# Changelog

## 0.12.0 — 2026-10-06 · Höhenprofil-Werkzeug, Etappen und Ballastmodell (Gasfahrt)

* **Neues Panel A «Fahrtprofil: Höhen, Etappen, Ballast»** (nur Gasballon): «Daten aufbereiten» holt
  die Modellprognosen entlang der Bahn (Startort + Wegpunkte alle 40 km, Modell mit ausreichendem
  Horizont), das **Relief** (Open-Meteo Elevation über den Worker, `/api/wx/elevation`, 7 Tage Cache),
  **Stundenprofile** am jeweiligen Ort (Wolken-/Nebeldecken RH ≥ 95 %, Inversionen, Nullgradgrenze,
  Wind/Scherung in Fahrthöhe), die **Sonnenereignisse** SS · ECET · BCMT · SR entlang der Bahn und die
  **Lufträume** (openAIP, durchfahren und nahe, HX-Status) → `b.profile.data`.
* **Werkzeug (Vollbild):** Grafik Distanz × Höhe mit drei Beschriftungszeilen (km mit Zwischenstrichen
  bei 25/50/75 %; Zeit LT/UTC – aus der Distanz über den Wind der Fahrthöhe – mit 30'-Strichen und den
  Sonnenzeiten darunter; Tag/Datum bei Fahrten über Mitternacht). Punkte ziehen, Doppelklick setzt,
  ≡ Menü (einfügen davor/danach, löschen); Etappen vom Start her nummeriert, Griff ⋮ am unteren Rand
  verschiebt Grenzen, Klick auf die Zeitzeile setzt eine, Menü umbenennen/löschen (mit Vorgänger oder
  Nachfolger zusammenlegen); **Rückgängig** (Knopf, Ctrl+Z, 50 Schritte). Layer «Wetter» und
  «Lufträume», Raten-Pillen zuoberst (grau < 0,5 · grün ≤ 1,75 · gelb ≤ 3 · rot). Lufträume ab GND und
  Nebeldecken enden an der Reliefline; Mindestabstand (300 m, Experten) rot schraffiert mit Warnung
  «<300m AGL · km» auf der Distanzskala; Wasserflächen (ebene Läufe im Höhenmodell) als blaue Einsätze.
  Achtung-Zeichen mit Grund-Symbol (Wind «35 kt», Scherung, CB-Neigung, Nebel nahe Grund, Niederschlag,
  Vereisung als Schneestern; Einzelheiten im Tooltip; Grenzen unter Einstellungen → Experten). Lufträume
  ab GND ohne Bodenlinie, HX/Betriebszeiten umbrochen unter der Bezeichnung; Etappennamen oberhalb der
  Grafik. **Modellwahl** im Werkzeug: Modelle mit ausreichendem Horizont; ein Modell, das die Fahrt nur
  teilweise abdeckt, zeigt «⚠ bis +X h», eine Warnung und den Marker «← Ende Prognosemodell».
  **Kartenansicht** (nur Ansicht): Grundkarte Neutral/OSM/Topo/Luftfahrtkarte (openAIP)/Satellit,
  Bahn, Stundenmarken, Höhenpunkte, Etappenmarker (Raute + Fähnchen), Luftraumflächen.
  Nach jeder Profiländerung wird die Bahn nachgerechnet (Prognosen im Zwischenspeicher).
* **Zeitzone:** LT/UTC-Schalter im Werkzeug ist der Briefing-Schalter (`b.time.base`); Grafik,
  Tabellen und Druck folgen ihm einheitlich (Flugplan bleibt UTC).
* **Ballastschätzung nach der Aerostatik** (`docs/Aerostatik_Gasballon.md`): je Teilstück Manöver
  (WZ · v², Abfangen × 1,3), Abblasen über der Prallhöhe (1 % je 80 m, Prallhöhe aus dem Füllungsgrad),
  Temperatur Gas–Luft (Tag/Nacht klar/bedeckt aus `S.aero`, Übergang ±1 h um ECET/BCMT, Bewölkung
  aus dem Modell), Adiabatik; Summe + Landereserve gegen den Ballastvorrat aus A3 mit Balken (> 85 %
  Warnung). **Widerstandszahl WZ** je Hülle in den Stammdaten (Experten; Vorgabe 3,5 / 3,8).
* **Etappenübersicht** (Panel, Briefingsicht, Druck): Nr., Name, Zeitfenster, km, Höhenband, Ort
  (ICAO-Kurzkoordinaten Beginn → Ende), Land/FIR (Luftraumanalyse), Lufträume, Achtung-Zeichen,
  **FIS-Kontakte je Land** (Einstellungen → Experten, AIP; vorbelegt CH/AT, übrige mit AIP-Verweis).
* **NOTAM «Umkreis um Orte»:** Knopf «Orte aus Etappen» übernimmt die Etappenmitten mit passendem Radius.
* **Nachfahrer-Panel** (A, nur Gas ab 12 h Fahrtdauer): Route, Maut/Vignetten, Übernachtung,
  Grenzdokumente, Treffpunkt als Textvorlage.
* **Druck:** Profil als Vollbreite-Grafik, Etappenübersicht und Ballasttabelle im Briefing.
* Noch nicht in 0.12.0 (geplant 0.12.x): eigene B/C-Abschnitte je Etappe; Kalibrierung über
  Inventurpunkte/Barogramm; Unsicherheit der Zeitzeile (offene Fragen f/g im Konzept).
