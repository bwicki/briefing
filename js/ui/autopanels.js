/* Fahrtbriefing — automatische Panels in der Erarbeitungssicht: Modell-Leiste,
 * Aktualisieren je Panel, Trajektorien-Steuerung, DABS (PDF → Bilder), Karten-
 * Schnappschüsse, Radar (live), KI-Hinweis. Die Darstellung des Schnappschusses
 * selbst liegt in autorender.js (gemeinsam mit der Briefingsicht). */
import { h, clear, toast, num, dialog } from '../util.js';
import { t, getLang } from '../i18n.js';
import { field, input, select, textarea, check } from './widgets.js';
import { renderSnapshot, setAirspaceUrl } from './autorender.js';
import * as DATA from '../auto/data.js';
import { MODELS, modelsFor, modelName, suggestModel } from '../auto/openmeteo.js';
import { hhmm, fmtDateTime } from '../calc/time.js';
import { panelPrompt, aiHint } from '../auto/ai.js';

const shareTok = (ctx) => ctx.shared?.token;

/** Modell-Leiste über Abschnitt B. */
export function meteoBar(b, ctx, { onChange, refreshAll, readOnly }) {
  if (!b.meteo) b.meteo = { model: suggestModel((b.time.startMs - Date.now()) / 3600000), topHpa: 500 };
  const hours = (b.time.startMs - Date.now()) / 3600000;
  const ok = modelsFor(hours).map((m) => m.key);
  const opts = MODELS.filter((m) => !m.noLevels).map((m) => ({ value: m.key, label: `${m.name} · ${m.note}${ok.includes(m.key) ? '' : ' ✗'}` }));
  const sel = select(opts, b.meteo.model || '', { disabled: readOnly, onchange: (e) => { b.meteo.model = e.target.value; DATA.clearMemo(); onChange(); } });
  const lr = b.meteo.lastRefresh;
  const status = h('span.note', lr ? `${lr.n}/${lr.total} ✓ · ${hhmm(b.site.tz || 'Europe/Zurich', lr.ts)}` : '');
  const btn = readOnly ? null : h('button.btn.primary', { type: 'button', onclick: () => refreshAll(status) }, t('refreshAll'));
  const sugg = h('span.note', `${t('auto_suggest')}: ${modelName(suggestModel(hours))} (${hours >= 0 ? '+' : ''}${Math.round(hours)} h)`);
  return h('div.card.meteobar', h('div.card-body', [h('div.frow.c3', [field(t('auto_model'), sel), h('div.f', [h('label', ' '), h('div.row-actions', [btn, status])]), h('div.f', [h('label', ' '), sugg])])]));
}

/**
 * Rahmen eines automatischen Panels. p.auto = 'meteogram'|'wind'|…;
 * d = Panel-Datensatz (d.content.auto = Schnappschuss). onChange() nach Änderungen.
 */
export function autoBlock(p, d, b, ctx, { onChange, readOnly, upload }) {
  setAirspaceUrl(ctx.settings.airspaceTileUrl);
  const wrap = h('div.autoblock');
  const toolbar = h('div.row-actions.no-print');
  const body = h('div');
  const status = h('span.note');
  const setSnap = (snap) => { d.content.auto = snap; onChange(); draw(); };
  async function run() {
    status.textContent = t('loading'); toolbar.querySelectorAll('button').forEach((x) => { x.disabled = true; });
    try {
      let snap;
      if (p.auto === 'dabs') snap = await fetchDabs(b, ctx, upload);
      else if (p.auto === 'synoptic') snap = await fetchSynoptic(b, ctx);
      else snap = await DATA.AUTO_FETCHERS[p.key](ctx, b);
      setSnap(snap); status.textContent = '';
    } catch (e) { status.textContent = e.code === 'remote' || e.message === 'remote only' ? t('ac_localOnly') : `${t('error')}: ${e.message}`; console.warn(p.key, e); }
    toolbar.querySelectorAll('button').forEach((x) => { x.disabled = false; });
  }
  function draw() {
    clear(toolbar); clear(body);
    if (!readOnly) {
      toolbar.appendChild(h('button.btn', { type: 'button', onclick: run }, d.content.auto ? t('auto_refresh') : t('auto_load')));
      if (p.auto === 'traj') toolbar.appendChild(trajControls(b, ctx, () => { onChange(); run(); }));
      if (p.auto === 'dabs') toolbar.appendChild(select([{ value: 'today', label: t('auto_today') }, { value: 'tomorrow', label: t('auto_tomorrow') }], b.dabsDay || dabsDayFor(b), { onchange: (e) => { b.dabsDay = e.target.value; onChange(); } }));
      if (p.auto === 'notam') toolbar.appendChild(h('span.note', ctx.can('notam') ? `${t('auto_notamRadius')} ${ctx.settings.notamRadiusNm || 25} NM` : t('feat_disabled')));
      if (d.content.auto && ctx.store.mode === 'remote' && ctx.can('ai')) toolbar.appendChild(h('button.btn', { type: 'button', onclick: () => askAi(p, d, b, ctx, onChange, draw) }, d.ai?.text ? t('ai_again') : t('ai_ask')));
      if (d.content.auto) toolbar.appendChild(h('button.btn.icon', { type: 'button', title: t('auto_clear'), onclick: () => { if (confirm(t('auto_clear') + '?')) { d.content.auto = null; onChange(); draw(); } } }, '✕'));
      toolbar.appendChild(status);
    }
    if (p.auto === 'radar') body.appendChild(radarLive(b, ctx));
    const snap = d.content.auto;
    if (snap) body.appendChild(renderSnapshot(snap, b, ctx, { interactive: !readOnly }));
    else if (p.auto !== 'radar') body.appendChild(h('div.note', readOnly ? t('auto_empty') : t('auto_hint_' + p.auto, { s: p.phase2 || '' })));
  }
  draw();
  wrap.append(toolbar, body);
  // beim ersten Öffnen ohne Schnappschuss automatisch laden (nur Modell-Panels, nicht NOTAM/DABS)
  if (!readOnly && !d.content.auto && (['meteogram', 'wind', 'temps', 'traj', 'metar', 'sigmet', 'balloon', 'pdiff'].includes(p.auto) || (p.auto === 'fwp' && b.site.country === 'DE')) && b.site.lat != null && ctx.autoLoad !== false) setTimeout(run, 50 + Math.random() * 400);
  return wrap;
}

