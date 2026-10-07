/* Fahrtbriefing — Datenaufbereitung für das Höhenprofil-Werkzeug (0.12, Gasfahrt).
 *
 * Aus den geplanten Fahrthöhen (b.profile.points) entsteht die zusammengesetzte Bahn: der Ballon
 * wird als Luftpaket mit dem Modellwind in der jeweils geplanten Höhe verschoben – zuerst mit dem
 * Profil am Startort (grobe Bahn), dann mit Prognosen an Wegpunkten entlang dieser Bahn (alle ~40 km,
 * gewichtet nach Abstand). Daraus: Kopplung km ↔ Zeit ↔ Ort, Relief (Open-Meteo Elevation),
 * Stundenprofile am jeweiligen Ort (Wolkendecken, Inversionen, Nullgradgrenze, Wind, Scherung),
 * Sonnenereignisse entlang der Bahn, Lufträume (openAIP) mit km-Abschnitten und Achtung-Zeichen.
 * Ergebnis in b.profile.data (Schnappschuss mit Stand, Modell, Quellen).
 */
import * as OM from './openmeteo.js';
import { getForecast, getForecastAt } from './data.js';
import { ensureProfile, altAt, fitPoints, defaultPoints, defaultStages, posAtKm, hazards, kmAtMs, waterRuns, waterFromItems } from '../calc/profile.js';
import { sunTimes } from '../calc/sun.js';
import { destination, distKm } from '../calc/geo.js';
import { normalizeAirspace, analyzeAirspaces, distToAirspaceKm, inAirspace } from '../calc/airspace.js';
import { t } from '../i18n.js';

const M_TO_FT = 3.28084;
const WAYPOINT_KM = 40, MAX_WAYPOINTS = 7;

/** Wind (u, v) in Höhe alt zur Zeit ms aus einer Prognose (linear zwischen den Stunden). */
function windOf(j, ms, alt) {
  const i = OM.indexAt(j, ms); if (i < 0) return null;
  const tt = j.hourly.time, sec = ms / 1000;
  let i0 = i, i1 = i;
  if (tt[i] > sec && i > 0) { i0 = i - 1; i1 = i; } else if (tt[i] <= sec && i < tt.length - 1) { i0 = i; i1 = i + 1; }
  const w0 = OM.windAt(OM.profile(j, i0, j.elevation), alt), w1 = OM.windAt(OM.profile(j, i1, j.elevation), alt);
  if (!w0 || !w1) return null;
  const f = i1 === i0 ? 0 : (sec - tt[i0]) / ((tt[i1] - tt[i0]) || 1);
  return { u: w0.u + f * (w1.u - w0.u), v: w0.v + f * (w1.v - w0.v) };
}

/**
 * Bahn integrieren: fcs = [{ j, lat, lon }] (Wegpunkt-Prognosen), altFn(km) → m AMSL.
 * Rückgabe { points:[{ms, km, lat, lon, alt, spdKt, dir}], totalKm, ok }
 */
export function integrate(fcs, altFn, o) {
  const stepMin = o.stepMin || 10, steps = Math.max(1, Math.round(o.durationMin / stepMin));
  let lat = o.lat, lon = o.lon, ms = o.startMs, km = 0, ok = true;
  const points = [{ ms, km: 0, lat, lon, alt: Math.round(altFn(0)), spdKt: 0, dir: 0 }];
  for (let s = 0; s < steps; s++) {
    const alt = altFn(km);
    // Gewichte: zwei nächste Wegpunkte, umgekehrt proportional zum Abstand (mind. 1 km)
    const near = fcs.map((f) => ({ f, d: Math.max(1, distKm(lat, lon, f.lat, f.lon)) })).sort((a, b) => a.d - b.d).slice(0, 2);
    let u = 0, v = 0, wsum = 0;
    for (const n of near) { const w = windOf(n.f.j, ms, alt); if (!w) continue; const wt = 1 / n.d; u += w.u * wt; v += w.v * wt; wsum += wt; }
    if (!wsum) { ok = false; break; }
    u /= wsum; v /= wsum;
    const dt = stepMin * 60, dKm = Math.hypot(u, v) * dt / 1000;
    const brg = (Math.atan2(u, v) * 180 / Math.PI + 360) % 360;
    const p = destination(lat, lon, brg, dKm);
    lat = p.lat; lon = p.lon; ms += dt * 1000; km += dKm;
    const { spd, dir } = OM.uvToDirSpd(u, v);
    points.push({ ms, km: Math.round(km * 100) / 100, lat: +lat.toFixed(4), lon: +lon.toFixed(4), alt: Math.round(altFn(km)), spdKt: Math.round(spd * 1.943844), dir: Math.round(dir) });
  }
  return { points, totalKm: Math.round(km * 10) / 10, ok };
}

