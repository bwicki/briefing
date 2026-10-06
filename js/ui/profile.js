/* Fahrtbriefing — Höhenprofil-Werkzeug (0.12, Gasfahrt): Grafik Distanz × Höhe mit Zeitzeile,
 * Relief, Wetter- und Luftraum-Layer, Etappen, Ballasttabelle und Kartenansicht.
 *
 * Reine Darstellung (Panel, Briefingsicht, Druck) und das interaktive Werkzeug (Vollbild-Dialog)
 * zeichnen dieselbe SVG-Grafik (drawChart); Rechenkern in js/calc/profile.js, Daten aus
 * js/auto/profiledata.js (b.profile.data). Farben als CSS-Variablen --pf-* (app.css), damit
 * Hell/Dunkel, Lightbox und Druck (.brief) stimmen.
 */
import { h, clear, toast, fmt } from '../util.js';
import { t, getLang } from '../i18n.js';
import { MODELS, suggestModel } from '../auto/openmeteo.js';
import { hhmm, fmtDate, isoDate, localParts, fmtDateTime } from '../calc/time.js';
import { ensureProfile, altAt, msAtKm, kmAtMs, posAtKm, reliefAt, segments, rateClass, reliefBreaches, addStage, removeStage, moveStage, stageWindows, nightFraction, ballastPlan, fitPoints } from '../calc/profile.js';
import { buildProfileData } from '../auto/profiledata.js';
import { massPerf, fillFractionOf } from '../model.js';
import { icao } from '../calc/geo.js';
import { icon } from './icons.js';
import { sampleOf } from './profile_sample.js';

const NS = 'http://www.w3.org/2000/svg';
const W = 1040, H = 550, ML = 58, R = 24, T = 44, B = 120;   // Ränder (ML statt L: L ist Leaflet); oberhalb T: Achsenhinweis und Etappennamen
const MONO = 'var(--mono)';
/** SVG-Element; fill/stroke als style, damit var(--pf-…) in jedem Browser gilt. */
function el(n, a = {}, txt) {
  const e = document.createElementNS(NS, n);
  const st = [];
  for (const k in a) { if (a[k] == null) continue; if ((k === 'fill' || k === 'stroke') && String(a[k]).startsWith('var(')) st.push(`${k}:${a[k]}`); else e.setAttribute(k, a[k]); }
  if (st.length) e.setAttribute('style', st.join(';'));
  if (txt != null) e.textContent = txt;
  return e;
}
const C = { fg: 'var(--pf-fg)', dim: 'var(--pf-dim)', line: 'var(--pf-line)', panel: 'var(--pf-panel)', night: 'var(--pf-night)', relief: 'var(--pf-relief)', cloud: 'var(--pf-cloud)', inv: 'var(--pf-inv)', zero: 'var(--pf-zero)', ok: 'var(--pf-ok)', warn: 'var(--pf-warn)', bad: 'var(--pf-bad)', pt: 'var(--pf-pt)', stage: 'var(--pf-stage)', asC: 'var(--pf-as-c)', asD: 'var(--pf-as-d)', asCtr: 'var(--pf-as-ctr)', asSua: 'var(--pf-as-sua)', water: 'var(--pf-water)', grid: 'var(--pf-grid)' };
const WX_ICON = { wind: 'M-7 -3 H3 a2.2 2.2 0 1 0 -2.2 -2.2 M-7 1 H6 a2.2 2.2 0 1 1 -2.2 2.2 M-7 5 H1', shear: 'M-8 -1 l3 -4 l3 4 l3 -4 l3 4 l3 -4 M-8 4 l3 -4 l3 4 l3 -4 l3 4 l3 -4', cb: 'M1.5 -8 L-5 1 H0 L-2 8 L5 -2 H0 Z', fog: 'M-7 -4 H7 M-7 0 H7 M-7 4 H5', rain: 'M-4.6 -4.6 C-2.5999999999999996 -2.2 -1.9999999999999996 -0.3999999999999999 -2.9999999999999996 1.0000000000000002 C-3.8 2.2 -5.3999999999999995 2.2 -6.199999999999999 1.0000000000000002 C-7.199999999999999 -0.3999999999999999 -6.6 -2.2 -4.6 -4.6 Z M0 -1.5999999999999999 C2 0.8 2.6 2.6 1.6 4.0 C0.8 5.2 -0.8 5.2 -1.6 4.0 C-2.6 2.6 -2 0.8 0 -1.5999999999999999 Z M4.6 -4.6 C6.6 -2.2 7.199999999999999 -0.3999999999999999 6.199999999999999 1.0000000000000002 C5.3999999999999995 2.2 3.8 2.2 2.9999999999999996 1.0000000000000002 C1.9999999999999996 -0.3999999999999999 2.5999999999999996 -2.2 4.6 -4.6 Z',   /* drei Tropfen */ ice: 'M0 0 L7 0 M4.2 0 L5.4 2.1 M4.2 0 L5.4 -2.1 M0 0 L3.5 6.1 M2.1 3.6 L0.9 5.7 M2.1 3.6 L4.5 3.6 M0 0 L-3.5 6.1 M-2.1 3.6 L-4.5 3.6 M-2.1 3.6 L-0.9 5.7 M0 0 L-7 0 M-4.2 0 L-5.4 -2.1 M-4.2 0 L-5.4 2.1 M0 0 L-3.5 -6.1 M-2.1 -3.6 L-0.9 -5.7 M-2.1 -3.6 L-4.5 -3.6 M0 0 L3.5 -6.1 M2.1 -3.6 L4.5 -3.6 M2.1 -3.6 L0.9 -5.7' };   // Vereisung: Schneestern
/** Text auf Zeilen von höchstens n Zeichen umbrechen (an Leerzeichen). */
function wrapText(txt, n) {
  const out = []; let line = '';
  for (const w of String(txt).split(/\s+/)) { if (line && (line + ' ' + w).length > n) { out.push(line); line = w; } else line = line ? line + ' ' + w : w; }
  if (line) out.push(line);
  return out.slice(0, 3);
}
const HZ_KEY = { wind: 'pf_hzWind', shear: 'pf_hzShear', cb: 'pf_hzCb', fog: 'pf_hzFog', rain: 'pf_hzRain', ice: 'pf_hzIce' };
const hzLabel = (hz) => (HZ_KEY[hz.type] ? t(HZ_KEY[hz.type]) + (hz.type === 'wind' && /\d+/.test(hz.lbl || '') ? ` ${/\d+/.exec(hz.lbl)[0]} kt` : '') : hz.lbl);
const rateCol = (r) => ({ hold: C.dim, ok: C.ok, warn: C.warn, bad: C.bad })[rateClass(r)];
/** Luftraum-Art für Farbe/Strich: CTR, SUA (R/P/D/TRA/TSA), Klasse A–C, sonst D/TMA. */
const asKind = (a) => (a.typeKey === 'CTR' ? 'ctr' : ['R', 'P', 'D', 'TRA', 'TSA', 'TMZ', 'RMZ'].includes(a.typeKey) ? 'sua' : ['A', 'B', 'C'].includes(a.cls) ? 'c' : 'd');
const AS_COL = { c: C.asC, d: C.asD, ctr: C.asCtr, sua: C.asSua };

