#!/usr/bin/env python3
"""Mide la deformación del escaneo de la carta L105 frente a su retícula impresa.

La carta es un mosaico de escaneos: la retícula impresa se aparta hasta 9 px
(≈0,1') de la calibración nominal del KAP. Este script sigue cada meridiano y
paralelo de 10' y el marco interior, y escribe en dist/chart-warp.js la corrección
(décimas de píxel) en una malla de 2' que usa chart-geo.js.

Uso: python3 scripts/calibrate-chart.py   (después de build-chart.py)
"""
import json, math, statistics
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
TILES = ROOT / 'dist' / 'assets' / 'chart'
W, H = 4963, 3508
LON0, LAT0 = -(6 + 20 / 60), 36 + 20 / 60          # esquina NW de la retícula
NLON, NLAT = 36, 21                                  # nodos cada 2'
merc = lambda lat: math.log(math.tan(math.pi / 4 + math.radians(lat) / 2))
MN, MS = merc(LAT0), merc(35 + 40 / 60)
X = lambda lon: 328 + (lon - LON0) / (70 / 60) * 4359
Y = lambda lat: 220 + (MN - merc(lat)) / (MN - MS) * 3065

full = Image.new('L', (W, H))
for c in range(5):
    for r in range(4):
        full.paste(Image.open(TILES / f'2-{c}-{r}.webp'), (c * 1024, r * 1024))


def profile(box, vertical):
    im = full.crop(box)
    im = im.resize((im.width, 1) if vertical else (1, im.height), Image.BOX)
    return list(im.get_flattened_data() if hasattr(im, 'get_flattened_data') else im.getdata())


def offset(pos, along, vertical, mode, R=14):
    """Desvío de la línea respecto a `pos`, medido en una ventana de 60 px centrada en `along`."""
    p0 = round(pos)
    box = (p0 - R, along - 30, p0 + R + 1, along + 30) if vertical else (along - 30, p0 - R, along + 30, p0 + R + 1)
    p = profile(box, vertical)
    if mode == 'darkest':
        i = min(range(len(p)), key=p.__getitem__)
        if p[i] > 185: return None
    else:                                             # primera línea oscura viniendo del interior
        order = range(len(p)) if mode == 'first' else range(len(p) - 1, -1, -1)
        i = next((k for k in order if p[k] < 150), None)
        if i is None: return None
        while 0 <= i + (1 if mode == 'first' else -1) < len(p) and p[i + (1 if mode == 'first' else -1)] < p[i]: i += 1 if mode == 'first' else -1
    lo = max(0, i - 2); w = [max(0, 215 - v) for v in p[lo:i + 3]]
    return lo + sum(k * v for k, v in enumerate(w)) / sum(w) - R + p0 - pos


def trace(pos, start, stop, vertical, mode):
    """Devuelve f(along) con el desvío filtrado (mediana) e interpolado."""
    samples = [(a, offset(pos, a, vertical, mode)) for a in range(start, stop, 25)]
    good = [(a, d) for a, d in samples if d is not None]
    clean = []
    for i, (a, d) in enumerate(good):
        near = [v for _, v in good[max(0, i - 8):i + 9]]
        med = statistics.median(near)
        clean.append((a, med if abs(d - med) > 1.5 else d))
    def f(along):
        if along <= clean[0][0]: return clean[0][1]
        for (a0, d0), (a1, d1) in zip(clean, clean[1:]):
            if along <= a1: return d0 + (d1 - d0) * (along - a0) / (a1 - a0)
        return clean[-1][1]
    return f


meridians = []
for k in range(8):
    x = X(LON0 + k * 10 / 60)
    meridians.append(trace(x, 260, 3260, True, 'last' if k == 0 else 'first' if k == 7 else 'darkest'))
parallels = []
for k in range(5):
    y = Y(LAT0 - k * 10 / 60)
    parallels.append(trace(y, 370, 4650, False, 'last' if k == 0 else 'first' if k == 4 else 'darkest'))

dx, dy = [], []
for j in range(NLAT):
    y = Y(LAT0 - j * 2 / 60)
    for i in range(NLON):
        x = X(LON0 + i * 2 / 60)
        k, t = min(6, i // 5), (i - min(6, i // 5) * 5) / 5
        dx.append(round(10 * (meridians[k](y) * (1 - t) + meridians[k + 1](y) * t)))
        k, t = min(3, j // 5), (j - min(3, j // 5) * 5) / 5
        dy.append(round(10 * (parallels[k](x) * (1 - t) + parallels[k + 1](x) * t)))

(ROOT / 'dist' / 'chart-warp.js').write_text(
    '// Generado por scripts/calibrate-chart.py: desvío de la retícula impresa (décimas de píxel), malla de 2\'.\n'
    f'export const WARP = {json.dumps({"nlon": NLON, "nlat": NLAT, "dx": dx, "dy": dy}, separators=(",", ":"))};\n')
for name, grid in (('dx', dx), ('dy', dy)):
    print(name)
    for j in range(0, NLAT, 5): print(' '.join(f'{grid[j * NLON + i] / 10:+5.1f}' for i in range(0, NLON, 5)))
