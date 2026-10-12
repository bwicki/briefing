# Konzept «ops.wicki.aero» – Dokumente aus dem Briefing, Fahrtdaten, Debriefing

Stand 12.10.2026, Fassung 2.1 (Konzept, keine Umsetzung). Fassung 1 vom 09.10.2026 mit neun offenen Fragen; die Antworten
von B. Wicki vom 12.10.2026 sind eingearbeitet (Abschnitt 9 «Entscheide») und die betroffenen Abschnitte angepasst.
Grundlage: Auftrag vom 09.10.2026 – nach zwei bis drei weiteren Briefing-Iterationen sollen (1) Beförderungsschein und
Flugauftrag aus dem finalisierten Briefing erzeugt, (2) ein zweiter Hauptteil **Fahrtdaten** (laufendes Einspielen von
Trackingdaten) und (3) ein dritter Hauptteil **Debriefing** (Planung gegen Ist, iterativ verbesserte physikalische
Modelle, v. a. Gasfahrt) aufgebaut werden.

Die Plattform heisst seit 12.10.2026 **ops.wicki.aero** (Repository `bwicki/ops`); `briefing.wicki.aero` ist seither
nicht mehr erreichbar (GitHub Pages bedient nur eine Domain) – ältere Links sind auf ops.wicki.aero umzustellen. Nichts in diesem Dokument ist bereits gebaut – ausser dem Umzug selbst (0.12.17f).

## 1 Gesamtbild

```
                 ┌───────────────────────────────────────────────────────────────┐
                 │  ops.wicki.aero                                               │
                 │                                                               │
  Vorbereitung   │  1 BRIEFING  ──► Final ──► Dokumente (Beförderungsschein,     │
                 │       │                     Flugauftrag, ICAO-FPL, Pax-Karte) │
                 │       │ Planungsdaten (Bahnen, Profil, Etappen, Zeitplan)     │
                 │       ▼                                                       │
  Fahrt          │  2 FAHRTDATEN ◄── APRS (bis 3 Rufzeichen je Ballon)           │
                 │       │       ◄── Garmin inReach (MapShare je Ballon)         │
                 │       │       ◄── Zustandsmeldungen reporting.wicki.aero (Gas)│
                 │       │ Ist-Bahn, Höhen, Raten, Ballast/ATC/Ressourcen         │
                 │       ▼                                                       │
  Nachbereitung  │  3 DEBRIEFING ──► Soll/Ist-Vergleich ──► Modellparameter ──►  │
                 │                   zurück in die Planung (Kalibrierung)        │
                 └───────────────────────────────────────────────────────────────┘
```

Eine Fahrt ist der gemeinsame Datensatz. Das Briefing (heute) liefert den **Soll**-Teil, die Fahrtdaten den **Ist**-Teil,
das Debriefing vergleicht beide und schreibt **Modellparameter** zurück (z. B. Überhitzungsfaktoren Gas–Luft,
Ballastwirkung, Windkorrektur je Niveau), die das nächste Briefing verwendet.

Technisch bleibt die bestehende Architektur (GitHub Pages + Cloudflare Worker, D1, R2). Neu kommen hinzu:
ein Ingest-Pfad für Trackingdaten (Cron im Worker), ein Lesepfad in das Repository `gb_flight_data`, eine
Zeitreihen-Tabelle in D1, und ein Auswertungsmodul im Browser (gleiche Rechenbibliothek `js/calc/*` wie die Planung).

## 2 Dokumente aus dem finalisierten Briefing (Stufe 0)

Zwei betrieblich nötige Dokumente werden aus dem Final-Stand erzeugt; die Datenquellen sind alle schon im Briefing.
**Vorlagen: die am 04.10.2026 gelieferten Beispiele gelten unverändert (Entscheid 1).**

