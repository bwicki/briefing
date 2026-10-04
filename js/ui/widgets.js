/* Fahrtbriefing — wiederverwendbare Oberflächenbausteine. */
import { h, clear, uid, shrinkImage, toast, fmt } from '../util.js';
import { t } from '../i18n.js';

export const field = (label, input, cls = '') => h('div.f' + (cls ? '.' + cls : ''), [h('label', label), input]);

export function input(type, value, attrs = {}) {
  const el = h('input', { type, ...attrs });
  if (value != null) el.value = value;
  return el;
}
export function select(options, value, attrs = {}) {
  const el = h('select', attrs);
  for (const o of options) {
    const opt = h('option', { value: o.value }, o.label);
    if (String(o.value) === String(value)) opt.selected = true;
    el.appendChild(opt);
  }
  return el;
}
export function textarea(value, attrs = {}) { const el = h('textarea', attrs); el.value = value || ''; return el; }
export function check(label, checked, onchange, attrs = {}) {
  const c = h('input', { type: 'checkbox', ...attrs }); c.checked = !!checked;
  c.addEventListener('change', () => onchange(c.checked));
  return h('label.check', [c, h('span', label)]);
}
export const tag = (cls, text) => h('span.tag' + (cls ? '.' + cls : ''), text);
export const kv = (rows) => h('div.kv', rows.filter(Boolean).map(([k, v]) => [h('div.k', k), h('div.v', typeof v === 'string' ? v : v)]));
export const stats = (items) => h('div.stat-strip', items.map(([k, v, cls]) => h('div.stat', [h('div.k', k), h('div.v' + (cls ? '.' + cls : ''), v)])));
export function card(title, body, opts = {}) {
  const el = h('div.card', [title ? h('div.card-head', [h('div.section-title', title), ...(opts.headExtra || [])]) : null, h('div.card-body', body)]);
  return el;
}

/** Bilder aus Zwischenablage / Dateien → verkleinerte dataURLs. */
export async function imagesFromItems(items) {
  const out = [];
  for (const it of items) {
    const f = it.getAsFile ? it.getAsFile() : it;
    if (f && f.type && f.type.startsWith('image/')) out.push(await shrinkImage(f));
  }
  return out;
}

/**
 * Einfüge-Assistent: Textfeld + Bildablage. value = { text, images:[{id,url,caption}] }
 * onChange(value) nach jeder Änderung; upload(dataUrl) → url (Store).
 */
export function pasteArea(value, onChange, upload, opts = {}) {
  const v = value || { text: '', images: [] };
  v.images = v.images || [];
  const wrap = h('div.pastewrap');
  const ta = textarea(v.text, { placeholder: opts.placeholder || t('panel_paste'), rows: opts.rows || 3 });
  ta.addEventListener('input', () => { v.text = ta.value; onChange(v); });
  ta.addEventListener('paste', async (e) => {
    const items = Array.from(e.clipboardData?.items || []).filter((i) => i.type.startsWith('image/'));
    if (!items.length) return;
    e.preventDefault();
    await addImages(await imagesFromItems(items));
  });
  const imgs = h('div.imgs');
  const fileIn = h('input', { type: 'file', accept: 'image/*', multiple: true, style: { display: 'none' } });
  fileIn.addEventListener('change', async () => { await addImages(await imagesFromItems(Array.from(fileIn.files))); fileIn.value = ''; });
  const bar = h('div.row-actions.no-print', [
    h('button.btn', { type: 'button', onclick: () => fileIn.click() }, t('panel_file')),
    navigator.clipboard?.read ? h('button.btn', { type: 'button', onclick: readClipboard }, t('panel_pasteBtn')) : null,
    (v.text || v.images.length) ? h('button.btn', { type: 'button', onclick: () => { if (confirm(t('panel_clear') + '?')) { v.text = ''; v.images = []; ta.value = ''; renderImgs(); onChange(v); } } }, t('panel_clear')) : null,
  ]);
  async function readClipboard() {
    try {
      const items = await navigator.clipboard.read();
      const urls = [];
      for (const it of items) for (const type of it.types) if (type.startsWith('image/')) urls.push(await shrinkImage(await it.getType(type)));
      if (urls.length) await addImages(urls);
      else { const txt = await navigator.clipboard.readText(); if (txt) { ta.value = (ta.value ? ta.value + '\n' : '') + txt; v.text = ta.value; onChange(v); } }
    } catch (e) { toast(`${t('error')}: ${e.message}`); }
  }
  async function addImages(dataUrls) {
    for (const d of dataUrls) {
      try {
        const r = await upload(d);
        v.images.push({ id: uid(8), url: r.url, caption: '' });
      } catch (e) { toast(`${t('error')}: ${e.message}`); }
    }
    renderImgs(); onChange(v);
  }
  function renderImgs() {
    clear(imgs);
    for (const im of v.images) {
      const cap = input('text', im.caption, { class: 'cap', placeholder: t('caption') });
      cap.addEventListener('input', () => { im.caption = cap.value; onChange(v); });
      imgs.appendChild(h('figure', [
        h('img', { src: im.url, alt: im.caption || '' }),
        h('button.btn.icon.rm.no-print', { type: 'button', title: t('removeImage'), onclick: () => { v.images = v.images.filter((x) => x !== im); renderImgs(); onChange(v); } }, '✕'),
        cap,
      ]));
    }
  }
  // Drag & Drop auf das ganze Feld
  wrap.addEventListener('dragover', (e) => { e.preventDefault(); ta.classList.add('drag'); });
  wrap.addEventListener('dragleave', () => ta.classList.remove('drag'));
  wrap.addEventListener('drop', async (e) => { e.preventDefault(); ta.classList.remove('drag'); await addImages(await imagesFromItems(Array.from(e.dataTransfer.files))); });
  renderImgs();
  wrap.append(ta, bar, imgs, fileIn);
  return wrap;
}

