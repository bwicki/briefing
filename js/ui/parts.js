/* Fahrtbriefing — Bausteine, die Ablauf, Erarbeitungssicht und Briefingsicht teilen:
 * Sonne/Mond-Block, Tragkraft-/Ballast-Editor, Zeitplan-Editor. */
import { h, clear, num, fmt, fmtSigned, toast, uid } from '../util.js';
import { t, getLang } from '../i18n.js';
import { field, input, select, kv, stats, liftCurve, check, fieldAdd } from './widgets.js';
import { sunFor, massPerf, scheduleFor, setStart, ensureStops, syncMeeting, scheduleRowLabel } from '../model.js';
import { stammLabel } from '../stamm.js';
import { placeRow, placeLine, typeToPick } from './place.js';
import { hhmm, localParts, fmtDur, fmtDate } from '../calc/time.js';
import { moonPhaseName } from '../calc/sun.js';
import { racValidity } from '../calc/rac.js';
import { siteWeatherAt, route } from '../net.js';
import { trailerMinutes } from '../calc/schedule.js';
import { CYLINDER_CATALOG } from '../calc/aero.js';

const tzOf = (b) => b.site.tz || 'Europe/Zurich';

/** Sonne/Mond als Datenzeilen (für Editor und Druck). */
export function sunRows(b, ctx) {
  const sun = sunFor(b, ctx.settings, ctx.racTable);
  if (!sun) return { sun: null, rows: [] };
  const z = tzOf(b);
  const f = (ms) => (ms ? hhmm(z, ms) : '–');
  const rows = [
    [`${t('bcmt')} / ${t('sr')} / ${t('ss')} / ${t('ecet')} LT`, h('span', [h('b', `${f(sun.official.bcmt)} · ${f(sun.official.sr)} · ${f(sun.official.ss)} · ${f(sun.official.ecet)}`), ' ', h('span.muted.small', sun.source === 'rac' ? `(${t('sun_rac')})` : `(${t('sun_astro')})`)])],
    sun.source === 'rac' ? [t('sun_astro'), `${f(sun.astro.bcmt)} · ${f(sun.astro.sr)} · ${f(sun.astro.ss)} · ${f(sun.astro.ecet)}`] : null,
    [t('sun_moon'), `${t('sun_moonrise')} ${f(sun.moon.rise)} · ${t('sun_moonset')} ${f(sun.moon.set)} · ${moonPhaseName(sun.moon.phase, getLang())} · ${Math.round(sun.moon.fraction * 100)} % ${t('sun_illum')}`],
    ['UTC', `${f(sun.official.bcmt) && hhmm('UTC', sun.official.bcmt)} · ${hhmm('UTC', sun.official.sr)} · ${hhmm('UTC', sun.official.ss)} · ${hhmm('UTC', sun.official.ecet)}`],
  ];
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
    if (bal.type === 'hab') inputsBox.append(mk('envTempC', `${t('mp_envTemp')} (°C)`, 5));
    else if (ctx.settings.expert) inputsBox.append(mk('gasDeltaT', `${t('gb_gasDeltaT')} (K)`));
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
        section(t('mp_resMass'), 'res', [stats([[t('mp_takeoff'), `${fmt(r.takeoff)} kg`], [t('mp_mtom'), `${fmt(r.mtom)} kg`], [t('mp_delta'), `${fmtSigned(r.massDelta)} kg`, r.massDelta > 0 ? 'neg' : 'pos'], [t('mp_required'), `${r.required.toFixed(3)} kg/m³`]])]),
        // Resultate Höhe / Hüllentemperatur
        section(t('mp_resAlt'), 'res', [h('div.alt-grid', [stats([[t('mp_maxAlt'), r.maxAltExcel != null ? `${fmt(r.maxAltExcel)} m AMSL` : '> 10 000 m'], [t('mp_maxAltExact'), r.maxAltExact != null ? `${fmt(r.maxAltExact)} m` : '–'], [t('mp_envReq'), r.envReq != null ? `${fmt(r.envReq)} °C` : '–', r.envReq != null && r.envReq > (w.envTempC ?? bal.envTempC) ? 'neg' : 'pos'], [t('mp_envMargin', { t: w.envTempC ?? bal.envTempC }), r.envMargin != null ? `${fmtSigned(r.envMargin)} K` : '–', r.envMargin < 0 ? 'neg' : ''], [t('mp_maxAgl'), r.maxAltExcel != null ? `${fmt(Math.max(0, r.maxAltExcel - (b.site.elev || 0)))} m AGL` : '–'], [t('mp_envTemp'), `${w.envTempC ?? bal.envTempC} °C`]]), h('figure.curve-fig', [liftCurve(r.rows, r.takeoff, r.maxAltExcel), h('figcaption.mini', t('mp_curve'))])])]),
        // Gasplanung (Vorgabe: Flaschen; Resultat: Vorrat, Dauer, Bedarf)
        section(t('mp_gasPlan'), 'gas', [
          h('table.cyl', [h('thead', h('tr', [h('th', t('mp_cyl')), h('th', t('mp_count')), h('th', 'l (80 %)'), h('th', 'kg Gas'), h('th', 'kg'), h('th', 'kg total')])), h('tbody', cylRows)]),
          stats([[t('mp_usable'), `${fmt(r.usable)} kg (${Math.round((bal.usableFraction ?? 0.9) * 100)} % von ${fmt(r.gasKg)})`], [t('mp_burn'), `${fmt(r.burn)} kg/h`], [t('mp_endurance'), fmtDur(r.enduranceMin)], [t('mp_enduranceRes'), fmtDur(r.enduranceExcelReserve)]]),
          stats([[t('mp_need', { d: fmtDur(b.intent.durationMin), r: `${Math.round(r.reserveMin)} min` }), `${fmt(r.needKg)} kg`], [t('mp_margin'), `${fmtSigned(r.fuelMargin)} kg`, r.fuelMargin < 0 ? 'neg' : 'pos']]),
        ]),
      );
    } else {
      out.append(
        section(t('mp_given'), 'given', [kv([[t('mp_volume'), `${fmt(bal.volume)} m³ (${Math.round((bal.fillFraction ?? 1) * 100)} %)`], [t('b_gas'), `${bal.gas} · ${t('gb_purity')} ${Math.round((bal.purity ?? 1) * 1000) / 10} %`], [t('mp_siteAlt'), `${fmt(b.site.elev)} m AMSL`], [t('gb_net'), `${fmt(r.net)} kg (${bal.masses.envelope} + ${bal.masses.basket} + ${bal.masses.equipment + (bal.masses.instruments || 0)} + ${fmt(r.paxMass)})`], [t('mp_persons'), `${1 + b.persons.pax.length} · ${fmt(r.paxMass)} kg`], [t('gb_reserve'), `${bal.reserveUnits || 0} × ${bal.ballastUnitKg || 0} kg = ${fmt(r.reserveKg)} kg`]])]),
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
export function stopsEditor(b, ctx, onChange, opts = {}) {
  const S = ctx.settings, sc = b.schedule;
  ensureStops(sc);
  const box = h('div.stops');
  const meetOpts = () => ctx.stamm.meetings.map((m) => ({ value: m.id, label: stammLabel(m, m.name) })).concat([{ value: 'custom', label: t('meetingCustom') }]);
  const clearDepartPins = () => { for (const k of Object.keys(sc.overrides || {})) if (k.startsWith('depart:')) delete sc.overrides[k]; };
  const changed = () => { syncMeeting(sc); onChange(); };
  async function routeLeg(k) {
    const a = sc.stops[k]; if (!a) return;
    const nx = sc.stops[k + 1] || { lat: b.site.lat, lon: b.site.lon };
    if (a.lat == null || nx.lat == null) { a.driveSource = a.driveMin == null ? '' : 'manual'; return; }
    try {
      const r = await route(a.lat, a.lon, nx.lat, nx.lon);
      a.driveMin = trailerMinutes(r.seconds, S.scheduleDefaults.trailerFactor, S.scheduleDefaults.surchargeMin); a.driveKm = Math.round(r.meters / 1000); a.driveSource = 'routing';
    } catch (e) { a.driveSource = 'manual'; if (a.driveMin == null) a.driveMin = 30; }
  }
  async function routeAll() { await Promise.all(sc.stops.map((_, k) => routeLeg(k))); draw(); changed(); }
  function move(k, to) { if (to < 0 || to >= sc.stops.length) return; const [st] = sc.stops.splice(k, 1); sc.stops.splice(to, 0, st); clearDepartPins(); routeAll(); }
  let dragFrom = null;
  function draw() {
    clear(box);
    sc.stops.forEach((st, k) => {
      const last = k === sc.stops.length - 1;
      const custom = input('text', st.meetingId === 'custom' || !st.meetingId ? st.name : '', { placeholder: t('meeting') }); custom.hidden = !!st.meetingId && st.meetingId !== 'custom';
      typeToPick(custom, () => ({ name: st.name, lat: st.lat, lon: st.lon, elev: null }), { title: t('meeting'), onPick: (p) => { st.name = p.name; st.lat = p.lat; st.lon = p.lon; st.meetingId = 'custom'; clearDepartPins(); routeAll(); }, onCancel: (v) => { st.name = v; changed(); } });
      const sel = select(meetOpts(), st.meetingId || 'custom', { onchange: (e) => { st.meetingId = e.target.value; const m = ctx.stamm.meetings.find((x) => x.id === st.meetingId); if (m) { st.name = m.name; st.lat = m.lat ?? null; st.lon = m.lon ?? null; } else { st.name = custom.value; st.lat = null; st.lon = null; } custom.hidden = st.meetingId !== 'custom'; clearDepartPins(); routeAll(); } });
      const drive = input('number', st.driveMin ?? '', { step: 5, min: 0, style: { width: '84px' }, title: last ? t('sch_driveSite') : t('sch_driveNext'), oninput: (e) => { st.driveMin = num(e.target.value, null); st.driveSource = 'manual'; clearDepartPins(); changed(); redrawTimes(); } });
      const place = placeRow({ name: st.name, lat: st.lat, lon: st.lon }, { label: '', title: t('meeting'), noName: true, onPick: (p) => { st.lat = p.lat; st.lon = p.lon; if (!st.name || st.meetingId === 'custom') { st.name = st.name || p.name; custom.value = st.name; } st.meetingId = st.meetingId || 'custom'; clearDepartPins(); routeAll(); } });
      const row = h('div.stop-row', { draggable: true }, [
        h('div.stop-main', [
          h('span.handle', { title: t('sch_drag') }, '≡'),
          h('span.stop-no', String(k + 1)),
          h('div.stop-sel', [sel, custom]),
          h('button.btn.icon.small', { type: 'button', title: t('sch_moveUp'), disabled: k === 0, onclick: () => move(k, k - 1) }, '▲'),
          h('button.btn.icon.small', { type: 'button', title: t('sch_moveDown'), disabled: last, onclick: () => move(k, k + 1) }, '▼'),
          h('button.btn.icon.small', { type: 'button', title: t('remove'), disabled: sc.stops.length < 2, onclick: () => { sc.stops.splice(k, 1); clearDepartPins(); routeAll(); } }, '✕'),
        ]),
        h('div.stop-sub', [place, h('span.inline.small', [h('span.muted', `${last ? t('sch_driveSite') : t('sch_driveNext')}: `), drive, h('span.muted.small', st.driveSource === 'routing' ? ` ${t('driveAuto')}${st.driveKm ? ` · ${st.driveKm} km` : ''}` : st.driveSource === 'manual' ? ` ${t('driveManual')}` : '')])]),
      ]);
      row.addEventListener('dragstart', (e) => { dragFrom = k; e.dataTransfer.effectAllowed = 'move'; row.classList.add('dragging'); });
      row.addEventListener('dragend', () => row.classList.remove('dragging'));
      row.addEventListener('dragover', (e) => { e.preventDefault(); row.classList.add('over'); });
      row.addEventListener('dragleave', () => row.classList.remove('over'));
      row.addEventListener('drop', (e) => { e.preventDefault(); row.classList.remove('over'); if (dragFrom != null && dragFrom !== k) move(dragFrom, k); dragFrom = null; });
      box.appendChild(row);
    });
  }
  const redrawTimes = () => opts.onTimes?.();
  box.addFn = () => { sc.stops.push({ id: uid(5), meetingId: 'custom', name: '', lat: null, lon: null, driveMin: null, driveKm: null, driveSource: '', dwellMin: 0 }); clearDepartPins(); draw(); changed(); setTimeout(() => box.querySelectorAll('.stop-sel input')[sc.stops.length - 1]?.focus(), 30); };
  box.routeAll = routeAll;
  draw();
  if (sc.stops.some((st) => st.driveMin == null && st.lat != null) && b.site.lat != null) routeAll();
  return box;
}

/** Zeitplan-Tabelle mit Überschreibungen; opts.hideStops lässt die Etappen-Liste weg (Ablauf zeigt sie selbst). */
export function scheduleEditor(b, ctx, onChange, readOnly = false, opts = {}) {
  const S = ctx.settings, sc = b.schedule, z = tzOf(b);
  ensureStops(sc);
  const wrap = h('div');
  const table = h('table.sched');
  const warnBox = h('div');
  const note = h('div.note');
  const rigIn = input('number', sc.rigMin, { step: 5, readOnly, oninput: (e) => { sc.rigMin = num(e.target.value); redraw(); onChange(); } });
  const fillIn = input('number', sc.fillMin, { step: 5, readOnly, oninput: (e) => { sc.fillMin = num(e.target.value); redraw(); onChange(); } });
  const bufIn = input('number', sc.bufferMin, { step: 5, readOnly, oninput: (e) => { sc.bufferMin = num(e.target.value); redraw(); onChange(); } });
  function redraw() {
    clear(table); clear(warnBox);
    const sun = sunFor(b, S, ctx.racTable);
    const { rows, warnings } = scheduleFor(b, sun);
    sc.rows = rows.map((r) => ({ key: r.key, ms: r.ms }));
    for (const r of rows) {
      const tIn = readOnly ? h('span.mono', hhmm(z, r.ms)) : input('time', hhmm(z, r.ms), { onchange: (e) => {
        const [hh, mm] = e.target.value.split(':').map(Number); const p = localParts(z, r.ms);
        sc.overrides[r.key] = Date.UTC(p.y, p.m - 1, p.d, hh, mm) - p.off * 60000;
        if (r.key === 'start') { delete sc.overrides.start; setStart(b, `${p.y}-${String(p.m).padStart(2, '0')}-${String(p.d).padStart(2, '0')}`, e.target.value); }
        redraw(); onChange();
      } });
      if (r.overridden && !readOnly) tIn.classList.add('ov');
      const dd = localParts(z, r.ms).d !== localParts(z, b.time.startMs).d ? ` (${fmtDate(z, r.ms, getLang()).slice(0, 2)})` : '';
      table.appendChild(h('tr', [h('td.tm', tIn), h('td', [scheduleRowLabel(r, b, t), dd ? h('span.muted.small', dd) : null]), h('td.act', r.overridden && !readOnly ? h('button.btn.icon', { type: 'button', title: t('recompute'), onclick: () => { delete sc.overrides[r.key]; redraw(); onChange(); } }, '↺') : null)]));
    }
    for (const wkey of warnings) warnBox.appendChild(h('div.warn', '⚠ ' + (wkey === 'nightStart' ? t('nightWarn', { t: hhmm(z, b.time.startMs), b: hhmm(z, sun.official.bcmt) }) : wkey === 'nightLanding' ? t('nightLandWarn', { e: hhmm(z, sun.official.ecet) }) : (getLang() === 'en' ? 'Return after sunset' : 'Rückfahrt nach Sonnenuntergang'))));
  }
  const timeFields = [field(`${t('rigTime')} (min)`, rigIn), b.balloon.type === 'gas' ? field(`${t('fillTime')} (min)`, fillIn) : field(`${t('buffer')} (min)`, bufIn)];
  let stops = null;
  if (!readOnly && !opts.hideStops) { stops = stopsEditor(b, ctx, () => { redraw(); onChange(); }, { onTimes: redraw }); wrap.append(fieldAdd(t('sch_stops'), stops, () => stops.addFn(), t('sch_stopAdd'))); }
  if (!readOnly) wrap.append(
    h('div.frow.c3', [...timeFields, h('div.f', [h('label', ' '), h('div.row-actions', [h('button.btn', { type: 'button', onclick: () => { sc.overrides = {}; (stops || opts.stops)?.routeAll?.(); redraw(); onChange(); } }, t('recompute')), note])])]),
  );
  else wrap.append(h('div.note', [`${t('sch_stops')}: `, ...sc.stops.map((st, k) => h('span', [k ? ' → ' : '', st.lat != null ? placeLine({ name: st.name, lat: st.lat, lon: st.lon }) : (st.name || '–'), st.driveMin != null ? h('span.muted', ` (${st.driveMin} min)`) : null]))]));
  wrap.append(table, warnBox);
  if (!readOnly) wrap.append(h('div.note', t('sch_rule')));
  redraw();
  return wrap;
}

export const cylinderCatalog = CYLINDER_CATALOG;