| Dokument | Inhalt (aus dem Briefing) | Fehlendes (noch zu erfassen) |
|---|---|---|
| **Beförderungsschein** – Vorlage BHB ANH 511 «Passagierliste und Beförderungsschein» v7 vom 28.12.2024 (DE und EN, je 2 Seiten; Seite 2 = Auszüge AXA A–D, unverändert) | Kopf: Datum der Fahrt, am/Tag/pm, Startort; Kennzeichen (HB-QWP, HB-QWZ, HB-QPJ, HB-QWV, anderes – aus dem Briefing angekreuzt); Luftfrachtführer (Wicki Aero GmbH / B. Wicki / Veranstalter / Drittpartei – aus Fahrtzweck); Entgelt (CHF/EUR, pro Fahrt/Person, durch/an Dritte, unentgeltlich); Art der Fahrt (gewerblich / Ausbildung / Skill test / privat entgeltlich / privat unentgeltlich); Erklärungstext; Tabelle Vorname Name · E-Mail/Bemerkungen · Unterschrift (Pax aus dem Briefing vorgedruckt, Rest leer); Ort/Datum, Unterschrift Pilot; Fusszeile «v7 \| 28.12.2024 \| EASA BOP.BAS.115» | **Entscheide 12.10.2026:** Entgelt (Betrag CHF/EUR, pro Fahrt/Person/unterschiedlich, durch/an Dritte verrechnet) wird im Briefing erfasst – nur sichtbar und vorgedruckt, wenn «gewerbliche Fahrt» gewählt ist; E-Mail der Pax aus der Personenliste vordrucken, wenn dort erfasst, sonst leer; Sprache DE oder EN nach Briefingsprache (nicht beide); Seite 2 (AXA-Auszüge A–D) unverändert; Pilotenunterschrift digital wie beim Flugauftrag. Entwurf beider Seiten am 12.10.2026 im Design-Fenster vorgelegt |
| **Flugauftrag** (Operator Flight Order) – eigener Entwurf, 12.10.2026 im Design-Fenster vorgelegt (A4, eine Seite, Tabellenstil des Beförderungsscheins) | Betreiber/Betriebsleiter; Datum, Startzeit LT/UTC, geplante Dauer und Fenster; Startort mit Koordinaten/Höhe; Landeraum (Sektor, Distanz, Grenzübertritt); Art der Fahrt, Heissluft/Gas; Ballon (Kennzeichen, Muster, Volumen) und Korb (Typ, Plätze, MTOM); Besatzung (PIC mit Lizenz/Medical, Crew, Rückholer mit Telefon); Passagiere (Namen, Anzahl, Insassenmasse); Rahmenbedingungen: Fahrtabsicht (Höhenband, VFR/NVFR, Brennstoff/Ballast), Wetter aus dem Briefing (Ampel, Wind, Sicht, Mindestbedingungen), Luftraum/NOTAM/DABS, Auflagen; Erteilung (Betreiber) und Annahme (PIC) mit Unterschriften; Durchführung nach der Fahrt (Start/Landung Zeit/Ort, Bemerkungen); Fusszeile mit Briefingnummer/Final-Stand | Lizenz-Nr. und Medical-Gültigkeit des PIC sowie Korb-Daten (Typ, Plätze, MTOM) fehlen in den Stammdaten → Ergänzung der Nutzer-/Ballon-Stammdaten in Stufe 0. **Entscheid 12.10.2026 (Kommentar zum Entwurf):** Lizenznummer und «Medical gültig bis» je Pilot in den Einstellungen (Nutzer); ist das Medical abgelaufen, fragt die App beim nächsten Login nach der aktuellen Gültigkeit (Pflichtfeld, bis es erfasst ist); «Betriebsleiter» erscheint nicht auf dem Flugauftrag. **Digitale Unterschrift (Entscheid 12.10.2026):** Betreiber und PIC unterschreiben direkt in der App – je Nutzer ein hinterlegtes Unterschriftenbild (Upload einer gescannten Unterschrift, PNG/JPG mit transparentem oder weissem Grund, in den Einstellungen → Nutzer; Ablage in R2, nur für eigene Dokumente verwendbar). «Signieren» im Final-Stand setzt Bild, Name und Zeitstempel UTC in das Dokument und protokolliert die Signatur (Aktivitätsprotokoll); das PDF trägt beide Signaturen mit Zeitstempel. Zwei Rollen: Betreiber (Supermaster/Master mit Betreiberrecht) und PIC (der im Briefing eingetragene Pilot); fehlt eine Signatur, zeigt das Dokument die leere Linie |

