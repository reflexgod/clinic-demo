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
    wm_em = advance(wm_font, wm) - 0.02 * (len(wm) - 1)
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

def mask(text, i, tag="span"):
    return f'<{tag} class="mask"><span style="--i:{i}">{text}</span></{tag}>'


def wa_link(c, message):
    from urllib.parse import quote
    return f"https://wa.me/{c['contact']['whatsapp']}?text={quote(message)}"


def tel(c):
    return f"tel:{c['contact']['phoneTel']}"


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
    <a class="wordmark" href="{R or './'}" aria-label="{e(c['name'])}, home">{e(c['wordmark'])}</a>
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
      <span class="wordmark">{e(c['wordmark'])}</span>
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
    <p class="footer__wordmark" aria-hidden="true" data-wordmark><span>{e(c['wordmark'])}</span></p>
  </footer>

  <nav class="mobile-bar" aria-label="Quick actions" data-mobile-bar inert>
    <a href="{tel(c)}">Call</a>
    <a href="{R}book/">{e(c['hero']['cta'])}</a>
  </nav>
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


def hero(c, R, label, lines, lede, cta_href, cta, image, alt, pos, h1_class="", short=False):
    i = 0
    parts = [f'<p class="label hero__label">{mask(e(label), i)}</p>']
    i += 1
    title = []
    for line in lines:
        title.append(mask(e(line), i))
        i += 1
    parts.append(f'<h1 class="hero__title {h1_class}">{"".join(title)}</h1>')
    parts.append(f'<p class="hero__lede">{mask(e(lede), i)}</p>')
    i += 1
    parts.append(f'<p class="hero__cta">{mask(f"<a class=\"link link--light\" href=\"{cta_href}\">{e(cta)}</a>", i)}</p>')
    video = ""
    if c["hero"].get("video") and not short:
        video = f'<video class="hero__video" data-base="{R}{c["hero"]["video"]}" muted loop playsinline preload="none" aria-hidden="true" tabindex="-1"></video>'
    return f"""
    <section class="hero{' hero--short' if short else ''}" data-hero aria-labelledby="page-title">
      <div class="hero__media">
        {picture(image, '100vw', e(alt), R, eager=True, pos=pos, preview=False)}
        {video}
      </div>
      <div class="hero__content" id="page-title-wrap">
        {''.join(parts).replace('<h1 class', '<h1 id="page-title" class', 1)}
      </div>
    </section>"""


def treatment_index(c, R, items, heading_id, label, title):
    rows, thumbs, previews = [], [], []
    for n, (idx, t) in enumerate(items):
        num = f"{idx + 1:02d}"
        rows.append(f"""
          <li><a class="index__row" href="{R}treatments/{t['slug']}/" data-preview="{n}">
            <span class="index__num">{num}</span>
            <span class="index__thumb">{picture(t['image'], '72px', '', R, pos=t.get('pos'), preview=False)}</span>
            <span class="index__name">{e(t['name'])}</span>
            <span class="index__short">{e(t['short'])}</span>
          </a></li>""")
        previews.append(picture(t["image"], "(min-width: 900px) 24vw, 1px", "", R, pos=t.get("pos"), cls="index__img", preview=False))
    return f"""
    <section class="section index" id="treatments" aria-labelledby="{heading_id}" data-index>
      <div class="container index__head">
        <p class="label">{e(label)}</p>
        <h2 class="h2" id="{heading_id}">{e(title)}</h2>
      </div>
      <ol class="container index__list">{''.join(rows)}
      </ol>
      <div class="index__preview" aria-hidden="true" data-index-preview>{''.join(previews)}</div>
    </section>"""


def case_tiles(c, R, indices, featured=False):
    tiles = []
    for i in indices:
        k = c["cases"][i]
        hidden = '<span class="visually-hidden"> (sample case)</span>' if k["sample"] else ""
        tiles.append(f"""
          <li class="case-item" data-cat="{k['cat']}">
            <button class="case" type="button" data-case="{i}">
              <span class="case__media reveal-img">{picture(k['image'], '(min-width: 900px) 30vw, (min-width: 600px) 45vw, 100vw', '', R, pos='50% 45%')}</span>
              <span class="case__name">{e(k['name'])}{hidden}</span>
              <span class="case__meta label">{e(k['meta'])}</span>
            </button>
          </li>""")
    return f'<ul class="cases__grid{" cases__grid--featured" if featured else ""}" data-cases>{"".join(tiles)}\n        </ul>'


