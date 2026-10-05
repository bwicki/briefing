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

### Anmeldeseite

Beim ersten Laden fragt die App Benutzer und Kennwort. Im **Server-Modus** prüft
sie der Worker (Hash in der Datenbank, Fehlversuche werden gebremst); nach zwei
Stunden ohne Benutzung wird wieder gefragt, Menü → *Sperren* sofort. Der zuletzt
benutzte Anmeldename wird vorgeschlagen. Das eigene Kennwort wird in
**Einstellungen → Experte** geändert — nach der Inbetriebnahme bitte ein längeres
setzen, weil die Briefings Pax-Namen enthalten.

### Benutzer, Rollen und Freigaben (ab 0.5.0)

Die App kennt zwei Rollen. Der **Supermaster** (Startbenutzer `bwicki`) verwaltet
Benutzer, die zentralen Zugänge (API-Schlüssel) und sieht die Nutzungsstatistik;
er hat lesende Einsicht in alle Briefings (Sicht *Alle Benutzer*) und in den Stamm
jedes Benutzers (*Stamm ansehen*), ändert fremde Briefings aber nicht. Ein
**Master** hat eigenen Stamm (Ballone, Personen, Startplätze, Treffpunkte,
Betreiber), eigene Briefings und eigenes Kennwort; Master sehen einander nicht.
Beim Anlegen kann der Supermaster den Stamm eines bestehenden Benutzers kopieren
(sonst beginnt der neue Benutzer mit dem Beispiel-Stamm der App) und je Benutzer
KI, NOTAM und Final-PDF freischalten.

**Freigaben** (Einstellungen → Benutzer & Freigaben): jeder Benutzer gibt per
Klickbox je Kategorie Teile seines Stamms einem anderen Benutzer zur Auswahl frei
— etwa die Ballone, wenn jemand das eigene Material mitbenützt. Freigegebene
Einträge erscheinen im Ablauf mit dem Namen des Gebers in Klammern und bleiben
dessen Eigentum (der Empfänger ändert sie nicht). Verwendet ein Benutzer einen
freigegebenen Ballon, sieht der Eigner das Briefing lesend unter *Fahrten mit
meinem Material* — die Grundlage für das Ballonbuch. Persönliche Links (Mitarbeit,
Nur lesen) bleiben wie bisher je Briefing.

**Material-Links für Externe** (Einstellungen → Benutzer & Freigaben → *Fahrten mit
meinem Material*): für Materialeigner ohne Benutzerkonto, etwa den Halter eines
mitbenützten Ballons. Der Benutzer wählt Name und Kennungen aus seinem Stamm;
der Link (`#/m/<token>`, Standard 1 Jahr gültig, widerrufbar, QR/WhatsApp/E-Mail)
zeigt ohne Kennwort die Liste aller Briefings mit diesen Kennungen — eigene und
solche anderer Benutzer, die den Ballon über eine Freigabe verwenden — und jedes
davon in der Briefingsicht samt Pax-Karte, nur lesen. Jedes Öffnen zählt in der
Statistik als Link-Öffnung des Erstellers.

**Nutzungsstatistik** (Supermaster, Einstellungen → Statistik): je Benutzer und
Monat Anmeldungen, neue Briefings, Freigaben als Final, Datenabrufe je Quelle,
KI-Aufrufe und Tokens, PDFs, Dateien/Bytes, Links; Fahrten je Ballon (Eigner,
Material von), Speicher je Benutzer; Export als CSV.

Ist der Worker nicht erreichbar (oder in `js/config.js` keine Adresse eingetragen),
läuft die App im **lokalen Modus**: Daten bleiben im Browser dieses Geräts,
persönliche Links und Zugänge sind dann nicht verfügbar. Die Kopfzeile zeigt
das mit «Lokaler Modus» an.

### Übersicht «Briefings»

Alle Briefings mit Datum, Startort (ICAO-Kurzkoordinaten, Höhe), Ballon, Fahrttyp,
Phase (Vorplanung > 72 h, Planung 24–72 h, Final < 24 h), Status, Arbeitsversion und
Anzahl Links. Filter *Geplant / Alle / Archiv*, Suche; Sichten *Meine Briefings*,
*Alle Benutzer* (Supermaster) und *Fahrten mit meinem Material* (wenn Ballone
freigegeben sind; fremde Briefings öffnen sich nur in der Briefingsicht). Rechts
die nächste Fahrt mit Sonnenzeiten. **⧉** dupliziert ein Briefing als Vorlage (gleicher Startort, Ballon,
Crew; Datum + 7 Tage; Meteo-Panels leer) und öffnet den Ablauf bei Schritt 6.

### Neues Briefing — geführter Ablauf

Sechs Schritte mit Zurück/Weiter (Eingabetaste = Weiter); der Entwurf wird laufend
gespeichert, *Als Entwurf speichern* verlässt den Ablauf.