Erzeugung: wie die Pax-Karte (`#/v/<id>/p`) als eigene Druckseiten `#/v/<id>/bs` und `#/v/<id>/fa`, A4, mit den drei
Schriften der Briefingsicht; Final-PDF über den vorhandenen PDF-Weg (Cloudflare Browser Rendering), Ablage in R2 neben
dem Briefing-PDF, Download aus der Briefingsicht. Der ICAO-Flugplan (IBS-Beispiel) wird gleich mitgezogen, da das
Panel C02 die Felder schon führt.

Reihenfolge: Beförderungsschein → Flugauftrag → ICAO-FPL (Textformat zum Einfügen in skybriefing/IBS).

## 3 Hauptteil «Fahrtdaten»

### 3.1 Quellen

| Quelle | Was | Zugang | Taktung | Einsatz |
|---|---|---|---|---|
| **APRS** (LightAPRS im Kombi-Instrument u. a.) | Position, Höhe, Kurs, Geschwindigkeit, Kommentar | **aprs.fi API** (JSON), Schlüssel vorhanden → Zugang `aprsfi_key` in den Einstellungen; **bis zu 3 Rufzeichen je Ballon** in den Stammdaten (Entscheid 2) | Senderate des Trackers (typ. 1–3 min), Abruf alle 2 min | Heissluft und Gas |
| **Garmin inReach** | Position, Höhe, Kurs, Geschwindigkeit, Batteriestand, Nachrichten | MapShare `https://live.garmin.com/bwi` → KML-Feed `https://share.garmin.com/Feed/Share/bwi` (Zeitfenster über `d1`/`d2`); **je Ballon** ein Feed-Eintrag in den Stammdaten (Entscheid 4); bei einem gemeinsamen MapShare-Konto werden die Geräte im Feed über IMEI/Gerätename dem Ballon zugeordnet | 10 min (einstellbar), Abruf alle 2–5 min | Heissluft und Gas; Rückfall bei fehlendem APRS-Empfang (Gebirge, Meer) |
| **Zustandsmeldungen reporting.wicki.aero** (nur Gas) | von Hand im Korb erfasste Ereignisse mit Handy-GPS-Position: Ballast (Abwurf kg, Sand/Wasser, Restbestand), ATC (RX/TX, Station, Frequenz, Squawk, Meldung), Ressourcen (Batterie %, Brennstoffzelle, Solar, Methanol %, O₂ je Flasche/Liter/%), PIC-Wechsel, Position (MANPOS/POS), Sonstiges (Notiz, WhatsApp-Weiterleitung, Anhänge) | Repository **`bwicki/gb_flight_data`** (privat): je Fahrt `data/<FAHRT>.json` und `.csv`, Index `data/_flights.json` (Fahrt, abgeschlossen am/von, Zeilen), `data/_setup.json` (Ballon, Crew, Startballast, Vorlagen), Bilder in `data/media/`; Lesen über die GitHub-API mit einem Lese-Token (Zugang `github_flightdata_token`) | je Meldung ein Datensatz (GB26: 68, GB27: 53) | Gas; bei Heissluft wird nichts erfasst (Entscheid 6) |
| **Nachträgliche Logs** | GPS-Rohlog (SD-Karte des GB-Core2, Anforderungsdokument an Hilmar), Garmin-Export (GPX), APRS-Rohlog, FLARM-Log (IGC) | Datei-Upload im Debriefing | – | Lückenfüller und Referenz |

Grundsatz: **mehrere Quellen, eine Ist-Bahn.** Positionen werden zu einer zusammengeführten Bahn verschmolzen
(Zeitstempel UTC, Priorität APRS > inReach > Handy-Position der Zustandsmeldungen, Lücken interpoliert und als solche
markiert). Die Zustandsmeldungen liefern die **Ereignisse** (Ballast, ATC, Ressourcen, PIC) und sind die wichtigste
Quelle für die Kalibrierung (Abschnitt 4.2).

