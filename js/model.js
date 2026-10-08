/* Fahrtbriefing — Briefing-Datensatz und abgeleitete Grössen.
 *
 * Ein Briefing ist ein JSON-Dokument (siehe newBriefing). Abgeleitete Werte
 * (Sonne, Tragkraft, Zeitplan, Phase) werden nicht gespeichert, sondern aus
 * den Eingaben gerechnet — so bleiben sie bei jeder Änderung konsistent.
 */
import { uid, deepCopy } from './util.js';
import { resolveBalloon, defaultBalloon } from './defaults.js';
import { fromLocal, localParts, isoDate, hhmm, addMin, fmtDate, fmtDateTime, fmtDur } from './calc/time.js';
import { sunTimes, moonTimes, moonIllumination, parseDwdAstro } from './calc/sun.js';
import { racLookup } from './calc/rac.js';
import { hotAir, gasBalloon } from './calc/aero.js';
import { buildSchedule, scheduleWarnings, buildPlan, planTemplate, planToStops } from './calc/schedule.js';
import { icao, bearing, distKm, compass, countryGuess, fixCountry } from './calc/geo.js';
import { PANELS, touchesCH, visiblePanels, panelFilled } from './panels.js';
import { stageSets, pruneStagePlans } from './calc/stageplan.js';
import { tt, t as tr } from './i18n.js';
import { routeMatrix, routeMatrixLine } from './countries.js';

export function newBriefing(settings, now = Date.now()) {
  const sel = defaultBalloon(settings);
  const bal = resolveBalloon(settings, sel);
  const forType = (s) => !s.types?.length || s.types.includes(bal?.type || 'hab');
  const site = settings.sites.find((s) => s.favorite && forType(s)) || settings.sites.find(forType) || settings.sites[0] || null;
  const tz = site?.tz || 'Europe/Zurich';
  const p = localParts(tz, now + 86400000);
  const date = `${p.y}-${String(p.m).padStart(2, '0')}-${String(p.d).padStart(2, '0')}`;
  const op = settings.operators.find((o) => o.default) || settings.operators[0];
  const meeting = settings.meetings.find((m) => (site?.meetingId ? m.id === site.meetingId : m.default)) || settings.meetings[0] || null;
  const intent = settings.intentDefaults[bal?.type || 'hab'];
  const b = {
    id: uid(12), createdAt: now, updatedAt: now, revision: 0, edition: 0, status: 'draft', finalNo: 0,
    lang: settings.lang || 'de', timeBase: settings.timeBase || 'LT',
    balloon: bal, balloonSel: sel,
    meteo: { model: 'icon_eu', topHpa: 500 },   // Vorgabe ICON-EU (0.12.4); andere Modelle im Schritt «Was ist geplant?» und in der Modell-Leiste
    flight: { kind: 'commercial', operatorId: op?.id || 'custom', operatorName: op?.name || '', occasion: '', nvfr: false },
    site: site ? { ...deepCopy(site), icao: icao(site.lat, site.lon) } : { name: '', lat: null, lon: null, elev: null, tz, country: '', icao: '' },
    time: { date, time: '06:30', startMs: fromLocal(tz, date, '06:30'), base: settings.timeBase || 'LT' },
    intent: { durationMin: intent.durationMin, altMinFt: intent.altMinFt, altMaxFt: intent.altMaxFt, direction: '', dayNight: 'day', remark: '', levels: [...intent.levels] },
    landing: emptyPlace(),
    persons: { picId: settings.persons.find((x) => x.roles?.includes('pic'))?.id || '', pic: settings.persons.find((x) => x.roles?.includes('pic'))?.name || '', copilotId: '', copilot: '', retrieveId: settings.persons.find((x) => x.roles?.includes('retrieve'))?.id || '', retrieve: settings.persons.find((x) => x.roles?.includes('retrieve'))?.name || '', retrievers: settings.persons.filter((x) => x.roles?.includes('retrieve')).slice(0, 1).map((x) => ({ id: x.id, name: x.name })), pax: [] },
    schedule: { stops: [{ id: 'm1', meetingId: meeting?.id || '', name: meeting?.name || '', lat: meeting?.lat ?? null, lon: meeting?.lon ?? null, driveMin: null, driveKm: null, driveSource: '', dwellMin: 0 }], meetingId: meeting?.id || '', meetingName: meeting?.name || '', meetingLat: meeting?.lat ?? null, meetingLon: meeting?.lon ?? null, driveMin: null, driveSource: '', driveKm: null, rigMin: bal?.rigMin ?? 45, fillMin: bal?.fillMin ?? 0, bufferMin: settings.scheduleDefaults.bufferMin, recoveryMin: settings.scheduleDefaults.recoveryMin, rows: [], overrides: {} },
    weather: { tempC: 15, qnh: 1013, rh: null, envTempC: bal?.envTempC ?? 100, source: 'manual', stand: null, gasDeltaT: 0, fillPct: 100 },
    panels: {}, versions: [], log: [], accessCount: 0,
  };
  for (const p of PANELS) b.panels[p.key] = { content: {}, extra: { text: '', images: [] }, ai: null, comment: '', updatedAt: null, updatedBy: null };
  return b;
}

