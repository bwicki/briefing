/* Fahrtbriefing — ICAO-Flugplan (FPL) aus dem Briefing.
 *
 * Felder nach ICAO Doc 4444 Appendix 2, Vorlage skybriefing/IBS (Muster Gasfahrten HB-QPJ):
 *   7 Kennung · 8 Flugregeln V / Art des Flugs · 9 Anzahl, Typ ZZZZ, Wirbelschleppe L ·
 *   10 Ausrüstung (z. B. GY/E, GY/EB1) · 13 ZZZZ + EOBT · 15 Geschwindigkeit N0025, Höhe F125/VFR, Route
 *   «DRIFTING … FROM … TO … VIA …» · 16 ZZZZ + Gesamt-EET + ALTN ZZZZ · 18 DEP/ DEST/ DOF/ EET/ TYP/ ALTN/ RMK/ ·
 *   19 E/ P/ R/ S/ J/ D/ A/ N/ C/.
 * buildFpl(b, ctx) → Datensatz mit allen Feldern; fplMessage(d) → ICAO-Text; fplXml(d) → XML.
 * Die FIR-ICAO-Codes für EET/ kommen aus den FIR-Namen der Luftraumanalyse (Tabelle Europa).
 */
import { icao, bearing } from './geo.js';

/** FIR-Namen (openAIP) → ICAO-Code; Suche nach Teilstring in Grossbuchstaben. */
export const FIR_CODES = [
  ['SWITZERLAND', 'LSAS'], ['SCHWEIZ', 'LSAS'], ['LANGEN', 'EDGG'], ['MUENCHEN', 'EDMM'], ['MUNCHEN', 'EDMM'], ['MUNICH', 'EDMM'], ['BREMEN', 'EDWW'],
  ['WIEN', 'LOVV'], ['VIENNA', 'LOVV'], ['MILANO', 'LIMM'], ['MILAN', 'LIMM'], ['ROMA', 'LIRR'], ['ROME', 'LIRR'], ['BRINDISI', 'LIBB'],
  ['PARIS', 'LFFF'], ['REIMS', 'LFEE'], ['MARSEILLE', 'LFMM'], ['BREST', 'LFRR'], ['BORDEAUX', 'LFBB'],
  ['PRAHA', 'LKAA'], ['PRAGUE', 'LKAA'], ['BRATISLAVA', 'LZBB'], ['BUDAPEST', 'LHCC'], ['WARSZAWA', 'EPWW'], ['WARSAW', 'EPWW'],
  ['KOBENHAVN', 'EKDK'], ['COPENHAGEN', 'EKDK'], ['SWEDEN', 'ESAA'], ['SVERIGE', 'ESAA'], ['NORWAY', 'ENOR'], ['FINLAND', 'EFIN'],
  ['RIGA', 'EVRR'], ['VILNIUS', 'EYVL'], ['TALLINN', 'EETT'], ['AMSTERDAM', 'EHAA'], ['BRUSSELS', 'EBBU'], ['BRUXELLES', 'EBBU'],
  ['LJUBLJANA', 'LJLA'], ['ZAGREB', 'LDZO'], ['SARAJEVO', 'LQSB'], ['BEOGRAD', 'LYBA'], ['BELGRADE', 'LYBA'], ['SKOPJE', 'LWSS'], ['TIRANA', 'LAAA'],
  ['SOFIA', 'LBSR'], ['BUCURESTI', 'LRBB'], ['BUCHAREST', 'LRBB'], ['LONDON', 'EGTT'], ['SCOTTISH', 'EGPX'], ['SHANNON', 'EISN'],
  ['MADRID', 'LECM'], ['BARCELONA', 'LECB'], ['LISBOA', 'LPPC'], ['LISBON', 'LPPC'], ['ATHINAI', 'LGGG'], ['ATHENS', 'LGGG'],
  ['KYIV', 'UKBV'], ['LVIV', 'UKLV'], ['MINSK', 'UMMV'], ['NICOSIA', 'LCCC'], ['MALTA', 'LMMM'], ['ISTANBUL', 'LTBB'], ['ANKARA', 'LTAA'],
];
export function firCode(name) {
  const u = (name || '').toUpperCase();
  const m = /\b([A-Z]{4})\b/.exec(u.replace(/\bFIR\b|\bUIR\b/g, ''));
  if (m && /^[EL][A-Z]{3}$|^U[KM][A-Z]{2}$/.test(m[1]) && !FIR_CODES.some(([k]) => k === m[1])) return m[1];
  for (const [k, c] of FIR_CODES) if (u.includes(k)) return c;
  return '';
}

