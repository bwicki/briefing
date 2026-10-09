/* Fahrtbriefing — eingefügte amtliche Textberichte (0.12.15).
 *
 * Erkennt die «Flugwetterprognose für die Schweiz» (MeteoSchweiz/skybriefing): Kopf, Ausgabezeit, Gültigkeit,
 * Abschnitte (Zwischentitel mit Doppelpunkt), Windtabellen je Station (Payerne/Zürich/Lugano) und die
 * Prognosewerte der freien Atmosphäre. Daraus: lesbare Gliederung (Zeilenumbrüche innerhalb eines Absatzes
 * entfernt) und die Gültigkeit für die Aktualitätswarnung. Für andere Texte eine generische Gliederung und,
 * wo erkennbar, «gültig bis» / «VALID».
 */

const MONTHS_DE = { januar: 0, februar: 1, märz: 2, maerz: 2, april: 3, mai: 4, juni: 5, juli: 6, august: 7, september: 8, oktober: 9, november: 10, dezember: 11 };

/** «am Freitag, den 9. Oktober 2026, 11:00 UTC» → UTC-ms (auch ohne Komma vor der Zeit). */
export function parseDeDateUtc(s) {
  const m = /(\d{1,2})\.\s*([A-Za-zäöüÄÖÜ]+)\s+(\d{4})[,\s]+(\d{1,2}):(\d{2})\s*UTC/.exec(s || '');
  if (!m) return null;
  const mo = MONTHS_DE[m[2].toLowerCase()]; if (mo == null) return null;
  return Date.UTC(+m[3], mo, +m[1], +m[4], +m[5]);
}

/** PS04 → +4, MS03 → −3 (Temperaturangabe der Flugwetterprognose). */
const tempOf = (s) => { const m = /^(PS|MS)(\d{2})$/.exec(s || ''); return m ? (m[1] === 'MS' ? -1 : 1) * +m[2] : null; };

/** Gliederung eines Textes in Blöcke: {kind:'h'|'p'|'kv', text} – Zwischentitel = Zeile mit Doppelpunkt am Ende oder kurze
 * alleinstehende Zeile ohne Satzpunkt; Absätze = aufeinanderfolgende Zeilen (harte Umbrüche entfernt). */
export function textBlocks(text) {
  const lines = String(text || '').replace(/\r/g, '').split('\n');
  const out = []; let para = [];
  const flush = () => { if (para.length) { out.push({ kind: 'p', text: para.join(' ').replace(/\s+/g, ' ').trim() }); para = []; } };
  for (let i = 0; i < lines.length; i++) {
    const ln = lines[i].trim();
    if (!ln) { flush(); continue; }
    const next = (lines[i + 1] || '').trim(), prev = (lines[i - 1] || '').trim();
    const isHead = /:$/.test(ln) && ln.length < 70 && !/\d:\d\d$/.test(ln);
    const isTitle = !prev && (!next || /:$/.test(next) === false) && ln.length < 80 && !/[.!?]$/.test(ln) && !/^\d/.test(ln) && !/^\S{1,8}\s*-\s/.test(ln) && (i === 0 || !next || lines[i + 1] === '' || /^(Wetterlage|Wolken|Wind|Prognosewerte|Gefahren|Aussichten|Wetterentwicklung|Nächste)/i.test(ln));
    if (isHead) { flush(); out.push({ kind: 'h', text: ln.replace(/:$/, '') }); continue; }
    if (isTitle && (!next || lines[i + 1] === '')) { flush(); out.push({ kind: 'h', text: ln }); continue; }
    const kv = /^([A-Za-zäöüÄÖÜ ]{4,30}):\s+(.+)$/.exec(ln);
    if (kv && !next.includes(' - ')) { flush(); out.push({ kind: 'kv', k: kv[1].trim(), v: kv[2].trim() }); continue; }
    para.push(ln);
  }
  flush();
  return out;
}

