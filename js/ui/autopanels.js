/* Fahrtbriefing — automatische Panels in der Erarbeitungssicht: Modell-Leiste,
 * Aktualisieren je Panel, Trajektorien-Steuerung, DABS (PDF → Bilder), Karten-
 * Schnappschüsse, Radar (live), KI-Hinweis. Die Darstellung des Schnappschusses
 * selbst liegt in autorender.js (gemeinsam mit der Briefingsicht). */
import { h, clear, toast, num, dialog } from '../util.js';
import { t, getLang } from '../i18n.js';
import { field, input, select, textarea, check } from './widgets.js';
import { renderSnapshot, setAirspaceUrl, renderSondeWindow } from './autorender.js';
import * as DATA from '../auto/data.js';
import { MODELS, modelsFor, modelName, suggestModel } from '../auto/openmeteo.js';
import { hhmm, fmtDateTime } from '../calc/time.js';
import { pointInfo } from '../net.js';
import { placeRow } from './place.js';
import { icao, distKm } from '../calc/geo.js';
import { parseLevel } from '../auto/traj.js';
import { applyLanding } from '../model.js';
import { panelPrompt, aiHint } from '../auto/ai.js';
import { icon, iconSvg } from './icons.js';

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
  const toolbar = h('div.row-actions.no-print.ptools');
  const body = h('div');
  const status = h('span.note');
  const setSnap = (snap) => { d.content.auto = snap; onChange(); draw(); };
  async function run(auto = false) {
    if (auto && !wrap.isConnected) return;   // Sicht inzwischen verlassen (Timer) → nichts laden
    status.textContent = t('loading'); toolbar.querySelectorAll('button').forEach((x) => { x.disabled = true; });
    try {
      let snap;
      if (p.auto === 'dabs') snap = await fetchDabs(b, ctx, upload);
      else if (p.auto === 'synoptic') snap = await fetchSynoptic(b, ctx);
      else snap = await DATA.AUTO_FETCHERS[p.key](ctx, b);
      if (!wrap.isConnected) return;         // Sicht während des Ladens verlassen → nicht mehr speichern
      setSnap(snap); status.textContent = '';
    } catch (e) { status.textContent = e.code === 'remote' || e.message === 'remote only' ? t('ac_localOnly') : `${t('error')}: ${e.message}`; console.warn(p.key, e); }
    toolbar.querySelectorAll('button').forEach((x) => { x.disabled = false; });
  }
  function draw() {
    clear(toolbar); clear(body);
    if (!readOnly) {
      toolbar.appendChild(h('button.btn.small', { type: 'button', onclick: () => run() }, d.content.auto ? t('auto_refresh') : t('auto_load')));
      if (p.auto === 'traj') toolbar.appendChild(trajControls(b, ctx, () => { onChange(); run(); }));
      if (p.auto === 'dabs') toolbar.appendChild(select([{ value: 'today', label: t('auto_today') }, { value: 'tomorrow', label: t('auto_tomorrow') }], b.dabsDay || dabsDayFor(b), { onchange: (e) => { b.dabsDay = e.target.value; onChange(); } }));
      if (p.auto === 'obs') toolbar.appendChild(h('span.inline', [h('span.note', t('auto_obsKm')), input('number', b.obsKm || ctx.settings.obsRadiusKm || 50, { step: 10, min: 10, max: 150, style: { width: '74px' }, onchange: (e) => { b.obsKm = Math.min(150, Math.max(10, num(e.target.value, 50))); onChange(); run(); } })]));
      if (p.auto === 'metar') toolbar.appendChild(h('span.inline', [h('span.note', t('auto_metarKm')), input('number', b.metarKm || ctx.settings.metarRadiusKm || 150, { step: 10, min: 20, max: 400, style: { width: '74px' }, onchange: (e) => { b.metarKm = Math.min(400, Math.max(20, num(e.target.value, 150))); onChange(); run(); } })]));
      if (p.auto === 'notam') {
        if (!ctx.can('notam')) toolbar.appendChild(h('span.note', t('feat_disabled')));
        else toolbar.appendChild(select([{ value: 'route', label: `${t('notam_route')} · ${ctx.settings.notamRadiusNm || 25} NM` }, { value: 'places', label: t('notam_placesMode') }], b.notamMode === 'places' ? 'places' : 'route', { title: t('notam_mode'), onchange: (e) => { b.notamMode = e.target.value; if (b.notamMode === 'places' && !(b.notamPlaces || []).length) b.notamPlaces = [{ name: b.site.name, lat: b.site.lat, lon: b.site.lon, km: 200 }]; onChange(); draw(); } }));
      }
      if (p.auto === 'airspace') toolbar.appendChild(h('span.note', `${t('as_corridor')} ${ctx.settings.airspaceCorridorKm || 5} km · ${b.intent.altMinFt || 0}–${b.intent.altMaxFt || 6000} ft`));
      if (d.content.auto) toolbar.appendChild(h('button.btn.icon.small', { type: 'button', title: t('auto_clear'), onclick: () => { if (confirm(t('auto_clear') + '?')) { d.content.auto = null; onChange(); draw(); } } }, icon('close', 14)));
      toolbar.appendChild(status);
    }
    if (p.auto === 'radar') body.appendChild(radarLive(b, ctx));
    if (p.auto === 'notam' && !readOnly && b.notamMode === 'places') body.appendChild(notamPlacesEditor(b, ctx, () => { onChange(); }, () => run()));
    const snap = d.content.auto;
    const onLanding = (!readOnly && p.auto === 'traj') ? async (pt) => {
      let info = {}; try { info = await pointInfo(pt.lat, pt.lon); } catch { /* ohne Name */ }
      applyLanding(b, { lat: pt.lat, lon: pt.lon, name: info.name || icao(pt.lat, pt.lon), elev: info.elev != null ? Math.round(info.elev) : null }, getLang());
      if (d.content.auto?.data) d.content.auto.data.landing = { lat: b.landing.lat, lon: b.landing.lon, name: b.landing.name };
      onChange(); draw(); toast(`${t('landingSite')}: ${b.landing.name}`);
      document.dispatchEvent(new CustomEvent('fb:landing', { detail: { id: b.id } }));
    } : null;
    if (snap) body.appendChild(renderSnapshot(snap, b, ctx, { interactive: !readOnly, onLanding }));
    else if (p.auto !== 'radar') body.appendChild(h('div.note', readOnly ? t('auto_empty') : p.auto === 'airspace' && ctx.store.mode !== 'remote' ? t('auto_asLocal') : t('auto_hint_' + p.auto, { s: p.phase2 || '' })));
  }
  draw();
  wrap.append(toolbar, body);
  // beim ersten Öffnen ohne Schnappschuss automatisch laden: Modell-Panels sofort; DABS, Karten und
  // NOTAM (Worker-Abrufe, Freigabe) etwas später, damit die Modellpanels zuerst stehen
  const remote = ctx.store.mode === 'remote';
  const auto = ['meteogram', 'wind', 'temps', 'traj', 'metar', 'sigmet', 'balloon', 'pdiff', 'thermal'].includes(p.auto) || (p.auto === 'fwp' && b.site.country === 'DE');
  const later = remote && (p.auto === 'dabs' || p.auto === 'airspace' || (p.auto === 'synoptic' && (ctx.settings.synopticCharts || []).length) || (p.auto === 'notam' && ctx.can('notam')));
  if (!readOnly && !d.content.auto && (auto || later) && b.site.lat != null && ctx.autoLoad !== false) setTimeout(() => run(true), (later ? 1500 : 50) + Math.random() * 400);
  return wrap;
}

