/* Fahrtbriefing — Darstellung der automatischen Schnappschüsse (Erarbeitungs-
 * und Briefingsicht teilen diese Funktionen; sie lesen nur den Schnappschuss). */
import { h, fmt } from '../util.js';
import { t, getLang } from '../i18n.js';
import { hhmm, fmtDateTime, fmtDate, fmtDur } from '../calc/time.js';
import { MS_TO_KT, M_TO_FT } from '../auto/openmeteo.js';
import { meteogram as meteogramSvg, windChart, stueveChart, mk } from '../auto/charts.js';
import { trajSvg, TRAJ_COLORS, targetEstimate } from '../auto/traj.js';
import { directionText } from '../model.js';
import { mapsLink } from './place.js';
import { decodeMetar, decodeTaf, badToken, MARK0, MARK1 } from '../calc/metar.js';
import { bearing, compass } from '../calc/geo.js';

const kt = (ms) => (ms == null ? '–' : Math.round(ms * MS_TO_KT));
const deg = (d) => (d == null ? '–' : Math.round(d).toString().padStart(3, '0'));
const FLY = ['neg', 'half', 'pos'];
const flyTxt = (lv) => (lv == null ? '–' : t('fly_' + lv));

/** Kopfzeile Stand/Modell/Quelle. */
export function standLine(snap, b) {
  if (!snap) return null;
  const z = b.site.tz || 'Europe/Zurich';
  return h('div.note.stand', `${t('stand')}: ${fmtDateTime(z, snap.stand, getLang())} LT · ${snap.modelName ? `${t('auto_model')}: ${snap.modelName} · ` : ''}${snap.source || ''}${snap.generated ? ` (${snap.generated.slice(0, 16).replace('T', ' ')} UTC)` : ''}`);
}

// ---------------------------------------------------------------- Meteogramm
export function renderMeteogram(snap, b, ctx, opts = {}) {
  const d = snap.data, z = b.site.tz || 'Europe/Zurich';
  const lang = getLang();
  const lab = { temp: `${t('auto_tempTd')} °C`, wind: `${t('auto_wind')} / ${t('auto_gust')} kt`, cloud: `${t('auto_cloud')} %`, precip: `${t('auto_precip')} mm/h`, cape: 'CAPE J/kg', high: t('auto_cloudHigh'), mid: t('auto_cloudMid'), low: t('auto_cloudLow'), fly: t('auto_fly'), start: t('auto_trajStart'), land: t('auto_landing'), lt: 'LT' };
  const svg = meteogramSvg(d.recs, { fromMs: d.fromMs, toMs: d.toMs, startMs: d.fromMs, hhmm: (ms) => hhmm(z, ms).slice(0, 2), dayLabel: (ms) => fmtDate(z, ms, lang), rating: (r) => r.fly, lab, w: 760 });
  const sw = (cls, style) => h('span.sw.' + cls, { style });
  const legend = h('div.mg-legend', [
    h('span.item', [sw('line'), t('auto_temp')]), h('span.item', [sw('dash'), t('auto_dew')]),
    h('span.item', [sw('box', { background: 'var(--amber)' }), t('auto_wind')]), h('span.item', [sw('box', { background: 'var(--amber)', opacity: .4 }), t('auto_gust')]),
    h('span.item', [sw('box', { background: 'var(--mg-cloud)' }), `${t('auto_cloud')} (${t('auto_cloudHigh')}/${t('auto_cloudMid')}/${t('auto_cloudLow')})`]),
    h('span.item', [sw('box', { background: 'var(--dew)' }), t('auto_precip')]), h('span.item', [sw('dash', { borderColor: '#8a4fb5' }), 'CAPE ⚡ ≥ 300']),
    h('span.item', [sw('box', { background: 'var(--amber)', opacity: .25 }), t('auto_window')]), h('span.item', [sw('box', { background: 'var(--text-dim)', opacity: .3 }), t('auto_night')]),
    h('span.item', [sw('box', { background: 'var(--green)' }), `${t('auto_fly')}: ${t('fly_2')}`]), h('span.item', [sw('box', { background: 'var(--amber)' }), t('fly_1')]), h('span.item', [sw('box', { background: 'var(--temp)' }), t('fly_0')]),
  ]);
  const rows = d.recs.filter((r) => r.ms >= d.fromMs - 3600000 && r.ms <= d.toMs + 3600000);
  const table = h('table.auto', [
    h('thead', h('tr', ['LT', 'T/Td °C', 'RH %', `${t('auto_wind')} kt`, `${t('auto_gust')}`, `${t('auto_cloud')} l/m/h %`, 'mm/h', 'CAPE', t('auto_fog'), t('auto_base'), t('auto_fly')].map((x) => h('th', x)))),
    h('tbody', rows.map((r) => h('tr', { class: r.ms >= d.fromMs && r.ms <= d.toMs ? 'win' : '' }, [
      h('td.mono', hhmm(z, r.ms)), h('td', `${r.temp?.toFixed(0) ?? '–'} / ${r.dew?.toFixed(0) ?? '–'}`), h('td', r.rh != null ? Math.round(r.rh) : '–'),
      h('td.mono', `${deg(r.d10)}/${kt(r.w10)}`), h('td.mono', kt(r.gust)), h('td', `${r.cloudLow != null ? Math.round(r.cloudLow) : '–'}/${r.cloudMid != null ? Math.round(r.cloudMid) : '–'}/${r.cloudHigh != null ? Math.round(r.cloudHigh) : '–'}`), h('td', r.precip != null ? r.precip.toFixed(1) : '–'), h('td', r.cape != null ? Math.round(r.cape) : '–'),
      h('td', ['–', '○', '◐', '●'][r.fog ?? 0]), h('td', r.baseFt != null ? `${r.baseFt} ft` : '–'), h('td', h('span.tag.' + (FLY[r.fly] || ''), flyTxt(r.fly))),
    ]))),
  ]);
  return h('div.auto-wrap', [svg, legend, h('div.tbl-scroll', table), h('div.note', t('auto_flyLegend'))]);
}