function trajControls(b, ctx, onApply) {
  if (!b.traj) b.traj = { durationMin: ctx.settings.trajDefaults?.[b.balloon.type] || 120, levels: [...(b.intent.levels || [])], startOffsetMin: 0 };
  const dur = input('number', b.traj.durationMin, { step: 30, min: 30, style: { width: '90px' }, title: t('duration') + ' (min)', onchange: (e) => { b.traj.durationMin = num(e.target.value, 120); onApply(); } });
  const off = select([-120, -60, -30, 0, 30, 60, 120].map((v) => ({ value: v, label: `${v > 0 ? '+' : ''}${v} min` })), b.traj.startOffsetMin || 0, { title: t('auto_trajOffset'), onchange: (e) => { b.traj.startOffsetMin = +e.target.value; onApply(); } });
  const lv = input('text', (b.traj.levels || []).join(', '), { placeholder: 'SFC, 1000 AGL, 3000, FL065', style: { minWidth: '200px' }, title: t('levels'), onchange: (e) => { b.traj.levels = e.target.value.split(/[,;]+/).map((x) => x.trim()).filter(Boolean); onApply(); } });
  return h('span.inline', [dur, off, lv]);
}

const dabsDayFor = (b) => { const d = new Date(); const sameDay = new Date(b.time.startMs).toDateString() === d.toDateString(); return sameDay ? 'today' : 'tomorrow'; };

/** DABS-PDF über den Worker holen, Seiten rendern, als Bilder ablegen. */
async function fetchDabs(b, ctx, upload) {
  if (ctx.store.mode !== 'remote') throw new Error(t('ac_localOnly'));
  const day = b.dabsDay || dabsDayFor(b);
  const j = await ctx.store.data('dabs', { day, b: b.id }, shareTok(ctx));
  const pdfUrl = ctx.store.apiBase + j.url;
  const pdfjs = await import('../vendor/pdfjs/pdf.min.mjs');
  pdfjs.GlobalWorkerOptions.workerSrc = new URL('../vendor/pdfjs/pdf.worker.min.mjs', import.meta.url).href;
  const doc = await pdfjs.getDocument({ url: pdfUrl }).promise;
  const images = [];
  for (let i = 1; i <= Math.min(doc.numPages, 6); i++) {
    const pg = await doc.getPage(i);
    const vp = pg.getViewport({ scale: 1.6 });
    const canvas = document.createElement('canvas'); canvas.width = vp.width; canvas.height = vp.height;
    await pg.render({ canvasContext: canvas.getContext('2d'), viewport: vp }).promise;
    const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
    const r = await upload(dataUrl);
    images.push({ url: r.url, caption: `DABS ${j.date} (${day === 'today' ? t('auto_today') : t('auto_tomorrow')}) · ${t('auto_page')} ${i}/${doc.numPages}` });
  }
  return { kind: 'dabs', stand: Date.now(), source: 'skybriefing DABS', data: { day, date: j.date, pdfUrl }, images, text: `DABS ${j.date} (${day}), ${images.length} ${t('auto_page')}` };
}

