"""Screenshots + rule audit of pages at 1440 / 1024 / 768 / 390px.

Usage: .venv/Scripts/python -I tools/screens.py [path ...] [--base http://127.0.0.1:8080/] [--out review] [--states]
Needs the site served locally (python -m http.server 8080). Uses the installed Chrome.
Audit flags: rounded corners, shadows and gradients, colours outside the config palette,
horizontal overflow, console errors, images without alt, fonts that failed to load.
"""
import argparse
import json
import subprocess
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent
VIEWPORTS = [(1440, 900, False), (1024, 768, False), (768, 1024, True), (390, 844, True)]


def palette():
    js = "globalThis.window={};require('./assets/js/clinic.config.js');process.stdout.write(JSON.stringify(window.CLINIC.theme.colors))"
    cols = json.loads(subprocess.run(["node", "-e", js], cwd=ROOT, capture_output=True, text=True).stdout)
    return [[int(v.lstrip("#")[i:i + 2], 16) for i in (0, 2, 4)] for v in cols.values()]


AUDIT_JS = r"""
(palette) => {
  const pal = new Set(palette.map(c => c.join(',')));
  const out = { radius: [], shadow: [], colours: {}, noAlt: [], overflowX: document.documentElement.scrollWidth - innerWidth };
  const rgb = (s) => { const m = s.match(/rgba?\(([^)]+)\)/); if (!m) return null; const p = m[1].split(/[ ,/]+/).filter(Boolean).map(Number); return p.length === 4 && p[3] === 0 ? null : p.slice(0, 3).map(Math.round).join(','); };
  const note = (c, el, prop) => { if (c && !pal.has(c)) { const k = c + ' ' + prop; out.colours[k] = out.colours[k] || (el.className || el.tagName).toString().slice(0, 50); } };
  for (const el of document.querySelectorAll('body *')) {
    const cs = getComputedStyle(el);
    if (cs.display === 'none') continue;
    if (parseFloat(cs.borderTopLeftRadius) > 0 || parseFloat(cs.borderBottomRightRadius) > 0) out.radius.push((el.className || el.tagName).toString().slice(0, 50));
    if (['SOURCE', 'SCRIPT', 'STYLE', 'TEMPLATE'].includes(el.tagName)) continue;
    if (cs.boxShadow !== 'none' || cs.textShadow !== 'none') out.shadow.push((el.className || el.tagName).toString().slice(0, 50));
    if (cs.backgroundImage.includes('gradient')) out.shadow.push('gradient: ' + (el.className || el.tagName).toString().slice(0, 50));
    if (['IMG', 'VIDEO', 'PICTURE', 'IFRAME'].includes(el.tagName)) { if (el.tagName === 'IMG' && !el.hasAttribute('alt')) out.noAlt.push(el.src); continue; }
    if ((el.innerText || '').trim() && el.children.length === 0) note(rgb(cs.color), el, 'color');
    note(rgb(cs.backgroundColor), el, 'background');
    for (const side of ['Top', 'Right', 'Bottom', 'Left']) if (parseFloat(cs[`border${side}Width`]) > 0 && cs[`border${side}Style`] !== 'none') note(rgb(cs[`border${side}Color`]), el, 'border');
  }
  out.radius = [...new Set(out.radius)]; out.shadow = [...new Set(out.shadow)];
  out.fonts = [...document.fonts].map(f => `${f.family} ${f.status}`);
  return out;
}
"""


def settle(page):
    """Scroll the whole page so lazy images load and reveals run, then return to the top."""
    h = page.evaluate("document.documentElement.scrollHeight")
    for y in range(0, h, 500):
        page.evaluate(f"window.scrollTo(0, {y})")
        page.wait_for_timeout(150)
    page.wait_for_timeout(1500)
    page.evaluate("window.scrollTo(0, 0)")
    page.wait_for_timeout(600)


