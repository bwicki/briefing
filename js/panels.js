/* Fahrtbriefing — Panel-Register.
 *
 * Die Reihenfolge entspricht dem gedruckten Muster «Briefing 2026». Jedes
 * Panel hat eine Art (kind), die bestimmt, wie Erarbeitungs- und Briefingsicht
 * es darstellen, und einen Grad (auto/calc/paste/text), der in Phase 2 für die
 * automatischen Abrufe gebraucht wird. In Phase 1 sind alle Meteo-/Nav-Panels
 * «paste» (Einfüge-Assistent) oder «text»; der Deep-Link (`link`) verweist auf
 * die Quelle in den Einstellungen (sources).
 */
import { PLAN_KEYS, STAGE_PANEL_KEYS, startPlanOff } from './calc/stageplan.js';

export const SECTIONS = [
  { id: 'A', de: 'Operationelle Vorbereitung', en: 'Operational preparation' },
  { id: 'B', de: 'Meteorologische Vorbereitung', en: 'Meteorological preparation' },
  { id: 'C', de: 'Navigatorische Vorbereitung', en: 'Navigational preparation' },
  { id: 'D', de: 'Crew-/Pax-Briefing', en: 'Crew/pax briefing' },
];

export const PANELS = [
  // A
  { key: 'A.core', section: 'A', kind: 'core', de: 'Stammdaten', en: 'Flight data', grade: 'calc', always: true, noAi: true },
  { key: 'A.sun', section: 'A', kind: 'sun', de: 'Astronomische Daten', en: 'Astronomical data', grade: 'calc', always: true, noAi: true },
  { key: 'A.massperf', section: 'A', kind: 'massperf', de: 'Tragkraft-, Treibstoff- und Massenberechnung', en: 'Lift, fuel and mass calculation', grade: 'calc', always: true },
  // 0.12: Gasfahrt – Fahrthöhen, Etappen und Ballast im Höhenprofil-Werkzeug; Nachfahrer-Abschnitt ab 12 h Fahrtdauer
  { key: 'A.profile', section: 'A', kind: 'profile', de: 'Fahrtprofil: Höhen, Etappen, Ballast', en: 'Flight profile: altitudes, stages, ballast', grade: 'calc', gasOnly: true, noAi: true },
  { key: 'A.retrieve', section: 'A', kind: 'text', de: 'Nachfahrer: Route, Maut, Übernachtung, Grenze', en: 'Retrieve crew: route, tolls, overnight, border', grade: 'manual', gasOnly: true, minDurationMin: 720, defaultText: { de: 'Route Nachfahrer: …\nMaut / Vignetten: …\nÜbernachtung: …\nGrenzdokumente (ID, Fahrzeugpapiere, Ballonpapiere): …\nTreffpunkt / Erreichbarkeit: …', en: 'Retrieve route: …\nTolls / vignettes: …\nOvernight stay: …\nBorder documents (ID, vehicle papers, balloon papers): …\nMeeting point / reachability: …' } },
  { key: 'A.landing', section: 'A', kind: 'landing', de: 'Geplante Landeorte, Besonderheiten', en: 'Planned landing areas, particulars', grade: 'manual' },
  { key: 'A.equipment', section: 'A', kind: 'equipment', de: 'Erforderliche Spezialausrüstung', en: 'Special equipment required', grade: 'calc' },
  { key: 'A.schedule', section: 'A', kind: 'schedule', de: 'Tagesplanung (LT)', en: 'Day schedule (LT)', grade: 'calc', always: true },
  { key: 'A.remarks', section: 'A', kind: 'text', de: 'Bemerkungen', en: 'Remarks', grade: 'manual' },
  // B
  { key: 'B.synoptic', section: 'B', kind: 'auto', auto: 'synoptic', de: 'Allgemeine Lage mit Bodendruckkarte', en: 'General situation with surface chart', grade: 'half', link: 'meteoswiss', phase2: 'ECMWF Open Charts, DWD Bodenanalyse' },
  { key: 'B.metar', section: 'B', kind: 'auto', auto: 'metar', de: 'METAR/TAF der nächstgelegenen Flugplätze', en: 'METAR/TAF of nearest aerodromes', grade: 'auto', link: 'skybriefing', phase2: 'aviationweather.gov, Plätze im eingestellten Umkreis (RAW + Klartext)' },
  { key: 'B.temps', section: 'B', kind: 'auto', auto: 'temps', de: 'Temps', en: 'Soundings', grade: 'auto', link: 'meteoblue', phase2: 'meteoblue Images API, eigenes Stüve, Payerne' },
  { key: 'B.obs', section: 'B', kind: 'auto', auto: 'obs', de: 'Beobachtungen (Wetterstationen)', en: 'Observations (weather stations)', grade: 'auto', link: 'meteoswiss', phase2: 'Wetterstationen im Umkreis: SwissMetNet (CH), DWD via Bright Sky (DE), EUMETNET MeteoGate/E-SOH (übriges Europa)' },
  { key: 'B.fwp', section: 'B', kind: 'auto', auto: 'fwp', de: 'Flugwetterprognose (offiziell)', en: 'Official aviation forecast', grade: 'half', link: 'skybriefing', phase2: 'DE: DWD Luftsportberichte automatisch' },
  { key: 'B.wind', section: 'B', kind: 'auto', auto: 'wind', de: 'Windprognose (Boden/Höhe)', en: 'Wind forecast (surface/altitude)', grade: 'half', link: 'pcmet', phase2: 'eigene Windfiedern-Karten' },
  { key: 'B.balloon', section: 'B', kind: 'auto', auto: 'balloon', de: 'Ballonprognose', en: 'Balloon forecast', grade: 'auto', link: 'dwdBallon', phase2: 'DWD Gebietsvorhersage Ballonsport, eigene Stundentabelle' },
  { key: 'B.pdiff', section: 'B', kind: 'auto', auto: 'pdiff', de: 'Druckdifferenzprognose', en: 'Pressure difference forecast', grade: 'auto', link: 'meteoswiss', phase2: 'Bise/Föhn aus Modell und SwissMetNet' },
  { key: 'B.traj', section: 'B', kind: 'auto', auto: 'traj', de: 'Trajektorien', en: 'Trajectories', grade: 'auto', link: 'meteoblue', phase2: 'eigene Berechnung, Szenarien, Ensemble' },
  { key: 'B.sigwx', section: 'B', kind: 'auto', auto: 'sigmet', de: 'SIGWX low Alps', en: 'SIGWX low Alps', grade: 'half', link: 'skybriefing', phase2: 'SIGMET/AIRMET automatisch' },
  { key: 'B.thermal', section: 'B', kind: 'auto', auto: 'thermal', de: 'Thermik', en: 'Thermals', grade: 'auto', phase2: 'eigene Abschätzung aus Modellwerten (Strahlung, Grenzschicht): Einsetzen, Stärke, Abschwächen' },
  { key: 'B.meteogram', section: 'B', kind: 'auto', auto: 'meteogram', de: 'Meteogramm, Take-off Forecast o. ä.', en: 'Meteogram, take-off forecast', grade: 'auto', link: 'meteoblue', phase2: 'meteoblue Images API, eigenes Meteogramm' },
  { key: 'B.radar', section: 'B', kind: 'auto', auto: 'radar', de: 'Radar / Blitz / Satellit / Webcams', en: 'Radar / lightning / satellite / webcams', grade: 'auto', link: 'windy', phase2: 'RainViewer, EUMETSAT, Windy-Webcams', optional: true },
  { key: 'B.warnings', section: 'B', kind: 'paste', de: 'Warnungen', en: 'Warnings', grade: 'auto', link: 'meteoswiss', phase2: 'MeteoSchweiz/DWD-Warnungen', optional: true },
  { key: 'B.remarks', section: 'B', kind: 'text', de: 'Bemerkungen', en: 'Remarks', grade: 'manual' },
  // C
  { key: 'C.airspace', section: 'C', kind: 'auto', auto: 'airspace', de: 'Luftraum entlang des Fahrtwegs', en: 'Airspace along the route', grade: 'auto', phase2: 'openAIP: Lufträume entlang der Trajektorien, Höhenband, Korridor, FIR-Folge' },
  { key: 'C.dabs', section: 'C', kind: 'auto', auto: 'dabs', de: 'DABS', en: 'DABS', grade: 'auto', link: 'skybriefingDabs', phase2: 'DABS-PDF automatisch (CH)', chOnly: true },
  { key: 'C.notam', section: 'C', kind: 'auto', auto: 'notam', de: 'NOTAM (VFR-relevant)', en: 'NOTAM (VFR relevant)', grade: 'auto', link: 'skybriefing', phase2: 'FAA-NOTAM-API: Strecke (Start → Landeraum/Trajektorien) oder Umkreis um gewählte Orte, VFR-Filter' },
  { key: 'C.fpl', section: 'C', kind: 'fpl', de: 'Flugplan', en: 'Flight plan', grade: 'manual', defaultText: { de: 'keiner', en: 'none' } },
  { key: 'C.agreements', section: 'C', kind: 'text', de: 'Besondere Absprachen', en: 'Special agreements', grade: 'manual', defaultText: { de: 'keine', en: 'none' } },
  { key: 'C.transition', section: 'C', kind: 'transition', de: 'Übergangshöhe', en: 'Transition altitude', grade: 'calc' },
  { key: 'C.remarks', section: 'C', kind: 'text', de: 'Bemerkungen', en: 'Remarks', grade: 'manual' },
  // D
  { key: 'D.pax', section: 'D', kind: 'text', de: 'Besondere Briefingbedürfnisse PAX', en: 'Special briefing needs PAX', grade: 'manual' },
  { key: 'D.crew', section: 'D', kind: 'text', de: 'Besondere Briefingbedürfnisse CREW', en: 'Special briefing needs CREW', grade: 'manual' },
  { key: 'D.standard', section: 'D', kind: 'paxbriefing', de: 'Standard-Briefing PAX', en: 'Standard PAX briefing', grade: 'calc', always: true },
];

