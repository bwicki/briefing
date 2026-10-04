/* Fahrtbriefing — Luftraumanalyse entlang des Fahrtwegs (openAIP-Daten).
 *
 * Eingabe: Trajektorien (Punkte je Niveau), Lufträume im Kartenausschnitt (openAIP Core API,
 * über den Worker), geplantes Höhenband. Ausgabe je Luftraum: durchfahren (Bahn innerhalb und
 * Untergrenze unter der geplanten Maximalhöhe), nahe (Korridor), darüber (Untergrenze über
 * der Maximalhöhe – nur beim Steigen relevant) sowie die FIR-Folge je Bahn.
 * Reine Funktionen, ohne DOM – testbar in test/calc.test.mjs.
 */
const M_TO_FT = 3.28084;

/** openAIP-Typen (Schema Core API) → Kurzbezeichnung. */
export const AS_TYPES = { 0: 'OTHER', 1: 'R', 2: 'D', 3: 'P', 4: 'CTR', 5: 'TMZ', 6: 'RMZ', 7: 'TMA', 8: 'TRA', 9: 'TSA', 10: 'FIR', 11: 'UIR', 12: 'ADIZ', 13: 'ATZ', 14: 'MATZ', 15: 'AWY', 16: 'MTR', 17: 'ALERT', 18: 'WARN', 19: 'PROT', 20: 'HTZ', 21: 'GLD', 22: 'TRP', 23: 'TIZ', 24: 'TIA', 25: 'MTA', 26: 'CTA', 27: 'ACC', 28: 'SPORT', 29: 'LOWFLY', 30: 'MRT', 31: 'TFR', 32: 'VFR', 33: 'FIS', 34: 'LTA', 35: 'UTA' };
export const AS_CLASS = { 0: 'A', 1: 'B', 2: 'C', 3: 'D', 4: 'E', 5: 'F', 6: 'G', 8: 'SUA' };
/** Typen, die als Information gelten (FIR-Folge) oder für die Ballonfahrt nicht zählen. */
const FIR_TYPES = new Set([10]);
const SKIP_TYPES = new Set([11, 27, 35]);   // UIR, ACC-Sektor, UTA: oberer Luftraum, nie relevant

/** Höhenangabe → ft AMSL (GND-Bezug näherungsweise mit Geländehöhe elevM). */
export function limitFt(l, elevM = 0) {
  if (!l || l.value == null) return null;
  const v = +l.value;
  const ft = l.unit === 6 ? v * 100 : l.unit === 0 ? v * M_TO_FT : v;
  return Math.round(l.referenceDatum === 0 ? ft + elevM * M_TO_FT : ft);
}
export function limitText(l) {
  if (!l || l.value == null) return '–';
  const v = +l.value;
  if (l.unit === 6) return `FL ${String(Math.round(v)).padStart(3, '0')}`;
  if (l.referenceDatum === 0) return v === 0 ? 'GND' : `${Math.round(l.unit === 0 ? v * M_TO_FT : v)} ft AGL`;
  return `${Math.round(l.unit === 0 ? v * M_TO_FT : v)} ft`;
}

/** openAIP-Objekt → schlankes Luftraum-Objekt (Ringe als [lat, lon]). */
export function normalizeAirspace(it, elevM = 0) {
  const polys = [];
  const g = it.geometry || {};
  const toRing = (r) => r.map(([lon, lat]) => [lat, lon]);
  if (g.type === 'Polygon') polys.push((g.coordinates || []).map(toRing));
  else if (g.type === 'MultiPolygon') for (const p of g.coordinates || []) polys.push(p.map(toRing));
  const typeKey = AS_TYPES[it.type] || 'OTHER';
  return {
    id: it._id || it.id || it.name, name: it.name || '', type: it.type ?? 0, typeKey, cls: AS_CLASS[it.icaoClass] || '', country: it.country || '',
    lowerFt: limitFt(it.lowerLimit, elevM), upperFt: limitFt(it.upperLimit, elevM), lowerTxt: limitText(it.lowerLimit), upperTxt: limitText(it.upperLimit),
    lowerAgl: it.lowerLimit?.referenceDatum === 0 && +it.lowerLimit.value > 0,
    flags: { onDemand: !!it.onDemand, onRequest: !!it.onRequest, byNotam: !!it.byNotam, specialAgreement: !!it.specialAgreement },
    activity: it.activity ?? null, hours: it.hoursOfOperation || null, transponder: it.transponderCode || null,
    freqs: (it.frequencies || []).map((f) => ({ value: f.value, name: f.name || '' })).filter((f) => f.value),
    polys,
  };
}

