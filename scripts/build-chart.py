#!/usr/bin/env python3
"""Convierte la carta L105 de enseñanza (BSB/KAP) en las teselas WebP de dist/assets/chart.

Uso: python3 scripts/build-chart.py /ruta/a/L105_ensenanza_PER.kap

Genera tres niveles: 0 (1/4, una sola imagen), 1 (1/2) y 2 (resolución completa),
los dos últimos troceados en teselas de 1024 px. Requiere Pillow con soporte WebP.
"""
import json, re, sys
from pathlib import Path
from PIL import Image

TILE = 1024
OUT = Path(__file__).resolve().parent.parent / 'dist' / 'assets' / 'chart'


def decode(path):
    data = Path(path).read_bytes()
    end = data.index(b'\x1a\x00')
    header = data[:end].decode('latin-1')
    width, height = map(int, re.search(r'RA=(\d+),(\d+)', header).groups())
    palette = [0, 0, 0] * 256
    for i, r, g, b in re.findall(r'RGB/(\d+),(\d+),(\d+),(\d+)', header):
        palette[int(i) * 3:int(i) * 3 + 3] = [int(r), int(g), int(b)]
    refs = [tuple(map(float, m)) for m in re.findall(r'REF/\d+,(\d+),(\d+),([-\d.]+),([-\d.]+)', header)]
    pos = end + 2
    depth = data[pos]; pos += 1
    shift = 7 - depth; low = (1 << shift) - 1
    pixels = bytearray(width * height)
    for row in range(height):
        while data[pos] & 0x80: pos += 1          # número de fila (varint)
        pos += 1
        x = 0; base = row * width
        while data[pos] != 0:
            c = data[pos]; pos += 1
            color = (c & 0x7f) >> shift; count = c & low
            while c & 0x80:
                c = data[pos]; pos += 1
                count = count * 128 + (c & 0x7f)
            count = min(count + 1, width - x)
            pixels[base + x:base + x + count] = bytes([color]) * count
            x += count
        pos += 1
    image = Image.frombytes('P', (width, height), bytes(pixels))
    image.putpalette(palette)
    return image.convert('RGB'), refs


def main():
    if len(sys.argv) != 2: sys.exit(__doc__)
    image, refs = decode(sys.argv[1])
    if len(set(image.convert('HSV').getchannel('S').getextrema())) == 1: image = image.convert('L')
    OUT.mkdir(parents=True, exist_ok=True)
    for old in OUT.glob('*.webp'): old.unlink()
    width, height = image.size
    levels = []
    for level, factor in enumerate((4, 2, 1)):
        scaled = image if factor == 1 else image.resize((round(width / factor), round(height / factor)), Image.LANCZOS)
        if level == 0:
            scaled.save(OUT / '0.webp', quality=82, method=6)
            levels.append({'factor': factor, 'width': scaled.width, 'height': scaled.height})
            continue
        cols = -(-scaled.width // TILE); rows = -(-scaled.height // TILE)
        for r in range(rows):
            for c in range(cols):
                scaled.crop((c * TILE, r * TILE, min(scaled.width, (c + 1) * TILE), min(scaled.height, (r + 1) * TILE))).save(OUT / f'{level}-{c}-{r}.webp', quality=82, method=6)
        levels.append({'factor': factor, 'width': scaled.width, 'height': scaled.height, 'cols': cols, 'rows': rows})
    print(json.dumps({'width': width, 'height': height, 'tile': TILE, 'levels': levels, 'refs': refs}, indent=1))
    print(f'{sum(f.stat().st_size for f in OUT.glob("*.webp")) / 1e6:.1f} MB en {OUT}')


if __name__ == '__main__':
    main()
