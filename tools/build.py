"""Build every page of the site from assets/js/clinic.config.js.

Usage: .venv/Scripts/python -I tools/build.py
Needs Node (to read the config exactly as the browser does) and Pillow + fontTools (tools/requirements.txt).

Writes:
  index.html                 Home
  treatments/<slug>/         One page per treatment in config.treatments
  results/                   All cases, with filters
  book/                      Book a visit, the planner and the visit details
  favicon.svg, apple-touch-icon.png, site.webmanifest
Nothing else needs editing for a new clinic: change the config, add photos, rebuild.
"""
import html
import json
import re
import shutil
import subprocess
import sys
from pathlib import Path

from fontTools.ttLib import TTFont
from fontTools.varLib import instancer
from PIL import Image, ImageDraw, ImageFont

sys.path.insert(0, str(Path(__file__).resolve().parent))
from picture import picture, srcset, widths  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
CONFIG = ROOT / "assets" / "js" / "clinic.config.js"
FONTS = ROOT / "assets" / "fonts"
SYSTEM_FONTS = {"Georgia": "georgia.ttf", "Arial": "arial.ttf", "Times New Roman": "times.ttf", "Helvetica": "arial.ttf"}

e = html.escape


def load_config():
    js = f"globalThis.window = {{}}; require({json.dumps(str(CONFIG))}); process.stdout.write(JSON.stringify(window.CLINIC));"
    out = subprocess.run(["node", "-e", js], capture_output=True, text=True, encoding="utf-8")
    if out.returncode:
        sys.exit(f"Could not read {CONFIG.name}:\n{out.stderr}")
    return json.loads(out.stdout)


# ---------------------------------------------------------------------------------------------- fonts

def static_font(path, axes):
    font = TTFont(path)
    if "fvar" in font:
        limits = {a.axisTag: min(max(axes.get(a.axisTag, a.defaultValue), a.minValue), a.maxValue) for a in font["fvar"].axes}
        font = instancer.instantiateVariableFont(font, limits)
    return font


def advance(font, text):
    cmap, hmtx, upm = font.getBestCmap(), font["hmtx"], font["head"].unitsPerEm
    return sum(hmtx[cmap[ord(c)]][0] for c in text if ord(c) in cmap) / upm


def fallback_face(name, spec, axes, sample):
    """@font-face for a local fallback scaled to the web font's metrics, so the swap doesn't shift text."""
    web = static_font(FONTS / spec["file"], axes)
    local = Path("C:/Windows/Fonts") / SYSTEM_FONTS.get(spec["fallback"], "")
    if not local.is_file():
        return ""
    fb = TTFont(local)
    adjust = advance(web, sample) / advance(fb, sample)
    upm, hhea = web["head"].unitsPerEm, web["hhea"]
    pct = lambda v: f"{abs(v) / upm / adjust * 100:.2f}%"  # noqa: E731
    return (f'@font-face{{font-family:"{name} fallback";src:local("{spec["fallback"]}");size-adjust:{adjust * 100:.2f}%;'
            f'ascent-override:{pct(hhea.ascent)};descent-override:{pct(hhea.descent)};line-gap-override:{pct(hhea.lineGap)}}}')


def theme_css(c):
    t = c["theme"]
    head, body = t["fonts"]["heading"], t["fonts"]["body"]
    sample = c["description"] + " " + " ".join(x["summary"] for x in c["treatments"])
    col = t["colors"]
    ink = col["ink"].lstrip("#")
    rgb = ",".join(str(int(ink[i:i + 2], 16)) for i in (0, 2, 4))
    # Footer wordmark: its width in em (Fraunces at the size it is set, -0.02em tracking), so CSS can fit it
    wm_font = static_font(FONTS / head["file"], {"wght": 300, "opsz": 144})
    wm = c["wordmark"]
    wm_em = advance(wm_font, wm) - 0.02 * (len(wm) - 1) + 0.76  # + the logo mark and its gap
    return "".join([
        f'@font-face{{font-family:"{head["family"]}";src:url("{{R}}assets/fonts/{head["file"]}") format("woff2");font-weight:{head["weight"]};font-display:swap}}',
        f'@font-face{{font-family:"{body["family"]}";src:url("{{R}}assets/fonts/{body["file"]}") format("woff2");font-weight:{body["weight"]};font-display:swap}}',
        fallback_face(head["family"], head, {"wght": head["use"], "opsz": 72}, sample),
        fallback_face(body["family"], body, {"wght": body["use"]}, sample),
        f':root{{--bg:{col["bg"]};--ink:{col["ink"]};--stone:{col["stone"]};--accent:{col["accent"]};--ink-rgb:{rgb};',
        f'--serif:"{head["family"]}","{head["family"]} fallback",{head["fallback"]},serif;--serif-weight:{head["use"]};',
        f'--sans:"{body["family"]}","{body["family"]} fallback",{body["fallback"]},sans-serif;--wordmark-em:{wm_em:.4f}}}',
    ])


# ---------------------------------------------------------------------------------------------- pieces

def mark_svg(c, cls="mark"):
    """The logo mark as inline SVG, drawn in currentColor so it follows the text colour."""
    lg = c["logo"]
    return (f'<svg class="{cls}" viewBox="0 0 40 40" aria-hidden="true" focusable="false"><path d="{lg["mark"]}" fill="none" '
            f'stroke="currentColor" stroke-width="{lg["stroke"]}" stroke-linecap="round" stroke-linejoin="round"/></svg>')


def mask(text, i, tag="span"):
    return f'<{tag} class="mask"><span style="--i:{i}">{text}</span></{tag}>'


def wa_link(c, message):
    from urllib.parse import quote
    return f"https://wa.me/{c['contact']['whatsapp']}?text={quote(message)}"


def tel(c):
    return f"tel:{c['contact']['phoneTel']}"


def rating_line(c):
    r = c.get("rating")
    if not r:
        return ""
    sample = " · Sample" if (r.get("sample") and c["demo"]) else ""
    return f"★ {e(r['value'])} on {e(r['source'])} · {e(r['count'])} reviews{sample}"


def proof(text, cls=""):
    return f'<p class="proof{(" " + cls) if cls else ""}">{text}</p>' if text else ""


