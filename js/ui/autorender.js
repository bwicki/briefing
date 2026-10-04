/* Fahrtbriefing — Darstellung der automatischen Schnappschüsse (Erarbeitungs-
 * und Briefingsicht teilen diese Funktionen; sie lesen nur den Schnappschuss). */
import { h, fmt } from '../util.js';
import { t, getLang } from '../i18n.js';
import { hhmm, fmtDateTime, fmtDate } from '../calc/time.js';
import { MS_TO_KT, M_TO_FT } from '../auto/openmeteo.js';
import { meteogram as meteogramSvg, windChart, stueveChart } from '../auto/charts.js';
import { trajSvg } from '../auto/traj.js';
import { mapsLink } from './place.js';

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
  const svg = meteogramSvg(d.recs, { fromMs: d.fromMs, toMs: d.toMs, hhmm: (ms) => hhmm(z, ms).slice(0, 2), rating: (r) => r.fly, w: 680 });
  const rows = d.recs.filter((r) => r.ms >= d.fromMs - 3600000 && r.ms <= d.toMs + 3600000);
  const table = h('table.auto', [
    h('thead', h('tr', ['LT', 'T/Td °C', 'RH %', `${t('auto_wind')} kt`, `${t('auto_gust')}`, `${t('auto_cloud')} l/m/h %`, 'mm/h', 'CAPE', t('auto_fog'), t('auto_base'), t('auto_fly')].map((x) => h('th', x)))),
    h('tbody', rows.map((r) => h('tr', { class: r.ms >= d.fromMs && r.ms <= d.toMs ? 'win' : '' }, [
      h('td.mono', hhmm(z, r.ms)), h('td', `${r.temp?.toFixed(0) ?? '–'} / ${r.dew?.toFixed(0) ?? '–'}`), h('td', r.rh != null ? Math.round(r.rh) : '–'),
      h('td.mono', `${deg(r.d10)}/${kt(r.w10)}`), h('td.mono', kt(r.gust)), h('td', `${r.cloudLow != null ? Math.round(r.cloudLow) : '–'}/${r.cloudMid != null ? Math.round(r.cloudMid) : '–'}/${r.cloudHigh != null ? Math.round(r.cloudHigh) : '–'}`), h('td', r.precip != null ? r.precip.toFixed(1) : '–'), h('td', r.cape != null ? Math.round(r.cape) : '–'),
      h('td', ['–', '○', '◐', '●'][r.fog ?? 0]), h('td', r.baseFt != null ? `${r.baseFt} ft` : '–'), h('td', h('span.tag.' + (FLY[r.fly] || ''), flyTxt(r.fly))),
    ]))),
  ]);
  return h('div.auto-wrap', [svg, h('div.tbl-scroll', table), h('div.note', t('auto_flyLegend'))]);
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
  return h('div.auto-wrap', [charts, h('div.tbl-scroll', table), h('div.note', t('auto_windNote'))]);
}

// ---------------------------------------------------------------- Stüve
export function renderTemps(snap, b, ctx) {
  const d = snap.data;
  const svg = stueveChart(d.profile, { w: 560, h: 360, pblFt: d.pbl != null ? Math.round(((d.elev || 0) + d.pbl) * M_TO_FT) : null, fzlFt: d.fzl != null ? Math.round(d.fzl * M_TO_FT) : null, lang: getLang() });
  const inv = d.inversions?.length ? h('div.warn', `${t('auto_inversion')}: ${d.inversions.map((x) => `${x.fromFt}–${x.toFt} ft (+${x.dT} K)`).join(', ')}`) : h('div.note', t('auto_noInversion'));
  const rows = [...d.profile].sort((a, c) => c.ft - a.ft).map((l) => h('tr', [h('td', l.label), h('td.mono', l.ft), h('td', l.temp != null ? l.temp.toFixed(1) : '–'), h('td', l.dew != null ? l.dew.toFixed(1) : '–'), h('td', l.rh ?? '–'), h('td.mono', `${deg(l.dir)}/${kt(l.spd)}`)]));
  return h('div.auto-wrap', [svg || h('div.note', t('auto_noProfile')), inv, h('div.note', `${t('auto_pbl')}: ${d.pbl != null ? Math.round(d.pbl * M_TO_FT) + ' ft AGL' : '–'} · 0 °C: ${d.fzl != null ? Math.round(d.fzl * M_TO_FT) + ' ft AMSL' : '–'}`), h('details', [h('summary.small', t('auto_table')), h('div.tbl-scroll', h('table.auto', [h('thead', h('tr', [t('auto_level'), 'ft', 'T', 'Td', 'RH', 'kt'].map((x) => h('th', x)))), h('tbody', rows)]))])]);
}