// ---------------------------------------------------------------- Luftraum entlang des Fahrtwegs
const AS_COL = { cross: '#c2481a', near: '#d08a1a', above: '#8a8f99' };
/** Nord-oben-Skizze: Lufträume (rot durchfahren, orange nahe) und Bahnen – druckbar. */
function airspaceSvg(d, b) {
  const NS = 'http://www.w3.org/2000/svg';
  const mk2 = (tag, attrs, txt) => { const n = document.createElementNS(NS, tag); for (const k in attrs) n.setAttribute(k, attrs[k]); if (txt != null) n.textContent = txt; return n; };
  const W = 520, H = 400, pad = 26;
  const lat0 = b.site.lat, lon0 = b.site.lon;
  const kx = 111.2 * Math.cos(lat0 * Math.PI / 180), ky = 111.2;
  const toKm = (la, lo) => [(lo - lon0) * kx, (la - lat0) * ky];
  const all = [[0, 0]];
  for (const tr of d.tracks) for (const p of tr.points) all.push(toKm(p.lat, p.lon));
  if (d.landing) all.push(toKm(d.landing.lat, d.landing.lon));
  const xs = all.map((p) => p[0]), ys = all.map((p) => p[1]);
  const cx = (Math.min(...xs) + Math.max(...xs)) / 2, cy = (Math.min(...ys) + Math.max(...ys)) / 2;
  let r = Math.max(3, ...all.map(([x, y]) => Math.max(Math.abs(x - cx) * H / W, Math.abs(y - cy)))) * 1.3 + 2;
  const grid = r > 60 ? 20 : r > 25 ? 10 : r > 12 ? 5 : 2;
  r = Math.ceil(r / grid) * grid;
  const sc = (H - 2 * pad) / (2 * r);
  const X = (x) => W / 2 + (x - cx) * sc, Y = (y) => H / 2 - (y - cy) * sc;
  const svg = mk2('svg', { viewBox: `0 0 ${W} ${H}`, class: 'traj-svg as-svg', role: 'img' });
  const rx = r * W / H;
  for (let g = Math.ceil((cx - rx) / grid) * grid; g <= cx + rx; g += grid) svg.appendChild(mk2('line', { x1: X(g), y1: pad, x2: X(g), y2: H - pad, class: 'tg' + (Math.abs(g) < 1e-6 ? ' tz' : '') }));
  for (let g = Math.ceil((cy - r) / grid) * grid; g <= cy + r; g += grid) svg.appendChild(mk2('line', { x1: pad, y1: Y(g), x2: W - pad, y2: Y(g), class: 'tg' + (Math.abs(g) < 1e-6 ? ' tz' : '') }));
  svg.appendChild(mk2('text', { x: W / 2, y: 11, class: 'tl', 'text-anchor': 'middle' }, 'N ↑'));
  svg.appendChild(mk2('text', { x: W - 4, y: H - 4, class: 'tl', 'text-anchor': 'end' }, `km · Raster ${grid} km`));
  const clip = mk2('clipPath', { id: 'asclip' }); clip.appendChild(mk2('rect', { x: pad, y: pad, width: W - 2 * pad, height: H - 2 * pad })); svg.appendChild(clip);
  const g = mk2('g', { 'clip-path': 'url(#asclip)' }); svg.appendChild(g);
  const labels = [];
  for (const x of [...d.near, ...d.crossed]) {
    for (const poly of x.as.polys) {
      const ring = poly[0] || []; if (!ring.length) continue;
      const pts = ring.map(([la, lo]) => { const [kxx, kyy] = toKm(la, lo); return `${X(kxx).toFixed(1)},${Y(kyy).toFixed(1)}`; }).join(' ');
      g.appendChild(mk2('polygon', { points: pts, fill: AS_COL[x.status], 'fill-opacity': x.status === 'cross' ? 0.14 : 0.07, stroke: AS_COL[x.status], 'stroke-width': x.status === 'cross' ? 1.4 : 0.9, 'stroke-dasharray': x.status === 'near' ? '4 3' : '' }));
      if (x.status === 'cross') {
        const c = ring.reduce((a, [la, lo]) => { const [kxx, kyy] = toKm(la, lo); return [a[0] + kxx / ring.length, a[1] + kyy / ring.length]; }, [0, 0]);
        let lx = X(c[0]), ly = Y(c[1]);
        while (labels.some(([ax, ay]) => Math.abs(ax - lx) < 60 && Math.abs(ay - ly) < 10)) ly += 10;
        labels.push([lx, ly]);
        g.appendChild(mk2('text', { x: lx, y: ly, class: 'tl', 'text-anchor': 'middle', fill: AS_COL.cross, style: 'font-weight:600;font-size:8.5px' }, x.as.name.slice(0, 26)));
      }
    }
  }
  d.tracks.forEach((tr, k) => {
    const col = TRAJ_COLORS[k % TRAJ_COLORS.length];
    g.appendChild(mk2('polyline', { points: tr.points.map((p) => { const [x, y] = toKm(p.lat, p.lon); return `${X(x).toFixed(1)},${Y(y).toFixed(1)}`; }).join(' '), fill: 'none', stroke: col, 'stroke-width': 2, 'stroke-linejoin': 'round' }));
    const e = tr.points[tr.points.length - 1]; if (e) { const [x, y] = toKm(e.lat, e.lon); g.appendChild(mk2('text', { x: X(x) + 4, y: Y(y) + 3, class: 'tl', fill: col, style: 'font-weight:600' }, tr.label)); }
  });
  svg.appendChild(mk2('circle', { cx: X(0), cy: Y(0), r: 4, class: 'tsite' }));
  if (d.landing) { const [x, y] = toKm(d.landing.lat, d.landing.lon); svg.appendChild(mk2('path', { d: `M${X(x) - 5},${Y(y) + 5} L${X(x)},${Y(y) - 5} L${X(x) + 5},${Y(y) + 5} Z`, class: 'tland' })); }
  return svg;
}
function drawAirspaceMap(el, d, b) {
  if (typeof L === 'undefined') return;
  const map = L.map(el, { zoomControl: true }).setView([b.site.lat, b.site.lon], 10);
  const bl = baseLayers();
  bl.osm.addTo(map); for (const k in bl.over) bl.over[k].addTo(map);
  L.control.layers(bl.base, bl.over, { position: 'topleft', collapsed: true }).addTo(map);
  const bounds = [[b.site.lat, b.site.lon]];
  const tip = (x) => `<b>${x.as.name}</b><br>${x.as.typeKey}${x.as.cls ? ' ' + x.as.cls : ''} · ${x.as.lowerTxt} – ${x.as.upperTxt}<br>${t(x.status === 'cross' ? 'as_crossed' : x.status === 'near' ? 'as_near' : 'as_above')}${x.firstKm != null ? ` · ${x.firstKm} km` : x.minDistKm ? ` · ${x.minDistKm} km` : ''}`;
  for (const x of [...d.near, ...d.crossed]) for (const poly of x.as.polys) if (poly[0]?.length) L.polygon(poly[0], { color: AS_COL[x.status], weight: x.status === 'cross' ? 2 : 1.2, fillOpacity: x.status === 'cross' ? 0.14 : 0.06, dashArray: x.status === 'near' ? '5 4' : null }).addTo(map).bindTooltip(tip(x), { sticky: true });
  d.tracks.forEach((tr, k) => { const pts = tr.points.map((p) => [p.lat, p.lon]); bounds.push(...pts); L.polyline(pts, { color: TRAJ_COLORS[k % TRAJ_COLORS.length], weight: 3 }).addTo(map).bindTooltip(`${tr.label} · ${tr.altFt} ft`); });
  L.marker([b.site.lat, b.site.lon]).addTo(map).bindTooltip(b.site.name || 'Start');
  if (d.landing) L.marker([d.landing.lat, d.landing.lon], { icon: L.divIcon({ className: 'land-dot', iconSize: [16, 16], iconAnchor: [8, 8] }) }).addTo(map).bindTooltip(d.landing.name || t('landingSite'));
  setTimeout(() => { map.invalidateSize(); map.fitBounds(bounds, { padding: [24, 24] }); }, 60);
  return map;
}
export function renderAirspace(snap, b, ctx, opts = {}) {
  const d = snap.data, z = b.site.tz || 'Europe/Zurich';
  const head = h('div.note', `${t('as_band')}: ${d.altMinFt}–${d.altMaxFt} ft · ${t('as_corridor')} ${d.corridorKm} km · ${d.tracks.map((x) => x.label).join(', ')} · ${d.total ?? '–'} ${t('as_inArea')}${d.trajStand ? ` · ${t('as_trajStand')} ${fmtDateTime(z, d.trajStand, getLang())}` : ''}`);
  const firParts = [];
  for (const w of d.warns || []) firParts.push(h('div.warn', `⚠ ${w.kind === 'ctr' ? t('as_warnCtr', { n: `${w.name} (${w.typeKey}${w.cls ? ' ' + w.cls : ''}, ${w.lowerTxt}–${w.upperTxt})` }) : t('as_warnTma', { n: `${w.name} (${w.typeKey}${w.cls ? ' ' + w.cls : ''})`, l: w.lowerTxt, d: w.aglFt })}`));
  for (const w of d.landWarns || []) firParts.push(h('div.note', `${t('as_landCtr', { n: `${w.name} (${w.typeKey}${w.cls ? ' ' + w.cls : ''})` })}`));
  if (d.firs?.length) {
    // gleiche FIR-Folgen zusammenfassen: «SFC, 1000 ft AGL: CH» · «5000 ft: CH → DE ab 80 km, +1:30»
    const seqTxt = (f) => f.seq.map((s, i) => `${s.name}${s.country ? ` (${s.country})` : ''}${i ? ` ${t('as_fromKm')} ${s.fromKm} km, ${hhmm(z, s.fromMs)} LT (+${fmtDur(Math.round((s.fromMs - b.time.startMs) / 60000))})` : ''}`).join(' → ');
    const groups = [];
    for (const f of d.firs) { const key = f.seq.map((s) => s.name).join('|'); const g = groups.find((x) => x.key === key); if (g) g.labels.push(f.label); else groups.push({ key, labels: [f.label], f }); }
    firParts.push(h('div.as-fir', [h('b', `${t('as_fir')}: `), groups.length === 1 ? seqTxt(groups[0].f) : groups.map((g, i) => h('span', [i ? ' · ' : '', h('span.muted', `${g.labels.join(', ')}: `), seqTxt(g.f)]))]));
  }
  const hitsTxt = (x) => {
    if (x.hits.length > 3) { const a = Math.min(...x.hits.map((hh) => hh.entryKm)), e = Math.max(...x.hits.map((hh) => hh.exitKm)); return `${x.hits.length} ${t('as_tracks')}: ${a}–${e} km`; }
    return x.hits.map((hh) => `${hh.label}: ${hh.entryKm} km ${hhmm(z, hh.entryMs)}${hh.exitKm > hh.entryKm ? `–${hh.exitKm} km ${hhmm(z, hh.exitMs)}` : ''}`).join(' · ');
  };
  const flags = (as) => [as.flags?.byNotam ? 'NOTAM' : '', as.flags?.onRequest ? 'REQ' : '', as.flags?.specialAgreement ? 'AGRMT' : '', as.transponder ? `SQ ${as.transponder}` : '', ...(as.freqs || []).slice(0, 2).map((f) => `${f.name ? f.name + ' ' : ''}${f.value}`)].filter(Boolean).join(' · ');
  const row = (x) => h('tr', { class: `as-${x.status}` }, [
    h('td.mono', x.firstKm != null ? [`${x.firstKm} km`, h('br'), `${hhmm(z, x.firstMs)} LT`] : [`${t('as_near')}`, h('br'), `${x.minDistKm} km`]),
    h('td', [h('b', x.as.name), x.hits.length > 1 || (x.hits.length === 1 && d.tracks.length > 1) ? h('div.small.muted', hitsTxt(x)) : null, flags(x.as) ? h('div.small.muted.mono', flags(x.as)) : null]),
    h('td.mono', `${x.as.typeKey}${x.as.cls ? ' ' + x.as.cls : ''}`),
    h('td.mono', x.as.lowerTxt), h('td.mono', x.as.upperTxt),
  ]);
  const thead = h('thead', h('tr', [h('th', t('as_km')), h('th', t('name')), h('th', t('as_type')), h('th', t('as_lower')), h('th', t('as_upper'))]));
  const table = h('table.auto.as-tbl', [thead, h('tbody', [...d.crossed.map(row), ...d.near.map(row)])]);
  const empty = !d.crossed.length && !d.near.length ? h('div.note', t('as_noneCrossed')) : null;
  const svg = airspaceSvg(d, b);
  const mapEl = opts.interactive ? h('div.map.traj.as-map') : null;
  const grid = h('div.traj-grid' + (mapEl ? '.maponly' : ''), [svg, mapEl]);
  const legend = h('div.traj-legend', [h('span.item', [h('span.sw', { style: { background: AS_COL.cross } }), ` ${t('as_crossed')}`]), h('span.item', [h('span.sw', { style: { background: AS_COL.near } }), ` ${t('as_near')} (${d.corridorKm} km)`]), ...d.tracks.map((tr, k) => h('span.item', [h('span.sw', { style: { background: TRAJ_COLORS[k % TRAJ_COLORS.length] } }), ` ${tr.label} · ${tr.altFt} ft`]))]);
  const above = d.above.length ? h('details', [h('summary.small', `${t('as_above')} (> ${d.altMaxFt} ft): ${d.above.length}`), h('div.tbl-scroll', h('table.auto.as-tbl', [thead.cloneNode(true), h('tbody', d.above.map(row))]))]) : null;
  const wrap = h('div.auto-wrap', [head, ...firParts, legend, grid, empty, d.crossed.length || d.near.length ? h('div.tbl-scroll', table) : null, above, h('div.note', `${t('as_note')} ${t('as_noteEG')}`)]);
  if (mapEl) setTimeout(() => { if (mapEl.isConnected) drawAirspaceMap(mapEl, d, b); }, 0);
  return wrap;
}