/** Leaflet-Karte mit verschiebbarem Marker. onMove(lat, lon) */
export function mapPicker(container, lat, lon, onMove, zoom = 11) {
  if (typeof L === 'undefined') { container.textContent = 'Leaflet fehlt'; return null; }
  const map = L.map(container, { zoomControl: true, attributionControl: true }).setView([lat ?? 47.3, lon ?? 8.4], lat == null ? 7 : zoom);
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 18, attribution: '© OpenStreetMap' }).addTo(map);
  let marker = null;
  const put = (la, lo) => {
    if (!marker) { marker = L.marker([la, lo], { draggable: true }).addTo(map); marker.on('dragend', () => { const p = marker.getLatLng(); onMove(p.lat, p.lng); }); }
    else marker.setLatLng([la, lo]);
  };
  if (lat != null) put(lat, lon);
  map.on('click', (e) => { put(e.latlng.lat, e.latlng.lng); onMove(e.latlng.lat, e.latlng.lng); });
  setTimeout(() => map.invalidateSize(), 50);
  return { map, setPos(la, lo, z) { put(la, lo); map.setView([la, lo], z || map.getZoom()); } };
}

/** Kleine Kurve Tragkraft vs. Höhe (SVG). rows: [{h, climb}] */
export function liftCurve(rows, takeoff, maxAlt) {
  const W = 320, H = 150, pl = 36, pr = 10, pt = 10, pb = 24;
  const hs = rows.map((r) => r.h), cs = rows.map((r) => r.capacity);
  const hMax = Math.max(...hs), cMin = Math.min(...cs, takeoff), cMax = Math.max(...cs, takeoff);
  const x = (c) => pl + (c - cMin) / (cMax - cMin || 1) * (W - pl - pr);
  const y = (hh) => pt + (1 - hh / hMax) * (H - pt - pb);
  const pts = rows.map((r) => `${x(r.capacity).toFixed(1)},${y(r.h).toFixed(1)}`).join(' ');
  const span = cMax - cMin || 1, step = span > 600 ? 200 : span > 300 ? 100 : 50;
  const xt = []; for (let c = Math.ceil(cMin / step) * step; c <= cMax; c += step) xt.push(c);
  // SVG-Namensraum nötig: mit document.createElement entstünde ein HTML-Element «svg», dessen Inhalt als Text erschiene
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`); svg.setAttribute('class', 'curve');
  svg.innerHTML = `
    <polyline fill="none" stroke="var(--dew)" stroke-width="2" points="${pts}"/>
    <line x1="${x(takeoff)}" y1="${pt}" x2="${x(takeoff)}" y2="${H - pb}" stroke="var(--temp)" stroke-dasharray="4 3"/>
    ${maxAlt != null ? `<line x1="${pl}" y1="${y(maxAlt)}" x2="${W - pr}" y2="${y(maxAlt)}" stroke="var(--amber)" stroke-dasharray="3 3"/>` : ''}
    ${[0, 2000, 4000, 6000, 8000, 10000].filter((hh) => hh <= hMax).map((hh) => `<line x1="${pl}" y1="${y(hh)}" x2="${W - pr}" y2="${y(hh)}" stroke="var(--line-soft)" stroke-width="0.6"/><text x="4" y="${y(hh) + 3}" font-size="8" fill="var(--text-dim)" font-family="monospace">${hh}</text>`).join('')}
    ${xt.map((c) => `<line x1="${x(c)}" y1="${H - pb}" x2="${x(c)}" y2="${H - pb + 3}" stroke="var(--text-dim)"/><text x="${x(c)}" y="${H - pb + 11}" font-size="7.5" fill="var(--text-dim)" font-family="monospace" text-anchor="middle">${c}</text>`).join('')}
    <line x1="${pl}" y1="${H - pb}" x2="${W - pr}" y2="${H - pb}" stroke="var(--text-dim)" stroke-width="0.8"/>
    <text x="${x(takeoff) + 3}" y="${pt + 9}" font-size="8" fill="var(--temp)" font-family="monospace">${fmt(takeoff)} kg</text>
    <text x="${W - pr}" y="${H - 2}" font-size="7.5" fill="var(--text-dim)" font-family="monospace" text-anchor="end">kg Tragfähigkeit → · m AMSL ↑</text>`;
  return svg;
}
