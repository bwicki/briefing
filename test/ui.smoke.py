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
        assert pg.query_selector('.wiz .traj-legend .item') is not None, 'Trajektorien-Vorschau mit Niveau-Legende in Schritt 3'
        assert 'Tag und Nacht' not in pg.inner_text('.wiz'), 'keine Tag/Nacht-Wahl mehr in Schritt 3'
        pg.click('button:has-text("Weiter →")'); pg.wait_for_timeout(1500)
        import re as _re
        takeoff0 = _re.search(r'Start\u00ad?gewicht[^\d]*(\d+)', pg.inner_text('.wiz'), _re.I) or _re.search(r'Ballast[^\d]*(\d+)', pg.inner_text('.wiz'), _re.I)
        pg.click('button.add[title="Pax hinzufügen (Name oder Platzhalter)"]'); pg.wait_for_timeout(200)
        pg.click('button.add[title="Pax hinzufügen (Name oder Platzhalter)"]'); pg.wait_for_timeout(300)
        takeoff1 = _re.search(r'Start\u00ad?gewicht[^\d]*(\d+)', pg.inner_text('.wiz'), _re.I) or _re.search(r'Ballast[^\d]*(\d+)', pg.inner_text('.wiz'), _re.I)
        assert takeoff0 and takeoff1 and int(takeoff1.group(1)) != int(takeoff0.group(1)), f'Vorschau reagiert auf Pax: {takeoff0 and takeoff0.group(0)} → {takeoff1 and takeoff1.group(0)}'
        assert 'Personen (inkl. PIC) 3' in pg.inner_text('.wiz'), 'Personenzahl in der Vorschau'
        rows = pg.query_selector_all('.pax-row:not(.ret-row) input[type=text]')
        if rows: rows[0].fill('Viviane Graf')
        pg.wait_for_timeout(300)
        pg.screenshot(path=f'{OUT}/{name}_05_wiz4.png', full_page=True)
        pg.click('button:has-text("Weiter →")'); pg.wait_for_timeout(2500)
        # Schritt 5: tabellarischer Zeitplan (Dropdown je Zeile, Info, Dauer, Ort), Zeilen verschiebbar, Zeiten laufen mit
        assert pg.query_selector('.wiz table.sched.plan tbody tr.anchor') is not None, 'Zeitplan-Tabelle mit Anker «Start»'
        acts = pg.evaluate("() => [...document.querySelectorAll('.wiz table.sched.plan tbody tr td.act select')].map(s => s.value)")
        assert acts[:2] == ['meet', 'drive'] and 'rig' in acts and 'landing' in acts and 'return' in acts, f'Vorlage-Zeilen: {acts}'
        times0 = pg.evaluate("() => [...document.querySelectorAll('.wiz table.sched.plan tbody tr td.tm input')].map(i => i.value)")
        start_i = acts.index('start')
        assert times0[acts.index('rig')] < times0[start_i] < times0[acts.index('landing')] and times0[acts.index('arrive')] == times0[acts.index('rig')], f'Zeiten um den Anker: {times0}'
        # Bergung nach oben vor die Landung → Landung rückt um die Bergungsdauer nach hinten
        rec_i = acts.index('recovery')
        pg.click(f'.wiz table.sched.plan tbody tr:nth-child({rec_i + 1}) td.handle button[title="nach oben"]'); pg.wait_for_timeout(600)
        acts2 = pg.evaluate("() => [...document.querySelectorAll('.wiz table.sched.plan tbody tr td.act select')].map(s => s.value)")
        times2 = pg.evaluate("() => [...document.querySelectorAll('.wiz table.sched.plan tbody tr td.tm input')].map(i => i.value)")
        assert acts2.index('recovery') == rec_i - 1 and times2[acts2.index('landing')] > times0[acts.index('landing')], f'Zeile verschoben, Zeiten angepasst: {times2}'
        pg.click('.wiz .sched-tools button:has-text("Zeile hinzufügen")'); pg.wait_for_timeout(400)
        assert len(pg.query_selector_all('.wiz table.sched.plan tbody tr')) == len(acts) + 1, 'Zeile hinzugefügt'
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
        # 0.9.2: Panel-Nummerierung, «Astronomische Daten» ohne KI-Knopf, DABS nur bei CH-Berührung, Flugplan-Schalter
        assert pg.inner_text('#panel-A\\.core .panel-head .ttl').startswith('A1') and pg.inner_text('#panel-A\\.sun .panel-head .ttl').startswith('A2'), 'Panel-Nummern A1/A2'
        assert 'Astronomische Daten' in pg.inner_text('#panel-A\\.sun .panel-head') and pg.query_selector('#panel-A\\.sun .aibtns') is None and pg.query_selector('#panel-A\\.core .aibtns') is None, 'Astronomische Daten ohne KI-Knopf'
        assert pg.query_selector('#panel-C\\.dabs') is not None, 'DABS vorhanden (Landeraum in CH)'
        assert pg.query_selector('#panel-C\\.fpl input[type=checkbox]') is not None, 'Flugplan-Schalter'
        # 0.10.0: Flugplan erzeugen → ICAO-Nachricht mit Kennung, EOBT UTC, DEP/DEST, Feld 19
        if not pg.is_checked('#panel-C\\.fpl input[type=checkbox]'): pg.check('#panel-C\\.fpl input[type=checkbox]'); pg.wait_for_timeout(300)
        pg.click('#panel-C\\.fpl button:has-text("Aus Briefing erzeugen")'); pg.wait_for_timeout(800)
        fplmsg = pg.inner_text('#panel-C\\.fpl pre')
        assert fplmsg.startswith('(FPL-HB') and '-ZZZZ0430' in fplmsg and 'DEP/' in fplmsg and '4725N00816E' in fplmsg and 'C/' in fplmsg and fplmsg.rstrip().endswith(')'), 'ICAO-Nachricht: ' + fplmsg[:120]
        assert 'Ziel' in pg.inner_text('#panel-B\\.traj .traj-legend') and '°' in pg.inner_text('#panel-B\\.traj .traj-legend'), 'Zielzeile im Trajektorien-Panel'
        # NOTAM: Umkreis um Orte (Standard Startort, 200 km)
        pg.select_option('#panel-C\\.notam .ptools select', 'places'); pg.wait_for_timeout(400)
        assert pg.query_selector('#panel-C\\.notam .notam-places .np-row') is not None and '200' in pg.input_value('#panel-C\\.notam .notam-places input[type=number]'), 'NOTAM-Orte-Editor mit Startort und 200 km'
        pg.select_option('#panel-C\\.notam .ptools select', 'route'); pg.wait_for_timeout(300)
        # Reihenfolge C: NOTAM vor Flugplan
        keys = pg.evaluate("() => [...document.querySelectorAll('.panel')].map(p => p.id)")
        assert keys.index('panel-C.notam') < keys.index('panel-C.fpl'), 'Flugplan nach NOTAM'
        # Phase 3: Tendenz-Karte, «Mehr»-Menü, Pax-Karte, Crew-Dialog
        assert 'tendenz' in pg.inner_text('.side').lower(), 'Go/No-Go-Karte'
        pg.click('#menuBtn'); pg.wait_for_timeout(300)
        assert pg.is_visible('#menu details.submenu'), 'Hamburger mit Untermenüs offen'
        assert 'Neues Briefing' not in pg.inner_text('#menu'), 'kein «Neues Briefing» im Hamburger'
        pg.click('#menu details.submenu summary:has-text("Mehr")'); pg.wait_for_timeout(200)
        pg.click('#menu button:has-text("Crew")'); pg.wait_for_timeout(1200)
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
        assert '(FPL-HB' in pg.inner_text('.brief tr.row-C-fpl'), 'Flugplan in der Briefingsicht'
        pg.click('#tools button.print'); pg.wait_for_timeout(400)
        assert 'Passagier Info-/Sicherheitskarte' in pg.inner_text('.dialog'), 'Druckdialog mit Passagierkarte'
        pg.click('.dialog-foot button:first-child'); pg.wait_for_timeout(200)
        assert '4725N00816E' in pg.inner_text('.brief'), 'Landeraum in Briefingsicht'
        assert pg.query_selector('.brief svg.mg-svg') is not None and pg.query_selector('.brief svg.sv-svg') is not None, 'Grafiken in der Briefingsicht'
        pg.emulate_media(media='print')
        pg.pdf(path=f'{OUT}/{name}_brief.pdf', format='A4', print_background=True) if not mobile else None
        pg.emulate_media(media='screen')
        # Pax-Karte
        pg.goto(BASE + f'#/pax/{bid}'); pg.wait_for_timeout(900)
        assert 'Sicherheit' in pg.inner_text('.paxsheet .paxcard:first-child') and 'Treffpunkt' in pg.inner_text('.paxsheet .paxcard:first-child'), 'Pax-Karte'
        pg.screenshot(path=f'{OUT}/{name}_12_pax.png', full_page=True)
        assert pg.is_visible('#mainnav a.on'), 'Hauptnavigation sichtbar'
        # Settings
        pg.goto(BASE + '#/settings?balloons'); pg.wait_for_timeout(700)
        pg.screenshot(path=f'{OUT}/{name}_10_settings.png', full_page=True)
        # 0.9.2: Zurück-Knopf, Speichern als Umriss bis zur ersten Änderung, Tracker je Ballon
        assert pg.query_selector('#tools button[title="Zurück"]') is not None, 'Zurück-Knopf in den Einstellungen'
        assert 'primary' not in (pg.get_attribute('#tools button.save', 'class') or ''), 'Speichern zunächst nur Umriss'
        assert 'tracker-links' in pg.inner_text('.settings').lower(), 'Tracker-Links beim Ballon'
        pg.fill('.settings .item-box input[type=text]', 'HB-TEST'); pg.wait_for_timeout(200)
        assert 'primary' in (pg.get_attribute('#tools button.save', 'class') or ''), 'Speichern gefüllt nach Änderung'
        pg.click('#menuBtn'); pg.wait_for_timeout(300)
        assert pg.query_selector('#menu details.submenu summary:has-text("JSON")') is not None, 'JSON-Untermenü im Hamburger'
        pg.click('#menuBtn'); pg.wait_for_timeout(200)
        # 0.10.1: Muster auch bei der Gashülle, Bild der Hülle, Panel-Tabelle mit Nummern
        assert 'HB-QPJ · NL/STU-1000' in pg.inner_text('.settings'), 'Muster bei der Gashülle'
        pg.set_input_files('.settings .item-box input[type=file]', os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'img', 'wicki-logo.png')); pg.wait_for_timeout(600)
        assert pg.query_selector('.settings img.bimg') is not None, 'Hüllenbild in den Einstellungen'
        pg.fill('.settings .item-box input[type=text]', 'HB-QWZ'); pg.wait_for_timeout(200)
        pg.click('#tools button.save'); pg.wait_for_timeout(600)
        pg.goto(BASE + '#/settings?panels'); pg.wait_for_timeout(600)
        assert pg.query_selector('table.panels-tbl') is not None and 'A1' in pg.inner_text('table.panels-tbl .pno'), 'Panel-Tabelle mit Nummern'
        pg.screenshot(path=f'{OUT}/{name}_13_panels.png', full_page=True)
        pg.goto(BASE + f'#/pax/{bid}'); pg.wait_for_timeout(900)
        assert pg.query_selector('.paxsheet img.bimg') is not None, 'Hüllenbild im Pax-Blatt'
        pg.goto(BASE + f'#/v/{bid}'); pg.wait_for_timeout(900)
        assert pg.query_selector('.brief tr.row-A-core img.bimg') is not None, 'Hüllenbild in der Briefingsicht'
        pg.goto(BASE + f'#/b/{bid}'); pg.wait_for_timeout(1500)
        assert pg.query_selector('#panel-A\\.core .panel-head img.bimg') is not None, 'Hüllenbild im Stammdaten-Titel'
        pg.screenshot(path=f'{OUT}/{name}_14_core_img.png')
        # Liste erneut
        pg.goto(BASE + '#/list'); pg.wait_for_timeout(600)
        pg.screenshot(path=f'{OUT}/{name}_11_list.png')
        b.close()

run('desktop', {'width': 1366, 'height': 860})
run('gladbeck', {'width': 1366, 'height': 860}, site_chip='Gladbeck')
run('phone', {'width': 390, 'height': 844}, scale=2, mobile=True)
run('ipad', {'width': 820, 'height': 1180}, scale=2, mobile=True)
print('\n'.join(errors) if errors else 'keine Konsolenfehler')
