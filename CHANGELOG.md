# Changelog

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
