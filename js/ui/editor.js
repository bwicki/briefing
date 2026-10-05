/* Fahrtbriefing — Erarbeitungssicht: Navigation, Panels, Zusatzinfo/KI/Kommentar,
 * Freigabe-Checkliste, Berechtigungen. Für Owner und Mitarbeit-Links. */
import { h, clear, toast, dialog, debounce, uid, textToNodes } from '../util.js';
import { t, tt, getLang } from '../i18n.js';
import { setHeader, printButton } from '../app.js';
import { field, input, textarea, check, pasteArea, kv, tag } from './widgets.js';
import { sunBlock, massPerfEditor, scheduleEditor } from './parts.js';
import { SECTIONS, visiblePanels, panelFilled, mandatoryPanels, panelNo, AMC1_BOP_BAS_115, GAS_BRIEFING_EXTRA } from '../panels.js';
import { phaseOf, sunFor, equipmentSuggest, upgradeBriefing, applyLanding, balloonImage, completion, isLocked, paxLine, countriesLine } from '../model.js';
import { docsLine } from '../stamm.js';
import { placeRow, placeLine } from './place.js';
import { meteoBar, autoBlock, askAi } from './autopanels.js';
import { refreshAll as refreshAllData } from '../auto/data.js';
import { goNoGoCard, crewDialog, assessmentDialog, finalPdfDialog, exportOne, printDialog, paxCardTitle } from './extras.js';
import { changesSinceFinal } from '../calc/diff.js';
import { panelByKey } from '../panels.js';
import { fmtDate, fmtDateTime, hhmm, fmtDur } from '../calc/time.js';
import { openAccessDialog } from './access.js';
import { fplPanel } from './fplpanel.js';
import { icon, iconSvg } from './icons.js';

