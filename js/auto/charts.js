/* Fahrtbriefing — SVG-Grafiken: Windfahnen, Höhenwindprofil, Stüve-Diagramm,
 * Meteogramm. Windfahnen und Stüve sind aus GaforCast übernommen (js/wind.js,
 * js/stueve.js) und als ES-Modul gefasst; Farben über CSS-Variablen, damit
 * Druck und Dunkelmodus stimmen.
 */
import { MS_TO_KT } from './openmeteo.js';

const NS = 'http://www.w3.org/2000/svg';
export const mk = (tag, attrs, txt) => { const n = document.createElementNS(NS, tag); for (const k in attrs || {}) n.setAttribute(k, attrs[k]); if (txt != null) n.textContent = txt; return n; };
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
let uid = 0;

/** Windfahne (Luftfahrt: Schaft zeigt in den Wind) als Pfadstücke, Schaft nach oben. */
export function barb(kt) {
  const L = 20, step = 3.4; const out = [];
  if (kt == null || !isFinite(kt)) return out;
  let k = Math.round(kt / 5) * 5;
  if (k < 5) return [{ circle: true }];
  out.push({ d: `M0,0 L0,${-L}`, fill: false });
  let y = -L, drew = false;
  while (k >= 50) { out.push({ d: `M0,${y} L-10,${y + 2.5} L0,${y + 5} Z`, fill: true }); y += 5.8; k -= 50; drew = true; }
  while (k >= 10) { out.push({ d: `M0,${y} L-10,${y - 3.4}`, fill: false }); y += step; k -= 10; drew = true; }
  if (k >= 5) { if (!drew) y += step; out.push({ d: `M0,${y} L-5.5,${y - 1.9}`, fill: false }); }
  return out;
}
function barbGroup(x, y, spdMs, dir, cls) {
  const g = mk('g', { transform: `translate(${x.toFixed(1)},${y.toFixed(1)}) rotate(${dir == null ? 0 : dir})`, class: cls });
  for (const part of barb(spdMs * MS_TO_KT)) {
    if (part.circle) { g.appendChild(mk('circle', { r: 3, cx: 0, cy: 0, class: 'calm' })); continue; }
    g.appendChild(mk('path', { d: part.d, class: part.fill ? 'fill' : '' }));
  }
  return g;
}