export const panelByKey = (k) => PANELS.find((p) => p.key === k);

/**
 * Sichtbare Panels in Reihenfolge (ausgeblendete und CH-only entfernt, wenn die Fahrt die Schweiz nicht berührt).
 * 0.12.5: Etappen-Briefing (abgeleitete Sicht mit `stagePlan`) → nur die Panels der Etappenplanung; Startetappe ohne
 * Planung → die orts-/zeitgebundenen Panels fehlen in den Abschnitten B/C (die Planung liegt dann bei einer anderen Etappe).
 * 0.12.7: Sicht der Startetappe (`stagePlan.start`, Bereich der ersten Etappe) → alle Panels wie im Hauptbriefing.
 */
export function visiblePanels(settings, briefing) {
  const hidden = new Set(settings?.panels?.hidden || []);
  const ch = briefing ? touchesCH(briefing) : true;
  const gas = briefing ? briefing.balloon?.type === 'gas' : true;
  const dur = briefing ? (briefing.intent?.durationMin || 0) : Infinity;
  const stageSet = briefing?.stagePlan && !briefing.stagePlan.start ? new Set(STAGE_PANEL_KEYS) : null;   // 0.12.7: Sicht der Startetappe behält alle Panels
  const dropped = !stageSet && briefing && startPlanOff(briefing) ? new Set(PLAN_KEYS) : null;
  return PANELS.filter((p) => !hidden.has(p.key) && (!p.chOnly || ch) && (!p.gasOnly || gas) && (!p.minDurationMin || dur >= p.minDurationMin) && (!stageSet || stageSet.has(p.key)) && (!dropped || !dropped.has(p.key)));
}
/** Berührt die Fahrt die Schweiz? Startort/Landeraum/FIR-Folge/Trajektorienpunkte (grobe Länderschätzung). */
// Grober Umriss der Schweiz (lat, lon; ~20 Stützpunkte) – ersetzt das Rechteck, das Süddeutschland und Vorarlberg mitgezählt hat (0.12.4)
const CH_OUTLINE = [[46.22, 5.96], [46.40, 6.12], [46.75, 6.45], [47.05, 6.92], [47.30, 7.00], [47.58, 7.52], [47.60, 8.20], [47.78, 8.55], [47.82, 8.72], [47.68, 9.20], [47.55, 9.58], [47.28, 9.53], [47.06, 9.62], [46.92, 10.20], [46.85, 10.48], [46.62, 10.46], [46.40, 10.10], [46.22, 9.30], [45.83, 9.03], [46.00, 8.80], [46.10, 8.42], [46.45, 8.08], [46.00, 7.86], [45.92, 7.25], [46.20, 6.85], [46.40, 6.78], [46.30, 6.30], [46.13, 6.30], [46.12, 6.05]];
const inRing = (lat, lon, ring) => { let inside = false; for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) { const [yi, xi] = ring[i], [yj, xj] = ring[j]; if (((yi > lat) !== (yj > lat)) && (lon < (xj - xi) * (lat - yi) / ((yj - yi) || 1e-12) + xi)) inside = !inside; } return inside; };
export const inSwitzerland = (lat, lon) => inRing(lat, lon, CH_OUTLINE);
export function touchesCH(b) {
  if ((b?.site?.country || '') === 'CH' || (b?.landing?.country || '') === 'CH') return true;
  const inCH = inSwitzerland;
  if (b?.landing?.lat != null && inCH(b.landing.lat, b.landing.lon)) return true;
  for (const f of b?.panels?.['C.airspace']?.content?.auto?.data?.firs || []) for (const sq of f.seq || []) if (sq.country === 'CH') return true;
  for (const tr of b?.stagePlan?.traj?.tracks || b?.panels?.['B.traj']?.content?.auto?.data?.tracks || []) for (const p of tr.points || []) if (inCH(p.lat, p.lon)) return true;
  return false;
}
/** Nummer eines Panels innerhalb seines Abschnitts (A1 … An) in der sichtbaren Liste. */
export function panelNo(p, list, prefix = '') {   // prefix (0.12.7): Etappe, z. B. «E1-» → «E1-C3»
  const same = (list || PANELS).filter((x) => x.section === p.section);
  const k = same.findIndex((x) => x.key === p.key);
  return `${prefix}${p.section}${k >= 0 ? k + 1 : ''}`;
}
/** «A1 · Stammdaten» */
export const panelTitle = (p, list, tr) => `${panelNo(p, list)} · ${tr(p)}`;

