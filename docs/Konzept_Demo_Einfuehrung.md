# Konzept: Einführungsfilme «Fahrtbriefing» (0.12.2)

Stand 06.10.2026 · Wicki Aero GmbH · Prototyp umgesetzt (zwei Filme, Player, Pipeline)

## 1 Ziel und Zielgruppe

Eine neue Nutzerin oder ein neuer Nutzer – Ballonpilot, mit der Fahrtvorbereitung vertraut, mit der Plattform nicht –
sieht in **höchstens drei Minuten**, was die Plattform tut und wie ein Briefing entsteht: von der Anmeldung über die
sechs Schritte des Assistenten bis zur Freigabe. Nicht gezeigt werden Einstellungen, Expertenmenü, Mehrbenutzer und
Zugänge; die Filme ersetzen weder README noch SETUP.

Zwei Fassungen, weil sich Panels und Ablauf unterscheiden:

| Fassung | Ballon (Stammdaten) | Startplatz | Dauer | Besonderes |
|---|---|---|---|---|
| Heissluftfahrt | HB-QWZ · BB26E, 2600 m³ | Oberlunkhofen AG | ≈ 2:30 | Tragkraft, Meteo-Panels, Luftraum, Go/No-Go, Freigabe |
| Gasfahrt | HB-QPJ · NL-STU/1000, 1050 m³ H₂ | Oberlunkhofen AG, 16:00 LT, 24 h | ≈ 2:20 | Fahrtprofil-Werkzeug, Etappen, Wettermodell, Beispiel, Ballast |

## 2 Form

- **Film (MP4, H.264/AAC, 1366 × 768)** mit synthetischer Sprecherstimme und Kapiteleinblendung unten links – läuft
  überall (Browser, Handy, PowerPoint, WhatsApp) ohne Abhängigkeiten.
- **Player-Seite `demo/index.html`**: beide Filme, Kapitelliste zum Springen, Sprechtext als Untertitel, hell/dunkel.
  Erreichbar unter `briefing.wicki.aero/demo/` und über das Menü ≡ → «Einführung (Filme)»; die Dropbox-Kopie läuft
  auch direkt aus dem Ordner (Datei öffnen).
- Keine Interaktion im Film (kein Mitklicken): Üben kann man in der App selbst – für die Gasfahrt mit dem
  «Beispiel»-Knopf des Werkzeugs, der im Film gezeigt wird.

Verworfen: Web-Speech-Stimme des Browsers (klingt je Gerät anders, kein Export als Film), animierte Skizzen statt
echter Bedienung (veralten schneller, zeigen nicht die Oberfläche).

## 3 Drehbuch (Szenen = Kapitel)

Die Sprechtexte stehen in `demo/build/script.py` – eine Quelle für Stimme, Aufnahme und Player. Je Szene ein Satz
Handlung in der App (Zeiger sichtbar, Klicks mit Druckeffekt) und 8–18 s Sprechtext.

**Heissluftfahrt (9 Kapitel):** Anmelden und Übersicht · Neues Briefing: Ballon und Fahrt · Ort und Zeit · Fahrtabsicht,
Personen, Tagesplanung · Erarbeitung: Abschnitte und Pflichtinhalte · Daten laden · Luftraum und Tragkraft · Go/No-Go,
Freigabe und Briefingsicht · Ende (Hinweis auf die Gasfahrt).

**Gasfahrt (9 Kapitel):** Anmelden und Übersicht · Neues Briefing: Gasballon · Fahrtabsicht über 24 Stunden · Erarbeitung
mit den Gas-Panels · Fahrtprofil: Daten aufbereiten · Werkzeug: Punkte und Etappen · Wettermodell und Beispiel · Etappen,
Ballast und Kontakte · Briefingsicht.

## 4 Stimme