/** Amtliche Karten als Schnappschuss (DWD-Analyse u. a.) über den Worker ablegen. */
async function fetchSynoptic(b, ctx) {
  if (ctx.store.mode !== 'remote') throw new Error(t('ac_localOnly'));
  const charts = ctx.settings.synopticCharts || [];
  const images = []; const errs = [];
  const validIso = (offH) => { const ms = Math.round((b.time.startMs + offH * 3600000) / (3 * 3600000)) * 3 * 3600000; return new Date(ms).toISOString().slice(0, 13) + ':00:00Z'; };
  for (const c of charts) {
    const url = (c.url || '').replace(/\{validTime(?:\+(\d+))?\}/g, (_, hh) => validIso(+(hh || 0)));
    try { const j = await ctx.store.data('snapshot', { b: b.id }, shareTok(ctx), { url }); images.push({ url: ctx.store.apiBase + j.url, caption: `${c.name} · ${fmtDateTime(b.site.tz || 'Europe/Zurich', j.fetched, getLang())}${/ecmwf/.test(url) ? ' · © ECMWF, CC-BY-4.0' : /dwd\.de/.test(url) ? ' · © DWD' : ''}`, src: url }); }
    catch (e) { errs.push(`${c.name}: ${e.message}`); }
  }
  if (!images.length) throw new Error(errs.join(' · ') || t('auto_none'));
  return { kind: 'synoptic', stand: Date.now(), source: charts.map((c) => c.name).join(', '), data: { errors: errs }, images, text: `${images.length} ${t('images')}: ${images.map((i) => i.caption).join('; ')}` };
}

/** Radar live (RainViewer-Kacheln auf OSM), nur Bildschirm. */
function radarLive(b, ctx) {
  const el = h('div.map.radar.no-print');
  const note = h('div.note', t('auto_radarNote'));
  setTimeout(async () => {
    if (typeof L === 'undefined' || b.site.lat == null) return;
    const map = L.map(el).setView([b.site.lat, b.site.lon], 8);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 12, attribution: '© OpenStreetMap' }).addTo(map);
    if (ctx.settings.airspaceTileUrl) L.tileLayer(ctx.settings.airspaceTileUrl, { maxZoom: 14, opacity: 0.75, attribution: 'Luftraum: openAIP' }).addTo(map);
    L.marker([b.site.lat, b.site.lon]).addTo(map);
    try {
      const j = await fetch('https://api.rainviewer.com/public/weather-maps.json').then((r) => r.json());
      const frames = j.radar?.past || [];
      const last = frames[frames.length - 1];
      if (last) { L.tileLayer(`${j.host}${last.path}/256/{z}/{x}/{y}/2/1_1.png`, { opacity: 0.65, attribution: 'RainViewer' }).addTo(map); note.textContent = `${t('auto_radarNote')} · RainViewer ${new Date(last.time * 1000).toISOString().slice(11, 16)} UTC`; }
    } catch { /* ohne Radar */ }
    setTimeout(() => map.invalidateSize(), 60);
  }, 0);
  const links = ctx.settings.sources || {};
  return h('div', [el, note, h('div.row-actions', [links.windy ? h('a.btn', { href: links.windy, target: '_blank', rel: 'noopener' }, 'Windy ↗') : null, h('a.btn', { href: 'https://www.meteoschweiz.admin.ch/wetter/wetter-und-klima-aktuell/radarbild.html', target: '_blank', rel: 'noopener' }, 'MeteoSchweiz Radar ↗'), h('a.btn', { href: 'https://www.blitzortung.org/de/live_lightning_maps.php', target: '_blank', rel: 'noopener' }, 'Blitzortung ↗'), h('a.btn', { href: 'https://www.sat24.com/de/eu', target: '_blank', rel: 'noopener' }, 'Sat24 ↗')])]);
}

/** KI-Hinweis anfordern (Worker → Anthropic). */
async function askAi(p, d, b, ctx, onChange, redraw) {
  const prompt = panelPrompt(p, d, b, ctx);
  const edit = textarea(prompt.user, { rows: 8 });
  const ok = await dialog(t('ai_title'), h('div', [h('div.note', t('ai_hint')), edit]), [{ label: t('cancel'), value: false }, { label: t('ai_send'), value: true, primary: true }], { cls: 'wide' });
  if (!ok) return;
  toast(t('loading'));
  try {
    const res = await aiHint(ctx, b, { system: prompt.system, prompt: edit.value, images: prompt.images, model: ctx.settings.aiModel });
    d.ai = { text: res.text, model: res.model, ts: Date.now(), by: ctx.who };
    onChange(); redraw(); document.dispatchEvent(new CustomEvent('fb:ai', { detail: { key: p.key } }));
    toast(t('ok'));
  } catch (e) { toast(`${t('error')}: ${e.message}`); }
}
