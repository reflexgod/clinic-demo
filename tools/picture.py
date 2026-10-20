"""Responsive <picture> markup for a processed photo (AVIF > WebP > JPEG).

Widths and intrinsic dimensions are read from the files in assets/img. With a preview, the <picture>
carries a ~1 KB blurred version as its background, so its fixed-ratio box is never empty.
"""
import base64
import io
import re
from functools import lru_cache
from pathlib import Path

from PIL import Image, ImageFilter

IMG = Path(__file__).resolve().parent.parent / "assets" / "img"


@lru_cache(maxsize=None)
def widths(name):
    found = sorted(int(m.group(1)) for p in IMG.glob(f"{name}-*.jpg")
                   if (m := re.fullmatch(rf"{re.escape(name)}-(\d+)\.jpg", p.name)))
    if not found:
        raise FileNotFoundError(f"No exported image named '{name}' in assets/img (see tools/images.py)")
    return found


@lru_cache(maxsize=None)
def size(name):
    ws = widths(name)
    base = 1280 if 1280 in ws else ws[-1]
    return base, Image.open(IMG / f"{name}-{base}.jpg").size


@lru_cache(maxsize=None)
def lqip(name):
    """Tiny blurred preview as a data URI."""
    im = Image.open(IMG / f"{name}-{widths(name)[0]}.jpg").convert("RGB")
    small = im.resize((12, max(round(12 * im.height / im.width), 1)), Image.LANCZOS)
    small = small.resize((48, max(round(48 * im.height / im.width), 1)), Image.BICUBIC).filter(ImageFilter.GaussianBlur(2))
    buf = io.BytesIO()
    small.save(buf, "JPEG", quality=50, optimize=True)
    return "data:image/jpeg;base64," + base64.b64encode(buf.getvalue()).decode()


def srcset(name, ext, root=""):
    return ", ".join(f"{root}assets/img/{name}-{x}.{ext} {x}w" for x in widths(name))


def picture(name, sizes, alt, root="", eager=False, pos=None, cls=None, preview=True):
    base, (w, h) = size(name)
    load = 'fetchpriority="high"' if eager else 'loading="lazy"'
    position = pos or "50% 50%"
    style = f"background-image: url({lqip(name)}); " if preview else ""
    classes = " ".join(c for c in ["fill", cls] if c)
    return (f'<picture class="{classes}" style="{style}background-position: {position}">'
            f'<source type="image/avif" srcset="{srcset(name, "avif", root)}" sizes="{sizes}">'
            f'<source type="image/webp" srcset="{srcset(name, "webp", root)}" sizes="{sizes}">'
            f'<img src="{root}assets/img/{name}-{base}.jpg" srcset="{srcset(name, "jpg", root)}" sizes="{sizes}" '
            f'width="{w}" height="{h}" {load} decoding="async" alt="{alt}" style="object-position: {position}"></picture>')
