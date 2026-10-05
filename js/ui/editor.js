/* Fahrtbriefing — Erarbeitungssicht: Navigation, Panels, Zusatzinfo/KI/Kommentar,
 * Freigabe-Checkliste, Berechtigungen. Für Owner und Mitarbeit-Links. */
import { h, clear, toast, dialog, debounce, uid, textToNodes } from '../util.js';
import { t, tt, getLang } from '../i18n.js';
import { setHeader, printButton } from '../app.js';
import { field, input, textarea, check, pasteArea, kv, tag } from './widgets.js';
import { sunBlock, massPerfEditor, scheduleEditor } from './parts.js';
import { SECTIONS, visiblePanels, panelFilled, mandatoryPanels, panelNo, AMC1_BOP_BAS_115, GAS_BRIEFING_EXTRA } from '../panels.js';
import { phaseOf, sunFor, equipmentSuggest, upgradeBriefing, applyLanding, fplSuggested, crossesBorder } from '../model.js';
import { docsLine } from '../stamm.js';
import { placeRow, placeLine } from './place.js';
import { meteoBar, autoBlock, askAi } from './autopanels.js';
import { refreshAll as refreshAllData } from '../auto/data.js';
import { goNoGoCard, crewDialog, assessmentDialog, finalPdfDialog, exportOne, printDialog, paxCardTitle } from './extras.js';
import { changesSinceFinal } from '../calc/diff.js';
import { panelByKey } from '../panels.js';
import { fmtDate, fmtDateTime, hhmm, fmtDur } from '../calc/time.js';
import { openAccessDialog } from './access.js';