export const emptyPlace = () => ({ name: '', lat: null, lon: null, elev: null, icao: '', address: '' });

/** Ältere Briefings auf die aktuelle Struktur heben (fehlende Felder ergänzen). */
export function upgradeBriefing(b) {
  if (!b) return b;
  if (!b.landing) b.landing = emptyPlace();
  fixCountry(b.site); fixCountry(b.landing); for (const st of b.schedule?.stops || []) fixCountry(st);   // 0.12.10: falsches Land (z. B. «CH» bei Orten in Deutschland) nach Koordinaten korrigieren
  if (!b.schedule.overrides) b.schedule.overrides = {};
  ensureStops(b.schedule);
  ensurePlan(b);
  if (!Array.isArray(b.persons.retrievers)) b.persons.retrievers = b.persons.retrieve ? [{ id: b.persons.retrieveId || 'custom', name: b.persons.retrieve }] : [];
  if (b.persons.copilotId == null) { b.persons.copilotId = ''; b.persons.copilot = ''; }   // 0.12.6: 2. Pilot (Gasfahrt)
  for (const p of b.persons.pax || []) if (/^(Pax|Passenger) \d+$/.test(p.name || '')) p.name = '';   // alte Platzhalter-Namen
  if (b.flight && b.flight.nvfr == null) b.flight.nvfr = b.intent?.dayNight === 'night' || b.intent?.dayNight === 'both';   // 0.8.1: NVFR-Schalter statt Tag/Nacht in der Absicht
  for (const p of PANELS) if (!b.panels[p.key]) b.panels[p.key] = { content: {}, extra: { text: '', images: [] }, ai: null, comment: '', updatedAt: null, updatedBy: null };
  // 0.12.13: SIGMET/AIRMET-Schnappschuss von «SIGWX low Alps» nach «Warnungen» verschieben (B.sigwx ist nur noch Einfügefeld)
  { const sx = b.panels['B.sigwx'], wn = b.panels['B.warnings']; if (sx?.content?.auto?.kind === 'sigmet') { if (wn && !wn.content?.auto) { wn.content = { ...(wn.content || {}), auto: sx.content.auto, hidden: sx.content.hidden || [] }; } delete sx.content.auto; delete sx.content.hidden; } }
  // 0.11.2: Bearbeitungsstand «vN» (Sitzungen) – Bestand übernimmt den bisherigen Speicherzähler
  if (b.edition == null) b.edition = b.revision || 0;
  // 0.12.5: Planungen je Etappe (Ops-Briefing); verwaiste Datensätze gelöschter Etappen entfernen
  if (!b.stagePlans || typeof b.stagePlans !== 'object') b.stagePlans = {};
  pruneStagePlans(b);
  // 0.11.4: Füllungsgrad je Briefing (Vorgabe 100 %, meist wird voll gefüllt); Bestand: Stammwert der Hülle
  if (b.weather && b.weather.fillPct == null) b.weather.fillPct = Math.round((b.balloon?.fillFraction ?? 1) * 100);
  // 0.11.2: bei Auto-Panels ohne Einfügepflicht wandert «eigener Text/Bilder» (content) in die Zusatzbox (extra)
  for (const p of PANELS) {
    if (p.kind !== 'auto' || p.grade === 'half') continue;
    const d = b.panels[p.key]; const c = d?.content;
    if (!c || (!(c.text || '').trim() && !(c.images || []).length)) continue;
    d.extra = d.extra || { text: '', images: [] };
    d.extra.text = [d.extra.text || '', c.text || ''].filter((x) => x.trim()).join('\n');
    d.extra.images = [...(d.extra.images || []), ...(c.images || [])];
    delete c.text; delete c.images;
  }
  return b;
}

/** Duplikat als Vorlage: alles Nicht-Zeitabhängige bleibt (Ballon, Startort, PIC, Pax, Nachfahrer, Absicht, Ausrüstung, Absprachen);
 * zeitabhängige Angaben auf Vorgabe (Datum morgen 06:30, Anlass, Startplatzwerte, Tagesplanung, Meteo-Panels); der Ablauf beginnt bei Schritt 1. */