function trajControls(b, ctx, onApply) {
  if (!b.traj) b.traj = { durationMin: ctx.settings.trajDefaults?.[b.balloon.type] || 120, levels: [...(b.intent.levels || [])], startOffsetMin: 0 };
  const dur = input('number', b.traj.durationMin, { step: 30, min: 30, style: { width: '90px' }, title: t('duration') + ' (min)', onchange: (e) => { b.traj.durationMin = num(e.target.value, 120); onApply(); } });
  const off = select([-120, -60, -30, 0, 30, 60, 120].map((v) => ({ value: v, label: `${v > 0 ? '+' : ''}${v} min` })), b.traj.startOffsetMin || 0, { title: t('auto_trajOffset'), style: { width: '120px' }, onchange: (e) => { b.traj.startOffsetMin = +e.target.value; onApply(); } });
  const lv = input('text', (b.traj.levels || []).join(', '), { placeholder: 'SFC, 1000 AGL, 3000, FL065', style: { width: '280px' }, title: t('levels'), onchange: (e) => { b.traj.levels = e.target.value.split(/[,;]+/).map((x) => x.trim()).filter(Boolean); onApply(); } });
  // Klick ins Niveaufeld: senkrechte Liste der verfügbaren Niveaus zum An-/Abwählen (eigene Werte weiterhin tippbar)
  const AVAIL = ['SFC', '500 AGL', '1000 AGL', '1500 AGL', '2000 AGL', '3000 AGL', '2000', '3000', '4000', '5000', '6000', '7000', '8000', '10000', 'FL100', 'FL120', 'FL150'];
  const norm = (x) => String(x).toUpperCase().replace(/\s+/g, ' ').trim();
  const pick = h('div.lvl-pick', { hidden: true });
  const drawPick = () => {
    clear(pick);
    const cur = new Set((b.traj.levels || []).map(norm));
    for (const L of AVAIL) {
      const on = cur.has(norm(L));
      pick.appendChild(h('label.lvl-it', [h('input', { type: 'checkbox', checked: on, onchange: (e) => {
        const set = (b.traj.levels || []).filter((x) => norm(x) !== norm(L));
        if (e.target.checked) set.push(L);
        b.traj.levels = set.sort((a, c) => (levelOrder(a) - levelOrder(c)));
        lv.value = b.traj.levels.join(', '); onApply(); drawPick();
      } }), ' ', L]));
    }
  };
  const levelOrder = (x) => { const p = parseLevel(x); return p ? (p.kind === 'sfc' ? -1 : p.kind === 'agl' ? p.ft : p.ft + 0.5) : 1e9; };
  lv.addEventListener('focus', () => { drawPick(); pick.hidden = false; });
  document.addEventListener('click', (e) => { if (!pick.isConnected) return; if (!e.target.closest('.lvl-wrap')) pick.hidden = true; });
  return h('span.inline', [dur, off, h('span.lvl-wrap', [lv, pick])]);
}

