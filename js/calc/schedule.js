/* Fahrtbriefing — Tagesplanung (regelbasiert).
 *
 * Rückwärts vom Start: Start − Aufrüst-/Füllzeit − Fahrzeit − Puffer = Abfahrt
 * am Treffpunkt. Vorwärts: Landung ≈ Start + Dauer. Gasballon-Vorlage mit
 * Füllbeginn/Füllende. Alle Zeilen sind in der App überschreibbar; hier wird
 * nur der Vorschlag gerechnet.
 */
import { addMin, floorToMin, roundToMin } from './time.js';

/**
 * in: { startMs, type:'hab'|'gas', rigMin, fillMin, bufferMin, durationMin, recoveryMin,
 *       stops: [{ id, name, driveMin (zur nächsten Etappe bzw. zum Startplatz), dwellMin }],
 *       overrides: { 'depart:<id>'|arrive|rig|fillStart|fillEnd|landing|return: ms } }
 *       (Altform: driveMin/meetingName ohne stops = eine Etappe)
 * out: [{ key, kind?, stopId?, name?, ms, overridden? }] — Etappen-Abfahrten, Ankunft Startplatz,
 *       Aufrüsten/Füllen, Start, Landung, Rückkehr. Pins gelten rückwärts: die Zeilen davor
 *       rechnen vom Pin aus, die danach vom Start.
 */
export function buildSchedule(i) {
  const rows = [];
  const prep = (i.type === 'gas' ? (i.fillMin || 0) : 0) + (i.rigMin || 0);
  const ov = i.overrides || {};
  // Ankunft Startplatz (Pin überschreibt die Rückrechnung vom Start)
  const arrive = ov.arrive != null ? ov.arrive : floorToMin(addMin(i.startMs, -prep), 5);
  // Etappen rückwärts: letzte Etappe fährt mit Puffer zum Startplatz, davor jede zur nächsten
  const stops = Array.isArray(i.stops) && i.stops.length ? i.stops : [{ id: 'm1', name: i.meetingName || '', driveMin: i.driveMin ?? 30 }];
  const departs = new Array(stops.length);
  let next = arrive;
  for (let k = stops.length - 1; k >= 0; k--) {
    const st = stops[k];
    const key = `depart:${st.id}`;
    const drive = (st.driveMin ?? 30) + (k === stops.length - 1 ? (i.bufferMin || 0) : 0);
    departs[k] = ov[key] != null ? ov[key] : floorToMin(addMin(next, -drive), 5);
    next = addMin(departs[k], -(st.dwellMin || 0));
  }
  stops.forEach((st, k) => rows.push({ key: `depart:${st.id}`, kind: 'depart', stopId: st.id, name: st.name || '', ms: departs[k], overridden: ov[`depart:${st.id}`] != null, drive: st.driveMin ?? null }));
  rows.push({ key: 'arrive', kind: 'arrive', ms: arrive, overridden: ov.arrive != null });
  if (i.type === 'gas') {
    rows.push({ key: 'rig', ms: arrive });
    const fillStart = addMin(arrive, i.rigMin || 0);
    rows.push({ key: 'fillStart', ms: fillStart });
    rows.push({ key: 'fillEnd', ms: addMin(fillStart, i.fillMin || 0) });
  } else {
    rows.push({ key: 'rig', ms: arrive });
  }
  rows.push({ key: 'start', ms: i.startMs });
  if (i.durationMin) {
    const land = roundToMin(addMin(i.startMs, i.durationMin), 5);
    rows.push({ key: 'landing', ms: land });
    const lastDrive = stops[stops.length - 1]?.driveMin ?? i.driveMin ?? 0;
    if (i.recoveryMin) rows.push({ key: 'return', ms: roundToMin(addMin(land, i.recoveryMin + lastDrive), 5) });
  }
  // übrige Pins (rig, fillStart, fillEnd, landing, return) anwenden
  for (const r of rows) if (!r.kind && r.key !== 'start' && ov[r.key] != null) { r.ms = ov[r.key]; r.overridden = true; }
  return rows;
}

// ---------------------------------------------------------------- Tabellarischer Zeitplan (0.9.1)
/** Aktivitäten: Typ → Standarddauer (min). Zeit einer Zeile = Beginn der Aktivität; die Dauer läuft bis zur nächsten Zeile. */
export const ACT_TYPES = ['meet', 'drive', 'arrive', 'rig', 'fill', 'buffer', 'briefing', 'start', 'flight', 'landing', 'recovery', 'return', 'meal', 'fuel', 'custom'];
export const ACT_DEFAULT_MIN = { meet: 10, drive: 30, arrive: 0, rig: 45, fill: 150, buffer: 15, briefing: 15, start: 0, flight: 120, landing: 0, recovery: 60, return: 30, meal: 45, fuel: 20, custom: 15 };
/** Typen mit Ortsbezug (true = frei wählbar; 'site'/'landing' = aus dem Briefing). */
export const ACT_PLACE = { meet: true, drive: true, arrive: 'site', landing: 'landing', return: true, meal: true, fuel: true, briefing: true, custom: true };

export const durationOf = (it, o = {}) => (it.type === 'flight' ? (it.min ?? o.flightMin ?? 0) : (it.min ?? ACT_DEFAULT_MIN[it.type] ?? 0));

