"""Rematte V18 mascots onto transparent PNGs without eating black clothes."""
from pathlib import Path
import shutil
import numpy as np
from PIL import Image

ROOT = Path(r"c:\Users\Danny\Projects\new-project")
BACKUP = ROOT / "mocks" / "live-before-v18"
BACKUP.mkdir(parents=True, exist_ok=True)

LIVE = {
    "hoodie": ROOT / "assets" / "duck-hub-mascot.png",
    "jacket": ROOT / "assets" / "duck-hub-mascot-jacket.png",
    "ace": ROOT / "assets" / "duck-hub-mascot-ace.png",
}

SOURCES = {
    "hoodie": ROOT / "mocks" / "duck-age" / "duck-age-bar-v13-01-kid-canvas.png",
    "bib": ROOT / "mocks" / "duck-age" / "duck-age-bar-v14-02-bib-runner.png",
    "floor": ROOT / "mocks" / "duck-age" / "duck-age-bar-v18-03-towel.png",
    "ace": Path(
        r"C:\Users\Danny\.cursor\projects\c-Users-Danny-Projects-new-project\assets\duck-age-bar-ace-snifter.png"
    ),
}

OUT = {
    "hoodie": LIVE["hoodie"],
    "bib": ROOT / "assets" / "duck-hub-mascot-bib.png",
    "floor": LIVE["jacket"],
    "ace": LIVE["ace"],
}


def silhouette(rgb, thresh=14):
    char = rgb.max(axis=2) > thresh
    h, w = char.shape
    ys, xs = np.where(char)
    if len(ys) == 0:
        return char
    y0, y1 = int(ys.min()), int(ys.max())
    torso_end = y0 + int(0.64 * (y1 - y0))
    filled = char.copy()
    for y in range(y0, y1 + 1):
        cols = np.where(char[y])[0]
        if len(cols) < 2:
            continue
        if y <= torso_end:
            filled[y, cols.min() : cols.max() + 1] = True
        else:
            # fill only tiny gaps (anti-alias / boot laces), not the space between legs
            start = cols[0]
            prev = cols[0]
            for x in cols[1:]:
                if x - prev > 28:
                    filled[y, start : prev + 1] = True
                    start = x
                prev = x
            filled[y, start : prev + 1] = True
    return filled


def rematte(src: Path) -> Image.Image:
    rgb = np.array(Image.open(src).convert("RGB"))
    mask = silhouette(rgb)
    alpha = np.where(mask, 255, 0).astype(np.uint8)
    # slight dilate for fringe
    padm = np.pad(mask, 1)
    dil = padm[1:-1, 1:-1] | padm[:-2, 1:-1] | padm[2:, 1:-1] | padm[1:-1, :-2] | padm[1:-1, 2:]
    alpha = np.where(dil, 255, 0).astype(np.uint8)
    arr = np.dstack([rgb, alpha])
    ys, xs = np.where(alpha > 0)
    pad = 10
    y0 = max(0, int(ys.min()) - pad)
    y1 = min(arr.shape[0], int(ys.max()) + pad + 1)
    x0 = max(0, int(xs.min()) - pad)
    x1 = min(arr.shape[1], int(xs.max()) + pad + 1)
    return Image.fromarray(arr[y0:y1, x0:x1])


def main():
    for key, path in LIVE.items():
        dest = BACKUP / path.name
        if path.exists() and not dest.exists():
            shutil.copy2(path, dest)
            print("backed up", path.name)

    for key, src in SOURCES.items():
        if not src.exists():
            raise SystemExit(f"missing source {src}")
        img = rematte(src)
        out = OUT[key]
        img.save(out, "PNG")
        print("wrote", out.relative_to(ROOT), img.size, img.mode)


if __name__ == "__main__":
    main()
