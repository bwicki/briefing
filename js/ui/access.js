/* Fahrtbriefing — Berechtigungen je Briefing (persönliche Links). Nur mit Server. */
import { h, clear, toast, dialog } from '../util.js';
import { t } from '../i18n.js';
import { field, input, select } from './widgets.js';
import { fmtDate, fmtDateTime } from '../calc/time.js';

/** QR lokal erzeugt (js/vendor/qrcode.js, MIT) – der Link verlässt das Gerät nicht. */
/** QR-Code als SVG-Element (lokal erzeugt) oder null. */
export function qrSvg(url, cellSize = 4, margin = 4) {
  try { const qr = window.qrcode(0, 'M'); qr.addData(url); qr.make(); const box = document.createElement('div'); box.innerHTML = qr.createSvgTag({ cellSize, margin }); const svg = box.firstChild; svg.style.background = '#fff'; return svg; } catch { return null; }
}
export function showQr(url) {
  const box = h('div', { style: { textAlign: 'center' } });
  try {
    const qr = window.qrcode(0, 'M'); qr.addData(url); qr.make();
    box.innerHTML = qr.createSvgTag({ cellSize: 5, margin: 8 });
    box.firstChild.style.background = '#fff'; box.firstChild.style.maxWidth = '100%';
  } catch (e) { box.textContent = e.message; }
  dialog(t('ac_qr'), h('div', [box, h('div.small.mono', { style: { textAlign: 'center', marginTop: '6px', wordBreak: 'break-all' } }, url)]), [{ label: t('close'), primary: true }]);
}

export async function openAccessDialog(ctx, b) {
  const S = ctx.stamm || ctx.settings, z = b.site.tz || 'Europe/Zurich';
  if (ctx.store.mode !== 'remote') { await dialog(t('ac_title'), h('p.note', t('ac_localOnly')), [{ label: t('close'), primary: true }]); return; }
  const listBox = h('div');
  const persons = S.persons.map((p) => ({ value: p.name, label: p.name })).concat([{ value: '', label: t('operatorCustom') }]);
  const pSel = select(persons, S.persons[0]?.name || '');
  const pFree = input('text', '', { placeholder: t('name') });
  const role = select([{ value: 'read', label: t('role_read') }, { value: 'edit', label: t('role_edit') }], 'edit');
  const defDays = S.links?.defaultExpiryDays ?? 7;
  const exp = input('date', new Date(b.time.startMs + defDays * 86400000).toISOString().slice(0, 10));
  const addBtn = h('button.btn.primary', { type: 'button', onclick: async () => {
    const person = pSel.value || pFree.value.trim();
    if (!person) { toast(t('name') + '?'); return; }
    try {
      await ctx.store.createAccess(b.id, { person, role: role.value, expiresAt: new Date(exp.value + 'T23:59:59').getTime() });
      b.accessCount = (b.accessCount || 0) + 1;
      await drawList(); toast(t('ok'));
    } catch (e) { toast(`${t('error')}: ${e.message}`); }
  } }, t('ac_add'));
  async function drawList() {
    clear(listBox);
    let links = [];
    try { links = await ctx.store.listAccess(b.id); } catch (e) { listBox.appendChild(h('div.err', e.message)); return; }
    if (!links.length) { listBox.appendChild(h('div.note', t('ac_none'))); return; }
    for (const l of links) {
      const url = `${location.origin}${location.pathname}#/s/${l.token}`;
      listBox.appendChild(h('div.item-box', [
        h('div.head', [h('b', l.person), h('span.tag', l.role === 'edit' ? t('role_edit') : t('role_read')), h('span.muted.small', `${t('ac_expires')} ${fmtDate(z, l.expiresAt)}`)]),
        h('div.small.mono', { style: { wordBreak: 'break-all' } }, url),
        h('div.note', `${t('ac_lastOpen')}: ${l.lastOpenedAt ? fmtDateTime(z, l.lastOpenedAt) : '–'}`),
        h('div.row-actions', { style: { marginTop: '6px' } }, [
          h('button.btn', { type: 'button', onclick: () => navigator.clipboard.writeText(url).then(() => toast(t('copied'))) }, t('ac_copy')),
          h('a.btn', { href: `https://wa.me/?text=${encodeURIComponent(`Briefing ${fmtDate(z, b.time.startMs)} ${b.site.name}: ${url}`)}`, target: '_blank', rel: 'noopener' }, t('ac_whatsapp')),
          h('a.btn', { href: `mailto:?subject=${encodeURIComponent('Fahrtbriefing ' + fmtDate(z, b.time.startMs) + ' ' + b.site.name)}&body=${encodeURIComponent(url)}` }, t('ac_mail')),
          h('button.btn', { type: 'button', onclick: () => showQr(url) }, t('ac_qr')),
          h('button.btn', { type: 'button', onclick: async () => { await ctx.store.revokeAccess(b.id, l.token); await drawList(); } }, t('ac_revoke')),
        ]),
      ]));
    }
  }
  const content = h('div', [
    h('div.frow.c4', [field(t('ac_person'), h('div', [pSel, pFree])), field(t('ac_role'), role), field(t('ac_expires'), exp), h('div.f', [h('label', ' '), addBtn])]),
    h('div.note', t('ac_hint')), h('hr'), listBox,
  ]);
  drawList();
  await dialog(t('ac_title'), content, [{ label: t('close'), primary: true }]);
}