// ---------------------------------------------------------------- Thermik
export function renderThermal(snap, b) {
  const d = snap.data, z = b.site.tz || 'Europe/Zurich';
  const hs = d.hours || [];
  if (!hs.length) return h('div.note', t('auto_none'));
  const cls = { none: '', weak: 'pos', moderate: 'half', strong: 'neg', severe: 'neg' };
  const summary = h('div.stat-strip.th-sum', [
    h('div.stat', [h('div.k', t('th_onset')), h('div.v', d.onsetMs ? hhmm(z, d.onsetMs) + ' LT' : '–')]),
    h('div.stat', [h('div.k', t('th_peak')), h('div.v', d.peak ? `${hhmm(z, d.peak.ms)} · w* ${d.peak.wstar} m/s` : '–')]),
    h('div.stat', [h('div.k', t('th_end')), h('div.v', d.endMs ? hhmm(z, d.endMs) + ' LT' : '–')]),
    h('div.stat', [h('div.k', t('th_window')), h('div.v.' + (cls[d.winClass] || 'x'), `${t('th_' + d.winClass)} · max w* ${d.winMax} m/s`)]),
  ]);
  // Tabelle (kompakt, ohne horizontales Scrollen) und daneben Balken je Stunde in derselben Zeilenhöhe
  const lim = d.limits || { weak: 1.2, moderate: 2.0, strong: 3.0 };
  const vMax = Math.max(2, Math.ceil(Math.max(...hs.map((x) => x.wstar)) * 2) / 2);
  const inWin = (x) => x.ms >= d.fromMs - 1800000 && x.ms <= d.toMs;
  const table = h('table.auto.th-tbl', [
    h('thead', h('tr', [['LT', ''], ['W/m²', t('th_rad')], ['zi ft', `${t('th_zi')} ft AGL`], ['w*', `${t('th_wstar')} m/s`], ['↑ m/s', `${t('th_climb')} m/s`], ['Böe kt', `${t('th_gusty')} kt`], ['CAPE', 'CAPE J/kg'], [t('th_class'), '']].map(([x, ti]) => h('th', { title: ti }, x)))),
    h('tbody', hs.map((x) => h('tr', { class: inWin(x) ? 'win' : '' }, [h('td.mono', hhmm(z, x.ms)), h('td.mono', x.rad), h('td.mono', x.pbl != null ? Math.round(x.pbl * M_TO_FT) : '–'), h('td.mono', x.wstar.toFixed(1)), h('td.mono', x.climb.toFixed(1)), h('td.mono', x.gusty != null ? Math.round(x.gusty * MS_TO_KT) : '–'), h('td.mono', x.cape != null ? Math.round(x.cape) : '–'), h('td', h('span.tag.' + (cls[x.klass] || ''), t('th_' + x.klass)))]))),
  ]);
  const col = { none: 'var(--text-dim)', weak: 'var(--green)', moderate: 'var(--amber)', strong: 'var(--temp)', severe: 'var(--temp)' };
  const bars = h('div.th-bars', [
    h('div.th-head', [h('span', `w* m/s · ${t('th_weak')} < ${lim.weak} < ${t('th_moderate')} < ${lim.moderate} < ${t('th_strong')} < ${lim.strong}`)]),
    ...hs.map((x) => h('div.th-row' + (inWin(x) ? '.win' : ''), [h('span.tm.mono', hhmm(z, x.ms).slice(0, 2)), h('span.bar', h('span.fill', { style: { width: `${Math.max(0, Math.min(100, x.wstar / vMax * 100))}%`, background: col[x.klass], opacity: x.night ? 0.35 : 0.9 } })), h('span.val.mono', x.wstar.toFixed(1))])),
  ]);
  return h('div.auto-wrap', [summary, h('div.side-grid.fill', [h('div.num', table), h('div.gfx', bars)]), h('div.note', t('th_note'))]);
}

