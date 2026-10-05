/* Tests der Rechenmodule gegen die Excel-Vorlagen und die RAC-4-4-Tabelle.
 * Aufruf: node test/calc.test.mjs
 */
import { hotAir, gasBalloon, reserveMinutes, CYLINDER_CATALOG } from '../js/calc/aero.js';
import { sunTimes, moonTimes, moonIllumination, moonPhaseName } from '../js/calc/sun.js';
import { parseRacText, racLookup } from '../js/calc/rac.js';
import { fromLocal, hhmm, localParts, tzOffsetMin, isoDate } from '../js/calc/time.js';
import { icao, parseIcao, distKm } from '../js/calc/geo.js';
import { touchesCH, panelNo, visiblePanels } from '../js/panels.js';
import { targetEstimate } from '../js/auto/traj.js';
import { buildFpl, fplMessage, fplXml, fplCheck, firCode, fplName, fplPerson, fplPhone, fplLevel, driftWords, eetFromFirs } from '../js/calc/fpl.js';
import { buildSchedule, trailerMinutes, buildPlan, planTemplate, planToStops, scheduleWarnings, planOrderWarnings, ACT_DEFAULT_MIN } from '../js/calc/schedule.js';
import { readFileSync } from 'node:fs';
import * as OM from '../js/auto/openmeteo.js';
import { parseLevel, tracks, levelAltM } from '../js/auto/traj.js';
import { vfrRelevant } from '../js/auto/data.js';
import { normalizeAirspace, analyzeAirspaces, limitFt, limitText, inAirspace, distToAirspaceKm, requirementKey, siteWarnings, isPlainEG } from '../js/calc/airspace.js';
import { goNoGo } from '../js/calc/gonogo.js';
import { changesSinceFinal } from '../js/calc/diff.js';
import { resolveBalloon, mergeSettings } from '../js/defaults.js';
import { balloonImage } from '../js/model.js';

let fails = 0, n = 0;
const ok = (cond, msg) => { n++; if (!cond) { fails++; console.log('  FAIL', msg); } else console.log('  ok  ', msg); };
const near = (a, b, tol, msg) => ok(Math.abs(a - b) <= tol, `${msg}: ${a} vs ${b} (±${tol})`);

console.log('Heissluft HB-QWP (Excel: Startgewicht 765, Minder −118, Max. Steighöhe 5700)');
const va70 = CYLINDER_CATALOG.find((c) => c.id === 'va70');
const qwp = hotAir({
  volume: 3400, siteAlt: 1085, tempC: 8, qnh: 1024, envTempC: 100,
  masses: { envelope: 139, burner: 26, basket: 68, equipment: 20 },
  persons: 4, personWeight: 80, cylinders: [{ ...va70, count: 4 }], mtom: 883,
  usableFraction: 0.9, burnRate: 25, durationMin: 120, reserve: { pct: 25, capMin: 30 },
});
near(qwp.takeoff, 765, 0.5, 'Startgewicht');
near(qwp.massDeltaMtom, -118, 0.5, 'Minder-/Mehrgewicht (MTOM)');
ok(qwp.allowed <= qwp.mtom && qwp.massDelta === qwp.takeoff - qwp.allowed && ['lift', 'mtom'].includes(qwp.limitBy), 'zulässig = min(Tragkraft, MTOM)');
near(qwp.required, 0.225, 0.001, 'nötige Tragkraft/m³');
ok(qwp.maxAltExcel === 5700, `Max. Steighöhe Excel-Regel = ${qwp.maxAltExcel}`);
near(qwp.usable, 108, 0.01, 'Gasvorrat ausfliegbar');
near(qwp.enduranceMin, 4.32 * 60, 0.1, 'Fahrdauer ohne Reserve (min)');
near(qwp.enduranceExcelReserve, 3.24 * 60, 0.1, 'Fahrdauer mit 25 % Reserve (min)');
near(qwp.reserveMin, 30, 0.01, 'Reserve 2 h → 30 min (gedeckelt)');
near(qwp.needKg, 62.5, 0.01, 'Bedarf 2.5 h × 25 kg/h');
// Tabellenwerte der Excel-Zeilen h=5600 (D=0.2266987, F=+5.775) und h=5700 (D=0.2254201, F=+1.428)
const r5600 = qwp.rows.find((r) => r.h === 5600), r5700 = qwp.rows.find((r) => r.h === 5700);
near(r5600.liftM3, 0.2266986548962544, 1e-9, 'Tragkraft/m³ bei 5600 m');
near(r5600.climb, 5.7754266472650215, 1e-6, 'Steigkraft bei 5600 m');
near(r5700.liftM3, 0.22542011488901836, 1e-9, 'Tragkraft/m³ bei 5700 m');
near(r5700.climb, 1.4283906226623913, 1e-6, 'Steigkraft bei 5700 m');

console.log('Heissluft HB-QWZ (Excel: Startgewicht 568, Minder −162, Max. Steighöhe 5400, 110 °C, 85 kg)');
const wo = CYLINDER_CATALOG.find((c) => c.id === 'wo_s');
const qwz = hotAir({
  volume: 2600, siteAlt: 475, tempC: 22, qnh: 1017, envTempC: 110,
  masses: { envelope: 103, burner: 14, basket: 49, equipment: 15 },
  persons: 3, personWeight: 85, cylinders: [{ ...wo, count: 4 }], mtom: 730,
  usableFraction: 1.0, burnRate: 25, durationMin: 90, reserve: { pct: 25, capMin: 30 },
});
near(qwz.takeoff, 568, 0.5, 'Startgewicht');
near(qwz.massDeltaMtom, -162, 0.5, 'Minder-/Mehrgewicht (MTOM)');
ok(qwz.maxAltExcel === 5400, `Max. Steighöhe Excel-Regel = ${qwz.maxAltExcel}`);
near(qwz.usable, 80, 0.01, 'Gasvorrat ausfliegbar 100 %');
near(qwz.reserveMin, 22.5, 0.01, 'Reserve 1.5 h → 22.5 min');
ok(qwz.envReq > 60 && qwz.envReq < 110, `benötigte Hüllentemperatur ${qwz.envReq.toFixed(1)} °C plausibel`);

