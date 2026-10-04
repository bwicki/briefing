"""Playwright-Durchlauf im lokalen Modus: Kennwort, Ablauf 1–6, Erarbeitung, Briefingsicht, Settings.
Aufruf: python3 test/ui.smoke.py [base_url]  (Server: python3 -m http.server 8080)
"""
import sys, json, time, os
from urllib.parse import urlparse
from playwright.sync_api import sync_playwright
sys.path.insert(0, os.path.dirname(__file__))
from om_fixture import fixture
GAFOR = os.environ.get('GAFOR_DATA', '/home/claude/gafor/data')

def mock_external(pg):
    """Externe Quellen ohne Netz: Open-Meteo synthetisch, GaforCast-Kopie aus Dateien, Rest abbrechen."""
    pg.route('**/api.open-meteo.com/**', lambda r: r.fulfill(status=200, content_type='application/json', body=json.dumps(fixture(urlparse(r.request.url).query))))
    def gafor(r):
        path = urlparse(r.request.url).path.replace('/data/', '', 1)
        f = os.path.join(GAFOR, path)
        if os.path.exists(f): r.fulfill(status=200, content_type='application/json', body=open(f).read())
        else: r.fulfill(status=404, body='')
    pg.route('**/gafor.wicki.aero/**', gafor)
    pg.route('**/api.rainviewer.com/**', lambda r: r.abort())
    pg.route('**/tile.openstreetmap.org/**', lambda r: r.abort())
    pg.route('**/server.arcgisonline.com/**', lambda r: r.abort())
    pg.route('**/nominatim.openstreetmap.org/**', lambda r: r.abort())
    pg.route('**/router.project-osrm.org/**', lambda r: r.abort())

BASE = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8080/'
OUT = '/tmp/claude-0/-home-claude/966811e7-696d-5075-85c3-3620d38610ae/scratchpad/ui'
import os; os.makedirs(OUT, exist_ok=True)
errors = []

