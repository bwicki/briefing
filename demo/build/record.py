"""Aufnahme der Einführungsvideos (0.12.2): Playwright bedient die App im lokalen Modus mit Beispieldaten
(Open-Meteo-Nachbildung aus test/om_fixture.py, METAR-Kopie, Relief/Wasser synthetisch – wie test/ui.smoke.py),
zeichnet den Bildschirm als WebM auf und schreibt die Szenenzeiten (scenes.json). Zusammenbau mit Ton: assemble.py.

Aufruf: python3 demo/build/record.py <hab|gas> <out-dir> [base_url]   (Server: python3 -m http.server 8080 im Repo)
Voraussetzung: durations.json aus synth.py im out-dir (Szenenlänge = Sprechtext + Reserve).
"""
import sys, os, json, time, math, glob, shutil
from urllib.parse import urlparse, parse_qs
from playwright.sync_api import sync_playwright
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.abspath(os.path.join(HERE, '..', '..'))
sys.path.insert(0, os.path.join(ROOT, 'test')); sys.path.insert(0, HERE)
from om_fixture import fixture
from script import VERSIONS

VER = sys.argv[1]; OUT = sys.argv[2]; BASE = sys.argv[3] if len(sys.argv) > 3 else 'http://localhost:8080/'
GAFOR = os.environ.get('GAFOR_DATA', '/home/claude/gafor/data')
V = VERSIONS[VER]
DUR = json.load(open(os.path.join(OUT, 'durations.json')))[VER]
W, H = 1366, 768

INIT = r"""
(() => {
  const css = `#dm-cur{position:fixed;z-index:99999;width:22px;height:22px;margin:-2px 0 0 -2px;pointer-events:none;transition:transform .08s}
  #dm-cur svg{filter:drop-shadow(0 1px 2px rgba(0,0,0,.6))} #dm-cur.down{transform:scale(.78)}
  #dm-ban{position:fixed;left:16px;bottom:14px;z-index:99998;background:rgba(29,33,38,.88);color:#fff;font:600 15px/1.25 system-ui,-apple-system,sans-serif;padding:9px 13px 9px 10px;border-radius:9px;pointer-events:none;max-width:62vw;display:flex;align-items:center;gap:9px}
  #dm-ban b{display:inline-grid;place-items:center;background:#b8640f;border-radius:50%;width:24px;height:24px;font-size:13px;flex:0 0 auto}
  #dm-black{position:fixed;inset:0;background:#000;z-index:999999}`;
  const style = document.createElement('style'); style.textContent = css;
  const cur = document.createElement('div'); cur.id = 'dm-cur'; cur.style.left = '-50px';
  cur.innerHTML = '<svg viewBox="0 0 24 24" width="22" height="22"><path d="M4 2 L4 19 L8.5 14.5 L11.5 21 L14 20 L11 13.5 L17 13.5 Z" fill="#fff" stroke="#111" stroke-width="1.4" stroke-linejoin="round"/></svg>';
  const ban = document.createElement('div'); ban.id = 'dm-ban'; ban.hidden = true;
  const mount = () => { if (!style.isConnected && document.head) document.head.appendChild(style); if (document.body && !cur.isConnected) document.body.append(cur, ban); };
  document.addEventListener('DOMContentLoaded', mount); setTimeout(mount, 0);
  document.addEventListener('mousemove', (e) => { cur.style.left = e.clientX + 'px'; cur.style.top = e.clientY + 'px'; }, true);
  document.addEventListener('mousedown', () => cur.classList.add('down'), true);
  document.addEventListener('mouseup', () => cur.classList.remove('down'), true);
  window.__dmBanner = (n, t) => { mount(); ban.hidden = !t; ban.innerHTML = t ? `<b>${n}</b><span>${t}</span>` : ''; };
  window.__dmBlack = (on) => { mount(); let b = document.getElementById('dm-black'); if (on && !b) { b = document.createElement('div'); b.id = 'dm-black'; document.body.appendChild(b); } if (!on && b) b.remove(); };
})();
"""

def png1():
    import zlib, struct
    def chunk(tag, data): return struct.pack('>I', len(data)) + tag + data + struct.pack('>I', zlib.crc32(tag + data) & 0xffffffff)
    return b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', 1, 1, 8, 6, 0, 0, 0)) + chunk(b'IDAT', zlib.compress(b'\x00\x00\x00\x00\x00')) + chunk(b'IEND', b'')

