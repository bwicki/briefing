/* Fahrtbriefing — Länder-Matrix (0.11.1).
 *
 * Im Hintergrund geführte Übersicht, welche Quellen und Besonderheiten je Land gelten — getrennt nach
 * Rolle der Fahrt (Start, Überflug, Landung). Vorbild: Landespakete von GaforCast (gafor.wicki.aero):
 * Deutschland mit den DWD-Luftsportberichten über die GAFOR-Gebiete (inkl. astronomischer Angaben aus
 * dem Ballonwetterbericht), die Schweiz mit DABS (vorgeschrieben), RAC 4-4 und skybriefing, die
 * übrigen Länder mit den allgemeinen Quellen (Open-Meteo, openAIP, aviationweather, FAA-NOTAM).
 *
 * Sichtbar in Einstellungen → Experte → «Länder-Matrix»; eigene Notizen je Land werden in den
 * Einstellungen (S.countryNotes) gespeichert. Die Fahrt-Logik fragt die Matrix über
 * countryInfo(code) und routeMatrix(b) ab.
 */

/** Rollen einer Fahrt in einem Land. */
export const ROLES = ['start', 'overflight', 'landing'];

/** Länder-Matrix: je Land Quellen, Pflichtpunkte und Besonderheiten. `*` = alle übrigen Länder. */
export const COUNTRY_MATRIX = {
  CH: {
    name: { de: 'Schweiz', en: 'Switzerland' },
    official: { label: 'skybriefing (Skyguide/MeteoSchweiz)', url: 'https://www.skybriefing.com', access: 'login', reports: 'Flugwetterprognose, GAFOR CH, Ballonwetter (Einfügen)' },
    model: 'ICON-CH1 (MeteoSchweiz, 1 km) / ICON-CH2',
    sun: 'RAC 4-4 (amtlich, Tabelle im Jahrgang)',
    airspace: 'openAIP · DABS (täglich, vorgeschrieben) · AIP CH',
    notam: 'skybriefing / FAA-NOTAM (LS)',
    dabs: 'Pflicht: DABS des Fahrttags vor dem Start konsultieren',
    fpl: 'skybriefing (Flight Plan import); Schliessen ARO 0800 437 837',
    contacts: 'AIM Operations +41 43 931 61 61 · ARO 0800 437 837',
    panels: ['C.dabs'],
    roles: {
      start: ['DABS Pflicht', 'RAC 4-4 Dämmerungszeiten', 'NVFR: RMK/NVFR im Flugplan'],
      overflight: ['DABS Pflicht (CH-Luftraum)', 'Übergangshöhe 7000 ft / TMA-Grenzen'],
      landing: ['ARR-Meldung an ARO, wenn Flugplan aufgegeben'],
    },
    notes: ['Gasfahrten: Fahrt über die Landesgrenze praktisch immer → Flugplan', 'Flugplan für VFR nach DE/AT/FR/IT Pflicht (AIP CH ENR 1.10 § 1.3.2)'],
  },
  LI: {
    name: { de: 'Liechtenstein', en: 'Liechtenstein' },
    official: { label: 'wie Schweiz (Skyguide, FIR LSAS)', url: 'https://www.skybriefing.com', access: 'login', reports: 'siehe CH' },
    model: 'ICON-CH1', sun: 'RAC 4-4', airspace: 'openAIP · DABS', notam: 'skybriefing', dabs: 'wie CH', fpl: 'wie CH', contacts: 'wie CH', panels: ['C.dabs'],
    roles: { start: ['wie CH'], overflight: ['wie CH'], landing: ['wie CH'] }, notes: ['Luftraum durch Skyguide verwaltet'],
  },
  DE: {
    name: { de: 'Deutschland', en: 'Germany' },
    official: { label: 'DWD Luftsportberichte (flugwetter.de / pc_met)', url: 'https://www.dwd.de/DE/fachnutzer/luftfahrt/teaser/luftsportberichte/luftsportberichte_node.html', access: 'frei', reports: 'GAFOR (68 Gebiete), Flugwetterübersicht, Ballonwetterbericht je Gebiet' },
    model: 'ICON-D2 (DWD, 2 km)',
    sun: 'DWD Ballonwetterbericht des Gebiets («Astronomische Angaben», UTC) – sonst berechnet',
    airspace: 'openAIP · DFS AIP (ED-R, TMZ/RMZ)',
    notam: 'FAA-NOTAM (ED)',
    dabs: '–',
    fpl: 'VFR-Flugplan bei Fahrt über die Landesgrenze; Aufgabe über skybriefing (Start CH) oder AIS-C DFS',
    contacts: 'DFS AIS-C (Flugplan-Aufgabe) · FIS-Frequenz regional – Nummern in den Notizen ergänzen',
    panels: ['B.balloon', 'B.fwp'],
    roles: {
      start: ['Ballonwetterbericht und GAFOR des Gebiets (DWD)', 'Sonnen-/Dämmerungszeiten aus dem DWD-Bericht'],
      overflight: ['GAFOR-Gebiete entlang der Route', 'ED-R-Gebiete (Truppenübungsplätze) prüfen'],
      landing: ['Ballonwetterbericht des Zielgebiets', 'Grenzübertritt: Zoll nur Meldung, EU/Schengen'],
    },
    notes: ['Quelle wie GaforCast (gafor.wicki.aero): DWD-Berichte über die GAFOR-Gebiete, Nutzung nur zur eigenen Flugvorbereitung'],
  },
  AT: {
    name: { de: 'Österreich', en: 'Austria' },
    official: { label: 'Austro Control Flugwetter', url: 'https://www.austrocontrol.at/flugwetter', access: 'frei', reports: 'Bulletins FXOS41–45 mit Abschnitt «Hinweise Ballonfahrten»' },
    model: 'AROME (GeoSphere Austria, 2,5 km)',
    sun: 'berechnet (NOAA-Verfahren)',
    airspace: 'openAIP · AIP Austria',
    notam: 'FAA-NOTAM (LO)',
    dabs: '–', fpl: 'VFR-Flugplan bei Fahrt über die Landesgrenze', contacts: 'Austro Control AIS – Nummer in den Notizen ergänzen',
    panels: [],
    roles: { start: ['FXOS-Bulletin der Region'], overflight: ['Alpenquerung: Föhn/Talwinde, Föhnlagen in FXOS'], landing: ['Bulletin des Zielgebiets'] },
    notes: ['Bulletins im Volltext frei abrufbar (Vorbild GaforCast at/meta.json)'],
  },
  FR: {
    name: { de: 'Frankreich', en: 'France' },
    official: { label: 'Météo-France Aéronautique', url: 'https://aviation.meteo.fr', access: 'login', reports: 'nur nach Anmeldung (Einfügen)' },
    model: 'AROME (Météo-France, 1,5 km)',
    sun: 'berechnet', airspace: 'openAIP · SIA (AIP France)', notam: 'FAA-NOTAM (LF)', dabs: '–',
    fpl: 'VFR-Flugplan bei Fahrt über die Landesgrenze Pflicht', contacts: 'BRIA (Bureau régional d’information aéronautique)',
    panels: [], roles: { start: ['Bericht manuell einfügen'], overflight: ['Zonen R/P (SIA) prüfen'], landing: ['–'] }, notes: ['Berichte nur mit Login – Einfügefeld'],
  },
  IT: {
    name: { de: 'Italien', en: 'Italy' },
    official: { label: 'Aeronautica Militare (meteoam.it)', url: 'https://www.meteoam.it', access: 'frei', reports: 'GAFOR FBIY61 (13 Gebiete), Klartext' },
    model: 'ICON-2I (ItaliaMeteo/Arpae, 2,2 km)',
    sun: 'berechnet', airspace: 'openAIP · ENAV AIP', notam: 'FAA-NOTAM (LI)', dabs: '–',
    fpl: 'VFR-Flugplan bei Fahrt über die Landesgrenze Pflicht', contacts: 'ENAV ARO',
    panels: [], roles: { start: ['GAFOR FBIY61'], overflight: ['Alpensüdseite: Talwinde, Nebel Po-Ebene'], landing: ['GAFOR des Zielgebiets'] }, notes: ['GAFOR frei abrufbar (Vorbild GaforCast it/meta.json)'],
  },
  '*': {
    name: { de: 'übrige Länder', en: 'other countries' },
    official: { label: 'nationaler Flugwetterdienst (manuell einfügen)', url: '', access: 'unbekannt', reports: '–' },
    model: 'Open-Meteo Best Match / ICON-EU / GFS',
    sun: 'berechnet (NOAA-Verfahren)', airspace: 'openAIP', notam: 'FAA-NOTAM (ICAO-Präfix)', dabs: '–',
    fpl: 'VFR-Flugplan nach nationalem AIP', contacts: '–',
    panels: [], roles: { start: ['allgemeine Quellen'], overflight: ['FIR-Folge aus der Luftraumanalyse'], landing: ['allgemeine Quellen'] }, notes: [],
  },
};

