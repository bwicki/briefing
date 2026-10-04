/* Fahrtbriefing — Panel-Register.
 *
 * Die Reihenfolge entspricht dem gedruckten Muster «Briefing 2026». Jedes
 * Panel hat eine Art (kind), die bestimmt, wie Erarbeitungs- und Briefingsicht
 * es darstellen, und einen Grad (auto/calc/paste/text), der in Phase 2 für die
 * automatischen Abrufe gebraucht wird. In Phase 1 sind alle Meteo-/Nav-Panels
 * «paste» (Einfüge-Assistent) oder «text»; der Deep-Link (`link`) verweist auf
 * die Quelle in den Einstellungen (sources).
 */
export const SECTIONS = [
  { id: 'A', de: 'Operationelle Vorbereitung', en: 'Operational preparation' },
  { id: 'B', de: 'Meteorologische Vorbereitung', en: 'Meteorological preparation' },
  { id: 'C', de: 'Navigatorische Vorbereitung', en: 'Navigational preparation' },
  { id: 'D', de: 'Briefings', en: 'Briefings' },
];

export const PANELS = [
  // A
  { key: 'A.core', section: 'A', kind: 'core', de: 'Stammdaten', en: 'Flight data', grade: 'calc', always: true },
  { key: 'A.sun', section: 'A', kind: 'sun', de: 'Sonnenauf-/untergang', en: 'Sunrise / sunset', grade: 'calc', always: true },
  { key: 'A.massperf', section: 'A', kind: 'massperf', de: 'Tragkraft-, Treibstoff- und Massenberechnung', en: 'Lift, fuel and mass calculation', grade: 'calc', always: true },
  { key: 'A.landing', section: 'A', kind: 'landing', de: 'Geplante Landeorte, Besonderheiten', en: 'Planned landing areas, particulars', grade: 'manual' },
  { key: 'A.equipment', section: 'A', kind: 'equipment', de: 'Erforderliche Spezialausrüstung', en: 'Special equipment required', grade: 'calc' },
  { key: 'A.schedule', section: 'A', kind: 'schedule', de: 'Tagesplanung (LT)', en: 'Day schedule (LT)', grade: 'calc', always: true },
  { key: 'A.remarks', section: 'A', kind: 'text', de: 'Bemerkungen', en: 'Remarks', grade: 'manual' },
  // B
  { key: 'B.synoptic', section: 'B', kind: 'auto', auto: 'synoptic', de: 'Allgemeine Lage mit Bodendruckkarte', en: 'General situation with surface chart', grade: 'half', link: 'meteoswiss', phase2: 'ECMWF Open Charts, DWD Bodenanalyse' },
  { key: 'B.metar', section: 'B', kind: 'auto', auto: 'metar', de: 'METAR/TAF der nächstgelegenen Flugplätze', en: 'METAR/TAF of nearest aerodromes', grade: 'auto', link: 'skybriefing', phase2: 'aviationweather.gov, Plätze im eingestellten Umkreis (RAW + Klartext)' },
  { key: 'B.temps', section: 'B', kind: 'auto', auto: 'temps', de: 'Temps', en: 'Soundings', grade: 'auto', link: 'meteoblue', phase2: 'meteoblue Images API, eigenes Stüve, Payerne' },
  { key: 'B.obs', section: 'B', kind: 'paste', de: 'Observations', en: 'Observations', grade: 'auto', link: 'meteoswiss', phase2: 'SwissMetNet, METAR, DWD-Stationen' },
  { key: 'B.fwp', section: 'B', kind: 'auto', auto: 'fwp', de: 'Flugwetterprognose (offiziell)', en: 'Official aviation forecast', grade: 'half', link: 'skybriefing', phase2: 'DE: DWD Luftsportberichte automatisch' },
  { key: 'B.wind', section: 'B', kind: 'auto', auto: 'wind', de: 'Windprognose (Boden/Höhe)', en: 'Wind forecast (surface/altitude)', grade: 'half', link: 'pcmet', phase2: 'eigene Windfiedern-Karten' },
  { key: 'B.balloon', section: 'B', kind: 'auto', auto: 'balloon', de: 'Ballonprognose', en: 'Balloon forecast', grade: 'auto', link: 'dwdBallon', phase2: 'DWD Gebietsvorhersage Ballonsport, eigene Stundentabelle' },
  { key: 'B.pdiff', section: 'B', kind: 'auto', auto: 'pdiff', de: 'Druckdifferenzprognose', en: 'Pressure difference forecast', grade: 'auto', link: 'meteoswiss', phase2: 'Bise/Föhn aus Modell und SwissMetNet' },
  { key: 'B.traj', section: 'B', kind: 'auto', auto: 'traj', de: 'Trajektorien', en: 'Trajectories', grade: 'auto', link: 'meteoblue', phase2: 'eigene Berechnung, Szenarien, Ensemble' },
  { key: 'B.sigwx', section: 'B', kind: 'auto', auto: 'sigmet', de: 'SIGWX low Alps', en: 'SIGWX low Alps', grade: 'half', link: 'skybriefing', phase2: 'SIGMET/AIRMET automatisch' },
  { key: 'B.thermal', section: 'B', kind: 'auto', auto: 'thermal', de: 'Thermik', en: 'Thermals', grade: 'auto', phase2: 'eigene Abschätzung aus Modellwerten (Strahlung, Grenzschicht): Einsetzen, Stärke, Abschwächen' },
  { key: 'B.meteogram', section: 'B', kind: 'auto', auto: 'meteogram', de: 'Meteogramm, Take-off Forecast o. ä.', en: 'Meteogram, take-off forecast', grade: 'auto', link: 'meteoblue', phase2: 'meteoblue Images API, eigenes Meteogramm' },
  { key: 'B.radar', section: 'B', kind: 'auto', auto: 'radar', de: 'Radar / Blitz / Satellit / Webcams', en: 'Radar / lightning / satellite / webcams', grade: 'auto', link: 'windy', phase2: 'RainViewer, EUMETSAT, Windy-Webcams', optional: true },
  { key: 'B.warnings', section: 'B', kind: 'paste', de: 'Warnungen', en: 'Warnings', grade: 'auto', link: 'meteoswiss', phase2: 'MeteoSchweiz/DWD-Warnungen', optional: true },
  { key: 'B.remarks', section: 'B', kind: 'text', de: 'Bemerkungen', en: 'Remarks', grade: 'manual' },
  // C
  { key: 'C.fpl', section: 'C', kind: 'text', de: 'Flugplan', en: 'Flight plan', grade: 'manual', defaultText: { de: 'keiner', en: 'none' } },
  { key: 'C.dabs', section: 'C', kind: 'auto', auto: 'dabs', de: 'DABS', en: 'DABS', grade: 'auto', link: 'skybriefingDabs', phase2: 'DABS-PDF automatisch (CH)', chOnly: true },
  { key: 'C.notam', section: 'C', kind: 'auto', auto: 'notam', de: 'Strecken-NOTAM (VFR-relevant)', en: 'Route NOTAM (VFR relevant)', grade: 'auto', link: 'skybriefing', phase2: 'FAA-NOTAM-API mit Korridor und VFR-Filter' },
  { key: 'C.agreements', section: 'C', kind: 'text', de: 'Besondere Absprachen', en: 'Special agreements', grade: 'manual', defaultText: { de: 'keine', en: 'none' } },
  { key: 'C.transition', section: 'C', kind: 'transition', de: 'Übergangshöhe', en: 'Transition altitude', grade: 'calc' },
  { key: 'C.remarks', section: 'C', kind: 'text', de: 'Bemerkungen', en: 'Remarks', grade: 'manual' },
  // D
  { key: 'D.pax', section: 'D', kind: 'text', de: 'Besondere Briefingbedürfnisse PAX', en: 'Special briefing needs PAX', grade: 'manual' },
  { key: 'D.crew', section: 'D', kind: 'text', de: 'Besondere Briefingbedürfnisse CREW', en: 'Special briefing needs CREW', grade: 'manual' },
  { key: 'D.standard', section: 'D', kind: 'paxbriefing', de: 'Standard-Briefing PAX', en: 'Standard PAX briefing', grade: 'calc', always: true },
];

