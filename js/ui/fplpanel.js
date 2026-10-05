/* Fahrtbriefing — Panel «Flugplan»: Schalter, Erzeugen aus dem Briefing, Formular (Felder 7–19),
 * ICAO-Nachricht, Export (.txt ICAO, .xml) und Druckform für die Briefingsicht. */
import { h, clear, toast } from '../util.js';
import { t, getLang } from '../i18n.js';
import { field, input, select, check, textarea } from './widgets.js';
import { buildFpl, fplMessage, fplCheck, routeText, otherInfo, supplementary, hhmm4 } from '../calc/fpl.js';
import { fplSuggested, crossesBorder, massPerf, fileBase } from '../model.js';
import { icon, iconSvg } from './icons.js';

const FLAGS = { r19: ['uhf', 'vhf', 'elba'], s19: ['polar', 'desert', 'maritime', 'jungle'], j19: ['light', 'fluores', 'uhf', 'vhf'] };

/** Datensatz erzeugen (Treibstoff-Autonomie für Heissluft aus der Tragkraftrechnung). */
export function generateFpl(b, ctx) {
  let fuelEnduranceMin = 0;
  try { const { type, r } = massPerf(b, ctx.settings); if (type === 'hab') fuelEnduranceMin = r.enduranceMin; } catch { /* ohne */ }
  return buildFpl(b, ctx.settings, { fuelEnduranceMin });
}

const download = (name, text, mime) => { const a = document.createElement('a'); a.href = `data:${mime};charset=utf-8,` + encodeURIComponent(text); a.download = name; a.click(); };
const copyText = async (text) => { try { await navigator.clipboard.writeText(text); toast(t('copied')); } catch { toast(t('error')); } };

/** Erarbeitung: Panelinhalt. */
export function fplPanel(b, ctx, d, onChange, readOnly) {
  b.fpl = b.fpl || {};
  if (b.fpl.enabled == null) b.fpl.enabled = fplSuggested(b);
  const wrap = h('div.fplpanel');
  const why = [b.flight?.nvfr ? t('nvfr') : null, b.balloon?.type === 'gas' ? t('gas') : null, crossesBorder(b) ? t('fpl_border') : null].filter(Boolean);
  const body = h('div');
  if (b.flight?.nvfr && !b.fpl.enabled) b.fpl.enabled = true;   // NVFR: Flugplan verbindlich
  const sw = check(t('fpl_create'), !!b.fpl.enabled, (v) => { b.fpl.enabled = v; draw(); onChange(); }, { disabled: readOnly || !!b.flight?.nvfr });
  wrap.append(h('div.row-actions', [sw, b.flight?.nvfr ? h('span.tag.must', t('fpl_mandatoryNvfr')) : null, why.length ? h('span.note.small', `${t('fpl_why')}: ${why.join(', ')}`) : null]), body);
  function draw() {
    clear(body);
    if (!b.fpl.enabled) { body.appendChild(h('div.note', t('fpl_none'))); return; }
    const data = b.fpl.data;
    const tools = h('div.row-actions', [
      readOnly ? null : h('button.btn.small' + (data ? '' : '.primary'), { type: 'button', onclick: () => { b.fpl.data = generateFpl(b, ctx); draw(); onChange(); toast(t('fpl_generated')); } }, data ? t('fpl_regenerate') : t('fpl_generate')),
      data ? h('button.btn.small', { type: 'button', onclick: () => copyText(fplMessage(data)) }, t('fpl_copy')) : null,
      data ? h('button.btn.small', { type: 'button', onclick: () => download(`${fileBase(b)}_FPL.txt`, fplMessage(data), 'text/plain') }, t('fpl_dlTxt')) : null,
    ]);
    body.appendChild(tools);
    if (!data) { body.appendChild(h('div.note', t('fpl_hintGenerate'))); return; }
    const missing = fplCheck(data);
    if (missing.length) body.appendChild(h('div.warn', `⚠ ${t('fpl_check')}: ${missing.map((k) => t('fpl_f_' + k)).join(', ')}`));
    if (!data.eet18?.length) body.appendChild(h('div.note.small', t('fpl_noEet')));
    body.appendChild(fplForm(data, readOnly, () => { data.edited = Date.now(); draw(); onChange(); }));
    body.appendChild(h('div.fpl-msg', [h('div.lbl', t('fpl_message')), h('pre.mono', fplMessage(data))]));
    body.appendChild(h('div.note.small', t('fpl_formatNote')));
    body.appendChild(h('div.note.small', t('fpl_closeHint')));
    body.appendChild(field(t('fpl_textHint'), textarea(d.content?.text || '', { rows: 2, readOnly, oninput: (e) => { d.content = d.content || {}; d.content.text = e.target.value; onChange(); } })));
  }
  draw();
  return wrap;
}

