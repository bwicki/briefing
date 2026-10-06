/* Fahrtbriefing — Höhenprofil, Etappen und Ballastmodell der Gasfahrt (0.12).
 *
 * Reine Funktionen ohne DOM (testbar in test/calc.test.mjs). Das Profil ist eine Folge von
 * Punkten (km entlang der zusammengesetzten Bahn, Höhe m AMSL); die Bahn (`track`) liefert die
 * Kopplung km ↔ Zeit und Ort (aus den Trajektorien je Höhe, js/auto/profiledata.js). Das
 * Ballastmodell folgt der Aerostatik nach Emden (DFSV-Handbuch 2.10) und «Gone with the Wind»
 * Kap. 4 – Herleitung in docs/Aerostatik_Gasballon.md: Manöver (Widerstandszahl × Rate²),
 * Abblasen über der Prallhöhe (1 % je 80 m), Temperaturgesetz 4 (0,4 % des Auftriebs je K)
 * und Adiabatik beim schnellen Steigen.
 */

export const RATE_OK = 1.75, RATE_WARN = 3.0, RATE_HOLD = 0.5;
const ISA_RHO0 = 1.225;
/** Luftdichte ISA in Höhe h (m). */
export const rhoAir = (h) => ISA_RHO0 * Math.pow(Math.max(0, 1 - h / 44330), 4.256);
/** Dichteverhältnis Gas/Luft (gleicher Druck, gleiche Temperatur): H₂ 0.0695, He 0.138. */
const GAS_RATIO = { H2: 0.0695, He: 0.138 };

// ---------------------------------------------------------------- Datenmodell
/** b.profile anlegen/ergänzen (nur Gasballon sinnvoll, Struktur für alle). */
export function ensureProfile(b) {
  if (!b.profile) b.profile = {};
  const p = b.profile;
  if (!Array.isArray(p.points)) p.points = [];
  if (!Array.isArray(p.stages)) p.stages = [];
  if (!p.layers) p.layers = { wx: true, as: true };
  if (!p.base) p.base = 'neutral';
  if (p.data === undefined) p.data = null;
  return p;
}
/** Standardprofil: Start am Boden, Steigen auf Reiseflughöhe innerhalb 2 km, Halten, Sinken ab km −6 auf die Landehöhe. */
export function defaultPoints(siteAlt, cruiseAlt, totalKm, landAlt = siteAlt) {
  const T = Math.max(10, Math.round(totalKm));
  const cruise = Math.max(siteAlt + 300, Math.round(cruiseAlt / 50) * 50);
  return [{ km: 0, alt: Math.round(siteAlt) }, { km: 2, alt: cruise }, { km: Math.max(3, T - 6), alt: cruise }, { km: T, alt: Math.round(landAlt) }];
}
export const defaultStages = (names = { start: 'Start', enroute: 'Enroute', landing: 'Landung' }, totalKm = 100) => [
  { id: 's1', km: 0, name: names.start }, { id: 's2', km: Math.round(totalKm * 0.15), name: names.enroute }, { id: 's3', km: Math.round(totalKm * 0.85), name: names.landing },
];
/** Punkte auf die Bahnlänge anpassen: sortieren, erster Punkt bei 0 km, letzter bei totalKm; Zwischenpunkte jenseits entfernen. */
export function fitPoints(points, totalKm) {
  const T = Math.max(1, Math.round(totalKm * 10) / 10);
  let pts = (points || []).map((p) => ({ km: Math.max(0, +p.km || 0), alt: Math.round(+p.alt || 0) })).sort((a, b) => a.km - b.km);
  if (!pts.length) return pts;
  pts[0].km = 0;
  if (pts.length === 1) return pts;
  const last = pts[pts.length - 1];
  pts = pts.slice(0, -1).filter((p, i) => i === 0 || p.km < T - 0.5);
  pts.push({ km: T, alt: last.alt });
  for (let i = 1; i < pts.length; i++) if (pts[i].km <= pts[i - 1].km) pts[i].km = pts[i - 1].km + 0.1;
  return pts;
}