// ---------------------------------------------------------------- Trajektorien
export function renderTraj(snap, b, ctx, opts = {}) {
  const d = snap.data, z = b.site.tz || 'Europe/Zurich';
  const svg = trajSvg(d.tracks, { lat: b.site.lat, lon: b.site.lon, landing: d.landing, w: 420, h: 380 });
  const table = h('table.auto', [
    h('thead', h('tr', [t('auto_level'), 'ft', ...(d.tracks[0]?.hourly || []).map((hh) => hhmm(z, hh.ms)), t('auto_end')].map((x) => h('th', x)))),
    h('tbody', d.tracks.map((tr) => h('tr', [h('td', tr.label), h('td.mono', tr.altFt), ...(tr.belowGround ? [h('td', { colspan: (d.tracks.find((x) => x.hourly.length)?.hourly.length || 0) + 1 }, h('span.muted', t('auto_belowGround')))] : [...tr.hourly.map((hh) => h('td.mono', `${hh.km} km/${deg(hh.brg)}°`)), h('td', [h('span.mono', tr.end.icao), ' ', mapsLink(tr.end.lat, tr.end.lon, '↗'), tr.ok ? null : h('span.warn', ` ${t('auto_trajCut')}`)])])]))),
  ]);
  const mapEl = opts.interactive ? h('div.map.traj') : null;
  const wrap = h('div.auto-wrap', [h('div.traj-grid', [svg, mapEl]), h('div.note', `${t('auto_trajStart')} ${hhmm(z, d.startMs)} LT · ${d.durationMin} min · ${d.levels.join(', ')} · ${t('auto_trajNote')}`), h('div.tbl-scroll', table)]);
  if (mapEl) setTimeout(() => drawTrajMap(mapEl, d, b), 0);
  return wrap;
}
function drawTrajMap(el, d, b) {
  if (typeof L === 'undefined') return;
  const map = L.map(el, { zoomControl: true }).setView([b.site.lat, b.site.lon], 10);
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 17, attribution: '© OpenStreetMap' }).addTo(map);
  const colors = ['#c2481a', '#1673a8', '#2f8f4e', '#8a4fb5', '#b5892f', '#444', '#d1476e', '#2aa198'];
  const bounds = [[b.site.lat, b.site.lon]];
  d.tracks.forEach((tr, k) => {
    const pts = tr.points.map((p) => [p.lat, p.lon]); bounds.push(...pts);
    L.polyline(pts, { color: colors[k % colors.length], weight: 3 }).addTo(map).bindTooltip(`${tr.label} · ${tr.altFt} ft`);
    for (const hh of tr.hourly) L.circleMarker([hh.lat, hh.lon], { radius: 4, color: colors[k % colors.length], fillOpacity: 1 }).addTo(map).bindTooltip(`${tr.label} ${hhmm(b.site.tz || 'Europe/Zurich', hh.ms)} · ${hh.km} km`);
  });
  L.marker([b.site.lat, b.site.lon]).addTo(map).bindTooltip(b.site.name || 'Start');
  if (d.landing) L.circleMarker([d.landing.lat, d.landing.lon], { radius: 7, color: '#2f8f4e', fillOpacity: .6 }).addTo(map).bindTooltip(d.landing.name || t('landingSite'));
  setTimeout(() => { map.invalidateSize(); map.fitBounds(bounds, { padding: [20, 20] }); }, 60);
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
  const d = snap.data;
  if (!d.metar?.length) return h('div.note', t('auto_none'));
  return h('div.auto-wrap', d.metar.map((m) => {
    const taf = d.taf?.[m.icaoId];
    return h('div.metar', [
      h('div', [h('b', m.icaoId), ` ${m.name || ''} · ${Math.round(m.distKm)} km`, m.obsTime ? h('span.muted.small', ` · ${new Date(m.obsTime * 1000).toISOString().slice(11, 16)} UTC`) : null]),
      h('pre.report', m.rawOb || ''),
      taf ? h('pre.report', (taf.rawTAF || '').replace(/\s(PROB\d{2}\s+TEMPO|PROB\d{2}|TEMPO|BECMG|FM\d{6})/g, '\n  $1')) : h('div.note', `${t('auto_noTaf')}`),
    ]);
  }));
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
  if (d.gafor) parts.push(h('div', [h('b', `GAFOR ${d.area.id} ${d.area.name}`), ` (${d.area.refAltFt} ft) · ${d.gafor.title}: `, ...(d.gafor.periods || []).map((pp, i) => h('span.tag.' + ({ O: 'pos', C: 'pos', D: 'half', M: 'half', X: 'neg' }[d.gafor.codes?.[i]] || ''), { style: { marginRight: '4px' } }, `${pp} UTC ${d.gafor.codes?.[i] || '?'}${d.gafor.remarks?.[i] ? ' ' + d.gafor.remarks[i] : ''}`))]));
  if (d.office) parts.push(h('div.small.muted', `${d.office.bereich} (${d.office.office}) · ${(d.office.issued || '').slice(0, 16).replace('T', ' ')} UTC · ${t('auto_valid')} ${(d.office.validTo || '').slice(0, 16).replace('T', ' ')} UTC`), h('pre.report', d.office.text || ''), h('div.note', [h('a', { href: d.office.source, target: '_blank', rel: 'noopener' }, 'dwd.de ↗'), ` · ${t('auto_dwdTerms')}`]));
  return h('div.auto-wrap', parts);
}

/** Bildliste eines Schnappschusses (DABS, Karten). */
export function renderImages(snap) {
  const imgs = snap.images || [];
  if (!imgs.length) return h('div.note', '–');
  return h('div.imgs.auto-imgs', imgs.map((im) => h('figure', [h('img.pimg', { src: im.url, alt: im.caption || '' }), im.caption ? h('figcaption.mini', im.caption) : null])));
}

export const RENDERERS = { meteogram: renderMeteogram, wind: renderWind, temps: renderTemps, traj: renderTraj, balloon: renderBalloon, pdiff: renderPdiff, metar: renderMetar, sigmet: renderSigmet, notam: renderNotam, dabs: renderImages, synoptic: renderImages, fwp: renderFwp };
export function renderSnapshot(snap, b, ctx, opts = {}) {
  if (!snap) return null;
  const f = RENDERERS[snap.kind];
  const body = f ? f(snap, b, ctx, opts) : h('pre.report', snap.text || '');
  return h('div.auto', [standLine(snap, b), body]);
}
