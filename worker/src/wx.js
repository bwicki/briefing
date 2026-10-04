/* Fahrtbriefing — Datenabrufe im Worker (/api/wx/<kind>).
 *
 * Der Browser darf viele Quellen nicht direkt lesen (CORS) oder soll den
 * Schlüssel nicht sehen. Hier laufen deshalb: Open-Meteo (mit Kundenschlüssel),
 * METAR/TAF/SIGMET (aviationweather.gov, Rückfall GaforCast-Kopie), DABS-PDF
 * (skybriefing), Bild-Schnappschüsse amtlicher Karten (R2), FAA-NOTAM und die
 * Anthropic-API für KI-Hinweise. Antworten werden über die Cache-API kurz
 * zwischengespeichert, damit mehrere Nutzer eines Briefings die Quellen nicht
 * mehrfach belasten.
 */

const UA = 'Fahrtbriefing/0.3 (+https://briefing.wicki.aero)';
const AWC = 'https://aviationweather.gov/api/data';
const GAFOR = 'https://gafor.wicki.aero/data/dwd';
/** Eigene Kopie (GitHub Action im Repo), Rückfall GaforCast. */
const dataBase = (env) => (env.DATA_BASE || 'https://briefing.wicki.aero/data/dwd').replace(/\/$/, '');
async function copyJson(env, name) {
  const bust = `?t=${Math.floor(Date.now() / 600000)}`;
  try { return await (await get(`${dataBase(env)}/${name}${bust}`, {}, 12000)).json(); }
  catch { return (await get(`${GAFOR}/${name}${bust}`, {}, 12000)).json(); }
}
const SNAPSHOT_HOSTS = ['www.dwd.de', 'charts.ecmwf.int', 'www.meteoschweiz.admin.ch', 'www.meteoswiss.admin.ch', 'tilecache.rainviewer.com', 'api.rainviewer.com', 'static.meteoblue.com', 'my.meteoblue.com', 'www.meteoblue.com', 'www.skybriefing.com', 'eumetview.eumetsat.int', 'view.eumetsat.int', 'opendata.dwd.de'];

const json = (data, status = 200, headers = {}) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', ...headers } });
const err = (msg, status = 400) => json({ error: msg }, status);

async function getSecret(env, decrypt, name) {
  const row = await env.DB.prepare('SELECT iv,ct FROM secrets WHERE name=?').bind(name).first();
  if (!row) return null;
  try { return await decrypt(env, row.iv, row.ct); } catch { return null; }
}

/** Abruf mit Zeitlimit; wirft bei HTTP-Fehler. */
async function get(url, opts = {}, ms = 20000) {
  const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), ms);
  try {
    const r = await fetch(url, { ...opts, signal: ctl.signal, headers: { 'User-Agent': UA, Accept: opts.accept || 'application/json, text/plain, */*', ...(opts.headers || {}) }, redirect: 'follow' });
    if (!r.ok) throw new Error(`HTTP ${r.status} ${url.split('?')[0]}`);
    return r;
  } finally { clearTimeout(t); }
}

/** Cache-API: Antwort unter einem synthetischen Schlüssel für `ttl` Sekunden halten. */
async function cached(ctx, key, ttl, make) {
  const cache = caches.default;
  const req = new Request(`https://cache.briefing.local/${key}`);
  const hit = await cache.match(req);
  if (hit) return hit.json();
  const data = await make();
  ctx.waitUntil(cache.put(req, new Response(JSON.stringify(data), { headers: { 'Content-Type': 'application/json', 'Cache-Control': `public, max-age=${ttl}` } })));
  return data;
}

const R = 6371.0088, rad = (d) => d * Math.PI / 180;
const distKm = (a, b, c, d) => 2 * R * Math.asin(Math.min(1, Math.sqrt(Math.sin(rad(c - a) / 2) ** 2 + Math.cos(rad(a)) * Math.cos(rad(c)) * Math.sin(rad(d - b) / 2) ** 2)));