def head(c, R, page, theme):
    site = c["site"]
    url = site["url"] + page["path"]
    title, desc = page["title"], page.get("description", c["description"])
    og_img = page.get("og") or c["hero"]["image"]
    og_w = 1280 if 1280 in widths(og_img) else widths(og_img)[-1]
    preload = ""
    if page.get("lcp"):
        name, sizes = page["lcp"]
        preload = (f'\n  <link rel="preload" as="image" type="image/avif" imagesrcset="{srcset(name, "avif", R)}" '
                   f'imagesizes="{sizes}" fetchpriority="high">')
    hf, bf = c["theme"]["fonts"]["heading"]["file"], c["theme"]["fonts"]["body"]["file"]
    days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]
    hours = [{"@type": "OpeningHoursSpecification", "dayOfWeek": days[i], "opens": d[0], "closes": d[1]}
             for i, d in enumerate(c["hours"]["days"]) if d]
    ld = {
        "@context": "https://schema.org", "@type": "Dentist", "name": c["name"], "url": site["url"],
        "description": c["description"], "telephone": c["contact"]["phoneTel"],
        "image": f"{site['url']}assets/img/{c['hero']['image']}-1280.jpg",
        "address": {"@type": "PostalAddress", "streetAddress": c["address"]["street"], "addressLocality": c["address"]["locality"],
                    "addressRegion": c["address"]["region"], "postalCode": c["address"]["postalCode"], "addressCountry": c["address"]["country"]},
        "openingHoursSpecification": hours,
    }
    extra_ld = "".join(f'\n  <script type="application/ld+json">{json.dumps(x, ensure_ascii=False)}</script>' for x in page.get("jsonld", []))
    robots = '\n  <meta name="robots" content="noindex, nofollow">' if site["noindex"] else ""
    return f"""<!doctype html>
<html lang="{site['lang']}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <title>{e(title)}</title>
  <meta name="description" content="{e(desc)}">{robots}
  <link rel="canonical" href="{url}">
  <meta name="theme-color" content="{c['theme']['colors']['bg']}">
  <link rel="icon" href="{R}favicon.svg" type="image/svg+xml">
  <link rel="apple-touch-icon" href="{R}apple-touch-icon.png">
  <link rel="manifest" href="{R}site.webmanifest">
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="{e(c['name'])}">
  <meta property="og:title" content="{e(title)}">
  <meta property="og:description" content="{e(desc)}">
  <meta property="og:url" content="{url}">
  <meta property="og:image" content="{site['url']}assets/img/{og_img}-{og_w}.jpg">
  <meta property="og:locale" content="{site['locale']}">
  <meta name="twitter:card" content="summary_large_image">
  <link rel="preload" href="{R}assets/fonts/{hf}" as="font" type="font/woff2" crossorigin>
  <link rel="preload" href="{R}assets/fonts/{bf}" as="font" type="font/woff2" crossorigin>{preload}
  <style>{theme.replace("{R}", R)}</style>
  <link rel="stylesheet" href="{R}assets/css/site.css">
  <script>document.documentElement.classList.add('js')</script>
  <script src="{R}assets/js/clinic.config.js" defer></script>
  <script src="{R}assets/js/site.js" defer></script>
  <script type="application/ld+json">{json.dumps(ld, ensure_ascii=False)}</script>{extra_ld}
</head>"""


def header(c, R, home):
    tl = "".join(f'<li><a href="{R}treatments/{t["slug"]}/">{e(t["name"])}</a></li>' for t in c["treatments"])
    return f"""
<body class="{'has-hero' if home.get('hero') else 'no-hero'}">
  <a class="skip-link" href="#main">Skip to content</a>
  <header class="header" data-header>
    <a class="brand" href="{R or './'}" aria-label="{e(c['name'])}, home">{mark_svg(c, "brand__mark")}<span class="wordmark">{e(c['wordmark'])}</span></a>
    <nav class="nav" aria-label="Main">
      <a href="{R}#treatments">Treatments</a>
      <a href="{R}results/">Results</a>
      <a href="{R}book/#visit">Visit</a>
    </nav>
    <a class="header__cta link" href="{R}book/">{e(c['hero']['cta'])}</a>
    <button class="menu-toggle" type="button" aria-expanded="false" aria-controls="menu">Menu</button>
  </header>

  <div class="menu" id="menu" role="dialog" aria-modal="true" aria-label="Menu" inert>
    <div class="menu__top">
      <span class="brand">{mark_svg(c, "brand__mark")}<span class="wordmark">{e(c['wordmark'])}</span></span>
      <button class="menu__close" type="button" data-menu-close>Close</button>
    </div>
    <nav class="menu__body" aria-label="Menu">
      <p class="label">Treatments</p>
      <ul class="menu__treatments">{tl}</ul>
      <ul class="menu__main">
        <li><a href="{R}results/">Results</a></li>
        <li><a href="{R}book/#visit">Visit</a></li>
        <li><a href="{R}book/">{e(c['hero']['cta'])}</a></li>
      </ul>
    </nav>
    <div class="menu__foot">
      <a href="{tel(c)}">{e(c['contact']['phoneDisplay'])}</a>
      <a href="{wa_link(c, c['contact']['whatsappGreeting'])}">WhatsApp</a>
      <p class="open-status" data-open-status></p>
    </div>
  </div>
"""