/** Wolkendecken (RH ≥ 95 % je Druckfläche, zusammenhängend), Inversionen und Isothermieschichten aus einem Stundenprofil. */
export function layersOf(prof, ground) {
  const lv = prof.filter((l) => l.hPa != null && l.rh != null).sort((a, b) => a.m - b.m);
  const clouds = [], inv = [];
  let run = null;
  for (let i = 0; i < lv.length; i++) {
    const wet = lv[i].rh >= 95;
    if (wet && !run) run = { lo: i > 0 ? (lv[i - 1].m + lv[i].m) / 2 : Math.max(ground, lv[i].m - 300), hi: lv[i].m };
    if (wet && run) run.hi = i < lv.length - 1 ? (lv[i].m + lv[i + 1].m) / 2 : lv[i].m + 300;
    if (!wet && run) { clouds.push(run); run = null; }
  }
  if (run) clouds.push(run);
  // Inversionen (T nimmt mit der Höhe zu: Gradient > +0.1 K/100 m) und Isothermieschichten (Gradient zwischen −0.2 und +0.1 K/100 m)
  // zwischen benachbarten Flächen; zusammenhängende Schichten gleicher Art werden verbunden
  const tl = prof.filter((l) => l.temp != null).sort((a, b) => a.m - b.m);
  for (let i = 1; i < tl.length; i++) {
    const dz = tl[i].m - tl[i - 1].m; if (dz < 50) continue;
    const g = (tl[i].temp - tl[i - 1].temp) / dz * 100;
    const kind = g > 0.1 ? 'inv' : g > -0.2 ? 'iso' : null; if (!kind) continue;
    const last = inv[inv.length - 1];
    if (last && last.kind === kind && Math.abs(last.hi - tl[i - 1].m) < 1) last.hi = tl[i].m; else inv.push({ lo: tl[i - 1].m, hi: tl[i].m, kind });
  }
  const label = (c) => (c.lo < ground + 400 ? 'Nebel/St' : c.lo < 2000 ? 'St/Sc' : c.lo < 5000 ? 'Ac/As' : 'Ci/Cs');
  return { clouds: clouds.map((c) => ({ lo: Math.round(c.lo), hi: Math.round(c.hi), label: label(c) })), inv: inv.map((x) => ({ lo: Math.round(x.lo), hi: Math.round(x.hi), kind: x.kind })) };
}

/** Wert einer Profilgrösse in Höhe alt (linear zwischen den Flächen). */
function atAlt(prof, alt, key) {
  const lv = prof.filter((l) => l[key] != null).sort((a, b) => a.m - b.m);
  if (!lv.length) return null;
  if (alt <= lv[0].m) return lv[0][key];
  for (let k = 1; k < lv.length; k++) if (alt <= lv[k].m) { const a = lv[k - 1], b = lv[k]; const f = (alt - a.m) / ((b.m - a.m) || 1); return a[key] + f * (b[key] - a[key]); }
  return lv[lv.length - 1][key];
}
/** Windsprung (kt) zwischen benachbarten Flächen innerhalb ±1000 m um alt. */
function shearNear(prof, alt) {
  const lv = prof.filter((l) => l.spd != null && l.dir != null && Math.abs(l.m - alt) <= 1000).sort((a, b) => a.m - b.m);
  let best = 0;
  for (let k = 1; k < lv.length; k++) { const a = lv[k - 1], b = lv[k]; const ra = (a.dir + 180) * Math.PI / 180, rb = (b.dir + 180) * Math.PI / 180; const d = Math.hypot(a.spd * Math.sin(ra) - b.spd * Math.sin(rb), a.spd * Math.cos(ra) - b.spd * Math.cos(rb)); best = Math.max(best, d); }
  return Math.round(best * 1.943844);
}