console.log('Heissluft Muster 11.07.2026 HB-QWZ (PDF: 540 m, 24 °C, 1016 hPa, 100 °C, 90 kg, Startgewicht 583, −147, 1800 m)');
const qwzPdf = hotAir({
  volume: 2600, siteAlt: 540, tempC: 24, qnh: 1016, envTempC: 100,
  masses: { envelope: 103, burner: 14, basket: 49, equipment: 15 },
  persons: 3, personWeight: 90, cylinders: [{ ...wo, count: 4 }], mtom: 730, usableFraction: 1.0, burnRate: 25,
});
near(qwzPdf.takeoff, 583, 0.5, 'Startgewicht');
near(qwzPdf.massDeltaMtom, -147, 0.5, 'Minder-/Mehrgewicht (MTOM)');
ok(qwzPdf.maxAltExcel === 1800, `Max. Steighöhe = ${qwzPdf.maxAltExcel}`);

console.log('Gasballon HB-QPJ (Excel v2: ρ 1.21398, Auftrieb 1274.68, Ballast 804.32)');
const gbx = gasBalloon({
  volume: 1050, tempC: 20, qnh: 1026, rh: 50, siteAlt: 47, excelMode: true,
  masses: { envelope: 116, basket: 50, equipment: 40 }, persons: 2, personWeight: 85,
});
near(gbx.rhoAir, 1.2139802549196117, 1e-9, 'Luftdichte Excel-Modus');
near(gbx.ballast, 804.3157676655923, 1e-6, 'Ballast Excel-Modus');
const gb = gasBalloon({
  volume: 1050, tempC: 15, qnh: 1013, rh: 50, siteAlt: 0, gas: 'H2', purity: 0.995,
  masses: { envelope: 116, basket: 50, equipment: 40 }, persons: 2, personWeight: 85, ballastUnitKg: 15, reserveUnits: 3,
});
near(gb.rhoAir, 1.221, 0.003, 'Luftdichte feucht 15 °C');
near(gb.grossLift, 1187, 3, 'Brutto-Auftrieb Beispiel Konzept');
near(gb.coolingLossPerK, 4.1, 0.2, 'Abkühlung kg/K');
ok(gb.ballastPer100m > 12 && gb.ballastPer100m < 15, `Ballast je 100 m ${gb.ballastPer100m.toFixed(1)} kg`);

console.log('Reserve-Regel');
near(reserveMinutes(90, { pct: 25, capMin: 30 }), 22.5, 0.01, '1.5 h');
near(reserveMinutes(180, { pct: 25, capMin: 30 }), 30, 0.01, '3 h gedeckelt');
near(reserveMinutes(60, { pct: 25, capMin: 30, minMin: 20 }), 20, 0.01, 'Minimum');

console.log('RAC 4-4 Parser gegen Referenz-JSON');
const ref = JSON.parse(readFileSync(new URL('../data/rac/rac-ch.json', import.meta.url), 'utf8'));
const txt = ['VFR Manual', '2026 FIR SWITZERLAND (LT)', 'OCT NOV DEC', 'Day', '1 2 3 4 1 2 3 4 1 2 3 4',
  '1 0658 0729 1910 1940 0641 0713 1714 1746 0720 0755 1643 1718',
  '31 0639 0710 1716 1748 0741 0816 1652 1727',
  '2027 FIR SWITZERLAND (LT)', 'JAN FEB MAR',
  '28 0727 0800 1727 1800 0642 0713 1814 1844 0648 0718 1954 2024',
  '29 0726 0759 1728 1801 0646 0716 1955 2026'].join('\n');
const t = parseRacText(txt, 'test');
ok(t.days['2026-10-01'].bcmt === '0658', 'Oktober 1');
ok(t.days['2026-12-31'].ecet === '1727' && !t.days['2026-11-31'], '31. Dezember, kein 31. November');
ok(t.days['2027-02-28'].sr === '0713' && t.days['2027-03-29'].ss === '1955' && !t.days['2027-02-29'], 'Februar/März Ende');
ok(t.problems.length === 0, 'keine Parser-Probleme');
ok(racLookup(ref, '2026-10-03').bcmt === '0701' && racLookup(ref, '2027-06-21').ss === '2129', 'Referenz-Lookup');
ok(Object.keys(ref.days).length === 457, 'Referenz 457 Tage');

console.log('Sonne astronomisch Bern vs. RAC (Toleranz 2 min)');
const tz = 'Europe/Zurich';
function cmp(dateStr) {
  const noon = fromLocal(tz, dateStr, '12:00');
  const s = sunTimes(46.95, 7.433, noon);
  const r = racLookup(ref, dateStr);
  const toMin = (ms) => { const p = localParts(tz, ms); return p.hh * 60 + p.mm; };
  const rm = (t) => +t.slice(0, 2) * 60 + +t.slice(2);
  near(toMin(s.dawn), rm(r.bcmt), 2, `${dateStr} BCMT`);
  near(toMin(s.sunrise), rm(r.sr), 2, `${dateStr} SR`);
  near(toMin(s.sunset), rm(r.ss), 2, `${dateStr} SS`);
  near(toMin(s.dusk), rm(r.ecet), 2, `${dateStr} ECET`);
}
cmp('2026-10-03'); cmp('2026-12-21'); cmp('2027-03-28'); cmp('2027-06-21'); cmp('2027-10-25');

