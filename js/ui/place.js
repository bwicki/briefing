import { placeLabel } from '../model.js';
/* Fahrtbriefing — Ortswahl: Dialog mit Karte, Ortssuche, Koordinaten (ICAO-Kurzformat)
 * und Google-Maps-Link. Für Startort, Treffpunkt und geplanten Landeraum.
 *
 * Ein «Ort» ist { name, lat, lon, elev, tz, country, icao, address }.
 * pickPlace(initial, opts) → Promise<Ort | null>
 * placeRow(value, opts)    → Zeile «Name · ICAO · Höhe · Maps ↗ · [Wählen…]»
 */
import { h, clear, dialog, toast, num, debounce } from '../util.js';
import { t, getLang } from '../i18n.js';
import { icao, parseIcao, countryGuess, distKm, bearing } from '../calc/geo.js';
import { geocode, pointInfo } from '../net.js';
import { mapPicker, input, field } from './widgets.js';
import { icon, iconSvg } from './icons.js';

/** Google-Maps-Link auf einen Punkt (öffnet in neuem Fenster/Tab). */
export const mapsUrl = (lat, lon) => `https://www.google.com/maps/search/?api=1&query=${(+lat).toFixed(5)}%2C${(+lon).toFixed(5)}`;

export function mapsLink(lat, lon, label) {
  if (lat == null || lon == null) return null;
  return h('a.maps', { href: mapsUrl(lat, lon), target: '_blank', rel: 'noopener noreferrer', title: 'Google Maps' }, label || 'Google Maps ↗');
}

/** Kompakte Ortszeile für Sichten und Druck: Name · 4719N00824E · 461 m · Maps ↗ */
export function placeLine(p, opts = {}) {
  if (!p || p.lat == null) return h('span.muted', opts.empty || t('pick_none'));
  const parts = [];
  if (p.name && !opts.noName) parts.push(h('span.pname', placeLabel(p)));
  parts.push(h('span.mono', icao(p.lat, p.lon)));
  if (opts.decimal) parts.push(h('span.muted.small', `${(+p.lat).toFixed(4)}, ${(+p.lon).toFixed(4)}`));
  if (p.elev != null && !opts.noElev) parts.push(h('span', `${Math.round(p.elev)} m`));
  if (!opts.noLink) parts.push(mapsLink(p.lat, p.lon));
  const out = h('span.pline');
  parts.forEach((x, i) => { if (i) out.appendChild(h('span.sep', ' · ')); out.appendChild(x); });
  return out;
}

/**
 * Feld mit Ortszeile und Knopf «Wählen…». value wird nicht verändert; onPick(place|null).
 * opts: label, readOnly, allowClear, title (Dialogtitel), from (Bezugspunkt für Distanz/Kurs)
 */
export function placeRow(value, opts = {}) {
  const line = h('div.pline-wrap');
  const draw = () => {
    clear(line);
    line.appendChild(placeLine(value, opts));
    if (opts.from && value?.lat != null && opts.from.lat != null) {
      const km = distKm(opts.from.lat, opts.from.lon, value.lat, value.lon), brg = bearing(opts.from.lat, opts.from.lon, value.lat, value.lon);
      line.appendChild(h('span.muted.small', ` · ${km.toFixed(1)} km · ${Math.round(brg).toString().padStart(3, '0')}°`));
    }
  };
  draw();
  const btns = [];
  if (!opts.readOnly) {
    btns.push(h('button.btn', { type: 'button', onclick: async () => { const p = await pickPlace(value, { title: opts.title || opts.label, from: opts.from }); if (p) { if (opts.onPick) opts.onPick(p); else Object.assign(value, p); draw(); } } }, value?.lat != null ? t('pick_change') : t('pick_choose')));
    if (opts.allowClear && value?.lat != null) btns.push(h('button.btn.icon', { type: 'button', title: t('remove'), onclick: () => { if (opts.onPick) opts.onPick(null); else for (const k of ['name', 'lat', 'lon', 'elev', 'icao', 'address']) value[k] = k === 'name' || k === 'icao' || k === 'address' ? '' : null; draw(); } }, icon('close', 14)));
  }
  const row = h('div.prow', [line, btns.length ? h('div.row-actions', btns) : null]);
  return opts.label ? field(opts.label, row) : row;
}

/**
 * Textfeld, das beim Tippen die Ortswahl öffnet (Suche mit dem Getippten vorbelegt).
 * onPick(place) nach Übernahme; der Feldwert wird auf place.name gesetzt.
 */