// ---------------------------------------------------------------- Windprofil
export function renderWind(snap, b, ctx, opts = {}) {
  const d = snap.data, z = b.site.tz || 'Europe/Zurich';
  const hours = d.hours;
  if (!hours?.length) return h('div.note', '–');
  const levels = hours[0].profile.map((l) => l.label);
  const table = h('table.auto.wind', [
    h('thead', h('tr', [h('th', 'ft AMSL')].concat(hours.map((hh) => h('th.mono', hhmm(z, hh.ms)))))),
    h('tbody', levels.map((lab, li) => h('tr', [h('td', `${hours[0].profile[li].ft}${hours[0].profile[li].hPa ? ` · ${hours[0].profile[li].hPa} hPa` : ` · ${lab}`}`)].concat(hours.map((hh) => { const l = hh.profile.find((x) => x.label === lab); return h('td.mono', l ? `${deg(l.dir)}/${kt(l.spd)}` : '–'); }))))),
  ]);
  const first = hours[0];
  const marks = [];
  if (b.intent.altMinFt) marks.push([b.intent.altMinFt, `${t('altMin')} ${b.intent.altMinFt}`]);
  if (b.intent.altMaxFt) marks.push([b.intent.altMaxFt, `${t('altMax')} ${b.intent.altMaxFt}`]);
  const charts = h('div.wind-charts', hours.filter((_, i) => i === 0 || i === hours.length - 1 || (hours.length > 4 && i === Math.floor(hours.length / 2))).map((hh) => h('figure', [windChart(hh.profile, { w: 240, h: 300, groundFt: Math.round((d.elev || 0) * M_TO_FT), pblFt: hh.pbl != null ? Math.round(((d.elev || 0) + hh.pbl) * M_TO_FT) : null, fzlFt: hh.fzl != null ? Math.round(hh.fzl * M_TO_FT) : null, marks, lang: getLang() }), h('figcaption.mini', `${hhmm(z, hh.ms)} LT`)])));
  return h('div.auto-wrap', [h('div.side-grid', [h('div.num', h('div.tbl-scroll', table)), h('div.gfx', charts)]), h('div.note', t('auto_windNote'))]);
}

// ---------------------------------------------------------------- Stüve
export function renderTemps(snap, b, ctx) {
  const d = snap.data;
  const svg = stueveChart(d.profile, { w: 560, h: 360, pblFt: d.pbl != null ? Math.round(((d.elev || 0) + d.pbl) * M_TO_FT) : null, fzlFt: d.fzl != null ? Math.round(d.fzl * M_TO_FT) : null, lang: getLang() });
  const inv = d.inversions?.length ? h('div.warn', `${t('auto_inversion')}: ${d.inversions.map((x) => `${x.fromFt}–${x.toFt} ft (+${x.dT} K)`).join(', ')}`) : h('div.note', t('auto_noInversion'));
  const rows = [...d.profile].sort((a, c) => c.ft - a.ft).map((l) => h('tr', [h('td', l.label), h('td.mono', l.ft), h('td', l.temp != null ? l.temp.toFixed(1) : '–'), h('td', l.dew != null ? l.dew.toFixed(1) : '–'), h('td', l.rh ?? '–'), h('td.mono', `${deg(l.dir)}/${kt(l.spd)}`)]));
  const table = h('div.tbl-scroll', h('table.auto', [h('thead', h('tr', [t('auto_level'), 'ft', 'T', 'Td', 'RH', 'kt'].map((x) => h('th', x)))), h('tbody', rows)]));
  const parts = [h('div.side-grid', [h('div.num', [h('div.lbl', `${t('auto_modelProfile')} ${snap.modelName || ''}`), table, inv, h('div.note', `${t('auto_pbl')}: ${d.pbl != null ? Math.round(d.pbl * M_TO_FT) + ' ft AGL' : '–'} · 0 °C: ${d.fzl != null ? Math.round(d.fzl * M_TO_FT) + ' ft AMSL' : '–'}`), h('div.note.small', [h('span.sw', { style: { background: 'var(--sv-cloud)', opacity: .5 } }), ` ${t('auto_cloudShade')} · `, h('span.sw', { style: { background: 'var(--sv-humid)', opacity: .4 } }), ` ${t('auto_humidShade')}`])]), h('div.gfx', svg || h('div.note', t('auto_noProfile')))])];
  // Letzte Messung (Radiosonde Payerne u. a.): zweites Stüve + Tabelle der Hauptdruckflächen
  if (d.obs?.levels?.length) {
    const o = d.obs;
    const main = o.levels.filter((l) => [1000, 925, 850, 700, 600, 500].includes(Math.round(l.hPa)) || l.hPa === o.levels[0].hPa);
    const oSvg = stueveChart(o.levels.filter((l, i, a) => i % Math.max(1, Math.floor(a.length / 40)) === 0 || main.includes(l)), { w: 560, h: 360, lang: getLang() });
    const oRows = [...main].sort((a, c) => c.ft - a.ft).map((l) => h('tr', [h('td', l.label), h('td.mono', l.ft), h('td', l.temp != null ? l.temp.toFixed(1) : '–'), h('td', l.dew != null ? l.dew.toFixed(1) : '–'), h('td', l.rh ?? '–'), h('td.mono', `${deg(l.dir)}/${kt(l.spd)}`)]));
    parts.push(h('div.side-grid', { style: { marginTop: '10px' } }, [h('div.num', [h('div.lbl', [`${t('auto_sounding')} ${o.station.name} (${o.station.id}) · `, o.station.lat != null && b.site.lat != null ? h('span.dirarrow', { title: `${Math.round(bearing(b.site.lat, b.site.lon, o.station.lat, o.station.lon)).toString().padStart(3, '0')}°`, style: { transform: `rotate(${Math.round(bearing(b.site.lat, b.site.lon, o.station.lat, o.station.lon)) - 90}deg)` } }, '➜') : null, o.station.d != null ? ` ${Math.round(o.station.d)} km · ` : '', `${(o.time || '').slice(0, 13).replace('T', ' ')} UTC`]), h('div.tbl-scroll', h('table.auto', [h('thead', h('tr', [t('auto_level'), 'ft', 'T', 'Td', 'RH', 'kt'].map((x) => h('th', x)))), h('tbody', oRows)])), h('div.note', [t('auto_soundingNote'), ' ', h('a', { href: 'https://www.meteoschweiz.admin.ch/service-und-publikationen/applikationen/radiosondierungen.html', target: '_blank', rel: 'noopener' }, 'MeteoSchweiz ↗'), ' · ', h('a', { href: o.url || '#', target: '_blank', rel: 'noopener' }, 'UWyo ↗')])]), h('div.gfx', oSvg || h('div.note', t('auto_noProfile')))]));
  } else if (d.obsErr) parts.push(h('div.note', `${t('auto_sounding')}: ${d.obsErr}`));
  // SondeHub: nächste Live-Sonde (Amateurempfang) als drittes Stüve
  if (d.sonde?.levels?.length) {
    const sN = d.sonde;
    const lv = sN.levels.filter((l) => l.temp != null);
    const sSvg = lv.length >= 4 ? stueveChart(lv.filter((l, i, a) => i % Math.max(1, Math.floor(a.length / 40)) === 0 || i === a.length - 1), { w: 560, h: 360, lang: getLang() }) : null;
    const sel = lv.filter((l, i, a) => i % Math.max(1, Math.floor(a.length / 12)) === 0 || i === a.length - 1);
    const sRows = [...sel].reverse().map((l) => h('tr', [h('td', l.label), h('td.mono', l.ft), h('td', l.temp != null ? l.temp.toFixed(1) : '–'), h('td', l.dew != null ? l.dew.toFixed(1) : '–'), h('td', l.rh ?? '–'), h('td.mono', `${deg(l.dir)}/${kt(l.spd)}`)]));
    parts.push(h('div.side-grid', { style: { marginTop: '10px' } }, [h('div.num', [h('div.lbl', [`${t('auto_sondehub')} ${sN.serial} · `, dirArrow(b, sN.lat, sN.lon), ` ${Math.round(sN.km)} km · ${(sN.launch || '').slice(0, 16).replace('T', ' ')} UTC`]), h('div.tbl-scroll', h('table.auto', [h('thead', h('tr', [t('auto_level'), 'ft', 'T', 'Td', 'RH', 'kt'].map((x) => h('th', x)))), h('tbody', sRows)])), h('div.note', [t('auto_sondehubNote'), ' ', h('a', { href: `https://sondehub.org/${encodeURIComponent(sN.serial)}`, target: '_blank', rel: 'noopener' }, 'sondehub.org ↗')])]), h('div.gfx', sSvg || h('div.note', t('auto_noProfile')))]));
  }
  return h('div.auto-wrap', parts);
}