export function duplicateBriefing(src, settings) {
  const b = deepCopy(src);
  b.id = uid(12); b.createdAt = Date.now(); b.updatedAt = Date.now(); b.revision = 0; b.edition = 0; b.status = 'draft'; b.finalNo = 0; b.versions = []; b.log = []; b.accessCount = 0;
  b.no = null; b.pdfs = []; b.assessment = null;   // neue Ordnungsnummer beim Speichern
  b.wizardStep = 1;
  const tz = b.site.tz || 'Europe/Zurich';
  const p = localParts(tz, Date.now() + 86400000);
  b.time.date = `${p.y}-${String(p.m).padStart(2, '0')}-${String(p.d).padStart(2, '0')}`; b.time.time = '06:30'; b.time.startMs = fromLocal(tz, b.time.date, b.time.time);
  b.flight.occasion = '';
  b.weather = { ...b.weather, tempC: 15, qnh: 1013, rh: null, source: 'manual', stand: null, gasDeltaT: 0 };
  if (b.meteo) delete b.meteo.lastRefresh;
  for (const p of PANELS) {
    const keep = ['A.landing', 'A.equipment', 'C.fpl', 'C.agreements', 'C.transition', 'D.pax', 'D.crew', 'D.standard'].includes(p.key);
    if (!keep) b.panels[p.key] = { content: {}, extra: { text: '', images: [] }, ai: null, comment: '', updatedAt: null, updatedBy: null };
  }
  b.schedule.rows = []; b.schedule.overrides = {};
  for (const it of b.schedule.plan || []) delete it.pin;
  b.stagePlans = {};   // 0.12.5: Etappen-Briefings sind zeitgebunden
  if (b.profile) b.profile.data = null;
  return b;
}

export function setStart(b, date, time) {
  b.time.date = date; b.time.time = time;
  b.time.startMs = fromLocal(b.site.tz || 'Europe/Zurich', date, time);
}

export function phaseOf(startMs, now = Date.now()) {
  const h = (startMs - now) / 3600000;
  if (h < -6) return 'past';
  if (h < 0) return 'now';
  if (h < 24) return 'final';
  if (h < 72) return 'plan';
  return 'pre';
}

/** Sonne/Mond für das Briefing: amtlich (CH, RAC) und astronomisch. Alle Zeiten UTC-ms. */
export function sunFor(b, settings, racTable) {
  const tz = b.site.tz || 'Europe/Zurich', lat = b.site.lat, lon = b.site.lon;
  if (lat == null) return null;
  const date = isoDate(tz, b.time.startMs);
  const noon = fromLocal(tz, date, '12:00');
  const astro = sunTimes(lat, lon, noon);
  let official = null, source = 'astro', racMissing = false;
  if ((b.site.country || '') === 'CH') {
    const r = racLookup(racTable, date);
    if (r) {
      const t = (s) => fromLocal(tz, date, `${s.slice(0, 2)}:${s.slice(2)}`);
      official = { bcmt: t(r.bcmt), sr: t(r.sr), ss: t(r.ss), ecet: t(r.ecet) };
      source = 'rac';
    } else racMissing = true;
  }
  let dwdArea = null;
  if (!official && (b.site.country || '') === 'DE') {
    // Deutschland: amtliche Angaben aus dem DWD-Ballonwetterbericht des Gebiets (UTC), sofern er den Fahrttag abdeckt
    const dwd = b.panels?.['B.balloon']?.content?.auto?.data?.dwd;
    const a = dwd ? parseDwdAstro(dwd.text) : null;
    if (a && a.date === date) {
      const u = (hm) => fromLocal('UTC', date, hm);
      official = { bcmt: u(a.bcmt), sr: u(a.sr), ss: u(a.ss), ecet: u(a.ecet) };
      source = 'dwd'; dwdArea = dwd.id;
    }
  }
  if (!official) official = { bcmt: astro.dawn, sr: astro.sunrise, ss: astro.sunset, ecet: astro.dusk };
  const dayStart = fromLocal(tz, date, '00:00');
  const moon = moonTimes(lat, lon, dayStart);
  const ill = moonIllumination(b.time.startMs);
  const landing = b.time.startMs + (b.intent.durationMin || 0) * 60000;
  // Mehrtägige Fahrten: Landung an einem späteren Tag → ECET jenes Tages
  const landDate = isoDate(tz, landing);
  let ecetLanding = official.ecet;
  if (landDate !== date) {
    const r2 = (b.site.country || '') === 'CH' ? racLookup(racTable, landDate) : null;
    if (r2) ecetLanding = fromLocal(tz, landDate, `${r2.ecet.slice(0, 2)}:${r2.ecet.slice(2)}`);
    else ecetLanding = sunTimes(lat, lon, fromLocal(tz, landDate, '12:00')).dusk;
  }
  // NVFR bewusst geplant (Schalter in Schritt 1): keine Nacht-Warnungen, die Rohflags bleiben für die Ausrüstung
  const nvfr = !!b.flight?.nvfr;
  const startBeforeBcmt = b.time.startMs < official.bcmt, landingAfterEcet = ecetLanding != null && landing > ecetLanding;
  return {
    date, tz, official, astro: { bcmt: astro.dawn, sr: astro.sunrise, ss: astro.sunset, ecet: astro.dusk }, source, racMissing, dwdArea,
    moon: { ...moon, fraction: ill.fraction, phase: ill.phase },
    nightStart: !nvfr && startBeforeBcmt, nightLanding: !nvfr && landingAfterEcet, landing, nvfr, startBeforeBcmt, landingAfterEcet,
  };
}

