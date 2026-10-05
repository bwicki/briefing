/* Fahrtbriefing — Phase 3: Kalendereintrag (ICS), Crew-Nachricht, Gesamteinschätzung
 * (KI), Pax-Sicherheitskarte, Export, Final-PDF. */
import { h, clear, toast, dialog, uid } from '../util.js';
import { t, tt, getLang } from '../i18n.js';
import { setHeader, printButton } from '../app.js';
import { textarea, field, check } from './widgets.js';
import { placeLine, mapsUrl } from './place.js';
import { sunFor, scheduleFor, upgradeBriefing, scheduleRowLabel, balloonImage, titleLine, lastChangeLine, fileBase } from '../model.js';
import { qrSvg } from './access.js';
import { hhmm, fmtDate, fmtDateTime, fmtDur } from '../calc/time.js';
import { goNoGo } from '../calc/gonogo.js';
import { flightContext, aiHint } from '../auto/ai.js';
import { visiblePanels, AMC1_BOP_BAS_115, GAS_BRIEFING_EXTRA } from '../panels.js';

const z = (b) => b.site.tz || 'Europe/Zurich';

// ---------------------------------------------------------------- ICS
const icsDate = (ms) => new Date(ms).toISOString().replace(/[-:]/g, '').slice(0, 15) + 'Z';
const icsEsc = (s) => String(s || '').replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/[,;]/g, (m) => '\\' + m);

/** Ein Termin: Abfahrt Treffpunkt bis Rückkehr, mit Zeitplan im Beschrieb. */
export function icsFor(b, ctx, opts = {}) {
  const sun = sunFor(b, ctx.settings, ctx.racTable);
  const { rows } = scheduleFor(b, sun);
  const first = rows[0]?.ms ?? b.time.startMs, last = rows[rows.length - 1]?.ms ?? b.time.startMs + 4 * 3600000;
  const zz = z(b), lang = getLang();
  const lines = rows.map((r) => `${hhmm(zz, r.ms)} ${scheduleRowLabel(r, b, t, ctx.settings.activities?.custom)}`);
  const sc = b.schedule;
  const loc = sc.meetingLat != null ? `${sc.meetingName} (${sc.meetingLat.toFixed(5)}, ${sc.meetingLon.toFixed(5)})` : sc.meetingName || b.site.name;
  const desc = [`${t('appName')} ${fmtDate(zz, b.time.startMs, lang)} · ${b.site.name} · ${b.balloon.label}`, `PIC ${b.persons.pic}${b.persons.retrieve ? ` · ${t('retrieve')} ${b.persons.retrieve}` : ''}`, '', ...lines, '', sc.meetingLat != null ? `${t('meeting')}: ${mapsUrl(sc.meetingLat, sc.meetingLon)}` : '', b.site.lat != null ? `${t('site')}: ${mapsUrl(b.site.lat, b.site.lon)}` : '', opts.link ? `Briefing: ${opts.link}` : ''].filter((x) => x !== null).join('\n');
  const now = icsDate(Date.now());
  return ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Wicki Aero//Fahrtbriefing//DE', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', 'BEGIN:VEVENT',
    `UID:briefing-${b.id}@briefing.wicki.aero`, `DTSTAMP:${now}`, `DTSTART:${icsDate(first)}`, `DTEND:${icsDate(last)}`,
    `SUMMARY:${icsEsc(`${t('ics_title')} ${b.site.name} · ${b.balloon.reg}`)}`, `LOCATION:${icsEsc(loc)}`, `DESCRIPTION:${icsEsc(desc)}`,
    b.site.lat != null ? `GEO:${b.site.lat.toFixed(5)};${b.site.lon.toFixed(5)}` : '', `URL:${opts.link || location.origin + location.pathname}`,
    'BEGIN:VALARM', 'TRIGGER:-PT12H', 'ACTION:DISPLAY', `DESCRIPTION:${icsEsc(t('ics_title'))}`, 'END:VALARM', 'END:VEVENT', 'END:VCALENDAR'].filter(Boolean).join('\r\n');
}
export function downloadText(name, text, mime = 'text/plain') {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type: mime })); a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