/** Punkt in Ring ([lat, lon]) – Strahlmethode. */
export function inRing(lat, lon, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [yi, xi] = ring[i], [yj, xj] = ring[j];
    if (((yi > lat) !== (yj > lat)) && (lon < (xj - xi) * (lat - yi) / ((yj - yi) || 1e-12) + xi)) inside = !inside;
  }
  return inside;
}
/** Punkt in Polygon (Aussenring, Löcher) bzw. in einem der Polygone. */
export function inAirspace(lat, lon, as) {
  for (const p of as.polys) {
    if (!p.length || !inRing(lat, lon, p[0])) continue;
    if (p.slice(1).some((hole) => inRing(lat, lon, hole))) continue;
    return true;
  }
  return false;
}
/** Kürzeste Distanz Punkt → Aussenring (km), 0 innerhalb; lokale Plattkarte. */
export function distToAirspaceKm(lat, lon, as) {
  if (inAirspace(lat, lon, as)) return 0;
  const kx = 111.2 * Math.cos(lat * Math.PI / 180), ky = 111.2;
  let best = Infinity;
  for (const p of as.polys) {
    const ring = p[0] || [];
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const ax = (ring[j][1] - lon) * kx, ay = (ring[j][0] - lat) * ky, bx = (ring[i][1] - lon) * kx, by = (ring[i][0] - lat) * ky;
      const dx = bx - ax, dy = by - ay; const len2 = dx * dx + dy * dy;
      const u = len2 ? Math.max(0, Math.min(1, -(ax * dx + ay * dy) / len2)) : 0;
      const px = ax + u * dx, py = ay + u * dy;
      best = Math.min(best, Math.hypot(px, py));
    }
  }
  return best;
}
const bboxOf = (as) => { let s = 90, n = -90, w = 180, e = -180; for (const p of as.polys) for (const [la, lo] of p[0] || []) { if (la < s) s = la; if (la > n) n = la; if (lo < w) w = lo; if (lo > e) e = lo; } return { s, n, w, e }; };

const R = 6371.0088, rad = (d) => d * Math.PI / 180;
const distKm = (a, b, c, d) => 2 * R * Math.asin(Math.min(1, Math.sqrt(Math.sin(rad(c - a) / 2) ** 2 + Math.cos(rad(a)) * Math.cos(rad(c)) * Math.sin(rad(d - b) / 2) ** 2)));

/** Hinweis-Schlüssel (i18n as_req_*) je Luftraum. */
export function requirementKey(as) {
  switch (as.typeKey) {
    case 'CTR': return 'ctr';
    case 'TMA': case 'CTA': case 'AWY': case 'LTA': case 'TIA': case 'OTHER': return as.cls && 'ABCD'.includes(as.cls) ? 'clearance' : as.cls === 'E' ? 'classE' : as.cls === 'F' || as.cls === 'G' ? 'uncontrolled' : 'check';
    case 'P': return 'prohibited';
    case 'R': return 'restricted';
    case 'D': return 'danger';
    case 'TMZ': case 'TRP': return 'tmz';
    case 'RMZ': case 'TIZ': return 'rmz';
    case 'TRA': case 'TSA': case 'MTA': case 'MTR': case 'MRT': case 'TFR': return 'activation';
    case 'ATZ': case 'MATZ': case 'HTZ': return 'atz';
    case 'GLD': case 'SPORT': return 'sport';
    case 'PROT': case 'LOWFLY': return 'protected';
    case 'ADIZ': return 'adiz';
    case 'ALERT': case 'WARN': return 'caution';
    case 'FIS': case 'VFR': return 'info';
    default: return 'check';
  }
}

/**
 * Analyse. tracks: [{label, altFt, points:[{ms,lat,lon}]}], items: normalisierte Lufträume.
 * o: { altMinFt, altMaxFt, corridorKm, siteElevFt }.
 * Rückgabe: { crossed, near, above, firs:[{label, seq:[{name, fromKm, fromMs}]}], all }
 */