/** Ortsname für DEP/ DEST/: Grossbuchstaben, Umlaute aufgelöst, nur A–Z0–9 (BITTERFELDWOLFEN). */
export function fplName(s) {
  return (s || '').toUpperCase().replace(/Ä/g, 'AE').replace(/Ö/g, 'OE').replace(/Ü/g, 'UE').replace(/ß/g, 'SS').replace(/É|È|Ê/g, 'E').replace(/À|Â/g, 'A').replace(/[^A-Z0-9]/g, '').slice(0, 30);
}
/** Name «Balthasar Wicki» → «WICKI BALTHASAR» (Nachname zuerst). */
export function fplPerson(name, order = 'last-first') {
  const parts = (name || '').trim().toUpperCase().replace(/Ä/g, 'AE').replace(/Ö/g, 'OE').replace(/Ü/g, 'UE').replace(/ß/g, 'SS').split(/\s+/).filter(Boolean);
  if (parts.length < 2 || order !== 'last-first') return parts.join(' ');
  return `${parts[parts.length - 1]} ${parts.slice(0, -1).join(' ')}`;
}
/** Telefonnummer international ohne «+»: +41 79 611 12 10 → 0041796111210. */
export function fplPhone(p) {
  const s = (p || '').replace(/[\s\-()./]/g, '');
  if (!s) return '';
  return s.startsWith('+') ? '00' + s.slice(1) : s;
}
export const hhmm4 = (min) => { const m = Math.max(0, Math.round(min)); return `${String(Math.floor(m / 60)).padStart(2, '0')}${String(m % 60).padStart(2, '0')}`; };
const utcHHMM = (ms) => { const d = new Date(ms); return `${String(d.getUTCHours()).padStart(2, '0')}${String(d.getUTCMinutes()).padStart(2, '0')}`; };
const dof = (ms) => { const d = new Date(ms); return `${String(d.getUTCFullYear()).slice(2)}${String(d.getUTCMonth() + 1).padStart(2, '0')}${String(d.getUTCDate()).padStart(2, '0')}`; };

const COMPASS16 = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
export const compass16 = (deg) => COMPASS16[Math.round((((deg % 360) + 360) % 360) / 22.5) % 16];

/** Richtungsfolge aus einer Bahn: «NW LATER NNW THEN NE AND E» (Stundenabschnitte, Wiederholungen zusammengefasst). */
export function driftWords(points) {
  const pts = (points || []).filter((p) => p.lat != null);
  if (pts.length < 2) return '';
  const dirs = [];
  const step = Math.max(1, Math.floor(pts.length / 6));
  for (let k = step; k < pts.length; k += step) { const d = compass16(bearing(pts[k - step].lat, pts[k - step].lon, pts[k].lat, pts[k].lon)); if (dirs[dirs.length - 1] !== d) dirs.push(d); }
  if (!dirs.length) dirs.push(compass16(bearing(pts[0].lat, pts[0].lon, pts[pts.length - 1].lat, pts[pts.length - 1].lon)));
  const words = [dirs[0]];
  dirs.slice(1).forEach((d, i) => words.push(i === 0 ? `LATER ${d}` : i === dirs.length - 2 ? `AND ${d}` : `THEN ${d}`));
  return words.join(' ');
}

/** Flughöhe aus der Maximalhöhe: ab 5000 ft Flugfläche (F125), sonst VFR. */
export function fplLevel(altMaxFt, transitionFt = 5000) {
  if (!altMaxFt || altMaxFt < transitionFt) return 'VFR';
  return 'F' + String(Math.round(altMaxFt / 500) * 5).padStart(3, '0');
}

/** FIR-Folge → «EET/LKAA0330 LZBB1330» (Eintrittszeiten ab EOBT, erste FIR = Abflug-FIR entfällt). */
export function eetFromFirs(firs, startMs) {
  const seq = firs?.[0]?.seq || firs?.find((f) => f.seq?.length)?.seq || [];
  const out = [];
  seq.forEach((s, k) => {
    if (k === 0 && (s.fromKm || 0) <= 0.5) return;
    const code = firCode(s.name) || (s.country ? s.country + '??' : '????');
    const min = s.fromMs != null && startMs != null ? (s.fromMs - startMs) / 60000 : null;
    if (min != null && min >= 0 && !out.some((x) => x.code === code)) out.push({ code, min, name: s.name });
  });
  return out;
}