1. **Ballon & Fahrt** — Heissluft (Kennung) oder Gas (Hülle × Korb), Typ der Fahrt mit
   **NVFR-Schalter** (bewusst geplante Nachtfahrt: keine Nacht-Warnungen, Nachtausrüstung
   wird gesetzt), Lufttransportführer, Anlass.
2. **Ort & Zeit** — Favoriten-Chips (nur Startplätze, die zum Ballontyp passen;
   Kennzeichnung Heissluft/Gas in den Einstellungen) und **Ortswahl**: ins Ortsfeld
   tippen öffnet die Suche direkt. Kurzkoordinaten, Höhe, Land und Zeitzone werden
   ermittelt (Open-Meteo, Nominatim); Datum, Startzeit, LT/UTC; Sonne/Dämmerung
   sofort, Warnung bei Nachtfahrt (bzw. Hinweis «NVFR geplant»); Planungshorizont mit
   verfügbaren Modellen. «Als Favorit speichern» nur, wenn kein Favorit gewählt ist.
   Sobald Ort und Zeit stehen, erscheint die **Start-Ampel** (denkbar / marginal /
   eher ausgeschlossen) aus Modellwerten und Ampel-Grenzen — grobe Einschätzung,
   keine Entscheidung.
3. **Fahrtabsicht** — Start-Ampel, Dauer, Höhenband, Trajektorien-Niveaus; **Trajektorien-
   Karte mit allen Niveaus** (Legende, Stundenpunkte, zeichnet bei Änderungen neu); ein
   Klick auf die Karte übernimmt den Punkt als **geplanten Landeraum** und füllt die
   Zielrichtung als `Ort · W266° · 25 km · ~1:30 h · ⌀ 1200 m AMSL` (Fahrzeit und
   mittlere Fahrthöhe aus den beiden nächsten Trajektorien links/rechts des Ziels,
   nach Querabstand gewichtet; `>` = Ziel jenseits der Bahnenden). Trajektorien-
   Niveaus (Startwerte je Ballontyp aus den Einstellungen). Landeraum und Richtung
   bleiben optional.
4. **Personen** — PIC, **mehrere Nachfahrer** (Liste aus Stamm oder frei), Pax
   (Name leer = Platzhalter im Briefing, Gewicht), Vorschau Tragkraft bzw. Ballast;
   Temperatur/QNH/Feuchte werden, wenn der Start innert 15 Tagen liegt, aus dem
   Modell geholt.
5. **Tagesplanung** — **Tabelle** mit je Zeile Zeit · Aktivität (Dropdown:
   Treffpunkt, Fahrt, Ankunft Startplatz, Aufrüsten, Füllen, Reserve, Briefing,
   Start, Fahrt (Ballon), Landung, Bergung, Rückfahrt, Verpflegung, Tanken,
   Sonstiges; unter Experte ein-/ausblendbar, Standarddauer, eigene Aktivitäten) ·
   Info · Dauer (min) · Ort. Zeilen per Ziehen oder ▲▼ verschieben, hinzufügen,
   löschen – die Zeiten laufen mit: Anker ist «Start» (Startzeit), danach Zeit +
   Dauer vorwärts, davor rückwärts, Rundung auf 5 min. Zeit tippen = Pin (↺ löst
   ihn). Treffpunkte aus dem Stamm in der Spalte «Ort» wählbar («anderer …» per
   Ortswahl); Fahrten werden geroutet (OSRM × Anhängerfaktor + Zuschlag), sobald Ort
   davor und danach bekannt sind; Ankunft = Startplatz, Landung = Landeraum; die
   Dauer der Ballonfahrt ist dieselbe wie in «Was ist geplant». Warnungen bei
   unplausibler Reihenfolge; Zeilen vor BCMT / nach ECET dunkel, Dämmerung hell
   schattiert. «Vorlage neu» baut die Tabelle aus Stamm und Favoriten neu. Klickbox
   **«kein Tagesplan anlegen / später»**.
6. **Prüfen** — Zusammenfassung und Pflicht-Panels; *Briefing anlegen*.

### Ortswahl (Startort, Treffpunkt, Landeraum, Stammdaten)

Der Knopf **Ort wählen …** öffnet ein Fenster mit Karte (Marker setzen oder
ziehen), Suche und Koordinatenausgabe. Die Suche versteht Ortsnamen (Open-Meteo),
Adressen mit Hausnummer (Nominatim/OpenStreetMap), Dezimalkoordinaten
«47.3, 8.4», ICAO-Kurzkoordinaten «4719N00824E», Grad/Minuten
«47°19.0'N 008°24.0'E» und eingefügte Google-Maps-Links. 📍 übernimmt den
eigenen Standort (Handy). Höhe, Zeitzone und Land werden automatisch ergänzt.
Ergebnis in allen Sichten: **Name · Kurzkoordinaten · Höhe · Google Maps ↗**
(öffnet in neuem Fenster, auch im PDF klickbar); ⎘ kopiert Koordinaten und Link.

