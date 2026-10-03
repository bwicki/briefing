# Einrichtung — Frontend (GitHub Pages) und Worker (Cloudflare)

Dauer beim ersten Mal etwa 30 Minuten. Reihenfolge einhalten; jeder Schritt ist
einzeln prüfbar. Schlüssel und Kennwörter nie in Dateien des Repositories
schreiben und nie im Chat weitergeben.

## 1 Frontend auf GitHub Pages

1. Repository `bwicki/briefing`: Settings → Pages → Source «Deploy from a branch»,
   Branch `main`, Ordner `/ (root)`. Die Datei `CNAME` (`briefing.wicki.aero`)
   liegt bereits im Repository.
2. DNS für wicki.aero (Cloudflare): `CNAME briefing → bwicki.github.io`, Proxy
   **aus** (graue Wolke), bis GitHub das Zertifikat ausgestellt hat.
3. Settings → Pages → Custom domain `briefing.wicki.aero`, nach «DNS check
   successful» **Enforce HTTPS** aktivieren.
4. Prüfung: https://briefing.wicki.aero öffnet die Kennwortseite; solange der
   Worker fehlt, erscheint «Lokaler Modus» in der Kopfzeile (Kennwort 1234).

## 2 Cloudflare-Konto vorbereiten

1. Dashboard → rechts oben Account-ID kopieren (für die GitHub Action).
2. API-Token erstellen: My Profile → API Tokens → Create Token → Vorlage
   «Edit Cloudflare Workers»; zusätzlich die Berechtigungen **D1 → Edit** und
   **Workers R2 Storage → Edit** ergänzen. Token kopieren (wird nur einmal gezeigt).
3. Im GitHub-Repository: Settings → Secrets and variables → Actions → New
   repository secret: `CLOUDFLARE_API_TOKEN` (das Token) und
   `CLOUDFLARE_ACCOUNT_ID` (die Account-ID).

## 3 Datenbank und Bucket anlegen (einmalig, lokal mit wrangler)

Auf einem Rechner mit Node 20+:

```bash
cd worker
npm install
npx wrangler login                      # Browser-Anmeldung bei Cloudflare
npx wrangler d1 create briefing         # Ausgabe: database_id
```

Die ausgegebene `database_id` in `worker/wrangler.toml` eintragen (Platzhalter
ersetzen), dann:

```bash
npx wrangler r2 bucket create briefing-files
npx wrangler d1 execute briefing --remote --file=schema.sql
```

## 4 Geheimnisse des Workers setzen

```bash
openssl rand -base64 48 | npx wrangler secret put SESSION_SECRET
openssl rand -base64 32 | npx wrangler secret put ENC_KEY
```

`SESSION_SECRET` signiert die Sitzungen, `ENC_KEY` (genau 32 Bytes, base64)
verschlüsselt die Zugänge in der Datenbank. Beide Werte sicher ablegen
(Passwortmanager) — ohne `ENC_KEY` sind gespeicherte Zugänge nicht mehr lesbar.

## 5 Worker veröffentlichen

Entweder lokal `npx wrangler deploy` oder die geänderte `wrangler.toml` nach
`main` pushen — die GitHub Action `Deploy worker` deployt automatisch
(Actions-Tab zeigt den Lauf). Ergebnis: `https://briefing-api.<account>.workers.dev`.

Prüfung: `https://briefing-api.<account>.workers.dev/api/health` liefert
`{"ok":true,…}`.

## 6 Eigene Domain für den Worker

Dashboard → Workers & Pages → `briefing-api` → Settings → Domains & Routes →
**Add → Custom domain** `api.briefing.wicki.aero`. Cloudflare legt den DNS-Eintrag
und das Zertifikat an. Prüfung: `https://api.briefing.wicki.aero/api/health`.

`js/config.js` enthält bereits `apiBase: 'https://api.briefing.wicki.aero'`; wird
eine andere Adresse verwendet, dort eintragen und pushen.

## 7 Erste Anmeldung

1. https://briefing.wicki.aero öffnen — die Kopfzeile zeigt jetzt **nicht** mehr
   «Lokaler Modus».
2. Kennwort `1234`, dann **Einstellungen → Experte → Kennwort ändern** (längeres
   Kennwort wählen).
3. Einstellungen → Zugänge: API-Schlüssel (Open-Meteo, meteoblue, Anthropic …) und
   Logins eintragen; sie werden verschlüsselt im Worker gespeichert.
4. Einstellungen → Ballone/Personen/Startplätze prüfen (Platzhalter sind markiert),
   speichern.
5. Daten aus dem lokalen Modus werden nicht automatisch übernommen — Briefings dort
   neu anlegen (Phase 1 ist dafür gedacht, mit dem Server zu beginnen).

## 8 Laufender Betrieb

* **RAC 4-4:** jedes Jahr das neue PDF aus dem eVFR-Manual unter
  Einstellungen → Sonne / RAC 4-4 hochladen.
* **Sicherung:** `GET https://api.briefing.wicki.aero/api/export` mit dem
  Sitzungs-Token liefert alle Briefings als JSON (Export-Knopf in Phase 3).
* **Limits (Cloudflare Free):** D1 5 Mio. Zeilen-Lesungen/Tag, 100 000
  Schreibungen/Tag, R2 10 GB — für Briefings weit ausreichend; bei Bedarf Workers
  Paid (5 $/Monat).
* **Lokale Entwicklung:** `cd worker && npm run db:local && npm run dev` (Port 8787)
  und im Repository-Root `python3 -m http.server 8080`; `js/config.js` auf
  `http://localhost:8787` stellen oder die Tests unter `test/` verwenden.

## 9 Was im Dashboard noch sinnvoll ist

* Workers & Pages → `briefing-api` → Observability: Logs bei Fehlern.
* D1 → `briefing` → Time Travel: Wiederherstellung auf einen Zeitpunkt der letzten
  30 Tage (Free: 7 Tage).
