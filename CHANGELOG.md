# Changelog

## 0.5.1 — 2026-10-04

* Material-Links für Externe: Materialeigner ohne Konto sehen über einen Link
  (`#/m/<token>`, 1 Jahr, widerrufbar) alle Briefings mit ihren Kennungen —
  Liste, Briefingsicht, Pax-Karte, nur lesen (Tabelle `material_links`).
* Neue Benutzer ohne «Stamm kopieren von» starten mit dem Beispiel-Stamm der App.
* Fix: Flugwetterprognose DE warf bei GAFOR-Perioden ohne bekannten Code einen
  Fehler (leere CSS-Klasse); `h()` ignoriert leere Klassensegmente.
* Einrichtung ohne lokalen Rechner: GitHub-Workflow «Setup worker» (D1, R2,
  Schema/Migration, Deploy, Secrets, `database_id` und workers.dev-Adresse in
  `js/config.js`); `ENC_KEY` darf jede Zeichenkette ab 32 Zeichen sein.

## 0.5.0 — 2026-10-04 · Mehrbenutzer

* Benutzer mit Rollen Supermaster/Master (Anmeldename + Kennwort, Sitzung je
  Benutzer): eigener Stamm, eigene Briefings, eigenes Kennwort je Master; Zugänge
  (API-Schlüssel) zentral, nur Supermaster ändert sie; Freischaltungen KI/NOTAM/PDF
  je Benutzer.
* Freigaben per Klickbox je Kategorie (Ballone, Personen, Startplätze, Treffpunkte,
  Betreiber); freigegebene Einträge im Ablauf mit Geber; Eigner sieht «Fahrten mit
  meinem Material» lesend (Ballonbuch).
* Supermaster: Benutzer anlegen (Stamm kopieren), Kennwort setzen, deaktivieren,
  Stamm ansehen, Sicht «Alle Benutzer» (nur lesen), Export aller Benutzer,
  Nutzungsstatistik (je Benutzer/Monat, Fahrten je Ballon, Speicher; CSV).
* Worker: Tabellen `users`, `shares`, `usage`; `briefings.owner_id/material_owner`
  (`migrate-0.5.sql`); `/api/me`, `/api/users`, `/api/shares`, `/api/admin/*`,
  `?scope=` für Listen; Mitarbeit-Links und Datenabrufe protokolliert.
* Fix: `aria-pressed` wurde als leeres Attribut gesetzt (Chips ohne Markierung).

## 0.4.0 — 2026-10-04 · Phase 3

* Hauptnavigation Briefings · Neu · Einstellungen in jeder Sicht; Einstellungs-
  Kategorien auf Handy als scrollbare Zeile; Editor/Dialoge auf Handy ohne
  horizontales Überlaufen (Grid-Fix).
* Tendenz (Modell) aus Stundenampel + Go/No-Go-Kriterien; Änderungen seit Final;
  Gesamteinschätzung (KI); Pax-Sicherheitskarte; Crew-Nachricht & .ics; Final-PDF
  (Browser Rendering oder Upload); Export JSON; PWA/Service Worker; Luftraum-Overlay.
* Eigener DWD-/METAR-Abruf (GitHub Action, `scripts/fetch-dwd.mjs` aus GaforCast)
  nach `data/dwd/`; GaforCast-Kopie nur noch als Rückfall.
* Setup-Skripte `worker/setup.ps1` / `setup.sh` (nur noch `wrangler login`).

## 0.3.0 — 2026-10-04 · Phase 2

* Automatische Panels mit Schnappschuss (Stand/Modell/Quelle, Druck, Leselink):
  Meteogramm, Windprofil, Temps (Stüve), Trajektorien (Niveaus, Dauer, Startversatz,
  Skizze + Karte + Tabelle), Ballonprognose (DWD-Gebietsvorhersage DE + eigene
  Stundentabelle mit Ampel), Druckdifferenz (Bise/Föhn), METAR/TAF der nächsten
  Plätze, SIGMET/AIRMET, Flugwetterprognose DE (DWD Flugwetterübersicht + GAFOR),
  Allgemeine Lage (DWD-/ECMWF-Karten als Schnappschuss), Radar live, DABS (PDF →
  Seitenbilder), Strecken-NOTAM (FAA) mit Korridor und VFR-Filter.
