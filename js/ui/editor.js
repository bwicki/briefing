/* Fahrtbriefing — Erarbeitungssicht: Navigation, Panels, Zusatzinfo/KI/Kommentar,
 * Freigabe-Checkliste, Berechtigungen. Für Owner und Mitarbeit-Links. */
import { h, clear, toast, dialog, debounce, uid, textToNodes, lightbox } from '../util.js';
import { t, tt, getLang } from '../i18n.js';
import { setHeader, printButton } from '../app.js';
import { field, input, textarea, check, pasteArea, kv, tag } from './widgets.js';
import { sunBlock, massPerfEditor, scheduleEditor } from './parts.js';
import { SECTIONS, visiblePanels, panelFilled, mandatoryPanels, panelNo, AMC1_BOP_BAS_115, GAS_BRIEFING_EXTRA } from '../panels.js';
import { phaseOf, sunFor, equipmentSuggest, upgradeBriefing, applyLanding, balloonImage, completion, isLocked, isArchived, paxLine, countriesLine, placeLabel, hasCopilot, routeCountries, transitionItems, applicableTransitions, intentLine } from '../model.js';
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
import { profilePanel } from './profile.js';
import { icon, iconSvg } from './icons.js';
import { stageSets, startPlanOff, startPlanBriefing, startPlanSig, planStale, stageWindowsOf, STAGE_REFRESH } from '../calc/stageplan.js';
import { placeName } from '../net.js';

/** 0.12.10: Nachtrag – die Briefings-Seite setzt nach der Rückfrage ein Sitzungs-Flag; es gilt für diese Erarbeitung (Reiter) und
 * erlischt beim Verlassen (app.js). Archivierte Briefings öffnen sich nie. */
