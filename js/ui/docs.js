/* Fahrtbriefing — Betriebsdokumente aus dem Briefing (0.13.0, Stufe 0 des Konzepts ops.wicki.aero):
 *   #/bs/<id>  Passagierliste und Beförderungsschein (Vorlage BHB ANH 511 v7, DE/EN nach Briefingsprache, 2 Seiten)
 *   #/fa/<id>  Flugauftrag / Operator Flight Assignment (Entwurf 12.10.2026, 1 Seite)
 * Beide vorausgefüllt aus dem Briefing und den Stammdaten; digitale Unterschrift (hinterlegtes Unterschriftenbild je
 * Nutzer, Name und Zeitstempel UTC) für Betreiber und PIC; PDF über den Worker (Browser Rendering), Ablage im Briefing.
 */
import { h, toast, dialog, confirmDialog } from '../util.js';
import { t, getLang } from '../i18n.js';
import { setHeader, printButton } from '../app.js';
import { upgradeBriefing, placeLabel, hasCopilot, crossesBorder, routeCountries, personsOnBoard, massPerf } from '../model.js';
import { hhmm, fmtDate, fmtDur } from '../calc/time.js';
import { goNoGo } from '../calc/gonogo.js';
import { icao } from '../calc/geo.js';

const today = () => new Date().toISOString().slice(0, 10);
const box = (on) => h('span.cb', { class: on ? 'on' : '' });
const utc = (ms) => { const d = new Date(ms); return `${d.toISOString().slice(0, 10).split('-').reverse().join('.')} ${d.toISOString().slice(11, 16)} UTC`; };

/** Personendokumente des PIC: Lizenznummer (Dokument «Lizenz …») und Medical-Gültigkeit (Dokument «Medical»). */
export function picDocs(person) {
  const docs = person?.docs || [];
  const lic = docs.find((d) => /lizenz|licen/i.test(d.type || '')), med = docs.find((d) => /medical/i.test(d.type || ''));
  return { licence: lic?.name || '', medicalTo: med?.validTo || '', medicalExpired: !!med?.validTo && med.validTo < today(), licenceDoc: lic, medicalDoc: med };
}
const fmtIso = (iso) => (iso ? iso.split('-').reverse().join('.') : '');

/** Ballon mit Registerdaten aus den Stammdaten (Snapshot im Briefing enthält sie nicht). */
function balloonFull(b, S) {
  const B = S.balloons || {};
  if (b.balloon?.type === 'gas') {
    const env = (B.envelopes || []).find((e) => e.id === b.balloon.envelopeId) || {}, bas = (B.baskets || []).find((k) => k.id === b.balloon.basketId) || {};
    return { reg: b.balloon.reg, model: env.model || '', volume: env.volume || b.balloon.volume, register: env.register || null, basket: bas.name || '', basketMass: bas.mass, maxPersons: bas.maxPersons, hex: env.hex || b.balloon.hex || '', masses: b.balloon.masses || {}, cylinders: [] };
  }
  const hab = (B.hab || []).find((x) => x.id === b.balloon?.id) || b.balloon || {};
  return { reg: b.balloon?.reg || hab.id, model: hab.model || '', volume: hab.volume, register: hab.register || null, basket: '', basketMass: hab.masses?.basket, maxPersons: hab.maxPersons, hex: hab.hex || '', masses: hab.masses || {}, mtom: hab.mtom, cylinders: (hab.cylinders || []).filter((c) => c.count) };
}

const OPERATOR_LINES = { de: ['Wicki Aero GmbH, Stockerstrasse 44, CH-8002 Zürich (Halterin)', 'Balthasar Wicki, Bertastrasse 21, CH-8003 Zürich (Eigentümer)'], en: ['Wicki Aero GmbH, Stockerstrasse 44, CH-8002 Zurich (aircraft operator)', 'Balthasar Wicki, Bertastrasse 21, CH-8003 Zurich (aircraft owner)'] };
const REGS = ['HB-QWP', 'HB-QWZ', 'HB-QPJ', 'HB-QWV'];

/** Unterschriftenblock: hinterlegtes Bild + Name + Zeitstempel, sonst leere Linie. */
function sigBlock(sig, label) {
  return h('div.sig', [h('div.sig-img', sig?.url ? h('img', { src: sig.url, alt: '' }) : null), h('div.sig-line', sig ? `${label} · ${t('doc_signed')}: ${sig.name}, ${utc(sig.ts)}` : label)]);
}