* Modell-Leiste (Modellwahl je Horizont, «Alle aktualisieren»), Ampel-Grenzen und
  weitere Vorgaben in Einstellungen → Meteo & Auto-Panels.
* KI-Hinweis je Panel (Prompt sichtbar, Anthropic über Worker, editierbar).
* Worker: `/api/wx/*` (Open-Meteo mit Schlüssel, AWC, DWD-Kopie, DABS, Schnappschuss,
  NOTAM, KI) mit Cache; Dateien auch PDF.
* Eigenes Favicon «Checkliste» (SVG, ICO, Apple-Touch, PWA-Icons); fünf Varianten unter `icons/variants`.
* pdf.js vendored (RAC-Upload, DABS). Fix: Briefingsicht ausserhalb CH (Sonnenzeile).
* Tests: 90 Rechenprüfungen, UI-Durchläufe CH und DE mit synthetischem Open-Meteo.

## 0.2.0 — 2026-10-04

* Ortswahl-Fenster (Karte, Suche nach Ort/Adresse/Koordinaten/ICAO/Google-Maps-Link,
  eigener Standort) für Startort, Treffpunkt, geplanten Landeraum und die
  Stammdaten in den Einstellungen; Ausgabe überall als Name · ICAO-Kurzkoordinaten ·
  Höhe · Google-Maps-Link (neues Fenster, im PDF klickbar).
* Neues Feld «Geplanter Landeraum» (Fahrtabsicht, Panel A «Geplante Landeorte») mit
  Distanz und Kurs ab Startort.
* Lizenz: «Alle Rechte vorbehalten – Nutzung nur mit Zustimmung und Quellenangabe»
  (ersetzt Unlicense).

## 0.1.0 — 2026-10-04 · Phase 1

* Kennwortseite (Prüfung im Worker; lokaler Modus ohne Server), Sperre nach 2 h.
* Geführter Ablauf «Neues Briefing» in sechs Schritten (Ballon & Fahrt, Ort & Zeit
  mit Karte und Ortssuche, Fahrtabsicht, Personen mit Tragkraft-Vorschau,
  Tagesplanung mit Routing, Prüfen).
* Erarbeitungssicht mit Navigation A–D, Status je Panel, Zusatzinfo/KI-Hinweis/
  Kommentar, Einfüge-Assistent für Text und Bilder, Arbeitsversion im Kopf,
  Freigabe-Checkliste mit Final-Versionen.
* Briefingsicht nach dem Muster «Briefing 2026», Druck A4, Handy-Darstellung.
* Berechnungen: Sonne/Dämmerung (RAC 4-4 CH, astronomisch), Mond, Tragkraft
  Heissluft (Excel-Modell + Erweiterungen), Ballast Gasballon, Tagesplanung.
* Einstellungen: Ballone als Komponenten (Heissluft, Hüllen, Körbe), Personen,
  Lufttransportführer, Startplätze/Treffpunkte, Fahrtabsicht-Startwerte, Zeitplan,
  RAC-PDF-Upload, Übergangshöhen, Go/No-Go-Kriterien, Panels & Pflicht, Links,
  Zugänge (verschlüsselt), Experte (Kennwort, Reserve-Regel).
* Persönliche Links (Mitarbeit / Nur lesen) mit Ablauf, Widerruf, QR, WhatsApp, E-Mail.
* Cloudflare Worker: Sitzung, Einstellungen, Zugänge, Briefings (D1), Links,
  Bilder (R2), Export; GitHub Action für das Deployment.
* Tests: `test/calc.test.mjs` (70 Prüfungen gegen Excel und RAC),
  `test/api.test.sh`, `test/ui.smoke.py`, `test/ui.remote.py`.
