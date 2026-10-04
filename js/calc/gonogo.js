/* Fahrtbriefing — Go/No-Go-Tendenz aus den gespeicherten Modellstunden.
 *
 * Kein Startentscheid: die Funktion fasst zusammen, was die Stundenampel des
 * Meteogramms im Fahrtfenster sagt, und prüft die vier Kriterien aus den
 * Einstellungen (Trockenfenster, Gewitterabstand, Mittelwind, Böen). Ergebnis
 * 2 = fahrbar, 1 = grenzwertig, 0 = nein, null = keine Daten; dazu die Gründe.
 */
const MS_TO_KT = 1.943844;

export function goNoGo(b, settings) {
  const snap = b.panels?.['B.meteogram']?.content?.auto;
  const recs = snap?.data?.recs;
  if (!recs?.length) return { level: null, reasons: [], stand: null };
  const g = settings.goNoGo || {};
  const start = b.time.startMs, landing = start + (b.intent.durationMin || 0) * 60000;
  const win = recs.filter((r) => r.ms >= start - 1800000 && r.ms <= landing + 1800000);
  if (!win.length) return { level: null, reasons: [], stand: snap.stand };
  const reasons = [];
  let level = 2;
  const down = (to, why) => { if (to < level) level = to; if (why && !reasons.includes(why)) reasons.push(why); };
  // Stundenampel im Fenster
  const worst = Math.min(...win.map((r) => (r.fly == null ? 2 : r.fly)));
  const worstRec = win.find((r) => r.fly === worst);
  if (worst < 2) down(worst, worstRec?.why?.length ? worstRec.why.join(', ') : null);
  // Trockenfenster: Stunden ohne Niederschlag rund um die Fahrt
  const dryH = g.dryWindowH ?? 3;
  const around = recs.filter((r) => r.ms >= start - dryH * 3600000 && r.ms <= landing + dryH * 3600000);
  const wet = around.filter((r) => (r.precip || 0) >= 0.1);
  if (wet.length) down(wet.some((r) => r.ms >= start - 3600000 && r.ms <= landing + 3600000) ? 0 : 1, `Niederschlag innert ±${dryH} h (${wet.length} h)`);
  // Gewitterabstand: CAPE über Grenzwert innerhalb noTsH
  const tsH = g.noTsH ?? 3, capeNo = settings.flyLimits?.cape?.[1] ?? 800, capeLim = settings.flyLimits?.cape?.[0] ?? 300;
  const ts = recs.filter((r) => r.ms >= start - tsH * 3600000 && r.ms <= landing + tsH * 3600000 && (r.cape || 0) >= capeLim);
  if (ts.length) down(ts.some((r) => r.cape >= capeNo) ? 0 : 1, `CAPE bis ${Math.round(Math.max(...ts.map((r) => r.cape)))} J/kg innert ±${tsH} h`);
  // Mittelwind / Böen (kt) im Fenster
  const maxW = Math.max(...win.map((r) => (r.w10 || 0) * MS_TO_KT)), maxG = Math.max(...win.map((r) => (r.gust || 0) * MS_TO_KT));
  if (g.meanWindKt && maxW > g.meanWindKt) down(maxW > g.meanWindKt * 1.3 ? 0 : 1, `Mittelwind ${Math.round(maxW)} kt > ${g.meanWindKt} kt`);
  if (g.gustKt && maxG > g.gustKt) down(maxG > g.gustKt * 1.3 ? 0 : 1, `Böen ${Math.round(maxG)} kt > ${g.gustKt} kt`);
  return { level, reasons, stand: snap.stand, model: snap.modelName, hours: win.length, maxWindKt: Math.round(maxW), maxGustKt: Math.round(maxG) };
}