/** Füllungsgrad des Gasballons (0–1): Eingabe im Briefing (A3, Vorgabe 100 %), sonst Stammwert der Hülle. */
export function fillFractionOf(b) {
  const p = b?.weather?.fillPct;
  if (p != null && Number.isFinite(+p) && +p > 0) return Math.min(1.2, +p / 100);
  return b?.balloon?.fillFraction ?? 1;
}
/** Tragkraft (Heissluft) oder Ballast (Gas) aus Briefing-Eingaben. */
/** Zweiter Pilot an Bord (0.12.6; seit 0.12.7 für alle Ballontypen)? */
export const hasCopilot = (b) => !!(b?.persons?.copilot || '').trim();   // 0.12.7: alle Ballontypen (0.12.6: nur Gas)
/** Personen an Bord: PIC (+ 2. Pilot bei der Gasfahrt) + Pax. */
export const personsOnBoard = (b) => 1 + (hasCopilot(b) ? 1 : 0) + (b.persons?.pax?.length || 0);
export function massPerf(b, settings) {
  const bal = b.balloon, w = b.weather;
  const persons = personsOnBoard(b);
  const pw = +bal.personWeight || +settings?.balloons?.gasDefaults?.personWeight || 85;
  const personMasses = [b.persons.picWeight || pw, ...(hasCopilot(b) ? [b.persons.copilotWeight || pw] : []), ...(b.persons.pax || []).map((p) => p.weight || pw)];
  if (bal.type === 'gas') {
    return { type: 'gas', r: gasBalloon({
      volume: bal.volume, fillFraction: fillFractionOf(b), gas: bal.gas, purity: bal.purity, siteAlt: b.site.elev || 0,
      tempC: w.tempC, qnh: w.qnh, rh: w.rh, gasDeltaT: w.gasDeltaT || 0,
      masses: bal.masses, persons, personWeight: pw, personMasses, ballastUnitKg: bal.ballastUnitKg, reserveUnits: bal.reserveUnits,
    }) };
  }
  return { type: 'hab', r: hotAir({
    volume: bal.volume, siteAlt: b.site.elev || 0, tempC: w.tempC, qnh: w.qnh, rh: w.rh, envTempC: w.envTempC ?? bal.envTempC, envMaxC: bal.envMaxC,
    masses: bal.masses, persons, personWeight: pw, personMasses, cylinders: b.cylinders || bal.cylinders, mtom: bal.mtom,
    usableFraction: bal.usableFraction, burnRate: bal.burnRate, durationMin: b.intent.durationMin, reserve: settings.reserve,
  }) };
}

/** Zeitplan (tabellarisch, 0.9.1) sicherstellen: aus den Altfeldern (Etappen, Zeiten) eine Vorlage bauen. */
export function ensurePlan(b) {
  const s = b.schedule;
  if (!Array.isArray(s.plan) || !s.plan.length) {
    ensureStops(s);
    s.plan = planTemplate({ type: b.balloon?.type, stops: s.stops, rigMin: s.rigMin, fillMin: s.fillMin, bufferMin: s.bufferMin, recoveryMin: s.recoveryMin, meetingName: s.meetingName, meetingLat: s.meetingLat, meetingLon: s.meetingLon, driveMin: s.driveMin });
    // alte Pins (Altform) übernehmen, soweit zuordenbar
    const ov = s.overrides || {};
    for (const it of s.plan) { const k = it.type === 'meet' ? `depart:${it.id.replace(/^meet-/, '')}` : it.type; if (ov[k] != null) it.pin = ov[k]; }
  }
  if (!s.plan.some((x) => x.type === 'start')) s.plan.push({ id: 'start', type: 'start', name: '', info: '', min: 0 });
  return s.plan;
}
/** Ballonwechsel in den Zeitplan übernehmen: Aufrüstzeit, Füllzeile (Gas) ein-/ausblenden. */
export function applyBalloonToPlan(b, bal) {
  const s = b.schedule; if (!Array.isArray(s.plan) || !bal) return;
  const rig = s.plan.find((x) => x.type === 'rig'); if (rig && bal.rigMin != null) rig.min = bal.rigMin;
  const fillIdx = s.plan.findIndex((x) => x.type === 'fill');
  if (bal.type === 'gas' && fillIdx < 0) { const a = s.plan.findIndex((x) => x.type === 'start'); s.plan.splice(a < 0 ? s.plan.length : a, 0, { id: 'fill', type: 'fill', name: '', info: '', min: bal.fillMin ?? 150 }); }
  else if (bal.type === 'gas' && fillIdx >= 0 && bal.fillMin != null) s.plan[fillIdx].min = bal.fillMin;
  else if (bal.type !== 'gas' && fillIdx >= 0) s.plan.splice(fillIdx, 1);
}
/** Altfelder (Etappen, Treffpunkt) aus dem Zeitplan nachführen – für Pax-Karte, ICS, Crew-Nachricht, Leser. */
export function syncFromPlan(s) {
  if (!Array.isArray(s.plan)) return;
  const stops = planToStops(s.plan);
  if (stops.length) s.stops = stops;
  syncMeeting(s);
}
/** Zeitplan-Zeilen (mit Pins) und Warnungen. Zeilen tragen key = Typ (start, landing, return …) für Leser. */
export function scheduleFor(b, sun) {
  const s = b.schedule;
  ensurePlan(b);
  const rows = buildPlan(s.plan, { startMs: b.time.startMs, flightMin: b.intent.durationMin }).map((r) => ({ ...r, key: r.type === 'meet' ? `meet:${r.id}` : r.type, kind: r.type === 'meet' ? 'depart' : undefined }));
  syncFromPlan(s);
  const warnings = scheduleWarnings(rows, sun ? { bcmt: sun.nvfr ? null : sun.official.bcmt, ecet: sun.nvfr ? null : sun.official.ecet, ss: sun.official.ss } : null);
  return { rows, warnings };
}

