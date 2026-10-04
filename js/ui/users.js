/* Fahrtbriefing — Einstellungen «Benutzer & Freigaben» und «Statistik».
 *
 * Freigaben: jeder Benutzer kann Teile seines Stamms (Ballone, Personen,
 * Startplätze, Treffpunkte, Betreiber) anderen Benutzern per Klickbox freigeben.
 * Benutzerverwaltung und Nutzungsstatistik nur für den Supermaster. */
import { h, clear, toast, dialog } from '../util.js';
import { t } from '../i18n.js';
import { field, input, select, check } from './widgets.js';
import { SHARE_CATEGORIES } from '../stamm.js';
import { fmtDateTime } from '../calc/time.js';

const fmtMb = (b) => (b ? (b / 1048576).toFixed(b > 10485760 ? 0 : 1) : '0');

export function usersSection(ctx) {
  const wrap = h('div');
  if (ctx.store.mode !== 'remote') { wrap.appendChild(h('div.card', h('div.card-body', h('div.note', t('us_remoteOnly'))))); return wrap; }
  const redraw = () => { clear(wrap); wrap.appendChild(sharesCard(ctx)); if (ctx.isSuper) wrap.appendChild(adminCard(ctx, redraw)); };
  redraw();
  return wrap;
}

// ---------------------------------------------------------------- Freigaben
function sharesCard(ctx) {
  const given = h('div'), received = h('div');
  const card = h('div.card', [h('div.card-head', h('div.section-title', t('sh_title'))), h('div.card-body', [
    h('div.note', t('sh_hint')),
    h('h3', t('sh_given')), given,
    h('h3', t('sh_received')), received,
  ])]);
  (async () => {
    try {
      const [users, shares] = await Promise.all([ctx.store.listUsers(), ctx.store.listShares()]);
      const others = users.filter((u) => u.id !== ctx.user?.id);
      clear(given);
      if (!others.length) given.appendChild(h('div.note', t('sh_noUsers')));
      for (const u of others) {
        const cur = new Set((shares.find((s) => s.from === ctx.user?.id && s.to === u.id) || {}).categories || []);
        const boxes = SHARE_CATEGORIES.map((c) => check(t('sh_cat_' + c), cur.has(c), async (v) => {
          if (v) cur.add(c); else cur.delete(c);
          try { await ctx.store.setShare(u.id, [...cur]); toast(t('set_saved')); } catch (e) { toast(`${t('error')}: ${e.message}`); }
        }));
        given.appendChild(h('div.share-row', [h('div.who', [h('b', u.name), h('span.muted.mono.small', ` ${u.id}`)]), h('div.cats', boxes)]));
      }
      clear(received);
      const rec = shares.filter((s) => s.to === ctx.user?.id);
      if (!rec.length) received.appendChild(h('div.note', t('sh_none')));
      for (const s of rec) received.appendChild(h('div.share-row', [h('div.who', [h('b', s.fromName), h('span.muted.mono.small', ` ${s.from}`)]), h('div.note', s.categories.map((c) => t('sh_cat_' + c)).join(' · '))]));
    } catch (e) { clear(given); given.appendChild(h('div.err', e.message)); }
  })();
  return card;
}