console.log('Mond');
const full = fromLocal(tz, '2026-10-26', '12:00'); // Vollmond 26.10.2026 (≈ 04:12 UTC)
const ill = moonIllumination(full);
ok(ill.fraction > 0.97, `Vollmond 26.10.2026 beleuchtet ${(ill.fraction * 100).toFixed(0)} %`);
const mt = moonTimes(47.3, 8.4, fromLocal(tz, '2026-10-10', '00:00'));
ok(mt.rise != null || mt.set != null, `Mondzeiten 10.10.2026: rise ${mt.rise ? hhmm(tz, mt.rise) : '–'} set ${mt.set ? hhmm(tz, mt.set) : '–'}`);
ok(typeof moonPhaseName(ill.phase) === 'string', 'Phasenname');

console.log('Zeit / Zeitzone');
ok(tzOffsetMin(tz, Date.UTC(2026, 6, 1)) === 120 && tzOffsetMin(tz, Date.UTC(2026, 0, 1)) === 60, 'Sommer-/Winterzeit');
ok(hhmm(tz, fromLocal(tz, '2026-10-25', '02:30')) === '02:30', 'Rückkonversion am Umstelltag');
ok(isoDate(tz, fromLocal(tz, '2026-10-10', '00:10')) === '2026-10-10', 'isoDate nach Mitternacht lokal');

console.log('Geo');
ok(icao(47.3167, 8.3917) === '4719N00824E', `ICAO ${icao(47.3167, 8.3917)}`);
ok(icao(51.5713, 6.9827) === '5134N00659E', `ICAO Gladbeck ${icao(51.5713, 6.9827)}`);
const p = parseIcao('4719N00824E'); near(p.lat, 47.3167, 0.01, 'parseIcao lat'); near(p.lon, 8.4, 0.01, 'parseIcao lon');
near(distKm(47.4, 8.5, 47.3167, 8.3917), 12, 2, 'Distanz Katzenrüti–Oberlunkhofen grob');

console.log('Tagesplanung');
const start = fromLocal(tz, '2026-10-10', '06:30');
const rows = buildSchedule({ startMs: start, type: 'hab', rigMin: 45, driveMin: trailerMinutes(24 * 60), bufferMin: 0, durationMin: 120 });
const by = Object.fromEntries(rows.map((r) => [r.key, hhmm(tz, r.ms)]));
ok(by.start === '06:30' && by.arrive === '05:45' && by['depart:m1'] === '05:10' && by.landing === '08:30', JSON.stringify(by));
const gasRows = buildSchedule({ startMs: start, type: 'gas', rigMin: 30, fillMin: 150, driveMin: 30, bufferMin: 10, durationMin: 24 * 60 });
const gby = Object.fromEntries(gasRows.map((r) => [r.key, hhmm(tz, r.ms)]));
ok(gby.arrive === '03:30' && gby.fillStart === '04:00' && gby.fillEnd === '06:30' && gby['depart:m1'] === '02:50', JSON.stringify(gby));
// mehrere Etappen + Pins: Ankunft gepinnt → Etappen rückwärts; Abfahrt der mittleren Etappe gepinnt → erste rechnet davon
const multi = buildSchedule({ startMs: start, type: 'hab', rigMin: 45, bufferMin: 0, durationMin: 120, stops: [{ id: 'a', name: 'A', driveMin: 20 }, { id: 'b', name: 'B', driveMin: 30 }], overrides: { arrive: fromLocal(tz, '2026-10-10', '06:00') } });
const mby = Object.fromEntries(multi.map((r) => [r.key, hhmm(tz, r.ms)]));
ok(mby.arrive === '06:00' && mby['depart:b'] === '05:30' && mby['depart:a'] === '05:10', JSON.stringify(mby));
const multi2 = buildSchedule({ startMs: start, type: 'hab', rigMin: 45, bufferMin: 0, durationMin: 120, stops: [{ id: 'a', name: 'A', driveMin: 20 }, { id: 'b', name: 'B', driveMin: 30 }], overrides: { 'depart:b': fromLocal(tz, '2026-10-10', '05:00') } });
const m2 = Object.fromEntries(multi2.map((r) => [r.key, hhmm(tz, r.ms)]));
ok(m2.arrive === '05:45' && m2['depart:b'] === '05:00' && m2['depart:a'] === '04:40', JSON.stringify(m2));


