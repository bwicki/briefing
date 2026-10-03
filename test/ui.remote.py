"""Playwright-Durchlauf im Server-Modus (wrangler dev --local auf 8787, http.server auf 8080):
Login, Ablauf, Editor, Berechtigungs-Link erstellen, Link in neuem Kontext öffnen (Mitarbeit), Änderung sichtbar.
"""
import sys, os
from playwright.sync_api import sync_playwright
BASE = 'http://localhost:8080/'; API = 'http://localhost:8787'
OUT = '/tmp/claude-0/-home-claude/966811e7-696d-5075-85c3-3620d38610ae/scratchpad/ui'; os.makedirs(OUT, exist_ok=True)
errors = []
with sync_playwright() as p:
    b = p.chromium.launch()
    c1 = b.new_context(viewport={'width': 1366, 'height': 860}, locale='de-CH', timezone_id='Europe/Zurich')
    pg = c1.new_page()
    pg.on('console', lambda m: errors.append(f'console.{m.type}: {m.text}') if m.type == 'error' and 'ERR_TUNNEL' not in m.text else None)
    pg.on('pageerror', lambda e: errors.append(f'pageerror: {e}'))
    pg.route('**/js/config.js', lambda r: r.fulfill(status=200, content_type='application/javascript', body=f"window.BRIEFING_CONFIG = {{ apiBase: '{API}' }};"))
    pg.goto(BASE + '#/list'); pg.wait_for_timeout(800)
    assert pg.is_visible('#gate'), 'gate sichtbar'
    pg.fill('#gatePw', '0000'); pg.click('#gateOpen'); pg.wait_for_timeout(600)
    assert pg.is_visible('#gateErr'), 'Fehlermeldung bei falschem Kennwort'
    pg.fill('#gatePw', '1234'); pg.click('#gateOpen'); pg.wait_for_timeout(900)
    assert not pg.is_visible('#gate'), 'eingeloggt'
    assert 'Lokaler' not in pg.inner_text('#modeBadge') if pg.query_selector('#modeBadge') else True
    pg.goto(BASE + '#/new'); pg.wait_for_timeout(700)
    for i in range(5):
        pg.click('button:has-text("Weiter →")'); pg.wait_for_timeout(900)
    pg.click('button:has-text("Briefing anlegen")'); pg.wait_for_timeout(1500)
    bid = pg.evaluate('location.hash').split('/')[-1]
    print('briefing', bid)
    # Text ins Pflicht-Panel und speichern
    pg.fill('#panel-B\\.fwp textarea', 'Flugwetterprognose MeteoSchweiz: Hochdrucklage.'); pg.wait_for_timeout(1500)
    # Berechtigungen
    pg.click('button:has-text("Berechtigungen")'); pg.wait_for_timeout(800)
    pg.click('button:has-text("Person hinzufügen")'); pg.wait_for_timeout(1200)
    link_el = pg.query_selector('.item-box .mono')
    link = link_el.inner_text().strip(); print('link', link)
    pg.screenshot(path=f'{OUT}/remote_access.png')
    pg.keyboard.press('Escape'); pg.click('.dialog-foot button'); pg.wait_for_timeout(300)
    # Freigabe mit fehlenden Pflicht-Panels → Dialog
    pg.click('button:has-text("Freigeben als Final")'); pg.wait_for_timeout(600)
    pg.screenshot(path=f'{OUT}/remote_release.png')
    assert pg.is_visible('.dialog'), 'Freigabe-Dialog'
    pg.fill('.dialog textarea', 'Test: DABS/NOTAM folgen'); pg.click('.dialog-foot button.primary'); pg.wait_for_timeout(1500)
    assert 'Final v1' in pg.inner_text('#subtitle'), 'Final v1 im Kopf: ' + pg.inner_text('#subtitle')
    # Zweiter Kontext: Mitarbeit-Link
    c2 = b.new_context(viewport={'width': 820, 'height': 1180}, locale='de-CH', timezone_id='Europe/Zurich')
    p2 = c2.new_page()
    p2.on('pageerror', lambda e: errors.append(f'[link] pageerror: {e}'))
    p2.route('**/js/config.js', lambda r: r.fulfill(status=200, content_type='application/javascript', body=f"window.BRIEFING_CONFIG = {{ apiBase: '{API}' }};"))
    p2.goto(link); p2.wait_for_timeout(1200)
    p2.screenshot(path=f'{OUT}/remote_link_name.png')
    p2.fill('input[type=text]', 'Martin Baumann'); p2.click('button:has-text("Weiter")'); p2.wait_for_timeout(1500)
    p2.screenshot(path=f'{OUT}/remote_link_editor.png')
    assert 'Mitarbeit' in p2.inner_text('#subtitle'), 'Mitarbeit-Rolle im Kopf: ' + p2.inner_text('#subtitle')
    p2.fill('#panel-A\\.landing textarea', 'Raum Wohlen – Bremgarten'); p2.wait_for_timeout(1800)
    # Owner lädt neu und sieht die Änderung
    pg.goto(BASE + f'#/b/{bid}'); pg.reload(); pg.wait_for_timeout(1500)
    val = pg.input_value('#panel-A\\.landing textarea')
    assert 'Wohlen' in val, 'Änderung via Link sichtbar: ' + val
    assert 'Martin Baumann (Link)' in pg.inner_text('#subtitle'), 'Autor im Kopf: ' + pg.inner_text('#subtitle')
    # Briefingsicht via Link (Lesen)
    p2.goto(link + '/v'); p2.wait_for_timeout(1000)
    p2.screenshot(path=f'{OUT}/remote_link_brief.png', full_page=True)
    # Liste zeigt Link-Zähler
    pg.goto(BASE + '#/list'); pg.wait_for_timeout(900)
    assert '🔗 1' in pg.inner_text('table'), 'Link-Zähler in Liste'
    pg.screenshot(path=f'{OUT}/remote_list.png')
    # Settings: Zugänge
    pg.goto(BASE + '#/settings?access'); pg.wait_for_timeout(900)
    pg.click('summary:has-text("Zugänge")'); pg.wait_for_timeout(400)
    pg.screenshot(path=f'{OUT}/remote_settings_access.png', full_page=True)
    b.close()
print('\n'.join(errors) if errors else 'OK – keine Seitenfehler')
