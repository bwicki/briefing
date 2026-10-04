/* Fahrtbriefing — KI-Hinweis je Panel: Prompt aus Fahrtkontext und Panel-Inhalt,
 * Aufruf über den Worker (Schlüssel bleibt dort). Pax-Namen werden nicht
 * übermittelt. Antwort: 2–5 Zeilen Besonderheiten/kritische Punkte, keine
 * Startempfehlung. */
import { tt, getLang } from '../i18n.js';
import { hhmm, fmtDate, fmtDur } from '../calc/time.js';
import { sunFor } from '../model.js';
import { visiblePanels } from '../panels.js';

export function flightContext(b, ctx) {
  const z = b.site.tz || 'Europe/Zurich', lang = getLang();
  const sun = sunFor(b, ctx.settings, ctx.racTable);
  const g = ctx.settings.goNoGo || {};
  const L = ctx.settings.flyLimits || {};
  return [
    `Ballon: ${b.balloon.label} (${b.balloon.type === 'gas' ? 'Gasballon' : 'Heissluftballon'}, ${b.balloon.volume} m³)`,
    `Startort: ${b.site.name} ${b.site.icao} ${b.site.elev ?? '?'} m AMSL, Land ${b.site.country || '?'}`,
    `Start: ${fmtDate(z, b.time.startMs, lang)} ${hhmm(z, b.time.startMs)} LT (${hhmm('UTC', b.time.startMs)} UTC), Dauer ${fmtDur(b.intent.durationMin)}, Höhenband ${b.intent.altMinFt}–${b.intent.altMaxFt} ft, Richtung ${b.intent.direction || '–'}${b.landing?.lat != null ? `, geplanter Landeraum ${b.landing.name} ${b.landing.icao}` : ''}`,
    sun ? `Sonne: BCMT ${hhmm(z, sun.official.bcmt)} SR ${hhmm(z, sun.official.sr)} SS ${hhmm(z, sun.official.ss)} ECET ${hhmm(z, sun.official.ecet)} LT` : '',
    `Kriterien: Bodenwind grenzwertig ab ${L.wind?.[0] ?? 4} m/s, nein ab ${L.wind?.[1] ?? 6} m/s; Böen ${L.gust?.[0] ?? 6}/${L.gust?.[1] ?? 8} m/s; CAPE ${L.cape?.[0] ?? 300}/${L.cape?.[1] ?? 800} J/kg; Trockenfenster ≥ ${g.dryWindowH ?? 3} h; kein Gewitter innert ${g.noTsH ?? 3} h`,
    `Fahrtart: ${b.flight.kind}, Pax: ${b.persons.pax.length}`,
  ].filter(Boolean).join('\n');
}

const SYSTEM = {
  de: `Du bist Meteorologe und Ballonfahrt-Ausbilder und unterstützt einen erfahrenen Ballonpiloten bei der Fahrtvorbereitung. Du bekommst den Fahrtkontext und den Inhalt eines Briefing-Panels (Modelldaten, amtliche Produkte, eingefügte Texte oder Bilder). Antworte auf Deutsch (Schweiz, kein ß) in 2–6 knappen Zeilen als Aufzählung mit «–»: Besonderheiten, kritische Punkte, Abweichungen von den Kriterien, ballonfahrtspezifische Warnungen und Hinweise, was zu beobachten ist. Nenne Zahlen mit Einheit und Zeit (LT). Keine Startempfehlung, keine Floskeln, keine Wiederholung des Kontexts. Wenn die Daten für eine Aussage nicht reichen, sag das in einer Zeile.`,
  en: `You are a meteorologist and balloon flight instructor supporting an experienced balloon pilot in flight preparation. You receive the flight context and the content of one briefing panel (model data, official products, pasted text or images). Answer in English in 2–6 terse lines as a list with "–": particulars, critical points, deviations from the criteria, balloon-specific warnings and hints, what to watch. Give numbers with units and time (LT). No go/no-go recommendation, no filler, do not repeat the context. If the data is insufficient, say so in one line.`,
};

/** Gesamtlage aus den übrigen Panels (gekürzt): Schnappschuss-Texte, eingefügte Texte, Zusatzinfos – als Kontext,
 *  damit der Kommentar zu einem Panel die Lage des ganzen Briefings kennt. Budget ca. 7000 Zeichen. */
export function briefingOverview(b, ctx, exceptKey, budget = 7000) {
  const lines = [];
  let used = 0;
  for (const p of visiblePanels(ctx.settings, b)) {
    if (p.key === exceptKey) continue;
    const d = b.panels?.[p.key]; if (!d) continue;
    const bits = [];
    if (d.content?.auto?.text) bits.push(d.content.auto.text);
    if (d.content?.text) bits.push(d.content.text);
    if (d.extra?.text) bits.push(`Zusatzinfo: ${d.extra.text}`);
    if (d.comment) bits.push(`Pilotenkommentar: ${d.comment}`);
    if (d.ai?.text) bits.push(`Bisheriger KI-Kommentar: ${d.ai.text}`);
    if (!bits.length) continue;
    const txt = bits.join(' | ').replace(/\s+/g, ' ').slice(0, 700);
    if (used + txt.length > budget) break;
    used += txt.length;
    lines.push(`• ${tt(p)}: ${txt}`);
  }
  return lines.join('\n');
}

/** Prompt für ein Panel. Bilder: nur serverseitig abgelegte (/files/…). */
export function panelPrompt(p, d, b, ctx) {
  const lang = getLang();
  const parts = [`PANEL: ${tt(p)} (${p.key})`, '', 'FAHRTKONTEXT:', flightContext(b, ctx), ''];
  const auto = d.content?.auto;
  if (auto?.text) parts.push(`AUTOMATISCHE DATEN (${auto.source || ''}${auto.modelName ? ', ' + auto.modelName : ''}):`, auto.text.slice(0, 12000), '');
  if (d.content?.text) parts.push('EINGEFÜGTER TEXT:', d.content.text.slice(0, 8000), '');
  if (d.extra?.text) parts.push('ZUSATZINFO (PILOT):', d.extra.text.slice(0, 4000), '');
  if (d.comment) parts.push('KOMMENTAR (PILOT):', d.comment.slice(0, 2000), '');
  const images = [].concat(auto?.images || [], d.content?.images || [], d.extra?.images || []).map((i) => i.url).filter((u) => /\/files\//.test(u)).slice(0, 6);
  if (images.length) parts.push(`${images.length} BILD(ER) beigefügt — lies sie aus (Karten, Tabellen, Screenshots).`, '');
  const overview = briefingOverview(b, ctx, p.key);
  if (overview) parts.push('GESAMTLAGE (übrige Panels, gekürzt – nur als Kontext, nicht kommentieren):', overview, '');
  parts.push(lang === 'en'
    ? `Comment on the panel "${tt(p)}": particulars of this information and balloon-specific warnings/hints, taking the overall situation into account but staying on this panel's topic.`
    : `Kommentiere das Panel «${tt(p)}»: Besonderheiten dieser Informationen sowie ballonfahrtspezifische Warnungen und Hinweise – unter Berücksichtigung der Gesamtlage, aber mit Bezug auf das Thema dieses Panels.`);
  return { system: SYSTEM[lang] || SYSTEM.de, user: parts.join('\n'), images };
}

export async function aiHint(ctx, b, { system, prompt, images, model }) {
  return ctx.store.data('ai', { b: b.id }, ctx.shared?.token, { system, prompt, images, model: model || undefined });
}
