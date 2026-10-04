# Fahrtbriefing — Worker einrichten (Windows PowerShell)
#
# Voraussetzung: Node 22+ (https://nodejs.org). Aufruf im Ordner worker\:
#   powershell -ExecutionPolicy Bypass -File .\setup.ps1
# Das Skript ist wiederholbar: Vorhandenes wird erkannt und übersprungen.
# Es öffnet einmal den Browser für «wrangler login» (Cloudflare-Konto).
#
# Was es tut: npm install → Login → D1-Datenbank «briefing» (ID in wrangler.toml)
# → R2-Bucket «briefing-files» → Schema → Secrets SESSION_SECRET/ENC_KEY (zufällig,
# in .secrets.local.txt abgelegt, gitignored) → Deploy → Hinweise für Domain und
# GitHub-Secrets.

$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot

function Step($t) { Write-Host "`n== $t" -ForegroundColor Cyan }

Step 'npm install'
npm install --no-audit --no-fund | Out-Null

Step 'Cloudflare-Anmeldung'
$who = (npx wrangler whoami 2>&1 | Out-String)
if ($who -notmatch 'Account ID|You are logged in') { npx wrangler login; $who = (npx wrangler whoami 2>&1 | Out-String) }
$accountId = ([regex]::Match($who, '([0-9a-f]{32})')).Groups[1].Value
Write-Host "Account-ID: $accountId"

Step 'D1-Datenbank «briefing»'
$list = (npx wrangler d1 list --json 2>$null | Out-String)
$dbId = $null
if ($list) { try { $dbId = (($list | ConvertFrom-Json) | Where-Object { $_.name -eq 'briefing' } | Select-Object -First 1).uuid } catch {} }
if (-not $dbId) {
  $out = (npx wrangler d1 create briefing 2>&1 | Out-String)
  $dbId = ([regex]::Match($out, 'database_id\s*=\s*"([0-9a-f-]{36})"')).Groups[1].Value
  if (-not $dbId) { $dbId = ([regex]::Match($out, '([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})')).Groups[1].Value }
}
if (-not $dbId) { throw 'database_id nicht ermittelbar – Ausgabe von «wrangler d1 create briefing» prüfen.' }
$toml = Get-Content wrangler.toml -Raw
$toml = [regex]::Replace($toml, 'database_id\s*=\s*"[^"]*"', "database_id = `"$dbId`"")
Set-Content wrangler.toml $toml -NoNewline
Write-Host "database_id = $dbId (in wrangler.toml eingetragen)"

Step 'R2-Bucket «briefing-files»'
$buckets = (npx wrangler r2 bucket list 2>&1 | Out-String)
if ($buckets -notmatch 'briefing-files') { npx wrangler r2 bucket create briefing-files | Out-Null }
Write-Host 'ok'

Step 'Schema anlegen'
npx wrangler d1 execute briefing --remote --file=schema.sql | Out-Null
# bestehende Datenbank (vor 0.5.0): Spalten owner_id/material_owner nachziehen
$null = npx wrangler d1 execute briefing --remote --command "SELECT owner_id FROM briefings LIMIT 1" 2>&1
if ($LASTEXITCODE -ne 0) { Write-Host 'Migration 0.5 ...'; npx wrangler d1 execute briefing --remote --file=migrate-0.5.sql | Out-Null }
Write-Host 'ok'

Step 'Secrets'
$secretsFile = Join-Path $PSScriptRoot '.secrets.local.txt'
$existing = (npx wrangler secret list 2>&1 | Out-String)
function Rand($bytes) { $b = New-Object byte[] $bytes; [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($b); [Convert]::ToBase64String($b) }
$lines = @("Fahrtbriefing Worker-Secrets, erzeugt $(Get-Date -Format s) — in den Passwortmanager übernehmen und diese Datei löschen.")
foreach ($name in @('SESSION_SECRET', 'ENC_KEY')) {
  if ($existing -match $name) { Write-Host "$name bereits gesetzt – unverändert"; continue }
  $val = if ($name -eq 'ENC_KEY') { Rand 32 } else { Rand 48 }
  $val | npx wrangler secret put $name | Out-Null
  $lines += "$name=$val"
  Write-Host "$name gesetzt"
}
if ($lines.Count -gt 1) { Set-Content $secretsFile ($lines -join "`n"); Write-Host "Werte in $secretsFile abgelegt (gitignored)." -ForegroundColor Yellow }

Step 'Deploy'
$dep = (npx wrangler deploy 2>&1 | Out-String)
Write-Host $dep
$url = ([regex]::Match($dep, 'https://[a-z0-9.-]+\.workers\.dev')).Value

Step 'Nächste Schritte'
Write-Host "1. Prüfen: $url/api/health"
Write-Host '2. Eigene Domain: Dashboard → Workers & Pages → briefing-api → Settings → Domains & Routes → Custom domain api.briefing.wicki.aero'
Write-Host "3. GitHub → Settings → Secrets → Actions: CLOUDFLARE_ACCOUNT_ID = $accountId, CLOUDFLARE_API_TOKEN = (My Profile → API Tokens → «Edit Cloudflare Workers» + D1 Edit + R2 Edit)"
Write-Host '4. GitHub → Settings → Actions → General → Workflow permissions: «Read and write» (für den DWD-Abruf-Workflow)'
Write-Host '5. git add worker/wrangler.toml && git commit -m "database_id" && git push'
Write-Host '6. https://briefing.wicki.aero öffnen, Kennwort 1234, dann Einstellungen → Experte → Kennwort ändern; Zugänge eintragen.'
