"""Sample photo for the before/after block (demo only).

Usage: .venv/Scripts/python -I tools/sample_ba.py
Exports one unedited stock close-up as sample-ba-before. No "after" is simulated: the site says a real,
consented before/after case will appear there.
"""
import sys
from pathlib import Path

from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parent))
from images import export, grade  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "src-assets" / "stock" / "smile-1.jpg"


def main():
    im = Image.open(SRC).convert("RGB")
    w, h = im.size
    th = round(w * 3 / 4)  # 4:3 crop around the mouth
    top = max(0, min(h - th, round(h * 0.5 - th / 2)))
    im = grade(im.crop((0, top, w, top + th)))
    export(im, "sample-ba-before", widths=(640, 1280, 1600))
    print("wrote sample-ba-before", im.size)


if __name__ == "__main__":
    main()