**Heissluft (Entscheid 5/6):** Fahrtdaten werden erfasst, aber ohne Ereignisse im Korb. Start und Landung werden
automatisch aus der APRS-/inReach-Bahn abgeleitet (Start = erste anhaltende Bewegung > 2 kt und Höhengewinn > 30 m nach
der geplanten Startzeit − 1 h; Landung = 10 min ohne Bewegung in Bodennähe) und im Flugauftrag/Logbuch eingetragen; der
PIC kann die Zeiten korrigieren.

**reporting.wicki.aero, befundet am 12.10.2026:** Die App (gb_notion_frontend) schreibt direkt in das Repository;
`_setup.json` enthält neben Ballon, Crew und Vorlagen auch einen Kartendienst-Token im Klartext – das Repository ist
privat, der Token sollte dennoch nicht im Datenverzeichnis liegen (Hinweis, keine Änderung durch dieses Konzept).
Die Zuordnung Fahrt ↔ Briefing erfolgt über Rufzeichen und Datum (`_setup.json: call`, `ts_utc` der Meldungen),
mit Nachfrage, wenn mehrere Fahrten in Frage kommen.

### 3.2 Datenmodell (D1)

```
flights           id, briefing_id, status (planned|live|landed|closed), start_ms, land_ms, source_cfg (JSON),
                  gbfd_flight (z. B. GB26), expires_ms (Löschfrist), export_prompted_ms
track_points      flight_id, ms, src (aprs|inreach|report|file), lat, lon, alt_m, vs_ms, gs_kt, crs, agl_m, extra (JSON)
flight_events     flight_id, ms, kind (launch|level|ballast|atc|resources|pic|stage|landing|note), value (JSON), src, who
track_merged      flight_id, ms, lat, lon, alt_m, vs_ms, gs_kt, quality (0..1), gap (bool)   – alle 30 s, berechnet
balloon_trackers  balloon_id, aprs_calls (bis 3), inreach_feed (URL, Kennwort optional), inreach_device (IMEI/Name)
```

Speichern nur, was je Fahrt nötig ist (eine 20-h-Gasfahrt ≈ 2 400 Punkte je Quelle): D1 reicht; R2 für Rohdateien.
Die Zuordnung Tracker → Fahrt erfolgt über den Ballon (`balloon_trackers`) und das Startfenster (Start − 2 h bis
Landung + 6 h); ausserhalb werden keine Punkte gespeichert (Datenschutz, Kosten).

### 3.3 Einspielen

* **Worker-Cron** (Cloudflare Cron Trigger, alle 2 min, nur solange eine Fahrt `live` ist): holt aprs.fi (alle
  Rufzeichen des Ballons in einem Aufruf) und den MapShare-KML-Feed, schreibt neue Punkte, berechnet `track_merged`
  nach, setzt `landed` nach der Regel aus 3.1.
* **Zustandsmeldungen** (Gas): der Cron liest `data/<FAHRT>.json` aus `gb_flight_data` (GitHub-API, ETag-Vergleich,
  also nur bei Änderung Datenverkehr) und übernimmt neue Zeilen als `flight_events` mit der Handy-Position als
  `track_points` (src `report`). Nach Fahrtende einmal vollständig.
* **Manueller Start** aus dem Briefing: Knopf «Fahrt starten» in «Laufende Fahrten» (oder automatisch zur
  Startzeit); «Fahrt beenden» setzt `landed` und friert die Ist-Bahn ein.

### 3.4 Sicht «Fahrtdaten» (live)

* Karte: geplante Trajektorien/Profilbahn (dünn), Ist-Bahn (kräftig), Soll-Position zur aktuellen Zeit als
  Marke, Lufträume, NOTAM-Kreise aus dem Briefing, Landeraum; Rückholer sehen dieselbe Karte über einen Link
  (Material-/Fahrt-Link, nur lesen).
* Profil (Gasfahrt): das Höhenprofil-Werkzeug aus 0.12 mit der Ist-Höhe als zweite Linie, Etappengrenzen,
  Sonnenstand, Vertikalrate; Ballast- und Ressourcen-Ereignisse als Marken.
