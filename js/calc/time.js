/* Fahrtbriefing — Zeit und Zeitzonen.
 *
 * Intern rechnet die App in UTC-Millisekunden. Alles, was ein Mensch sieht,
 * wird über die IANA-Zeitzone des Startorts (z. B. Europe/Zurich) formatiert.
 * Die Umkehrung — Lokalzeit am Ort → UTC — braucht den Versatz dieser Zone zu
 * genau diesem Zeitpunkt; der wird aus Intl ermittelt, Sommerzeit inklusive.
 */

const pad = (n) => String(n).padStart(2, '0');

/** Versatz der Zone in Minuten (Ost positiv) zum Zeitpunkt `ms`. */
export function tzOffsetMin(tz, ms) {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone: tz, hourCycle: 'h23',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
  const p = {};
  for (const { type, value } of dtf.formatToParts(new Date(ms))) p[type] = value;
  const asUtc = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second);
  return Math.round((asUtc - Math.floor(ms / 1000) * 1000) / 60000);
}

/** Lokale Kalenderteile des Zeitpunkts in der Zone. */
export function localParts(tz, ms) {
  const off = tzOffsetMin(tz, ms);
  const d = new Date(ms + off * 60000);
  return {
    y: d.getUTCFullYear(), m: d.getUTCMonth() + 1, d: d.getUTCDate(),
    hh: d.getUTCHours(), mm: d.getUTCMinutes(), wd: d.getUTCDay(), off,
  };
}

/** "YYYY-MM-DD" + "HH:MM" in der Zone → UTC-Millisekunden. */
export function fromLocal(tz, dateStr, timeStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const [hh, mm] = (timeStr || '00:00').split(':').map(Number);
  let guess = Date.UTC(y, m - 1, d, hh, mm);
  // zwei Iterationen reichen auch über Sommerzeitwechsel hinweg
  for (let i = 0; i < 2; i++) guess = Date.UTC(y, m - 1, d, hh, mm) - tzOffsetMin(tz, guess) * 60000;
  return guess;
}

export const isoDate = (tz, ms) => { const p = localParts(tz, ms); return `${p.y}-${pad(p.m)}-${pad(p.d)}`; };
export const hhmm = (tz, ms) => { const p = localParts(tz, ms); return `${pad(p.hh)}:${pad(p.mm)}`; };
export const hhmmCompact = (tz, ms) => hhmm(tz, ms).replace(':', '');
export const utcHHMM = (ms) => hhmm('UTC', ms);

/** "Sa 10.10.2026" */
export function fmtDate(tz, ms, lang = 'de') {
  const p = localParts(tz, ms);
  const wd = (lang === 'en' ? ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] : ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'])[p.wd];
  return `${wd} ${pad(p.d)}.${pad(p.m)}.${p.y}`;
}
export function fmtDateTime(tz, ms, lang = 'de') { return `${fmtDate(tz, ms, lang)} ${hhmm(tz, ms)}`; }

/** Zeitzonen-Kürzel wie "LT (UTC+2)". */
export function tzLabel(tz, ms) {
  const off = tzOffsetMin(tz, ms);
  const s = off >= 0 ? '+' : '−';
  const a = Math.abs(off);
  return `UTC${s}${a / 60 | 0}${a % 60 ? ':' + pad(a % 60) : ''}`;
}

export const addMin = (ms, min) => ms + min * 60000;
export const roundToMin = (ms, step = 5) => Math.round(ms / (step * 60000)) * step * 60000;
export const floorToMin = (ms, step = 5) => Math.floor(ms / (step * 60000)) * step * 60000;

/** Dauer in Minuten als "1:30 h". */
export function fmtDur(min) {
  const m = Math.round(min);
  return `${Math.floor(m / 60)}:${pad(m % 60)} h`;
}