def footer(c, R):
    a = c["address"]
    hours = "<br>".join(e(x) for x in c["hours"]["summary"])
    demo = (f'<li>Demo site: {e(c["name"])} and its team are fictional. Reviews and cases are samples.</li>' if c["demo"] else "")
    return f"""
  <footer class="footer" data-footer>
    <div class="footer__grid">
      <div>
        <p class="label">Visit</p>
        <address>{'<br>'.join(e(x) for x in a['lines'])}</address>
      </div>
      <div>
        <p class="label">Hours</p>
        <p>{hours}</p>
      </div>
      <div>
        <p class="label">Contact</p>
        <ul>
          <li><a href="{tel(c)}">{e(c['contact']['phoneDisplay'])}</a></li>
          <li><a href="{wa_link(c, c['contact']['whatsappGreeting'])}">WhatsApp</a></li>
        </ul>
      </div>
      <nav aria-labelledby="footer-explore">
        <p class="label" id="footer-explore">Explore</p>
        <ul>
          <li><a href="{R}#treatments">Treatments</a></li>
          <li><a href="{R}results/">Results</a></li>
          <li><a href="{R}book/">{e(c['hero']['cta'])}</a></li>
        </ul>
      </nav>
    </div>
    <ul class="footer__meta">
      <li>© {c['site']['year']} {e(c['name'])}</li>
      {demo}
      <li>{e(c['site']['credit'])}</li>
    </ul>
    <p class="footer__wordmark" aria-hidden="true" data-wordmark><span>{mark_svg(c, "footer__mark")}{e(c['wordmark'])}</span></p>
  </footer>

  <nav class="mobile-bar" aria-label="Quick actions" data-mobile-bar inert>
    <a href="{tel(c)}">Call</a>
    <a href="{wa_link(c, c['contact']['whatsappGreeting'])}">WhatsApp</a>
    <a href="{R}book/" data-quick-request>Book</a>
  </nav>

  <div class="quick" id="quick-request" role="dialog" aria-modal="true" aria-labelledby="quick-title" inert data-quick>
    <div class="quick__panel">
      <div class="quick__top">
        <p class="label" data-quick-count>1 / 3</p>
        <button type="button" data-quick-close>Close</button>
      </div>
      <h2 class="h3" id="quick-title" tabindex="-1" data-quick-q>What is the visit for?</h2>
      <div class="quick__options" data-quick-options></div>
      <div class="quick__done" data-quick-done hidden>
        <p class="quick__summary" data-quick-summary></p>
        <a class="link" href="#" data-quick-send>Send on WhatsApp</a>
        <p class="proof">{e(c['proof']['noPressure'])}</p>
        <button class="quick__restart" type="button" data-quick-restart>Start again</button>
      </div>
    </div>
  </div>
"""


def case_view(R):
    return """
  <div class="case-view" id="case-view" role="dialog" aria-modal="true" aria-labelledby="cv-title" inert>
    <div class="case-view__bar">
      <button type="button" data-cv-prev>Previous</button>
      <p class="case-view__count" data-cv-count></p>
      <button type="button" data-cv-next>Next</button>
      <button type="button" data-cv-close>Close</button>
    </div>
    <div class="case-view__inner">
      <div class="case-view__media" data-cv-media></div>
      <div class="case-view__text">
        <p class="label" data-cv-sample>Sample case</p>
        <h2 id="cv-title" data-cv-title></h2>
        <p class="case-view__meta" data-cv-meta></p>
        <dl class="case-story">
          <div><dt class="label">Concern</dt><dd data-cv-concern></dd></div>
          <div><dt class="label">Plan</dt><dd data-cv-plan></dd></div>
          <div><dt class="label">Result</dt><dd data-cv-result></dd></div>
        </dl>
        <blockquote class="case-note"><p data-cv-note></p></blockquote>
        <a class="link" href="#" data-cv-book>About this treatment</a>
      </div>
    </div>
  </div>
"""


def hero(c, R, label, lines, lede, cta_href, cta, image, alt, pos, short=False):
    title = "".join(mask(e(line), i) for i, line in enumerate(lines))
    after = f'style="--i:{len(lines)}"'
    video = ""
    if c["hero"].get("video") and not short:
        video = f'<video class="hero__video" data-base="{R}{c["hero"]["video"]}" muted loop playsinline preload="none" aria-hidden="true" tabindex="-1"></video>'
    status = "" if short else ' <span class="hero__status" data-open-status></span>'
    second = "" if short else f'<a class="link link--light" href="{wa_link(c, c["contact"]["whatsappGreeting"])}">{e(c["hero"]["secondary"])}</a>'
    trust = "" if short else proof(rating_line(c), "proof--light hero__after")
    return f"""
    <section class="hero{' hero--short' if short else ''}" data-hero aria-labelledby="page-title">
      <div class="hero__media">
        {picture(image, '100vw', e(alt), R, eager=True, pos=pos, preview=False)}
        {video}
      </div>
      <div class="hero__content">
        <p class="label hero__label hero__after">{e(label)}{status}</p>
        <h1 class="hero__title" id="page-title">{title}</h1>
        <p class="hero__lede hero__after" {after}>{e(lede)}</p>
        <p class="hero__cta hero__after" {after}><a class="link link--light" href="{cta_href}" data-quick-request>{e(cta)}</a>{second}</p>
        {trust.replace('hero__after"', 'hero__after" ' + after, 1) if trust else ''}
      </div>
    </section>"""


def intro(c):
    i = c["intro"]
    return f"""
    <section class="intro-band" aria-labelledby="intro-title">
      <div class="container intro-band__inner fade">
        <h2 class="h2" id="intro-title">{e(i['title'])}</h2>
        <p class="lede">{e(i['text'])}</p>
      </div>
    </section>"""


def pillars(c, R):
    items = "".join(f"""
        <li class="pillar fade">
          <div class="pillar__media">{picture(x['image'], '(min-width: 900px) 34vw, 100vw', e(x['imageAlt']), R, pos=x.get('pos'))}</div>
          <div class="pillar__text">
            <h3 class="card__name">{e(x['title'])}</h3>
            <p class="card__line">{e(x['text'])}</p>
          </div>
        </li>""" for x in c["pillars"])
    return f"""
    <section class="pillars" aria-label="Why patients choose us">
      <ul class="pillars__row">{items}
      </ul>
    </section>"""


def clinic(c, R):
    k = c["clinic"]
    return f"""
    <section class="clinic" aria-labelledby="clinic-title">
      {picture(k['image'], '100vw', e(k['imageAlt']), R, pos=k.get('pos'))}
      <div class="clinic__content fade">
        <p class="label" id="clinic-title">{e(k['label'])}</p>
        <p class="clinic__text">{e(k['text'])}</p>
        <a class="link link--light" href="#doctor">{e(k['link'])}</a>
      </div>
    </section>"""


