# Konzept «Flightportal» – Dokumente aus dem Briefing, Fahrtdaten, Debriefing

Stand 09.10.2026 (Konzept, keine Umsetzung). Grundlage: Auftrag von B. Wicki vom 09.10.2026 – nach zwei bis drei weiteren
Briefing-Iterationen sollen (1) Beförderungsschein und Flugauftrag aus dem finalisierten Briefing erzeugt, (2) ein zweiter
Hauptteil **Fahrtdaten** (laufendes Einspielen von Trackingdaten) und (3) ein dritter Hauptteil **Debriefing**
(Planung gegen Ist, iterativ verbesserte physikalische Modelle, v. a. Gasfahrt) aufgebaut werden. Danach wird die
Plattform umbenannt.

Alles hier ist Vorschlag und Entscheidungsgrundlage; die Fragen am Ende (Abschnitt 9) sind zu beantworten, bevor
eine Umsetzungssitzung beginnt. Nichts in diesem Dokument ist bereits gebaut.

## 1 Gesamtbild

```
                 ┌───────────────────────────────────────────────────────────────┐
                 │  flightportal.wicki.aero (Arbeitstitel)                       │
                 │                                                               │
  Vorbereitung   │  1 BRIEFING  ──► Final ──► Dokumente (Beförderungsschein,     │
                 │       │                     Flugauftrag, ICAO-FPL, Pax-Karte) │
                 │       │ Planungsdaten (Bahnen, Profil, Etappen, Zeitplan)     │
                 │       ▼                                                       │
  Fahrt          │  2 FAHRTDATEN ◄── APRS · Garmin inReach · Bord-Telemetrie     │
                 │       │           (reporting.wicki.aero, nur Gas)              │
                 │       │ Ist-Bahn, Höhen, Raten, Ballast/Brenner, Wetter an Bord│
                 │       ▼                                                       │
  Nachbereitung  │  3 DEBRIEFING ──► Soll/Ist-Vergleich ──► Modellparameter ──►  │
                 │                   zurück in die Planung (Kalibrierung)        │
                 └───────────────────────────────────────────────────────────────┘
```

Eine Fahrt ist der gemeinsame Datensatz. Das Briefing (heute) liefert den **Soll**-Teil, die Fahrtdaten den **Ist**-Teil,
das Debriefing vergleicht beide und schreibt **Modellparameter** zurück (z. B. Überhitzungsfaktoren Gas–Luft,
Ballastwirkung, Windkorrektur je Niveau), die das nächste Briefing verwendet.

Technisch bleibt die bestehende Architektur (GitHub Pages + Cloudflare Worker, D1, R2). Neu kommen hinzu:
ein Ingest-Pfad für Trackingdaten (Cron im Worker bzw. Push von den Trackern), eine Zeitreihen-Tabelle in D1,
und ein Auswertungsmodul im Browser (gleiche Rechenbibliothek `js/calc/*` wie die Planung).

## 2 Dokumente aus dem finalisierten Briefing (Stufe 0)

Zwei betrieblich nötige Dokumente werden aus dem Final-Stand erzeugt; die Datenquellen sind alle schon im Briefing.

| Dokument | Inhalt (aus dem Briefing) | Fehlendes (noch zu erfassen) |
|---|---|---|
| **Beförderungsschein** (Passagierliste/Fahrtenschein, Beispiel vom 04.10.2026 geliefert) | Betreiber (LTF), Ballon (Kennzeichen, Muster, S/N), Datum, Startort, geplanter Landeraum, PIC, 2. Pilot/Crew, Pax (Name, Vorname, ggf. Gewicht), Briefingnummer, Fahrtzweck (gewerblich/privat) | Unterschriftenfelder; Geburtsdatum/Adresse der Pax nur, wenn das Formular es verlangt (Datenschutz: nur drucken, nicht länger speichern als die Fahrt) |
| **Flugauftrag** (Operator Flight Order) | Fahrtnummer, PIC, Crew, Ballon, Startort/-zeit, Landeraum, Fahrtabsicht (Höhenband, Dauer), Treffpunkt, Rückholer, Wetterkurzfassung (Ampel, Wind), NOTAM/DABS-Status, Freigabestand «Final vN» mit Zeitstempel | Freigabe durch den Betriebsleiter (Name, Zeit) – bei Wicki Aero identisch mit dem PIC, Feld trotzdem vorsehen |