/** Eintrag eines Landes (ISO-2), sonst der Standard `*`. */
export const countryInfo = (code) => COUNTRY_MATRIX[String(code || '').toUpperCase()] || COUNTRY_MATRIX['*'];

/** Länder einer Fahrt mit Rolle: Start (Startort), Landung (Landeraum), Überflug (FIR-Folge / Trajektorienpunkte). */
export function routeMatrix(b, routeCountries) {
  const start = (b.site?.country || '').toUpperCase();
  const land = (b.landing?.country || '').toUpperCase();
  const all = [...(routeCountries || [])].map((c) => String(c).toUpperCase()).filter(Boolean);
  const out = [];
  const add = (code, role) => { if (!code) return; let e = out.find((x) => x.code === code); if (!e) { e = { code, roles: [], info: countryInfo(code) }; out.push(e); } if (!e.roles.includes(role)) e.roles.push(role); };
  add(start, 'start');
  for (const c of all) if (c !== start && c !== land) add(c, 'overflight');
  if (land) add(land, land === start && all.length <= 1 ? 'landing' : 'landing');
  return out;
}

/** Kurzzeile «CH (Start) · DE (Überflug) · AT (Landung)». */
export function routeMatrixLine(entries, tr) {
  return entries.map((e) => `${e.code} (${e.roles.map((r) => tr(r)).join('/')})`).join(' · ');
}
