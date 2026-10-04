# Changelog

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