Erzeugung: wie die Pax-Karte (`#/v/<id>/p`) als eigene Druckseiten `#/v/<id>/bs` und `#/v/<id>/fa`, A4, mit den drei
Schriften der Briefingsicht; Final-PDF über den vorhandenen PDF-Weg (Cloudflare Browser Rendering), Ablage in R2 neben
dem Briefing-PDF, Download aus der Briefingsicht. Der ICAO-Flugplan (IBS-Beispiel) wird gleich mitgezogen, da das
Panel C02 die Felder schon führt.

Reihenfolge: Beförderungsschein → Flugauftrag → ICAO-FPL (Textformat zum Einfügen in skybriefing/IBS).

## 3 Hauptteil «Fahrtdaten»

### 3.1 Quellen

| Quelle | Was | Zugang | Taktung | Einsatz |
|---|---|---|---|---|
| **APRS** (LightAPRS im Kombi-Instrument, Rufzeichen des Ballons) | Position, Höhe, Kurs, Geschwindigkeit, Kommentar | aprs.fi API (JSON, Schlüssel), alternativ eigener APRS-IS-Client auf einem Relais | alle 3 min (Senderate), Abruf alle 1–2 min | Heissluft und Gas |
| **Garmin inReach** | Position, Höhe, Kurs, Geschwindigkeit, Batteriestand, Nachrichten | MapShare-KML-Feed (URL + optionales Kennwort), kein Schlüssel nötig | 10 min (einstellbar, kostenpflichtig häufiger), Abruf alle 2–5 min | Heissluft und Gas, Rückfall bei fehlendem APRS-Empfang (Gebirge, Meer) |
| **Bord-Telemetrie reporting.wicki.aero** (nur Gas) | Daten des Gasballoninstruments: Position, Höhe, Vertikalrate, Lidar-Bodenabstand, Umgebungs-/Gas-Temperatur, Ballast-/Ventil-Ereignisse (soweit vorhanden), Bordnetz | bestehende Datenkommunikation über Starlink Mini (ESP32-S3 → reporting.wicki.aero); Schnittstelle und Format sind zu klären (Frage 3) | nach heutigem Stand 1 Datensatz je Übertragung; Ziel ≤ 1 min | Gas |
| **Nachträgliche Logs** | GPS-Rohlog (SD-Karte des GB-Core2, Anforderungsdokument an Hilmar), Garmin-Export (GPX), APRS-Rohlog, FLARM-Log (IGC) | Datei-Upload im Debriefing | – | Lückenfüller und Referenz |

Grundsatz: **mehrere Quellen, eine Ist-Bahn.** Die Quellen werden zu einer zusammengeführten Bahn verschmolzen
(Zeitstempel UTC, Priorität Bord-Telemetrie > APRS > inReach, Lücken interpoliert und als solche markiert).

### 3.2 Datenmodell (D1)

```
flights           id, briefing_id, status (planned|live|landed|closed), start_ms, land_ms, source_cfg (JSON)
track_points      flight_id, ms, src (tele|aprs|inreach|file), lat, lon, alt_m, vs_ms, gs_kt, crs, agl_m (Lidar), extra (JSON)
flight_events     flight_id, ms, kind (launch|level|ballast|vent|burner|stage|landing|note), value, src, who
track_merged      flight_id, ms, lat, lon, alt_m, vs_ms, gs_kt, quality (0..1), gap (bool)   – alle 30 s, berechnet
```

Speichern nur, was je Fahrt nötig ist (eine 20-h-Gasfahrt ≈ 2 400 Punkte je Quelle): D1 reicht; R2 für Rohdateien.
Die Zuordnung Tracker → Fahrt erfolgt über den Ballon (Stammdaten: Rufzeichen APRS, inReach-Feed-URL je Ballon/Korb)
und das Startfenster (Start − 2 h bis Landung + 6 h); ausserhalb werden keine Punkte gespeichert (Datenschutz,
Kosten).

### 3.3 Einspielen

* **Worker-Cron** (Cloudflare Cron Trigger, alle 2 min, nur solange eine Fahrt `live` ist): holt aprs.fi und
  MapShare-KML, schreibt neue Punkte, berechnet `track_merged` nach, setzt `landed`, wenn 30 min keine Bewegung
  und Bodennähe (Lidar < 5 m oder AGL < 30 m aus dem Geländemodell).
* **Push** von reporting.wicki.aero: `POST /api/flights/:id/points` mit Gerätetoken (Material-Zugang je Ballon),
  Format JSON-Zeilen; das Format wird mit der bestehenden Kommunikation abgeglichen (Frage 3).
* **Manueller Start** aus dem Briefing: Knopf «Fahrt starten» in «Laufende Fahrten» (oder automatisch zur
  Startzeit); «Fahrt beenden» setzt `landed` und friert die Ist-Bahn ein.

### 3.4 Sicht «Fahrtdaten» (live)

