"""Sample before/after pair for the comparison slider (demo only).

Usage: .venv/Scripts/python -I tools/sample_ba.py
"Before" is an unedited stock photo; "after" is the same photo with a simulated whitening applied to
the teeth only (bright, low-saturation pixels in the mouth area, feathered). The site labels the pair
as a simulated sample. Replace with a real, consented patient pair before launch.
"""
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter

sys.path.insert(0, str(Path(__file__).resolve().parent))
from images import export, grade  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "src-assets" / "stock" / "smile-1.jpg"


def main():
    im = Image.open(SRC).convert("RGB")
    w, h = im.size
    th = round(w / 1.5)  # 3:2 crop around the mouth
    top = max(0, min(h - th, round(h * 0.5 - th / 2)))
    im = grade(im.crop((0, top, w, top + th)))
    x = np.asarray(im).astype(np.float32) / 255
    mx, mn = x.max(2), x.min(2)
    lum = x @ np.array([0.2126, 0.7152, 0.0722], np.float32)
    sat = (mx - mn) / np.maximum(mx, 1e-4)
    teeth = (lum > 0.45) & (sat < 0.38)
    yy, xx = np.mgrid[0:x.shape[0], 0:x.shape[1]]
    cy, cx = x.shape[0] * 0.5, x.shape[1] * 0.472  # the mouth opening in this photo
    teeth &= ((yy - cy) / (x.shape[0] * 0.105)) ** 2 + ((xx - cx) / (x.shape[1] * 0.235)) ** 2 < 1
    mask = Image.fromarray((teeth * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(3))
    m = np.asarray(mask).astype(np.float32)[..., None] / 255
    white = x.copy()
    white[..., 2] = np.minimum(1, white[..., 2] * 1.10 + 0.02)  # less yellow
    white[..., 1] = np.minimum(1, white[..., 1] * 1.05 + 0.02)
    white = np.minimum(1, white * 1.06 + 0.02)
    out = x * (1 - m * 0.85) + white * (m * 0.85)
    export(im, "sample-ba-before", widths=(640, 1280, 1600))
    export(Image.fromarray((out * 255).astype(np.uint8)), "sample-ba-after", widths=(640, 1280, 1600))
    print("wrote sample-ba-before / sample-ba-after", im.size)


if __name__ == "__main__":
    main()