/** Zeitzone des Briefings: LT (Zone des Startorts) oder UTC – gilt im Werkzeug, Briefing und Druck. */
export const zoneOf = (b) => (b.time?.base === 'UTC' ? 'UTC' : (b.site?.tz || 'Europe/Zurich'));
export const tzName = (b) => (b.time?.base === 'UTC' ? 'UTC' : 'LT');
const WD = { de: ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'], en: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] };
/** Uhrzeit; an einem anderen Kalendertag als der Start mit Wochentag («Mi 02:00»). */
export function fmtTD(b, ms) {
  const z = zoneOf(b);
  const wd = isoDate(z, ms) !== isoDate(z, b.time.startMs) ? `${WD[getLang()][localParts(z, ms).wd]} ` : '';
  return wd + hhmm(z, ms);
}

/** Tag/Dämmerung/Nacht-Abschnitte entlang der Zeit aus den Sonnenereignissen [{kind, ms}]. */
export function sunBands(sun, startMs, endMs) {
  const ev = (sun || []).filter((e) => e.ms != null).sort((a, b) => a.ms - b.ms);
  const after = { ss: 'dusk', ecet: 'night', bcmt: 'dawn', sr: 'day' }, before = { ss: 'day', ecet: 'dusk', bcmt: 'night', sr: 'dawn' };
  let state = ev.length ? before[ev[0].kind] : 'day', cur = startMs;
  const out = [];
  for (const e of ev) { if (e.ms > cur) out.push({ ms0: cur, ms1: Math.min(e.ms, endMs), state }); cur = Math.max(cur, e.ms); state = after[e.kind]; if (cur >= endMs) break; }
  if (cur < endMs) out.push({ ms0: cur, ms1: endMs, state });
  return out.filter((x) => x.ms1 > x.ms0);
}

/** Minimale Höhe über Grund im Abschnitt (m); mit Reliefabstand aus den Einstellungen. */
const minAglOf = (ctx) => +ctx.settings.profileLimits?.minAgl || 300;

/**
 * Grafik zeichnen. st: { b, ctx, p (b.profile), D (p.data), interactive, used (Set, wird mit vorkommenden Legendensymbolen gefüllt) }
 */
export function drawChart(svg, st) {
  const { b, ctx, p, D } = st;
  const lang = getLang(), z = zoneOf(b), tz = tzName(b);
  const KM = Math.max(1, D.totalKm), track = D.track, pts = p.points, used = st.used || new Set();
  const minAgl = minAglOf(ctx);
  const reliefMax = D.relief?.length ? Math.max(...D.relief.map((r) => r.m)) : 0, reliefMin = D.relief?.length ? Math.min(...D.relief.map((r) => r.m)) : 0;
  const yMin = reliefMin > 1500 ? Math.floor((reliefMin - 500) / 500) * 500 : 0;
  const yMax = Math.ceil(Math.max(Math.max(...pts.map((q) => q.alt)) + 700, reliefMax + 600, yMin + 2500, D.yMaxHint || 0) / 500) * 500;
  const x = (km) => ML + (km / KM) * (W - ML - R), y = (m) => T + (1 - (m - yMin) / (yMax - yMin)) * (H - T - B);
  const yc = (m) => y(Math.max(yMin, Math.min(yMax, m)));
  const msK = (km) => msAtKm(track, km), kmT = (ms) => kmAtMs(track, ms);
  const startMs = D.startMs, endMs = D.endMs;
  const yAx1 = H - B + 16, yAx2 = H - B + 40, ySun = H - B + 52, ySun2 = H - B + 61, yAx3 = H - B + 84;
  const relief = D.relief || [];
  const reliefY = (km) => (relief.length ? y(Math.max(yMin, reliefAt(relief, km))) : y(yMin));
  clear(svg);
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  const defs = el('defs');
  const hatch = el('pattern', { id: 'pf-hatch', width: 6, height: 6, patternUnits: 'userSpaceOnUse', patternTransform: 'rotate(45)' }); hatch.appendChild(el('line', { x1: 0, y1: 0, x2: 0, y2: 6, stroke: C.bad, 'stroke-width': 2 })); defs.appendChild(hatch);
  for (const k of Object.keys(AS_COL)) { const pt = el('pattern', { id: 'pf-as-' + k, width: 8, height: 8, patternUnits: 'userSpaceOnUse', patternTransform: 'rotate(-45)' }); pt.appendChild(el('line', { x1: 0, y1: 0, x2: 0, y2: 8, stroke: AS_COL[k], 'stroke-width': 1, opacity: .45 })); defs.appendChild(pt); }
  svg.appendChild(defs);
  // ---- Ebene 0: Nacht/Dämmerung, Gitter, Relief mit Mindestabstand-Band, Unterschreitungen
  for (const bd of sunBands(D.sun, startMs, endMs)) {
    if (bd.state === 'day') continue;
    const k0 = Math.max(0, kmT(bd.ms0)), k1 = Math.min(KM, kmT(bd.ms1)); if (k1 <= k0) continue;
    svg.appendChild(el('rect', { x: x(k0), y: T, width: x(k1) - x(k0), height: H - T - B, fill: C.night, opacity: bd.state === 'night' ? .22 : .12 })); used.add('night');
  }
  for (let m = yMin; m <= yMax; m += 1000) svg.appendChild(el('text', { x: ML - 6, y: y(m) + 4, 'text-anchor': 'end', 'font-size': 11, fill: C.dim, 'font-family': MONO }, m));
  svg.appendChild(el('text', { x: ML - 6, y: T - 8, 'text-anchor': 'end', 'font-size': 9, fill: C.dim }, 'm AMSL'));
  if (relief.length) {
    const base0 = `${x(KM)},${y(yMin)} ${x(0)},${y(yMin)}`;
    svg.appendChild(el('polygon', { points: relief.map((r) => `${x(r.km)},${yc(r.m + minAgl)}`).join(' ') + ' ' + base0, fill: C.relief, opacity: .18 }));
    svg.appendChild(el('polygon', { points: relief.map((r) => `${x(r.km)},${yc(r.m)}`).join(' ') + ' ' + base0, fill: C.relief, opacity: .75 }));
    // Wasserflächen (ebene Läufe im Höhenmodell) als blaue Einsätze an der Oberfläche
    for (const w of D.water || []) { if (w.m < yMin || w.m > yMax) continue; const yw = yc(w.m); svg.appendChild(el('rect', { x: x(w.km0), y: yw, width: x(w.km1) - x(w.km0), height: Math.min(9, y(yMin) - yw), fill: C.water, opacity: .9 })); used.add(D.waterSource === 'osm' ? 'water-osm' : 'water'); }
    const hi = relief.reduce((a, r) => (r.m > a.m ? r : a), relief[0]);
    svg.appendChild(el('text', { x: Math.max(x(0) + 110, Math.min(x(hi.km) + 4, W - R - 190)), y: Math.min(yc(hi.m) + 26, y(yMin) - 6), 'font-size': 10, fill: C.panel }, t('pf_reliefLbl', { m: minAgl })));
    used.add('relief');
  }
  // Höhenlinien über die ganze Breite, vor Nacht/Dämmerung und Relief (Geländehöhe ablesbar)
  for (let m = yMin; m <= yMax; m += 500) svg.appendChild(el('line', { x1: ML, x2: W - R, y1: y(m), y2: y(m), stroke: C.grid, 'stroke-width': m % 1000 ? .6 : 1, opacity: m % 1000 ? .5 : .7 }));
  const lows = relief.length ? reliefBreaches(pts, relief, { minAgl }) : [];
  for (const lo of lows) { svg.appendChild(el('rect', { x: x(lo.km0), y: T, width: x(lo.km1) - x(lo.km0), height: H - T - B, fill: 'url(#pf-hatch)', opacity: .35 })); used.add('low'); }
  // ---- Achsen: km (mit Zwischenstrichen 25/50/75 %) · Zeit (volle Stunden, Zwischenstriche 30') · Sonne · Tag
  svg.appendChild(el('line', { x1: ML, x2: W - R, y1: H - B, y2: H - B, stroke: C.dim }));
  const step = KM <= 60 ? 5 : KM <= 150 ? 10 : KM <= 400 ? 20 : 50;
  for (let k = 0; k <= KM + 1e-6; k += step / 4) { const major = Math.abs(k / step - Math.round(k / step)) < 1e-6; svg.appendChild(el('line', { x1: x(k), x2: x(k), y1: H - B, y2: H - B + (major ? 4 : 2), stroke: C.dim, 'stroke-width': major ? 1 : .6 })); if (major) svg.appendChild(el('text', { x: x(k), y: yAx1, 'text-anchor': 'middle', 'font-size': 11, fill: C.dim, 'font-family': MONO }, Math.round(k))); }
  svg.appendChild(el('text', { x: ML - 14, y: yAx1, 'text-anchor': 'end', 'font-size': 10, fill: C.dim }, 'km'));
  svg.appendChild(el('line', { x1: ML, x2: W - R, y1: yAx2 - 12, y2: yAx2 - 12, stroke: C.line }));
  const hourMs = 3600000, firstHour = Math.ceil(startMs / hourMs) * hourMs;
  const pxPerHour = (x(kmT(Math.min(endMs, startMs + hourMs))) - x(0)) || 40;
  const every = pxPerHour >= 34 ? 1 : pxPerHour >= 18 ? 2 : 3;
  let n = 0;
  for (let ms = firstHour; ms <= endMs; ms += hourMs / 2) {
    const full = (ms - firstHour) % hourMs === 0, k = kmT(ms); if (k > KM) break;
    svg.appendChild(el('line', { x1: x(k), x2: x(k), y1: yAx2 - 12, y2: yAx2 - (full ? 8 : 10), stroke: C.stage, 'stroke-width': full ? 1 : .6 }));
    if (full) { const hh = localParts(z, ms).hh; if (n % every === 0 || hh === 0) svg.appendChild(el('text', { x: x(k), y: yAx2, 'text-anchor': 'middle', 'font-size': 10.5, fill: C.stage, 'font-family': MONO }, hhmm(z, ms))); n++; }
  }
  svg.appendChild(el('text', { x: ML - 22, y: yAx2, 'text-anchor': 'end', 'font-size': 10, fill: C.stage }, tz));
  // Sonnenzeiten SS · ECET · BCMT · SR: Kürzel und darunter die Uhrzeit, bündig zur Marke
  const sunRow = (D.sun || []).filter((e) => e.ms >= startMs && e.ms <= endMs);
  for (const e of sunRow) {
    const k = kmT(e.ms), anchor0 = e.kind === 'ss' || e.kind === 'bcmt' ? 'end' : 'start'; const anchor = anchor0 === 'start' && x(k) > W - R - 40 ? 'end' : anchor0 === 'end' && x(k) < ML + 40 ? 'start' : anchor0; const dx = anchor === 'end' ? -2 : 2;
    svg.appendChild(el('line', { x1: x(k), x2: x(k), y1: yAx2 - 12, y2: ySun2 + 1, stroke: C.night, opacity: .55, 'stroke-width': .8 }));
    svg.appendChild(el('text', { x: x(k) + dx, y: ySun, 'text-anchor': anchor, 'font-size': 8, fill: C.night, opacity: .9, 'font-family': MONO, 'font-weight': 600 }, e.kind.toUpperCase()));
    svg.appendChild(el('text', { x: x(k) + dx, y: ySun2, 'text-anchor': anchor, 'font-size': 7.5, fill: C.night, opacity: .9, 'font-family': MONO }, hhmm(z, e.ms)));
  }
  // Tageszeile nur, wenn die Fahrt (in der gewählten Zone) über Mitternacht geht (ohne Zeilenbeschriftungen «Sonne»/«Tag» links, 0.12.2)
  const midnights = []; let lastDay = isoDate(z, startMs);
  for (let ms = firstHour; ms <= endMs; ms += hourMs) { const d = isoDate(z, ms); if (d !== lastDay) { midnights.push(ms); lastDay = d; } }
  if (midnights.length) {
    svg.appendChild(el('text', { x: x(0), y: yAx3, 'font-size': 10.5, fill: C.fg, 'font-weight': 600 }, fmtDate(z, startMs, lang) + (tz === 'UTC' ? ' UTC' : '')));
    for (const ms of midnights) { const k = kmT(ms); svg.appendChild(el('line', { x1: x(k), x2: x(k), y1: H - B, y2: yAx3 + 3, stroke: C.fg, 'stroke-width': 1.2, 'stroke-dasharray': '3 2' })); svg.appendChild(el('text', { x: x(k) + 4, y: yAx3, 'font-size': 10.5, fill: C.fg, 'font-weight': 600 }, fmtDate(z, ms, lang) + (tz === 'UTC' ? ' UTC' : ''))); }
  }
  svg.appendChild(el('text', { x: ML, y: yAx3 + (midnights.length ? 16 : 0), 'font-size': 9.5, fill: C.dim }, t('pf_startLand', { s: `${fmtDate(z, startMs, lang)} ${hhmm(z, startMs)}`, l: fmtTD(b, endMs), tz, h: ((endMs - startMs) / hourMs).toFixed(1), km: Math.round(KM) })));
  if (st.interactive) svg.appendChild(el('rect', { x: ML, y: yAx2 - 12, width: W - ML - R, height: 16, fill: 'transparent', class: 'pf-axis' }));
  // ---- Ebene 1: Lufträume (Layer): Flächen bis zur Reliefline, Status (HX) in Klammern unter der Bezeichnung
  const clipPoly = (km0, km1, lo, hi) => {   // Fläche hi…lo, unten durch das Relief begrenzt
    const top = `${x(km0)},${yc(hi)} ${x(km1)},${yc(hi)}`;
    const bottom = []; for (let k = km1; k >= km0 - 1e-6; k -= Math.max(1, (km1 - km0) / 40)) bottom.push(`${x(Math.max(km0, k))},${Math.min(yc(lo), reliefY(Math.max(km0, k)))}`);
    bottom.push(`${x(km0)},${Math.min(yc(lo), reliefY(km0))}`);
    return top + ' ' + bottom.join(' ');
  };
  if (p.layers?.as !== false) for (const a of D.airspaces || []) {
    if (a.lo > yMax || a.hi < yMin) continue;
    const kind = asKind(a), col = AS_COL[kind], near = a.status === 'near';
    const km1 = Math.min(KM, a.km1), poly = clipPoly(a.km0, km1, a.lo, a.hi);
    const stroke = { stroke: col, 'stroke-width': near ? 1 : 1.4, 'stroke-dasharray': kind === 'ctr' || kind === 'sua' ? '6 3' : near ? '2 2' : '', fill: 'none' };
    svg.appendChild(el('polygon', { points: poly, fill: `url(#pf-as-${kind})`, opacity: near ? .3 : .6 }));
    // Rand: Oberkante und senkrechte Grenzen bis zum Boden; Unterkante nur dort, wo sie über dem Relief liegt
    const y0 = yc(a.hi), yb = (k) => Math.min(yc(a.lo), reliefY(k));
    svg.appendChild(el('polyline', { points: `${x(a.km0)},${yb(a.km0)} ${x(a.km0)},${y0} ${x(km1)},${y0} ${x(km1)},${yb(km1)}`, ...stroke }));
    let run = [];
    const flush = () => { if (run.length > 1) svg.appendChild(el('polyline', { points: run.join(' '), ...stroke })); run = []; };
    for (let k = a.km0; k <= km1 + 1e-6; k += Math.max(0.5, (km1 - a.km0) / 60)) { if (yc(a.lo) < reliefY(k) - 0.5) run.push(`${x(Math.min(k, km1))},${yc(a.lo)}`); else flush(); }
    flush();
    const lbl = `${a.name} · ${a.cls && a.cls !== 'SUA' ? a.cls : a.typeKey} · ${a.lowerTxt || ''} – ${a.upperTxt || ''}`;
    svg.appendChild(el('text', { x: x(a.km0) + 5, y: y0 + 13, 'font-size': 10, fill: col, 'font-weight': 600 }, lbl));
    // Status (HX / O/R / Betriebszeiten) unter der Bezeichnung, umbrochen auf die Breite der Fläche
    if (a.tmp) wrapText(a.tmp, Math.max(8, Math.floor((x(km1) - x(a.km0) - 8) / 5.2))).forEach((ln, i) => svg.appendChild(el('text', { x: x(a.km0) + 5, y: y0 + 25 + i * 11, 'font-size': 9, fill: col }, ln)));
    used.add('as-' + kind); if (a.tmp) used.add('as-tmp');
  }
  // ---- Ebene 2: Wetter (Layer): Decken je Stundenzelle (unten bis zum Relief), Inversionen, Nullgradgrenze, Achtung-Zeichen
  if (p.layers?.wx !== false) {
    const hrs = D.hours || [];
    const cell = (i) => [i ? (hrs[i - 1].km + hrs[i].km) / 2 : 0, i < hrs.length - 1 ? (hrs[i].km + hrs[i + 1].km) / 2 : KM];
    const overlaps = (c, list) => (list || []).some((d) => Math.abs(d.lo - c.lo) < 400 && Math.abs(d.hi - c.hi) < 600);
    const zeroPts = [], invFirst = { inv: false, iso: false };
    hrs.forEach((hr, i) => {
      const [k0, k1] = cell(i);
      for (const c of hr.clouds || []) {
        if (c.hi < yMin || c.lo > yMax) continue;
        svg.appendChild(el('polygon', { points: clipPoly(k0, k1, c.lo, c.hi), fill: C.cloud, opacity: .55 })); used.add('cloud');
        if (!overlaps(c, hrs[i - 1]?.clouds)) { const lx = x(k0) + (k0 === 0 ? 40 : 4); svg.appendChild(el('text', { x: lx, y: yc(c.hi) + 12, 'font-size': 10, fill: C.fg, 'font-weight': 600 }, `${c.label} ${c.hi - c.lo} m`)); svg.appendChild(el('text', { x: lx, y: yc(c.hi) + 23, 'font-size': 9, fill: C.fg }, `${c.lo}–${c.hi} m`)); }
      }
      for (const iv of hr.inv || []) {
        if (iv.hi < yMin || iv.lo > yMax) continue;
        const iso = iv.kind === 'iso', y0 = yc(iv.hi), y1 = yc(iv.lo);
        // Inversion: Band mit gestrichelter Mittellinie; Isothermie: helleres Band ohne Linie
        svg.appendChild(el('rect', { x: x(k0), y: y0, width: x(k1) - x(k0), height: Math.max(2, y1 - y0), fill: C.inv, opacity: iso ? .14 : .26 }));
        if (!iso) svg.appendChild(el('line', { x1: x(k0), x2: x(k1), y1: (y0 + y1) / 2, y2: (y0 + y1) / 2, stroke: C.inv, 'stroke-width': 1.6, 'stroke-dasharray': '6 4' }));
        used.add(iso ? 'iso' : 'inv');
        const seen = iso ? invFirst.iso : invFirst.inv; if (!seen) { invFirst[iso ? 'iso' : 'inv'] = true; svg.appendChild(el('text', { x: x(k0) + 4, y: y0 - 3, 'font-size': 9.5, fill: C.inv }, t(iso ? 'pf_iso' : 'pf_inversion'))); }
      }
      if (hr.fzl != null && hr.fzl >= yMin && hr.fzl <= yMax) zeroPts.push([hr.km, hr.fzl]);
    });
    if (zeroPts.length >= 2) {
      svg.appendChild(el('polyline', { points: zeroPts.map(([k, m]) => `${x(k)},${y(m)}`).join(' '), fill: 'none', stroke: C.zero, 'stroke-width': 1.8, 'stroke-dasharray': '2 4', 'stroke-linecap': 'round' }));
      svg.appendChild(el('text', { x: x(zeroPts[0][0]) + 2, y: y(zeroPts[0][1]) - 4, 'font-size': 10, fill: C.zero, 'font-weight': 600 }, '0 °C'));
      used.add('zero');
    }
    for (const hz of D.hazards || []) {
      const cx = x(hz.km), cy = yc(hz.alt); const g = el('g');
      g.appendChild(el('circle', { cx, cy, r: 11, fill: C.panel, 'fill-opacity': .35, stroke: C.bad, 'stroke-width': 1.6 }));   // durchscheinend
      g.appendChild(el('path', { d: WX_ICON[hz.type] || WX_ICON.wind, transform: `translate(${cx} ${cy})`, fill: hz.type === 'cb' ? C.bad : 'none', stroke: C.bad, 'stroke-width': 1.6, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }));
      if (hz.type === 'wind') g.appendChild(el('text', { x: cx, y: cy + 23, 'text-anchor': 'middle', 'font-size': 9, fill: C.bad, 'font-weight': 600 }, hzLabel(hz).replace(/^\S+\s*/, '')));   // nur beim Wind «35 kt»; Einzelheiten im Tooltip
      g.appendChild(el('title', {}, `${hzLabel(hz)} · ${fmtTD(b, hz.ms)}${hz.msEnd > hz.ms ? '–' + fmtTD(b, hz.msEnd) : ''} ${tz} · ${hz.km}${hz.kmEnd > hz.km ? '–' + hz.kmEnd : ''} km · ${hz.txt || ''}`));
      svg.appendChild(g); used.add('hz-' + hz.type);
    }
  }
  // ---- Ebene 3: ECET/BCMT-Marken, Etappen (nummeriert) mit Menü und Griff
  for (const e of sunRow) if (e.kind === 'ecet' || e.kind === 'bcmt') { const k = kmT(e.ms); svg.appendChild(el('line', { x1: x(k), x2: x(k), y1: T, y2: H - B, stroke: C.dim, 'stroke-dasharray': '2 3', opacity: .7 })); }   // Kürzel stehen in der Sonnenzeile
  p.stages.forEach((s, i) => {
    svg.appendChild(el('line', { x1: x(s.km), x2: x(s.km), y1: T - 18, y2: H - B, stroke: C.stage, 'stroke-width': 1.5 }));   // Strich reicht über die Grafik hinaus bis zum Namen
    const label = `${i + 1} · ${s.name || ''}`, lw = label.length * 6.4, right = x(s.km) + 4 + lw + 20 > W - R;   // am rechten Rand nach links anschreiben
    svg.appendChild(el('text', { x: x(s.km) + (right ? -4 : 4), y: T - 7, 'text-anchor': right ? 'end' : 'start', 'font-size': 11, fill: C.stage, 'font-weight': 600 }, label));
    if (st.interactive) { menuIcon(svg, right ? x(s.km) - 8 - lw - 14 : x(s.km) + 8 + lw, T - 18, 'stage', i); if (i > 0) stageHandle(svg, x(s.km), i); }
    used.add('stage');
  });
  // Modellhorizont vor dem geplanten Fahrtende: Marker mit Pfeil «Ende Prognosemodell» auf Höhe der Etappennamen
  if (D.cut) {
    const xe = x(KM); const g = el('g');
    g.appendChild(el('line', { x1: xe, x2: xe, y1: T - 30, y2: H - B, stroke: C.bad, 'stroke-width': 1.5, 'stroke-dasharray': '4 3' }));
    g.appendChild(el('path', { d: `M${xe - 26} ${T - 26} h22 m-4 -4 l4 4 l-4 4`, fill: 'none', stroke: C.bad, 'stroke-width': 1.6, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }));   // Pfeil zeigt auf die Prognosegrenze
    g.appendChild(el('text', { x: xe - 30, y: T - 22, 'text-anchor': 'end', 'font-size': 10, fill: C.bad, 'font-weight': 600 }, t('pf_modelEnd')));
    g.appendChild(el('title', {}, t('pf_modelEndHint', { m: D.modelName || '', t: fmtTD(b, endMs), tz, p: fmtTD(b, D.plannedEndMs) })));
    svg.appendChild(g); used.add('cut');
  }
  // ---- Ebene 4: Profil, Punkte, Beschriftungen; Ebene 5: Raten-Pillen zuoberst
  const pills = [];
  for (const s of segments(pts, track)) {
    const col = rateCol(s.rate);
    svg.appendChild(el('line', { x1: x(s.km0), y1: y(s.alt0), x2: x(s.km1), y2: y(s.alt1), stroke: col, 'stroke-width': 3.5, 'stroke-linecap': 'round' }));
    pills.push({ mx: (x(s.km0) + x(s.km1)) / 2, my: (y(s.alt0) + y(s.alt1)) / 2, col, lbl: `${s.rate >= 0 ? '+' : '−'}${Math.abs(s.rate).toFixed(1)}` });
    used.add('rate-' + rateClass(s.rate));
  }
  pts.forEach((q, i) => {
    const c = el('circle', { cx: x(q.km), cy: y(q.alt), r: 6, fill: C.pt, stroke: C.panel, 'stroke-width': 2, class: st.interactive ? 'pf-pt' : '', 'data-i': i });
    const tp = track.points ? track.points.reduce((a, pp) => (Math.abs(pp.km - q.km) < Math.abs(a.km - q.km) ? pp : a), track.points[0]) : null;
    c.appendChild(el('title', {}, `${q.alt} m AMSL · ${fmtTD(b, msK(q.km))} ${tz} · ${q.km} km${tp ? ` · ${t('pf_wind')} ${tp.dir}°/${tp.spdKt} kt` : ''}`));
    svg.appendChild(c);
    const lb = el('text', { x: x(q.km), y: y(q.alt) + 20, 'text-anchor': i === 0 ? 'start' : i === pts.length - 1 ? 'end' : 'middle', 'font-size': 10, fill: C.fg, 'font-family': MONO }, String(q.alt)); lb.appendChild(el('tspan', { 'font-size': 6.5 }, 'm')); lb.appendChild(el('tspan', {}, `·${fmtTD(b, msK(q.km))}`)); svg.appendChild(lb);
    if (st.interactive) menuIcon(svg, x(q.km) + 9, y(q.alt) - 22, 'pt', i);
  });
  used.add('pt');
  // Raten-Pillen mittig auf dem Teilstück (horizontal und vertikal), «m/s» kleiner
  for (const pl of pills) { const g = el('g', { class: 'pf-pill' }); const w = 44; g.appendChild(el('rect', { x: pl.mx - w / 2, y: pl.my - 7, width: w, height: 14, rx: 7, fill: C.panel, stroke: pl.col, 'stroke-width': 1 })); const tx = el('text', { x: pl.mx, y: pl.my + 3.5, 'text-anchor': 'middle', 'font-size': 10, fill: pl.col, 'font-family': MONO, 'font-weight': 600 }, pl.lbl); tx.appendChild(el('tspan', { 'font-size': 6.5, 'font-weight': 400 }, ' m/s')); g.appendChild(tx); svg.appendChild(g); }
  // AGL-Warnung: rot, zweizeilig («< 300 m AGL» / «68–77 km»), auf der Distanzskala, hinterlegt (überdeckt die km-Beschriftung)
  for (const lo of lows) {
    const cx = (x(lo.km0) + x(lo.km1)) / 2, l1 = `<${minAgl}m AGL`, l2 = `${Math.round(lo.km0)}–${Math.round(lo.km1)} km`, w = Math.max(l1.length, l2.length) * 4.6 + 8;
    svg.appendChild(el('rect', { x: cx - w / 2, y: yAx1 - 9, width: w, height: 20, rx: 2, fill: C.panel }));
    svg.appendChild(el('text', { x: cx, y: yAx1 - 1, 'text-anchor': 'middle', 'font-size': 8, fill: C.bad, 'font-weight': 600, 'font-family': MONO }, l1));
    svg.appendChild(el('text', { x: cx, y: yAx1 + 8, 'text-anchor': 'middle', 'font-size': 7.5, fill: C.bad, 'font-family': MONO }, l2));
  }
  // Erklärungen (Beispiel): nummerierte Kreise an festen Stellen
  for (const c of st.callouts || []) {
    if (!c.axis && c.km == null) continue;
    const cx = c.axis === 'km' ? ML - 46 : x(c.km), cy = c.axis === 'km' ? yAx1 - 4 : yc(c.alt);
    const g = el('g', { class: 'pf-callout' }); g.appendChild(el('circle', { cx, cy, r: 9, fill: C.pt })); g.appendChild(el('text', { x: cx, y: cy + 4, 'text-anchor': 'middle', 'font-size': 11, fill: '#fff', 'font-weight': 600 }, c.n)); g.appendChild(el('title', {}, t(c.key))); svg.appendChild(g);
  }
  st.scale = { x, y, KM, yMin, yMax, kx: (px) => Math.max(0, Math.min(KM, (px - ML) / (W - ML - R) * KM)), my: (py) => Math.max(yMin, Math.min(yMax, yMin + (1 - (py - T) / (H - T - B)) * (yMax - yMin))), yAx2 };
  return svg;
}
function menuIcon(root, px, py, kind, idx) {
  const g = el('g', { class: 'pf-mi', 'data-kind': kind, 'data-idx': idx });
  g.appendChild(el('rect', { x: px, y: py, width: 14, height: 14, rx: 3, fill: C.panel, stroke: C.line }));
  for (const d of [4, 7, 10]) g.appendChild(el('line', { x1: px + 3, x2: px + 11, y1: py + d, y2: py + d, stroke: C.dim, 'stroke-width': 1.3 }));
  g.appendChild(el('title', {}, kind === 'pt' ? t('pf_ptMenu') : t('pf_stMenu')));
  root.appendChild(g);
}
function stageHandle(root, px, idx) {
  const g = el('g', { class: 'pf-sh', 'data-idx': idx }); const yb = H - B - 14;
  g.appendChild(el('rect', { x: px - 7, y: yb, width: 14, height: 14, rx: 3, fill: C.stage, stroke: C.panel, 'stroke-width': 1.5 }));
  for (const d of [3, 7, 11]) g.appendChild(el('circle', { cx: px, cy: yb + d, r: 1.3, fill: '#fff' }));
  g.appendChild(el('title', {}, t('pf_stHandle')));
  root.appendChild(g);
}

/** Legende: kompakt, nur die Symbole, die in der Grafik vorkommen (used aus drawChart). */
/**
 * Einklappbarer Block (Legende, Modell der Schätzung): Zustand je Briefing in p.fold[key] (Legende offen,
 * Modell zu als Vorgabe). o.forceOpen = im Druck immer offen (Legende); o.onToggle speichert den Zustand.
 */
function fold(key, title, content, p, o = {}) {
  const open = o.forceOpen ? true : (p?.fold?.[key] ?? o.defaultOpen ?? true);
  const det = h('details.pf-fold.' + key, [h('summary', [h('span.caret'), title]), h('div.pf-fold-body', content)]);
  det.open = open;
  // «toggle» feuert auch für das programmatische Setzen – nur echte Änderungen speichern
  let last = open;
  if (!o.forceOpen) det.addEventListener('toggle', () => { if (det.open === last) return; last = det.open; if (p) { if (!p.fold) p.fold = {}; p.fold[key] = det.open; } o.onToggle?.(det.open); });
  return det;
}
export const foldOpen = (p, key, dflt) => p?.fold?.[key] ?? dflt;

/** Legende: nur die vorkommenden Symbole; o.hint = Bedienhinweis als erste Zeile (Werkzeug); o.p/o.onToggle = einklappbar. */
export function legend(used, ctx, o = {}) {
  const sw = (style) => h('i.sw', { style });
  const ic = (type) => { const s = el('svg', { width: 14, height: 14, viewBox: '-9 -9 18 18' }); s.appendChild(el('circle', { r: 8, fill: 'none', stroke: C.bad, 'stroke-width': 1.3 })); s.appendChild(el('path', { d: WX_ICON[type], fill: type === 'cb' ? C.bad : 'none', stroke: C.bad, 'stroke-width': 1.3, 'stroke-linecap': 'round' })); return s; };
  const minAgl = minAglOf(ctx);
  const items = [
    o.hint ? [h('span.pf-leghint', o.hint)] : null,
    [h('span.pf-legaxis', t('pf_axisNote', { tz: 'LT/UTC' }))],
    used.has('relief') ? [sw('background:var(--pf-relief)'), t('pf_legRelief', { m: minAgl })] : null,
    used.has('cloud') ? [sw('background:var(--pf-cloud)'), t('pf_legCloud')] : null,
    used.has('inv') ? [sw('background:var(--pf-inv);opacity:.5'), t('pf_legInv')] : null,
    used.has('iso') ? [sw('background:var(--pf-inv);opacity:.25'), t('pf_legIso')] : null,
    used.has('zero') ? [sw('background:var(--pf-zero);height:2px'), t('pf_legZero')] : null,
    used.has('night') ? [sw('background:var(--pf-night);opacity:.35'), t('pf_legNight')] : null,
    used.has('water-osm') ? [sw('background:var(--pf-water)'), t('pf_legWaterOsm')] : used.has('water') ? [sw('background:var(--pf-water)'), t('pf_legWater')] : null,
    used.has('cut') ? [sw('border-top:2px dashed var(--pf-bad);background:transparent;height:0'), t('pf_modelEnd')] : null,
    [...used].some((k) => k.startsWith('hz-')) ? [...['wind', 'shear', 'cb', 'fog', 'rain', 'ice'].filter((k) => used.has('hz-' + k)).flatMap((k) => [ic(k), ` ${t(HZ_KEY[k])} `])] : null,
    used.has('as-c') ? [sw('border:1.5px solid var(--pf-as-c);background:transparent'), `${t('pf_layerAs')} A–C`] : null,
    used.has('as-d') ? [sw('border:1.5px solid var(--pf-as-d);background:transparent'), `${t('pf_layerAs')} D / TMA`] : null,
    used.has('as-ctr') ? [sw('border:1.5px dashed var(--pf-as-ctr);background:transparent'), 'CTR'] : null,
    used.has('as-sua') ? [sw('border:1.5px dashed var(--pf-as-sua);background:transparent'), 'R / P / D / TRA'] : null,
    used.has('as-tmp') ? [h('span', '(HX)'), t('pf_legAs').split('·').pop().trim()] : null,
    [sw('background:var(--pf-pt)'), t('pf_legPts')],
    used.has('stage') ? [sw('background:var(--pf-stage);height:2px'), t('pf_legStage')] : null,
    [sw('background:var(--pf-ok)'), t('pf_legRate', { m: minAgl })],
  ].filter(Boolean);
  const box = h('div.pf-legend', items.map((it) => h('span', it)));
  return fold('legend', t('pf_legend'), box, o.p, { defaultOpen: true, forceOpen: !!o.print, onToggle: o.onToggle });
}

/** Erklärungen zur Beispielfahrt: nummerierte Liste und «Woher die Daten kommen». */
function calloutList(callouts) {
  return h('div.pf-callouts', [
    h('ol', callouts.map((c) => h('li', [h('b.k', String(c.n)), h('span', t(c.key))]))),
    h('div.pf-sources', [h('div.lbl', t('pf_exSrc')), h('ul', ['pf_exSrc1', 'pf_exSrc2', 'pf_exSrc3', 'pf_exSrc4'].map((k) => h('li', t(k))))]),
  ]);
}

// ---------------------------------------------------------------- Ballast und Etappen
/** Ballastplan für das Briefing (Parameter aus Stammdaten, A3 und Expertenmenü). */
export function ballastFor(b, ctx) {
  const p = ensureProfile(b), D = p.data; if (!D) return null;
  const S = ctx.settings, bal = b.balloon, mp = massPerf(b, S), r = mp.r;
  const hrs = D.hours || [];
  const overcastAt = (ms) => { if (!hrs.length) return 0; const hr = hrs.reduce((a, x) => (Math.abs(x.ms - ms) < Math.abs(a.ms - ms) ? x : a), hrs[0]); return hr.cloud != null ? Math.max(0, Math.min(1, hr.cloud / 100)) : 0; };
  return ballastPlan(p.points, D.track, { volume: bal.volume, fillFraction: fillFractionOf(b), gas: bal.gas, siteAlt: b.site.elev || 0, wz: bal.wz || null, aero: S.aero, landingKg: r?.reserveKg || 0, availKg: r?.ballast ?? null, nightAt: (ms) => nightFraction(D.sun, ms), overcastAt });
}
/**
 * Schätzung Ballastverbrauch: Teilstücke in 1–3 Spalten, Balken, Hinweis; darunter «Modell der Schätzung» als
 * einklappbarer Block über die ganze Breite (Zustand in p.fold.model; im Druck nur, wenn aufgeklappt: o.print).
 */
export function ballastTable(b, ctx, o = {}) {
  const bp = ballastFor(b, ctx); if (!bp) return null;
  const p = ensureProfile(b);
  const tz = tzName(b), bal = b.balloon, S = ctx.settings;
  const n = (v, d = 0) => (v ? v.toFixed(d) : '–');
  const th = (key, cls = '.n') => h('th' + cls, { title: t(key + 'Tip') }, t(key));
  const head = () => h('thead', h('tr', [h('th', `${t('pf_bSeg')} ${tz}`), h('th.n', 'km'), h('th.n', t('pf_bAlt')), h('th.n', 'm/s'), th('pf_bMan'), th('pf_bBlow'), th('pf_bTemp'), th('pf_bAdia'), h('th.n', 'kg')]));
  const row = (r) => h('tr', [h('td', `${fmtTD(b, r.ms0)}–${fmtTD(b, r.ms1)}`), h('td.n', `${Math.round(r.km0)}–${Math.round(r.km1)}`), h('td.n', `${r.alt0}→${r.alt1}`), h('td.n', { style: { color: rateCol(r.rate) } }, r.rate.toFixed(1)), h('td.n', n(r.man)), h('td.n', n(r.blow)), h('td.n', r.temp ? n(r.temp) : r.gain ? `▲ ${n(r.gain)}` : '–'), h('td.n', r.adia >= 0.5 ? n(r.adia) : '–'), h('td.n', h('b', n(r.kg)))]);
  const foot = [
    h('tr', [h('td', { colspan: 8 }, t('pf_bLanding')), h('td.n', n(bp.landingKg))]),
    h('tr.total', [h('td', { colspan: 8 }, bp.availKg != null ? t('pf_bTotal', { a: fmt(bp.availKg) }) : t('pf_bNoAvail')), h('td.n', bp.availKg != null ? `${n(bp.total)} / ${n(bp.availKg - bp.total)}` : n(bp.total))]),
  ];
  // Teilstücke auf 1–3 Spalten verteilen (bis 6 Zeilen eine, bis 12 zwei, darüber drei); Zeiten/Höhen brechen nicht um
  const cols = bp.rows.length <= 6 ? 1 : bp.rows.length <= 12 ? 2 : 3, per = Math.ceil(bp.rows.length / cols);
  const tables = [];
  for (let c = 0; c < cols; c++) { const part = bp.rows.slice(c * per, (c + 1) * per); if (!part.length && c) continue; tables.push(h('div.tscroll', h('table.pf-ballast.no-lb', [head(), h('tbody', [...part.map(row), ...(c === cols - 1 ? foot : [])])]))); }
  const tbl = h('div.pf-ballast-grid.cols' + tables.length, { style: { gridTemplateColumns: `repeat(${tables.length}, minmax(0, 1fr))` } }, tables);
  const pct = bp.availKg ? Math.min(100, bp.total / bp.availKg * 100) : 0;
  const bar = h('div.pf-bar', h('i', { style: { width: pct + '%', background: pct > 85 ? 'var(--pf-bad)' : 'var(--pf-pt)' } }));
  const note = h('div.note.small', (bp.availKg ? (pct > 85 ? t('pf_bTight', { p: pct.toFixed(0) }) : t('pf_bNote', { p: pct.toFixed(0), r: n(bp.availKg - bp.total) })) : '') + (bp.gain ? ' ' + t('pf_bGain', { g: n(bp.gain) }) : ''));
  const a = S.aero || {};
  // Modell der Schätzung: Parameter und Bedeutung der Spalten – einklappbar, über die ganze Breite; im Druck nur, wenn aufgeklappt
  const modelTxt = t('pf_bModel', { v: fmt(bal.volume), g: bal.gas === 'He' ? 'He' : 'H₂', f: Math.round(fillFractionOf(b) * 100), p: bp.prallH, wz: bal.wz || ((bal.volume || 0) >= 1000 ? 3.8 : 3.5), k: bp.kgPerK1000, d: a.dtDayClear, n: a.dtNightClear, dc: a.dtDayOvercast, nc: a.dtNightOvercast });
  const modelBody = h('div.note.small', [h('div', modelTxt), h('ul.pf-cols', ['pf_bMan', 'pf_bBlow', 'pf_bTemp', 'pf_bAdia'].map((k) => h('li', [h('b', t(k)), ': ', t(k + 'Tip')])))]);
  const model = o.print && !foldOpen(p, 'model', false) ? null : fold('model', t('pf_bModelTitle'), modelBody, p, { defaultOpen: false, forceOpen: !!o.print, onToggle: o.onToggle });
  return h('div.pf-ballast-wrap', [h('div.lbl', t('pf_ballast')), tbl, bar, note, model]);
}
/** Etappenübersicht: Nr., Name, Zeit (Briefing-Zone), km, Höhenband, Ort, Land/FIR, Lufträume, Achtung, Kontakte (AIP). */
export function stageRows(b, ctx) {
  const p = ensureProfile(b), D = p.data; if (!D) return [];
  const S = ctx.settings;
  return stageWindows(p.stages, D.track, p.points, D.totalKm).map((w) => {
    const firs = (D.firs || []).filter((f) => f.fromKm < w.km1 && (f.toKm ?? D.totalKm) > w.km0);
    const countries = [...new Set(firs.map((f) => f.country).filter(Boolean))];
    const as = (D.airspaces || []).filter((a) => a.km0 < w.km1 && a.km1 > w.km0);
    const hz = (D.hazards || []).filter((x) => x.km < w.km1 && (x.kmEnd ?? x.km) >= w.km0);
    // Kontakte: FIS-Sektoren aus openAIP entlang der Etappe (Name · Frequenz), sonst die Kontakte je Land aus den Einstellungen
    const secs = (D.fis || []).filter((f) => f.fromKm < w.km1 && f.toKm > w.km0 && f.freqs?.length);
    const contacts = secs.length ? secs.map((f) => ({ cc: f.country, name: f.name, freq: f.freqs[0], phone: '' })) : (S.fisContacts || []).filter((c) => countries.includes(c.cc) && (c.freq || c.phone));
    return { ...w, firs, countries, as, hz, contacts };
  });
}
export function stageTable(b, ctx) {
  const rows = stageRows(b, ctx); if (!rows.length) return null;
  const tz = tzName(b);
  const place = (q) => (q ? icao(q.lat, q.lon) : '–');
  return h('div.pf-stages-wrap', [h('div.lbl', t('pf_stages')), h('div.tscroll', h('table.pf-stages.no-lb', [
    h('thead', h('tr', [h('th', 'Nr.'), h('th', t('pf_stage')), h('th', t('pf_stFrom', { tz })), h('th.n', 'km'), h('th.n', t('pf_stAlt')), h('th', t('pf_stPlace')), h('th', t('pf_stCountry')), h('th', t('pf_stAs')), h('th', t('pf_stHz')), h('th', t('pf_stContacts'))])),
    h('tbody', rows.map((w) => h('tr', [h('td.n', w.no), h('td', w.name || '–'), h('td.mono', `${fmtTD(b, w.ms0)}–${fmtTD(b, w.ms1)}`), h('td.n', `${Math.round(w.km0)}–${Math.round(w.km1)}`), h('td.n', w.altMin != null ? `${w.altMin}–${w.altMax}` : '–'), h('td.mono', `${place(w.from)} → ${place(w.to)}`), h('td', w.firs.map((f) => `${f.name}${f.country && f.country !== f.name ? ` (${f.country})` : ''}`).join(' → ') || '–'), h('td', w.as.map((a) => `${a.name}${a.status === 'near' ? ' (' + t('as_near') + ')' : ''}${a.tmp ? ' (HX)' : ''}`).join(', ') || '–'), h('td', w.hz.map((x) => `${hzLabel(x)} ${Math.round(x.km)}${(x.kmEnd ?? x.km) > x.km ? '–' + Math.round(x.kmEnd) : ''} km`).join(', ') || '–'), h('td', w.contacts.map((c) => `${c.name}${c.freq ? ' ' + c.freq : ''}${c.phone ? ' · ' + c.phone : ''}`).join('; ') || '–')]))),
  ]))]);
}
export const standLine = (b, D) => (D ? t('pf_stand', { t: fmtDateTime(zoneOf(b), D.stand, getLang()), m: D.modelName || D.model || '', s: D.source || '' }) + (D.errors?.length ? ` · ${t('pf_errors', { e: D.errors.join('; ') })}` : '') : '');

// ---------------------------------------------------------------- Panel (Editor) und Briefingsicht
/** Panel A «Fahrtprofil» im Editor: Daten aufbereiten, Werkzeug öffnen, Grafik (Bild), Etappen- und Ballasttabelle. */
export function profilePanel(b, ctx, o = {}) {
  const p = ensureProfile(b);
  const box = h('div.pf-panel');
  const draw = () => {
    clear(box);
    const D = p.data;
    if (b.site.lat == null) { box.appendChild(h('div.note', t('pf_noSite'))); return; }
    const st = h('span.note.small');
    const build = async (btn) => {
      btn.disabled = true; st.textContent = '…';
      try { await buildProfileData(ctx, b, (m) => { st.textContent = m; }); p.updated = Date.now(); o.onChange?.(); st.textContent = ''; draw(); }
      catch (e) { console.error(e); st.textContent = `✗ ${e.message}`; toast(`${t('error')}: ${e.message}`); }
      btn.disabled = false;
    };
    if (!o.readOnly) box.appendChild(h('div.row-actions', [
      h('button.btn.small' + (D ? '' : '.primary'), { type: 'button', onclick: (e) => build(e.currentTarget) }, [icon('refresh', 14), ` ${D ? t('pf_rebuild') : t('pf_build')}`]),
      D ? h('button.btn.small.primary', { type: 'button', onclick: () => openProfileTool(b, ctx, { onChange: o.onChange, onClose: draw }) }, [icon('edit', 14), ` ${t('pf_open')}`]) : null,
      st,
    ]));
    if (!D) { box.appendChild(h('div.note', t('pf_noData'))); return; }
    const used = new Set();
    const svg = el('svg', { class: 'pf-svg', 'aria-label': t('pf_title') });
    drawChart(svg, { b, ctx, p, D, interactive: false, used });
    const onToggle = () => { if (!o.readOnly) { p.updated = Date.now(); o.onChange?.(); } };
    box.append(h('div.pf-chart', svg), legend(used, ctx, { p, onToggle }), h('div.note.small.stand', standLine(b, D)), stageTable(b, ctx), ballastTable(b, ctx, { onToggle }));
  };
  draw();
  return box;
}
/** Briefingsicht/Druck: Grafik, Etappenübersicht, Ballasttabelle (nur Darstellung). */
export function profileView(b, ctx) {
  const p = ensureProfile(b), D = p.data;
  if (!D) return h('span.mini', '–');
  const used = new Set();
  const svg = el('svg', { class: 'pf-svg', 'aria-label': t('pf_title') });
  drawChart(svg, { b, ctx, p, D, interactive: false, used });
  // Briefingsicht/Druck: Legende immer offen, Modell der Schätzung nur, wenn im Panel/Werkzeug aufgeklappt
  return h('div.pf-view', [h('div.pf-chart', svg), legend(used, ctx, { p, print: true }), h('div.mini', standLine(b, D)), stageTable(b, ctx), ballastTable(b, ctx, { print: true })]);
}

// ---------------------------------------------------------------- Werkzeug (Vollbild-Dialog)
const BASES = {
  neutral: { url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', attr: '© OpenStreetMap, © CARTO', max: 18 },
  osm: { url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png', attr: '© OpenStreetMap', max: 17 },
  topo: { url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', attr: '© OpenStreetMap, SRTM · OpenTopoMap (CC-BY-SA)', max: 16 },
  icao: { url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', attr: '© OpenStreetMap, © CARTO · Luftraum: openAIP', max: 14, openaip: true },
  sat: { url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', attr: 'Esri, Maxar, Earthstar Geographics', max: 17 },
};
export function openProfileTool(b0, ctx, o = {}) {
  let b = b0, p = ensureProfile(b0);
  if (!p.data) { toast(t('pf_noData')); return; }
  const realB = b0, realP = p;
  const S = ctx.settings;
  let view = 'profile', busy = 0, seq = 0, sample = null;   // sample: Beispielfahrt (synthetisch, nicht gespeichert)
  const history = [];
  const snapshot = () => { history.push(JSON.stringify({ points: p.points, stages: p.stages })); if (history.length > 50) history.shift(); undoBtn.disabled = false; };
  const changed = () => { if (sample) return; p.updated = Date.now(); o.onChange?.(); };
  // Bahn nach einer Profiländerung nachrechnen (Prognosen im Memo, Relief/Lufträume neu); Zwischenstände werden verworfen
  const recompute = async () => {
    if (sample) { redraw(); return; }
    const my = ++seq; busy++; status.textContent = t('pf_working');
    try { await buildProfileData(ctx, b, (m) => { if (my === seq) status.textContent = m; }); }
    catch (e) { status.textContent = `✗ ${e.message}`; }
    busy--; if (my === seq) { status.textContent = ''; if (drag != null || dragStage != null) pendingRedraw = true; else redraw(); changed(); }   // während eines Ziehens nicht neu zeichnen
  };
  const undo = () => { const s = history.pop(); if (!s) return; const v = JSON.parse(s); p.points = v.points; p.stages = v.stages; undoBtn.disabled = !history.length; redraw(); recompute(); };
  // Werkzeugleiste
  const segBtn = (lbl, on, fn) => h('button', { type: 'button', class: on ? 'on' : '', onclick: fn }, lbl);
  const viewSeg = h('div.seg', [segBtn(t('pf_viewProfile'), true, () => setView('profile')), segBtn(t('pf_viewMap'), false, () => setView('map'))]);
  const tzSeg = h('div.seg', { title: t('timeBase') }, ['LT', 'UTC'].map((k) => segBtn(k, (b.time.base || 'LT') === k, () => { b.time.base = k; tzSeg.querySelectorAll('button').forEach((x, i) => x.classList.toggle('on', ['LT', 'UTC'][i] === k)); changed(); redraw(); })));
  const undoBtn = h('button.btn.small', { type: 'button', disabled: true, title: t('pf_undoTitle'), onclick: undo }, `↶ ${t('pf_undo')}`);
  const status = h('span.note.small.pf-status');
  const layerBox = h('div.pf-layers', [['wx', 'pf_layerWx'], ['as', 'pf_layerAs']].map(([k, key]) => { const c = h('input', { type: 'checkbox' }); c.checked = p.layers[k] !== false; c.onchange = () => { p.layers[k] = c.checked; changed(); redraw(); }; return h('label', [c, ' ', t(key)]); }));
  // Wettermodell: Modelle mit Druckflächen, deren Horizont wenigstens den Fahrtbeginn erreicht; Vorgabe = feinstes Modell, das die ganze
  // Fahrt abdeckt (suggestModel); deckt eines die Fahrt nur teilweise ab → ⚠
  const hoursToStart = Math.max(0, (b.time.startMs - Date.now()) / 3600000), needH = hoursToStart + (b.intent.durationMin || 1440) / 60;
  const dfltModel = suggestModel(needH);
  const modelOpts = MODELS.filter((m) => m.key && !m.noLevels && m.hours >= hoursToStart + 1).map((m) => ({ value: m.key, label: `${m.name} · ${m.note}${m.hours < needH ? ` ⚠ ${t('pf_modelShort', { h: Math.round(m.hours - hoursToStart) })}` : ` (${m.hours} h)`}${m.key === dfltModel ? ` · ${t('pf_modelDefault')}` : ''}` }));
  // Pille «Wettermodell <Name> ⋯»: zeigt das gewählte, sonst das tatsächlich verwendete Modell; Klick öffnet die Liste
  const modelName = () => (MODELS.find((m) => m.key === (p.model || p.data?.model || dfltModel)) || MODELS[MODELS.length - 1]).name;
  const modelLbl = h('span', modelName());
  const modelBtn = h('button.btn.small.pf-modelbtn', { type: 'button', title: t('pf_modelTip'), onclick: (ev) => { ev.stopPropagation(); openModelMenu(); } }, [h('span.note.small', `${t('pf_model')} `), modelLbl, icon('more', 14)]);
  const modelWarn = h('div.pf-modelwarn', { hidden: true });
  const sampleBtn = h('button.btn.small.pf-sample', { type: 'button', title: t('pf_sampleNote'), onclick: () => toggleSample() }, t('pf_sample'));
  const toolbar = h('div.pf-toolbar', [viewSeg, tzSeg, undoBtn, modelBtn, sampleBtn, status, layerBox]);
  const toolbar2 = h('div.pf-toolbar2', { hidden: true }, [modelWarn]);
  function openModelMenu() {
    closeMenu();
    menuEl = h('div.pf-menu');
    menuEl.style.left = modelBtn.offsetLeft + 'px'; menuEl.style.top = (modelBtn.offsetTop + modelBtn.offsetHeight + 4) + 'px';
    menuEl.appendChild(h('div.ttl', t('pf_model')));
    const cur = p.model || p.data?.model || dfltModel;
    for (const m of modelOpts) menuEl.appendChild(h('button', { type: 'button', onclick: () => { p.model = m.value; modelLbl.textContent = modelName(); closeMenu(); changed(); recompute(); } }, `${m.value === cur ? '✓ ' : ''}${m.label}`));
    toolbar.appendChild(menuEl);
  }
  // Beispiel: synthetische Fahrt mit nummerierten Erklärungen; Schliessen führt zur aktuellen Planung zurück
  function toggleSample() {
    closeMenu();
    if (sample) { sample = null; b = realB; p = realP; } else { sample = sampleOf(realB); b = sample.b; p = sample.p; }
    history.length = 0; undoBtn.disabled = true; modelBtn.disabled = !!sample; modelLbl.textContent = modelName();
    sampleBtn.textContent = sample ? t('pf_sampleClose') : t('pf_sample'); sampleBtn.classList.toggle('on', !!sample);
    layerBox.querySelectorAll('input').forEach((c, i) => { c.checked = p.layers[['wx', 'as'][i]] !== false; });
    tzSeg.querySelectorAll('button').forEach((x, i) => x.classList.toggle('on', ['LT', 'UTC'][i] === (b.time.base || 'LT')));
    redraw();
  }
  // Grafik
  const svg = el('svg', { class: 'pf-svg pf-tool-svg', 'aria-label': t('pf_title') });
  const chartWrap = h('div.pf-chart.tool', svg);
  const legendBox = h('div');
  const mapWrap = h('div.pf-map-wrap', { hidden: true });
  const baseSeg = h('div.seg', Object.keys(BASES).map((k) => segBtn(t('pf_base' + k[0].toUpperCase() + k.slice(1)), (p.base || 'neutral') === k, () => { p.base = k; baseSeg.querySelectorAll('button').forEach((x, i) => x.classList.toggle('on', Object.keys(BASES)[i] === k)); changed(); drawMap(); })));
  const mapEl = h('div.map.pf-map');
  mapWrap.append(h('div.pf-maptools', [h('span.note', t('pf_base')), baseSeg]), mapEl);
  const tables = h('div.pf-tables');
  const calloutBox = h('div');
  const body = h('div.dialog-body.pf-body', [toolbar, toolbar2, chartWrap, mapWrap, legendBox, calloutBox, tables]);
  const close = () => { back.remove(); document.removeEventListener('keydown', onKey); if (map) { map.remove(); map = null; } o.onClose?.(); };
  const back = h('div.backdrop.pf-backdrop', h('div.dialog.pf-tool', [h('div.dialog-head', [h('div.section-title', `${t('pf_title')} · ${b.site.name || ''} · ${fmtDate(zoneOf(b), b.time.startMs, getLang())}`), h('button.btn.icon', { type: 'button', onclick: close, 'aria-label': 'close' }, '✕')]), body]));
  document.body.appendChild(back);
  const onKey = (ev) => { if (ev.key === 'Escape') { if (menuEl) closeMenu(); else close(); } if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === 'z' && !ev.target.closest('input,textarea')) { ev.preventDefault(); undo(); } };
  document.addEventListener('keydown', onKey);
  let st = null;
  function redraw() {
    const used = new Set();
    st = { b, ctx, p, D: p.data, interactive: true, used, callouts: sample?.callouts };
    drawChart(svg, st);
    const D = p.data; modelWarn.hidden = toolbar2.hidden = !D.cut;
    if (D.cut) { clear(modelWarn); modelWarn.append('⚠ ', t('pf_modelEndHint', { m: D.modelName || '', t: fmtTD(b, D.endMs), tz: tzName(b), p: fmtTD(b, D.plannedEndMs) })); }
    if (!sample) modelLbl.textContent = modelName();
    renderLegend();
    clear(calloutBox); if (sample) calloutBox.appendChild(calloutList(sample.callouts));
    clear(tables); tables.append(h('div.note.small', sample ? t('pf_sampleNote') : standLine(b, p.data)), ballastTable(b, ctx, { onToggle: changed }), stageTable(b, ctx));
    if (view === 'map') drawMap();
  }
  // Legende mit dem Bedienhinweis (Profil/Karte) als erster Zeile; einklappbar, Zustand im Briefing
  function renderLegend() { clear(legendBox); legendBox.appendChild(legend(st.used, ctx, { hint: view === 'profile' ? t('pf_hintProfile') : t('pf_hintMap'), p, onToggle: changed })); }
  // Menüs ≡ für Punkte und Etappen
  let menuEl = null;
  const closeMenu = () => { if (menuEl) { menuEl.remove(); menuEl = null; } };
  function openMenu(kind, idx, ev) {
    closeMenu();
    const r = chartWrap.getBoundingClientRect();
    menuEl = h('div.pf-menu');
    menuEl.style.left = Math.max(0, Math.min(r.width - 270, ev.clientX - r.left + 6)) + 'px'; menuEl.style.top = (ev.clientY - r.top + 6) + 'px';
    const btn = (label, fn, commit = true) => menuEl.appendChild(h('button', { type: 'button', onclick: () => { snapshot(); fn(); closeMenu(); redraw(); changed(); if (commit) recompute(); } }, label));
    const KM = p.data.totalKm;
    if (kind === 'pt') {
      const q = p.points[idx];
      menuEl.appendChild(h('div.ttl', t('pf_ptTitle', { alt: q.alt, t: `${fmtTD(b, msAtKm(p.data.track, q.km))} ${tzName(b)}`, km: q.km })));
      const mid = (a, c) => ({ km: Math.round((a.km + c.km) / 2 * 10) / 10, alt: Math.round((a.alt + c.alt) / 2 / 50) * 50 });
      btn(t('pf_insBefore'), () => { const prev = p.points[idx - 1] || { km: Math.max(0, q.km - 10), alt: q.alt }; p.points.push(mid(prev, q)); p.points = fitPoints(p.points, KM); });
      btn(t('pf_insAfter'), () => { const next = p.points[idx + 1] || { km: Math.min(KM, q.km + 10), alt: q.alt }; p.points.push(mid(q, next)); p.points = fitPoints(p.points, KM); });
      if (idx > 0 && idx < p.points.length - 1) btn(t('pf_delPt'), () => { p.points.splice(idx, 1); });
    } else {
      const s = p.stages[idx];
      menuEl.appendChild(h('div.ttl', t('pf_stTitle', { n: idx + 1, t: `${fmtTD(b, msAtKm(p.data.track, s.km))} ${tzName(b)}`, km: s.km })));
      const inp = h('input', { type: 'text', placeholder: t('pf_stName') }); inp.value = s.name || ''; menuEl.appendChild(inp);
      btn(t('pf_rename'), () => { s.name = inp.value.trim() || s.name; }, false);
      if (idx > 0) btn(t('pf_delPrev'), () => removeStage(p.stages, idx, 'prev'), false);
      if (idx < p.stages.length - 1) btn(t('pf_delNext'), () => removeStage(p.stages, idx, 'next'), false);
    }
    chartWrap.appendChild(menuEl);
    inpFocus(menuEl);
  }
  const inpFocus = (m) => { const i = m.querySelector('input'); if (i) { i.focus(); i.select(); i.addEventListener('keydown', (ev) => { if (ev.key === 'Enter') m.querySelector('button')?.click(); }); } };
  back.addEventListener('click', (ev) => { if (menuEl && !menuEl.contains(ev.target) && !ev.target.closest('.pf-mi')) closeMenu(); });
  // Ziehen (Punkte, Etappengriffe), Doppelklick setzt einen Punkt, Klick auf die Zeitzeile setzt eine Etappengrenze
  let drag = null, dragStage = null, moved = false, pendingRedraw = false;
  const pos = (ev) => { const r = svg.getBoundingClientRect(); return { px: (ev.clientX - r.left) * W / r.width, py: (ev.clientY - r.top) * H / r.height }; };
  svg.addEventListener('pointerdown', (ev) => {
    const pt = ev.target.closest('.pf-pt'), sh = ev.target.closest('.pf-sh');
    if (pt) { snapshot(); drag = +pt.dataset.i; } else if (sh) { snapshot(); dragStage = +sh.dataset.idx; } else return;
    moved = false; svg.setPointerCapture(ev.pointerId); ev.preventDefault();
  });
  svg.addEventListener('pointermove', (ev) => {
    if (drag == null && dragStage == null) return;
    const { px, py } = pos(ev), sc = st.scale; moved = true;
    if (drag != null) { const first = drag === 0, last = drag === p.points.length - 1; const q = p.points[drag]; q.km = first ? 0 : last ? sc.KM : Math.round(sc.kx(px) * 10) / 10; q.alt = Math.round(sc.my(py) / 50) * 50; if (!first && !last) { const lo = p.points[drag - 1].km + 0.5, hi = p.points[drag + 1].km - 0.5; q.km = Math.max(lo, Math.min(hi, q.km)); } redraw(); }
    else { moveStage(p.stages, dragStage, sc.kx(px), sc.KM); redraw(); }
  });
  svg.addEventListener('pointerup', () => { const wasPt = drag != null && moved, wasSt = dragStage != null && moved; drag = null; dragStage = null; if (pendingRedraw) { pendingRedraw = false; redraw(); } if (wasPt) { changed(); recompute(); } else if (wasSt) changed(); });
  svg.addEventListener('dblclick', (ev) => { const { px, py } = pos(ev); if (py < T || py > H - B || ev.target.closest('.pf-mi,.pf-sh')) return; snapshot(); p.points.push({ km: Math.round(st.scale.kx(px) * 10) / 10, alt: Math.round(st.scale.my(py) / 50) * 50 }); p.points = fitPoints(p.points, st.scale.KM); redraw(); changed(); recompute(); });
  svg.addEventListener('click', (ev) => {
    const mi = ev.target.closest('.pf-mi'); if (mi) { openMenu(mi.dataset.kind, +mi.dataset.idx, ev); ev.stopPropagation(); return; }
    if (!ev.target.closest('.pf-axis')) return;
    const { px } = pos(ev), km = Math.round(st.scale.kx(px));
    snapshot(); const s = addStage(p.stages, km, t('pf_newStage', { t: fmtTD(b, msAtKm(p.data.track, km)) }), 2); if (!s) { history.pop(); undoBtn.disabled = !history.length; return; } redraw(); changed();
  });
  // Karte (nur Ansicht): Leaflet mit wählbarer Grundkarte, Bahn, Stundenmarken, Höhenpunkte, Etappenmarker, Luftraumflächen
  let map = null, layerGroup = null, baseLayer = null, aipLayer = null;
  function drawMap() {
    if (typeof L === 'undefined') return;
    const D = p.data, tz = tzName(b);
    if (!map) { map = L.map(mapEl, { zoomControl: true }).setView([b.site.lat, b.site.lon], 9); layerGroup = L.layerGroup().addTo(map); }
    const bs = BASES[p.base] || BASES.neutral;
    if (baseLayer) map.removeLayer(baseLayer); if (aipLayer) { map.removeLayer(aipLayer); aipLayer = null; }
    baseLayer = L.tileLayer(bs.url, { maxZoom: bs.max, attribution: bs.attr }).addTo(map);
    if (bs.openaip && S.airspaceTileUrl) aipLayer = L.tileLayer(S.airspaceTileUrl, { maxZoom: 14, opacity: .8, attribution: 'Luftraum: openAIP' }).addTo(map);
    layerGroup.clearLayers();
    const dark = p.base === 'sat';
    const asSnap = sample ? null : b.panels?.['C.airspace']?.content?.auto?.data;
    if (p.layers.as !== false && asSnap) for (const x of [...(asSnap.crossed || []), ...(asSnap.near || [])]) for (const poly of x.as.polys || []) if (poly[0]?.length) L.polygon(poly[0], { color: x.status === 'cross' ? '#7a3fa0' : '#2f6f9f', weight: 1.2, fillOpacity: .08, dashArray: x.status === 'near' ? '5 4' : null }).addTo(layerGroup).bindTooltip(`${x.as.name} · ${x.as.typeKey}${x.as.cls ? ' ' + x.as.cls : ''} · ${x.as.lowerTxt} – ${x.as.upperTxt}`, { sticky: true });
    const pts = D.track.points.map((q) => [q.lat, q.lon]);
    L.polyline(pts, { color: dark ? '#ffb45c' : '#b8640f', weight: 3 }).addTo(layerGroup);
    for (const hr of D.hours || []) if (hr.ms > D.startMs) L.circleMarker([hr.lat, hr.lon], { radius: 3, color: '#666', fillColor: '#fff', fillOpacity: 1, weight: 1.2 }).addTo(layerGroup).bindTooltip(`${fmtTD(b, hr.ms)} ${tz} · ${hr.km} km · ${hr.alt} m`);
    p.points.forEach((q, i) => { if (i === 0 || i === p.points.length - 1) return; const ps = posAtKm(D.track, q.km); if (ps) L.circleMarker([ps.lat, ps.lon], { radius: 5, color: '#fff', fillColor: '#b8640f', fillOpacity: 1, weight: 1.5 }).addTo(layerGroup).bindTooltip(`${q.alt} m · ${fmtTD(b, msAtKm(D.track, q.km))} ${tz} · ${q.km} km`, { direction: 'top', className: 'pf-tip' }); });
    p.stages.forEach((s, i) => { const ps = posAtKm(D.track, s.km); if (!ps) return; const html = `<svg width="24" height="34" viewBox="0 0 24 34"><path d="M12 14 L21 23 L12 32 L3 23 Z" fill="#2f6f9f" stroke="#fff" stroke-width="2"/><line x1="12" y1="14" x2="12" y2="2" stroke="#2f6f9f" stroke-width="2"/><path d="M12 2 L23 6 L12 10 Z" fill="#2f6f9f"/></svg>`; L.marker([ps.lat, ps.lon], { icon: L.divIcon({ className: 'pf-stage-icon', html, iconSize: [24, 34], iconAnchor: [12, 23] }) }).addTo(layerGroup).bindTooltip(`${i + 1} · ${s.name || ''} · ${t('pf_from')} ${fmtTD(b, msAtKm(D.track, s.km))} ${tz}`, { permanent: true, direction: 'right', offset: [10, -8], className: 'pf-tip stage' }); });
    L.marker([b.site.lat, b.site.lon]).addTo(layerGroup).bindTooltip(b.site.name || t('pf_mapStart'));
    const end = D.track.points[D.track.points.length - 1]; if (end) L.marker([end.lat, end.lon], { icon: L.divIcon({ className: 'land-dot', iconSize: [16, 16], iconAnchor: [8, 8] }) }).addTo(layerGroup).bindTooltip(t('pf_mapLanding'));
    setTimeout(() => { map.invalidateSize(); map.fitBounds(pts, { padding: [24, 24] }); }, 60);
  }
  function setView(v) { view = v; viewSeg.querySelectorAll('button').forEach((x, i) => x.classList.toggle('on', ['profile', 'map'][i] === v)); chartWrap.hidden = v !== 'profile'; mapWrap.hidden = v !== 'map'; renderLegend(); closeMenu(); if (v === 'map') drawMap(); }
  redraw();
  return close;
}
