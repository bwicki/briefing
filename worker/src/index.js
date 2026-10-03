/* Fahrtbriefing — Cloudflare Worker: Sitzung (Kennwort), Einstellungen, Zugänge
 * (verschlüsselt), Briefings (D1), persönliche Links, Bilder (R2).
 *
 * Alle JSON-Antworten; Fehler als { error }. Owner-Aufrufe brauchen
 * «Authorization: Bearer <token>» (HMAC-signiert, 30 Tage). Persönliche Links
 * laufen über /api/shared/<token> ohne Sitzung.
 */

const SESSION_DAYS = 30;
const MAX_ATTEMPTS = 8;           // Fehlversuche je IP in 15 min
const ATTEMPT_WINDOW = 15 * 60 * 1000;
const DEFAULT_PASSWORD = '1234';

// ------------------------------------------------------------ Helfer
const enc = new TextEncoder(), dec = new TextDecoder();
const b64u = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64u = (s) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - s.length % 4) % 4)), (c) => c.charCodeAt(0));
const rnd = (n = 16) => b64u(crypto.getRandomValues(new Uint8Array(n)));
const json = (data, status = 200, headers = {}) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', ...headers } });
const err = (msg, status = 400) => json({ error: msg }, status);

async function pbkdf2(password, saltB64u, iterations = 100000) {
  const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: unb64u(saltB64u), iterations }, key, 256);
  return b64u(bits);
}
async function hmac(secret, data) {
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return b64u(await crypto.subtle.sign('HMAC', key, enc.encode(data)));
}
async function aesKey(env) {
  const raw = unb64u(env.ENC_KEY || '');
  if (raw.length !== 32) throw new Error('ENC_KEY muss 32 Bytes (base64) sein');
  return crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt', 'decrypt']);
}
async function encrypt(env, text) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await aesKey(env), enc.encode(text));
  return { iv: b64u(iv), ct: b64u(ct) };
}
export async function decrypt(env, iv, ct) {
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64u(iv) }, await aesKey(env), unb64u(ct));
  return dec.decode(pt);
}

// ------------------------------------------------------------ Sitzung
async function makeToken(env) {
  const payload = b64u(enc.encode(JSON.stringify({ exp: Date.now() + SESSION_DAYS * 86400000, r: rnd(8) })));
  return `${payload}.${await hmac(env.SESSION_SECRET, payload)}`;
}
async function checkToken(env, req) {
  const auth = req.headers.get('Authorization') || '';
  const m = /^Bearer (.+)$/.exec(auth);
  if (!m) return false;
  const [payload, sig] = m[1].split('.');
  if (!payload || !sig) return false;
  const expect = await hmac(env.SESSION_SECRET, payload);
  if (expect.length !== sig.length || !timingSafeEqual(expect, sig)) return false;
  try { const p = JSON.parse(dec.decode(unb64u(payload))); return p.exp > Date.now(); } catch { return false; }
}
function timingSafeEqual(a, b) { let r = 0; for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i); return r === 0; }

async function getKv(env, k) { const row = await env.DB.prepare('SELECT v FROM kv WHERE k=?').bind(k).first(); return row ? JSON.parse(row.v) : null; }
async function setKv(env, k, v) { await env.DB.prepare('INSERT INTO kv (k,v,updated_at) VALUES (?,?,?) ON CONFLICT(k) DO UPDATE SET v=excluded.v, updated_at=excluded.updated_at').bind(k, JSON.stringify(v), Date.now()).run(); }

async function getPassword(env) {
  let pw = await getKv(env, 'password');
  if (!pw) { const salt = rnd(16); pw = { salt, hash: await pbkdf2(DEFAULT_PASSWORD, salt) }; await setKv(env, 'password', pw); }
  return pw;
}
async function verifyPassword(env, password) {
  const pw = await getPassword(env);
  const h = await pbkdf2(String(password || ''), pw.salt);
  return timingSafeEqual(h, pw.hash);
}