def treatment_index(c, R):
    rows, previews = [], []
    for n, t in enumerate(c["treatments"]):
        rows.append(f"""
          <li><a class="index__row" href="{R}treatments/{t['slug']}/" data-preview="{n}">
            <span class="index__thumb">{picture(t['image'], '72px', '', R, pos=t.get('pos'), preview=False)}</span>
            <span class="index__name">{e(t['name'])}</span>
            <span class="index__line">{e(t['summary'])}</span>
          </a></li>""")
        previews.append(picture(t["image"], "(min-width: 900px) 220px, 1px", "", R, pos=t.get("pos"), cls="index__img", preview=False))
    return f"""
    <section class="section section--stone index" id="treatments" aria-labelledby="treatments-title" data-index>
      <div class="container">
        <div class="section__head fade">
          <p class="label">Treatments</p>
          <h2 class="h2" id="treatments-title">Care for the whole family</h2>
        </div>
        <ul class="index__list">{''.join(rows)}
        </ul>
      </div>
      <div class="index__preview" aria-hidden="true" data-index-preview>{''.join(previews)}</div>
    </section>"""


def slider(c, R, sizes="(min-width: 700px) 640px, 100vw"):
    b = c["beforeAfter"]
    return f"""<figure class="ba-wrap">
          <div class="ba" data-ba>
            {picture(b['after'], sizes, 'Sample after: the same smile with simulated whitening', R)}
            <div class="ba__before">{picture(b['before'], sizes, 'Sample before: the original smile', R)}</div>
            <span class="ba__tag ba__tag--before label" aria-hidden="true">Before</span>
            <span class="ba__tag ba__tag--after label" aria-hidden="true">After</span>
            <input class="ba__range" type="range" min="0" max="100" value="50" aria-label="Compare before and after (sample)">
            <span class="ba__handle" aria-hidden="true"><span class="ba__grip"></span></span>
          </div>
          <figcaption class="compare__note">{e(b['note'])}</figcaption>
        </figure>"""


def results_home(c, R):
    tiles = "".join(f"""
            <li class="case-item" data-cat="{c['cases'][i]['cat']}">
              <button class="case" type="button" data-case="{i}">
                <span class="case__media">{picture(c['cases'][i]['image'], '(min-width: 900px) 22vw, 50vw', '', R, pos='50% 40%')}</span>
                <span class="case__name">{e(c['cases'][i]['name'])}<span class="visually-hidden"> (sample case)</span></span>
              </button>
            </li>""" for i in range(min(4, len(c["cases"]))))
    return f"""
    <section class="section results-home" aria-labelledby="results-title" data-cases-block>
      <div class="container">
        <div class="section__head fade">
          <p class="label">Results · Sample</p>
          <h2 class="h2" id="results-title">{e(c['beforeAfter']['title'])}</h2>
        </div>
        <div class="results-home__grid">
          <div class="fade">{slider(c, R)}</div>
          <div class="fade">
            <ul class="smiles" data-cases>{tiles}
            </ul>
            <p class="section__more"><a class="link" href="{R}results/">See all results</a></p>
          </div>
        </div>
      </div>
      <script type="application/json" id="case-media">{media_map(c)}</script>
    </section>"""


def treatment_grid(c, R, items, heading_id, label, title, section_id="treatments", stone=False):
    cards = "".join(f"""
          <li class="fade">
            <a class="card" href="{R}treatments/{t['slug']}/">
              <span class="card__media">{picture(t['image'], '(min-width: 900px) 30vw, (min-width: 600px) 45vw, 100vw', e(t['imageAlt']), R, pos=t.get('pos'))}</span>
              <span class="card__name">{e(t['name'])}</span>
              <span class="card__line">{e(t['summary'])}</span>
            </a>
          </li>""" for t in items)
    return f"""
    <section class="section treatments{' section--stone' if stone else ''}" id="{section_id}" aria-labelledby="{heading_id}">
      <div class="container">
        <div class="section__head fade">
          <p class="label">{e(label)}</p>
          <h2 class="h2" id="{heading_id}">{e(title)}</h2>
        </div>
        <ul class="grid3">{cards}
        </ul>
      </div>
    </section>"""


def case_tiles(c, R, indices, featured=False):
    tiles = []
    for i in indices:
        k = c["cases"][i]
        hidden = '<span class="visually-hidden"> (sample case)</span>' if k["sample"] else ""
        tiles.append(f"""
          <li class="case-item fade" data-cat="{k['cat']}">
            <button class="case" type="button" data-case="{i}">
              <span class="case__media">{picture(k['image'], '(min-width: 900px) 30vw, (min-width: 600px) 45vw, 100vw', '', R, pos='50% 45%')}</span>
              <span class="case__name">{e(k['name'])}{hidden}</span>
              <span class="case__meta label">{e(k['meta'])}</span>
            </button>
          </li>""")
    return f'<ul class="cases__grid{" cases__grid--featured" if featured else ""}" data-cases>{"".join(tiles)}\n        </ul>'


def media_map(c):
    names = {k[f] for k in c["cases"] for f in ("image", "face", "before") if k.get(f)}
    return json.dumps({n: widths(n) for n in sorted(names)})


def cases_section(c, R, indices, heading_id, label, title, lede, link=None, filters=False, h1=False, stone=False):
    tag = "h1" if h1 else "h2"
    note = '<p class="cases__note">Sample cases using stock photographs, for demonstration only.</p>' if any(c["cases"][i]["sample"] for i in indices) else ""
    filter_html = ""
    if filters:
        cats = []
        for t in c["treatments"]:
            if any(c["cases"][i]["cat"] == t["slug"] for i in indices):
                cats.append(f'<button type="button" data-filter="{t["slug"]}" aria-pressed="false">{e(t["name"])}</button>')
        filter_html = (f'<div class="filters" role="group" aria-label="Filter cases by treatment">'
                       f'<button type="button" data-filter="all" aria-pressed="true">All</button>{"".join(cats)}</div>')
    more = f'<p class="section__more"><a class="link" href="{link[0]}">{e(link[1])}</a></p>' if link else ""
    return f"""
    <section class="section cases{' section--stone' if stone else ''}" aria-labelledby="{heading_id}" data-cases-block>
      <div class="container">
        <div class="section__head fade">
          <p class="label">{e(label)}</p>
          <{tag} class="{'h1' if h1 else 'h2'}" id="{heading_id}">{e(title)}</{tag}>
          {f'<p class="lede">{e(lede)}</p>' if lede else ''}
          {note}
        </div>
        {filter_html}
        {case_tiles(c, R, indices, featured=not filters)}
        {more}
      </div>
      <script type="application/json" id="case-media">{media_map(c)}</script>
    </section>"""


