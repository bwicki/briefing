/* Fahrtbriefing — Geodaten: Koordinatenformate, Distanzen, Kurs.
 *
 * ICAO-Kurzformat wie im Flugplan: Breite DDMM + N/S, Länge DDDMM + E/W,
 * z. B. 4719N00823E für Oberlunkhofen. Minuten werden gerundet; eine
 * Rundung auf 60 Minuten wird in den nächsten Grad übertragen.
 */

const R = 6371.0088;
const rad = (d) => d * Math.PI / 180;
const deg = (r) => r * 180 / Math.PI;

function dm(v) {
  let d = Math.floor(Math.abs(v));
  let m = Math.round((Math.abs(v) - d) * 60);
  if (m === 60) { d += 1; m = 0; }
  return [d, m];
}

/** 4719N00823E */
export function icao(lat, lon) {
  const [ld, lm] = dm(lat), [od, om] = dm(lon);
  return `${String(ld).padStart(2, '0')}${String(lm).padStart(2, '0')}${lat < 0 ? 'S' : 'N'}` +
         `${String(od).padStart(3, '0')}${String(om).padStart(2, '0')}${lon < 0 ? 'W' : 'E'}`;
}

/** 47°19.0'N 008°23.5'E (mit Zehntelminuten, für Karten und Funk) */
export function dmm(lat, lon) {
  const f = (v, w) => {
    const d = Math.floor(Math.abs(v));
    const m = ((Math.abs(v) - d) * 60).toFixed(1);
    return `${String(d).padStart(w, '0')}°${m.padStart(4, '0')}'`;
  };
  return `${f(lat, 2)}${lat < 0 ? 'S' : 'N'} ${f(lon, 3)}${lon < 0 ? 'W' : 'E'}`;
}

/** ICAO-Kurzformat zurück in Dezimalgrad (für Eingaben). */
export function parseIcao(s) {
  const m = /^(\d{2})(\d{2})([NS])\s*(\d{3})(\d{2})([EW])$/.exec(String(s).trim().toUpperCase());
  if (!m) return null;
  const lat = (+m[1] + m[2] / 60) * (m[3] === 'S' ? -1 : 1);
  const lon = (+m[4] + m[5] / 60) * (m[6] === 'W' ? -1 : 1);
  return { lat, lon };
}

/** Grosskreisdistanz in km. */
export function distKm(lat1, lon1, lat2, lon2) {
  const dLat = rad(lat2 - lat1), dLon = rad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
}

/** Anfangskurs in Grad (0–360). */
export function bearing(lat1, lon1, lat2, lon2) {
  const y = Math.sin(rad(lon2 - lon1)) * Math.cos(rad(lat2));
  const x = Math.cos(rad(lat1)) * Math.sin(rad(lat2)) - Math.sin(rad(lat1)) * Math.cos(rad(lat2)) * Math.cos(rad(lon2 - lon1));
  return (deg(Math.atan2(y, x)) + 360) % 360;
}

/** Zielpunkt aus Start, Kurs (Grad) und Distanz (km). */
export function destination(lat, lon, brg, km) {
  const d = km / R, b = rad(brg), p1 = rad(lat), l1 = rad(lon);
  const p2 = Math.asin(Math.sin(p1) * Math.cos(d) + Math.cos(p1) * Math.sin(d) * Math.cos(b));
  const l2 = l1 + Math.atan2(Math.sin(b) * Math.sin(d) * Math.cos(p1), Math.cos(d) - Math.sin(p1) * Math.sin(p2));
  return { lat: deg(p2), lon: ((deg(l2) + 540) % 360) - 180 };
}

export const mToFt = (m) => m / 0.3048;
export const ftToM = (ft) => ft * 0.3048;
export const ktToKmh = (kt) => kt * 1.852;
export const kmhToKt = (kmh) => kmh / 1.852;

/** Ländercode aus einer groben Bounding-Box-Liste (nur für Regelwerk-Vorbelegung). */
export function countryGuess(lat, lon) {
  const boxes = [
    ['CH', 45.8, 47.9, 5.9, 10.6],
    ['LI', 47.0, 47.3, 9.4, 9.7],
    ['AT', 46.3, 49.1, 9.5, 17.2],
    ['DE', 47.2, 55.1, 5.8, 15.1],
    ['FR', 41.3, 51.2, -5.2, 9.6],
    ['IT', 36.6, 47.1, 6.6, 18.6],
  ];
  for (const [cc, s, n, w, e] of boxes) if (lat >= s && lat <= n && lon >= w && lon <= e) return cc;
  return '';
}