* Konzept/Skizze: `docs/Konzept_0.12_Hoehenprofil.md` mit Entscheiden 1–40, Skizze Stand 9
  (`docs/Hoehenprofil_Werkzeug_Skizze.html`).
* Tests: calc 221 (Kopplung km/Zeit, Teilstücke, Relief, Etappen, Nachtanteil, Ballastmodell,
  Achtung-Zeichen), Smoke-Lauf «gas» (Panel, Werkzeug: Ziehen, Punkt/Etappe setzen, umbenennen,
  Ctrl+Z, LT/UTC, Modellwahl mit Horizont-Warnung, Karte; Legende; NOTAM-Orte; Briefingsicht), API (`elevation`).

## 0.11.4 — 2026-10-05 · Antworten zu 0.11.3 · Füllungsgrad · Aerostatik-Parameter · Konzept 0.12

* **Vergrösserte Ansicht auch im Editor:** Klick auf Grafiken, Bilder und Datentabellen öffnet wie in
  der Briefingsicht das Grossbild (Eingabefelder, Karten, Niveauliste und Symbole ausgenommen); Bilder
  der Zusatz-/Kommentarboxen ebenfalls.
* **Alter von METAR/TAF und Beobachtungen** «(vor 0:30 h)» bezieht sich auf den **Publikations-
  zeitpunkt des Briefings** (Freigabe als Final); in der Erarbeitung auf jetzt, nach der Fahrt
  (gesperrt, ohne Freigabe) auf den Startzeitpunkt (`ageRefMs`).
* **A3 Gasballon – Füllungsgrad (%)** je Briefing, Vorgabe **100 %** (meist wird voll gefüllt);
  Gasmenge, Ballast und Kennzahlen folgen daraus; Bestand übernimmt den Stammwert der Hülle. Grundlage
  für Prallhöhe und Ballastmodell in 0.12.
* **Einstellungen → Experten → «Aerostatik Gasballon»:** Überhitzung des Traggases Tag/Nacht bei klarem
  (+15 / −3 K) und bedecktem Himmel (+5 / −1 K), Auftriebsänderung je K (0.4 %), Verlust über der
  Prallhöhe (1 % je 80 m) – Parameter des Ballastmodells 0.12 (`S.aero`).
* **Bearbeitungsstand** bleibt wie in 0.11.2 (zählt beim ersten Speichern einer Sitzung, nicht beim
  Öffnen).
* **Konzept 0.12:** `docs/Konzept_0.12_Hoehenprofil.md` mit allen Entscheiden vom 05.10.2026 als
  Startvorlage; Skizze Stand 3 (zwei X-Zeilen Distanz/Zeit, Zeit über den Wind der Fahrthöhe
  gekoppelt, 300-m-Reliefband mit Warnung, Etappenmarker auf der Karte deutlich anders als
  Zeitmarken, Ballastmodell mit 100 % Füllung).
* Tests: calc 197, Smoke (Lightbox im Editor, Aerostatik-Karte), Gasballon-Prüfung A3.
* **Wording:** in der App heisst es durchgehend «Nutzer» statt «Benutzer» (Einstellungen, Liste, Meldungen, Doku).

## 0.11.3 — 2026-10-05 · Kopie ab Schritt 1 · NVFR-Schalter · Niveauliste · Sortierung · Tragkraft-Grafik

* **Kopie eines (gesperrten) Briefings** beginnt den Ablauf wieder bei Schritt 1; Nicht-Zeitabhängiges
  bleibt (Ballon, Startort, PIC, Pax, Nachfahrer, Fahrtabsicht, Ausrüstung, Absprachen, Flugplan-
  Einstellungen), Zeitabhängiges steht auf Vorgabe (Datum morgen 06:30, Anlass leer, Startplatzwerte
  15 °C/1013 hPa manuell, Tagesplanung neu, Meteo-Panels leer).
* **«Wo und wann»:** liegt die Startzeit vor BCMT oder die Landung nach ECET, erscheint der Schalter
  **«NVFR zulassen»**; eingeschaltet macht er den **Flugplan (C) verbindlich** (Pflicht-Markierung,
  Schalter «Flugplan erstellen» fest ein, Panel gilt erst mit erstelltem Flugplan als erledigt) und setzt
  die Nachtausrüstung. Derselbe Schalter wie «NVFR» in Schritt 1.
* **Trajektorien:** Klick ins Niveaufeld öffnet eine senkrechte Liste der verfügbaren Niveaus (SFC,
  500–3000 ft AGL, 2000–10000 ft, FL100–FL150) zum An-/Abwählen; eigene Werte weiterhin tippbar.
* **Liste:** Sortierung über die Spaltenköpfe (▲/▼), Standard Ordnungsnummer absteigend (jüngste
  zuoberst); **Doppelklick** auf eine Zeile öffnet die Briefingsicht.
* **A3 Tragkraft:** Eingabe heisst **«Max. Hüllentemperatur»** mit der Vorgabe des Ballons
  («Vorgabe HB-QWZ: 110 °C»); der Wert ist je Ballon in den Stammdaten einstellbar (ohne
  Expertenmodus, neben MTOM). Grafik Tragkraft/Höhe: **Obergrenze** als rote Linie mit Beschriftung
  «Obergrenze (Hülle 110 °C): 3 450 m», Bereich darüber schraffiert, Startplatzhöhe grün, Zwischen-
  einheiten auf beiden Achsen (500 m, ¼-Schritte der kg-Skala).