def compare(c, R, stone=False):
    return f"""
    <section class="section compare{' section--stone' if stone else ''}" aria-labelledby="compare-title">
      <div class="container compare__wrap">
        <div class="section__head fade">
          <p class="label">Before &amp; after · Sample</p>
          <h2 class="h2" id="compare-title">Drag to compare</h2>
        </div>
        <div class="fade">{slider(c, R)}</div>
      </div>
    </section>"""


def first_visit(c, R):
    """Three edge-to-edge photo tiles; number, title and two lines sit on the photo."""
    fv = c["firstVisit"]
    tiles = "".join(f"""
        <li class="tile fade">
          {picture(st['image'], '(min-width: 900px) 34vw, 100vw', e(st['imageAlt']), R, pos=st.get('pos'))}
          <div class="tile__text">
            <p class="label">{n + 1:02d}</p>
            <h3 class="card__name">{e(st['title'])}</h3>
            <p>{e(st['text'])}</p>
          </div>
        </li>""" for n, st in enumerate(fv["steps"]))
    return f"""
    <section class="journey" aria-labelledby="first-visit-title">
      <div class="container section__head journey__head fade">
        <p class="label">{e(fv['label'])}</p>
        <h2 class="h2" id="first-visit-title">{e(fv['title'])}</h2>
        <p class="lede">{e(fv['text'])}</p>
      </div>
      <ol class="tiles">{tiles}
      </ol>
    </section>"""


def doctor(c, R):
    d = c["doctors"][0]
    sample = d.get("sample") and c["demo"]
    tag = '<span class="sample-tag">Sample</span>' if sample else ""
    video = (f'<video class="doctor__video" src="{R}{d["video"]}" controls preload="none" poster="{R}assets/img/{d["videoPoster"]}-640.jpg"></video>' if d.get("video") else
             f'<div class="doctor__video-slot">{picture(d["videoPoster"], "320px", "", R, pos="60% 50%", preview=False)}'
             f'<p class="label">Meet the doctor · 20s video{" · Sample slot" if sample else ""}</p></div>')
    creds = " · ".join(e(x) for x in (d["credentials"], d.get("years"), d.get("memberships")) if x)
    return f"""
    <section class="section section--stone doctor" id="doctor" aria-labelledby="doctor-title">
      <div class="container split">
        <div class="split__media doctor__portrait fade">{picture(d['image'], '(min-width: 900px) 40vw, 100vw', e(d['imageAlt']), R, pos=d.get('pos'))}{tag}</div>
        <div class="split__text fade">
          <p class="label">{e(d['role'])}</p>
          <h2 class="h2" id="doctor-title">{e(d['name'])}</h2>
          <blockquote class="quote-sm"><p>“{e(d['quote'])}”</p></blockquote>
          <p class="doctor__creds">{creds}{' (sample)' if sample else ''}</p>
          {video}
          <p><a class="link" href="{R}book/" data-quick-request>Book a visit with {e(d['name'])}</a></p>
          {proof(e(c['proof']['noPressure']))}
        </div>
      </div>
    </section>"""


def reviews(c, R):
    r = c["reviews"]
    sample = r.get("sample") and c["demo"]
    cards = [f"""
          <li class="review-card fade">
            <p class="review-card__stars" aria-label="5 out of 5 stars">★★★★★</p>
            <blockquote><p>“{e(x['text'])}”</p></blockquote>
            <p class="review-card__by"><strong>{e(x['name'])}</strong> · {e(x['treatment'])}</p>
            <p class="label">Google{' · Sample' if sample else ''}</p>
          </li>""" for x in r["items"]]
    photos = [f"""
          <li class="review-photo fade">{picture(ph['image'], '(min-width: 900px) 30vw, 100vw', e(ph['imageAlt']), R, pos=ph.get('pos'))}</li>""" for ph in r.get("photos", [])]
    # Mix the two photos into the wall: after the 2nd and 5th card
    wall = cards[:2] + photos[:1] + cards[2:5] + photos[1:2] + cards[5:]
    link = f'<p class="section__more"><a class="link" href="{e(r["googleUrl"])}" data-google-reviews>Read reviews on Google</a></p>' if r.get("googleUrl") else ""
    return f"""
    <section class="section wall" aria-labelledby="reviews-title">
      <div class="container">
        <div class="section__head fade">
          <p class="label">{rating_line(c)}</p>
          <h2 class="h2" id="reviews-title">{e(r['title'])}</h2>
        </div>
        <ul class="wall__grid">{''.join(wall)}
        </ul>
        {link}
      </div>
    </section>"""


def visit(c, R, heading="h2"):
    a = c["address"]
    hours = "<br>".join(e(x) for x in c["hours"]["summary"])
    from urllib.parse import quote
    map_src = f"https://www.google.com/maps?q={quote(a['mapQuery'])}&output=embed"
    return f"""
    <section class="section visit" id="visit" aria-labelledby="visit-title">
      <div class="container split split--text-first">
        <div class="split__text fade">
          <p class="label">Visit</p>
          <{heading} class="h2" id="visit-title">{e(a['lines'][0])}</{heading}>
          <address>{'<br>'.join(e(x) for x in a['lines'])}</address>
          <p class="open-status" data-open-status></p>
          <dl class="details">
            <div><dt class="label">Hours</dt><dd>{hours}</dd></div>
            <div><dt class="label">Phone</dt><dd><a href="{tel(c)}">{e(c['contact']['phoneDisplay'])}</a></dd></div>
            <div><dt class="label">WhatsApp</dt><dd><a href="{wa_link(c, c['contact']['whatsappGreeting'])}">Message the clinic</a></dd></div>
          </dl>
          <p class="visit__access">{e(a['access'])}</p>
          <div class="emergency" data-emergency>
            <p class="emergency__title">{e(c['emergency']['title'])}</p>
            <p data-emergency-open><a class="link" href="{tel(c)}">Call now</a> {e(c['emergency']['open'])}</p>
            <p data-emergency-closed hidden><a class="link" href="{wa_link(c, 'Hello, I have a dental emergency (toothache or broken tooth). Please call me back.')}">WhatsApp request</a> {e(c['emergency']['closed'])}</p>
          </div>
        </div>
        <div class="map fade">
          <p class="map__landmark label">{e(a.get('landmark') or a['locality'])}</p>
          <button class="map__load" type="button" data-map-src="{e(map_src)}" data-map-title="Map of {e(a['mapQuery'])}">
            <span class="map__place">{e(a['mapQuery'])}</span>
            <span class="link">Load Google Map</span>
          </button>
        </div>
      </div>
    </section>"""