// ---------------------------------------------------------------- Trajektorien
export function renderTraj(snap, b, ctx, opts = {}) {
  const d = snap.data, z = b.site.tz || 'Europe/Zurich';
  const svg = trajSvg(d.tracks, { lat: b.site.lat, lon: b.site.lon, landing: d.landing, w: 420, h: 380 });
  const table = h('table.auto', [
    h('thead', h('tr', [t('auto_level'), 'ft', ...(d.tracks[0]?.hourly || []).map((hh) => hhmm(z, hh.ms)), t('auto_end')].map((x) => h('th', x)))),
    h('tbody', d.tracks.map((tr, k) => h('tr', [h('td', [h('span.sw', { style: { background: TRAJ_COLORS[k % TRAJ_COLORS.length] } }), ' ', tr.label]), h('td.mono', tr.altFt), ...(tr.belowGround ? [h('td', { colspan: (d.tracks.find((x) => x.hourly.length)?.hourly.length || 0) + 1 }, h('span.muted', t('auto_belowGround')))] : [...tr.hourly.map((hh) => h('td.mono', `${hh.km} km/${deg(hh.brg)}°`)), h('td', [h('span.mono', tr.end.icao), ' ', mapsLink(tr.end.lat, tr.end.lon, '↗'), tr.ok ? null : h('span.warn', ` ${t('auto_trajCut')}`)])])]))),
  ]);
  const legend = h('div.traj-legend', [h('span.muted.small', `${t('auto_legendAlt')}: `), ...d.tracks.filter((tr) => !tr.belowGround).map((tr, k) => h('span.item', [h('span.sw', { style: { background: TRAJ_COLORS[d.tracks.indexOf(tr) % TRAJ_COLORS.length] } }), ` ${tr.label} · ${tr.altFt} ft`]))]);
  // Zielpunkt: Ort · Richtung · Distanz · Fahrzeit · mittlere Höhe aus der Schar (rechts von der Legende)
  if (b.landing?.lat != null) { const est = targetEstimate(d.tracks, b.site, b.landing); legend.appendChild(h('span.item.target', [h('span.sw', { style: { background: '#2f8f4e', borderRadius: '50%' } }), ` ${t('auto_target')}: ${directionText(b, getLang(), est)}`])); }
  const mapEl = opts.interactive ? h('div.map.traj') : null;
  const grid = h('div.traj-grid' + (mapEl ? '.maponly' : ''), [svg, mapEl]);
  const wrap = h('div.auto-wrap', [legend, grid, h('div.note', `${t('auto_trajStart')} ${hhmm(z, d.startMs)} LT · ${d.durationMin} min · ${d.levels.join(', ')} · ${t('auto_trajNote')}${opts.onLanding ? ' · ' + t('auto_dragLanding') : ''}`), h('div.tbl-scroll', table)]);
  if (mapEl) setTimeout(() => drawTrajMap(mapEl, d, b, { onGrid: () => grid.classList.toggle('maponly'), onLanding: opts.onLanding }), 0);
  return wrap;
}
let ctxAirspace = '';
export const setAirspaceUrl = (u) => { ctxAirspace = u || ''; };
/** Leaflet-Karte: Basiskarte wählbar (OSM/Satellit), Luftraum-Overlay, Knopf «Distanzraster» (rechts oben) blendet die Skizze ein. */
export function baseLayers() {
  const osm = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 17, attribution: '© OpenStreetMap' });
  const sat = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { maxZoom: 17, attribution: 'Esri, Maxar, Earthstar Geographics' });
  const base = {}; base[t('auto_osm')] = osm; base[t('auto_satellite')] = sat;
  const over = {};
  if (ctxAirspace) over['openAIP'] = L.tileLayer(ctxAirspace, { maxZoom: 14, opacity: 0.75, attribution: 'Luftraum: openAIP' });
  return { osm, sat, base, over };
}
function iconButton(map, title, icon, onClick, pos = 'topright') {
  const C = L.Control.extend({ onAdd() { const el = L.DomUtil.create('div', 'leaflet-bar leaflet-control fb-ctl'); const a = L.DomUtil.create('a', '', el); a.href = '#'; a.title = title; a.setAttribute('aria-label', title); a.textContent = icon; L.DomEvent.on(a, 'click', (e) => { L.DomEvent.stop(e); a.classList.toggle('on'); onClick(a.classList.contains('on')); }); return el; } });
  return new C({ position: pos }).addTo(map);
}
function drawTrajMap(el, d, b, o = {}) {
  if (typeof L === 'undefined') return;
  const map = L.map(el, { zoomControl: true }).setView([b.site.lat, b.site.lon], 10);
  const bl = baseLayers();
  bl.osm.addTo(map); for (const k in bl.over) bl.over[k].addTo(map);
  L.control.layers(bl.base, bl.over, { position: 'topleft', collapsed: true }).addTo(map);
  if (o.onGrid) iconButton(map, t('auto_grid'), '▦', o.onGrid);
  const colors = TRAJ_COLORS;
  const bounds = [[b.site.lat, b.site.lon]];
  d.tracks.forEach((tr, k) => {
    const pts = tr.points.map((p) => [p.lat, p.lon]); bounds.push(...pts);
    L.polyline(pts, { color: colors[k % colors.length], weight: 3 }).addTo(map).bindTooltip(`${tr.label} · ${tr.altFt} ft`);
    for (const hh of tr.hourly) L.circleMarker([hh.lat, hh.lon], { radius: 4, color: colors[k % colors.length], fillOpacity: 1 }).addTo(map).bindTooltip(`${tr.label} ${hhmm(b.site.tz || 'Europe/Zurich', hh.ms)} · ${hh.km} km`);
  });
  L.marker([b.site.lat, b.site.lon]).addTo(map).bindTooltip(b.site.name || 'Start');
  // Landeraum: grüner Punkt, am Bildschirm verschiebbar (o.onLanding) – sonst nur Anzeige
  const landIcon = L.divIcon({ className: 'land-dot', iconSize: [16, 16], iconAnchor: [8, 8] });
  if (d.landing || o.onLanding) {
    const pos = d.landing ? [d.landing.lat, d.landing.lon] : [b.site.lat, b.site.lon];
    const mk = L.marker(pos, { icon: landIcon, draggable: !!o.onLanding, title: d.landing?.name || t('landingSite') }).addTo(map);
    mk.bindTooltip(d.landing ? (d.landing.name || t('landingSite')) : t('auto_dragLanding'));
    if (o.onLanding) mk.on('dragend', (e) => { const { lat, lng } = e.target.getLatLng(); o.onLanding({ lat, lon: lng }); });
  }
  if (o.onLanding && !d.landing) map.on('click', (e) => o.onLanding({ lat: e.latlng.lat, lon: e.latlng.lng }));
  setTimeout(() => { map.invalidateSize(); map.fitBounds(bounds, { padding: [20, 20] }); }, 60);
  return map;
}

