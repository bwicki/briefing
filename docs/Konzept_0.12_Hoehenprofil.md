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

Ergänzungen vom 06.10.2026, später Nachmittag (Stand 8 der Skizze, während der Umsetzung):

| Nr. | Punkt | Entscheid |
|---|---|---|
| 29 | Lufträume ab GND, Nebel | Lufträume, die bis GND reichen (CTR u. a.), sowie Nebel-/Stratusdecken enden an der **Reliefline**, nicht an der 0-m-Linie (Fläche = Polygon mit Reliefunterkante). |
| 30 | AGL-Warnung | Zweizeilig «< 300 m AGL» / «68–77 km», rot, in der Schriftgrösse der Sonnenzeiten, **auf Höhe der Distanzskala**, hinterlegt (überdeckt die km-Beschriftung); die Fläche bleibt rot schraffiert. Mindestabstand im Expertenmenü einstellbar. |
| 31 | Zwischenstriche | Distanzskala: bei 25/50/75 % der Hauptteilung; Zeitskala: bei 30'. |
| 32 | Legende | Kompakter (kleinerer Zeilenabstand) und **nur mit den Symbolen, die in der Grafik vorkommen**. |

Ergänzungen vom 06.10.2026, 16 Uhr (Stand 9 der Skizze):

| Nr. | Punkt | Entscheid |
|---|---|---|
| 33 | HX-Lufträume | Unter der Bezeichnung nur «HX»; feste Gültigkeitszeiten (openAIP «hours») werden angeführt und auf die Breite der Fläche umbrochen (max. 3 Zeilen). |
| 34 | Lufträume bis GND | Keine Bodenlinie: Oberkante und senkrechte Grenzen bis auf den Boden; eine Unterkante nur dort, wo sie über dem Relief liegt. |
| 35 | Achtung-Zeichen | Kein Text unter dem Symbol (Ausnahme Wind: «35 kt»); Einzelheiten (Zeit, km-Abschnitt, Werte) im Tooltip. Anhaltende Bedingungen werden zu einem Zeichen mit Abschnitt zusammengefasst; Nebel nur bei Fahrthöhe ≤ 600 m über Grund. |
| 36 | Vereisung | Symbol Schneestern; Regen-Symbol (Tropfen) im Beispiel gezeigt. |
| 37 | AGL-Warnung | Zusammengeschrieben «<300m AGL». |
| 38 | Etappen | Namen oberhalb der Grafik (eigene Zeile), Etappenstriche reichen über die Grafik hinaus bis zum Namen; am rechten Rand links angeschrieben. |
| 39 | Modellwahl | Im Werkzeug Liste der Modelle mit Druckflächen, deren Horizont den Fahrtbeginn erreicht; deckt eines die Fahrt nur teilweise ab: «⚠ bis +X h» in der Liste, Warnung unter der Layer-Box, Marker «← Ende Prognosemodell» über der Grafik auf Höhe der Etappennamen; Bahn, Relief und Lufträume enden am Modellhorizont (`p.model`, `data.cut`). |
| 40 | Wasserflächen | Blaue Einsätze im Geländeprofil. Quelle: ebene Läufe ≥ 3 km (±1 m) im Höhenmodell (Copernicus DEM zeigt Seen eben); Heuristik, in der Legende so benannt; Abgleich mit OSM-Wasserflächen in 0.12.x. |

Ergänzungen vom 06.10.2026, 16:47 (Stand 10 der Skizze, Version 0.12.1):

