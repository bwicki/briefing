/* Fahrtbriefing — Bausteine, die Ablauf, Erarbeitungssicht und Briefingsicht teilen:
 * Sonne/Mond-Block, Tragkraft-/Ballast-Editor, Zeitplan-Editor. */
import { h, clear, num, fmt, fmtSigned, toast, uid } from '../util.js';
import { t, tt, getLang } from '../i18n.js';
import { field, input, select, kv, stats, liftCurve } from './widgets.js';
import { sunFor, massPerf, fillFractionOf, scheduleFor, setStart, ensurePlan, actLabel } from '../model.js';
import { placeLine, pickPlace } from './place.js';
import { hhmm, localParts, fmtDur, fmtDate } from '../calc/time.js';
import { icao } from '../calc/geo.js';
import { moonPhaseName } from '../calc/sun.js';
import { racValidity } from '../calc/rac.js';
import { siteWeatherAt, route } from '../net.js';
import { trailerMinutes, ACT_TYPES, ACT_DEFAULT_MIN, ACT_PLACE, planOrderWarnings } from '../calc/schedule.js';
import { CYLINDER_CATALOG } from '../calc/aero.js';
import { icon, iconSvg } from './icons.js';

const tzOf = (b) => b.site.tz || 'Europe/Zurich';

/** Sonne/Mond als Datenzeilen (für Editor und Druck). */
export function sunRows(b, ctx) {
  const sun = sunFor(b, ctx.settings, ctx.racTable);
  if (!sun) return { sun: null, rows: [] };
  const z = tzOf(b);
  const f = (ms) => (ms ? hhmm(z, ms) : '–');
  const rows = [
    [`${t('bcmt')} / ${t('sr')} / ${t('ss')} / ${t('ecet')} LT`, h('span', [h('b', `${f(sun.official.bcmt)} · ${f(sun.official.sr)} · ${f(sun.official.ss)} · ${f(sun.official.ecet)}`), ' ', h('span.muted.small', sun.source === 'rac' ? `(${t('sun_rac')})` : sun.source === 'dwd' ? `(${t('sun_dwd', { id: sun.dwdArea })})` : `(${t('sun_astro')})`)])],
    sun.source === 'rac' ? [t('sun_astro'), `${f(sun.astro.bcmt)} · ${f(sun.astro.sr)} · ${f(sun.astro.ss)} · ${f(sun.astro.ecet)}`] : null,
    [t('sun_moon'), `${t('sun_moonrise')} ${f(sun.moon.rise)} · ${t('sun_moonset')} ${f(sun.moon.set)} · ${moonPhaseName(sun.moon.phase, getLang())} · ${Math.round(sun.moon.fraction * 100)} % ${t('sun_illum')}`],
    ['UTC', `${f(sun.official.bcmt) && hhmm('UTC', sun.official.bcmt)} · ${hhmm('UTC', sun.official.sr)} · ${hhmm('UTC', sun.official.ss)} · ${hhmm('UTC', sun.official.ecet)}`],
  ];
  if (sun.nvfr) rows.push([t('nvfr'), `${t('nvfr_planned')}${sun.startBeforeBcmt ? ` · ${t('nvfr_start')}` : ''}${sun.landingAfterEcet ? ` · ${t('nvfr_landing')}` : ''}`]);
  const warns = [];
  if (sun.racMissing) warns.push(t('sun_racMissing', { v: ctx.racTable ? racValidity(ctx.racTable) : '–' }));
  if (sun.nightStart) warns.push(t('nightWarn', { t: hhmm(z, b.time.startMs), b: f(sun.official.bcmt) }));
  if (sun.nightLanding) warns.push(t('nightLandWarn', { e: f(sun.official.ecet) }));
  return { sun, rows, warns };
}

export function sunBlock(b, ctx) {
  const { rows, warns } = sunRows(b, ctx);
  return h('div', [kv(rows), ...warns.map((w) => h('div.warn', '⚠ ' + w))]);
}

