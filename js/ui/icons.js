/* Fahrtbriefing — Symbolsatz «Linie» (0.11.3): einheitliche SVG-Symbole (24 × 24, Strich 2 px, runde Enden)
 * statt Emoji/Unicode – gleich auf Windows, iPad, im Druck. icon(name) liefert ein <svg>, iconSvg(name) den Markup. */

const P = {
  menu: 'M4 7h16M4 12h16M4 17h16',
  print: 'M7 9V4h10v5 M4 9h16a1 1 0 0 1 1 1v6h-4v4H7v-4H3v-6a1 1 0 0 1 1-1z M7 15h10v5H7z',
  edit: 'M4 20l4-1L19 8l-3-3L5 16z M14 7l3 3',
  view: 'M2 12c3-6 17-6 20 0c-3 6-17 6-20 0z M12 12m-3 0a3 3 0 1 0 6 0a3 3 0 1 0-6 0',
  dup: 'M8 8h12v12H8z M4 16V4h12',
  del: 'M4 7h16 M9 7V4h6v3 M6 7l1 13h10l1-13z M10 11v6M14 11v6',
  text: 'M6 3h8l4 4v14H6z M14 3v4h4 M9 12h6M9 16h6 M18 15v6M15 18h6',
  comment: 'M4 5h16v11h-8l-4 4v-4H4z M8 9h8M8 12h5',
  ai: 'M12 3l2 6 6 2-6 2-2 6-2-6-6-2 6-2z M19 15l1 2 2 1-2 1-1 2-1-2-2-1 2-1z',
  refresh: 'M20 12a8 8 0 1 1-2.3-5.7 M20 4v5h-5',
  close: 'M6 6l12 12M18 6L6 18',
  check: 'M4 12l5 5L20 6',
  warn: 'M12 3l10 18H2z M12 10v5M12 18v.5',
  lock: 'M6 11h12v10H6z M8 11V7a4 4 0 0 1 8 0v4 M12 15v3',
  link: 'M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1.5 1.5 M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1.5-1.5',
  place: 'M12 22s7-7 7-12a7 7 0 0 0-14 0c0 5 7 12 7 12z M12 10m-2.5 0a2.5 2.5 0 1 0 5 0a2.5 2.5 0 1 0-5 0',
  ext: 'M14 4h6v6M20 4L10 14 M18 13v7H4V6h7',
  night: 'M21 13A9 9 0 1 1 11 3a7 7 0 0 0 10 10z',
  more: 'M6 12h.01M12 12h.01M18 12h.01',
  map: 'M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2z M9 4v14 M15 6v14',   // 0.12.8: Kartenfenster (NOTAM)
  plus: 'M12 5v14M5 12h14',
  grid: 'M4 4h5v5H4zM10 4h5v5h-5zM16 4h4v5h-4zM4 10h5v5H4zM10 10h5v5h-5zM16 10h4v5h-4zM4 16h5v4H4zM10 16h5v4h-5zM16 16h4v4h-4z',
  sort: 'M8 9l4-4 4 4M8 15l4 4 4-4',
  up: 'M6 15l6-6 6 6',
  down: 'M6 9l6 6 6-6',
  grip: 'M9 5h.01M15 5h.01M9 12h.01M15 12h.01M9 19h.01M15 19h.01',
  back: 'M15 18l-6-6 6-6',
};

/** SVG-Markup eines Symbols (für innerHTML, Leaflet-Controls, Druck). */
export function iconSvg(name, size = 18) {
  const d = P[name] || P.more;
  const dots = name === 'more' || name === 'grip';
  return `<svg class="ico ico-${name}" viewBox="0 0 24 24" width="${size}" height="${size}" aria-hidden="true" focusable="false"><path d="${d}" fill="none" stroke="currentColor" stroke-width="${dots ? 3.5 : 2}" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
}

/** SVG-Element eines Symbols. */
export function icon(name, size = 18) {
  const tpl = document.createElement('template');
  tpl.innerHTML = iconSvg(name, size);
  return tpl.content.firstChild;
}

export const ICON_NAMES = Object.keys(P);
