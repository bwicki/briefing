/* Fahrtbriefing — Datenhaltung.
 *
 * Zwei Adapter mit derselben Schnittstelle:
 *   remote  Cloudflare Worker (D1, R2) unter config.apiBase — Normalbetrieb.
 *   local   localStorage dieses Browsers — ohne Server, zum Ausprobieren und
 *           als Rückfall, wenn der Worker nicht erreichbar ist.
 * Die Oberfläche spricht nur `store`. Welche Variante aktiv ist, steht in
 * store.mode; Berechtigungs-Links und Zugänge gibt es nur remote.
 */
import { load, save, del, uid } from './util.js';
import { mergeSettings } from './defaults.js';

const cfg = (typeof window !== 'undefined' && window.BRIEFING_CONFIG) || {};
const API = (cfg.apiBase || '').replace(/\/$/, '');
const LS = { settings: 'fb.settings', briefings: 'fb.briefings', unlocked: 'fb.unlocked', pw: 'fb.localpw', token: 'fb.token', touch: 'fb.touch' };

// ----------------------------------------------------------------- local
const local = {
  mode: 'local',
  async health() { return true; },
  async login(pw) {
    const stored = load(LS.pw, '1234');
    if (pw !== stored) return false;
    save(LS.unlocked, 1); return true;
  },
  logout() { del(LS.unlocked); },
  isAuthed() { return load(LS.unlocked, 0) === 1; },
  async changePassword(oldPw, newPw) {
    if (oldPw !== load(LS.pw, '1234')) throw new Error('wrong');
    save(LS.pw, newPw); return true;
  },
  async getSettings() { return mergeSettings(load(LS.settings, null)); },
  async saveSettings(s) { save(LS.settings, s); return s; },
  async listBriefings() { return Object.values(load(LS.briefings, {})).map(summary).sort((a, b) => (a.startMs || 0) - (b.startMs || 0)); },
  async getBriefing(id) { const all = load(LS.briefings, {}); return all[id] || null; },
  async saveBriefing(b, who) {
    const all = load(LS.briefings, {});
    b.revision = (b.revision || 0) + 1; b.updatedAt = Date.now(); b.updatedBy = who || 'local';
    all[b.id] = b; save(LS.briefings, all); return b;
  },
  async deleteBriefing(id) { const all = load(LS.briefings, {}); delete all[id]; save(LS.briefings, all); },
  async uploadImage(briefingId, dataUrl) { return { url: dataUrl, key: uid(8) }; },
  async listAccess() { return []; },
  async createAccess() { throw new Error('local'); },
  async revokeAccess() { throw new Error('local'); },
  async listSecrets() { return {}; },
  async setSecret() { throw new Error('local'); },
  async deleteSecret() { throw new Error('local'); },
  async openShared() { throw new Error('local'); },
  async saveShared() { throw new Error('local'); },
  async getLog(id) { const b = await this.getBriefing(id); return b?.log || []; },
  /** Datenabrufe ohne Server: nur, was öffentlich und CORS-frei ist. */
  async data(kind, params = {}, shareToken, body = null) { const { localData } = await import('./net.js'); return localData(kind, { ...params, ...(body || {}) }); },
};

// ---------------------------------------------------------------- remote
function authHeaders() { const t = load(LS.token, null); return t ? { Authorization: `Bearer ${t}` } : {}; }
async function api(path, opts = {}) {
  const r = await fetch(API + path, {
    method: opts.method || 'GET',
    headers: { 'Content-Type': 'application/json', ...authHeaders(), ...(opts.headers || {}) },
    body: opts.body != null ? JSON.stringify(opts.body) : undefined,
  });
  if (r.status === 401) { del(LS.token); throw Object.assign(new Error('unauthorized'), { status: 401 }); }
  if (!r.ok) { let m = `HTTP ${r.status}`; try { m = (await r.json()).error || m; } catch { /* egal */ } throw Object.assign(new Error(m), { status: r.status }); }
  if (r.status === 204) return null;
  return r.json();
}