def mock(pg):
    PNG = png1()
    pg.route('**/js/config.js', lambda r: r.fulfill(status=200, content_type='application/javascript', body="window.BRIEFING_CONFIG = { apiBase: '' };"))
    def elev(r):
        q = parse_qs(urlparse(r.request.url).query); lats = q['latitude'][0].split(','); lons = q['longitude'][0].split(',')
        r.fulfill(status=200, content_type='application/json', body=json.dumps({'elevation': [round(450 + 900 * max(0, math.sin((float(lo) - 8.0) * 3.0)) + 200 * math.sin(float(la) * 40)) for la, lo in zip(lats, lons)]}))
    pg.route('**/api.open-meteo.com/**', lambda r: r.fulfill(status=200, content_type='application/json', body=json.dumps(fixture(urlparse(r.request.url).query))))
    pg.route('**/api.open-meteo.com/v1/elevation**', elev)   # zuletzt registriert = zuerst geprüft
    def gafor(r):
        path = urlparse(r.request.url).path.replace('/data/', '', 1); f = os.path.join(GAFOR, path)
        if os.path.exists(f): r.fulfill(status=200, content_type='application/json', body=open(f).read())
        else: r.fulfill(status=404, body='')
    pg.route('**/gafor.wicki.aero/**', gafor)
    def water(r):
        n = r.request.post_data.count('is_in(')
        els = [{'type': 'm', 'id': i + 1, 'tags': {'i': str(i), 'id': '2400000001' if 30 <= i <= 34 else '', 'nm': 'Sempachersee' if 30 <= i <= 34 else '', 'wt': 'lake' if 30 <= i <= 34 else ''}} for i in range(n)]
        r.fulfill(status=200, content_type='application/json', body=json.dumps({'elements': els}))
    pg.route('**/overpass-api.de/**', water)
    for pat in ['**/basemaps.cartocdn.com/**', '**/tile.opentopomap.org/**', '**/tile.openstreetmap.org/**', '**/server.arcgisonline.com/**']: pg.route(pat, lambda r: r.fulfill(status=200, content_type='image/png', body=PNG))
    for pat in ['**/api.rainviewer.com/**', '**/nominatim.openstreetmap.org/**', '**/router.project-osrm.org/**']: pg.route(pat, lambda r: r.abort())

class Rec:
    def __init__(self, pg):
        self.pg = pg; self.t0 = None; self.scenes = []; self.cur = None
    # ---- Bedienung mit sichtbarem Zeiger
    def box(self, sel):
        el = self.pg.query_selector(sel)
        if not el: raise RuntimeError('fehlt: ' + sel)
        el.scroll_into_view_if_needed(); self.pg.wait_for_timeout(150)
        return el.bounding_box()
    def move(self, sel, dx=0.5, dy=0.5, steps=14):
        b = self.box(sel); self.pg.mouse.move(b['x'] + b['width'] * dx, b['y'] + b['height'] * dy, steps=steps); self.pg.wait_for_timeout(120)
    def click(self, sel, dx=0.5, dy=0.5, wait=600):
        self.move(sel, dx, dy); self.pg.mouse.down(); self.pg.wait_for_timeout(90); self.pg.mouse.up(); self.pg.wait_for_timeout(wait)
    def hover_path(self, sels, pause=900):
        for s in sels:
            try: self.move(s); self.pg.wait_for_timeout(pause)
            except Exception: pass
    def type(self, sel, text, delay=110):
        self.click(sel, wait=200); self.pg.keyboard.type(text, delay=delay)
    def scroll(self, dy, steps=6, pause=60):
        for _ in range(steps): self.pg.mouse.wheel(0, dy / steps); self.pg.wait_for_timeout(pause)
    # ---- Szenen
    def flash(self):
        # kurzes schwarzes Bild = Szenenmarke; assemble.py findet sie mit blackdetect (Videozeit statt Uhrzeit: die Aufnahme kann nachhinken)
        self.pg.evaluate('() => window.__dmBlack(true)'); self.pg.wait_for_timeout(260); self.pg.evaluate('() => window.__dmBlack(false)'); self.pg.wait_for_timeout(120)
    def scene(self, i, key, title):
        self.pg.evaluate('() => window.__dmBanner(0, "")'); self.flash()
        self.pg.evaluate('([n, t]) => window.__dmBanner(n, t)', [i + 1, title])
        self.cur = {'i': i, 'key': key, 'title': title, 't0': time.time() - self.t0}
    def end_scene(self):
        need = DUR[self.cur['i']] * 1.2 + 1.2   # Reserve: die Aufnahme kann gegenüber der Uhr nachhinken (assemble.py misst die Szenen im Video)
        while time.time() - self.t0 - self.cur['t0'] < need: self.pg.wait_for_timeout(100)
        self.cur['t1'] = time.time() - self.t0; self.scenes.append(self.cur); print(f"  {self.cur['i'] + 1} {self.cur['key']:9s} {self.cur['t1'] - self.cur['t0']:5.1f} s"); self.cur = None