// ---------------------------------------------------------------- Ballonprognose
export function renderBalloon(snap, b, ctx) {
  const d = snap.data, z = b.site.tz || 'Europe/Zurich';
  const parts = [];
  if (d.dwd) {
    parts.push(h('div.lbl', `DWD · ${t('auto_dwdArea')} ${d.dwd.id} ${d.dwd.name} (${d.dwd.refAltFt} ft) · ${d.dwd.station?.name} ${d.dwd.distKm} km · ${d.dwd.issued}`));
    for (const blk of d.dwd.blocks || []) {
      parts.push(h('div.small.b', blk.heading));
      parts.push(h('div.tbl-scroll', h('table.auto.dwd', (blk.rows || []).map((row) => h('tr', row.map((c) => h(c.c === 'b' ? 'th' : 'td', { colspan: c.s || 1 }, c.t)))))));
    }
    parts.push(h('div.note', [h('a', { href: d.dwd.source, target: '_blank', rel: 'noopener' }, 'dwd.de ↗'), ` · ${t('auto_dwdTerms')}`]));
  } else if (d.note) parts.push(h('div.note', d.note));
  const rows = d.recs.filter((r) => r.ms >= d.fromMs - 2 * 3600000 && r.ms <= d.toMs + 2 * 3600000);
  parts.push(h('div.lbl', { style: { marginTop: '8px' } }, `${t('auto_ownTable')} · ${snap.modelName || ''}`));
  parts.push(h('div.tbl-scroll', h('table.auto', [h('thead', h('tr', ['LT', `${t('auto_wind')} kt`, t('auto_gust'), 'T °C', t('auto_cloud') + ' %', 'mm/h', t('auto_fly'), t('auto_why')].map((x) => h('th', x)))), h('tbody', rows.map((r) => h('tr', { class: r.ms >= d.fromMs && r.ms <= d.toMs ? 'win' : '' }, [h('td.mono', hhmm(z, r.ms)), h('td.mono', `${deg(r.d10)}/${kt(r.w10)}`), h('td.mono', kt(r.gust)), h('td', r.temp?.toFixed(0) ?? '–'), h('td', r.cloud != null ? Math.round(r.cloud) : '–'), h('td', r.precip != null ? r.precip.toFixed(1) : '–'), h('td', h('span.tag.' + (FLY[r.fly] || ''), flyTxt(r.fly))), h('td.small', (r.why || []).join(', '))])))])));
  return h('div.auto-wrap', parts);
}

// ---------------------------------------------------------------- Druckdifferenz
export function renderPdiff(snap, b) {
  const d = snap.data, z = b.site.tz || 'Europe/Zurich';
  return h('div.auto-wrap', d.pairs.map((p) => {
    const rows = p.rows.filter((r) => r.ms >= d.fromMs - 6 * 3600000 && r.ms <= d.toMs + 6 * 3600000);
    const every = rows.length > 16 ? 2 : 1;
    // Färbung: orange ab lim.half, rot ab lim.neg hPa – in der Warnrichtung des Paars (sign −1 = Südüberdruck, +1 = Nord/West, 0 = beide)
    const lim = d.limits || { half: 3, neg: 4 };
    const level = (v) => { const w = p.sign ? v * p.sign : Math.abs(v); return w >= lim.neg ? 'neg' : w >= lim.half ? 'half' : ''; };
    return h('div', { style: { marginBottom: '8px' } }, [h('div.lbl', p.name), h('div.tbl-scroll', h('table.auto', [h('thead', h('tr', [h('th', 'LT'), ...rows.filter((_, i) => i % every === 0).map((r) => h('th.mono', hhmm(z, r.ms)))])), h('tbody', [h('tr', [h('td', p.a), ...rows.filter((_, i) => i % every === 0).map((r) => h('td.mono', r.pa.toFixed(0)))]), h('tr', [h('td', p.b), ...rows.filter((_, i) => i % every === 0).map((r) => h('td.mono', r.pb.toFixed(0)))]), h('tr', [h('td', 'ΔP'), ...rows.filter((_, i) => i % every === 0).map((r) => { const lv = level(r.d); return h('td.mono' + (lv ? '.b.pd-' + lv : ''), { class: r.ms >= d.fromMs && r.ms <= d.toMs ? 'win' : '' }, `${r.d > 0 ? '+' : ''}${r.d}`); })])])])), h('div.note', `${p.hint} · ${t('pd_legend', { h: lim.half, n: lim.neg })}`)]);
  }));
}