console.log('Trajektorien / Open-Meteo-Helfer');
ok(parseLevel('SFC').kind === 'sfc' && parseLevel('1000 AGL').ft === 1000 && parseLevel('FL065').ft === 6500 && parseLevel('3000').kind === 'amsl' && parseLevel('500 m AGL').ft === 1640, 'Niveau-Schreibweisen');
near(levelAltM(parseLevel('1000 AGL'), 461), 461 + 304.8, 0.1, 'Niveau AGL → m AMSL');
// synthetisches Modell: Wind überall 270°/10 m/s (aus West), 6 Stunden ab T0
const T0 = Date.UTC(2026, 9, 5, 4, 0);
const hours = Array.from({ length: 7 }, (_, i) => T0 / 1000 + i * 3600);
const H = { time: hours };
const fill = (k, v) => { H[k] = hours.map(() => v); };
fill('wind_speed_10m', 10); fill('wind_direction_10m', 270); fill('wind_speed_80m', 10); fill('wind_direction_80m', 270); fill('wind_speed_180m', 10); fill('wind_direction_180m', 270);
for (const p of [1000, 975, 950, 925, 900, 850, 800, 700, 600, 500]) { fill(`wind_speed_${p}hPa`, 10); fill(`wind_direction_${p}hPa`, 270); fill(`temperature_${p}hPa`, 10); fill(`geopotential_height_${p}hPa`, OM.stdHeight(p)); fill(`relative_humidity_${p}hPa`, 50); }
const J = { hourly: H, elevation: 461, _levels: [1000, 975, 950, 925, 900, 850, 800, 700, 600, 500] };
ok(OM.indexAt(J, T0 + 1800000) === 0 || OM.indexAt(J, T0 + 1800000) === 1, 'indexAt rundet auf die nächste Stunde');
const prof = OM.profile(J, 0, 461);
ok(prof.length >= 8 && prof[0].m > prof[prof.length - 1].m, 'Profil von oben nach unten');
const w = OM.windAt(prof, 1500);
near(w.u, 10, 0.01, 'windAt: u = +10 m/s (Wind aus West → Drift nach Ost)'); near(w.v, 0, 0.01, 'windAt: v = 0');
const trs = tracks(J, { lat: 47.3167, lon: 8.3917, elev: 461, startMs: T0, durationMin: 60, levels: ['SFC', '3000', 'FL065'], stepMin: 10 });
ok(trs.length === 3 && trs.every((x) => x.ok), 'drei Bahnen, vollständig');
near(trs[1].end.km, 36, 0.3, 'nach 60 min bei 10 m/s: 36 km');
near(trs[1].end.brg, 90, 1, 'Kurs 090° (nach Osten)');
ok(trs[1].hourly.length === 1 && /^47\d\dN008\d\dE$/.test(trs[1].end.icao), 'Stundenmarke und ICAO-Endpunkt');
const rec = { temp: 10, dew: 9.8, rh: 98, w10: 1, gust: 2, precip: 0, cape: 50, vis: 800, cloudLow: 10 };
ok(OM.fogRisk(rec).level === 3, 'Nebelrisiko hoch bei Sicht < 1 km');
ok(OM.flyRating(rec, true).level === 0, 'Ampel nein bei Sicht 0.8 km');
ok(OM.flyRating({ temp: 15, dew: 5, w10: 5, gust: 7, precip: 0, cape: 100 }, true).level === 1, 'Ampel grenzwertig bei 5 m/s / Böen 7');
ok(OM.flyRating({ temp: 15, dew: 5, w10: 2, gust: 3, precip: 0, cape: 100 }, true).level === 2, 'Ampel fahrbar');
ok(OM.flyRating({ temp: 15, dew: 5, w10: 2, gust: 3, precip: 0, cape: 100 }, false).level === 0, 'Ampel nein ausserhalb der Dämmerung');
ok(OM.suggestModel(10) === 'icon_d2' && OM.suggestModel(100) === 'icon_eu' && OM.suggestModel(200) === 'gfs_global', 'Modellvorschlag je Horizont');
const fromMs = T0, toMs = T0 + 7200000;
ok(vfrRelevant({ text: 'TEMPO RESTRICTED AREA ACT SFC-FL100', start: '2026-10-04T00:00:00Z', end: '2026-10-06T00:00:00Z', minFL: 0 }, 8000, fromMs, toMs).relevant, 'NOTAM Sperrgebiet relevant');
ok(!vfrRelevant({ text: 'ILS RWY 14 U/S', start: '2026-10-04T00:00:00Z', end: '2026-10-06T00:00:00Z' }, 8000, fromMs, toMs).relevant, 'NOTAM ILS nicht VFR-relevant');
ok(!vfrRelevant({ text: 'AIRSPACE RESTRICTION', start: '2026-10-04T00:00:00Z', end: '2026-10-06T00:00:00Z', minFL: 150 }, 8000, fromMs, toMs).relevant, 'NOTAM über FL150 nicht relevant');
ok(!vfrRelevant({ text: 'AIRSPACE RESTRICTION', start: '2026-10-09T00:00:00Z', end: '2026-10-10T00:00:00Z' }, 8000, fromMs, toMs).relevant, 'NOTAM erst später');