### Erarbeitungssicht

Oben in jeder Sicht die Hauptnavigation **Briefings · + Neues Briefing**; Einstellungen,
JSON (Import/Export der Einstellungen), Berechtigungen und «Mehr» im Hamburger-Menü.
Links die Navigation A–D mit Status-Punkt je Panel (grün erledigt, blau
automatisch/noch nicht geladen, orange manuell offen, rot Pflicht offen), Mitte die Panels
in Druckreihenfolge, **nummeriert A1–An, B1–Bn, C1–Cn, D1–Dn**, rechts Planungshorizont,
Panel-Zähler und Protokoll. Im Kopf
die **Arbeitsversion** («v12 · Datum Zeit · Name»), der Status und die Phase.

Jedes Panel hat unter dem Inhalt drei einklappbare Blöcke: **Zusatzinfo** (eigene
Recherche: Text, Bilder, Links), **KI-Hinweis** (editierbar, verwerfbar) und
**Kommentar**.

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
* **Automatisch** (seit 0.3.0, Abschnitt B und C) — der Inhalt wird aus Modellen
  und amtlichen Quellen geholt und als **Schnappschuss** mit Stand, Modell und
  Quelle im Briefing gespeichert (Druck, Leselink, Final-Versionen). Jedes
  dieser Panels hat *Aktualisieren*, *KI-Hinweis*, ✕ (Schnappschuss entfernen)
  und darunter ein Einfügefeld für eigenen Text/Bilder. Details im Abschnitt
  «Automatische Panels».
* **Text** — Landeorte, Bemerkungen, Flugplan, Absprachen, Briefingbedürfnisse.

### Automatische Panels (Phase 2)

Über Abschnitt B steht die **Modell-Leiste**: Modellwahl (ICON-D2 2 km bis 48 h,
ARPEGE, ICON-EU, ECMWF IFS, UKMO, ICON global, GFS, Auto) mit Vorschlag je
Planungshorizont, **Alle aktualisieren** und der Stand der letzten Aktualisierung.
Beim ersten Öffnen eines Briefings laden sich alle automatischen Panels von
selbst (Modell-Panels sofort; DABS, Karten und NOTAM — soweit freigeschaltet —
kurz danach).

