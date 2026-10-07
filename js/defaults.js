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
        id: 'HB-QWP', name: 'HB-QWP', model: 'G 34/24', hex: '4B2C8B', volume: 3400,
        masses: { envelope: 139, burner: 26, basket: 68, equipment: 20 }, mtom: 950,
        personWeight: 80, envTempC: 100, envMaxC: null, usableFraction: 0.9, burnRate: 25,
        cylinders: [cyl('va70', 4)], rigMin: 45, maxPersons: 5,
      },
      {
        id: 'HB-QWZ', name: 'HB-QWZ', model: 'BB26E', hex: '4B2C95', volume: 2600,
        masses: { envelope: 103, burner: 14, basket: 49, equipment: 15 }, mtom: 730,
        personWeight: 85, envTempC: 110, envMaxC: null, usableFraction: 1.0, burnRate: 25,
        cylinders: [cyl('wo_s', 4)], rigMin: 45, maxPersons: 4,
      },
    ],
    envelopes: [
      { id: 'HB-QPJ', name: 'HB-QPJ', model: 'NL-STU/1000', hex: '4B2BCF', volume: 1050, mass: 116, gas: 'H2', purity: 0.995, fillFraction: 1.0, placeholder: false },
      { id: 'HB-QWV', name: 'HB-QWV', model: 'NL-STU/1000', hex: '4B2C91', volume: 1050, mass: 116, gas: 'H2', purity: 0.995, fillFraction: 1.0, placeholder: true },
    ],
    baskets: [
      { id: 'wettkampf', name: 'Wettkampfkorb', mass: 50, equipment: 45, instruments: 0, maxPersons: 2, ballastUnitKg: 15, reserveUnits: 3, placeholder: true },
      { id: 'pax', name: 'Pax-Korb', mass: 70, equipment: 45, instruments: 0, maxPersons: 4, ballastUnitKg: 15, reserveUnits: 3, placeholder: true },
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
    hab: { durationMin: 120, altMinFt: 500, altMaxFt: 5000, levels: ['SFC', '500 AGL', '1000 AGL', '3000', '5000', '8000'] },
    gas: { durationMin: 1440, altMinFt: 1000, altMaxFt: 10000, levels: ['SFC', '1000 AGL', '3000', '5000', '8000', 'FL100'] },
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
  flyLimits: { wind: [4, 6], gust: [6, 8], gustSpread: [4, 6], cape: [300, 800], precip: 0.1, visKm: 1.5, baseFt: 1000 },
  trajDefaults: { hab: 120, gas: 1440, stepMin: 10 },
  meteoDefaults: { topHpa: 500 },
  thermalLimits: { none: 0.6, weak: 1.2, moderate: 2.0, strong: 3.0, onset: 1.0 },
  docTypes: { balloon: ['Lufttüchtigkeitszeugnis (ARC)', 'Eintragungsschein', 'Lärmzeugnis', 'Versicherungsnachweis', 'Funkkonzession', 'Wägebericht'], person: ['Lizenz (BPL)', 'Medical', 'Funkzeugnis', 'Ausweis / Pass', 'Versicherung'] },
  webcamKm: 40, obsRadiusKm: 75, sondeKm: 250,
  airspaceCorridorKm: 5,
  airspaceTmaWarnFt: 900,
  pdiffWarn: { half: 3, neg: 4 },
  // 0.11.4: Aerostatik Gasballon (Grundlage für das Höhenprofil-Werkzeug 0.12): Überhitzung des Traggases gegenüber der Luft in K
  // (Emden Tab. 9 / «Gone with the Wind» Kap. 4) – Tag/Nacht bei klarem Himmel und bei bedecktem Himmel; Kühlverlust ≈ 0.4 % Auftrieb je K
  aero: { dtDayClear: 15, dtNightClear: -3, dtDayOvercast: 5, dtNightOvercast: -1, liftPctPerK: 0.4, fullLossPctPer80m: 1 },
  // 0.12: Grenzen für die Achtung-Zeichen im Höhenprofil (Wind in Fahrthöhe, Windsprung benachbarter Schichten, CAPE) und Mindestabstand über Grund
  profileLimits: { windKt: 30, shearKt: 20, cape: 500, minAgl: 300 },
  // 0.12: FIS-Kontakte je Land (AIP ENR 2.1 / GEN 3.3) für die Etappenübersicht – editierbar in Einstellungen → Experten;
  // nur gesicherte Werte vorbelegt, übrige Länder als Platzhalter mit AIP-Verweis
  fisContacts: [
    { cc: 'CH', name: 'Zürich Information (FIS)', freq: '124.700', phone: '' }, { cc: 'CH', name: 'Geneva Information (FIS)', freq: '126.350', phone: '' },
    { cc: 'AT', name: 'Wien Information (FIS)', freq: '124.400', phone: '' },
    { cc: 'DE', name: 'FIS Langen / München / Bremen – Frequenz je Sektor gemäss AIP Germany ENR 2.1', freq: '', phone: '' },
    { cc: 'FR', name: 'SIV (FIS) je Sektor gemäss AIP France ENR 2.1', freq: '', phone: '' },
    { cc: 'IT', name: 'FIS Milano / Padova / Roma gemäss AIP Italia ENR 2.1', freq: '', phone: '' },
  ],
  paxCardTitle: { de: 'Passagier Info-/Sicherheitskarte', en: 'Passenger info / safety card' },
  webcams: [{ id: 'uetliberg', name: 'Uetliberg (Roundshot)', lat: 47.3496, lon: 8.4913, url: 'https://uetliberg.roundshot.com/' }, { id: 'rigi', name: 'Rigi Kulm (Roundshot)', lat: 47.0569, lon: 8.4854, url: 'https://rigi.roundshot.com/' }],
  metarRadiusKm: 150, metarCount: 0, notamRadiusNm: 25, aiModel: 'claude-sonnet-5-5',
  synopticCharts: [
    { name: 'DWD Bodenanalyse Europa/Nordatlantik', url: 'https://www.dwd.de/DWD/wetter/wv_spez/hobbymet/wetterkarten/bwk_bodendruck_na_ana.png' },
    { name: 'DWD Bodenanalyse Westeuropa', url: 'https://www.dwd.de/DWD/wetter/wv_spez/hobbymet/wetterkarten/bwk_bodendruck_weu_ana.png' },
    { name: 'ECMWF Bodendruck + Wind 850 hPa zur Startzeit', url: 'https://charts.ecmwf.int/opencharts-api/v1/products/medium-mslp-wind850/?projection=opencharts_europe&valid_time={validTime}' },
    { name: 'ECMWF Bodendruck + Wind 850 hPa, Start +24 h', url: 'https://charts.ecmwf.int/opencharts-api/v1/products/medium-mslp-wind850/?projection=opencharts_europe&valid_time={validTime+24}' },
  ],
  // Grosswetteranalyse nationaler Wetterdienste (Text); Land = Startort (und Landeraum). DE geprüft (DWD Opendata);
  // CH/AT/IT: Seite + CSS-Selektor, bei Änderung der Website hier anpassen.
  wxTexts: [
    { cc: 'DE', name: 'DWD Synoptische Übersicht Kurzfrist', url: 'https://opendata.dwd.de/weather/text_forecasts/txt/SXDL31_DWAV_LATEST', sel: '' },
    { cc: 'DE', name: 'DWD Synoptische Übersicht Mittelfrist', url: 'https://opendata.dwd.de/weather/text_forecasts/txt/SXDL33_DWAV_LATEST', sel: '' },
    { cc: 'AT', name: 'ORF Wetter – Prognose Österreich (GeoSphere-Daten)', url: 'https://wetter.orf.at/oes/prognose', sel: 'main' },
    // CH und IT: die amtlichen Seiten sind JavaScript-Anwendungen ohne abrufbaren Text (Stand 10/2026) – Eintrag bleibt als Link, nicht abgerufen
    { cc: 'CH', name: 'MeteoSchweiz Wetterbericht (nur Link – Seite ohne abrufbaren Text)', url: 'https://www.meteoschweiz.admin.ch/', sel: 'main', disabled: true },
    { cc: 'IT', name: 'Aeronautica Militare – Previsioni testuali (nur Link – Seite ohne abrufbaren Text)', url: 'https://www.meteoam.it/it/previsioni-testuali', sel: 'main', disabled: true },
  ],
  pdiffPairs: [],
  airspaceTileUrl: '',
  paxCardItems: {
    de: ['Feste, geschlossene Schuhe (Wiese, Tau, Dreck)', 'Lange Hosen, Schichten – oben ist es nicht kälter, am Boden früh aber kühl', 'Mütze/Cap (Brennerhitze), Sonnenbrille', 'Handschuhe zum Mithelfen beim Aufrüsten', 'Kamera mit Schlaufe; Handy sicher verstaut', 'Keine Angst vor etwas Wartezeit: wir fahren nur bei passendem Wetter'],
    en: ['Sturdy closed shoes (meadow, dew, mud)', 'Long trousers, layers – not colder aloft, but chilly on the ground early', 'Cap (burner heat), sunglasses', 'Gloves for helping with rigging', 'Camera with lanyard; phone stowed safely', 'Be ready to wait a little: we only fly in suitable weather'],
  },
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
  // Flugplan (ICAO FPL): Standardwerte je Ballontyp, Vorlagen mit {picPhone} {satphone} {pic}
  fpl: {
    typeOfFlight: { commercial: 'N', private: 'G', training: 'G', exam: 'G' },
    equip10a: 'GY', equip10b: 'E', levelFromFt: 5000, satphone: '', colour: 'WHITE', picNameOrder: 'last-first',
    gas: { speed15: 'N0025', enduranceMin: 2880, equip10a: '', equip10b: '', typ18: 'GAS BALLOON' },
    hab: { speed15: 'N0015', equip10a: '', equip10b: '', typ18: 'HOT AIR BALLOON' },
    r19: { uhf: false, vhf: true, elba: false }, s19: { polar: false, desert: false, maritime: false, jungle: false },
    j19: { light: true, fluores: false, uhf: false, vhf: false }, d19: { number: '', capacity: '', cover: false, colour: '' },
    rmk18: 'CREW CONTACT {picPhone} AND {satphone}', n19: 'GSM PIC {picPhone} AND SATPHONE {satphone}',
    rmkTraining: 'TRG FLT', rmkExam: 'SKILL TEST',
  },
};