// ---------------------------------------------------------------- Interpolation
const lerp = (a, b, t) => a + (b - a) * t;
/** Höhe m AMSL an km (linear zwischen den Punkten, ausserhalb geklemmt). */
export function altAt(points, km) {
  const p = points; if (!p?.length) return null;
  if (km <= p[0].km) return p[0].alt;
  for (let i = 1; i < p.length; i++) if (km <= p[i].km) { const a = p[i - 1], b = p[i]; return b.km > a.km ? lerp(a.alt, b.alt, (km - a.km) / (b.km - a.km)) : b.alt; }
  return p[p.length - 1].alt;
}
/** Allgemeine Interpolation auf einer nach `x` sortierten Liste: Wert `y` an x (ausserhalb: Rand bzw. lineare Fortsetzung am Ende). */
function interp(list, xKey, yKey, x, extrapolate = false) {
  if (!list?.length) return null;
  if (x <= list[0][xKey]) return list[0][yKey];
  for (let i = 1; i < list.length; i++) if (x <= list[i][xKey]) { const a = list[i - 1], b = list[i]; const d = b[xKey] - a[xKey]; return d > 0 ? lerp(a[yKey], b[yKey], (x - a[xKey]) / d) : b[yKey]; }
  const n = list.length;
  if (extrapolate && n >= 2) { const a = list[n - 2], b = list[n - 1]; const d = b[xKey] - a[xKey]; return d > 0 ? b[yKey] + (b[yKey] - a[yKey]) * (x - b[xKey]) / d : b[yKey]; }
  return list[n - 1][yKey];
}
/** Zeit (ms) an km entlang der Bahn. */
export const msAtKm = (track, km) => interp(track?.points, 'km', 'ms', km, true);
/** km an Zeit (ms). */
export const kmAtMs = (track, ms) => interp(track?.points, 'ms', 'km', ms, true);
/** Ort an km. */
export function posAtKm(track, km) { const p = track?.points; if (!p?.length) return null; return { lat: interp(p, 'km', 'lat', km), lon: interp(p, 'km', 'lon', km) }; }
/** Geländehöhe an km (relief: [{km, m}]). */
export const reliefAt = (relief, km) => interp(relief, 'km', 'm', km);

// ---------------------------------------------------------------- Wasserflächen (Heuristik)
/**
 * Wasserflächen im Reliefprofil (Heuristik): das Höhenmodell (Copernicus DEM) zeigt Seen als exakt ebene Flächen –
 * Läufe von ≥ minKm km mit gleicher Höhe (±1 m) werden als Wasser markiert [{km0, km1, m}]. Ebene Landflächen können
 * mitgezählt werden (Legende nennt die Heuristik); Abgleich mit OSM-Wasserflächen: 0.12.x.
 */
export function waterRuns(relief, minKm = 3) {
  const out = []; let run = null;
  for (let i = 0; i < (relief || []).length; i++) {
    const r = relief[i];
    if (run && Math.abs(r.m - run.m) <= 1) { run.km1 = r.km; continue; }
    if (run && run.km1 - run.km0 >= minKm) out.push({ ...run });
    run = { km0: r.km, km1: r.km, m: r.m };
  }
  if (run && run.km1 - run.km0 >= minKm) out.push(run);
  return out.filter((w) => w.m > 0);
}

// ---------------------------------------------------------------- Teilstücke, Raten
/** Teilstücke mit Steig-/Sinkrate in m/s (Zeit aus der Bahn). */
export function segments(points, track) {
  const out = [];
  for (let i = 1; i < (points?.length || 0); i++) {
    const a = points[i - 1], b = points[i];
    const ms0 = msAtKm(track, a.km), ms1 = msAtKm(track, b.km);
    const dt = ms0 != null && ms1 != null ? (ms1 - ms0) / 1000 : 0;
    const rate = dt > 0 ? (b.alt - a.alt) / dt : 0;
    out.push({ i, km0: a.km, km1: b.km, alt0: a.alt, alt1: b.alt, ms0, ms1, dtMin: dt / 60, rate: Math.round(rate * 100) / 100 });
  }
  return out;
}
/** Klasse der Rate: hold (< 0,5), ok (≤ 1,75), warn (≤ 3), bad. */
export const rateClass = (r) => { const a = Math.abs(r); return a < RATE_HOLD ? 'hold' : a <= RATE_OK ? 'ok' : a <= RATE_WARN ? 'warn' : 'bad'; };

