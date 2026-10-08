/* Fahrtbriefing — App-Hülle: Kennwortseite, Kopfzeile, Menü, Routing.
 *
 * Routen (Hash):
 *   #/list            Übersicht
 *   #/new             geführter Ablauf «Neues Briefing» (#/new/<id> = Entwurf fortsetzen)
 *   #/b/<id>          Erarbeitungssicht
 *   #/v/<id>          Briefingsicht (Druck)
 *   #/settings        Einstellungen
 *   #/s/<token>       Persönlicher Link (Lesen oder Mitarbeit, ohne Kennwort)
 *   #/m/<token>       Material-Link (externer Materialeigner: Liste + Briefingsicht, ohne Kennwort)
 */
import { APP } from './version.js';
import { $, h, clear, toast, load, save, dialog } from './util.js';
import { t, setLang, getLang } from './i18n.js';
import { store } from './store.js';
import { renderList } from './ui/list.js';
import { renderWizard } from './ui/wizard.js';
import { renderEditor } from './ui/editor.js';
import { renderBrief } from './ui/view.js';
import { renderSettings } from './ui/settings.js';
import { renderPaxCard } from './ui/extras.js';
import { renderShared } from './ui/shared.js';
import { renderMaterial } from './ui/material.js';
import { mergedStamm } from './stamm.js';
import { icon, iconSvg } from './ui/icons.js';
import { loadGaforAreas, loadCountries } from './auto/data.js';

const GATE_IDLE_MS = 2 * 60 * 60 * 1000;

export const ctx = {
  settings: null, racDefault: null, store, lang: 'de',
  get racTable() { return this.settings?.rac?.custom || this.racDefault; },
  get who() { return this.shared?.person || this.user?.name || this.settings?.ownerName || 'Owner'; },
  shared: null, // { token, role, person } bei persönlichem Link
  user: null,   // { id, name, role, flags } angemeldeter Benutzer (Super/Master)
  sharedStamm: [], given: [], // von anderen freigegebener Stamm; eigene Freigaben
  get isSuper() { return this.user?.role === 'super'; },
  /** Freischaltung (ai, notam, pdf): Super immer; Link-Nutzer erben die des Eigners (Worker prüft). */
  can(flag) { return !this.user || this.user.role === 'super' || this.user.flags?.[flag] !== false; },
  /** Eigener Stamm + freigegebene Teile — für Auswahlfelder (nie zum Speichern). */
  get stamm() { if (!this._stamm) this._stamm = mergedStamm(this.settings || {}, this.sharedStamm); return this._stamm; },
  _stamm: null,
  navigate: (hash) => { location.hash = hash; },
  async saveSettings(s) { this.settings = s; this._stamm = null; await store.saveSettings(s); applyPrefs(); },
};

// ---------------------------------------------------------------- Kopfzeile
export function setHeader({ title, sub, tools = [], eyebrow, menu = [] } = {}) {
  $('title').textContent = title || t('appName');
  $('eyebrow').textContent = eyebrow || t('eyebrow');
  const subEl = $('subtitle'); clear(subEl);
  if (sub) subEl.appendChild(typeof sub === 'string' ? document.createTextNode(sub) : sub);
  const tl = $('tools'); clear(tl);
  for (const b of tools) tl.appendChild(b);
  ctx.pageMenu = menu;   // seitenspezifische Untermenüs im Hamburger (z. B. Berechtigungen, Mehr)
  buildMenu();
}
/** Druck-Symbolknopf für die Kopfzeile (rechts von «Freigeben», links vom Hamburger). */
export const printButton = (onclick) => h('button.btn.icon.print', { type: 'button', title: t('print'), 'aria-label': t('print'), onclick }, icon('print', 20));