/** Schweizerisches Luftfahrzeugregister (BAZL, app02.bazl.admin.ch), Stand 05.10.2026 — wird in die Stammdaten übernommen. */
export const BAZL_REGISTER = {
  'HB-QWP': { manufacturer: 'Theo Schroeder Fire Balloons GmbH', model: 'G 34/24', type: 'hab', hex: '4B2C8B', serial: '1699', year: 2017, mtom: 950, mopsc: 4, tcds: 'EASA.BA.016', registered: '2017-04-11', arcUntil: '2027-01-12' },
  'HB-QWZ': { manufacturer: 'Balóny Kubíček spol. s r.o.', model: 'BB26E', type: 'hab', hex: '4B2C95', serial: '1630', year: 2019, mtom: 730, mopsc: 2, tcds: 'EASA.BA.003', registered: '2019-12-23', arcUntil: '2027-01-12' },
  'HB-QPJ': { manufacturer: 'Ballonbau Wörner GmbH', model: 'NL-STU/1000', type: 'gas', hex: '4B2BCF', serial: '1097', year: 2011, mtom: 1160, mopsc: 6, tcds: 'EASA.BA.009', registered: '2012-02-27', arcUntil: '2027-03-30' },
  'HB-QWV': { manufacturer: 'Ballonbau Wörner GmbH', model: 'NL-STU/1000', type: 'gas', hex: '4B2C91', serial: '1117', year: 2023, mtom: 1160, mopsc: 2, tcds: 'EASA.BA.009', registered: '2023-06-26', arcUntil: '2027-07-01' },
};
/** Registerdaten in einen Ballon/eine Hülle übernehmen: Hexcode, Muster (falls Platzhalter/alt), Register-Block, ARC-Dokument. */
export function applyRegister(x) {
  const r = BAZL_REGISTER[x?.id]; if (!r) return x;
  if (!x.hex || !/^[0-9A-F]{6}$/i.test(x.hex)) x.hex = r.hex;
  if (!x.model || /^Heissluft|^BB34Z$|^NL\/STU-1000$/.test(x.model)) x.model = r.model;
  x.register = { ...r };
  x.docs = Array.isArray(x.docs) ? x.docs : [];
  const arc = x.docs.find((d) => /ARC|Lufttüchtigkeit/i.test(d.type || '') || /ARC/i.test(d.name || ''));
  if (arc) { if (!arc.validTo) arc.validTo = r.arcUntil; } else x.docs.push({ type: 'Lufttüchtigkeitszeugnis (ARC)', name: '', validTo: r.arcUntil, url: '' });
  return x;
}

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
      type: 'gas', envelopeId: env.id, basketId: bas.id, reg: env.reg || env.id, ownerId: env.ownerId || bas.ownerId || null,
      label: `${env.reg || env.id}${env.model ? ' · ' + env.model : ''}${env.hex ? ` (${env.hex})` : ''} × ${bas.name}`, hex: env.hex || '', docs: env.docs || [], volume: env.volume, gas: env.gas, purity: env.purity, fillFraction: env.fillFraction, wz: env.wz ?? null,
      masses: { envelope: env.mass, basket: bas.mass, equipment: bas.equipment, instruments: bas.instruments },
      personWeight: b.gasDefaults.personWeight, maxPersons: bas.maxPersons,
      ballastUnitKg: bas.ballastUnitKg, reserveUnits: bas.reserveUnits,
      rigMin: b.gasDefaults.rigMin, fillMin: b.gasDefaults.fillMin,
      trackers: env.trackers || [], colour: env.colour || '', image: env.image || '',
    };
  }
  const h = b.hab.find((x) => x.id === sel.id) || b.hab[0];
  if (!h) return null;
  return { type: 'hab', ownerId: null, ...JSON.parse(JSON.stringify(h)), id: h.id, reg: h.reg || h.id, label: `${h.reg || h.id}${h.model ? ' · ' + h.model : ''}${h.hex ? ` (${h.hex})` : ''}` };
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
  const out = merge(base, saved);
  // 0.6: alte Standardwerte (120 km / 4 Plätze) auf neue Standards heben (150 km / alle im Umkreis)
  if (out.metarRadiusKm === 120 && out.metarCount === 4) { out.metarRadiusKm = 150; out.metarCount = 0; }
  // 0.7.1: ungeprüfte Textquellen (geosphere Wetterübersicht, meteoam Situazione, MeteoSchweiz-Seite) → geprüfte Standardliste
  if ((out.wxTexts || []).some((x) => /geosphere\.at\/de\/wetter\/wetteruebersicht|meteoam\.it\/it\/situazione|wetterbericht\.html/.test(x.url || ''))) out.wxTexts = JSON.parse(JSON.stringify(DEFAULT_SETTINGS.wxTexts));
  // 0.10.2: Standardradien Beobachtungen 50 → 75 km, Sonden 150 → 250 km (nur wenn noch die alten Standards gespeichert sind)
  if (out.obsRadiusKm === 50) out.obsRadiusKm = 75;
  if (out.sondeKm === 150) out.sondeKm = 250;
  // 0.7: Beispielballone «Heissluft NNNN m³» → Muster + Transponder-Hexcode; 0.11.0: BAZL-Registerdaten (Hex 24-bit, Muster, ARC)
  for (const x of out.balloons?.hab || []) {
    if (x.hex == null) x.hex = '';
    if (x.id === 'HB-QWZ' && x.hex.toLowerCase() === '4c4b4') x.hex = '';   // alter, unvollständiger Wert
    if (x.id === 'HB-QWP' && x.mtom === 883) x.mtom = 950;   // 0.11.1: MTOM nach BAZL-Register
    applyRegister(x);
  }
  for (const x of out.balloons?.envelopes || []) applyRegister(x);
  return out;
}