/** Abschnitte, in denen das Profil weniger als minAgl über dem Relief liegt (Start-/Landeanflug ausgenommen). */
export function reliefBreaches(points, relief, o = {}) {
  const minAgl = o.minAgl ?? 300, skipStart = o.skipStart ?? 4, skipEnd = o.skipEnd ?? 5;
  if (!points?.length || !relief?.length) return [];
  const T = points[points.length - 1].km;
  const out = []; let run = null;
  for (let k = skipStart; k <= T - skipEnd; k += 1) {
    const low = altAt(points, k) < reliefAt(relief, k) + minAgl;
    if (low && run == null) run = k;
    if (!low && run != null) { out.push({ km0: run, km1: k }); run = null; }
  }
  if (run != null) out.push({ km0: run, km1: Math.round(T - skipEnd) });
  return out;
}

// ---------------------------------------------------------------- Etappen
let seq = 0;
const newId = () => `st${Date.now().toString(36)}${(seq++).toString(36)}`;
export const sortStages = (stages) => stages.sort((a, b) => a.km - b.km);
/** Etappe bei km einfügen (Name optional); Nummerierung ergibt sich aus der Reihenfolge. */
export function addStage(stages, km, name = '', minGap = 2) {
  if (stages.some((s) => Math.abs(s.km - km) < minGap)) return null;
  const s = { id: newId(), km: Math.round(km), name };
  stages.push(s); sortStages(stages); return s;
}
/** Etappe löschen: 'prev' = Vorgänger übernimmt den Abschnitt, 'next' = Nachfolger beginnt hier. */
export function removeStage(stages, idx, mode) {
  if (idx < 0 || idx >= stages.length) return false;
  if (mode === 'prev') { if (idx === 0) return false; stages.splice(idx, 1); return true; }
  if (mode === 'next') { if (idx >= stages.length - 1) return false; stages[idx + 1].km = stages[idx].km; stages.splice(idx, 1); return true; }
  return false;
}
/** Etappengrenze verschieben (zwischen Vorgänger und Nachfolger, Startgrenze fest bei 0). */
export function moveStage(stages, idx, km, totalKm, minGap = 2) {
  if (idx <= 0 || idx >= stages.length) return stages[idx]?.km ?? 0;
  const lo = stages[idx - 1].km + minGap, hi = (stages[idx + 1]?.km ?? totalKm) - minGap;
  stages[idx].km = Math.round(Math.max(lo, Math.min(hi, km)));
  return stages[idx].km;
}
/** Etappenfenster: Nummer, km-/Zeit-Bereich, Höhenband, Orte. */
export function stageWindows(stages, track, points, totalKm) {
  const T = totalKm ?? (points?.length ? points[points.length - 1].km : track?.totalKm ?? 0);
  return (stages || []).map((s, i, a) => {
    const km0 = s.km, km1 = a[i + 1]?.km ?? T;
    let altMin = Infinity, altMax = -Infinity;
    for (let k = km0; k <= km1; k += 0.5) { const h = altAt(points, k); if (h == null) continue; altMin = Math.min(altMin, h); altMax = Math.max(altMax, h); }
    for (const p of points || []) if (p.km > km0 && p.km < km1) { altMin = Math.min(altMin, p.alt); altMax = Math.max(altMax, p.alt); }
    return { no: i + 1, id: s.id, name: s.name, km0, km1, ms0: msAtKm(track, km0), ms1: msAtKm(track, km1), altMin: isFinite(altMin) ? Math.round(altMin) : null, altMax: isFinite(altMax) ? Math.round(altMax) : null, from: posAtKm(track, km0), to: posAtKm(track, km1) };
  });
}

// ---------------------------------------------------------------- Sonne entlang der Bahn
/** Nachtanteil 0…1 zur Zeit ms aus den Ereignissen [{kind:'ecet'|'bcmt', ms}] (Übergang ±1 h). */
export function nightFraction(events, ms, transH = 1) {
  const ev = (events || []).filter((e) => e.kind === 'ecet' || e.kind === 'bcmt').sort((a, b) => a.ms - b.ms);
  const H = transH * 3600000;
  let night = ev.length && ev[0].kind === 'bcmt' ? 1 : 0;   // vor dem ersten Ereignis: Nacht, wenn das erste Ereignis ein BCMT ist
  for (const e of ev) {
    if (ms < e.ms - H) break;
    const f = Math.max(0, Math.min(1, (ms - (e.ms - H)) / (2 * H)));
    night = e.kind === 'ecet' ? f : 1 - f;
  }
  return night;
}