/** Etappenliste sicherstellen (Altform: ein Treffpunkt) und die Altfelder für Leser synchron halten. */
export function ensureStops(s) {
  if (!Array.isArray(s.stops) || !s.stops.length) {
    s.stops = [{ id: 'm1', meetingId: s.meetingId || '', name: s.meetingName || '', lat: s.meetingLat ?? null, lon: s.meetingLon ?? null, driveMin: s.driveMin ?? null, driveKm: s.driveKm ?? null, driveSource: s.driveSource || '', dwellMin: 0 }];
    if (s.overrides?.depart != null) { s.overrides['depart:m1'] = s.overrides.depart; delete s.overrides.depart; }
  }
  syncMeeting(s);
  return s.stops;
}
/** Ersten Treffpunkt setzen (Favorit des Startplatzes): Etappen (Altform) und Zeitplan-Zeile «Treffpunkt». */
export function setFirstMeeting(s, m) {
  ensureStops(s);
  Object.assign(s.stops[0], { meetingId: m.id, name: m.name, lat: m.lat ?? null, lon: m.lon ?? null, driveMin: null, driveSource: '' });
  syncMeeting(s);
  const row = (s.plan || []).find((x) => x.type === 'meet');
  if (row) { row.name = m.name; row.meetingId = m.id; row.place = m.lat != null ? { name: m.name, lat: m.lat, lon: m.lon } : null; const drv = (s.plan || []).slice(s.plan.indexOf(row) + 1).find((x) => x.type === 'drive'); if (drv) { drv.minSource = ''; } }
}
export function syncMeeting(s) {
  const f = s.stops?.[0]; if (!f) return;
  s.meetingId = f.meetingId || ''; s.meetingName = f.name || ''; s.meetingLat = f.lat ?? null; s.meetingLon = f.lon ?? null;
  const last = s.stops[s.stops.length - 1]; s.driveMin = last.driveMin ?? null; s.driveKm = last.driveKm ?? null; s.driveSource = last.driveSource || '';
}
/** Landeraum setzen (oder löschen) und die Zielrichtung daraus ableiten (Himmelsrichtung · Kurs · Distanz · Ort). */
export function applyLanding(b, p, lang = 'de', est = null) {
  if (p) {
    Object.assign(b.landing, { name: p.name || '', lat: p.lat, lon: p.lon, elev: p.elev ?? null, icao: icao(p.lat, p.lon), address: p.address || '', country: p.country || countryGuess(p.lat, p.lon) || '' });
    if (b.site.lat != null) { b.intent.direction = directionText(b, lang, est); b.intent.target = targetInfo(b, est); }
  } else { Object.assign(b.landing, { name: '', lat: null, lon: null, elev: null, icao: '', address: '' }); b.intent.target = null; }
  return b.landing;
}
/** 0.12.8: strukturierte Zielangaben (Kurs, Distanz, Fahrzeit, mittlere Höhe) zum Landeraum – Grundlage der Zeile «Fahrtabsicht». */
export function targetInfo(b, est = null) {
  const p = b.landing; if (!p || p.lat == null || b.site?.lat == null) return null;
  const brg = Math.round(bearing(b.site.lat, b.site.lon, p.lat, p.lon)), km = Math.round(distKm(b.site.lat, b.site.lon, p.lat, p.lon));
  const o = { brg, km };
  if (est && !est.unreliable) { o.min = est.min; o.altM = est.altM; o.beyond = !!est.beyond; }
  return o;
}
/** Zeile «Fahrtabsicht» (0.12.8): Fahrtdauer · Fahrthöhen · Grobrichtung · Distanz · Ankunft · ⌀ Fahrthöhe · ⌀ Geschwindigkeit (ohne Landeort – eigene Zeile). */
export function intentLine(b, tr, z, opts = {}) {
  const parts = [`${tr('intent_dur')} ${fmtDur(b.intent.durationMin)}`, `${tr('intent_alts')} ${b.intent.altMinFt}–${b.intent.altMaxFt} ft AMSL`];
  let g = b.intent.target;
  if (!g && b.landing?.lat != null) {   // ältere Briefings: Kurs/Distanz aus dem Landeraum, Fahrzeit/Höhe aus der alten Richtungszeile («~20:55 h · ⌀ 2210 m»)
    g = targetInfo(b);
    const m = /([~>])(\d+):(\d\d) h/.exec(b.intent.direction || ''), a = /⌀ (\d+) m/.exec(b.intent.direction || '');
    if (g && m) { g.min = +m[2] * 60 + +m[3]; g.beyond = m[1] === '>'; if (a) g.altM = +a[1]; }
  }
  if (g) {
    parts.push(`${tr('intent_dir')} ~${String(g.brg).padStart(3, '0')}°`, `${tr('intent_dist')} ~${g.km} km`);
    if (g.min != null) {
      const arr = b.time.startMs + g.min * 60000, wd = (ms) => new Intl.DateTimeFormat(opts.lang || 'de', { weekday: 'short', timeZone: z }).format(new Date(ms));
      parts.push(`${tr('intent_arr')} ${g.beyond ? '>' : '~'}${wd(arr) !== wd(b.time.startMs) ? wd(arr) + ' ' : ''}${hhmm(z, arr)} LT (${tr('intent_travel')} ${fmtDur(g.min)})`);
      if (g.altM != null) parts.push(`⌀ ${tr('intent_avgAlt')} ${g.altM} m AMSL`);
      if (g.min > 0) parts.push(`⌀ ${tr('intent_avgSpd')} ${(g.km / (g.min / 60)).toFixed(1)} km/h`);
    }
  } else if (b.intent.direction) parts.push(`${tr('intent_dir')} ${b.intent.direction}`);
  if (opts.remark && b.intent.remark) parts.push(b.intent.remark);
  return parts.join(' · ');
}
/** «Ort · W266° · 25 km · ~1:30 h · ⌀ 1200 m AMSL» – Fahrzeit/Höhe aus der Trajektorienschar (est von targetEstimate), falls vorhanden. */
export function directionText(b, lang = 'de', est = null) {
  const p = b.landing; if (!p || p.lat == null || b.site.lat == null) return b.intent.direction || '';
  const brg = Math.round(bearing(b.site.lat, b.site.lon, p.lat, p.lon)), km = distKm(b.site.lat, b.site.lon, p.lat, p.lon);
  const parts = [p.name || p.icao || icao(p.lat, p.lon), `${compass(brg, lang)}${String(brg).padStart(3, '0')}°`, `${km.toFixed(0)} km`];
  if (est && !est.unreliable) { const hh = Math.floor(est.min / 60), mm = est.min % 60; parts.push(`${est.beyond ? '>' : '~'}${hh}:${String(mm).padStart(2, '0')} h`, `⌀ ${est.altM} m AMSL`); }
  return parts.join(' · ');
}
/** Länder entlang der Fahrt: FIR-Folge der Luftraumanalyse (falls geladen), sonst Startort, Landeraum und Trajektorienpunkte (grobe Schätzung). */
export function routeCountries(b) {
  const out = new Set();
  if (b.site?.country) out.add(b.site.country);
  if (b.landing?.lat != null) out.add(b.landing.country || countryGuess(b.landing.lat, b.landing.lon));
  const firs = b.panels?.['C.airspace']?.content?.auto?.data?.firs || [];
  let fromFir = false;
  for (const f of firs) for (const s of f.seq || []) if (s.country) { out.add(s.country); fromFir = true; }
  if (!fromFir) for (const tr of b.panels?.['B.traj']?.content?.auto?.data?.tracks || []) for (const p of tr.points || []) { const c = countryGuess(p.lat, p.lon); if (c) out.add(c); }
  out.delete('');
  return out;
}
export const crossesBorder = (b) => routeCountries(b).size > 1;
/** Für die Fahrt anwendbare Übergangshöhen (0.12.6): Länder der Fahrt (Startort, Landeraum, FIR-Folge, Profil-FIRs) → Vorgaben je Land, sonst Einträge mit passendem Land. */
export function applicableTransitions(b, settings) {
  const cc = routeCountries(b);
  for (const f of b.profile?.data?.firs || []) if (f.country) cc.add(f.country);
  const ids = new Set();
  for (const c of cc) {
    const d = settings?.transitionDefaults?.[c];
    if (d?.length) d.forEach((x) => ids.add(x));
    else for (const ta of settings?.transitionAltitudes || []) if ((ta.countries || []).includes(c)) ids.add(ta.id);
  }
  return (settings?.transitionAltitudes || []).map((ta) => ta.id).filter((id) => ids.has(id));
}
/** Angeklickte Übergangshöhen: von Hand gesetzt (manual), sonst die anwendbaren der Fahrt. */
export function transitionItems(b, settings) {
  const d = b.panels?.['C.transition'];
  return d?.content?.manual ? (d.content.items || []) : applicableTransitions(b, settings);
}
export { touchesCH };
/** Flugplan nötig? NVFR, Grenzüberschreitung oder Gasfahrt → Standard «ja». */
export const fplSuggested = (b) => !!(b.flight?.nvfr || b.balloon?.type === 'gas' || crossesBorder(b));
/** Beschriftung einer Zeitplan-Zeile (Etappen mit Namen). */
export function scheduleRowLabel(r, b, tr, acts) {
  if (r.type) {
    const place = r.type === 'arrive' ? placeLabel(b.site) : r.type === 'landing' ? placeLabel(b.landing) : (r.place?.name || r.name || '');
    return `${actLabel(r, tr, acts)}${place ? ' · ' + place : ''}${r.info ? ' – ' + r.info : ''}`;
  }
  if (r.kind === 'depart') return `${tr('sch_departAt')}${r.name ? ' · ' + r.name : ''}`;
  if (r.key === 'arrive') return `${tr('sch_arrive')}${b.site?.name ? ' · ' + placeLabel(b.site) : ''}`;
  return tr('sch_' + r.key);
}

