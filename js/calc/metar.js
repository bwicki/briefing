/* Fahrtbriefing — METAR/TAF in Klartext (DE/EN). Deckt die üblichen Gruppen ab:
 * Wind (inkl. Böen, variabel), Sicht (m, SM, CAVOK), RVR, Wettererscheinungen,
 * Wolken (inkl. CB/TCU, VV), Temperatur/Taupunkt, QNH (Q/A), Trend (NOSIG,
 * BECMG, TEMPO), TAF-Gruppen (FM, BECMG, TEMPO, PROB), TX/TN, RMK wird nicht
 * übersetzt. Unbekannte Gruppen bleiben als Rohtext stehen. */

const L = {
  de: {
    wind: 'Wind', calm: 'Wind still', vrb: 'variabel', gust: 'Böen', from: 'aus', vis: 'Sicht', cavok: 'CAVOK (Sicht ≥ 10 km, keine Wolken unter 5000 ft/MSA, kein signifikantes Wetter)',
    nsw: 'kein signifikantes Wetter', clouds: 'Wolken', nsc: 'keine signifikanten Wolken', ncd: 'keine Wolken erkannt', skc: 'wolkenlos', vv: 'Vertikalsicht', temp: 'Temperatur', dew: 'Taupunkt', qnh: 'QNH',
    nosig: 'keine wesentliche Änderung erwartet', becmg: 'allmählich', tempo: 'zeitweise', prob: 'Wahrscheinlichkeit', fm: 'ab', valid: 'gültig', tx: 'Höchsttemperatur', tn: 'Tiefsttemperatur', auto: 'automatische Meldung', cor: 'Korrektur', amd: 'Änderung', obs: 'Beobachtung',
    cover: { FEW: '1–2/8', SCT: '3–4/8', BKN: '5–7/8', OVC: '8/8' }, cb: 'Cumulonimbus', tcu: 'Towering Cumulus', rvr: 'RVR', ws: 'Windscherung',
    int: { '-': 'leichter', '+': 'starker', VC: 'in der Nähe' },
    desc: { MI: 'flacher', BC: 'Bänke', PR: 'teilweise', DR: 'treibender', BL: 'verwehender', SH: 'Schauer', TS: 'Gewitter mit', FZ: 'gefrierender' },
    showers: '{wx}schauer', tsWith: 'Gewitter mit {wx}', bcfg: 'Nebelbänke',
    wx: { DZ: 'Sprühregen', RA: 'Regen', SN: 'Schnee', SG: 'Schneegriesel', IC: 'Eisnadeln', PL: 'Eiskörner', GR: 'Hagel', GS: 'Graupel', UP: 'unbekannter Niederschlag', BR: 'feuchter Dunst', FG: 'Nebel', FU: 'Rauch', VA: 'Vulkanasche', DU: 'Staub', SA: 'Sand', HZ: 'trockener Dunst', PY: 'Sprühnebel', PO: 'Staubwirbel', SQ: 'Bö', FC: 'Trichterwolke', SS: 'Sandsturm', DS: 'Staubsturm' },
  },
  en: {
    wind: 'Wind', calm: 'calm', vrb: 'variable', gust: 'gusts', from: 'from', vis: 'Visibility', cavok: 'CAVOK (vis ≥ 10 km, no cloud below 5000 ft/MSA, no significant weather)',
    nsw: 'no significant weather', clouds: 'Clouds', nsc: 'no significant cloud', ncd: 'no cloud detected', skc: 'sky clear', vv: 'vertical visibility', temp: 'Temperature', dew: 'dew point', qnh: 'QNH',
    nosig: 'no significant change expected', becmg: 'becoming', tempo: 'temporarily', prob: 'probability', fm: 'from', valid: 'valid', tx: 'max temperature', tn: 'min temperature', auto: 'automated report', cor: 'correction', amd: 'amended', obs: 'observation',
    cover: { FEW: '1–2/8', SCT: '3–4/8', BKN: '5–7/8', OVC: '8/8' }, cb: 'cumulonimbus', tcu: 'towering cumulus', rvr: 'RVR', ws: 'wind shear',
    int: { '-': 'light', '+': 'heavy', VC: 'in the vicinity' },
    desc: { MI: 'shallow', BC: 'patches of', PR: 'partial', DR: 'drifting', BL: 'blowing', SH: 'showers', TS: 'thunderstorm', FZ: 'freezing' },
    showers: '{wx} showers', tsWith: 'thunderstorm with {wx}', bcfg: 'fog patches',
    wx: { DZ: 'drizzle', RA: 'rain', SN: 'snow', SG: 'snow grains', IC: 'ice crystals', PL: 'ice pellets', GR: 'hail', GS: 'small hail', UP: 'unknown precipitation', BR: 'mist', FG: 'fog', FU: 'smoke', VA: 'volcanic ash', DU: 'dust', SA: 'sand', HZ: 'haze', PY: 'spray', PO: 'dust whirls', SQ: 'squall', FC: 'funnel cloud', SS: 'sandstorm', DS: 'duststorm' },
  },
};