| Panel | Inhalt | Quelle |
|---|---|---|
| Allgemeine Lage | Schnappschüsse amtlicher Karten (DWD-Bodenanalysen, ECMWF Bodendruck/Wind 850 hPa zur Startzeit und +24 h; Liste in Einstellungen → Meteo) **und** die Grosswetteranalyse des nationalen Dienstes als Text für das Land des Startorts/Landeraums (DWD Synoptische Übersicht Kurz-/Mittelfrist und ORF/GeoSphere Austria geprüft; MeteoSchweiz und Aeronautica Militare liefern nur per JavaScript → als Link; weitere Seiten mit CSS-Selektor konfigurierbar, Haken «abrufen») | DWD, ECMWF Open Charts (CC-BY-4.0), nationale Dienste; über Worker (`/api/wx/snapshot`, `/api/wx/wxtext`) |
| METAR/TAF | alle Plätze im Umkreis (direkt im Panel einstellbar, Standard 150 km); Richtungspfeil vom Startort zum Platz; Schlechtwetter rot (Wind/Böen ≥ 14 kt, Sicht < 5 km, Niederschlag/Nebel/Gewitter, Basis ≤ 1500 ft, CB/TCU); je Platz **Rohmeldung und Klartext nebeneinander** (DE/EN: Wind, Sicht, Wetter, Wolken, T/Td, QNH, Trend; TAF mit BECMG/TEMPO/PROB/FM-Gruppen und Gültigkeit) | aviationweather.gov über Worker; Rückfall GaforCast-Kopie |
| Temps | Stüve-Diagramm des Modellprofils zur Startzeit (T, Td, Feuchteschattierung blau ab RH 85 %, **Wolkenschichten rötlich ab RH 95 %**, Windfahnen, Grenzschicht, 0 °C), Inversionen; dazu die **letzte Radiosondierung** der nächsten Station (Payerne u. a.) als zweites Stüve mit Tabelle; **nächste Live-Radiosonde aus SondeHub** (Amateurempfang, letzte 12 h, Umkreis einstellbar, Standard 250 km) als drittes Stüve | Open-Meteo Druckflächen; Radiosonde über Worker `/api/wx/sounding` (Archiv University of Wyoming); SondeHub über `/api/wx/sondes`, `/api/wx/sonde`) |
| Beobachtungen (Wetterstationen) | **Wetterstationen im Umkreis** des Startorts (Standard 75 km, im Panel einstellbar): SwissMetNet (MeteoSchweiz via api.existenz.ch), DWD (Bright Sky), übriges Europa EUMETNET MeteoGate/E-SOH; Tabelle Pfeil · km · Zeit · Wind/Böen (rot ab 14/20 kt) · T/Td · RH · QNH · Niederschlag | über Worker (`/api/wx/stations`) |
| Flugwetterprognose | **DE:** DWD Flugwetterübersicht des Bereichs + GAFOR-Einstufung des Gebiets (Punkt-in-Polygon). **CH:** MeteoSchweiz-Prognose einfügen (Pflicht) | DWD-Luftsportberichte (Kopie gafor.wicki.aero) |
| Windprognose | Windprofil Start–Landung stündlich (°/kt je Niveau), Profilgrafiken mit Höhenband-Marken | Open-Meteo |
| Ballonprognose | **DE:** DWD-Gebietsvorhersage Ballonsport (Tabellen); immer: eigene Stundentabelle mit Ampel fahrbar/grenzwertig/nein und Begründung | DWD (Kopie), Open-Meteo |
| Druckdifferenz | Genève–Güttingen (Bise), Zürich–Lugano (Föhn) aus Modell-QNH, stündlich; Paare in Einstellungen | Open-Meteo |
| Trajektorien | Bahnen je Niveau (SFC, «1000 AGL», «3000», «FL065»; Standard aus Fahrtabsicht), Dauer (Heissluft 2 h, Gas 24 h), Startversatz ±2 h; **Legende Farbe = Höhe**; Landeraum als grüner Punkt **verschiebbar** (setzt Landeraum und Zielrichtung); am Bildschirm die Karte (Basiskarte oder Satellit, Luftraum-Overlay; Knopf ▦ rechts oben blendet das Distanzraster-Skizze ein), im Druck die Nord-oben-Skizze; Tabelle mit Stundenmarken, Endpunkt als ICAO + Maps-Link | eigene Rechnung aus dem Modellwind (Punktprognose, linear zwischen Stunden und Niveaus) |
| SIGWX | SIGMET/AIRMET im Umkreis automatisch; SIGWX-Karte einfügen | aviationweather.gov über Worker |
| Thermik | eigene Abschätzung aus dem Modell: Globalstrahlung × Bowen-Faktor → Wärmestrom, mit Grenzschichthöhe zur konvektiven Geschwindigkeitsskala w* (Deardorff); je Stunde Klasse keine/schwach/mässig/kräftig/stark (Grenzen unter Einstellungen → Experte), Einsetzen, Maximum, Abschwächen, Fahrtfenster; Tabelle links, Balken rechts | Open-Meteo |
| Meteogramm | Grafik über Start −6 h … Landung +6 h mit beschrifteten Bändern (Temperatur/Taupunkt mit Extremwerten, Wind/Böen kt mit Fahnen, Bewölkung hoch/mittel/tief, Niederschlag mm/h + CAPE), Zeitachse LT mit Tageswechsel, Start-/Landemarke, Nacht- und Fahrtfenster-Schattierung, Ampelstreifen und Legende; dazu Stundentabelle mit Nebelrisiko und Wolkenbasis | Open-Meteo |
| Radar | Live-Radar (RainViewer) auf der Karte (weit genug für die Niederschlagsgebiete), Startort und Landeraum markiert, **Webcams im Umkreis automatisch aus öffentlichen Quellen** (europaweit: Windy Webcams API mit Schlüssel, OpenStreetMap ohne; Umkreis in Einstellungen → Meteo, Standard 40 km um Start und Landeraum) plus eigene Liste, als Kamera-Symbol mit Popup (Vorschaubild, Link) und aufklappbarer Liste; Klickboxen Regen/Webcams/Sonden; **Klick auf eine Sonde** verkleinert die Karte und öffnet daneben Emagramm + Daten der Sonde; Links Windy/MeteoSchweiz/Blitzortung/Sat24 — nur am Bildschirm | RainViewer, Windy, OSM/Overpass; über Worker (`/api/wx/webcams`) |
| Luftraum entlang des Fahrtwegs | **Luftraumanalyse** aus openAIP für die berechneten Trajektorien: je Luftraum *durchfahren* (Bahn innerhalb, Untergrenze unter der geplanten Maximalhöhe; km ab Start, ETA je Bahn), *nahe* (im Korridor, Standard 5 km, Einstellungen → Meteo) oder *oberhalb der Maximalhöhe* (eingeklappt); Typ (CTR, TMA, TMZ, RMZ, R/D/P, TRA/TSA, ATZ …), ICAO-Klasse, Unter-/Obergrenze, Zusatzcodes (NOTAM/REQ/AGRMT, Squawk, Frequenz); reine Klasse-E/G-Lufträume werden nicht gelistet; **Warnungen** Startort in CTR/ATZ und TMA/CTA tiefer als 900 ft über dem Startort (Experte); **FIR-Folge** je Bahn mit Wechselpunkt (km, LT, +h:mm ab Start); Karte mit Polygonen und Bahnen (Bildschirm), Nord-oben-Skizze (Druck). Braucht die Trajektorien (werden sonst mitberechnet) und den openAIP-Schlüssel («Zugänge: openaip» oder der Kachel-Schlüssel der Overlay-URL) | openAIP Core API über Worker `/api/wx/airspace` (6 h Cache je Ausschnitt) |
| DABS | DABS-PDF (heute/morgen) automatisch holen; Seiten im kleinen Viewer mit Blättern (‹ ›, Pfeiltasten, Link zum PDF), im Druck alle Seiten bzw. als Beilage | skybriefing über Worker, R2 |
| NOTAM | FAA-NOTAM-API wahlweise **Strecke** (Startort → Landeraum → Trajektorien-Endpunkte, Radius einstellbar) oder **Umkreis um Orte** (Ortswahl, Standard Startort, Radius 200 km); **VFR-Filter** (zeitlich, untere Grenze unter Höhenband + 2000 ft, keine reinen IFR-/Infrastruktur-NOTAM); übrige einklappbar | FAA NOTAM API (Zugang in Einstellungen → Zugänge) |

