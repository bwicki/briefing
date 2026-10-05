/* Fahrtbriefing — geführter Ablauf «Neues Briefing» (sechs Schritte, Weiter/Zurück). */
import { h, clear, toast, num, fmt, fmtSigned, debounce } from '../util.js';
import { t, getLang } from '../i18n.js';
import { setHeader } from '../app.js';
import { field, input, select, textarea, check, kv, stats, fieldAdd } from './widgets.js';
import { scheduleEditor } from './parts.js';
import { newBriefing, setStart, sunFor, massPerf, scheduleFor, equipmentSuggest, phaseOf, upgradeBriefing, scheduleRowLabel, setFirstMeeting, applyLanding, applyBalloonToPlan, directionText, isLocked } from '../model.js';
import { placeRow, placeLine, pickPlace, mapsLink, typeToPick } from './place.js';
import { stammLabel } from '../stamm.js';
import { resolveBalloon } from '../defaults.js';
import { icao, countryGuess, distKm, bearing, compass } from '../calc/geo.js';
import { hhmm, fmtDate, fmtDur, localParts, isoDate } from '../calc/time.js';
import { geocode, pointInfo, siteWeatherAt, route } from '../net.js';
import { startAmpel, quickTraj } from '../auto/data.js';
import { baseLayers } from './autorender.js';
import { TRAJ_COLORS, targetEstimate } from '../auto/traj.js';
import { trailerMinutes } from '../calc/schedule.js';
import { mandatoryPanels } from '../panels.js';
import { tt } from '../i18n.js';

const STEPS = ['wiz_s1', 'wiz_s2', 'wiz_s3', 'wiz_s4', 'wiz_s5', 'wiz_s6'];
const QS = ['wiz_q1', 'wiz_q2', 'wiz_q3', 'wiz_q4', 'wiz_q5', 'wiz_q6'];

