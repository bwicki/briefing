/* Fahrtbriefing — Briefing-Datensatz und abgeleitete Grössen.
 *
 * Ein Briefing ist ein JSON-Dokument (siehe newBriefing). Abgeleitete Werte
 * (Sonne, Tragkraft, Zeitplan, Phase) werden nicht gespeichert, sondern aus
 * den Eingaben gerechnet — so bleiben sie bei jeder Änderung konsistent.
 */
import { uid, deepCopy } from './util.js';
import { resolveBalloon, defaultBalloon } from './defaults.js';
import { fromLocal, localParts, isoDate, hhmm, addMin } from './calc/time.js';
import { sunTimes, moonTimes, moonIllumination } from './calc/sun.js';
import { racLookup } from './calc/rac.js';
import { hotAir, gasBalloon } from './calc/aero.js';
import { buildSchedule, scheduleWarnings } from './calc/schedule.js';
import { icao, bearing, distKm, compass, countryGuess } from './calc/geo.js';
import { PANELS } from './panels.js';

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
    id: uid(12), createdAt: now, updatedAt: now, revision: 0, status: 'draft', finalNo: 0,
    lang: settings.lang || 'de', timeBase: settings.timeBase || 'LT',
    balloon: bal, balloonSel: sel,
    flight: { kind: 'commercial', operatorId: op?.id || 'custom', operatorName: op?.name || '', occasion: '', nvfr: false },
    site: site ? { ...deepCopy(site), icao: icao(site.lat, site.lon) } : { name: '', lat: null, lon: null, elev: null, tz, country: '', icao: '' },
    time: { date, time: '06:30', startMs: fromLocal(tz, date, '06:30'), base: settings.timeBase || 'LT' },
    intent: { durationMin: intent.durationMin, altMinFt: intent.altMinFt, altMaxFt: intent.altMaxFt, direction: '', dayNight: 'day', remark: '', levels: [...intent.levels] },
    landing: emptyPlace(),
    persons: { picId: settings.persons.find((x) => x.roles?.includes('pic'))?.id || '', pic: settings.persons.find((x) => x.roles?.includes('pic'))?.name || '', retrieveId: settings.persons.find((x) => x.roles?.includes('retrieve'))?.id || '', retrieve: settings.persons.find((x) => x.roles?.includes('retrieve'))?.name || '', retrievers: settings.persons.filter((x) => x.roles?.includes('retrieve')).slice(0, 1).map((x) => ({ id: x.id, name: x.name })), pax: [] },
    schedule: { stops: [{ id: 'm1', meetingId: meeting?.id || '', name: meeting?.name || '', lat: meeting?.lat ?? null, lon: meeting?.lon ?? null, driveMin: null, driveKm: null, driveSource: '', dwellMin: 0 }], meetingId: meeting?.id || '', meetingName: meeting?.name || '', meetingLat: meeting?.lat ?? null, meetingLon: meeting?.lon ?? null, driveMin: null, driveSource: '', driveKm: null, rigMin: bal?.rigMin ?? 45, fillMin: bal?.fillMin ?? 0, bufferMin: settings.scheduleDefaults.bufferMin, recoveryMin: settings.scheduleDefaults.recoveryMin, rows: [], overrides: {} },
    weather: { tempC: 15, qnh: 1013, rh: null, envTempC: bal?.envTempC ?? 100, source: 'manual', stand: null, gasDeltaT: 0 },
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
  if (!b.schedule.overrides) b.schedule.overrides = {};
  ensureStops(b.schedule);
  if (!Array.isArray(b.persons.retrievers)) b.persons.retrievers = b.persons.retrieve ? [{ id: b.persons.retrieveId || 'custom', name: b.persons.retrieve }] : [];
  for (const p of b.persons.pax || []) if (/^(Pax|Passenger) \d+$/.test(p.name || '')) p.name = '';   // alte Platzhalter-Namen
  if (b.flight && b.flight.nvfr == null) b.flight.nvfr = b.intent?.dayNight === 'night' || b.intent?.dayNight === 'both';   // 0.8.1: NVFR-Schalter statt Tag/Nacht in der Absicht
  for (const p of PANELS) if (!b.panels[p.key]) b.panels[p.key] = { content: {}, extra: { text: '', images: [] }, ai: null, comment: '', updatedAt: null, updatedBy: null };
  return b;
}