// ---------------------------------------------------------------- Crew-Nachricht
export function crewMessage(b, ctx, link) {
  const sun = sunFor(b, ctx.settings, ctx.racTable);
  const { rows } = scheduleFor(b, sun);
  const zz = z(b), lang = getLang(), sc = b.schedule;
  const L = lang === 'en';
  const lines = [
    `${L ? 'Balloon flight' : 'Ballonfahrt'} ${fmtDate(zz, b.time.startMs, lang)} – ${b.site.name} (${b.site.icao})`,
    `${b.balloon.label} · PIC ${b.persons.pic}${b.persons.retrieve ? ` · ${t('retrieve')} ${b.persons.retrieve}` : ''} · ${b.persons.pax.length} Pax`,
    '',
    ...rows.map((r) => `${hhmm(zz, r.ms)}  ${scheduleRowLabel(r, b, t, ctx.settings.activities?.custom)}`),
    '',
    ...rows.filter((r) => r.place?.lat != null).map((r) => `${r.type === 'meet' ? t('meeting') : t('act_' + r.type)} ${r.name || r.place.name || ''}: ${mapsUrl(r.place.lat, r.place.lon)}`),
    b.site.lat != null ? `${t('site')}: ${mapsUrl(b.site.lat, b.site.lon)}` : '',
    sun ? `BCMT ${hhmm(zz, sun.official.bcmt)} · SR ${hhmm(zz, sun.official.sr)} · SS ${hhmm(zz, sun.official.ss)} · ECET ${hhmm(zz, sun.official.ecet)}` : '',
    link ? `Briefing: ${link}` : '',
    '', L ? 'Weather permitting – confirmation the evening before.' : 'Wetterabhängig – Bestätigung am Vorabend.',
  ].filter((x) => x !== null);
  return lines.join('\n');
}

export async function crewDialog(b, ctx) {
  let link = '';
  if (ctx.store.mode === 'remote' && !ctx.shared) {
    try { const links = await ctx.store.listAccess(b.id); const l = links.find((x) => x.role === 'read') || links[0]; if (l) link = `${location.origin}${location.pathname}#/s/${l.token}`; } catch { /* ohne Link */ }
  }
  const txt = textarea(crewMessage(b, ctx, link), { rows: 14 });
  const subject = `${t('ics_title')} ${fmtDate(z(b), b.time.startMs, getLang())} ${b.site.name}`;
  const content = h('div', [h('div.note', t('crew_hint')), txt, h('div.row-actions', { style: { marginTop: '8px' } }, [
    h('button.btn', { type: 'button', onclick: () => navigator.clipboard.writeText(txt.value).then(() => toast(t('copied'))) }, t('copy')),
    h('a.btn', { href: '#', onclick: (e) => { e.preventDefault(); window.open(`https://wa.me/?text=${encodeURIComponent(txt.value)}`, '_blank', 'noopener'); } }, t('ac_whatsapp')),
    h('a.btn', { href: '#', onclick: (e) => { e.preventDefault(); location.href = `mailto:${encodeURIComponent(crewEmails(b, ctx))}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(txt.value)}`; } }, t('ac_mail')),
    h('button.btn', { type: 'button', onclick: () => downloadText(`${fileBase(b)}.ics`, icsFor(b, ctx, { link }), 'text/calendar') }, t('ics_download')),
  ])]);
  await dialog(t('crew_title'), content, [{ label: t('close'), primary: true }], { cls: 'wide' });
}
function crewEmails(b, ctx) {
  const P = (ctx.stamm || ctx.settings).persons || [];
  const ids = [b.persons.picId, b.persons.retrieveId];
  return P.filter((p) => ids.includes(p.id) && p.email).map((p) => p.email).join(',');
}