/** Orte für die NOTAM-Umkreisabfrage: Ort (Ortswahl, Standard Startort), Radius km (Standard 200), «+»/✕, «Abrufen». */
function notamPlacesEditor(b, ctx, onChange, onRun) {
  const box = h('div.notam-places');
  const draw = () => {
    clear(box);
    (b.notamPlaces || []).forEach((pl, i) => box.appendChild(h('div.np-row', [
      placeRow(pl, { label: t('notam_place'), title: t('notam_place'), onPick: (q) => { Object.assign(pl, { name: q.name, lat: q.lat, lon: q.lon }); onChange(); draw(); } }),
      h('span.inline', [h('span.note', t('notam_radiusKm')), input('number', pl.km ?? 200, { step: 10, min: 10, max: 400, style: { width: '80px' }, onchange: (e) => { pl.km = Math.min(400, Math.max(10, num(e.target.value, 200))); onChange(); } }), h('button.btn.icon.small', { type: 'button', title: t('remove'), onclick: () => { b.notamPlaces.splice(i, 1); onChange(); draw(); } }, icon('close', 14))]),
    ])));
    box.appendChild(h('div.row-actions', [h('button.btn.small', { type: 'button', onclick: () => { (b.notamPlaces = b.notamPlaces || []).push({ name: b.site.name, lat: b.site.lat, lon: b.site.lon, km: 200 }); onChange(); draw(); } }, `+ ${t('notam_addPlace')}`), h('button.btn.small.primary', { type: 'button', onclick: onRun }, t('auto_load'))]));
  };
  draw();
  return box;
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
  // Grosswetteranalyse der nationalen Dienste: Land des Startorts und des Landeraums
  const ccs = [...new Set([b.site.country, b.landing?.country].filter(Boolean))];
  const texts = [];
  for (const src of (ctx.settings.wxTexts || []).filter((x) => ccs.includes(x.cc))) {
    if (src.disabled) { texts.push({ cc: src.cc, name: src.name, url: src.url, text: '', linkOnly: true }); continue; }
    try { const j = await ctx.store.data('wxtext', { url: src.url, sel: src.sel || '' }, shareTok(ctx)); texts.push({ cc: src.cc, name: src.name, url: src.url, text: j.text, fetched: j.fetched, truncated: j.truncated }); }
    catch (e) { errs.push(`${src.name}: ${e.message}`); }
  }
  if (!images.length && !texts.length) throw new Error(errs.join(' · ') || t('auto_none'));
  return { kind: 'synoptic', stand: Date.now(), source: charts.map((c) => c.name).concat(texts.map((x) => x.name)).join(', '), data: { errors: errs, texts }, images, text: `${images.length} ${t('images')}: ${images.map((i) => i.caption).join('; ')}` + texts.map((x) => `\n\n${x.name}:\n${x.text}`).join('') };
}

