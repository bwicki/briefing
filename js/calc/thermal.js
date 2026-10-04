/* Fahrtbriefing — Thermik-Abschätzung aus Modell-Stundenwerten (Näherung, keine Messung).
 *
 * Grundlage: Globalstrahlung (shortwave_radiation), Grenzschichthöhe (boundary_layer_height,
 * AGL), 2-m-Temperatur, Feuchte, Böen. Rechnung:
 *   sensibler Wärmestrom  H ≈ f · Globalstrahlung, f = 0.30 (trocken) … 0.18 (feucht, RH ≥ 85 %)
 *   kinematisch           H' = H / (ρ cp) = H / (1.2 · 1005)        [K·m/s]
 *   Deardorff-Skala       w* = (g / T · H' · zi)^(1/3)              [m/s], zi = Grenzschichthöhe
 * Typische Steigwerte in Thermikblasen ≈ 0.6–0.8 · w*; Böigkeit (Böe − Mittelwind) am Boden ist
 * ein zweiter Hinweis auf konvektive Durchmischung. Einsetzen = erste Stunde mit w* ≥ 1.0 m/s
 * (nach Sonnenaufgang), Abschwächen = letzte Stunde mit w* ≥ 1.0 m/s. Klassen:
 *   < 0.6 keine · 0.6–1.2 schwach · 1.2–2.0 mässig · 2.0–3.0 kräftig · > 3.0 stark
 * Für Ballonfahrten relevant: ab «mässig» spürbare Turbulenz in Bodennähe, Start/Landung
 * vorzugsweise vor dem Einsetzen bzw. nach dem Abschwächen.
 */
const G = 9.81, RHO_CP = 1.2 * 1005;

export const THERMAL_DEFAULTS = { none: 0.6, weak: 1.2, moderate: 2.0, strong: 3.0, onset: 1.0 };   // Obergrenzen der Klassen (m/s), Einsetzen ab w*
export const classOf = (w, th = THERMAL_DEFAULTS) => (w == null ? 'none' : w < th.none ? 'none' : w < th.weak ? 'weak' : w < th.moderate ? 'moderate' : w < th.strong ? 'strong' : 'severe');

/** Stundenwerte → Thermikwerte je Stunde. recs: [{ms, rad, pbl, temp, rh, w10, gust, cape, night}] */
export function thermalHours(recs, th = THERMAL_DEFAULTS) {
  return recs.map((r) => {
    const rad = Math.max(0, r.rad || 0);
    const f = r.rh != null && r.rh >= 85 ? 0.18 : r.rh != null && r.rh >= 70 ? 0.24 : 0.30;
    const H = f * rad;
    const Hk = H / RHO_CP;
    const zi = Math.max(50, r.pbl || 0);
    const T = (r.temp ?? 15) + 273.15;
    const wstar = r.night || rad < 20 ? 0 : Math.cbrt(G / T * Hk * zi);
    const gusty = r.gust != null && r.w10 != null ? Math.max(0, r.gust - r.w10) : null;   // m/s
    const climb = 0.7 * wstar;
    return { ms: r.ms, rad: Math.round(rad), pbl: r.pbl ?? null, H: Math.round(H), wstar: Math.round(wstar * 10) / 10, climb: Math.round(climb * 10) / 10, klass: classOf(wstar, th), gusty: gusty != null ? Math.round(gusty * 10) / 10 : null, cape: r.cape ?? null, night: !!r.night };
  });
}

/** Einsetzen, Maximum, Abschwächen innerhalb der übergebenen Stunden (ein Tag). */
export function thermalSummary(hours, th = THERMAL_DEFAULTS) {
  const active = hours.filter((x) => x.wstar >= (th.onset ?? 1.0));
  if (!active.length) return { onsetMs: null, endMs: null, peak: hours.reduce((a, x) => (x.wstar > (a?.wstar ?? -1) ? x : a), null), active: false };
  const peak = active.reduce((a, x) => (x.wstar > a.wstar ? x : a), active[0]);
  return { onsetMs: active[0].ms, endMs: active[active.length - 1].ms + 3600000, peak, active: true };
}
