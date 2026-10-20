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

Warm limestone, deep navy, a secondary stone and one muted sage accent (links and hover only).
Fraunces for headings in sentence case, Manrope for body text, small tracked uppercase labels.
No rounded corners, shadows, gradients, decorative lines or icons. Four motions only:

- **Hero:** each headline line slides up from its own mask (1.1s, 0.15s stagger), once.
- **Images:** a bottom-to-top clip wipe with a 1.05 to 1 scale settle (1.2s), once.
- **Treatments index:** on desktop, the hovered row shifts and a preview follows the cursor;
  on phones, rows are links with thumbnails.
- **Your first visit:** the image stays pinned and crossfades while three steps scroll past (desktop);
  stacked steps on phones.

All motion is off with `prefers-reduced-motion`. `tools/screens.py` screenshots pages at four widths
and audits them against these rules (radius, shadows, gradients, off-palette colours, overflow, errors).

## Images

Photos live in `assets/img` as `<name>-<width>.{avif,webp,jpg}`; the config refers to them by
`<name>`. To add your own: `from tools.images import export, grade`, or follow `tools/stock.py`, which
downloads, grades and exports the demo's Unsplash photos. `tools/sample_ba.py` makes the sample
before/after pair (a simulated whitening, labelled as such). Credits: `CREDITS.md`.

## Riya

With `riya.webhookUrl` set to an n8n Chat Trigger webhook, Riya talks to it live. Left empty, she
gives demo answers built from the config (timings, address, treatments, booking).