console.log('Go/No-Go und Änderungen seit Final');
const S3 = { goNoGo: { dryWindowH: 3, noTsH: 3, meanWindKt: 10, gustKt: 12 }, flyLimits: { cape: [300, 800] } };
const mkRec = (i, o = {}) => ({ ms: T0 + i * 3600000, fly: 2, precip: 0, cape: 20, w10: 2, gust: 3, why: [], ...o });
const B3 = { time: { startMs: T0, date: '2026-10-05', time: '06:00' }, intent: { durationMin: 120 }, panels: { 'B.meteogram': { content: { auto: { stand: 1, modelName: 'ICON-D2', data: { recs: Array.from({ length: 12 }, (_, i) => mkRec(i - 4)) } } } } }, versions: [] };
ok(goNoGo(B3, S3).level === 2, 'fahrbar bei ruhigen Stunden');
B3.panels['B.meteogram'].content.auto.data.recs[5] = mkRec(1, { fly: 1, w10: 5, gust: 7, why: ['Bodenwind 10 kt'] });
const g1 = goNoGo(B3, S3); ok(g1.level === 1 && g1.reasons[0].includes('Bodenwind'), 'grenzwertig übernimmt Stundenampel + Grund');
B3.panels['B.meteogram'].content.auto.data.recs[7] = mkRec(3, { precip: 0.6 });
ok(goNoGo(B3, S3).level === 0, 'Regen 1 h nach Landung → nein (Trockenfenster)');
B3.panels['B.meteogram'].content.auto.data.recs[7] = mkRec(3, { cape: 900 });
ok(goNoGo(B3, S3).level === 0 && goNoGo(B3, S3).reasons.some((r) => r.includes('CAPE')), 'CAPE 900 innert 3 h → nein');
ok(goNoGo({ time: { startMs: T0 }, intent: {}, panels: {} }, S3).level === null, 'ohne Meteogramm: keine Aussage');
const snap = JSON.parse(JSON.stringify({ ...B3, panels: { 'A.landing': { content: { text: 'Wohlen' }, extra: { text: '' } } }, persons: { pax: [{ name: 'A' }] }, schedule: { meetingName: 'Katzenrüti' } }));
const B4 = { ...JSON.parse(JSON.stringify(snap)), versions: [{ no: 1, ts: 1, who: 'x', snapshot: snap }] };
ok(changesSinceFinal(B4).any === false, 'keine Änderungen direkt nach Freigabe');
B4.panels['A.landing'].content.text = 'Bremgarten'; B4.persons.pax.push({ name: 'B' });
const ch = changesSinceFinal(B4);
ok(ch.any && ch.fields.includes('persons') && ch.panels.some((p) => p.key === 'A.landing' && p.what.includes('content')), 'Pax und Landeort als geändert erkannt');
ok(changesSinceFinal({ versions: [] }) === null, 'ohne Final: null');
console.log('Luftraumanalyse');
const ft0 = () => ({ value: 0, unit: 1, referenceDatum: 0 });
const sq = (lat0, lon0, lat1, lon1) => ({ type: 'Polygon', coordinates: [[[lon0, lat0], [lon1, lat0], [lon1, lat1], [lon0, lat1], [lon0, lat0]]] });
const ctr = normalizeAirspace({ _id: 'c1', name: 'ZURICH CTR', type: 4, icaoClass: 3, country: 'CH', lowerLimit: { value: 0, unit: 1, referenceDatum: 0 }, upperLimit: { value: 4500, unit: 1, referenceDatum: 1 }, geometry: sq(47.40, 8.40, 47.55, 8.65) }, 430);
ok(ctr.typeKey === 'CTR' && ctr.cls === 'D' && ctr.lowerTxt === 'GND' && ctr.upperTxt === '4500 ft' && ctr.lowerFt === Math.round(430 * 3.28084), 'CTR normalisiert (GND = Platzhöhe)');
ok(limitFt({ value: 95, unit: 6, referenceDatum: 2 }) === 9500 && limitText({ value: 95, unit: 6, referenceDatum: 2 }) === 'FL 095' && limitText({ value: 1000, unit: 0, referenceDatum: 0 }) === '3281 ft AGL', 'Höhenangaben FL/m/AGL');
ok(inAirspace(47.45, 8.5, ctr) && !inAirspace(47.30, 8.5, ctr), 'Punkt in Polygon');
const dHole = normalizeAirspace({ name: 'H', type: 2, geometry: { type: 'Polygon', coordinates: [[[8.0, 47.0], [8.4, 47.0], [8.4, 47.3], [8.0, 47.3], [8.0, 47.0]], [[8.1, 47.1], [8.3, 47.1], [8.3, 47.2], [8.1, 47.2], [8.1, 47.1]]] }, lowerLimit: { value: 0, unit: 1, referenceDatum: 0 }, upperLimit: { value: 100, unit: 6, referenceDatum: 2 } });
ok(inAirspace(47.05, 8.05, dHole) && !inAirspace(47.15, 8.2, dHole), 'Loch im Polygon');
ok(Math.abs(distToAirspaceKm(47.30, 8.5, ctr) - 11.1) < 0.5 && distToAirspaceKm(47.45, 8.5, ctr) === 0, 'Distanz zum Rand ≈ 11 km');
const tma = normalizeAirspace({ _id: 't1', name: 'ZURICH TMA 3', type: 7, icaoClass: 2, lowerLimit: { value: 5500, unit: 1, referenceDatum: 1 }, upperLimit: { value: 195, unit: 6, referenceDatum: 2 }, geometry: sq(47.2, 8.2, 47.7, 8.9) });
const fir1 = normalizeAirspace({ name: 'SWITZERLAND FIR', type: 10, country: 'CH', lowerLimit: { value: 0, unit: 1, referenceDatum: 0 }, upperLimit: { value: 195, unit: 6, referenceDatum: 2 }, geometry: sq(45.8, 5.9, 47.5, 10.5) });
const fir2 = normalizeAirspace({ name: 'LANGEN FIR', type: 10, country: 'DE', lowerLimit: { value: 0, unit: 1, referenceDatum: 0 }, upperLimit: { value: 245, unit: 6, referenceDatum: 2 }, geometry: sq(47.5, 7.0, 50.0, 10.5) });
const dang = normalizeAirspace({ name: 'LS-D16', type: 2, lowerLimit: { value: 0, unit: 1, referenceDatum: 0 }, upperLimit: { value: 150, unit: 6, referenceDatum: 2 }, geometry: sq(47.30, 8.30, 47.36, 8.36) });
const uir = normalizeAirspace({ name: 'SWITZERLAND UIR', type: 11, lowerLimit: { value: 195, unit: 6, referenceDatum: 2 }, upperLimit: { value: 660, unit: 6, referenceDatum: 2 }, geometry: sq(45.8, 5.9, 48.5, 10.5) });
// Bahn von 47.30/8.50 nach Norden bis 47.60 (≈ 33 km), 10-min-Punkte
const trk = { label: 'SFC', altFt: 1500, points: Array.from({ length: 12 }, (_, i) => ({ ms: T0 + i * 600000, lat: 47.30 + i * 0.0273, lon: 8.50 })) };
const an = analyzeAirspaces([trk], [ctr, tma, fir1, fir2, dang, uir], { altMinFt: 1500, altMaxFt: 4000, corridorKm: 5 });
ok(an.crossed.length === 1 && an.crossed[0].as.name === 'ZURICH CTR' && an.crossed[0].req === 'ctr', 'CTR wird durchfahren');
ok(Math.abs(an.crossed[0].firstKm - 12.1) < 1.5 && an.crossed[0].hits[0].label === 'SFC', 'Einfahrt CTR nach ≈ 12 km');
ok(an.above.length === 1 && an.above[0].as.name === 'ZURICH TMA 3', 'TMA über Maximalhöhe → darüber');
ok(an.near.length === 0 && !JSON.stringify(an).includes('UIR'), 'Gefahrengebiet > 5 km und UIR nicht gelistet');
ok(an.firs.length === 1 && an.firs[0].seq.map((x) => x.name).join('>') === 'SWITZERLAND FIR>LANGEN FIR' && an.firs[0].seq[1].fromKm > 20, 'FIR-Folge CH → DE mit km');
const an2 = analyzeAirspaces([trk], [dang], { altMaxFt: 4000, corridorKm: 15 });
ok(an2.near.length === 1 && an2.near[0].minDistKm > 10 && an2.near[0].minDistKm < 12, 'Gefahrengebiet im 15-km-Korridor als «nahe»');
const clsE = normalizeAirspace({ name: 'E-SEKTOR', type: 0, icaoClass: 4, lowerLimit: ft0(), upperLimit: { value: 100, unit: 6, referenceDatum: 2 }, geometry: sq(47.2, 8.2, 47.7, 8.9) });
const tmzG = normalizeAirspace({ name: 'TMZ TEST', type: 5, icaoClass: 6, lowerLimit: ft0(), upperLimit: { value: 5000, unit: 1, referenceDatum: 1 }, geometry: sq(47.2, 8.2, 47.7, 8.9) });
const an3 = analyzeAirspaces([trk], [clsE, tmzG], { altMaxFt: 4000, corridorKm: 5 });
ok(isPlainEG(clsE) && !isPlainEG(tmzG) && an3.crossed.length === 1 && an3.crossed[0].as.name === 'TMZ TEST', 'Klasse E nicht gelistet, TMZ in Klasse G schon');
const sw = siteWarnings({ lat: 47.45, lon: 8.5, elevFt: 1400 }, [ctr, tma, clsE], 900);
ok(sw.some((w) => w.kind === 'ctr' && w.as.name === 'ZURICH CTR'), 'Startort in CTR → Warnung');
ok(!sw.some((w) => w.kind === 'tma'), 'TMA 5500 ft bei Platz 1400 ft (4100 ft darüber) → keine Warnung');
const sw2 = siteWarnings({ lat: 47.45, lon: 8.5, elevFt: 4800 }, [tma], 900);
ok(sw2.length === 1 && sw2[0].kind === 'tma' && sw2[0].aglFt === 700, 'TMA nur 700 ft über Platz → Warnung');
ok(requirementKey({ typeKey: 'TMA', cls: 'E' }) === 'classE' && requirementKey({ typeKey: 'OTHER', cls: 'C' }) === 'clearance' && requirementKey({ typeKey: 'P' }) === 'prohibited' && requirementKey({ typeKey: 'TRA' }) === 'activation', 'Hinweis-Schlüssel je Typ/Klasse');