export async function renderEditor(view, ctx, id, opts = {}) {
  const shared = ctx.shared;
  const b = opts.briefing || await ctx.store.getBriefing(id);
  if (!b) { view.appendChild(h('div.err', 'not found')); return; }
  if (!shared && b.access === 'read') { ctx.navigate(`#/v/${b.id}`); return; }   // fremdes Briefing: nur Briefingsicht
  upgradeBriefing(b);
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
  const touchedSoon = debounce(() => drawSide(), 1500);
  window.addEventListener('beforeunload', (e) => { if (dirty) { e.preventDefault(); e.returnValue = ''; } });

  // ---------------------------------------------------------------- Kopf
  function drawHeader() {
    const tools = [];
    const toggle = h('div.viewtoggle', [h('button.on', { type: 'button' }, t('view_edit')), h('button', { type: 'button', onclick: () => ctx.navigate(shared ? `#/s/${shared.token}/v` : `#/v/${b.id}`) }, t('view_brief'))]);
    tools.push(toggle);
    if (canOwn) tools.push(h('button.btn.primary', { type: 'button', onclick: release }, t('release')));
    tools.push(printButton(() => printDialog(b, ctx, shared)));   // Druckauswahl → Briefingsicht
    // Berechtigungen und «Mehr» als Untermenüs im Hamburger
    const menu = [
      canOwn ? { label: t('access'), items: [{ label: t('access_manage'), fn: () => openAccessDialog(ctx, b) }] } : null,
      { label: t('more'), items: [
        { label: paxCardTitle(S), fn: () => ctx.navigate(shared ? `#/s/${shared.token}/p` : `#/pax/${b.id}`) },
        { label: t('crew_title'), fn: () => crewDialog(b, ctx) },
        canOwn && ctx.store.mode === 'remote' && ctx.can('ai') ? { label: t('ass_title'), fn: () => assessmentDialog(b, ctx, () => { touched(); drawSide(); }) } : null,
        canOwn && ctx.store.mode === 'remote' && ctx.can('pdf') ? { label: t('pdf_title'), fn: () => finalPdfDialog(b, ctx, () => { touched(); drawHeader(); }) } : null,
        canOwn ? { label: t('export_one'), fn: () => exportOne(b) } : null,
      ].filter(Boolean) },
    ].filter(Boolean);
    const sub = h('span', [h('span.rev', t('rev', { n: b.revision || 0, t: b.updatedAt ? fmtDateTime(z, b.updatedAt, lang) : '–', who: b.updatedBy || '–' })), ' · ', b.status === 'final' ? tag('final', t('released', { n: b.finalNo })) : tag('', t('status_draft')), ' · ', tag(phaseOf(b.time.startMs) === 'final' ? 'final-phase' : phaseOf(b.time.startMs) === 'plan' ? 'plan' : 'pre', t('phase_' + phaseOf(b.time.startMs))), shared ? ` · ${shared.role === 'edit' ? t('ac_editlink') : t('ac_readonly')} · ${shared.person}` : '']);
    setHeader({ title: `${fmtDate(z, b.time.startMs, lang)} ${b.site.name || ''} · ${b.balloon.reg}`, sub, tools, menu });
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
      for (const p of ps) det.appendChild(h('div.it', { onclick: () => document.getElementById('panel-' + p.key)?.scrollIntoView({ behavior: 'smooth', block: 'start' }) }, [h('span.dot.' + panelStatus(p)), h('span.pno', panelNo(p, panels)), ' ', tt(p), mandatory.has(p.key) ? h('span.tag.must', { style: { marginLeft: 'auto' } }, '!') : null]));
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
    const ch = changesSinceFinal(b);
    side.append(...[
      goNoGoCard(b, ctx),
      ch ? h('div.card', [h('div.card-head', h('div.section-title', t('chg_title', { n: ch.since.no }))), h('div.card-body.note', ch.any ? [ch.fields.length ? h('div', `${t('chg_fields')}: ${ch.fields.map((f) => t('chg_' + f)).join(', ')}`) : null, ...ch.panels.map((p) => h('div', { onclick: () => document.getElementById('panel-' + p.key)?.scrollIntoView({ behavior: 'smooth' }), style: { cursor: 'pointer' } }, `• ${tt(panelByKey(p.key) || { de: p.key })} (${p.what.map((w) => t('chg_' + w)).join(', ')})`))] : t('chg_none'))]) : null,
      b.assessment?.text ? h('div.card', [h('div.card-head', h('div.section-title', t('ass_title'))), h('div.card-body', [h('div.note', { style: { whiteSpace: 'pre-wrap' } }, b.assessment.text), h('div.note.small', `${b.assessment.model || ''} · ${fmtDateTime(z, b.assessment.ts, lang)}`)])]) : null,
      h('div.card', [h('div.card-head', h('div.section-title', t('horizon'))), h('div.card-body', [h('div', `${fmtDate(z, b.time.startMs, lang)} ${hhmm(z, b.time.startMs)} LT · ${hhmm('UTC', b.time.startMs)} UTC`), h('div.note', `${hrs >= 0 ? '+' : ''}${hrs} h → ${t('phase_' + phaseOf(b.time.startMs))}`)])]),
      h('div.card', [h('div.card-head', h('div.section-title', 'Panels')), h('div.card-body', [h('div', [h('span.dot.ok'), ` ${counts.ok} ✓`]), h('div', [h('span.dot.must'), ` ${counts.must} ${t('panel_mandatory')}`]), h('div', [h('span.dot.auto'), ` ${counts.auto} auto`]), h('div', [h('span.dot.man'), ` ${counts.man} ${t('panel_optional')}`])])]),
      h('div.card', [h('div.card-head', h('div.section-title', t('log'))), h('div.card-body.note', (b.log || []).slice(-6).reverse().map((l) => h('div', `${fmtDateTime(z, l.ts, lang)} · ${l.who} · ${l.action}${l.panel ? ' · ' + l.panel : ''}${l.note ? ' · ' + l.note : ''}`)).concat((b.log || []).length ? [] : [h('div', '–')]))]),
    ].filter(Boolean));
  }

  // ---------------------------------------------------------------- Panels
  const upload = (dataUrl) => ctx.store.uploadImage(b.id, dataUrl, shared?.token);
  function subBlocks(p) {
    const d = b.panels[p.key];
    const hasExtra = !!((d.extra?.text || '').trim() || (d.extra?.images || []).length);
    const extra = h('details.sub.extra', { open: hasExtra }, [h('summary', t('extra')), pasteArea(d.extra, (v) => { d.extra = v; touched(p.key); }, upload, { placeholder: t('extraHint'), rows: 2 })]);
    // KI-Kommentar direkt unter dem Panelinhalt: Text (Klick auf ✎ zum Bearbeiten), ✕ verwirft
    let ai = null;
    if (d.ai?.text) {
      const ro = shared?.role === 'read';
      const txt = h('div.ai-text', d.ai.text);
      const ed = textarea(d.ai.text, { rows: 4, oninput: (e) => { d.ai.text = e.target.value; d.ai.edited = true; txt.textContent = e.target.value; touched(p.key); } }); ed.hidden = true;
      ai = h('div.sub.ai', [h('div.row-actions', [h('span.lbl', `🤖 ${t('ai')} · ${d.ai.model || ''} · ${d.ai.ts ? fmtDateTime(z, d.ai.ts, lang) : ''}${d.ai.edited ? ' · ' + t('ai_edited') : ''}`), ro ? null : h('button.btn.icon', { type: 'button', title: t('ai_edit'), onclick: () => { ed.hidden = !ed.hidden; txt.hidden = !ed.hidden; if (!ed.hidden) ed.focus(); } }, '✎'), ro ? null : h('button.btn.icon', { type: 'button', title: t('ai_discard'), onclick: () => { d.ai = null; touched(p.key); drawPanels(); } }, '✕')]), txt, ed]);
    }
    const cm = textarea(d.comment, { rows: 2, placeholder: t('comment'), oninput: (e) => { d.comment = e.target.value; touched(p.key); } });
    const comment = h('details.sub.cmt', { open: !!(d.comment || '').trim() }, [h('summary', t('comment')), cm]);
    return [extra, ai, comment];
  }
  /** Quelle eines Panels: Link aus den Einstellungen (p.link) oder aus dem Schnappschuss (PDF, Bild-URL, Quelle). */
  function sourceUrlOf(p, d) {
    const snap = d.content?.auto;
    return (p.link && S.sources[p.link]) || snap?.data?.pdfUrl || snap?.sourceUrl || snap?.data?.sourceUrl || snap?.images?.find((im) => im.src)?.src || (snap?.source && /^https?:\/\//.test(snap.source) ? snap.source : '') || '';
  }
  const shortUrl = (u) => { const x = u.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, ''); return x.length > 28 ? x.slice(0, 26) + '[…]' : x; };
  function renderPanel(p) {
    const d = b.panels[p.key] || (b.panels[p.key] = { content: {}, extra: { text: '', images: [] }, ai: null, comment: '' });
    const srcUrl = sourceUrlOf(p, d);
    const head = h('div.panel-head', [
      h('div.ttl', [h('span.pno', panelNo(p, panels)), ' ', tt(p)]),
      mandatory.has(p.key) ? tag('must', t('panel_mandatory')) : null,
      p.grade === 'auto' ? tag('auto', 'AUTO') : p.grade === 'half' ? tag('half', 'LINK + EINFÜGEN') : p.grade === 'calc' ? tag('calc', 'CALC') : null,
      srcUrl ? h('a.srclink', { href: srcUrl, target: '_blank', rel: 'noopener', title: srcUrl }, shortUrl(srcUrl)) : null,
      p.noAi ? null : aiButtons(p, d),
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
      case 'fpl': {
        // Schalter «Flugplan erstellen?» – Standard ja bei NVFR, Grenzüberschreitung oder Gasfahrt
        b.fpl = b.fpl || {};
        if (b.fpl.enabled == null) b.fpl.enabled = fplSuggested(b);
        const ro = shared?.role === 'read';
        const ta = textarea(d.content.text || '', { rows: 3, placeholder: t('fpl_textHint'), readOnly: ro, oninput: (e) => { d.content.text = e.target.value; touched(p.key); } });
        const body2 = h('div');
        const drawFpl = () => { clear(body2); if (b.fpl.enabled) body2.append(ta, h('div.note.small', t('fpl_soon'))); else body2.append(h('div.note', t('fpl_none'))); };
        const sw = check(t('fpl_create'), !!b.fpl.enabled, (v) => { b.fpl.enabled = v; drawFpl(); touched(p.key); }, { disabled: ro });
        const why = [b.flight?.nvfr ? t('nvfr') : null, b.balloon?.type === 'gas' ? t('gas') : null, crossesBorder(b) ? t('fpl_border') : null].filter(Boolean);
        drawFpl();
        content = h('div', [h('div.row-actions', [sw, why.length ? h('span.note.small', `${t('fpl_why')}: ${why.join(', ')}`) : null]), body2]);
        break;
      }
      case 'landing': {
        const ro = shared?.role === 'read';
        const box = h('div');
        const drawLand = () => { clear(box); box.appendChild(placeRow(b.landing, { label: t('landingSite'), title: t('landingSite'), allowClear: true, readOnly: ro, from: b.site, onPick: (pl) => { applyLanding(b, pl, lang); touched(p.key); drawLand(); } })); };
        drawLand();
        document.addEventListener('fb:landing', (e) => { if (e.detail?.id === b.id && box.isConnected) drawLand(); });
        content = h('div', [box, field(t('landingText'), textarea(d.content.text || '', { rows: 2, readOnly: ro, oninput: (e) => { d.content.text = e.target.value; touched(p.key); } }))]);
        break;
      }
      case 'auto': {
        const link = p.link && S.sources[p.link];
        if (!d.content) d.content = {};
        content = h('div', [
          autoBlock(p, d, b, ctx, { onChange: () => touched(p.key), readOnly: shared?.role === 'read', upload }),
          h('details.sub.extra', { open: !!((d.content.text || '').trim() || (d.content.images || []).length) || p.grade === 'half' }, [h('summary', t('panel_pasteSummary')), pasteArea(d.content, (v) => { Object.assign(d.content, { text: v.text, images: v.images }); touched(p.key); }, upload)]),
        ]);
        break;
      }
      case 'paste': default: {
        const link = p.link && S.sources[p.link];
        content = h('div', [
          p.phase2 ? h('div.note', { style: { marginBottom: '6px' } }, t('panel_phase2', { s: p.phase2 })) : null,
          pasteArea(d.content, (v) => { d.content = v; touched(p.key); }, upload),
        ]);
      }
    }
    body.append(content, ...subBlocks(p).filter(Boolean));
    return h('div.panel' + (panelStatus(p) === 'must' ? '.must-open' : ''), { id: 'panel-' + p.key }, [head, body]);
  }
  /** «KI-Kommentar» (direkt) und «…» (mit Prompt-Maske) im Titelbalken – Server-Modus mit KI-Freigabe. */
  function aiButtons(p, d) {
    if (ctx.store.mode !== 'remote' || !ctx.can('ai') || shared?.role === 'read') return null;
    const hasContent = !!(d.content?.auto || (d.content?.text || '').trim() || (d.content?.images || []).length || (d.extra?.text || '').trim() || (d.extra?.images || []).length || ['core', 'sun', 'massperf', 'schedule', 'equipment', 'transition'].includes(p.kind));
    if (!hasContent) return null;
    const run = async (edit) => { const btn = wrap.querySelector('button'); btn.disabled = true; btn.textContent = t('ai_working'); await askAi(p, d, b, ctx, () => touched(p.key), drawPanels, { edit }); btn.disabled = false; btn.textContent = d.ai?.text ? t('ai_again') : t('ai_ask'); };
    const wrap = h('span.aibtns', [
      h('button.btn.small.ai', { type: 'button', title: t('ai_direct'), onclick: () => run(false) }, d.ai?.text ? t('ai_again') : t('ai_ask')),
      h('button.btn.small.ai.more', { type: 'button', title: t('ai_withPrompt'), 'aria-label': t('ai_withPrompt'), onclick: () => run(true) }, '…'),
    ]);
    return wrap;
  }
  function coreBlock() {
    const rows = [
      [t('core_reg'), b.balloon.label], [t('core_date'), `${fmtDate(z, b.time.startMs, lang)}${b.flight.occasion ? ' · ' + b.flight.occasion : ''}`],
      [t('core_kind'), `${t('kind_' + b.flight.kind)} · LTF: ${b.flight.operatorName}`], [t('core_start'), `${hhmm(z, b.time.startMs)} LT (${hhmm('UTC', b.time.startMs)} UTC)`],
      [t('core_pic'), b.persons.pic], [t('core_pax'), `${b.persons.pax.length}: ${b.persons.pax.map((x) => x.name).join(', ') || '–'}`], [t('core_retrieve'), b.persons.retrieve || '–'],
      [t('core_site'), h('span', [placeLine(b.site), ` · ${b.site.country || ''}`])],
      [t('core_intent'), `${fmtDur(b.intent.durationMin)} · ${b.intent.altMinFt}–${b.intent.altMaxFt} ft · ${b.intent.direction || '–'}`],
      ...(docsLine(b.balloon.docs) ? [[t('docs'), docsLine(b.balloon.docs)]] : []),
      ...(docsLine(ctx.stamm?.persons?.find((x) => x.id === b.persons.picId)?.docs) ? [[`${t('docs')} PIC`, docsLine(ctx.stamm.persons.find((x) => x.id === b.persons.picId).docs)]] : []),
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
  async function refreshAll(statusEl) {
    const keys = panels.filter((p) => p.kind === 'auto' && (['meteogram', 'wind', 'temps', 'traj', 'balloon', 'pdiff', 'metar', 'sigmet', 'thermal'].includes(p.auto) || (p.auto === 'fwp' && b.site.country === 'DE'))).map((p) => p.key);
    let n = 0;
    ctx.autoLoad = false;
    const res = await refreshAllData(ctx, b, keys, (k, st, e) => { if (statusEl) statusEl.textContent = `${k} ${st === 'loading' ? '…' : st === 'ok' ? '✓' : '✗ ' + (e?.message || '')}`; });
    for (const [k, snap] of Object.entries(res)) { if (!snap.error) { b.panels[k].content = { ...(b.panels[k].content || {}), auto: snap }; touched(k); n++; } }
    b.meteo.lastRefresh = { ts: Date.now(), n, total: keys.length };
    drawPanels(); ctx.autoLoad = true;
  }
  function drawPanels() {
    clear(mainCol);
    for (const s of SECTIONS) {
      const ps = panels.filter((p) => p.section === s.id);
      if (!ps.length) continue;
      mainCol.appendChild(h('div.sect-title', `${s.id} · ${s[lang] || s.de}`));
      if (s.id === 'B' && b.site.lat != null) mainCol.appendChild(meteoBar(b, ctx, { onChange: () => { dirty = true; saveSoon(); }, refreshAll, readOnly: shared?.role === 'read' }));
      for (const p of ps) mainCol.appendChild(renderPanel(p));
    }
  }
  document.addEventListener('fb:ai', () => drawNav());

  // ---------------------------------------------------------------- Freigabe
  async function release() {
    const missing = mandatoryPanels(S, b).filter((p) => !panelFilled(p, b));
    const reason = textarea('', { rows: 2, placeholder: t('rel_reason') });
    const ch = changesSinceFinal(b);
    const content = h('div', [
      missing.length ? h('div', [h('div.warn', t('rel_missing')), h('ul', missing.map((p) => h('li', tt(p)))), h('div.lbl', t('rel_force')), reason]) : h('div.ok', t('rel_ok')),
      ch ? h('div.note', { style: { marginTop: '8px' } }, ch.any ? `${t('chg_title', { n: ch.since.no })}: ${[...ch.fields.map((f) => t('chg_' + f)), ...ch.panels.map((p) => tt(panelByKey(p.key) || { de: p.key }))].join(', ')}` : t('chg_none')) : null,
      h('div.note', { style: { marginTop: '8px' } }, t('rel_pdfHint')),
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