/**
 * Flugplan-Datensatz aus dem Briefing. S = Einstellungen (S.fpl Standardwerte), b = Briefing.
 * Liefert alle Felder; der Benutzer kann sie danach überschreiben (b.fpl.data).
 */
export function buildFpl(b, S, opts = {}) {
  const F = S.fpl || {};
  const type = b.balloon?.type === 'gas' ? 'gas' : 'hab';
  const T = F[type] || {};
  const startMs = b.time.startMs;
  const dur = b.intent?.durationMin || 120;
  const traj = b.panels?.['B.traj']?.content?.auto?.data;
  const firs = b.panels?.['C.airspace']?.content?.auto?.data?.firs || [];
  const tracks = (traj?.tracks || []).filter((x) => !x.belowGround && x.points?.length > 1);
  const mid = tracks[Math.floor(tracks.length / 2)];
  const pic = (S.persons || []).find((p) => p.id === b.persons?.picId) || {};
  const picPhone = fplPhone(pic.phone), sat = fplPhone(F.satphone);
  const vars = { picPhone, satphone: sat, pic: fplPerson(pic.name || b.persons?.pic, F.picNameOrder) };
  const tpl = (s) => (s || '').replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? '').replace(/\s+/g, ' ').trim();
  const stripCanton = (n) => (n || '').replace(/\s+[A-Z]{2}$/, '');   // «Oberlunkhofen AG» → OBERLUNKHOFEN
  const dep = { name: fplName(stripCanton(b.site?.name)), coord: b.site?.lat != null ? icao(b.site.lat, b.site.lon) : '' };
  const destPt = b.landing?.lat != null ? b.landing : (mid?.end || null);
  const destCoord = destPt ? icao(destPt.lat, destPt.lon) : '';
  const destName = fplName(stripCanton(b.landing?.name || ''));
  const dest = { name: destName && destName !== destCoord ? destName : '', coord: destCoord };
  const eet = eetFromFirs(firs, traj?.startMs ?? startMs);
  const kind = b.flight?.kind || 'private';
  const typeOfFlight = F.typeOfFlight?.[kind] || (kind === 'commercial' ? 'N' : 'G');
  const nvfr = !!b.flight?.nvfr;
  const enduranceMin = type === 'gas' ? (T.enduranceMin || 2880) : Math.max(dur + 30, Math.round(opts.fuelEnduranceMin || 0) || dur + 60);
  const contacts = [picPhone, sat].filter(Boolean);
  const isDefault = (v, def) => !v || v === def;
  // Standardvorlagen werden aus den vorhandenen Nummern gebaut (kein «AND» ins Leere); eigene Vorlagen roh ersetzt
  const rmkText = isDefault(F.rmk18, 'CREW CONTACT {picPhone} AND {satphone}') ? (contacts.length ? `CREW CONTACT ${contacts.join(' AND ')}` : '') : tpl(F.rmk18);
  const n19Text = isDefault(F.n19, 'GSM PIC {picPhone} AND SATPHONE {satphone}') ? [picPhone ? `GSM PIC ${picPhone}` : '', sat ? `SATPHONE ${sat}` : ''].filter(Boolean).join(' AND ') : tpl(F.n19);
  const rmkParts = [nvfr ? 'NVFR' : '', rmkText].filter(Boolean);
  return {
    v: 1,
    id7: (b.balloon?.reg || b.balloon?.id || '').replace(/[^A-Z0-9]/gi, '').toUpperCase(),
    rules8: 'V', typeOfFlight8: typeOfFlight,
    number9: '', type9: 'ZZZZ', wake9: 'L',
    equip10a: T.equip10a || F.equip10a || 'GY', equip10b: T.equip10b || F.equip10b || 'E',
    dep13: 'ZZZZ', eobt13: utcHHMM(startMs),
    speed15: T.speed15 || (type === 'gas' ? 'N0025' : 'N0015'), level15: fplLevel(b.intent?.altMaxFt, F.levelFromFt || 5000),
    drift15: mid ? driftWords(mid.points) : '', via15: '',
    dest16: 'ZZZZ', eet16: hhmm4(dur), altn16: 'ZZZZ', altn16b: type === 'gas' ? 'ZZZZ' : '',
    dep18: dep, dest18: dest, dof18: dof(startMs), eet18: eet.map((e) => ({ ...e, text: `${e.code}${hhmm4(e.min)}` })),
    typ18: T.typ18 || (type === 'gas' ? 'GAS BALLOON' : 'HOT AIR BALLOON'), altn18: 'UNKNOWN' + (type === 'gas' ? ' UNKNOWN' : ''), rmk18: rmkParts.join(' '),
    e19: hhmm4(enduranceMin), p19: 1 + (b.persons?.pax?.length || 0),
    r19: { uhf: !!F.r19?.uhf, vhf: F.r19?.vhf !== false, elba: !!F.r19?.elba },
    s19: { polar: !!F.s19?.polar, desert: !!F.s19?.desert, maritime: !!F.s19?.maritime, jungle: !!F.s19?.jungle },
    j19: { light: F.j19?.light !== false, fluores: !!F.j19?.fluores, uhf: !!F.j19?.uhf, vhf: !!F.j19?.vhf },
    d19: { number: F.d19?.number || '', capacity: F.d19?.capacity || '', cover: !!F.d19?.cover, colour: (F.d19?.colour || '').toUpperCase() },
    a19: (b.balloon?.colour || F.colour || 'WHITE').toUpperCase(),
    n19: n19Text,
    c19: vars.pic,
    nvfr, kind, type, generated: Date.now(),
  };
}