* Karte: geplante Trajektorien/Profilbahn (dünn), Ist-Bahn (kräftig), Soll-Position zur aktuellen Zeit als
  Marke, Lufträume, NOTAM-Kreise aus dem Briefing, Landeraum; Rückholer sehen dieselbe Karte über einen Link
  (Material-/Fahrt-Link, nur lesen).
* Profil (Gasfahrt): das Höhenprofil-Werkzeug aus 0.12 mit der Ist-Höhe als zweite Linie, Etappengrenzen,
  Sonnenstand, Vertikalrate.
* Kennzahlen: Zeit seit Start, Distanz, mittlere Geschwindigkeit, Abweichung von der Soll-Position (km, °),
  verbleibende Reichweite nach Ballast (Gas) bzw. Brennstoff (Heissluft, manuell).
* Meldungen: Abweichung > Schwelle (z. B. 15 km oder 30°), Annäherung an Luftraum/Grenze, Datenlücke > 10 min.
  Anzeige in der App; Push (E-Mail/Signal) erst in einer späteren Stufe.
* Ereignisse von Hand: Ballast abgeworfen (kg), Ventil, Brennerlauf, Etappenwechsel, Notiz – aus dem Korb per
  Handy (grosse Knöpfe, offline-tauglich mit Nachsenden).

## 4 Hauptteil «Debriefing»

### 4.1 Soll/Ist-Vergleich

Gegenübergestellt werden je Fahrt:

| Grösse | Soll (Briefing) | Ist (Fahrtdaten) | Kennzahl |
|---|---|---|---|
| Bahn | Trajektorie je Niveau, Profilbahn | zusammengeführte Ist-Bahn | Querabweichung (km) je Stunde, Endpunktabstand, Richtungsfehler (°) |
| Höhenverlauf (Gas) | Höhenprofil-Werkzeug (Etappen, Raten) | Ist-Höhe, Vertikalrate | Höhenfehler je Etappe, erreichte Prallhöhe, Nacht-Absinken |
| Wind je Niveau | Modellwind (Open-Meteo, Ensemble) | aus Ist-Bahn abgeleiteter Wind (Groundspeed/Kurs je Höhe) | Modellfehler Richtung/Geschwindigkeit je Niveau und Stunde |
| Ballast/Auftrieb (Gas) | Aerostatik-Rechnung (Füllung, Überhitzung, Ballast) | Ballastereignisse, Vertikalraten, Temperaturen | Überhitzungsfaktor Ist, Ballastwirkung (m je kg), Gasverlust je Tag |
| Zeitplan | Tagesplanung A05 | Ereigniszeiten | Verzug je Schritt |
| Meteo | Ampel, Prognosen | Bordwerte, METAR nach der Fahrt | Trefferquote der Ampel |

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
* **Erst ab ≥ 3 Fahrten** mit vollständigen Bord-Daten sinnvoll; davor nur Anzeige der Abweichungen.

### 4.3 Archiv und Auswertung über Fahrten

Liste aller Fahrten mit Kennzahlen (Distanz, Dauer, Endpunktfehler, Ampel-Treffer), Filter nach Ballon, Jahr,
Heissluft/Gas; Vergleich mehrerer Fahrten; Export der Zeitreihen. Dient auch als Nachweis (Betriebsaufzeichnungen).

## 5 Struktur der Plattform

Navigation oben: **Briefing · Fahrt · Debriefing** (je Fahrt), dazu die Übersicht aller Fahrten (heutige Briefings-Seite,
erweitert um Spalten «Fahrtdaten» und «Debriefing»). Die Fahrt-ID ist die Briefingnummer; Nachträge (a, b, c) gehören
zur selben Fahrt. Rollen bleiben: Master (eigene Fahrten), Supermaster (alle, Modellparameter), Links für Crew,
Rückholer und Materialeigner (lesen).

## 6 Name

Vorschlag **flightportal.wicki.aero** ist tragfähig (neutral, DE/EN). Alternativen zur Prüfung:

| Name | Für | Gegen |
|---|---|---|
| flightportal.wicki.aero | neutral, beschreibt Briefing + Fahrt + Debriefing | generisch |
| fahrt.wicki.aero / flight.wicki.aero | kurz, Ballonsprache («Fahrt») | nur deutsch bzw. nur englisch |
| ops.wicki.aero | kurz, «Operations» deckt alle drei Teile | wenig sprechend für Externe (Pax, Rückholer) |
| logbook.wicki.aero | betont Aufzeichnung | unterschlägt die Planung |

