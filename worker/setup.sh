#!/usr/bin/env bash
# Fahrtbriefing — Worker einrichten (macOS/Linux). Gegenstück zu setup.ps1.
#   cd worker && bash setup.sh
# Wiederholbar; öffnet einmal den Browser für «wrangler login».
set -euo pipefail
cd "$(dirname "$0")"
step() { printf '\n== %s\n' "$1"; }

step 'npm install'; npm install --no-audit --no-fund >/dev/null

step 'Cloudflare-Anmeldung'
WHO=$(npx wrangler whoami 2>&1 || true)
echo "$WHO" | grep -qiE 'Account ID|logged in' || { npx wrangler login; WHO=$(npx wrangler whoami 2>&1); }
ACCOUNT_ID=$(echo "$WHO" | grep -oE '[0-9a-f]{32}' | head -1 || true)
echo "Account-ID: ${ACCOUNT_ID:-?}"

step 'D1-Datenbank «briefing»'
DB_ID=$(npx wrangler d1 list --json 2>/dev/null | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{const j=JSON.parse(s);const x=j.find(d=>d.name==="briefing");console.log(x?x.uuid:"")}catch{console.log("")}})' || true)
if [ -z "$DB_ID" ]; then
  OUT=$(npx wrangler d1 create briefing 2>&1 || true)
  DB_ID=$(echo "$OUT" | grep -oE '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}' | head -1 || true)
fi
[ -n "$DB_ID" ] || { echo 'database_id nicht ermittelbar'; exit 1; }
sed -i.bak -E "s/database_id *= *\"[^\"]*\"/database_id = \"$DB_ID\"/" wrangler.toml && rm -f wrangler.toml.bak
echo "database_id = $DB_ID"

step 'R2-Bucket «briefing-files»'
npx wrangler r2 bucket list 2>&1 | grep -q briefing-files || npx wrangler r2 bucket create briefing-files >/dev/null
echo ok

step 'Schema'; npx wrangler d1 execute briefing --remote --file=schema.sql >/dev/null; echo ok

step 'Secrets'
EXISTING=$(npx wrangler secret list 2>&1 || true)
: > .secrets.local.txt; echo "Fahrtbriefing Worker-Secrets $(date -u +%FT%TZ) — in den Passwortmanager übernehmen, Datei löschen." >> .secrets.local.txt
for NAME in SESSION_SECRET ENC_KEY; do
  if echo "$EXISTING" | grep -q "$NAME"; then echo "$NAME bereits gesetzt"; continue; fi
  if [ "$NAME" = ENC_KEY ]; then VAL=$(openssl rand -base64 32); else VAL=$(openssl rand -base64 48); fi
  printf '%s' "$VAL" | npx wrangler secret put "$NAME" >/dev/null
  echo "$NAME=$VAL" >> .secrets.local.txt; echo "$NAME gesetzt"
done

step 'Deploy'; DEP=$(npx wrangler deploy 2>&1); echo "$DEP"
URL=$(echo "$DEP" | grep -oE 'https://[a-z0-9.-]+\.workers\.dev' | head -1 || true)

step 'Nächste Schritte'
cat <<EOF
1. Prüfen: ${URL:-<workers.dev-URL>}/api/health
2. Eigene Domain: Dashboard → Workers & Pages → briefing-api → Settings → Domains & Routes → Custom domain api.briefing.wicki.aero
3. GitHub → Settings → Secrets → Actions: CLOUDFLARE_ACCOUNT_ID = ${ACCOUNT_ID:-?}, CLOUDFLARE_API_TOKEN = (My Profile → API Tokens → «Edit Cloudflare Workers» + D1 Edit + R2 Edit)
4. GitHub → Settings → Actions → General → Workflow permissions: «Read and write» (DWD-Abruf-Workflow)
5. git add worker/wrangler.toml && git commit -m "database_id" && git push
6. https://briefing.wicki.aero öffnen, Kennwort 1234 → Einstellungen → Experte → Kennwort ändern; Zugänge eintragen.
EOF