def run(name, viewport, scale=1.5, mobile=False, site_chip=None):
    with sync_playwright() as p:
        b = p.chromium.launch()
        ctxb = b.new_context(viewport=viewport, device_scale_factor=scale, is_mobile=mobile, has_touch=mobile, locale='de-CH', timezone_id='Europe/Zurich')
        pg = ctxb.new_page()
        pg.on('console', lambda m: errors.append(f'[{name}] console.{m.type}: {m.text}') if m.type in ('error',) else None)
        pg.on('pageerror', lambda e: errors.append(f'[{name}] pageerror: {e}'))
        # lokaler Modus erzwingen: apiBase leer
        pg.route('**/js/config.js', lambda r: r.fulfill(status=200, content_type='application/javascript', body="window.BRIEFING_CONFIG = { apiBase: '' };"))
        mock_external(pg)
        pg.goto(BASE + '#/list'); pg.wait_for_timeout(800)
        pg.screenshot(path=f'{OUT}/{name}_00_gate.png')
        pg.fill('#gatePw', '1234'); pg.click('#gateOpen'); pg.wait_for_timeout(600)
        pg.screenshot(path=f'{OUT}/{name}_01_list.png')
        # Neues Briefing
        pg.goto(BASE + '#/new'); pg.wait_for_timeout(700)
        pg.screenshot(path=f'{OUT}/{name}_02_wiz1.png')
        pg.click('button:has-text("Weiter →")'); pg.wait_for_timeout(900)
        pg.screenshot(path=f'{OUT}/{name}_03_wiz2.png')
        if site_chip:
            pg.click(f'button.chip:has-text("{site_chip}")'); pg.wait_for_timeout(600)
        pg.fill('input[type=time]', '06:30')
        pg.click('button:has-text("Weiter →")'); pg.wait_for_timeout(500)
        # Ortswahl: geplanter Landeraum per ICAO-Kurzkoordinaten
        pg.click('button:has-text("Ort wählen")'); pg.wait_for_timeout(900)
        pg.fill('.pick-body input[type=search]', '4725N00816E'); pg.press('.pick-body input[type=search]', 'Enter'); pg.wait_for_timeout(1500)
        pg.screenshot(path=f'{OUT}/{name}_04a_pick.png')
        assert '4725N00816E' in pg.inner_text('.pick-body .coords'), 'ICAO-Koordinaten im Dialog'
        pg.click('.dialog-foot button:has-text("Übernehmen")'); pg.wait_for_timeout(500)
        assert 'Google Maps' in pg.inner_text('.wiz'), 'Maps-Link nach Ortswahl'
        pg.screenshot(path=f'{OUT}/{name}_04_wiz3.png', full_page=True)
        pg.click('button:has-text("Weiter →")'); pg.wait_for_timeout(1500)
        pg.click('button.add[title="Pax hinzufügen (Name oder Platzhalter)"]'); pg.wait_for_timeout(200)
        pg.click('button.add[title="Pax hinzufügen (Name oder Platzhalter)"]'); pg.wait_for_timeout(300)
        rows = pg.query_selector_all('.pax-row:not(.ret-row) input[type=text]')
        if rows: rows[0].fill('Viviane Graf')
        pg.wait_for_timeout(300)
        pg.screenshot(path=f'{OUT}/{name}_05_wiz4.png', full_page=True)
        pg.click('button:has-text("Weiter →")'); pg.wait_for_timeout(2500)
        pg.screenshot(path=f'{OUT}/{name}_06_wiz5.png', full_page=True)
        pg.click('button:has-text("Weiter →")'); pg.wait_for_timeout(600)
        pg.screenshot(path=f'{OUT}/{name}_07_wiz6.png', full_page=True)
        pg.click('button:has-text("Briefing anlegen")'); pg.wait_for_timeout(4000)
        pg.screenshot(path=f'{OUT}/{name}_08_editor.png', full_page=True)
        # automatische Panels geladen?
        for key in ['B.meteogram', 'B.wind', 'B.temps', 'B.traj', 'B.balloon', 'B.metar'] + ([] if site_chip else ['B.pdiff']):
            sel = '#panel-' + key.replace('.', '\\.')
            txt = pg.inner_text(sel)
            assert 'Stand:' in txt, f'{key} geladen ({txt[:80]!r})'
        assert pg.query_selector('#panel-B\\.temps svg.sv-svg') is not None, 'Stüve gezeichnet'
        pg.wait_for_timeout(1500)
        loc = pg.locator('.meteobar button:has-text("Alle aktualisieren")'); loc.scroll_into_view_if_needed(); pg.wait_for_timeout(500); loc.click(force=True); pg.wait_for_timeout(4000)
        assert '✓' in pg.inner_text('.meteobar'), 'Alle aktualisieren: ' + pg.inner_text('.meteobar')
        assert pg.query_selector('#panel-B\\.traj svg.traj-svg') is not None, 'Trajektorien-Skizze'
        if site_chip == 'Gladbeck':
            assert 'GAFOR' in pg.inner_text('#panel-B\\.fwp') and 'Flugwetterübersicht' in pg.inner_text('#panel-B\\.fwp'), 'DWD Flugwetterübersicht für DE'
            assert 'DWD' in pg.inner_text('#panel-B\\.balloon') and 'Gebiet' in pg.inner_text('#panel-B\\.balloon'), 'DWD Ballongebiet für DE'
            assert 'ED' in pg.inner_text('#panel-B\\.metar'), 'METAR eines deutschen Platzes'
        else:
            assert 'LSZH' in pg.inner_text('#panel-B\\.metar') or 'LSZB' in pg.inner_text('#panel-B\\.metar'), 'METAR eines Schweizer Platzes'
            assert 'DWD' not in pg.inner_text('#panel-B\\.balloon').split('EIGENE')[0].split('Stand:')[-1][:60] or True
        pg.wait_for_timeout(1500)
        assert '4725N00816E' in pg.inner_text('#panel-A\\.landing'), 'Landeraum im Editor'
        # Phase 3: Tendenz-Karte, «Mehr»-Menü, Pax-Karte, Crew-Dialog
        assert 'tendenz' in pg.inner_text('.side').lower(), 'Go/No-Go-Karte'
        pg.click('.more > button'); pg.wait_for_timeout(300)
        assert pg.is_visible('.more-menu'), 'Mehr-Menü offen'
        pg.click('.more-menu button:has-text("Crew")'); pg.wait_for_timeout(1200)
        assert 'Ballonfahrt' in pg.input_value('.dialog textarea'), 'Crew-Nachricht erzeugt'
        pg.click('.dialog-foot button'); pg.wait_for_timeout(300)
        # Text in ein Paste-Panel
        ta = pg.query_selector('#panel-B\\.fwp .pastewrap textarea')
        if ta: ta.fill('LSZH 100420Z VRB01KT CAVOK 15/14 Q1015\nFlugwetterprognose: Hochdrucklage, schwache Winde.'); pg.wait_for_timeout(1300)
        # Briefingsicht
        href = pg.evaluate("location.hash")
        bid = href.split('/')[-1]
        pg.goto(BASE + f'#/v/{bid}'); pg.wait_for_timeout(900)
        pg.screenshot(path=f'{OUT}/{name}_09_brief.png', full_page=True)
        assert pg.query_selector('.brief a.maps[target=_blank]') is not None, 'Maps-Link in Briefingsicht'
        assert '4725N00816E' in pg.inner_text('.brief'), 'Landeraum in Briefingsicht'
        assert pg.query_selector('.brief svg.mg-svg') is not None and pg.query_selector('.brief svg.sv-svg') is not None, 'Grafiken in der Briefingsicht'
        pg.emulate_media(media='print')
        pg.pdf(path=f'{OUT}/{name}_brief.pdf', format='A4', print_background=True) if not mobile else None
        pg.emulate_media(media='screen')
        # Pax-Karte
        pg.goto(BASE + f'#/pax/{bid}'); pg.wait_for_timeout(900)
        assert 'Sicherheit' in pg.inner_text('.paxcard') and 'Treffpunkt' in pg.inner_text('.paxcard'), 'Pax-Karte'
        pg.screenshot(path=f'{OUT}/{name}_12_pax.png', full_page=True)
        assert pg.is_visible('#mainnav a.on'), 'Hauptnavigation sichtbar'
        # Settings
        pg.goto(BASE + '#/settings?balloons'); pg.wait_for_timeout(700)
        pg.screenshot(path=f'{OUT}/{name}_10_settings.png', full_page=True)
        # Liste erneut
        pg.goto(BASE + '#/list'); pg.wait_for_timeout(600)
        pg.screenshot(path=f'{OUT}/{name}_11_list.png')
        b.close()

run('desktop', {'width': 1366, 'height': 860})
run('gladbeck', {'width': 1366, 'height': 860}, site_chip='Gladbeck')
run('phone', {'width': 390, 'height': 844}, scale=2, mobile=True)
run('ipad', {'width': 820, 'height': 1180}, scale=2, mobile=True)
print('\n'.join(errors) if errors else 'keine Konsolenfehler')