def login(r, pg):
    pg.goto(BASE + '#/list'); pg.wait_for_timeout(900)
    r.type('#gatePw', '1234'); r.click('#gateOpen', wait=900)

def wizard_common(r, pg, kind_time):
    """Schritt 2 (Ort/Zeit): Startzeit setzen, Sonnenblock zeigen, Weiter."""
    r.click('input[type=time]', wait=150); pg.fill('input[type=time]', kind_time); pg.dispatch_event('input[type=time]', 'change'); pg.wait_for_timeout(700)

def record_hab(r, pg):
    # Vorbereitung (nicht im Film): ein bestehendes Briefing, damit die Übersicht nicht leer ist
    login(r, pg); pg.goto(BASE + '#/new'); pg.wait_for_timeout(700)
    pg.select_option('.wiz select', 'HB-QWP'); pg.wait_for_timeout(300); pg.click('button:has-text("Weiter →")'); pg.wait_for_timeout(700)
    pg.click('button.chip:has-text("Gladbeck")'); pg.wait_for_timeout(500); pg.fill('input[type=time]', '08:00'); pg.dispatch_event('input[type=time]', 'change'); pg.wait_for_timeout(500)
    for _ in range(4): pg.click('button:has-text("Weiter →")'); pg.wait_for_timeout(900)
    pg.click('button:has-text("Briefing anlegen")'); pg.wait_for_timeout(2000)
    pg.evaluate("() => localStorage.removeItem('fb.unlocked')"); pg.goto(BASE + '#/list'); pg.reload(); pg.wait_for_timeout(1200)
    # 1 Anmelden und Übersicht
    r.scene(0, 'login', V['scenes'][0][1])
    r.type('#gatePw', '1234'); pg.wait_for_timeout(400); r.click('#gateOpen', wait=1200)
    r.hover_path(['table.list tbody tr', 'table.list tbody tr td:nth-child(3)', '.chips button:nth-child(2)'], 1500)
    r.end_scene()
    # 2 Neues Briefing: Ballon und Fahrt
    r.scene(1, 'wiz1', V['scenes'][1][1])
    r.click('a[href="#/new"]', wait=1000)
    r.hover_path(['.wiz button.chip.lg:has-text("Heissluft")', '.wiz select'], 1200)
    r.click('.wiz button.chip.lg:has-text("privat")', wait=800)
    r.hover_path(['.wiz .frow', '.wiz .note'], 1200)
    r.end_scene(); r.click('button:has-text("Weiter →")', wait=900)
    # 3 Ort und Zeit
    r.scene(2, 'wiz2', V['scenes'][2][1])
    r.hover_path(['button.chip:has-text("Oberlunkhofen")'], 1200)
    wizard_common(r, pg, '07:30')
    r.hover_path(['.sunblock, .sun, .wiz .kv', '.wiz .frow:nth-of-type(2)'], 1400)
    r.end_scene(); r.click('button:has-text("Weiter →")', wait=900)
    # 4 Fahrtabsicht, Personen, Tagesplanung, Prüfen → anlegen
    r.scene(3, 'wiz3', V['scenes'][3][1])
    r.hover_path(['.wiz .frow'], 1600); r.click('button:has-text("Weiter →")', wait=1000)
    r.hover_path(['.wiz .frow'], 1400); r.click('button:has-text("Weiter →")', wait=1000)
    r.hover_path(['.wiz .frow'], 1400); r.click('button:has-text("Weiter →")', wait=1000)
    r.hover_path(['.wiz .summary, .wiz .kv'], 1200)
    r.end_scene(); r.click('button:has-text("Briefing anlegen")', wait=2500)
    # 5 Erarbeitung
    r.scene(4, 'editor', V['scenes'][4][1])
    r.hover_path(['.enav details:nth-of-type(1) summary', '.enav details:nth-of-type(2) summary', '.enav .it.sel, .enav .it', '.side .card.gonogo', '.side .card:nth-child(2)'], 1500)
    r.click('.refresh-all .must-btn', wait=1500)
    r.end_scene()
    # 6 Daten laden
    r.scene(5, 'refresh', V['scenes'][5][1])
    pg.evaluate('window.scrollTo({top: 0, behavior: "smooth"})'); pg.wait_for_timeout(700)
    r.click('.refresh-all button.primary', wait=2500)
    r.hover_path(['.meteobar, .meteo-bar', '#panel-B\\.meteogram', '#panel-B\\.wind', '#panel-B\\.traj'], 2200)
    r.end_scene()
    # 7 Luftraum und Tragkraft
    r.scene(6, 'airspace', V['scenes'][6][1])
    r.hover_path(['#panel-C\\.airspace', '#panel-C\\.airspace table, #panel-C\\.airspace .auto-wrap'], 2500)
    r.hover_path(['#panel-A\\.massperf', '#panel-A\\.massperf table, #panel-A\\.massperf .kv'], 2500)
    r.end_scene()
    # 8 Go/No-Go, Freigabe, Briefingsicht
    r.scene(7, 'release', V['scenes'][7][1])
    pg.evaluate('window.scrollTo({top: 0, behavior: "smooth"})'); pg.wait_for_timeout(700)
    r.hover_path(['.side .card.gonogo', 'header .btn.primary'], 1800)
    r.click('.viewtoggle button:nth-child(2)', wait=1800)
    r.scroll(600, 8, 70); pg.wait_for_timeout(600)
    r.end_scene()
    # 9 Ende
    r.scene(8, 'end', V['scenes'][8][1])
    r.scroll(-600, 8, 70)
    r.end_scene()

