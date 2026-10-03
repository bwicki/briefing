/* Fahrtbriefing — Standard-Einstellungen und Stammdaten.
 * Startwerte aus den Excel-Vorlagen und dem Konzept v0.4; alles in den
 * Einstellungen änderbar. Platzhalter sind als solche markiert.
 */
import { CYLINDER_CATALOG } from './calc/aero.js';

const cyl = (id, count) => ({ ...CYLINDER_CATALOG.find((c) => c.id === id), count });

export const DEFAULT_SETTINGS = {
  schema: 1,
  lang: 'de',
  theme: 'light',
  timeBase: 'LT',
  ownerName: 'B. Wicki',
  expert: false,
  operators: [
    { id: 'wicki-aero', name: 'Wicki Aero GmbH', default: true },
    { id: 'bwi', name: 'Balthasar Wicki (privat)' },
  ],
  balloons: {
    defaultType: 'hab',
    defaultHab: 'HB-QWZ',
    defaultEnvelope: 'HB-QWV',
    defaultBasket: 'wettkampf',
    hab: [
      {
        id: 'HB-QWP', name: 'HB-QWP', model: 'Heissluft 3400 m³', volume: 3400,
        masses: { envelope: 139, burner: 26, basket: 68, equipment: 20 }, mtom: 883,
        personWeight: 80, envTempC: 100, envMaxC: null, usableFraction: 0.9, burnRate: 25,
        cylinders: [cyl('va70', 4)], rigMin: 45, maxPersons: 5,
      },
      {
        id: 'HB-QWZ', name: 'HB-QWZ', model: 'Heissluft 2600 m³', volume: 2600,
        masses: { envelope: 103, burner: 14, basket: 49, equipment: 15 }, mtom: 730,
        personWeight: 85, envTempC: 110, envMaxC: null, usableFraction: 1.0, burnRate: 25,
        cylinders: [cyl('wo_s', 4)], rigMin: 45, maxPersons: 4,
      },
    ],
    envelopes: [
      { id: 'HB-QPJ', name: 'HB-QPJ', model: 'NL/STU-1000', volume: 1050, mass: 116, gas: 'H2', purity: 0.995, fillFraction: 1.0, placeholder: false },
      { id: 'HB-QWV', name: 'HB-QWV', model: 'NL/STU-1000', volume: 1050, mass: 116, gas: 'H2', purity: 0.995, fillFraction: 1.0, placeholder: true },
    ],
    baskets: [
      { id: 'wettkampf', name: 'Wettkampfkorb', mass: 50, equipment: 40, instruments: 0, maxPersons: 2, ballastUnitKg: 15, reserveUnits: 3, placeholder: true },
      { id: 'pax', name: 'Pax-Korb', mass: 70, equipment: 40, instruments: 0, maxPersons: 4, ballastUnitKg: 15, reserveUnits: 3, placeholder: true },
    ],
    gasDefaults: { personWeight: 85, rigMin: 30, fillMin: 150 },
  },
  persons: [
    { id: 'bwicki', name: 'Balthasar Wicki', roles: ['pic', 'crew'], phone: '', email: '', weight: null },
    { id: 'mbaumann', name: 'Martin Baumann', roles: ['retrieve', 'crew'], phone: '', email: '', weight: null },
  ],
  sites: [
    { id: 'oberlunkhofen', name: 'Oberlunkhofen AG', lat: 47.3167, lon: 8.3917, elev: 461, country: 'CH', tz: 'Europe/Zurich', notes: '', meetingId: 'katzenrueti', favorite: true },
    { id: 'gladbeck', name: 'Gladbeck (DE)', lat: 51.5713, lon: 6.9827, elev: 42, country: 'DE', tz: 'Europe/Berlin', notes: '', meetingId: '', favorite: true },
  ],
  meetings: [
    { id: 'katzenrueti', name: 'Katzenrüti (P+R)', address: 'Katzenrütistrasse 308, 8153 Rümlang', lat: 47.4474, lon: 8.5215, mapsUrl: 'https://goo.gl/maps/JfTdKeyJVWB4KfRW9', default: true },
  ],
  intentDefaults: {
    hab: { durationMin: 120, altMinFt: 500, altMaxFt: 5000, levels: ['SFC', '500 AGL', '1000', '2000', '3000', '5000'] },
    gas: { durationMin: 1440, altMinFt: 1000, altMaxFt: 10000, levels: ['SFC', '1000', '2000', '3000', '5000', '8000', '10000'] },
  },
  scheduleDefaults: { trailerFactor: 1.15, surchargeMin: 5, bufferMin: 0, recoveryMin: 60 },
  reserve: { pct: 25, capMin: 30, minMin: 0 },
  rac: { custom: null },
  transitionAltitudes: [
    { id: 'zh', label: '7000 ft AMSL (ZH)', countries: ['CH'] },
    { id: 'ch', label: '900 ft AGL (CH)', countries: ['CH'] },
    { id: 'be', label: '6000 ft AMSL (BE)', countries: ['CH'] },
    { id: 'sg', label: '5000 ft AMSL (SG)', countries: ['CH'] },
    { id: 'fr', label: '3000 ft AGL (FRANCE)', countries: ['FR'] },
    { id: 'de', label: '5000 ft AMSL (GERMANY)', countries: ['DE'] },
  ],
  transitionDefaults: { CH: ['zh', 'ch'], DE: ['de'], FR: ['fr'] },
  goNoGo: { dryWindowH: 10, noTsH: 15, meanWindKt: 10, gustKt: 12 },
  panels: { hidden: [], mandatory: ['A.sun', 'A.massperf', 'B.fwp', 'C.dabs', 'C.notam'] },
  links: { defaultExpiryDays: 7 },
  sources: {
    skybriefing: 'https://www.skybriefing.com/',
    skybriefingDabs: 'https://www.skybriefing.com/de/dabs',
    meteoswiss: 'https://www.meteoschweiz.admin.ch/wetter/wetter-und-klima-von-a-bis-z/wetterbericht.html',
    pcmet: 'https://www.flugwetter.de/',
    meteoblue: 'https://www.meteoblue.com/',
    dwdBallon: 'https://www.dwd.de/DE/fachnutzer/luftfahrt/teaser/gebietsvorhersagen_ballonsport/gebietsvorhersagen_ballonsport_node.html',
    dwdLuftsport: 'https://www.dwd.de/DE/fachnutzer/luftfahrt/teaser/luftsportberichte/luftsportberichte_node.html',
    windy: 'https://www.windy.com/',
    rainviewer: 'https://www.rainviewer.com/',
  },
  equipmentItems: ['none', 'pressurisation', 'o2', 'nvr', 'alpine', 'heli'],
  paxBriefingItems: ['health', 'ticket', 'gloves'],
};