/** Tragkraft (Heissluft) / Ballast (Gas): Vorgaben (Eingaben) klar getrennt von Resultaten. onChange() nach Eingabe. */
export function massPerfEditor(b, ctx, onChange, readOnly = false) {
  const wrap = h('div.mp');
  const w = b.weather, bal = b.balloon;
  const inputsBox = h('div.frow.c4');
  const out = h('div');
  const mk = (key, label, step = 1) => { const el = input('number', w[key] ?? '', { step, readOnly, oninput: (e) => { w[key] = num(e.target.value, null); w.source = 'manual'; draw(); onChange(); } }); return field(label, el); };
  const modelBtn = h('button.btn', { type: 'button', onclick: async () => {
    try { const p = localParts(tzOf(b), b.time.startMs); const m = await siteWeatherAt(b.site.lat, b.site.lon, b.time.date, p.hh);
      Object.assign(w, { tempC: Math.round(m.tempC * 10) / 10, rh: m.rh, qnh: Math.round(m.qnh), source: 'model', stand: new Date().toISOString().slice(0, 16).replace('T', ' ') + ' UTC' });
      redrawInputs(); draw(); onChange(); toast(t('ok'));
    } catch (e) { toast(`${t('error')}: ${e.message}`); }
  } }, t('mp_fromModel'));
  const srcNote = h('div.note');
  function redrawInputs() {
    clear(inputsBox);
    inputsBox.append(mk('tempC', `${t('mp_temp')} (°C)`, 0.5), mk('qnh', `${t('mp_qnh')} (hPa)`), mk('rh', `${t('mp_rh')} (%)`));
    if (bal.type === 'hab') { const f = mk('envTempC', `${t('mp_envTemp')} (°C)`, 5); f.appendChild(h('div.note.small', t('mp_envDefault', { r: bal.reg || bal.id || '', t: bal.envTempC ?? '–' }))); inputsBox.append(f); }
    else {
      const f = mk('fillPct', `${t('gb_fillPct')} (%)`, 5); f.appendChild(h('div.note.small', t('gb_fillDefault'))); inputsBox.append(f);
      if (ctx.settings.expert) inputsBox.append(mk('gasDeltaT', `${t('gb_gasDeltaT')} (K)`));
    }
  }
  const section = (title, cls, children) => h('div.mp-sec.' + cls, [h('div.lbl', title), ...children]);
  function draw() {
    clear(out);
    srcNote.textContent = w.source === 'model' ? t('mp_modelStand', { t: w.stand || '' }) : (w.rh == null ? t('mp_dry') : '');
    const { type, r } = massPerf(b, ctx.settings);
    if (type === 'hab') {
      const m = bal.masses;
      const cylRows = (b.cylinders || bal.cylinders).map((c, i) => h('tr', [h('td', c.name), h('td', readOnly ? String(c.count) : input('number', c.count, { min: 0, step: 1, oninput: (e) => { if (!b.cylinders) b.cylinders = JSON.parse(JSON.stringify(bal.cylinders)); b.cylinders[i].count = num(e.target.value); draw(); onChange(); } })), h('td', fmt(c.litres)), h('td', fmt(c.gasKg)), h('td', fmt(c.totalKg)), h('td', fmt(c.count * c.totalKg))]));
      out.append(
        // Vorgaben aus dem Stamm (Ballonprofil) – nur lesen
        section(t('mp_given'), 'given', [kv([[t('mp_volume'), `${fmt(bal.volume)} m³`], [t('mp_siteAlt'), `${fmt(b.site.elev)} m AMSL`], [t('mp_equip'), `${m.envelope} / ${m.burner} / ${m.basket} / ${m.equipment} kg`], [t('mp_total'), `${fmt(r.equipMass)} kg`], [t('mp_persons'), `${1 + b.persons.pax.length} · ${fmt(r.paxMass)} kg`], [t('mp_cylMass'), `${fmt(r.cylMass)} kg`]])]),
        // Resultate Masse
        section(t('mp_resMass'), 'res', [stats([[t('mp_takeoff'), `${fmt(r.takeoff)} kg`], [t('mp_allowed'), `${fmt(r.allowed)} kg`, null, t(r.limitBy === 'mtom' ? 'mp_limitMtom' : 'mp_limitLift', { l: fmt(r.liftAtSite), m: fmt(r.mtom) })], [t('mp_delta'), `${fmtSigned(r.massDelta)} kg`, r.massDelta > 0 ? 'neg' : 'pos'], [t('mp_required'), `${r.required.toFixed(3)} kg/m³`]])]),
        // Resultate Höhe / Hüllentemperatur
        section(t('mp_resAlt'), 'res', [h('div.alt-grid', [stats([[t('mp_maxAlt'), r.maxAltExcel != null ? `${fmt(r.maxAltExcel)} m AMSL` : '> 10 000 m'], [t('mp_maxAltExact'), r.maxAltExact != null ? `${fmt(r.maxAltExact)} m` : '–'], [t('mp_envReq'), r.envReq != null ? `${fmt(r.envReq)} °C` : '–', r.envReq != null && r.envReq > (w.envTempC ?? bal.envTempC) ? 'neg' : 'pos'], [t('mp_envMargin', { t: w.envTempC ?? bal.envTempC }), r.envMargin != null ? `${fmtSigned(r.envMargin)} K` : '–', r.envMargin < 0 ? 'neg' : ''], [t('mp_maxAgl'), r.maxAltExcel != null ? `${fmt(Math.max(0, r.maxAltExcel - (b.site.elev || 0)))} m AGL` : '–'], [t('mp_envTemp'), `${w.envTempC ?? bal.envTempC} °C`]]), h('figure.curve-fig', [liftCurve(r.rows, r.takeoff, r.maxAltExcel, { envTempC: w.envTempC ?? bal.envTempC, siteAlt: b.site.elev || 0, ceilingLabel: t('mp_ceiling', { t: w.envTempC ?? bal.envTempC }) }), h('figcaption.mini', t('mp_curve'))])])]),
        // Gasplanung (Vorgabe: Flaschen; Resultat: Vorrat, Dauer, Bedarf)
        section(t('mp_gasPlan'), 'gas', [
          h('table.cyl', [h('thead', h('tr', [h('th', t('mp_cyl')), h('th', t('mp_count')), h('th', 'l (80 %)'), h('th', 'kg Gas'), h('th', 'kg'), h('th', 'kg total')])), h('tbody', cylRows)]),
          stats([[t('mp_usable'), `${fmt(r.usable)} kg (${Math.round((bal.usableFraction ?? 0.9) * 100)} % von ${fmt(r.gasKg)})`], [t('mp_burn'), `${fmt(r.burn)} kg/h`], [t('mp_endurance'), fmtDur(r.enduranceMin)], [t('mp_enduranceRes'), fmtDur(r.enduranceExcelReserve)]]),
          stats([[t('mp_need', { d: fmtDur(b.intent.durationMin), r: `${Math.round(r.reserveMin)} min` }), `${fmt(r.needKg)} kg`], [t('mp_margin'), `${fmtSigned(r.fuelMargin)} kg`, r.fuelMargin < 0 ? 'neg' : 'pos']]),
        ]),
      );
    } else {
      out.append(
        section(t('mp_given'), 'given', [kv([[t('mp_volume'), `${fmt(bal.volume)} m³ · ${t('gb_fillPct')} ${Math.round(fillFractionOf(b) * 100)} % = ${fmt(bal.volume * fillFractionOf(b))} m³`], [t('b_gas'), `${bal.gas} · ${t('gb_purity')} ${Math.round((bal.purity ?? 1) * 1000) / 10} %`], [t('mp_siteAlt'), `${fmt(b.site.elev)} m AMSL`], [t('gb_net'), `${fmt(r.net)} kg (${bal.masses.envelope} + ${bal.masses.basket} + ${bal.masses.equipment + (bal.masses.instruments || 0)} + ${fmt(r.paxMass)})`], [t('mp_persons'), `${1 + b.persons.pax.length} · ${fmt(r.paxMass)} kg`], [t('gb_reserve'), `${bal.reserveUnits || 0} × ${bal.ballastUnitKg || 0} kg = ${fmt(r.reserveKg)} kg`]])]),
        section(t('mp_resBallast'), 'res', [
          stats([[t('gb_rhoAir'), `${r.rhoAir.toFixed(4)} kg/m³`], [t('gb_rhoGas'), `${r.rhoGas.toFixed(4)} kg/m³`], [t('gb_gasMass'), `${fmt(r.gasMass)} kg`], [t('gb_gross'), `${fmt(r.grossLift)} kg`]]),
          stats([[t('gb_ballast'), `${fmt(r.ballast)} kg`, r.ballast < r.reserveKg ? 'neg' : 'pos'], ['%', `${fmt(r.ballastPct, 1)} %`], [t('gb_units'), r.units != null ? `${fmt(r.units, 1)} × ${bal.ballastUnitKg} kg` : '–'], [t('gb_cooling'), `${fmt(r.coolingLossPerK, 1)} kg/K`], [t('gb_per100'), `${fmt(r.ballastPer100m, 1)} kg`]]),
        ]),
      );
    }
  }
  redrawInputs();
  wrap.append(section(t('mp_inputs'), 'in', [inputsBox, readOnly ? srcNote : h('div.row-actions', [modelBtn, srcNote])]), out);
  draw();
  return wrap;
}