// ---------------------------------------------------------------- Beförderungsschein
export function bsSheet(b, ctx) {
  const S = ctx.settings, z = b.site.tz || 'Europe/Zurich', lang = b.lang === 'en' ? 'en' : 'de', de = lang === 'de';
  const pax = b.persons.pax || [], fee = b.flight.fee || {};
  const commercial = b.flight.kind === 'commercial', privatePaid = b.flight.kind === 'private' && !fee.free && !!fee.amount, privateFree = b.flight.kind === 'private' && !privatePaid;
  const startH = +hhmm(z, b.time.startMs).slice(0, 2);
  const persons = (S.persons || []);
  const paxRows = [...pax, ...Array(Math.max(0, 5 - pax.length)).fill(null)].map((p) => {
    const sp = p?.id ? persons.find((x) => x.id === p.id) : p?.name ? persons.find((x) => x.name === p.name) : null;
    return h('tr', [h('td', p?.name || ''), h('td.muted', sp?.email || ''), h('td')]);
  });
  const opIsWicki = /wicki aero/i.test(b.flight.operatorName || '');
  const page1 = h('div.docsheet.bs', [
    h('div.dhead', [h('div.dtitle', de ? 'Passagierliste und Beförderungsschein' : 'Passenger List and Title of Transport'), h('img.dlogo', { src: 'img/wicki-logo.png', alt: 'Wicki Partners Ballonteam' })]),
    h('table.dtab', h('tbody', [
      h('tr', [h('td.k', de ? 'Datum der Fahrt' : 'Date of Flight'), h('td', [h('b', fmtDate(z, b.time.startMs, lang)), '   ', box(startH < 12), de ? ' am  ' : ' am  ', box(false), de ? ' Tag  ' : ' day  ', box(startH >= 12), ' pm    ', de ? 'Startort ' : 'launch location ', h('b', placeLabel(b.site))])]),
      h('tr', [h('td.k', de ? 'Kennzeichen' : 'Registration'), h('td', [...REGS.flatMap((r) => [box(b.balloon?.reg === r), ` ${r}  `]), box(!REGS.includes(b.balloon?.reg)), ` ${!REGS.includes(b.balloon?.reg) ? b.balloon?.reg || '____________' : '____________'}`])]),
      h('tr', [h('td.k', de ? 'Luftfrachtführer' : 'Air Carrier'), h('td.lines', [h('div', [box(opIsWicki), ` ${OPERATOR_LINES[lang][0]}`]), h('div', [box(!opIsWicki && /wicki/i.test(b.flight.operatorName || '')), ` ${OPERATOR_LINES[lang][1]}`]), h('div', [box(false), de ? ' Veranstalter einer Luftfahrtveranstaltung  ' : ' organizer of an aviation event  ', box(!opIsWicki && !/wicki/i.test(b.flight.operatorName || '')), de ? ' andere Drittpartei ' : ' other third party ', (!opIsWicki && !/wicki/i.test(b.flight.operatorName || '')) ? h('b', b.flight.operatorName) : '____________________'])])]),
      h('tr', [h('td.k', de ? 'Entgelt' : 'Remuneration'), h('td.lines', [
        h('div', [box(commercial && !!fee.amount), ` ${fee.currency || 'CHF'} ${commercial && fee.amount ? h('b', String(fee.amount)).textContent : '____________'}  `, box(commercial && !!fee.amount && fee.mode === 'perFlight'), de ? ' pro Fahrt / ' : ' per flight / ', box(commercial && !!fee.amount && fee.mode === 'perPerson'), de ? ' pro Person / ' : ' per person / ', box(commercial && !!fee.amount && fee.mode === 'various'), de ? ' untersch. Entgelte' : ' different prices']),
        h('div', [box(commercial && fee.third === 'by'), de ? ' durch / ' : ' charged by a third party / ', box(commercial && fee.third === 'to'), de ? ' an einen Dritten verrechnet' : ' charged to the benefit of a third party']),
        h('div', [box(commercial && !!fee.free), de ? ' unentgeltliche Fahrt / ' : ' complimentary flight / ', box(commercial && fee.free === 'some'), de ? ' für einzelne Pax unentgeltliche Fahrt' : ' complimentary flight for certain passengers']),
      ])]),
      h('tr', [h('td.k', de ? 'Art der Fahrt' : 'Qualification of Flight'), h('td.lines', [
        h('div', [box(commercial), de ? ' gewerbliche Fahrt  ' : ' commercial flight  ', box(b.flight.kind === 'training'), de ? ' Ausbildungs-/Trainingsfahrt  ' : ' instruction, training flight  ', box(b.flight.kind === 'exam'), ' Skill test, OPC']),
        h('div', [box(privatePaid), de ? ' private entgeltliche Fahrt mit eingeschränkter Versicherungsdeckung (siehe Rückseite)' : ' private flight against reward with limited insurance coverage (see overleaf)']),
        h('div', [box(privateFree), de ? ' private unentgeltliche Fahrt mit Enthaftungserklärung (siehe Rückseite)' : ' private unpaid flight with release of liability (see overleaf)']),
      ])]),
    ])),
    h('div.dbox', de ? [
      h('div', 'Sowohl nach nationalem wie auch internationalen Bestimmungen ist die Haftung eines Luftfrachtführers für Personen- und Sachschäden der Passagiere beschränkt. Es wird ausdrücklich festgehalten, dass es sich nicht um eine gewerbs- oder berufsmässige Personenbeförderung durch ein gewerbliches Luftfahrtunternehmen handelt, sofern dies oben nicht ausdrücklich so erklärt wird.'),
      h('div', 'Mit meiner Unterschrift bestätige ich als Passagier, dass ich'),
      h('ul', ['eine Einweisung in den Ablauf der Ballonfahrt erhalten habe;', 'in jedem Fall mit der Vereinbarung von Zürich/Schweiz als ausschliesslichem Gerichtsstand und Schweizer Recht als anwendbarem Recht ausdrücklich einverstanden bin (gemäss Rückseite, Abschnitt B);', 'mit den Versicherungs- und Beförderungsbestimmungen einverstanden bin (gemäss Rückseite, Abschnitte A und C, falls anwendbar);', 'für private unentgeltliche Fahrten mit einer umfassenden Haftungsfreistellung einverstanden bin (gemäss Rückseite, Abschnitt D);', 'mit der Nutzung meiner E-Mail-Adresse für einen künftigen Newsletter-Versand einverstanden bin; und', 'den Piloten über allfällige gesundheitliche Einschränkungen vollumfänglich aufgeklärt habe.'].map((x) => h('li', x))),
    ] : [
      h('div', 'According to both national and international regulations, the liability of an air carrier for personal injury and damage to passengers’ property is limited. It is expressly stated that this is not a commercial or professional passenger transport by a commercial air transport organization unless this is expressly stated above.'),
      h('div', 'With my signature as a passenger, I confirm that I'),
      h('ul', ['have been briefed on the procedure of the balloon flight;', 'in any case expressly agree with the agreement of Zurich/Switzerland as the exclusive place of jurisdiction and Swiss law as the applicable law (as stated overleaf, Section B);', 'agree with the insurance and the transport regulations (as stated overleaf, Sections A and, if applicable, C);', 'in case of a private unpaid flight: agree with a comprehensive release from liability (as stated overleaf, Section D);', 'consent to the use of my e-mail address to be used for eventual future electronic communication; and', 'informed the pilot fully of any health restrictions.'].map((x) => h('li', x))),
    ]),
    h('table.dtab.paxtab', [h('thead', h('tr', [h('td.k', de ? 'Vorname Name' : 'Full name'), h('td.k', de ? 'E-Mail-Adresse; Bemerkungen, gesundheitliche Einschränkungen' : 'E-mail address; remarks, health restrictions'), h('td.k', de ? 'Unterschrift' : 'Signature')])), h('tbody', paxRows)]),
    h('div.sigrow', [h('div.sig', [h('div.sig-img.text', `${placeLabel(b.site).split(',')[0]}, ${fmtDate(z, b.time.startMs, lang)}`), h('div.sig-line', de ? 'Ort, Datum' : 'Place, Date')]), sigBlock(b.docs?.bs?.picSig, de ? 'Unterschrift Ballonpilot' : 'Signature of Balloon Pilot')]),
    h('div.dfoot', [h('span', `v7 | 28.12.2024 | EASA BOP.BAS.115 · ${t('doc_from')} ${b.no || ''} ${b.finalNo ? `Final v${b.finalNo}` : ''} · ops.wicki.aero`), h('span', '1 | 2')]),
  ]);
  const page2 = de ? h('div.docsheet.bs.p2', [
    h('div.dsub', 'Diese Auszüge sind aus dem offiziellen Beförderungsschein der AXA Versicherungen entnommen:'),
    h('div.dbox.two', [
      h('div', [h('b', 'A. Hinweise zur Haftung'), h('p', 'Die Beförderung aufgrund dieses Beförderungsscheins unterliegt den Haftungsbestimmungen der zum Zeitpunkt des Fluges geltenden Fassung des Schweizerischen Obligationenrechts («OR»), der Schweizer Verordnung über den Lufttransport («LTrV») oder des Montrealer Übereinkommens vom 28.05.1999 («MÜ»; Anpassungen per 28.12.2024). Diese regeln die Haftung des Luftfrachtführers. Für Tod oder Körperverletzung eines Passagiers, für den Verlust oder die Beschädigung von Gepäck und für Verspätung. Wenn die LTrV oder das MÜ Anwendung finden, kann die Haftung beschränkt sein:'), h('ol', [h('li', 'Für Körperschäden bis zu SDR 151’880 (Sonderziehungsrechte; ca. EUR 191’598) kann die Haftung weder ausgeschlossen noch beschränkt werden. Darüber hinaus kann sich der Luftfrachtführer, bei bestimmten gesetzlich festgelegten Entlastungsgründen.'), h('li', 'Bei Zerstörung, Verlust, Beschädigung oder Verspätung von Reisegepäck ist die Haftung auf SDR 1’519 (ca. EUR 1’916) pro Passagier begrenzt. Reisegepäck, dessen Wert diesen Betrag übersteigt, sollte der Passagier vor Antritt der Reise dem Lufttransportführer melden oder vollständig versichern.'), h('li', '[Verspätungen: nicht relevant für Ballonfahrten]')]), h('p', 'Leistungen, die den Schadenersatz-Anspruchsberechtigten aus der vom Luftfrachtführer oder vom Luftfahrzeughalter allenfalls abgeschlossenen Insassenunfall-Versicherung ausgerichtet werden, und allfällige Vorauszahlungen, die vom Luftfrachtführer oder für dessen Rechnung geleistet werden, sind im vollen Umfang auf die Haftpflichtansprüche anzurechnen.')]),
      h('div', [h('b', 'B. Gerichtsstandsvereinbarung für Passagiere und anwendbares Recht'), h('p', 'Sämtliche Ansprüche gegenüber dem Luftfrachtführer, dem Luftfahrzeugbetreiber, dem Luftfahrzeughalter oder dem Luftfahrzeugeigentümer, ihren jeweiligen Aktionären, Gesellschaftern, Organen, Hilfspersonen oder Angestellten, oder den Nachkommen jeder dieser Personen oder Gesellschaften («geschützte Parteien»), sind bei Personenschäden oder im Todesfall im Zusammenhang mit diesem Transport, aus welchem Rechtsgrund auch immer, ausschliesslich nach Schweizer Recht und ohne Beachtung der kollisionsrechtlichen Bestimmungen zu behandeln. Mit Ausnahme der Fälle, bei welchen das Montrealer Übereinkommen («MÜ») zur Anwendung gelangt, sind sämtliche Ansprüche ausschliesslich von den Gerichten am Schweizer Wohnsitz des Klägers oder des Beklagten zu behandeln. Falls das MÜ zur Anwendung gelangt, ist der erstattungsfähige Schadenersatzanspruch gemäss Art. 17 MÜ nach Schweizer Recht zu beurteilen.'), h('p', 'Der Passagier anerkennt ausdrücklich, dass nach Schweizer Recht Entschädigungen bei Körperschäden oder im Todesfall geringer ausfallen können als nach Rechtsordnungen anderer Staaten unter ähnlichen Umständen.'), h('p', 'Jede geschützte Partei kann von dieser Klausel Gebrauch machen.'), h('p', 'Der unterzeichnende Passagier anerkennt, dass er alle obenstehenden Bestimmungen gelesen, verstanden und akzeptiert hat und er sich für sich und seine Nachkommen verbindlich bindet.')]),
    ]),
    h('div.dbox', [h('b', 'C. Für private entgeltliche Fahrten gilt zusätzlich'), h('p', 'Es handelt sich um eine private Ballonfahrt gegen Entgelt, bei der das Versicherungsobligatorium zur Deckung der Haftpflicht von Personen- und Sachschäden der Passagiere gemäss nachfolgend Ziffer 1 auf SDR 151’880 (ca. EUR 191’598) begrenzt ist.')]),
    h('div.dbox', [h('b', 'D. Private unentgeltliche Fahrten: Enthaftungserklärung des Passagiers'), h('p', ['Es handelt sich um eine private unentgeltliche Ballonfahrt, bei der die nachfolgende Haftungsfreistellung vereinbart wird: ', h('b', 'Der unterzeichnende Fluggast erklärt hiermit freiwillig, dass er auf allfällige Schadenersatz- und Genugtuungsforderungen im Zusammenhang mit dem bezeichneten Flug gegenüber dem genannten Piloten verzichtet, soweit dies nach Gesetz zulässig ist.'), ' Der Passagier ist sich über die Tragweite dieser Enthaftungserklärung bewusst.'])]),
    h('div.dfoot', [h('span', 'v7 | 28.12.2024 | EASA BOP.BAS.115'), h('span', '2 | 2')]),
  ]) : h('div.docsheet.bs.p2', [
    h('div.dsub', 'These excerpts are taken from the AXA Insurance Title of Transport:'),
    h('div.dbox.two', [
      h('div', [h('b', 'A. Notice on Liability'), h('p', 'Carriage on the basis of this title of transport is subject to the liability provisions – as currently in force – of the Swiss Code of Obligations ("CO"), the Swiss Ordinance on Carriage by Air ("OCA"), or the Montreal of 28.05.1999 ("MC"; amended per 28.12.2024). These instruments govern the liability of air carriers for death or bodily injury of a passenger, for the loss or damage of baggage and for delay. Whenever the OCA or the MC applies, liability may be limited:'), h('ol', [h('li', 'For losses out of personal injuries up to SDR 151’880 (Special Drawing Rights; ca. EUR 191’598), the liability may not be excluded or limited. Beyond this, the air carrier may exempt itself from liability under certain grounds for exoneration, defined by the legislation.'), h('li', 'Liability for destruction, loss, damage, or delay to baggage, is limited to SDR 1’519 (ca. EUR 1’916) per passenger. Baggage greater in value than this figure should be brought to the carrier’s attention at check-in or fully insured by the passenger prior to travel.'), h('li', '[Delayed travel: not relevant for balloon flights]')]), h('p', 'Benefits paid to persons entitled to compensation for damages from any passenger accident insurance policies the air carrier or aircraft owner may have taken, or any advance payments made by the carrier or on its behalf shall be credited in full against liability claims.')]),
      h('div', [h('b', 'B. Jurisdiction Agreement in respect of passengers and Applicable Law'), h('p', 'Any claims against the carrier, the aircraft operator or owner, their respective shareholders, members, directors, agents or employees, or the successors of any of these persons of entities (“protected parties”), for personal injury or death in connection with this carriage, however founded, shall be governed by the laws of Switzerland, without regard to its conflicts of laws provisions. Except for cases subject to the Montreal Convention (“MC”), any such claims shall be in the exclusive jurisdiction of the Swiss courts of the defendant’s or of the claimant’s domicile. Whenever the MC applies, Swiss law shall determine damages recoverable under art. 17 MC.'), h('p', 'The passenger hereby acknowledges that damages recoverable under Swiss law in case of personal injury or death may be lower than damages recoverable in some other jurisdictions under similar circumstances.'), h('p', 'Any of the protected parties may avail itself of this clause.'), h('p', 'The undersigned passenger acknowledges he/she has read, understood and approved the terms hereof, which shall be binding upon himself/herself and his/her successors.')]),
    ]),
    h('div.dbox', [h('b', 'C. Additional Note applicable to Private Flights against Compensation'), h('p', 'This is a private flight against compensation, for which mandatory insurance coverage for liability in case of passengers’ personal injury and property damage is limited to SDR 151’880 (ca. EUR 191’598).')]),
    h('div.dbox', [h('b', 'D. For Private Unpaid Flights: Release Declaration by the Passenger'), h('p', [h('b', 'The undersigned flight passenger hereby declares voluntarily that he/she waives any claims for damages or demands for satisfaction versus the named pilot in connection with the described flight.'), ' The flight passenger is aware of the implications of this release declaration.'])]),
    h('div.dfoot', [h('span', 'v7 | 28.12.2024 | EASA BOP.BAS.115'), h('span', '2 | 2')]),
  ]);
  return h('div.docpages', [page1, page2]);
}

