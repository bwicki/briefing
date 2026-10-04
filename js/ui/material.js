/* Fahrtbriefing — Einstieg über Material-Link (#/m/<token>[/<id>[/p]]):
 * ein externer Materialeigner (z. B. Halter eines mitbenützten Ballons) sieht die
 * Liste aller Briefings mit seinen Kennungen und jedes davon in der Briefingsicht
 * (nur lesen) samt Pax-Karte. Kein Kennwort, kein Benutzerkonto. */
import { h } from '../util.js';
import { t } from '../i18n.js';
import { setHeader } from '../app.js';
import { renderBrief } from './view.js';
import { renderPaxCard } from './extras.js';
import { mergeSettings } from '../defaults.js';
import { upgradeBriefing, phaseOf } from '../model.js';
import { fmtDate, hhmm, fmtDateTime } from '../calc/time.js';
import { tag } from './widgets.js';

export async function renderMaterial(view, ctx, tokenAndMore) {
  const [token, id, sub] = tokenAndMore.split('/');
  let res;
  try { res = await ctx.store.openMaterial(token, id); }
  catch (e) { setHeader({ title: t('appName') }); view.appendChild(h('div.card', h('div.card-body', h('div.err', e.status === 404 || e.status === 410 ? t('ac_expired') : `${t('error')}: ${e.message}`)))); return; }
  if (id) {
    ctx.settings = mergeSettings(res.settings);
    ctx.shared = { token, role: 'read', person: res.person, material: true };
    const b = upgradeBriefing(res.briefing);
    if (sub === 'p') await renderPaxCard(view, ctx, b.id, { briefing: b });
    else await renderBrief(view, ctx, b.id, { briefing: b });
    return;
  }
  ctx.shared = { token, role: 'read', person: res.person, material: true };
  setHeader({ title: t('ml_title'), sub: `${res.person} · ${res.regs.join(', ')} · ${t('ml_owner')}: ${res.owner}` });
  const now = Date.now();
  const rows = res.briefings || [];
  const box = h('div.card', [h('div.card-head', h('div.section-title', t('ml_list', { n: rows.length }))), h('div.card-body')]);
  const body = box.querySelector('.card-body');
  if (!rows.length) body.appendChild(h('div.note', t('noBriefings')));
  else body.appendChild(h('div.cards-list', rows.map((b) => {
    const z = b.tz || 'Europe/Zurich', ph = phaseOf(b.startMs || 0, now);
    return h('a.bcard', { href: `#/m/${token}/${b.id}` }, [
      h('div.t', `${fmtDate(z, b.startMs || 0)} · ${hhmm(z, b.startMs || 0)} LT · ${b.reg || ''}`),
      h('div', `${b.site || '–'} · ${t('kind_' + (b.kind || 'commercial'))} · ${b.ownerName || b.owner || ''}`),
      h('div.m', [tag(ph === 'plan' ? 'plan' : ph === 'final' ? 'final-phase' : 'pre', t('phase_' + ph)), ' ', b.status === 'final' ? tag('final', t('released', { n: b.finalNo })) : tag('', t('status_draft')), ' ', h('span.sm', b.updatedAt ? fmtDateTime(z, b.updatedAt) : '')]),
    ]);
  })));
  body.appendChild(h('div.note', { style: { marginTop: '10px' } }, t('ml_hint', { d: fmtDate('Europe/Zurich', res.expiresAt) })));
  view.appendChild(box);
}
