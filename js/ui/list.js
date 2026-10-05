/* Fahrtbriefing — Übersicht der Briefings. */
import { h, clear, toast, dialog } from '../util.js';
import { t } from '../i18n.js';
import { setHeader } from '../app.js';
import { fmtDate, hhmm, fmtDateTime } from '../calc/time.js';
import { phaseOf, duplicateBriefing, sunFor, isLocked } from '../model.js';
import { racValidity, racFmt, racLookup } from '../calc/rac.js';
import { isoDate } from '../calc/time.js';
import { tag } from './widgets.js';

export async function renderList(view, ctx) {
  setHeader({ title: t('briefings'), tools: [] });   // «+ Neues Briefing» steht als gefüllter Knopf in der Hauptnavigation
  // Sichten: eigene · alle Benutzer (Super) · Fahrten mit meinem Material (Ballon freigegeben)
  const remote = ctx.store.mode === 'remote';
  const scopes = ['own'];
  if (remote && ctx.isSuper) scopes.push('all');
  if (remote && (ctx.given || []).some((g) => g.categories?.includes('balloons'))) scopes.push('material');
  const want = (location.hash.split('?')[1] || '').replace(/^scope=/, '');
  let scope = scopes.includes(want) ? want : 'own';
  let all = await ctx.store.listBriefings(scope);
  const foreign = (b) => ctx.user && b.owner && b.owner !== ctx.user.id;
  const openHash = (b) => (foreign(b) ? `#/v/${b.id}` : `#/b/${b.id}`);
  let filter = 'planned', q = '';
  const now = Date.now();

  const body = h('div');
  const side = h('div');
  view.appendChild(h('div.layout-2', [body, side]));

  function rows() {
    return all.filter((b) => {
      const ph = phaseOf(b.startMs || 0, now);
      if (filter === 'planned' && ph === 'past') return false;
      if (filter === 'archive' && ph !== 'past') return false;
      if (q) { const s = `${b.no || ''} ${b.site || ''} ${b.reg || ''} ${b.balloon || ''} ${b.ownerName || ''} ${fmtDate(b.tz || 'Europe/Zurich', b.startMs || 0)}`.toLowerCase(); if (!s.includes(q.toLowerCase())) return false; }
      return true;
    });
  }
  function draw() {
    clear(body);
    const search = h('input', { type: 'search', placeholder: t('search'), value: q, oninput: (e) => { q = e.target.value; drawTable(); } });
    const chips = h('div.chips', ['all', 'planned', 'archive'].map((f) => h('button.chip.lg', { type: 'button', 'aria-pressed': filter === f, onclick: () => { filter = f; draw(); } }, t(f === 'all' ? 'filterAll' : f === 'planned' ? 'filterPlanned' : 'filterArchive'))));
    body.appendChild(h('div.list-head', [h('h2', t('briefings')), chips]));
    if (scopes.length > 1) body.appendChild(h('div.chips.scopes', scopes.map((sc) => h('button.chip', { type: 'button', 'aria-pressed': scope === sc, onclick: async () => { scope = sc; all = await ctx.store.listBriefings(scope); draw(); } }, t('scope_' + sc)))));
    body.appendChild(h('div', { style: { marginBottom: '10px' } }, search));
    body.appendChild(tableWrap);
    drawTable();
  }
  const tableWrap = h('div');
  function drawTable() {
    clear(tableWrap);
    const rs = rows();
    if (!rs.length) { tableWrap.appendChild(h('div.note', t('noBriefings'))); return; }
    const narrow = window.innerWidth < 700;
    if (narrow) {
      tableWrap.appendChild(h('div.cards-list', rs.map((b) => h('div.bcard', { onclick: () => ctx.navigate(openHash(b)) }, [
        h('div.t', `${b.no ? b.no + ' · ' : ''}${fmtDate(b.tz || 'Europe/Zurich', b.startMs || 0)} · ${hhmm(b.tz || 'Europe/Zurich', b.startMs || 0)} LT · ${b.reg || ''}`),
        h('div', `${b.site || '–'}${scope !== 'own' ? ` · ${b.ownerName || b.owner || ''}` : ''}`),
        h('div.m', [locked(b) ? '🔒 ' : '', phaseTag(b), ' ', statusText(b)]),
      ]))));
      return;
    }
    const showOwner = scope !== 'own';
    const tz = (b) => b.tz || 'Europe/Zurich';
    const tbl = h('table.tbl.list', [h('thead', h('tr', [h('th', '#'), h('th', t('colDate')), h('th', t('colSite')), showOwner ? h('th', t('colOwner')) : null, h('th', t('colBalloon')), h('th', t('colType')), h('th', t('colStatus')), h('th', t('colChange')), h('th', '')].filter(Boolean))),
      h('tbody', rs.map((b) => h('tr', { class: locked(b) ? 'locked' : '' }, [
        h('td.mono.no', [b.no || '–', locked(b) ? h('span.lock', { title: t('locked') }, ' 🔒') : null]),
        h('td', [h('div.l1', fmtDate(tz(b), b.startMs || 0)), h('div.l2', `${hhmm(tz(b), b.startMs || 0)} LT`)]),
        h('td', [h('div.l1', b.site || '–'), h('div.l2', `${b.icao || ''}${b.elev != null ? ' · ' + Math.round(b.elev) + '\u00a0m' : ''}`)]),
        showOwner ? h('td', [h('div.l1', b.ownerName || b.owner || '–'), b.materialOwner && b.materialOwner !== b.owner ? h('div.l2', `${t('colMaterial')}: ${b.materialOwner}`) : null]) : null,
        h('td.nowrap', b.reg || b.balloon || '–'),
        h('td.nowrap', t('kind_' + (b.kind || 'commercial'))),
        h('td', [h('div.l1', statusTag(b)), h('div.l2', phaseTag(b))]),
        h('td', [h('div.l1', `v${b.edition ?? b.revision ?? 0} · ${b.updatedAt ? fmtDateTime(tz(b), b.updatedAt) : '–'}`), h('div.l2', [b.updatedBy || '', b.links ? h('span', { title: t('colLinks') }, ` · 🔗 ${b.links}`) : null])]),
        h('td.row-actions.acts', foreign(b) ? [h('button.btn.icon.small', { type: 'button', title: t('view_brief'), onclick: () => ctx.navigate(openHash(b)) }, '👁')] : [
          locked(b) ? h('button.btn.icon.small', { type: 'button', title: t('view_brief'), onclick: () => ctx.navigate(`#/v/${b.id}`) }, '👁') : h('button.btn.icon.small.edit', { type: 'button', title: t('edit'), onclick: () => ctx.navigate(`#/b/${b.id}`) }, '✎'),
          h('button.btn.icon.small', { type: 'button', title: t('duplicate'), onclick: () => dup(b.id) }, '⧉'),
          h('button.btn.icon.small', { type: 'button', title: t('delete'), onclick: () => delB(b.id) }, '🗑'),
        ]),
      ].filter(Boolean))))]);
    tableWrap.appendChild(tbl);
  }
  const locked = (b) => (b.endMs ? now > b.endMs : isLocked({ time: { startMs: b.startMs || 0 }, intent: {} }, now));
  /** Phase der Fahrt (Vorplanung/Planung/Final/vergangen) als kleines Etikett. */
  function phaseTag(b) {
    const ph = phaseOf(b.startMs || 0, now);
    const cls = ph === 'plan' ? 'plan' : ph === 'final' ? 'final-phase' : 'pre';
    return tag(cls, t('phase_' + ph));
  }
  /** Status: «Final v2» oder «in Arbeit 75 %» (Fortschritt = gefüllte Panels). */
  function statusTag(b) {
    return b.status === 'final' ? tag('final', t('released', { n: b.finalNo })) : tag('', b.progress == null ? t('status_inwork') : t('status_progress', { p: b.progress }));
  }
  function statusText(b) {
    const st = b.status === 'final' ? t('released', { n: b.finalNo }) : b.progress == null ? t('status_inwork') : t('status_progress', { p: b.progress });
    return `${st} · v${b.edition ?? b.revision ?? 0} · ${b.updatedAt ? fmtDateTime(b.tz || 'Europe/Zurich', b.updatedAt) : ''}${b.updatedBy ? ' · ' + b.updatedBy : ''}`;
  }
  async function dup(id) {
    const src = await ctx.store.getBriefing(id);
    const b = duplicateBriefing(src, ctx.settings);
    await ctx.store.saveBriefing(b, ctx.who);
    ctx.navigate(`#/new/${b.id}`);
  }
  async function delB(id) {
    if (!(await dialog(t('delete'), h('p', t('confirmDelete')), [{ label: t('cancel'), value: false }, { label: t('delete'), value: true, primary: true }]))) return;
    await ctx.store.deleteBriefing(id);
    const i = all.findIndex((b) => b.id === id); if (i >= 0) all.splice(i, 1);
    drawTable(); toast(t('ok'));
  }

  // rechte Spalte: nächste Fahrt, Stammdaten
  const upcoming = all.filter((b) => !foreign(b) && (b.startMs || 0) > now - 6 * 3600000).sort((a, b) => a.startMs - b.startMs)[0];
  const sideCards = [];
  if (upcoming) {
    const full = await ctx.store.getBriefing(upcoming.id);
    const sun = full ? sunFor(full, ctx.settings, ctx.racTable) : null;
    const tz = upcoming.tz || 'Europe/Zurich';
    sideCards.push(h('div.card', [h('div.card-head', h('div.section-title', t('nextFlight'))), h('div.card-body', [
      h('div', { style: { fontWeight: 600 } }, `${fmtDate(tz, upcoming.startMs)} ${hhmm(tz, upcoming.startMs)} LT · ${upcoming.reg || ''}`),
      h('div', upcoming.site || ''),
      sun ? h('div.note', `BCMT ${hhmm(tz, sun.official.bcmt)} · SR ${hhmm(tz, sun.official.sr)} · SS ${hhmm(tz, sun.official.ss)} · ECET ${hhmm(tz, sun.official.ecet)}`) : null,
      h('div', { style: { marginTop: '8px' } }, h('button.btn', { type: 'button', onclick: () => ctx.navigate(`#/b/${upcoming.id}`) }, t('open'))),
    ])]));
  }
  const s = ctx.settings;
  sideCards.push(h('div.card', [h('div.card-head', h('div.section-title', t('masterData'))), h('div.card-body.note', [
    h('div', `${t('set_balloons')}: ${s.balloons.hab.length + s.balloons.envelopes.length} · ${t('set_persons')}: ${s.persons.length} · ${t('set_sites')}: ${s.sites.length}`),
    (ctx.sharedStamm || []).length ? h('div', `${t('sh_received')}: ${ctx.sharedStamm.map((x) => `${x.fromName} (${x.categories.map((c) => t('sh_cat_' + c)).join(', ')})`).join(' · ')}`) : null,
    h('div', `${t('racValid')}: ${ctx.racTable ? racValidity(ctx.racTable).split('–')[1].trim() : '–'}`),
    h('div', { style: { marginTop: '8px' } }, h('button.btn', { type: 'button', onclick: () => ctx.navigate('#/settings') }, t('nav_settings'))),
  ])]));
  side.append(...sideCards);
  draw();
}
