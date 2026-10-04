"""Playwright-Durchlauf im Server-Modus (wrangler dev --local auf 8787, http.server auf 8080):
Login, Ablauf, Editor, Berechtigungs-Link erstellen, Link in neuem Kontext öffnen (Mitarbeit), Änderung sichtbar.
"""
import sys, os, json
from urllib.parse import urlparse, parse_qs
sys.path.insert(0, os.path.dirname(__file__))
from om_fixture import fixture
from as_fixture import airspace_fixture
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
    # Modell- und Luftraumdaten ohne Netz: Fixtures für /api/wx/om und /api/wx/airspace
    pg.route('**/api/wx/om**', lambda r: r.fulfill(status=200, content_type='application/json', body=json.dumps(fixture(parse_qs(urlparse(r.request.url).query).get('query', [''])[0]))))
    pg.route('**/api/wx/airspace**', lambda r: r.fulfill(status=200, content_type='application/json', body=json.dumps(airspace_fixture(parse_qs(urlparse(r.request.url).query).get('bbox', ['8,47,9,48'])[0]))))
    pg.route('**/tile.openstreetmap.org/**', lambda r: r.abort())
    pg.goto(BASE + '#/list'); pg.wait_for_timeout(800)
    assert pg.is_visible('#gate'), 'gate sichtbar'
    assert pg.is_visible('#gateUser'), 'Benutzerfeld im Server-Modus'
    pg.fill('#gateUser', 'bwicki'); pg.fill('#gatePw', '0000'); pg.click('#gateOpen'); pg.wait_for_timeout(600)
    assert pg.is_visible('#gateErr'), 'Fehlermeldung bei falschem Kennwort'
    pg.fill('#gatePw', '1234'); pg.click('#gateOpen'); pg.wait_for_timeout(900)
    assert not pg.is_visible('#gate'), 'eingeloggt'
    pg.click('#menuBtn'); pg.wait_for_timeout(200)
    assert 'Supermaster' in pg.inner_text('#menu'), 'Rolle im Menü: ' + pg.inner_text('#menu')
    pg.keyboard.press('Escape'); pg.click('body', position={'x': 5, 'y': 400}); pg.wait_for_timeout(200)
    assert 'Lokaler' not in pg.inner_text('#modeBadge') if pg.query_selector('#modeBadge') else True
    pg.goto(BASE + '#/new'); pg.wait_for_timeout(700)
    for i in range(5):
        pg.click('button:has-text("Weiter →")'); pg.wait_for_timeout(900)
    pg.click('button:has-text("Briefing anlegen")'); pg.wait_for_timeout(1500)
    bid = pg.evaluate('location.hash').split('/')[-1]
    print('briefing', bid)
    # Text ins Pflicht-Panel und speichern
    pg.fill('#panel-B\\.fwp .pastewrap textarea', 'Flugwetterprognose MeteoSchweiz: Hochdrucklage.'); pg.wait_for_timeout(1500)
    # DABS: Worker-Antwort und PDF simulieren (Netz im Test gesperrt), Seiten werden mit pdf.js gerendert und hochgeladen
    PDF = os.environ.get('TEST_PDF', os.path.join(OUT, 'desktop_brief.pdf'))
    pg.route('**/api/wx/dabs**', lambda r: r.fulfill(status=200, content_type='application/json', body='{"url":"/files/test/dabs.pdf","key":"test/dabs.pdf","day":"tomorrow","date":"2026-10-05","fetched":1}'))
    pg.route('**/files/test/dabs.pdf', lambda r: r.fulfill(status=200, content_type='application/pdf', body=open(PDF, 'rb').read()))
    pg.click('#panel-C\\.dabs button:has-text("Laden")'); pg.wait_for_timeout(6000)
    dabs_txt = pg.inner_text('#panel-C\\.dabs')
    assert 'Seite 1/' in dabs_txt, 'DABS-Seiten als Bilder: ' + dabs_txt[:200]
    assert pg.query_selector('#panel-C\\.dabs img.pimg') is not None, 'DABS-Bild'
    pg.screenshot(path=f'{OUT}/remote_dabs.png')
    # Luftraum entlang des Fahrtwegs (openAIP-Fixture): lädt im Server-Modus von selbst, sonst «Laden»
    pg.wait_for_timeout(2500)
    if 'TEST CTR' not in pg.inner_text('#panel-C\\.airspace'): pg.click('#panel-C\\.airspace button:has-text("Laden")'); pg.wait_for_timeout(3000)
    as_txt = pg.inner_text('#panel-C\\.airspace')
    assert 'TEST CTR' in as_txt and 'SWITZERLAND FIR' in as_txt and 'LANGEN FIR' in as_txt, 'Luftraum-Panel: ' + as_txt[:300]
    assert 'oberhalb' in as_txt and 'TEST TMA 4' not in as_txt, 'TMA über Maximalhöhe eingeklappt: ' + as_txt[:300]
    pg.click('#panel-C\\.airspace details summary'); pg.wait_for_timeout(200)
    assert 'TEST TMA 4' in pg.inner_text('#panel-C\\.airspace'), 'TMA nach Aufklappen sichtbar'
    assert pg.query_selector('#panel-C\\.airspace table.as-tbl tr.as-cross') is not None, 'durchfahrener Luftraum in Tabelle'
    assert pg.query_selector('#panel-C\\.airspace .as-map .leaflet-overlay-pane path') is not None, 'Polygone auf der Karte'
    pg.query_selector('#panel-C\\.airspace').screenshot(path=f'{OUT}/remote_airspace.png')
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
    if pg.query_selector('.dialog textarea'): pg.fill('.dialog textarea', 'Test: DABS/NOTAM folgen')   # nur bei fehlenden Pflicht-Panels (DABS lädt seit 0.6 von selbst)
    pg.click('.dialog-foot button.primary'); pg.wait_for_timeout(1500)
    assert 'Final v1' in pg.inner_text('#subtitle'), 'Final v1 im Kopf: ' + pg.inner_text('#subtitle')
    # Zweiter Kontext: Mitarbeit-Link
    c2 = b.new_context(viewport={'width': 820, 'height': 1180}, locale='de-CH', timezone_id='Europe/Zurich')
    p2 = c2.new_page()
    p2.on('pageerror', lambda e: errors.append(f'[link] pageerror: {e}'))
    p2.route('**/js/config.js', lambda r: r.fulfill(status=200, content_type='application/javascript', body=f"window.BRIEFING_CONFIG = {{ apiBase: '{API}' }};"))
    p2.goto(link); p2.wait_for_timeout(1200)
    p2.screenshot(path=f'{OUT}/remote_link_name.png')
    p2.fill('#view input[type=text]', 'Martin Baumann'); p2.click('button:has-text("Weiter")'); p2.wait_for_timeout(1500)
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
    row = pg.query_selector('.frow:has-text("Open-Meteo API key")')
    inp = row.query_selector('input'); inp.fill('key-sichtbar-123')
    assert inp.get_attribute('type') == 'password', 'Eingabe verdeckt'
    row.query_selector('button.eye').click(); pg.wait_for_timeout(200)
    assert inp.get_attribute('type') == 'text', 'Auge zeigt Eingabe'
    row.query_selector('button:has-text("Speichern")').click(); pg.wait_for_timeout(1200)
    row = pg.query_selector('.frow:has-text("Open-Meteo API key")'); inp = row.query_selector('input')
    assert inp.input_value() == '', 'Feld nach Speichern leer'
    row.query_selector('button.eye').click(); pg.wait_for_timeout(1000)
    assert inp.input_value() == 'key-sichtbar-123' and inp.get_attribute('type') == 'text', 'gespeicherter Wert wird nachgeladen und angezeigt: ' + inp.input_value()
    row.query_selector('button.eye').click(); pg.wait_for_timeout(200)
    assert inp.input_value() == '' and inp.get_attribute('type') == 'password', 'Verbergen leert nachgeladenen Wert'
    pg.screenshot(path=f'{OUT}/remote_settings_access.png', full_page=True)

    # ---- Mehrbenutzer: Super legt Master «mtest» an (Stamm kopiert, ohne KI) und gibt Ballone + Startplätze frei
    pg.goto(BASE + '#/settings?users'); pg.wait_for_timeout(1200)
    pg.screenshot(path=f'{OUT}/remote_users_empty.png', full_page=True)
    assert 'Neuer Benutzer' in pg.inner_text('#view'), 'Admin-Formular sichtbar'
    box = pg.query_selector('.item-box:has-text("Neuer Benutzer")')
    inputs = box.query_selector_all('input')
    inputs[0].fill('mtest'); inputs[1].fill('Max Test'); inputs[2].fill('abcd')
    box.query_selector_all('select')[1].select_option('bwicki')
    box.query_selector('label.check:has-text("KI") input').uncheck()
    box.query_selector('button:has-text("Anlegen")').click(); pg.wait_for_timeout(1500)
    assert 'Max Test' in pg.inner_text('table.tbl'), 'Benutzer in Liste: ' + pg.inner_text('table.tbl')[:300]
    row = pg.query_selector('.share-row:has-text("Max Test")')
    assert row is not None, 'Freigabe-Zeile für mtest'
    row.query_selector('label.check:has-text("Ballone") input').check(); pg.wait_for_timeout(600)
    row.query_selector('label.check:has-text("Startplätze") input').check(); pg.wait_for_timeout(600)
    pg.screenshot(path=f'{OUT}/remote_users.png', full_page=True)
    # Statistik-Seite
    pg.goto(BASE + '#/settings?stats'); pg.wait_for_timeout(1500)
    st = pg.inner_text('#view').upper()
    assert 'JE BENUTZER UND MONAT' in st and 'ANMELDUNGEN' in st, 'Statistik: ' + st[:200]
    pg.screenshot(path=f'{OUT}/remote_stats.png', full_page=True)
    # Sperren → neuer Benutzer meldet sich an
    pg.click('#menuBtn'); pg.click('#menu button:has-text("Sperren")'); pg.wait_for_timeout(500)
    assert pg.is_visible('#gate'), 'gesperrt'
    assert pg.input_value('#gateUser') == 'bwicki', 'letzter Benutzer vorgeschlagen'
    pg.fill('#gateUser', 'mtest'); pg.fill('#gatePw', 'abcd'); pg.click('#gateOpen'); pg.wait_for_timeout(1200)
    assert not pg.is_visible('#gate'), 'mtest eingeloggt'
    pg.goto(BASE + '#/list'); pg.wait_for_timeout(800)
    lst = pg.inner_text('#view')
    assert 'Keine Briefings' in lst or 'test0000' not in lst, 'mtest sieht keine fremden Briefings'
    assert 'Alle Benutzer' not in lst, 'Master hat keine Sicht «Alle Benutzer»'
    assert 'Ballone' in lst and 'Von anderen erhalten' in lst, 'erhaltene Freigabe in Stammkarte: ' + lst[-300:]
    # Zugänge nur lesend
    pg.goto(BASE + '#/settings?access'); pg.wait_for_timeout(900)
    assert 'nur der Supermaster' in pg.inner_text('#view'), 'Zugänge read-only für Master'
    # Neues Briefing mit freigegebenem Ballon (Eintrag «(B. Wicki)»)
    pg.goto(BASE + '#/new'); pg.wait_for_timeout(900)
    sel = pg.query_selector('select')
    opts = [o.inner_text() for o in sel.query_selector_all('option')]
    shared_opts = [o for o in opts if '(B. Wicki)' in o or '(Balthasar' in o]
    assert shared_opts, 'freigegebene Ballone im Auswahlfeld: ' + ', '.join(opts)
    sel.select_option(label=shared_opts[0]); pg.wait_for_timeout(600)
    pg.screenshot(path=f'{OUT}/remote_wizard_shared.png')
    for i in range(5):
        pg.click('button:has-text("Weiter →")'); pg.wait_for_timeout(700)
    pg.click('button:has-text("Briefing anlegen")'); pg.wait_for_timeout(1500)
    bid2 = pg.evaluate('location.hash').split('/')[-1]; print('briefing mtest', bid2)
    assert pg.query_selector('button:has-text("KI")') is None or 'KI fragen' not in pg.inner_text('#view'), 'KI-Knöpfe für mtest ausgeblendet'
    # Super meldet sich wieder an: Sicht «Fahrten mit meinem Material» und «Alle Benutzer», fremdes Briefing nur lesen
    pg.click('#menuBtn'); pg.click('#menu button:has-text("Sperren")'); pg.wait_for_timeout(400)
    pg.fill('#gateUser', 'bwicki'); pg.fill('#gatePw', '1234'); pg.click('#gateOpen'); pg.wait_for_timeout(1200)
    pg.goto(BASE + '#/list?scope=material'); pg.wait_for_timeout(1000)
    assert 'Max Test' in pg.inner_text('#view'), 'Material-Sicht zeigt Briefing von Max Test: ' + pg.inner_text('#view')[:300]
    pg.screenshot(path=f'{OUT}/remote_list_material.png')
    pg.click('button.chip:has-text("Alle Benutzer")'); pg.wait_for_timeout(900)
    assert 'Max Test' in pg.inner_text('table') and 'B. Wicki' in pg.inner_text('table'), 'Alle-Sicht'
    pg.goto(BASE + f'#/b/{bid2}'); pg.wait_for_timeout(1200)
    assert pg.evaluate('location.hash').startswith('#/v/'), 'fremdes Briefing wird zur Briefingsicht umgeleitet: ' + pg.evaluate('location.hash')
    assert 'Nur lesen' in pg.inner_text('#subtitle'), 'Nur-lesen-Hinweis: ' + pg.inner_text('#subtitle')
    assert pg.query_selector('.viewtoggle button:has-text("Erarbeitung")') is None, 'kein Bearbeiten-Umschalter'
    pg.screenshot(path=f'{OUT}/remote_foreign_view.png')
    # ---- Material-Link für Externe: bwicki erstellt Link für HB-QWP, Externer sieht eigene + fremde Briefings mit HB-QWP
    pg.goto(BASE + '#/settings?users'); pg.wait_for_timeout(1200)
    card = pg.query_selector('.card:has(button:has-text("Material-Link erstellen"))')
    assert card is not None, 'Material-Link-Karte'
    card.query_selector('input[type=text]').fill('Halter Extern')
    card.query_selector('label.check:has-text("HB-QWP") input').check()
    card.query_selector('button:has-text("Material-Link erstellen")').click(); pg.wait_for_timeout(1200)
    mlink = card.query_selector('.item-box .mono').inner_text().strip(); print('material link', mlink)
    assert '#/m/' in mlink, 'Material-Link-URL'
    pg.screenshot(path=f'{OUT}/remote_material_links.png', full_page=True)
    c3 = b.new_context(viewport={'width': 390, 'height': 844}, locale='de-CH', timezone_id='Europe/Zurich')
    p3 = c3.new_page()
    p3.on('pageerror', lambda e: errors.append(f'[material] pageerror: {e}'))
    p3.route('**/js/config.js', lambda r: r.fulfill(status=200, content_type='application/javascript', body=f"window.BRIEFING_CONFIG = {{ apiBase: '{API}' }};"))
    p3.goto(mlink); p3.wait_for_timeout(1500)
    txt = p3.inner_text('#view')
    assert 'HB-QWP' in txt and 'Max Test' in txt, 'Material-Liste zeigt fremdes Briefing mit HB-QWP: ' + txt[:300]
    assert not p3.is_visible('#gate'), 'kein Kennwort für Material-Link'
    p3.screenshot(path=f'{OUT}/remote_material_list.png', full_page=True)
    p3.click('a.bcard >> nth=0'); p3.wait_for_timeout(1500)
    assert p3.evaluate('location.hash').startswith('#/m/'), 'Briefingsicht unter #/m/: ' + p3.evaluate('location.hash')
    assert 'Fahrtbriefing' in p3.inner_text('.brief'), 'Briefingsicht gerendert'
    assert p3.query_selector('.viewtoggle button:has-text("Erarbeitung")') is None, 'Material-Link nur lesen'
    p3.screenshot(path=f'{OUT}/remote_material_view.png')
    p3.click('button:has-text("Pax-Sicherheitskarte")'); p3.wait_for_timeout(1000)
    assert p3.evaluate('location.hash').endswith('/p'), 'Pax-Karte unter Material-Link: ' + p3.evaluate('location.hash')
    b.close()
print('\n'.join(errors) if errors else 'OK – keine Seitenfehler')
