/* Fahrtbriefing — externe Dienste ohne Schlüssel (direkt aus dem Browser):
 * Open-Meteo Geocoding/Höhe/Modellwerte, OSRM-Routing, Nominatim-Rückwärtssuche.
 * Alle Aufrufe sind optional: schlägt einer fehl, bleibt die App bedienbar.
 */
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
