# Fahrtbriefing — Ballon-Fahrtvorbereitung

Stellt das Fahrtbriefing für Heissluft- und Gasballonfahrten zusammen: Stammdaten,
Sonnen- und Dämmerungszeiten (amtliche RAC-4-4-Tabelle für die Schweiz, sonst
astronomisch), Tragkraft-/Treibstoff- bzw. Ballastrechnung, Tagesplanung mit
Routing, Meteo- und Navigations-Panels mit Einfüge-Assistent, Briefingsicht zum
Drucken (A4), persönliche Links für Mitarbeit oder Lesen. Zweisprachig DE/EN.

**Live:** https://briefing.wicki.aero · **Repository:** https://github.com/bwicki/briefing
**Stack:** HTML/CSS/JS ohne Build-Schritt (GitHub Pages) + Cloudflare Worker mit D1
(Datenbank) und R2 (Bilder). Gestaltung, Tokens und Bedienidiom aus GaforCast/StueveCast.

> **Planungshilfe ohne Gewähr.** Flughandbuch (AFM) und amtliche Produkte
> (MeteoSchweiz/skybriefing, DWD, DABS/NOTAM) sind massgebend.

Stand: Phase 1 (Version 0.1.0). Die automatischen Meteo-Abrufe, DABS/NOTAM und
die KI-Hinweise folgen in Phase 2 (siehe Konzept v0.4 im Projektordner).

---

## Die App von oben nach unten

### Kennwortseite

Beim ersten Laden fragt die App ein Kennwort. Im **Server-Modus** prüft es der
Worker (Hash in der Datenbank, Startwert `1234`, Fehlversuche werden gebremst);
nach zwei Stunden ohne Benutzung wird wieder gefragt, Menü → *Sperren* sofort.
Das Kennwort wird in **Einstellungen → Experte** geändert — nach der
Inbetriebnahme bitte ein längeres setzen, weil die Briefings Pax-Namen enthalten.

Ist der Worker nicht erreichbar (oder in `js/config.js` keine Adresse eingetragen),
läuft die App im **lokalen Modus**: Daten bleiben im Browser dieses Geräts,
persönliche Links und Zugänge sind dann nicht verfügbar. Die Kopfzeile zeigt
das mit «Lokaler Modus» an.

### Übersicht «Briefings»

Alle Briefings mit Datum, Startort (ICAO-Kurzkoordinaten, Höhe), Ballon, Fahrttyp,
Phase (Vorplanung > 72 h, Planung 24–72 h, Final < 24 h), Status, Arbeitsversion und
Anzahl Links. Filter *Geplant / Alle / Archiv*, Suche. Rechts die nächste Fahrt mit
Sonnenzeiten. **⧉** dupliziert ein Briefing als Vorlage (gleicher Startort, Ballon,
Crew; Datum + 7 Tage; Meteo-Panels leer) und öffnet den Ablauf bei Schritt 6.

### Neues Briefing — geführter Ablauf

Sechs Schritte mit Zurück/Weiter (Eingabetaste = Weiter); der Entwurf wird laufend
gespeichert, *Als Entwurf speichern* verlässt den Ablauf.

1. **Ballon & Fahrt** — Heissluft (Kennung) oder Gas (Hülle × Korb), Typ der Fahrt,
   Lufttransportführer, Anlass.
2. **Ort & Zeit** — Favoriten-Chips, Ortssuche (Name oder «lat, lon»), Karte mit
   verschiebbarem Marker. Kurzkoordinaten, Höhe, Land und Zeitzone werden
   ermittelt (Open-Meteo, Nominatim); Datum, Startzeit, LT/UTC; Sonne/Dämmerung
   sofort, Warnung bei Nachtfahrt; Planungshorizont mit verfügbaren Modellen.
3. **Fahrtabsicht** — Dauer, Höhenband, Zielrichtung, Tag/Nacht, Trajektorien-
   Niveaus (Startwerte je Ballontyp aus den Einstellungen).
4. **Personen** — PIC, Nachfahrer, Pax (Name oder Platzhalter, Gewicht), Vorschau
   Tragkraft bzw. Ballast; Temperatur/QNH/Feuchte werden, wenn der Start innert
   15 Tagen liegt, aus dem Modell geholt.
5. **Tagesplanung** — Treffpunkt, Fahrzeit mit Anhänger (OSRM-Routing × Faktor +
   Zuschlag), Aufrüst-/Füllzeit, Tabelle mit überschreibbaren Zeiten.
6. **Prüfen** — Zusammenfassung und Pflicht-Panels; *Briefing anlegen*.

### Erarbeitungssicht

Links die Navigation A–D mit Status-Punkt je Panel (grün erledigt, blau
automatisch ab Phase 2, orange manuell offen, rot Pflicht offen), Mitte die Panels
in Druckreihenfolge, rechts Planungshorizont, Panel-Zähler und Protokoll. Im Kopf
die **Arbeitsversion** («v12 · Datum Zeit · Name»), der Status und die Phase.