// ---------------------------------------------------------------- Benutzerverwaltung (Super)
function adminCard(ctx, onUsersChanged) {
  const list = h('div');
  const idIn = input('text', '', { placeholder: 'z. B. mmuster', autocapitalize: 'none' }), nameIn = input('text', ''), pwIn = input('password', '', { autocomplete: 'new-password' });
  const roleSel = select([{ value: 'master', label: t('role_master') }, { value: 'super', label: t('role_super') }], 'master');
  const copySel = select([{ value: '', label: t('us_copyNone') }], '');
  const flags = { ai: true, notam: true, pdf: true };
  const flagBoxes = h('div.chips', ['ai', 'notam', 'pdf'].map((f) => check(t('flag_' + f), true, (v) => { flags[f] = v; })));
  const createBtn = h('button.btn.primary', { type: 'button', onclick: async () => {
    const id = idIn.value.trim().toLowerCase();
    if (!/^[a-z0-9][a-z0-9_.-]{1,30}$/.test(id)) { toast(t('us_badId')); return; }
    if (pwIn.value.length < 4) { toast('≥ 4'); return; }
    try {
      await ctx.store.adminCreateUser({ id, name: nameIn.value.trim() || id, password: pwIn.value, role: roleSel.value, flags, copyFrom: copySel.value || null });
      idIn.value = nameIn.value = pwIn.value = ''; toast(t('ok')); onUsersChanged ? onUsersChanged() : drawList();
    } catch (e) { toast(e.status === 409 ? t('us_exists') : `${t('error')}: ${e.message}`); }
  } }, t('us_create'));
  const form = h('div.item-box', [h('div.head', h('b', t('us_new'))),
    h('div.frow.c4', [field(t('us_id'), idIn), field(t('us_name'), nameIn), field(t('us_pw'), pwIn), field(t('us_role'), roleSel)]),
    h('div.frow.c2', [field(t('us_copyFrom'), copySel), field(t('us_flags'), flagBoxes)]),
    h('div.row-actions', [createBtn])]);

  async function drawList() {
    clear(list);
    let users;
    try { users = await ctx.store.adminUsers(); } catch (e) { list.appendChild(h('div.err', e.message)); return; }
    for (const o of [...copySel.options].slice(1)) o.remove();
    for (const u of users) copySel.appendChild(h('option', { value: u.id }, `${u.name} (${u.id})`));
    const flagsOf = (u) => h('div.chips', ['ai', 'notam', 'pdf'].map((f) => check(t('flag_' + f), u.flags?.[f] !== false, async (v) => { try { await ctx.store.adminUpdateUser(u.id, { flags: { [f]: v } }); toast(t('set_saved')); } catch (e) { toast(e.message); } })));
    const actionsOf = (u) => h('div.row-actions', [
      h('button.btn', { type: 'button', onclick: () => viewStamm(ctx, u) }, t('us_viewStamm')),
      h('button.btn', { type: 'button', onclick: () => resetPw(ctx, u, drawList) }, t('us_setPw')),
      u.id === ctx.user?.id ? null : h('button.btn', { type: 'button', onclick: async () => { try { await ctx.store.adminUpdateUser(u.id, { active: !u.active }); drawList(); } catch (e) { toast(e.message); } } }, t(u.active ? 'us_deactivate' : 'us_activate')),
    ]);
    const roleOf = (u) => [t(u.role === 'super' ? 'role_super' : 'role_master'), u.active ? '' : h('span.sm', ` · ${t('us_inactive')}`)];
    const lastOf = (u) => (u.lastLoginAt ? fmtDateTime('Europe/Zurich', u.lastLoginAt) : '–');
    if (window.innerWidth < 700) {   // Handy: Karten statt breiter Tabelle
      for (const u of users) list.appendChild(h('div.item-box', { class: u.active ? '' : 'inactive' }, [
        h('div.head', [h('b', u.name), h('span.mono.small.muted', ` ${u.id}`), h('span.sm', { style: { marginLeft: 'auto' } }, roleOf(u))]),
        h('div.sm', `${t('us_briefings')}: ${u.briefings ?? 0} · ${t('us_lastLogin')}: ${lastOf(u)}`),
        u.role === 'super' ? null : flagsOf(u), actionsOf(u),
      ]));
      return;
    }
    const tbl = h('table.tbl', [h('thead', h('tr', [h('th', t('us_id')), h('th', t('us_name')), h('th', t('us_role')), h('th', t('us_flags')), h('th', t('us_briefings')), h('th', t('us_lastLogin')), h('th', '')])),
      h('tbody', users.map((u) => h('tr', { class: u.active ? '' : 'inactive' }, [
        h('td.mono', u.id), h('td', u.name), h('td', roleOf(u)),
        h('td', u.role === 'super' ? '–' : flagsOf(u)), h('td', `${u.briefings ?? 0}`), h('td.sm', lastOf(u)), h('td', actionsOf(u)),
      ])))]);
    list.appendChild(h('div.tblwrap', tbl));
  }
  drawList();
  return h('div.card', [h('div.card-head', h('div.section-title', t('us_title'))), h('div.card-body', [h('div.note', t('us_hint')), list, form])]);
}