export async function renderEditor(view, ctx, id, opts = {}) {
  const shared = ctx.shared;
  const b = opts.briefing || await ctx.store.getBriefing(id);
  if (!b) { view.appendChild(h('div.err', 'not found')); return; }
  if (!shared && b.access === 'read') { ctx.navigate(`#/v/${b.id}`); return; }   // fremdes Briefing: nur Briefingsicht
  if (isLocked(b)) { ctx.navigate(shared ? `#/s/${shared.token}/v` : `#/v/${b.id}`); return; }   // Fahrt vorbei: unverändert lassen (Hinweis in der Briefingsicht)
  upgradeBriefing(b);
  const S = ctx.settings, z = b.site.tz || 'Europe/Zurich', lang = getLang();
  const canOwn = !shared;

  // ---------------------------------------------------------------- Speichern
  let dirty = false;
  // Bearbeitungsstand «vN»: jede Bearbeitungssitzung (Öffnen der Erarbeitung, Weiterarbeit nach Freigabe/PDF) zählt beim ersten Speichern +1
  let editionPending = true;
  async function saveNow(logEntry) {
    if (logEntry) b.log.push({ ts: Date.now(), who: ctx.who, ...logEntry });
    if (b.log.length > 300) b.log.splice(0, b.log.length - 300);
    b.progress = completion(b, S);
    if (editionPending) { b.edition = (b.edition || 0) + 1; editionPending = false; }
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
        canOwn && ctx.store.mode === 'remote' && ctx.can('pdf') ? { label: t('pdf_title'), fn: () => finalPdfDialog(b, ctx, () => { editionPending = true; touched(); drawHeader(); }) } : null,
        canOwn ? { label: t('export_one'), fn: () => exportOne(b) } : null,
      ].filter(Boolean) },
    ].filter(Boolean);
    const sub = h('span', [h('span.rev', t('rev', { n: b.edition ?? b.revision ?? 0, t: b.updatedAt ? fmtDateTime(z, b.updatedAt, lang) : '–', who: b.updatedBy || '–' })), ' · ', b.status === 'final' ? tag('final', t('released', { n: b.finalNo })) : tag('', t('status_progress', { p: completion(b, S) })), ' · ', tag(phaseOf(b.time.startMs) === 'final' ? 'final-phase' : phaseOf(b.time.startMs) === 'plan' ? 'plan' : 'pre', t('phase_' + phaseOf(b.time.startMs))), shared ? ` · ${shared.role === 'edit' ? t('ac_editlink') : t('ac_readonly')} · ${shared.person}` : '']);
    setHeader({ title: `${b.no ? b.no + ' · ' : ''}${fmtDate(z, b.time.startMs, lang)} ${b.site.name || ''} · ${b.balloon.reg}`, sub, tools, menu });
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
  // Navigation als Akkordeon: nur der Abschnitt der gerade bearbeiteten Stelle ist offen; selbst geöffnete bleiben offen
  const navOpen = new Set(); let activeSect = null, activeKey = null, closedActive = null;
  function applyNavOpen() {
    for (const det of nav.querySelectorAll('details')) {
      const id = det.dataset.sect;
      const want = (id === activeSect && closedActive !== id) || navOpen.has(id);
      if (det.open !== want) { det.dataset.auto = '1'; det.open = want; }
    }
    for (const it of nav.querySelectorAll('.it')) it.classList.toggle('sel', it.dataset.key === activeKey);
  }
  function drawNav() {
    const e = nav.firstChild; clear(e);
    if (!activeSect) activeSect = SECTIONS.find((s) => panels.some((p) => p.section === s.id))?.id || 'A';
    for (const s of SECTIONS) {
      const ps = panels.filter((p) => p.section === s.id);
      if (!ps.length) continue;
      const det = h('details', { 'data-sect': s.id }, [h('summary', `${s.id} · ${s[lang] || s.de}`)]);
      det.addEventListener('toggle', () => { if (det.dataset.auto) { delete det.dataset.auto; return; } if (det.open) { navOpen.add(s.id); if (closedActive === s.id) closedActive = null; } else { navOpen.delete(s.id); if (s.id === activeSect) closedActive = s.id; } });
      for (const p of ps) det.appendChild(h('div.it', { 'data-key': p.key, onclick: () => { setActive(p.key); document.getElementById('panel-' + p.key)?.scrollIntoView({ behavior: 'smooth', block: 'start' }); } }, [h('span.dot.' + panelStatus(p)), h('span.pno', panelNo(p, panels)), ' ', tt(p), mandatory.has(p.key) ? h('span.tag.must', { style: { marginLeft: 'auto' } }, '!') : null]));
      e.appendChild(det);
    }
    e.appendChild(h('div.note', { style: { marginTop: '8px' } }, t('navLegend')));
    applyNavOpen();
    drawSide();
  }
  function setActive(key) {
    const p = panels.find((x) => x.key === key); if (!p) return;
    if (p.section !== activeSect) { activeSect = p.section; closedActive = null; }
    activeKey = key; applyNavOpen();
  }
  // aktiver Abschnitt aus der Scroll-Position (erstes Panel, dessen Oberkante die Lesemarke erreicht hat)
  let scrollTick = false;
  const onScroll = () => {
    if (!mainCol.isConnected) { window.removeEventListener('scroll', onScroll); return; }
    if (scrollTick) return; scrollTick = true;
    requestAnimationFrame(() => {
      scrollTick = false;
      const mark = 140; let cur = null;
      for (const el of mainCol.querySelectorAll('.panel')) { const r = el.getBoundingClientRect(); if (r.top <= mark) cur = el; else break; }
      const key = (cur || mainCol.querySelector('.panel'))?.id?.replace(/^panel-/, '');
      if (key && key !== activeKey) setActive(key);
    });
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  mainCol.addEventListener('focusin', (e) => { const el = e.target.closest('.panel'); if (el) setActive(el.id.replace(/^panel-/, '')); });
  function drawSide() {
    clear(side);
    const hrs = Math.round((b.time.startMs - Date.now()) / 3600000);
    const counts = { ok: 0, must: 0, auto: 0, man: 0 };
    for (const p of panels) counts[panelStatus(p)]++;
    const ch = changesSinceFinal(b);
    side.append(...[
      goNoGoCard(b, ctx),
      ch ? h('div.card', [h('div.card-head', h('div.section-title', t('chg_title', { n: ch.since.no }))), h('div.card-body.note', ch.any ? [ch.fields.length ? h('div', `${t('chg_fields')}: ${ch.fields.map((f) => t('chg_' + f)).join(', ')}`) : null, ...ch.panels.map((p) => h('div', { onclick: () => document.getElementById('panel-' + p.key)?.scrollIntoView({ behavior: 'smooth' }), style: { cursor: 'pointer' } }, `• ${tt(panelByKey(p.key) || { de: p.key })} (${p.what.map((w) => t('chg_' + w)).join(', ')})`))] : t('chg_none'))]) : null,
      h('div.card', [h('div.card-head', h('div.section-title', t('horizon'))), h('div.card-body', [h('div', `${fmtDate(z, b.time.startMs, lang)} ${hhmm(z, b.time.startMs)} LT · ${hhmm('UTC', b.time.startMs)} UTC`), h('div.note', `${hrs >= 0 ? '+' : ''}${hrs} h → ${t('phase_' + phaseOf(b.time.startMs))}`)])]),
      h('div.card', [h('div.card-head', h('div.section-title', 'Panels')), h('div.card-body', [h('div', [h('span.dot.ok'), ` ${counts.ok} ✓`]), h('div', [h('span.dot.must'), ` ${counts.must} ${t('panel_mandatory')}`]), h('div', [h('span.dot.auto'), ` ${counts.auto} auto`]), h('div', [h('span.dot.man'), ` ${counts.man} ${t('panel_optional')}`])])]),
      h('div.card', [h('div.card-head', h('div.section-title', t('log'))), h('div.card-body.note', (b.log || []).slice(-6).reverse().map((l) => h('div', `${fmtDateTime(z, l.ts, lang)} · ${l.who} · ${l.action}${l.panel ? ' · ' + l.panel : ''}${l.note ? ' · ' + l.note : ''}`)).concat((b.log || []).length ? [] : [h('div', '–')]))]),
      summaryCard(),
    ].filter(Boolean));
  }
  /** Zuunterst: Zusammenfassung des Briefings (KI-Gesamteinschätzung) mit Knopf zum Erstellen/Erneuern. */
  function summaryCard() {
    const canAi = canOwn && ctx.store.mode === 'remote' && ctx.can('ai');
    const a = b.assessment;
    return h('div.card.summary', [h('div.card-head', h('div.section-title', t('summary_title'))), h('div.card-body', [
      a?.text ? h('div.note', { style: { whiteSpace: 'pre-wrap' } }, a.text) : h('div.note.small', t('summary_hint')),
      a?.text ? h('div.note.small', `${a.model || ''} · ${fmtDateTime(z, a.ts, lang)}`) : null,
      canAi ? h('span.aibtns', { style: { marginTop: '6px', display: 'inline-flex' } }, [
        h('button.btn.small.ai' + (a?.text ? '.renew' : ''), { type: 'button', title: t('ai_direct'), onclick: () => assessmentDialog(b, ctx, () => { touched(); drawSide(); }, { edit: false }) }, a?.text ? t('summary_renew') : t('summary_make')),
        h('button.btn.small.ai.more', { type: 'button', title: t('ai_withPrompt'), 'aria-label': t('ai_withPrompt'), onclick: () => assessmentDialog(b, ctx, () => { touched(); drawSide(); }, { edit: true }) }, icon('more', 14)),
      ]) : null,
    ])]);
  }

  // ---------------------------------------------------------------- Panels
  const upload = (dataUrl) => ctx.store.uploadImage(b.id, dataUrl, shared?.token);
  // Zusatzboxen unter dem Panelinhalt: «Eigener Text / Bilder / Daten» (blau) und «Kommentar PIC» (gelb) – erscheinen nur mit Inhalt
  // oder nach Klick auf den Symbolknopf im Panelkopf; KI-Kommentar dazwischen (violett)
  const openBoxes = new Set();
  function extraBox(p, d) {
    return h('div.sub.extra', [h('div.lbl', t('extra')), pasteArea(d.extra, (v) => { d.extra = v; touched(p.key); }, upload, { placeholder: t('extraHint'), rows: 2 })]);
  }
  function commentBox(p, d) {
    const ro = shared?.role === 'read';
    return h('div.sub.cmt', [h('div.lbl', t('comment')), textarea(d.comment, { rows: 2, readOnly: ro, placeholder: t('comment'), oninput: (e) => { d.comment = e.target.value; touched(p.key); } })]);
  }
  function subBlocks(p) {
    const d = b.panels[p.key];
    const hasExtra = !!((d.extra?.text || '').trim() || (d.extra?.images || []).length);
    const extra = hasExtra || openBoxes.has(p.key + ':extra') ? extraBox(p, d) : null;
    // KI-Kommentar direkt unter dem Panelinhalt: Text (Klick auf ✎ zum Bearbeiten), ✕ verwirft
    let ai = null;
    if (d.ai?.text) {
      const ro = shared?.role === 'read';
      const txt = h('div.ai-text', d.ai.text);
      const ed = textarea(d.ai.text, { rows: 4, oninput: (e) => { d.ai.text = e.target.value; d.ai.edited = true; txt.textContent = e.target.value; touched(p.key); } }); ed.hidden = true;
      ai = h('div.sub.ai', [h('div.row-actions', [h('span.lbl', [icon('ai', 14), ` ${t('ai')} · ${d.ai.model || ''} · ${d.ai.ts ? fmtDateTime(z, d.ai.ts, lang) : ''}${d.ai.edited ? ' · ' + t('ai_edited') : ''}`]), ro ? null : h('button.btn.icon', { type: 'button', title: t('ai_edit'), onclick: () => { ed.hidden = !ed.hidden; txt.hidden = !ed.hidden; if (!ed.hidden) ed.focus(); } }, icon('edit')), ro ? null : h('button.btn.icon', { type: 'button', title: t('ai_discard'), onclick: () => { d.ai = null; touched(p.key); drawPanels(); } }, icon('close'))]), txt, ed]);
    }
    const comment = (d.comment || '').trim() || openBoxes.has(p.key + ':cmt') ? commentBox(p, d) : null;
    return [extra, ai, comment];
  }
  /** Symbolknöpfe im Panelkopf: 📝 Eigener Text/Bilder/Daten · 💬 Kommentar PIC – fügen die Box unter dem Inhalt an und setzen den Fokus. */
  function addButtons(p, d) {
    if (shared?.role === 'read') return null;
    const open = (kind) => {
      const body = document.getElementById('panel-' + p.key)?.querySelector('.panel-body'); if (!body) return;
      let box = body.querySelector(kind === 'extra' ? ':scope > .sub.extra' : ':scope > .sub.cmt');
      if (!box) {
        openBoxes.add(`${p.key}:${kind}`);
        box = kind === 'extra' ? extraBox(p, d) : commentBox(p, d);
        if (kind === 'extra') { const before = body.querySelector(':scope > .sub.ai') || body.querySelector(':scope > .sub.cmt'); before ? body.insertBefore(box, before) : body.appendChild(box); } else body.appendChild(box);
      }
      box.querySelector('textarea')?.focus();
    };
    return h('div.addrow', [
      h('button.btn.icon.small.add.extra', { type: 'button', title: t('extra_add'), 'aria-label': t('extra_add'), onclick: () => open('extra') }, icon('text')),
      h('button.btn.icon.small.add.cmt', { type: 'button', title: t('comment_add'), 'aria-label': t('comment_add'), onclick: () => open('cmt') }, icon('comment')),
    ]);
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
      h('div.lft', [
        h('div.ttl', [h('span.pno', panelNo(p, panels)), ' ', tt(p)]),
        h('div.src', `${t('stand')}: ${d.updatedAt ? `${fmtDateTime(z, d.updatedAt, lang)} · ${d.updatedBy || ''}` : t('stand_none')}`),
      ]),
      h('div.rgt', [
        h('div.rrow', [
          mandatory.has(p.key) ? tag('must', t('panel_mandatory')) : null,
          p.grade === 'auto' ? tag('auto', 'AUTO') : p.grade === 'half' ? tag('half', 'LINK + EINFÜGEN') : p.grade === 'calc' ? tag('calc', 'CALC') : null,
          p.noAi ? null : aiButtons(p, d),
        ]),
        srcUrl ? h('a.srclink', { href: srcUrl, target: '_blank', rel: 'noopener', title: srcUrl }, shortUrl(srcUrl)) : null,
        addButtons(p, d),
      ]),
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
      case 'fpl': content = fplPanel(b, ctx, d, () => touched(p.key), shared?.role === 'read'); break;
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
          // Einfügepflicht (LINK + EINFÜGEN): Feld für den offiziellen Bericht bleibt immer sichtbar; sonst dient die Zusatzbox
          p.grade === 'half' ? h('div.sub.half', [h('div.lbl', t('panel_pasteSummary')), pasteArea(d.content, (v) => { Object.assign(d.content, { text: v.text, images: v.images }); touched(p.key); }, upload)]) : null,
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
    const run = async (edit) => { const btn = wrap.querySelector('button'); btn.disabled = true; btn.textContent = t('ai_working'); await askAi(p, d, b, ctx, () => touched(p.key), drawPanels, { edit }); btn.disabled = false; btn.textContent = d.ai?.text ? t('ai_again') : t('ai_ask'); btn.classList.toggle('renew', !!d.ai?.text); };
    const wrap = h('span.aibtns', [
      h('button.btn.small.ai' + (d.ai?.text ? '.renew' : ''), { type: 'button', title: t('ai_direct'), onclick: () => run(false) }, d.ai?.text ? t('ai_again') : t('ai_ask')),
      h('button.btn.small.ai.more', { type: 'button', title: t('ai_withPrompt'), 'aria-label': t('ai_withPrompt'), onclick: () => run(true) }, icon('more', 14)),
    ]);
    return wrap;
  }
  function coreBlock() {
    const rows = [
      [t('core_no'), b.no || '–'],
      [t('core_reg'), b.balloon.label], [t('core_countries'), countriesLine(b)], [t('core_date'), `${fmtDate(z, b.time.startMs, lang)}${b.flight.occasion ? ' · ' + b.flight.occasion : ''}`],
      [t('core_kind'), `${t('kind_' + b.flight.kind)} · LTF: ${b.flight.operatorName}`], [t('core_start'), `${hhmm(z, b.time.startMs)} LT (${hhmm('UTC', b.time.startMs)} UTC)`],
      [t('core_pic'), b.persons.pic], [t('core_pax'), paxLine(b, S)], [t('core_retrieve'), b.persons.retrieve || '–'],
      [t('core_site'), h('span', [placeLine(b.site), ` · ${b.site.country || ''}`])],
      [t('core_intent'), `${fmtDur(b.intent.durationMin)} · ${b.intent.altMinFt}–${b.intent.altMaxFt} ft · ${b.intent.direction || '–'}`],
      ...(docsLine(b.balloon.docs) ? [[t('docs'), docsLine(b.balloon.docs)]] : []),
      ...(docsLine(ctx.stamm?.persons?.find((x) => x.id === b.persons.picId)?.docs) ? [[`${t('docs')} PIC`, docsLine(ctx.stamm.persons.find((x) => x.id === b.persons.picId).docs)]] : []),
    ];
    const canEdit = canOwn || shared?.role === 'edit';
    // Hüllenbild rechts im Datenfenster (nicht im Panelkopf)
    const img = balloonImage(b, S) ? h('img.bimg.core-img', { src: balloonImage(b, S), alt: b.balloon.reg || '', title: b.balloon.label || '' }) : null;
    return h('div', [h('div.core-grid', [kv(rows), img]), canEdit ? h('div.row-actions', { style: { marginTop: '8px' } }, [h('button.btn', { type: 'button', onclick: async () => { b.wizardStep = 1; await saveNow(); ctx.navigate(shared ? `#/s/${shared.token}/w` : `#/new/${b.id}`); } }, [icon('edit', 16), ` ${t('masterData')}`])]) : null]);
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
    (b.meteo = b.meteo || {}).lastRefresh = { ts: Date.now(), n, total: keys.length };
    drawPanels(); ctx.autoLoad = true;
  }
  /** Über dem ersten Abschnitt: alle automatischen Panels neu laden (ohne KI-Kommentare); Status daneben. */
  function refreshRow() {
    const canEdit = canOwn || shared?.role === 'edit';
    if (!canEdit || b.site.lat == null) return null;
    const st = h('span.note.small');
    return h('div.row-actions.refresh-all', [h('button.btn.primary.small', { type: 'button', title: t('refreshAllHint'), onclick: async (e) => { const btn = e.currentTarget; btn.disabled = true; st.textContent = '…'; try { await refreshAll(st); st.textContent = `✓ ${b.meteo?.lastRefresh?.n ?? ''}/${b.meteo?.lastRefresh?.total ?? ''}`; } catch (err) { st.textContent = `✗ ${err.message}`; } btn.disabled = false; } }, [icon('refresh', 16), ` ${t('refreshAllData')}`]), st]);
  }
  function drawPanels() {
    clear(mainCol);
    const rr = refreshRow(); if (rr) mainCol.appendChild(rr);
    for (const s of SECTIONS) {
      const ps = panels.filter((p) => p.section === s.id);
      if (!ps.length) continue;
      mainCol.appendChild(h('div.sect-title', [h('span.id', s.id), h('span.nm', s[lang] || s.de)]));
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
    editionPending = true;   // Weiterarbeit nach der Freigabe = neuer Bearbeitungsstand
    toast(t('rel_done', { n: b.finalNo }));
    drawHeader();
  }

  drawHeader(); drawNav(); drawPanels();
}