/** Höhenwindprofil: levels [{ft, spd (m/s), dir}] oben→unten. */
export function windChart(levels, o = {}) {
  const pts = levels.filter((l) => l.spd != null && isFinite(l.ft));
  if (pts.length < 2) return null;
  const W = Math.max(180, Math.round(o.w || 260)), H = Math.max(200, Math.round(o.h || 310));
  const PAD_L = 34, PAD_R = 26, PAD_T = 16, PAD_B = 34;
  const topFt = Math.ceil(Math.max(...pts.map((p) => p.ft)) / 1000) * 1000;
  const botFt = Math.floor(Math.min(o.groundFt != null ? o.groundFt : pts[pts.length - 1].ft, ...pts.map((p) => p.ft)) / 500) * 500;
  const maxV = Math.max(10, Math.ceil(Math.max(...pts.map((p) => p.spd * MS_TO_KT)) / 10) * 10);
  const padFt = ((topFt - botFt) || 1000) * 0.12, lo = botFt - padFt, hi = topFt + padFt;
  const x = (v) => PAD_L + (v / maxV) * (W - PAD_L - PAD_R);
  const y = (ft) => PAD_T + (1 - (ft - lo) / (hi - lo)) * (H - PAD_T - PAD_B);
  const svg = mk('svg', { viewBox: `0 0 ${W} ${H}`, class: 'wp-svg', role: 'img' });
  const minor = mk('g', { class: 'wp-grid minor' }), grid = mk('g', { class: 'wp-grid' });
  const vStep = maxV > 60 ? 20 : 10;
  for (let v = 0; v <= maxV; v += vStep / 2) {
    (v % vStep === 0 ? grid : minor).appendChild(mk('line', { x1: x(v), y1: PAD_T, x2: x(v), y2: H - PAD_B }));
    if (v % vStep === 0) svg.appendChild(mk('text', { x: x(v), y: H - PAD_B + 11, class: 'wp-ax', 'text-anchor': 'middle' }, String(v)));
  }
  const span = topFt - botFt, stepFt = span > 14000 ? 4000 : span > 7000 ? 2000 : 1000;
  for (let ft = Math.ceil(botFt / (stepFt / 2)) * (stepFt / 2); ft <= topFt; ft += stepFt / 2) {
    const major = Math.abs(ft % stepFt) < 1;
    (major ? grid : minor).appendChild(mk('line', { x1: PAD_L, y1: y(ft), x2: W - PAD_R, y2: y(ft) }));
    if (major) svg.appendChild(mk('text', { x: PAD_L - 4, y: y(ft) + 3, class: 'wp-ax', 'text-anchor': 'end' }, ft >= 1000 ? `${(ft / 1000).toFixed(0)}k` : String(ft)));
  }
  svg.append(minor, grid);
  svg.appendChild(mk('text', { x: W - PAD_R, y: H - PAD_B + 22, class: 'wp-ax', 'text-anchor': 'end' }, 'kt'));
  svg.appendChild(mk('text', { x: 2, y: PAD_T - 4, class: 'wp-ax' }, 'ft'));
  const marker = (ft, label, cls) => { if (ft == null || ft < botFt || ft > topFt) return; svg.appendChild(mk('line', { x1: PAD_L, y1: y(ft), x2: W - PAD_R, y2: y(ft), class: 'wp-mark ' + cls })); svg.appendChild(mk('text', { x: W - PAD_R - 2, y: y(ft) - 4, class: 'wp-mlab ' + cls, 'text-anchor': 'end' }, label)); };
  marker(o.pblFt, o.lang === 'en' ? 'PBL' : 'Grenzschicht', 'pbl'); marker(o.fzlFt, '0 °C', 'fzl');
  for (const [ft, label] of o.marks || []) marker(ft, label, 'lvl');
  svg.appendChild(mk('polyline', { points: pts.map((p) => `${x(p.spd * MS_TO_KT).toFixed(1)},${y(p.ft).toFixed(1)}`).join(' '), class: 'wp-line' }));
  for (const p of pts) { svg.appendChild(barbGroup(x(p.spd * MS_TO_KT), y(p.ft), p.spd, p.dir, 'wp-barb')); svg.appendChild(mk('circle', { cx: x(p.spd * MS_TO_KT), cy: y(p.ft), r: 1.8, class: 'wp-dot' })); }
  return svg;
}

