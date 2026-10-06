/* Fahrtbriefing — Punktprognose Open-Meteo (Port aus GaforCast, als ES-Modul).
 *
 * Liefert Stundenwerte am Startort (Boden, 80/180 m, Druckflächen bis topHpa),
 * daraus Windprofil, Taupunkt, Nebelrisiko, Wolkenbasis und die Stundenampel
 * «fahrbar / grenzwertig / nein». Alles Modellwerte — in der Oberfläche immer
 * mit Modell und Abrufzeit beschriftet. Zeiten werden als Unix-Sekunden (UTC)
 * geholt, damit die Zuordnung zur Startzeit nicht von Zeitzonen abhängt.
 */

export const HOURLY = [
  'temperature_2m', 'dew_point_2m', 'relative_humidity_2m',
  'precipitation', 'precipitation_probability',
  'cloud_cover', 'cloud_cover_low', 'cloud_cover_mid', 'cloud_cover_high',
  'visibility', 'shortwave_radiation',
  'wind_speed_10m', 'wind_direction_10m', 'wind_gusts_10m',
  'wind_speed_80m', 'wind_direction_80m',
  'wind_speed_180m', 'wind_direction_180m',
  'cape', 'boundary_layer_height', 'freezing_level_height',
  'pressure_msl', 'surface_pressure',
];
export const LEVELS = [1000, 975, 950, 925, 900, 850, 800, 700, 600, 500, 400, 300];
const LEVEL_VARS = ['wind_speed', 'wind_direction', 'temperature', 'geopotential_height', 'relative_humidity'];
export const M_TO_FT = 3.280839895;
export const MS_TO_KT = 1.943844;

/** Modelle mit Druckflächen, nach Horizont sortiert; km = Gitterweite (für die Vorgabe «feinstes Modell, das reicht»). */
export const MODELS = [
  { key: 'icon_d2', name: 'ICON-D2', note: 'DWD, 2 km', hours: 48, km: 2 },
  { key: 'meteofrance_arome_france_hd', name: 'AROME', note: 'Météo-France, 1.5 km', hours: 48, km: 1.5, noLevels: true },
  { key: 'meteofrance_arpege_europe', name: 'ARPEGE', note: 'Météo-France, 11 km', hours: 96, km: 11 },
  { key: 'icon_eu', name: 'ICON-EU', note: 'DWD, 7 km', hours: 120, km: 7 },
  { key: 'ecmwf_ifs025', name: 'ECMWF IFS', note: 'ECMWF, 25 km', hours: 144, km: 25 },
  { key: 'ukmo_global_deterministic_10km', name: 'UKMO', note: 'Met Office, 10 km', hours: 168, km: 10 },
  { key: 'icon_global', name: 'ICON global', note: 'DWD, 11 km', hours: 180, km: 11 },
  { key: 'gfs_global', name: 'GFS', note: 'NOAA, 13 km', hours: 384, km: 13 },
  { key: '', name: 'Auto (best match)', note: 'nahtloser Mix', hours: 384, km: 99 },
];
export const modelName = (key) => (MODELS.find((m) => m.key === (key || '')) || MODELS[MODELS.length - 1]).name;
export const modelHours = (key) => (MODELS.find((m) => m.key === (key || '')) || MODELS[MODELS.length - 1]).hours;
/** Modelle, die den Horizont (h ab jetzt, +6 h Reserve) noch abdecken; feinstes Gitter zuerst, bei gleichem Gitter das mit kürzerem Horizont. */
export const modelsFor = (hours) => MODELS.filter((m) => m.hours >= Math.max(0, hours) + 6 && !m.noLevels).sort((a, b) => a.km - b.km || a.hours - b.hours);
/** Vorgabe je Horizont: feinstes Modell, das die ganze Zeitspanne abdeckt (sonst Auto). */
export const suggestModel = (hours) => (modelsFor(hours)[0] || MODELS[MODELS.length - 1]).key;

