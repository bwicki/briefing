# Konzept 0.12 – Etappenmodell und Höhenprofil-Werkzeug (Gasfahrt)

Stand 05.10.2026, nach den Antworten von B. Wicki auf die Fragen zu 0.11.3. Dieses Dokument ist die Startvorlage für die Umsetzungssitzung 0.12. Grundlagen der Aerostatik: `docs/Aerostatik_Gasballon.md`. Interaktive Skizze: `00_Konzept/Hoehenprofil_Werkzeug_Skizze.html` (Stand 7, 06.10.2026).

## 1 Ziel

Für Gasfahrten (typisch 10–20 h, über Nacht, mehrere Länder) soll das Briefing die Fahrt in **Etappen** gliedern und die **geplanten Fahrthöhen** als Profil über der gefahrenen Strecke erfassen. Aus dem Profil folgen Steig-/Sinkraten, Zeitachse, Relief-Abstand, Wolken-/Dämmerungslage und die **Ballastschätzung nach der Aerostatik** (nicht kg/h, sondern Manöver, Abblasen über der Prallhöhe, Tag/Nacht-Übergang, Adiabatik).

## 2 Entscheide (05.10.2026)

| Nr. | Frage | Entscheid |
|---|---|---|
| 1 | Zeitachse | Beide X-Beschriftungen **unten untereinander**: Zeile 1 gefahrene Distanz entlang der Trajektorie (km), Zeile 2 Lokalzeit. Die Zeit folgt aus der Distanz über die **Windgeschwindigkeit der jeweiligen Fahrthöhe** (Trajektorie je Niveau). |
| 2 | Relief | Geländeband (Open-Meteo Elevation entlang der Trajektorie) mit **300 m Mindestabstand** als helles Band; Unterschreitung wird rot schraffiert und beschriftet. |
| 3 | Etappen auf der Karte | Ja. **Marker deutlich anders als die Zeitmarken** der Trajektorien: gefüllte Raute mit Fähnchen und Name (Akzentfarbe), Zeitmarken bleiben kleine weisse Punkte. |
| 4 | Überhitzung Gas–Luft | Vorgaben klar +15 / −3 K, bedeckt +5 / −1 K; 0.4 % Auftrieb je K; über Prallhöhe −1 % je 80 m. **Im Expertenmenü hinterlegt (seit 0.11.4: Einstellungen → Experten → Aerostatik, `S.aero`).** |
| 5 | Füllungsgrad | **Eingabe in der Fahrtvorbereitung (A3), Vorgabe 100 %** (meist wird voll gefüllt). Seit 0.11.4: `b.weather.fillPct`, `fillFractionOf(b)` in `model.js`. |
| 6 | Bearbeitungsstand | Bleibt: zählt beim ersten Speichern einer Sitzung, nicht beim blossen Öffnen. |
| 7 | Lightbox | Auch im Editor (seit 0.11.4). |
| 8 | Alter METAR/TAF | Relativ zum **Publikationszeitpunkt des Briefings** (Freigabe als Final); in Erarbeitung relativ zu jetzt, nach der Fahrt (gesperrt, ohne Freigabe) relativ zum Start. Seit 0.11.4: `ageRefMs(b)`. |
| 9 | autorouter | Konto angelegt, Freischaltung durch autorouter-Admin ausstehend. Danach Secrets `autorouter_user` / `autorouter_pass` gemäss SETUP (Browser-Weg über GitHub Actions). |
| 10 | Kontakte FIR/Land | Vorgabewerte aus dem AIP (CH/D/A/F/I) reichen. |

Ergänzungen vom 06.10.2026 (Stand 4 der Skizze):