// ------------------------------------------------------------ Open-Meteo
async function openMeteo(env, decrypt, ctx, q) {
  const query = q.get('query') || '';
  if (!/^latitude=/.test(query) || /[^\w=&.,%:-]/.test(query)) return err('bad query');
  const key = await getSecret(env, decrypt, 'openmeteo');
  const base = key ? 'https://customer-api.open-meteo.com' : 'https://api.open-meteo.com';
  const url = `${base}/v1/forecast?${query}${key ? `&apikey=${encodeURIComponent(key)}` : ''}`;
  const data = await cached(ctx, `om/${await sha(query)}`, 900, async () => (await get(url, {}, 25000)).json());
  return json(data);
}
async function sha(s) { const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)); return [...new Uint8Array(b)].slice(0, 16).map((x) => x.toString(16).padStart(2, '0')).join(''); }

// ------------------------------------------------------------ METAR / TAF / SIGMET
function pickNearest(list, lat, lon, km, limit) {
  const best = new Map();
  for (const m of Array.isArray(list) ? list : []) { if (!m.icaoId || m.lat == null) continue; const prev = best.get(m.icaoId); if (!prev || (m.obsTime || 0) > (prev.obsTime || 0)) best.set(m.icaoId, m); }
  return [...best.values()].map((m) => ({ ...m, distKm: distKm(lat, lon, m.lat, m.lon) })).filter((m) => m.distKm <= km).sort((a, b) => a.distKm - b.distKm).slice(0, limit);
}
function tafByIcao(list, ids) {
  const out = {};
  for (const t of Array.isArray(list) ? list : []) { if (!t.icaoId || !ids.includes(t.icaoId)) continue; const prev = out[t.icaoId]; if (!prev || t.mostRecent === 1 || (prev.mostRecent !== 1 && (t.issueTime || '') > (prev.issueTime || ''))) out[t.icaoId] = t; }
  return out;
}
async function metar(env, ctx, q) {
  const lat = +q.get('lat'), lon = +q.get('lon'), km = Math.min(300, +q.get('km') || 120), limit = Math.min(10, +q.get('limit') || 4);
  if (!isFinite(lat) || !isFinite(lon)) return err('lat/lon');
  const cell = `${lat.toFixed(1)},${lon.toFixed(1)},${km},${limit}`;
  const data = await cached(ctx, `metar/${cell}`, 600, async () => {
    const dLat = km / 111.2, dLon = km / (111.2 * Math.max(0.2, Math.cos(rad(lat))));
    const bbox = [lat - dLat, lon - dLon, lat + dLat, lon + dLon].map((v) => v.toFixed(3)).join(',');
    try {
      const list = await (await get(`${AWC}/metar?bbox=${bbox}&format=json&hours=3`, {}, 12000)).json();
      const m = pickNearest(list, lat, lon, km, limit);
      if (!m.length) throw new Error('empty');
      const ids = m.map((x) => x.icaoId);
      let taf = {};
      try { taf = tafByIcao(await (await get(`${AWC}/taf?ids=${ids.join(',')}&format=json`, {}, 12000)).json(), ids); } catch { /* ohne TAF */ }
      return { metar: m, taf, source: 'aviationweather.gov', generated: new Date().toISOString() };
    } catch (e) {
      const j = await copyJson(env, 'metar.json');
      const m = pickNearest(j.metar, lat, lon, km, limit);
      return { metar: m, taf: tafByIcao(j.taf, m.map((x) => x.icaoId)), source: `Kopie NOAA AWC (${j.via || 'awc'}; live: ${e.message})`, generated: j.generated };
    }
  });
  return json(data);
}
async function sigmet(ctx, q) {
  const lat = +q.get('lat'), lon = +q.get('lon');
  if (!isFinite(lat) || !isFinite(lon)) return err('lat/lon');
  const data = await cached(ctx, `sigmet/${lat.toFixed(0)},${lon.toFixed(0)}`, 600, async () => {
    const list = await (await get(`${AWC}/isigmet?format=json`, {}, 15000)).json();
    const near = (Array.isArray(list) ? list : []).filter((s) => {
      const pts = (s.coords || []).filter((c) => c.lat != null);
      if (!pts.length) return /^(LS|ED|ET|LO|LF|LI|EB|EH|EL)/.test(s.firId || s.icaoId || '');
      const cLat = pts.reduce((a, c) => a + c.lat, 0) / pts.length, cLon = pts.reduce((a, c) => a + c.lon, 0) / pts.length;
      return distKm(lat, lon, cLat, cLon) < 450 || pts.some((c) => distKm(lat, lon, c.lat, c.lon) < 250);
    });
    return { sigmet: near.map((s) => ({ id: s.isigmetId || s.airSigmetId, fir: s.firId || s.icaoId, firName: s.firName, hazard: s.hazard, qualifier: s.qualifier, validFrom: s.validTimeFrom, validTo: s.validTimeTo, base: s.base, top: s.top, raw: s.rawSigmet || s.rawAirSigmet, coords: s.coords })), source: 'aviationweather.gov', generated: new Date().toISOString() };
  });
  return json(data);
}