export const levelsUpTo = (topHpa) => LEVELS.filter((p) => p >= (topHpa || 500));

/** Standardatmosphäre: Höhe (m) zu Druck. */
export const stdHeight = (hPa) => 44330.77 * (1 - Math.pow(hPa / 1013.25, 0.1902632));

/** Taupunkt aus T und RH (Magnus, Alduchov & Eskridge). */
export function dewPoint(tC, rh) {
  if (tC == null || rh == null || rh <= 0) return null;
  const b = 17.625, c = 243.04;
  const g = Math.log(Math.min(100, Math.max(1, rh)) / 100) + (b * tC) / (c + tC);
  return (c * g) / (b - g);
}

/**
 * Abruf. fetcher(url) → JSON (Browser direkt oder via Worker mit Schlüssel).
 * opts: { days, topHpa, model, startDate, endDate }
 */
export function buildQuery(lat, lon, opts = {}) {
  const levels = opts.noLevels ? [] : levelsUpTo(opts.topHpa);
  const lvl = [];
  for (const p of levels) for (const v of LEVEL_VARS) lvl.push(`${v}_${p}hPa`);
  const q = new URLSearchParams({
    latitude: (+lat).toFixed(4), longitude: (+lon).toFixed(4),
    hourly: HOURLY.concat(lvl).join(','),
    wind_speed_unit: 'ms', timeformat: 'unixtime', timezone: 'UTC',
  });
  if (opts.model) q.set('models', opts.model);
  if (opts.startDate && opts.endDate) { q.set('start_date', opts.startDate); q.set('end_date', opts.endDate); }
  else q.set('forecast_days', String(opts.days || 4));
  return { query: q.toString(), levels };
}

export async function forecast(fetcher, lat, lon, opts = {}) {
  const { query, levels } = buildQuery(lat, lon, opts);
  const j = await fetcher(query);
  if (!j || j.error) throw new Error(j?.reason || 'Open-Meteo error');
  if (!j.hourly?.time?.length) throw new Error('no data');
  j._levels = levels; j._model = opts.model || ''; j._fetched = Date.now();
  return j;
}

/** Index der Stunde, die ms (UTC) am nächsten liegt; -1 wenn ausserhalb. */
export function indexAt(j, ms) {
  const t = j?.hourly?.time; if (!t?.length) return -1;
  const s = ms / 1000;
  if (s < t[0] - 1800 || s > t[t.length - 1] + 1800) return -1;
  let best = 0, bd = Infinity;
  for (let i = 0; i < t.length; i++) { const d = Math.abs(t[i] - s); if (d < bd) { bd = d; best = i; } }
  return best;
}

/** Eine Stunde als flacher Datensatz. */
export function rec(j, i) {
  const h = j.hourly; const g = (k) => (h[k] && h[k][i] != null ? h[k][i] : null);
  return {
    ms: h.time[i] * 1000,
    temp: g('temperature_2m'), dew: g('dew_point_2m'), rh: g('relative_humidity_2m'),
    precip: g('precipitation'), pop: g('precipitation_probability'),
    cloud: g('cloud_cover'), cloudLow: g('cloud_cover_low'), cloudMid: g('cloud_cover_mid'), cloudHigh: g('cloud_cover_high'),
    vis: g('visibility'), rad: g('shortwave_radiation'),
    w10: g('wind_speed_10m'), d10: g('wind_direction_10m'), gust: g('wind_gusts_10m'),
    w80: g('wind_speed_80m'), d80: g('wind_direction_80m'), w180: g('wind_speed_180m'), d180: g('wind_direction_180m'),
    cape: g('cape'), pbl: g('boundary_layer_height'), fzl: g('freezing_level_height'),
    qnh: g('pressure_msl'), qfe: g('surface_pressure'),
  };
}