Jedes Panel hat unter dem Inhalt drei einklappbare Blöcke: **Zusatzinfo** (eigene
Recherche: Text, Bilder, Links), **KI-Hinweis** (Phase 2) und **Kommentar**.

Panel-Arten:

* **Berechnet** — Stammdaten, Sonne/Mond, Tragkraft/Ballast (Eingaben Temperatur,
  QNH, Feuchte, Hüllentemperatur; Knopf «aus Modell übernehmen»; Tanks je Briefing
  änderbar), Tagesplanung (Routing, Überschreibungen mit ↺ zurücksetzen),
  Spezialausrüstung, Übergangshöhe (nach Land vorgekreuzt), Standard-Briefing PAX
  (Checkliste, AMC1 BOP.BAS.115, Zusatzpunkte Gasballon).
* **Einfüge-Assistent** (Meteo, DABS, NOTAM, SIGWX …) — *Quelle öffnen ↗* führt
  zur Quelle (Einstellungen → Quellen), das Feld nimmt Text per Tastatur und
  **Bilder aus der Zwischenablage** (Ctrl/Cmd-V, iPad «Einsetzen»), per Drag & Drop
  oder Datei. Bilder werden auf 1600 px verkleinert, im Server-Modus in R2
  abgelegt.
* **Text** — Landeorte, Bemerkungen, Flugplan, Absprachen, Briefingbedürfnisse.

**Freigeben als Final** prüft die Pflicht-Panels (Einstellungen → Panels & Pflicht);
fehlt etwas, kann mit Begründung trotzdem freigegeben werden (Protokoll). Jede
Freigabe wird als Final v1, v2 … mit Schnappschuss abgelegt.

### Briefingsicht und Druck

Das fertige Briefing wie im gedruckten Muster: Kopf mit Logo, Abschnitte A–D als
zweispaltige Tabellen, Zusatzinfo/KI-Hinweis/Kommentar unter dem Inhalt, Fuss mit
Version und Hinweis. **PDF / Drucken** nutzt den Browserdruck (A4 hoch; «Als PDF
sichern»). Auf dem Handy werden die Tabellen gestapelt.

### Berechtigungen (persönliche Links)

Je Briefing Personen mit Rolle **Mitarbeit** (alle Inhalte inkl. Pax-Namen ändern,
nicht löschen/freigeben/berechtigen) oder **Nur lesen** (Briefingsicht). Gültig bis
Fahrtdatum + 7 Tage (änderbar), widerrufbar, mit QR-Code (lokal erzeugt), WhatsApp-
und E-Mail-Weitergabe. Mitarbeit-Empfänger nennen beim ersten Öffnen ihren Namen;
Änderungen stehen mit Name/Zeit im Kopf und Protokoll. Nur im Server-Modus.

### Einstellungen

Allgemein (Sprache, Thema, Name im Protokoll, Expertenmodus), Ballone (Heissluft-
Profile mit Tanks; Gas: Hüllen und Körbe getrennt; Standardkombination), Personen,
Lufttransportführer, Startplätze & Treffpunkte, Fahrtabsicht-Startwerte, Zeitplan
(Anhänger-Faktor, Zuschlag, Puffer, Bergezeit), Sonne/RAC 4-4 (PDF-Upload, siehe
unten), Übergangshöhen, Go/No-Go-Kriterien (Ampel ab Phase 3), Panels & Pflicht,
Freigabe-Links, Zugänge (API-Schlüssel und Logins, nur Server-Modus, verschlüsselt),
Experte (Kennwort ändern, Reserve-Regel). *Export/Import JSON* sichert die
Einstellungen (ohne Zugänge).

---

## Rechenmodelle

* **Sonne/Dämmerung** — Schweiz: RAC 4-4 (VFR Manual, skyguide): BCMT, SR, SS, ECET
  in Lokalzeit, Referenz Sternwarte Bern, gültig für die FIR. Die mitgelieferte
  Tabelle (`data/rac/rac-ch.json`) deckt OCT 2026 – DEC 2027 ab; ein neues PDF wird
  in den Einstellungen hochgeladen und im Browser geparst (pdf.js). Ausserhalb der
  Schweiz und als Vergleich: astronomisch (NOAA-Verfahren, aus GaforCast).
  Mond: Auf-/Untergang, Phase, beleuchteter Anteil (Meeus, niedrige Genauigkeit).
* **Heissluft** — Excel-Modell «Tragkraft-, Massen- und Treibstoffberechnung» 1:1
  (ISA-Gradient ab Startplatz, barometrische Höhenformel ab QNH, Tragkraft/m³ =
  ρ·(T_H − T)/(273.15 + T_H), Tabelle je 100 m, Max. Steighöhe wie VLOOKUP − 100 m),
  erweitert um feuchte Luft (Magnus, optional), exakte Gleichgewichtshöhe,
  benötigte Hüllentemperatur, Treibstoffbedarf = (Dauer + Reserve) · Verbrauch mit
  Reserve = min(25 % · Dauer, 30 min) (einstellbar).