// ------------------------------------------------------------ DWD-Kopie (GaforCast)
async function dwd(env, ctx) {
  const data = await cached(ctx, 'dwd/index', 600, () => copyJson(env, 'index.json'));
  return json(data);
}

// ------------------------------------------------------------ DABS (PDF → R2)
async function dabs(env, ctx, q, briefingId) {
  const day = q.get('day') === 'tomorrow' ? 'tomorrow' : 'today';
  const date = new Date(Date.now() + (day === 'tomorrow' ? 86400000 : 0)).toISOString().slice(0, 10);
  const key = `dabs/${date}-${day}-${Math.floor(Date.now() / 1800000)}.pdf`;
  let obj = await env.FILES.get(key);
  if (!obj) {
    const r = await get(`https://www.skybriefing.com/o/dabs?${day}`, { accept: 'application/pdf,*/*' }, 25000);
    const buf = await r.arrayBuffer();
    if (buf.byteLength < 1000 || new Uint8Array(buf, 0, 4).join(',') !== '37,80,68,70') return err('DABS: kein PDF erhalten', 502);
    await env.FILES.put(key, buf, { httpMetadata: { contentType: 'application/pdf' } });
    ctx.waitUntil(env.DB.prepare('INSERT OR IGNORE INTO files (key,briefing_id,content_type,size,created_at) VALUES (?,?,?,?,?)').bind(key, briefingId || 'dabs', 'application/pdf', buf.byteLength, Date.now()).run());
  }
  return json({ url: `/files/${key}`, key, day, date, fetched: Date.now() });
}

// ------------------------------------------------------------ Bild-Schnappschuss
async function snapshot(env, body, briefingId, q) {
  const u = (() => { try { return new URL(body.url || q.get('url') || ''); } catch { return null; } })();
  if (!u || u.protocol !== 'https:' || !SNAPSHOT_HOSTS.some((h) => u.hostname === h || u.hostname.endsWith('.' + h))) return err('host not allowed');
  let target = u.toString();
  // ECMWF Open Charts: die API liefert JSON mit dem Bildlink
  if (u.hostname === 'charts.ecmwf.int' && u.pathname.startsWith('/opencharts-api/')) {
    const j = await (await get(target, { accept: 'application/json' }, 25000)).json();
    target = j?.data?.link?.href; if (!target) return err('ECMWF: kein Bildlink');
  }
  const r = await get(target, { accept: 'image/*,application/pdf' }, 25000);
  const ct = (r.headers.get('Content-Type') || '').split(';')[0].trim();
  const ext = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/gif': 'gif', 'application/pdf': 'pdf' }[ct];
  if (!ext) return err(`unsupported type ${ct}`);
  const buf = await r.arrayBuffer();
  if (buf.byteLength > 8 * 1024 * 1024) return err('too large');
  const id = [...crypto.getRandomValues(new Uint8Array(9))].map((b) => (b % 36).toString(36)).join('');
  const key = `${briefingId || 'snap'}/${id}.${ext}`;
  await env.FILES.put(key, buf, { httpMetadata: { contentType: ct } });
  await env.DB.prepare('INSERT INTO files (key,briefing_id,content_type,size,created_at) VALUES (?,?,?,?,?)').bind(key, briefingId || 'snap', ct, buf.byteLength, Date.now()).run();
  return json({ url: `/files/${key}`, key, contentType: ct, fetched: Date.now() });
}