// ---------------------------------------------------------------- Gesamteinschätzung (KI)
export function assessmentPrompt(b, ctx) {
  const lang = getLang();
  const gn = goNoGo(b, ctx.settings);
  const parts = [lang === 'en' ? 'OVERALL ASSESSMENT REQUESTED.' : 'GESAMTEINSCHÄTZUNG ERBETEN.', '', 'FAHRTKONTEXT:', flightContext(b, ctx), ''];
  if (gn.level != null) parts.push(`AMPEL (Modell ${gn.model || ''}, ${gn.hours} h im Fenster): ${['nein', 'grenzwertig', 'fahrbar'][gn.level]}${gn.reasons.length ? ' – ' + gn.reasons.join('; ') : ''}`, '');
  for (const p of visiblePanels(ctx.settings, b)) {
    const d = b.panels[p.key]; if (!d) continue;
    const bits = [];
    if (d.content?.auto?.text) bits.push(d.content.auto.text.slice(0, 2500));
    if (d.content?.text) bits.push(d.content.text.slice(0, 2000));
    if (d.extra?.text) bits.push(`Zusatz: ${d.extra.text.slice(0, 800)}`);
    if (d.ai?.text) bits.push(`KI-Hinweis: ${d.ai.text}`);
    if (d.comment) bits.push(`Kommentar: ${d.comment}`);
    if (bits.length) parts.push(`## ${p.key} ${tt(p)}`, ...bits, '');
  }
  parts.push(lang === 'en'
    ? 'Write 6–10 terse lines: overall picture, the two or three decisive factors with numbers and times (LT), open points to check before launch, and a tendency (flyable / marginal / no) with reasoning – explicitly not a launch decision.'
    : 'Schreib 6–10 knappe Zeilen: Gesamtbild, die zwei bis drei entscheidenden Faktoren mit Zahlen und Zeiten (LT), offene Punkte vor dem Start, und eine Tendenz (fahrbar / grenzwertig / nein) mit Begründung – ausdrücklich kein Startentscheid.');
  const system = lang === 'en'
    ? 'You are a meteorologist and balloon flight instructor. You receive a complete flight briefing (context, model data, official products, pilot notes). Answer in English, terse, numbers with units and LT times, as a short list with "–". No filler. The pilot decides.'
    : 'Du bist Meteorologe und Ballonfahrt-Ausbilder. Du bekommst ein vollständiges Fahrtbriefing (Kontext, Modelldaten, amtliche Produkte, Pilotennotizen). Antworte auf Deutsch (Schweiz, kein ß), knapp, Zahlen mit Einheit und LT-Zeiten, als kurze Liste mit «–». Keine Floskeln. Der Pilot entscheidet.';
  return { system, user: parts.join('\n') };
}
export async function assessmentDialog(b, ctx, onChange) {
  if (ctx.store.mode !== 'remote') { toast(t('ac_localOnly')); return; }
  const pr = assessmentPrompt(b, ctx);
  const edit = textarea(pr.user, { rows: 10 });
  const ok = await dialog(t('ass_title'), h('div', [h('div.note', t('ai_hint')), edit]), [{ label: t('cancel'), value: false }, { label: t('ai_send'), value: true, primary: true }], { cls: 'wide' });
  if (!ok) return;
  toast(t('loading'));
  try {
    const res = await aiHint(ctx, b, { system: pr.system, prompt: edit.value, images: [], model: ctx.settings.aiModel });
    b.assessment = { text: res.text, model: res.model, ts: Date.now(), who: ctx.who };
    onChange(); toast(t('ok'));
  } catch (e) { toast(`${t('error')}: ${e.message}`); }
}

// ---------------------------------------------------------------- Go/No-Go-Karte
export function goNoGoCard(b, ctx) {
  const g = goNoGo(b, ctx.settings);
  const cls = g.level == null ? '' : ['neg', 'half', 'pos'][g.level];
  return h('div.card.gonogo', [h('div.card-head', h('div.section-title', t('gn_title'))), h('div.card-body', [
    h('div.gn-level', [h('span.dot.' + (g.level == null ? 'man' : ['must', 'auto', 'ok'][g.level])), ' ', h('b', g.level == null ? t('gn_nodata') : t('fly_' + g.level))]),
    g.reasons.length ? h('ul.gn-why', g.reasons.map((r) => h('li', r))) : null,
    g.level != null ? h('div.note', `${g.model || ''} · ${g.hours} h · ${t('auto_wind')} max ${g.maxWindKt} kt / ${t('auto_gust')} ${g.maxGustKt} kt · ${t('gn_disclaimer')}`) : h('div.note', t('gn_hint')),
  ])]);
}

