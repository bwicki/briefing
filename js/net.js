/* Fahrtbriefing — externe Dienste ohne Schlüssel (direkt aus dem Browser):
 * Open-Meteo Geocoding/Höhe/Modellwerte, OSRM-Routing, Nominatim-Rückwärtssuche.
 * Alle Aufrufe sind optional: schlägt einer fehl, bleibt die App bedienbar.
 */
import { t } from './i18n.js';
const withTimeout = (ms) => { const c = new AbortController(); setTimeout(() => c.abort(), ms); return c.signal; };
const getJson = async (url, ms = 9000) => { const r = await fetch(url, { signal: withTimeout(ms) }); if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); };

/** Ortssuche → [{name, admin, country, lat, lon, elev, tz}] */
export async function geocode(q, lang = 'de') {
  const m = /^\s*(-?\d+(?:[.,]\d+)?)[\s,;]+(-?\d+(?:[.,]\d+)?)\s*$/.exec(q);
  if (m) {
    const lat = parseFloat(m[1].replace(',', '.')), lon = parseFloat(m[2].replace(',', '.'));
    const info = await pointInfo(lat, lon).catch(() => ({}));
    return [{ name: info.name || `${lat.toFixed(4)}, ${lon.toFixed(4)}`, admin: '', country: info.country || '', lat, lon, elev: info.elev ?? null, tz: info.tz || 'Europe/Zurich' }];
  }
  const j = await getJson(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=8&language=${lang}&format=json`);
  return (j.results || []).map((r) => ({
    name: r.name, admin: [r.admin1, r.country].filter(Boolean).join(', '), country: r.country_code || '',
    lat: r.latitude, lon: r.longitude, elev: r.elevation ?? null, tz: r.timezone || 'Europe/Zurich',
  }));
}

/** Höhe, Zeitzone, aktuelle Werte für einen Punkt (Open-Meteo forecast, timezone=auto). */
export async function pointInfo(lat, lon) {
  const j = await getJson(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,pressure_msl&timezone=auto`);
  let name = '', country = '';
  try {
    const n = await getJson(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}&zoom=12&accept-language=de`, 6000);
    const a = n.address || {};
    name = a.village || a.town || a.city || a.municipality || a.hamlet || n.name || '';
    country = (a.country_code || '').toUpperCase();
  } catch { /* Nominatim optional */ }
  return { elev: j.elevation, tz: j.timezone, name, country, current: j.current };
}

/** Internationale Kfz-Kennzeichen (Ortsangaben im Ausland: «D-Stuttgart»). */
const CAR_CODES = { CH: 'CH', LI: 'FL', DE: 'D', AT: 'A', FR: 'F', IT: 'I', SI: 'SLO', HR: 'HR', HU: 'H', CZ: 'CZ', SK: 'SK', PL: 'PL', BE: 'B', NL: 'NL', LU: 'L', DK: 'DK', ES: 'E', PT: 'P', GB: 'GB', IE: 'IRL', SE: 'S', NO: 'N', FI: 'FIN', MC: 'MC', SM: 'RSM' };
export const carCode = (iso) => CAR_CODES[String(iso || '').toUpperCase()] || String(iso || '').toUpperCase();
/** Ortsname (Nominatim) mit Länderkennzeichen voran, wenn nicht im Heimatland: «D-Stuttgart»; leer, wenn nichts gefunden. */
export async function placeName(lat, lon, homeCountry = 'CH', lang = 'de') {
  try {
    const n = await getJson(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${(+lat).toFixed(4)}&lon=${(+lon).toFixed(4)}&zoom=10&accept-language=${lang}`, 6000);
    const a = n.address || {};
    const name = a.town || a.city || a.village || a.municipality || a.county || n.name || '';
    const cc = (a.country_code || '').toUpperCase();
    if (!name) return '';
    return cc && cc !== String(homeCountry || '').toUpperCase() ? `${carCode(cc)}-${name}` : name;
  } catch { return ''; }
}

/** Modellwerte (T, RH, QNH) zur Startstunde, bis 16 Tage voraus. */
export async function siteWeatherAt(lat, lon, isoDate, hour) {
  const j = await getJson(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&hourly=temperature_2m,relative_humidity_2m,pressure_msl&start_date=${isoDate}&end_date=${isoDate}&timezone=auto`);
  const i = Math.min(23, Math.max(0, hour));
  const H = j.hourly || {};
  if (!H.time || H.temperature_2m?.[i] == null) throw new Error('no data');
  return { tempC: H.temperature_2m[i], rh: H.relative_humidity_2m[i], qnh: H.pressure_msl[i], time: H.time[i], tz: j.timezone, model: 'best_match' };
}

/** Routing Auto (OSRM-Demo): Dauer s, Distanz m. */
export async function route(fromLat, fromLon, toLat, toLon) {
  const j = await getJson(`https://router.project-osrm.org/route/v1/driving/${fromLon},${fromLat};${toLon},${toLat}?overview=false`);
  const r = j.routes?.[0];
  if (!r) throw new Error('no route');
  return { seconds: r.duration, meters: r.distance };
}

/** Eigene DWD-/METAR-Kopie (data/dwd, GitHub Action) – Rückfall GaforCast. */
const GAFOR = 'https://gafor.wicki.aero/data';
export async function dataFile(rel, ms = 12000) {
  const bust = `?t=${Math.floor(Date.now() / 600000)}`;
  try { return await getJson(`data/${rel}${bust}`, ms); }
  catch { return getJson(`${GAFOR}/${rel}${bust}`, ms); }
}

/** Datenabrufe im lokalen Modus (ohne Worker): Open-Meteo direkt, METAR/TAF und DWD aus der eigenen Kopie. */
export async function localData(kind, p = {}) {
  switch (kind) {
    case 'om': return getJson(`https://api.open-meteo.com/v1/forecast?${p.query}`, 15000);
    case 'metar': {
      const j = await dataFile('dwd/metar.json');
      const km = p.km || 150;
      const best = new Map();
      for (const m of j.metar || []) { if (!m.icaoId || m.lat == null) continue; const prev = best.get(m.icaoId); if (!prev || (m.obsTime || 0) > (prev.obsTime || 0)) best.set(m.icaoId, m); }
      const R = 6371, rad = (d) => d * Math.PI / 180;
      const dist = (a, b, c, d) => 2 * R * Math.asin(Math.sqrt(Math.sin(rad(c - a) / 2) ** 2 + Math.cos(rad(a)) * Math.cos(rad(c)) * Math.sin(rad(d - b) / 2) ** 2));
      const list = [...best.values()].map((m) => ({ ...m, distKm: dist(+p.lat, +p.lon, m.lat, m.lon) })).filter((m) => m.distKm <= km).sort((a, b) => a.distKm - b.distKm).slice(0, p.limit || 40);
      const ids = list.map((m) => m.icaoId);
      const taf = {}; for (const t of j.taf || []) if (ids.includes(t.icaoId) && (!taf[t.icaoId] || t.mostRecent === 1)) taf[t.icaoId] = t;
      return { metar: list, taf, source: `${t('auto_copy')} NOAA AWC (${j.via || 'awc'})`, generated: j.generated };
    }
    case 'dwd': return dataFile('dwd/index.json');
    default: throw Object.assign(new Error('remote only'), { code: 'remote' });
  }
}