async function resetPw(ctx, u, after) {
  const pw = input('password', '', { autocomplete: 'new-password' }), pw2 = input('password', '', { autocomplete: 'new-password' });
  const ok = await dialog(`${t('us_setPw')} · ${u.name}`, h('div', [field(t('set_pwNew'), pw), field(t('set_pwNew2'), pw2)]), [{ label: t('cancel'), value: false }, { label: t('save'), value: true, primary: true }]);
  if (!ok) return;
  if (pw.value !== pw2.value) { toast(t('set_pwMismatch')); return; }
  if (pw.value.length < 4) { toast('≥ 4'); return; }
  try { await ctx.store.adminUpdateUser(u.id, { password: pw.value }); toast(t('set_pwChanged')); after?.(); } catch (e) { toast(e.message); }
}

/** Lesende Einsicht in den Stamm eines Benutzers (Super). */
async function viewStamm(ctx, u) {
  let s;
  try { s = await ctx.store.getSettingsOf(u.id); } catch (e) { toast(e.message); return; }
  const li = (arr, f) => (arr?.length ? h('ul.plain', arr.map((x) => h('li', f(x)))) : h('div.note', '–'));
  const body = h('div.stammview', [
    h('div.note', `${t('set_ownerName')}: ${s.ownerName || '–'} · ${t('set_lang')}: ${s.lang || '–'}`),
    h('h3', t('set_balloons')), li([...(s.balloons?.hab || []), ...(s.balloons?.envelopes || [])], (x) => `${x.id} · ${x.model || ''} ${x.volume ? x.volume + ' m³' : ''}`),
    h('h3', t('basket')), li(s.balloons?.baskets, (x) => `${x.name} · ${x.mass} kg`),
    h('h3', t('set_persons')), li(s.persons, (x) => `${x.name} (${(x.roles || []).join(', ')})`),
    h('h3', t('set_sites')), li(s.sites, (x) => `${x.name}${x.favorite ? ' ★' : ''}`),
    h('h3', t('set_meetings')), li(s.meetings, (x) => `${x.name} · ${x.address || ''}`),
    h('h3', t('set_operators')), li(s.operators, (x) => x.name),
    h('div.row-actions', [h('button.btn', { type: 'button', onclick: () => { const a = document.createElement('a'); a.href = 'data:application/json,' + encodeURIComponent(JSON.stringify(s, null, 2)); a.download = `briefing-settings-${u.id}.json`; a.click(); } }, t('us_download'))]),
  ]);
  await dialog(t('us_stammOf', { n: u.name }), body, [{ label: t('close'), primary: true }], { cls: 'wide' });
}