// ---------------------------------------------------------------- Pax-Sicherheitskarte (#/pax/:id)
/** Titel der Passagierkarte: Experte-Einstellung (DE/EN) oder Standard. */
export const paxCardTitle = (S) => { const lang = getLang(); return (S.paxCardTitle?.[lang] || S.paxCardTitle?.de || '').trim() || t('pax_title'); };

/** Druckauswahl: nur Briefing, zusätzlich DABS-Beilage, NOTAM, Passagierkarte → Briefingsicht mit ?print=1&parts=… */
export async function printDialog(b, ctx, shared, onApply) {
  const d = b.panels || {};
  const hasDabs = !!(d['C.dabs']?.content?.auto?.images?.length);
  const hasNotam = !!(d['C.notam']?.content?.auto || (d['C.notam']?.content?.text || '').trim() || (d['C.notam']?.content?.images || []).length);
  const sel = { dabs: hasDabs, notam: hasNotam, pax: false };
  const body = h('div', [
    h('div.note', t('print_hint')),
    check(t('print_brief'), true, () => {}),
    check(`${t('print_dabs')}${hasDabs ? '' : ` (${t('print_none')})`}`, sel.dabs, (v) => { sel.dabs = v; }),
    check(`${t('print_notam')}${hasNotam ? '' : ` (${t('print_none')})`}`, sel.notam, (v) => { sel.notam = v; }),
    check(paxCardTitle(ctx.settings), sel.pax, (v) => { sel.pax = v; }),
  ]);
  body.querySelector('input').disabled = true;
  const ok = await dialog(t('print_title'), body, [{ label: t('cancel'), value: false }, { label: t('print'), value: true, primary: true }]);
  if (!ok) return;
  const parts = ['brief', sel.dabs && 'dabs', sel.notam && 'notam', sel.pax && 'pax'].filter(Boolean).join(',');
  if (onApply) { onApply(parts); return; }
  ctx.navigate(`${shared?.material ? `#/m/${shared.token}/${b.id}` : shared ? `#/s/${shared.token}/v` : `#/v/${b.id}`}?print=1&parts=${parts}`);
}

/** Passagierkarte als Druckbogen (A4 quer, zwei A5-Karten); wird in der Pax-Sicht und als Druckteil der Briefingsicht gebraucht. */
export function paxSheet(b, ctx) {
  const S = ctx.settings, zz = z(b), lang = getLang();
  const sun = sunFor(b, S, ctx.racTable);
  const { rows } = scheduleFor(b, sun);
  const depart = rows.find((r) => r.kind === 'depart'), landing = rows.find((r) => r.key === 'landing');
  const meet = (b.schedule.stops || []).find((st) => st.lat != null) || null;
  const qr = meet ? qrSvg(mapsUrl(meet.lat, meet.lon), 3, 2) : null;
  const pic = S.persons.find((p) => p.id === b.persons.picId);
  const items = (S.paxCardItems?.[lang] || S.paxCardItems?.de || []);
  const card = h('div.brief.paxcard', [
    h('div.bh', [h('div.l', [balloonImage(b, S) ? h('img.bimg', { src: balloonImage(b, S), alt: b.balloon.reg || '' }) : null, h('div', [h('h1', `${paxCardTitle(S)} · ${fmtDate(zz, b.time.startMs, lang)}`), h('div', `${b.balloon.label} · PIC ${b.persons.pic}${pic?.phone ? ' · ' + pic.phone : ''}`)])]), h('div.r', [h('img', { src: 'img/wicki-logo.png', alt: 'Wicki Partners Ballonteam' }), h('div.tl', titleLine(b, lang, t('appName'))), h('div', lastChangeLine(b, lang, t('lastChange')))])]),
    h('div.bs', t('pax_meet')),
    h('div.pax-meet', [h('div.kv.pax-kv', [
      [t('meeting'), meet ? placeLine({ name: meet.name, lat: meet.lat, lon: meet.lon }, { noElev: true }) : (b.schedule.meetingName || '–')],
      [t('pax_time'), depart ? `${hhmm(zz, depart.ms)} LT` : '–'], [t('sch_start'), `${hhmm(zz, b.time.startMs)} LT · ${b.site.name}`],
      [t('duration'), `${fmtDur(b.intent.durationMin)} (${t('pax_approx')})`], [t('sch_landing'), landing ? `${hhmm(zz, landing.ms)} LT · ${t('pax_landingNote')}` : '–'],
    ].map(([k, v]) => [h('div.k', k), h('div.v', v)])), qr ? h('figure.pax-qr', [qr, h('figcaption.mini', t('pax_qr'))]) : null]),
    h('div.bs', t('pax_bring')), h('ul.pax-list', items.map((x) => h('li', x))),
    h('div.bs', t('pax_safety')), h('ul.pax-list', (lang === 'en' ? PAX_SAFETY.en : PAX_SAFETY.de).concat(b.balloon.type === 'gas' ? GAS_BRIEFING_EXTRA[lang] || GAS_BRIEFING_EXTRA.de : []).map((x) => h('li', x))),
    h('div.bs', t('pax_contact')), h('div.kv.pax-kv', [[t('pic'), `${b.persons.pic}${pic?.phone ? ' · ' + pic.phone : ''}`], b.persons.retrieve ? [t('retrieve'), b.persons.retrieve] : null, [t('operator'), b.flight.operatorName]].filter(Boolean).map(([k, v]) => [h('div.k', k), h('div.v', v)])),
    (b.balloon?.trackers?.length ? b.balloon.trackers : pic?.trackers || []).length ? h('div', [h('div.bs', t('pax_track')), h('ul.pax-list.trackers', (b.balloon?.trackers?.length ? b.balloon.trackers : pic.trackers).map((u) => h('li', h('a', { href: u, target: '_blank', rel: 'noopener' }, u.replace(/^https?:\/\/(www\.)?/, ''))))), h('div.mini', t('pax_trackHint'))]) : null,
    h('div.bf', [h('span', t('pax_weather')), h('span', `${t('appName')} · ${b.flight.operatorName}`)]),
  ]);
  // Druck: A4 quer, zwei A5-Karten nebeneinander (Schnittlinie in der Mitte); am Bildschirm eine Karte
  const copy = card.cloneNode(true); copy.classList.add('copy');
  return h('div.paxsheet', [card, copy]);
}

export async function renderPaxCard(view, ctx, id, opts = {}) {
  const b = upgradeBriefing(opts.briefing || await ctx.store.getBriefing(id));
  if (!b) { view.appendChild(h('div.err', 'not found')); return; }
  const zz = z(b), lang = getLang();
  const back = ctx.shared?.material ? `#/m/${ctx.shared.token}/${b.id}` : ctx.shared ? `#/s/${ctx.shared.token}/v` : `#/b/${b.id}`;
  setHeader({ title: paxCardTitle(ctx.settings), sub: `${fmtDate(zz, b.time.startMs, lang)} · ${b.site.name}`, tools: [h('button.btn', { type: 'button', onclick: () => ctx.navigate(back) }, '← ' + t('view_brief')), printButton(() => window.print())] });
  view.appendChild(paxSheet(b, ctx));
  if (/print=1/.test(location.hash)) setTimeout(() => window.print(), 400);
}
const PAX_SAFETY = {
  de: ['Den Anweisungen des Piloten folgen – vor allem bei der Landung.', 'Landeposition: Rücken in Fahrtrichtung, Knie leicht gebeugt, an den Haltegriffen festhalten, nichts in den Händen.', 'Im Korb bleiben, bis der Pilot das Aussteigen freigibt – auch nach der Landung.', 'Keine losen Gegenstände (Hüte, Handys ohne Band); Kameras mit Schlaufe.', 'Vor dem Start: Fahrtenschein unterschreiben, Gesundheitszustand und Flugangst ansprechen.', 'Beim Aufrüsten und Abbauen hilft die ganze Crew – der Pilot sagt, wo.'],
  en: ['Follow the pilot’s instructions – especially for landing.', 'Landing position: back towards the direction of travel, knees slightly bent, hold the handles, nothing in your hands.', 'Stay in the basket until the pilot clears you to climb out – also after landing.', 'No loose items (hats, phones without strap); cameras with a lanyard.', 'Before launch: sign the flight ticket, mention health issues or fear of heights.', 'Everybody helps rigging and packing – the pilot says where.'],
};

// ---------------------------------------------------------------- Export
export async function exportAll(ctx, all = false) {
  let data;
  if (ctx.store.mode === 'remote') data = await ctx.store.exportAll(all);
  else data = { exportedAt: Date.now(), settings: ctx.settings, briefings: await Promise.all((await ctx.store.listBriefings()).map((s) => ctx.store.getBriefing(s.id))) };
  downloadText(`fahrtbriefing-export-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(data, null, 1), 'application/json');
}
export function exportOne(b) { downloadText(`${fileBase(b)}.json`, JSON.stringify(b, null, 1), 'application/json'); }

// ---------------------------------------------------------------- Final-PDF
/** Server-PDF (Browser Rendering) oder manuelles Ablegen eines gedruckten PDFs. */
export async function finalPdfDialog(b, ctx, onChange) {
  if (ctx.store.mode !== 'remote') { toast(t('ac_localOnly')); return; }
  const last = (b.versions || []).slice(-1)[0];
  const status = h('div.note', last?.pdfUrl ? h('a', { href: last.pdfUrl, target: '_blank', rel: 'noopener' }, `${t('pdf_current')} v${last.no} ↗`) : t('pdf_none'));
  const fileIn = h('input', { type: 'file', accept: 'application/pdf', style: { display: 'none' } });
  fileIn.addEventListener('change', async () => {
    const f = fileIn.files[0]; if (!f) return;
    if (f.size > 12 * 1024 * 1024) { toast('> 12 MB'); return; }
    status.textContent = t('loading');
    try {
      const dataUrl = await new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(f); });
      const r = await ctx.store.uploadImage(b.id, dataUrl, ctx.shared?.token);
      attachPdf(b, r.url, 'upload'); onChange();
      status.innerHTML = ''; status.appendChild(h('a', { href: r.url, target: '_blank', rel: 'noopener' }, `${t('pdf_stored')} ↗`));
    } catch (e) { status.textContent = `${t('error')}: ${e.message}`; }
  });
  const serverBtn = h('button.btn.primary', { type: 'button', onclick: async () => {
    status.textContent = t('pdf_rendering');
    try { const j = await ctx.store.data('pdf', { b: b.id }, ctx.shared?.token, { id: b.id }); attachPdf(b, ctx.store.apiBase + j.url, 'server'); onChange(); status.innerHTML = ''; status.appendChild(h('a', { href: ctx.store.apiBase + j.url, target: '_blank', rel: 'noopener' }, `${t('pdf_stored')} ↗`)); }
    catch (e) { status.textContent = `${t('error')}: ${e.message}`; }
  } }, t('pdf_server'));
  const content = h('div', [h('div.note', t('pdf_hint')), h('div.row-actions', { style: { margin: '8px 0' } }, [serverBtn, h('button.btn', { type: 'button', onclick: () => fileIn.click() }, t('pdf_upload')), h('button.btn', { type: 'button', onclick: () => ctx.navigate(ctx.shared ? `#/s/${ctx.shared.token}/v?print=1` : `#/v/${b.id}?print=1`) }, t('print')), fileIn]), status]);
  await dialog(t('pdf_title'), content, [{ label: t('close'), primary: true }], { cls: 'wide' });
}
function attachPdf(b, url, how) {
  const last = (b.versions || []).slice(-1)[0];
  const entry = { url, how, ts: Date.now() };
  if (last) { last.pdfUrl = url; last.pdfHow = how; last.pdfTs = entry.ts; }
  b.pdfs = (b.pdfs || []).concat([{ ...entry, finalNo: last?.no || 0 }]).slice(-20);
}
