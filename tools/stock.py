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
    "photo-interior": "https://unsplash.com/photos/a-dental-room-with-a-desk-and-chairs-Fdku_oMrDvk",
    "photo-talk": "https://unsplash.com/photos/dentist-talking-to-patient-in-a-modern-dental-office-Bg81yWKZlMg",
    "photo-screen": "https://unsplash.com/photos/man-in-white-dress-shirt-holding-black-pen--m-4tYmtLlI",
    "photo-mirror-smile": "https://unsplash.com/photos/young-woman-smiling-holding-a-mirror-looking-at-her-reflection-Vx71zsOqtSU",
    "photo-implant": "https://unsplash.com/photos/gloved-hand-holding-a-dental-implant-and-crown-eHwRLpfHSKY",
    "photo-aligner": "https://unsplash.com/photos/woman-adjusting-clear-dental-aligners-on-teeth-uTUsnv_UCSQ",
    "photo-instruments": "https://unsplash.com/photos/gloved-hand-holding-dental-examination-tools-98eodnv1abo",
    "photo-model": "https://unsplash.com/photos/dentist-demonstrating-dental-implant-on-model-LOgBp87WzIk",
    "photo-toothbrushes": "https://unsplash.com/photos/bamboo-toothbrushes-in-a-glass-jar-with-eucalyptus-leaves-VCC5Vc0X2F8",
    "photo-mirror-tool": "https://unsplash.com/photos/dental-mirror-and-explorer-tool-ux18C551ghI",
    "photo-waiting-reader": "https://unsplash.com/photos/woman-sitting-in-a-modern-waiting-room-reading-jH05wxjmAWE",
}
# Earlier stock still used by the demo (already exported; credited by page URL)
KEPT = {
    "stock-arrival": "Planner (suitcase by a window)",
    "stock-virtual-call": "Book page: virtual consultation",
    "stock-natural-smile": "Treatment: smile design",
    "stock-case-*": "Sample cases",
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
            files, size = export(grade(Image.open(src)), name)
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
