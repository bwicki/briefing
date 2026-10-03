/* Fahrtbriefing — Sonne und Mond (astronomische Rechnung).
 *
 * Sonne: „sunrise equation" (NOAA), minutengenau — übernommen aus GaforCast.
 *   dawn    Anfang der bürgerlichen Dämmerung (BCMT, Sonnenhöhe −6°)
 *   sunrise Sonnenaufgang (−0,833°: Refraktion und Sonnenrand)
 *   sunset  Sonnenuntergang
 *   dusk    Ende der bürgerlichen Dämmerung (ECET)
 *
 * Mond: Position nach Meeus (niedrige Genauigkeit, ±1°), daraus Auf-/Untergang
 * durch Abtasten des Tages in 10-Minuten-Schritten mit Feinsuche, Phase und
 * beleuchteter Anteil. Für die Nachtfahrt reicht das: es geht um „ist Mond da
 * und wie viel", nicht um Sekunden.
 *
 * Für die Schweiz gilt die amtliche RAC-4-4-Tabelle (rac.js); diese Rechnung
 * liefert dort nur die lokal-astronomischen Vergleichswerte.
 */

const RAD = Math.PI / 180;
const DAY = 86400000;
const J2000 = 2451545;
const toJulian = (ms) => ms / DAY - 0.5 + 2440588;
const fromJulian = (j) => (j + 0.5 - 2440588) * DAY;
const toDays = (ms) => toJulian(ms) - J2000;
const e = 23.4397 * RAD; // Schiefe der Ekliptik

/** Sonnenzeiten des Kalendertags (UTC-Tag), in den `ms` fällt. UTC-ms oder null. */
export function sunTimes(lat, lon, ms) {
  const lw = -lon * RAD, phi = lat * RAD;
  const n = Math.round(toJulian(ms) - J2000 - 0.0009 - lw / (2 * Math.PI));
  const jStar = J2000 + 0.0009 + lw / (2 * Math.PI) + n;
  const M = (357.5291 + 0.98560028 * (jStar - J2000)) * RAD;
  const C = (1.9148 * Math.sin(M) + 0.02 * Math.sin(2 * M) + 0.0003 * Math.sin(3 * M)) * RAD;
  const lam = M + C + Math.PI + 102.9372 * RAD;
  const jNoon = jStar + 0.0053 * Math.sin(M) - 0.0069 * Math.sin(2 * lam);
  const dec = Math.asin(Math.sin(lam) * Math.sin(e));
  const hourAngle = (altDeg) => {
    const c = (Math.sin(altDeg * RAD) - Math.sin(phi) * Math.sin(dec)) / (Math.cos(phi) * Math.cos(dec));
    return (c > 1 || c < -1) ? null : Math.acos(c);
  };
  const pair = (altDeg) => {
    const h = hourAngle(altDeg);
    if (h == null) return [null, null];
    const half = h / (2 * Math.PI);
    return [fromJulian(jNoon - half), fromJulian(jNoon + half)];
  };
  const [sunrise, sunset] = pair(-0.833);
  const [dawn, dusk] = pair(-6);
  return { dawn, sunrise, noon: fromJulian(jNoon), sunset, dusk };
}

/**
 * Sonnenzeiten für einen lokalen Kalendertag: der Tag wird über seinen lokalen
 * Mittag angesprochen, damit die Rechnung nicht in den Nachbartag kippt
 * (Mitteleuropa am Morgen ist UTC noch Vortag).
 * `localNoonMs` = UTC-ms des lokalen Mittags (12:00 Ortszeit).
 */
export function sunTimesForDay(lat, lon, localNoonMs) {
  return sunTimes(lat, lon, localNoonMs);
}

/** Ist es zu diesem Zeitpunkt fahrbar hell (Sonne über −6°)? */
export function isDaylight(lat, lon, ms) {
  for (const off of [0, -DAY, DAY]) {
    const t = sunTimes(lat, lon, ms + off);
    if (t.dawn == null || t.dusk == null) continue;
    if (ms >= t.dawn && ms <= t.dusk) return true;
  }
  return false;
}