// ------------------------------------------------------------ FAA NOTAM
async function notam(env, decrypt, ctx, q) {
  const id = await getSecret(env, decrypt, 'faa_client_id'), secret = await getSecret(env, decrypt, 'faa_client_secret');
  if (!id || !secret) return err('FAA-Zugang fehlt (Einstellungen → Zugänge)', 424);
  const lat = +q.get('lat'), lon = +q.get('lon'), radius = Math.min(100, +q.get('nm') || 25);
  if (!isFinite(lat) || !isFinite(lon)) return err('lat/lon');
  const data = await cached(ctx, `notam/${lat.toFixed(2)},${lon.toFixed(2)},${radius}`, 900, async () => {
    const url = `https://external-api.faa.gov/notamapi/v1/notams?locationLatitude=${lat.toFixed(4)}&locationLongitude=${lon.toFixed(4)}&locationRadius=${radius}&pageSize=1000&sortBy=effectiveStartDate&sortOrder=Asc`;
    const j = await (await get(url, { headers: { client_id: id, client_secret: secret } }, 25000)).json();
    const items = (j.items || []).map((it) => {
      const core = it.properties?.coreNOTAMData?.notam || {}; const tr = it.properties?.coreNOTAMData?.notamTranslation?.[0] || {};
      return { id: core.id, number: core.number, type: core.type, location: core.location, icao: core.icaoLocation, start: core.effectiveStart, end: core.effectiveEnd, classification: core.classification, text: core.text, minFL: core.minimumFL, maxFL: core.maximumFL, radius: core.radius, coordinates: core.coordinates, lat: core.lat, lon: core.lon, formatted: tr.formattedText || tr.simpleText || '', geometry: it.geometry };
    });
    return { items, total: j.totalCount, source: 'FAA NOTAM API', generated: new Date().toISOString() };
  });
  return json(data);
}

// ------------------------------------------------------------ KI (Anthropic)
async function ai(env, decrypt, body) {
  const key = await getSecret(env, decrypt, 'anthropic');
  if (!key) return err('Anthropic-Schlüssel fehlt (Einstellungen → Zugänge)', 424);
  const model = /^[a-z0-9.-]+$/.test(body.model || '') ? body.model : 'claude-sonnet-5-5';
  const content = [];
  for (const u of (body.images || []).slice(0, 6)) {
    const mm = /^\/files\/(.+\.(jpg|png|webp))$/.exec(String(u).replace(/^https?:\/\/[^/]+/, ''));
    if (!mm) continue;
    const obj = await env.FILES.get(mm[1]); if (!obj) continue;
    const bytes = new Uint8Array(await obj.arrayBuffer());
    if (bytes.length > 4 * 1024 * 1024) continue;
    let bin = ''; for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    content.push({ type: 'image', source: { type: 'base64', media_type: obj.httpMetadata?.contentType || 'image/jpeg', data: btoa(bin) } });
  }
  content.push({ type: 'text', text: String(body.prompt || '').slice(0, 60000) });
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model, max_tokens: 700, system: String(body.system || '').slice(0, 8000), messages: [{ role: 'user', content }] }),
  });
  const j = await r.json();
  if (!r.ok) return err(j.error?.message || `Anthropic HTTP ${r.status}`, 502);
  const text = (j.content || []).filter((c) => c.type === 'text').map((c) => c.text).join('\n').trim();
  return json({ text, model: j.model, usage: j.usage });
}