* **Konzept 0.12:** `docs/Aerostatik_Gasballon.md` – Grundlagen der Gasballon-Aerostatik aus
  Emden (DFSV-Handbuch 2.10) und «Gone with the Wind» Kap. 4 als Basis des Ballastmodells;
  Skizze des Höhenprofil-Werkzeugs überarbeitet (gefahrene Distanz, Steig-/Sinkraten mit
  Farben, Menüs für Punkte und Etappen, Schichtmächtigkeiten, aerostatisches Ballastmodell).
* **Symbolsatz «Linie»** (Option A der Vorlage `00_Konzept/Icon-Set_Vorschlaege.html`): alle
  Bedienelemente mit einheitlichen SVG-Symbolen (24 × 24, Strich 2 px) statt Emoji – Menü, Drucken,
  Bearbeiten, Briefingsicht, Duplizieren, Löschen, Eigener Text (blau), Kommentar PIC (gelb), KI
  (violett), Aktualisieren, Schliessen, Ort wählen, Sperre, Freigabelink, Sortierpfeile, Griff.
  Gleich auf Windows, iPad und im Druck (`js/ui/icons.js`).
* **A1 Stammdaten:** Hüllenbild rechts im Datenfenster statt im Panelkopf (Erarbeitung und
  Briefingsicht).
* Mobil: Niveaufeld und Titelzeile der Briefingsicht umbrechen, Seite nie breiter als der Bildschirm.

## 0.11.2 — 2026-10-05 · Liste · Editor-Struktur · METAR/TAF · Lightbox · Kopfzeile · NOTAM-Quelle

* **Liste** kompakt: kleinere Schrift, je Zelle höchstens zwei Zeilen (Höhe «467 m» und Kennung
  ohne Umbruch), Spalte **«#»** mit 🔒 hinter der Nummer bei gesperrten Briefings, **«Status»**
  (in Arbeit NN % / Final vN, darunter die Phase) und **«Letzte Änderung»** (vN · Datum · Bearbeiter,
  dazu 🔗 n aktive Freigabelinks – die bisherige Spalte «Links»). Aktionen als Symbole in einer
  Zeile: ✎ Bearbeiten (bei Sperre stattdessen 👁 Briefingsicht), ⧉ Duplizieren, 🗑 Löschen.
* **Bearbeitungsstand «vN»** zählt neu Bearbeitungssitzungen statt Speichervorgänge: +1 beim ersten
  Speichern nach dem Öffnen der Erarbeitung, nach einer Freigabe und nach einem Final-PDF.
  Bestand übernimmt den bisherigen Zähler (Worker-Spalte `edition`, Feld `b.edition`).
* **Erarbeitung:** Knopf «Alle verfügbaren Daten aktualisieren» über dem Abschnitt A; Abschnittstitel
  A–D markant (Kennbuchstabe, Balken); D heisst **«Crew-/Pax-Briefing»**; linke Navigation als
  **Akkordeon** – nur der Abschnitt der gerade bearbeiteten Stelle ist offen (folgt dem Scrollen und
  dem Fokus), selbst geöffnete Abschnitte bleiben offen.
* **Zusatzboxen je Panel:** «Eigener Text / Bilder einfügen» und «Zusatzinfo (eigene Recherche)»
  sind zu **«Eigener Text / Bilder / Daten»** (blau) zusammengelegt, dazu **«Kommentar PIC»** (gelb).
  Beide erscheinen nur mit Inhalt oder nach Klick auf die Symbolknöpfe 📝/💬 im Panelkopf (unter
  KI-Kommentar/Quelle). Ausnahme: Panels mit Einfügepflicht (LINK + EINFÜGEN) behalten das Feld
  «Bericht / Daten einfügen». Bestehende eigene Texte/Bilder in Auto-Panels wandern in die Zusatzbox.
* **METAR/TAF:** Klartext beginnt mit «METAR LSZH …» bzw. «TAF LSZH …»; hinter der Zeit steht das
  Alter **«(vor 0:30 h)»**; Änderungsgruppen (→ BECMG/TEMPO/PROB) ohne Aufzählungspunkt, da sie
  sich auf die Punkte davor beziehen.
* **Briefingsicht:** Klick auf Grafiken, Bilder und Tabellen öffnet eine **vergrösserte Ansicht**
  (Popup mit ✕, Escape); Kopfzeile typographisch neu – eine Schriftfamilie, links Datum · Ort und
  Ballonzeile, rechts Logo, Titelzeile, letzte Änderung, Status (die Titelzeile erbte bisher eine
  SVG-Achsenklasse `.tl` → Monospace).
* **SondeHub:** Startort der Sonde mit Ortsname; im Ausland mit Kfz-Länderkennzeichen («D-Stuttgart»).
* Begriff «grenzwertig» → **«marginal»** (Ampel, Tabellen, KI-Prompts).
* KI-Zusammenfassung (rechte Spalte): Knopf in der KI-Farbe mit «direkt erstellen» und «…»
  (Prompt zuerst anpassen) wie in den Panels.
* **NOTAM: autorouter als zweite Quelle.** Zugänge «autorouter Benutzer/Kennwort» (Einstellungen →
  Zugänge); dann werden NOTAM je FIR der Fahrt (Startort, Landeraum, Lufträume) über
  `api.autorouter.aero` geholt und auf den Umkreis gefiltert; FAA bleibt Rückfall (mit einem
  Wiederholungsversuch). Länder-Matrix nennt die FIR-Kennungen (CH LSAS, DE EDMM/EDGG/EDWW, …).