const remote = {
  mode: 'remote',
  async health() { try { const r = await fetch(API + '/api/health', { signal: AbortSignal.timeout(5000) }); return r.ok; } catch { return false; } },
  async login(pw) {
    try { const j = await api('/api/session', { method: 'POST', body: { password: pw } }); save(LS.token, j.token); return true; }
    catch (e) { if (e.status === 401 || e.status === 403 || e.status === 429) return false; throw e; }
  },
  logout() { api('/api/session', { method: 'DELETE' }).catch(() => {}); del(LS.token); },
  isAuthed() { return !!load(LS.token, null); },
  async changePassword(oldPw, newPw) { await api('/api/password', { method: 'POST', body: { oldPassword: oldPw, newPassword: newPw } }); return true; },
  async getSettings() { const j = await api('/api/settings'); return mergeSettings(j.settings); },
  async saveSettings(s) { await api('/api/settings', { method: 'PUT', body: { settings: s } }); return s; },
  async listBriefings() { return (await api('/api/briefings')).briefings; },
  async getBriefing(id) { const j = await api(`/api/briefings/${id}`); return j.briefing; },
  async saveBriefing(b, who) {
    const j = await api(`/api/briefings/${b.id}`, { method: 'PUT', body: { briefing: b, who } });
    Object.assign(b, { revision: j.revision, updatedAt: j.updatedAt, updatedBy: j.updatedBy });
    return b;
  },
  async deleteBriefing(id) { await api(`/api/briefings/${id}`, { method: 'DELETE' }); },
  async uploadImage(briefingId, dataUrl, shareToken) {
    const j = await api(`/api/briefings/${briefingId}/files${shareToken ? `?t=${shareToken}` : ''}`, { method: 'POST', body: { dataUrl } });
    return { url: API + j.url, key: j.key };
  },
  async listAccess(id) { return (await api(`/api/briefings/${id}/access`)).links; },
  async createAccess(id, body) { return (await api(`/api/briefings/${id}/access`, { method: 'POST', body })).link; },
  async revokeAccess(id, token) { await api(`/api/briefings/${id}/access/${token}`, { method: 'DELETE' }); },
  async listSecrets() { return (await api('/api/secrets')).secrets; },
  async setSecret(name, value) { await api('/api/secrets', { method: 'PUT', body: { name, value } }); },
  async deleteSecret(name) { await api(`/api/secrets/${name}`, { method: 'DELETE' }); },
  async openShared(token, who) { return api(`/api/shared/${token}${who ? `?who=${encodeURIComponent(who)}` : ''}`); },
  async saveShared(token, b, who) {
    const j = await api(`/api/shared/${token}`, { method: 'PUT', body: { briefing: b, who } });
    Object.assign(b, { revision: j.revision, updatedAt: j.updatedAt, updatedBy: j.updatedBy });
    return b;
  },
  async getLog(id) { return (await api(`/api/briefings/${id}/log`)).log; },
  /** Datenabrufe über den Worker (Schlüssel bleiben dort); shareToken für Link-Nutzer. */
  async data(kind, params = {}, shareToken, body = null) {
    const q = new URLSearchParams(); for (const [k, v] of Object.entries(params)) if (v != null) q.set(k, String(v));
    if (shareToken) q.set('t', shareToken);
    return api(`/api/wx/${kind}?${q.toString()}`, body ? { method: 'POST', body } : {});
  },
};

function summary(b) {
  return {
    id: b.id, startMs: b.time?.startMs, tz: b.site?.tz, site: b.site?.name, icao: b.site?.icao, elev: b.site?.elev,
    balloon: b.balloon?.label, reg: b.balloon?.reg, kind: b.flight?.kind, status: b.status, finalNo: b.finalNo,
    revision: b.revision, updatedAt: b.updatedAt, updatedBy: b.updatedBy, links: (b.accessCount || 0),
  };
}

export const store = {
  mode: 'local', impl: local, apiBase: API,
  async init() {
    if (API && await remote.health()) { this.impl = remote; this.mode = 'remote'; }
    else { this.impl = local; this.mode = 'local'; }
    return this.mode;
  },
  touch() { save(LS.touch, Date.now()); },
  idleExpired(ms = 2 * 60 * 60 * 1000) { const t = load(LS.touch, 0); return t && Date.now() - t > ms; },
};
for (const k of ['health', 'login', 'logout', 'isAuthed', 'changePassword', 'getSettings', 'saveSettings', 'listBriefings', 'getBriefing', 'saveBriefing', 'deleteBriefing', 'uploadImage', 'listAccess', 'createAccess', 'revokeAccess', 'listSecrets', 'setSecret', 'deleteSecret', 'openShared', 'saveShared', 'getLog', 'data']) {
  store[k] = (...a) => store.impl[k](...a);
}
export { summary };