export function typeToPick(inp, getValue, opts = {}) {
  let open = false;
  inp.addEventListener('input', async (e) => {
    if (open || e.inputType === 'deleteContentBackward' || e.inputType === 'deleteContentForward') return;
    const v = inp.value.trim();
    if (v.length < 2) return;
    open = true;
    try {
      const p = await pickPlace({ ...(getValue?.() || {}), name: '' }, { title: opts.title, from: opts.from, query: v });
      if (p) { inp.value = p.name; opts.onPick?.(p); } else opts.onCancel?.(v);
    } finally { open = false; }
  });
  return inp;
}

/** Koordinaten aus Text: «47.3, 8.4», ICAO 4719N00824E, Google-Maps-URL (@lat,lon / q=lat,lon). */
export function parseCoords(q) {
  const s = String(q || '').trim();
  let m = /^(-?\d{1,2}(?:[.,]\d+)?)[\s,;]+(-?\d{1,3}(?:[.,]\d+)?)$/.exec(s);
  if (m) return { lat: parseFloat(m[1].replace(',', '.')), lon: parseFloat(m[2].replace(',', '.')) };
  const ic = parseIcao(s);
  if (ic) return ic;
  m = /[@=\/](-?\d{1,2}\.\d+)[,%2C]+(-?\d{1,3}\.\d+)/i.exec(s.replace(/%2C/gi, ','));
  if (m) return { lat: parseFloat(m[1]), lon: parseFloat(m[2]) };
  m = /(\d{1,2})[°\s](\d{1,2}(?:[.,]\d+)?)['′]?\s*([NS])[\s,]+(\d{1,3})[°\s](\d{1,2}(?:[.,]\d+)?)['′]?\s*([EW])/i.exec(s);
  if (m) return { lat: (+m[1] + parseFloat(m[2].replace(',', '.')) / 60) * (m[3].toUpperCase() === 'S' ? -1 : 1), lon: (+m[4] + parseFloat(m[5].replace(',', '.')) / 60) * (m[6].toUpperCase() === 'W' ? -1 : 1) };
  return null;
}

