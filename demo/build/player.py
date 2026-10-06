"""Erzeugt demo/index.html (Player) mit eingebetteten Kapiteln aus media/*.json – ohne Abhängigkeiten, läuft auch von Datei (file://).

Aufruf: python3 demo/build/player.py
"""
import os, json
HERE = os.path.dirname(os.path.abspath(__file__)); DEMO = os.path.abspath(os.path.join(HERE, '..'))
data = {}
for ver, fn in [('hab', 'einfuehrung_heissluft'), ('gas', 'einfuehrung_gas')]:
    p = os.path.join(DEMO, 'media', fn + '.json')
    if os.path.exists(p): data[ver] = { **json.load(open(p, encoding='utf-8')), 'src': f'media/{fn}.mp4' }

HTML = r"""<!doctype html>
<html lang="de">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>Fahrtbriefing · Einführung</title>
<meta name="description" content="Einführung in die Fahrtbriefing-Plattform: Heissluftfahrt (HB-QWZ) und Gasfahrt (HB-QPJ), je rund zwei Minuten, mit Sprecherstimme.">
<style>
:root{--bg:#f6f4ef;--fg:#1d2126;--dim:#5b6470;--line:#d9d4ca;--panel:#fff;--accent:#b8640f;--accent-2:#2f6f9f;--mono:ui-monospace,"IBM Plex Mono",Menlo,Consolas,monospace;--sans:system-ui,-apple-system,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif;color-scheme:light}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){--bg:#14171b;--fg:#e9e6df;--dim:#9aa3ad;--line:#2d333b;--panel:#1c2026;--accent:#e08a2b;--accent-2:#6fa6d6;color-scheme:dark}}
:root[data-theme="dark"]{--bg:#14171b;--fg:#e9e6df;--dim:#9aa3ad;--line:#2d333b;--panel:#1c2026;--accent:#e08a2b;--accent-2:#6fa6d6;color-scheme:dark}
*{box-sizing:border-box}html,body{margin:0}body{background:var(--bg);color:var(--fg);font:15px/1.5 var(--sans);padding-block:18px;padding-inline:16px}
.wrap{max-width:1180px;margin:0 auto}
.eyebrow{font:500 11px/1.2 var(--mono);letter-spacing:.08em;text-transform:uppercase;color:var(--dim)}
h1{font-size:24px;margin:4px 0 2px;text-wrap:balance}
.sub{color:var(--dim);margin:0 0 14px}
.tabs{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px}
.tabs button{font:inherit;font-size:14px;padding:8px 14px;border:1px solid var(--line);border-radius:999px;background:var(--panel);color:var(--fg);cursor:pointer}
.tabs button[aria-pressed="true"]{background:var(--accent);border-color:var(--accent);color:#fff}
.player{display:grid;grid-template-columns:minmax(0,1fr) 320px;gap:16px;align-items:start}
@media (max-width:860px){.player{grid-template-columns:1fr}}
video{width:100%;max-width:100%;aspect-ratio:1366/768;background:#000;border-radius:10px;display:block;border:1px solid var(--line)}
.cap{margin-top:10px;padding:10px 14px;background:var(--panel);border:1px solid var(--line);border-radius:10px;min-height:66px}
.cap .t{font:600 12px/1.2 var(--mono);letter-spacing:.04em;text-transform:uppercase;color:var(--accent);margin-bottom:4px}
.chap{background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:8px;min-width:0}
.chap h2{font-size:12px;letter-spacing:.06em;text-transform:uppercase;color:var(--dim);margin:4px 6px 6px;font-family:var(--mono);font-weight:500}
.chap ol{list-style:none;margin:0;padding:0;display:grid;gap:3px}
.chap li{display:grid;grid-template-columns:26px 1fr auto;gap:8px;align-items:center;padding:7px 8px;border-radius:8px;cursor:pointer;min-width:0}
.chap li:hover{background:color-mix(in srgb,var(--accent) 10%,transparent)}
.chap li.on{background:color-mix(in srgb,var(--accent) 18%,transparent)}
.chap li b{display:inline-grid;place-items:center;width:24px;height:24px;border-radius:50%;background:var(--accent-2);color:#fff;font:600 12px var(--mono)}
.chap li .tm{font:12px var(--mono);color:var(--dim);font-variant-numeric:tabular-nums}
.note{color:var(--dim);font-size:13px;margin-top:14px;max-width:70ch}
.note a{color:var(--accent-2)}
.tools{display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin-top:10px;font-size:13px;color:var(--dim)}
.tools label{display:inline-flex;gap:6px;align-items:center;cursor:pointer}
</style>
</head>
<body>
<div class="wrap">
  <div class="eyebrow">Fahrtbriefing · Ballon · Fahrtvorbereitung</div>
  <h1>Einführung in die Plattform</h1>
  <p class="sub">Zwei kurze Filme mit Sprecherstimme – für Pilotinnen und Piloten, die das Fahrtbriefing zum ersten Mal nutzen. Kapitel anklicken, um direkt dorthin zu springen.</p>
  <div class="tabs" id="tabs"></div>
  <div class="player">
    <div>
      <video id="v" controls preload="metadata" playsinline></video>
      <div class="cap" id="cap"><div class="t" id="capT"></div><div id="capX"></div></div>
      <div class="tools"><label><input type="checkbox" id="capOn" checked> Sprechtext als Untertitel anzeigen</label><span id="dur"></span></div>
    </div>
    <div class="chap"><h2>Kapitel</h2><ol id="chap"></ol></div>
  </div>
  <p class="note">Aufgenommen in der App mit Beispieldaten (lokaler Modus, Wetter aus einem synthetischen Modell, Lufträume nicht geladen); Ballone und Startplätze aus den Stammdaten von Wicki Aero. Stimme: Sprachsynthese (Piper, Stimme «Thorsten»). Die App selbst: <a href="../">briefing.wicki.aero</a>.</p>
</div>
<script>
const DATA = __DATA__;
const v = document.getElementById('v'), tabs = document.getElementById('tabs'), chap = document.getElementById('chap'), capT = document.getElementById('capT'), capX = document.getElementById('capX'), capOn = document.getElementById('capOn'), durEl = document.getElementById('dur');
let cur = null;
const fmt = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
function pick(ver) {
  cur = DATA[ver]; if (!cur) return;
  for (const b of tabs.querySelectorAll('button')) b.setAttribute('aria-pressed', b.dataset.ver === ver);
  v.src = cur.src; v.load();
  chap.innerHTML = cur.chapters.map((c) => `<li data-n="${c.n}"><b>${c.n}</b><span>${c.title}</span><span class="tm">${fmt(c.start)}</span></li>`).join('');
  for (const li of chap.querySelectorAll('li')) li.onclick = () => { const c = cur.chapters[+li.dataset.n - 1]; v.currentTime = c.start + 0.3; v.play(); };
  durEl.textContent = `${cur.balloon} · ${fmt(cur.duration)} min`;
  update(0);
  try { localStorage.setItem('fb.demo', ver); } catch {}
}
function update(t) {
  if (!cur) return;
  const c = cur.chapters.find((x) => t >= x.start && t < x.end) || cur.chapters[0];
  for (const li of chap.querySelectorAll('li')) li.classList.toggle('on', +li.dataset.n === c.n);
  capT.textContent = `${c.n} · ${c.title}`; capX.textContent = capOn.checked ? c.text : '';
}
v.addEventListener('timeupdate', () => update(v.currentTime));
capOn.addEventListener('change', () => update(v.currentTime));
for (const [ver, d] of Object.entries(DATA)) { const b = document.createElement('button'); b.type = 'button'; b.dataset.ver = ver; b.textContent = d.title; b.onclick = () => pick(ver); tabs.appendChild(b); }
let first = Object.keys(DATA)[0]; try { const s = localStorage.getItem('fb.demo'); if (s && DATA[s]) first = s; } catch {}
if (location.hash === '#gas' && DATA.gas) first = 'gas'; if (location.hash === '#hab' && DATA.hab) first = 'hab';
pick(first);
</script>
</body>
</html>
"""
out = os.path.join(DEMO, 'index.html')
open(out, 'w', encoding='utf-8').write(HTML.replace('__DATA__', json.dumps(data, ensure_ascii=False)))
print('ok', out, list(data))