/** Stüve-Diagramm mit Windfeld. levels [{hPa, ft, m, spd, dir, temp, dew, rh}] oben→unten. */
export function stueveChart(levels, o = {}) {
  const KAPPA = 0.2857, fp = (p) => Math.pow(p / 1000, KAPPA);
  const PAD_T = 14, PAD_B = 30, PAD_L = 74, PAD_R = 30, GAP = 26, ALT_X = 34, SPLIT = 0.66, RH_START = 85, RH_MAX_ALPHA = 0.42;
  const rhAlpha = (rh) => (rh == null || rh <= RH_START ? 0 : RH_MAX_ALPHA * Math.min(1, (rh - RH_START) / (100 - RH_START)));
  const lv = levels.filter((l) => l.hPa != null && l.temp != null);
  if (lv.length < 3) return null;
  const near = levels.filter((l) => l.hPa == null && l.spd != null);
  const W = Math.max(300, Math.round(o.w || 520)), H = Math.max(240, Math.round(o.h || 340));
  const id = 'sv' + (++uid);
  const pTop = Math.min(...lv.map((l) => l.hPa)), pBot = Math.max(...lv.map((l) => l.hPa));
  const fTop = fp(pTop), fBot = fp(pBot);
  const temps = lv.concat(near).flatMap((l) => [l.temp, l.dew]).filter((v) => v != null && isFinite(v));
  let tMin = Math.floor((Math.min(...temps) - 4) / 10) * 10, tMax = Math.ceil((Math.max(...temps) + 4) / 10) * 10;
  if (tMax - tMin < 30) tMax = tMin + 30;
  const plotT = PAD_T, plotB = H - PAD_B, plotH = plotB - plotT;
  const sL = PAD_L, sR = PAD_L + (W - PAD_L - PAD_R - GAP) * SPLIT, wL = sR + GAP, wR = W - PAD_R;
  const fPad = (fBot - fTop) * 0.06, fLo = fTop - fPad, fHi = fBot + fPad;
  const y = (p) => plotT + ((fp(p) - fLo) / (fHi - fLo || 1)) * plotH;
  const yFt = (ft) => { const s = [...lv].sort((a, b) => a.ft - b.ft); if (ft <= s[0].ft) return y(s[0].hPa); if (ft >= s[s.length - 1].ft) return y(s[s.length - 1].hPa); for (let i = 1; i < s.length; i++) if (ft <= s[i].ft) { const t = (ft - s[i - 1].ft) / ((s[i].ft - s[i - 1].ft) || 1); return y(s[i - 1].hPa) + t * (y(s[i].hPa) - y(s[i - 1].hPa)); } return y(s[s.length - 1].hPa); };
  const xT = (t) => sL + ((t - tMin) / (tMax - tMin)) * (sR - sL);
  const yOf = (l) => (l.hPa != null ? y(l.hPa) : yFt(l.ft));
  const svg = mk('svg', { viewBox: `0 0 ${W} ${H}`, class: 'sv-svg', role: 'img' });
  const defs = mk('defs');
  const clip = mk('clipPath', { id: `${id}-clip` }); clip.appendChild(mk('rect', { x: sL, y: plotT, width: sR - sL, height: plotH })); defs.appendChild(clip);
  const stops = [...lv].sort((a, b) => a.hPa - b.hPa);
  if (stops.some((l) => rhAlpha(l.rh) > 0)) {
    const grad = mk('linearGradient', { id: `${id}-rh`, x1: 0, y1: 0, x2: 0, y2: 1 });
    for (const l of stops) grad.appendChild(mk('stop', { offset: `${(clamp((y(l.hPa) - plotT) / (plotH || 1), 0, 1) * 100).toFixed(2)}%`, 'stop-color': 'var(--sv-humid)', 'stop-opacity': rhAlpha(l.rh).toFixed(3) }));
    defs.appendChild(grad);
  }
  svg.appendChild(defs);
  const grid = mk('g', { class: 'sv-grid' }), minor = mk('g', { class: 'sv-grid minor' });
  const tStep = (tMax - tMin) > 70 ? 20 : 10;
  for (let t = tMin; t <= tMax; t += tStep) { (t === 0 ? grid : minor).appendChild(mk('line', { x1: xT(t), y1: plotT, x2: xT(t), y2: plotB, class: t === 0 ? 'sv-zero' : '' })); svg.appendChild(mk('text', { x: xT(t), y: plotB + 12, class: 'sv-ax', 'text-anchor': 'middle' }, String(t))); }
  const ad = mk('g', { class: 'sv-adiabat', 'clip-path': `url(#${id}-clip)` });
  for (let th = -60; th <= 160; th += 20) { const pts = [pBot, pTop].map((p) => [xT((th + 273.15) * fp(p) - 273.15), y(p)]); if (pts.every((q) => q[0] < sL - 2) || pts.every((q) => q[0] > sR + 2)) continue; ad.appendChild(mk('line', { x1: pts[0][0], y1: pts[0][1], x2: pts[1][0], y2: pts[1][1] })); }
  svg.appendChild(ad);
  for (const l of stops) { grid.appendChild(mk('line', { x1: sL, y1: y(l.hPa), x2: wR, y2: y(l.hPa) })); svg.appendChild(mk('text', { x: sL - 5, y: y(l.hPa) + 3, class: 'sv-ax', 'text-anchor': 'end' }, String(l.hPa))); if (l.ft != null) svg.appendChild(mk('text', { x: sL - ALT_X, y: y(l.hPa) + 3, class: 'sv-ax sv-alt', 'text-anchor': 'end' }, String(Math.round(l.ft)))); }
  svg.insertBefore(minor, svg.firstChild.nextSibling); svg.insertBefore(grid, minor.nextSibling);
  if (defs.querySelector('linearGradient')) svg.appendChild(mk('rect', { x: sL, y: plotT, width: sR - sL, height: plotH, fill: `url(#${id}-rh)` }));
  svg.appendChild(mk('rect', { x: sL, y: plotT, width: sR - sL, height: plotH, class: 'sv-frame' }));
  const curve = (key, cls, label) => {
    const pts = stops.concat(near.filter((l) => l[key] != null)).filter((l) => l[key] != null && isFinite(l[key])).sort((a, b) => yOf(a) - yOf(b));
    if (pts.length < 2) return;
    svg.appendChild(mk('polyline', { points: pts.map((l) => `${xT(clamp(l[key], tMin, tMax)).toFixed(1)},${yOf(l).toFixed(1)}`).join(' '), class: `sv-curve ${cls}` }));
    for (const l of pts) svg.appendChild(mk('circle', { cx: xT(clamp(l[key], tMin, tMax)), cy: yOf(l), r: 1.7, class: `sv-dot ${cls}` }));
    const top = pts[0]; svg.appendChild(mk('text', { x: clamp(xT(clamp(top[key], tMin, tMax)) + 4, sL + 3, sR - 14), y: clamp(yOf(top) - 4, plotT + 9, plotB - 3), class: `sv-lab ${cls}` }, label));
  };
  curve('dew', 'dew', 'Td'); curve('temp', 'temp', 'T');
  const mark = (ft, label, cls) => { if (ft == null) return; const yy = yFt(ft); if (yy < plotT - 1 || yy > plotB + 1) return; svg.appendChild(mk('line', { x1: sL, y1: yy, x2: wR, y2: yy, class: 'sv-mark ' + cls })); svg.appendChild(mk('text', { x: wR - 2, y: yy - 3, class: 'sv-mlab ' + cls, 'text-anchor': 'end' }, label)); };
  mark(o.pblFt, o.lang === 'en' ? 'PBL' : 'Grenzschicht', 'pbl'); mark(o.fzlFt, '0 °C', 'fzl');
  const wind = lv.filter((l) => l.spd != null).concat(near).sort((a, b) => yOf(a) - yOf(b));
  const maxV = Math.max(10, Math.ceil(Math.max(...wind.map((l) => l.spd * MS_TO_KT)) / 10) * 10);
  const wIn = 10, xW = (v) => wL + wIn + (v / maxV) * (wR - wL - wIn), vStep = maxV > 60 ? 20 : 10;
  for (let v = 0; v <= maxV; v += vStep / 2) { (v % vStep === 0 ? grid : minor).appendChild(mk('line', { x1: xW(v), y1: plotT, x2: xW(v), y2: plotB })); if (v % vStep === 0) svg.appendChild(mk('text', { x: xW(v), y: plotB + 12, class: 'sv-ax', 'text-anchor': 'middle' }, String(v))); }
  svg.appendChild(mk('rect', { x: wL, y: plotT, width: wR - wL, height: plotH, class: 'sv-frame' }));
  if (wind.length > 1) {
    svg.appendChild(mk('polyline', { points: wind.map((l) => `${xW(l.spd * MS_TO_KT).toFixed(1)},${yOf(l).toFixed(1)}`).join(' '), class: 'sv-wind' }));
    for (const l of wind) svg.appendChild(barbGroup(xW(l.spd * MS_TO_KT), yOf(l), l.spd, l.dir, 'sv-barb'));
  }
  svg.appendChild(mk('text', { x: sL, y: plotB + 24, class: 'sv-ax' }, '°C'));
  svg.appendChild(mk('text', { x: wR, y: plotB + 24, class: 'sv-ax', 'text-anchor': 'end' }, 'kt'));
  svg.appendChild(mk('text', { x: sL - 5, y: plotT - 4, class: 'sv-ax', 'text-anchor': 'end' }, 'hPa'));
  svg.appendChild(mk('text', { x: sL - ALT_X, y: plotT - 4, class: 'sv-ax sv-alt', 'text-anchor': 'end' }, 'ft AMSL'));
  return svg;
}