def media_map(c):
    names = {k[f] for k in c["cases"] for f in ("image", "face", "before") if k.get(f)}
    return json.dumps({n: widths(n) for n in sorted(names)})


def cases_section(c, R, indices, heading_id, label, title, lede, link=None, filters=False, h1=False):
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
    <section class="section cases" aria-labelledby="{heading_id}" data-cases-block>
      <div class="container">
        <div class="section__head">
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


def compare(c, R):
    b = c["beforeAfter"]
    sizes = "(min-width: 1200px) 1100px, 100vw"
    return f"""
    <section class="section compare" aria-labelledby="compare-title">
      <div class="container compare__wrap">
        <div class="section__head">
          <p class="label">Before &amp; after</p>
          <h2 class="h2" id="compare-title">{e(b['title'])}</h2>
          <p class="lede">{e(b['text'])}</p>
        </div>
        <div class="ba reveal-img" data-ba>
          {picture(b['after'], sizes, 'After: the same smile with simulated whitening', R, pos='50% 50%')}
          <div class="ba__before">{picture(b['before'], sizes, 'Before: the original smile', R, pos='50% 50%')}</div>
          <span class="ba__tag ba__tag--before label" aria-hidden="true">Before</span>
          <span class="ba__tag ba__tag--after label" aria-hidden="true">After</span>
          <input class="ba__range" type="range" min="0" max="100" value="50" aria-label="Compare before and after">
          <span class="ba__handle" aria-hidden="true"><span class="ba__grip"></span></span>
        </div>
        <p class="compare__note">{e(b['note'])}</p>
      </div>
    </section>"""


def story(c, R):
    fv = c["firstVisit"]
    pics, steps = [], []
    for n, s in enumerate(fv["steps"]):
        pics.append(picture(s["image"], "(min-width: 900px) 46vw, 1px", e(s["imageAlt"]), R, pos=s.get("pos"),
                            cls="story__img" + (" is-active" if n == 0 else "")))
        steps.append(f"""
          <li class="story__step" data-story-step="{n}">
            <div class="story__phone-media reveal-img">{picture(s['image'], '(min-width: 900px) 1px, 100vw', e(s['imageAlt']), R, pos=s.get('pos'))}</div>
            <p class="story__num">{n + 1:02d}</p>
            <h3 class="h3">{e(s['title'])}</h3>
            <p>{e(s['text'])}</p>
          </li>""")
    return f"""
    <section class="section story" aria-labelledby="story-title" data-story>
      <div class="container story__grid">
        <div class="story__media" aria-hidden="false">
          <div class="story__frame reveal-img">{''.join(pics)}</div>
          <p class="story__count label" aria-hidden="true"><span data-story-count>01</span> / {len(fv['steps']):02d}</p>
        </div>
        <div class="story__body">
          <div class="section__head">
            <p class="label">{e(fv['label'])}</p>
            <h2 class="h2" id="story-title">{e(fv['title'])}</h2>
          </div>
          <ol class="story__steps">{''.join(steps)}
          </ol>
        </div>
      </div>
    </section>"""


def doctor(c, R):
    d = c["doctors"][0]
    return f"""
    <section class="section doctor" id="doctor" aria-labelledby="doctor-title">
      <div class="container split">
        <div class="split__media reveal-img">{picture(d['image'], '(min-width: 900px) 42vw, 100vw', e(d['imageAlt']), R, pos=d.get('pos'))}</div>
        <div class="split__text">
          <p class="label">{e(d['role'])}</p>
          <h2 class="h2" id="doctor-title">{e(d['name'])}</h2>
          <blockquote class="quote-sm"><p>“{e(d['quote'])}”</p></blockquote>
          <p>{e(d['bio'])}</p>
          <p class="doctor__creds label">{e(d['credentials'])}</p>
        </div>
      </div>
    </section>"""