Empfehlung: flightportal.wicki.aero als Hauptname, `briefing.wicki.aero` als Weiterleitung beibehalten (Links in
Umlauf). Umbenennung erst, wenn Fahrtdaten produktiv sind.

## 7 Etappen der Umsetzung (Vorschlag)

| Stufe | Inhalt | Voraussetzung |
|---|---|---|
| 0 | Beförderungsschein, Flugauftrag, ICAO-FPL aus dem Final | Formularvorlagen/Beispiele (liegen vor), 2–3 Briefing-Iterationen abgeschlossen |
| 1 | Fahrtdaten: Stammdaten Tracker je Ballon, Worker-Cron APRS + inReach, Live-Karte, manuelle Ereignisse | aprs.fi-Schlüssel, inReach-MapShare-URL, Testfahrt |
| 2 | Bord-Telemetrie (Gas) über reporting.wicki.aero einspielen, Profil-Live-Sicht | Schnittstelle/Format von reporting.wicki.aero geklärt |
| 3 | Debriefing: Soll/Ist-Vergleich, Bericht, Export | Stufe 1 produktiv, 2–3 aufgezeichnete Fahrten |
| 4 | Modellkalibrierung (Gas), Rückfluss in die Planung | ≥ 3 Gasfahrten mit Bord-Daten |
| 5 | Umbenennung, Fahrtenarchiv, Auswertung über Fahrten | Stufen 1–3 produktiv |

Aufwand grob: Stufe 0 eine Sitzung; Stufe 1 zwei Sitzungen; Stufe 2 eine bis zwei (abhängig von reporting);
Stufe 3 zwei; Stufe 4 zwei bis drei (iterativ mit Fahrten); Stufe 5 eine.

## 8 Risiken und Grenzen

* **Datenlücken**: APRS-Empfang im Gebirge und über Wasser unzuverlässig, inReach nur alle 10 min → die Ist-Bahn ist
  eine Zusammenführung mit Lücken; Kennzahlen tragen eine Qualitätsangabe.
* **Wind aus der Bahn** ist nur ein Näherungswert (Ballon = Luftpaket, aber Höhe wechselt) – für die Kalibrierung
  der Windkorrektur nur Fenster mit stabiler Höhe verwenden.
* **Rechtliches**: Trackingdaten der Crew/Pax sind Personendaten; Speicherung nur im Fahrtfenster, Zugriff über
  Rollen/Links, Löschfrist festlegen (Frage 7).
* **Worker-Limits**: Cron alle 2 min, kleine Abfragen – unkritisch; aprs.fi erlaubt ohne Absprache nur geringe
  Abrufraten (Schlüssel nötig, Nutzungsbedingungen prüfen).
* **Kalibrierung** braucht saubere Ereignisdaten (Ballast kg, Zeit) – ohne Bord-Erfassung bleibt sie grob.

## 9 Offene Fragen (bitte je Nummer antworten)

1. Beförderungsschein/Flugauftrag: gelten die am 04.10.2026 gelieferten Beispiele unverändert als Vorlage, oder gibt es neuere Formulare? (`unverändert` / `neu`)
2. APRS: Rufzeichen je Ballon/Korb und bevorzugter Weg – aprs.fi (Schlüssel vorhanden?) oder eigener APRS-IS-Client? (`aprs.fi` / `eigener Client` / `beides`)
3. reporting.wicki.aero: Welche Daten werden heute übertragen (Felder), in welchem Format (JSON/CSV/Text), wohin (Endpunkt/Repo), wie oft, und wer pflegt die Sendeseite (Hilmar/ESP32-S3)? Bitte Beispielpaket oder Link zum Repository.
4. Garmin inReach: MapShare-Feed vorhanden (URL mit/ohne Kennwort)? Ein Gerät je Korb oder je Person? (`je Korb` / `je Person`)
5. Heissluftfahrten: sollen Fahrtdaten auch dort erfasst werden (APRS/inReach vorhanden?), oder zuerst nur Gas? (`beide` / `nur Gas`)
6. Ereignisse im Korb (Ballast, Ventil, Brenner): Erfassung per Handy-Seite der App oder kommen sie aus dem Instrument? (`Handy` / `Instrument` / `beides`)
7. Löschfrist für Trackingdaten (z. B. 2 Jahre) und wer darf die Ist-Bahn sehen (Crew-Link, Rückholer, Pax)? (`Frist in Monaten` / Rollen)
8. Name: `flightportal` oder einer der Alternativen (`fahrt` / `flight` / `ops` / `logbook` / anderer Vorschlag)?
9. Reihenfolge: Stufe 0 (Dokumente) vor Stufe 1 (Fahrtdaten) wie vorgeschlagen? (`ja` / andere Reihenfolge)