## 0.11.1 — 2026-10-05 · Länder-Matrix · DWD-Dämmerungszeiten · Rückmeldungen

* **Länder-Matrix** (Einstellungen → Experte): je Land (CH, LI, DE, AT, FR, IT, übrige) amtliches
  Flugwetter mit Zugang, Modell, Luftraum/NOTAM, DABS-Pflicht, Sonnenquelle, Flugplan, Kontakte und
  Pflichtpunkte je **Rolle der Fahrt (Start, Überflug, Landung)**; eigene Notizen je Land werden
  gespeichert. Deutschland nach dem Vorbild GaforCast (DWD über GAFOR-Gebiete), Schweiz mit DABS
  (vorgeschrieben) und RAC 4-4, übrige Länder mit Open-Meteo/openAIP/FAA-NOTAM. Stammdaten A1 zeigen
  die Zeile **«Länder (Rolle)»**, z. B. «CH (Start) · AT (Überflug) · DE (Landung)».
* **Deutschland: Dämmerungszeiten amtlich aus dem DWD-Ballonwetterbericht** des Gebiets
  («Astronomische Angaben», UTC → LT), sobald das Panel B «Ballonprognose» geladen ist und der Bericht
  den Fahrttag abdeckt; A2 nennt die Quelle «amtlich (DWD … Gebiet NN)». Sonst wie bisher berechnet.
* HB-QWP: MTOM 950 kg nach BAZL-Register (bisher 883; gespeicherte 883 werden angehoben).
* Modell (Gasfahrt-Planung): Ballast in kg; Etappen-Briefings mit Meteo + Luftraum/NOTAM/FIR;
  Relief über Open-Meteo-Elevation (weltweit) – festgehalten für 0.12.

## 0.11.0 — 2026-10-05 · Ordnungsnummer · Fortschritt · Sperre nach der Fahrt · Kopfzeilen

* **Ordnungsnummer `JJJJ-NNN`** je Briefing (Jahr des Fahrtdatums, laufend je Jahr; Server-Modus:
  zentraler Zähler in D1, eindeutig über alle Benutzer; lokaler Modus: Browser). Anzeige in der
  Liste (eigene Spalte, suchbar), in den Stammdaten, in der Kopfzeile und auf allen Ausdrucken als
  rechtsbündige Titelzeile **«Fahrtbriefing · 2026-017 · HB-QWZ · Start: Di 06.10.2026, 06:30 –
  Oberlunkhofen AG»**; darunter **«Letzte Änderung: Datum Zeit · Bearbeiter»**. Dateinamen von
  PDF (Server-Render), JSON-Export, Kalender (.ics) und FPL-Text beginnen mit der Nummer. Bestand
  wird beim ersten Aufruf nach dem Update nach Startzeit durchnummeriert (Worker-Migration, neue
  Spalten `no`, `progress`, `end_ms`).
* Liste: Status **«in Arbeit NN %»** (Anteil gefüllter sichtbarer Panels) statt «Entwurf»; finale
  Briefings zeigen nur **«Final vN»**; Phase «läuft» heisst «Fahrt läuft».
* **Sperre nach der Fahrt:** liegt Start + max(6 h, Fahrtdauer + 2 h) zurück, bleibt das Briefing
  unverändert – Erarbeitung und Wizard leiten auf die Briefingsicht um, dort Hinweis mit
  **«Kopieren und neu anlegen»** (neue Nummer, Datum +7 Tage). 🔒 in der Liste und Kopfzeile.
* Briefingsicht: rechts oben Logo, darunter Titelzeile, letzte Änderung, Status; Pax-Blatt ebenso.
* **Panel-Köpfe einheitlich:** links Nummer + Titel und darunter immer «Stand: …» (oder «noch nicht
  bearbeitet»), rechts Kennzeichen + KI-Knöpfe und darunter rechtsbündig der Quell-Link.
  KI-Knopf **«erneuern» violett schraffiert**, «KI-Kommentar» (neu) wie bisher.
* Rechte Spalte: **«Einschätzung/Modellsicht»** (bisher «Tendenz (Modell)»), Wertung in normaler
  Schriftgrösse mit horizontal ausgerichtetem Punkt; zuunterst Karte **«Zusammenfassung»** mit
  Knopf «KI-Zusammenfassung erstellen/erneuern» (Gesamteinschätzung) und Text.
* Stammdaten A1: Zeile **Ordnungsnummer**; **«2 Pax: Name (70 kg), Name (85 kg)»** (Gewicht aus
  dem Briefing, sonst Normgewicht); oben Knopf **«Alle verfügbaren Daten aktualisieren»** (alle
  automatischen Panels, ohne KI-Kommentare) mit Status.
* METAR/TAF kompakter: ohne Zeilen «METAR», «TAF», «Klartext»; Stationsnamen mit ICAO-Abkürzungen
  (AP, INTL, AB, AFLD statt «Arpt»).