// ---------------------------------------------------------------- Flugauftrag
export function faSheet(b, ctx) {
  const S = ctx.settings, z = b.site.tz || 'Europe/Zurich', lang = b.lang === 'en' ? 'en' : 'de', de = lang === 'de';
  const bal = balloonFull(b, S), reg = bal.register;
  const persons = S.persons || [];
  const pic = persons.find((p) => p.id === b.persons.picId) || persons.find((p) => p.name === b.persons.pic) || null;
  const pd = picDocs(pic);
  const retr = (b.persons.retrievers || []).map((r) => { const p = persons.find((x) => x.id === r.id); return `${r.name}${p?.phone ? ', ' + p.phone : ''}`; });
  const pax = b.persons.pax || [];
  const gng = goNoGo(b, S);
  const countries = [...routeCountries(b)].filter((c) => c !== b.site.country);
  const landing = b.landing?.name ? ((b.intent.direction || '').startsWith(b.landing.name) ? b.intent.direction : `${b.landing.name}${b.intent.direction ? ' · ' + b.intent.direction : ''}`) : b.intent.direction || '–';
  const endMs = b.time.startMs + (b.intent.durationMin || 0) * 60000;
  const fee = b.flight.fee || {};
  const mp = (() => { try { return massPerf(b, S); } catch { return null; } })();
  const cyl = bal.cylinders.length ? bal.cylinders.map((c) => `${c.count} × ${c.name} ${c.litres} l`).join(', ') : '';
  const sigs = b.docs?.fa || {};
  const page = h('div.docsheet.fa', [
    h('div.dhead.line', [
      h('div', [h('div.dtitle', de ? 'Flugauftrag · Operator Flight Assignment' : 'Operator Flight Assignment · Flugauftrag'), h('div.dsub', de ? 'Auftrag des Betreibers an den verantwortlichen Piloten (PIC), die Fahrt gemäss den nachstehenden Rahmenbedingungen durchzuführen' : 'Assignment by the operator to the pilot-in-command (PIC) to conduct the flight under the conditions stated below')]),
      h('div.dright', [h('img.dlogo', { src: 'img/wicki-logo.png', alt: 'Wicki Partners Ballonteam' }), h('div.mini', 'CH.BOP.8054 (CH-BAL BB 8054)'), h('div.mini', [`${de ? 'Fahrt-Nr.' : 'Flight no.'} `, h('b', b.no || '–'), b.finalNo ? ` · Final v${b.finalNo}` : '', b.frozenAt ? ` · ${utc(b.frozenAt)}` : ''])]),
    ]),
    h('table.dtab', h('tbody', [
      h('tr', [h('td.k', de ? 'Betreiber' : 'Operator'), h('td', { colspan: 3 }, /wicki aero/i.test(b.flight.operatorName || '') ? `Wicki Aero GmbH, Stockerstrasse 44, CH-8002 Zürich (${de ? 'Halterin, Lufttransportführer' : 'operator, air carrier'})` : b.flight.operatorName || '–')]),
      h('tr', [h('td.k', de ? 'Datum · Start' : 'Date · Launch'), h('td.w2', [h('b', fmtDate(z, b.time.startMs, lang)), ` · ${de ? 'Start' : 'launch'} ${hhmm(z, b.time.startMs)} LT (${hhmm('UTC', b.time.startMs)} UTC)`]), h('td.k2', de ? 'Dauer' : 'Duration'), h('td', `${de ? 'geplant' : 'planned'} ${fmtDur(b.intent.durationMin)} · ${de ? 'Landung ca.' : 'landing approx.'} ${hhmm(z, endMs)} LT`)]),
      h('tr', [h('td.k', de ? 'Startort' : 'Launch site'), h('td', { colspan: 3 }, `${placeLabel(b.site)} · ${b.site.icao || (b.site.lat != null ? icao(b.site.lat, b.site.lon) : '')}${b.site.elev != null ? ` · ${b.site.elev} m / ${Math.round(b.site.elev * 3.28084)} ft` : ''}`)]),
      h('tr', [h('td.k', de ? 'Landeraum' : 'Landing area'), h('td', { colspan: 3 }, [landing, `; ${de ? 'Grenzübertritt' : 'border crossing'}: `, box(!crossesBorder(b)), de ? ' nein  ' : ' no  ', box(crossesBorder(b)), ` ${de ? 'ja' : 'yes'}${countries.length ? ` (${countries.join(' / ')})` : ''}`])]),
      h('tr', [h('td.k', de ? 'Art der Fahrt' : 'Type of flight'), h('td', { colspan: 3 }, [box(b.flight.kind === 'commercial'), de ? ' gewerbliche Fahrt  ' : ' commercial  ', box(b.flight.kind === 'private'), de ? ' private Fahrt  ' : ' private  ', box(b.flight.kind === 'training'), de ? ' Ausbildung/Training  ' : ' training  ', box(b.flight.kind === 'exam'), ' Skill test/OPC  ·  ', box(b.balloon?.type !== 'gas'), de ? ' Heissluft  ' : ' hot air  ', box(b.balloon?.type === 'gas'), ' Gas', b.flight.kind === 'commercial' && fee.amount ? ` · ${de ? 'Entgelt' : 'fee'} ${fee.currency || 'CHF'} ${fee.amount} ${fee.mode === 'perPerson' ? (de ? 'pro Person' : 'per person') : fee.mode === 'various' ? (de ? 'unterschiedlich' : 'various') : (de ? 'pro Fahrt' : 'per flight')}` : ''])]),
    ])),
    h('table.dtab', h('tbody', [
      h('tr', [h('td.k', de ? 'Ballon' : 'Balloon'), h('td.w2', [h('b', bal.reg || '–'), reg ? ` · ${reg.manufacturer || ''} ${reg.model || bal.model}${reg.serial ? ` · S/N ${reg.serial}` : ''}` : bal.model ? ` · ${bal.model}` : '', bal.volume ? ` · ${bal.volume.toLocaleString('de-CH')} m³` : '', reg?.tcds ? ` · TCDS ${reg.tcds}` : '', reg?.arcUntil ? ` · ARC ${de ? 'bis' : 'until'} ${fmtIso(reg.arcUntil)}` : '']), h('td.k2', de ? 'Korb · Massen' : 'Basket · masses'), h('td', [bal.basket ? `${bal.basket} · ` : '', bal.masses?.basket != null ? `${de ? 'Korb' : 'basket'} ${bal.masses.basket} kg · ` : '', bal.masses?.burner != null ? `${de ? 'Brenner' : 'burner'} ${bal.masses.burner} kg · ` : '', bal.masses?.envelope != null ? `${de ? 'Hülle' : 'envelope'} ${bal.masses.envelope} kg · ` : '', bal.masses?.equipment != null ? `${de ? 'Ausrüstung' : 'equipment'} ${bal.masses.equipment} kg · ` : '', reg?.mopsc != null ? `MOPSC ${reg.mopsc} · ` : bal.maxPersons ? `max. ${bal.maxPersons} ${de ? 'Pers.' : 'pers.'} · ` : '', (reg?.mtom || bal.mtom) ? `MTOM ${reg?.mtom || bal.mtom} kg` : '', bal.hex ? ` · Hex ${bal.hex}` : ''])]),
      h('tr', [h('td.k', de ? 'Besatzung' : 'Crew'), h('td', { colspan: 3 }, [`PIC `, h('b', b.persons.pic || '–'), ` (${pd.licence ? pd.licence : (de ? 'Lizenz-Nr. –' : 'licence no. –')}, Medical ${pd.medicalTo ? `${de ? 'gültig bis' : 'valid until'} ${fmtIso(pd.medicalTo)}` : '–'})`, hasCopilot(b) ? ` · ${de ? 'Crew/2. Pilot' : 'crew/2nd pilot'}: ${b.persons.copilot}` : '', retr.length ? ` · ${de ? 'Rückholer' : 'retrieve'}: ${retr.join('; ')}` : ''])]),
      h('tr', [h('td.k', de ? 'Passagiere' : 'Passengers'), h('td', { colspan: 3 }, [h('div.paxgrid', pax.length ? pax.map((p, i) => h('div', `${i + 1}  ${p.name || (de ? '[Name]' : '[name]')}`)) : [h('div.muted', de ? 'keine Passagiere' : 'no passengers')]), h('div.mini', `${pax.length} Pax ${de ? 'gemäss Passagierliste/Beförderungsschein' : 'as per passenger list/title of transport'} ${b.no || ''}${mp?.r?.paxMass ? ` · ${de ? 'Gesamtmasse Insassen' : 'total persons mass'} ${Math.round(mp.r.paxMass)} kg` : ''} · ${personsOnBoard(b)} ${de ? 'Personen an Bord' : 'persons on board'}`)])]),
    ])),
    h('div.dsec', de ? 'Rahmenbedingungen und Auflagen' : 'Conditions and requirements'),
    h('table.dtab', h('tbody', [
      h('tr', [h('td.k', de ? 'Fahrtabsicht' : 'Flight intent'), h('td', { colspan: 3 }, [`${de ? 'Höhenband' : 'altitude band'} ${b.intent.altMinFt}–${b.intent.altMaxFt} ft AMSL · ${b.flight.nvfr ? 'NVFR' : 'VFR ' + (de ? 'Tag' : 'day')} · NVFR: `, box(!!b.flight.nvfr), de ? ' ja ' : ' yes ', box(!b.flight.nvfr), de ? ' nein' : ' no', b.balloon?.type === 'gas' ? ` · ${de ? 'Ballast' : 'ballast'} ${mp?.r?.ballast != null ? Math.round(mp.r.ballast) + ' kg' : '–'}` : cyl ? ` · ${de ? 'Gasvorrat' : 'fuel'} ${cyl}` : '', b.intent.remark ? ` · ${b.intent.remark}` : ''])]),
      h('tr', [h('td.k', de ? 'Wetter (Briefing)' : 'Weather (briefing)'), h('td', { colspan: 3 }, [gng.level != null ? h('span.dot', { class: gng.level === 2 ? 'ok' : gng.level === 1 ? 'half' : 'neg' }) : null, ' ', h('b', gng.level == null ? (de ? 'keine Modellauswertung' : 'no model evaluation') : gng.level === 2 ? 'GO' : gng.level === 1 ? (de ? 'GRENZWERTIG' : 'MARGINAL') : 'NO-GO'), gng.maxWindKt != null ? ` · ${de ? 'Wind bis' : 'wind up to'} ${gng.maxWindKt} kt, ${de ? 'Böen' : 'gusts'} ${gng.maxGustKt} kt (${gng.model || ''})` : '', gng.reasons?.length ? ` · ${gng.reasons.join('; ')}` : '', S.goNoGo?.meanWindKt ? ` · ${de ? 'Mindestbedingungen' : 'minima'}: ${de ? 'Mittelwind' : 'mean wind'} ≤ ${S.goNoGo.meanWindKt} kt${S.goNoGo.gustKt ? `, ${de ? 'Böen' : 'gusts'} ≤ ${S.goNoGo.gustKt} kt` : ''}` : ''])]),
      h('tr', [h('td.k', de ? 'Luftraum · NOTAM' : 'Airspace · NOTAM'), h('td', { colspan: 3 }, de ? 'Lufträume gemäss Briefing (C01) · DABS und NOTAM vor dem Start prüfen (PIC) · XPDR Mode S ab Start eingeschaltet, Squawk 7000 · ACL' : 'Airspace as per briefing (C01) · check DABS and NOTAM before launch (PIC) · XPDR Mode S on from launch, squawk 7000 · ACL')]),
      h('tr', [h('td.k', de ? 'Auflagen' : 'Requirements'), h('td', { colspan: 3 }, de ? 'Fahrt nur bei VMC · Pax-Einweisung und Beförderungsschein vor dem Start · Meldung Start/Landung an Rückholer (APRS/Tracking aktiv)' : 'Flight only in VMC · passenger briefing and title of transport before launch · report launch/landing to retrieve crew (APRS/tracking active)')]),
    ])),
    h('div.dsec', de ? 'Erteilung und Annahme' : 'Assignment and acceptance'),
    h('div.dtext', de ? `Der Betreiber erteilt dem PIC den Auftrag, die Fahrt im Rahmen der obigen Bedingungen und gemäss Betriebshandbuch (BHB) durchzuführen. Der PIC bestätigt mit seiner Unterschrift, dass er das Briefing${b.finalNo ? ` (Final v${b.finalNo})` : ''} zur Kenntnis genommen hat, die Fahrt unter den genannten Bedingungen verantwortlich übernimmt und die Entscheidung über Start und Abbruch bei ihm liegt (BOP.BAS.025).` : `The operator assigns the PIC to conduct the flight within the conditions above and in accordance with the operations manual. By signing, the PIC confirms having taken note of the briefing${b.finalNo ? ` (final v${b.finalNo})` : ''}, assumes responsibility for the flight under the stated conditions and retains the decision on launch and abort (BOP.BAS.025).`),
    h('div.sigrow', [sigBlock(sigs.opSig, de ? 'Betreiber (Wicki Aero GmbH)' : 'Operator (Wicki Aero GmbH)'), sigBlock(sigs.picSig, de ? 'Annahme PIC' : 'Acceptance PIC')]),
    h('div.dfoot', [h('span', `v1 | 12.10.2026 | EASA BOP.BAS.025 · ${t('doc_from')} ${b.no || ''} ${b.finalNo ? `Final v${b.finalNo}` : ''} · ops.wicki.aero`), h('span', '1 | 1')]),
  ]);
  return h('div.docpages', [page]);
}