* Kennzahlen: Zeit seit Start, Distanz, mittlere Geschwindigkeit, Abweichung von der Soll-Position (km, °),
  Ballastreserve (Gas, aus den Zustandsmeldungen) bzw. Brennstoff (Heissluft, manuell).
* Meldungen: Abweichung > Schwelle (z. B. 15 km oder 30°), Annäherung an Luftraum/Grenze, Datenlücke > 10 min.
  Anzeige in der App; Push (E-Mail/Signal) erst in einer späteren Stufe.
* Ereignisse von Hand bleiben in reporting.wicki.aero (keine zweite Erfassung in ops; Entscheid 6).

## 4 Hauptteil «Debriefing»

### 4.1 Soll/Ist-Vergleich

Gegenübergestellt werden je Fahrt:

| Grösse | Soll (Briefing) | Ist (Fahrtdaten) | Kennzahl |
|---|---|---|---|
| Bahn | Trajektorie je Niveau, Profilbahn | zusammengeführte Ist-Bahn | Querabweichung (km) je Stunde, Endpunktabstand, Richtungsfehler (°) |
| Höhenverlauf (Gas) | Höhenprofil-Werkzeug (Etappen, Raten) | Ist-Höhe, Vertikalrate | Höhenfehler je Etappe, erreichte Prallhöhe, Nacht-Absinken |
| Wind je Niveau | Modellwind (Open-Meteo, Ensemble) | aus Ist-Bahn abgeleiteter Wind (Groundspeed/Kurs je Höhe) | Modellfehler Richtung/Geschwindigkeit je Niveau und Stunde |
| Ballast/Auftrieb (Gas) | Aerostatik-Rechnung (Füllung, Überhitzung, Ballast) | Ballastereignisse (kg, Zeit, Medium) aus reporting, Vertikalraten | Überhitzungsfaktor Ist, Ballastwirkung (m je kg), Gasverlust je Tag |
| Ressourcen (Gas) | O₂-Planung (o2.wicki.aero), Bordnetz | Ressourcen-Meldungen (O₂ Liter/%, Batterie, Methanol) | Verbrauch je Stunde gegen Plan |
| Zeitplan | Tagesplanung A05 | Ereigniszeiten (Start/Landung automatisch, PIC-Wechsel) | Verzug je Schritt |
| Meteo | Ampel, Prognosen | METAR/Beobachtungen nach der Fahrt | Trefferquote der Ampel |

Darstellung: Karte (Soll/Ist), Profil (Soll/Ist), Tabellen je Kennzahl, Kurzbericht (Text, optional KI-Zusammenfassung
wie heute im Briefing). Export als PDF (Debriefing-Bericht) und CSV/GPX.

### 4.2 Modellverbesserung (Gasfahrt)

Ziel: die Parameter der Aerostatik und der Bahnrechnung aus vielen Fahrten **kalibrieren**, nicht von Hand setzen.

* **Parameter** (heute fest bzw. im Expertenmenü): Überhitzung Gas–Luft Tag/Nacht (klar/bedeckt), Auftrieb je K,
  Gasverlust über die Prallhöhe und über die Zeit (Diffusion), Ballastwirkung, Verzögerung der Reaktion,
  Windkorrektur je Niveau (Modellbias).
* **Verfahren**: je Fahrt werden die Parameter so angepasst, dass die simulierte Höhe/Bahn den Ist-Verlauf am
  besten trifft (Least Squares über Fenster von 1 h; robust gegen Ausreisser). Über mehrere Fahrten wird der
  Median je Parameter mit Streuung geführt (Tabelle `model_params`: Parameter, Wert, Streuung, n Fahrten, Datum).
* **Rückfluss**: das Briefing zeigt im Höhenprofil-Werkzeug «Modell: kalibriert aus n Fahrten (Stand …)» und
  verwendet die kalibrierten Werte als Vorgabe; der Experte kann sie je Briefing überschreiben.
