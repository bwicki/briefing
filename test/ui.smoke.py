"""Playwright-Durchlauf im lokalen Modus: Kennwort, Ablauf 1–6, Erarbeitung, Briefingsicht, Settings.
Aufruf: python3 test/ui.smoke.py [base_url]  (Server: python3 -m http.server 8080)
"""
import sys, json, time
from playwright.sync_api import sync_playwright

BASE = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8080/'
OUT = '/tmp/claude-0/-home-claude/966811e7-696d-5075-85c3-3620d38610ae/scratchpad/ui'
import os; os.makedirs(OUT, exist_ok=True)
errors = []

def run(name, viewport, scale=1.5, mobile=False):
    with sync_playwright() as p:
        b = p.chromium.launch()
        ctxb = b.new_context(viewport=viewport, device_scale_factor=scale, is_mobile=mobile, has_touch=mobile, locale='de-CH', timezone_id='Europe/Zurich')
        pg = ctxb.new_page()
        pg.on('console', lambda m: errors.append(f'[{name}] console.{m.type}: {m.text}') if m.type in ('error',) else None)
        pg.on('pageerror', lambda e: errors.append(f'[{name}] pageerror: {e}'))
        # lokaler Modus erzwingen: apiBase leer
        pg.route('**/js/config.js', lambda r: r.fulfill(status=200, content_type='application/javascript', body="window.BRIEFING_CONFIG = { apiBase: '' };"))
        pg.goto(BASE + '#/list'); pg.wait_for_timeout(800)
        pg.screenshot(path=f'{OUT}/{name}_00_gate.png')
        pg.fill('#gatePw', '1234'); pg.click('#gateOpen'); pg.wait_for_timeout(600)
        pg.screenshot(path=f'{OUT}/{name}_01_list.png')
        # Neues Briefing
        pg.goto(BASE + '#/new'); pg.wait_for_timeout(700)
        pg.screenshot(path=f'{OUT}/{name}_02_wiz1.png')
        pg.click('button:has-text("Weiter →")'); pg.wait_for_timeout(900)
        pg.screenshot(path=f'{OUT}/{name}_03_wiz2.png')
        pg.fill('input[type=time]', '06:30')
        pg.click('button:has-text("Weiter →")'); pg.wait_for_timeout(500)
        pg.screenshot(path=f'{OUT}/{name}_04_wiz3.png')
        pg.click('button:has-text("Weiter →")'); pg.wait_for_timeout(1500)
        pg.click('button:has-text("Pax hinzufügen")'); pg.wait_for_timeout(200)
        pg.click('button:has-text("Pax hinzufügen")'); pg.wait_for_timeout(300)
        rows = pg.query_selector_all('.pax-row input[type=text]')
        if rows: rows[0].fill('Viviane Graf')
        pg.wait_for_timeout(300)
        pg.screenshot(path=f'{OUT}/{name}_05_wiz4.png', full_page=True)
        pg.click('button:has-text("Weiter →")'); pg.wait_for_timeout(2500)
        pg.screenshot(path=f'{OUT}/{name}_06_wiz5.png', full_page=True)
        pg.click('button:has-text("Weiter →")'); pg.wait_for_timeout(600)
        pg.screenshot(path=f'{OUT}/{name}_07_wiz6.png', full_page=True)
        pg.click('button:has-text("Briefing anlegen")'); pg.wait_for_timeout(1200)
        pg.screenshot(path=f'{OUT}/{name}_08_editor.png', full_page=True)
        # Text in ein Paste-Panel
        ta = pg.query_selector('#panel-B\\.fwp textarea')
        if ta: ta.fill('LSZH 100420Z VRB01KT CAVOK 15/14 Q1015\nFlugwetterprognose: Hochdrucklage, schwache Winde.'); pg.wait_for_timeout(1300)
        # Briefingsicht
        href = pg.evaluate("location.hash")
        bid = href.split('/')[-1]
        pg.goto(BASE + f'#/v/{bid}'); pg.wait_for_timeout(900)
        pg.screenshot(path=f'{OUT}/{name}_09_brief.png', full_page=True)
        pg.emulate_media(media='print')
        pg.pdf(path=f'{OUT}/{name}_brief.pdf', format='A4', print_background=True) if not mobile else None
        pg.emulate_media(media='screen')
        # Settings
        pg.goto(BASE + '#/settings?balloons'); pg.wait_for_timeout(700)
        pg.screenshot(path=f'{OUT}/{name}_10_settings.png', full_page=True)
        # Liste erneut
        pg.goto(BASE + '#/list'); pg.wait_for_timeout(600)
        pg.screenshot(path=f'{OUT}/{name}_11_list.png')
        b.close()

run('desktop', {'width': 1366, 'height': 860})
run('phone', {'width': 390, 'height': 844}, scale=2, mobile=True)
run('ipad', {'width': 820, 'height': 1180}, scale=2, mobile=True)
print('\n'.join(errors) if errors else 'keine Konsolenfehler')
