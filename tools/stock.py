"""Download the demo's stock photos (Unsplash, free licence), grade and export them, write CREDITS.md.

Usage: .venv/Scripts/python -I tools/stock.py
Picks live in PICKS below (name -> Unsplash photo page). Originals are cached in src-assets/stock/.
Stock is for the demo only: never presented as a real clinic's patients, cases or doctors.
"""
import re
import sys
import urllib.request
from pathlib import Path

from PIL import Image
from playwright.sync_api import sync_playwright

sys.path.insert(0, str(Path(__file__).resolve().parent))
from images import export, grade  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "src-assets" / "stock"

PICKS = {
    # Clinic settings and people (Indian patients, dentists and clinic rooms)
    "photo-clinic-room": "https://unsplash.com/photos/modern-office-with-desk-chairs-and-computer-bdeLBIPYUrE",
    "photo-clinic-chairs": "https://unsplash.com/photos/red-and-white-leather-padded-chair-I-kDEBUMAaQ",
    "photo-family": "https://unsplash.com/photos/woman-and-child-laughing-on-sofa-a-_1PPjnbUg",
    "photo-checkup-child": "https://unsplash.com/photos/a-young-boy-getting-his-teeth-checked-by-a-dentist-etw3NOpgKDI",
    "photo-smile-man": "https://unsplash.com/photos/man-in-red-crew-neck-shirt-ARBQCe2GrjQ",
    "photo-smile-woman": "https://unsplash.com/photos/woman-in-gray-long-sleeve-shirt-smiling-6luXq9r2z1s",
    "photo-treatment": "https://unsplash.com/photos/a-woman-getting-her-teeth-checked-by-a-dentist-IX5vs6sjSFo",
    "photo-consult-desk": "https://unsplash.com/photos/a-woman-sits-at-a-desk-with-a-laptop-JFD4nvAn0X4",
    "photo-dentist-patient": "https://unsplash.com/photos/a-woman-getting-her-teeth-brushed-by-a-dentist-7n50uixCBV8",
    "photo-older-man": "https://unsplash.com/photos/a-smiling-man-in-a-white-polo-shirt-XGs1bSZ9P6s",
    "photo-video-call": "https://unsplash.com/photos/a-woman-sitting-at-a-table-with-a-laptop-4NRgZmVb7bc",
    "photo-doctor": "https://unsplash.com/photos/a-man-with-a-stethoscope-standing-with-his-arms-crossed-3HIroMoyre8",
    # Sample smiles for the results grid: 1:1, nose to chin
    "smile-2": "https://unsplash.com/photos/person-smiling-with-silver-nose-ring-uUMcHRHBSw8",
    "smile-3": "https://unsplash.com/photos/smiling-man-with-dark-stubble-AJ66j-TX_Ks",
    # Objects and hands only
    "photo-implant": "https://unsplash.com/photos/gloved-hand-holding-a-dental-implant-and-crown-eHwRLpfHSKY",
    "photo-model": "https://unsplash.com/photos/dentist-demonstrating-dental-implant-on-model-LOgBp87WzIk",
    "photo-mirror-tool": "https://unsplash.com/photos/dental-mirror-and-explorer-tool-ux18C551ghI",
}
# Square nose-to-chin crops for the smile grid: (centre x, centre y, side as a fraction of the height)
SQUARE = {
    "smile-2": (.5, .4, .56), "smile-3": (.52, .58, .42),
}
# 4:5 crops for portraits: (centre x, centre y, width) as fractions of the photo
CROPS = {
    "photo-smile-woman": (.5, .45, 1.0),
    "photo-doctor": (.5, .4, .78),
}


def crop45(im, cx, cy, wf):
    w = round(im.width * wf)
    h = min(round(w * 1.25), im.height)
    w = round(h / 1.25)
    x = min(max(round(cx * im.width - w / 2), 0), im.width - w)
    y = min(max(round(cy * im.height - h / 2), 0), im.height - h)
    return im.crop((x, y, x + w, y + h))


# Earlier stock still used by the demo (already exported)
KEPT = {
    "stock-arrival": "Planner (suitcase by a window)",
    "sample-ba-*": "Before/after sample (tools/sample_ba.py, from an Unsplash smile close-up)",
}
UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36"


def main():
    SRC.mkdir(parents=True, exist_ok=True)
    rows = []
    with sync_playwright() as p:
        b = p.chromium.launch(channel="chrome", headless=True, args=["--disable-blink-features=AutomationControlled"])
        pg = b.new_context(user_agent=UA).new_page()
        for name, url in PICKS.items():
            pg.goto(url, wait_until="domcontentloaded", timeout=60000)
            pg.wait_for_timeout(2000)
            info = pg.evaluate("""() => {
              const og = document.querySelector('meta[property="og:image"]');
              const a = [...document.querySelectorAll('a[href^="/@"]')].find(x => x.textContent.trim());
              return { img: og && og.content, author: a ? a.textContent.trim() : 'Unknown', profile: a ? 'https://unsplash.com' + a.getAttribute('href') : '' };
            }""")
            src = SRC / f"{name}.jpg"
            if not src.exists():
                raw = re.sub(r"\?.*$", "", info["img"]) + "?w=2400&q=85&fm=jpg"
                src.write_bytes(urllib.request.urlopen(urllib.request.Request(raw, headers={"User-Agent": UA}), timeout=90).read())
            im = Image.open(src).convert("RGB")
            if name in CROPS:
                im = crop45(im, *CROPS[name])
            elif name in SQUARE:
                cx, cy, side = SQUARE[name]
                n = min(round(side * im.height), im.width, im.height)
                x = min(max(round(cx * im.width - n / 2), 0), im.width - n)
                y = min(max(round(cy * im.height - n / 2), 0), im.height - n)
                im = im.crop((x, y, x + n, y + n))
            files, size = export(grade(im), name)
            rows.append(f"| `assets/img/{name}-*` | {info['author']} ({info['profile']}) | {url} |")
            print(f"{name:<22} {size[0]}x{size[1]}  {info['author']:<24} 1280: {files.get(1280)}")
        b.close()
    lines = ["# Image credits (demo only)", "",
             "All photography is stock, used as placeholders for a fictional clinic. None of it shows a real",
             "clinic's premises, patients, doctors or results. Replace before any real launch.", "",
             "## Unsplash (Unsplash License)", "", "| Files | Photographer | Source |", "|---|---|---|", *rows, "",
             "Earlier Unsplash stock also used: " + ", ".join(f"`{k}` ({v})" for k, v in KEPT.items()) + ".", ""]
    (ROOT / "CREDITS.md").write_text("\n".join(lines), encoding="utf-8", newline="\n")


if __name__ == "__main__":
    main()