/**
 * Zeiten des Zeitplans: Anker ist die Zeile «start» (= Startzeit des Briefings). Danach vorwärts
 * (Zeit = vorherige Zeit + deren Dauer), davor rückwärts (Zeit = nächste Zeit − eigene Dauer).
 * Pins (it.pin, ms) fixieren eine Zeile; die Nachbarn rechnen von dort weiter. Rundung auf 5 min.
 * in: items [{ id, type, name?, info?, min?, pin?, place?{name,lat,lon} }], o { startMs, flightMin }
 * out: [{ ...item, ms, overridden, dur }]
 */
export function buildPlan(items, o) {
  const rows = (items || []).map((it) => ({ ...it, ms: null, overridden: it.pin != null, dur: durationOf(it, o) }));
  if (!rows.length) return rows;
  let a = rows.findIndex((r) => r.type === 'start'); if (a < 0) a = 0;
  rows[a].ms = o.startMs; rows[a].overridden = false;
  for (let k = a + 1; k < rows.length; k++) rows[k].ms = rows[k].pin != null ? rows[k].pin : roundToMin(addMin(rows[k - 1].ms, rows[k - 1].dur), 5);
  for (let k = a - 1; k >= 0; k--) rows[k].ms = rows[k].pin != null ? rows[k].pin : floorToMin(addMin(rows[k + 1].ms, -rows[k].dur), 5);
  return rows;
}

/** Vorlage aus den bisherigen Feldern (Etappen, Aufrüst-/Füll-/Puffer-/Bergungszeit). */
export function planTemplate(i) {
  const items = [];
  const stops = Array.isArray(i.stops) && i.stops.length ? i.stops : [{ id: 'm1', name: i.meetingName || '', lat: i.meetingLat ?? null, lon: i.meetingLon ?? null, driveMin: i.driveMin ?? null }];
  stops.forEach((st, k) => {
    items.push({ id: `meet-${st.id || k}`, type: 'meet', name: st.name || '', info: '', min: st.dwellMin || ACT_DEFAULT_MIN.meet, place: st.lat != null ? { name: st.name || '', lat: st.lat, lon: st.lon } : null, meetingId: st.meetingId || '' });
    items.push({ id: `drive-${st.id || k}`, type: 'drive', name: '', info: '', min: st.driveMin ?? 30, km: st.driveKm ?? null, minSource: st.driveSource === 'routing' ? 'routing' : (st.driveMin != null ? 'manual' : ''), place: null });
  });
  if (i.bufferMin > 0) items.push({ id: 'buffer', type: 'buffer', name: '', info: '', min: i.bufferMin });
  items.push({ id: 'arrive', type: 'arrive', name: '', info: '', min: 0 });
  items.push({ id: 'rig', type: 'rig', name: '', info: '', min: i.rigMin ?? 45 });
  if (i.type === 'gas') items.push({ id: 'fill', type: 'fill', name: '', info: '', min: i.fillMin ?? 150 });
  items.push({ id: 'start', type: 'start', name: '', info: '', min: 0 });
  items.push({ id: 'flight', type: 'flight', name: '', info: '', min: null });
  items.push({ id: 'landing', type: 'landing', name: '', info: '', min: 0 });
  items.push({ id: 'recovery', type: 'recovery', name: '', info: '', min: i.recoveryMin ?? 60 });
  items.push({ id: 'return', type: 'return', name: '', info: '', min: stops[stops.length - 1]?.driveMin ?? 30 });
  return items;
}

/** Etappen (Altform) aus dem Zeitplan: Treffpunkte mit Ort, Fahrzeit = Dauer der folgenden Fahrt. */
export function planToStops(items) {
  const out = [];
  items.forEach((it, k) => {
    if (it.type !== 'meet') return;
    const drv = items.slice(k + 1).find((x) => x.type === 'drive' || x.type === 'meet' || x.type === 'arrive');
    out.push({ id: it.id, meetingId: it.meetingId || 'custom', name: it.name || it.place?.name || '', lat: it.place?.lat ?? null, lon: it.place?.lon ?? null, driveMin: drv?.type === 'drive' ? (drv.min ?? ACT_DEFAULT_MIN.drive) : null, driveKm: drv?.km ?? null, driveSource: drv?.minSource || '', dwellMin: it.min ?? 0 });
  });
  return out;
}

/** Fahrzeit mit Anhänger aus der Routing-Dauer (s): Faktor und Zuschlag. */
export function trailerMinutes(routeSeconds, factor = 1.15, surchargeMin = 5) {
  return Math.round(routeSeconds / 60 * factor + surchargeMin);
}

/** Hinweise: Start vor BCMT, Landung nach ECET, Rückfahrt nach SS. */
export function scheduleWarnings(rows, sun) {
  const w = [];
  const by = Object.fromEntries(rows.map((r) => [r.key || r.type, r.ms]));
  if (sun?.bcmt && by.start < sun.bcmt) w.push('nightStart');
  if (sun?.ecet && by.landing && by.landing > sun.ecet) w.push('nightLanding');
  if (sun?.ss && by.return && by.return > sun.ss) w.push('returnAfterSunset');
  return w;
}