// ------------------------------------------------------------ Briefings
function summaryOf(b) {
  return { id: b.id, startMs: b.time?.startMs, tz: b.site?.tz, site: b.site?.name, icao: b.site?.icao, elev: b.site?.elev, balloon: b.balloon?.label, reg: b.balloon?.reg, kind: b.flight?.kind, status: b.status, finalNo: b.finalNo, revision: b.revision, updatedAt: b.updatedAt, updatedBy: b.updatedBy };
}
async function saveBriefing(env, b, who) {
  const row = await env.DB.prepare('SELECT revision FROM briefings WHERE id=?').bind(b.id).first();
  b.revision = (row?.revision || 0) + 1; b.updatedAt = Date.now(); b.updatedBy = who || 'owner';
  if (!b.createdAt) b.createdAt = b.updatedAt;
  const s = summaryOf(b);
  await env.DB.prepare(`INSERT INTO briefings (id,json,revision,status,final_no,start_ms,tz,site,icao,elev,reg,balloon,kind,created_at,updated_at,updated_by)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    ON CONFLICT(id) DO UPDATE SET json=excluded.json, revision=excluded.revision, status=excluded.status, final_no=excluded.final_no, start_ms=excluded.start_ms, tz=excluded.tz, site=excluded.site, icao=excluded.icao, elev=excluded.elev, reg=excluded.reg, balloon=excluded.balloon, kind=excluded.kind, updated_at=excluded.updated_at, updated_by=excluded.updated_by`)
    .bind(b.id, JSON.stringify(b), b.revision, b.status || 'draft', b.finalNo || 0, s.startMs || null, s.tz || null, s.site || null, s.icao || null, s.elev ?? null, s.reg || null, s.balloon || null, s.kind || null, b.createdAt, b.updatedAt, b.updatedBy).run();
  return { revision: b.revision, updatedAt: b.updatedAt, updatedBy: b.updatedBy };
}
async function loadBriefing(env, id) {
  const row = await env.DB.prepare('SELECT json FROM briefings WHERE id=?').bind(id).first();
  if (!row) return null;
  const b = JSON.parse(row.json);
  const c = await env.DB.prepare('SELECT COUNT(*) AS n FROM access_links WHERE briefing_id=? AND revoked=0 AND expires_at>?').bind(id, Date.now()).first();
  b.accessCount = c?.n || 0;
  return b;
}
async function publicSettings(env) {
  const s = (await getKv(env, 'settings')) || {};
  return s;
}

// ------------------------------------------------------------ Router
export default {
  async fetch(req, env, ctx) {
    const url = new URL(req.url);
    const origin = req.headers.get('Origin') || '';
    const allowed = (env.ALLOWED_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean);
    const corsOrigin = allowed.includes(origin) ? origin : (allowed[0] || '*');
    const cors = { 'Access-Control-Allow-Origin': corsOrigin, 'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, Authorization', 'Access-Control-Max-Age': '86400', 'Vary': 'Origin' };
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    try {
      const res = await route(req, env, url, ctx);
      for (const [k, v] of Object.entries(cors)) res.headers.set(k, v);
      return res;
    } catch (e) {
      console.error(e);
      return json({ error: e.message || 'error' }, 500, cors);
    }
  },
};