/** Standardballon-Kombination für ein neues Briefing. */
export function defaultBalloon(settings) {
  const b = settings.balloons;
  if (b.defaultType === 'gas') return { type: 'gas', envelopeId: b.defaultEnvelope, basketId: b.defaultBasket };
  return { type: 'hab', id: b.defaultHab };
}

/** Komponenten zu einer Kombination auflösen (Profil-Schnappschuss fürs Briefing). */
export function resolveBalloon(settings, sel) {
  const b = settings.balloons;
  if (sel.type === 'gas') {
    const env = b.envelopes.find((e) => e.id === sel.envelopeId) || b.envelopes[0];
    const bas = b.baskets.find((k) => k.id === sel.basketId) || b.baskets[0];
    if (!env || !bas) return null;
    return {
      type: 'gas', envelopeId: env.id, basketId: bas.id, reg: env.id,
      label: `${env.id} × ${bas.name}`, volume: env.volume, gas: env.gas, purity: env.purity, fillFraction: env.fillFraction,
      masses: { envelope: env.mass, basket: bas.mass, equipment: bas.equipment, instruments: bas.instruments },
      personWeight: b.gasDefaults.personWeight, maxPersons: bas.maxPersons,
      ballastUnitKg: bas.ballastUnitKg, reserveUnits: bas.reserveUnits,
      rigMin: b.gasDefaults.rigMin, fillMin: b.gasDefaults.fillMin,
    };
  }
  const h = b.hab.find((x) => x.id === sel.id) || b.hab[0];
  if (!h) return null;
  return { type: 'hab', id: h.id, reg: h.id, label: `${h.id} · ${h.model}`, ...JSON.parse(JSON.stringify(h)) };
}

/** Tiefes Zusammenführen gespeicherter Einstellungen mit den Standards (neue Felder ergänzen). */
export function mergeSettings(saved) {
  const base = JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
  if (!saved || typeof saved !== 'object') return base;
  const merge = (a, b) => {
    for (const k of Object.keys(b)) {
      if (b[k] && typeof b[k] === 'object' && !Array.isArray(b[k]) && a[k] && typeof a[k] === 'object' && !Array.isArray(a[k])) merge(a[k], b[k]);
      else a[k] = b[k];
    }
    return a;
  };
  return merge(base, saved);
}