/** Ist ein Panel inhaltlich gefüllt? (für Freigabe-Checkliste) */
export function panelFilled(p, briefing) {
  const d = briefing.panels?.[p.key] || {};
  const extraText = (d.extra?.text || '').trim();
  const extraImg = (d.extra?.images || []).length;
  switch (p.kind) {
    case 'core': case 'sun': case 'massperf': case 'schedule': case 'transition': case 'paxbriefing': case 'equipment':
      return true;
    case 'profile':
      return !!(briefing.profile?.data && (briefing.profile.points || []).length >= 2);
    case 'text':
      return !!((d.content?.text || '').trim() || extraText);
    case 'fpl':
      return !briefing.flight?.nvfr || !!briefing.fpl?.enabled;   // NVFR: Flugplan muss erstellt sein
    case 'landing':
      return !!((d.content?.text || '').trim() || extraText || briefing.landing?.lat != null);
    case 'paste':
      return !!((d.content?.text || '').trim() || (d.content?.images || []).length || extraText || extraImg);
    case 'auto':
      return !!(d.content?.auto || (d.content?.text || '').trim() || (d.content?.images || []).length || extraText || extraImg);
    default:
      return true;
  }
}

/** Pflicht-Panels gemäss Einstellungen (sichtbar, nicht «always»). */
export function mandatoryPanels(settings, briefing) {
  const m = new Set(settings?.panels?.mandatory || []);
  if (briefing?.flight?.nvfr) m.add('C.fpl');   // Nachtfahrt (NVFR): Flugplan verbindlich
  return visiblePanels(settings, briefing).filter((p) => m.has(p.key) && !p.always);
}