async function route(req, env, url, ctx) {
  const p = url.pathname.replace(/\/+$/, '') || '/';
  const m = (re) => re.exec(p);
  const body = async () => { try { return await req.json(); } catch { return {}; } };
  const ip = req.headers.get('CF-Connecting-IP') || '0.0.0.0';

  if (p === '/api/health') return json({ ok: true, version: env.APP_VERSION || '', time: Date.now() });

  // ---- Dateien (unerratbare Schlüssel, öffentlich lesbar; Cache 1 Jahr)
  let mm = m(/^\/files\/([a-z0-9]+)\/([a-z0-9]+\.(?:jpg|png|webp))$/);
  if (mm && req.method === 'GET') {
    const obj = await env.FILES.get(`${mm[1]}/${mm[2]}`);
    if (!obj) return err('not found', 404);
    return new Response(obj.body, { headers: { 'Content-Type': obj.httpMetadata?.contentType || 'image/jpeg', 'Cache-Control': 'public, max-age=31536000, immutable' } });
  }

  // ---- Sitzung
  if (p === '/api/session' && req.method === 'POST') {
    const since = Date.now() - ATTEMPT_WINDOW;
    const n = await env.DB.prepare('SELECT COUNT(*) AS n FROM login_attempts WHERE ip=? AND ts>?').bind(ip, since).first();
    if ((n?.n || 0) >= MAX_ATTEMPTS) return err('too many attempts', 429);
    const { password } = await body();
    if (!(await verifyPassword(env, password))) {
      await env.DB.prepare('INSERT INTO login_attempts (ip,ts) VALUES (?,?)').bind(ip, Date.now()).run();
      ctx.waitUntil(env.DB.prepare('DELETE FROM login_attempts WHERE ts<?').bind(since).run());
      return err('wrong password', 401);
    }
    await env.DB.prepare('DELETE FROM login_attempts WHERE ip=?').bind(ip).run();
    return json({ token: await makeToken(env) });
  }
  if (p === '/api/session' && req.method === 'DELETE') return new Response(null, { status: 204 });

  // ---- Persönliche Links (ohne Sitzung)
  mm = m(/^\/api\/shared\/([A-Za-z0-9_-]+)$/);
  if (mm) {
    const link = await env.DB.prepare('SELECT * FROM access_links WHERE token=?').bind(mm[1]).first();
    if (!link || link.revoked) return err('link revoked', 410);
    if (link.expires_at < Date.now()) return err('link expired', 410);
    const b = await loadBriefing(env, link.briefing_id);
    if (!b) return err('not found', 404);
    if (req.method === 'GET') {
      ctx.waitUntil(env.DB.prepare('UPDATE access_links SET last_opened_at=? WHERE token=?').bind(Date.now(), link.token).run());
      return json({ briefing: b, role: link.role, person: link.person, settings: await publicSettings(env) });
    }
    if (req.method === 'PUT') {
      if (link.role !== 'edit') return err('read only', 403);
      const { briefing, who } = await body();
      if (!briefing || briefing.id !== b.id) return err('bad briefing');
      // Mitarbeit darf weder Freigabe noch Berechtigungen ändern
      briefing.status = b.status; briefing.finalNo = b.finalNo; briefing.versions = b.versions;
      return json(await saveBriefing(env, briefing, `${who || link.person} (Link)`));
    }
    return err('method', 405);
  }

  // ---- Bild-Upload über Link (Mitarbeit)
  mm = m(/^\/api\/briefings\/([a-z0-9]+)\/files$/);
  if (mm && req.method === 'POST' && url.searchParams.get('t')) {
    const link = await env.DB.prepare('SELECT * FROM access_links WHERE token=? AND briefing_id=? AND revoked=0 AND role=?').bind(url.searchParams.get('t'), mm[1], 'edit').first();
    if (!link || link.expires_at < Date.now()) return err('forbidden', 403);
    return uploadFile(env, mm[1], await body());
  }

  // ---- Alles Weitere braucht die Owner-Sitzung
  if (!p.startsWith('/api/')) return err('not found', 404);
  if (!(await checkToken(env, req))) return err('unauthorized', 401);

  if (p === '/api/password' && req.method === 'POST') {
    const { oldPassword, newPassword } = await body();
    if (!(await verifyPassword(env, oldPassword))) return err('wrong password', 403);
    if (!newPassword || String(newPassword).length < 4) return err('too short');
    const salt = rnd(16); await setKv(env, 'password', { salt, hash: await pbkdf2(String(newPassword), salt) });
    return json({ ok: true });
  }
  if (p === '/api/settings') {
    if (req.method === 'GET') return json({ settings: (await getKv(env, 'settings')) || {} });
    if (req.method === 'PUT') { const { settings } = await body(); await setKv(env, 'settings', settings || {}); return json({ ok: true }); }
  }
  if (p === '/api/secrets') {
    if (req.method === 'GET') { const rows = await env.DB.prepare('SELECT name FROM secrets').all(); return json({ secrets: Object.fromEntries((rows.results || []).map((r) => [r.name, true])) }); }
    if (req.method === 'PUT') {
      const { name, value } = await body();
      if (!/^[a-z0-9_]{1,40}$/.test(name || '') || typeof value !== 'string' || !value) return err('bad secret');
      const { iv, ct } = await encrypt(env, value);
      await env.DB.prepare('INSERT INTO secrets (name,iv,ct,updated_at) VALUES (?,?,?,?) ON CONFLICT(name) DO UPDATE SET iv=excluded.iv, ct=excluded.ct, updated_at=excluded.updated_at').bind(name, iv, ct, Date.now()).run();
      return json({ ok: true });
    }
  }
  mm = m(/^\/api\/secrets\/([a-z0-9_]+)$/);
  if (mm && req.method === 'DELETE') { await env.DB.prepare('DELETE FROM secrets WHERE name=?').bind(mm[1]).run(); return new Response(null, { status: 204 }); }

  if (p === '/api/briefings' && req.method === 'GET') {
    const rows = await env.DB.prepare(`SELECT b.id,b.start_ms,b.tz,b.site,b.icao,b.elev,b.reg,b.balloon,b.kind,b.status,b.final_no,b.revision,b.updated_at,b.updated_by,
      (SELECT COUNT(*) FROM access_links a WHERE a.briefing_id=b.id AND a.revoked=0 AND a.expires_at>?) AS links FROM briefings b ORDER BY b.start_ms`).bind(Date.now()).all();
    return json({ briefings: (rows.results || []).map((r) => ({ id: r.id, startMs: r.start_ms, tz: r.tz, site: r.site, icao: r.icao, elev: r.elev, reg: r.reg, balloon: r.balloon, kind: r.kind, status: r.status, finalNo: r.final_no, revision: r.revision, updatedAt: r.updated_at, updatedBy: r.updated_by, links: r.links })) });
  }
  if (p === '/api/export' && req.method === 'GET') {
    const rows = await env.DB.prepare('SELECT json FROM briefings').all();
    return json({ exportedAt: Date.now(), settings: await getKv(env, 'settings'), briefings: (rows.results || []).map((r) => JSON.parse(r.json)) });
  }
  mm = m(/^\/api\/briefings\/([a-z0-9]+)$/);
  if (mm) {
    const id = mm[1];
    if (req.method === 'GET') { const b = await loadBriefing(env, id); return b ? json({ briefing: b }) : err('not found', 404); }
    if (req.method === 'PUT') { const { briefing, who } = await body(); if (!briefing || briefing.id !== id) return err('bad briefing'); return json(await saveBriefing(env, briefing, who)); }
    if (req.method === 'DELETE') {
      await env.DB.prepare('DELETE FROM briefings WHERE id=?').bind(id).run();
      await env.DB.prepare('DELETE FROM access_links WHERE briefing_id=?').bind(id).run();
      const files = await env.DB.prepare('SELECT key FROM files WHERE briefing_id=?').bind(id).all();
      for (const f of files.results || []) ctx.waitUntil(env.FILES.delete(f.key));
      await env.DB.prepare('DELETE FROM files WHERE briefing_id=?').bind(id).run();
      return new Response(null, { status: 204 });
    }
  }
  mm = m(/^\/api\/briefings\/([a-z0-9]+)\/files$/);
  if (mm && req.method === 'POST') return uploadFile(env, mm[1], await body());
  mm = m(/^\/api\/briefings\/([a-z0-9]+)\/log$/);
  if (mm && req.method === 'GET') { const b = await loadBriefing(env, mm[1]); return json({ log: b?.log || [] }); }
  mm = m(/^\/api\/briefings\/([a-z0-9]+)\/access$/);
  if (mm) {
    const id = mm[1];
    if (req.method === 'GET') {
      const rows = await env.DB.prepare('SELECT token,person,role,expires_at,created_at,last_opened_at FROM access_links WHERE briefing_id=? AND revoked=0 ORDER BY created_at').bind(id).all();
      return json({ links: (rows.results || []).map((r) => ({ token: r.token, person: r.person, role: r.role, expiresAt: r.expires_at, createdAt: r.created_at, lastOpenedAt: r.last_opened_at })) });
    }
    if (req.method === 'POST') {
      const { person, role, expiresAt } = await body();
      if (!person || !['read', 'edit'].includes(role)) return err('bad link');
      const token = rnd(16);
      await env.DB.prepare('INSERT INTO access_links (token,briefing_id,person,role,expires_at,created_at) VALUES (?,?,?,?,?,?)').bind(token, id, String(person).slice(0, 80), role, +expiresAt || Date.now() + 7 * 86400000, Date.now()).run();
      return json({ link: { token, person, role, expiresAt } });
    }
  }
  mm = m(/^\/api\/briefings\/([a-z0-9]+)\/access\/([A-Za-z0-9_-]+)$/);
  if (mm && req.method === 'DELETE') { await env.DB.prepare('UPDATE access_links SET revoked=1 WHERE token=? AND briefing_id=?').bind(mm[2], mm[1]).run(); return new Response(null, { status: 204 }); }

  return err('not found', 404);
}

async function uploadFile(env, briefingId, { dataUrl }) {
  const mm = /^data:(image\/(?:jpeg|png|webp));base64,(.+)$/.exec(dataUrl || '');
  if (!mm) return err('bad image');
  const bytes = unb64u(mm[2].replace(/-/g, '+').replace(/_/g, '/'));
  if (bytes.length > 4 * 1024 * 1024) return err('too large (4 MB)');
  const ext = mm[1] === 'image/png' ? 'png' : mm[1] === 'image/webp' ? 'webp' : 'jpg';
  const key = `${briefingId}/${rnd(12).toLowerCase().replace(/[^a-z0-9]/g, 'x')}.${ext}`;
  await env.FILES.put(key, bytes, { httpMetadata: { contentType: mm[1] } });
  await env.DB.prepare('INSERT INTO files (key,briefing_id,content_type,size,created_at) VALUES (?,?,?,?,?)').bind(key, briefingId, mm[1], bytes.length, Date.now()).run();
  return json({ url: `/files/${key}`, key });
}
