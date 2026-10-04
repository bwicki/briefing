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

/** Fahrzeit mit Anhänger aus der Routing-Dauer (s): Faktor und Zuschlag. */
export function trailerMinutes(routeSeconds, factor = 1.15, surchargeMin = 5) {
  return Math.round(routeSeconds / 60 * factor + surchargeMin);
}

/** Hinweise: Start vor BCMT, Landung nach ECET, Rückfahrt nach SS. */
export function scheduleWarnings(rows, sun) {
  const w = [];
  const by = Object.fromEntries(rows.map((r) => [r.key, r.ms]));
  if (sun?.bcmt && by.start < sun.bcmt) w.push('nightStart');
  if (sun?.ecet && by.landing && by.landing > sun.ecet) w.push('nightLanding');
  if (sun?.ss && by.return && by.return > sun.ss) w.push('returnAfterSunset');
  return w;
}