export function analyzeAirspaces(tracks, items, o = {}) {
  const corridor = o.corridorKm ?? 5;
  const altMax = o.altMaxFt ?? 6000, altMin = Math.min(o.altMinFt ?? 0, altMax);
  const out = [];
  const firs = [];
  const trs = tracks.map((tr) => {
    let km = 0; const pts = tr.points.map((p, i, a) => { if (i) km += distKm(a[i - 1].lat, a[i - 1].lon, p.lat, p.lon); return { ...p, km: Math.round(km * 10) / 10 }; });
    return { label: tr.label, altFt: tr.altFt, pts, bb: pts.reduce((b, p) => ({ s: Math.min(b.s, p.lat), n: Math.max(b.n, p.lat), w: Math.min(b.w, p.lon), e: Math.max(b.e, p.lon) }), { s: 90, n: -90, w: 180, e: -180 }) };
  });
  const margin = corridor / 111.2 * 1.6;
  for (const as of items) {
    if (SKIP_TYPES.has(as.type) || !as.polys.length) continue;
    const bb = bboxOf(as);
    const hits = [];
    let minDist = Infinity;
    for (const tr of trs) {
      if (bb.n < tr.bb.s - margin || bb.s > tr.bb.n + margin || bb.e < tr.bb.w - margin || bb.w > tr.bb.e + margin) continue;
      let entry = null, exit = null;
      for (const p of tr.pts) {
        if (inAirspace(p.lat, p.lon, as)) { if (!entry) entry = p; exit = p; }
      }
      if (entry) { hits.push({ label: tr.label, altFt: tr.altFt, entryKm: entry.km, exitKm: exit.km, entryMs: entry.ms, exitMs: exit.ms }); minDist = 0; continue; }
      if (FIR_TYPES.has(as.type)) continue;
      // Korridor: Punkte im Abstand prüfen (jeder dritte Punkt reicht bei 10-min-Schritten)
      for (let i = 0; i < tr.pts.length; i += 2) { const d = distToAirspaceKm(tr.pts[i].lat, tr.pts[i].lon, as); if (d < minDist) minDist = d; if (d === 0) break; }
    }
    if (FIR_TYPES.has(as.type)) {
      for (const hh of hits) { let f = firs.find((x) => x.label === hh.label); if (!f) { f = { label: hh.label, seq: [] }; firs.push(f); } f.seq.push({ name: as.name, country: as.country, fromKm: hh.entryKm, fromMs: hh.entryMs, toKm: hh.exitKm }); }
      continue;
    }
    if (!hits.length && minDist > corridor) continue;
    const vertical = as.lowerFt == null || as.lowerFt <= altMax;   // Untergrenze unter geplanter Maximalhöhe → betroffen
    const status = !vertical ? 'above' : hits.length ? 'cross' : 'near';
    out.push({ as, status, hits, minDistKm: Math.round(minDist * 10) / 10, firstKm: hits.length ? Math.min(...hits.map((x) => x.entryKm)) : null, firstMs: hits.length ? Math.min(...hits.map((x) => x.entryMs)) : null, req: requirementKey(as) });
  }
  for (const f of firs) f.seq.sort((a, b) => a.fromKm - b.fromKm);
  const order = (a, b) => (a.firstKm ?? 1e9) - (b.firstKm ?? 1e9) || a.minDistKm - b.minDistKm || (a.as.lowerFt ?? 0) - (b.as.lowerFt ?? 0);
  const crossed = out.filter((x) => x.status === 'cross').sort(order);
  const near = out.filter((x) => x.status === 'near').sort(order);
  const above = out.filter((x) => x.status === 'above').sort(order);
  return { crossed, near, above, firs, altMin, altMax, corridorKm: corridor };
}

/** Ring auf höchstens n Punkte ausdünnen (für die Ablage im Briefing). */
export function thinRing(ring, n = 120) {
  if (ring.length <= n) return ring;
  const step = ring.length / n; const out = [];
  for (let i = 0; i < ring.length; i += step) out.push(ring[Math.floor(i)]);
  if (out[out.length - 1] !== ring[ring.length - 1]) out.push(ring[ring.length - 1]);
  return out;
}