* **BAZL-Registerdaten** der vier Ballone (Luftfahrzeugregister, Stand 05.10.2026) in den Stammdaten:
  24-bit-Adresse (HB-QWP 4B2C8B, HB-QWZ 4B2C95, HB-QPJ 4B2BCF, HB-QWV 4B2C91), Muster (HB-QWP
  = Schroeder Fire Balloons G 34/24, bisher falsch «BB34Z»; Wörner NL-STU/1000), Hersteller, S/N,
  Baujahr, MTOM, MOPSC, TCDS, ARC gültig bis (als Dokument «Lufttüchtigkeitszeugnis (ARC)» mit
  Ablaufdatum). Bestehende Einstellungen werden beim Laden ergänzt (alter Hexcode «4c4b4» ersetzt);
  CODE/ im Flugplan erscheint damit automatisch.
* Flugplan: RMK/ bei Ausbildung **«TRG FLT»**, bei Examination **«SKILL TEST»** (getrennt einstellbar).

## 0.10.2 — 2026-10-05 · skybriefing-Importformat · Rückmeldungen 0.10.0/0.10.1

* **Flugplan:** ICAO-Nachricht exakt im Format des skybriefing-Imports («Flightplan and Briefing →
  Flight Plan import», Text einfügen → Import): Felder 7–18 je Zeile mit «-», Feld 19 als Zeile
  `-E/ P/ R/ S/ J/ D/`, danach `A/`, `N/`, `C/` je eigene Zeile, Klammer zu am Schluss (wie die
  skybriefing-Beispiele). Der XML-Export entfällt (skybriefing nimmt nur ICAO-Text).
