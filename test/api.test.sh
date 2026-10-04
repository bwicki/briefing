#!/usr/bin/env bash
# API-Durchlauf gegen einen laufenden Worker (wrangler dev --local, Port 8787).
set -e
A=${1:-http://localhost:8787}
j() { curl -s -H 'Content-Type: application/json' "$@"; }
echo "# health"; j $A/api/health; echo
echo "# falsches Kennwort"; j -X POST $A/api/session -d '{"password":"0000"}'; echo
echo "# Login 1234"; TOK=$(j -X POST $A/api/session -d '{"password":"1234"}' | sed -E 's/.*"token":"([^"]+)".*/\1/'); echo "token ${TOK:0:20}…"
H="Authorization: Bearer $TOK"
echo "# Settings leer"; j -H "$H" $A/api/settings; echo
echo "# Settings speichern"; j -H "$H" -X PUT $A/api/settings -d '{"settings":{"ownerName":"B. Wicki","lang":"de"}}'; echo
echo "# Secret"; j -H "$H" -X PUT $A/api/secrets -d '{"name":"openmeteo","value":"abc123"}'; j -H "$H" $A/api/secrets; echo
echo "# Briefing anlegen"; j -H "$H" -X PUT $A/api/briefings/test00000001 -d '{"briefing":{"id":"test00000001","status":"draft","time":{"startMs":1791100800000},"site":{"name":"Oberlunkhofen","tz":"Europe/Zurich","icao":"4719N00824E","elev":461},"balloon":{"label":"HB-QWZ","reg":"HB-QWZ"},"flight":{"kind":"commercial"},"panels":{},"log":[]},"who":"test"}'; echo
echo "# Liste"; j -H "$H" $A/api/briefings; echo
echo "# Link erstellen"; LINK=$(j -H "$H" -X POST $A/api/briefings/test00000001/access -d '{"person":"Martin","role":"edit","expiresAt":1900000000000}'); echo "$LINK"; T=$(echo "$LINK" | sed -E 's/.*"token":"([^"]+)".*/\1/')
echo "# Shared GET"; j "$A/api/shared/$T?who=Martin" | head -c 300; echo
echo "# Shared PUT"; j -X PUT "$A/api/shared/$T" -d '{"briefing":{"id":"test00000001","status":"final","time":{"startMs":1791100800000},"site":{"name":"Oberlunkhofen","tz":"Europe/Zurich"},"balloon":{"label":"HB-QWZ","reg":"HB-QWZ"},"flight":{"kind":"commercial"},"panels":{"A.landing":{"content":{"text":"Wohlen"}}},"log":[]},"who":"Martin"}'; echo
echo "# Status bleibt draft (Mitarbeit darf nicht freigeben)"; j -H "$H" $A/api/briefings/test00000001 | grep -o '"status":"[a-z]*"'
echo "# Bild hochladen"; PNG="iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=="; UP=$(j -H "$H" -X POST $A/api/briefings/test00000001/files -d "{\"dataUrl\":\"data:image/png;base64,$PNG\"}"); echo "$UP"; U=$(echo "$UP" | sed -E 's/.*"url":"([^"]+)".*/\1/'); curl -s -o /dev/null -w "file GET %{http_code} %{content_type}\n" "$A$U"
echo "# Link widerrufen"; curl -s -o /dev/null -w "%{http_code}\n" -H "$H" -X DELETE $A/api/briefings/test00000001/access/$T; j "$A/api/shared/$T"; echo
echo "# Kennwort ändern"; j -H "$H" -X POST $A/api/password -d '{"oldPassword":"1234","newPassword":"5678"}'; j -X POST $A/api/session -d '{"password":"1234"}'; echo; j -X POST $A/api/session -d '{"password":"5678"}' | head -c 40; echo
echo "# zurück auf 1234"; TOK2=$(j -X POST $A/api/session -d '{"password":"5678"}' | sed -E 's/.*"token":"([^"]+)".*/\1/'); j -H "Authorization: Bearer $TOK2" -X POST $A/api/password -d '{"oldPassword":"5678","newPassword":"1234"}'; echo
echo "# Export"; j -H "$H" $A/api/export | head -c 200; echo
echo "# ohne Token"; curl -s -o /dev/null -w "%{http_code}\n" $A/api/briefings
echo "# löschen"; curl -s -o /dev/null -w "%{http_code}\n" -H "$H" -X DELETE $A/api/briefings/test00000001
echo "# --- Datenabrufe (/api/wx) ---"
TOK=$(j -X POST $A/api/session -d '{"password":"1234"}' | sed -E 's/.*"token":"([^"]+)".*/\1/'); H="Authorization: Bearer $TOK"
echo "# wx ohne Token → 401"; curl -s -o /dev/null -w "%{http_code}\n" "$A/api/wx/metar?lat=47.3&lon=8.4"
echo "# om ungültige Query → 400"; curl -s -w " %{http_code}\n" -H "$H" "$A/api/wx/om?query=foo"
echo "# notam ohne Zugang → 424"; curl -s -w " %{http_code}\n" -H "$H" "$A/api/wx/notam?lat=47.3&lon=8.4"
echo "# ai ohne Zugang → 424"; curl -s -w " %{http_code}\n" -H "$H" -X POST "$A/api/wx/ai" -d '{"prompt":"x"}'
echo "# snapshot fremder Host → 400"; curl -s -w " %{http_code}\n" -H "$H" -X POST "$A/api/wx/snapshot?b=test00000001" -d '{"url":"https://example.com/x.png"}'
echo "# unbekannt → 404"; curl -s -o /dev/null -w "%{http_code}\n" -H "$H" "$A/api/wx/foo"
echo "# Link-Nutzer (read) darf dabs nicht → 403 (nach Anlage eines Links)"
j -H "$H" -X PUT $A/api/briefings/test00000002 -d '{"briefing":{"id":"test00000002","status":"draft","time":{"startMs":1791100800000},"site":{"name":"X","tz":"Europe/Zurich"},"balloon":{"label":"HB-QWZ","reg":"HB-QWZ"},"flight":{"kind":"private"},"panels":{},"log":[]},"who":"test"}' > /dev/null
T2=$(j -H "$H" -X POST $A/api/briefings/test00000002/access -d '{"person":"Leser","role":"read","expiresAt":1900000000000}' | sed -E 's/.*"token":"([^"]+)".*/\1/')
curl -s -o /dev/null -w "%{http_code}\n" "$A/api/wx/dabs?t=$T2"
echo "# Link-Nutzer darf metar (Abruf extern, hier Netz evtl. gesperrt → 200 oder 500)"; curl -s -o /dev/null -w "%{http_code}\n" "$A/api/wx/metar?lat=47.3&lon=8.4&t=$T2"
curl -s -o /dev/null -w "%{http_code}\n" -H "$H" -X DELETE $A/api/briefings/test00000002