// ---------------------------------------------------------------- Ballastmodell (Emden / GWTW)
/**
 * ballastPlan(points, track, o)
 * o: { volume (m³), fillFraction (0–1), gas ('H2'|'He'), siteAlt (m), wz (Widerstandszahl kg·s²/m² bei ρ₀),
 *      aero: { dtDayClear, dtNightClear, dtDayOvercast, dtNightOvercast, liftPctPerK, fullLossPctPer80m },
 *      lapse (K/100 m, Vorgabe 0.65), landingKg, availKg,
 *      nightAt(ms) → 0…1, overcastAt(ms) → 0…1 }
 * Rückgabe: { rows:[{km0,km1,alt0,alt1,ms0,ms1,rate,man,blow,temp,gain,adia,kg}], sum, gain, landingKg, total, availKg, pct, prallH, kgPerK1000 }
 */
export function ballastPlan(points, track, o) {
  const V = +o.volume || 1000, fg = Math.min(1.2, Math.max(0.3, +o.fillFraction || 1)), ratio = GAS_RATIO[o.gas] ?? GAS_RATIO.H2;
  const a = { dtDayClear: 15, dtNightClear: -3, dtDayOvercast: 5, dtNightOvercast: -1, liftPctPerK: 0.4, fullLossPctPer80m: 1, ...(o.aero || {}) };
  const lapse = o.lapse ?? 0.65, wz0 = o.wz || (V >= 1000 ? 3.8 : 3.5);
  const buoy = (h) => rhoAir(h) * V;                                       // Auftrieb des vollen Volumens (kg)
  const kgPerK = (h) => buoy(h) * a.liftPctPerK / 100;                     // Temperaturgesetz 4
  const lift = (h) => buoy(h) * (1 - ratio);                               // Tragfähigkeit prall in Höhe h
  const nightAt = o.nightAt || (() => 0), overcastAt = o.overcastAt || (() => 0);
  const dT = (ms) => { const n = nightAt(ms), c = overcastAt(ms); const day = lerp(a.dtDayClear, a.dtDayOvercast, c), night = lerp(a.dtNightClear, a.dtNightOvercast, c); return lerp(day, night, n); };
  const h0 = points?.[0]?.alt ?? o.siteAlt ?? 0;
  // Prallhöhe aus dem Füllungsgrad (Höhenzahl n = 1/FG): ρ(h_p) = FG · ρ(h₀)
  let pH = h0; if (fg < 1) { while (pH < 12000 && rhoAir(pH) > fg * rhoAir(h0)) pH += 10; }
  const prallH0 = pH;
  const rows = []; let sum = 0, gain = 0;
  for (const s of segments(points, track)) {
    const dh = s.alt1 - s.alt0, hm = (s.alt0 + s.alt1) / 2, v = Math.max(Math.abs(s.rate), 1.0);
    const wz = wz0 * rhoAir(hm) / ISA_RHO0;
    const man = Math.abs(dh) >= 50 ? wz * v * v * (dh < 0 ? 1.3 : 1) : 0;        // Steigen einleiten / Sinken abfangen (30 % Überwerfen)
    let blow = 0; if (s.alt1 > pH) { blow = lift(pH) * (a.fullLossPctPer80m / 100) * (s.alt1 - Math.max(s.alt0, pH)) / 80; pH = s.alt1; }
    // Temperatur Gas–Luft: Verlauf innerhalb des Teilstücks stundenweise abtasten – Abkühlung kostet Ballast, Erwärmung gibt Auftrieb
    let temp = 0, g = 0;
    if (s.ms0 != null && s.ms1 != null && s.ms1 > s.ms0) {
      let prev = dT(s.ms0);
      for (let ms = s.ms0 + 1800000; ms <= s.ms1 + 1799999; ms += 1800000) { const cur = dT(Math.min(ms, s.ms1)); const d = (cur - prev) * kgPerK(hm); if (d < 0) temp -= d; else g += d; prev = cur; }
    }
    gain += g;
    const adia = dh >= 50 ? Math.max(0, (1.0 - lapse) * dh / 100 * kgPerK(hm) * Math.min(1, Math.max(0, (v - 0.3) / 1.2))) : 0;
    const kg = man + blow + temp + adia; sum += kg;
    rows.push({ ...s, man: r1(man), blow: r1(blow), temp: r1(temp), gain: r1(g), adia: r1(adia), kg: r1(kg) });
  }
  const landingKg = +o.landingKg || 0, total = sum + landingKg, availKg = o.availKg != null ? +o.availKg : null;
  return { rows, sum: r1(sum), gain: r1(gain), landingKg, total: r1(total), availKg, pct: availKg ? Math.round(total / availKg * 100) : null, prallH: prallH0, kgPerK1000: r1(kgPerK(1000)), liftStart: r1(lift(h0)) };
}
const r1 = (x) => Math.round(x * 10) / 10;