// ---------------------------------------------------------------- Seiten
/** Druckseite mit Kopfzeile, Signieren (Eigner, Server-Modus) und PDF-Erzeugung. */
export async function renderDoc(view, ctx, id, kind, opts = {}) {
  const b = upgradeBriefing(opts.briefing || await ctx.store.getBriefing(id));
  if (!b) { view.appendChild(h('div.err', 'not found')); return; }
  const z = b.site.tz || 'Europe/Zurich', lang = getLang();
  const own = !ctx.shared && b.access !== 'read';
  const back = ctx.shared?.material ? `#/m/${ctx.shared.token}/${b.id}` : ctx.shared ? `#/s/${ctx.shared.token}/v` : `#/v/${b.id}`;
  const title = kind === 'bs' ? t('doc_bs') : t('doc_fa');
  const tools = [h('button.btn', { type: 'button', onclick: () => ctx.navigate(back) }, '← ' + t('view_brief'))];
  const redraw = () => { const old = view.querySelector('.docpages'); const nu = kind === 'bs' ? bsSheet(b, ctx) : faSheet(b, ctx); if (old) old.replaceWith(nu); else view.appendChild(nu); };
  const sign = async (role) => {
    const sig = ctx.settings.signature;
    if (!sig?.url) { toast(t('doc_noSig')); return; }
    const ok = await confirmDialog(t('doc_signTitle'), t('doc_signQ', { role: role === 'op' ? t('doc_roleOp') : t('doc_rolePic'), name: ctx.user?.name || '' }), { yes: t('doc_signYes'), no: t('cancel') });
    if (!ok) return;
    b.docs = b.docs || {}; b.docs[kind] = b.docs[kind] || {};
    b.docs[kind][role === 'op' ? 'opSig' : 'picSig'] = { name: ctx.user?.name || ctx.who || '', ts: Date.now(), url: sig.url, user: ctx.user?.id || '' };
    try { await ctx.store.saveBriefing(b, ctx.who); toast(t('doc_signed') + ' ✓'); redraw(); } catch (e) { toast(`${t('error')}: ${e.message}`); }
  };
  const pdfBtn = h('button.btn', { type: 'button', onclick: async () => {
    pdfBtn.disabled = true; pdfBtn.textContent = t('pdf_rendering');
    try { const j = await ctx.store.data('pdf', { b: b.id, doc: kind }, null, { id: b.id, doc: kind }); b.docs = b.docs || {}; b.docs[kind] = b.docs[kind] || {}; b.docs[kind].pdfUrl = ctx.store.apiBase + j.url; b.docs[kind].pdfTs = Date.now(); await ctx.store.saveBriefing(b, ctx.who); window.open(ctx.store.apiBase + j.url, '_blank'); toast(t('pdf_stored')); }
    catch (e) { toast(`${t('error')}: ${e.message}`); }
    pdfBtn.disabled = false; pdfBtn.textContent = t('doc_pdf');
  } }, t('doc_pdf'));
  if (own && ctx.store.mode === 'remote') {
    if (kind === 'fa') tools.push(h('button.btn', { type: 'button', onclick: () => sign('op') }, t('doc_signOp')));
    tools.push(h('button.btn', { type: 'button', onclick: () => sign('pic') }, t('doc_signPic')), pdfBtn);
    if (b.docs?.[kind]?.pdfUrl) tools.push(h('a.btn', { href: b.docs[kind].pdfUrl, target: '_blank', rel: 'noopener' }, 'PDF ↗'));
  }
  tools.push(printButton(() => window.print()));
  setHeader({ title, sub: `${fmtDate(z, b.time.startMs, lang)} · ${placeLabel(b.site)} · ${b.no || ''}`, tools });
  if (own && kind === 'fa') { const pic = (ctx.settings.persons || []).find((p) => p.id === b.persons.picId); const pd = picDocs(pic); if (pd.medicalExpired) view.appendChild(h('div.note.neg', t('doc_medicalExpired', { d: fmtIso(pd.medicalTo) }))); }
  redraw();
  if (/print=1/.test(location.hash)) setTimeout(() => window.print(), 400);
}

/** Beim Login: abgelaufenes Medical eines PIC → Nachfrage nach der neuen Gültigkeit (Entscheid 12.10.2026). */
export async function medicalCheck(ctx) {
  const S = ctx.settings; if (!S?.persons || ctx.shared) return;
  for (const p of S.persons.filter((x) => (x.roles || []).includes('pic'))) {
    const pd = picDocs(p);
    if (!pd.medicalExpired) continue;
    const inp = h('input', { type: 'date', value: '' });
    const r = await dialog(t('doc_medTitle'), h('div', [h('p', t('doc_medText', { name: p.name, d: fmtIso(pd.medicalTo) })), inp]), [{ label: t('later'), value: false }, { label: t('save'), value: true, primary: true }]);
    if (r === true && inp.value) { pd.medicalDoc.validTo = inp.value; try { await ctx.store.saveSettings(S); toast(t('ok')); } catch (e) { toast(`${t('error')}: ${e.message}`); } }
  }
}