| Nr. | Punkt | Entscheid |
|---|---|---|
| 11 | Zeichenreihenfolge | Raten-Pillen **immer zuoberst**; Nacht und Relief zuhinterst, dann Lufträume, Wetter (Decken, Inversion, Symbole), Sonne/Etappen, Profil, Punkte, Menüs, Pillen. |
| 12 | Etappenmenü | Zusätzlich «Etappe löschen (mit Nachfolger zusammenlegen)»: der Nachfolger beginnt am Anfang der gelöschten Etappe; «mit Vorgänger»: der Vorgänger übernimmt den Abschnitt. |
| 13 | Kartenansicht | Umschalter Profil / Karte im Werkzeug; die Karte ist **reine Ansicht** (Bahn, Stundenmarken, Höhenpunkte mit Höhe, Etappenmarker, Luftraumflächen) – kein Ziehen, kein Menü. |
| 14 | Mehrtägige Fahrten | Dritte Achsenzeile «Tag» mit Wochentag und Datum («Di 06.10.2026», ab Mitternacht «Mi 07.10.2026»); Zeiten nach Mitternacht überall mit Wochentag («Mi 02:00»). |
| 15 | Luftraum-Layer | Lufträume A–D, TMA, CTR aus der vorhandenen openAIP-Analyse als Flächen mit Unter-/Obergrenze im Profil und als Flächen auf der Karte; Beschriftung Name · Klasse · Grenzen; «durchfahren», wenn das Profil im Höhenband liegt. E/G nicht gezeichnet. |
| 16 | Layer-Schalter | Kästchen rechts oben: «Wetter» und «Lufträume», Vorgabe beide ein; gelten für Profil und Karte. |

Ergänzungen vom 06.10.2026, mittags (Stand 5 der Skizze):

| Nr. | Punkt | Entscheid |
|---|---|---|
| 17 | Lufträume | Kein Hinweis «durchfahren» (Piloten kennen die Bedeutung). Temporärer Status – HX oder anderer – in Klammern **unter der Bezeichnung** («(HX · aktiv gemäss DABS/NOTAM, Mo–Fr 07:30–17:00 LT)»); Quelle: openAIP-Attribute + DABS/NOTAM-Aktivierungen. |
| 18 | Etappengrenzen verschieben | Griff ⋮ an jeder Grenze am unteren Rand des Diagramms, horizontal ziehbar zwischen Vorgänger und Nachfolger (≥ 2 km Abstand); Startgrenze fest bei 0 km. |
| 19 | Rückgängig | Stapel der letzten 50 Zustände (Punkte + Etappen); Knopf «↶ Rückgängig» in der Werkzeugleiste und Ctrl+Z; jede Änderung (Löschen, Zusammenlegen, Ziehen, Setzen, Umbenennen) ist ein Schritt. |
| 20 | Nummerierung | Etappen werden vom Start her automatisch nummeriert (1, 2, 3 …) – im Profil, auf der Karte, im Menü und in den Etappen-Panels; eine dazwischen gesetzte Etappe nummeriert neu. Der Name bleibt frei wählbar. |
| 21 | Kartenansicht | Neutrale Grundkarte (Carto Positron) als Vorgabe; umschaltbar auf OpenStreetMap, OpenTopoMap, Luftfahrtkarte (openAIP-Kachel-URL aus den Einstellungen) und Satellit (Esri). Wetter-/Luftraum-Layer gelten auch hier. |
| 22 | Zeitskala | Genaue Zeiten SS · ECET · BCMT · SR in kleiner Schrift unter der Zeitzeile an ihrer Position (links/rechts der Marke, damit nahe Paare nicht überlappen). Schalter **LT / UTC** in der Werkzeugleiste: Stundenmarken, Sonnenzeiten, Tageszeile, Punkt- und Etappenzeiten und Ballasttabelle folgen der gewählten Skala (CEST = UTC+2, aus der Zeitzone des Startorts). |

Ergänzungen vom 06.10.2026, nachmittags (Stand 6 der Skizze):