/** Beschriftung eines Aktivitätstyps; eigene Aktivitäten (Experte) über it.act. */
export function actLabel(it, tr, acts) {
  if (it.type === 'custom' && it.act) { const a = (acts || []).find((x) => x.id === it.act); if (a) return tt(a) || tr('act_custom'); }
  return tr('act_' + it.type);
}

/** Vorschläge Spezialausrüstung aus Fahrtabsicht und Nacht. */
export function equipmentSuggest(b, sun) {
  const s = [];
  if (b.flight?.nvfr || sun?.startBeforeBcmt || sun?.landingAfterEcet) s.push('nvr');
  if ((b.intent.altMaxFt || 0) > 10000) s.push('o2');
  return s;
}

/** Ortsname mit Länderkennzeichen voran, wenn ausserhalb der Schweiz: «DE-Wolfegg» (0.12.4; ein vorhandenes « (DE)» am Ende entfällt). */
export function placeLabel(p) {   // 0.12.8: immer mit Länderkennzeichen, auch CH («CH-Oberlunkhofen AG»)
  if (!p) return '';
  const name = String(p.name || '').trim(), cc = String(p.country || '').toUpperCase();
  if (!name || !cc) return name;
  const bare = name.replace(new RegExp(`\\s*\\(${cc}\\)$`), '');
  return new RegExp(`^${cc}-`).test(bare) ? bare : `${cc}-${bare}`;
}
export const startLabel = (b) => `${hhmm(b.site.tz || 'Europe/Zurich', b.time.startMs)}`;