/**
 * Meteogramm: recs [{ms, temp, dew, w10, gust, d10, cloud, cloudLow, cloudMid, cloudHigh, precip, cape}],
 * o: { fromMs, toMs (Fahrtfenster), tz, hhmm(fn), light(fn ms→bool), w, rating(fn rec→0..2) }
 */
export function meteogram(recs, o = {}) {
  if (!recs?.length) return null;
  const W = o.w || 640, H = 300, L = 40, R = 40, T = 10, B = 26;
  const rows = [['temp', 90], ['wind', 70], ['cloud', 50], ['precip', 44]];
  const svg = mk('svg', { viewBox: `0 0 ${W} ${H}`, class: 'mg-svg', role: 'img' });
  const t0 = recs[0].ms, t1 = recs[recs.length - 1].ms;
  const x = (ms) => L + ((ms - t0) / ((t1 - t0) || 1)) * (W - L - R);
  const colW = (W - L - R) / Math.max(1, recs.length - 1);
  // Fahrtfenster + Nacht
  if (o.light) for (const r of recs) if (!o.light(r.ms)) svg.appendChild(mk('rect', { x: x(r.ms) - colW / 2, y: T, width: colW, height: H - T - B, class: 'mg-night' }));
  if (o.fromMs != null) svg.appendChild(mk('rect', { x: x(o.fromMs), y: T, width: Math.max(2, x(o.toMs) - x(o.fromMs)), height: H - T - B, class: 'mg-window' }));
  let yTop = T;
  const band = (h) => { const y0 = yTop; yTop += h; return [y0, y0 + h]; };
  // Temperatur / Taupunkt
  { const [y0, y1] = band(rows[0][1]);
    const vals = recs.flatMap((r) => [r.temp, r.dew]).filter((v) => v != null);
    const vMin = Math.floor((Math.min(...vals) - 2) / 5) * 5, vMax = Math.ceil((Math.max(...vals) + 2) / 5) * 5;
    const y = (v) => y1 - 4 - ((v - vMin) / ((vMax - vMin) || 1)) * (y1 - y0 - 8);
    for (let v = vMin; v <= vMax; v += 5) { svg.appendChild(mk('line', { x1: L, y1: y(v), x2: W - R, y2: y(v), class: 'mg-grid' })); svg.appendChild(mk('text', { x: L - 4, y: y(v) + 3, class: 'mg-ax', 'text-anchor': 'end' }, String(v))); }
    svg.appendChild(mk('polyline', { points: recs.filter((r) => r.dew != null).map((r) => `${x(r.ms).toFixed(1)},${y(r.dew).toFixed(1)}`).join(' '), class: 'mg-dew' }));
    svg.appendChild(mk('polyline', { points: recs.filter((r) => r.temp != null).map((r) => `${x(r.ms).toFixed(1)},${y(r.temp).toFixed(1)}`).join(' '), class: 'mg-temp' }));
    svg.appendChild(mk('text', { x: W - R + 4, y: y0 + 10, class: 'mg-ax' }, '°C T/Td'));
  }
  // Wind
  { const [y0, y1] = band(rows[1][1]);
    const vMax = Math.max(10, Math.ceil(Math.max(...recs.map((r) => (r.gust ?? r.w10 ?? 0) * MS_TO_KT)) / 5) * 5);
    const y = (v) => y1 - 2 - (v / vMax) * (y1 - y0 - 14);
    for (const v of [0, vMax / 2, vMax]) { svg.appendChild(mk('line', { x1: L, y1: y(v), x2: W - R, y2: y(v), class: 'mg-grid' })); svg.appendChild(mk('text', { x: L - 4, y: y(v) + 3, class: 'mg-ax', 'text-anchor': 'end' }, String(Math.round(v)))); }
    for (const r of recs) { if (r.gust != null) svg.appendChild(mk('rect', { x: x(r.ms) - colW * 0.3, y: y(r.gust * MS_TO_KT), width: colW * 0.6, height: Math.max(0, y(0) - y(r.gust * MS_TO_KT)), class: 'mg-gust' })); if (r.w10 != null) svg.appendChild(mk('rect', { x: x(r.ms) - colW * 0.3, y: y(r.w10 * MS_TO_KT), width: colW * 0.6, height: Math.max(0, y(0) - y(r.w10 * MS_TO_KT)), class: 'mg-wind' })); }
    for (const r of recs) if (r.w10 != null && r.d10 != null) svg.appendChild(barbGroup(x(r.ms), y0 + 16, r.w10, r.d10, 'mg-barb'));
    svg.appendChild(mk('text', { x: W - R + 4, y: y0 + 10, class: 'mg-ax' }, 'kt Wind/Böen'));
  }
  // Bewölkung
  { const [y0, y1] = band(rows[2][1]);
    const hh = (y1 - y0 - 6) / 3;
    recs.forEach((r) => { [['cloudHigh', 0], ['cloudMid', 1], ['cloudLow', 2]].forEach(([k, j]) => { const v = r[k]; if (v == null) return; svg.appendChild(mk('rect', { x: x(r.ms) - colW / 2, y: y0 + 3 + j * hh, width: colW, height: hh, class: 'mg-cloud', style: `fill-opacity:${(v / 100 * 0.85).toFixed(2)}` })); }); });
    svg.appendChild(mk('text', { x: W - R + 4, y: y0 + 10, class: 'mg-ax' }, 'Wolken h/m/l'));
  }
  // Niederschlag + CAPE
  { const [y0, y1] = band(rows[3][1]);
    const pMax = Math.max(1, Math.ceil(Math.max(...recs.map((r) => r.precip || 0))));
    const y = (v) => y1 - 2 - (v / pMax) * (y1 - y0 - 8);
    for (const r of recs) if (r.precip) svg.appendChild(mk('rect', { x: x(r.ms) - colW * 0.35, y: y(r.precip), width: colW * 0.7, height: Math.max(0, y(0) - y(r.precip)), class: 'mg-precip' }));
    svg.appendChild(mk('text', { x: L - 4, y: y(pMax) + 3, class: 'mg-ax', 'text-anchor': 'end' }, `${pMax}`));
    svg.appendChild(mk('text', { x: W - R + 4, y: y0 + 10, class: 'mg-ax' }, 'mm/h'));
    for (const r of recs) if (r.cape != null && r.cape >= 300) svg.appendChild(mk('text', { x: x(r.ms), y: y0 + 10, class: 'mg-ax mg-cape', 'text-anchor': 'middle' }, '⚡'));
  }
  // Zeitachse + Ampel
  for (const r of recs) {
    const d = new Date(r.ms); const hr = o.hhmm ? o.hhmm(r.ms) : `${d.getUTCHours()}`;
    const every = recs.length > 30 ? 3 : recs.length > 16 ? 2 : 1;
    const idx = recs.indexOf(r);
    if (idx % every === 0) svg.appendChild(mk('text', { x: x(r.ms), y: H - B + 12, class: 'mg-ax', 'text-anchor': 'middle' }, hr));
    if (o.rating) { const lv = o.rating(r); if (lv != null) svg.appendChild(mk('rect', { x: x(r.ms) - colW / 2 + 1, y: H - B + 16, width: Math.max(1, colW - 2), height: 6, class: `mg-fly f${lv}` })); }
  }
  svg.appendChild(mk('line', { x1: L, y1: H - B, x2: W - R, y2: H - B, class: 'mg-grid' }));
  return svg;
}