| Nr. | Punkt | Entscheid |
|---|---|---|
| 23 | Luftraum-Layer (Frage h) | Durchfahrene **und nahe** Lufträume zeichnen – dieselbe Auswahl wie im Luftraum-Panel (Korridor aus den Einstellungen). |
| 24 | Zeitzone (Frage i) | Im Werkzeug, im Briefing und im Druck **einheitlich die Zeitzone des Briefings** (LT oder UTC); der LT/UTC-Schalter im Werkzeug ist der Briefing-Schalter, kein Durchmischen von UTC und LT. Vorgabe wie bisher LT; Flugplan-Zeiten bleiben UTC (ICAO). |
| 25 | Sonnenzeiten | Unter der Zeitzeile Kürzel (SS, ECET, BCMT, SR) und darunter die Uhrzeit, links- oder rechtsbündig zur Marke (SS/BCMT rechtsbündig, ECET/SR linksbündig), eine Stufe kleiner als die Stundenmarken; der Strich reicht von der horizontalen Zeitlinie bis unter die Zeitangabe. |
| 27 | Nullgradgrenze | Teil des Wetter-Layers: 0-°C-Höhe aus dem Modellprofil je Stunde am Bahnpunkt (Interpolation zwischen den Druckflächen), als gepunktete Linie mit Beschriftung «0 °C». |
| 28 | Wording | In der App heisst es durchgehend «Nutzer» (nicht «Benutzer»); Datenzugänge bleiben zentral, keine Klickboxen je Nutzer. |
| 26 | Achtung-Zeichen | Symbol zeigt den Grund: Wind (Windlinien), Scherung/Turbulenz (Zickzack), Gewitterneigung (Blitz), Nebel (≡), Niederschlag (Tropfen), Vereisung (Schneeflocke); Kurztext darunter («Wind 35 kt», «Scherung», «CB-Neigung» …), Tooltip mit Einzelheiten. Quellen: Modellprofil (Wind/Scherung je Schicht), Thermik/CAPE, RH/T (Nebel, Vereisung), Niederschlag. |

Noch offen (in der Umsetzung klären):
- f) Wind je Fahrthöhe aus den Open-Meteo-Druckflächen interpoliert – Stundenauflösung ausreichend, oder Unsicherheit (±) auf der Zeitzeile zeigen?
- g) Beim Ziehen eines Punkts ändert sich die Bahn (andere Niveaus = andere Richtung) – Karte und Relief sofort nachrechnen oder erst beim Loslassen? (Vorschlag: Profil sofort, Karte/Relief beim Loslassen, mit Fortschrittsanzeige.)

## 3 Datenmodell (Briefing)

```js
b.profile = {
  layers: { wx: true, as: true }, tz: 'LT', base: 'neutral',                 // Layer-Schalter, Zeitskala, Grundkarte (je Briefing gespeichert)
  points: [{ km: 0, alt: 450 }, { km: 2, alt: 1300 }, …],   // gefahrene Distanz entlang der Bahn, m AMSL; sortiert nach km
  stages: [{ id, km: 0, name: 'Start' }, { id, km: 30, name: 'Enroute · Mittelland' }, …],
  track: { stand, points: [{ km, lat, lon, alt, ms, windKmh, dir }] },   // zusammengesetzte Bahn (Ergebnis, 1-km-Schritte)
  relief: { stand, m: [ … je km … ] },                                   // Open-Meteo Elevation
  clouds: [{ km0, km1, h0, h1, label }], inversions: [[km, m], …],       // aus dem Modellprofil je Stunde/Ort
  ballast: { rows: [ … je Teilstück … ], total, landing, avail, gain },  // Resultat
};
b.weather.fillPct   // 0.11.4, Vorgabe 100
S.aero              // 0.11.4: dtDayClear, dtNightClear, dtDayOvercast, dtNightOvercast, liftPctPerK, fullLossPctPer80m
```

Etappen sind Teilintervalle der Distanz (`km` der Grenze). Jede Etappe hat Zeitfenster (aus der Kopplung), Ort (Bahnpunkt), Land/FIR (aus der Luftraumanalyse) und eigene Panels B/C (Meteo, Luftraum/NOTAM/DABS, Kontakte).