* Nach AIP Schweiz ENR 1.10 (Flight Planning): **RMK/TRAINING FLT** bei Ausbildung, **RMK/TRAINING FLT
  SKILL TEST** bei Examination (Texte in den Einstellungen → Flugplan anpassbar; NVFR bleibt davor);
  **CODE/** mit der 24-bit-Adresse, wenn beim Ballon ein vollständiger 6-stelliger Hexcode hinterlegt
  ist (Reihenfolge TYP/ CODE/ ALTN/ RMK/); Hinweis im Panel und in der Briefingsicht zum **Schliessen
  des Flugplans** nach der Landung (ARO 0800 437 837) sowie zu DLA/CHG/CNL.
* **DEP/ DEST/ behalten das Kantonskürzel** als eigenes Wort («BUELACH ZH», «OBERLUNKHOFEN AG»).
* **Flugart (Feld 8) je Fahrttyp** in den Einstellungen → Flugplan auch für **Ausbildung** und
  **Examination** (Standard G; Examination ist weiterhin ein eigener Fahrttyp neben privat/gewerblich).
* **Standardradien:** Beobachtungen 75 km (bisher 50), SondeHub-Sonden 250 km (bisher 150); gespeicherte
  alte Standardwerte werden beim Laden angehoben, abweichende eigene Werte bleiben.
* **Hüllenbild:** quadratischer **Mittenausschnitt ohne Verzerrung** (192 px); Anzeige 64 px im Titel
  der Erarbeitung und **im Wizard Schritt 1 neben der Ballonwahl**, 2 × 2 cm in Briefingsicht, Druck
  und Pax-Blatt.

## 0.10.1 — 2026-10-05 · Hüllenbild · Muster bei Gashüllen · Panel-Tabelle

* Einstellungen → Ballone: **Bild der Hülle** je Heissluftballon und Gas-Hülle («Bild wählen …»,
  wird auf 192 px verkleinert als JPEG in den Stammdaten gespeichert, «Bild entfernen»). Das Bild
  erscheint **2 × 2 cm** im Titel des Panels A1 «Stammdaten» (Erarbeitung, Briefingsicht, Druck)
  und links oben im **Pax-Info-/Sicherheitsblatt**. Neue Briefings tragen das Bild als
  Schnappschuss; ältere Briefings zeigen das aktuelle Bild aus den Stammdaten.
* Gas-Hüllen zeigen in der Kartenüberschrift das **Muster nach der Kennung**
  («HB-QPJ · NL/STU-1000»), wie die Heissluftballone.
* Einstellungen → Panels & Pflicht: **kompakte Tabelle je Abschnitt** mit **Panel-Nummer wie im
  Briefing** (A1, A2 … D3), Kennzeichen fix/CH/AUTO und Spalten «ausblenden» / «Pflicht» als
  Häkchen; ausgeblendete Panels erhalten keine Nummer, die übrigen rücken nach.

## 0.10.0 — 2026-10-05 · ICAO-Flugplan aus dem Briefing · Wetterstationen · SondeHub

* Panel **C «Flugplan»**: Schalter «Flugplan erstellen?» (Standard ja bei NVFR, Grenzüberschreitung
  oder Gasfahrt) und **«Aus Briefing erzeugen»** – füllt den ICAO-Flugplan nach den vier
  skybriefing-Mustern (HB-QPJ):
  * 7 Kennung (ohne Bindestrich) · 8 V + Art des Flugs (gewerblich N, privat G; Einstellungen) ·
    9 ZZZZ/L · 10 Ausrüstung/Überwachung (z. B. GY/E, GY/EB1; je Ballontyp) ·
    13 ZZZZ + EOBT UTC aus der Startzeit · 15 Geschwindigkeit (Gas N0025, Heissluft N0015), Höhe
    als Flugfläche aus der Maximalhöhe (ab 5000 ft, sonst VFR) und Route
    `DRIFTING NW LATER NNW THEN NE FROM <DEP> TO <DEST> [VIA …]` (Richtungswörter aus der
    mittleren Trajektorie, VIA frei) · 16 ZZZZ + Gesamt-EET aus der Fahrtdauer, ALTN ZZZZ (Gas:
    zwei) · 18 `DEP/<ORT> <KOORD> DEST/… DOF/ EET/<FIR><HHMM> … TYP/ ALTN/UNKNOWN RMK/NVFR CREW
    CONTACT …` – **EET/ je FIR aus der FIR-Folge der Luftraumanalyse** (FIR-Namen → ICAO-Codes,
    Tabelle Europa; Eintrittszeit ab EOBT aus den Trajektorien) · 19 E/ Autonomie (Gas aus
    Einstellungen, Heissluft aus der Treibstoffrechnung), P/ Personen (PIC + Pax), R/ S/ J/ D/
    (Einstellungen), **A/ Farbe aus dem Ballon** (neu bei Heissluft und Gas-Hülle), N/ und RMK/
    aus Vorlagen mit {picPhone} {satphone}, C/ PIC «NACHNAME VORNAME».
  * Formular mit allen Feldern (editierbar), Plausibilitätsprüfung, **ICAO-Nachricht** (Doc 4444,
    Feld 19 als Zusatzzeile), **Kopieren**, **Download .txt (ICAO-Text) und .xml**; Briefingsicht
    und Druck zeigen Kurzformular und Nachricht.
  * Neue Einstellungs-Seite **«Flugplan»** (Art des Flugs je Fahrttyp, Ausrüstung, Flugflächen-
    Schwelle, Satellitentelefon, Farbe, PIC-Namensform, Vorlagen RMK/ und N/, je Ballontyp
    Geschwindigkeit/Autonomie/TYP/, Feld-19-Ausrüstung).
  * Unverifiziert: das skybriefing-Importformat («ICO» / XML) ist öffentlich nicht dokumentiert –
    das XML folgt einem einfachen eigenen Schema; bitte mit einer Datei im Import prüfen.
* Panel **B «Beobachtungen (Wetterstationen)»** (bisher Einfügen): **Wetterstationen im Umkreis
  des Startorts** (Standard 50 km, im Panel einstellbar) wie in cockpit.wicki.aero – SwissMetNet
  (MeteoSchweiz via api.existenz.ch), DWD (Bright Sky) und übriges Europa EUMETNET
  MeteoGate/E-SOH; Tabelle mit Richtungspfeil · km · Beobachtungszeit · Wind/Böen kt (rot ab 14 /
  20 kt) · T/Td · RH · QNH · Niederschlag; Worker-Route `GET /api/wx/stations`.
* Panel **Temps**: zusätzlich die **nächste Live-Radiosonde aus SondeHub** (Amateurempfang, letzte
  12 h, Umkreis 150 km einstellbar) als drittes Stüve mit Tabelle: Temperatur/Feuchte vom
  Sondensensor, Wind aus der Drift je 200 m, Druck gemessen oder aus der Höhe gerechnet
  (Worker `GET /api/wx/sondes`, `/api/wx/sonde?serial=`). radiosondy.info hat keine
  dokumentierte Schnittstelle – nicht angebunden.
* **Vertikalprofile: Wolkenschichten rötlich** (RH ≥ 95 %), feuchte Schichten weiter blau
  (RH ≥ 85 %); Legende unter dem Modellprofil.
* **Radar-Karte: Klick auf eine Sonde** verkleinert die Karte nach links (Ausschnitt um die Sonde)
  und öffnet rechts ein Fenster mit Emagramm, Kopfdaten und Tabelle der Sonde (✕ schliesst).
* Tests: 147 Rechentests (FIR-Codes, Namen, Telefon, Flugfläche, vollständige Nachricht gegen das
  Muster, XML, Heissluft-Variante); Smoke-Test erzeugt den Flugplan und prüft die Nachricht;
  API-Test prüft die neuen Routen.

## 0.9.2 — 2026-10-05 · Rückmeldungen zu 0.9.1 und vierte Liste (Teil 1)

* Tagesplan: **Dauer der Ballonfahrt** in der Tabelle schreibt zurück nach «Was ist geplant»
  (eine Quelle); **Plausibilitätswarnungen** zur Reihenfolge (z. B. «Bergung» vor «Landung»,
  «Start» nach «Landung»); **Treffpunkt-Auswahl in der Spalte «Ort»** (Dropdown der Treffpunkte aus
  dem Stamm, «anderer …» per Ortswahl, ✎ zum Ändern) – kein Namensfeld mehr unter der Aktivität;
  **Zeilen-Schattierung nach Dämmerung** (dunkel = vor BCMT / nach ECET, hell = BCMT–SR bzw.
  SS–ECET; Legende unter der Tabelle; auch in der Briefingsicht und im Druck).
* **Aktivitäten unter Experte definierbar**: eingebaute ein-/ausblenden und Standarddauer ändern,
  eigene Aktivitäten (DE/EN, Dauer, mit/ohne Ort); Start, Fahrt (Ballon) und Landung bleiben fix.
* **Minder-/Mehrgewicht** neu gegenüber dem **zulässigen Startgewicht = Tragkraft am Startplatz
  (Hüllentemperatur), höchstens MTOM**; die massgebende Grenze wird angezeigt (Ablauf Schritt 4,
  Panel Tragkraft, Briefingsicht). Die Excel-Vergleichstests prüfen weiterhin den MTOM-Bezug.
* **Panel-Nummerierung A1–An, B1–Bn, C1–Cn, D1–Dn** (Titelbalken, linke Navigation, Briefingsicht);
  Nummern folgen der sichtbaren Reihenfolge.
* **Tracker-Links je Ballon** (Heissluft und Gas-Hülle, Einstellungen → Ballone) statt je Person;
  Passagierkarte nimmt die Links des Ballons (Rückfall: PIC). Neu beim Ballon: **Farbe (Hülle)**
  für den Flugplan.
* Einstellungen: **Zurück-Knopf (←)** in der Kopfzeile führt an die Stelle zurück, von der man
  gekommen ist; **«Speichern» ist ein Umriss** und füllt sich erst nach einer Änderung;
  **JSON-Untermenü im Hamburger** (über «Einstellungen»): Import JSON / Export JSON der Einstellungen.
* «Was ist geplant»: **Zielrichtung** beim Setzen des Zielpunkts neu als
  `Ort · W266° · 25 km · ~1:30 h · ⌀ 1200 m AMSL` – Fahrzeit und mittlere Fahrthöhe (konstante
  Höhe) aus den beiden nächsten Trajektorien links und rechts des Ziels, nach Querabstand
  gewichtet (`>` wenn das Ziel jenseits der Bahnenden liegt); **dieselbe Zeile im Panel
  Trajektorien** rechts der Legende.
* **KI-Kommentar** bei «Stammdaten» und «Astronomische Daten» (neuer Name für
  «Sonnenauf-/untergang») ausgeblendet.
* **DABS** nur, wenn die Fahrt die Schweiz berührt (Startort, Landeraum, FIR-Folge der
  Luftraumanalyse oder Trajektorienpunkte in der Schweiz) – nicht mehr nur bei Schweizer Startort.
* **Flugplan-Panel mit Schalter «Flugplan erstellen?»** – Standard «ja» bei NVFR, Grenzüberschreitung
  (Länder entlang der Fahrt) oder Gasfahrt, sonst «nein»; Begründung wird angezeigt. Die
  automatische Erstellung folgt in 0.10.0.
* METAR und Radiosondierung: **Richtungspfeil vor der km-Distanz**.
* Tests: 135 Rechentests (DABS-Regel, Panel-Nummern, Zielschätzung, Reihenfolge-Warnung),
  Smoke-Test prüft Nummerierung, Astronomie-Panel ohne KI, Flugplan-Schalter, Zielzeile,
  Einstellungen (Zurück, Speichern-Zustand, Tracker beim Ballon, JSON-Untermenü).

## 0.9.1 — 2026-10-04 · Dritte Rückmeldungsrunde (Teil 2): tabellarischer Zeitplan

* **Tagesplanung als Tabelle** (Ablauf Schritt 5, Panel «Zeitplan» in der Erarbeitung): je Zeile
  **Zeit · Aktivität (Dropdown) · Info · Dauer (min) · Ort**. Aktivitäten: Treffpunkt, Fahrt,
  Ankunft Startplatz, Aufrüsten, Füllen, Reserve, Briefing, Start, Fahrt (Ballon), Landung,
  Bergung, Rückfahrt, Verpflegung, Tanken, Sonstiges. Zeilen **per Ziehen oder ▲▼ verschieben**,
  hinzufügen (+ Zeile), löschen (✕) – **die Zeiten laufen mit**: Anker ist die Zeile «Start»
  (= Startzeit des Briefings); danach Zeit + Dauer vorwärts, davor rückwärts (Zeile = nächste
  Zeit − eigene Dauer), Rundung auf 5 min. Zeit tippen = Pin (gestrichelt, ↺ löst ihn).
* Orte: Treffpunkt/Fahrt/Rückfahrt/Verpflegung/Tanken/Briefing/Sonstiges mit Ortswahl (📍/✎);
  Ankunft = Startplatz und Landung = geplanter Landeraum aus dem Briefing. **Fahrten werden
  geroutet** (OSRM, Anhängerfaktor + Zuschlag), sobald Ort davor und danach bekannt sind
  (gestrichelte orange Dauer = Routing; manuell überschreibbar, «Neu rechnen» setzt zurück).
* Fahrtdauer der Ballonfahrt aus «Was ist geplant» (in der Zeile überschreibbar); Ballonwechsel
  im Ablauf passt Aufrüstzeit an und blendet die Füllzeile (Gas) ein/aus. «Vorlage neu» baut die
  Tabelle aus den Stammwerten neu (zweistufiger Knopf, kein Browser-Dialog).
* Bestehende Briefings werden beim Öffnen in die Tabelle überführt (Etappen → Treffpunkt/Fahrt,
  Puffer → Reserve, alte Pins bleiben); Pax-Karte, Kalender (ICS), Crew-Nachricht und
  Briefingsicht lesen aus der Tabelle (Crew-Nachricht mit Maps-Links aller Zeilen mit Ort).
* Briefingsicht: Zeitplan mit Dauer und Koordinaten/Maps-Link je Zeile mit Ort.
* Layout: breite Tabelle im Ablauf (Schritt 5 nutzt die volle Breite); in schmalen Spalten
  (Telefon, iPad hochkant, Panel neben der Seitenspalte) wird jede Zeile dreizeilig
  (Zeit/Aktivität/Dauer – Info – Ort).
* Tests: `buildPlan`/`planTemplate`/`planToStops` (127 Tests), Smoke-Test prüft Tabelle,
  Verschieben mit angepassten Zeiten und Zeile hinzufügen.

## 0.9.0 — 2026-10-04 · Dritte Rückmeldungsrunde (Teil 1)

* **KI-Kommentar** in jedem Panel-Titelbalken (Server-Modus mit KI-Freigabe): Klick erzeugt den
  Kommentar direkt (ohne Prompt-Maske) und zeigt ihn unter dem Panelinhalt; «…» daneben öffnet
  die Prompt-Maske zum Anpassen. Prompt enthält den Panelinhalt (inkl. hochgeladener Zusatzinfos
  und Bilder) **und die Gesamtlage** des Briefings (übrige Panels gekürzt) mit Bezug auf das
  Thema des Panels; Fokus auf Besonderheiten und ballonfahrtspezifische Warnungen/Hinweise.
  Kommentar als Text (✎ bearbeiten, ✕ verwerfen).
* Kopfzeile: Pille nur Briefings / Neues Briefing; **Einstellungen, Berechtigungen und «Mehr» als
  Untermenüs im Hamburger** (offene Untermenüs bleiben beim Autosave offen); **Drucken als
  Symbolknopf** rechts von «Freigeben».
* **Druckdialog**: nur Briefing, zusätzlich DABS-Beilage, NOTAM, «Passagier Info-/
  Sicherheitskarte» (Titel unter Experte überschreibbar, DE/EN); die Passagierkarte wird als
  A4-quer-Seite an das Briefing angehängt.
* Abschnitt C: **Flugplan nach dem NOTAM**; NOTAM wahlweise **Strecke** (Start → Landeraum →
  Trajektorien-Enden) oder **Umkreis um Orte** (Ortswahl, Standard Startort, Radius 200 km;
  Kreise > 100 NM werden mit 7 Teilabfragen abgedeckt).
* Radar-Karte: **Klickboxen rechts** für Regen (RainViewer), Webcams, Sonden (SondeHub:
  Startplätze im Umkreis 250 km und Sonden der letzten 6 h); «Zoom level not supported»
  behoben (RainViewer-Kacheln ab Zoom 7 hochskaliert, Karte bis Zoom 14).
* Temps: zusätzlich die **letzte Radiosondierung** der nächsten Station (Payerne 06610,
  Stuttgart, München, Wien, Milano …) als zweites Stüve-Diagramm mit Tabelle der
  Hauptdruckflächen (Worker `GET /api/wx/sounding?stn=`, Archiv University of Wyoming –
  dieselbe Messung wie das MeteoSchweiz-Emagramm, das nur per JavaScript geliefert wird).
* Druckdifferenz: ΔP-Zellen **orange ab 3 hPa, rot ab 4 hPa** in der Warnrichtung des Paars
  (Zürich–Lugano: Südüberdruck; Genève–Güttingen: Bise); Schwellen unter Experte.
* Thermik: Tabelle kompakt ohne horizontales Scrollen, daneben Balken je Stunde in derselben
  Zeilenhöhe.
* Layout: Panel-Titelbalken einheitlich zweizeilig hoch; alle Eingabefelder/Knöpfe in den
  Panel-Werkzeugleisten 30 px hoch, Trajektorien-Eingaben in einer Zeile; linke Panel-
  Navigation und rechte Spalte scrollbar; Pflicht-Inhalte im Ablauf fett in normaler Grösse.
* Offen → 0.9.1: tabellarischer Zeitplan.

## 0.8.1 — 2026-10-04 · Rückmeldungen zu 0.8.0

* Luftraum-Panel: nur Typ und ICAO-Klasse (keine Erklärtexte; Zusatzcodes NOTAM/REQ/AGRMT,
  Squawk und Frequenz klein unter dem Namen); reine Klasse-E/G-Lufträume werden nicht
  gelistet (TMZ, RMZ, ATZ, R/D/P usw. unabhängig von der Klasse schon). **Warnungen**: Startort
  liegt in einer CTR/ATZ; TMA/CTA (Klasse A–D) mit Untergrenze weniger als 900 ft über dem
  Startort (Schwelle unter Einstellungen → Experte); Landeraum in CTR als Hinweis. FIR-Folge
  mit Zeit ab Start (+h:mm) für das spätere EET im Flugplan.
* Schritt 1: **NVFR-Schalter** in der Zeile «Typ der Fahrt» (bewusst geplante Nachtfahrt):
  unterdrückt die Nacht-Warnungen (Ort & Zeit, Fahrtabsicht, Tagesplanung, Briefingsicht),
  zeigt stattdessen «NVFR geplant», setzt die Nachtausrüstung (NVR) in der Spezialausrüstung.
  Die Tag/Nacht-Wahl in der Fahrtabsicht entfällt (alte Briefings: «Nacht»/«Tag und Nacht» →
  NVFR).
* Schritt 3: Trajektorien-Karte mit **allen Niveaus** (Legende, Stundenpunkte); Niveaus-Feld
  über der Karte, Änderungen an Niveaus/Dauer zeichnen neu.
* Schritt 2: «Als Favorit speichern» erscheint nicht mehr, wenn ein Favorit gewählt ist.
* Schritt 4: Kästchen PIC/Nachfahrer unten bündig; Vorschau zeigt Personenzahl und
  Personenmasse; Normgewicht-Rückfall 85 kg, falls ein Ballon-Stammsatz keines hat.
* Textumbruch: Silbentrennung (lang=de/en) statt willkürlicher Trennung mitten im Wort; lange
  Beschriftungen mit weichen Trennstellen (Hüllen·temperatur, Treibstoff·reserve …).

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