/** AMC1 BOP.BAS.115 — Text, wie im Muster hinterlegt (EN, Original). */
export const AMC1_BOP_BAS_115 = `AMC1 BOP.BAS.115 Briefing of passengers
(a) Passengers should be given a verbal briefing and demonstration about safety matters in such a way that the information is easily retained and applied during the landing and in the case of an emergency situation.
(b) The briefing/demonstration should include the following items:
(1) safety in relation to ground equipment;
(2) use of internal handholds;
(3) wearing of suitable clothing;
(4) smoking regulations;
(5) in-flight use and stowage of personal belongings and baggage;
(6) importance to remain inside the basket at all times, particularly after landing;
(7) landing positions to be assumed to minimise the effect of the impact during landing;
(8) safe manoeuvring of the balloon on the ground after landing;
(9) use of oxygen-dispensing equipment, if applicable; and
(10) other emergency equipment provided for individual passenger use, if applicable.
(c) Part or all of the verbal briefing may be provided additionally by a safety briefing card on which pictorial instructions indicate the correct landing position.
(d) Before take-off, the correct landing position should be demonstrated.
(e) Before commencing the landing phase, passengers should be required to practise the correct landing position.`;

export const GAS_BRIEFING_EXTRA = {
  de: ['Wasserstoff: kein Feuer, kein Rauchen, keine Funken (auch Handy) im Umkreis der Hülle', 'Ballasthandling: nur auf Anweisung des Piloten', 'Schleiflandung: Haltung, Festhalten, im Korb bleiben', 'Nachtfahrt: Stirnlampe rot, Lärm vermeiden'],
  en: ['Hydrogen: no fire, no smoking, no sparks (incl. phones) near the envelope', 'Ballast handling only on the pilot\'s instruction', 'Drag landing: position, hold on, stay in the basket', 'Night flight: red headlamp, keep noise down'],
};