// ---------------------------------------------------------------- Mond
function sunCoords(d) {
  const M = (357.5291 + 0.98560028 * d) * RAD;
  const C = (1.9148 * Math.sin(M) + 0.02 * Math.sin(2 * M) + 0.0003 * Math.sin(3 * M)) * RAD;
  const L = M + C + 102.9372 * RAD + Math.PI;
  return { dec: Math.asin(Math.sin(L) * Math.sin(e)), ra: Math.atan2(Math.sin(L) * Math.cos(e), Math.cos(L)) };
}
function moonCoords(d) {
  const L = (218.316 + 13.176396 * d) * RAD;   // ekliptikale Länge
  const M = (134.963 + 13.064993 * d) * RAD;   // mittlere Anomalie
  const F = (93.272 + 13.229350 * d) * RAD;    // Argument der Breite
  const l = L + 6.289 * RAD * Math.sin(M);
  const b = 5.128 * RAD * Math.sin(F);
  const dt = 385001 - 20905 * Math.cos(M);
  return {
    ra: Math.atan2(Math.sin(l) * Math.cos(e) - Math.tan(b) * Math.sin(e), Math.cos(l)),
    dec: Math.asin(Math.sin(b) * Math.cos(e) + Math.cos(b) * Math.sin(e) * Math.sin(l)),
    dist: dt,
  };
}
const siderealTime = (d, lw) => (280.16 + 360.9856235 * d) * RAD - lw;

/** Mondhöhe (Grad) über dem Horizont am Ort. */
export function moonAltitude(lat, lon, ms) {
  const lw = -lon * RAD, phi = lat * RAD, d = toDays(ms);
  const c = moonCoords(d);
  const H = siderealTime(d, lw) - c.ra;
  let h = Math.asin(Math.sin(phi) * Math.sin(c.dec) + Math.cos(phi) * Math.cos(c.dec) * Math.cos(H));
  h += 0.017 * RAD / Math.tan(h + 10.26 * RAD / (h + 5.10 * RAD)); // Refraktion (Näherung)
  return h / RAD;
}

/** Beleuchteter Anteil (0–1) und Phase (0 Neumond, 0.5 Vollmond). */
export function moonIllumination(ms) {
  const d = toDays(ms), s = sunCoords(d), m = moonCoords(d);
  const sdist = 149598000;
  const phi = Math.acos(Math.sin(s.dec) * Math.sin(m.dec) + Math.cos(s.dec) * Math.cos(m.dec) * Math.cos(s.ra - m.ra));
  const inc = Math.atan2(sdist * Math.sin(phi), m.dist - sdist * Math.cos(phi));
  const angle = Math.atan2(Math.cos(s.dec) * Math.sin(s.ra - m.ra),
    Math.sin(s.dec) * Math.cos(m.dec) - Math.cos(s.dec) * Math.sin(m.dec) * Math.cos(s.ra - m.ra));
  return { fraction: (1 + Math.cos(inc)) / 2, phase: 0.5 + 0.5 * inc * (angle < 0 ? -1 : 1) / Math.PI };
}

/** Phasenname (de/en). */
export function moonPhaseName(phase, lang = 'de') {
  const p = ((phase % 1) + 1) % 1;
  const names = lang === 'en'
    ? ['new moon', 'waxing crescent', 'first quarter', 'waxing gibbous', 'full moon', 'waning gibbous', 'last quarter', 'waning crescent']
    : ['Neumond', 'zunehmende Sichel', 'erstes Viertel', 'zunehmender Mond', 'Vollmond', 'abnehmender Mond', 'letztes Viertel', 'abnehmende Sichel'];
  const i = Math.round(p * 8) % 8;
  return names[i];
}

/**
 * Mondauf- und -untergang innerhalb [startMs, startMs + 24 h): Abtastung alle
 * 10 min, Nullstellen per Bisektion. Rückgabe { rise, set, alwaysUp, alwaysDown }.
 */
export function moonTimes(lat, lon, startMs) {
  const h0 = 0.133; // Grad: Mondradius + Parallaxe grob
  const step = 10 * 60000;
  let prev = moonAltitude(lat, lon, startMs) - h0, rise = null, set = null;
  for (let t = startMs + step; t <= startMs + DAY; t += step) {
    const h = moonAltitude(lat, lon, t) - h0;
    if (prev < 0 && h >= 0 && rise == null) rise = bisect(t - step, t);
    if (prev >= 0 && h < 0 && set == null) set = bisect(t - step, t);
    prev = h;
  }
  function bisect(a, b) {
    for (let i = 0; i < 20; i++) {
      const m = (a + b) / 2;
      const ha = moonAltitude(lat, lon, a) - h0, hm = moonAltitude(lat, lon, m) - h0;
      if ((ha < 0) === (hm < 0)) a = m; else b = m;
    }
    return Math.round((a + b) / 2 / 60000) * 60000;
  }
  const up = moonAltitude(lat, lon, startMs) - h0 >= 0;
  return { rise, set, alwaysUp: rise == null && set == null && up, alwaysDown: rise == null && set == null && !up };
}