def record_gas(r, pg):
    login(r, pg); pg.goto(BASE + '#/new'); pg.wait_for_timeout(700)
    for _ in range(5): pg.click('button:has-text("Weiter →")'); pg.wait_for_timeout(800)
    pg.click('button:has-text("Briefing anlegen")'); pg.wait_for_timeout(2000)
    pg.evaluate("() => localStorage.removeItem('fb.unlocked')"); pg.goto(BASE + '#/list'); pg.reload(); pg.wait_for_timeout(1200)
    # 1 Anmelden und Übersicht
    r.scene(0, 'login', V['scenes'][0][1])
    r.type('#gatePw', '1234'); pg.wait_for_timeout(400); r.click('#gateOpen', wait=1200)
    r.hover_path(['table.list tbody tr', 'table.list tbody tr td:nth-child(5)'], 1500)
    r.end_scene()
    # 2 Neues Briefing: Gasballon, Ort/Zeit
    r.scene(1, 'wiz1', V['scenes'][1][1])
    r.click('a[href="#/new"]', wait=1000)
    r.click('.wiz button.chip.lg:has-text("Gas")', wait=800)
    r.move('.wiz select'); pg.select_option('.wiz select', 'HB-QPJ'); pg.wait_for_timeout(900)
    r.hover_path(['.wiz select:nth-of-type(1)', '.wiz .frow'], 1000)
    r.click('button:has-text("Weiter →")', wait=900)
    r.hover_path(['button.chip:has-text("Oberlunkhofen")'], 900)
    wizard_common(r, pg, '16:00')
    r.end_scene(); r.click('button:has-text("Weiter →")', wait=900)
    # 3 Fahrtabsicht 24 h … anlegen
    r.scene(2, 'wiz3', V['scenes'][2][1])
    r.hover_path(['.wiz .frow'], 1600); r.click('button:has-text("Weiter →")', wait=900)
    r.hover_path(['.wiz .frow'], 1200); r.click('button:has-text("Weiter →")', wait=900)
    r.hover_path(['.wiz .frow'], 1000); r.click('button:has-text("Weiter →")', wait=900)
    r.end_scene(); r.click('button:has-text("Briefing anlegen")', wait=2500)
    # 4 Erarbeitung mit Gas-Panels
    r.scene(3, 'editor', V['scenes'][3][1])
    r.hover_path(['.enav .it[data-key="A.profile"]', '.enav .it[data-key="A.retrieve"]', '.enav .it[data-key="C.fpl"]', '#panel-A\\.profile .panel-head'], 1500)
    r.end_scene()
    # 5 Fahrtprofil: Daten aufbereiten
    r.scene(4, 'profile', V['scenes'][4][1])
    r.click('#panel-A\\.profile button:has-text("Daten aufbereiten")', wait=500)
    for _ in range(40):
        pg.wait_for_timeout(400)
        if pg.query_selector('#panel-A\\.profile svg.pf-svg'): break
    r.hover_path(['#panel-A\\.profile svg.pf-svg', '#panel-A\\.profile .pf-legend'], 2000)
    r.end_scene()
    # 6 Werkzeug: Punkte und Etappen
    r.scene(5, 'tool', V['scenes'][5][1])
    r.click('#panel-A\\.profile button:has-text("Werkzeug öffnen")', wait=1200)
    pts = pg.evaluate("() => [...document.querySelectorAll('.pf-tool svg .pf-pt')].map(c => [+c.getAttribute('cx'), +c.getAttribute('cy')])")
    svg = pg.query_selector('.pf-tool svg.pf-svg'); box = svg.bounding_box(); sx = box['width'] / 1040; sy = box['height'] / 550
    x0, y0 = box['x'] + pts[1][0] * sx, box['y'] + pts[1][1] * sy
    pg.mouse.move(x0, y0, steps=14); pg.wait_for_timeout(300); pg.mouse.down(); pg.mouse.move(x0 + 60 * sx, y0 - 40 * sy, steps=22); pg.wait_for_timeout(200); pg.mouse.up(); pg.wait_for_timeout(2500)
    pg.mouse.move(box['x'] + 560 * sx, box['y'] + 230 * sy, steps=16); pg.wait_for_timeout(200); pg.mouse.dblclick(box['x'] + 560 * sx, box['y'] + 230 * sy); pg.wait_for_timeout(2200)
    ab = pg.query_selector('.pf-tool svg .pf-axis').bounding_box(); pg.mouse.move(ab['x'] + ab['width'] * 0.55, ab['y'] + ab['height'] / 2, steps=14); pg.wait_for_timeout(200); pg.mouse.click(ab['x'] + ab['width'] * 0.55, ab['y'] + ab['height'] / 2); pg.wait_for_timeout(900)
    mi = pg.query_selector_all('.pf-tool svg .pf-mi[data-kind=stage]')[-1]; mb = mi.bounding_box(); pg.mouse.move(mb['x'] + mb['width'] / 2, mb['y'] + mb['height'] / 2, steps=12); pg.mouse.click(mb['x'] + mb['width'] / 2, mb['y'] + mb['height'] / 2); pg.wait_for_timeout(600)
    pg.fill('.pf-menu input', 'Voralpen'); pg.wait_for_timeout(400); r.click('.pf-menu button:has-text("Umbenennen")', wait=900)
    r.end_scene()
    # 7 Wettermodell und Beispiel
    r.scene(6, 'model', V['scenes'][6][1])
    r.click('.pf-tool .pf-modelbtn', wait=1800); r.hover_path(['.pf-tool .pf-menu button:nth-child(2)', '.pf-tool .pf-menu button:nth-child(4)'], 1000); pg.keyboard.press('Escape'); pg.wait_for_timeout(400)
    r.click('.pf-tool button.pf-sample', wait=1500)
    r.hover_path(['.pf-tool svg .pf-callout', '.pf-tool .pf-callouts li:nth-child(2)', '.pf-tool .pf-callouts li:nth-child(5)'], 1300)
    r.click('.pf-tool button.pf-sample', wait=800)
    r.end_scene()
    # 8 Etappen, Ballast, Kontakte
    r.scene(7, 'ballast', V['scenes'][7][1])
    r.hover_path(['.pf-tool .pf-ballast-wrap .lbl', '.pf-tool table.pf-ballast', '.pf-tool table.pf-stages'], 2200)
    r.click('.pf-tool details.pf-fold.model summary', wait=1500)
    r.end_scene()
    # 9 Briefingsicht
    r.scene(8, 'release', V['scenes'][8][1])
    pg.keyboard.press('Escape'); pg.wait_for_timeout(600)
    r.click('.viewtoggle button:nth-child(2)', wait=1800)
    try: r.move('.brief tr.row-A-profile svg.pf-svg')
    except Exception: pass
    r.end_scene()

def main():
    os.makedirs(OUT, exist_ok=True)
    vdir = os.path.join(OUT, VER + '_video'); shutil.rmtree(vdir, ignore_errors=True)
    with sync_playwright() as p:
        b = p.chromium.launch()
        ctx = b.new_context(viewport={'width': W, 'height': H}, device_scale_factor=1, locale='de-CH', timezone_id='Europe/Zurich', record_video_dir=vdir, record_video_size={'width': W, 'height': H})
        pg = ctx.new_page(); pg.add_init_script(INIT); mock(pg)
        r = Rec(pg); r.t0 = time.time()
        (record_hab if VER == 'hab' else record_gas)(r, pg)
        pg.evaluate('() => window.__dmBanner(0, "")'); pg.wait_for_timeout(300); r.flash(); pg.wait_for_timeout(600)   # Endmarke
        ctx.close(); b.close()
    webm = glob.glob(os.path.join(vdir, '*.webm'))[0]
    json.dump({'video': webm, 'scenes': r.scenes}, open(os.path.join(OUT, VER + '_scenes.json'), 'w'), indent=1)
    print('ok', webm)

main()
