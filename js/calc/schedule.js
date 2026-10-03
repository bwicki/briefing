/* Fahrtbriefing — Tagesplanung (regelbasiert).
 *
 * Rückwärts vom Start: Start − Aufrüst-/Füllzeit − Fahrzeit − Puffer = Abfahrt
 * am Treffpunkt. Vorwärts: Landung ≈ Start + Dauer. Gasballon-Vorlage mit
 * Füllbeginn/Füllende. Alle Zeilen sind in der App überschreibbar; hier wird
 * nur der Vorschlag gerechnet.
 */
import { addMin, floorToMin, roundToMin } from './time.js';

/**
 * in: { startMs, type:'hab'|'gas', rigMin, fillMin, driveMin, bufferMin, durationMin,
 *       recoveryMin, meetingName, siteName }
 * out: [{ key, ms, label(de/en via key), editable:true }]
 */
export function buildSchedule(i) {
  const rows = [];
  const prep = (i.type === 'gas' ? (i.fillMin || 0) : 0) + (i.rigMin || 0);
  const arrive = floorToMin(addMin(i.startMs, -prep), 5);
  const depart = floorToMin(addMin(arrive, -((i.driveMin || 0) + (i.bufferMin || 0))), 5);
  rows.push({ key: 'depart', ms: depart });
  rows.push({ key: 'arrive', ms: arrive });
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
    if (i.recoveryMin) rows.push({ key: 'return', ms: roundToMin(addMin(land, i.recoveryMin + (i.driveMin || 0)), 5) });
  }
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
