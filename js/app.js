/* Fahrtbriefing — App-Hülle: Kennwortseite, Kopfzeile, Menü, Routing.
 *
 * Routen (Hash):
 *   #/list            Übersicht
 *   #/new             geführter Ablauf «Neues Briefing» (#/new/<id> = Entwurf fortsetzen)
 *   #/b/<id>          Erarbeitungssicht
 *   #/v/<id>          Briefingsicht (Druck)
 *   #/settings        Einstellungen
 *   #/s/<token>       Persönlicher Link (Lesen oder Mitarbeit, ohne Kennwort)
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

const GATE_IDLE_MS = 2 * 60 * 60 * 1000;

export const ctx = {
  settings: null, racDefault: null, store, lang: 'de',
  get racTable() { return this.settings?.rac?.custom || this.racDefault; },
  get who() { return this.shared?.person || this.settings?.ownerName || 'Owner'; },
  shared: null, // { token, role, person } bei persönlichem Link
  navigate: (hash) => { location.hash = hash; },
  async saveSettings(s) { this.settings = s; await store.saveSettings(s); applyPrefs(); },
};

// ---------------------------------------------------------------- Kopfzeile
export function setHeader({ title, sub, tools = [], eyebrow } = {}) {
  $('title').textContent = title || t('appName');
  $('eyebrow').textContent = eyebrow || t('eyebrow');
  const subEl = $('subtitle'); clear(subEl);
  if (sub) subEl.appendChild(typeof sub === 'string' ? document.createTextNode(sub) : sub);
  const tl = $('tools'); clear(tl);
  for (const b of tools) tl.appendChild(b);
}

/** Hauptnavigation: Briefings · Neu · Einstellungen — immer sichtbar (nicht für Link-Nutzer). */
function buildNav() {
  const n = $('mainnav'); if (!n) return; clear(n);
  if (ctx.shared || !store.isAuthed()) { n.hidden = true; return; }
  n.hidden = false;
  const cur = (location.hash || '#/list').split('?')[0].split('/')[1] || 'list';
  const items = [['list', t('nav_list'), '#/list'], ['new', t('nav_new'), '#/new'], ['settings', t('nav_settings'), '#/settings']];
  for (const [key, label, href] of items) {
    const active = cur === key || (key === 'list' && ['b', 'v', 'pax'].includes(cur));
    n.appendChild(h('a', { href, class: active ? 'on' : '', 'aria-current': active ? 'page' : null }, key === 'new' ? `+ ${label}` : label));
  }
}

function buildMenu() {
  const m = $('menu'); clear(m);
  const item = (label, fn) => m.appendChild(h('button', { type: 'button', onclick: () => { m.classList.add('hidden'); fn(); } }, label));
  if (!ctx.shared) {
    item(t('nav_list'), () => ctx.navigate('#/list'));
    item(t('nav_new'), () => ctx.navigate('#/new'));
    item(t('nav_settings'), () => ctx.navigate('#/settings'));
    m.appendChild(h('div.sep'));
  }
  item(t('nav_theme'), () => { applyTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark', true); });
  item(t('nav_lang'), () => { setLang(getLang() === 'de' ? 'en' : 'de'); save('fb.lang', getLang()); buildMenu(); route(); });
  m.appendChild(h('div.sep'));
  item(t('nav_about'), () => dialog(t('nav_about'), h('div.note', [h('p', `${APP.name} ${APP.version} · ${APP.date}`), h('p', t('about')), h('p', [h('a', { href: APP.repo, target: '_blank', rel: 'noopener' }, APP.repo)])]), [{ label: t('close'), primary: true }]));
  if (!ctx.shared) item(t('nav_lock'), () => lock());
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
  setTimeout(() => $('gatePw').focus(), 60);
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
  document.getElementById('menu').classList.add('hidden');
  buildNav();
  try {
    if (name === 's' && arg) { await renderShared(view, ctx, arg); return; }
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
  $('appVersion').onclick = () => toast(`${APP.name} ${APP.version} · ${APP.date}`);
  setLang(load('fb.lang', 'de'));
  applyTheme(load('fb.theme', 'light'));
  await store.init();
  const badge = $('modeBadge');
  if (store.mode === 'local') { badge.hidden = false; badge.textContent = t('localMode'); badge.classList.add('local'); }
  ctx.racDefault = await fetch('data/rac/rac-ch.json').then((r) => r.json()).catch(() => null);
  // PWA: Service Worker (App-Hülle offline, zuletzt geöffnete Briefings lesbar)
  if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js', { type: 'module' }).catch((e) => console.warn('sw', e));

  $('gateForm').onsubmit = async (e) => {
    e.preventDefault();
    const pw = $('gatePw').value.trim();
    $('gateOpen').disabled = true;
    try {
      const ok = await store.login(pw);
      if (ok) { $('gatePw').value = ''; $('gateErr').hidden = true; await afterLogin(); }
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
  if (hash.startsWith('#/s/')) { await route(); return; }
  if (store.isAuthed() && !store.idleExpired(GATE_IDLE_MS)) await afterLogin();
  else { if (store.isAuthed()) store.logout(); showGate(); }
}
main();
