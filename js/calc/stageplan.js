/* Fahrtbriefing — Ops-Briefing je Etappe (0.12.5, Gasfahrt).
 *
 * Jede Etappe des Fahrtprofils kann eine eigene Meteo-/Luftraum-/NOTAM-Planung tragen (`stage.ops`):
 * die Planung der Startetappe sind die Abschnitte B und C des Briefings (wie bisher, Startort und
 * ganze Fahrt); jede weitere Etappe mit Planung bekommt einen eigenen Satz B/C-Panels mit dem
 * Zeitfenster, der Mitte der Etappe als Ort und dem Etappenende als Landeraum (Daten in
 * `b.stagePlans[stageId].panels`). Die Abrufe laufen über eine abgeleitete Sicht des Briefings
 * (`stagePlanBriefing`), damit alle Beschaffungsfunktionen unverändert arbeiten.
 * Reine Funktionen ohne DOM (testbar in test/calc.test.mjs).
 */
import { stageWindows, posAtKm, reliefAt, altAt } from './profile.js';
import { icao, countryGuess, distKm } from './geo.js';

const M_TO_FT = 3.28084;
/** Orts-/zeitgebundene Panels einer Planung (Abschnitte B/C). */
export const PLAN_KEYS = ['B.metar', 'B.temps', 'B.obs', 'B.fwp', 'B.wind', 'B.balloon', 'B.sigwx', 'B.thermal', 'B.meteogram', 'C.airspace', 'C.dabs', 'C.notam'];
/** Panels eines Etappen-Briefings: die Planung plus Bemerkungen je Abschnitt. */
export const STAGE_PANEL_KEYS = [...PLAN_KEYS, 'B.remarks', 'C.remarks'];
/** Automatisch nachladbare Panels eines Etappen-Briefings («Alle verfügbaren Daten aktualisieren»). */
export const STAGE_REFRESH = ['meteogram', 'wind', 'temps', 'balloon', 'metar', 'sigmet', 'thermal'];

/** Planung einer Etappe gesetzt? Ohne Angabe: die erste Etappe ja, alle weiteren nein. */
export const stageOps = (stages, i) => (stages?.[i]?.ops == null ? i === 0 : !!stages[i].ops);
/** Etappen mit Planung (Index und Etappe). */
export const opsStages = (stages) => (stages || []).map((s, i) => ({ i, s })).filter((x) => stageOps(stages, x.i));
/** Darf die Planung dieser Etappe ausgeschaltet werden? Nur, wenn eine andere Etappe eine Planung hat. */
export const canDropOps = (stages, i) => opsStages(stages).some((x) => x.i !== i);
/** Nach Löschen/Zusammenlegen: mindestens eine Planung je Briefing (sonst die Startetappe). */
export function ensureOps(stages) {
  if (!stages?.length) return;
  if (!opsStages(stages).length) stages[0].ops = true;
}
/** Land an km aus der FIR-Folge der Profilanalyse ([{country, fromKm, toKm}]), sonst Schätzung aus der Lage. */
export function countryAtKm(firs, km, pos, fallback = '') {
  const f = (firs || []).find((x) => x.country && km >= (x.fromKm ?? 0) && km <= (x.toKm ?? Infinity));
  return f?.country || (pos ? countryGuess(pos.lat, pos.lon) : '') || fallback;
}
/** Kreise entlang der Etappe für die NOTAM-Umkreisabfrage: Radius nm, Mittelpunkte so, dass sich die Kreise überlappen (max. 6). */
export function coverPoints(track, km0, km1, nm, name = '') {
  const len = Math.max(0, km1 - km0), step = Math.max(10, nm * 1.852 * 1.6);
  const n = Math.min(6, Math.max(1, Math.ceil(len / step)));
  const out = [];
  for (let i = 0; i < n; i++) {
    const km = km0 + (i + 0.5) * len / n, q = posAtKm(track, km);
    if (q) out.push({ lat: +q.lat.toFixed(4), lon: +q.lon.toFixed(4), name: `${name} ${Math.round(km)} km`.trim(), nm });
  }
  return out;
}
/** Planungsdatensatz einer Etappe anlegen/holen (Panels, Orte, Abrufeinstellungen). */
export function stagePlanOf(b, stageId) {
  if (!b.stagePlans) b.stagePlans = {};
  if (!b.stagePlans[stageId]) b.stagePlans[stageId] = { panels: {} };
  const plan = b.stagePlans[stageId];
  if (!plan.panels) plan.panels = {};
  for (const k of STAGE_PANEL_KEYS) if (!plan.panels[k]) plan.panels[k] = { content: {}, extra: { text: '', images: [] }, ai: null, comment: '', updatedAt: null, updatedBy: null };
  return plan;
}
/** Etappenfenster des Profils (leer ohne Bahn). */
export function stageWindowsOf(b) {
  const p = b?.profile, D = p?.data;
  if (!D?.track?.points?.length || !(p.stages || []).length) return [];
  return stageWindows(p.stages, D.track, p.points, D.totalKm);
}
/**
 * Abgeleitete Sicht des Briefings für eine Etappe: Ort = Etappenmitte (Relief als Platzhöhe, Land aus der FIR-Folge),
 * Zeitfenster = Etappe, Landeraum = Etappenende, Panels = Planung der Etappe. Abrufeinstellungen (METAR-/Beobachtungs-
 * Radius, DABS-Tag, NOTAM-Orte) lesen und schreiben im Planungsdatensatz. Null ohne Bahn oder unbekannte Etappe.
 */
