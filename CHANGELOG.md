# Changelog

## 0.8.0 — 2026-10-04 · Luftraum entlang des Fahrtwegs

* Neues Panel «Luftraum entlang des Fahrtwegs» (Abschnitt C, vor DABS): Lufträume aus
  openAIP für die berechneten Trajektorien — je Luftraum *durchfahren* (Bahn innerhalb und
  Untergrenze unter der geplanten Maximalhöhe; km ab Start und ETA je Bahn), *nahe* (im
  Korridor, Standard 5 km, Einstellungen → Meteo) oder *oberhalb der Maximalhöhe*
  (eingeklappt); Typ und ICAO-Klasse, Unter-/Obergrenze (GND/AGL/ft/FL), Hinweis je Typ
  (CTR-Freigabe, Transponder, Hörbereitschaft, Aktivierung per NOTAM, Frequenzen);
  FIR-Folge je Bahn mit Wechselpunkt (km, LT) als Vorarbeit für den Flugplan; Karte mit
  Polygonen und Bahnen (Bildschirm, mit openAIP-Overlay) und Nord-oben-Skizze (Druck);
  Text für KI-Hinweis und Leselink. Lädt im Server-Modus von selbst nach den Trajektorien.
* Worker `GET /api/wx/airspace?bbox=…` (openAIP Core API, Schlüssel `openaip` unter Zugänge
  oder Kachel-Schlüssel der Overlay-URL, 6 h Cache); Analyse im Browser
  (`js/calc/airspace.js`, 12 neue Tests).
* SETUP: Anleitung für den openAIP-Schlüssel.

## 0.7.1 — 2026-10-04 · Antworten auf die offenen Fragen

* Webcams europaweit automatisch: der Worker sucht Kameras im Umkreis des Startplatzes
  (und des Landeraums, wenn er weiter weg liegt) in öffentlichen Quellen — Windy
  Webcams API v3 (Schlüssel «Windy Webcams key» unter Zugänge, Vorschaubild im Popup)
  und OpenStreetMap/Overpass (ohne Schlüssel, als Webcam erfasste Punkte mit Adresse);
  Umkreis in Einstellungen → Meteo (Standard 40 km), eigene Liste bleibt zusätzlich;
  Radar-Panel mit aufklappbarer Liste (Distanz, Ort). `GET /api/wx/webcams?lat&lon&km`.
* Grosswetteranalyse: Österreich über die ORF/GeoSphere-Prognoseseite (geprüft);
  MeteoSchweiz und Aeronautica Militare liefern ihren Text nur per JavaScript —
  Einträge ohne «abrufen» erscheinen im Panel als Link; Haken «abrufen» je Eintrag.
* Thermik-Klassen (w*-Grenzen und Einsetzen) unter Einstellungen → Experte
  einstellbar, Standard wie bisher (0.6 / 1.2 / 2.0 / 3.0, Einsetzen 1.0 m/s).
* SETUP: Anleitung für den Windy-Webcams-Schlüssel.

## 0.7.0 — 2026-10-04 · Zweite Rückmeldungsrunde

* Tagesplanung neu: Etappen (mehrere Treffpunkte/Zwischenhalte) mit «+», Ort, Fahrzeit
  je Etappe (Routing), Umsortieren per Ziehen oder ▲▼; Zeiten rückwärts vom Start,
  jede Zeile pinbar (Ankunft ändern → Treffpunkte rückgerechnet, ↺ hebt Pin auf);
  Ablauf und Erarbeitung teilen denselben Editor.
* Einheitliches «+»-Kästchen hinter der Beschriftung für neue Einträge (Nachfahrer, Pax,
  Etappen, Dokumente, alle Stammlisten in den Einstellungen).
* Ablauf: «Wer ist dabei?», «Pflicht-Inhalt», Vorschau Tragkraft zweizeilig mit 2×4
  Werten (Propan-Bedarf, Fahrdauer m/Reserve, Treibstoffreserve), Schritt 6 Karten
  direkt untereinander in zwei Spalten, Sonnen-Label «amtlich (LSAS, RAC 4-4)».
* Tragkraft-Panel: Resultat Höhe/Hüllentemperatur als 2×3 Felder links, Kurve rechts
  klein; «Propan-Zylinder».
* Ballone: Feld «Muster» (z. B. BB26E) und Transponder-Hexcode, im Briefingkopf als
  «HB-QWZ · BB26E (4c4b4)»; Dokumente je Ballon und Person (Typ aus Standardliste,
  Bezeichnung, gültig bis, Datei PDF/Bild in der Worker-Ablage R2, `POST /api/docs`);
  Standardlisten unter Einstellungen → Experte; abgelaufene Dokumente ⚠ im Stammdaten-
  Panel.
* Panels: Werkzeugleiste einzeilig und klein; Quelle als kleiner Link rechts im
  Titelbalken (gekürzt).