/** Duplikat als Vorlage: Stammdaten übernommen, Meteo-Panels leer, neues Datum (+7 Tage). */
export function duplicateBriefing(src, settings) {
  const b = deepCopy(src);
  b.id = uid(12); b.createdAt = Date.now(); b.updatedAt = Date.now(); b.revision = 0; b.status = 'draft'; b.finalNo = 0; b.versions = []; b.log = []; b.accessCount = 0;
  const tz = b.site.tz || 'Europe/Zurich';
  const next = addMin(b.time.startMs, 7 * 24 * 60);
  b.time.date = isoDate(tz, next); b.time.startMs = fromLocal(tz, b.time.date, b.time.time);
  for (const p of PANELS) {
    const keep = ['A.landing', 'A.equipment', 'C.fpl', 'C.agreements', 'C.transition', 'D.pax', 'D.crew', 'D.standard'].includes(p.key);
    if (!keep) b.panels[p.key] = { content: {}, extra: { text: '', images: [] }, ai: null, comment: '', updatedAt: null, updatedBy: null };
  }
  b.weather = { ...b.weather, source: 'manual', stand: null };
  b.schedule.rows = []; b.schedule.overrides = {};
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
    date, tz, official, astro: { bcmt: astro.dawn, sr: astro.sunrise, ss: astro.sunset, ecet: astro.dusk }, source, racMissing,
    moon: { ...moon, fraction: ill.fraction, phase: ill.phase },
    nightStart: !nvfr && startBeforeBcmt, nightLanding: !nvfr && landingAfterEcet, landing, nvfr, startBeforeBcmt, landingAfterEcet,
  };
}

/** Tragkraft (Heissluft) oder Ballast (Gas) aus Briefing-Eingaben. */
export function massPerf(b, settings) {
  const bal = b.balloon, w = b.weather;
  const persons = 1 + (b.persons.pax?.length || 0);
  const pw = +bal.personWeight || +settings?.balloons?.gasDefaults?.personWeight || 85;
  const personMasses = [b.persons.picWeight || pw, ...(b.persons.pax || []).map((p) => p.weight || pw)];
  if (bal.type === 'gas') {
    return { type: 'gas', r: gasBalloon({
      volume: bal.volume, fillFraction: bal.fillFraction ?? 1, gas: bal.gas, purity: bal.purity, siteAlt: b.site.elev || 0,
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

/** Zeitplan-Zeilen (mit Überschreibungen) und Warnungen. */
export function scheduleFor(b, sun) {
  const s = b.schedule;
  ensureStops(s);
  const rows = buildSchedule({ startMs: b.time.startMs, type: b.balloon.type, rigMin: s.rigMin, fillMin: s.fillMin, bufferMin: s.bufferMin, durationMin: b.intent.durationMin, recoveryMin: s.recoveryMin, stops: s.stops, overrides: s.overrides || {} });
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
export function syncMeeting(s) {
  const f = s.stops?.[0]; if (!f) return;
  s.meetingId = f.meetingId || ''; s.meetingName = f.name || ''; s.meetingLat = f.lat ?? null; s.meetingLon = f.lon ?? null;
  const last = s.stops[s.stops.length - 1]; s.driveMin = last.driveMin ?? null; s.driveKm = last.driveKm ?? null; s.driveSource = last.driveSource || '';
}
/** Landeraum setzen (oder löschen) und die Zielrichtung daraus ableiten (Himmelsrichtung · Kurs · Distanz · Ort). */
export function applyLanding(b, p, lang = 'de') {
  if (p) {
    Object.assign(b.landing, { name: p.name || '', lat: p.lat, lon: p.lon, elev: p.elev ?? null, icao: icao(p.lat, p.lon), address: p.address || '', country: p.country || countryGuess(p.lat, p.lon) || '' });
    if (b.site.lat != null) {
      const brg = Math.round(bearing(b.site.lat, b.site.lon, p.lat, p.lon)), km = distKm(b.site.lat, b.site.lon, p.lat, p.lon);
      b.intent.direction = `${compass(brg, lang)} ${String(brg).padStart(3, '0')}° · ${km.toFixed(0)} km · ${p.name || b.landing.icao}`;
    }
  } else Object.assign(b.landing, { name: '', lat: null, lon: null, elev: null, icao: '', address: '' });
  return b.landing;
}
/** Beschriftung einer Zeitplan-Zeile (Etappen mit Namen). */
export function scheduleRowLabel(r, b, tr) {
  if (r.kind === 'depart') return `${tr('sch_departAt')}${r.name ? ' · ' + r.name : ''}`;
  if (r.key === 'arrive') return `${tr('sch_arrive')}${b.site?.name ? ' · ' + b.site.name : ''}`;
  return tr('sch_' + r.key);
}

/** Vorschläge Spezialausrüstung aus Fahrtabsicht und Nacht. */
export function equipmentSuggest(b, sun) {
  const s = [];
  if (b.flight?.nvfr || sun?.startBeforeBcmt || sun?.landingAfterEcet) s.push('nvr');
  if ((b.intent.altMaxFt || 0) > 10000) s.push('o2');
  return s;
}

export const startLabel = (b) => `${hhmm(b.site.tz || 'Europe/Zurich', b.time.startMs)}`;