| Nr. | Punkt | Entscheid |
|---|---|---|
| 41 | Modellmarker | Pfeil «Ende Prognosemodell» zeigt auf die Prognosegrenze. |
| 42 | Höhenlinien | Über die ganze Breite, vor Nacht/Dämmerung und vor dem Relief, damit die Geländehöhe ablesbar ist. |
| 43 | Regen-Symbol | Drei Tropfen im Warnkreis (Option A, verwendet); Optionen B (Wolke mit Tropfen) und C (Striche mit Bodenlinie) in der Skizze gezeigt. |
| 44 | Pillen und Beschriftungen | «m/s» in den Raten-Pillen deutlich kleiner; Punktbeschriftung kompakt «2300m·19:30» mit kleinem «m». |
| 45 | Alte Sonnenkürzel | ECET/BCMT-Texte am unteren Grafikrand entfernt (die Sonnenzeile trägt Kürzel und Zeiten); feine Linien bleiben. |
| 46 | Achtung-Zeichen | Durchscheinend (Kreis mit 35 % Deckung), nicht auf deckendem weissem Grund. |
| 47 | Nullgradgrenze | Beschriftung entfällt; «0 °C» links an der Linie genügt. |
| 48 | Pillen-Position | Mittig auf dem Teilstück, horizontal und vertikal (bei Fahrt im Ausgleich also auf der Linie). |
| 49 | Inversion/Isothermie | Aus dem Modellprofil je Stunde: Inversion (Gradient > +0,1 K/100 m) als Band mit gestrichelter Mittellinie, Isothermie (−0,2 … +0,1 K/100 m) als helleres Band; zusammenhängende Flächen werden verbunden. |
| 50 | Modellwahl | Pille «Modell GFS ⋯» in der Werkzeugleiste; Klick öffnet die Liste (⚠ bei Teilabdeckung); kein separates Kästchen. |
| 51 | Werkzeugleiste | Alle Schalter auf einer Zeile (Profil/Karte, LT/UTC, Rückgängig, Modell, Beispiel, Wetter, Lufträume); Hinweis und Modellwarnung darunter. |
| 52 | Achsenhinweis | Nicht mehr über der Grafik; erster Eintrag der Legende. |
| 53 | Beispiel | Knopf «Beispiel» zeigt eine synthetische Beispielfahrt (wie die Skizze) mit nummerierten Erklärungen in der Grafik und darunter sowie «Woher die Daten kommen»; dort kann geübt werden, nichts wird gespeichert; «Beispiel schliessen» führt zur aktuellen Planung zurück. |
| 54 | Ballasttabelle | Unter der Grafik, dynamisch nachgeführt; ab 7 Teilstücken zwei, ab 13 drei Spalten; Zeiten/Höhen ohne Umbruch. |
| 55 | Legende | Inversion und Isothermie als eigene Einträge. |
| 56 | Achsen (Stand 11) | Zeilenbeschriftungen «Sonne» und «Tag» links der Achsen entfallen. |
| 57 | Wording | «Level-Out» statt «Abblasen» (Gasverlust über der Prallhöhe). |
| 58 | Spalten | «Temp.» = Ballast für die Abkühlung Gas–Luft (Tag→Nacht, Bewölkung; 0,4 %/K, halbstündlich; ▲ = Gewinn), «Adiab.» = Abkühlung beim schnellen Steigen (1,0 gegen 0,65 K/100 m, anteilig ab 0,3 m/s); Tooltip im Kopf, Liste im Block «Modell der Schätzung». |
| 59 | Modell der Schätzung | Einklappbarer Block über die ganze Breite unter der Tabelle (Vorgabe zu); im Briefingdruck nur, wenn aufgeklappt (Zustand `profile.fold.model`). |
| 60 | Legende | Einklappbar (Vorgabe offen, `profile.fold.legend`); im Briefingdruck immer; erste Zeile = Bedienhinweis (Profil/Karte), nicht mehr über der Grafik. |
| 61 | Titel | «Schätzung Ballastverbrauch». |
| 62 | Wettermodell | Pille «Wettermodell ‹Name› ⋯»; Vorgabe das feinste Modell (Gitterweite), das die ganze Fahrt abdeckt (+6 h Reserve); kein «Auto» in der Liste; `suggestModel` wählt nach Gitterweite. |
| 63 | Wasserflächen | OpenStreetMap über Overpass (`is_in` je km-Punkt, natural=water ohne Flüsse/Kanäle), Worker `/api/wx/water` mit 30-Tage-Cache, lokaler Modus direkt; Heuristik aus dem Relief nur als Rückfall (Legende nennt die Quelle). |
| 64 | FIS-Kontakte | FIS-Sektoren aus openAIP (Typ 33) entlang der Bahn → Kontakte je Etappe (Name · Frequenz); sonst Kontakte je Land aus den Einstellungen. Statische Werte DE/FR/IT aus der AIP noch nicht verifiziert. |
| 65 | Druck | Aufklappzustand gilt nur für den Block «Modell der Schätzung»; die Legende wird immer gedruckt. |