**KI-Hinweis:** Knopf im Panel öffnet den Prompt (Fahrtkontext + Panel-Inhalt +
Bilder, ohne Pax-Namen) zur Kontrolle, sendet ihn über den Worker an die
Anthropic-API (Modell in Einstellungen → Meteo) und legt 2–5 Zeilen als
editierbaren Hinweis ab (gelb markiert, im Druck «KI-Hinweis»). Keine
Startempfehlung.

Die **Ampel** (fahrbar/grenzwertig/nein) bewertet Modellstunden gegen die Grenzen
in Einstellungen → Meteo (Bodenwind, Böen, Böigkeit, Niederschlag, CAPE, Sicht,
Wolkenbasis, bürgerliche Dämmerung). Sie ersetzt keine Beratung — sie zeigt,
welche Stunden man anschauen muss.

### Ordnungsnummer, Fortschritt, Sperre (0.11)

Jedes Briefing erhält beim ersten Speichern eine **Ordnungsnummer `JJJJ-NNN`**
(Jahr des Fahrtdatums, laufende Nummer je Jahr, z. B. `2026-017`); sie wird im
Server-Modus zentral vergeben (eindeutig über alle Benutzer), im lokalen Modus im
Browser. Sie steht in der Liste, in den Stammdaten, in der Kopfzeile und auf allen
Ausdrucken rechtsbündig als Titelzeile `Fahrtbriefing · 2026-017 · HB-QWZ · Start:
Di 06.10.2026, 06:30 – Oberlunkhofen AG`, darunter `Letzte Änderung: Datum Zeit ·
Bearbeiter`. Dateinamen (PDF, JSON, ICS, FPL) beginnen mit der Nummer:
`2026-017_Fahrtbriefing_HB-QWZ_2026-10-06[_final-v1].pdf`. Bestehende Briefings
werden beim ersten Aufruf nach dem Update nach Startzeit durchnummeriert.

Die Liste zeigt als Status **«in Arbeit NN %»** (Anteil gefüllter Panels) oder
**«Final vN»**. Liegt die Fahrt zurück (Start + max. 6 h / Fahrtdauer + 2 h), ist das
Briefing **gesperrt** (🔒 in der Liste): Erarbeitung und Wizard leiten auf die
Briefingsicht um, dort steht der Hinweis mit **«Kopieren und neu anlegen»** (neue
Nummer, Datum eine Woche später, Panels leer). Das alte Briefing bleibt unverändert.

**Freigeben als Final** prüft die Pflicht-Panels (Einstellungen → Panels & Pflicht);
fehlt etwas, kann mit Begründung trotzdem freigegeben werden (Protokoll). Jede
Freigabe wird als Final v1, v2 … mit Schnappschuss abgelegt.

### Phase 3: Tendenz, Änderungen, Gesamteinschätzung, Pax-Karte, Crew, PDF, offline

* **Einschätzung/Modellsicht** rechts im Editor und oben in der Briefingsicht: fasst die
  Stundenampel des Meteogramms im Fahrtfenster und die Go/No-Go-Kriterien
  (Trockenfenster, Gewitterabstand/CAPE, Mittelwind, Böen; Einstellungen →
  Go/No-Go) zu fahrbar/grenzwertig/nein mit Gründen zusammen. Kein Startentscheid.