export function stagePlanBriefing(b, stageId) {
  const wins = stageWindowsOf(b);
  const w = wins.find((x) => x.id === stageId); if (!w) return null;
  const D = b.profile.data, track = D.track;
  const kmMid = (w.km0 + w.km1) / 2, mid = posAtKm(track, kmMid) || w.from;
  const plan = stagePlanOf(b, stageId);
  const ccMid = countryAtKm(D.firs, kmMid, mid, b.site.country), ccEnd = countryAtKm(D.firs, w.km1, w.to, ccMid);
  const elevMid = D.relief?.length ? Math.round(reliefAt(D.relief, kmMid)) : (b.site.elev ?? 0);
  const elevEnd = D.relief?.length ? Math.round(reliefAt(D.relief, w.km1)) : (b.landing?.elev ?? elevMid);
  const altMinFt = Math.round((w.altMin ?? altAt(b.profile.points, kmMid) ?? elevMid) * M_TO_FT), altMaxFt = Math.max(altMinFt + 500, Math.round((w.altMax ?? elevMid) * M_TO_FT));
  const segPts = track.points.filter((q) => q.km >= w.km0 - 0.01 && q.km <= w.km1 + 0.01);
  const site = { ...b.site, lat: +mid.lat.toFixed(4), lon: +mid.lon.toFixed(4), elev: elevMid, country: ccMid, icao: icao(mid.lat, mid.lon), name: plan.midName || icao(mid.lat, mid.lon), address: '' };
  const landing = { name: plan.toName || icao(w.to.lat, w.to.lon), lat: +w.to.lat.toFixed(4), lon: +w.to.lon.toFixed(4), elev: elevEnd, country: ccEnd, icao: icao(w.to.lat, w.to.lon), address: '' };
  const durationMin = Math.max(10, Math.round((w.ms1 - w.ms0) / 60000));
  const stagePlan = {
    id: stageId, no: w.no, name: w.name || '', km0: w.km0, km1: w.km1, ms0: w.ms0, ms1: w.ms1, msMid: Math.round((w.ms0 + w.ms1) / 2), altMin: w.altMin, altMax: w.altMax,
    from: { ...w.from, name: plan.fromName || icao(w.from.lat, w.from.lon), country: countryAtKm(D.firs, w.km0, w.from, b.site.country) }, to: { ...landing }, mid: { ...mid, name: site.name, country: ccMid },
    track: { points: segPts }, traj: { tracks: [{ label: 'Profil', altFt: Math.round((w.altMax ?? elevMid) * M_TO_FT), altM: w.altMax, points: segPts.map((q) => ({ ms: q.ms, lat: q.lat, lon: q.lon })) }], landing: { lat: landing.lat, lon: landing.lon, name: landing.name } },
    lenKm: Math.round((w.km1 - w.km0) * 10) / 10,
  };
  const bs = { ...b, site, landing, time: { ...b.time, startMs: w.ms0 }, intent: { ...b.intent, durationMin, altMinFt, altMaxFt }, panels: plan.panels, stagePlan, traj: null };
  // Abrufeinstellungen je Etappe: im Planungsdatensatz halten (die abgeleitete Sicht wird nicht gespeichert)
  for (const k of ['dabsDay', 'metarKm', 'obsKm', 'notamMode', 'notamPlaces']) Object.defineProperty(bs, k, { get: () => plan[k], set: (v) => { plan[k] = v; }, enumerable: true, configurable: true });
  return bs;
}
/** Etappen-Briefings des Briefings (Etappen mit Planung ausser der ersten; die erste sind die Abschnitte B/C). */
/**
 * 0.12.7: Planung der Startetappe (Abschnitte B/C des Hauptbriefings) nur auf ihren Bereich, sobald weitere Etappen bestehen:
 * abgeleitete Sicht mit Zeitfenster, Höhenband und Bahnabschnitt der ersten Etappe (`stagePlan.start = true`); Startort, Landeraum,
 * Panels und Abrufeinstellungen bleiben die des Hauptbriefings (Schreibzugriffe gehen durch). Mit nur einer Etappe, ohne Profil
 * oder ohne Planung bei der Startetappe → das Briefing selbst (ganze Fahrt).
 */