/** Bild der Hülle: Schnappschuss im Briefing, sonst aus den aktuellen Stammdaten (ältere Briefings). */
export function balloonImage(b, settings) {
  if (b?.balloon?.image) return b.balloon.image;
  const B = settings?.balloons; if (!B || !b?.balloon) return '';
  const x = b.balloon.type === 'gas' ? (B.envelopes || []).find((e) => e.id === b.balloon.envelopeId) : (B.hab || []).find((e) => e.id === b.balloon.id);
  return x?.image || '';
}

// ---------------------------------------------------------------- 0.11: Ordnungsnummer, Fortschritt, Sperre
/** Jahr für die Ordnungsnummer: Jahr des Fahrtdatums (Ablage nach Fahrt), sonst Erstellungsjahr. */
export function briefingYear(b) {
  const d = b?.time?.date; if (/^\d{4}-/.test(d || '')) return +d.slice(0, 4);
  return new Date(b?.time?.startMs || b?.createdAt || Date.now()).getUTCFullYear();
}
/** Ordnungsnummer «JJJJ-NNN» aus Jahr und laufender Nummer. */
export const formatNo = (year, n) => `${year}-${String(n).padStart(3, '0')}`;
/** Anteil gefüllter sichtbarer Panels in Prozent (Fortschritt «in Arbeit NN %»). */
export function completion(b, settings) {
  const ps = visiblePanels(settings, b);
  // 0.12.5: Etappen-Briefings zählen mit (ihre Panels mit der abgeleiteten Sicht der Etappe)
  const sets = stageSets(b);
  const total = ps.length + sets.reduce((a, x) => a + visiblePanels(settings, x.bs).length, 0);
  if (!total) return 0;
  const n = ps.filter((p) => panelFilled(p, b)).length + sets.reduce((a, x) => a + visiblePanels(settings, x.bs).filter((p) => panelFilled(p, x.bs)).length, 0);
  return Math.round((100 * n) / total);
}
/** Archiv-Grenze: geplante Landung (Start + Fahrtdauer) + 6 h – danach ist das Briefing unveränderlich (0.12.10a). */
export const ARCHIVE_AFTER_LANDING_MS = 6 * 3600000;
export function archiveMs(b) {
  const start = b?.time?.startMs || 0;
  const dur = (b?.intent?.durationMin || 0) * 60000;
  return start + dur + ARCHIVE_AFTER_LANDING_MS;
}
/** 0.12.10a: Sperre ab Startzeitpunkt – ab dann nur noch Ansicht; Änderungen während der laufenden Fahrt als Nachtrag. */
export const LOCK_AFTER_START_MS = 0;
export const lockMs = (b) => (b?.time?.startMs || 0) + LOCK_AFTER_START_MS;
/** Gesperrt: Startzeitpunkt vorbei (laufende oder vergangene Fahrt). */
export const isLocked = (b, now = Date.now()) => now > lockMs(b);
/** Archiv: Fahrt vorbei oder eingefrorene Archivkopie eines Nachtrags → unveränderlich, nicht löschbar. */
export const isArchived = (b, now = Date.now()) => !!b?.frozen || now > archiveMs(b);
/** Laufende Fahrt: gesperrt, aber noch nicht im Archiv → Nachtrag möglich. */
export const isRunning = (b, now = Date.now()) => isLocked(b, now) && !isArchived(b, now);
/** Briefingnummer des Nachtrags: «2026-008» → «2026-008a», «2026-008a» → «2026-008b». */
export function nextAmendmentNo(no) {
  const m = /^(.*?)([a-z])?$/.exec(String(no || ''));
  const base = m ? m[1] : String(no || ''); const letter = m && m[2] ? String.fromCharCode(m[2].charCodeAt(0) + 1) : 'a';
  return base + (letter > 'z' ? 'z' : letter);
}
/** Nachtrag während der laufenden Fahrt: der bisherige Stand wird als eingefrorene Kopie (bisherige Nummer) ins Archiv
 * gelegt, das Briefing selbst (gleiche Kennung, Links bleiben gültig) erhält die Nummer mit Buchstabe und ist wieder bearbeitbar.
 * Reine Datenfunktion – Speichern übernimmt der Aufrufer (lokal) bzw. der Worker. */
