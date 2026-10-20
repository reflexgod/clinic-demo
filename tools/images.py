"""Responsive image exports: <name>-<w>.{avif,webp,jpg} in assets/img, plus a gentle house grade.

The grade keeps stock photography calm and consistent with the palette: slightly lower saturation,
a touch of warmth and softened blacks. It never retouches people or results.
"""
from pathlib import Path

import numpy as np
from PIL import Image, ImageEnhance, ImageFilter

OUT = Path(__file__).resolve().parent.parent / "assets" / "img"
WIDTHS = (640, 1280, 1920)


def grade(im, saturation=0.86, warmth=0.015, lift=6):
    im = ImageEnhance.Color(im.convert("RGB")).enhance(saturation)
    x = np.asarray(im).astype(np.float32)
    x[..., 0] *= 1 + warmth
    x[..., 2] *= 1 - warmth
    x = lift + x * (255 - lift) / 255
    return Image.fromarray(np.clip(x, 0, 255).astype(np.uint8))


def export(im, name, widths=WIDTHS):
    OUT.mkdir(parents=True, exist_ok=True)
    files = {}
    ws = [w for w in widths if w < im.width] + ([im.width] if im.width < widths[-1] else [])
    for w in ws[:3]:
        h = round(im.height * w / im.width)
        r = im.resize((w, h), Image.LANCZOS)
        if w < im.width:
            r = r.filter(ImageFilter.UnsharpMask(radius=0.8, percent=35, threshold=2))
        base = OUT / f"{name}-{w}"
        r.save(f"{base}.avif", "AVIF", quality=60, speed=4)
        r.save(f"{base}.webp", "WEBP", quality=78, method=6)
        r.save(f"{base}.jpg", "JPEG", quality=78, optimize=True, progressive=True)
        files[w] = {ext: round(Path(f"{base}.{ext}").stat().st_size / 1024) for ext in ("avif", "webp", "jpg")}
    return files, (im.width, im.height)
