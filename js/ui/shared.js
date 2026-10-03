/* Fahrtbriefing — Einstieg über persönlichen Link (#/s/<token>[/v|/w]). */
import { h, load, save, toast } from '../util.js';
import { t } from '../i18n.js';
import { setHeader } from '../app.js';
import { input, field } from './widgets.js';
import { renderEditor } from './editor.js';
import { renderBrief } from './view.js';
import { renderWizard } from './wizard.js';
import { mergeSettings } from '../defaults.js';

export async function renderShared(view, ctx, tokenAndMore) {
  const [token, sub] = tokenAndMore.split('/');
  let who = load(`fb.share.${token}`, '');
  let res;
  try { res = await ctx.store.openShared(token, who); }
  catch (e) { setHeader({ title: t('appName') }); view.appendChild(h('div.card', h('div.card-body', h('div.err', e.status === 404 || e.status === 410 ? t('ac_expired') : `${t('error')}: ${e.message}`)))); return; }
  ctx.settings = mergeSettings(res.settings);
  ctx.shared = { token, role: res.role, person: res.person };
  if (res.role === 'edit' && !who) {
    // Name für das Protokoll erfragen
    const nameIn = input('text', '', { placeholder: t('name') });
    setHeader({ title: t('appName') });
    const form = h('div.card', h('div.card-body', [h('p.note', `${t('ac_editlink')} · ${res.person}`), field(t('ac_yourName'), nameIn), h('button.btn.primary', { type: 'button', onclick: () => { who = nameIn.value.trim() || res.person; save(`fb.share.${token}`, who); ctx.shared.person = who; location.reload(); } }, t('ac_enter'))]));
    view.appendChild(form); return;
  }
  if (res.role === 'edit' && who) ctx.shared.person = who;
  const b = res.briefing;
  if (res.role === 'read' || sub === 'v') await renderBrief(view, ctx, b.id, { briefing: b });
  else if (sub === 'w') await renderWizard(view, ctx, b.id, { briefing: b });
  else await renderEditor(view, ctx, b.id, { briefing: b });
}