def stitch(page, path, top=0, height=None):
    """Capture a tall region as viewport-sized shots stitched together (keeps touch emulation)."""
    from PIL import Image
    vw, vh = page.viewport_size["width"], page.viewport_size["height"]
    height = int(height or page.evaluate("document.documentElement.scrollHeight"))
    canvas = Image.new("RGB", (vw, height), "white")
    y = int(top)
    tmp = Path(path).with_suffix(".tmp.png")
    while True:
        page.evaluate(f"window.scrollTo(0, {y})")
        page.wait_for_timeout(250)
        actual = page.evaluate("scrollY")
        page.screenshot(path=tmp)
        canvas.paste(Image.open(tmp), (0, int(actual - top)))
        if actual + vh >= top + height or actual < y:
            break
        y += vh
    tmp.unlink()
    canvas.save(path)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("paths", nargs="*", default=[""])
    ap.add_argument("--base", default="http://127.0.0.1:8080/")
    ap.add_argument("--out", default=str(ROOT / "review"))
    ap.add_argument("--states", action="store_true", help="also capture index hover, story, case view and menu")
    ap.add_argument("--only", type=int, help="only this viewport width")
    a = ap.parse_args()
    out = Path(a.out)
    out.mkdir(parents=True, exist_ok=True)
    pal = palette()
    report = {}
    with sync_playwright() as p:
        browser = p.chromium.launch(channel="chrome", headless=True)
        for path in a.paths:
            slug = path.strip("/").replace("/", "-") or "home"
            for w, h, touch in VIEWPORTS:
                if a.only and a.only != w:
                    continue
                ctx = browser.new_context(viewport={"width": w, "height": h}, has_touch=touch, is_mobile=(w < 768))
                page = ctx.new_page()
                errors = []
                page.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)
                page.on("pageerror", lambda e: errors.append(str(e)))
                page.goto(a.base + path, wait_until="networkidle")
                page.wait_for_timeout(2200)  # hero reveal
                page.screenshot(path=out / f"{slug}-{w}-top.png")
                settle(page)
                hide = page.add_style_tag(content=".mobile-bar,.riya-launcher,.header{visibility:hidden!important}")
                stitch(page, out / f"{slug}-{w}.png")
                hide.evaluate("el => el.remove()")
                audit = page.evaluate(AUDIT_JS, pal)
                audit["errors"] = errors
                audit["height"] = page.evaluate("document.documentElement.scrollHeight")
                if a.states:
                    if w >= 1024 and page.locator(".index__row").count():
                        page.locator(".index__row").nth(1).scroll_into_view_if_needed()
                        page.wait_for_timeout(600)
                        page.locator(".index__row").nth(1).hover()
                        page.wait_for_timeout(900)
                        page.screenshot(path=out / f"{slug}-{w}-index-hover.png")
                        page.mouse.move(5, 5)
                    if page.locator("[data-story]").count():
                        page.evaluate("document.querySelectorAll('[data-story-step]')[1].scrollIntoView({block: 'center'})")
                        page.wait_for_timeout(1400)
                        page.screenshot(path=out / f"{slug}-{w}-story.png")
                    if page.locator(".case").count():
                        page.locator(".case").first.scroll_into_view_if_needed()
                        page.locator(".case").first.click()
                        page.wait_for_timeout(900)
                        page.screenshot(path=out / f"{slug}-{w}-case-view.png")
                        audit["case_view_focus"] = page.evaluate("document.activeElement.textContent")
                        page.keyboard.press("Escape")
                        page.wait_for_timeout(500)
                    if w < 900:
                        page.evaluate("window.scrollTo(0, 0)")
                        page.click(".menu-toggle")
                        page.wait_for_timeout(600)
                        page.screenshot(path=out / f"{slug}-{w}-menu.png")
                        page.keyboard.press("Escape")
                        page.wait_for_timeout(500)
                report[f"{slug} {w}"] = audit
                ctx.close()
        browser.close()
    (out / "audit.json").write_text(json.dumps(report, indent=1))
    for k, r in report.items():
        flags = {x: r[x] for x in ("radius", "shadow", "colours", "noAlt", "errors") if r[x]}
        print(f"== {k:<34} h {r['height']:>6}  overflowX {r['overflowX']}  {flags or 'clean'}")
        bad = [f for f in r["fonts"] if not f.endswith("loaded")]
        if bad:
            print("   fonts:", bad)


if __name__ == "__main__":
    main()