/** Formular nach dem ICAO-Flugplanblatt; Felder editierbar. */
function fplForm(d, ro, onChange) {
  const txt = (obj, key, label, opts = {}) => field(label, input('text', obj[key] ?? '', { readOnly: ro, placeholder: opts.ph || '', style: opts.w ? { maxWidth: opts.w } : null, oninput: (e) => { obj[key] = opts.upper === false ? e.target.value : e.target.value.toUpperCase(); if (opts.after) opts.after(); } }));
  const num = (obj, key, label) => field(label, input('number', obj[key] ?? '', { readOnly: ro, min: 0, oninput: (e) => { obj[key] = +e.target.value || 0; } }));
  const flags = (key, labels) => h('div.f', [h('label', t('fpl_f_' + key)), h('div.chips', FLAGS[key].map((k) => h('button.chip', { type: 'button', 'aria-pressed': !!d[key][k], disabled: ro, onclick: (e) => { d[key][k] = !d[key][k]; e.currentTarget.setAttribute('aria-pressed', d[key][k]); onChange(); } }, labels[k])))]);
  const item = (no, title, ...els) => h('div.fpl-item', [h('div.fpl-no', [h('b', no), ' ', title]), h('div.frow.c4', els)]);
  const eetRows = h('div');
  const drawEet = () => { clear(eetRows); (d.eet18 || []).forEach((e, i) => eetRows.appendChild(h('div.fpl-eet', [input('text', e.code, { readOnly: ro, style: { width: '70px' }, oninput: (ev) => { e.code = ev.target.value.toUpperCase(); e.text = `${e.code}${hhmm4(e.min)}`; } }), input('text', hhmm4(e.min), { readOnly: ro, style: { width: '70px' }, placeholder: 'HHMM', oninput: (ev) => { const m = /^(\d{2})(\d{2})$/.exec(ev.target.value); if (m) { e.min = +m[1] * 60 + +m[2]; e.text = `${e.code}${hhmm4(e.min)}`; } } }), h('span.muted.small', e.name || ''), ro ? null : h('button.btn.icon.small', { type: 'button', onclick: () => { d.eet18.splice(i, 1); drawEet(); onChange(); } }, icon('close', 14))]))); if (!ro) eetRows.appendChild(h('button.btn.small', { type: 'button', onclick: () => { (d.eet18 = d.eet18 || []).push({ code: '', min: 0, text: '', name: '' }); drawEet(); } }, '+ FIR')); };
  drawEet();
  const form = h('div.fpl-form', [
    item('7–10', t('fpl_i7'), txt(d, 'id7', t('fpl_f_id7'), { w: '140px' }), field(t('fpl_f_typeOfFlight8'), select([['G', 'G – General aviation'], ['N', 'N – Non-scheduled'], ['S', 'S – Scheduled'], ['M', 'M – Military'], ['X', 'X – Other']].map(([v, l]) => ({ value: v, label: l })), d.typeOfFlight8, { disabled: ro, onchange: (e) => { d.typeOfFlight8 = e.target.value; onChange(); } })), txt(d, 'equip10a', t('fpl_f_equip10a'), { w: '120px' }), txt(d, 'equip10b', t('fpl_f_equip10b'), { w: '120px' })),
    item('13–16', t('fpl_i13'), txt(d, 'eobt13', t('fpl_f_eobt13'), { w: '100px', ph: 'HHMM' }), txt(d, 'speed15', t('fpl_f_speed15'), { w: '100px' }), txt(d, 'level15', t('fpl_f_level15'), { w: '100px' }), txt(d, 'eet16', t('fpl_f_eet16'), { w: '100px', ph: 'HHMM' })),
    h('div.frow.c2', [txt(d, 'drift15', t('fpl_f_drift15'), { ph: 'NW LATER NNW THEN NE' }), txt(d, 'via15', t('fpl_f_via15'), { ph: 'WOLFSBURG SCHWERIN', upper: false })]),
    h('div.note.small.mono', routeText(d)),
    item('18', t('fpl_i18'), txt(d.dep18, 'name', 'DEP/ ' + t('name'), { w: '200px' }), txt(d.dep18, 'coord', 'DEP/ ' + t('coords'), { w: '140px' }), txt(d.dest18, 'name', 'DEST/ ' + t('name'), { w: '200px' }), txt(d.dest18, 'coord', 'DEST/ ' + t('coords'), { w: '140px' })),
    h('div.frow.c4', [txt(d, 'dof18', 'DOF/', { w: '100px', ph: 'YYMMDD' }), txt(d, 'typ18', 'TYP/', { w: '200px' }), txt(d, 'code18', 'CODE/', { w: '100px', ph: '4B1234' }), txt(d, 'altn18', 'ALTN/', { w: '200px' })]),
    h('div.frow', [field('EET/', eetRows)]),
    h('div.frow', [txt(d, 'rmk18', 'RMK/')]),
    h('div.note.small.mono', otherInfo(d)),
    item('19', t('fpl_i19'), txt(d, 'e19', 'E/ ' + t('fpl_f_e19'), { w: '100px', ph: 'HHMM' }), num(d, 'p19', 'P/ ' + t('fpl_f_p19')), flags('r19', { uhf: 'UHF', vhf: 'VHF', elba: 'ELBA' }), flags('s19', { polar: 'POLAR', desert: 'DESERT', maritime: 'MARITIME', jungle: 'JUNGLE' })),
    h('div.frow.c4', [flags('j19', { light: 'LIGHT', fluores: 'FLUORES', uhf: 'UHF', vhf: 'VHF' }), txt(d.d19, 'number', 'D/ ' + t('fpl_f_dNumber'), { w: '80px' }), txt(d.d19, 'capacity', t('fpl_f_dCapacity'), { w: '80px' }), h('div.frow.c2', [check(t('fpl_f_dCover'), !!d.d19.cover, (v) => { d.d19.cover = v; onChange(); }, { disabled: ro }), txt(d.d19, 'colour', t('fpl_f_dColour'), { w: '120px' })])]),
    h('div.frow.c3', [txt(d, 'a19', 'A/ ' + t('fpl_f_a19')), txt(d, 'n19', 'N/ ' + t('fpl_f_n19')), txt(d, 'c19', 'C/ ' + t('fpl_f_c19'))]),
    h('div.note.small.mono', supplementary(d)),
  ]);
  return form;
}

/** Briefingsicht / Druck: Formularblatt (Kurzform) und Nachricht. */
export function fplView(b, ctx) {
  const d = b.fpl?.data;
  const on = b.fpl?.enabled ?? fplSuggested(b);
  if (!on) return h('div', t('fpl_none'));
  if (!d) return h('div', t('fpl_planned'));
  const row = (k, v) => h('tr', [h('td.k', k), h('td', v)]);
  return h('div.fpl-view', [
    h('table.inner.fpl-tbl', [
      row('7 / 8', `${d.id7} · ${d.rules8}${d.typeOfFlight8}`), row('9 / 10', `${d.number9 || ''}${d.type9}/${d.wake9} · ${d.equip10a}/${d.equip10b}`),
      row('13', `${d.dep13} ${d.eobt13}`), row('15', `${d.speed15} ${d.level15} ${routeText(d)}`),
      row('16', `${d.dest16} ${d.eet16} ${[d.altn16, d.altn16b].filter(Boolean).join(' ')}`), row('18', otherInfo(d)), row('19', supplementary(d)),
    ]),
    h('pre.mono.fpl-msg', fplMessage(d)),
    h('div.small', t('fpl_closeHint')),
  ]);
}