// ---------------------------------------------------------------- METAR/TAF
export function renderMetar(snap, b) {
  const d = snap.data, lang = getLang();
  if (!d.metar?.length) return h('div.note', t('auto_none'));
  const tafFmt = (raw) => (raw || '').replace(/\s(PROB\d{2}\s+TEMPO|PROB\d{2}|TEMPO|BECMG|FM\d{6})/g, '\n  $1');
  // Rohtext: schlechte Gruppen rot
  const rawNodes = (raw) => raw.split(/(\s+)/).map((tk) => (/^\s+$/.test(tk) || !badToken(tk) ? tk : h('span.bad', tk)));
  // Klartext: Markierungen aus dem Decoder → rot
  const marked = (line) => line.split(new RegExp(`(${MARK0}[^${MARK1}]*${MARK1})`)).filter(Boolean).map((x) => (x.startsWith(MARK0) ? h('span.bad', x.slice(1, -1)) : x));
  const pair = (label, raw, lines) => h('div.metar-cols', [
    h('div.raw', [h('div.lbl', label), h('pre.report', rawNodes(raw))]),
    h('div.dec', [h('div.lbl', t('auto_decoded')), h('ul.decoded', lines.map((x) => h('li', marked(x))))]),
  ]);
  const arrow = (m) => { if (m.lat == null || b.site.lat == null) return null; const brg = bearing(b.site.lat, b.site.lon, m.lat, m.lon); return h('span.dirarrow', { title: `${Math.round(brg).toString().padStart(3, '0')}° ${compass(brg, lang)}`, style: { transform: `rotate(${Math.round(brg) - 90}deg)` } }, '➜'); };
  return h('div.auto-wrap', [
    h('div.note', `${d.metar.length} ${t('auto_metarWithin')} ${d.radiusKm || ''} km · ${t('auto_badLegend')}`),
    ...d.metar.map((m) => {
      const taf = d.taf?.[m.icaoId];
      return h('div.metar', [
        h('div', [h('b', m.icaoId), ` ${m.name || ''} · `, arrow(m), ` ${Math.round(m.distKm)} km`, m.obsTime ? h('span.muted.small', ` · ${new Date(m.obsTime * 1000).toISOString().slice(11, 16)} UTC`) : null]),
        pair('METAR', m.rawOb || '', decodeMetar(m.rawOb || '', lang)),
        taf ? pair('TAF', tafFmt(taf.rawTAF), decodeTaf(taf.rawTAF || '', lang)) : h('div.note', `${t('auto_noTaf')}`),
      ]);
    }),
  ]);
}

// ---------------------------------------------------------------- SIGMET
export function renderSigmet(snap) {
  const d = snap.data;
  if (!d.list?.length) return h('div.note', t('auto_noSigmet'));
  return h('div.auto-wrap', d.list.map((s) => h('div.metar', [h('div', [h('b', `${s.fir || ''} ${s.hazard || ''} ${s.qualifier || ''}`), h('span.muted.small', ` · ${s.validFrom || ''} – ${s.validTo || ''}${s.base != null || s.top != null ? ` · ${s.base ?? 'SFC'}–${s.top ?? '?'} ft` : ''}`)]), h('pre.report', s.raw || '')])));
}

// ---------------------------------------------------------------- NOTAM
export function renderNotam(snap, b, ctx, opts = {}) {
  const d = snap.data;
  const rel = (d.items || []).filter((x) => x.vfr?.relevant), other = (d.items || []).filter((x) => !x.vfr?.relevant);
  const item = (x) => h('div.metar', [h('div', [h('b', `${x.icao || x.location || ''} ${x.number || ''}`), h('span.muted.small', ` · ${(x.start || '').slice(0, 16)} – ${(x.end || '').slice(0, 16)}${x.minFL != null || x.maxFL != null ? ` · FL${x.minFL ?? '000'}–FL${x.maxFL ?? '?'}` : ''}`), x.vfr?.why?.length ? h('span.muted.small', ` · ${x.vfr.why.join(', ')}`) : null]), h('pre.report', (x.formatted || x.text || '').trim())]);
  const parts = [h('div.note', d.mode === 'places' ? `${t('notam_places')}: ${(d.points || []).map((p) => `${p.name || ''} (${Math.round((p.nm || d.nm) * 1.852)} km)`).join(', ')} · ${rel.length} ${t('auto_notamRelevant')}, ${other.length} ${t('auto_notamOther')}` : `${t('auto_notamCorridor')}: ${(d.points || []).map((p) => p.name || '').filter(Boolean).join(' → ')} · ${d.nm} NM · ${rel.length} ${t('auto_notamRelevant')}, ${other.length} ${t('auto_notamOther')}`)];
  if (d.errors?.length) parts.push(h('div.warn', d.errors.join(' · ')));
  parts.push(...rel.map(item));
  if (other.length && opts.interactive) parts.push(h('details', [h('summary.small', `${t('auto_notamOther')} (${other.length})`), ...other.map(item)]));
  return h('div.auto-wrap', parts);
}

// ---------------------------------------------------------------- Flugwetterprognose DE
export function renderFwp(snap) {
  const d = snap.data;
  const parts = [];
  if (d.gafor) parts.push(h('div', [h('b', `GAFOR ${d.area.id} ${d.area.name}`), ` (${d.area.refAltFt} ft) · ${d.gafor.title}: `, ...(d.gafor.periods || []).map((pp, i) => h('span.tag' + ({ O: '.pos', C: '.pos', D: '.half', M: '.half', X: '.neg' }[d.gafor.codes?.[i]] || ''), { style: { marginRight: '4px' } }, `${pp} UTC ${d.gafor.codes?.[i] || '?'}${d.gafor.remarks?.[i] ? ' ' + d.gafor.remarks[i] : ''}`))]));
  if (d.office) parts.push(h('div.small.muted', `${d.office.bereich} (${d.office.office}) · ${(d.office.issued || '').slice(0, 16).replace('T', ' ')} UTC · ${t('auto_valid')} ${(d.office.validTo || '').slice(0, 16).replace('T', ' ')} UTC`), h('pre.report', d.office.text || ''), h('div.note', [h('a', { href: d.office.source, target: '_blank', rel: 'noopener' }, 'dwd.de ↗'), ` · ${t('auto_dwdTerms')}`]));
  return h('div.auto-wrap', parts);
}

/** Bildliste eines Schnappschusses (DABS, Karten). Mehrere Seiten: kleiner Viewer mit Blättern
 * (Bildschirm); im Druck erscheinen alle Seiten (bzw. die Beilagen der Briefingsicht). */