* **Erst ab ≥ 3 Fahrten** mit vollständigen Ballastmeldungen sinnvoll; davor nur Anzeige der Abweichungen. Die
  Fahrten GB26/GB27 (2026) liegen bereits mit Ballast- und Ressourcenmeldungen vor und können als erste
  Kalibrierfahrten dienen, sobald eine Bahn (APRS/inReach) dazu importiert ist.

### 4.3 Archiv und Auswertung über Fahrten

Liste aller Fahrten mit Kennzahlen (Distanz, Dauer, Endpunktfehler, Ampel-Treffer), Filter nach Ballon, Jahr,
Heissluft/Gas; Vergleich mehrerer Fahrten; Export der Zeitreihen. Dient auch als Nachweis (Betriebsaufzeichnungen).

### 4.4 Aufbewahrung und Löschung (Entscheid 7)

* Trackingdaten (`track_points`, `track_merged`, `flight_events`, Rohdateien in R2) werden **2 Jahre** nach der
  Landung gelöscht; Kennzahlen und Debriefing-Bericht (ohne Bahn) bleiben.
* **Vor jeder Löschung** wird der Eigner beim nächsten Login gefragt: Liste der fälligen Fahrten, je Fahrt «Exportieren
  (ZIP mit GPX, CSV, JSON, Bericht-PDF)» oder «Löschen». Ohne Antwort wird nicht gelöscht; die Frage erscheint bei jedem
  Login erneut, bis sie beantwortet ist. Der Supermaster sieht die fälligen Fahrten aller Nutzer. Löschungen werden im
  Aktivitätsprotokoll (0.12.16) festgehalten.
* Sicht auf die Ist-Bahn: Eigner und Supermaster; Crew-, Rückholer- und Materiallinks während der Fahrt und bis
  **3 Monate** nach der Landung (Entscheid 12.10.2026; Rollen über die bestehenden Links). Pax sehen keine Bahn.

## 5 Struktur der Plattform

Navigation oben: **Briefing · Fahrt · Debriefing** (je Fahrt), dazu die Übersicht aller Fahrten (heutige Briefings-Seite,
erweitert um Spalten «Fahrtdaten» und «Debriefing»). Die Fahrt-ID ist die Briefingnummer; Nachträge (a, b, c) gehören
zur selben Fahrt. Rollen bleiben: Master (eigene Fahrten), Supermaster (alle, Modellparameter), Links für Crew,
Rückholer und Materialeigner (lesen).

Stammdaten Ballon (Einstellungen → Ballone) werden um die Tracker ergänzt: bis zu drei APRS-Rufzeichen, inReach-Feed
(URL, optionales Kennwort, Gerätekennung), Kennung in `gb_flight_data` (Rufzeichen).

## 6 Name (Entscheid 8)

**ops.wicki.aero** – umgesetzt am 12.10.2026 (Repository `bwicki/ops`, Pages-Domain, Worker-Origins, Links;
`briefing.wicki.aero` nicht mehr erreichbar). Der App-Name «Fahrtbriefing» bleibt für den Briefing-Teil; der Seitentitel und
das Logo werden mit Stufe 1 auf «Ops» umgestellt, wenn der zweite Hauptteil sichtbar wird.

## 7 Etappen der Umsetzung (Entscheid 9: Reihenfolge bestätigt)

| Stufe | Inhalt | Voraussetzung |
|---|---|---|
| 0 | Beförderungsschein, Flugauftrag, ICAO-FPL aus dem Final | Vorlagen vom 04.10.2026 (unverändert), 2–3 Briefing-Iterationen abgeschlossen |
| 1 | Fahrtdaten: Stammdaten Tracker je Ballon, Worker-Cron APRS (aprs.fi) + inReach, Live-Karte, Start/Landung automatisch | Zugang `aprsfi_key`, MapShare-Feed `bwi` (Zugriff aus dem Worker zu prüfen – aus dem Entwicklungsnetz war der Feed nicht erreichbar), Testfahrt |
| 2 | Zustandsmeldungen (Gas) aus `gb_flight_data` einspielen, Profil-Live-Sicht mit Ereignissen | Lese-Token für das private Repository (Zugang `github_flightdata_token`) |
| 3 | Debriefing: Soll/Ist-Vergleich, Bericht, Export; Aufbewahrung/Export-Abfrage | Stufe 1 produktiv, 2–3 aufgezeichnete Fahrten |
| 4 | Modellkalibrierung (Gas), Rückfluss in die Planung | ≥ 3 Gasfahrten mit Ballastmeldungen (GB26/GB27 als Start) |
| 5 | Fahrtenarchiv, Auswertung über Fahrten, Titel/Logo «Ops» | Stufen 1–3 produktiv |

