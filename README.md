# Clinic demo site

A reusable, config-driven demo website for dental clinics. Static HTML, one CSS file and a small
vanilla JS file; no framework and no runtime dependencies. The bundled demo brand,
**Smile Dental Clinic** (FC Road, Shivajinagar, Pune) and **Dr. Mehta**, is fictional. The phone and
WhatsApp number is an invalid placeholder, and every review and case is marked "Sample".

## Rebuild for a new prospect

1. Edit **`assets/js/clinic.config.js`**: name, wordmark, tagline, colours, fonts, address, hours,
   phone/WhatsApp, doctors, treatments, cases, reviews, planner timings and the Riya webhook.
   Each field is commented.
2. Add any new photos (see *Images* below).
3. Rebuild:

   ```bash
   python -m venv .venv && .venv/Scripts/python -m pip install -r tools/requirements.txt   # once
   .venv/Scripts/python -I tools/build.py
   ```

The build reads the same config file the browser reads (through Node), so nothing else needs editing.
It writes `index.html`, one page per treatment under `treatments/<slug>/`, `results/`, `book/`, the
favicon (a monogram of the wordmark's first letter) and the web manifest. Pages for treatments that
were removed from the config are deleted.

Set `demo: false` for a real clinic: call and WhatsApp links then dial and open for real, and the
footer drops the "fictional" line. Set `site.noindex: false` (and edit `robots.txt`) at launch.

## Run locally

```bash
python -m http.server 8080
# open http://127.0.0.1:8080/
```

## Structure

```
index.html  treatments/  results/  book/   Generated pages (do not edit by hand)
assets/js/clinic.config.js                 The one file to edit
assets/js/site.js   assets/js/riya.js      Behaviour; Riya's chat window loads on first click
assets/css/site.css                        All styles (colours and fonts come from the config)
assets/fonts/  assets/img/                 Self-hosted fonts (SIL OFL) and responsive images
tools/                                     Build and asset pipeline (Python)
```

## Design rules

Photography leads, type stays quiet. Warm limestone, deep navy, a secondary stone and one muted
sage accent (links and hover only). Fraunces for headings in sentence case: only the hero headline
is large; section headings are moderate and body text is 17px Manrope. No rounded corners, shadows,
gradients, decorative lines or icons.

Motion is limited to two things: the hero headline revealing line by line (once), and a plain
fade-in with a small rise for every other block. Treatment and case photos brighten slightly on
hover (0.4s). All motion is off with `prefers-reduced-motion`. `tools/screens.py` screenshots pages
at four widths (`--sections` saves one image per section) and audits them against these rules.

## Images

Photos live in `assets/img` as `<name>-<width>.{avif,webp,jpg}`; the config refers to them by
`<name>`. To add your own: `from tools.images import export, grade`, or follow `tools/stock.py`, which
downloads, crops, grades and exports the demo's Unsplash photos (Indian patients, dentists and clinic rooms). `tools/sample_ba.py` makes the sample
before/after pair (a simulated whitening, labelled as such). Credits: `CREDITS.md`.

## Riya

With `riya.webhookUrl` set to an n8n Chat Trigger webhook, Riya talks to it live. Left empty, she
gives demo answers built from the config (timings, address, treatments, booking).

## Conversion and measurement

- Hero states who, where and why, with the rating (marked Sample in demo mode), the open-now status,
  "Book a visit" and "WhatsApp us". Small proof lines from `config.proof` sit under the main calls to action.
- "Book a visit" and the mobile bar's Book open a 3-tap quick request (treatment, day, time) that writes a
  WhatsApp message. Days come from the opening hours; today is offered only while the clinic is open.
- The visit section's emergency line offers a call during opening hours and a WhatsApp request outside them.
- Treatment pages show "What it costs" from `config.pricing` and each treatment's `cost` (empty fields are
  hidden) and add a cost question to the FAQ.
- Events (calls, WhatsApp, quick requests, Riya opened and messages, planner sent, scroll depth) go to the
  analytics script set in `config.analytics` (e.g. Plausible). Demo mode logs them to the console.
- `/stats/` is an unlinked sample "This month" page showing how those numbers would look to the clinic.

Honesty rules: no fake scarcity, no pop-ups that open by themselves, no autoplay sound, no invented
awards. Everything sample is labelled.
