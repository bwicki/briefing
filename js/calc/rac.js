/* Fahrtbriefing — Tag- und Nachtgrenzen Schweiz (VFR Manual RAC 4-4).
 *
 * Die amtliche Tabelle (BCMT, SR, SS, ECET je Kalendertag, Lokalzeit, Referenz
 * Sternwarte Bern, gültig für die ganze FIR Schweiz) liegt als JSON vor:
 *   { validFrom, validTo, days: { "YYYY-MM-DD": { bcmt, sr, ss, ecet } } }
 * Das JSON entsteht aus dem PDF-Text — `parseRacText()` versteht genau das
 * Zeilenformat des eVFR-Manuals:
 *   "2026 FIR SWITZERLAND (LT)"       Jahreszeile
 *   "OCT NOV DEC"                     Monatszeile (ein bis drei Monate)
 *   "1 0658 0729 1910 1940 0641 …"    Tageszeile: Tag, dann je Monat vier Zeiten
 * Monate, die den Tag nicht haben (31., 29./30. Februar), fehlen in der Zeile;
 * die Gruppen werden darum der Reihe nach den Monaten zugeordnet, die den Tag
 * besitzen.
 */

const MON = { JAN: 1, FEB: 2, MAR: 3, APR: 4, MAY: 5, JUN: 6, JUL: 7, AUG: 8, SEP: 9, OCT: 10, NOV: 11, DEC: 12 };
const daysInMonth = (y, m) => new Date(Date.UTC(y, m, 0)).getUTCDate();
const pad = (n) => String(n).padStart(2, '0');

/** Text (Zeilen des PDFs) → Tabelle. Wirft, wenn nichts Brauchbares gefunden wird. */
export function parseRacText(text, source = '') {
  const lines = String(text).split(/\r?\n/).map((l) => l.replace(/\s+/g, ' ').trim());
  let year = null, months = null;
  const days = {};
  const problems = [];
  for (const l of lines) {
    let m = /^(\d{4})\s+FIR\s+SWITZERLAND/i.exec(l);
    if (m) { year = +m[1]; months = null; continue; }
    m = /^((?:JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)(?:\s+(?:JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC))*)$/i.exec(l);
    if (m) { months = l.toUpperCase().split(' ').map((x) => MON[x]); continue; }
    m = /^(\d{1,2})((?:\s+\d{4}){4,12})$/.exec(l);
    if (m && year && months) {
      const day = +m[1];
      const nums = m[2].trim().split(' ');
      const groups = [];
      for (let i = 0; i + 3 < nums.length; i += 4) groups.push(nums.slice(i, i + 4));
      const valid = months.filter((mo) => day <= daysInMonth(year, mo));
      if (groups.length !== valid.length) { problems.push(`${year} ${months.join('/')} Tag ${day}: ${groups.length} Gruppen, ${valid.length} erwartet`); continue; }
      valid.forEach((mo, i) => {
        const g = groups[i];
        if (!g.every((t) => /^\d{4}$/.test(t) && +t.slice(0, 2) < 24 && +t.slice(2) < 60)) { problems.push(`${year}-${pad(mo)}-${pad(day)}: ungültige Zeit`); return; }
        days[`${year}-${pad(mo)}-${pad(day)}`] = { bcmt: g[0], sr: g[1], ss: g[2], ecet: g[3] };
      });
    }
  }
  const keys = Object.keys(days).sort();
  if (!keys.length) throw new Error('Keine RAC-4-4-Tabelle im Text gefunden');
  return {
    source, reference: 'Sternwarte Bern 46°57N 007°26E', timezone: 'LT (MEZ/MESZ)',
    validFrom: keys[0], validTo: keys[keys.length - 1], days, problems,
  };
}

/** Eintrag für ein Datum "YYYY-MM-DD" oder null. */
export function racLookup(table, dateStr) {
  if (!table || !table.days) return null;
  return table.days[dateStr] || null;
}

/** "0710" → "07:10" */
export const racFmt = (t) => (t ? `${t.slice(0, 2)}:${t.slice(2)}` : '–');

/** Gültigkeit als Text, z. B. "01.10.2026 – 31.12.2027". */
export function racValidity(table) {
  if (!table) return '';
  const f = (s) => { const [y, m, d] = s.split('-'); return `${d}.${m}.${y}`; };
  return `${f(table.validFrom)} – ${f(table.validTo)}`;
}

/**
 * pdf.js-Textinhalt (items mit str und transform) → Zeilen. Items mit gleicher
 * y-Lage (±2 pt) bilden eine Zeile, innerhalb der Zeile nach x sortiert.
 */
export function linesFromPdfItems(items) {
  const rows = [];
  for (const it of items) {
    if (!it.str || !it.str.trim()) continue;
    const x = it.transform[4], y = it.transform[5];
    let row = rows.find((r) => Math.abs(r.y - y) < 2.5);
    if (!row) { row = { y, items: [] }; rows.push(row); }
    row.items.push({ x, s: it.str });
  }
  rows.sort((a, b) => b.y - a.y);
  return rows.map((r) => r.items.sort((a, b) => a.x - b.x).map((i) => i.s).join(' '));
}