* **Seit Final vN geändert**: nach einer Freigabe zeigt die Seitenleiste, welche
  Stammdaten und Panels sich seither geändert haben (klickbar); die Briefingsicht
  markiert geänderte Panels, die Freigabe-Checkliste listet sie.
* **Mehr ▾** im Editor-Kopf: Pax-Sicherheitskarte, Crew-Nachricht & Kalender,
  Gesamteinschätzung (KI), Final-PDF, Briefing exportieren (JSON).
* **Gesamteinschätzung (KI)**: Prompt aus allen Panels (automatische Daten, Texte,
  KI-Hinweise, Kommentare) – 6–10 Zeilen mit Tendenz, editierbar, erscheint oben
  in der Briefingsicht.
* **Pax-Sicherheitskarte** (`#/pax/<id>`, Leselink `…/p`): eine Seite für die
  Passagiere – Treffpunkt mit Maps-Link, Zeiten, Mitbringen (Liste in
  Einstellungen → Experte), Sicherheitspunkte, Kontakt. Druck A4.
* **Crew-Nachricht & Kalender**: Text mit Zeitplan und Maps-Links zum Kopieren,
  per WhatsApp/E-Mail (Adressen der beteiligten Personen), `.ics`-Termin von
  Abfahrt bis Rückkehr mit Erinnerung 12 h vorher.
* **Final-PDF**: auf dem Server (Cloudflare Browser Rendering druckt die
  Briefingsicht nach R2; Zugänge `cf_account_id`/`cf_api_token`) oder ein mit
  «Als PDF sichern» erzeugtes PDF hochladen; Link in der Briefingsicht.
* **Export**: Einstellungen → Experte → alle Briefings + Einstellungen als JSON.
* **PWA / offline**: `sw.js` lädt die App-Hülle vor; zuletzt geöffnete Briefings
  und Dateien bleiben offline lesbar (Netz zuerst, Cache als Rückfall). Zum
  Startbildschirm hinzufügen (iPad/Handy) ergibt die App im Vollbild.
* **Luftraum-Overlay**: Kachel-URL (openAIP) in Einstellungen → Experte, wird auf
  Trajektorien- und Radarkarte gelegt.

### Briefingsicht und Druck

Das fertige Briefing wie im gedruckten Muster: Kopf mit Logo, Abschnitte A–D als
zweispaltige Tabellen, Zusatzinfo/KI-Hinweis/Kommentar unter dem Inhalt, Fuss mit
Version und Hinweis. **PDF / Drucken** nutzt den Browserdruck (A4 hoch; «Als PDF
sichern»). Bild-Schnappschüsse (DABS, Karten) stehen als **Beilagen** auf eigenen
Seiten nach dem Briefing; die Klickbox «Beilagen mitdrucken» in der Werkzeugleiste
schaltet sie für den Druck ab (am Bildschirm zeigt das Panel den Viewer). Die
Pax-Karte (A5 hoch, mit QR-Code des Treffpunkts) druckt auf A4 quer zwei Karten
nebeneinander zum Trennen. Auf dem Handy werden die Tabellen gestapelt.

### Flugplan (ICAO FPL)

Panel C «Flugplan»: Schalter «Flugplan erstellen?» (Vorschlag ja bei NVFR, Grenzüberschreitung
oder Gasfahrt), dann «Aus Briefing erzeugen». Der Datensatz folgt dem ICAO-Flugplanblatt
(Doc 4444): Kennung, Flugregeln V, Art des Flugs, ZZZZ/L, Ausrüstung, EOBT UTC, Geschwindigkeit,
Flugfläche aus der Maximalhöhe, Route `DRIFTING … FROM … TO … VIA …`, Gesamt-EET, ALTN ZZZZ,
Feld 18 (DEP/ DEST/ mit Kurzkoordinaten, DOF/, **EET/ je FIR aus der Luftraumanalyse**, TYP/,
ALTN/UNKNOWN, RMK/NVFR CREW CONTACT …) und Feld 19 (Autonomie, Personen, Notfunk,
Überlebensausrüstung, Westen, Rettungsinseln, Farbe aus dem Ballon, Bemerkungen, PIC). Jedes
Feld ist überschreibbar; die ICAO-Nachricht (Format des skybriefing-Imports: «Flightplan and
Briefing → Flight Plan import», Text einfügen → Import) kann kopiert oder als .txt geladen werden.
DEP/ und DEST/ behalten das Kantonskürzel als eigenes Wort («BUELACH ZH»).
Standardwerte unter Einstellungen → Flugplan. Trajektorien und Luftraum vorher laden, damit
Route und EET/ gefüllt sind.

### Berechtigungen (persönliche Links)

