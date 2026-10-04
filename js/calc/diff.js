/* Fahrtbriefing — Änderungen seit der letzten Final-Version.
 *
 * Vergleicht den aktuellen Datensatz mit dem Schnappschuss der letzten Freigabe
 * (b.versions[last].snapshot): Stammfelder (Zeit, Ort, Ballon, Absicht,
 * Personen, Zeitplan) und je Panel Inhalt, Zusatzinfo, KI-Hinweis, Kommentar.
 * Liefert { since: {no, ts}, fields: [...], panels: [...] } oder null ohne Final.
 */
const stable = (v) => JSON.stringify(v, (k, x) => (k === 'updatedAt' || k === 'updatedBy' || k === 'stand' || k === 'fetched' || k === 'ts' ? undefined : x));

export function changesSinceFinal(b) {
  const last = (b.versions || []).slice(-1)[0];
  if (!last?.snapshot) return null;
  const s = last.snapshot;
  const fields = [];
  const cmp = (key, a, c) => { if (stable(a) !== stable(c)) fields.push(key); };
  cmp('time', { d: b.time?.date, t: b.time?.time, ms: b.time?.startMs }, { d: s.time?.date, t: s.time?.time, ms: s.time?.startMs });
  cmp('site', { n: b.site?.name, lat: b.site?.lat, lon: b.site?.lon }, { n: s.site?.name, lat: s.site?.lat, lon: s.site?.lon });
  cmp('balloon', b.balloon?.label, s.balloon?.label);
  cmp('intent', b.intent, s.intent);
  cmp('landing', { n: b.landing?.name, lat: b.landing?.lat, lon: b.landing?.lon }, { n: s.landing?.name, lat: s.landing?.lat, lon: s.landing?.lon });
  cmp('persons', b.persons, s.persons);
  cmp('schedule', { m: b.schedule?.meetingName, d: b.schedule?.driveMin, o: b.schedule?.overrides, r: b.schedule?.rigMin }, { m: s.schedule?.meetingName, d: s.schedule?.driveMin, o: s.schedule?.overrides, r: s.schedule?.rigMin });
  cmp('weather', { t: b.weather?.tempC, q: b.weather?.qnh, rh: b.weather?.rh, e: b.weather?.envTempC }, { t: s.weather?.tempC, q: s.weather?.qnh, rh: s.weather?.rh, e: s.weather?.envTempC });
  const panels = [];
  const keys = new Set([...Object.keys(b.panels || {}), ...Object.keys(s.panels || {})]);
  for (const k of keys) {
    const a = b.panels?.[k] || {}, c = s.panels?.[k] || {};
    const what = [];
    if (stable(a.content) !== stable(c.content)) what.push('content');
    if (stable(a.extra) !== stable(c.extra)) what.push('extra');
    if ((a.ai?.text || '') !== (c.ai?.text || '')) what.push('ai');
    if ((a.comment || '') !== (c.comment || '')) what.push('comment');
    if (what.length) panels.push({ key: k, what });
  }
  return { since: { no: last.no, ts: last.ts, who: last.who }, fields, panels, any: fields.length + panels.length > 0 };
}