/** Etappen (Treffpunkte) der Anfahrt: Liste mit Ort, Fahrzeit zur nächsten Etappe, Umsortieren
 * per Ziehen (oder ▲▼); «+» über box.addFn. Jede Änderung löscht die Abfahrts-Pins. */
/** Tabellarischer Zeitplan: Zeilen = Aktivitäten (Dropdown), Info, Dauer, Zeit (Pin) und Ort; Zeilen per Ziehen
 *  oder ▲▼ verschiebbar – die Zeiten laufen mit (Anker «Start»). Fahrten werden geroutet (OSRM, Anhängerfaktor),
 *  wenn Ort davor und danach bekannt sind. */
/** Zeilenklasse nach Dämmerung: night (vor BCMT / nach ECET), dusk (BCMT–SR, SS–ECET), sonst ''. */
export function twilightClass(sun) {
  if (!sun?.official) return () => '';
  const o = sun.official;
  return (ms) => (ms < o.bcmt || ms > o.ecet ? 'night' : ms < o.sr || ms > o.ss ? 'dusk' : '');
}
export function scheduleEditor(b, ctx, onChange, readOnly = false, opts = {}) {
  const S = ctx.settings, sc = b.schedule, z = tzOf(b);
  ensurePlan(b);
  const wrap = h('div');
  const table = h('table.sched.plan');
  const warnBox = h('div');
  const ACTS = S.activities || {};
  const customs = ACTS.custom || [];
  const hiddenActs = new Set(ACTS.hidden || []);
  const usedTypes = new Set(sc.plan.map((x) => x.type));
  const typeOpts = ACT_TYPES.filter((k) => !hiddenActs.has(k) || usedTypes.has(k)).map((k) => ({ value: k, label: t('act_' + k) }))
    .concat(customs.map((a) => ({ value: 'custom:' + a.id, label: tt(a) || t('act_custom') })));
  const typeValue = (it) => (it.type === 'custom' && it.act ? 'custom:' + it.act : it.type);
  const defMin = (type, act) => { if (act) { const a = customs.find((x) => x.id === act); if (a?.min != null) return a.min; } return ACTS.minutes?.[type] ?? ACT_DEFAULT_MIN[type]; };
  const placeKind = (it) => (it.type === 'custom' && it.act ? ((customs.find((x) => x.id === it.act) || {}).place === false ? false : true) : ACT_PLACE[it.type]);
  const meetings = (ctx.stamm?.meetings || []).filter((m) => m.lat != null);
  let dragFrom = null;
  const placeOf = (it) => (ACT_PLACE[it.type] === 'site' ? b.site : ACT_PLACE[it.type] === 'landing' ? (b.landing?.lat != null ? b.landing : null) : it.place);
  const prevPlace = (k) => { for (let i = k - 1; i >= 0; i--) { const pl = placeOf(sc.plan[i]); if (pl?.lat != null) return pl; } return null; };
  const nextPlace = (k) => { for (let i = k + 1; i < sc.plan.length; i++) { const pl = placeOf(sc.plan[i]); if (pl?.lat != null) return pl; } return null; };
  /** Fahrt routen: eigener Ort = Ziel, sonst nächster Ort; Start = vorheriger Ort. */
  async function routeDrive(k) {
    const it = sc.plan[k]; if (!it || (it.type !== 'drive' && it.type !== 'return') || it.minSource === 'manual') return;
    const from = prevPlace(k), to = it.place?.lat != null ? it.place : nextPlace(k);
    if (!from || !to) return;
    try { const r = await route(from.lat, from.lon, to.lat, to.lon); it.min = trailerMinutes(r.seconds, S.scheduleDefaults.trailerFactor, S.scheduleDefaults.surchargeMin); it.km = Math.round(r.meters / 1000); it.minSource = 'routing'; }
    catch { /* Routing nicht verfügbar – Dauer bleibt */ }
  }
  async function routeAll() { await Promise.all(sc.plan.map((_, k) => routeDrive(k))); redraw(); onChange(); }
  const clearPins = () => { for (const it of sc.plan) delete it.pin; };
  function move(k, to) { if (to < 0 || to >= sc.plan.length) return; const [it] = sc.plan.splice(k, 1); sc.plan.splice(to, 0, it); routeAll(); }
  function redraw() {
    clear(table); clear(warnBox);
    const sun = sunFor(b, S, ctx.racTable);
    const { rows, warnings } = scheduleFor(b, sun);
    sc.rows = rows.map((r) => ({ key: r.key, ms: r.ms }));
    const twilight = twilightClass(sun);
    table.appendChild(h('thead', h('tr', [readOnly ? null : h('th'), h('th', t('sch_colTime')), h('th', t('sch_colAct')), h('th', t('sch_colInfo')), h('th', t('sch_colMin')), h('th', t('sch_colPlace')), readOnly ? null : h('th')])));
    const tbody = h('tbody');
    rows.forEach((r, k) => {
      const it = sc.plan[k];
      const isStart = it.type === 'start';
      const dd = localParts(z, r.ms).d !== localParts(z, b.time.startMs).d ? ` (${fmtDate(z, r.ms, getLang()).split(' ')[0]})` : '';
      const tIn = readOnly ? h('span.mono', hhmm(z, r.ms) + dd) : input('time', hhmm(z, r.ms), { onchange: (e) => {
        const [hh, mm] = e.target.value.split(':').map(Number); const p = localParts(z, r.ms);
        const ms = Date.UTC(p.y, p.m - 1, p.d, hh, mm) - p.off * 60000;
        if (isStart) setStart(b, `${p.y}-${String(p.m).padStart(2, '0')}-${String(p.d).padStart(2, '0')}`, e.target.value); else it.pin = ms;
        redraw(); onChange();
      } });
      if (r.overridden && !readOnly) tIn.classList.add('ov');
      const typeSel = readOnly ? h('b', actLabel(it, t, customs)) : select(typeOpts, typeValue(it), { onchange: (e) => {
        const v = e.target.value; const nt = v.startsWith('custom:') ? 'custom' : v; const act = v.startsWith('custom:') ? v.slice(7) : null;
        if (nt !== 'start' && it.type === 'start') { e.target.value = 'start'; return; }
        it.type = nt; it.act = act || undefined;
        it.min = nt === 'flight' ? null : defMin(nt, act);
        const pk2 = placeKind(it); if (!pk2 || typeof pk2 === 'string') it.place = null;
        if (nt !== 'meet') { delete it.meetingId; it.name = ''; }
        routeAll();
      } });
      const infoIn = readOnly ? h('span', it.info || '') : input('text', it.info || '', { placeholder: t('sch_infoHint'), oninput: (e) => { it.info = e.target.value; onChange(); } });
      // Dauer der Ballonfahrt: Quelle ist «Was ist geplant» – Änderung hier schreibt dorthin zurück
      const minIn = readOnly ? h('span.mono', `${r.dur}`) : input('number', it.type === 'flight' ? b.intent.durationMin : (it.min ?? defMin(it.type, it.act) ?? 0), { step: 5, min: 0, title: it.type === 'flight' ? t('sch_flightFromIntent') : it.minSource === 'routing' ? `${t('driveAuto')}${it.km ? ` · ${it.km} km` : ''}` : '', oninput: (e) => { if (it.type === 'flight') { b.intent.durationMin = num(e.target.value, 0); it.min = null; } else { it.min = num(e.target.value, 0); if (it.type === 'drive' || it.type === 'return') it.minSource = 'manual'; } redraw(); onChange(); opts.onIntent?.(); } });
      if (it.minSource === 'routing' && !readOnly) minIn.classList.add('auto');
      // Ort: Startplatz/Landeraum aus dem Briefing, sonst wählbar (kompakt: Name · Wählen/✎ · ✕)
      let placeCell;
      const pk = placeKind(it);
      const pname = (p) => (p?.name ? h('span.pname', p.name) : h('span.mono', icao(p.lat, p.lon)));
      const pick = async () => { const p = await pickPlace(it.place, { title: actLabel(it, t, customs), from: prevPlace(k) }); if (p) { it.place = { name: p.name || '', lat: p.lat, lon: p.lon }; if (it.type === 'meet') { it.name = p.name || it.name; it.meetingId = meetings.find((m) => m.lat === p.lat && m.lon === p.lon)?.id || 'custom'; } routeAll(); } };
      if (pk === 'site') placeCell = pname(b.site);
      else if (pk === 'landing') placeCell = b.landing?.lat != null ? pname(b.landing) : h('span.muted', t('landingSite') + ' –');
      else if (it.type === 'meet' && !readOnly) {
        // Treffpunkt: Auswahl aus dem Stamm (Treffpunkte) oder «anderer …» per Ortswahl
        const curId = it.meetingId && meetings.some((m) => m.id === it.meetingId) ? it.meetingId : (it.place?.lat != null ? 'custom' : '');
        const mOpts = [{ value: '', label: '–' }, ...meetings.map((m) => ({ value: m.id, label: m.name })), { value: 'custom', label: it.place?.lat != null && curId === 'custom' ? `${it.place.name || icao(it.place.lat, it.place.lon)} …` : t('meetingCustom') + ' …' }];
        const mSel = select(mOpts, curId, { onchange: async (e) => {
          const v = e.target.value;
          if (v === 'custom') { await pick(); return; }
          const m = meetings.find((x) => x.id === v);
          if (m) { it.meetingId = m.id; it.name = m.name; it.place = { name: m.name, lat: m.lat, lon: m.lon }; } else { it.meetingId = ''; it.name = ''; it.place = null; }
          routeAll();
        } });
        placeCell = h('span.pcell', [mSel, it.place?.lat != null ? h('button.btn.icon.small.ghost', { type: 'button', title: t('pick_change'), onclick: pick }, icon('edit', 14)) : null]);
      } else if (pk && !readOnly) {
        placeCell = h('span.pcell', [
          it.place?.lat != null ? pname(it.place) : h('span.muted', '–'),
          h('button.btn.icon.small', { type: 'button', title: it.place?.lat != null ? t('pick_change') : t('pick_choose'), onclick: pick }, icon(it.place?.lat != null ? 'edit' : 'place', 16)),
          it.place?.lat != null ? h('button.btn.icon.small.ghost', { type: 'button', title: t('remove'), onclick: () => { it.place = null; routeAll(); } }, icon('close', 14)) : null,
        ]);
      } else if (pk && it.place?.lat != null) placeCell = placeLine(it.place, { noElev: true });
      else placeCell = h('span.muted', '–');
      const row = h('tr', { draggable: !readOnly, class: [isStart ? 'anchor' : '', twilight(r.ms)].filter(Boolean).join(' ') }, [
        readOnly ? null : h('td.handle', [h('span.handle', { title: t('sch_drag') }, icon('grip', 16)), h('span.updown', [h('button.tiny', { type: 'button', title: t('sch_moveUp'), disabled: k === 0, onclick: () => move(k, k - 1) }, '▲'), h('button.tiny', { type: 'button', title: t('sch_moveDown'), disabled: k === rows.length - 1, onclick: () => move(k, k + 1) }, '▼')])]),
        h('td.tm', [tIn, r.overridden && !readOnly ? h('button.btn.icon.small', { type: 'button', title: t('recompute'), onclick: () => { delete it.pin; redraw(); onChange(); } }, '↺') : null]),
        h('td.act', typeSel),
        h('td.info', infoIn),
        h('td.min', minIn),
        h('td.place', { class: pk ? '' : 'none' }, placeCell),
        readOnly ? null : h('td.ops', [h('button.btn.icon.small', { type: 'button', title: t('remove'), disabled: isStart, onclick: () => { sc.plan.splice(k, 1); routeAll(); } }, icon('close', 14))]),
      ]);
      if (!readOnly) {
        row.addEventListener('dragstart', (e) => { dragFrom = k; e.dataTransfer.effectAllowed = 'move'; row.classList.add('dragging'); });
        row.addEventListener('dragend', () => row.classList.remove('dragging'));
        row.addEventListener('dragover', (e) => { e.preventDefault(); row.classList.add('over'); });
        row.addEventListener('dragleave', () => row.classList.remove('over'));
        row.addEventListener('drop', (e) => { e.preventDefault(); row.classList.remove('over'); if (dragFrom != null && dragFrom !== k) move(dragFrom, k); dragFrom = null; });
      }
      tbody.appendChild(row);
    });
    table.appendChild(tbody);
    for (const wkey of warnings) warnBox.appendChild(h('div.warn', '⚠ ' + (wkey === 'nightStart' ? t('nightWarn', { t: hhmm(z, b.time.startMs), b: hhmm(z, sun.official.bcmt) }) : wkey === 'nightLanding' ? t('nightLandWarn', { e: hhmm(z, sun.official.ecet) }) : (getLang() === 'en' ? 'Return after sunset' : 'Rückfahrt nach Sonnenuntergang'))));
    for (const ow of planOrderWarnings(sc.plan)) warnBox.appendChild(h('div.warn', '⚠ ' + t('sch_orderWarn', { a: t('act_' + ow.a), b: t('act_' + ow.b) })));
    if (sun && !readOnly) warnBox.appendChild(h('div.note.small.sch-legend', [h('span.sw.night'), ` ${t('sch_legendNight')} · `, h('span.sw.dusk'), ` ${t('sch_legendDusk', { b: hhmm(z, sun.official.bcmt), s: hhmm(z, sun.official.sr), ss: hhmm(z, sun.official.ss), e: hhmm(z, sun.official.ecet) })}`]));
  }
  const addRow = (type = 'custom') => { const a = sc.plan.findIndex((x) => x.type === 'start'); const it = { id: uid(5), type, name: '', info: '', min: type === 'flight' ? null : defMin(type), place: null }; sc.plan.splice(a >= 0 ? a : sc.plan.length, 0, it); redraw(); onChange(); setTimeout(() => table.querySelectorAll('tbody tr')[Math.max(0, a)]?.querySelector('select')?.focus(), 30); };
  table.addFn = () => addRow('custom');
  if (!readOnly) {
    // «Vorlage neu»: zweistufig (erster Klick fragt, zweiter innert 4 s führt aus) – kein Browser-Dialog
    let armed = null;
    const tplBtn = h('button.btn.small', { type: 'button', onclick: () => {
      if (armed) { clearTimeout(armed); armed = null; tplBtn.textContent = t('sch_template'); sc.plan = null; ensurePlan(b); routeAll(); return; }
      tplBtn.textContent = t('sch_templateConfirm'); armed = setTimeout(() => { armed = null; tplBtn.textContent = t('sch_template'); }, 4000);
    } }, t('sch_template'));
    wrap.append(h('div.sched-tools', [
      h('button.btn.small', { type: 'button', onclick: () => addRow('custom') }, `+ ${t('sch_addRow')}`),
      h('button.btn.small', { type: 'button', onclick: () => { clearPins(); for (const it of sc.plan) if (it.minSource === 'manual') it.minSource = ''; routeAll(); } }, t('recompute')),
      tplBtn,
      h('span.note', t('sch_rule')),
    ]));
  }
  wrap.append(h('div.sched-wrap', h('div.tbl-scroll', table)), warnBox);
  redraw();
  wrap.addFn = table.addFn;
  wrap.routeAll = routeAll;
  return wrap;
}

export const cylinderCatalog = CYLINDER_CATALOG;