def planner(c, R, stone=False):
    p = c["planner"]
    opts = "".join(f'<li><button type="button" data-treatment="{t["slug"]}" aria-pressed="false">{e(t["name"])}</button></li>' for t in c["treatments"])
    return f"""
    <section class="section planner{' section--stone' if stone else ''}" id="plan" aria-labelledby="planner-title" data-planner>
      <div class="container split">
        <div class="split__media fade">{picture(p['image'], '(min-width: 900px) 42vw, 100vw', e(p['imageAlt']), R, pos=p.get('pos'))}</div>
        <div class="split__text planner__body fade">
          <p class="label">For visiting patients</p>
          <h2 class="h2" id="planner-title">{e(p['title'])}</h2>
          <p class="planner__intro">{e(p['intro'])}</p>
          <div class="planner__stage">
            <div class="planner__step is-active" data-step="1">
              <p class="label">01 / 03</p>
              <p class="planner__q" id="planner-q1" tabindex="-1">What would you like to plan?</p>
              <ul class="planner__options" aria-labelledby="planner-q1">{opts}<li><button type="button" data-treatment="unsure" aria-pressed="false">Not sure yet</button></li></ul>
            </div>
            <div class="planner__step" data-step="2" inert>
              <p class="label">02 / 03</p>
              <label class="planner__q" for="planner-city" tabindex="-1">Where are you travelling from?</label>
              <input class="planner__input" id="planner-city" type="text" placeholder="City" autocomplete="address-level2" maxlength="60">
              <button class="link" type="button" data-planner-next>Next</button>
            </div>
            <div class="planner__step" data-step="3" inert>
              <p class="label">03 / 03</p>
              <p class="planner__q" id="planner-q3" tabindex="-1">How many days can you be in {e(p['city'])}?</p>
              <div class="planner__stepper" role="group" aria-labelledby="planner-q3">
                <button type="button" data-days="-1" aria-label="Fewer days">−</button>
                <output aria-live="polite"><span data-days-value>{p['startDays']}</span> days</output>
                <button type="button" data-days="1" aria-label="More days">+</button>
              </div>
              <button class="link" type="button" data-planner-next>See my plan</button>
            </div>
            <div class="planner__step" data-step="result" inert>
              <p class="planner__q" tabindex="-1" data-summary></p>
              <p class="planner__detail" data-detail></p>
              <p class="planner__note">{e(p['note'])}</p>
              <p class="planner__actions">
                <a class="link" href="{wa_link(c, c['contact']['whatsappGreeting'])}" target="_blank" rel="noopener" data-whatsapp>Send my plan on WhatsApp</a>
                <a class="link" href="{R}book/#virtual">Book a video consultation</a>
              </p>
              <button class="planner__restart" type="button" data-planner-restart>Start again</button>
            </div>
          </div>
        </div>
      </div>
    </section>"""


def cta_band(c, R, text, line=""):
    """Compact deep-navy band: centred heading, one line, one call to action."""
    extra = f"<p>{e(line)}</p>" if line else ""
    return f"""
    <section class="band" aria-labelledby="band-title">
      <div class="container band__inner fade">
        <h2 class="h2" id="band-title">{e(text)}</h2>
        <p><a class="link link--light" href="{R}book/" data-quick-request>{e(c["hero"]["cta"])}</a></p>
        {extra}
      </div>
    </section>"""


# ---------------------------------------------------------------------------------------------- pages

def page_home(c, R):
    h = c["hero"]
    return "".join([
        hero(c, R, h["label"], h["lines"], h["lede"], f"{R}book/", h["cta"], h["image"], h["imageAlt"], h["pos"]),
        intro(c),
        pillars(c, R),
        clinic(c, R),
        treatment_index(c, R),
        results_home(c, R),
        cta_band(c, R, "Book a visit on FC Road.", c["proof"]["evenings"]),
        first_visit(c, R),
        doctor(c, R),
        reviews(c, R),
        planner(c, R, stone=True),
        visit(c, R),
    ])


def cost_block(c, t):
    pr = c.get("pricing", {})
    items = [x for x in (pr.get("consultation"), t.get("cost"), pr.get("estimate"), pr.get("emi")) if x]
    if not items:
        return ""
    lis = "".join(f"<li>{e(x)}</li>" for x in items)
    note = f'<p class="cost__note">{e(pr["note"])}</p>' if pr.get("note") and c["demo"] else ""
    return f"""
    <section class="section cost" aria-labelledby="cost-title">
      <div class="container split split--text-first">
        <div class="section__head fade">
          <p class="label">What it costs</p>
          <h2 class="h2" id="cost-title">No surprises on the bill</h2>
        </div>
        <div class="fade">
          <ul class="cost__list">{lis}</ul>
          {note}
        </div>
      </div>
    </section>"""


