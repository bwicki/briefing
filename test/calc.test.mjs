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

console.log(`\n${n - fails}/${n} Tests bestanden`);
process.exit(fails ? 1 : 0);
