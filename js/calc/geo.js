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

/** Punkt-in-Polygon (Ring als [lon, lat]-Paare wie GeoJSON). */
export function inRing(lat, lon, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if (((yi > lat) !== (yj > lat)) && (lon < (xj - xi) * (lat - yi) / ((yj - yi) || 1e-12) + xi)) inside = !inside;
  }
  return inside;
}
/** 0.12.10: vereinfachter Umriss der Schweiz ([lon, lat], im Uhrzeigersinn ab Basel; Genauigkeit wenige km, Enklaven Büsingen/Campione nicht berücksichtigt). */
const CH_RING = [[7.59, 47.59], [7.80, 47.56], [8.06, 47.56], [8.24, 47.61], [8.30, 47.59], [8.52, 47.57], [8.55, 47.62], [8.60, 47.80], [8.70, 47.75], [8.86, 47.66], [9.05, 47.68], [9.15, 47.665], [9.17, 47.655], [9.22, 47.64], [9.38, 47.60], [9.50, 47.52], [9.60, 47.46], [9.66, 47.39], [9.57, 47.32], [9.50, 47.26], [9.47, 47.05], [9.52, 47.03], [9.65, 47.07], [9.70, 47.05], [10.10, 46.90], [10.36, 46.96], [10.49, 46.85], [10.47, 46.63], [10.44, 46.55], [10.20, 46.50], [10.14, 46.23], [9.52, 46.33], [9.33, 46.51], [9.15, 46.25], [9.10, 46.00], [9.03, 45.83], [8.93, 45.85], [8.86, 45.97], [8.76, 46.03], [8.70, 46.12], [8.60, 46.16], [8.45, 46.22], [8.14, 46.20], [8.08, 46.25], [8.30, 46.37], [8.37, 46.45], [8.50, 46.42], [8.65, 46.33], [8.60, 46.20], [8.45, 46.22], [8.14, 46.20], [7.98, 46.00], [7.87, 45.93], [7.66, 45.98], [7.17, 45.87], [7.04, 45.92], [6.93, 46.07], [6.80, 46.39], [6.24, 46.30], [6.30, 46.24], [6.19, 46.17], [6.04, 46.14], [5.96, 46.13], [5.97, 46.19], [6.07, 46.46], [6.14, 46.60], [6.35, 46.71], [6.46, 46.90], [6.60, 46.98], [6.72, 47.06], [6.70, 47.07], [6.95, 47.26], [6.95, 47.33], [7.01, 47.50], [7.07, 47.49], [7.26, 47.42], [7.40, 47.48], [7.52, 47.55]];
let DE_RINGS = null;
let COUNTRY_RINGS = null;   // 0.12.10a: [{ cc, rings }] aus data/countries.geojson (Natural Earth 1:10m, vereinfacht ~500 m) – präzise Landesgrenzen
/** Landesgrenzen setzen (GeoJSON-Features mit properties.cc, MultiPolygon). Kleine Länder zuerst (LI, MC, SM), damit Enklaven gewinnen. */
export function setCountryRings(features) {
  const list = [];
  for (const f of features || []) { const g = f.geometry || {}; const polys = g.type === 'Polygon' ? [g.coordinates] : g.type === 'MultiPolygon' ? g.coordinates : []; const rings = polys.map((p) => p?.[0]).filter(Boolean); if (rings.length) list.push({ cc: String(f.properties?.cc || '').toUpperCase(), rings, box: bbox(rings) }); }
  const small = new Set(['LI', 'MC', 'SM', 'VA']);
  list.sort((a, b) => (small.has(a.cc) ? 0 : 1) - (small.has(b.cc) ? 0 : 1));
  COUNTRY_RINGS = list;
}
export const countryRingsLoaded = () => !!COUNTRY_RINGS;
function bbox(rings) { let w = 999, e = -999, s = 999, n = -999; for (const r of rings) for (const [x, y] of r) { if (x < w) w = x; if (x > e) e = x; if (y < s) s = y; if (y > n) n = y; } return [w, s, e, n]; }
/** Deutschland-Umriss aus den GAFOR-Gebieten (data/gafor-areas.geojson), von auto/data.js nach dem Laden gesetzt. */
export function setDeRings(features) { DE_RINGS = []; for (const f of features || []) { const g = f.geometry || {}; const polys = g.type === 'Polygon' ? [g.coordinates] : g.type === 'MultiPolygon' ? g.coordinates : []; for (const poly of polys) if (poly?.[0]) DE_RINGS.push(poly[0]); } }
/** Ländercode zu Koordinaten: Liechtenstein (Kasten), Schweiz (Umriss), Deutschland (GAFOR-Gebiete, sonst Rhein-Grenze zu Frankreich), danach grobe Kästen AT/FR/IT/DE.
 * Nur für die Vorbelegung des Landes – im Grenzband kann die Angabe abweichen; sie lässt sich in den Stammdaten überschreiben. */