def page_treatment(c, R, idx):
    t = c["treatments"][idx]
    cases = [n for n, k in enumerate(c["cases"]) if k["cat"] == t["slug"]]
    steps = "".join(f"""
          <li class="fade"><p class="steps__num">{n + 1:02d}</p><h3 class="h3">{e(s[0])}</h3><p>{e(s[1])}</p></li>""" for n, s in enumerate(t["steps"]))
    pairs = list(t["faq"]) + ([["What does it cost?", t["cost"] + " You get a written estimate before anything is done."]] if t.get("cost") else [])
    faq = "".join(f"""
          <div class="faq__item">
            <h3><button type="button" aria-expanded="false" aria-controls="faq-{n}" id="faq-q-{n}">{e(q)}<span class="faq__sign" aria-hidden="true"></span></button></h3>
            <div class="faq__panel" id="faq-{n}" role="region" aria-labelledby="faq-q-{n}"><div><p>{e(a)}</p></div></div>
          </div>""" for n, (q, a) in enumerate(pairs))
    others = [c["treatments"][(idx + k) % len(c["treatments"])] for k in (1, 2, 3)]
    return "".join([
        hero(c, R, "Treatments", [t["name"]], t["summary"], f"{R}book/", c["hero"]["cta"], t["image"], t["imageAlt"], t.get("pos"), short=True),
        f"""
    <section class="section" aria-labelledby="about-title">
      <div class="container intro__grid intro__grid--text">
        <p class="label fade" id="about-title">About this treatment</p>
        <p class="statement fade">{e(t['intro'])}</p>
      </div>
    </section>
    <section class="section section--stone" aria-labelledby="steps-title">
      <div class="container">
        <div class="section__head fade">
          <p class="label">How it works</p>
          <h2 class="h2" id="steps-title">Step by step</h2>
        </div>
        <ol class="steps">{steps}
        </ol>
      </div>
    </section>""",
        cost_block(c, t),
        cases_section(c, R, cases, "cases-title", "Results", f"{t['name']}: sample cases", "", link=(f"{R}results/", "All results")) if cases else "",
        f"""
    <section class="section section--stone faq" aria-labelledby="faq-title">
      <div class="container split split--text-first">
        <div class="section__head fade">
          <p class="label">Questions</p>
          <h2 class="h2" id="faq-title">Good to know</h2>
        </div>
        <div class="faq__list" data-accordion>{faq}
        </div>
      </div>
    </section>""",
        cta_band(c, R, f"Talk it through with {c['doctors'][0]['name']}.", "A first visit is a conversation. Nothing is booked until you decide."),
        planner(c, R),
        treatment_grid(c, R, others, "others-title", "Other treatments", "You may also need", section_id="more", stone=True),
    ])


def page_results(c, R):
    return "".join([
        cases_section(c, R, list(range(len(c["cases"]))), "page-title", "Results", "Results", "Natural changes, planned around each face.", filters=True, h1=True),
        cta_band(c, R, "Every plan starts with a conversation.", "Bring your questions; we will show you your options."),
        compare(c, R, stone=True),
    ])


def page_book(c, R):
    b = c["book"]

    def path(key, anchor):
        p = b[key]
        return f"""
          <article class="path fade"{f' id="{anchor}"' if anchor else ''} aria-labelledby="path-{key}">
            <div class="path__media">{picture(p['image'], '(min-width: 768px) 45vw, 100vw', e(p['imageAlt']), R, pos=p.get('pos'))}</div>
            <p class="label">{e(p['label'])}</p>
            <h2 class="h3" id="path-{key}">{e(p['title'])}</h2>
            <p>{e(p['text'])}</p>
            <p class="path__actions">
              <a class="link" href="{wa_link(c, p['message'])}">Book on WhatsApp</a>
              <a class="link" href="{tel(c)}">Call {e(c['contact']['phoneDisplay'])}</a>
            </p>
          </article>"""
    return "".join([f"""
    <section class="section book" aria-labelledby="page-title">
      <div class="container">
        <div class="section__head fade">
          <p class="label">{e(c['name'])}</p>
          <h1 class="h1" id="page-title">{e(b['title'])}</h1>
          <p class="lede">{e(b['lede'])}</p>
        </div>
        <div class="paths">{path('inPerson', 'in-person')}{path('virtual', 'virtual')}
        </div>
        <p class="book__note">WhatsApp opens with your request already written. Nothing is sent until you press send.</p>
      </div>
    </section>""", planner(c, R, stone=True), visit(c, R)])


def page_stats(c, R):
    st = c["stats"]
    tiles = "".join(f'<li><span class="stats__num">{n}</span><span>{e(label)}</span></li>' for label, n in st["items"])
    scroll = "".join(f"<li><span>{e(label)}</span><strong>{e(v)}</strong></li>" for label, v in st["scroll"])
    return f"""
    <section class="section stats" aria-labelledby="page-title">
      <div class="container">
        <div class="section__head">
          <p class="label">For the clinic · not linked from the site</p>
          <h1 class="h1" id="page-title">{e(st['month'])}</h1>
          <p class="lede">What the website brought in, counted with privacy-friendly analytics. Every number here is a sample for the demo.</p>
        </div>
        <ul class="stats__grid">{tiles}</ul>
        <h2 class="h3" style="margin-top: 48px">How far visitors read</h2>
        <ul class="stats__scroll">{scroll}</ul>
      </div>
    </section>"""


# ---------------------------------------------------------------------------------------------- icons

def path_points(d, steps=24):
    """Polylines from SVG path data (absolute M, L, C, Q, Z), for rasterising the mark with Pillow."""
    tokens = re.findall(r"[MLCQZ]|-?[\d.]+", d)
    lines, cur, start, i, cmd = [], None, None, 0, None
    while i < len(tokens):
        if tokens[i] in "MLCQZ":
            cmd = tokens[i]
            i += 1
            if cmd == "Z":
                cur.append(start)
                continue
        nums = lambda n: [float(t) for t in tokens[i:i + n]]  # noqa: E731
        if cmd == "M":
            x, y = nums(2); i += 2
            cur = [(x, y)]; start = (x, y); lines.append(cur)
        elif cmd == "L":
            x, y = nums(2); i += 2
            cur.append((x, y))
        elif cmd == "C":
            x1, y1, x2, y2, x, y = nums(6); i += 6
            x0, y0 = cur[-1]
            for k in range(1, steps + 1):
                t = k / steps
                u = 1 - t
                cur.append((u**3 * x0 + 3 * u * u * t * x1 + 3 * u * t * t * x2 + t**3 * x,
                            u**3 * y0 + 3 * u * u * t * y1 + 3 * u * t * t * y2 + t**3 * y))
        elif cmd == "Q":
            x1, y1, x, y = nums(4); i += 4
            x0, y0 = cur[-1]
            for k in range(1, steps + 1):
                t = k / steps
                u = 1 - t
                cur.append((u * u * x0 + 2 * u * t * x1 + t * t * x, u * u * y0 + 2 * u * t * y1 + t * t * y))
    return lines


