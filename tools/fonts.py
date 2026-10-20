"""Download self-hosted web fonts (latin subsets, variable) into assets/fonts.

Usage: .venv/Scripts/python -I tools/fonts.py
Reads the families from FONTS below; to change fonts for a prospect, edit clinic.config.js (theme.fonts)
and this list together, then rebuild. Both families are SIL Open Font License.
"""
import io
import re
import urllib.request
from pathlib import Path

from fontTools import subset
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer

OUT = Path(__file__).resolve().parent.parent / "assets" / "fonts"
UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36"
# file name -> (Google Fonts css2 family spec, axis ranges kept, licence path in google/fonts)
FONTS = {
    "fraunces": ("Fraunces:opsz,wght@9..144,300..500", {"wght": (300, 450), "opsz": (24, 144)}, "ofl/fraunces/OFL.txt"),
    "manrope": ("Manrope:wght@400..600", {"wght": (400, 600)}, "ofl/manrope/OFL.txt"),
}
# Basic Latin + Latin-1 + dashes, quotes, bullet, ellipsis, middle dot, rupee sign
UNICODES = [*range(0x20, 0x7F), *range(0xA0, 0x100), 0x2013, 0x2014, 0x2018, 0x2019, 0x201C, 0x201D, 0x2022, 0x2026, 0x20B9]


def get(url):
    return urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": UA}), timeout=60).read()


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    for name, (spec, axes, licence) in FONTS.items():
        css = get(f"https://fonts.googleapis.com/css2?family={spec}&display=swap").decode()
        block = css.split("/* latin */")[1]
        url = re.search(r"url\((https://[^)]+\.woff2)\)", block).group(1)
        font = TTFont(io.BytesIO(get(url)))
        opts = subset.Options()
        opts.flavor = "woff2"
        opts.layout_features = ["kern", "liga", "calt", "case", "lnum", "tnum", "pnum", "onum"]
        sub = subset.Subsetter(opts)
        sub.populate(unicodes=UNICODES)
        sub.subset(font)
        font = instancer.instantiateVariableFont(font, axes)
        subset.save_font(font, str(OUT / f"{name}.woff2"), opts)
        (OUT / f"OFL-{name}.txt").write_bytes(get(f"https://raw.githubusercontent.com/google/fonts/main/{licence}"))
        print(f"{name}.woff2  {(OUT / f'{name}.woff2').stat().st_size / 1024:.1f} KB")


if __name__ == "__main__":
    main()