/** Windtabellen «Payerne - 12:00 UTC / 18:00 UTC … 05000FT - 240/13 PS03 / 240/20 PS06». Liefert die Tabellen und die Zeilenindizes, die sie belegen. */
export function parseWindTables(text) {
  const lines = String(text || '').replace(/\r/g, '').split('\n');
  const tables = []; const used = new Set();
  for (let i = 0; i < lines.length; i++) {
    const m = /^([A-Za-zäöüÄÖÜ. ]{3,20}?)\s*-\s*(\d{1,2}:\d{2})\s*UTC\s*\/\s*(\d{1,2}:\d{2})\s*UTC\s*$/.exec(lines[i].trim());
    if (!m) continue;
    const tb = { station: m[1].trim(), times: [m[2], m[3]], rows: [] }; used.add(i);
    for (let k = i + 1; k < lines.length; k++) {
      const ln = lines[k].trim(); if (!ln) break;
      if (/^Höhe/i.test(ln)) { used.add(k); continue; }
      const g = /^Ground\s*-\s*(.+)$/i.exec(ln);
      if (g) { tb.ground = g[1].trim(); used.add(k); continue; }
      const r = /^(\d{4,5})FT\s*-\s*(\S+)\s+(PS\d{2}|MS\d{2})\s*\/\s*(\S+)\s+(PS\d{2}|MS\d{2})/.exec(ln);
      if (r) { tb.rows.push({ ft: +r[1], w1: r[2], t1: tempOf(r[3]), w2: r[4], t2: tempOf(r[5]) }); used.add(k); continue; }
      break;
    }
    if (tb.rows.length) tables.push(tb);
  }
  return { tables, used };
}

/** Gültigkeit aus dem Text: Flugwetterprognose CH (Ausgabe, «gültig für hh:mm - hh:mm UTC», «Nächste Aktualisierung …»),
 * sonst «VALID ddhhmm/ddhhmm», «gültig bis dd.mm.yyyy hh:mm» oder «VALID hh UTC dd.mm.yyyy». null, wenn nichts erkennbar. */
export function reportValidity(text, refMs = Date.now()) {
  const s = String(text || '');
  if (!s.trim()) return null;
  const issued = parseDeDateUtc(s);
  let from = null, to = null, next = null;
  const v = /gültig\s+(?:für|von)?\s*(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})\s*UTC/i.exec(s);
  if (issued != null && v) {
    const d = new Date(issued);
    from = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), +v[1], +v[2]);
    to = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), +v[3], +v[4]);
    if (to < from) to += 86400000;
  }
  const nx = /Nächste Aktualisierung\s+am\s+([^\n]+)/i.exec(s);
  if (nx) next = parseDeDateUtc(nx[1]);
  if (from == null && to == null) {
    const ref = new Date(refMs);
    const vv = /VALID\s+(\d{2})(\d{2})(\d{2})\s*\/\s*(\d{2})(\d{2})(\d{2})/i.exec(s);   // SIGMET/TAF-Art ddhhmm/ddhhmm
    if (vv) { const at = (dd, hh, mi) => { let ms = Date.UTC(ref.getUTCFullYear(), ref.getUTCMonth(), dd, hh, mi); if (dd < ref.getUTCDate() - 15) ms = Date.UTC(ref.getUTCFullYear(), ref.getUTCMonth() + 1, dd, hh, mi); return ms; }; from = at(+vv[1], +vv[2], +vv[3]); to = at(+vv[4], +vv[5], +vv[6]); }
    const gb = /gültig\s+bis\s+(\d{1,2})\.(\d{1,2})\.(\d{4})[,\s]+(\d{1,2}):(\d{2})/i.exec(s);
    if (gb) to = Date.UTC(+gb[3], +gb[2] - 1, +gb[1], +gb[4], +gb[5]);
    const vt = /VALID\s+(\d{2})\s*UTC\s+(\d{1,2})\.(\d{1,2})\.(\d{4})/i.exec(s) || /VALID\s+(\d{2})\s*UTC\s+(\d{1,2})\.(\d{1,2})\.(\d{2})\b/i.exec(s);   // SIGWX-Karten: «VALID 12 UTC 09.10.2026»
    if (vt) { const y = vt[4].length === 2 ? 2000 + +vt[4] : +vt[4]; const fx = Date.UTC(y, +vt[3] - 1, +vt[2], +vt[1]); from = fx - 3 * 3600000; to = fx + 3 * 3600000; }
  }
  if (from == null && to == null && next == null && issued == null) return null;
  return { issued, from, to, next };
}

/** Strukturierte Fassung: Blöcke ohne die Windtabellen, Windtabellen, Gültigkeit. */
export function parseReport(text) {
  const { tables, used } = parseWindTables(text);
  const lines = String(text || '').replace(/\r/g, '').split('\n');
  const rest = lines.filter((_, i) => !used.has(i)).join('\n');
  return { blocks: textBlocks(rest), wind: tables, validity: reportValidity(text), ch: /Flugwetterprognose für die Schweiz/i.test(text || '') };
}
