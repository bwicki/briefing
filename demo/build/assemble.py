"""Zusammenbau: Bildschirmaufnahme (record.py) + Sprechtexte (synth.py) → MP4 (H.264/AAC) und chapters.json für den Player.

Aufruf: python3 demo/build/assemble.py <hab|gas> <out-dir> <mp4-ziel>
Die Szenenzeiten der Aufnahme werden über das schwarze Markerbild (blackdetect) auf die Videozeit abgebildet; je Szene wird
der Sprechtext mit Stille auf die Szenenlänge aufgefüllt, dann alles verkettet und mit dem Bild gemischt.
"""
import sys, os, json, subprocess, re, wave
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
from script import VERSIONS

VER, OUT, DST = sys.argv[1], sys.argv[2], sys.argv[3]
S = json.load(open(os.path.join(OUT, VER + '_scenes.json')))
video, scenes = S['video'], S['scenes']

def run(cmd): return subprocess.run(cmd, capture_output=True, text=True)
# 1) Szenenmarken: kurze schwarze Bilder (record.py) → Videozeiten der Szenenanfänge und der Endmarke
r = run(['ffmpeg', '-hide_banner', '-i', video, '-vf', 'blackdetect=d=0.12:pix_th=0.10', '-an', '-f', 'null', '-'])
marks = [float(x) for x in re.findall(r'black_start:([\d.]+)', r.stderr)]
ends = [float(x) for x in re.findall(r'black_end:([\d.]+)', r.stderr)]
if len(marks) != len(scenes) + 1: raise SystemExit(f'{len(marks)} Szenenmarken im Video, erwartet {len(scenes) + 1}: {marks}')
print('Szenenmarken (Videozeit):', ' '.join(f'{m:.1f}' for m in marks))
# 2) Ton: je Szene Sprechtext (nach dem schwarzen Bild) + Stille bis zur nächsten Marke
tmp = os.path.join(OUT, VER + '_audio'); os.makedirs(tmp, exist_ok=True)
parts, chapters, t = [], [], 0.0
for k, sc in enumerate(scenes):
    i = sc['i']; key = sc['key']; dur = marks[k + 1] - marks[k]
    wav = os.path.join(OUT, VER, f'{i:02d}_{key}.wav'); seg = os.path.join(tmp, f'{i:02d}.wav')
    run(['ffmpeg', '-y', '-hide_banner', '-loglevel', 'error', '-i', wav, '-af', f'adelay=400|400,apad=whole_dur={dur:.3f}', '-ar', '44100', '-ac', '1', '-t', f'{dur:.3f}', seg])
    parts.append(seg)
    title, text = VERSIONS[VER]['scenes'][i][1], VERSIONS[VER]['scenes'][i][2]
    chapters.append({'n': i + 1, 'key': key, 'title': title, 'start': round(t, 2), 'end': round(t + dur, 2), 'text': text})
    t += dur
lst = os.path.join(tmp, 'list.txt'); open(lst, 'w').write(''.join(f"file '{p}'\n" for p in parts))
audio = os.path.join(tmp, 'all.wav'); run(['ffmpeg', '-y', '-hide_banner', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', lst, '-c', 'copy', audio])
# 3) Bild ab der ersten Marke, Länge = Summe der Szenen; H.264 + AAC
start = marks[0]
os.makedirs(os.path.dirname(DST), exist_ok=True)
r = run(['ffmpeg', '-y', '-hide_banner', '-loglevel', 'error', '-ss', f'{start:.3f}', '-t', f'{t:.3f}', '-i', video, '-i', audio, '-map', '0:v:0', '-map', '1:a:0',
         '-c:v', 'libx264', '-preset', 'medium', '-crf', '24', '-pix_fmt', 'yuv420p', '-r', '25', '-vf', 'scale=trunc(iw/2)*2:trunc(ih/2)*2', '-c:a', 'aac', '-b:a', '64k', '-movflags', '+faststart', '-shortest', DST])
if r.returncode: raise SystemExit(r.stderr)
json.dump({'version': VER, 'title': VERSIONS[VER]['title'], 'balloon': VERSIONS[VER]['balloon'], 'duration': round(t, 1), 'chapters': chapters}, open(DST.replace('.mp4', '.json'), 'w'), ensure_ascii=False, indent=1)
print(f'ok {DST} {t:.0f} s, {os.path.getsize(DST) / 1e6:.1f} MB')
