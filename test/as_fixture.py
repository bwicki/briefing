"""Synthetische openAIP-Antwort (Worker /api/wx/airspace) für Tests ohne Netz: CTR als Nord-Süd-Streifen
in der Mitte, grosse TMA ab 5500 ft, Gefahrengebiet östlich, RMZ-Streifen nahe dem Start, zwei FIR (Grenze östlich der Mitte)."""
def airspace_fixture(bbox):
    w, s, e, n = [float(x) for x in bbox.split(',')]
    cx, cy = (w + e) / 2, (s + n) / 2
    sq = lambda lat0, lon0, lat1, lon1: {'type': 'Polygon', 'coordinates': [[[lon0, lat0], [lon1, lat0], [lon1, lat1], [lon0, lat1], [lon0, lat0]]]}
    ft = lambda v, ref=1: {'value': v, 'unit': 1, 'referenceDatum': ref}
    fl = lambda v: {'value': v, 'unit': 6, 'referenceDatum': 2}
    items = [
        {'_id': 'a1', 'name': 'TEST CTR', 'type': 4, 'icaoClass': 3, 'country': 'CH', 'lowerLimit': ft(0, 0), 'upperLimit': ft(4500), 'geometry': sq(s - 1, cx - 0.06, n + 1, cx + 0.06), 'frequencies': [{'value': '118.100', 'name': 'TWR'}]},
        {'_id': 'a2', 'name': 'TEST TMA 4', 'type': 7, 'icaoClass': 2, 'country': 'CH', 'lowerLimit': ft(5500), 'upperLimit': fl(195), 'geometry': sq(s, w, n, e)},
        {'_id': 'a3', 'name': 'LS-D99 TEST', 'type': 2, 'icaoClass': 8, 'country': 'CH', 'byNotam': True, 'lowerLimit': ft(0, 0), 'upperLimit': fl(130), 'geometry': sq(cy, cx + 0.30, cy + 0.06, cx + 0.36)},
        {'_id': 'a4', 'name': 'TEST RMZ', 'type': 6, 'icaoClass': 6, 'country': 'CH', 'lowerLimit': ft(0, 0), 'upperLimit': ft(2500, 0), 'geometry': sq(s - 1, w + 0.08, n + 1, w + 0.14)},
        {'_id': 'f1', 'name': 'SWITZERLAND FIR', 'type': 10, 'country': 'CH', 'lowerLimit': ft(0, 0), 'upperLimit': fl(195), 'geometry': sq(s - 1, w - 1, n + 1, cx + 0.2)},
        {'_id': 'f2', 'name': 'LANGEN FIR', 'type': 10, 'country': 'DE', 'lowerLimit': ft(0, 0), 'upperLimit': fl(245), 'geometry': sq(s - 1, cx + 0.2, n + 1, e + 1)},
        {'_id': 'u1', 'name': 'TEST UIR', 'type': 11, 'lowerLimit': fl(195), 'upperLimit': fl(660), 'geometry': sq(s - 1, w - 1, n + 1, e + 1)},
    ]
    return {'items': items, 'total': len(items), 'source': 'openAIP (Fixture)', 'generated': '2026-10-04T12:00:00Z'}