/** Adresssuche (Nominatim) – für Strassen/Hausnummern, die Open-Meteo nicht kennt. */
async function nominatim(q, lang) {
  const c = new AbortController(); setTimeout(() => c.abort(), 8000);
  const r = await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=6&accept-language=${lang}&q=${encodeURIComponent(q)}`, { signal: c.signal });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const j = await r.json();
  return j.map((x) => ({ name: x.name || x.display_name.split(',')[0], admin: x.display_name.split(',').slice(1, 3).join(',').trim(), country: (x.address?.country_code || '').toUpperCase(), lat: +x.lat, lon: +x.lon, elev: null, tz: '', address: x.display_name }));
}

/** Modaler Ortswahl-Dialog. Löst mit dem gewählten Ort oder null. */
export function pickPlace(initial, opts = {}) {
  const lang = getLang();
  const cur = { name: initial?.name || '', lat: initial?.lat ?? null, lon: initial?.lon ?? null, elev: initial?.elev ?? null, tz: initial?.tz || '', country: initial?.country || '', icao: '', address: initial?.address || '' };
  const q = input('search', opts.query || '', { placeholder: t('pick_search'), autocomplete: 'off' });
  const results = h('div.results');
  const mapEl = h('div.map.pick');
  const nameIn = input('text', cur.name, { placeholder: t('name'), oninput: (e) => { cur.name = e.target.value; } });
  const elevIn = input('number', cur.elev ?? '', { step: 1, oninput: (e) => { cur.elev = num(e.target.value, null); } });
  const coordsOut = h('div.coords');
  const linkOut = h('div');
  const status = h('div.note');
  let picker = null;
  const lookupSoon = debounce(async () => {
    if (cur.lat == null) return;
    try {
      const info = await pointInfo(cur.lat, cur.lon);
      if (info.elev != null) { cur.elev = Math.round(info.elev); elevIn.value = cur.elev; }
      if (info.tz) cur.tz = info.tz;
      if (info.country) cur.country = info.country;
      if (!cur.name && info.name) { cur.name = info.name; nameIn.value = info.name; }
      status.textContent = '';
      drawCoords();
    } catch { status.textContent = t('pick_noInfo'); }
  }, 500);
  function drawCoords() {
    clear(coordsOut); clear(linkOut);
    if (cur.lat == null) { coordsOut.appendChild(h('span.muted', t('pick_none'))); return; }
    cur.icao = icao(cur.lat, cur.lon);
    coordsOut.append(h('b.mono', cur.icao), h('span.muted.small', ` · ${cur.lat.toFixed(5)}, ${cur.lon.toFixed(5)}`), cur.country ? h('span.muted.small', ` · ${cur.country}`) : null);
    linkOut.append(mapsLink(cur.lat, cur.lon, t('pick_maps')), h('button.btn.icon', { type: 'button', title: t('copy'), style: { marginLeft: '6px' }, onclick: () => { navigator.clipboard?.writeText(`${cur.icao} · ${cur.lat.toFixed(5)}, ${cur.lon.toFixed(5)} · ${mapsUrl(cur.lat, cur.lon)}`); toast(t('copied')); } }, '⎘'));
    if (opts.from?.lat != null) linkOut.appendChild(h('span.muted.small', ` · ${distKm(opts.from.lat, opts.from.lon, cur.lat, cur.lon).toFixed(1)} km · ${Math.round(bearing(opts.from.lat, opts.from.lon, cur.lat, cur.lon)).toString().padStart(3, '0')}°`));
  }
  function setPos(lat, lon, fromMap = false, meta = {}) {
    cur.lat = +lat; cur.lon = +lon; cur.elev = meta.elev ?? null; cur.tz = meta.tz || ''; cur.country = meta.country || countryGuess(cur.lat, cur.lon); cur.address = meta.address || '';
    if (meta.name != null) { cur.name = meta.name; nameIn.value = meta.name; }
    else if (fromMap) { /* Name bleibt, wird nur ergänzt, wenn leer */ }
    elevIn.value = cur.elev ?? '';
    if (!fromMap) picker?.setPos(cur.lat, cur.lon, 13);
    drawCoords();
    status.textContent = t('loading');
    lookupSoon();
  }
  async function doSearch() {
    const s = q.value.trim(); clear(results);
    if (!s) return;
    const c = parseCoords(s);
    if (c) { setPos(c.lat, c.lon, false, { name: cur.name }); return; }
    results.appendChild(h('div.note', t('loading')));
    try {
      let rs = [];
      const addressLike = /\d/.test(s) || /,/.test(s) || /(strasse|straße|str\.|weg|platz|gasse|allee|rue|via|road|lane)/i.test(s);
      if (!addressLike) rs = await geocode(s, lang).catch(() => []);
      if (!rs.length) rs = await nominatim(s, lang).catch(() => []);
      if (!rs.length && addressLike) rs = await geocode(s, lang).catch(() => []);
      clear(results);
      if (!rs.length) { results.appendChild(h('div.note', t('pick_noHit'))); return; }
      for (const r of rs) results.appendChild(h('button', { type: 'button', onclick: () => { clear(results); setPos(r.lat, r.lon, false, { name: r.name, elev: r.elev, tz: r.tz, country: r.country, address: r.address }); } }, `${r.name}${r.admin ? ' · ' + r.admin : ''} · ${icao(r.lat, r.lon)}${r.elev != null ? ' · ' + Math.round(r.elev) + ' m' : ''}`));
    } catch (e) { clear(results); results.appendChild(h('div.err', e.message)); }
  }
  q.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); doSearch(); } });
  const geoBtn = navigator.geolocation ? h('button.btn', { type: 'button', title: t('pick_myPos'), onclick: () => {
    status.textContent = t('loading');
    navigator.geolocation.getCurrentPosition((pos) => setPos(pos.coords.latitude, pos.coords.longitude, false, { name: cur.name }), (err) => { status.textContent = `${t('error')}: ${err.message}`; }, { enableHighAccuracy: true, timeout: 10000 });
  } }, icon('place', 16)) : null;
  const content = h('div.pick-body', [
    h('div.inline', [q, h('button.btn', { type: 'button', onclick: doSearch }, t('siteSearchBtn')), geoBtn]),
    results,
    mapEl,
    h('div.note', t('pick_hint')),
    h('div.frow', [field(t('name'), nameIn), field(`${t('elevation')} (m)`, elevIn)]),
    h('div.frow', [field(t('coords'), coordsOut), field('Google Maps', linkOut)]),
    status,
  ]);
  drawCoords();
  setTimeout(() => {
    picker = mapPicker(mapEl, cur.lat, cur.lon, (la, lo) => setPos(la, lo, true), 13);
    if (cur.lat == null && opts.from?.lat != null) picker?.map.setView([opts.from.lat, opts.from.lon], 10);
    setTimeout(() => { q.focus(); if (opts.query) { q.setSelectionRange(q.value.length, q.value.length); doSearch(); } }, 100);
  }, 30);
  // Weitertippen im Suchfeld sucht laufend (ab 3 Zeichen, mit Pause)
  q.addEventListener('input', debounce(() => { if (q.value.trim().length >= 3) doSearch(); }, 600));
  return dialog(opts.title || t('pick_title'), content, [{ label: t('cancel'), value: false }, { label: t('pick_use'), value: true, primary: true }], { cls: 'wide' }).then((ok) => {
    if (!ok || cur.lat == null) return null;
    cur.icao = icao(cur.lat, cur.lon);
    if (!cur.name) cur.name = cur.icao;
    return { ...cur };
  });
}