// ---------------------------------------------------------------- Wetter-Auslöser (Achtung-Zeichen)
/**
 * Signifikantes Wetter aus den Stundenprofilen entlang der Bahn: hours [{ms, km, alt (geplante Höhe), ground, windKt (in Fahrthöhe),
 * shearKt (Windsprung zu benachbarten Flächen), cape, tempAtAlt, rhAtAlt, fogRisk, precip}].
 * Grenzen: windKt ≥ lim.windKt (Vorgabe 30), shearKt ≥ lim.shearKt (20), cape ≥ lim.cape (500), Nebel ≥ 2 (nur ≤ 600 m über Grund),
 * Niederschlag ≥ 0.5 mm, Vereisung T ≤ 0 und RH ≥ 90. Rückgabe [{type, km, kmEnd, alt, ms, msEnd, lbl, txt}].
 */
export function hazards(hours, lim = {}) {
  const L = { windKt: 30, shearKt: 20, cape: 500, fog: 2, precip: 0.5, ...lim };
  const out = [], last = {};
  // anhaltende Bedingung (gleiche Art, Lücke ≤ 2 h) → ein Zeichen am Beginn, Abschnitt bis kmEnd
  const push = (type, h, lbl, txt) => {
    const prev = last[type];
    if (prev && h.ms - prev.msEnd <= 2 * 3600000) { prev.kmEnd = h.km; prev.msEnd = h.ms; return; }
    const it = { type, km: h.km, kmEnd: h.km, alt: h.alt, ms: h.ms, msEnd: h.ms, lbl, txt }; out.push(it); last[type] = it;
  };
  for (const h of hours || []) {
    if (h.windKt != null && h.windKt >= L.windKt) push('wind', h, `Wind ${Math.round(h.windKt)} kt`, `Wind ${Math.round(h.windKt)} kt in ${Math.round(h.alt)} m`);
    if (h.shearKt != null && h.shearKt >= L.shearKt) push('shear', h, 'Scherung', `Windsprung ${Math.round(h.shearKt)} kt zwischen benachbarten Schichten`);
    if (h.cape != null && h.cape >= L.cape) push('cb', h, 'CB-Neigung', `CAPE ${Math.round(h.cape)} J/kg`);
    // Nebel nur, wenn die Fahrthöhe nahe am Boden liegt (Start/Landung, tiefe Fahrt)
    if (h.fogRisk != null && h.fogRisk >= L.fog && (h.ground == null || h.alt - h.ground <= 600)) push('fog', h, 'Nebel', `Nebelrisiko ${h.fogRisk}/3`);
    if (h.precip != null && h.precip >= L.precip) push('rain', h, 'Niederschlag', `${h.precip} mm/h`);
    if (h.tempAtAlt != null && h.rhAtAlt != null && h.tempAtAlt <= 0 && h.rhAtAlt >= 90) push('ice', h, 'Vereisung', `T ${h.tempAtAlt.toFixed(0)} °C, RH ${Math.round(h.rhAtAlt)} % in Fahrthöhe`);
  }
  return out.sort((a, b) => a.km - b.km);
}