Je Briefing Personen mit Rolle **Mitarbeit** (alle Inhalte inkl. Pax-Namen ändern,
nicht löschen/freigeben/berechtigen) oder **Nur lesen** (Briefingsicht). Gültig bis
Fahrtdatum + 7 Tage (änderbar), widerrufbar, mit QR-Code (lokal erzeugt), WhatsApp-
und E-Mail-Weitergabe. Mitarbeit-Empfänger nennen beim ersten Öffnen ihren Namen;
Änderungen stehen mit Name/Zeit im Kopf und Protokoll. Nur im Server-Modus.

### Einstellungen

Jede Liste (Ballone, Hüllen, Körbe, Personen, Betreiber, Startplätze, Treffpunkte,
Übergangshöhen, Karten, Webcams, Wettertexte) hat ein **«+»** im Kartenkopf. Ballone
haben **Muster** (z. B. BB26E) und **Transponder-Hexcode**; Ballone und Personen tragen
**Dokumente** (Typ aus der Standardliste unter Experte, Bezeichnung, gültig bis, Datei
PDF/Bild – im Server-Modus in der Worker-Ablage R2, nicht in GitHub). Abgelaufene
Dokumente erscheinen mit ⚠ im Stammdaten-Panel.

Der Zurück-Knopf (←) in der Kopfzeile führt an die Stelle zurück, von der man in die
Einstellungen kam; «Speichern» füllt sich erst, wenn etwas geändert wurde.

Allgemein (Sprache, Thema, Name im Protokoll, Expertenmodus), Ballone (Heissluft-
Profile mit Tanks; Gas: Hüllen und Körbe getrennt; Standardkombination; je Ballon
Tracker-Links für die Passagierkarte, die Hüllenfarbe für den Flugplan und ein Bild der
Hülle – quadratischer Mittenausschnitt – das im Titel des Stammdaten-Panels, im Pax-Blatt und
im Wizard erscheint, im Druck 2 × 2 cm), Personen,
Lufttransportführer, Startplätze & Treffpunkte, Fahrtabsicht-Startwerte, Zeitplan,
Meteo & Auto-Panels (Ampel-Grenzen, Trajektorien-Dauer, Profilhöhe, METAR-Umkreis,
NOTAM-Radius, KI-Modell, Karten für «Allgemeine Lage»)
(Anhänger-Faktor, Zuschlag, Puffer, Bergezeit), Sonne/RAC 4-4 (PDF-Upload, siehe
unten), Übergangshöhen, Go/No-Go-Kriterien (Ampel ab Phase 3), Panels & Pflicht
(Tabelle je Abschnitt mit der Panel-Nummer wie im Briefing, ausblenden/Pflicht),
Freigabe-Links, Benutzer & Freigaben (Stamm-Freigaben; Supermaster: Benutzer
anlegen, Kennwort setzen, Freischaltungen, Stamm ansehen), Statistik (Supermaster),
Zugänge (API-Schlüssel und Logins, zentral, verschlüsselt; nur der Supermaster
ändert sie; das Auge zeigt die Eingabe im Klartext und lädt bei leerem Feld den
gespeicherten Wert nach — protokolliert), Experte (Kennwort ändern, Reserve-Regel). *Export/Import JSON* sichert
die Einstellungen (ohne Zugänge).

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
  Reserve = min(25 % · Dauer, 30 min) (einstellbar). **Zulässiges Startgewicht** =
  Tragkraft am Startplatz bei Hüllentemperatur, höchstens MTOM; Minder-/Mehrgewicht
  bezieht sich darauf (die massgebende Grenze wird genannt).
* **Gas** — Brutto-Auftrieb = V · (ρ_Luft − ρ_Gasgemisch) mit Gasdichte aus p, T
  und Reinheit; Ballast = Brutto-Auftrieb − Nettomasse; Kennzahlen Abkühlung je K,
  Ballast je 100 m, Ballast-Einheiten, Landereserve. Ein Excel-Modus reproduziert
  die Vorlage v2 exakt (Tests).
* **Tagesplanung** — Zeilenliste mit Anker «Start»: vorwärts Zeit + Dauer,
  rückwärts nächste Zeit − eigene Dauer, Pins je Zeile, Rundung auf 5 min
  (`buildPlan`); Hinweise bei BCMT/ECET-Konflikt und Rückfahrt nach SS.

`node test/calc.test.mjs` prüft diese Modelle gegen die Excel-Werte und die RAC-Tabelle.

---

## Woher die Daten kommen

| Was | Quelle | Weg |
|---|---|---|
| Ortssuche, Höhe, Zeitzone, Modellwerte T/QNH/RH | Open-Meteo (Geocoding, Elevation, Forecast) | direkt aus dem Browser |
| Ortsname/Land zum Kartenpunkt | Nominatim / OpenStreetMap | direkt aus dem Browser |
| Fahrzeit | OSRM-Demo-Server (OpenStreetMap) | direkt aus dem Browser |
| Kartenkacheln | OpenStreetMap | direkt aus dem Browser |
| Sonne/Dämmerung CH | RAC 4-4 (skyguide) | `data/rac/rac-ch.json`, Upload in den Einstellungen |
| Briefings, Einstellungen, Links | eigener Worker (D1) | `js/config.js → apiBase` |
| Bilder | eigener Worker (R2) | unerratbare Dateischlüssel |