// ------------------------------------------------------------ Final-PDF (Cloudflare Browser Rendering)
async function pdfRender(env, decrypt, ctx, body, auth) {
  const token = await getSecret(env, decrypt, 'cf_api_token'), acc = await getSecret(env, decrypt, 'cf_account_id');
  if (!token || !acc) return err('Browser Rendering nicht konfiguriert (Zugänge: cf_api_token, cf_account_id)', 424);
  const id = String(body.id || '').replace(/[^a-z0-9]/g, '');
  if (!id) return err('id');
  const row = await env.DB.prepare('SELECT json FROM briefings WHERE id=?').bind(id).first();
  if (!row) return err('not found', 404);
  const b = JSON.parse(row.json);
  // temporärer Leselink (1 h), damit der Renderer die Briefingsicht ohne Kennwort öffnen kann
  const tmp = [...crypto.getRandomValues(new Uint8Array(16))].map((x) => (x % 36).toString(36)).join('');
  await env.DB.prepare('INSERT INTO access_links (token,briefing_id,person,role,expires_at,created_at) VALUES (?,?,?,?,?,?)').bind(tmp, id, 'PDF-Renderer', 'read', Date.now() + 3600000, Date.now()).run();
  try {
    const page = `${(env.APP_URL || 'https://briefing.wicki.aero').replace(/\/$/, '')}/#/s/${tmp}/v`;
    const r = await fetch(`https://api.cloudflare.com/client/v4/accounts/${acc}/browser-rendering/pdf`, {
      method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: page, gotoOptions: { waitUntil: 'networkidle0', timeout: 60000 }, waitForTimeout: 2500, viewport: { width: 1200, height: 1600 }, pdfOptions: { format: 'A4', printBackground: true, preferCSSPageSize: true, margin: { top: '12mm', right: '12mm', bottom: '14mm', left: '12mm' } } }),
    });
    const ct = (r.headers.get('Content-Type') || '').split(';')[0];
    if (!r.ok || ct !== 'application/pdf') { let m = `Browser Rendering HTTP ${r.status}`; try { const j = await r.json(); m = j.errors?.[0]?.message || m; } catch { /* kein JSON */ } return err(m, 502); }
    const buf = await r.arrayBuffer();
    const key = `${id}/final-v${b.finalNo || 0}-${Date.now()}.pdf`;
    await env.FILES.put(key, buf, { httpMetadata: { contentType: 'application/pdf' } });
    await env.DB.prepare('INSERT INTO files (key,briefing_id,content_type,size,created_at) VALUES (?,?,?,?,?)').bind(key, id, 'application/pdf', buf.byteLength, Date.now()).run();
    return json({ url: `/files/${key}`, key, size: buf.byteLength, finalNo: b.finalNo || 0 });
  } finally {
    ctx.waitUntil(env.DB.prepare('UPDATE access_links SET revoked=1 WHERE token=?').bind(tmp).run());
  }
}

/** Einstieg: kind, Query, Body; auth = { owner: bool (Sitzung mit Schreibrecht), link: row|null, user: {id,role,flags}|null }. */
export async function handleWx(kind, req, env, ctx, q, body, auth, decrypt) {
  const canWrite = auth.owner || auth.link?.role === 'edit';
  const briefingId = q.get('b') || auth.link?.briefing_id || null;
  switch (kind) {
    case 'om': return openMeteo(env, decrypt, ctx, q);
    case 'metar': return metar(env, ctx, q);
    case 'sigmet': return sigmet(ctx, q);
    case 'dwd': return dwd(env, ctx);
    case 'dabs': if (!canWrite) return err('forbidden', 403); return dabs(env, ctx, q, briefingId);
    case 'snapshot': if (!canWrite) return err('forbidden', 403); return snapshot(env, body, briefingId, q);
    case 'notam': return notam(env, decrypt, ctx, q);
    case 'ai': if (!canWrite) return err('forbidden', 403); return ai(env, decrypt, body);
    case 'pdf': if (!auth.owner) return err('forbidden', 403); return pdfRender(env, decrypt, ctx, body, auth);
    default: return err('unknown kind', 404);
  }
}