def reviews(c):
    r = c["reviews"]
    n = len(r["items"])
    slides = "".join(f"""
            <div class="review{' is-active' if i == 0 else ''}" role="group" aria-roledescription="slide" aria-label="{i + 1} of {n}"{'' if i == 0 else ' aria-hidden="true"'}>
              <figure>
                <blockquote><p>“{e(x['quote'])}”</p></blockquote>
                <figcaption class="label">{e(x['source'])}</figcaption>
              </figure>
            </div>""" for i, x in enumerate(r["items"]))
    return f"""
    <section class="section reviews" aria-labelledby="reviews-title" data-reviews>
      <div class="container">
        <h2 class="label" id="reviews-title">{e(r['label'])}</h2>
        <div class="reviews__stage" aria-roledescription="carousel" aria-labelledby="reviews-title">{slides}
        </div>
        <div class="reviews__controls">
          <p class="label" aria-hidden="true"><span data-review-count>01</span> / {n:02d}</p>
          <button type="button" data-review-prev>Previous</button>
          <button type="button" data-review-next>Next</button>
          <button type="button" data-review-pause aria-pressed="false">Pause</button>
        </div>
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
        <div class="split__text">
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
          <p><a class="link" href="{R}book/#plan">Coming from out of town? Plan your visit</a></p>
        </div>
        <div class="map">
          <p class="map__landmark label">{e(a.get('landmark') or a['locality'])}</p>
          <button class="map__load" type="button" data-map-src="{e(map_src)}" data-map-title="Map of {e(a['mapQuery'])}">
            <span class="map__place">{e(a['mapQuery'])}</span>
            <span class="link">Load Google Map</span>
          </button>
        </div>
      </div>
    </section>"""