// ---- Tabellarischer Zeitplan (0.9.1): Anker «Start», vorwärts/rückwärts, Pins, Vorlage, Etappen-Rückführung
{
  const startMs = Date.UTC(2026, 9, 10, 4, 0);   // 06:00 LT (CEST)
  const tpl = planTemplate({ type: 'hab', stops: [{ id: 'm1', name: 'Katzenrüti', lat: 47.4, lon: 8.5, driveMin: 25, driveSource: 'routing', driveKm: 18 }, { id: 'm2', name: 'Buchs', lat: 47.3, lon: 8.3, driveMin: 10 }], rigMin: 45, bufferMin: 15, recoveryMin: 60 });
  ok(tpl.map((x) => x.type).join(',') === 'meet,drive,meet,drive,buffer,arrive,rig,start,flight,landing,recovery,return', 'Vorlage HAB: Treffpunkte, Fahrten, Reserve, Ankunft, Aufrüsten, Start, Fahrt, Landung, Bergung, Rückfahrt');
  ok(planTemplate({ type: 'gas', stops: [], fillMin: 150 }).some((x) => x.type === 'fill'), 'Vorlage Gas enthält Füllen');
  const rows = buildPlan(tpl, { startMs, flightMin: 90 });
  const by = Object.fromEntries(rows.map((r) => [r.type + (r.type === 'meet' ? ':' + r.id : ''), r]));
  ok(by.start.ms === startMs && by.flight.ms === startMs && by.flight.dur === 90, 'Start ist Anker, Fahrtdauer aus der Absicht');
  ok(by.landing.ms === startMs + 90 * 60000 && by.recovery.ms === by.landing.ms && by.return.ms === by.landing.ms + 60 * 60000, 'vorwärts: Landung = Start + Fahrt, Rückfahrt = Landung + Bergung');
  ok(by.rig.ms === startMs - 45 * 60000 && by.arrive.ms === by.rig.ms && by.buffer.ms === by.arrive.ms - 15 * 60000, 'rückwärts: Aufrüsten = Start − 45, Reserve davor');
  ok(by['meet:meet-m2'].ms === by.buffer.ms - 10 * 60000 - ACT_DEFAULT_MIN.meet * 60000 && by['meet:meet-m1'].ms === by['meet:meet-m2'].ms - 25 * 60000 - ACT_DEFAULT_MIN.meet * 60000, 'Etappen: Abfahrt = nächste Zeit − Fahrt − Aufenthalt');
  // Pin auf Ankunft: Zeilen davor rechnen vom Pin, Start bleibt
  const pinned = tpl.map((x) => (x.type === 'arrive' ? { ...x, pin: startMs - 120 * 60000 } : x));
  const r2 = buildPlan(pinned, { startMs, flightMin: 90 });
  const b2 = Object.fromEntries(r2.map((r) => [r.type, r]));
  ok(b2.arrive.ms === startMs - 120 * 60000 && b2.arrive.overridden && b2.rig.ms === startMs - 45 * 60000 && b2.buffer.ms === b2.arrive.ms - 15 * 60000, 'Pin Ankunft: Reserve/Etappen rechnen vom Pin, Aufrüsten weiter vom Start');
  // Umsortieren: Bergung vor Landung → Zeiten laufen mit
  const moved = tpl.slice(); const ri = moved.findIndex((x) => x.type === 'recovery'); const [rec] = moved.splice(ri, 1); moved.splice(moved.findIndex((x) => x.type === 'flight'), 0, rec);
  const r3 = buildPlan(moved, { startMs, flightMin: 90 }); const b3 = Object.fromEntries(r3.map((r) => [r.type, r]));
  ok(b3.recovery.ms === startMs && b3.flight.ms === startMs + 60 * 60000 && b3.landing.ms === b3.flight.ms + 90 * 60000, 'verschobene Zeile: Nachfolger rechnen neu');
  ok(buildPlan([{ id: 'a', type: 'custom', min: 7 }, { id: 'start', type: 'start' }, { id: 'b', type: 'custom', min: 7 }, { id: 'c', type: 'custom', min: 7 }], { startMs }).map((r) => (r.ms - startMs) / 60000).join() === '-10,0,0,5', 'Rundung auf 5 min (rückwärts abgerundet, vorwärts kaufmännisch)');
  const stops = planToStops(tpl);
  ok(stops.length === 2 && stops[0].name === 'Katzenrüti' && stops[0].driveMin === 25 && stops[0].driveSource === 'routing' && stops[0].driveKm === 18 && stops[1].driveMin === 10, 'Etappen (Altform) aus dem Zeitplan abgeleitet');
  const ow = planOrderWarnings(moved);
  ok(ow.length === 2 && ow.some((x) => x.a === 'recovery' && x.b === 'flight') && ow.some((x) => x.a === 'recovery' && x.b === 'landing') && planOrderWarnings(tpl).length === 0, 'Reihenfolge-Warnung: Bergung vor Fahrt/Landung');
  const w = scheduleWarnings(rows, { bcmt: startMs + 60000, ecet: startMs + 60 * 60000, ss: startMs + 30 * 60000 });
  ok(w.join() === 'nightStart,nightLanding,returnAfterSunset', 'Warnungen aus Typ-Schlüsseln');
}