Aufwand grob: Stufe 0 eine Sitzung; Stufe 1 zwei Sitzungen; Stufe 2 eine; Stufe 3 zwei; Stufe 4 zwei bis drei
(iterativ mit Fahrten); Stufe 5 eine.

## 8 Risiken und Grenzen

* **Datenlücken**: APRS-Empfang im Gebirge und über Wasser unzuverlässig, inReach nur alle 10 min → die Ist-Bahn ist
  eine Zusammenführung mit Lücken; Kennzahlen tragen eine Qualitätsangabe.
* **Wind aus der Bahn** ist nur ein Näherungswert (Ballon = Luftpaket, aber Höhe wechselt) – für die Kalibrierung
  der Windkorrektur nur Fenster mit stabiler Höhe verwenden.
* **Rechtliches**: Trackingdaten der Crew/Pax sind Personendaten; Speicherung nur im Fahrtfenster, Zugriff über
  Rollen/Links, Löschfrist 2 Jahre mit Export-Abfrage (4.4).
* **Worker-Limits**: Cron alle 2 min, kleine Abfragen – unkritisch; aprs.fi erlaubt ohne Absprache nur geringe
  Abrufraten (ein Aufruf je Ballon und Takt mit allen Rufzeichen; Nutzungsbedingungen prüfen).
* **Kalibrierung** braucht saubere Ereignisdaten (Ballast kg, Zeit) – die Zustandsmeldungen liefern sie; ohne Bahn
  (APRS/inReach) zur gleichen Fahrt bleibt sie grob.
* **gb_flight_data** wird von der reporting-App beschrieben; ops liest nur. Änderungen am Format dort (Spalten)
  brechen den Import nicht, solange `ts_utc`, `type`, `lat/lon`, `alt_ft` und die Ballastfelder bleiben.

## 9 Entscheide vom 12.10.2026 (Antworten auf die Fragen der Fassung 1)

| Nr. | Frage | Entscheid |
|---|---|---|
| 1 | Vorlagen Beförderungsschein/Flugauftrag | unverändert (Beispiele vom 04.10.2026) |
| 2 | APRS | bis zu 3 Rufzeichen je Ballon; aprs.fi mit vorhandenem Schlüssel |
| 3 | reporting.wicki.aero | Zustandsmeldungen von Hand über das Frontend, abgelegt im Repository `gb_flight_data` (Tabelle je Fahrt); befundet, siehe 3.1 |
| 4 | Garmin inReach | MapShare `live.garmin.com/bwi`, je Ballon (Heissluft und Gas) |
| 5 | Heissluft | ja, Fahrtdaten auch dort |
| 6 | Ereignisse im Korb | Heissluft: nichts ausser Start/Landung (automatisch aus APRS); Gas: Zustandsmeldungen aus `gb_flight_data` |
| 7 | Löschfrist | 2 Jahre; vor jeder Löschung beim nächsten Login Export anbieten |
| 8 | Name | ops.wicki.aero (umgesetzt 12.10.2026) |
| 9 | Reihenfolge | Stufe 0 vor Stufe 1, wie vorgeschlagen |

Noch offen (für die Umsetzungssitzung der jeweiligen Stufe):

1. Stufe 1: Kennwort des MapShare-Feeds (falls gesetzt) und Gerätekennungen je Ballon; aprs.fi-Schlüssel in den
   Zugängen hinterlegen.
2. Stufe 2: Lese-Token für `gb_flight_data` (GitHub Fine-grained Token, nur Contents: Read) in den Zugängen hinterlegen.
3. Stufe 0: Rückmeldung zum Entwurf des Flugauftrags (Design-Fenster) – Felder, Reihenfolge, Umfang.
