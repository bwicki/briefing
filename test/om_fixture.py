"""Synthetische Open-Meteo-Antwort für Tests ohne Netz (gleiches Schema wie api.open-meteo.com/v1/forecast
mit timeformat=unixtime, timezone=UTC). Wind dreht mit der Höhe von 240° auf 290° und nimmt zu;
Tagesgang der Temperatur; eine Inversion bei 925 hPa; etwas Regen am Nachmittag."""
import math, datetime, json
from urllib.parse import parse_qs, urlparse

LEVELS = [1000, 975, 950, 925, 900, 850, 800, 700, 600, 500, 400, 300]
STD_H = lambda p: 44330.77 * (1 - (p / 1013.25) ** 0.1902632)

def fixture(query, elev=461.0):
    q = parse_qs(query)
    lat = float(q.get('latitude', ['47.3'])[0]); lon = float(q.get('longitude', ['8.4'])[0])
    hourly = q.get('hourly', [''])[0].split(',')
    if 'start_date' in q:
        d0 = datetime.datetime.strptime(q['start_date'][0], '%Y-%m-%d').replace(tzinfo=datetime.timezone.utc)
        d1 = datetime.datetime.strptime(q['end_date'][0], '%Y-%m-%d').replace(tzinfo=datetime.timezone.utc) + datetime.timedelta(days=1)
    else:
        d0 = datetime.datetime.now(datetime.timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
        d1 = d0 + datetime.timedelta(days=int(q.get('forecast_days', ['4'])[0]))
    n = int((d1 - d0).total_seconds() // 3600)
    t = [int(d0.timestamp()) + 3600 * i for i in range(n)]
    out = {'time': t}
    def series(f): return [round(f(i, (t[i] % 86400) / 3600), 2) for i in range(n)]
    base = {
        'temperature_2m': lambda i, h: 12 + 6 * math.sin((h - 9) / 24 * 2 * math.pi),
        'dew_point_2m': lambda i, h: 9 + 1.5 * math.sin((h - 9) / 24 * 2 * math.pi),
        'relative_humidity_2m': lambda i, h: min(100, 82 - 25 * math.sin((h - 9) / 24 * 2 * math.pi)),
        'precipitation': lambda i, h: 0.4 if 14 <= h <= 16 and i // 24 == 1 else 0.0,
        'precipitation_probability': lambda i, h: 60 if 14 <= h <= 16 else 5,
        'cloud_cover': lambda i, h: 40 + 30 * math.sin(h / 24 * 2 * math.pi),
        'cloud_cover_low': lambda i, h: 20 + 20 * math.sin(h / 24 * 2 * math.pi),
        'cloud_cover_mid': lambda i, h: 15, 'cloud_cover_high': lambda i, h: 30,
        'visibility': lambda i, h: 24140 if h > 7 else 6000,
        'shortwave_radiation': lambda i, h: max(0, 500 * math.sin((h - 6) / 12 * math.pi)) if 6 <= h <= 18 else 0,
        'wind_speed_10m': lambda i, h: 1.5 + 1.5 * max(0, math.sin((h - 8) / 12 * math.pi)),
        'wind_direction_10m': lambda i, h: 240, 'wind_gusts_10m': lambda i, h: 3 + 3 * max(0, math.sin((h - 8) / 12 * math.pi)),
        'wind_speed_80m': lambda i, h: 3.0, 'wind_direction_80m': lambda i, h: 250,
        'wind_speed_180m': lambda i, h: 4.5, 'wind_direction_180m': lambda i, h: 255,
        'cape': lambda i, h: 150 if 12 <= h <= 17 else 20, 'boundary_layer_height': lambda i, h: 300 + 900 * max(0, math.sin((h - 7) / 12 * math.pi)),
        'freezing_level_height': lambda i, h: 2800, 'pressure_msl': lambda i, h: 1018 - 0.3 * (i / 24), 'surface_pressure': lambda i, h: 1018 - 0.3 * (i / 24) - elev / 8.3,
    }
    for k in hourly:
        if k in base: out[k] = series(base[k])
        else:
            m = None
            for p in LEVELS:
                if k.endswith(f'_{p}hPa'): m = (k[:-len(f'_{p}hPa')], p)
            if not m: continue
            var, p = m
            hgt = STD_H(p)
            idx = LEVELS.index(p)
            if var == 'wind_speed': out[k] = series(lambda i, h, idx=idx: 3 + idx * 1.6)
            elif var == 'wind_direction': out[k] = series(lambda i, h, idx=idx: 240 + idx * 5)
            elif var == 'temperature':
                tp = 12 - 6.5 * hgt / 1000 + (3 if p == 925 else 0)
                out[k] = series(lambda i, h, tp=tp: tp + 2 * math.sin((h - 9) / 24 * 2 * math.pi))
            elif var == 'geopotential_height': out[k] = series(lambda i, h, hgt=hgt: hgt)
            elif var == 'relative_humidity': out[k] = series(lambda i, h, p=p: 90 if p in (925, 900) else 55)
    return {'latitude': lat, 'longitude': lon, 'elevation': elev, 'generationtime_ms': 1.2, 'utc_offset_seconds': 0, 'timezone': 'GMT', 'timezone_abbreviation': 'GMT', 'hourly': out}

if __name__ == '__main__':
    import sys
    print(json.dumps(fixture(urlparse(sys.argv[1]).query if '?' in sys.argv[1] else sys.argv[1]))[:400])