## 4 Algorithmen

**Bahn und Zeit.** Aus den vorhandenen Trajektorien je Niveau (Open-Meteo, Stundenpunkte) wird eine zusammengesetzte Bahn gebildet: je km die Richtung und Geschwindigkeit des Niveaus, das der geplanten Höhe `alt(km)` am nächsten liegt (linear zwischen zwei Niveaus interpoliert). Zeit `t(km) = Σ dk / v(alt(km))`. Die Zeitzeile zeigt die vollen Stunden an den sich ergebenden Positionen (ungleich verteilt).

**Relief.** Open-Meteo Elevation API an den Bahnpunkten (1-km-Raster, Batch à 100 Punkte, Cache im Worker). Band `relief + 300 m`; Teilstücke mit `alt < relief + 300` (ausser erste 4 / letzte 5 km) werden markiert.

**Sonne.** BCMT/ECET am jeweiligen Bahnpunkt der Stunde (RAC 4-4 CH, DWD-Bericht DE, sonst astronomisch) → Zeit → über die Kopplung auf die Distanzachse.

**Wolken/Inversionen.** Modellprofil je Stunde am Bahnpunkt (RH ≥ 95 % je Druckfläche), zusammenhängende Schichten als Decken mit Mächtigkeit in m; Inversionen als Linie; Nullgradgrenze (0 °C) als gepunktete Linie; signifikantes Wetter als Achtung-Zeichen mit Grund-Symbol (Wind ≥ Grenzwert der Ampel, Scherung = Windsprung zwischen benachbarten Schichten, CB-Neigung aus CAPE/Thermik, Nebel RH/T-Td, Niederschlag, Vereisung T < 0 °C in Wolken).

**Raten.** Je Teilstück `r = Δalt / Δt` in m/s (eine Dezimale). Farben: |r| < 0.5 grau (Höhe halten), 0.5–1.75 grün, bis 3 gelb, darüber rot.

**Ballast je Teilstück** (Herleitung in `Aerostatik_Gasballon.md` §8):
1. Manöver: `WZ(h) · v²` mit `v = max(|r|, 1 m/s)`, Abfangen × 1.3 (Überwerfen). `WZ` aus Stammdaten (Emden Tab. 10: 945 m³ 3.5, 1050 m³ 3.8 kg·s²/m²), mit der Luftdichte skaliert.
2. Abblasen über der Prallhöhe: `lift(pH) · 1 % · Δh/80 m`; Prallhöhe aus Füllungsgrad (`n = 1/FG`), bei 100 % = Starthöhe; Prallhöhe wandert mit der erreichten Höhe.
3. Temperatur Gas–Luft: `ΔT(t) · 0.4 % · Auftrieb`; Abnahme kostet Ballast, Zunahme ergibt Auftrieb (Ventil/Steigen). ΔT aus `S.aero` (klar/bedeckt aus der Bewölkung des Modells am Ort/Zeit), Übergang 2 h um ECET/BCMT.
4. Adiabatik beim schnellen Steigen: `(1.0 − Γ) · Δh/100 · kg/K`, gewichtet mit der Rate.

Summe + Landeballast (Reserve + Bremsballast aus Stammdaten) gegen den Vorrat (A3 Ballast). Anzeige als Tabelle und Balken; > 85 % des Vorrats = Warnung.

**Kalibrierung.** Keine Dauermessung: periodische Ballast-Inventuren als Zeitpunkte erfassen; das Modell summiert zwischen zwei Inventuren; Differenz = Korrekturfaktor je Ballon/Fahrt; Barogramm als zweite Kontrolle.

## 5 Oberfläche