export function amendOpen(b) {
  if (!b || isArchived(b)) return false;
  try { return sessionStorage.getItem('fb.amend.' + b.id) === '1'; } catch { return false; }
}
export async function renderEditor(view, ctx, id, opts = {}) {
  const shared = ctx.shared;
  const b = opts.briefing || await ctx.store.getBriefing(id);
  if (!b) { view.appendChild(h('div.err', 'not found')); return; }
  if (!shared && b.access === 'read') { ctx.navigate(`#/v/${b.id}`); return; }   // fremdes Briefing: nur Briefingsicht
  if (isLocked(b) && !amendOpen(b)) { ctx.navigate(shared ? `#/s/${shared.token}/v` : `#/v/${b.id}`); return; }   // Start + 1 h vorbei: nur Ansicht – ausser als Nachtrag (0.12.10, Flag aus der Briefings-Seite)
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
  const touched = (panelKey, X = main) => {
    dirty = true;
    if (panelKey) { const p = X.b.panels[panelKey]; if (p) { p.updatedAt = Date.now(); p.updatedBy = ctx.who; } if (X.sid) X.plan.at = windowOf(X.sid); }
    saveSoon(); drawNav();
    if (panelKey === 'A.profile') setsSoon();   // Etappen geändert → Etappen-Briefings nachführen (0.12.5)
  };
  const touchedSoon = debounce(() => drawSide(), 1500);
  window.addEventListener('beforeunload', (e) => { if (dirty) { e.preventDefault(); e.returnValue = ''; } });

  // ---------------------------------------------------------------- Kopf
  function drawHeader() {
    const tools = [];
    // 0.12.8: beim Wechsel die aktuelle Stelle merken – die Briefingsicht öffnet dort (und umgekehrt)
    const toggle = h('div.viewtoggle', [h('button.on', { type: 'button' }, t('view_edit')), h('button', { type: 'button', onclick: () => { try { sessionStorage.setItem('fb.pos.' + b.id, activeKey || ''); } catch { /* ohne Speicher */ } ctx.navigate(shared ? `#/s/${shared.token}/v` : `#/v/${b.id}`); } }, t('view_brief'))]);
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
    setHeader({ title: `${b.no ? b.no + ' · ' : ''}${fmtDate(z, b.time.startMs, lang)} ${placeLabel(b.site)} · ${b.balloon.reg}`, sub, tools, menu });
  }

  // ---------------------------------------------------------------- Layout
  const nav = h('div.enav-wrap', h('div.enav'));
  const mainCol = h('div.emain');   // 0.12.8: eigener Rollbereich mit sichtbarem Rollbalken (≥ 900 px)
  const side = h('div.side-wrap');
  view.appendChild(h('div.editor', [h('div', nav), mainCol, h('div.side', side)]));

  const panels = visiblePanels(S, b);
  const mandatory = new Set(mandatoryPanels(S, b).map((p) => p.key));
  // Kontexte: Hauptbriefing (main) und Etappen-Briefings (0.12.5: je Etappe mit Planung ausser der ersten ein Satz B/C-Panels
  // mit der abgeleiteten Sicht der Etappe – Ort = Etappenmitte, Zeitfenster = Etappe)
  // 0.12.7: mit weiteren Etappen gilt die Planung der Startetappe nur für ihren Bereich (abgeleitete Sicht, schreibt ins Briefing durch)
  const main = { b: startPlanBriefing(b), sid: null, panels, mandatory, id: (p) => p.key };
  let sets = [], setsSig = '';
  const windowOf = (sid) => { const w = stageWindowsOf(b).find((x) => x.id === sid); return w ? { km0: w.km0, km1: w.km1, ms0: w.ms0, ms1: w.ms1 } : null; };
  function buildSets() {
    sets = stageSets(b).map((x) => ({ ...x, b: x.bs, panels: visiblePanels(S, x.bs), mandatory: new Set(mandatoryPanels(S, x.bs).map((p) => p.key)), sect: `E${x.no}`, id: (p) => `${x.sid}-${p.key}` }));
    main.b = startPlanBriefing(b);
    setsSig = sets.map((x) => `${x.sid}:${x.no}:${Math.round(x.bs.stagePlan.km0)}-${Math.round(x.bs.stagePlan.km1)}:${Math.round(x.bs.stagePlan.ms0 / 600000)}-${Math.round(x.bs.stagePlan.ms1 / 600000)}`).join('|') + (startPlanOff(b) ? '|off' : '') + '|' + startPlanSig(b);
    return setsSig;
  }
  buildSets();
  const setsSoon = debounce(() => { const old = setsSig; if (buildSets() !== old) { drawNav(); drawPanels(); } }, 1200);
  const items = () => [...panels.map((p) => ({ id: p.key, p, X: main })), ...sets.flatMap((X) => X.panels.map((p) => ({ id: X.id(p), p, X })))];
  const itemOf = (id) => items().find((it) => it.id === id);
  // 0.12.6: mit Etappen-Briefings gliedert sich die Sicht in Etappen – die Abschnitte B/C des Hauptbriefings sind «E1 · ‹Startetappe›»
  const grouped = () => sets.length > 0;
  const stage1Name = () => b.profile?.stages?.[0]?.name || t('pf_stStart');
  // 0.12.8: Panels für die ganze Fahrt (Allgemeine Lage) stehen bei Etappen-Briefings vor E1 im Abschnitt «W»
  const WHOLE = new Set(['B.synoptic']);
  const whole = (p) => grouped() && WHOLE.has(p.key);
  const sectOf = (it) => (it.X.sid ? it.X.sect : whole(it.p) ? 'W' : grouped() && (it.p.section === 'B' || it.p.section === 'C') ? 'E1' : it.p.section);
  const sectLabel = (s) => `${s.id} · ${s[lang] || s.de}`;
  // 0.12.7: mit mehreren Etappen tragen die Panels der Etappen-Briefings die Etappe in der Nummer («E1-C3»)
  const pno = (p, X) => panelNo(p, X.panels, grouped() && !whole(p) && (X.sid || p.section === 'B' || p.section === 'C') ? `E${X.sid ? X.no : 1}-` : '');

  function panelStatus(p, X = main) {
    if (panelFilled(p, X.b)) return 'ok';
    if (X.mandatory.has(p.key)) return 'must';
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
    // Gruppe in der Navigation: parts = [{ sub (Zwischentitel, optional), ps, X }]
    const navSect = (id, label, parts, cls = '') => {
      const det = h('details' + cls, { 'data-sect': id }, [h('summary', label)]);
      det.addEventListener('toggle', () => { if (det.dataset.auto) { delete det.dataset.auto; return; } if (det.open) { navOpen.add(id); if (closedActive === id) closedActive = null; } else { navOpen.delete(id); if (id === activeSect) closedActive = id; } });
      for (const part of parts) {
        if (part.sub) det.appendChild(h('div.subhead', part.sub));
        for (const p of part.ps) { const key = part.X.id(p); det.appendChild(h('div.it', { 'data-key': key, onclick: () => { setActive(key); document.getElementById('panel-' + key)?.scrollIntoView({ behavior: 'smooth', block: 'start' }); } }, [h('span.dot.' + panelStatus(p, part.X)), h('span.pno', pno(p, part.X)), h('span.nm', [tt(p), part.X.mandatory.has(p.key) ? h('span.tag.must', { style: { marginLeft: '6px' } }, '!') : null])])); }
      }
      e.appendChild(det);
    };
    const bySect = (X) => SECTIONS.filter((s) => s.id === 'B' || s.id === 'C').map((s) => ({ sub: sectLabel(s), ps: X.panels.filter((p) => p.section === s.id && !whole(p)), X })).filter((x) => x.ps.length);
    for (const s of SECTIONS) {
      const ps = panels.filter((p) => p.section === s.id);
      if (grouped() && s.id === 'B') { const wp = ps.filter(whole); if (wp.length) navSect('W', t('sp_whole'), [{ ps: wp, X: main }]); navSect('E1', t('sp_nav', { n: 1, name: stage1Name() }), bySect(main), '.stage'); continue; }   // E1 = Abschnitte B/C des Hauptbriefings
      if (grouped() && s.id === 'C') { for (const X of sets) navSect(X.sect, t('sp_nav', { n: X.no, name: X.name }), bySect(X), '.stage'); continue; }   // weitere Etappen-Briefings
      if (ps.length) navSect(s.id, sectLabel(s), [{ ps, X: main }]);
    }
    e.appendChild(h('div.legend', ['ok', 'auto', 'man', 'must'].map((k) => h('span', [h('span.dot.' + k), t('navLeg_' + k)]))));   // 0.12.8: Legende mit eingefärbten Punkten
    applyNavOpen();
    updateMustBtn();
    drawSide();
  }
  function setActive(key) {
    const it = itemOf(key); if (!it) return;
    const sect = sectOf(it);
    if (sect !== activeSect) { activeSect = sect; closedActive = null; }
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
  mainCol.addEventListener('scroll', onScroll, { passive: true });
  mainCol.addEventListener('focusin', (e) => { const el = e.target.closest('.panel'); if (el) setActive(el.id.replace(/^panel-/, '')); });
  // Grafiken, Bilder und Datentabellen: Klick öffnet die vergrösserte Ansicht (wie in der Briefingsicht; Eingabefelder, Karten und Symbole ausgenommen)
  mainCol.addEventListener('click', (e) => {
    if (e.target.closest('a, button, input, textarea, select, label, .leaflet-container, .lvl-pick, .no-lb')) return;
    const el = e.target.closest('svg:not(.ico), img.pimg, table.auto, table.dwd');
    if (!el || !mainCol.contains(el)) return;
    const head = el.closest('.panel')?.querySelector('.panel-head .ttl');
    lightbox(el, head ? head.textContent.replace(/\s+/g, ' ').trim().slice(0, 80) : '');
  });
  function drawSide() {
    clear(side);
    const hrs = Math.round((b.time.startMs - Date.now()) / 3600000);
    const ch = changesSinceFinal(b);
    // 0.12.8: Reihenfolge Planungshorizont · Grunddaten · Einschätzung (Modellsicht) · Zusammenfassung; ohne «Panels» und «Protokoll»
    const canEdit = canOwn || shared?.role === 'edit';
    const nvfr = h('input', { type: 'checkbox', checked: !!b.flight.nvfr, disabled: !canEdit, onchange: () => { b.flight.nvfr = nvfr.checked; touched(); drawPanels(); } });
    const basics = h('div.card.basics', [h('div.card-head', h('div.section-title', t('side_basics'))), h('div.card-body', h('div.kv.small', [
      [t('core_date'), `${fmtDate(z, b.time.startMs, lang)} ${hhmm(z, b.time.startMs)} LT`], [t('site'), placeLabel(b.site)], [t('core_reg'), b.balloon.reg || b.balloon.label || '–'], [t('intent_dur'), fmtDur(b.intent.durationMin)],
      [t('core_landing'), b.landing?.lat != null ? placeLabel(b.landing) : '–'], [t('side_rules'), h('label.inline', [h('span', 'VFR'), ' ', nvfr, ' NVFR'])],
    ].map(([k, v]) => [h('div.k', k), h('div.v', v)])))]);
    side.append(...[
      h('div.card', [h('div.card-head', h('div.section-title', t('horizon'))), h('div.card-body', [h('div', `${fmtDate(z, b.time.startMs, lang)} ${hhmm(z, b.time.startMs)} LT · ${hhmm('UTC', b.time.startMs)} UTC`), h('div.note', `${hrs >= 0 ? '+' : ''}${hrs} h → ${t('phase_' + phaseOf(b.time.startMs))}`)])]),
      basics,
      ch ? h('div.card', [h('div.card-head', h('div.section-title', t('chg_title', { n: ch.since.no }))), h('div.card-body.note', ch.any ? [ch.fields.length ? h('div', `${t('chg_fields')}: ${ch.fields.map((f) => t('chg_' + f)).join(', ')}`) : null, ...ch.panels.map((p) => h('div', { onclick: () => document.getElementById('panel-' + p.key)?.scrollIntoView({ behavior: 'smooth' }), style: { cursor: 'pointer' } }, `• ${tt(panelByKey(p.key) || { de: p.key })} (${p.what.map((w) => t('chg_' + w)).join(', ')})`))] : t('chg_none'))]) : null,
      goNoGoCard(b, ctx),
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
  function extraBox(p, d, X = main) {
    return h('div.sub.extra', [h('div.lbl', t('extra')), pasteArea(d.extra, (v) => { d.extra = v; touched(p.key, X); }, upload, { placeholder: t('extraHint'), rows: 2 })]);
  }
  function commentBox(p, d, X = main) {
    const ro = shared?.role === 'read';
    return h('div.sub.cmt', [h('div.lbl', t('comment')), textarea(d.comment, { rows: 2, readOnly: ro, placeholder: t('comment'), oninput: (e) => { d.comment = e.target.value; touched(p.key, X); } })]);
  }
  function subBlocks(p, X = main) {
    const d = X.b.panels[p.key];
    const hasExtra = !!((d.extra?.text || '').trim() || (d.extra?.images || []).length);
    const extra = hasExtra || openBoxes.has(X.id(p) + ':extra') ? extraBox(p, d, X) : null;
    // KI-Kommentar direkt unter dem Panelinhalt: Text (Klick auf ✎ zum Bearbeiten), ✕ verwirft
    let ai = null;
    if (d.ai?.text) {
      const ro = shared?.role === 'read';
      const txt = h('div.ai-text', d.ai.text);
      const ed = textarea(d.ai.text, { rows: 4, oninput: (e) => { d.ai.text = e.target.value; d.ai.edited = true; txt.textContent = e.target.value; touched(p.key, X); } }); ed.hidden = true;
      ai = h('div.sub.ai', [h('div.row-actions', [h('span.lbl', [icon('ai', 14), ` ${t('ai')} · ${d.ai.model || ''} · ${d.ai.ts ? fmtDateTime(z, d.ai.ts, lang) : ''}${d.ai.edited ? ' · ' + t('ai_edited') : ''}`]), ro ? null : h('button.btn.icon', { type: 'button', title: t('ai_edit'), onclick: () => { ed.hidden = !ed.hidden; txt.hidden = !ed.hidden; if (!ed.hidden) ed.focus(); } }, icon('edit')), ro ? null : h('button.btn.icon', { type: 'button', title: t('ai_discard'), onclick: () => { d.ai = null; touched(p.key, X); drawPanels(); } }, icon('close'))]), txt, ed]);
    }
    const comment = (d.comment || '').trim() || openBoxes.has(X.id(p) + ':cmt') ? commentBox(p, d, X) : null;
    return [extra, ai, comment];
  }
  /** Symbolknöpfe im Panelkopf: 📝 Eigener Text/Bilder/Daten · 💬 Kommentar PIC – fügen die Box unter dem Inhalt an und setzen den Fokus. */
  function addButtons(p, d, X = main) {
    if (shared?.role === 'read') return null;
    const open = (kind) => {
      const body = document.getElementById('panel-' + X.id(p))?.querySelector('.panel-body'); if (!body) return;
      let box = body.querySelector(kind === 'extra' ? ':scope > .sub.extra' : ':scope > .sub.cmt');
      if (!box) {
        openBoxes.add(`${X.id(p)}:${kind}`);
        box = kind === 'extra' ? extraBox(p, d, X) : commentBox(p, d, X);
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
  function renderPanel(p, X = main) {
    const bb = X.b;   // Hauptbriefing oder abgeleitete Sicht der Etappe
    const d = bb.panels[p.key] || (bb.panels[p.key] = { content: {}, extra: { text: '', images: [] }, ai: null, comment: '' });
    const srcUrl = sourceUrlOf(p, d);
    const head = h('div.panel-head', [
      h('div.lft', [
        h('div.ttl', [h('span.pno', pno(p, X)), ' ', tt(p)]),
        h('div.src', `${t('stand')}: ${d.updatedAt ? `${fmtDateTime(z, d.updatedAt, lang)} · ${d.updatedBy || ''}` : t('stand_none')}`),
      ]),
      h('div.rgt', [
        h('div.rrow', [
          X.mandatory.has(p.key) ? tag('must', t('panel_mandatory')) : null,
          p.grade === 'auto' ? tag('auto', 'AUTO') : p.grade === 'half' ? tag('half', 'LINK + EINFÜGEN') : p.grade === 'calc' ? tag('calc', 'CALC') : null,
          p.noAi ? null : aiButtons(p, d, X),
        ]),
        srcUrl ? h('a.srclink', { href: srcUrl, target: '_blank', rel: 'noopener', title: srcUrl }, shortUrl(srcUrl)) : null,
        addButtons(p, d, X),
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
        content = textarea(d.content.text || '', { rows: 2, oninput: (e) => { d.content.text = e.target.value; touched(p.key, X); } });
        break;
      }
      case 'fpl': content = fplPanel(b, ctx, d, () => touched(p.key), shared?.role === 'read'); break;
      case 'profile': content = profilePanel(b, ctx, { onChange: () => touched(p.key), readOnly: shared?.role === 'read' }); break;
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
          autoBlock(p, d, bb, ctx, { onChange: () => touched(p.key, X), readOnly: shared?.role === 'read', upload }),
          // Einfügepflicht (LINK + EINFÜGEN): Feld für den offiziellen Bericht bleibt immer sichtbar; sonst dient die Zusatzbox
          p.grade === 'half' ? h('div.sub.half', [h('div.lbl', t('panel_pasteSummary')), pasteArea(d.content, (v) => { Object.assign(d.content, { text: v.text, images: v.images }); touched(p.key, X); }, upload)]) : null,
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
    body.append(content, ...subBlocks(p, X).filter(Boolean));
    return h('div.panel' + (panelStatus(p, X) === 'must' ? '.must-open' : ''), { id: 'panel-' + X.id(p) }, [head, body]);
  }
  /** «KI-Kommentar» (direkt) und «…» (mit Prompt-Maske) im Titelbalken – Server-Modus mit KI-Freigabe. */
  function aiButtons(p, d, X = main) {
    if (ctx.store.mode !== 'remote' || !ctx.can('ai') || shared?.role === 'read') return null;
    const hasContent = !!(d.content?.auto || (d.content?.text || '').trim() || (d.content?.images || []).length || (d.extra?.text || '').trim() || (d.extra?.images || []).length || ['core', 'sun', 'massperf', 'schedule', 'equipment', 'transition'].includes(p.kind));
    if (!hasContent) return null;
    const run = async (edit) => { const btn = wrap.querySelector('button'); btn.disabled = true; btn.textContent = t('ai_working'); await askAi(p, d, X.b, ctx, () => touched(p.key, X), drawPanels, { edit }); btn.disabled = false; btn.textContent = d.ai?.text ? t('ai_again') : t('ai_ask'); btn.classList.toggle('renew', !!d.ai?.text); };
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
      [t('core_pic'), b.persons.pic], ...(hasCopilot(b) ? [[t('copilot'), b.persons.copilot]] : []), [t('core_pax'), paxLine(b, S)], [t('core_retrieve'), b.persons.retrieve || '–'],
      [t('core_site'), placeLine(b.site)],
      [t('core_landing'), b.landing?.lat != null ? placeLine(b.landing) : '–'],   // 0.12.8: Landeort (geplant) in gleicher Gliederung wie der Startort
      [t('core_intent'), intentLine(b, t, z, { lang })],
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
    // Gasballon: Druckerhöhung und Heli-Bergung gibt es nicht (0.12.4)
    const items = S.equipmentItems.filter((it) => b.balloon?.type !== 'gas' || !['pressurisation', 'heli'].includes(it));
    for (const it of items) box.appendChild(check(t('eq_' + it), sel.has(it), (on) => { if (on) sel.add(it); else sel.delete(it); if (it === 'none' && on) { S.equipmentItems.filter((x) => x !== 'none').forEach((x) => sel.delete(x)); } else if (on) sel.delete('none'); d.content.items = [...sel]; box.querySelectorAll('input').forEach((c, i) => { c.checked = sel.has(S.equipmentItems[i]); }); touched(p.key); }));
    return h('div', [box, sugg.length ? h('div.note', t('eq_suggest', { s: sugg.map((x) => t('eq_' + x)).join(', ') })) : null]);
  }
  /** Übergangshöhen (0.12.6): die für die Fahrt anwendbaren sind automatisch angeklickt (Länder der Fahrt); Handänderung bleibt, bis «automatisch» gewählt wird. */
  function transitionBlock(p, d) {
    const box = h('div'), wrap = h('div');
    const draw = () => {
      clear(box);
      const sel = new Set(transitionItems(b, S)); d.content.items = [...sel];
      for (const ta of S.transitionAltitudes) box.appendChild(check(ta.label, sel.has(ta.id), (on) => { if (on) sel.add(ta.id); else sel.delete(ta.id); d.content.items = [...sel]; d.content.manual = true; touched(p.key); draw(); }));
      const cc = [...routeCountries(b)].join(', ');
      box.appendChild(h('div.row-actions', [h('span.note', d.content.manual ? t('tr_manual') : t('tr_auto', { c: cc || '–' })), d.content.manual ? h('button.btn.small', { type: 'button', onclick: () => { d.content.manual = false; touched(p.key); draw(); } }, t('tr_resetAuto')) : null]));
    };
    draw();
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
    let n = 0, total = keys.length;
    ctx.autoLoad = false;
    const res = await refreshAllData(ctx, b, keys, (k, st, e) => { if (statusEl) statusEl.textContent = `${k} ${st === 'loading' ? '…' : st === 'ok' ? '✓' : '✗ ' + (e?.message || '')}`; });
    for (const [k, snap] of Object.entries(res)) { if (!snap.error) { b.panels[k].content = { ...(b.panels[k].content || {}), auto: snap }; touched(k); n++; } }
    // Etappen-Briefings (0.12.5): dieselben Modell-/Meldungspanels je Etappe
    for (const X of sets) {
      const ks = X.panels.filter((p) => p.kind === 'auto' && (STAGE_REFRESH.includes(p.auto) || (p.auto === 'fwp' && X.bs.site.country === 'DE'))).map((p) => p.key);
      total += ks.length;
      const r2 = await refreshAllData(ctx, X.bs, ks, (k, st, e) => { if (statusEl) statusEl.textContent = `${X.sect} ${k} ${st === 'loading' ? '…' : st === 'ok' ? '✓' : '✗ ' + (e?.message || '')}`; });
      for (const [k, snap] of Object.entries(r2)) { if (!snap.error) { X.bs.panels[k].content = { ...(X.bs.panels[k].content || {}), auto: snap }; touched(k, X); n++; } }
    }
    (b.meteo = b.meteo || {}).lastRefresh = { ts: Date.now(), n, total };
    drawPanels(); ctx.autoLoad = true;
  }
  /** Über dem ersten Abschnitt, bleibt beim Rollen unter der Kopfzeile stehen: alle automatischen Panels neu laden (ohne KI-Kommentare)
   *  mit Status daneben, und «Pflichtinhalte ergänzen» – springt zum nächsten noch leeren Pflicht-Panel (zyklisch ab dem aktiven). */
  let mustBtn = null;
  const openMandatory = () => items().filter((it) => panelStatus(it.p, it.X) === 'must');
  function updateMustBtn() {
    if (!mustBtn) return;
    const n = openMandatory().length;
    mustBtn.disabled = !n; mustBtn.classList.toggle('done', !n);
    clear(mustBtn); mustBtn.append(icon(n ? 'edit' : 'check', 16), ` ${n ? `${t('fillMandatory')} (${n})` : t('fillMandatoryDone')}`);
  }
  function jumpMandatory() {
    const open = openMandatory(); if (!open.length) return;
    const i = open.findIndex((it) => it.id === activeKey);
    const next = open[(i + 1) % open.length];
    setActive(next.id);
    document.getElementById('panel-' + next.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  function refreshRow() {
    const canEdit = canOwn || shared?.role === 'edit';
    if (!canEdit) return null;
    const st = h('span.note.small');
    mustBtn = h('button.btn.small.must-btn', { type: 'button', title: t('fillMandatoryHint'), onclick: jumpMandatory });
    updateMustBtn();
    // 0.12.6: Etappen-Knöpfe (E1 · Start, E3 · Nacht …) springen zum Etappenkopf
    const stageBtns = grouped() ? [{ sect: 'E1', no: 1, name: stage1Name() }, ...sets].map((X) => h('button.btn.small.stage-btn', { type: 'button', title: t('sp_jump'), onclick: () => { document.getElementById('sect-' + X.sect)?.scrollIntoView({ behavior: 'smooth', block: 'start' }); activeSect = X.sect; closedActive = null; applyNavOpen(); } }, t('sp_nav', { n: X.no, name: X.name }))) : [];
    return h('div.row-actions.refresh-all', [
      b.site.lat != null ? h('button.btn.small', { type: 'button', title: t('refreshAllHint'), onclick: async (e) => { const btn = e.currentTarget; btn.disabled = true; st.textContent = '…'; try { await refreshAll(st); st.textContent = `✓ ${b.meteo?.lastRefresh?.n ?? ''}/${b.meteo?.lastRefresh?.total ?? ''}`; } catch (err) { st.textContent = `✗ ${err.message}`; } btn.disabled = false; } }, [icon('refresh', 16), ` ${t('refreshAllData')}`]) : null,
      mustBtn, ...stageBtns, st,
    ]);
  }
  function drawPanels() {
    clear(mainCol);
    const rr = refreshRow(); if (rr) mainCol.appendChild(rr);
    const g = grouped();
    for (const s of SECTIONS) {
      const ps = panels.filter((p) => p.section === s.id);
      if (ps.length) {
        // 0.12.6: mit Etappen-Briefings steht über B der Etappenkopf «E1 · Etappe 1 · ‹Start›» (Startort, ganze Fahrt); B/C werden Untertitel
        if (g && s.id === 'B') for (const p of ps.filter(whole)) { if (p === ps.filter(whole)[0]) mainCol.appendChild(h('div.sect-title', { id: 'sect-W' }, [h('span.id', 'B'), h('span.nm', t('sp_whole'))])); mainCol.appendChild(renderPanel(p)); }   // 0.12.8: Allgemeine Lage vor der Startetappe
        if (g && s.id === 'B') { mainCol.appendChild(h('div.sect-title.stage', { id: 'sect-E1' }, [h('span.id', 'E1'), h('span.nm', t('sp_title', { n: 1, name: stage1Name() }))])); const sp1 = main.b.stagePlan; mainCol.appendChild(h('div.sect-sub', sp1 ? t('sp_subStart1', { site: placeLabel(b.site), d: fmtDate(z, sp1.ms0, lang), t0: hhmm(z, sp1.ms0), t1: hhmm(z, sp1.ms1), tz: 'LT', k1: Math.round(sp1.km1), len: Math.round(sp1.lenKm), b: sp1.to.name }) : t('sp_subStart', { site: placeLabel(b.site), d: fmtDate(z, b.time.startMs, lang), t0: hhmm(z, b.time.startMs), t1: hhmm(z, b.time.startMs + (b.intent.durationMin || 0) * 60000), tz: 'LT' }))); }
        mainCol.appendChild(h('div.sect-title' + (g && (s.id === 'B' || s.id === 'C') ? '.sub' : ''), [h('span.id', s.id), h('span.nm', s[lang] || s.de)]));
        if (s.id === 'B' && b.site.lat != null) mainCol.appendChild(meteoBar(b, ctx, { onChange: () => { dirty = true; saveSoon(); }, refreshAll, readOnly: shared?.role === 'read' }));
        if (s.id === 'B' && startPlanOff(b)) mainCol.appendChild(h('div.sect-sub', h('span.warn', t('sp_startOff'))));
        for (const p of ps) if (!whole(p)) mainCol.appendChild(renderPanel(p));
      }
      if (s.id === 'C') for (const X of sets) renderStageSet(X);   // Etappen-Briefings zwischen C und D (0.12.5)
    }
  }
  /** Abschnitt «E2 · Etappe 2 · Name» mit Zeitfenster/Ort und den B/C-Panels der Etappe (Untertitel B und C, 0.12.6). */
  function renderStageSet(X) {
    const sp = X.bs.stagePlan;
    mainCol.appendChild(h('div.sect-title.stage', { id: 'sect-' + X.sect }, [h('span.id', X.sect), h('span.nm', t('sp_title', { n: X.no, name: X.name || '–' }))]));
    const sub = h('div.sect-sub', { title: t('sp_hint') });
    const line = () => `${t('sp_sub', { d: fmtDate(z, sp.ms0, lang), t0: hhmm(z, sp.ms0), t1: hhmm(z, sp.ms1), tz: 'LT', k0: Math.round(sp.km0), k1: Math.round(sp.km1), len: Math.round(sp.lenKm), a: sp.from.name, b: sp.to.name, mid: sp.mid.name })}`;
    const txt = h('span', line());
    sub.append(txt, planStale(X.plan.at, windowOf(X.sid)) ? h('span.warn', `⚠ ${t('sp_stale')}`) : null);
    mainCol.appendChild(sub);
    // Ortsnamen der Etappe (Nominatim) nachtragen, einmal je Etappe gespeichert
    const want = [['fromName', sp.from], ['midName', sp.mid], ['toName', sp.to]].filter(([k]) => !X.plan[k]);
    if (want.length && b.site.lat != null) Promise.all(want.map(([k, q]) => placeName(q.lat, q.lon, b.site.country, lang).then((nm) => { if (nm) { X.plan[k] = nm; q.name = nm; if (k === 'midName') X.bs.site.name = nm; if (k === 'toName') X.bs.landing.name = nm; } }))).then(() => { if (sub.isConnected) { txt.textContent = line(); dirty = true; saveSoon(); } });
    let lastSect = null;
    for (const p of X.panels) {
      if (p.section !== lastSect) { const s = SECTIONS.find((x) => x.id === p.section); mainCol.appendChild(h('div.sect-title.sub', [h('span.id', s.id), h('span.nm', s[lang] || s.de)])); lastSect = p.section; }
      mainCol.appendChild(renderPanel(p, X));
    }
  }
  document.addEventListener('fb:ai', () => drawNav());

  // ---------------------------------------------------------------- Freigabe
  async function release() {
    // Pflicht-Panels des Hauptbriefings und der Etappen-Briefings (0.12.5)
    const missing = [...mandatoryPanels(S, b).filter((p) => !panelFilled(p, b)).map((p) => tt(p)), ...sets.flatMap((X) => mandatoryPanels(S, X.bs).filter((p) => !panelFilled(p, X.bs)).map((p) => `${X.sect} · ${tt(p)}`))];
    const reason = textarea('', { rows: 2, placeholder: t('rel_reason') });
    const ch = changesSinceFinal(b);
    const content = h('div', [
      missing.length ? h('div', [h('div.warn', t('rel_missing')), h('ul', missing.map((x) => h('li', x))), h('div.lbl', t('rel_force')), reason]) : h('div.ok', t('rel_ok')),
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
  // 0.12.8: aus der Briefingsicht gemerkte Stelle wieder anzeigen
  try { const pos = sessionStorage.getItem('fb.pos.' + b.id); sessionStorage.removeItem('fb.pos.' + b.id); if (pos) setTimeout(() => { const el = document.getElementById('panel-' + pos); if (el) { el.scrollIntoView({ block: 'start' }); setActive(pos); } }, 80); } catch { /* ohne Speicher */ }
}