// ---------------------------------------------------------------- Statistik (Super)
export function statsSection(ctx) {
  const box = h('div');
  if (ctx.store.mode !== 'remote' || !ctx.isSuper) { box.appendChild(h('div.card', h('div.card-body', h('div.note', t('us_remoteOnly'))))); return box; }
  const csvBtn = h('button.btn', { type: 'button', onclick: async () => { try { const txt = await ctx.store.adminStatsCsv(); const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([txt], { type: 'text/csv;charset=utf-8' })); a.download = 'briefing-statistik.csv'; a.click(); } catch (e) { toast(e.message); } } }, t('st_csv'));
  const body = h('div', t('loading'));
  box.appendChild(h('div.card', [h('div.card-head', [h('div.section-title', t('st_title')), csvBtn]), h('div.card-body', body)]));
  (async () => {
    let st;
    try { st = await ctx.store.adminStats(); } catch (e) { clear(body); body.appendChild(h('div.err', e.message)); return; }
    clear(body);
    // je Benutzer und Monat zusammenfassen
    const key = (r) => `${r.user}|${r.month}`;
    const agg = new Map();
    for (const r of st.usage) {
      const a = agg.get(key(r)) || { user: r.user, month: r.month, logins: 0, created: 0, released: 0, fetch: 0, ai: 0, aiTok: 0, pdf: 0, files: 0, bytes: 0, linksNew: 0, linksOpen: 0 };
      if (r.kind === 'login') a.logins += r.count;
      else if (r.kind === 'briefing_create') a.created += r.count;
      else if (r.kind === 'release') a.released += r.count;
      else if (r.kind.startsWith('wx_')) a.fetch += r.count;
      else if (r.kind === 'ai') { a.ai += r.count; a.aiTok += r.sum; }
      else if (r.kind === 'pdf') a.pdf += r.count;
      else if (r.kind === 'file') { a.files += r.count; a.bytes += r.sum; }
      else if (r.kind === 'link_create') a.linksNew += r.count;
      else if (r.kind === 'link_open') a.linksOpen += r.count;
      agg.set(key(r), a);
    }
    const rows = [...agg.values()].sort((a, b) => b.month.localeCompare(a.month) || a.user.localeCompare(b.user));
    const name = (id) => st.users.find((u) => u.id === id)?.name || id || '–';
    body.appendChild(h('h3', t('st_perMonth')));
    if (!rows.length) body.appendChild(h('div.note', t('st_none')));
    else body.appendChild(h('div.tblwrap', h('table.tbl.compact', [h('thead', h('tr', [t('st_month'), t('st_user'), t('st_logins'), t('st_created'), t('st_released'), t('st_fetch'), t('st_ai'), t('st_pdf'), t('st_files'), t('st_links')].map((x) => h('th', x)))),
      h('tbody', rows.map((a) => h('tr', [h('td.mono', a.month), h('td', name(a.user)), h('td', `${a.logins}`), h('td', `${a.created}`), h('td', `${a.released}`), h('td', `${a.fetch}`), h('td', `${a.ai} / ${a.aiTok}`), h('td', `${a.pdf}`), h('td', `${a.files} / ${fmtMb(a.bytes)}`), h('td', `${a.linksNew} / ${a.linksOpen}`)])))])));
    // Fahrten je Ballon (Ballonbuch-Zahlen)
    const fl = new Map();
    for (const r of st.flights) { const k = `${r.reg || '–'}|${r.owner}|${r.materialOwner || ''}|${r.month || ''}`; const a = fl.get(k) || { reg: r.reg || '–', owner: r.owner, material: r.materialOwner, month: r.month || '–', n: 0, final: 0 }; a.n += r.count; if (r.status === 'final') a.final += r.count; fl.set(k, a); }
    const frows = [...fl.values()].sort((a, b) => b.month.localeCompare(a.month) || a.reg.localeCompare(b.reg));
    body.appendChild(h('h3', t('st_flights')));
    if (!frows.length) body.appendChild(h('div.note', t('st_none')));
    else body.appendChild(h('div.tblwrap', h('table.tbl.compact', [h('thead', h('tr', [t('st_month'), t('st_reg'), t('st_owner'), t('st_material'), t('st_count'), t('released_short')].map((x) => h('th', x)))),
      h('tbody', frows.map((a) => h('tr', [h('td.mono', a.month), h('td.mono', a.reg), h('td', name(a.owner)), h('td', a.material ? name(a.material) : '–'), h('td', `${a.n}`), h('td', `${a.final}`)])))])));
    // Speicher und Links je Benutzer
    body.appendChild(h('h3', t('st_storage')));
    body.appendChild(h('div.tblwrap', h('table.tbl.compact', [h('thead', h('tr', [t('st_user'), t('st_files'), t('st_links'), t('us_lastLogin')].map((x) => h('th', x)))),
      h('tbody', st.users.map((u) => { const s = st.storage.find((x) => x.owner === u.id) || {}; const l = st.links.find((x) => x.owner === u.id) || {}; return h('tr', [h('td', `${u.name} (${u.id})`), h('td', `${s.files || 0} / ${fmtMb(s.bytes)}`), h('td', `${l.count || 0} / ${l.opened || 0}`), h('td.sm', u.lastLoginAt ? fmtDateTime('Europe/Zurich', u.lastLoginAt) : '–')]); }))])));
  })();
  return box;
}