/** Sonnenereignisse entlang der Bahn (astronomisch am jeweiligen Ort): SS, ECET, BCMT, SR mit Zeit und km. */
export function sunEvents(track) {
  const pts = track.points; if (!pts?.length) return [];
  const out = [];
  const state = (p) => { const s = sunTimes(p.lat, p.lon, p.ms); if (!s.dusk || !s.dawn) return { s, civil: true, sun: true }; return { s, civil: p.ms >= s.dawn && p.ms <= s.dusk, sun: s.sunrise && s.sunset ? p.ms >= s.sunrise && p.ms <= s.sunset : false }; };
  let prev = state(pts[0]);
  const add = (kind, ms) => { if (ms == null) return; out.push({ kind, ms, km: Math.round(kmAtMs(track, ms) * 10) / 10 }); };
  for (let i = 1; i < pts.length; i++) {
    const cur = state(pts[i]);
    if (prev.sun && !cur.sun) add('ss', cur.s.sunset ?? prev.s.sunset);
    if (prev.civil && !cur.civil) add('ecet', cur.s.dusk ?? prev.s.dusk);
    if (!prev.civil && cur.civil) add('bcmt', cur.s.dawn ?? prev.s.dawn);
    if (!prev.sun && cur.sun) add('sr', cur.s.sunrise ?? prev.s.sunrise);
    prev = cur;
  }
  // Doppelte (durch Zeitzonen-/Tagwechsel in sunTimes) entfernen: gleiche Art innerhalb 2 h
  return out.filter((e, i, a) => !a.slice(0, i).some((x) => x.kind === e.kind && Math.abs(x.ms - e.ms) < 2 * 3600000)).sort((a, b) => a.ms - b.ms);
}

/** Aktivierungs-/Statushinweis eines Luftraums: «HX» bei Aktivierung per NOTAM/DABS, O/R, feste Betriebszeiten (Teile mit « · »). */
export function airspaceStatus(as) {
  const parts = [];
  if (as.flags?.byNotam) parts.push('HX');
  if (as.flags?.onRequest) parts.push('O/R');
  if (as.flags?.onDemand) parts.push('bei Bedarf');
  if (as.flags?.specialAgreement) parts.push('bes. Vereinbarung');
  if (as.hours) parts.push(String(as.hours).replace(/\s+/g, ' ').trim().slice(0, 80));
  return parts.join(' · ');
}

/**
 * Daten für das Profil aufbereiten und in b.profile.data ablegen. onStep(text) für Fortschritt.
 * Liefert b.profile.data (auch bei Teilfehlern, mit `errors`).
 */
/**
 * FIS-Sektoren (openAIP Typ 33 «FIS Sector», Frequenzen aus der AIP) entlang der Bahn (0.12.2): Folge [{name, country, freqs[], fromKm, toKm}];
 * Lücken (kein Sektor in den Daten) bleiben leer – dann gelten die Kontakte aus den Einstellungen (FIS-Kontakte je Land).
 */