// ---- 0.9.2: DABS nur bei CH-Berührung, Panel-Nummern, Zielschätzung aus der Trajektorienschar
{
  const bDE = { site: { country: 'DE', lat: 51.57, lon: 6.98 }, landing: { lat: null }, panels: {} };
  ok(!touchesCH(bDE) && !visiblePanels({ panels: { hidden: [] } }, bDE).some((p) => p.key === 'C.dabs'), 'Gladbeck ohne CH-Berührung: kein DABS');
  const bDE2 = { ...bDE, panels: { 'B.traj': { content: { auto: { data: { tracks: [{ points: [{ lat: 47.5, lon: 8.2 }] }] } } } } } };
  ok(touchesCH(bDE2), 'Trajektorienpunkt in CH → DABS');
  const bFir = { ...bDE, panels: { 'C.airspace': { content: { auto: { data: { firs: [{ seq: [{ country: 'DE' }, { country: 'CH' }] }] } } } } } };
  ok(touchesCH(bFir), 'FIR-Folge mit CH → DABS');
  const vis = visiblePanels({ panels: { hidden: [] } }, { site: { country: 'CH' }, panels: {} });
  ok(panelNo(vis[0], vis) === 'A1' && panelNo(vis.find((p) => p.key === 'C.dabs'), vis) === 'C2' && panelNo(vis.find((p) => p.key === 'B.metar'), vis) === 'B2', 'Panel-Nummern A1 / B2 / C2');
  const t0 = Date.UTC(2026, 9, 10, 4, 0);
  const mk = (altM, brg) => ({ altM, points: Array.from({ length: 13 }, (_, k) => { const km = k * 2; const r = km / 111; return { ms: t0 + k * 10 * 60000, lat: 47 + r * Math.cos(brg * Math.PI / 180), lon: 8 + r * Math.sin(brg * Math.PI / 180) / Math.cos(47 * Math.PI / 180) }; }) });
  const trs = [mk(800, 80), mk(1500, 100)];
  const est = targetEstimate(trs, { lat: 47, lon: 8 }, { lat: 47 + (12 / 111) * Math.cos(90 * Math.PI / 180), lon: 8 + (12 / 111) * Math.sin(90 * Math.PI / 180) / Math.cos(47 * Math.PI / 180) });
  ok(est && est.min >= 55 && est.min <= 65 && est.altM > 800 && est.altM < 1500 && !est.beyond, `Ziel zwischen zwei Bahnen: ~60 min, Höhe gemittelt (${est && est.min} min, ${est && est.altM} m)`);
  const far = targetEstimate(trs, { lat: 47, lon: 8 }, { lat: 47, lon: 8 + (40 / 111) / Math.cos(47 * Math.PI / 180) });
  ok(far && far.beyond, 'Ziel jenseits der Bahnenden → «>»');
}