Noch offen (in der Umsetzung klären):
- f) Wind je Fahrthöhe aus den Open-Meteo-Druckflächen interpoliert – Stundenauflösung ausreichend, oder Unsicherheit (±) auf der Zeitzeile zeigen?
- g) Beim Ziehen eines Punkts ändert sich die Bahn (andere Niveaus = andere Richtung) – Karte und Relief sofort nachrechnen oder erst beim Loslassen? (Vorschlag: Profil sofort, Karte/Relief beim Loslassen, mit Fortschrittsanzeige.)

## 3 Datenmodell (Briefing) – Stand der Umsetzung 0.12.0

```js
b.profile = {
  points: [{ km: 0, alt: 450 }, { km: 2, alt: 1300 }, …],   // gefahrene Distanz entlang der Bahn, m AMSL; sortiert, erster 0 km, letzter = Bahnlänge
  stages: [{ id, km: 0, name: 'Start' }, { id, km: 30, name: 'Enroute' }, …],   // Grenzen; Nummerierung aus der Reihenfolge
  layers: { wx: true, as: true }, base: 'neutral',             // Layer-Schalter, Grundkarte der Kartenansicht
  updated, model,                                             // letzte Änderung im Werkzeug; gewähltes Modell (Werkzeug)
  data: {                                                     // Schnappschuss «Daten aufbereiten» (js/auto/profiledata.js)
    stand, model, modelName, source, fetched, totalKm, ok, startMs, endMs, durationMin, tz,
    track: { points: [{ ms, km, lat, lon, alt, spdKt, dir }] },   // zusammengesetzte Bahn, 10-min-Schritte
    waypoints: [{ lat, lon, km }],                             // Prognoseorte (alle 40 km, max. 7)
    relief: [{ km, m }],                                       // Open-Meteo Elevation je km
    hours: [{ ms, km, lat, lon, alt, ground, clouds: [{ lo, hi, label }], inv: [{ lo, hi, kind: 'inv'|'iso' }], fzl, windKt, shearKt, tempAtAlt, rhAtAlt, cape, fogRisk, precip, cloud, temp2m, dew2m }],
    sun: [{ kind: 'ss'|'ecet'|'bcmt'|'sr', ms, km }],           // astronomisch am Bahnpunkt
    airspaces: [{ name, typeKey, cls, country, status: 'cross'|'near', km0, km1, lo, hi, lowerTxt, upperTxt, tmp, freqs }],
    water: [{ km0, km1, m }], cut, plannedEndMs, modelHours,                 // Wasserflächen (Heuristik), Modellhorizont vor Fahrtende
    firs: [{ name, country, fromKm, toKm }], hazards: [{ type, km, kmEnd, alt, ms, msEnd, lbl, txt }], errors: [],
  },
};
b.time.base         // 'LT' | 'UTC' – Zeitzone von Werkzeug, Tabellen und Druck
b.weather.fillPct   // 0.11.4, Vorgabe 100
b.balloon.wz        // Widerstandszahl aus den Stammdaten der Hülle (Experten), sonst 3,5 / 3,8 nach Volumen
S.aero              // 0.11.4: dtDayClear, dtNightClear, dtDayOvercast, dtNightOvercast, liftPctPerK, fullLossPctPer80m
S.profileLimits     // 0.12: windKt 30, shearKt 20, cape 500, minAgl 300
S.fisContacts       // 0.12: [{ cc, name, freq, phone }] für die Etappenübersicht
```

