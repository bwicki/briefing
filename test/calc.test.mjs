/* Tests der Rechenmodule gegen die Excel-Vorlagen und die RAC-4-4-Tabelle.
 * Aufruf: node test/calc.test.mjs
 */
import { hotAir, gasBalloon, reserveMinutes, CYLINDER_CATALOG } from '../js/calc/aero.js';
import { sunTimes, moonTimes, moonIllumination, moonPhaseName } from '../js/calc/sun.js';
import { parseRacText, racLookup } from '../js/calc/rac.js';
import { fromLocal, hhmm, localParts, tzOffsetMin, isoDate } from '../js/calc/time.js';
import { icao, parseIcao, distKm } from '../js/calc/geo.js';
import { buildSchedule, trailerMinutes } from '../js/calc/schedule.js';
import { readFileSync } from 'node:fs';
import * as OM from '../js/auto/openmeteo.js';
import { parseLevel, tracks, levelAltM } from '../js/auto/traj.js';
import { vfrRelevant } from '../js/auto/data.js';
import { goNoGo } from '../js/calc/gonogo.js';
import { changesSinceFinal } from '../js/calc/diff.js';

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
near(qwp.massDelta, -118, 0.5, 'Minder-/Mehrgewicht');
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
near(qwz.massDelta, -162, 0.5, 'Minder-/Mehrgewicht');
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
near(qwzPdf.massDelta, -147, 0.5, 'Minder-/Mehrgewicht');
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
ok(by.start === '06:30' && by.arrive === '05:45' && by.depart === '05:10' && by.landing === '08:30', JSON.stringify(by));
const gasRows = buildSchedule({ startMs: start, type: 'gas', rigMin: 30, fillMin: 150, driveMin: 30, bufferMin: 10, durationMin: 24 * 60 });
const gby = Object.fromEntries(gasRows.map((r) => [r.key, hhmm(tz, r.ms)]));
ok(gby.arrive === '03:30' && gby.fillStart === '04:00' && gby.fillEnd === '06:30' && gby.depart === '02:50', JSON.stringify(gby));


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
console.log(`\n${n - fails}/${n} Tests bestanden`);
process.exit(fails ? 1 : 0);