export const panelByKey = (k) => PANELS.find((p) => p.key === k);

/** Sichtbare Panels in Reihenfolge (ausgeblendete und CH-only ausserhalb CH entfernt). */
export function visiblePanels(settings, briefing) {
  const hidden = new Set(settings?.panels?.hidden || []);
  const ch = (briefing?.site?.country || '') === 'CH';
  return PANELS.filter((p) => !hidden.has(p.key) && (!p.chOnly || ch));
}

/** Ist ein Panel inhaltlich gefüllt? (für Freigabe-Checkliste) */
export function panelFilled(p, briefing) {
  const d = briefing.panels?.[p.key] || {};
  const extraText = (d.extra?.text || '').trim();
  const extraImg = (d.extra?.images || []).length;
  switch (p.kind) {
    case 'core': case 'sun': case 'massperf': case 'schedule': case 'transition': case 'paxbriefing': case 'equipment':
      return true;
    case 'text':
      return !!((d.content?.text || '').trim() || extraText);
    case 'landing':
      return !!((d.content?.text || '').trim() || extraText || briefing.landing?.lat != null);
    case 'paste':
      return !!((d.content?.text || '').trim() || (d.content?.images || []).length || extraText || extraImg);
    case 'auto':
      return !!(d.content?.auto || (d.content?.text || '').trim() || (d.content?.images || []).length || extraText || extraImg);
    default:
      return true;
  }
}