* METAR/TAF: Umkreis direkt im Panel (lädt neu), Richtungspfeil zum Platz,
  Schlechtwetter rot (Wind/Böen ≥ 14 kt, Sicht < 5 km, Niederschlag/Nebel/Gewitter,
  Basis BKN/OVC ≤ 1500 ft, CB/TCU) in RAW und Klartext.
* Temps und Windprognose: Zahlen links, Grafik rechts.
* Trajektorien: Landeraum als grüner Punkt verschiebbar (oder Klick), setzt Landeraum
  und Zielrichtung; Stammdaten-Panel folgt.
* Neues Panel «Thermik»: eigene Abschätzung aus Modellwerten (Globalstrahlung,
  Grenzschicht → w*): Einsetzen, Maximum, Abschwächen, Klasse je Stunde, Fahrtfenster.
* Radar: weiter herausgezoomt, Start und Landeraum markiert, Webcams als Kamera-Symbol
  mit Link (Liste in Einstellungen → Meteo).
* Allgemeine Lage: zusätzlich Grosswetteranalyse des nationalen Dienstes als Text
  (DWD Synoptische Übersicht geprüft; MeteoSchweiz/GeoSphere/Aeronautica Militare als
  Seite + Selektor konfigurierbar, Worker `GET /api/wx/wxtext`).
* Pax-Karte: QR-Code des Google-Maps-Links zum Treffpunkt; Druck A4 quer mit zwei
  A5-Karten nebeneinander (Schnittlinie).
* Fix: ein noch laufender Abruf mit altem Sitzungs-Token beendete eine frische Anmeldung;
  Auto-Laden stoppt beim Verlassen der Sicht.

## 0.6.0 — 2026-10-04 · Rückmeldungen aus dem ersten Einsatz

* Ablauf: ein «Neues Briefing»-Knopf (gefüllt, in der Hauptnavigation); tippen
  ins Ortsfeld (Startort, Treffpunkt) öffnet die Ortssuche direkt; Startplätze in
  den Einstellungen als Heissluft/Gas gekennzeichnet (Favoriten je Ballontyp);
  Start-Ampel (denkbar / marginal / eher ausgeschlossen) sobald Ort und Zeit
  stehen; Trajektorien-Vorschau (Min/Max-Höhe) in der Fahrtabsicht — Klick auf
  die Karte setzt Landeraum und Zielrichtung; Platzhalter in Pax-Feldern
  verschwinden beim Tippen (leer = «Pax n (Name folgt)» im Briefing); mehrere
  Nachfahrer; Tagesplanung «kein Plan anlegen / später».
* Ortszeile (Name · Koordinaten · Höhe · Maps-Link · Ändern) auf einer Zeile,
  Felder darunter unten bündig; Ausgabewerte auf einer Zeile ausgerichtet.
* Tragkraft/Masse: Vorgaben (Eingaben Startplatz, Vorgaben aus Stamm) klar von
  den Resultaten (Masse; Höhe und Hüllentemperatur mit Kurve und Achsen) getrennt;
  «Gasflaschen» → «Gasplanung» (nur Heissluft).
* Fix: Tragkraft-Kurve zeigte statt der Grafik eine lange Zahlenreihe
  (SVG-Namensraum).
* METAR/TAF: alle Plätze im Umkreis (Standard 150 km, Anzahl einstellbar, 0 = alle);
  Rohmeldung und Klartext (DE/EN) nebeneinander, TAF-Gruppen entschlüsselt.
* Trajektorien: Legende Farbe = Höhe; Karte als Standard (Satellit/Basiskarte
  wählbar), Distanzraster-Skizze über Knopf ▦; Skizze im Druck.
* Meteogramm neu: beschriftete Bänder mit Einheiten, Zeitachse mit Tageswechsel,
  Start-/Landemarken, Extremwerte, CAPE-Linie, Legende; Fenster −6/+6 h.
* Automatische Panels laden beim ersten Öffnen alle von selbst (auch DABS,
  Karten, NOTAM soweit freigeschaltet).
* DABS/Karten: kleiner Viewer mit Blättern; Beilagen auf eigenen Seiten im Druck,
  abschaltbar («Beilagen mitdrucken»); geparste Karten nicht mehr gestaucht.
* Briefingsicht: einheitliche Breite aller Abschnitte (Tabellen mit fester
  Spaltenbreite, breite Inhalte scrollen bzw. brechen um).
* Personen: mehrere Tracker-Links je Person (Einstellungen) → Pax-Karte zeigt
  die Links des PIC; Pax-Karte druckt A5 hoch.

## 0.5.2 — 2026-10-04

* Zugänge: Auge zum Anzeigen/Verbergen der Eingabe; bei leerem Feld lädt es den
  gespeicherten Wert nach (`GET /api/secrets/:name`, nur Supermaster, als
  `secret_view` protokolliert). Löschen mit Rückfrage; «Speichern» ohne Änderung
  wird gemeldet.

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
