/* Fahrtbriefing — Darstellung der automatischen Schnappschüsse (Erarbeitungs-
 * und Briefingsicht teilen diese Funktionen; sie lesen nur den Schnappschuss). */
import { h, fmt } from '../util.js';
import { t, getLang } from '../i18n.js';
import { hhmm, fmtDateTime, fmtDate } from '../calc/time.js';
import { MS_TO_KT, M_TO_FT } from '../auto/openmeteo.js';
import { meteogram as meteogramSvg, windChart, stueveChart, mk } from '../auto/charts.js';
import { trajSvg, TRAJ_COLORS } from '../auto/traj.js';
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
  // Balken w* je Stunde
  const W = 760, H = 150, L = 36, R = 10, T = 10, B = 26, n = hs.length, cw = (W - L - R) / n;
  const vMax = Math.max(2, Math.ceil(Math.max(...hs.map((x) => x.wstar)) * 2) / 2);
  const y = (v) => H - B - (v / vMax) * (H - T - B);
  const svg = mk('svg', { viewBox: `0 0 ${W} ${H}`, class: 'mg-svg', role: 'img' });
  for (const v of [0, 1, 2, 3].filter((v) => v <= vMax)) { svg.appendChild(mk('line', { x1: L, y1: y(v), x2: W - R, y2: y(v), class: 'mg-grid' })); svg.appendChild(mk('text', { x: L - 4, y: y(v) + 3, class: 'mg-ax', 'text-anchor': 'end' }, `${v} m/s`)); }
  if (d.fromMs != null) svg.appendChild(mk('rect', { x: L + ((d.fromMs - hs[0].ms) / 3600000) * cw, y: T, width: Math.max(2, ((d.toMs - d.fromMs) / 3600000) * cw), height: H - T - B, class: 'mg-window' }));
  hs.forEach((x, i) => {
    const col = { none: 'var(--text-dim)', weak: 'var(--green)', moderate: 'var(--amber)', strong: 'var(--temp)', severe: 'var(--temp)' }[x.klass];
    svg.appendChild(mk('rect', { x: L + i * cw + 1, y: y(x.wstar), width: Math.max(1, cw - 2), height: Math.max(0, y(0) - y(x.wstar)), fill: col, 'fill-opacity': x.night ? 0.35 : 0.9 }));
    if (i % (n > 20 ? 2 : 1) === 0) svg.appendChild(mk('text', { x: L + i * cw + cw / 2, y: H - B + 12, class: 'mg-ax', 'text-anchor': 'middle' }, hhmm(z, x.ms).slice(0, 2)));
  });
  svg.appendChild(mk('text', { x: L + 4, y: T + 10, class: 'mg-title' }, `w* (m/s) · ${t('th_class')}: ${t('th_weak')} < 1.2 < ${t('th_moderate')} < 2.0 < ${t('th_strong')} < 3.0`));
  const table = h('table.auto', [
    h('thead', h('tr', ['LT', `${t('th_rad')} W/m²`, `${t('th_zi')} ft AGL`, `${t('th_wstar')} m/s`, `${t('th_climb')} m/s`, `${t('th_gusty')} kt`, 'CAPE', t('th_class')].map((x) => h('th', x)))),
    h('tbody', hs.map((x) => h('tr', { class: x.ms >= d.fromMs - 1800000 && x.ms <= d.toMs ? 'win' : '' }, [h('td.mono', hhmm(z, x.ms)), h('td', x.rad), h('td', x.pbl != null ? Math.round(x.pbl * M_TO_FT) : '–'), h('td.mono', x.wstar.toFixed(1)), h('td.mono', x.climb.toFixed(1)), h('td.mono', x.gusty != null ? Math.round(x.gusty * MS_TO_KT) : '–'), h('td', x.cape != null ? Math.round(x.cape) : '–'), h('td', h('span.tag.' + (cls[x.klass] || ''), t('th_' + x.klass)))]))),
  ]);
  return h('div.auto-wrap', [summary, h('div.side-grid', [h('div.num', h('div.tbl-scroll', table)), h('div.gfx', svg)]), h('div.note', t('th_note'))]);
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
  return h('div.auto-wrap', [h('div.side-grid', [h('div.num', [table, inv, h('div.note', `${t('auto_pbl')}: ${d.pbl != null ? Math.round(d.pbl * M_TO_FT) + ' ft AGL' : '–'} · 0 °C: ${d.fzl != null ? Math.round(d.fzl * M_TO_FT) + ' ft AMSL' : '–'}`)]), h('div.gfx', svg || h('div.note', t('auto_noProfile')))])]);
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
    return h('div', { style: { marginBottom: '8px' } }, [h('div.lbl', p.name), h('div.tbl-scroll', h('table.auto', [h('thead', h('tr', [h('th', 'LT'), ...rows.filter((_, i) => i % every === 0).map((r) => h('th.mono', hhmm(z, r.ms)))])), h('tbody', [h('tr', [h('td', p.a), ...rows.filter((_, i) => i % every === 0).map((r) => h('td.mono', r.pa.toFixed(0)))]), h('tr', [h('td', p.b), ...rows.filter((_, i) => i % every === 0).map((r) => h('td.mono', r.pb.toFixed(0)))]), h('tr', [h('td', 'ΔP'), ...rows.filter((_, i) => i % every === 0).map((r) => h('td.mono' + (Math.abs(r.d) >= 3 ? '.b' : ''), { class: r.ms >= d.fromMs && r.ms <= d.toMs ? 'win' : '' }, `${r.d > 0 ? '+' : ''}${r.d}`))])])])), h('div.note', p.hint)]);
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
        h('div', [h('b', m.icaoId), ` ${m.name || ''} · ${Math.round(m.distKm)} km `, arrow(m), m.obsTime ? h('span.muted.small', ` · ${new Date(m.obsTime * 1000).toISOString().slice(11, 16)} UTC`) : null]),
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
  const parts = [h('div.note', `${t('auto_notamCorridor')}: ${(d.points || []).map((p) => p.name || '').filter(Boolean).join(' → ')} · ${d.nm} NM · ${rel.length} ${t('auto_notamRelevant')}, ${other.length} ${t('auto_notamOther')}`)];
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
  if (!imgs.length) return h('div.note', '–');
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

export const RENDERERS = { thermal: renderThermal, meteogram: renderMeteogram, wind: renderWind, temps: renderTemps, traj: renderTraj, balloon: renderBalloon, pdiff: renderPdiff, metar: renderMetar, sigmet: renderSigmet, notam: renderNotam, dabs: renderImages, synoptic: renderImages, fwp: renderFwp };
export function renderSnapshot(snap, b, ctx, opts = {}) {
  if (!snap) return null;
  const f = RENDERERS[snap.kind];
  const body = f ? f(snap, b, ctx, opts) : h('pre.report', snap.text || '');
  return h('div.auto', [standLine(snap, b), body]);
}