export function renderImages(snap, b, ctx, opts = {}) {
  const imgs = snap.images || [];
  const texts = (snap.data?.texts || []).map((x) => x.linkOnly ? h('div.wxtext.small', [h('b', x.name), ' · ', h('a', { href: x.url, target: '_blank', rel: 'noopener' }, x.url.replace(/^https?:\/\/(www\.)?/, '') + ' ↗')]) : h('details.wxtext', { open: true }, [h('summary.small', [h('b', x.name), x.fetched ? h('span.muted', ` · ${new Date(x.fetched).toISOString().slice(0, 16).replace('T', ' ')} UTC`) : null, x.url ? [' · ', h('a', { href: x.url, target: '_blank', rel: 'noopener' }, '↗')] : null]), h('pre.report.wx', x.text + (x.truncated ? ' […]' : ''))]));
  const errs = snap.data?.errors?.length ? h('div.warn.small', snap.data.errors.join(' · ')) : null;
  if (!imgs.length) return h('div', [errs, ...texts, !texts.length ? h('div.note', '–') : null]);
  if (texts.length || errs) { const inner = renderImagesOnly(snap); return h('div', [inner, errs, ...texts]); }
  return renderImagesOnly(snap);
}
function renderImagesOnly(snap) {
  const imgs = snap.images || [];
  const figs = imgs.map((im, i) => h('figure', { class: i === 0 ? 'cur' : '' }, [h('img.pimg', { src: im.url, alt: im.caption || '', loading: i === 0 ? 'eager' : 'lazy' }), im.caption ? h('figcaption.mini', im.caption) : null]));
  if (imgs.length < 2 && !snap.data?.pdfUrl) return h('div.imgs.auto-imgs', figs);
  let cur = 0;
  const counter = h('span.mono', `1/${imgs.length}`);
  const show = (i) => { cur = (i + imgs.length) % imgs.length; figs.forEach((f, k) => f.classList.toggle('cur', k === cur)); counter.textContent = `${cur + 1}/${imgs.length}`; };
  const bar = h('div.pager-bar.no-print', [
    h('button.btn.icon', { type: 'button', title: t('auto_prev'), 'aria-label': t('auto_prev'), onclick: () => show(cur - 1) }, '‹'),
    h('span.small', [t('auto_page'), ' ', counter]),
    h('button.btn.icon', { type: 'button', title: t('auto_next'), 'aria-label': t('auto_next'), onclick: () => show(cur + 1) }, '›'),
    snap.data?.pdfUrl ? h('a.btn.small', { href: snap.data.pdfUrl, target: '_blank', rel: 'noopener' }, 'PDF ↗') : null,
  ]);
  const wrap = h('div.pager', [bar, h('div.imgs.auto-imgs.pages', figs)]);
  wrap.addEventListener('keydown', (e) => { if (e.key === 'ArrowLeft') show(cur - 1); else if (e.key === 'ArrowRight') show(cur + 1); });
  wrap.tabIndex = 0;
  return wrap;
}

/** Richtungspfeil vom Startort (vor der km-Angabe). */
const dirArrow = (b, lat, lon) => { if (lat == null || b.site?.lat == null) return null; const brg = bearing(b.site.lat, b.site.lon, lat, lon); return h('span.dirarrow', { title: `${deg(brg)}° ${compass(brg, getLang())}`, style: { transform: `rotate(${Math.round(brg) - 90}deg)` } }, '➜'); };

/** Beobachtungen: Wetterstationen im Umkreis als Tabelle (Pfeil · km · Zeit · Wind · T/Td · RH · QNH · Niederschlag). */
export function renderObs(snap, b) {
  const d = snap.data || {};
  if (d.local) return h('div.note', t('auto_obsLocal'));
  const st = d.stations || [];
  if (!st.length) return h('div', [h('div.note', t('auto_obsNone', { km: d.km })), d.errors?.length ? h('div.note.small', d.errors.join(' · ')) : null]);
  const age = (iso) => { if (!iso) return ''; const m = Math.round((Date.now() - new Date(iso)) / 60000); return m < 90 ? `${m} min` : `${Math.round(m / 60)} h`; };
  const windCls = (x) => ((x.kt || 0) >= 14 || (x.gustKt || 0) >= 20 ? 'bad' : '');
  const rows = st.map((x) => h('tr', [
    h('td', [h('b', x.name), h('span.muted.small', ` ${x.src}`)]),
    h('td.mono', [dirArrow(b, x.lat, x.lon), ` ${x.km} km`]),
    h('td.mono', x.time ? `${x.time.slice(11, 16)}Z (${age(x.time)})` : '–'),
    h('td.mono', { class: windCls(x) }, `${deg(x.dir)}/${x.kt != null ? Math.round(x.kt) : '–'}${x.gustKt != null ? ` G${Math.round(x.gustKt)}` : ''} kt`),
    h('td.mono', `${x.tempC != null ? x.tempC.toFixed(1) : '–'}${x.dewC != null ? ' / ' + x.dewC.toFixed(1) : ''} °C`),
    h('td.mono', x.rh != null ? `${Math.round(x.rh)} %` : '–'),
    h('td.mono', x.qnh != null ? `${Math.round(x.qnh)} hPa` : '–'),
    h('td.mono', x.precipMm != null ? `${x.precipMm} mm` : '–'),
  ]));
  return h('div', [
    h('div.tbl-scroll', h('table.auto.obs-tbl', [h('thead', h('tr', [t('auto_station'), 'km', 'UTC', t('auto_wind'), 'T / Td', 'RH', 'QNH', t('auto_precip')].map((x) => h('th', x)))), h('tbody', rows)])),
    h('div.note.small', `${t('auto_obsNote', { km: d.km })}${d.errors?.length ? ' · ' + d.errors.join(' · ') : ''}`),
  ]);
}

/** Sonden-Fenster (Radar-Karte): Emagramm + Kopf + Tabelle der Telemetrie-Niveaus. */
export function renderSondeWindow(box, so, b) {
  const old = box.querySelector('.note'); if (old) old.remove();
  const levels = (so.levels || []).map((l) => ({ label: `${l.hPa} hPa`, hPa: l.hPa, ft: l.ft, m: l.m, temp: l.temp, dew: l.dew, rh: l.rh, dir: l.dir, spd: l.kt != null ? l.kt / MS_TO_KT : null })).filter((l) => l.temp != null);
  const svg = levels.length >= 4 ? stueveChart(levels.filter((l, i, a) => i % Math.max(1, Math.floor(a.length / 40)) === 0 || i === a.length - 1), { w: 520, h: 340, lang: getLang() }) : null;
  const sel = levels.filter((l, i, a) => i % Math.max(1, Math.floor(a.length / 14)) === 0 || i === a.length - 1);
  box.appendChild(h('div.note.small', `${t('auto_sondeLaunch')} ${(so.launch || '').slice(0, 16).replace('T', ' ')} UTC · ${t('auto_sondeTop')} ${so.topM ?? '–'} m · ${so.points} ${t('auto_sondePoints')}${so.levels?.some((l) => !l.pressureMeasured) ? ` · ${t('auto_sondePressNote')}` : ''}`));
  box.appendChild(h('div.gfx', svg || h('div.note', t('auto_noProfile'))));
  box.appendChild(h('div.tbl-scroll', h('table.auto', [h('thead', h('tr', ['hPa', 'ft', 'T', 'Td', 'RH', 'kt'].map((x) => h('th', x)))), h('tbody', [...sel].reverse().map((l) => h('tr', [h('td.mono', l.hPa), h('td.mono', l.ft), h('td', l.temp != null ? l.temp.toFixed(1) : '–'), h('td', l.dew != null ? l.dew.toFixed(1) : '–'), h('td', l.rh ?? '–'), h('td.mono', `${deg(l.dir)}/${kt(l.spd)}`)])))])));
  box.appendChild(h('div.note.small', [h('a', { href: `https://sondehub.org/${encodeURIComponent(so.serial)}`, target: '_blank', rel: 'noopener' }, 'sondehub.org ↗')]));
}

export const RENDERERS = { obs: renderObs, airspace: renderAirspace, thermal: renderThermal, meteogram: renderMeteogram, wind: renderWind, temps: renderTemps, traj: renderTraj, balloon: renderBalloon, pdiff: renderPdiff, metar: renderMetar, sigmet: renderSigmet, notam: renderNotam, dabs: renderImages, synoptic: renderImages, fwp: renderFwp };
export function renderSnapshot(snap, b, ctx, opts = {}) {
  if (!snap) return null;
  const f = RENDERERS[snap.kind];
  const body = f ? f(snap, b, ctx, opts) : h('pre.report', snap.text || '');
  return h('div.auto', [standLine(snap, b), body]);
}
