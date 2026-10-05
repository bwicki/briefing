/* Fahrtbriefing — kleine Helfer für DOM, Speicher, Formatierung. */

export const $ = (id) => document.getElementById(id);

/** h('div.cls#id', {attr}, ...children) – kompakter DOM-Baukasten. */
export function h(spec, attrs, ...children) {
  if (attrs && (typeof attrs !== 'object' || attrs instanceof Node || Array.isArray(attrs))) { children.unshift(attrs); attrs = null; }
  const [tag, ...rest] = spec.split(/(?=[.#])/);
  const el = document.createElement(tag || 'div');
  for (const r of rest) { if (r[0] === '.') { if (r.length > 1) el.classList.add(r.slice(1)); } else if (r[0] === '#') el.id = r.slice(1); }   // leeres Segment («.tag.») ignorieren
  if (attrs) for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className += (el.className ? ' ' : '') + v;
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k === 'html') el.innerHTML = v;
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
    else if (k === 'dataset') Object.assign(el.dataset, v);
    else if (k in el && typeof v !== 'string' && k !== 'value') el[k] = v;
    else el.setAttribute(k, v === true ? (k.startsWith('aria-') ? 'true' : '') : v);   // aria-pressed="true" (CSS-Selektor)
  }
  append(el, children);
  return el;
}
export function append(el, children) {
  for (const c of children.flat(Infinity)) {
    if (c == null || c === false) continue;
    el.appendChild(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return el;
}
export const clear = (el) => { while (el.firstChild) el.removeChild(el.firstChild); return el; };

export const uid = (n = 10) => {
  const a = new Uint8Array(n); crypto.getRandomValues(a);
  return Array.from(a, (b) => 'abcdefghijklmnopqrstuvwxyz0123456789'[b % 36]).join('');
};
export const deepCopy = (o) => JSON.parse(JSON.stringify(o));
export const num = (v, def = 0) => { const n = parseFloat(String(v).replace(',', '.')); return Number.isFinite(n) ? n : def; };
export const fmt = (v, d = 0) => (v == null || !Number.isFinite(v) ? '–' : Number(v).toLocaleString('de-CH', { minimumFractionDigits: d, maximumFractionDigits: d }).replace(/’/g, "'"));
export const fmtSigned = (v, d = 0) => (v == null ? '–' : (v > 0 ? '+' : v < 0 ? '−' : '') + fmt(Math.abs(v), d));

export const load = (k, def) => { try { const v = localStorage.getItem(k); return v == null ? def : JSON.parse(v); } catch { return def; } };
export const save = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { console.warn('localStorage', e); } };
export const del = (k) => { try { localStorage.removeItem(k); } catch { /* egal */ } };

let toastTimer = null;
export function toast(msg, ms = 2600) {
  let el = $('toast');
  if (!el) { el = h('div#toast.toast'); document.body.appendChild(el); }
  el.textContent = msg; el.classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove('show'), ms);
}

/** Modaler Dialog: content ist ein Node; Promise löst mit dem Wert von close(v). */
export function dialog(title, content, buttons = [], opts = {}) {
  return new Promise((resolve) => {
    const back = h('div.backdrop');
    const box = h('div.dialog' + (opts.cls ? '.' + opts.cls : ''), [h('div.dialog-head', [h('div.section-title', title), h('button.btn.icon', { onclick: () => close(null), 'aria-label': 'close' }, '✕')]), h('div.dialog-body', content)]);
    const foot = h('div.dialog-foot');
    for (const b of buttons) foot.appendChild(h('button.btn' + (b.primary ? '.primary' : ''), { onclick: () => close(b.value === undefined ? true : b.value) }, b.label));
    if (buttons.length) box.appendChild(foot);
    back.appendChild(box); document.body.appendChild(back);
    back.addEventListener('click', (e) => { if (e.target === back) close(null); });
    function close(v) { back.remove(); resolve(v); }
    box.close = close;
  });
}

/** Vergrösserte Ansicht (Grafik, Bild oder Tabelle) als Popup mit Schliessknopf; Escape/Klick daneben schliesst. */
export function lightbox(node, title = '') {
  const back = h('div.backdrop.lightbox');
  const clone = node.cloneNode(true);
  clone.querySelectorAll('[id]').forEach((x) => x.removeAttribute('id'));
  if (clone.tagName === 'svg' || clone.tagName === 'SVG') { clone.removeAttribute('width'); clone.removeAttribute('height'); clone.style.width = '100%'; clone.style.height = 'auto'; clone.style.maxHeight = '86vh'; }
  const box = h('div.dialog.lb', [h('div.dialog-head', [h('div.section-title', title), h('button.btn.icon', { onclick: close, 'aria-label': 'close', title: 'Schliessen' }, '✕')]), h('div.dialog-body.lb-body', clone)]);
  back.appendChild(box); document.body.appendChild(back);
  back.addEventListener('click', (e) => { if (e.target === back) close(); });
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  document.addEventListener('keydown', onKey);
  function close() { back.remove(); document.removeEventListener('keydown', onKey); }
  return close;
}

export const debounce = (fn, ms = 400) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };

/** Bild (File/Blob) auf max. `max` px verkleinern, JPEG als dataURL. */
export function shrinkImage(blob, max = 1600, quality = 0.85) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      const s = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
      const ctx = c.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height); ctx.drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      resolve(c.toDataURL('image/jpeg', quality));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('image')); };
    img.src = url;
  });
}
/** Bild quadratisch aus der Mitte beschneiden (ohne Verzerrung) und auf size × size px verkleinern → JPEG-Daten-URL (Hüllenbild). */
export function shrinkImageSquare(blob, size = 192, quality = 0.85) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      const w = img.naturalWidth || img.width, hh = img.naturalHeight || img.height;
      if (!w || !hh) { URL.revokeObjectURL(url); return reject(new Error('image')); }
      const side = Math.min(w, hh), sx = Math.round((w - side) / 2), sy = Math.round((hh - side) / 2);
      const c = document.createElement('canvas'); c.width = size; c.height = size;
      const ctx = c.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, size, size); ctx.drawImage(img, sx, sy, side, side, 0, 0, size, size);
      URL.revokeObjectURL(url);
      resolve(c.toDataURL('image/jpeg', quality));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('image')); };
    img.src = url;
  });
}
export function dataUrlToBlob(dataUrl) {
  const [head, b64] = dataUrl.split(',');
  const mime = /data:([^;]+)/.exec(head)[1];
  const bin = atob(b64); const a = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) a[i] = bin.charCodeAt(i);
  return new Blob([a], { type: mime });
}
export const escapeHtml = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/** Mehrzeiligen Text mit Links in Absätze umsetzen (ohne HTML aus dem Text). */
export function textToNodes(text) {
  const frag = document.createDocumentFragment();
  const lines = String(text || '').split(/\r?\n/);
  lines.forEach((line, i) => {
    const parts = line.split(/(https?:\/\/[^\s<>"']+)/g);
    for (const p of parts) {
      if (/^https?:\/\//.test(p)) frag.appendChild(h('a', { href: p, target: '_blank', rel: 'noopener' }, p));
      else if (p) frag.appendChild(document.createTextNode(p));
    }
    if (i < lines.length - 1) frag.appendChild(document.createElement('br'));
  });
  return frag;
}

