#!/usr/bin/env python3
"""Gera og-mapa-bahia.png — 1200×630, mapa dos 27 TIs em fundo branco."""

import json
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
GEO = ROOT / "geo/base/territorios.geojson"
OUT = ROOT / "assets/og-mapa-bahia.png"

W, H = 1200, 630
BG = "#ffffff"
FILL = "#f0f0f0"
STROKE = "#cccccc"
YELLOW = "#f5c518"
TEXT = "#111111"
MUTED = "#6e6e6e"


def iter_rings(geom):
    gtype = geom["type"]
    coords = geom["coordinates"]
    if gtype == "Polygon":
        yield coords[0]
    elif gtype == "MultiPolygon":
        for poly in coords:
            yield poly[0]


def collect_bounds(features):
    minlng = minlat = float("inf")
    maxlng = maxlat = float("-inf")
    for f in features:
        for ring in iter_rings(f["geometry"]):
            for lng, lat in ring:
                minlng = min(minlng, lng)
                maxlng = max(maxlng, lng)
                minlat = min(minlat, lat)
                maxlat = max(maxlat, lat)
    return minlng, minlat, maxlng, maxlat


def project(lng, lat, bounds, box):
    x0, y0, x1, y1 = box
    minlng, minlat, maxlng, maxlat = bounds
    pad = 0.04
    bw, bh = x1 - x0, y1 - y0
    gw = (maxlng - minlng) * (1 + 2 * pad)
    gh = (maxlat - minlat) * (1 + 2 * pad)
    scale = min(bw / gw, bh / gh)
    cx = (minlng + maxlng) / 2
    cy = (minlat + maxlat) / 2
    hw, hh = gw * scale / 2, gh * scale / 2
    mx, my = (x0 + x1) / 2, (y0 + y1) / 2

    x = mx + (lng - cx) * scale
    y = my - (lat - cy) * scale
    return x, y


def load_font(size, bold=False):
    candidates = [
        "C:/Windows/Fonts/segoeuib.ttf" if bold else "C:/Windows/Fonts/segoeui.ttf",
        "C:/Windows/Fonts/arialbd.ttf" if bold else "C:/Windows/Fonts/arial.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf" if bold else "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    ]
    for path in candidates:
        p = Path(path)
        if p.exists():
            return ImageFont.truetype(str(p), size)
    return ImageFont.load_default()


def main():
    data = json.loads(GEO.read_text(encoding="utf-8"))
    features = data["features"]
    bounds = collect_bounds(features)

    img = Image.new("RGB", (W, H), BG)
    draw = ImageDraw.Draw(img)

    map_box = (48, 48, 760, H - 48)

    for f in features:
        for ring in iter_rings(f["geometry"]):
            pts = [project(lng, lat, bounds, map_box) for lng, lat in ring]
            if len(pts) >= 3:
                draw.polygon(pts, fill=FILL, outline=STROKE)

    # acento amarelo — linha sob título (identidade visual IRUN)
    draw.rectangle((820, 200, 1160, 206), fill=YELLOW)

    title = load_font(42, bold=True)
    sub = load_font(22, bold=False)
    meta = load_font(16, bold=False)

    draw.text((820, 88), "MOVIMENTO IRUN", fill=TEXT, font=title)
    draw.text((820, 148), "IDENTIDADE E TERRITÓRIO", fill=MUTED, font=sub)
    draw.text((820, 230), "Mapa territorial da Bahia", fill=TEXT, font=sub)
    draw.text((820, 268), "27 Territórios de Identidade", fill=MUTED, font=meta)
    draw.text((820, 296), "REDE · Design de Território", fill=MUTED, font=meta)

    OUT.parent.mkdir(parents=True, exist_ok=True)
    img.save(OUT, "PNG", optimize=True)
    print(f"OK -> {OUT} ({OUT.stat().st_size // 1024} KB)")


if __name__ == "__main__":
    main()
