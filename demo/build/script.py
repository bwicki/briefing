"""Fahrtbriefing — Einführungsvideos (0.12.2): Sprechtexte und Szenen.

Eine Quelle für die Sprachsynthese (Piper), die Aufnahme (record.py) und die Kapitel im Player (demo/index.html).
Zwei Fassungen: «hab» (Heissluftfahrt mit der HB-QWZ) und «gas» (Gasfahrt mit der HB-QPJ). Je Szene: Schlüssel,
Titel (Einblendung oben links), Sprechtext (deutsch; Kennungen mit Bindestrichen, damit die Stimme buchstabiert).
"""

VERSIONS = {
    'hab': {
        'title': 'Einführung Heissluftfahrt · HB-QWZ',
        'balloon': 'HB-QWZ · BB26E, 2600 m³',
        'scenes': [
            ('login', 'Anmelden und Übersicht',
             'Willkommen beim Fahrtbriefing. Nach der Anmeldung öffnet sich die Übersicht «Meine Briefings»: jede Fahrt mit Datum, Startort, Ballon, Status und Phase der Vorbereitung. Ein Klick auf eine Zeile öffnet die Erarbeitung.'),
            ('wiz1', 'Neues Briefing: Ballon und Fahrt',
             '«Neues Briefing» führt in sechs Schritten durch die Fahrtabsicht. Zuerst Ballon und Art der Fahrt: hier die Heissluft-Hülle H-B-Q-W-Z, eine private Fahrt. Die Stammdaten des Ballons – Massen, Zylinder, Hüllentemperatur – sind hinterlegt.'),
            ('wiz2', 'Ort und Zeit',
             'Dann Ort und Zeit: der Startplatz aus den Favoriten, hier Oberlunkhofen, dazu Datum und Startzeit. Die Dämmerungszeiten nach RAC 4-4 und der Zeitplan vom Treffpunkt bis zum Start werden sofort berechnet.'),
            ('wiz3', 'Fahrtabsicht, Personen, Tagesplanung',
             'Es folgen die Fahrtabsicht mit Dauer, Höhenband und Zielrichtung, die Personen an Bord mit einer Vorschau der Tragkraft, und die Tagesplanung. Am Schluss die Zusammenfassung – «Briefing anlegen» öffnet die Erarbeitung.'),
            ('editor', 'Erarbeitung: Abschnitte und Pflichtinhalte',
             'Die Erarbeitungssicht gliedert das Briefing in die Abschnitte A bis D: Fahrt, Meteo, Luftraum und Betrieb. Links die Navigation mit dem Stand jedes Panels, rechts Go/No-Go, Horizont und Protokoll. Pflichtinhalte sind markiert; «Pflichtinhalte ergänzen» springt zum nächsten offenen Panel.'),
            ('refresh', 'Daten laden',
             '«Alle verfügbaren Daten aktualisieren» lädt die automatischen Panels: Meteogramm, Winde je Höhe, Temperaturprofil, Trajektorien, METAR und TAF sowie die Lufträume. Die Meteo-Leiste zeigt das gewählte Wettermodell und den Stand der Daten.'),
            ('airspace', 'Luftraum und Tragkraft',
             'Abschnitt C zeigt die Lufträume entlang der Trajektorien mit Freigabestellen und Frequenzen. Die Tragkraft-Rechnung in Abschnitt A zeigt die Abflugmasse und den Spielraum zur maximalen Masse bei der erwarteten Temperatur.'),
            ('release', 'Go/No-Go, Freigabe und Briefingsicht',
             'Die Go/No-Go-Karte fasst die Kriterien zusammen. «Freigeben» prüft die Pflichtinhalte und erstellt die finale Fassung. Die Briefingsicht ist druckbar und lässt sich per Link mit Crew und Passagieren teilen.'),
            ('end', 'Ende',
             'Das war der Überblick für die Heissluftfahrt. Für Gasfahrten gibt es eine zweite Einführung mit Höhenprofil, Etappen und Ballastplanung.'),
        ],
    },
    'gas': {
        'title': 'Einführung Gasfahrt · HB-QPJ',
        'balloon': 'HB-QPJ · NL-STU/1000, 1050 m³ H₂',
        'scenes': [
            ('login', 'Anmelden und Übersicht',
             'Willkommen beim Fahrtbriefing. Diese Einführung zeigt die Vorbereitung einer Gasfahrt. Nach der Anmeldung öffnet sich die Übersicht «Meine Briefings» mit allen Fahrten, ihrem Status und der Phase der Vorbereitung.'),
            ('wiz1', 'Neues Briefing: Gasballon',
             '«Neues Briefing»: Ballonart Gas, Hülle H-B-Q-P-J mit tausendfünfzig Kubikmetern Wasserstoff, dazu der Korb. Startplatz Oberlunkhofen, Start am späten Nachmittag – die Fahrt geht über die Nacht.'),
            ('wiz3', 'Fahrtabsicht über 24 Stunden',
             'Die Fahrtabsicht: Dauer vierundzwanzig Stunden, Höhenband und Zielrichtung. Dann die Personen mit der Ballastvorschau, die Tagesplanung und die Zusammenfassung – «Briefing anlegen».'),
            ('editor', 'Erarbeitung mit den Gas-Panels',
             'Für Gasfahrten kommen eigene Panels dazu: das Fahrtprofil mit Höhen, Etappen und Ballast, die Nachfahrer-Übersicht und der Flugplan. Die Navigation links zeigt, was noch offen ist.'),
            ('profile', 'Fahrtprofil: Daten aufbereiten',
             '«Daten aufbereiten» rechnet die Bahn aus den Winden je Höhe, holt das Relief entlang der Bahn, die Stundenprofile, Sonnenzeiten und Lufträume. Die Grafik zeigt Distanz und Zeit gegen Höhe, mit Nacht, Dämmerung und Gelände.'),
            ('tool', 'Werkzeug: Punkte und Etappen',
             'Im Werkzeug werden die geplanten Fahrthöhen als Punkte gezogen; ein Doppelklick setzt einen neuen Punkt. Die Bahn wird nachgerechnet, Zeiten und Lufträume folgen. Ein Klick auf die Zeitzeile setzt eine Etappengrenze, die Etappen lassen sich benennen.'),
            ('model', 'Wettermodell und Beispiel',
             'Die Pille «Wettermodell» zeigt das Modell, das die ganze Fahrt abdeckt; die Liste warnt, wenn ein feineres Modell nur einen Teil reicht. «Beispiel» öffnet eine Übungsfahrt mit nummerierten Erklärungen zu jedem Element der Grafik.'),
            ('ballast', 'Etappen, Ballast und Kontakte',
             'Unter der Grafik die Etappenübersicht mit Zeiten, Höhenband, Ort, Land, Lufträumen und Kontakten, und die Schätzung des Ballastverbrauchs je Teilstück: Manöver, Level-Out, Temperatur und Adiabatik gegen den Vorrat.'),
            ('release', 'Briefingsicht',
             'In der Briefingsicht erscheint das Profil mit Etappen und Ballast als Teil des Briefings – druckbar und teilbar. Damit ist die Gasfahrt vorbereitet.'),
        ],
    },
}
