/* Fahrtbriefing — Erarbeitungssicht: Navigation, Panels, Zusatzinfo/KI/Kommentar,
 * Freigabe-Checkliste, Berechtigungen. Für Owner und Mitarbeit-Links. */
import { h, clear, toast, dialog, debounce, uid, textToNodes } from '../util.js';
import { t, tt, getLang } from '../i18n.js';
import { setHeader } from '../app.js';
import { field, input, textarea, check, pasteArea, kv, tag } from './widgets.js';
import { sunBlock, massPerfEditor, scheduleEditor } from './parts.js';
import { SECTIONS, visiblePanels, panelFilled, mandatoryPanels, AMC1_BOP_BAS_115, GAS_BRIEFING_EXTRA } from '../panels.js';
import { phaseOf, sunFor, equipmentSuggest } from '../model.js';
import { fmtDate, fmtDateTime, hhmm, fmtDur } from '../calc/time.js';
import { openAccessDialog } from './access.js';

export async function renderEditor(view, ctx, id, opts = {}) {
  const shared = ctx.shared;
  const b = opts.briefing || await ctx.store.getBriefing(id);
  if (!b) { view.appendChild(h('div.err', 'not found')); return; }
  const S = ctx.settings, z = b.site.tz || 'Europe/Zurich', lang = getLang();
  const canOwn = !shared;

  // ---------------------------------------------------------------- Speichern
  let dirty = false;
  async function saveNow(logEntry) {
    if (logEntry) b.log.push({ ts: Date.now(), who: ctx.who, ...logEntry });
    if (b.log.length > 300) b.log.splice(0, b.log.length - 300);
    try {
      if (shared) await ctx.store.saveShared(shared.token, b, ctx.who); else await ctx.store.saveBriefing(b, ctx.who);
      dirty = false; drawHeader();
    } catch (e) { toast(`${t('error')}: ${e.message}`); }
  }
  const saveSoon = debounce(() => saveNow(), 900);
  const touched = (panelKey) => { dirty = true; if (panelKey) { const p = b.panels[panelKey]; p.updatedAt = Date.now(); p.updatedBy = ctx.who; } saveSoon(); drawNav(); };
  window.addEventListener('beforeunload', (e) => { if (dirty) { e.preventDefault(); e.returnValue = ''; } });

  // ---------------------------------------------------------------- Kopf
  function drawHeader() {
    const tools = [];
    const toggle = h('div.viewtoggle', [h('button.on', { type: 'button' }, t('view_edit')), h('button', { type: 'button', onclick: () => ctx.navigate(shared ? `#/s/${shared.token}/v` : `#/v/${b.id}`) }, t('view_brief'))]);
    tools.push(toggle);
    if (canOwn) tools.push(h('button.btn', { type: 'button', onclick: () => openAccessDialog(ctx, b) }, t('access')));
    tools.push(h('button.btn', { type: 'button', onclick: () => ctx.navigate(shared ? `#/s/${shared.token}/v?print=1` : `#/v/${b.id}?print=1`) }, t('print')));
    if (canOwn) tools.push(h('button.btn.primary', { type: 'button', onclick: release }, t('release')));
    const sub = h('span', [h('span.rev', t('rev', { n: b.revision || 0, t: b.updatedAt ? fmtDateTime(z, b.updatedAt, lang) : '–', who: b.updatedBy || '–' })), ' · ', b.status === 'final' ? tag('final', t('released', { n: b.finalNo })) : tag('', t('status_draft')), ' · ', tag(phaseOf(b.time.startMs) === 'final' ? 'final-phase' : phaseOf(b.time.startMs) === 'plan' ? 'plan' : 'pre', t('phase_' + phaseOf(b.time.startMs))), shared ? ` · ${shared.role === 'edit' ? t('ac_editlink') : t('ac_readonly')} · ${shared.person}` : '']);
    setHeader({ title: `${fmtDate(z, b.time.startMs, lang)} ${b.site.name || ''} · ${b.balloon.reg}`, sub, tools });
  }

  // ---------------------------------------------------------------- Layout
  const nav = h('div.enav-wrap', h('div.enav'));
  const mainCol = h('div');
  const side = h('div.side-wrap');
  view.appendChild(h('div.editor', [h('div', nav), mainCol, h('div.side', side)]));

  const panels = visiblePanels(S, b);
  const mandatory = new Set(mandatoryPanels(S, b).map((p) => p.key));

  function panelStatus(p) {
    if (panelFilled(p, b)) return 'ok';
    if (mandatory.has(p.key)) return 'must';
    if (p.grade === 'auto') return 'auto';
    return 'man';
  }
  function drawNav() {
    const e = nav.firstChild; clear(e);
    for (const s of SECTIONS) {
      const ps = panels.filter((p) => p.section === s.id);
      if (!ps.length) continue;
      const det = h('details', { open: window.innerWidth >= 900 || s.id === 'A' }, [h('summary', `${s.id} · ${s[lang] || s.de}`)]);
      for (const p of ps) det.appendChild(h('div.it', { onclick: () => document.getElementById('panel-' + p.key)?.scrollIntoView({ behavior: 'smooth', block: 'start' }) }, [h('span.dot.' + panelStatus(p)), tt(p), mandatory.has(p.key) ? h('span.tag.must', { style: { marginLeft: 'auto' } }, '!') : null]));
      e.appendChild(det);
    }
    e.appendChild(h('div.note', { style: { marginTop: '8px' } }, t('navLegend')));
    drawSide();
  }
  function drawSide() {
    clear(side);
    const hrs = Math.round((b.time.startMs - Date.now()) / 3600000);
    const counts = { ok: 0, must: 0, auto: 0, man: 0 };
    for (const p of panels) counts[panelStatus(p)]++;
    side.append(
      h('div.card', [h('div.card-head', h('div.section-title', t('horizon'))), h('div.card-body', [h('div', `${fmtDate(z, b.time.startMs, lang)} ${hhmm(z, b.time.startMs)} LT · ${hhmm('UTC', b.time.startMs)} UTC`), h('div.note', `${hrs >= 0 ? '+' : ''}${hrs} h → ${t('phase_' + phaseOf(b.time.startMs))}`)])]),
      h('div.card', [h('div.card-head', h('div.section-title', 'Panels')), h('div.card-body', [h('div', [h('span.dot.ok'), ` ${counts.ok} ✓`]), h('div', [h('span.dot.must'), ` ${counts.must} ${t('panel_mandatory')}`]), h('div', [h('span.dot.auto'), ` ${counts.auto} auto`]), h('div', [h('span.dot.man'), ` ${counts.man} ${t('panel_optional')}`])])]),
      h('div.card', [h('div.card-head', h('div.section-title', t('log'))), h('div.card-body.note', (b.log || []).slice(-6).reverse().map((l) => h('div', `${fmtDateTime(z, l.ts, lang)} · ${l.who} · ${l.action}${l.panel ? ' · ' + l.panel : ''}${l.note ? ' · ' + l.note : ''}`)).concat((b.log || []).length ? [] : [h('div', '–')]))]),
    );
  }

  // ---------------------------------------------------------------- Panels
  const upload = (dataUrl) => ctx.store.uploadImage(b.id, dataUrl, shared?.token);
  function subBlocks(p) {
    const d = b.panels[p.key];
    const hasExtra = !!((d.extra?.text || '').trim() || (d.extra?.images || []).length);
    const extra = h('details.sub.extra', { open: hasExtra }, [h('summary', t('extra')), pasteArea(d.extra, (v) => { d.extra = v; touched(p.key); }, upload, { placeholder: t('extraHint'), rows: 2 })]);
    const ai = d.ai?.text ? h('div.sub.ai', [h('span.lbl', t('ai')), h('div.note', d.ai.text)]) : null;
    const cm = textarea(d.comment, { rows: 2, placeholder: t('comment'), oninput: (e) => { d.comment = e.target.value; touched(p.key); } });
    const comment = h('details.sub.cmt', { open: !!(d.comment || '').trim() }, [h('summary', t('comment')), cm]);
    return [extra, ai, comment];
  }
  function renderPanel(p) {
    const d = b.panels[p.key] || (b.panels[p.key] = { content: {}, extra: { text: '', images: [] }, ai: null, comment: '' });
    const head = h('div.panel-head', [
      h('div.ttl', tt(p)),
      mandatory.has(p.key) ? tag('must', t('panel_mandatory')) : null,
      p.grade === 'auto' ? tag('auto', 'AUTO') : p.grade === 'half' ? tag('half', 'LINK + EINFÜGEN') : p.grade === 'calc' ? tag('calc', 'CALC') : null,
      d.updatedAt ? h('span.src', `${t('stand')}: ${fmtDateTime(z, d.updatedAt, lang)} · ${d.updatedBy || ''}`) : null,
    ]);
    const body = h('div.panel-body');
    let content;
    switch (p.kind) {
      case 'core': content = coreBlock(); break;
      case 'sun': content = sunBlock(b, ctx); break;
      case 'massperf': content = massPerfEditor(b, ctx, () => touched(p.key), shared?.role === 'read'); break;
      case 'schedule': content = scheduleEditor(b, ctx, () => touched(p.key), shared?.role === 'read'); break;
      case 'equipment': content = equipmentBlock(p, d); break;
      case 'transition': content = transitionBlock(p, d); break;
      case 'paxbriefing': content = paxBriefingBlock(p, d); break;
      case 'text': {
        if (d.content.text == null && p.defaultText) d.content.text = tt(p.defaultText);
        content = textarea(d.content.text || '', { rows: 2, oninput: (e) => { d.content.text = e.target.value; touched(p.key); } });
        break;
      }
      case 'paste': default: {
        const link = p.link && S.sources[p.link];
        content = h('div', [
          h('div.row-actions', { style: { marginBottom: '6px' } }, [link ? h('a.btn', { href: link, target: '_blank', rel: 'noopener' }, t('panel_open')) : null, p.phase2 ? h('span.note', t('panel_phase2', { s: p.phase2 })) : null]),
          pasteArea(d.content, (v) => { d.content = v; touched(p.key); }, upload),
        ]);
      }
    }
    body.append(content, ...subBlocks(p).filter(Boolean));
    return h('div.panel' + (panelStatus(p) === 'must' ? '.must-open' : ''), { id: 'panel-' + p.key }, [head, body]);
  }
  function coreBlock() {
    const rows = [
      [t('core_reg'), b.balloon.label], [t('core_date'), `${fmtDate(z, b.time.startMs, lang)}${b.flight.occasion ? ' · ' + b.flight.occasion : ''}`],
      [t('core_kind'), `${t('kind_' + b.flight.kind)} · LTF: ${b.flight.operatorName}`], [t('core_start'), `${hhmm(z, b.time.startMs)} LT (${hhmm('UTC', b.time.startMs)} UTC)`],
      [t('core_pic'), b.persons.pic], [t('core_pax'), `${b.persons.pax.length}: ${b.persons.pax.map((x) => x.name).join(', ') || '–'}`], [t('core_retrieve'), b.persons.retrieve || '–'],
      [t('core_site'), `${b.site.name} (${b.site.icao}) · ${b.site.elev ?? '?'} m AMSL · ${b.site.country || ''}`],
      [t('core_intent'), `${fmtDur(b.intent.durationMin)} · ${b.intent.altMinFt}–${b.intent.altMaxFt} ft · ${b.intent.direction || '–'}`],
    ];
    return h('div', [kv(rows), canOwn || shared?.role === 'edit' ? h('div.row-actions', { style: { marginTop: '8px' } }, [h('button.btn', { type: 'button', onclick: async () => { b.wizardStep = 1; await saveNow(); ctx.navigate(shared ? `#/s/${shared.token}/w` : `#/new/${b.id}`); } }, `✎ ${t('masterData')}`)]) : null]);
  }
  function equipmentBlock(p, d) {
    const sun = sunFor(b, S, ctx.racTable);
    const sugg = equipmentSuggest(b, sun);
    if (!d.content.items) d.content.items = sugg.length ? [...sugg] : ['none'];
    const sel = new Set(d.content.items);
    const box = h('div');
    for (const it of S.equipmentItems) box.appendChild(check(t('eq_' + it), sel.has(it), (on) => { if (on) sel.add(it); else sel.delete(it); if (it === 'none' && on) { S.equipmentItems.filter((x) => x !== 'none').forEach((x) => sel.delete(x)); } else if (on) sel.delete('none'); d.content.items = [...sel]; box.querySelectorAll('input').forEach((c, i) => { c.checked = sel.has(S.equipmentItems[i]); }); touched(p.key); }));
    return h('div', [box, sugg.length ? h('div.note', t('eq_suggest', { s: sugg.map((x) => t('eq_' + x)).join(', ') })) : null]);
  }
  function transitionBlock(p, d) {
    if (!d.content.items) d.content.items = [...(S.transitionDefaults[b.site.country] || [])];
    const sel = new Set(d.content.items);
    const box = h('div');
    for (const ta of S.transitionAltitudes) box.appendChild(check(ta.label, sel.has(ta.id), (on) => { if (on) sel.add(ta.id); else sel.delete(ta.id); d.content.items = [...sel]; touched(p.key); }));
    return h('div', [box, h('div.note', t('tr_hint'))]);
  }
  function paxBriefingBlock(p, d) {
    const sel = new Set(d.content.items || S.paxBriefingItems);
    if (!d.content.items) d.content.items = [...sel];
    const box = h('div');
    for (const it of S.paxBriefingItems) box.appendChild(check(t('pb_' + it), sel.has(it), (on) => { if (on) sel.add(it); else sel.delete(it); d.content.items = [...sel]; touched(p.key); }));
    const extraGas = b.balloon.type === 'gas' ? h('div', [h('div.lbl', t('pb_gas')), h('ul', { style: { margin: '4px 0', paddingLeft: '18px' } }, GAS_BRIEFING_EXTRA[lang].map((x) => h('li', x)))]) : null;
    return h('div', [box, extraGas, h('details', [h('summary.small', 'AMC1 BOP.BAS.115'), h('pre.report', AMC1_BOP_BAS_115)])]);
  }
  function drawPanels() {
    clear(mainCol);
    for (const s of SECTIONS) {
      const ps = panels.filter((p) => p.section === s.id);
      if (!ps.length) continue;
      mainCol.appendChild(h('div.sect-title', `${s.id} · ${s[lang] || s.de}`));
      for (const p of ps) mainCol.appendChild(renderPanel(p));
    }
  }

  // ---------------------------------------------------------------- Freigabe
  async function release() {
    const missing = mandatoryPanels(S, b).filter((p) => !panelFilled(p, b));
    const reason = textarea('', { rows: 2, placeholder: t('rel_reason') });
    const content = h('div', [
      missing.length ? h('div', [h('div.warn', t('rel_missing')), h('ul', missing.map((p) => h('li', tt(p)))), h('div.lbl', t('rel_force')), reason]) : h('div.ok', t('rel_ok')),
    ]);
    const ok = await dialog(t('rel_title'), content, [{ label: t('rel_cancel'), value: false }, { label: t('rel_do'), value: true, primary: true }]);
    if (!ok) return;
    if (missing.length && !reason.value.trim()) { toast(t('rel_reason') + '?'); return; }
    b.status = 'final'; b.finalNo = (b.finalNo || 0) + 1;
    const snap = JSON.parse(JSON.stringify({ ...b, versions: undefined, log: undefined }));
    b.versions.push({ no: b.finalNo, ts: Date.now(), who: ctx.who, reason: reason.value.trim() || null, snapshot: snap });
    await saveNow({ action: `Final v${b.finalNo}`, note: reason.value.trim() || null });
    toast(t('rel_done', { n: b.finalNo }));
    drawHeader();
  }

  drawHeader(); drawNav(); drawPanels();
}