export function amendBriefingData(b, now = Date.now()) {
  const copy = deepCopy(b);
  copy.id = uid(12); copy.frozen = true; copy.frozenAt = now; copy.amendmentOf = b.id; copy.no = b.no || null;
  delete copy.access; delete copy.amendments;
  const oldNo = b.no || null;
  b.no = nextAmendmentNo(b.no || '');
  b.amendments = [...(b.amendments || []), { no: oldNo, copyId: copy.id, ts: now }];
  b.amendedAt = now;
  return { copy, b };
}
/** Bezugszeit für «Alter» von Meldungen (METAR/TAF, Beobachtungen): der Publikationszeitpunkt des Briefings
 * (letzte Freigabe als Final); ohne Freigabe während der Erarbeitung «jetzt», nach der Fahrt (gesperrt) der Startzeitpunkt. */
export function ageRefMs(b, now = Date.now()) {
  if (b?.status === 'final') { const v = (b.versions || []).slice(-1)[0]; if (v?.ts) return v.ts; }
  if (b && isArchived(b, now)) return b.time?.startMs || now;   // 0.12.10: während der laufenden Fahrt (Nachtrag) zählt «jetzt»
  return now;
}
/** Dateibasis «2026-017_Fahrtbriefing_HB-QWZ_2026-10-06» für PDF, JSON, ICS, FPL. */
export function fileBase(b) {
  const reg = (b.balloon?.reg || '').replace(/[^A-Za-z0-9-]+/g, '');
  return [b.no || 'ohne-Nr', 'Fahrtbriefing', reg, b.time?.date || ''].filter(Boolean).join('_');
}
/** Titelzeile für Ausdrucke: «Fahrtbriefing · 2026-017 · HB-QWZ · Start: Di 06.10.2026, 06:30 – Oberlunkhofen AG». */
export function titleLine(b, lang = 'de', appName = 'Fahrtbriefing') {
  const z = b.site?.tz || 'Europe/Zurich';
  return [appName, b.no || '', b.balloon?.reg || '', `Start: ${fmtDate(z, b.time.startMs, lang)}, ${hhmm(z, b.time.startMs)} – ${placeLabel(b.site)}`].filter(Boolean).join(' · ');
}
/** «Letzte Änderung: 05.10.2026 09:37 · B. Wicki». */
export function lastChangeLine(b, lang = 'de', label = 'Letzte Änderung') {
  const z = b.site?.tz || 'Europe/Zurich';
  return `${label}: ${b.updatedAt ? fmtDateTime(z, b.updatedAt, lang) : '–'}${b.updatedBy ? ' · ' + b.updatedBy : ''}`;
}
/** «2 Pax: Viviane Graf (70 kg), Max Muster (85 kg)» — Gewicht aus dem Briefing, sonst Normgewicht. */
export function paxLine(b, settings, placeholder = (i) => `Pax ${i + 1}`) {
  const pax = b.persons?.pax || [];
  if (!pax.length) return '0 Pax';
  const norm = b.balloon?.personWeight ?? settings?.balloons?.gasDefaults?.personWeight ?? null;
  const names = pax.map((x, i) => { const w = x.weight ?? norm; return `${x.name || placeholder(i)}${w != null ? ` (${Math.round(w)} kg)` : ''}`; });
  return `${pax.length} Pax: ${names.join(', ')}`;
}
/** Länderzeile für die Stammdaten: «CH (Start) · DE (Überflug) · AT (Landung)». */
export function countriesLine(b) {
  const entries = routeMatrix(b, routeCountries(b));
  return entries.length ? routeMatrixLine(entries, (r) => tr('cm_role_' + r)) : '–';
}