* **Gas** — Brutto-Auftrieb = V · (ρ_Luft − ρ_Gasgemisch) mit Gasdichte aus p, T
  und Reinheit; Ballast = Brutto-Auftrieb − Nettomasse; Kennzahlen Abkühlung je K,
  Ballast je 100 m, Ballast-Einheiten, Landereserve. Ein Excel-Modus reproduziert
  die Vorlage v2 exakt (Tests).
* **Tagesplanung** — Abfahrt = Start − Aufrüst-/Füllzeit − Fahrzeit − Puffer,
  Rundung auf 5 min; Landung = Start + Dauer; Hinweise bei BCMT/ECET-Konflikt.

`node test/calc.test.mjs` prüft diese Modelle gegen die Excel-Werte und die RAC-Tabelle.

---

## Woher die Daten kommen (Phase 1)

| Was | Quelle | Weg |
|---|---|---|
| Ortssuche, Höhe, Zeitzone, Modellwerte T/QNH/RH | Open-Meteo (Geocoding, Elevation, Forecast) | direkt aus dem Browser |
| Ortsname/Land zum Kartenpunkt | Nominatim / OpenStreetMap | direkt aus dem Browser |
| Fahrzeit | OSRM-Demo-Server (OpenStreetMap) | direkt aus dem Browser |
| Kartenkacheln | OpenStreetMap | direkt aus dem Browser |
| Sonne/Dämmerung CH | RAC 4-4 (skyguide) | `data/rac/rac-ch.json`, Upload in den Einstellungen |
| Briefings, Einstellungen, Links | eigener Worker (D1) | `js/config.js → apiBase` |
| Bilder | eigener Worker (R2) | unerratbare Dateischlüssel |

Phase 2 ergänzt: METAR/TAF, ECMWF-/DWD-Karten, DWD-Ballonwetterbericht und
Flugwetterübersicht (über GaforCast-Daten), meteoblue Images API, eigene Stüve-,
Meteogramm-, Windkarten- und Trajektorienprodukte, DABS, Strecken-NOTAM mit
VFR-Filter, KI-Hinweise je Panel.

---

## Betrieb

* **Frontend:** GitHub Pages aus `main` (Root). `CNAME` = `briefing.wicki.aero`.
* **Worker:** `worker/` (wrangler). Deployment automatisch über die GitHub Action
  `deploy-worker.yml` bei Änderungen unter `worker/` — Einrichtung in **SETUP.md**.
* **Konfiguration:** `js/config.js` enthält die Worker-Adresse (`apiBase`).
* **Sicherung:** `GET /api/export` (mit Sitzung) liefert alle Briefings und
  Einstellungen als JSON; Export-Knopf in der App folgt in Phase 3.
* **RAC-Tabelle:** jährlich das neue RAC-4-4-PDF in den Einstellungen hochladen.

## Versionierung

`js/version.js` ist die eine Stelle für die Versionsnummer (Semantic Versioning);
beim Release zusätzlich `CHANGELOG.md` nachführen (und ab Phase 3 `sw.js`).

## Dateien

```
index.html                 App-Hülle (Kennwortseite, Kopfzeile, Ansichten)
css/base.css               Token-Satz und Komponenten (GaforCast-Familie)
css/app.css                Layout, Ablauf, Editor, Briefingsicht, Handy/iPad
css/print.css              Druck A4
js/config.js               Worker-Adresse
js/app.js                  Kennwortseite, Menü, Routing
js/store.js                Datenhaltung: Worker (remote) oder localStorage (lokal)
js/model.js                Briefing-Datensatz, abgeleitete Grössen
js/defaults.js             Standard-Einstellungen und Stammdaten
js/panels.js               Panel-Register A–D
js/i18n.js                 Oberflächentexte DE/EN
js/net.js                  Open-Meteo, Nominatim, OSRM
js/calc/*.js               Sonne/Mond, RAC-Parser, Aerostatik, Zeitplan, Geo, Zeit
js/ui/*.js                 Liste, Ablauf, Erarbeitung, Briefingsicht, Einstellungen, Links
js/vendor/                 Leaflet (BSD-2), qrcode-generator (MIT)
data/rac/rac-ch.json       RAC 4-4 OCT 2026 – DEC 2027
worker/                    Cloudflare Worker (src/index.js, schema.sql, wrangler.toml)
test/                      Rechentests (node) und Oberflächen-Durchläufe (Playwright)
```

## Lizenz

Siehe `LICENSE`. Drittkomponenten: Leaflet (BSD-2-Clause), qrcode-generator (MIT),
pdf.js (Apache-2.0, nur beim RAC-Upload von cdnjs geladen). Logo und Name
«Wicki Partners Ballonteam» sind nicht Teil der Lizenz.
