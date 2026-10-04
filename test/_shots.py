import sys, os
src = open('/home/claude/briefing/test/ui.smoke.py').read().split('def run(')[0]
sys.argv=['x']; exec(src)
OUT='/tmp/claude-0/-home-claude-briefing/966811e7-696d-5075-85c3-3620d38610ae/scratchpad/shots'; os.makedirs(OUT, exist_ok=True)
def go(name, viewport, scale=1.5, mobile=False):
  with sync_playwright() as p:
    b = p.chromium.launch(); ctxb = b.new_context(viewport=viewport, device_scale_factor=scale, is_mobile=mobile, has_touch=mobile, locale='de-CH', timezone_id='Europe/Zurich'); pg = ctxb.new_page()
    pg.route('**/js/config.js', lambda r: r.fulfill(status=200, content_type='application/javascript', body="window.BRIEFING_CONFIG = { apiBase: '' };"))
    mock_external(pg)
    pg.goto(BASE + '#/list'); pg.wait_for_timeout(800); pg.fill('#gatePw', '1234'); pg.click('#gateOpen'); pg.wait_for_timeout(600)
    pg.goto(BASE + '#/new'); pg.wait_for_timeout(700); pg.click('button:has-text("Weiter →")'); pg.wait_for_timeout(900)
    pg.fill('input[type=time]', '06:30'); pg.click('button:has-text("Weiter →")'); pg.wait_for_timeout(2500)
    pg.screenshot(path=f'{OUT}/{name}_wiz3.png', full_page=True)
    pg.click('button:has-text("Weiter →")'); pg.wait_for_timeout(800)
    pg.click('button:has-text("Pax hinzufügen")'); pg.wait_for_timeout(300)
    pg.screenshot(path=f'{OUT}/{name}_wiz4.png', full_page=True)
    pg.click('button:has-text("Weiter →")'); pg.wait_for_timeout(2000)
    pg.click('button:has-text("Weiter →")'); pg.wait_for_timeout(600)
    pg.click('button:has-text("Briefing anlegen")'); pg.wait_for_timeout(7000)
    for key in ['A.massperf','B.meteogram','B.metar','B.traj','B.wind']:
        el = pg.query_selector('#panel-' + key.replace('.', '\\.'))
        if el: el.screenshot(path=f'{OUT}/{name}_{key}.png')
    bid = pg.url.split('/')[-1]
    pg.goto(BASE + f'#/v/{bid}'); pg.wait_for_timeout(2500)
    pg.screenshot(path=f'{OUT}/{name}_view.png', full_page=True)
    print(name, pg.evaluate("(() => { const b=document.querySelector('.brief'); const r=b.getBoundingClientRect(); const out=[r.width]; b.querySelectorAll(':scope > *').forEach(e=>{ const q=e.getBoundingClientRect(); out.push([e.tagName, (e.getAttribute('class')||'').slice(0,30), Math.round(q.left), Math.round(q.width)]); }); return out; })()"))
    b.close()
go('desk', {'width':1366,'height':860})
go('phone', {'width':390,'height':844}, scale=2, mobile=True)