/** Windprofil einer Stunde, von oben nach unten: [{label, hPa, m, ft, spd, dir, temp, rh, dew}]. */
export function profile(j, i, elevM) {
  if (!j?.hourly || i < 0) return [];
  const h = j.hourly;
  const ground = elevM != null ? elevM : (j.elevation != null ? j.elevation : 0);
  const out = [];
  for (const [agl, ws, wd] of [[10, 'wind_speed_10m', 'wind_direction_10m'], [80, 'wind_speed_80m', 'wind_direction_80m'], [180, 'wind_speed_180m', 'wind_direction_180m']]) {
    const s = h[ws]?.[i], d = h[wd]?.[i];
    if (s == null) continue;
    const m = ground + agl;
    out.push({ label: `${agl} m GND`, agl, hPa: null, m, ft: Math.round(m * M_TO_FT), spd: s, dir: d,
      temp: agl === 10 ? h.temperature_2m?.[i] ?? null : null, rh: agl === 10 ? h.relative_humidity_2m?.[i] ?? null : null, dew: agl === 10 ? h.dew_point_2m?.[i] ?? null : null });
  }
  for (const p of (j._levels || LEVELS)) {
    const s = h[`wind_speed_${p}hPa`]?.[i]; if (s == null) continue;
    const gh = h[`geopotential_height_${p}hPa`]?.[i];
    const m = gh != null ? gh : stdHeight(p);
    if (m <= ground + 200) continue;
    const tp = h[`temperature_${p}hPa`]?.[i] ?? null, rh = h[`relative_humidity_${p}hPa`]?.[i] ?? null;
    out.push({ label: `${p} hPa`, hPa: p, m, ft: Math.round(m * M_TO_FT), spd: s, dir: h[`wind_direction_${p}hPa`]?.[i] ?? null, temp: tp, rh, dew: dewPoint(tp, rh) });
  }
  out.sort((a, b) => b.m - a.m);
  return out;
}

/** Wind (u, v in m/s; u nach Ost, v nach Nord — Richtung, in die die Luft strömt) in Höhe altM, linear zwischen den Flächen. */
export function windAt(prof, altM) {
  const lv = prof.filter((l) => l.spd != null && l.dir != null).sort((a, b) => a.m - b.m);
  if (!lv.length) return null;
  const uv = (l) => { const r = (l.dir + 180) * Math.PI / 180; return { u: l.spd * Math.sin(r), v: l.spd * Math.cos(r) }; };
  if (altM <= lv[0].m) return { ...uv(lv[0]), level: lv[0].label };
  if (altM >= lv[lv.length - 1].m) return { ...uv(lv[lv.length - 1]), level: lv[lv.length - 1].label };
  for (let k = 1; k < lv.length; k++) {
    if (altM <= lv[k].m) {
      const a = uv(lv[k - 1]), b = uv(lv[k]), t = (altM - lv[k - 1].m) / ((lv[k].m - lv[k - 1].m) || 1);
      return { u: a.u + t * (b.u - a.u), v: a.v + t * (b.v - a.v), level: `${lv[k - 1].label}–${lv[k].label}` };
    }
  }
  return null;
}
export const uvToDirSpd = (u, v) => ({ spd: Math.hypot(u, v), dir: ((Math.atan2(u, v) * 180 / Math.PI) + 180 + 360) % 360 });