export function countryGuess(lat, lon) {
  if (!Number.isFinite(+lat) || !Number.isFinite(+lon)) return '';
  if (COUNTRY_RINGS) {   // präzise Grenzen, sobald geladen
    for (const c of COUNTRY_RINGS) { const [w, s, e, n] = c.box; if (lon < w || lon > e || lat < s || lat > n) continue; if (c.rings.some((r) => inRing(lat, lon, r))) return c.cc; }
    return '';
  }
  if (lat >= 47.048 && lat <= 47.27 && lon >= 9.50 && lon <= 9.64) return 'LI';
  if (inRing(lat, lon, CH_RING)) return 'CH';
  if (DE_RINGS && DE_RINGS.some((r) => inRing(lat, lon, r))) return 'DE';
  // grobe Nachbarschaft ohne GAFOR-Daten: Oberrhein (Rhein = Grenze FR/DE), Bayern/Vorarlberg–Tirol, Jura/Savoyen, Lombardei/Südtirol
  if (lat >= 47.5) {
    if (lat <= 49.1 && lon < 7.59 + (lat - 47.59) * (8.23 - 7.59) / (49.0 - 47.59) && lon > 4.5) return 'FR';
    if (lon >= 9.6 && lon < 10.2 && lat <= (lon < 9.8 ? 47.53 : 47.6)) return 'AT';   // Vorarlberg (Lindau bleibt DE)
    if (lon >= 10.2 && lon < 12.8 && lat <= 47.6) return 'AT';   // Tirol-Nordrand
    if (lon >= 12.8 && lon <= 17.2 && lat <= 48.8) return 'AT';
    if (lon >= 5.8 && lon <= 15.1 && lat <= 55.1) return 'DE';
    return '';
  }
  if (lon > 9.5) { if (lon <= 17.2 && lat >= (lon > 12 ? 46.4 : 46.8) && lat <= 49.1) return 'AT'; return lat >= 36.6 && lon <= 18.6 ? 'IT' : ''; }
  if (lon < 6.9 || (lat >= 46.4 && lon < 7.0)) return lat >= 41.3 ? 'FR' : '';
  return lat >= 36.6 ? 'IT' : '';
}
/** 0.12.10: Land nur, wenn es auch 2 km rundherum dasselbe ist (sonst '') – zur Korrektur eines falsch gespeicherten Landes
 * (z. B. Stammdaten-Ort in Deutschland mit Vorgabe «CH»); im Grenzband bleibt der gespeicherte Wert. */
export function countryGuessStrict(lat, lon) {
  if (!Number.isFinite(+lat) || !Number.isFinite(+lon)) return '';
  const c0 = countryGuess(+lat, +lon); if (!c0) return '';
  const km = COUNTRY_RINGS ? 2 : 4; const dLat = km / 111.2, dLon = km / (111.2 * Math.cos(rad(+lat)));
  for (const [a, o] of [[dLat, 0], [-dLat, 0], [0, dLon], [0, -dLon]]) if (countryGuess(+lat + a, +lon + o) !== c0) return '';
  return c0;
}
/** Gespeichertes Land gegen die Koordinaten prüfen: eindeutig anderes Land → korrigiert, sonst unverändert. */
export function fixCountry(p) {
  if (!p || p.lat == null || p.lon == null) return p;
  const g = countryGuessStrict(p.lat, p.lon);
  if (g && p.country && String(p.country).toUpperCase() !== g) p.country = g;
  if (!p.country && g) p.country = g;
  return p;
}

/** Himmelsrichtung (8 Sektoren) für Kurse: N, NE/NO, E/O, SE/SO, S, SW, W, NW. */
export function compass(deg, lang = 'de') {
  const d = ((deg % 360) + 360) % 360;
  const names = lang === 'en' ? ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'] : ['N', 'NO', 'O', 'SO', 'S', 'SW', 'W', 'NW'];
  return names[Math.round(d / 45) % 8];
}