/** Hauptnavigation: Briefings · Neu · Einstellungen — immer sichtbar (nicht für Link-Nutzer). */
function buildNav() {
  const n = $('mainnav'); if (!n) return; clear(n);
  if (ctx.shared || !store.isAuthed()) { n.hidden = true; return; }
  n.hidden = false;
  const cur = (location.hash || '#/list').split('?')[0].split('/')[1] || 'list';
  const items = [['list', t('nav_list'), '#/list'], ['new', t('nav_new'), '#/new']];   // Einstellungen: im Hamburger-Menü
  for (const [key, label, href] of items) {
    const active = cur === key || (key === 'list' && ['b', 'v', 'pax'].includes(cur));
    n.appendChild(h('a', { href, class: key === 'new' ? 'primary' : active ? 'on' : '', 'aria-current': active ? 'page' : null }, key === 'new' ? `+ ${label}` : label));
  }
}

function buildMenu() {
  const m = $('menu'); if (!m) return;
  // offene Untermenüs über einen Neuaufbau hinweg behalten (Autosave baut die Kopfzeile neu, während das Menü offen ist)
  const wasOpen = new Set([...m.querySelectorAll('details.submenu[open] summary')].map((x) => x.textContent));
  clear(m);
  const item = (label, fn, parent = m) => parent.appendChild(h('button', { type: 'button', onclick: () => { m.classList.add('hidden'); fn(); } }, label));
  const sub = (label, items, open = false) => { const d = h('details.submenu', { open: open || wasOpen.has(label) }, [h('summary', label)]); for (const it of items) if (it) item(it.label, it.fn, d); m.appendChild(d); };
  // seitenspezifische Untermenüs (Berechtigungen, Mehr …)
  for (const g of ctx.pageMenu || []) if (g.items?.length) sub(g.label, g.items, !!g.open);
  if ((ctx.pageMenu || []).length) m.appendChild(h('div.sep'));
  if (!ctx.shared && store.isAuthed()) {
    // JSON: Einstellungen exportieren / importieren (über «Einstellungen»)
    sub('JSON', [{ label: t('set_import'), fn: importSettingsJson }, { label: t('set_export'), fn: exportSettingsJson }]);
    const sects = ['general', 'balloons', 'persons', 'operators', 'sites', 'intent', 'schedule', 'fpl', 'meteo', 'panels', 'links', 'users', 'access', 'expert'];
    sub(t('nav_settings'), sects.map((k) => ({ label: t('set_' + k), fn: () => { if (!location.hash.startsWith('#/settings')) ctx.settingsReturn = location.hash || '#/list'; ctx.navigate('#/settings?' + k); } })));
    m.appendChild(h('div.sep'));
  }
  item(t('nav_theme'), () => { applyTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark', true); });
  item(t('nav_lang'), () => { setLang(getLang() === 'de' ? 'en' : 'de'); save('fb.lang', getLang()); buildMenu(); route(); });
  m.appendChild(h('div.sep'));
  if (ctx.user && !ctx.shared && store.mode === 'remote') { m.appendChild(h('div.menu-user', `${ctx.user.name} · ${ctx.user.id} · ${t(ctx.user.role === 'super' ? 'role_super' : 'role_master')}`)); m.appendChild(h('div.sep')); }
  item(t('nav_demo'), () => window.open('demo/', '_blank', 'noopener'));   // Einführungsfilme (0.12.2)
  item(t('nav_about'), () => dialog(t('nav_about'), h('div.note', [h('p', `${APP.name} ${APP.version} · ${APP.date}`), h('p', t('about')), h('p', [h('a', { href: APP.repo, target: '_blank', rel: 'noopener' }, APP.repo)])]), [{ label: t('close'), primary: true }]));
  if (!ctx.shared) item(t('nav_lock'), () => lock());
}

/** Einstellungen als JSON-Datei sichern / aus Datei einlesen (zusammenführen, speichern, Seite neu zeichnen). */
export function exportSettingsJson() {
  const a = document.createElement('a'); a.href = 'data:application/json,' + encodeURIComponent(JSON.stringify(ctx.settings, null, 2)); a.download = `briefing-settings-${new Date().toISOString().slice(0, 10)}.json`; a.click();
}
export function importSettingsJson() {
  const inp = h('input', { type: 'file', accept: 'application/json', style: { display: 'none' }, onchange: async (e) => {
    try { const txt = await e.target.files[0].text(); const j = JSON.parse(txt); if (!j || typeof j !== 'object') throw new Error('JSON'); await ctx.saveSettings({ ...ctx.settings, ...j }); toast(t('set_saved')); route(); }
    catch (err) { toast(`${t('error')}: ${err.message}`); }
    finally { inp.remove(); }
  } });
  document.body.appendChild(inp); inp.click();
}

function applyTheme(th, persist) {
  document.documentElement.dataset.theme = th;
  document.querySelector('meta[name=theme-color]')?.setAttribute('content', th === 'dark' ? '#0b1017' : '#f4f5f7');
  if (persist) save('fb.theme', th);
}
function applyPrefs() {
  applyTheme(load('fb.theme', ctx.settings?.theme || 'light'));
  setLang(load('fb.lang', ctx.settings?.lang || 'de'));
}

// ---------------------------------------------------------------- Sperre
function showGate(hint) {
  const g = $('gate'); g.hidden = false;
  $('gateTitle').textContent = t('gateTitle'); $('gateText').innerHTML = t('gateText'); $('gateOpen').textContent = t('gateOpen'); $('gateErr').textContent = t('gateErr');
  $('gateNote').textContent = store.mode === 'local' ? t('gateLocalNote') : '';
  const hintEl = $('gateHint'); hintEl.hidden = !hint; hintEl.textContent = hint || '';
  const u = $('gateUser'); u.hidden = store.mode === 'local'; u.placeholder = t('gateUser'); $('gatePw').placeholder = t('gatePw');
  if (!u.value) u.value = store.lastUser();
  setTimeout(() => (store.mode !== 'local' && !u.value ? u : $('gatePw')).focus(), 60);
}
function hideGate() { $('gate').hidden = true; }
function lock() { store.logout(); showGate(); }
let idleTimer = null;
function touchGate() {
  store.touch();
  clearTimeout(idleTimer);
  idleTimer = setTimeout(() => { if (!ctx.shared) lock(); }, GATE_IDLE_MS);
}

async function afterLogin() {
  hideGate();
  ctx.settings = await store.getSettings();
  try { const me = await store.me(); ctx.user = me.user; ctx.sharedStamm = me.shared || []; ctx.given = me.given || []; ctx._stamm = null; }
  catch (e) { if (e.status === 401) { showGate(); return; } console.warn('me', e); ctx.user = store.cachedUser(); }
  applyPrefs();
  buildMenu();
  touchGate();
  route();
}

// ---------------------------------------------------------------- Routing
async function route() {
  const view = $('view'); clear(view);
  const hash = (location.hash || '#/list').split('?')[0];
  const [, name, ...rest] = hash.split('/');
  const arg = rest.join('/') || undefined;
  // 0.12.10: Nachtrag-Flag erlischt, sobald die Erarbeitung des Briefings verlassen wird (nächstes Öffnen = neuer Nachtrag)
  try { for (const k of Object.keys(sessionStorage)) if (k.startsWith('fb.amend.') && !(name === 'b' && arg === k.slice(9))) sessionStorage.removeItem(k); } catch { /* ohne Sitzungsspeicher */ }
  document.getElementById('menu').classList.add('hidden');
  buildNav();
  try {
    if (name === 's' && arg) { await renderShared(view, ctx, arg); return; }
    if (name === 'm' && arg) { await renderMaterial(view, ctx, arg); return; }
    if (!store.isAuthed() && !ctx.shared) { showGate(); return; }
    buildNav();
    if (!ctx.settings) ctx.settings = await store.getSettings();
    switch (name) {
      case 'new': await renderWizard(view, ctx, arg || null); break;
      case 'b': await renderEditor(view, ctx, arg); break;
      case 'v': await renderBrief(view, ctx, arg); break;
      case 'settings': await renderSettings(view, ctx); break;
      case 'pax': await renderPaxCard(view, ctx, arg); break;
      default: await renderList(view, ctx);
    }
  } catch (e) {
    console.error(e);
    if (e.status === 401) { showGate(); return; }
    view.appendChild(h('div.card', [h('div.card-body', [h('div.err', `${t('error')}: ${e.message}`)])]));
  }
  window.scrollTo(0, 0);
}

// ---------------------------------------------------------------- Start
async function main() {
  $('appVersion').textContent = APP.version;
  if ($('gateVer')) $('gateVer').textContent = `${APP.name} ${APP.version}`;   // 0.12.6: Version auf der Anmeldeseite
  // Höhe der Kopfzeile als CSS-Variable (haftende Zeile «Daten aktualisieren / Pflichtinhalte» darunter, 0.12.2)
  const topbar = $('topbar'); const setTop = () => document.documentElement.style.setProperty('--topbar-h', topbar.offsetHeight + 'px');
  setTop(); if (window.ResizeObserver) new ResizeObserver(setTop).observe(topbar); window.addEventListener('resize', setTop);
  $('appVersion').onclick = () => toast(`${APP.name} ${APP.version} · ${APP.date}`);
  setLang(load('fb.lang', 'de'));
  applyTheme(load('fb.theme', 'light'));
  await store.init();
  const badge = $('modeBadge');
  if (store.mode === 'local') { badge.hidden = false; badge.textContent = t('localMode'); badge.classList.add('local'); }
  ctx.racDefault = await fetch('data/rac/rac-ch.json').then((r) => r.json()).catch(() => null);
  // PWA: Service Worker (App-Hülle offline, zuletzt geöffnete Briefings lesbar)
  loadGaforAreas().catch(() => null);   // 0.12.10: GAFOR-Gebiete (Deutschland-Rückfall für countryGuess)
  await Promise.race([loadCountries().catch(() => null), new Promise((r) => setTimeout(r, 2500))]);   // 0.12.10a: präzise Landesgrenzen vor der ersten Sicht (max. 2.5 s warten)
  if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js', { type: 'module' }).catch((e) => console.warn('sw', e));

  $('gateForm').onsubmit = async (e) => {
    e.preventDefault();
    const pw = $('gatePw').value.trim();
    const user = $('gateUser').value.trim().toLowerCase();
    $('gateOpen').disabled = true;
    try {
      const ok = await store.login(user, pw);
      // nach der Anmeldung immer die Übersicht «Meine Briefings» (0.12.2); Freigabe-Links (#/s, #/m) bleiben
      if (ok) { $('gatePw').value = ''; $('gateErr').hidden = true; if (!/^#\/(s|m)\//.test(location.hash)) history.replaceState(null, '', location.pathname + location.search + '#/list'); await afterLogin(); }
      else { $('gateErr').hidden = false; $('gatePw').value = ''; $('gatePw').focus(); }
    } catch (err) { $('gateErr').hidden = false; $('gateErr').textContent = `${t('error')}: ${err.message}`; }
    finally { $('gateOpen').disabled = false; }
  };
  $('menuBtn').onclick = (e) => { e.stopPropagation(); $('menu').classList.toggle('hidden'); };
  document.addEventListener('click', (e) => { if (!e.target.closest('#menu') && !e.target.closest('#menuBtn')) $('menu').classList.add('hidden'); });
  ['pointerdown', 'keydown'].forEach((ev) => document.addEventListener(ev, () => { if (store.isAuthed() && !$('gate').hidden === false) touchGate(); }, { passive: true }));
  document.addEventListener('visibilitychange', () => { if (!document.hidden && store.isAuthed() && store.idleExpired(GATE_IDLE_MS) && !ctx.shared) lock(); });
  window.addEventListener('hashchange', route);

  buildMenu();
  const hash = location.hash || '';
  if (hash.startsWith('#/s/') || hash.startsWith('#/m/')) { await route(); return; }
  if (store.isAuthed() && !store.idleExpired(GATE_IDLE_MS)) { ctx.user = store.cachedUser(); await afterLogin(); }
  else { if (store.isAuthed()) store.logout(); showGate(); }
}
main();