/** Radar live (RainViewer-Kacheln auf OSM), nur Bildschirm; Webcams im Umkreis (Worker: Windy/OSM) plus eigene Liste. */
function radarLive(b, ctx) {
  const el = h('div.map.radar.no-print');
  const sondeBox = h('div.sonde-win.no-print', { hidden: true });
  const grid = h('div.radar-grid', [el, sondeBox]);
  const note = h('div.note', t('auto_radarNote'));
  const camList = h('div.cams');
  const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const camPopup = (w) => `<b>${esc(w.name || 'Webcam')}</b>${w.place ? `<br><small>${esc(w.place)}</small>` : ''}${w.distKm != null ? `<br><small>${w.distKm} km</small>` : ''}${w.img ? `<br><a href="${esc(w.url)}" target="_blank" rel="noopener"><img src="${esc(w.img)}" alt="" style="max-width:220px;display:block;margin-top:4px"></a>` : ''}<br><a href="${esc(w.url)}" target="_blank" rel="noopener">${esc((w.url || '').replace(/^https?:\/\/(www\.)?/, '').slice(0, 40))} ↗</a>`;
  setTimeout(async () => {
    if (typeof L === 'undefined' || b.site.lat == null) return;
    const map = L.map(el).setView([b.site.lat, b.site.lon], 7);   // weit genug für die Niederschlagsgebiete
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 14, attribution: '© OpenStreetMap' }).addTo(map);
    L.marker([b.site.lat, b.site.lon]).addTo(map).bindTooltip(`${t('site')}: ${b.site.name || ''}`);
    if (b.landing?.lat != null) L.marker([b.landing.lat, b.landing.lon], { icon: L.divIcon({ className: 'land-dot', iconSize: [16, 16], iconAnchor: [8, 8] }) }).addTo(map).bindTooltip(`${t('landingSite')}: ${b.landing.name || ''}`);
    // Ebenen mit Klickboxen rechts: Regen (RainViewer), Webcams, Sonden (SondeHub)
    const camGroup = L.layerGroup().addTo(map), sondeGroup = L.layerGroup(), rainGroup = L.layerGroup().addTo(map);
    const overlays = {}; overlays[t('radar_rain')] = rainGroup; overlays[t('radar_cams')] = camGroup; overlays[t('radar_sondes')] = sondeGroup;
    L.control.layers(null, overlays, { position: 'topright', collapsed: false }).addTo(map);
    let sondesLoaded = false;
    map.on('overlayadd', async (e) => {
      if (e.layer !== sondeGroup || sondesLoaded) return;
      sondesLoaded = true;
      // SondeHub: Startplätze im Umkreis und Sonden der letzten 6 h (öffentliche API, direkt aus dem Browser)
      const sIcon = (live) => L.divIcon({ className: `sonde-ico${live ? ' live' : ''}`, html: live ? '🎈' : '◎', iconSize: [20, 20], iconAnchor: [10, 10] });
      try {
        const sites = await fetch('https://api.v2.sondehub.org/sites').then((r) => r.json());
        for (const st of Object.values(sites || {})) { const la = +st.position?.[1], lo = +st.position?.[0]; if (!isFinite(la) || distKm(b.site.lat, b.site.lon, la, lo) > 250) continue; L.marker([la, lo], { icon: sIcon(false), title: st.station_name }).addTo(sondeGroup).bindPopup(`<b>${esc(st.station_name)}</b><br>${esc(st.times?.join(', ') || '')} UTC<br><a href="https://sondehub.org/#!site=${esc(st.station)}" target="_blank" rel="noopener">sondehub.org ↗</a>`); }
      } catch { /* ohne Startplätze */ }
      try {
        const j = await fetch(`https://api.v2.sondehub.org/sondes?lat=${b.site.lat.toFixed(3)}&lon=${b.site.lon.toFixed(3)}&distance=250000&last=21600`).then((r) => r.json());
        for (const sd of Object.values(j || {})) { if (sd.lat == null) continue; const mk2 = L.marker([sd.lat, sd.lon], { icon: sIcon(true), title: sd.serial }).addTo(sondeGroup).bindTooltip(`${esc(sd.serial)} · ${Math.round(sd.alt)} m · ${esc((sd.datetime || '').slice(11, 16))} UTC`); mk2.on('click', () => openSonde(sd)); }
      } catch { /* ohne Sonden */ }
    });
    // Klick auf eine Sonde: Karte verkleinert links (Ausschnitt um die Sonde), rechts Emagramm + Daten
    async function openSonde(sd) {
      grid.classList.add('with-sonde'); sondeBox.hidden = false; clear(sondeBox);
      sondeBox.appendChild(h('div.sonde-head', [h('b', `🎈 ${sd.serial}`), h('span.muted.small', ` ${sd.type || ''} · ${Math.round(distKm(b.site.lat, b.site.lon, sd.lat, sd.lon))} km`), h('button.btn.icon.small', { type: 'button', title: t('close'), style: { marginLeft: 'auto' }, onclick: () => { grid.classList.remove('with-sonde'); sondeBox.hidden = true; setTimeout(() => map.invalidateSize(), 60); } }, icon('close', 14))]));
      sondeBox.appendChild(h('div.note', t('loading')));
      setTimeout(() => { map.invalidateSize(); map.setView([sd.lat, sd.lon], Math.max(map.getZoom(), 9)); }, 60);
      try {
        const so = await ctx.store.data('sonde', { serial: sd.serial }, shareTok(ctx));
        renderSondeWindow(sondeBox, so, b);
      } catch (e) { sondeBox.appendChild(h('div.err', `${t('error')}: ${e.code === 'remote' ? t('auto_sondeLocal') : e.message}`)); }
    }
    const camIcon = (own) => L.divIcon({ className: `cam-ico${own ? ' own' : ''}`, html: '📷', iconSize: [22, 22], iconAnchor: [11, 11] });
    // Eigene Webcams (Einstellungen → Meteo)
    const own = (ctx.settings.webcams || []).filter((w) => w.lat != null && w.lon != null);
    for (const w of own) L.marker([w.lat, w.lon], { icon: camIcon(true), title: w.name }).addTo(camGroup).bindPopup(camPopup(w));
    // Webcams im Umkreis aus öffentlichen Quellen (Startplatz, dazu Landeraum, wenn weiter weg)
    const km = +ctx.settings.webcamKm || 40;
    const centers = [[b.site.lat, b.site.lon]];
    if (b.landing?.lat != null && distKm(b.site.lat, b.site.lon, b.landing.lat, b.landing.lon) > km * 0.7) centers.push([b.landing.lat, b.landing.lon]);
    const found = []; const errs = []; let src = ''; let hasKey = true; let localOnly = false;
    for (const [la, lo] of centers) {
      try { const j = await ctx.store.data('webcams', { lat: la.toFixed(4), lon: lo.toFixed(4), km }, shareTok(ctx)); for (const w of j.webcams || []) if (!found.some((f) => f.id === w.id) && !own.some((o) => distKm(o.lat, o.lon, w.lat, w.lon) < 0.15)) found.push(w); src = j.source || src; hasKey = !!j.hasKey; errs.push(...(j.errors || [])); }
      catch (e) { if (e.code === 'remote') localOnly = true; else errs.push(e.message); }
    }
    if (!el.isConnected) return;
    for (const w of found) L.marker([w.lat, w.lon], { icon: camIcon(false), title: w.name }).addTo(camGroup).bindPopup(camPopup(w));
    const all = own.map((w) => ({ ...w, distKm: Math.round(distKm(b.site.lat, b.site.lon, w.lat, w.lon) * 10) / 10, own: true })).concat(found).sort((x, y) => x.distKm - y.distKm);
    const items = all.slice(0, 30).map((w) => h('li', [h('a', { href: w.url, target: '_blank', rel: 'noopener' }, w.name || 'Webcam'), ` · ${w.distKm} km`, w.place ? h('span.muted', ` · ${w.place}`) : null, w.own ? h('span.muted', ` · ${t('auto_webcamsOwn')}`) : null]));
    camList.appendChild(h('details', [h('summary', `📷 ${t('auto_webcamsNear')} ${km} km: ${all.length}${src ? ` (${src}${own.length ? ` + ${t('auto_webcamsOwn')}` : ''})` : ''}`), items.length ? h('ul.plain', items) : h('div.note', t('auto_webcamsNone')), localOnly ? h('div.note', t('auto_webcamsLocal')) : !hasKey ? h('div.note', t('auto_webcamsKey')) : null, errs.length ? h('div.note', errs.join(' · ')) : null]));
    try {
      const j = await fetch('https://api.rainviewer.com/public/weather-maps.json').then((r) => r.json());
      const frames = j.radar?.past || [];
      const last = frames[frames.length - 1];
      // maxNativeZoom 7: RainViewer liefert darüber «Zoom level not supported» – Kacheln werden hochskaliert
      if (last) { L.tileLayer(`${j.host}${last.path}/256/{z}/{x}/{y}/2/1_1.png`, { opacity: 0.65, maxNativeZoom: 7, maxZoom: 14, attribution: 'RainViewer' }).addTo(rainGroup); note.textContent = `${t('auto_radarNote')} · RainViewer ${new Date(last.time * 1000).toISOString().slice(11, 16)} UTC`; }
    } catch { /* ohne Radar */ }
    setTimeout(() => map.invalidateSize(), 60);
  }, 0);
  const links = ctx.settings.sources || {};
  return h('div', [grid, note, camList, h('div.row-actions', [links.windy ? h('a.btn', { href: links.windy, target: '_blank', rel: 'noopener' }, 'Windy ↗') : null, h('a.btn', { href: 'https://www.meteoschweiz.admin.ch/wetter/wetter-und-klima-aktuell/radarbild.html', target: '_blank', rel: 'noopener' }, 'MeteoSchweiz Radar ↗'), h('a.btn', { href: 'https://www.blitzortung.org/de/live_lightning_maps.php', target: '_blank', rel: 'noopener' }, 'Blitzortung ↗'), h('a.btn', { href: 'https://www.sat24.com/de/eu', target: '_blank', rel: 'noopener' }, 'Sat24 ↗')])]);
}

/** KI-Kommentar anfordern (Worker → Anthropic). Standard: direkt, ohne Prompt-Maske; opts.edit = Prompt zuerst zeigen. */
export async function askAi(p, d, b, ctx, onChange, redraw, opts = {}) {
  const prompt = panelPrompt(p, d, b, ctx);
  let user = prompt.user;
  if (opts.edit) {
    const edit = textarea(prompt.user, { rows: 10 });
    const ok = await dialog(t('ai_title'), h('div', [h('div.note', t('ai_hint')), edit]), [{ label: t('cancel'), value: false }, { label: t('ai_send'), value: true, primary: true }], { cls: 'wide' });
    if (!ok) return;
    user = edit.value;
  }
  toast(t('ai_working'));
  try {
    const res = await aiHint(ctx, b, { system: prompt.system, prompt: user, images: prompt.images, model: ctx.settings.aiModel });
    d.ai = { text: res.text, model: res.model, ts: Date.now(), by: ctx.who };
    onChange(); redraw(); document.dispatchEvent(new CustomEvent('fb:ai', { detail: { key: p.key } }));
  } catch (e) { toast(`${t('error')}: ${e.message}`); }
}