def planner(c, R):
    p = c["planner"]
    opts = "".join(f'<li><button type="button" data-treatment="{t["slug"]}" aria-pressed="false">{e(t["name"])}</button></li>' for t in c["treatments"])
    return f"""
    <section class="section planner" id="plan" aria-labelledby="planner-title" data-planner>
      <div class="container split">
        <div class="split__media reveal-img">{picture(p['image'], '(min-width: 900px) 42vw, 100vw', e(p['imageAlt']), R, pos=p.get('pos'))}</div>
        <div class="split__text planner__body">
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


def cta_band(c, R, text):
    return f"""
    <section class="section band" aria-labelledby="band-title">
      <div class="container">
        <h2 class="h2" id="band-title">{e(text)}</h2>
        <p><a class="link" href="{R}book/">{e(c["hero"]["cta"])}</a></p>
      </div>
    </section>"""


# ---------------------------------------------------------------------------------------------- pages

def page_home(c, R):
    h, i = c["hero"], c["intro"]
    featured = list(range(min(c["featuredCases"], len(c["cases"]))))
    return "".join([
        hero(c, R, h["label"], h["lines"], h["lede"], f"{R}book/", h["cta"], h["image"], h["imageAlt"], h["pos"]),
        f"""
    <section class="section intro" aria-labelledby="intro-title">
      <div class="container intro__grid">
        <div class="intro__text">
          <p class="label" id="intro-title">{e(i['label'])}</p>
          <p class="statement">{e(i['text'])}</p>
          <p><a class="link" href="#doctor">{e(i['link'])}</a></p>
        </div>
        <div class="intro__media reveal-img">{picture(i['image'], '(min-width: 900px) 30vw, 100vw', e(i['imageAlt']), R, pos=i.get('pos'))}</div>
      </div>
    </section>""",
        treatment_index(c, R, list(enumerate(c["treatments"])), "index-title", "Treatments", "Care for every stage of your smile"),
        story(c, R),
        compare(c, R),
        cases_section(c, R, featured, "cases-title", "Results", "Results that look like you", "", link=(f"{R}results/", "All results")),
        doctor(c, R),
        reviews(c),
        visit(c, R),
    ])


def page_treatment(c, R, idx):
    t = c["treatments"][idx]
    cases = [n for n, k in enumerate(c["cases"]) if k["cat"] == t["slug"]]
    steps = "".join(f"""
          <li><p class="steps__num">{n + 1:02d}</p><h3 class="h3">{e(s[0])}</h3><p>{e(s[1])}</p></li>""" for n, s in enumerate(t["steps"]))
    faq = "".join(f"""
          <div class="faq__item">
            <h3><button type="button" aria-expanded="false" aria-controls="faq-{n}" id="faq-q-{n}">{e(q)}<span class="faq__sign" aria-hidden="true"></span></button></h3>
            <div class="faq__panel" id="faq-{n}" role="region" aria-labelledby="faq-q-{n}"><div><p>{e(a)}</p></div></div>
          </div>""" for n, (q, a) in enumerate(t["faq"]))
    others = [(n, x) for n, x in enumerate(c["treatments"]) if n != idx]
    return "".join([
        hero(c, R, f"Treatment {idx + 1:02d}", [t["name"]], t["summary"], f"{R}book/", c["hero"]["cta"], t["image"], t["imageAlt"], t.get("pos"), short=True),
        f"""
    <section class="section" aria-labelledby="about-title">
      <div class="container intro__grid intro__grid--text">
        <p class="label" id="about-title">About this treatment</p>
        <p class="statement statement--sm">{e(t['intro'])}</p>
      </div>
    </section>
    <section class="section section--stone" aria-labelledby="steps-title">
      <div class="container">
        <div class="section__head">
          <p class="label">How it works</p>
          <h2 class="h2" id="steps-title">Step by step</h2>
        </div>
        <ol class="steps">{steps}
        </ol>
      </div>
    </section>""",
        cases_section(c, R, cases, "cases-title", "Results", f"{t['name']}: sample cases", "", link=(f"{R}results/", "All results")) if cases else "",
        f"""
    <section class="section faq" aria-labelledby="faq-title">
      <div class="container split split--text-first">
        <div class="section__head">
          <p class="label">Questions</p>
          <h2 class="h2" id="faq-title">Good to know</h2>
        </div>
        <div class="faq__list" data-accordion>{faq}
        </div>
      </div>
    </section>""",
        planner(c, R),
        treatment_index(c, R, others, "others-title", "Other treatments", "Explore more"),
        cta_band(c, R, f"Talk it through with {c['doctors'][0]['name']}."),
    ])


def page_results(c, R):
    return "".join([
        cases_section(c, R, list(range(len(c["cases"]))), "page-title", "Results", "Results", "Careful, natural changes that keep a smile in balance with the face.", filters=True, h1=True),
        compare(c, R),
        cta_band(c, R, "Every plan starts with a conversation."),
    ])


def page_book(c, R):
    b = c["book"]

    def path(key, anchor):
        p = b[key]
        return f"""
          <article class="path"{f' id="{anchor}"' if anchor else ''} aria-labelledby="path-{key}">
            <div class="path__media reveal-img">{picture(p['image'], '(min-width: 768px) 45vw, 100vw', e(p['imageAlt']), R, pos=p.get('pos'))}</div>
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
        <div class="section__head">
          <p class="label">{e(c['name'])}</p>
          <h1 class="h1" id="page-title">{e(b['title'])}</h1>
          <p class="lede">{e(b['lede'])}</p>
        </div>
        <div class="paths">{path('inPerson', 'in-person')}{path('virtual', 'virtual')}
        </div>
        <p class="book__note">WhatsApp opens with your request already written. Nothing is sent until you press send.</p>
      </div>
    </section>""", planner(c, R), visit(c, R)])


# ---------------------------------------------------------------------------------------------- icons

def icons(c):
    col = c["theme"]["colors"]
    letter = c["wordmark"].strip()[0]
    (ROOT / "favicon.svg").write_text(
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" fill="{col["ink"]}"/>'
        f'<text x="32" y="45" text-anchor="middle" font-family="Georgia, serif" font-size="40" fill="{col["bg"]}">{e(letter)}</text></svg>\n',
        encoding="utf-8", newline="\n")
    im = Image.new("RGB", (180, 180), col["ink"])
    font_path = next((p for p in [Path("C:/Windows/Fonts/georgia.ttf"), Path("/Library/Fonts/Georgia.ttf")] if p.is_file()), None)
    font = ImageFont.truetype(str(font_path), 112) if font_path else ImageFont.load_default()
    ImageDraw.Draw(im).text((90, 94), letter, font=font, fill=col["bg"], anchor="mm")
    im.save(ROOT / "apple-touch-icon.png", optimize=True)
    (ROOT / "site.webmanifest").write_text(json.dumps({
        "name": c["name"], "short_name": c["wordmark"].split()[0], "start_url": "./", "display": "browser",
        "background_color": col["bg"], "theme_color": col["bg"],
        "icons": [{"src": "apple-touch-icon.png", "sizes": "180x180", "type": "image/png"}]}, indent=2) + "\n", encoding="utf-8", newline="\n")


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
    icons(c)


if __name__ == "__main__":
    main()