export function startPlanBriefing(b) {
  if (!b || b.balloon?.type !== 'gas' || (b.profile?.stages || []).length < 2 || startPlanOff(b)) return b;
  const w = stageWindowsOf(b)[0]; if (!w || !(w.km1 > w.km0)) return b;
  const D = b.profile.data, track = D.track;
  const kmMid = (w.km0 + w.km1) / 2, mid = posAtKm(track, kmMid) || w.from;
  const elevMid = D.relief?.length ? Math.round(reliefAt(D.relief, kmMid)) : (b.site.elev ?? 0);
  const altMinFt = Math.round((w.altMin ?? altAt(b.profile.points, kmMid) ?? elevMid) * M_TO_FT), altMaxFt = Math.max(altMinFt + 500, Math.round((w.altMax ?? elevMid) * M_TO_FT));
  const segPts = track.points.filter((q) => q.km >= w.km0 - 0.01 && q.km <= w.km1 + 0.01);
  const durationMin = Math.max(10, Math.round((w.ms1 - w.ms0) / 60000));
  const toName = icao(w.to.lat, w.to.lon);
  const stagePlan = {
    start: true, id: w.id, no: 1, name: w.name || '', km0: w.km0, km1: w.km1, ms0: w.ms0, ms1: w.ms1, msMid: Math.round((w.ms0 + w.ms1) / 2), altMin: w.altMin, altMax: w.altMax,
    from: { ...w.from, name: b.site.name, country: b.site.country }, to: { ...w.to, name: toName, country: countryAtKm(D.firs, w.km1, w.to, b.site.country) }, mid: { ...mid, name: icao(mid.lat, mid.lon), country: countryAtKm(D.firs, kmMid, mid, b.site.country) },
    track: { points: segPts }, traj: { tracks: [{ label: 'Profil', altFt: Math.round((w.altMax ?? elevMid) * M_TO_FT), altM: w.altMax, points: segPts.map((q) => ({ ms: q.ms, lat: q.lat, lon: q.lon })) }], landing: { lat: w.to.lat, lon: w.to.lon, name: toName } },
    lenKm: Math.round((w.km1 - w.km0) * 10) / 10,
  };
  const bs = { ...b, intent: { ...b.intent, durationMin, altMinFt, altMaxFt }, stagePlan };
  for (const k of ['dabsDay', 'metarKm', 'obsKm', 'notamMode', 'notamPlaces', 'updated', 'state']) Object.defineProperty(bs, k, { get: () => b[k], set: (v) => { b[k] = v; }, enumerable: true, configurable: true });
  return bs;
}
/** Kennung des Bereichs der Startetappe (für Neuaufbau der Sicht): km/Zeit-Grenzen oder '' ohne Beschränkung. */
export const startPlanSig = (b) => { const v = startPlanBriefing(b); return v === b ? '' : `s:${Math.round(v.stagePlan.km1)}:${Math.round(v.stagePlan.ms1 / 600000)}`; };
export function stageSets(b) {
  if (!b || b.balloon?.type !== 'gas') return [];
  const stages = b.profile?.stages || [];
  return opsStages(stages).filter((x) => x.i > 0).map((x) => { const bs = stagePlanBriefing(b, x.s.id); return bs ? { sid: x.s.id, idx: x.i, no: x.i + 1, name: x.s.name || '', bs, plan: b.stagePlans[x.s.id] } : null; }).filter(Boolean);
}
/** Planung der Startetappe ausgeschaltet (dann fehlen die orts-/zeitgebundenen Panels in den Abschnitten B/C)? */
export const startPlanOff = (b) => b?.balloon?.type === 'gas' && (b.profile?.stages || []).length > 0 && !stageOps(b.profile.stages, 0);
/** Etappe seit dem letzten Abruf verschoben (> 2 km oder > 20 min)? `at` = Fenster beim Abruf. */
export function planStale(at, w) {
  if (!at || !w) return false;
  return Math.abs((at.km0 ?? 0) - w.km0) > 2 || Math.abs((at.km1 ?? 0) - w.km1) > 2 || Math.abs((at.ms0 ?? 0) - w.ms0) > 20 * 60000 || Math.abs((at.ms1 ?? 0) - w.ms1) > 20 * 60000;
}
/** Planungsdaten gelöschter Etappen entfernen. */
export function pruneStagePlans(b) {
  if (!b?.stagePlans) return;
  const ids = new Set((b.profile?.stages || []).map((s) => s.id));
  for (const k of Object.keys(b.stagePlans)) if (!ids.has(k)) delete b.stagePlans[k];
}
/** Entfernung der Etappenmitte vom Startort (km) – für Hinweise. */
export const midDistKm = (b, sp) => (sp?.mid && b?.site?.lat != null ? Math.round(distKm(b.site.lat, b.site.lon, sp.mid.lat, sp.mid.lon)) : null);