| Modellprognose (Stunden, Druckflächen) | Open-Meteo Forecast API | Server-Modus über Worker `/api/wx/om` (Kundenschlüssel, 15 min Cache); lokal direkt |
| METAR/TAF, SIGMET/AIRMET | NOAA aviationweather.gov | Worker `/api/wx/metar`, `/api/wx/sigmet` (10 min Cache); Rückfall `gafor.wicki.aero/data/dwd/metar.json` |
| DWD Luftsportberichte, Ballon-Gebietsvorhersagen, GAFOR-Gebiete, METAR-Kopie | DWD / NOAA, eigener Abruf durch die GitHub Action `fetch-dwd.yml` (3×/h) nach `data/dwd/`; Rückfall GaforCast-Kopie | Worker `/api/wx/dwd` oder direkt von der eigenen Origin |
| Amtliche Karten (Schnappschuss) | DWD Hobbymeteorologie, ECMWF Open Charts | Worker `/api/wx/snapshot` (Allowlist) → R2 |
| DABS | skybriefing `o/dabs?today|tomorrow` | Worker `/api/wx/dabs` → R2, Seiten mit pdf.js (vendored) gerendert |
| Lufträume | openAIP Core API (`api.core.openaip.net/api/airspaces?bbox=…`) | Worker `/api/wx/airspace` mit `openaip`-Schlüssel aus «Zugänge» (Rückfall: Kachel-Schlüssel aus der Overlay-URL), Analyse im Browser (`js/calc/airspace.js`) |
| Webcams | Windy Webcams API v3, OpenStreetMap/Overpass | Worker `/api/wx/webcams` (Schlüssel `windy_webcams` optional) |
| NOTAM | FAA NOTAM API (`external-api.faa.gov`) | Worker `/api/wx/notam` mit `faa_client_id/secret` aus «Zugänge» |
| KI-Hinweis | Anthropic API | Worker `/api/wx/ai` mit `anthropic`-Schlüssel aus «Zugänge» |
| Radar | RainViewer public API | direkt aus dem Browser (nur Bildschirm) |

Alle `/api/wx/*`-Aufrufe brauchen die Owner-Sitzung oder einen gültigen
persönlichen Link (`?t=`); DABS, Schnappschuss und KI zusätzlich Mitarbeit-Rolle.
Nicht automatisiert (bewusst, siehe Konzept 5.7): pc_met und skybriefing-Produkte
hinter Login — Deep-Link + Einfügen.

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
`sw.js` liest den Cache-Namen von dort (neue Version = neuer Cache). Beim Release
zusätzlich `CHANGELOG.md` nachführen.

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
js/calc/*.js               Sonne/Mond, RAC-Parser, Aerostatik, Zeitplan, Geo, Zeit, Flugplan (fpl.js)
js/ui/*.js                 Liste, Ablauf, Erarbeitung, Briefingsicht, Einstellungen, Links, Flugplan-Panel (fplpanel.js)
js/vendor/                 Leaflet (BSD-2), qrcode-generator (MIT)
data/rac/rac-ch.json       RAC 4-4 OCT 2026 – DEC 2027
worker/                    Cloudflare Worker (src/index.js, schema.sql, wrangler.toml)
test/                      Rechentests (node, inkl. Trajektorien/Ampel/NOTAM-Filter), Oberflächen-Durchläufe (Playwright, Open-Meteo synthetisch über test/om_fixture.py)
js/auto/                   Open-Meteo, Trajektorien, Grafiken (Stüve, Wind, Meteogramm), Datenbeschaffung, KI-Prompt
js/ui/autopanels.js, autorender.js  automatische Panels (Erarbeitung) und ihre Darstellung (beide Sichten)
worker/src/wx.js           Datenabrufe im Worker (/api/wx/*)
```

## Lizenz

Alle Rechte vorbehalten; Quelltext zur Einsicht veröffentlicht. Jede Nutzung
über das Lesen hinaus nur mit vorheriger ausdrücklicher Zustimmung von
Balthasar Wicki / Wicki Aero GmbH und mit Quellenangabe — siehe `LICENSE`
(DE/EN). Drittkomponenten: Leaflet (BSD-2-Clause), qrcode-generator (MIT),
pdf.js (Apache-2.0, `js/vendor/pdfjs`). Logo und Name
«Wicki Partners Ballonteam» sind nicht Teil der Lizenz.
