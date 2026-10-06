/* Fahrtbriefing — Beispielfahrt für das Höhenprofil-Werkzeug («Beispiel»-Knopf, 0.12.1).
 *
 * Synthetische, in sich stimmige Daten (wie die Konzeptskizze): 180 km, Start 16:00 LT, Abendübergang,
 * Relief mit See, Decken, Inversion und Isothermie, Lufträume mit HX, Achtung-Zeichen aller Arten.
 * Dient zum Üben und trägt die nummerierten Erklärungen (Callouts); Änderungen werden nicht gespeichert.
 */
import { fromLocal, isoDate } from '../calc/time.js';
import { destination } from '../calc/geo.js';
import { fitPoints } from '../calc/profile.js';

/** Beispiel-Briefing und -Profil aus dem echten Briefing ableiten (Ort/Zone/Ballon bleiben, Daten synthetisch). */
export function sampleOf(b) {
  const tz = b.site?.tz || 'Europe/Zurich', lat0 = b.site?.lat ?? 47.32, lon0 = b.site?.lon ?? 8.37, elev = 450;
  const day = isoDate(tz, Date.now());
  const startMs = fromLocal(tz, day, '16:00');
  const KM = 180;
  const relief = [[0, 450], [10, 480], [20, 520], [35, 600], [50, 700], [60, 900], [70, 1200], [80, 1500], [90, 1750], [100, 1900], [108, 1700], [115, 1400], [125, 1100], [135, 900], [145, 600], [155, 450], [158, 420], [164, 420], [168, 320], [180, 280]];
  const reliefAt = (k) => { for (let i = 1; i < relief.length; i++) if (k <= relief[i][0]) { const [k0, h0] = relief[i - 1], [k1, h1] = relief[i]; return h0 + (h1 - h0) * (k - k0) / (k1 - k0); } return relief[relief.length - 1][1]; };
  const points = fitPoints([[0, 450], [2, 1300], [40, 1300], [42, 1600], [75, 1600], [80, 2300], [125, 2300], [128, 1900], [150, 1900], [156, 900], [176, 900], [180, 280]].map(([km, alt]) => ({ km, alt })), KM);
  const altAt = (k) => { const p = points; if (k <= p[0].km) return p[0].alt; for (let i = 1; i < p.length; i++) if (k <= p[i].km) { const a = p[i - 1], c = p[i]; return a.alt + (c.alt - a.alt) * (k - a.km) / (c.km - a.km); } return p[p.length - 1].alt; };
  // Bahn: Wind 5 + 4.5·h/1000 km/h, Richtung dreht langsam nach Osten
  const track = []; let ms = startMs, lat = lat0, lon = lon0;
  for (let k = 0; k <= KM; k++) {
    const alt = Math.round(altAt(k)), v = 5 + 4.5 * alt / 1000;
    track.push({ ms: Math.round(ms), km: k, lat: +lat.toFixed(4), lon: +lon.toFixed(4), alt, spdKt: Math.round(v / 1.852), dir: Math.round(240 + k * 0.2) });
    const brg = 60 + k * 0.2, d = destination(lat, lon, brg, 1); lat = d.lat; lon = d.lon; ms += 3600000 / v;
  }
  const endMs = track[KM].ms;
  const msAt = (k) => track[Math.max(0, Math.min(KM, Math.round(k)))].ms;
  const kmAt = (t) => { for (let k = 1; k <= KM; k++) if (track[k].ms >= t) return k - 1 + (t - track[k - 1].ms) / (track[k].ms - track[k - 1].ms); return KM; };
  const nextDay = isoDate(tz, startMs + 86400000);
  const sun = [['ss', day, '18:40'], ['ecet', day, '19:15'], ['bcmt', nextDay, '06:50'], ['sr', nextDay, '07:25']].map(([kind, d, t]) => { const m = fromLocal(tz, d, t); return { kind, ms: m, km: Math.round(kmAt(m) * 10) / 10 }; }).filter((e) => e.ms >= startMs && e.ms <= endMs);
  // Stundenprofile: Decken, Inversion/Isothermie, Nullgradgrenze, Wind
  const hours = [];
  for (let t = Math.ceil(startMs / 3600000) * 3600000; t <= endMs; t += 3600000) {
    const km = kmAt(t), alt = Math.round(altAt(km)), ground = Math.round(reliefAt(km));
    const clouds = [];
    if (km < 60) clouds.push({ lo: 800, hi: 1200, label: 'St' });
    if (km >= 60 && km < 125) clouds.push({ lo: 3000, hi: 3800, label: 'Ac/As' });
    if (km >= 150) clouds.push({ lo: 280, hi: 650, label: 'Nebel/St' });
    const inv = [];
    if (km < 80) inv.push({ lo: 1650, hi: 1850, kind: 'inv' });
    if (km >= 100 && km < 140) inv.push({ lo: 2200, hi: 2500, kind: 'iso' });
    hours.push({ ms: t, km: Math.round(km * 10) / 10, lat: track[Math.round(km)].lat, lon: track[Math.round(km)].lon, alt, ground, clouds, inv, fzl: Math.round(2750 - km * 1.7), windKt: Math.round(8 + alt / 100), shearKt: km > 110 && km < 125 ? 22 : 8, tempAtAlt: 10 - alt / 160, rhAtAlt: 60, cape: km > 40 && km < 50 ? 600 : 50, fogRisk: km > 150 ? 3 : 0, precip: km > 24 && km < 32 ? 0.8 : 0, cloud: km < 60 ? 70 : km < 125 ? 60 : 30, temp2m: 12, dew2m: 9 });
  }
  const hz = (type, km, alt, lbl, txt) => ({ type, km, kmEnd: km, alt, ms: msAt(km), msEnd: msAt(km), lbl, txt });
  const hazards = [hz('rain', 28, 2150, 'Niederschlag', '0.8 mm/h, 19–21 LT'), hz('cb', 45, 3600, 'CB-Neigung', 'CAPE 600 J/kg ab 15 LT'), hz('ice', 108, 2750, 'Vereisung', 'T < 0 °C, RH > 90 % in Wolken'), hz('shear', 118, 3300, 'Scherung', 'Windsprung 22 kt 2500–3500 m'), hz('wind', 152, 3800, 'Wind 35 kt', 'Wind 35 kt in 4000 m'), hz('fog', 168, 650, 'Nebel', 'BR/FG 06–09 LT')];
  const airspaces = [
    { name: 'TMA Zürich 2', typeKey: 'TMA', cls: 'C', country: 'CH', status: 'cross', km0: 6, km1: 46, lo: 1370, hi: 5950, lowerTxt: '4500 ft', upperTxt: 'FL195', tmp: '', freqs: [] },
    { name: 'CTR Emmen', typeKey: 'CTR', cls: 'D', country: 'CH', status: 'cross', km0: 52, km1: 66, lo: 0, hi: 1370, lowerTxt: 'GND', upperTxt: '4500 ft', tmp: 'HX · Mo–Fr 07:30–17:00 LT', freqs: [] },
    { name: 'TMA Alpnach', typeKey: 'TMA', cls: 'D', country: 'CH', status: 'cross', km0: 92, km1: 136, lo: 2130, hi: 3960, lowerTxt: '7000 ft', upperTxt: 'FL130', tmp: 'HX', freqs: [] },
    { name: 'LS-R 4 Pilatus', typeKey: 'R', cls: 'SUA', country: 'CH', status: 'near', km0: 112, km1: 124, lo: 2000, hi: 4500, lowerTxt: '6500 ft', upperTxt: 'FL150', tmp: 'O/R', freqs: [] },
  ];
  const stages = [{ id: 'x1', km: 0, name: 'Start' }, { id: 'x2', km: 30, name: 'Enroute · Mittelland' }, { id: 'x3', km: 75, name: 'Voralpen' }, { id: 'x4', km: 140, name: 'Landung' }];
  const p = {
    points, stages, layers: { wx: true, as: true }, base: 'neutral', model: '', sample: true,
    data: {
      stand: Date.now(), model: '', modelName: 'Beispiel', modelHours: 384, source: 'synthetisch', fetched: Date.now(), totalKm: KM, ok: true, cut: false, yMaxHint: 4500, startMs, endMs, plannedEndMs: endMs, durationMin: Math.round((endMs - startMs) / 60000), tz,
      track: { points: track }, waypoints: [], relief: relief.map(([km, m]) => ({ km, m })), water: [{ km0: 158, km1: 164, m: 420 }], hours, sun, airspaces, firs: [{ name: 'Switzerland FIR', country: 'CH', fromKm: 0, toKm: KM }], hazards, errors: [],
    },
  };
  const sb = { ...b, profile: p, time: { ...(b.time || {}), startMs, base: b.time?.base || 'LT' }, site: { ...(b.site || {}), lat: lat0, lon: lon0, elev, tz }, intent: { ...(b.intent || {}), durationMin: p.data.durationMin } };
  // Erklärungen: Nummer, Position (km/alt oder Achse) und Textschlüssel
  const callouts = [
    { n: 1, axis: 'km', key: 'pf_ex1' }, { n: 2, km: 113, alt: 1550, key: 'pf_ex2' }, { n: 3, km: 90, alt: 3900, key: 'pf_ex3' }, { n: 4, km: 100, alt: 150, key: 'pf_ex4' },
    { n: 5, km: 60, alt: 2600, key: 'pf_ex5' }, { n: 6, km: 162, alt: 4350, key: 'pf_ex6' }, { n: 7, key: 'pf_ex7' }, { n: 8, km: 26, alt: 4100, key: 'pf_ex8' }, { n: 9, key: 'pf_ex9' },
  ];
  return { b: sb, p, callouts };
}