def wordmark_path(c, size, x0, baseline):
    """The wordmark as SVG outlines (Fraunces at the weight the site uses), so logo files need no font."""
    from fontTools.pens.svgPathPen import SVGPathPen
    from fontTools.pens.transformPen import TransformPen
    font = static_font(FONTS / c["theme"]["fonts"]["heading"]["file"], {"wght": c["theme"]["fonts"]["heading"]["use"], "opsz": 48})
    gs, cmap, upm = font.getGlyphSet(), font.getBestCmap(), font["head"].unitsPerEm
    scale = size / upm
    pen = SVGPathPen(gs)
    x = x0
    for ch in c["wordmark"]:
        g = cmap.get(ord(ch))
        if not g:
            continue
        gs[g].draw(TransformPen(pen, (scale, 0, 0, -scale, x, baseline)))
        x += gs[g].width * scale - 0.01 * size
    return pen.getCommands(), x


def icons(c):
    col = c["theme"]["colors"]
    lg = c["logo"]
    mark = lambda colour, extra="": f'<path d="{lg["mark"]}" fill="none" stroke="{colour}" stroke-width="{lg["stroke"]}" stroke-linecap="round" stroke-linejoin="round"{extra}/>'  # noqa: E731
    (ROOT / "favicon.svg").write_text(
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><rect width="40" height="40" fill="{col["bg"]}"/>{mark(col["ink"])}</svg>\n',
        encoding="utf-8", newline="\n")
    # Apple touch icon: the mark rasterised at 4x, then reduced for smooth edges
    big = 180 * 4
    im = Image.new("RGB", (big, big), col["bg"])
    draw = ImageDraw.Draw(im)
    k = big / 40 * 0.78
    off = (big - 40 * k) / 2
    width = round(lg["stroke"] * k)
    for line in path_points(lg["mark"]):
        pts = [(off + x * k, off + y * k) for x, y in line]
        draw.line(pts, fill=col["ink"], width=width, joint="curve")
        for px, py in (pts[0], pts[-1]):
            draw.ellipse((px - width / 2, py - width / 2, px + width / 2, py + width / 2), fill=col["ink"])
    im.resize((180, 180), Image.LANCZOS).save(ROOT / "apple-touch-icon.png", optimize=True)
    (ROOT / "site.webmanifest").write_text(json.dumps({
        "name": c["name"], "short_name": c["wordmark"].split()[0], "start_url": "./", "display": "browser",
        "background_color": col["bg"], "theme_color": col["bg"],
        "icons": [{"src": "apple-touch-icon.png", "sizes": "180x180", "type": "image/png"}]}, indent=2) + "\n", encoding="utf-8", newline="\n")
    # Logo files: navy on limestone, limestone for dark backgrounds and photos, and the mark alone
    out = ROOT / "assets" / "logo"
    out.mkdir(parents=True, exist_ok=True)
    words, end = wordmark_path(c, 26, 50, 29)
    w = round(end + 4)
    for name, ink in (("logo", col["ink"]), ("logo-light", col["bg"])):
        (out / f"{name}.svg").write_text(
            f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} 40" role="img" aria-label="{e(c["name"])}">'
            f'{mark(ink)}<path d="{words}" fill="{ink}"/></svg>\n', encoding="utf-8", newline="\n")
    (out / "mark.svg").write_text(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40">{mark(col["ink"])}</svg>\n', encoding="utf-8", newline="\n")


# ---------------------------------------------------------------------------------------------- main

def write(c, theme, path, R, page, main_html, extra=""):
    page["path"] = path
    doc = (head(c, R, page, theme) + header(c, R, page) + f'\n  <main id="main" tabindex="-1">{main_html}\n  </main>\n'
           + extra + footer(c, R) + "</body>\n</html>\n")
    doc = re.sub(r"[ \t]+\n", "\n", doc)
    out = ROOT / path / "index.html"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(doc, encoding="utf-8", newline="\n")
    print(f"wrote {(path or '') + 'index.html':<44} {len(doc) // 1024:>4} KB")


def main():
    c = load_config()
    theme = theme_css(c)
    name = c["name"]
    loc = c["address"]["locality"]
    # Pages for treatments that no longer exist in the config are removed
    tdir = ROOT / "treatments"
    if tdir.exists():
        keep = {t["slug"] for t in c["treatments"]}
        for d in tdir.iterdir():
            if d.is_dir() and d.name not in keep:
                shutil.rmtree(d)

    write(c, theme, "", "", {"title": f"{name} | {c['tagline'].rstrip('.')}", "hero": True,
                              "lcp": (c["hero"]["image"], "100vw")}, page_home(c, ""), case_view(""))
    for n, t in enumerate(c["treatments"]):
        R = "../../"
        ld = {"@context": "https://schema.org", "@type": "MedicalProcedure", "name": t["name"], "description": t["summary"],
              "url": f"{c['site']['url']}treatments/{t['slug']}/"}
        write(c, theme, f"treatments/{t['slug']}/", R,
              {"title": f"{t['name']} in {loc} | {name}", "description": f"{t['summary']} {t['intro'].split('. ')[0]}.",
               "hero": True, "lcp": (t["image"], "100vw"), "og": t["image"], "jsonld": [ld]},
              page_treatment(c, R, n), case_view(R))
    write(c, theme, "results/", "../", {"title": f"Results | {name}", "description": f"Sample before and after cases from {name}, {loc}."},
          page_results(c, "../"), case_view("../"))
    write(c, theme, "book/", "../", {"title": f"Book a visit | {name}", "description": f"Book an in-person visit at {name}, {c['address']['street']}, or a video consultation from anywhere."},
          page_book(c, "../"))
    write(c, theme, "stats/", "../", {"title": f"This month | {name}", "description": "Sample website results for the clinic."},
          page_stats(c, "../"))
    icons(c)


if __name__ == "__main__":
    main()