const T = (n) => (n == null ? '' : String(+n));
/** Schwellen für die Hervorhebung (rot): Wind/Böen ab kt, Sicht unter m, Wolkenbasis BKN/OVC unter ft. */
export const BAD = { windKt: 14, visM: 5000, baseFt: 1500 };
export const MARK0 = '\u0001', MARK1 = '\u0002';
const B = (txt) => MARK0 + txt + MARK1;
/** Ist eine Rohgruppe «schlechtes Wetter» (für die Rot-Markierung im RAW-Text)? */
export function badToken(tk) {
  let m;
  if ((m = /^(\d{3}|VRB)(\d{2,3})(?:G(\d{2,3}))?(KT|MPS)$/.exec(tk))) { const f = m[4] === 'MPS' ? 1.944 : 1; return +m[2] * f >= BAD.windKt || (m[3] && +m[3] * f >= BAD.windKt); }
  if (/^WS\d{3}\//.test(tk)) return true;
  if (/^\d{4}(NDV)?$/.test(tk)) return +tk.slice(0, 4) < BAD.visM;
  if (/^\d{4}(N|S|E|W|NE|NW|SE|SW)$/.test(tk)) return +tk.slice(0, 4) < BAD.visM;
  if ((m = /^(\d+)(?:\/(\d+))?SM$/.exec(tk))) return (+m[1] / (m[2] ? +m[2] : 1)) < 3;
  if (/^R\d{2}[LCR]?\//.test(tk)) return true;
  if ((m = /^(FEW|SCT|BKN|OVC)(\d{3}|\/\/\/)(CB|TCU|\/\/\/)?$/.exec(tk))) return (m[3] === 'CB' || m[3] === 'TCU') || ((m[1] === 'BKN' || m[1] === 'OVC') && m[2] !== '///' && +m[2] * 100 <= BAD.baseFt);
  if (/^VV(\d{3}|\/\/\/)$/.test(tk)) return true;
  if (/^[-+]?(VC)?(MI|BC|PR|DR|BL|SH|TS|FZ)*(DZ|RA|SN|SG|IC|PL|GR|GS|UP|BR|FG|FU|VA|DU|SA|HZ|PY|PO|SQ|FC|SS|DS)+$/.test(tk) && tk !== 'NSW') return true;
  return false;
}
function windTxt(m, s) {
  const dir = m[1], spd = +m[2], g = m[3] ? +m[3] : null, unit = m[4];
  const kt = (v) => (unit === 'MPS' ? Math.round(v * 1.944) : v);
  if (dir === '000' && spd === 0) return s.calm;
  const d = dir === 'VRB' ? s.vrb : `${dir}°`;
  return `${d} ${kt(spd)} kt${g != null ? ` (${s.gust} ${kt(g)} kt)` : ''}`;
}
function visTxt(v, s) {
  if (v === '9999') return `${s.vis} ≥ 10 km`;
  if (/^\d{4}$/.test(v)) return `${s.vis} ${+v >= 1000 ? (+v / 1000).toFixed(+v % 1000 ? 1 : 0) + ' km' : v + ' m'}`;
  const sm = /^(?:(\d+) )?(\d+)(?:\/(\d+))?SM$/.exec(v);
  if (sm) { const val = (+(sm[1] || 0)) + (sm[3] ? +sm[2] / +sm[3] : +sm[2]); return `${s.vis} ${val} SM (${(val * 1.609).toFixed(1)} km)`; }
  return null;
}
function wxTxt(code, s) {
  let c = code, parts = [], vc = false;
  if (c[0] === '+' || c[0] === '-') { parts.push(s.int[c[0]]); c = c.slice(1); }
  if (c.startsWith('VC')) { vc = true; c = c.slice(2); }
  const descs = [], wx = [];
  while (c.length >= 2) {
    const g = c.slice(0, 2); c = c.slice(2);
    if (s.desc[g]) descs.push(g); else if (s.wx[g]) wx.push(s.wx[g]); else return null;
  }
  if (!descs.length && !wx.length) return null;
  let body = wx.join(' / ');
  if (descs.includes('SH') && body) { body = s.showers.replace('{wx}', body); descs.splice(descs.indexOf('SH'), 1); }
  if (descs.includes('BC') && body === s.wx.FG) { body = s.bcfg; descs.splice(descs.indexOf('BC'), 1); }
  if (descs.includes('TS')) { body = body ? s.tsWith.replace('{wx}', body) : s.desc.TS.replace(/ mit$/, ''); descs.splice(descs.indexOf('TS'), 1); }
  const words = descs.map((g) => s.desc[g]);
  return [...parts, ...words, body, vc ? s.int.VC : ''].filter(Boolean).join(' ');
}
function cloudTxt(m, s) {
  const cov = m[1], hft = m[2] === '///' ? null : +m[2] * 100, typ = m[3];
  return `${cov} (${s.cover[cov]})${hft != null ? ` ${hft} ft` : ''}${typ === 'CB' ? ` ${s.cb}` : typ === 'TCU' ? ` ${s.tcu}` : ''}`;
}
const tempVal = (x) => (x.startsWith('M') ? -+x.slice(1) : +x);

/** Gruppen eines Abschnitts (METAR-Hauptteil oder TAF-Gruppe) übersetzen. Gibt Liste von Teilen zurück. */
function decodeGroups(tokens, s, out) {
  const clouds = [], wx = [];
  let i = 0;
  while (i < tokens.length) {
    const tk = tokens[i]; i++;
    let m;
    if (tk === 'AUTO') { out.push(s.auto); continue; }
    if (tk === 'CAVOK') { out.push(s.cavok); continue; }
    if (tk === 'NSW') { out.push(s.nsw); continue; }
    if (tk === 'NSC') { clouds.push(s.nsc); continue; }
    if (tk === 'NCD') { clouds.push(s.ncd); continue; }
    if (tk === 'SKC' || tk === 'CLR') { clouds.push(s.skc); continue; }
    if ((m = /^(\d{3}|VRB)(\d{2,3})(?:G(\d{2,3}))?(KT|MPS)$/.exec(tk))) {
      const wt = windTxt(m, s); let txt = wt === s.calm ? wt : `${s.wind} ${wt}`;
      const v = /^(\d{3})V(\d{3})$/.exec(tokens[i] || ''); if (v) { txt += ` (${s.vrb} ${v[1]}°–${v[2]}°)`; i++; }
      out.push(badToken(tk) ? B(txt) : txt); continue;
    }
    if ((m = /^WS(\d{3})\/(\d{3})(\d{2,3})(?:G(\d{2,3}))?(KT|MPS)$/.exec(tk))) { out.push(B(`${s.ws} ${+m[1] * 100} ft: ${windTxt([null, m[2], m[3], m[4], m[5]], s)}`)); continue; }
    if (/^\d{4}(NDV)?$/.test(tk)) { const vt = visTxt(tk.slice(0, 4), s); if (vt) { out.push(badToken(tk) ? B(vt) : vt); continue; } }
    if (/^(\d+ )?\d+(\/\d+)?SM$/.test(tk) || (/^\d+$/.test(tk) && /^\d+\/\d+SM$/.test(tokens[i] || ''))) { const v = /^\d+$/.test(tk) ? `${tk} ${tokens[i++]}` : tk; const vt = visTxt(v, s); if (vt) { out.push(badToken(v.replace(/^\d+ /, '')) ? B(vt) : vt); continue; } }
    if ((m = /^(\d{4})(N|S|E|W|NE|NW|SE|SW)$/.exec(tk))) { const vt = `${s.vis} ${m[2]} ${+m[1] >= 1000 ? (+m[1] / 1000).toFixed(1) + ' km' : m[1] + ' m'}`; out.push(badToken(tk) ? B(vt) : vt); continue; }
    if ((m = /^R(\d{2}[LCR]?)\/([PM]?\d{4})(?:V([PM]?\d{4}))?([UDN])?$/.exec(tk))) { out.push(B(`${s.rvr} ${m[1]}: ${m[2].replace(/^P/, '>').replace(/^M/, '<')} m${m[3] ? `–${m[3].replace(/^P/, '>').replace(/^M/, '<')} m` : ''}`)); continue; }
    if ((m = /^(FEW|SCT|BKN|OVC)(\d{3}|\/\/\/)(CB|TCU|\/\/\/)?$/.exec(tk))) { clouds.push(badToken(tk) ? B(cloudTxt(m, s)) : cloudTxt(m, s)); continue; }
    if ((m = /^\/\/\/(CB|TCU)$/.exec(tk))) { clouds.push(B(m[1] === 'CB' ? s.cb : s.tcu)); continue; }
    if ((m = /^VV(\d{3}|\/\/\/)$/.exec(tk))) { clouds.push(B(`${s.vv} ${m[1] === '///' ? '?' : +m[1] * 100 + ' ft'}`)); continue; }
    if ((m = /^(M?\d{2})\/(M?\d{2})?$/.exec(tk))) { out.push(`${s.temp} ${tempVal(m[1])} °C${m[2] ? `, ${s.dew} ${tempVal(m[2])} °C` : ''}`); continue; }
    if ((m = /^Q(\d{4})$/.exec(tk))) { out.push(`${s.qnh} ${+m[1]} hPa`); continue; }
    if ((m = /^A(\d{4})$/.exec(tk))) { out.push(`${s.qnh} ${(+m[1] / 100).toFixed(2)} inHg (${Math.round(+m[1] / 100 * 33.8639)} hPa)`); continue; }
    if ((m = /^T([XN])(M?\d{2})\/(\d{2})(\d{2})Z$/.exec(tk))) { out.push(`${m[1] === 'X' ? s.tx : s.tn} ${tempVal(m[2])} °C (${m[3]}. ${m[4]}:00 UTC)`); continue; }
    if (/^[-+]?(VC)?[A-Z]{2,8}$/.test(tk)) { const w = wxTxt(tk, s); if (w) { wx.push(B(w)); continue; } }
    if (tk === 'NOSIG') { out.push(s.nosig); continue; }
    if (tk === 'RMK') break;   // Bemerkungen nicht übersetzen
    out.push(tk);   // unbekannt → roh
  }
  if (wx.length) out.push(wx.join(', '));
  if (clouds.length) out.push(`${s.clouds}: ${clouds.join(', ')}`);
}

/** METAR → Zeilen in Klartext. */
export function decodeMetar(raw, lang = 'de') {
  const s = L[lang] || L.de;
  const toks = String(raw || '').replace(/=$/, '').trim().split(/\s+/).filter(Boolean);
  if (!toks.length) return [];
  const out = [];
  let i = 0;
  if (toks[i] === 'METAR' || toks[i] === 'SPECI') i++;
  if (toks[i] === 'COR') { out.push(s.cor); i++; }
  const stn = toks[i++];
  let m = /^(\d{2})(\d{2})(\d{2})Z$/.exec(toks[i] || '');
  const head = [stn]; if (m) { head.push(`${s.obs} ${m[1]}. ${m[2]}:${m[3]} UTC`); i++; }
  // Trend-Gruppen abtrennen
  const rest = toks.slice(i);
  const trendIdx = rest.findIndex((x) => x === 'NOSIG' || x === 'BECMG' || x === 'TEMPO');
  const main = trendIdx >= 0 ? rest.slice(0, trendIdx) : rest;
  const lines = [head.join(' · ')];
  const parts = []; decodeGroups(main, s, parts); lines.push(...parts);
  if (trendIdx >= 0) {
    const tr = rest.slice(trendIdx);
    for (const grp of splitGroups(tr, ['BECMG', 'TEMPO', 'NOSIG'])) {
      if (grp[0] === 'NOSIG') { lines.push(`→ ${s.nosig}`); continue; }
      const p = []; decodeGroups(grp.slice(1).filter((x) => !/^(FM|TL|AT)\d{4}$/.test(x)), s, p);
      const times = grp.slice(1).filter((x) => /^(FM|TL|AT)\d{4}$/.test(x)).map((x) => `${x.slice(0, 2)} ${x.slice(2, 4)}:${x.slice(4)}`).join(' ');
      lines.push(`→ ${grp[0] === 'BECMG' ? s.becmg : s.tempo}${times ? ` ${times}` : ''}: ${p.join('; ')}`);
    }
  }
  return lines;
}

function splitGroups(tokens, starts) {
  const groups = []; let cur = null;
  for (const tk of tokens) {
    const isStart = starts.includes(tk) || /^PROB\d{2}$/.test(tk) || /^FM\d{6}$/.test(tk);
    if (isStart) {
      if (/^PROB\d{2}$/.test(tk) && cur && cur.length === 1 && /^PROB/.test(cur[0])) { cur.push(tk); continue; }
      if (cur) groups.push(cur); cur = [tk];
      continue;
    }
    if (!cur) cur = ['']; cur.push(tk);
  }
  if (cur) groups.push(cur);
  // PROBxx TEMPO zusammenziehen
  const out = [];
  for (let k = 0; k < groups.length; k++) {
    const g = groups[k];
    if (/^PROB\d{2}$/.test(g[0]) && g.length === 1 && groups[k + 1] && groups[k + 1][0] === 'TEMPO') { out.push([`${g[0]} TEMPO`, ...groups[k + 1].slice(1)]); k++; continue; }
    if (/^PROB\d{2}$/.test(g[0]) && g[1] === 'TEMPO') { out.push([`${g[0]} TEMPO`, ...g.slice(2)]); continue; }
    out.push(g);
  }
  return out;
}

/** 0.12.10: Zeitfenster der TAF-Änderungsgruppen (UTC-ms), in der Reihenfolge der Klartextzeilen ab Zeile 2 (Zeile 1 = Kopf,
 * Basisgruppe = null). refMs (Stand des Abrufs) liefert Monat/Jahr. FM-Gruppen gelten bis zur nächsten FM-Gruppe bzw. zum Ende der Gültigkeit. */
export function tafGroupWindows(raw, refMs = Date.now()) {
  const toks = String(raw || '').replace(/=$/, '').trim().split(/\s+/).filter(Boolean);
  let i = 0; if (toks[i] === 'TAF') i++;
  while (toks[i] === 'AMD' || toks[i] === 'COR') i++;
  i++;   // Station
  const ref = new Date(refMs || Date.now()); const Y = ref.getUTCFullYear(), M = ref.getUTCMonth(), D = ref.getUTCDate();
  const at = (dd, hh, mi = 0) => { let ms = Date.UTC(Y, M, dd, hh, mi); if (dd < D - 15) ms = Date.UTC(Y, M + 1, dd, hh, mi); else if (dd > D + 15) ms = Date.UTC(Y, M - 1, dd, hh, mi); return ms; };
  if (/^\d{6}Z$/.test(toks[i] || '')) i++;
  let m = /^(\d{2})(\d{2})\/(\d{2})(\d{2})$/.exec(toks[i] || ''); let validEnd = null; if (m) { validEnd = at(+m[3], +m[4]); i++; }
  const groups = splitGroups(toks.slice(i), ['BECMG', 'TEMPO']);
  const out = groups.map((g) => {
    const kw = g[0];
    if (kw === '') return null;
    if (/^FM\d{6}$/.test(kw)) return { from: at(+kw.slice(2, 4), +kw.slice(4, 6), +kw.slice(6)), to: validEnd, fm: true };
    const per = /^(\d{2})(\d{2})\/(\d{2})(\d{2})$/.exec(g[1] || ''); if (!per) return null;
    return { from: at(+per[1], +per[2]), to: at(+per[3], +per[4]) };
  });
  for (let k = 0; k < out.length; k++) if (out[k]?.fm) { const nx = out.slice(k + 1).find((x) => x?.fm); if (nx) out[k].to = nx.from; }
  return out;
}
/** 0.12.13: Ende der TAF-Gültigkeit (UTC-ms) oder null. */
export function tafValidEnd(raw, refMs = Date.now()) {
  const toks = String(raw || '').replace(/=$/, '').trim().split(/\s+/).filter(Boolean);
  let i = 0; if (toks[i] === 'TAF') i++;
  while (toks[i] === 'AMD' || toks[i] === 'COR') i++;
  i++; if (/^\d{6}Z$/.test(toks[i] || '')) i++;
  const m = /^(\d{2})(\d{2})\/(\d{2})(\d{2})$/.exec(toks[i] || ''); if (!m) return null;
  const ref = new Date(refMs || Date.now()); const Y = ref.getUTCFullYear(), M = ref.getUTCMonth(), D = ref.getUTCDate();
  const dd = +m[3], hh = +m[4];
  let ms = Date.UTC(Y, M, dd, hh); if (dd < D - 15) ms = Date.UTC(Y, M + 1, dd, hh); else if (dd > D + 15) ms = Date.UTC(Y, M - 1, dd, hh);
  return ms;
}
/** TAF → Zeilen in Klartext (Basis + Änderungsgruppen). */
export function decodeTaf(raw, lang = 'de') {
  const s = L[lang] || L.de;
  const toks = String(raw || '').replace(/=$/, '').trim().split(/\s+/).filter(Boolean);
  if (!toks.length) return [];
  let i = 0; const lines = [];
  if (toks[i] === 'TAF') i++;
  const flags = [];
  while (toks[i] === 'AMD' || toks[i] === 'COR') { flags.push(toks[i] === 'AMD' ? s.amd : s.cor); i++; }
  const stn = toks[i++];
  let m = /^(\d{2})(\d{2})(\d{2})Z$/.exec(toks[i] || ''); const issued = m ? `${m[1]}. ${m[2]}:${m[3]} UTC` : ''; if (m) i++;
  m = /^(\d{2})(\d{2})\/(\d{2})(\d{2})$/.exec(toks[i] || ''); const valid = m ? `${s.valid} ${m[1]}. ${m[2]}:00 – ${m[3]}. ${m[4]}:00 UTC` : ''; if (m) i++;
  lines.push([stn, ...flags, issued, valid].filter(Boolean).join(' · '));
  const groups = splitGroups(toks.slice(i), ['BECMG', 'TEMPO']);
  for (const g of groups) {
    const kw = g[0]; let body = g.slice(1); let label = '';
    if (kw === '') label = '';
    else if (/^FM\d{6}$/.test(kw)) label = `${s.fm} ${kw.slice(2, 4)}. ${kw.slice(4, 6)}:${kw.slice(6)} UTC`;
    else {
      const per = /^(\d{2})(\d{2})\/(\d{2})(\d{2})$/.exec(body[0] || ''); if (per) body = body.slice(1);
      const when = per ? ` ${per[1]}. ${per[2]}:00 – ${per[3]}. ${per[4]}:00 UTC` : '';
      const pm = /^PROB(\d{2})( TEMPO)?$/.exec(kw);
      label = pm ? `${s.prob} ${pm[1]} %${pm[2] ? ` ${s.tempo}` : ''}${when}` : `${kw === 'BECMG' ? s.becmg : s.tempo}${when}`;
    }
    const p = []; decodeGroups(body, s, p);
    lines.push(`${label ? '→ ' + label + ': ' : ''}${p.join('; ')}`);
  }
  return lines;
}