/** Pflicht-Panels gemäss Einstellungen (sichtbar, nicht «always»). */
export function mandatoryPanels(settings, briefing) {
  const m = new Set(settings?.panels?.mandatory || []);
  return visiblePanels(settings, briefing).filter((p) => m.has(p.key) && !p.always);
}

/** AMC1 BOP.BAS.115 — Text, wie im Muster hinterlegt (EN, Original). */
export const AMC1_BOP_BAS_115 = `AMC1 BOP.BAS.115 Briefing of passengers
(a) Passengers should be given a verbal briefing and demonstration about safety matters in such a way that the information is easily retained and applied during the landing and in the case of an emergency situation.
(b) The briefing/demonstration should include the following items:
(1) safety in relation to ground equipment;
(2) use of internal handholds;
(3) wearing of suitable clothing;
(4) smoking regulations;
(5) in-flight use and stowage of personal belongings and baggage;
(6) importance to remain inside the basket at all times, particularly after landing;
(7) landing positions to be assumed to minimise the effect of the impact during landing;
(8) safe manoeuvring of the balloon on the ground after landing;
(9) use of oxygen-dispensing equipment, if applicable; and
(10) other emergency equipment provided for individual passenger use, if applicable.
(c) Part or all of the verbal briefing may be provided additionally by a safety briefing card on which pictorial instructions indicate the correct landing position.
(d) Before take-off, the correct landing position should be demonstrated.
(e) Before commencing the landing phase, passengers should be required to practise the correct landing position.`;

export const GAS_BRIEFING_EXTRA = {
  de: ['Wasserstoff: kein Feuer, kein Rauchen, keine Funken (auch Handy) im Umkreis der Hülle', 'Ballasthandling: nur auf Anweisung des Piloten', 'Schleiflandung: Haltung, Festhalten, im Korb bleiben', 'Nachtfahrt: Stirnlampe rot, Lärm vermeiden'],
  en: ['Hydrogen: no fire, no smoking, no sparks (incl. phones) near the envelope', 'Ballast handling only on the pilot\'s instruction', 'Drag landing: position, hold on, stay in the basket', 'Night flight: red headlamp, keep noise down'],
};
