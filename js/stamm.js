/* Fahrtbriefing — Stamm: eigene Stammdaten plus die von anderen Benutzern
 * freigegebenen Teile (Ballone, Personen, Startplätze, Treffpunkte, Betreiber).
 *
 * Freigegebene Einträge erhalten die ID «<benutzer>:<id>», damit sie sich nicht
 * mit eigenen überschneiden; die Kennung bleibt in `reg`, der Geber in `ownerId`/
 * `ownerName`. Der Worker setzt daraus den Materialeigner des Briefings. */

export const SHARE_CATEGORIES = ['balloons', 'persons', 'sites', 'meetings', 'operators'];

export function mergedStamm(settings, shared = []) {
  const copy = (arr) => (arr || []).map((x) => ({ ...x }));
  const out = {
    ...settings,
    balloons: { ...settings.balloons, hab: copy(settings.balloons?.hab), envelopes: copy(settings.balloons?.envelopes), baskets: copy(settings.balloons?.baskets) },
    persons: copy(settings.persons), sites: copy(settings.sites), meetings: copy(settings.meetings), operators: copy(settings.operators),
  };
  for (const s of shared || []) {
    const st = s.stamm || {};
    const mark = (x, withReg) => ({ ...x, id: `${s.from}:${x.id}`, ...(withReg ? { reg: x.reg || x.id } : {}), ownerId: s.from, ownerName: s.fromName || s.from, shared: true, default: false, favorite: !!x.favorite });
    if (st.balloons) {
      out.balloons.hab.push(...(st.balloons.hab || []).map((x) => mark(x, true)));
      out.balloons.envelopes.push(...(st.balloons.envelopes || []).map((x) => mark(x, true)));
      out.balloons.baskets.push(...(st.balloons.baskets || []).map((x) => mark(x, false)));
    }
    if (st.sites) out.sites.push(...st.sites.map((x) => ({ ...mark(x, false), meetingId: x.meetingId ? `${s.from}:${x.meetingId}` : '' })));
    for (const c of ['persons', 'meetings', 'operators']) if (st[c]) out[c].push(...st[c].map((x) => mark(x, false)));
  }
  return out;
}

/** Anzeigename mit Geber-Zusatz für freigegebene Einträge. */
export const stammLabel = (x, base) => (x?.shared ? `${base} (${x.ownerName})` : base);
