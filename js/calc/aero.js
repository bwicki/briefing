/* Fahrtbriefing — Aerostatik: Tragkraft Heissluft, Ballast Gasballon.
 *
 * Heissluft: das Rechenmodell der Excel-Vorlage «Tragkraft-, Massen- und
 * Treibstoffberechnung» ist 1:1 nachgebildet (ISA-Gradient ab Startplatz,
 * barometrische Höhenformel ab QNH, Tragkraft/m³ = ρ·(T_H − T)/(273.15 + T_H),
 * Tabelle in 100-m-Schritten, Max. Steighöhe wie VLOOKUP minus 100 m).
 * Darüber hinaus: feuchte Luft (Magnus), benötigte Hüllentemperatur, exakte
 * Gleichgewichtshöhe, Treibstoffbedarf nach Fahrtdauer mit Reserve-Regel.
 *
 * Gasballon: Brutto-Auftrieb = V·(ρ_Luft − ρ_Gasgemisch) mit Gasdichte aus
 * p, T und Reinheit; «Excel-Modus» reproduziert die Vorlage (fester
 * Sättigungsdampfdruck 2340 Pa, H₂-Dichte 0.08987 kg/m³ bei 0 °C).
 */

const RD = 287.058, RV = 461.523, RGAS = 8.314462, G = 9.80665;
const MOLAR = { H2: 2.016e-3, He: 4.0026e-3 };

/** Sättigungsdampfdruck über Wasser (hPa), Magnus. */
export const esMagnus = (tC) => 6.112 * Math.exp(17.62 * tC / (243.12 + tC));

/** Luftdichte kg/m³ aus p (hPa), T (°C), RH (%, optional). */
export function airDensity(pHpa, tC, rh = null) {
  const T = 273.15 + tC, p = pHpa * 100;
  if (rh == null) return 0.3485 * pHpa / T;            // trocken, wie Excel
  const e = Math.min(p, (rh / 100) * esMagnus(tC) * 100);
  return (p - e) / (RD * T) + e / (RV * T);
}

/** Druck in Höhe h (m) aus QNH und Meereshöhen-Temperatur Tsl (°C), ISA-Gradient. */
export const pressureAt = (qnh, h, tslC) => qnh * Math.pow(1 - 0.0065 * h / (273.15 + tslC), 5.255);

/** Treibstoffreserve nach Regel: min(Anteil · Dauer, Deckel) bzw. max(…, Minimum). */
export function reserveMinutes(durationMin, rule = {}) {
  const pct = rule.pct ?? 25, cap = rule.capMin ?? 30, floor = rule.minMin ?? 0;
  let r = durationMin * pct / 100;
  if (cap > 0) r = Math.min(r, cap);
  return Math.max(r, floor);
}

/**
 * Heissluftballon.
 * in: { volume, siteAlt, tempC, qnh, envTempC, envMaxC, masses:{envelope,burner,basket,equipment},
 *       persons, personWeight, cylinders:[{name,count,litres,gasKg,totalKg}], mtom,
 *       usableFraction, burnRate, durationMin, reserve:{pct,capMin,minMin}, rh (optional) }
 */
export function hotAir(i) {
  const tsl = i.tempC + i.siteAlt * 0.0065;
  const m = i.masses || {};
  const equipMass = (m.envelope || 0) + (m.burner || 0) + (m.basket || 0) + (m.equipment || 0);
  const cyl = (i.cylinders || []).map((c) => ({ ...c, count: +c.count || 0 }));
  const cylMass = cyl.reduce((s, c) => s + c.count * (c.totalKg || 0), 0);
  const gasKg = cyl.reduce((s, c) => s + c.count * (c.gasKg || 0), 0);
  const gasL = cyl.reduce((s, c) => s + c.count * (c.litres || 0), 0);
  const persons = +i.persons || 0;
  const paxMass = i.personMasses && i.personMasses.length
    ? i.personMasses.reduce((s, w) => s + (+w || i.personWeight || 0), 0)
    : persons * (i.personWeight || 0);
  const takeoff = equipMass + cylMass + paxMass;
  const required = takeoff / i.volume;                 // nötige Tragkraft/m³

  const rows = [];
  for (let h = 10000; h >= 0; h -= 100) {
    const t = tsl - h * 0.0065;
    const p = pressureAt(i.qnh, h, tsl);
    const rho = airDensity(p, t, i.rh ?? null);
    const liftM3 = rho * (i.envTempC - t) / (273.15 + i.envTempC);
    rows.push({ h, t, p, rho, liftM3, capacity: liftM3 * i.volume, climb: liftM3 * i.volume - takeoff });
  }
  // Excel: VLOOKUP(required, D:G, 4, TRUE) − 100 → grösster liftM3 ≤ required
  let maxAltExcel = null;
  for (const r of rows) { if (r.liftM3 <= required) maxAltExcel = r.h; }
  if (maxAltExcel != null) maxAltExcel -= 100;
  // exakt: Interpolation des Nulldurchgangs von climb
  let maxAltExact = null;
  for (let k = 0; k + 1 < rows.length; k++) {
    const a = rows[k], b = rows[k + 1];
    if (a.climb <= 0 && b.climb >= 0) { maxAltExact = b.h + (a.h - b.h) * (b.climb / (b.climb - a.climb)); break; }
  }
  if (maxAltExact == null && rows[0].climb > 0) maxAltExact = 10000;

  // Startplatz: Luftdichte, benötigte Hüllentemperatur
  const p0 = pressureAt(i.qnh, i.siteAlt, tsl);
  const rho0 = airDensity(p0, i.tempC, i.rh ?? null);
  const L = required;
  const envReq = rho0 > L ? (L * 273.15 + rho0 * i.tempC) / (rho0 - L) : null;
  const liftAtSite = rho0 * (i.envTempC - i.tempC) / (273.15 + i.envTempC) * i.volume;

  // Treibstoff
  const usable = (i.usableFraction ?? 0.9) * gasKg;
  const burn = i.burnRate || 25;
  const enduranceMin = burn > 0 ? usable / burn * 60 : 0;
  const resRule = i.reserve || {};
  const enduranceExcelReserve = burn > 0 ? usable * (1 - (resRule.pct ?? 25) / 100) / burn * 60 : 0;
  const dur = i.durationMin || 0;
  const reserveMin = reserveMinutes(dur, resRule);
  const needKg = (dur + reserveMin) / 60 * burn;

  // Zulässiges Startgewicht = Tragkraft am Startplatz (bei Hüllentemperatur), höchstens MTOM
  const allowed = i.mtom ? Math.min(liftAtSite, i.mtom) : liftAtSite;
  const limitBy = i.mtom && i.mtom <= liftAtSite ? 'mtom' : 'lift';
  return {
    tsl, equipMass, cylMass, gasKg, gasL, paxMass, takeoff, required, mtom: i.mtom,
    massDeltaMtom: i.mtom ? takeoff - i.mtom : null,
    allowed, limitBy, massDelta: takeoff - allowed,
    rows, maxAltExcel, maxAltExact, p0, rho0, envReq, envMargin: envReq != null ? i.envTempC - envReq : null,
    envMaxMargin: envReq != null && i.envMaxC ? i.envMaxC - envReq : null,
    liftAtSite, climbAtSite: liftAtSite - takeoff,
    usable, burn, enduranceMin, enduranceExcelReserve, reserveMin, needKg, fuelMargin: usable - needKg,
  };
}