Ballastplan und Etappenfenster werden nicht gespeichert, sondern aus `points`, `stages` und `data`
gerechnet (`ballastPlan`, `stageWindows` in `js/calc/profile.js`). Etappen sind Teilintervalle der
Distanz; jede Etappe hat Zeitfenster, Ort (Bahnpunkt), Land/FIR (aus der Luftraumanalyse), Lufträume,
Achtung-Zeichen und FIS-Kontakte (Etappenübersicht). Eigene Panels B/C je Etappe: **0.12.5 «Ops-Briefing je
Etappe»** – `stage.ops` (Klickbox im Etappenmenü und im Dialog beim Anlegen; Vorgabe: Startetappe), Planungsdaten
`b.stagePlans[stageId].panels`, abgeleitete Sicht `stagePlanBriefing()` (`js/calc/stageplan.js`): Ort =
Etappenmitte, Zeitfenster = Etappe, Landeraum = Etappenende, Luftraum/NOTAM entlang des Bahnabschnitts.

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
- Etappen im Editor (0.12.5): Abschnitt «E‹n› · Etappe n · Name» zwischen C und D je Etappe mit Planung (ausser der
  Startetappe = Abschnitte B/C), Zeitfenster und Ort in der Unterzeile, eigene B/C-Panels; Pflichtpanels wie im
  Hauptbriefing (Einstellungen), Mindestens-eine-Planung-Regel, Marke B/C im Werkzeug.
- Kontakte FIR/Land aus dem AIP (Vorgabe CH/D/A/F/I in den Einstellungen, Experten).
- Nachfahrer-Abschnitt ab 12 h Fahrtdauer: Route, Maut/Vignetten, Übernachtung, Grenzdokumente.
- Druck: Profil als Vollbreite-Grafik, Ballasttabelle in A3, Etappenübersicht als Tabelle.

### Umgesetzt in 0.12.0–0.12.2 / offen

Umgesetzt: Panel A «Fahrtprofil» mit Datenaufbereitung, Grafik als Bild und Werkzeug (alle Punkte
der Skizze Stand 11, inkl. Beispiel mit Erklärungen, OSM-Wasser, FIS-Sektoren), Kartenansicht mit Grundkarten, Ballastschätzung, Etappenübersicht mit Kontakten,
NOTAM-Orte aus Etappen, Nachfahrer-Panel ab 12 h, Druck, Zeitzone einheitlich; 0.12.5: Ops-Briefing je
Etappe (Abschnitte E‹n›); 0.12.6: Gliederung der Erarbeitung nach Etappen (E1 = B/C), Speichern/Verwerfen
und Spreizung Höhe im Werkzeug; 0.12.7: Ausschnitt-Schieber unter der Zeitskala (Beginn-/Endmarke, nicht
gespeichert), Planung der Startetappe nur auf ihren Bereich sobald weitere Etappen bestehen (Umbenennung
«Enroute» → «Start»), Panel-Nummern mit Etappe («E1-C3»). Offen (0.12.x): Pflichtpanels je Land, Kalibrierung über Inventurpunkte und
Barogramm, Unsicherheit auf der Zeitzeile (Frage f), Nachrechnen beim Ziehen statt beim Loslassen
(Frage g – umgesetzt ist: Profil sofort, Bahn/Relief/Lufträume beim Loslassen mit Statusanzeige).

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

«0.12 beginnen: Etappenmodell und Höhenprofil-Werkzeug gemäss docs/Konzept_0.12_Hoehenprofil.md und docs/Aerostatik_Gasballon.md; Skizze Stand 10 als Vorlage. Zuerst Datenmodell + Kopplung Distanz/Zeit + Ballastmodell mit Tests (calc), dann Werkzeug-UI, dann Etappen im Editor/Karte, dann Druck. Lieferung wie üblich nach Dropbox v0.12.0 und Push.»

Empfehlung Modell/Aufwand: Fable 5.1 oder Opus 5.5, Aufwand hoch; Rückfragen und kleine Korrekturen mit Sonnet 5.5, Aufwand mittel.