export function fisSectors(items, pts) {
  const secs = (items || []).filter((x) => x.typeKey === 'FIS' && x.polys?.length);
  if (!secs.length) return [];
  const out = []; let cur = null;
  for (const q of pts || []) {
    const hit = secs.find((x) => inAirspace(q.lat, q.lon, x)) || null;
    if (cur && hit && cur.id === hit.id) { cur.toKm = q.km; continue; }
    if (cur) out.push(cur);
    cur = hit ? { id: hit.id, name: hit.name, country: hit.country || null, freqs: (hit.freqs || []).map((f) => f.value), fromKm: q.km, toKm: q.km } : null;
  }
  if (cur) out.push(cur);
  return out.map(({ id, ...f }) => f);
}
export async function buildProfileData(ctx, b, onStep) {
  const p = ensureProfile(b);
  const errors = [];
  const step = (k) => { try { onStep?.(k); } catch { /* UI */ } };
  const durationMin = b.intent.durationMin || (ctx.settings.trajDefaults?.gas || 1440);
  const stepMin = ctx.settings.trajDefaults?.stepMin || 10;
  const elev = b.site.elev ?? 0;
  step(t('pf_stepModel'));
  // Modell: im Werkzeug gewählt (p.model), sonst die Vorgabe = feinstes Modell, das die ganze Fahrt (Start bis geplantes Ende) abdeckt
  // (Gasfahrten über 24 h brauchen ein globales Modell). Deckt das gewählte Modell die Fahrt nur teilweise ab, endet die Bahn dort.
  const hoursAhead = (b.time.startMs - Date.now()) / 3600000 + durationMin / 60;
  const model = p.model || OM.suggestModel(hoursAhead);
  const j0 = await getForecast(ctx, b, model, { allowShort: true });
  const cruise = ((b.intent.altMinFt || 0) + (b.intent.altMaxFt || 3000)) / 2 / M_TO_FT;
  const altFn = (pts) => (pts?.length ? (km) => altAt(pts, km) : () => Math.max(elev + 300, cruise));
  const base = { lat: b.site.lat, lon: b.site.lon, startMs: b.time.startMs, durationMin, stepMin };
  // 1) grobe Bahn mit dem Startort-Profil
  const rough = integrate([{ j: j0, lat: b.site.lat, lon: b.site.lon }], altFn(p.points), base);
  // 2) Wegpunkte entlang der groben Bahn, Prognosen dort
  const wps = [{ lat: b.site.lat, lon: b.site.lon, km: 0 }];
  for (const pt of rough.points) if (pt.km - wps[wps.length - 1].km >= WAYPOINT_KM && wps.length < MAX_WAYPOINTS) wps.push({ lat: pt.lat, lon: pt.lon, km: pt.km });
  const end = rough.points[rough.points.length - 1];
  if (end && end.km - wps[wps.length - 1].km > WAYPOINT_KM / 2 && wps.length < MAX_WAYPOINTS + 1) wps.push({ lat: end.lat, lon: end.lon, km: end.km });
  step(t('pf_stepWaypoints', { n: wps.length }));
  const fcs = [{ j: j0, lat: b.site.lat, lon: b.site.lon }];
  for (const w of wps.slice(1)) { try { fcs.push({ j: await getForecastAt(ctx, b, w.lat, w.lon, model), lat: w.lat, lon: w.lon }); } catch (e) { errors.push(`Wegpunkt ${w.km} km: ${e.message}`); } }
  // 3) endgültige Bahn, Punkte an die Länge anpassen (zweiter Durchlauf, weil die Höhen vom km abhängen)
  let track = integrate(fcs, altFn(p.points), base);
  if (!p.points.length) { p.points = defaultPoints(elev, Math.max(elev + 300, cruise), track.totalKm, b.landing?.elev ?? elev); track = integrate(fcs, altFn(p.points), base); }
  p.points = fitPoints(p.points, track.totalKm);
  track = integrate(fcs, altFn(p.points), base);
  p.points = fitPoints(p.points, track.totalKm);
  if (!p.stages.length) p.stages = defaultStages({ start: t('pf_stStart'), enroute: t('pf_stEnroute'), landing: t('pf_stLanding') }, track.totalKm, durationMin);
  for (const s of p.stages) s.km = Math.min(s.km, Math.max(0, track.totalKm - 2));
  // 4) Relief je km (Open-Meteo Elevation, 100 Punkte je Abruf)
  step(t('pf_stepRelief'));
  const grid = []; for (let k = 0; k <= Math.ceil(track.totalKm); k++) { const pos = posAtKm(track, k); if (pos) grid.push({ km: k, lat: +pos.lat.toFixed(4), lon: +pos.lon.toFixed(4) }); }
  const relief = [];
  try {
    for (let i = 0; i < grid.length; i += 100) {
      const chunk = grid.slice(i, i + 100);
      const j = await ctx.store.data('elevation', { lat: chunk.map((g) => g.lat).join(','), lon: chunk.map((g) => g.lon).join(',') }, ctx.shared?.token);
      (j.elevation || []).forEach((m, k) => relief.push({ km: chunk[k].km, m: Math.round(m) }));
    }
  } catch (e) { errors.push(`Relief: ${e.message}`); }
  // 4b) Wasserflächen (OpenStreetMap über Overpass, je km-Punkt); fällt die Abfrage aus → Heuristik aus dem Relief (ebene Abschnitte)
  step(t('pf_stepWater'));
  let water = null, waterSource = null;
  try {
    const items = [];
    for (let i = 0; i < grid.length; i += 100) {
      const chunk = grid.slice(i, i + 100);
      const j = await ctx.store.data('water', { lat: chunk.map((g) => g.lat).join(','), lon: chunk.map((g) => g.lon).join(',') }, ctx.shared?.token);
      items.push(...(j.items || chunk.map(() => null)));
    }
    water = waterFromItems(grid, items, relief); waterSource = 'osm';
  } catch (e) { errors.push(`Wasser: ${e.message}`); }
  // 5) Stundenprofile am jeweiligen Ort (nächster Wegpunkt)
  step(t('pf_stepHours'));
  const hours = [];
  const nearestFc = (lat, lon) => fcs.map((f) => ({ f, d: distKm(lat, lon, f.lat, f.lon) })).sort((a, b) => a.d - b.d)[0]?.f;
  const firstHour = Math.ceil(b.time.startMs / 3600000) * 3600000;
  const stamps = [b.time.startMs]; for (let ms = firstHour; ms <= track.points[track.points.length - 1].ms; ms += 3600000) stamps.push(ms);
  for (const ms of stamps) {
    const km = kmAtMs(track, ms), pos = posAtKm(track, km); if (!pos) continue;
    const f = nearestFc(pos.lat, pos.lon); if (!f) continue;
    const i = OM.indexAt(f.j, ms); if (i < 0) continue;
    const prof = OM.profile(f.j, i, f.j.elevation), r = OM.rec(f.j, i), alt = altAt(p.points, km);
    const w = OM.windAt(prof, alt);
    const { clouds, inv } = layersOf(prof, f.j.elevation ?? 0);
    hours.push({ ms, km: Math.round(km * 10) / 10, lat: pos.lat, lon: pos.lon, alt: Math.round(alt), ground: f.j.elevation ?? null, clouds, inv, fzl: r.fzl != null ? Math.round(r.fzl) : null,
      windKt: w ? Math.round(Math.hypot(w.u, w.v) * 1.943844) : null, shearKt: shearNear(prof, alt), tempAtAlt: atAlt(prof, alt, 'temp'), rhAtAlt: atAlt(prof, alt, 'rh'),
      cape: r.cape, fogRisk: OM.fogRisk(r).level, precip: r.precip, cloud: r.cloud, temp2m: r.temp, dew2m: r.dew });
  }
  // 6) Sonne entlang der Bahn
  const sun = sunEvents(track);
  // 7) Lufträume (openAIP) entlang der Bahn: durchfahren und nahe, mit km-Abschnitt und Höhenband
  step(t('pf_stepAirspace'));
  let airspaces = [], firs = [], fis = [];
  try {
    const pts = track.points;
    const corridorKm = +ctx.settings.airspaceCorridorKm || 5;
    const dLat = (corridorKm + 3) / 111.2, dLon = (corridorKm + 3) / (111.2 * Math.max(0.2, Math.cos(b.site.lat * Math.PI / 180)));
    const bbox = [Math.min(...pts.map((q) => q.lon)) - dLon, Math.min(...pts.map((q) => q.lat)) - dLat, Math.max(...pts.map((q) => q.lon)) + dLon, Math.max(...pts.map((q) => q.lat)) + dLat].map((v) => +v.toFixed(3));
    const tileKey = /[?&]apiKey=([A-Za-z0-9]+)/.exec(ctx.settings.airspaceTileUrl || '')?.[1];
    const j = await ctx.store.data('airspace', { bbox: bbox.join(','), key: tileKey || null }, ctx.shared?.token);
    const items = (j.items || []).map((it) => normalizeAirspace(it, elev));
    const altMaxFt = Math.max(...p.points.map((q) => q.alt)) * M_TO_FT, altMinFt = Math.min(...p.points.map((q) => q.alt)) * M_TO_FT;
    const a = analyzeAirspaces([{ label: 'Profil', altFt: Math.round(altMaxFt), points: pts }], items, { altMinFt, altMaxFt, corridorKm });
    const box = (x, status) => {
      let km0 = null, km1 = null;
      if (x.hits.length) { km0 = Math.min(...x.hits.map((h) => h.entryKm)); km1 = Math.max(...x.hits.map((h) => h.exitKm)); }
      else { for (const q of pts) { if (distToAirspaceKm(q.lat, q.lon, x.as) <= corridorKm) { if (km0 == null) km0 = q.km; km1 = q.km; } } }
      if (km0 == null) return null;
      return { name: x.as.name, typeKey: x.as.typeKey, cls: x.as.cls, country: x.as.country, status, km0: Math.round(km0 * 10) / 10, km1: Math.round(Math.max(km1, km0 + 1) * 10) / 10, lo: x.as.lowerFt != null ? Math.round(x.as.lowerFt / M_TO_FT) : 0, hi: x.as.upperFt != null ? Math.round(x.as.upperFt / M_TO_FT) : 20000, lowerTxt: x.as.lowerTxt, upperTxt: x.as.upperTxt, tmp: airspaceStatus(x.as), freqs: x.as.freqs?.slice(0, 2) || [] };
    };
    airspaces = [...a.crossed.map((x) => box(x, 'cross')), ...a.near.map((x) => box(x, 'near'))].filter(Boolean);
    firs = (a.firs[0]?.seq || []).map((f) => ({ name: f.name, country: f.country || null, fromKm: f.fromKm, toKm: f.toKm }));
    fis = fisSectors(items, pts);
  } catch (e) { errors.push(`Lufträume: ${e.message}`); }
  // 8) Achtung-Zeichen
  const hz = hazards(hours, { windKt: ctx.settings.profileLimits?.windKt, shearKt: ctx.settings.profileLimits?.shearKt, cape: ctx.settings.profileLimits?.cape });
  // Land am Startort als FIR-Ersatz, wenn die Luftraumanalyse nichts liefert
  if (!firs.length && b.site.country) firs = [{ name: b.site.country, country: b.site.country, fromKm: 0, toKm: track.totalKm }];
  const endMs = track.points[track.points.length - 1].ms, plannedEndMs = b.time.startMs + durationMin * 60000;
  p.data = {
    stand: Date.now(), model: j0._model, modelName: OM.modelName(j0._model), modelHours: OM.modelHours(j0._model), source: 'Open-Meteo · openAIP', fetched: j0._fetched,
    totalKm: track.totalKm, ok: track.ok, cut: !track.ok && endMs < plannedEndMs - 15 * 60000, track: { points: track.points }, waypoints: wps, relief, water: water || waterRuns(relief), waterSource: waterSource || 'heuristic', hours, sun, airspaces, firs, fis, hazards: hz, errors,
    startMs: b.time.startMs, endMs, plannedEndMs, durationMin, tz: b.site.tz || 'Europe/Zurich',
  };
  return p.data;
}

/** Bahn mit anderen Punkten neu rechnen, ohne alle Quellen neu zu holen (Prognosen sind im Memo). */
export async function recomputeTrack(ctx, b) { return buildProfileData(ctx, b); }