/**
 * Gasballon.
 * in: { volume, fillFraction, gas:'H2'|'He', purity (0–1), siteAlt, tempC, qnh, rh, gasDeltaT,
 *       masses:{envelope,basket,equipment,instruments}, persons, personWeight, personMasses,
 *       ballastUnitKg, reserveUnits, excelMode }
 */
export function gasBalloon(i) {
  const tsl = i.tempC + (i.siteAlt || 0) * 0.0065;
  const p0 = i.excelMode ? i.qnh : pressureAt(i.qnh, i.siteAlt || 0, tsl);
  const T = 273.15 + i.tempC;
  let rhoAir;
  if (i.excelMode) {
    const phi = (i.rh ?? 50) / 100, es = 2340, p = p0 * 100;
    const Rf = RD / (1 - phi * (es / p) * (1 - RD / RV));
    rhoAir = p / (Rf * T);
  } else rhoAir = airDensity(p0, i.tempC, i.rh ?? null);

  const vGas = i.volume * (i.fillFraction ?? 1);
  const gas = i.gas || 'H2';
  let rhoGas;
  if (i.excelMode) rhoGas = 0.08987;
  else {
    const Tg = T + (i.gasDeltaT || 0);
    const pure = (p0 * 100) * MOLAR[gas] / (RGAS * Tg);
    const x = i.purity ?? 1;
    rhoGas = x * pure + (1 - x) * rhoAir;
  }
  const gross = i.excelMode ? rhoAir * vGas : vGas * (rhoAir - rhoGas);
  const gasMass = rhoGas * vGas;
  const m = i.masses || {};
  const persons = +i.persons || 0;
  const paxMass = i.personMasses && i.personMasses.length
    ? i.personMasses.reduce((s, w) => s + (+w || i.personWeight || 0), 0)
    : persons * (i.personWeight || 0);
  const net = (m.envelope || 0) + (m.basket || 0) + (m.equipment || 0) + (m.instruments || 0) + paxMass;
  const ballast = i.excelMode ? gross - net - gasMass : gross - net;
  const grossLift = i.excelMode ? gross - gasMass : gross;
  const unit = i.ballastUnitKg || 0;
  const H = RD * T / G;                                   // Skalenhöhe
  return {
    p0, rhoAir, rhoGas, vGas, gasMass, grossLift, net, paxMass, ballast,
    ballastPct: grossLift ? ballast / grossLift * 100 : 0,
    units: unit ? ballast / unit : null,
    reserveKg: unit ? (i.reserveUnits || 0) * unit : 0,
    coolingLossPerK: grossLift / T,                         // kg je K Abkühlung
    ballastPer100m: grossLift * (1 - Math.exp(-100 / H)),  // kg je 100 m Gleichgewichtshöhe
  };
}

/** Tank-Katalog (Inhalt real 80 % l, Inhalt kg, Gesamt kg) aus der Vorlage. */
export const CYLINDER_CATALOG = [
  { id: 'va50', name: 'Schroeder VA50', litres: 42, gasKg: 21, totalKg: 37 },
  { id: 'va70', name: 'Schroeder VA70', litres: 60, gasKg: 30, totalKg: 48 },
  { id: 'wo_s', name: 'Worthington, klein', litres: 40, gasKg: 20, totalKg: 33 },
  { id: 'wo_l', name: 'Worthington, gross', litres: 60, gasKg: 30, totalKg: 49 },
  { id: 'um20', name: 'Ultramagic M20', litres: 40, gasKg: 20, totalKg: 35 },
  { id: 'um30', name: 'Ultramagic M30', litres: 60, gasKg: 30, totalKg: 50 },
  { id: 'um40', name: 'Ultramagic M40', litres: 80, gasKg: 40, totalKg: 64 },
  { id: 'c57', name: 'Cameron 57L', litres: 45, gasKg: 23, totalKg: 43 },
  { id: 'c75', name: 'Cameron 75L', litres: 60, gasKg: 30, totalKg: 52 },
  { id: 'c90', name: 'Cameron 90L', litres: 72, gasKg: 36, totalKg: 62 },
];
