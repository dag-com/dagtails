"""Remove compact yellow rubber-duck tokens from the map plate without
eating the amber gold path (path has R >> G; duck is R ≈ G)."""
from __future__ import annotations

from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
DST = ROOT / "assets" / "maps" / "dag-tails-bar-hop-map.jpg"

im = Image.open(DST).convert("RGB")
w, h = im.size
arr = np.asarray(im).astype(np.float32)
r, g, b = arr[:, :, 0], arr[:, :, 1], arr[:, :, 2]

# Compact duck yellow (not amber path).
cand = (
    (r > 200)
    & (g > 175)
    & (b < 100)
    & (np.abs(r - g) < 32)
    & ((r + g) / 2 - b > 130)
)

# Early-path corridor only.
region = np.zeros_like(cand, dtype=bool)
region[int(h * 0.12) : int(h * 0.42), int(w * 0.04) : int(w * 0.38)] = True
cand &= region
cand &= ~((g > r + 10) & (g > 120))  # skip green START plaque

# Connected components via simple flood (numpy label without scipy).
visited = np.zeros_like(cand, dtype=bool)
ys, xs = np.where(cand)
components: list[tuple[int, int, int, int, int]] = []  # minx,miny,maxx,maxy,area
from collections import deque

for y0, x0 in zip(ys.tolist(), xs.tolist()):
    if visited[y0, x0]:
        continue
    q = deque([(y0, x0)])
    visited[y0, x0] = True
    pts = []
    while q:
        y, x = q.popleft()
        pts.append((x, y))
        for dy, dx in ((0, 1), (0, -1), (1, 0), (-1, 0)):
            ny, nx = y + dy, x + dx
            if 0 <= ny < h and 0 <= nx < w and cand[ny, nx] and not visited[ny, nx]:
                visited[ny, nx] = True
                q.append((ny, nx))
    area = len(pts)
    # Duck icons are small; skip long path streaks.
    xs_c = [p[0] for p in pts]
    ys_c = [p[1] for p in pts]
    bw = max(xs_c) - min(xs_c) + 1
    bh = max(ys_c) - min(ys_c) + 1
    if 40 <= area <= 900 and bw <= 55 and bh <= 55 and max(bw, bh) / max(1, min(bw, bh)) < 3.2:
        components.append((min(xs_c), min(ys_c), max(xs_c), max(ys_c), area))

print(f"duck-like blobs: {len(components)}")
mask = Image.new("L", (w, h), 0)
draw = ImageDraw.Draw(mask)
# Always cover the classic START-path duck seat.
for cx, cy, rad in [(100, 305, 16), (115, 295, 12)]:
    draw.ellipse((cx - rad, cy - rad, cx + rad, cy + rad), fill=255)
for minx, miny, maxx, maxy, area in components:
    pad = 6
    draw.ellipse((minx - pad, miny - pad, maxx + pad, maxy + pad), fill=255)
    print(f"  blob area={area} box=({minx},{miny})-({maxx},{maxy})")

mask = mask.filter(ImageFilter.GaussianBlur(2.2))
m = np.asarray(mask).astype(np.float32) / 255.0

outer = np.asarray(mask.filter(ImageFilter.MaxFilter(23))).astype(bool)
ring = outer & (m < 0.12)
pathish = ring & (r > 155) & (g > 95) & (b < 135) & (r > g + 10) & (r > b + 45)
fill = arr[pathish].mean(0) if pathish.sum() > 8 else np.array([218.0, 158.0, 55.0])
print(f"fill {fill}")

rng = np.random.default_rng(13)
noise = rng.normal(0, 4, arr.shape).astype(np.float32)
out = arr * (1 - m[..., None]) + (fill + noise) * m[..., None]
soft = np.asarray(
    Image.fromarray(np.clip(out, 0, 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(0.8))
).astype(np.float32)
out = out * (1 - m[..., None] * 0.35) + soft * (m[..., None] * 0.35)
out = np.clip(out, 0, 255).astype(np.uint8)
Image.fromarray(out).save(DST, quality=93, optimize=True)
print(f"wrote {DST}")