/** Nebelrisiko 0…3 (Indikator). */
export function fogRisk(r) {
  if (!r || r.temp == null || r.dew == null) return { level: null };
  const spread = r.temp - r.dew, rh = r.rh == null ? 100 - spread * 5 : r.rh, w = r.w10 == null ? 0 : r.w10;
  let lvl = 0;
  if (spread <= 0.6 && rh >= 97 && w < 2.0) lvl = 3;
  else if (spread <= 1.5 && rh >= 93 && w < 3.5) lvl = 2;
  else if (spread <= 2.5 && rh >= 88 && w < 5.0) lvl = 1;
  if (r.vis != null) { if (r.vis < 1000) lvl = 3; else if (r.vis < 3000) lvl = Math.max(lvl, 2); else if (r.vis < 5000) lvl = Math.max(lvl, 1); }
  if (lvl > 0 && r.rad != null && r.rad > 250) lvl -= 1;
  return { level: lvl };
}
/** Grobe Basis der untersten Schicht in ft AGL (LCL-Faustregel). */
export function cloudBaseFt(r) {
  if (!r || r.cloudLow == null || r.cloudLow < 25 || r.temp == null || r.dew == null) return null;
  return Math.max(100, Math.round((r.temp - r.dew) * 400 / 100) * 100);
}

/** Stundenampel. limits aus den Einstellungen (m/s, J/kg, mm/h, km, ft). */
export const FLY_DEFAULTS = { wind: [4, 6], gust: [6, 8], gustSpread: [4, 6], cape: [300, 800], precip: 0.1, visKm: 1.5, baseFt: 1000 };
export function flyRating(r, light, limits, lang = 'de') {
  if (!r) return { level: null, why: [] };
  const L = { ...FLY_DEFAULTS, ...(limits || {}) };
  const kt = (ms) => (ms * MS_TO_KT).toFixed(0);
  const why = []; let lvl = 2;
  const down = (to, reason) => { if (to < lvl) lvl = to; why.push(reason); };
  const T = lang === 'en'
    ? { light: 'outside civil twilight', wind: 'surface wind', gust: 'gusts', gusty: 'gusty', precip: 'precipitation', cape: 'CAPE', vis: 'visibility', fog: 'fog risk', base: 'cloud base' }
    : { light: 'ausserhalb der bürgerlichen Dämmerung', wind: 'Bodenwind', gust: 'Böen', gusty: 'böig', precip: 'Niederschlag', cape: 'CAPE', vis: 'Sicht', fog: 'Nebelrisiko', base: 'Wolkenbasis' };
  if (light === false) down(0, T.light);
  const w = r.w10, g = r.gust;
  if (w != null) { if (w > L.wind[1]) down(0, `${T.wind} ${kt(w)} kt`); else if (w > L.wind[0]) down(1, `${T.wind} ${kt(w)} kt`); }
  if (g != null) { if (g > L.gust[1]) down(0, `${T.gust} ${kt(g)} kt`); else if (g > L.gust[0]) down(1, `${T.gust} ${kt(g)} kt`); }
  if (w != null && g != null) { const d = g - w; if (d > L.gustSpread[1]) down(0, `${T.gusty} +${kt(d)} kt`); else if (d > L.gustSpread[0]) down(1, `${T.gusty} +${kt(d)} kt`); }
  if (r.precip != null && r.precip >= L.precip) down(0, `${T.precip} ${r.precip.toFixed(1)} mm/h`);
  if (r.cape != null) { if (r.cape >= L.cape[1]) down(0, `${T.cape} ${Math.round(r.cape)} J/kg`); else if (r.cape >= L.cape[0]) down(1, `${T.cape} ${Math.round(r.cape)} J/kg`); }
  if (r.vis != null && r.vis < L.visKm * 1000) down(0, `${T.vis} ${(r.vis / 1000).toFixed(1)} km`);
  else if (fogRisk(r).level >= 2) down(1, T.fog);
  const base = cloudBaseFt(r);
  if (base != null && base < L.baseFt) down(1, `${T.base} ${base} ft AGL`);
  return { level: lvl, why };
}

/** Zusammenfassung der Stunden eines Fensters [fromMs, toMs]. */
export function window(j, fromMs, toMs) {
  const out = [];
  const t = j?.hourly?.time || [];
  for (let i = 0; i < t.length; i++) { const ms = t[i] * 1000; if (ms >= fromMs - 1800000 && ms <= toMs + 1800000) out.push(i); }
  return out;
}
