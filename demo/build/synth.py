"""Sprachsynthese der Sprechtexte mit Piper (lokal, ohne Dienst).

Aufruf: python3 demo/build/synth.py <voices-dir> [out-dir]
Stimme: de-thorsten-low (Piper-Release v0.0.2, CC0) – Dateien <voices-dir>/de-thorsten-low.onnx(.json).
Ergibt je Szene eine WAV-Datei (16 kHz mono) und durations.json {ver: [sek, …]}.
"""
import sys, os, json, wave
from piper import PiperVoice
from piper.config import SynthesisConfig
sys.path.insert(0, os.path.dirname(__file__))
from script import VERSIONS

voices = sys.argv[1]
out = sys.argv[2] if len(sys.argv) > 2 else os.path.join(os.path.dirname(__file__), 'out')
name = os.environ.get('PIPER_VOICE', 'de-thorsten-low')
voice = PiperVoice.load(os.path.join(voices, name + '.onnx'), os.path.join(voices, name + '.onnx.json'))
cfg = SynthesisConfig(length_scale=float(os.environ.get('PIPER_LENGTH', '1.12')))
# Aussprachehilfen: Guillemets weg (unbekanntes Phonem), Abkürzungen ausschreiben
def spoken(t):
    for a, b in [('«', ''), ('»', ''), ('Go/No-Go', 'Go No-Go'), ('RAC 4-4', 'RAC vier vier'), ('A bis D', 'A bis De'), ('METAR', 'Metar'), ('TAF', 'Taff'), (' – ', ', '), ('–', ', ')]:
        t = t.replace(a, b)
    return t
durations = {}
for ver, V in VERSIONS.items():
    d = os.path.join(out, ver); os.makedirs(d, exist_ok=True)
    durations[ver] = []
    for i, (key, title, text) in enumerate(V['scenes']):
        f = os.path.join(d, f'{i:02d}_{key}.wav')
        with wave.open(f, 'wb') as w:
            voice.synthesize_wav(spoken(text), w, syn_config=cfg)
        with wave.open(f, 'rb') as w:
            sec = w.getnframes() / w.getframerate()
        durations[ver].append(round(sec, 2))
        print(f'{ver} {i:02d} {key:9s} {sec:5.1f} s  {title}')
    print(f'{ver}: {sum(durations[ver]):.0f} s Sprechtext')
json.dump(durations, open(os.path.join(out, 'durations.json'), 'w'), indent=1)