export async function renderWizard(view, ctx, id, opts = {}) {
  let b = opts.briefing || (id && !ctx.shared ? await ctx.store.getBriefing(id) : null);
  let fresh = false;
  if (!b) { b = newBriefing(ctx.settings); fresh = true; }
  if (!fresh && isLocked(b)) { ctx.navigate(ctx.shared ? `#/s/${ctx.shared.token}/v` : `#/v/${b.id}`); return; }   // Fahrt vorbei: unverändert lassen
  upgradeBriefing(b);
  let step = b.wizardStep || (id ? 6 : 1);
  const tz = () => b.site.tz || 'Europe/Zurich';
  const lang = getLang();

  const back = ctx.shared ? `#/s/${ctx.shared.token}` : '#/list';
  const saveBtn = h('button.btn', { type: 'button', onclick: async () => { await persist(); toast(t('set_saved')); ctx.navigate(back); } }, t('wiz_saveDraft'));
  const cancelBtn = h('button.btn', { type: 'button', onclick: () => ctx.navigate(back) }, t('wiz_cancel'));
  setHeader({ title: t('wiz_title'), tools: [saveBtn, cancelBtn] });

  const stepsBar = h('div.steps');
  const prog = h('div.prog', h('i'));
  const box = h('div.card', h('div.card-body'));
  const sofar = h('div.card', [h('div.card-head', h('div.section-title', t('wiz_sofar'))), h('div.card-body.sofar')]);
  const wiz = h('div.wiz', [stepsBar, prog, h('div.wiz-layout', [box, h('div', sofar)])]);
  view.appendChild(wiz);

  async function persist() {
    b.wizardStep = step;
    if (ctx.shared) await ctx.store.saveShared(ctx.shared.token, b, ctx.who); else await ctx.store.saveBriefing(b, ctx.who);
    if (fresh) { fresh = false; history.replaceState(null, '', `#/new/${b.id}`); }
  }
  const persistSoon = debounce(() => persist().catch((e) => console.warn(e)), 1200);

  function drawSteps() {
    clear(stepsBar);
    wiz.classList.toggle('wide', step === 5);   // Tagesplanung: breite Tabelle
    STEPS.forEach((k, i) => {
      const n = i + 1;
      const cls = n < step ? 'done' : n === step ? 'cur' : '';
      stepsBar.appendChild(h('div.step' + (cls ? '.' + cls : ''), { onclick: () => { if (n < step) go(n); } }, [h('span.n', n < step ? '✓' : String(n)), t(k)]));
      if (i < STEPS.length - 1) stepsBar.appendChild(h('div.step-bar'));
    });
    prog.firstChild.style.width = `${step / 6 * 100}%`;
    const sb = sofar.querySelector('.sofar'); clear(sb);
    const lines = summaryLines();
    STEPS.forEach((k, i) => sb.appendChild(h('div', { class: i + 1 < step ? 'done' : 'todo' }, `${i + 1} · ${i + 1 < step && lines[i] ? lines[i] : t(k)}`)));
    sb.appendChild(h('div.note', { style: { marginTop: '8px' } }, t('wiz_jump')));
  }
  function summaryLines() {
    return [
      `${b.balloon?.label || ''} · ${t('kind_' + b.flight.kind)} · ${b.flight.operatorName}`,
      `${b.site.name || '?'} · ${fmtDate(tz(), b.time.startMs, lang)} ${hhmm(tz(), b.time.startMs)} LT`,
      `${fmtDur(b.intent.durationMin)} · ${b.intent.altMinFt}–${b.intent.altMaxFt} ft`,
      `${b.persons.pic} · ${b.persons.pax.length} Pax`,
      `${b.schedule.meetingName || '–'}`,
      '',
    ];
  }
  async function go(n) {
    if (n > step && !validate(step)) return;
    step = Math.max(1, Math.min(6, n));
    await persist();
    draw();
  }
  function validate(s) {
    if (s === 2 && (b.site.lat == null || !b.site.name)) { toast(t('site') + '?'); return false; }
    if (s === 2 && !b.time.date) { toast(t('date') + '?'); return false; }
    return true;
  }
  function footer(opts = {}) {
    return h('div.foot', [
      step > 1 ? h('button.btn', { type: 'button', onclick: () => go(step - 1) }, t('wiz_back')) : h('span'),
      h('div.hint', t('wiz_hint')),
      step < 6 ? h('button.btn.primary', { type: 'button', onclick: () => go(step + 1) }, t('wiz_next'))
        : h('button.btn.primary', { type: 'button', onclick: create }, t('wiz_create')),
    ]);
  }
  async function create() {
    delete b.wizardStep;
    if (ctx.shared) { await ctx.store.saveShared(ctx.shared.token, b, ctx.who); ctx.navigate(`#/s/${ctx.shared.token}`); return; }
    await ctx.store.saveBriefing(b, ctx.who);
    ctx.navigate(`#/b/${b.id}`);
  }
  function draw() {
    drawSteps();
    const body = box.querySelector('.card-body'); clear(body);
    body.appendChild(h('h2', [h('span.muted.mono.small', t('wiz_stepOf', { n: step, total: 6 }) + ' · '), t(QS[step - 1])]));
    const content = [null, step1, step2, step3, step4, step5, step6][step](body);
    body.appendChild(footer());
    body.addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target.tagName !== 'TEXTAREA' && e.target.tagName !== 'BUTTON') { e.preventDefault(); go(step + 1); } });
    window.scrollTo(0, 0);
    return content;
  }

  // ---------------------------------------------------------------- Start-Ampel (Schritt 2/3)
  /** Ampel «Start denkbar / marginal / eher ausgeschlossen» aus der Modellprognose, sobald Ort und Zeit bekannt sind. */
  function ampelBox() {
    const box = h('div.ampel');
    const draw = async () => {
      clear(box);
      if (b.site.lat == null || !b.time.startMs) return;
      box.appendChild(h('div.note', t('ampel_loading')));
      try {
        const a = await startAmpel(ctx, b);
        clear(box);
        const cls = ['neg', 'half', 'pos'][a.level] || '';
        box.appendChild(h('div.ampel-row.' + cls, [h('span.dot.' + cls), h('b', t('ampel_' + a.level)), a.why.length ? h('span.muted', ` · ${a.why.join(', ')}`) : null, h('span.muted.small', ` · ${a.modelName || ''} · ${t('ampel_hint')}`)]));
      } catch (e) { clear(box); box.appendChild(h('div.note', `${t('ampel_title')}: ${e.message}`)); }
    };
    draw();
    box.redraw = draw;
    return box;
  }

  /** Trajektorien-Vorschau mit allen Niveaus der Fahrtabsicht (Karte, Legende); Klick übernimmt Landeraum und Richtung.
   *  wrap.redraw() zeichnet neu (Niveaus/Dauer/Höhenband geändert). */
  function trajPreview(onPick) {
    const wrap = h('div.card', [h('div.card-head', h('div.section-title', t('trajprev_title'))), h('div.card-body')]);
    const body = wrap.querySelector('.card-body');
    let map = null;
    const render = async () => {
      clear(body);
      const mapEl = h('div.map.trajprev');
      const note = h('div.note', t('trajprev_loading'));
      const legend = h('div.traj-legend');
      body.append(note, legend, mapEl);
      if (b.site.lat == null) { note.textContent = t('site') + '?'; return; }
      const elevFt = Math.round((b.site.elev || 0) * 3.28084);
      const lo = b.intent.altMinFt || 500, hi = b.intent.altMaxFt || 5000;
      const levels = (b.intent.levels || []).filter(Boolean).length ? [...b.intent.levels] : [lo <= elevFt + 300 ? `${Math.max(300, lo)} AGL` : `${lo}`, `${hi}`];
      try {
        const r = await quickTraj(ctx, b, levels);
        if (!mapEl.isConnected) return;
        wrap.tracks = r.tracks;
        if (b.landing?.lat != null) { const est = targetEstimate(r.tracks, b.site, b.landing); const nd = directionText(b, lang, est); if (nd !== b.intent.direction) { b.intent.direction = nd; wrap.onDirection?.(nd); } }
        note.textContent = `${t('trajprev_note', { d: fmtDur(r.durationMin), l: levels.join(', ') })} · ${r.modelName || ''}`;
        legend.append(h('span.muted.small', `${t('auto_legendAlt')}: `), ...r.tracks.filter((tr) => !tr.belowGround).map((tr) => h('span.item', [h('span.sw', { style: { background: TRAJ_COLORS[r.tracks.indexOf(tr) % TRAJ_COLORS.length] } }), ` ${tr.label} · ${tr.altFt} ft`])));
        if (typeof L === 'undefined') return;
        if (map) { try { map.remove(); } catch { /* bereits entfernt */ } }
        map = L.map(mapEl, { zoomControl: true }).setView([b.site.lat, b.site.lon], 10);
        const bl = baseLayers(); bl.osm.addTo(map); for (const k in bl.over) bl.over[k].addTo(map);
        L.control.layers(bl.base, bl.over, { position: 'topleft', collapsed: true }).addTo(map);
        const bounds = [[b.site.lat, b.site.lon]];
        r.tracks.forEach((tr, k) => { if (tr.belowGround) return; const pts = tr.points.map((p) => [p.lat, p.lon]); bounds.push(...pts); L.polyline(pts, { color: TRAJ_COLORS[k % TRAJ_COLORS.length], weight: 3 }).addTo(map).bindTooltip(`${tr.label} · ${tr.altFt} ft`); for (const hh of tr.hourly || []) L.circleMarker([hh.lat, hh.lon], { radius: 3.5, color: TRAJ_COLORS[k % TRAJ_COLORS.length], fillOpacity: 1 }).addTo(map).bindTooltip(`${tr.label} ${hhmm(tz(), hh.ms)} · ${Math.round(hh.km)} km`); });
        L.marker([b.site.lat, b.site.lon]).addTo(map).bindTooltip(b.site.name || 'Start');
        let landMarker = b.landing?.lat != null ? L.circleMarker([b.landing.lat, b.landing.lon], { radius: 7, color: '#2f8f4e', fillOpacity: .6 }).addTo(map) : null;
        map.on('click', async (e) => {
          const { lat, lng } = e.latlng;
          if (!landMarker) landMarker = L.circleMarker([lat, lng], { radius: 7, color: '#2f8f4e', fillOpacity: .6 }).addTo(map); else landMarker.setLatLng([lat, lng]);
          let info = {}; try { info = await pointInfo(lat, lng); } catch { /* ohne Name/Höhe */ }
          onPick({ lat, lon: lng, name: info.name || icao(lat, lng), elev: info.elev != null ? Math.round(info.elev) : null, address: '' });
        });
        setTimeout(() => { map.invalidateSize(); map.fitBounds(bounds, { padding: [20, 20] }); }, 60);
      } catch (e) { note.textContent = `${t('trajprev_title')}: ${e.message}`; mapEl.hidden = true; }
    };
    render();
    wrap.redraw = render;
    return wrap;
  }

  // ---------------------------------------------------------------- 1
  function step1(body) {
    const S = ctx.stamm.balloons;
    const typeRow = h('div.chips');
    const combo = h('div.frow');
    const redraw = () => {
      clear(typeRow);
      for (const ty of ['hab', 'gas']) typeRow.appendChild(h('button.chip.lg', { type: 'button', 'aria-pressed': b.balloonSel.type === ty, onclick: () => { b.balloonSel = ty === 'gas' ? { type: 'gas', envelopeId: S.defaultEnvelope, basketId: S.defaultBasket } : { type: 'hab', id: S.defaultHab }; applyBalloon(); redraw(); } }, t(ty)));
      clear(combo);
      const img = (x) => x?.image ? h('div.f.bimg-f', [h('label', '\u00a0'), h('img.bimg', { src: x.image, alt: x.id || '' })]) : null;
      if (b.balloonSel.type === 'gas') {
        combo.appendChild(field(t('envelope'), select(S.envelopes.map((e) => ({ value: e.id, label: stammLabel(e, `${e.reg || e.id} · ${e.model} ${e.volume} m³`) })), b.balloonSel.envelopeId, { onchange: (e) => { b.balloonSel.envelopeId = e.target.value; applyBalloon(); redraw(); } })));
        combo.appendChild(field(t('basket'), select(S.baskets.map((k) => ({ value: k.id, label: stammLabel(k, `${k.name} · ${k.mass} kg · max ${k.maxPersons} P.`) })), b.balloonSel.basketId, { onchange: (e) => { b.balloonSel.basketId = e.target.value; applyBalloon(); } })));
        { const im = img(S.envelopes.find((e) => e.id === b.balloonSel.envelopeId)); if (im) combo.appendChild(im); }
      } else {
        combo.appendChild(field(t('registration'), select(S.hab.map((x) => ({ value: x.id, label: stammLabel(x, `${x.reg || x.id} · ${x.model}`) })), b.balloonSel.id, { onchange: (e) => { b.balloonSel.id = e.target.value; applyBalloon(); redraw(); } })));
        { const im = img(S.hab.find((x) => x.id === b.balloonSel.id)); if (im) combo.appendChild(im); }
      }
    };
    function applyBalloon() {
      const bal = resolveBalloon(ctx.stamm, b.balloonSel);
      if (!bal) return;
      const typeChanged = b.balloon?.type !== bal.type;
      b.balloon = bal;
      b.weather.envTempC = bal.envTempC ?? b.weather.envTempC;
      b.schedule.rigMin = bal.rigMin ?? b.schedule.rigMin; b.schedule.fillMin = bal.fillMin ?? 0; applyBalloonToPlan(b, bal);
      if (typeChanged) { const d = ctx.settings.intentDefaults[bal.type]; b.intent = { ...b.intent, durationMin: d.durationMin, altMinFt: d.altMinFt, altMaxFt: d.altMaxFt, levels: [...d.levels] }; }
      persistSoon();
    }
    const kinds = h('div.chips', ['private', 'commercial', 'training', 'exam'].map((k) => h('button.chip.lg', { type: 'button', 'aria-pressed': b.flight.kind === k, onclick: (e) => { b.flight.kind = k; kinds.querySelectorAll('.chip').forEach((c) => c.setAttribute('aria-pressed', c === e.currentTarget)); persistSoon(); } }, t('kind_' + k))));
    const ops = ctx.stamm.operators.map((o) => ({ value: o.id, label: stammLabel(o, o.name) })).concat([{ value: 'custom', label: t('operatorCustom') }]);
    const custom = input('text', b.flight.operatorId === 'custom' ? b.flight.operatorName : '', { placeholder: t('operatorCustom'), oninput: (e) => { b.flight.operatorName = e.target.value; persistSoon(); } });
    custom.hidden = b.flight.operatorId !== 'custom';
    const opSel = select(ops, b.flight.operatorId, { onchange: (e) => { b.flight.operatorId = e.target.value; custom.hidden = e.target.value !== 'custom'; b.flight.operatorName = e.target.value === 'custom' ? custom.value : ctx.stamm.operators.find((o) => o.id === e.target.value)?.name || ''; persistSoon(); } });
    // NVFR: bewusst geplante Nachtfahrt (Schalter in der Zeile «Typ der Fahrt») → keine Nacht-Warnungen, Nachtausrüstung wird gesetzt
    const nvfrChip = h('button.chip.lg.nvfr', { type: 'button', 'aria-pressed': !!b.flight.nvfr, title: t('nvfr_switch'), onclick: () => {
      b.flight.nvfr = !b.flight.nvfr; nvfrChip.setAttribute('aria-pressed', b.flight.nvfr);
      const eq = b.panels?.['A.equipment']?.content;
      if (eq?.items) { const set = new Set(eq.items); if (b.flight.nvfr) { set.add('nvr'); set.delete('none'); } eq.items = [...set]; }
      persistSoon();
    } }, `🌙 ${t('nvfr')}`);
    kinds.append(h('span.chip-sep'), nvfrChip);
    redraw();
    body.append(
      field(t('balloonType'), typeRow), combo,
      field(t('flightKind'), kinds), h('div.note', t('nvfr_hint')),
      h('div.frow', [field(t('operator'), h('div', [opSel, custom])), field(t('occasion'), input('text', b.flight.occasion, { oninput: (e) => { b.flight.occasion = e.target.value; persistSoon(); } }))]),
    );
  }

  // ---------------------------------------------------------------- 2
  function step2(body) {
    const S = ctx.settings, M = ctx.stamm;   // S: eigener Stamm (speichern), M: inkl. Freigaben (auswählen)
    const favs = h('div.chips');
    const nameIn = input('text', b.site.name, { placeholder: t('siteTypeHint') });
    // Tippen öffnet die Ortswahl (Suche mit dem Getippten); Übernahme setzt den Ort
    typeToPick(nameIn, () => b.site, { title: t('site'), onPick: (p) => { setSite({ name: p.name, lat: p.lat, lon: p.lon, elev: p.elev, tz: p.tz, country: p.country, id: '' }); drawFavs(); drawPlace(); }, onCancel: (v) => { b.site.name = v; drawPlace(); persistSoon(); } });
    const icaoIn = input('text', b.site.icao, { readOnly: true });
    const elevIn = input('number', b.site.elev ?? '', { step: 1, oninput: (e) => { b.site.elev = num(e.target.value, null); drawPlace(); persistSoon(); } });
    const ctry = select([['CH', 'CH'], ['DE', 'DE'], ['AT', 'AT'], ['FR', 'FR'], ['IT', 'IT'], ['LI', 'LI'], ['', t('unknown')]].map(([v, l]) => ({ value: v, label: l })), b.site.country, { onchange: (e) => { b.site.country = e.target.value; refreshSun(); persistSoon(); } });
    const tzIn = input('text', b.site.tz, { oninput: (e) => { b.site.tz = e.target.value || 'Europe/Zurich'; applyTime(); } });
    const dateIn = input('date', b.time.date, { onchange: applyTime });
    const timeIn = input('time', b.time.time, { onchange: applyTime });
    const baseRow = h('div.chips', ['LT', 'UTC'].map((k) => h('button.chip.lg', { type: 'button', 'aria-pressed': b.time.base === k, onclick: (e) => { b.time.base = k; baseRow.querySelectorAll('.chip').forEach((c) => c.setAttribute('aria-pressed', c === e.currentTarget)); applyTime(); } }, k)));
    const sunBox = h('div.note');
    const horizonBox = h('div.note');
    const ampel = ampelBox();
    const ampelSoon = debounce(() => ampel.redraw(), 900);
    function applyTime() {
      const d = dateIn.value || b.time.date, tm = timeIn.value || b.time.time;
      if (b.time.base === 'UTC') { b.time.date = d; b.time.time = tm; b.time.startMs = Date.UTC(...d.split('-').map((x, i) => i === 1 ? +x - 1 : +x), ...tm.split(':').map(Number)); b.time.date = isoDate(tz(), b.time.startMs); b.time.time = hhmm(tz(), b.time.startMs); }
      else setStart(b, d, tm);
      refreshSun(); persistSoon(); ampelSoon();
    }
    function refreshSun() {
      clear(sunBox); clear(horizonBox);
      if (b.site.lat == null) return;
      const sun = sunFor(b, S, ctx.racTable);
      const z = tz();
      sunBox.append(h('div', [h('b', `${t('bcmt')} ${hhmm(z, sun.official.bcmt)} · ${t('sr')} ${hhmm(z, sun.official.sr)} · ${t('ss')} ${hhmm(z, sun.official.ss)} · ${t('ecet')} ${hhmm(z, sun.official.ecet)}`), ' ', h('span.muted.small', sun.source === 'rac' ? t('sun_rac') : t('sun_astro'))]));
      if (sun.racMissing) sunBox.appendChild(h('div.warn', t('sun_racMissing', { v: ctx.racTable?.validTo || '–' })));
      if (sun.nightStart) sunBox.appendChild(h('div.warn', '⚠ ' + t('nightWarn', { t: hhmm(z, b.time.startMs), b: hhmm(z, sun.official.bcmt) })));
      if (sun.nightLanding) sunBox.appendChild(h('div.warn', '⚠ ' + t('nightLandWarn', { e: hhmm(z, sun.official.ecet) })));
      if (sun.nvfr) sunBox.appendChild(h('div.note', `${t('nvfr')}: ${t('nvfr_planned')}${sun.startBeforeBcmt ? ` · ${t('nvfr_start')}` : ''}${sun.landingAfterEcet ? ` · ${t('nvfr_landing')}` : ''}`));
      const ph = phaseOf(b.time.startMs);
      const hrs = Math.round((b.time.startMs - Date.now()) / 3600000);
      const models = hrs <= 48 ? 'ICON-D2, AROME, ICON-EU, ECMWF IFS, GFS' : hrs <= 120 ? 'ICON-EU, ARPEGE, ICON, ECMWF IFS, GFS' : hrs <= 240 ? 'ICON, ECMWF IFS, GFS, ECMWF ENS' : 'GFS, ECMWF ENS';
      horizonBox.textContent = `${t('horizon')}: ${hrs >= 0 ? '+' : ''}${hrs} h → ${t('phase_' + ph)} · ${models}`;
    }
    async function setSite(s) {
      Object.assign(b.site, { name: s.name, lat: s.lat, lon: s.lon, elev: s.elev ?? b.site.elev, tz: s.tz || b.site.tz, country: s.country || countryGuess(s.lat, s.lon), icao: icao(s.lat, s.lon), favoriteId: s.id || '' });
      nameIn.value = b.site.name; icaoIn.value = b.site.icao; elevIn.value = b.site.elev ?? ''; ctry.value = b.site.country; tzIn.value = b.site.tz;
      if (s.meetingId) { const m = M.meetings.find((x) => x.id === s.meetingId); if (m) setFirstMeeting(b.schedule, m); }
      setStart(b, b.time.date, b.time.time);
      refreshSun(); persistSoon(); ampelSoon();
      if (s.elev == null || !s.tz) {
        try { const info = await pointInfo(s.lat, s.lon); if (info.elev != null) { b.site.elev = Math.round(info.elev); elevIn.value = b.site.elev; } if (info.tz) { b.site.tz = info.tz; tzIn.value = info.tz; } if (!b.site.name && info.name) { b.site.name = info.name; nameIn.value = info.name; } if (info.country) { b.site.country = info.country; ctry.value = info.country; } setStart(b, b.time.date, b.time.time); refreshSun(); drawPlace(); persistSoon(); } catch { /* optional */ }
      }
    }
    function drawFavs() {
      clear(favs);
      const ty = b.balloon?.type || 'hab';
      for (const s of M.sites.filter((x) => x.favorite && (!x.types?.length || x.types.includes(ty)))) favs.appendChild(h('button.chip.lg', { type: 'button', 'aria-pressed': b.site.favoriteId === s.id, title: s.shared ? s.ownerName : null, onclick: () => { setSite(s); drawFavs(); } }, stammLabel(s, s.name)));
      if (!favs.children.length) favs.appendChild(h('span.note', t('siteNoFavType')));
      favBtn.hidden = !!b.site.favoriteId && M.sites.some((x) => x.id === b.site.favoriteId);   // schon ein Favorit → kein «Als Favorit speichern»
    }
    const placeBox = h('div');
    function drawPlace() {
      clear(placeBox);
      placeBox.appendChild(placeRow(b.site, { label: t('site'), title: t('site'), onPick: (p) => { setSite({ name: p.name, lat: p.lat, lon: p.lon, elev: p.elev, tz: p.tz, country: p.country, id: '' }); drawFavs(); drawPlace(); } }));
    }
    const favBtn = h('button.btn', { type: 'button', onclick: async () => {
      if (b.site.lat == null) return;
      const id = (b.site.name || 'site').toLowerCase().replace(/[^a-z0-9]+/g, '-');
      const ex = S.sites.find((x) => x.id === id);
      const rec = { id, name: b.site.name, lat: b.site.lat, lon: b.site.lon, elev: b.site.elev, country: b.site.country, tz: b.site.tz, notes: '', meetingId: b.schedule.meetingId || '', favorite: true };
      if (ex) Object.assign(ex, rec); else S.sites.push(rec);
      b.site.favoriteId = id; await ctx.saveSettings(S); drawFavs(); toast(t('set_saved'));
    } }, t('siteSaveFav'));
    drawFavs(); drawPlace();
    body.append(
      field(t('siteFavorites'), favs),
      placeBox,
      h('div.frow.c4', [field(t('name'), nameIn), field(t('coords'), icaoIn), field(t('elevation') + ' (m)', elevIn), field(t('countryRules'), ctry)]),
      h('div.frow.c4', [field(t('date'), dateIn), field(t('startTime'), timeIn), field(t('timeBase'), baseRow), field(t('s_tz'), tzIn)]),
      h('div.row-actions', [favBtn]),
      field(t('sun'), sunBox), horizonBox,
      field(t('ampel_title'), ampel),
    );
    refreshSun();
  }

  // ---------------------------------------------------------------- 3
  function step3(body) {
    const it = b.intent;
    let preview = null;
    const redrawPreview = debounce(() => preview?.redraw?.(), 1200);
    const durIn = input('text', fmtDur(it.durationMin).replace(' h', ''), { placeholder: '2:00', oninput: (e) => { const m = /^(\d+)(?::(\d{1,2}))?/.exec(e.target.value.trim()); if (m) { it.durationMin = (+m[1]) * 60 + (+(m[2] || 0)); persistSoon(); sugg(); redrawPreview(); } } });
    const minIn = input('number', it.altMinFt, { step: 100, oninput: (e) => { it.altMinFt = num(e.target.value); persistSoon(); sugg(); } });
    const maxIn = input('number', it.altMaxFt, { step: 100, oninput: (e) => { it.altMaxFt = num(e.target.value); persistSoon(); sugg(); } });
    const dir = input('text', it.direction, { placeholder: t('directionHint'), oninput: (e) => { it.direction = e.target.value; persistSoon(); } });
    const rem = textarea(it.remark, { rows: 2, oninput: (e) => { it.remark = e.target.value; persistSoon(); } });
    const lv = input('text', it.levels.join(', '), { oninput: (e) => { it.levels = e.target.value.split(/[,;]+/).map((x) => x.trim()).filter(Boolean); persistSoon(); redrawPreview(); } });
    const suggBox = h('div.note');
    const landBox = h('div');
    const setLanding = (p) => {
      const est = p && preview?.tracks ? targetEstimate(preview.tracks, b.site, p) : null;
      applyLanding(b, p, lang, est); if (p) dir.value = it.direction;
      persistSoon(); drawLand();
    };
    const drawLand = () => { clear(landBox); landBox.appendChild(placeRow(b.landing, { label: t('landingSite'), title: t('landingSite'), allowClear: true, from: b.site, onPick: setLanding })); landBox.appendChild(h('div.note', t('landingHint'))); };
    drawLand();
    preview = trajPreview(setLanding);
    preview.onDirection = (v) => { dir.value = v; persistSoon(); };
    function sugg() {
      const sun = sunFor(b, ctx.settings, ctx.racTable);
      const s = equipmentSuggest(b, sun);
      clear(suggBox);
      if (s.length) suggBox.textContent = t('eq_suggest', { s: s.map((x) => t('eq_' + x)).join(', ') });
      if (sun?.nightLanding) suggBox.appendChild(h('div.warn', '⚠ ' + t('nightLandWarn', { e: hhmm(tz(), sun.official.ecet) })));
    }
    sugg();
    body.append(
      field(t('ampel_title'), ampelBox()),
      h('div.frow.c3', [field(t('duration') + ' (h:mm)', durIn), field(`${t('altBand')} ${t('altMin')} (ft)`, minIn), field(`${t('altBand')} ${t('altMax')} (ft)`, maxIn)]),
      field(t('levels'), lv),
      preview,
      field(t('direction'), dir),
      landBox,
      field(t('intentRemark'), rem), suggBox,
    );
  }

  // ---------------------------------------------------------------- 4
  function step4(body) {
    const P = ctx.stamm.persons, bal = b.balloon;
    const pers = (role) => P.filter((p) => !role || p.roles?.includes(role)).map((p) => ({ value: p.id, label: stammLabel(p, p.name) })).concat([{ value: 'custom', label: t('operatorCustom') }]);
    const picCustom = input('text', b.persons.picId === 'custom' ? b.persons.pic : '', { placeholder: t('name'), oninput: (e) => { b.persons.pic = e.target.value; persistSoon(); } }); picCustom.hidden = b.persons.picId !== 'custom';
    const picSel = select(pers('pic'), b.persons.picId, { onchange: (e) => { b.persons.picId = e.target.value; picCustom.hidden = e.target.value !== 'custom'; b.persons.pic = e.target.value === 'custom' ? picCustom.value : P.find((p) => p.id === e.target.value)?.name || ''; persistSoon(); } });
    // Nachfahrer: mehrere Personen (Liste aus Stamm oder frei)
    const retOpts = pers('retrieve').concat(pers('crew').filter((x) => !pers('retrieve').some((y) => y.value === x.value) && x.value !== 'custom'));
    const retBox = h('div.retrievers');
    const syncRetrieve = () => { b.persons.retrieve = b.persons.retrievers.map((r) => r.name).filter(Boolean).join(', '); b.persons.retrieveId = b.persons.retrievers[0]?.id || ''; };
    function drawRet() {
      clear(retBox);
      b.persons.retrievers.forEach((r, i) => {
        const custom = input('text', r.id === 'custom' ? r.name : '', { placeholder: t('name'), oninput: (e) => { r.name = e.target.value; syncRetrieve(); persistSoon(); } }); custom.hidden = r.id !== 'custom';
        const sel = select(retOpts, r.id || 'custom', { onchange: (e) => { r.id = e.target.value; custom.hidden = r.id !== 'custom'; r.name = r.id === 'custom' ? custom.value : P.find((p) => p.id === r.id)?.name || ''; syncRetrieve(); persistSoon(); } });
        retBox.appendChild(h('div.pax-row.ret-row', [h('div', { style: { display: 'flex', gap: '6px', flex: 1, minWidth: 0 } }, [sel, custom]), h('button.btn.icon', { type: 'button', title: t('remove'), onclick: () => { b.persons.retrievers.splice(i, 1); syncRetrieve(); drawRet(); persistSoon(); } }, '✕')]));
      });
    }
    const retAdd = () => { const free = retOpts.find((o) => o.value !== 'custom' && !b.persons.retrievers.some((r) => r.id === o.value)); b.persons.retrievers.push(free ? { id: free.value, name: free.label.replace(/ \(.*\)$/, '') } : { id: 'custom', name: '' }); syncRetrieve(); drawRet(); persistSoon(); };
    drawRet();
    const paxBox = h('div');
    const preview = h('div');
    function drawPax() {
      clear(paxBox);
      b.persons.pax.forEach((p, i) => {
        const nameIn = input('text', p.name, { placeholder: t('paxPlaceholder', { n: i + 1 }), oninput: (e) => { p.name = e.target.value; persistSoon(); } });
        if (p.name === t('paxPlaceholder', { n: i + 1 })) { p.name = ''; nameIn.value = ''; }   // alter Platzhalter als Wert → leeren
        const wIn = input('number', p.weight ?? '', { placeholder: `${bal.personWeight} ${t('normWeight')}`, step: 1, oninput: (e) => { p.weight = num(e.target.value, null); drawPreview(); persistSoon(); } });
        paxBox.appendChild(h('div.pax-row', [nameIn, wIn, h('button.btn.icon', { type: 'button', onclick: () => { b.persons.pax.splice(i, 1); drawPax(); drawPreview(); persistSoon(); } }, '✕')]));
      });
    }
    const paxAdd = () => { b.persons.pax.push({ name: '', weight: null }); drawPax(); drawPreview(); persistSoon(); setTimeout(() => paxBox.querySelectorAll('.pax-row input[type=text]')[b.persons.pax.length - 1]?.focus(), 30); };
    function drawPreview() {
      clear(preview);
      const { type, r } = massPerf(b, ctx.settings);
      const src = b.weather.source === 'model' ? t('mp_modelStand', { t: b.weather.stand || '' }) : `${t('mp_temp')} ${b.weather.tempC} °C · QNH ${b.weather.qnh}`;
      if (type === 'hab') {
        preview.appendChild(h('div.card', [h('div.card-head', [h('div.section-title.two', [h('span', `${t('previewLift')} (${bal.reg})`), h('span.sub2', `${t('mp_persons')} ${1 + b.persons.pax.length} · ${fmt(r.paxMass)} kg · ${src}`)])]), stats([
          [t('mp_takeoff'), `${fmt(r.takeoff)} kg`], [t('mp_allowed'), `${fmt(r.allowed)} kg`, null, t(r.limitBy === 'mtom' ? 'mp_limitMtom' : 'mp_limitLift', { l: fmt(r.liftAtSite), m: fmt(r.mtom) })], [t('mp_delta'), `${fmtSigned(r.massDelta)} kg`, r.massDelta > 0 ? 'neg' : 'pos'],
          [t('mp_envReq'), r.envReq != null ? `${fmt(r.envReq)} °C` : '–', r.envReq != null && r.envReq > (b.weather.envTempC || bal.envTempC) ? 'neg' : ''],
          [t('mp_maxAlt'), r.maxAltExcel != null ? `${fmt(r.maxAltExcel)} m` : '–'],
          [t('mp_need', { d: fmtDur(b.intent.durationMin), r: Math.round(r.reserveMin) + ' min' }), `${fmt(r.needKg)} kg`], [t('mp_usable'), `${fmt(r.usable)} kg`, r.fuelMargin < 0 ? 'neg' : 'pos'],
          [t('mp_enduranceRes'), fmtDur(Math.max(0, r.enduranceMin - r.reserveMin))], [t('mp_margin'), `${fmtSigned(Math.round(r.fuelMargin))} kg`, r.fuelMargin < 0 ? 'neg' : 'pos'],
        ])]));
      } else {
        preview.appendChild(h('div.card', [h('div.card-head', [h('div.section-title.two', [h('span', `${t('previewBallast')} (${bal.label})`), h('span.sub2', `${t('mp_persons')} ${1 + b.persons.pax.length} · ${fmt(r.paxMass)} kg · ${src}`)])]), stats([
          [t('gb_gross'), `${fmt(r.grossLift)} kg`], [t('gb_net'), `${fmt(r.net)} kg`], [t('gb_ballast'), `${fmt(r.ballast)} kg · ${fmt(r.ballastPct)} %`, r.ballast < r.reserveKg ? 'neg' : 'pos'],
          [t('gb_units'), r.units != null ? `${fmt(r.units, 1)} × ${bal.ballastUnitKg} kg` : '–'],
        ])]));
      }
      if ((b.persons.pax.length + 1) > (bal.maxPersons || 99)) preview.appendChild(h('div.warn', `⚠ ${t('b_maxPersons')}: ${bal.maxPersons}`));
    }
    drawPax(); drawPreview();
    body.append(h('div.frow.top', [field(t('pic'), h('div', [picSel, picCustom])), fieldAdd(t('retrieve'), retBox, retAdd, t('retrieveAdd'))]), fieldAdd(t('pax'), paxBox, paxAdd, t('paxAdd')), preview);
    // Modellwerte für die Vorschau holen (einmal je Ort/Zeit)
    if (b.site.lat != null && b.weather.source !== 'model' && (b.time.startMs - Date.now()) < 15 * 86400000) {
      const p = localParts(tz(), b.time.startMs);
      siteWeatherAt(b.site.lat, b.site.lon, b.time.date, p.hh).then((w) => { Object.assign(b.weather, { tempC: Math.round(w.tempC * 10) / 10, rh: w.rh, qnh: Math.round(w.qnh), source: 'model', stand: new Date().toISOString().slice(0, 16).replace('T', ' ') + ' UTC' }); drawPreview(); persistSoon(); }).catch(() => {});
    }
  }

  // ---------------------------------------------------------------- 5
  function step5(body) {
    const sc = b.schedule;
    const holder = h('div');
    function drawEditor() { clear(holder); if (sc.skip) { holder.appendChild(h('div.note', t('sch_skipped'))); return; } holder.appendChild(scheduleEditor(b, ctx, () => persistSoon())); }
    const skipBox = check(t('sch_skip'), !!sc.skip, (v) => { sc.skip = v; drawEditor(); persistSoon(); });
    body.append(skipBox, holder);
    drawEditor();
  }

  // ---------------------------------------------------------------- 6
  function step6(body) {
    const S = ctx.settings;
    const sun = sunFor(b, S, ctx.racTable);
    const z = tz();
    const { type, r } = massPerf(b, S);
    const { rows } = scheduleFor(b, sun);
    body.append(
      h('div.sumcols', [
        h('div.card', [h('div.card-head', h('div.section-title', t('wiz_s1'))), h('div.card-body', kv([[t('registration'), b.balloon.label], [t('flightKind'), t('kind_' + b.flight.kind)], [t('operator'), b.flight.operatorName], [t('occasion'), b.flight.occasion || '–']]))]),
        h('div.card', [h('div.card-head', h('div.section-title', t('wiz_s2'))), h('div.card-body', kv([[t('site'), placeLine(b.site)], [t('date'), `${fmtDate(z, b.time.startMs, lang)} ${hhmm(z, b.time.startMs)} LT (${hhmm('UTC', b.time.startMs)} UTC)`], [t('sun'), sun ? `BCMT ${hhmm(z, sun.official.bcmt)} · SR ${hhmm(z, sun.official.sr)} · SS ${hhmm(z, sun.official.ss)} · ECET ${hhmm(z, sun.official.ecet)}` : '–'], sun?.nightStart ? ['', h('span.warn', t('night'))] : null]))]),
        h('div.card', [h('div.card-head', h('div.section-title', t('wiz_s3'))), h('div.card-body', kv([[t('duration'), fmtDur(b.intent.durationMin)], [t('altBand'), `${b.intent.altMinFt}–${b.intent.altMaxFt} ft`], [t('direction'), b.intent.direction || '–'], b.landing?.lat != null ? [t('landingSite'), placeLine(b.landing)] : null, [t('levels'), b.intent.levels.join(', ')]]))]),
        h('div.card', [h('div.card-head', h('div.section-title', t('wiz_s4'))), h('div.card-body', kv([[t('pic'), b.persons.pic], [t('retrieve'), b.persons.retrieve || '–'], [t('pax'), b.persons.pax.map((p) => p.name).join(', ') || '–'], type === 'hab' ? [t('mp_takeoff'), `${fmt(r.takeoff)} kg (${fmtSigned(r.massDelta)} kg)`] : [t('gb_ballast'), `${fmt(r.ballast)} kg`]]))]),
        h('div.card', [h('div.card-head', h('div.section-title', t('wiz_s5'))), h('div.card-body', kv([[t('meeting'), b.schedule.meetingLat != null ? placeLine({ name: b.schedule.meetingName, lat: b.schedule.meetingLat, lon: b.schedule.meetingLon }) : (b.schedule.meetingName || '–')]].concat(b.schedule.skip ? [[t('sch_title'), t('sch_skipped')]] : rows.map((row) => [hhmm(z, row.ms), scheduleRowLabel(row, b, t, S.activities?.custom)]))))]),
        h('div.card', [h('div.card-head', h('div.section-title', t('wiz_mandatory'))), h('div.card-body', [h('ul.mand', mandatoryPanels(S, b).map((p) => h('li', h('b', tt(p))))), h('div.note', t('wiz_createHint'))])]),
      ]),
    );
  }

  draw();
}