// ---- 0.10.0: ICAO-Flugplan aus dem Briefing (Muster HB-QPJ Gasfahrten)
{
  ok(firCode('SWITZERLAND FIR') === 'LSAS' && firCode('Praha FIR') === 'LKAA' && firCode('LZBB BRATISLAVA FIR') === 'LZBB' && firCode('KOBENHAVN FIR') === 'EKDK' && firCode('unbekannt') === '', 'FIR-Namen → ICAO-Codes');
  ok(fplName('Bitterfeld-Wolfen') === 'BITTERFELDWOLFEN' && fplName('Neumarkt in der Oberpfalz') === 'NEUMARKTINDEROBERPFALZ' && fplName('Bad Leonfelden') === 'BADLEONFELDEN' && fplName('Zürich Süd') === 'ZUERICHSUED', 'Ortsnamen für DEP/ DEST/');
  ok(fplPerson('Balthasar Wicki') === 'WICKI BALTHASAR' && fplPhone('+41 79 611 12 10') === '0041796111210' && fplLevel(12500) === 'F125' && fplLevel(16500) === 'F165' && fplLevel(4000) === 'VFR', 'PIC-Name, Telefon, Flugfläche');
  const t0 = Date.UTC(2026, 4, 1, 17, 0);
  const S = { persons: [{ id: 'p1', name: 'Balthasar Wicki', phone: '+41 79 611 12 10' }], fpl: { satphone: '+881632624091', gas: { enduranceMin: 2880, equip10b: 'EB1', speed15: 'N0025', typ18: 'GASBALLOON' }, r19: { vhf: true, elba: true }, s19: { maritime: true }, j19: { light: true }, d19: { number: '2', capacity: '2', cover: true, colour: 'orange' } } };
  const firs = [{ seq: [{ name: 'BREMEN FIR', country: 'DE', fromKm: 0, fromMs: t0 }, { name: 'KOBENHAVN FIR', country: 'DK', fromKm: 300, fromMs: t0 + 8 * 3600000 }, { name: 'SWEDEN FIR', country: 'SE', fromKm: 600, fromMs: t0 + 13.5 * 3600000 }, { name: 'RIGA FIR', country: 'LV', fromKm: 900, fromMs: t0 + 20 * 3600000 }] }];
  const b = { balloon: { type: 'gas', reg: 'HB-QPJ', colour: 'white' }, flight: { kind: 'private', nvfr: true }, time: { startMs: t0 }, intent: { durationMin: 1440, altMaxFt: 12500 }, site: { name: 'Bitterfeld-Wolfen', lat: 51.62, lon: 12.28, country: 'DE' }, landing: { name: 'Jelgava', lat: 56.57, lon: 23.5 }, persons: { picId: 'p1', pic: 'Balthasar Wicki', pax: [{ name: 'X' }] },
    panels: { 'C.airspace': { content: { auto: { data: { firs } } } }, 'B.traj': { content: { auto: { data: { startMs: t0, tracks: [{ altM: 3000, points: [{ lat: 51.62, lon: 12.28 }, { lat: 52.4, lon: 11.0 }, { lat: 53.5, lon: 11.4 }, { lat: 55, lon: 14 }, { lat: 56.5, lon: 23 }] }] } } } } } };
  const d = buildFpl(b, S);
  const msg = fplMessage(d);
  ok(msg.startsWith('(FPL-HBQPJ-VG\n-ZZZZ/L-GY/EB1\n-ZZZZ1700\n-N0025F125 DRIFTING '), 'Felder 7–15: ' + msg.split('\n').slice(0, 4).join(' | '));
  ok(msg.includes('FROM BITTERFELDWOLFEN TO JELGAVA') && msg.includes('\n-ZZZZ2400 ZZZZ ZZZZ\n'), 'Route und Feld 16 (EET 2400, ALTN ZZZZ ZZZZ)');
  ok(msg.includes('DEP/BITTERFELDWOLFEN 5137N01217E DEST/JELGAVA 5634N02330E DOF/260501 EET/EKDK0800 ESAA1330 EVRR2000 TYP/GASBALLOON ALTN/UNKNOWN UNKNOWN RMK/NVFR CREW CONTACT 0041796111210 AND 00881632624091'), 'Feld 18 wie Muster (DEP/DEST/DOF/EET/TYP/ALTN/RMK)');
  ok(msg.endsWith('-E/4800 P/2 R/VE S/M J/L D/2 2 C ORANGE A/WHITE N/GSM PIC 0041796111210 AND SATPHONE 00881632624091 C/WICKI BALTHASAR)'), 'Feld 19 wie Muster: ' + msg.split('\n').pop());
  ok(fplCheck(d).length === 0, 'Plausibilität ohne Beanstandung');
  const x = fplXml(d);
  ok(x.includes('<AircraftIdentification>HBQPJ</AircraftIdentification>') && x.includes('<EET fir="EKDK" time="0800"/>') && x.includes('<Message>(FPL-HBQPJ-VG'), 'XML mit Feldern und Nachricht');
  const bHab = { ...b, balloon: { type: 'hab', reg: 'HB-QWZ' }, flight: { kind: 'commercial', nvfr: false }, intent: { durationMin: 120, altMaxFt: 4000 }, panels: {} };
  const dh = buildFpl(bHab, S, { fuelEnduranceMin: 190 });
  ok(dh.typeOfFlight8 === 'N' && dh.level15 === 'VFR' && dh.speed15 === 'N0015' && dh.e19 === '0310' && dh.eet16 === '0200' && dh.altn16b === '' && !dh.rmk18.startsWith('NVFR') && dh.typ18 === 'HOT AIR BALLOON', 'Heissluft gewerblich: N, VFR, N0015, Autonomie aus Treibstoff, kein 2. ALTN');
  ok(fplCheck(dh).includes('eet18') === false && eetFromFirs([], t0).length === 0, 'ohne FIR-Folge keine EET/-Einträge');
  ok(driftWords([{ lat: 47, lon: 8 }, { lat: 47.5, lon: 8 }, { lat: 48, lon: 8 }]) === 'N', 'Richtungswörter: Nord');
}

console.log('Bild der Hülle (0.10.1)');
// 0.10.1: Bild der Hülle — Schnappschuss im Briefing, Rückgriff auf die Stammdaten
{
  const S = mergeSettings({});
  S.balloons.envelopes[0].image = 'data:image/jpeg;base64,AAA';
  const gas = resolveBalloon(S, { type: 'gas', envelopeId: S.balloons.envelopes[0].id, basketId: S.balloons.baskets[0].id });
  ok(gas.image === 'data:image/jpeg;base64,AAA' && gas.label.includes('NL/STU-1000'), 'resolveBalloon gas: Bild und Muster im Schnappschuss');
  S.balloons.hab[0].image = 'data:image/jpeg;base64,BBB';
  const hab = resolveBalloon(S, { type: 'hab', id: S.balloons.hab[0].id });
  ok(hab.image === 'data:image/jpeg;base64,BBB', 'resolveBalloon hab: Bild im Schnappschuss');
  ok(balloonImage({ balloon: { ...hab, image: 'data:x' } }, S) === 'data:x', 'balloonImage: Schnappschuss vor Stammdaten');
  ok(balloonImage({ balloon: { type: 'hab', id: hab.id } }, S) === 'data:image/jpeg;base64,BBB' && balloonImage({ balloon: { type: 'gas', envelopeId: gas.envelopeId } }, S) === 'data:image/jpeg;base64,AAA', 'balloonImage: Rückgriff auf Stammdaten (altes Briefing ohne Bild)');
  ok(balloonImage({ balloon: { type: 'hab', id: 'nope' } }, S) === '', 'balloonImage: leer ohne Bild');
}

console.log(`\n${n - fails}/${n} Tests bestanden`);
process.exit(fails ? 1 : 0);