Sprachsynthese **Piper** (rhasspy, MIT) mit der deutschen Stimme «Thorsten» (CC0) – läuft lokal ohne Dienst und ohne
Schlüssel, deterministisch (gleicher Text → gleiche Aufnahme). Aussprachehilfen im Skript: Kennungen mit Bindestrichen
(«H-B-Q-W-Z» wird buchstabiert), Zahlen ausgeschrieben, «RAC vier vier», Tempo 0,9 (length_scale 1.12).
Alternative Stimme «Kerstin» (weiblich, gleiche Quelle) ist vorbereitet (`PIPER_VOICE=de-kerstin-low`).
Bessere Stimmen (Piper «medium/high», Azure/ElevenLabs) bringen natürlicheren Klang, brauchen aber Modell-Download
bzw. einen Dienst mit Schlüssel – Entscheid nach dem Anhören.

## 5 Aufnahme

Playwright (Chromium, 1366 × 768) bedient die App im **lokalen Modus mit Beispieldaten** – dieselben Nachbildungen wie
der Smoke-Test (Open-Meteo synthetisch, METAR-Kopie, Relief und Wasser synthetisch). Dadurch ist die Aufnahme jederzeit
wiederholbar (nach jeder Oberflächenänderung neu aufnehmen) und enthält keine Zugangsdaten.

Einschränkungen der Beispieldaten, im Film sichtbar: Lufträume, NOTAM und DABS laden nur im Server-Modus (Panel C zeigt
«Laden» und den Hinweis), Wetterwerte sind synthetisch, die Bahn der Gasfahrt entsprechend künstlich. Eine Aufnahme mit
echten Daten ist möglich, wenn sie auf einem angemeldeten Rechner läuft (Server-Modus, Schlüssel in den Einstellungen) –
dann mit einem eigens angelegten Demo-Briefing, damit keine echte Fahrt im Film erscheint.

## 6 Technik (Pipeline `demo/build/`)

1. `synth.py` – Sprechtexte → WAV je Szene (Piper), `durations.json`.
2. `record.py <hab|gas>` – Aufnahme als WebM; je Szene ein kurzes schwarzes Bild als **Szenenmarke** (die Aufnahme kann
   gegenüber der Uhr nachhinken, darum werden die Szenen im Video gemessen, nicht nach Uhrzeit).
3. `assemble.py` – Szenenmarken per `blackdetect`, Sprechtext je Szene mit Stille auf die Szenenlänge, ffmpeg → MP4 + Kapitel-JSON.
4. `player.py` – `demo/index.html` mit eingebetteten Kapiteln.

Alles lokal (Python 3, Playwright, ffmpeg mit libx264, piper-tts); Stimmen aus den Piper-Releases
(`voice-de-thorsten-low.tar.gz`, `voice-de-kerstin-low.tar.gz`), nicht im Repo. Die Filme (≈ 5 MB je Fassung) liegen im
Repo unter `demo/media/` und werden mit der Seite ausgeliefert.

## 7 Pflege

- Nach Änderungen an Oberfläche oder Ablauf: Skript prüfen, `synth.py` nur bei Textänderung, `record.py` und
  `assemble.py` neu laufen lassen (≈ 4 min je Fassung), `player.py`, committen.
- Versionsstand im Film: die Kopfzeile der App zeigt die Version; der Player nennt das Datum des Stands.
- Englische Fassung: Sprechtexte in `script.py` ergänzen, Piper-Stimme `en_US` (z. B. «lessac»), Aufnahme mit `setLang('en')`.

## 8 Entscheide und offene Punkte

1. Prototyp mit Beispieldaten und Stimme «Thorsten» (männlich) umgesetzt; Stimme, Tempo und Länge nach dem Anhören anpassen.
2. Offen: Aufnahme mit echten Daten (Server-Modus) auf dem eigenen Rechner – braucht einmaliges Einrichten (Python,
   Playwright, ffmpeg) oder eine Aufnahme durch Claude mit einem Demo-Zugang.
3. Offen: Untertitel fest ins Bild brennen (für Weitergabe ohne Player) – technisch vorbereitet (drawtext), nicht aktiviert.
4. Offen: englische Fassung.