/** Route (Feld 15): «DRIFTING NW LATER NNW FROM BITTERFELDWOLFEN TO YELGAVA VIA WOLFSBURG SCHWERIN». */
export function routeText(d) {
  const parts = ['DRIFTING', d.drift15 || '', 'FROM', d.dep18?.name || d.dep18?.coord || 'ZZZZ', 'TO', d.dest18?.name || d.dest18?.coord || 'ZZZZ'];
  const via = (d.via15 || '').replace(/[,;/]+/g, ' ').split(/\s+/).map((w) => fplName(w)).filter(Boolean).join(' ');
  if (via) parts.push('VIA', via);
  return parts.filter(Boolean).join(' ').replace(/\s+/g, ' ');
}
/** Feld 18 als Text. */
export function otherInfo(d) {
  const out = [];
  const place = (p) => [p.name, p.coord].filter((x, i, a) => x && a.indexOf(x) === i).join(' ');
  if (d.dep18?.name || d.dep18?.coord) out.push(`DEP/${place(d.dep18)}`);
  if (d.dest18?.name || d.dest18?.coord) out.push(`DEST/${place(d.dest18)}`);
  if (d.dof18) out.push(`DOF/${d.dof18}`);
  if (d.eet18?.length) out.push(`EET/${d.eet18.map((e) => e.text).join(' ')}`);
  if (d.typ18) out.push(`TYP/${d.typ18}`);
  if (d.altn18) out.push(`ALTN/${d.altn18}`);
  if (d.rmk18) out.push(`RMK/${d.rmk18}`);
  return out.join(' ');
}
/** Feld 19 als Text (nicht übermittelt, aber im Formular). */
export function supplementary(d) {
  const flags = (o, keys) => keys.filter((k) => o?.[k]).map((k) => k[0].toUpperCase()).join('');
  const out = [`E/${d.e19}`, `P/${d.p19}`];
  const r = flags(d.r19, ['uhf', 'vhf', 'elba']); if (r) out.push(`R/${r}`);
  const s = flags(d.s19, ['polar', 'desert', 'maritime', 'jungle']); if (s) out.push(`S/${s}`);
  const j = flags(d.j19, ['light', 'fluores', 'uhf', 'vhf']); if (j) out.push(`J/${j}`);
  if (d.d19?.number) out.push(`D/${d.d19.number} ${d.d19.capacity || ''} ${d.d19.cover ? 'C' : ''} ${d.d19.colour || ''}`.replace(/\s+/g, ' ').trim());
  if (d.a19) out.push(`A/${d.a19}`);
  if (d.n19) out.push(`N/${d.n19}`);
  if (d.c19) out.push(`C/${d.c19}`);
  return out.join(' ');
}
/** ICAO-Nachricht (Doc 4444), Feld 19 als zusätzliche Zeile. */
export function fplMessage(d) {
  const lines = [
    `(FPL-${d.id7}-${d.rules8}${d.typeOfFlight8}`,
    `-${d.number9 || ''}${d.type9}/${d.wake9}-${d.equip10a}/${d.equip10b}`,
    `-${d.dep13}${d.eobt13}`,
    `-${d.speed15}${d.level15} ${routeText(d)}`,
    `-${d.dest16}${d.eet16} ${[d.altn16, d.altn16b].filter(Boolean).join(' ')}`.trimEnd(),
    `-${otherInfo(d)}`,
    `-${supplementary(d)})`,
  ];
  return lines.join('\n');
}
/** XML (einfaches, selbsterklärendes Schema; skybriefing-Import nicht verifiziert). */
export function fplXml(d, meta = {}) {
  const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const el = (n, v, attrs = '') => `  <${n}${attrs}>${esc(v)}</${n}>`;
  const flagsAttr = (o, keys) => keys.map((k) => ` ${k}="${o?.[k] ? 'true' : 'false'}"`).join('');
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<FlightPlan version="1" generator="${esc(meta.generator || 'Fahrtbriefing')}" generated="${new Date(d.generated || Date.now()).toISOString()}">`,
    el('MessageType', 'FPL'),
    el('AircraftIdentification', d.id7), el('FlightRules', d.rules8), el('TypeOfFlight', d.typeOfFlight8),
    el('NumberOfAircraft', d.number9), el('TypeOfAircraft', d.type9), el('WakeTurbulence', d.wake9),
    el('Equipment', d.equip10a), el('Surveillance', d.equip10b),
    el('DepartureAerodrome', d.dep13), el('EOBT', d.eobt13),
    el('CruisingSpeed', d.speed15), el('Level', d.level15), el('Route', routeText(d)),
    el('DestinationAerodrome', d.dest16), el('TotalEET', d.eet16), el('Alternate', d.altn16), el('SecondAlternate', d.altn16b),
    el('OtherInformation', otherInfo(d)),
    `  <OtherInformationItems>${['dep18', 'dest18'].map((k) => `<${k === 'dep18' ? 'DEP' : 'DEST'} name="${esc(d[k]?.name)}" coord="${esc(d[k]?.coord)}"/>`).join('')}<DOF>${esc(d.dof18)}</DOF>${(d.eet18 || []).map((e) => `<EET fir="${esc(e.code)}" time="${hhmm4(e.min)}"/>`).join('')}<TYP>${esc(d.typ18)}</TYP><ALTN>${esc(d.altn18)}</ALTN><RMK>${esc(d.rmk18)}</RMK></OtherInformationItems>`,
    '  <Supplementary>',
    `    <Endurance>${esc(d.e19)}</Endurance><PersonsOnBoard>${esc(d.p19)}</PersonsOnBoard>`,
    `    <EmergencyRadio${flagsAttr(d.r19, ['uhf', 'vhf', 'elba'])}/><SurvivalEquipment${flagsAttr(d.s19, ['polar', 'desert', 'maritime', 'jungle'])}/><Jackets${flagsAttr(d.j19, ['light', 'fluores', 'uhf', 'vhf'])}/>`,
    `    <Dinghies number="${esc(d.d19?.number)}" capacity="${esc(d.d19?.capacity)}" cover="${d.d19?.cover ? 'true' : 'false'}" colour="${esc(d.d19?.colour)}"/>`,
    `    <AircraftColour>${esc(d.a19)}</AircraftColour><Remarks>${esc(d.n19)}</Remarks><PilotInCommand>${esc(d.c19)}</PilotInCommand>`,
    '  </Supplementary>',
    `  <Message>${esc(fplMessage(d))}</Message>`,
    '</FlightPlan>',
  ].join('\n');
}
/** Plausibilitätsprüfung: Pflichtfelder und Formate. */
export function fplCheck(d) {
  const w = [];
  if (!/^[A-Z0-9]{2,7}$/.test(d.id7 || '')) w.push('id7');
  if (!/^\d{4}$/.test(d.eobt13 || '')) w.push('eobt13');
  if (!/^[NMK]\d{3,4}$/.test(d.speed15 || '')) w.push('speed15');
  if (!/^(F\d{3}|A\d{3}|VFR)$/.test(d.level15 || '')) w.push('level15');
  if (!/^\d{4}$/.test(d.eet16 || '')) w.push('eet16');
  if (!d.dep18?.coord) w.push('dep18');
  if (!d.dest18?.coord) w.push('dest18');
  if (!/^\d{6}$/.test(d.dof18 || '')) w.push('dof18');
  if (!/^\d{4}$/.test(d.e19 || '')) w.push('e19');
  if (!(d.p19 > 0)) w.push('p19');
  if (!d.c19) w.push('c19');
  if ((d.eet18 || []).some((e) => /\?/.test(e.code))) w.push('eet18');
  return w;
}