- Neues Panel **A «Fahrtprofil»** (nur Gas): Grafik als Bild im Briefing, Klick öffnet das Werkzeug (Vollbild-Dialog).
- Werkzeug: SVG wie Skizze Stand 5; Werkzeugleiste: Umschalter Profil / Karte (Karte nur Ansicht), LT / UTC, «↶ Rückgängig», Layer-Schalter Wetter / Lufträume rechts; Achsen km / Zeit (mit SS · ECET · BCMT · SR) / Tag; Etappengriffe am unteren Rand; Pillen zuoberst. Punkte ziehen, Doppelklick setzt, ≡ rechts oben neben Punkt/Etappe (einfügen davor/danach, löschen; Etappe umbenennen/löschen). Klick auf die Zeitzeile setzt eine Etappengrenze. Jeder Punkt: Höhe, Zeit, km, Wind/Temperatur des Modells.
- Karte (Trajektorien-Panel und Werkzeug): Bahn der gewählten Höhen in Akzentfarbe; Etappen als Raute + Fähnchen + Name; Höhenpunkte als kleine Akzentpunkte mit Höhe; Zeitmarken unverändert klein; Luftraumflächen nach Layer.
- Etappen im Editor: Abschnitte B/C je Etappe mit Zeitfenster und Ort (Akkordeon je Etappe), Pflichtpanels je Etappe nach Land.
- Kontakte FIR/Land aus dem AIP (Vorgabe CH/D/A/F/I in den Einstellungen, Experten).
- Nachfahrer-Abschnitt ab 12 h Fahrtdauer: Route, Maut/Vignetten, Übernachtung, Grenzdokumente.
- Druck: Profil als Vollbreite-Grafik, Ballasttabelle in A3, Etappenübersicht als Tabelle.

## 6 Abnahmekriterien

1. Beispielfahrt 1000 m³ H₂, Füllungsgrad 100 %, 180 km, Start 16:00: Zeitzeile ungleich verteilt, Landung vor/nach BCMT korrekt schattiert.
2. Punkt nach oben ziehen → Zeitzeile rechts davon rückt zusammen, Bahn auf der Karte dreht; Relief-Warnung erscheint bei < 300 m.
3. Ballasttabelle: Steigen 450 → 1300 m bei 100 % Füllung kostet ≈ 10–11 % der Tragfähigkeit (≈ 110 kg je 1000 m³) als Abblasen + Manöver; Abendübergang +15 → −3 K ≈ 18 K × 4.5 kg ≈ 80 kg.
4. Etappe setzen/umbenennen/löschen (Vorgänger/Nachfolger), Grenze mit dem Griff verschieben, Rückgängig (Knopf und Ctrl+Z) stellt den vorherigen Zustand her; Nummerierung folgt der Reihenfolge; Panels je Etappe erscheinen; Karte zeigt Rauten.
7. LT/UTC-Schalter: alle Zeiten im Werkzeug und in der Ballasttabelle wechseln konsistent; SS/ECET/BCMT/SR an der richtigen Position.
8. Luftraum mit HX-Status zeigt den Zusatz in Klammern; kein Warnhinweis.
5. Druck (PDF) enthält Profil, Ballasttabelle, Etappenübersicht.
6. Tests: calc (Kopplung, Prallhöhe, Ballastmodell gegen Zahlenbeispiel §9 der Aerostatik), Smoke (Werkzeug öffnen, ziehen, Etappe setzen), Remote.

## 7 Startprompt für die neue Sitzung

«0.12 beginnen: Etappenmodell und Höhenprofil-Werkzeug gemäss docs/Konzept_0.12_Hoehenprofil.md und docs/Aerostatik_Gasballon.md; Skizze Stand 3 als Vorlage. Zuerst Datenmodell + Kopplung Distanz/Zeit + Ballastmodell mit Tests (calc), dann Werkzeug-UI, dann Etappen im Editor/Karte, dann Druck. Lieferung wie üblich nach Dropbox v0.12.0 und Push.»

Empfehlung Modell/Aufwand: Fable 5.1 oder Opus 5.5, Aufwand hoch; Rückfragen und kleine Korrekturen mit Sonnet 5.5, Aufwand mittel.
