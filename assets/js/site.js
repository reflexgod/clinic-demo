/* ==========================================================================
   Clinic demo: site behaviour. Vanilla JS, no dependencies.
   Clinic data (hours, planner timings, cases, contact, Riya) comes from
   window.CLINIC, defined in clinic.config.js.

    1. Header over the hero      7. Before & after slider
    2. Menu                      8. Cases: filter + case view
    3. Hero video (optional)     9. Reviews
    4. Fade-in                  10. FAQ accordion
    5. Mobile bar               11. Open-now status
    6. Footer wordmark          12. Plan your visit
                                13. Map, demo mode, Riya
   ========================================================================== */
(() => {
  'use strict';

  const C = window.CLINIC || {};
  const root = document.documentElement;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const configScript = document.querySelector('script[src$="clinic.config.js"]');
  const ASSETS = configScript ? configScript.src.replace(/js\/clinic\.config\.js.*$/, '') : 'assets/';
  const SITE_ROOT = ASSETS.replace(/assets\/$/, '');
  const io = (cb, opts) => new IntersectionObserver(cb, opts);

  const lockScroll = (on) => {
    if (on) root.style.setProperty('--scrollbar-w', `${window.innerWidth - root.clientWidth}px`);
    root.classList.toggle('is-locked', on);
  };
  // Focus once the opened dialog has been painted visible (two frames, also with reduced motion)
  const focusSoon = (el) => requestAnimationFrame(() => requestAnimationFrame(() => el.focus()));
  // Keeps Tab inside an open dialog
  const trapFocus = (container, e) => {
    const items = [...container.querySelectorAll('a[href], button:not([disabled]), input, textarea')]
      .filter((el) => !el.closest('[inert]') && el.getClientRects().length);
    if (!items.length) return;
    const first = items[0];
    const last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  };

  /* 0. Measurement: privacy-friendly analytics from the config (e.g. Plausible). Demo mode, or no
        provider set, logs each event to the console so the clinic can see what would be counted. */
  const A = C.analytics || {};
  if (A.src && A.domain) {
    const tag = document.createElement('script');
    tag.defer = true;
    tag.src = A.src;
    tag.dataset.domain = A.domain;
    document.head.append(tag);
    window.plausible = window.plausible || function plausible() { (window.plausible.q = window.plausible.q || []).push(arguments); };
  }
  const track = (name, props = {}) => {
    if (window.plausible && A.src) window.plausible(name, { props });
    if (C.demo || !A.src) console.info('[analytics]', name, props);
  };
  window.clinicTrack = track;
  document.addEventListener('click', (e) => {
    const link = e.target.closest('a[href]');
    if (!link) return;
    if (link.href.startsWith('tel:')) track('Call click', { place: link.closest('[data-mobile-bar]') ? 'mobile bar' : 'page' });
    else if (link.href.includes('wa.me/') && !link.matches('[data-whatsapp], [data-quick-send]')) track('WhatsApp click');
  }, true);
  // Scroll depth: 25 / 50 / 75 / 100%, once each
  const depths = [25, 50, 75, 100];
  window.addEventListener('scroll', () => {
    const seen = (window.scrollY + window.innerHeight) / document.documentElement.scrollHeight * 100;
    while (depths.length && seen >= depths[0] - 1) track('Scroll depth', { percent: depths.shift() });
  }, { passive: true });

  // Opening hours, in the clinic's time zone (used by the open-now status and the emergency line)
  const toMinutes = (t) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
  const clinicNow = () => {
    const parts = Object.fromEntries(new Intl.DateTimeFormat('en-GB', {
      timeZone: (C.hours || {}).timeZone || 'Asia/Kolkata', weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
    }).formatToParts(new Date()).map((x) => [x.type, x.value]));
    return { day: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(parts.weekday), minutes: Number(parts.hour) * 60 + Number(parts.minute) };
  };
  const isOpenNow = () => {
    if (!C.hours) return false;
    const { day, minutes } = clinicNow();
    const today = C.hours.days[day];
    return Boolean(today && minutes >= toMinutes(today[0]) && minutes < toMinutes(today[1]));
  };

  /* 1. Header: transparent over the hero, solid once the hero has scrolled away */
  const header = document.querySelector('[data-header]');
  const hero = document.querySelector('[data-hero]');
  if (header && hero) {
    io(([entry]) => header.classList.toggle('is-solid', !entry.isIntersecting),
      { rootMargin: `-${header.offsetHeight}px 0px 0px 0px` }).observe(hero);
  }

  /* 2. Menu (phones and tablets): full-screen dialog, focus trapped, Esc closes */
  const menu = document.getElementById('menu');
  if (menu) {
    const toggle = document.querySelector('.menu-toggle');
    const onKey = (e) => {
      if (e.key === 'Escape') close();
      else if (e.key === 'Tab') trapFocus(menu, e);
    };
    const open = () => {
      lockScroll(true);
      menu.inert = false;
      menu.classList.add('is-open');
      toggle.setAttribute('aria-expanded', 'true');
      document.addEventListener('keydown', onKey);
      focusSoon(menu.querySelector('[data-menu-close]'));
    };
    function close() {
      menu.classList.remove('is-open');
      menu.inert = true;
      lockScroll(false);
      toggle.setAttribute('aria-expanded', 'false');
      document.removeEventListener('keydown', onKey);
      toggle.focus();
    }
    toggle.addEventListener('click', open);
    menu.querySelector('[data-menu-close]').addEventListener('click', close);
    menu.addEventListener('click', (e) => { if (e.target.closest('a[href*="#"]')) close(); });
  }

  /* 3. Hero video (only if the config names one): fetched after load, fades in once playing */
  const video = hero && hero.querySelector('video');
  const saveData = navigator.connection && navigator.connection.saveData;
  if (video && !reduceMotion && !saveData) {
    const start = () => {
      const large = window.innerWidth * window.devicePixelRatio > 1280;
      video.src = `${video.dataset.base}${large ? '1080' : '720'}.mp4`;
      video.addEventListener('playing', () => hero.classList.add('is-playing'), { once: true });
      video.play().catch(() => {});
    };
    if (document.readyState === 'complete') start();
    else window.addEventListener('load', start, { once: true });
  }

  /* 4. Fade-in: opacity and a small rise, once, as each block enters the viewport.
        Blocks entering together are staggered (0, 0.12, 0.24s). */
  const fades = document.querySelectorAll('.fade');
  if (!reduceMotion) {
    const watcher = io((entries) => {
      entries
        .filter((entry) => entry.isIntersecting)
        .sort((x, y) => (x.boundingClientRect.top - y.boundingClientRect.top) || (x.boundingClientRect.left - y.boundingClientRect.left))
        .forEach((entry, i) => {
          entry.target.style.setProperty('--delay', `${Math.min(i, 3) * 0.12}s`);
          entry.target.classList.add('is-in');
          watcher.unobserve(entry.target);
        });
    }, { rootMargin: '0px 0px -8% 0px' });
    fades.forEach((el) => watcher.observe(el));
  } else {
    fades.forEach((el) => el.classList.add('is-in'));
  }

  /* 4b. Treatments list (desktop with a mouse): a small preview follows the cursor, to the right of it */
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine) and (min-width: 900px)');
  document.querySelectorAll('[data-index]').forEach((section) => {
    const preview = section.querySelector('[data-index-preview]');
    const imgs = [...preview.children];
    const rows = [...section.querySelectorAll('[data-preview]')];
    let x = 0; let y = 0; let tx = 0; let ty = 0; let raf = 0; let shown = false;
    const place = () => { preview.style.transform = `translate3d(${x}px, ${y}px, 0)`; };
    const tick = () => {
      x += (tx - x) * 0.16;
      y += (ty - y) * 0.16;
      place();
      raf = Math.abs(tx - x) + Math.abs(ty - y) > 0.3 ? requestAnimationFrame(tick) : 0;
    };
    const aim = (clientX, clientY) => {
      const box = section.getBoundingClientRect();
      const p = preview.getBoundingClientRect();
      tx = Math.min(Math.max(clientX - box.left + 40, 0), box.width - p.width);
      ty = Math.min(Math.max(clientY - box.top - p.height / 2, 0), box.height - p.height);
      if (!shown || reduceMotion) { x = tx; y = ty; place(); } else if (!raf) raf = requestAnimationFrame(tick);
    };
    const show = (row) => {
      imgs.forEach((img, n) => img.classList.toggle('is-active', n === Number(row.dataset.preview)));
      preview.classList.add('is-visible');
      shown = true;
    };
    const hide = () => { preview.classList.remove('is-visible'); shown = false; };
    rows.forEach((row) => {
      row.addEventListener('mouseenter', (e) => { if (!finePointer.matches) return; aim(e.clientX, e.clientY); show(row); });
      row.addEventListener('focus', () => {
        if (!finePointer.matches) return;
        const name = row.querySelector('.index__name').getBoundingClientRect();
        aim(name.right, name.top + name.height / 2);
        show(row);
      });
      row.addEventListener('blur', hide);
    });
    section.addEventListener('mousemove', (e) => { if (shown) aim(e.clientX, e.clientY); });
    section.querySelector('.index__list').addEventListener('mouseleave', hide);
  });

  /* 4c. Quick request: treatment, then day, then time; the result opens WhatsApp prefilled */
  const quick = document.querySelector('[data-quick]');
  if (quick && C.treatments) {
    const Q = C.quickRequest || { days: 6, times: [] };
    const q = (sel) => quick.querySelector(sel);
    const options = q('[data-quick-options]');
    const title = q('[data-quick-q]');
    const state = {};
    let returnTo = null;
    const DAY = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const label = (t) => { const [h, m] = t.split(':').map(Number); return `${((h + 11) % 12) + 1}${m ? `:${String(m).padStart(2, '0')}` : ''} ${h < 12 ? 'AM' : 'PM'}`; };
    const openDays = () => {
      const out = [];
      const { day, minutes } = clinicNow();
      for (let i = 0; out.length < Q.days && i < 14; i += 1) {
        const d = (day + i) % 7;
        const hours = C.hours.days[d];
        // Today only while there is still at least an hour of opening time left
        if (hours && !(i === 0 && minutes > toMinutes(hours[1]) - 60)) out.push(i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : DAY[d]);
      }
      return out;
    };
    const choose = (step, items, onPick) => {
      q('[data-quick-count]').textContent = `${step} / 3`;
      q('[data-quick-done]').hidden = true;
      options.hidden = false;
      options.replaceChildren(...items.map(([text, small, value]) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.textContent = text;
        if (small) { const s2 = document.createElement('small'); s2.textContent = small; b.append(s2); }
        b.addEventListener('click', () => onPick(value || text));
        return b;
      }));
      focusSoon(title);
    };
    const stepTreatment = () => {
      title.textContent = 'What is the visit for?';
      choose(1, [...C.treatments.map((t) => [t.name, '', t.name]), ['Not sure yet', 'A general check-up and advice', 'a check-up and advice']], (v) => { state.treatment = v; stepDay(); });
    };
    const stepDay = () => {
      title.textContent = 'Which day suits you?';
      choose(2, openDays().map((d) => [d]), (v) => { state.day = v; stepTime(); });
    };
    const stepTime = () => {
      title.textContent = 'What time of day?';
      choose(3, Q.times.map(([name, from, to]) => [name, `${label(from)} to ${label(to)}`, name.toLowerCase()]), (v) => { state.time = v; done(); });
    };
    const done = () => {
      title.textContent = 'Your request is ready';
      q('[data-quick-count]').textContent = 'Done';
      options.hidden = true;
      const msg = `Hello ${C.name}, I'd like to book a visit for ${state.treatment.toLowerCase()}, ${state.day.toLowerCase()} (${state.time}). Please confirm a time.`;
      q('[data-quick-summary]').textContent = `${state.treatment}, ${state.day}, ${state.time}.`;
      q('[data-quick-send]').href = `https://wa.me/${C.contact.whatsapp}?text=${encodeURIComponent(msg)}`;
      q('[data-quick-done]').hidden = false;
      focusSoon(title);
    };
    const onKey = (e) => { if (e.key === 'Escape') close(); else if (e.key === 'Tab') trapFocus(quick, e); };
    const open = (trigger) => {
      returnTo = trigger;
      stepTreatment();
      lockScroll(true);
      quick.inert = false;
      quick.classList.add('is-open');
      document.addEventListener('keydown', onKey);
      track('Quick request opened');
    };
    function close() {
      quick.classList.remove('is-open');
      quick.inert = true;
      lockScroll(false);
      document.removeEventListener('keydown', onKey);
      if (returnTo) returnTo.focus({ preventScroll: true });
    }
    document.addEventListener('click', (e) => {
      const trigger = e.target.closest('[data-quick-request]');
      if (!trigger) return;
      e.preventDefault();
      open(trigger);
    });
    q('[data-quick-close]').addEventListener('click', close);
    q('[data-quick-restart]').addEventListener('click', stepTreatment);
    q('[data-quick-send]').addEventListener('click', () => track('Quick request completed', { treatment: state.treatment, day: state.day, time: state.time }));
    quick.addEventListener('click', (e) => { if (e.target === quick) close(); });
  }

  /* 4d. Emergency line: a call during opening hours, a WhatsApp request outside them */
  document.querySelectorAll('[data-emergency]').forEach((box) => {
    const sync = () => {
      const open = isOpenNow();
      box.querySelector('[data-emergency-open]').hidden = !open;
      box.querySelector('[data-emergency-closed]').hidden = open;
    };
    sync();
    setInterval(sync, 60000);
  });

  /* 5. Mobile action bar: shown after the hero, hidden over the footer */
  const bar = document.querySelector('[data-mobile-bar]');
  const footer = document.querySelector('[data-footer]');
  if (bar) {
    let pastHero = !hero;
    let footerVisible = false;
    const sync = () => {
      const show = pastHero && !footerVisible;
      bar.classList.toggle('is-visible', show);
      bar.inert = !show;
      document.body.classList.toggle('has-bar', show);
    };
    if (hero) io(([e]) => { pastHero = !e.isIntersecting; sync(); }).observe(hero);
    if (footer) io(([e]) => { footerVisible = e.isIntersecting; sync(); }).observe(footer);
    sync();
  }

  /* 6. Footer wordmark: CSS sizes it from the font's measured width; once the font has
         loaded, this trims the last few percent (kerning, optical size) so it spans exactly */
  const wordmark = document.querySelector('[data-wordmark]');
  if (wordmark && document.fonts) {
    const fit = () => {
      wordmark.style.fontSize = '';
      const text = wordmark.firstElementChild.getBoundingClientRect().width;
      const space = wordmark.clientWidth;
      if (text) wordmark.style.fontSize = `${parseFloat(getComputedStyle(wordmark).fontSize) * (space / text) * 0.995}px`;
    };
    document.fonts.ready.then(fit);
    let pending = 0;
    window.addEventListener('resize', () => { cancelAnimationFrame(pending); pending = requestAnimationFrame(fit); });
  }

  /* 7. Before & after: the range input drives the split */
  const bindSlider = (ba) => {
    const range = ba.querySelector('.ba__range');
    const set = () => ba.style.setProperty('--pos', `${range.value}%`);
    range.addEventListener('input', set);
    set();
  };
  document.querySelectorAll('[data-ba]').forEach(bindSlider);

  /* 8. Cases: treatment filter (results page) and the case view dialog */
  const grid = document.querySelector('[data-cases]');
  const view = document.getElementById('case-view');
  const mediaData = document.getElementById('case-media');
  if (grid && view && mediaData && C.cases) {
    const media = JSON.parse(mediaData.textContent);
    const items = [...grid.querySelectorAll('.case-item')];
    const $ = (sel) => view.querySelector(sel);

    const filterButtons = [...document.querySelectorAll('[data-cases-block] [data-filter]')];
    filterButtons.forEach((button) => button.addEventListener('click', () => {
      if (button.getAttribute('aria-pressed') === 'true') return;
      filterButtons.forEach((b) => b.setAttribute('aria-pressed', String(b === button)));
      const cat = button.dataset.filter;
      const swap = () => items.forEach((item) => { item.hidden = cat !== 'all' && item.dataset.cat !== cat; });
      if (reduceMotion) { swap(); return; }
      grid.classList.add('is-fading');
      setTimeout(() => {
        swap();
        // Tiles shown for the first time skip their own fade; the grid fades back as one
        items.forEach((item) => item.classList.add('is-in'));
        grid.classList.remove('is-fading');
      }, 300);
    }));

    const pictureHTML = (name, sizes, cls = '') => {
      const ws = media[name] || [1280];
      const set = (ext) => ws.map((w) => `${ASSETS}img/${name}-${w}.${ext} ${w}w`).join(', ');
      const base = ws.includes(1280) ? 1280 : ws[ws.length - 1];
      return `<picture class="${cls}"><source type="image/avif" srcset="${set('avif')}" sizes="${sizes}">`
        + `<source type="image/webp" srcset="${set('webp')}" sizes="${sizes}">`
        + `<img src="${ASSETS}img/${name}-${base}.jpg" srcset="${set('jpg')}" sizes="${sizes}" alt=""></picture>`;
    };
    let index = 0;
    let returnFocus = null;
    const visible = () => items.filter((item) => !item.hidden).map((item) => Number(item.querySelector('.case').dataset.case));
    const render = () => {
      const c = C.cases[index];
      const list = visible();
      $('[data-cv-title]').textContent = c.name;
      $('[data-cv-meta]').textContent = c.meta;
      $('[data-cv-concern]').textContent = c.concern;
      $('[data-cv-plan]').textContent = c.plan;
      $('[data-cv-result]').textContent = c.result;
      $('[data-cv-note]').textContent = c.note ? `“${c.note}”` : '';
      $('[data-cv-sample]').hidden = !c.sample;
      $('[data-cv-count]').textContent = `${String(list.indexOf(index) + 1).padStart(2, '0')} / ${String(list.length).padStart(2, '0')}`;
      const treatment = (C.treatments || []).find((t) => t.slug === c.cat);
      const book = $('[data-cv-book]');
      book.href = treatment ? `${SITE_ROOT}treatments/${treatment.slug}/` : `${SITE_ROOT}book/`;
      book.textContent = treatment ? `About ${treatment.name.toLowerCase()}` : 'Book a visit';
      const sizes = c.face ? '(min-width: 900px) 28vw, 50vw' : '(min-width: 900px) 55vw, 100vw';
      const smile = c.before
        ? `<div class="ba" data-ba>${pictureHTML(c.image, sizes)}<div class="ba__before">${pictureHTML(c.before, sizes)}</div>
            <span class="ba__tag ba__tag--before label">Before</span><span class="ba__tag ba__tag--after label">After</span>
            <input class="ba__range" type="range" min="0" max="100" value="50" aria-label="Compare before and after">
            <span class="ba__handle" aria-hidden="true"><span class="ba__grip"></span></span></div>`
        : pictureHTML(c.image, sizes);
      const box = $('[data-cv-media]');
      box.classList.toggle('is-pair', Boolean(c.face));
      box.innerHTML = `<figure class="cv-frame">${smile}${c.face ? '<span class="cv-frame__label label">Smile</span>' : ''}</figure>`
        + (c.face ? `<figure class="cv-frame">${pictureHTML(c.face, sizes)}<span class="cv-frame__label label">Full face</span></figure>` : '')
        + (c.sample ? '<p class="case-view__note">Sample case: stock photographs, for demonstration only.</p>' : '');
      const imgs = box.querySelectorAll('img');
      imgs[0].alt = c.sample ? `Sample image: ${c.name}` : c.name;
      if (c.face) imgs[imgs.length - 1].alt = c.sample ? 'Sample image: full face' : `${c.name}, full face`;
      if (c.before) bindSlider(box.querySelector('[data-ba]'));
    };
    const step = (dir) => {
      const list = visible();
      index = list[(list.indexOf(index) + dir + list.length) % list.length];
      render();
    };
    const onKey = (e) => {
      if (e.key === 'Escape') close();
      else if ((e.key === 'ArrowRight' || e.key === 'ArrowLeft') && !e.target.matches('.ba__range')) step(e.key === 'ArrowRight' ? 1 : -1);
      else if (e.key === 'Tab') trapFocus(view, e);
    };
    const open = (i, trigger) => {
      index = i;
      returnFocus = trigger;
      render();
      lockScroll(true);
      view.inert = false;
      view.classList.add('is-open');
      document.addEventListener('keydown', onKey);
      focusSoon($('[data-cv-close]'));
    };
    function close() {
      view.classList.remove('is-open');
      view.inert = true;
      lockScroll(false);
      document.removeEventListener('keydown', onKey);
      if (returnFocus) returnFocus.focus();
    }
    grid.addEventListener('click', (e) => {
      const tile = e.target.closest('.case');
      if (tile) open(Number(tile.dataset.case), tile);
    });
    $('[data-cv-close]').addEventListener('click', close);
    $('[data-cv-prev]').addEventListener('click', () => step(-1));
    $('[data-cv-next]').addEventListener('click', () => step(1));
  }

  /* 9. Reviews: one quote at a time, slow crossfade every 7s. Pauses on hover/focus,
         off screen, with the Pause button and with reduced motion. */
  document.querySelectorAll('[data-reviews]').forEach((block) => {
    const slides = [...block.querySelectorAll('.review')];
    const count = block.querySelector('[data-review-count]');
    const pauseButton = block.querySelector('[data-review-pause]');
    let current = 0; let timer = 0; let hovering = false; let paused = reduceMotion; let onScreen = false;
    if (reduceMotion) { pauseButton.hidden = true; }
    const show = (i) => {
      current = (i + slides.length) % slides.length;
      slides.forEach((s, n) => {
        s.classList.toggle('is-active', n === current);
        s.setAttribute('aria-hidden', String(n !== current));
      });
      count.textContent = String(current + 1).padStart(2, '0');
    };
    const schedule = () => {
      clearTimeout(timer);
      if (!paused && !hovering && onScreen) timer = setTimeout(() => { show(current + 1); schedule(); }, 7000);
    };
    block.querySelector('[data-review-prev]').addEventListener('click', () => { show(current - 1); schedule(); });
    block.querySelector('[data-review-next]').addEventListener('click', () => { show(current + 1); schedule(); });
    pauseButton.addEventListener('click', () => {
      paused = !paused;
      pauseButton.setAttribute('aria-pressed', String(paused));
      pauseButton.textContent = paused ? 'Play' : 'Pause';
      schedule();
    });
    const stage = block.querySelector('.reviews__stage');
    stage.addEventListener('mouseenter', () => { hovering = true; schedule(); });
    stage.addEventListener('mouseleave', () => { hovering = false; schedule(); });
    block.addEventListener('focusin', () => { hovering = true; schedule(); });
    block.addEventListener('focusout', (e) => { if (!block.contains(e.relatedTarget)) { hovering = false; schedule(); } });
    io(([entry]) => { onScreen = entry.isIntersecting; schedule(); }).observe(block);
  });

  /* 10. FAQ accordion */
  document.querySelectorAll('[data-accordion] [aria-controls]').forEach((trigger) => {
    const panel = document.getElementById(trigger.getAttribute('aria-controls'));
    const item = trigger.closest('.faq__item');
    panel.inert = true;
    trigger.addEventListener('click', () => {
      const open = trigger.getAttribute('aria-expanded') !== 'true';
      trigger.setAttribute('aria-expanded', String(open));
      item.classList.toggle('is-open', open);
      panel.inert = !open;
    });
  });

  /* 11. Live open status, in the clinic's time zone */
  const statusEls = document.querySelectorAll('[data-open-status]');
  if (statusEls.length && C.hours) {
    const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const label = (t) => {
      const [h, m] = t.split(':').map(Number);
      return `${((h + 11) % 12) + 1}${m ? `:${String(m).padStart(2, '0')}` : ''} ${h < 12 ? 'AM' : 'PM'}`;
    };
    const describe = () => {
      const { day, minutes } = clinicNow();
      const today = C.hours.days[day];
      if (today && minutes >= toMinutes(today[0]) && minutes < toMinutes(today[1])) return `Open now · until ${label(today[1])}`;
      if (today && minutes < toMinutes(today[0])) return `Closed now · opens today at ${label(today[0])}`;
      for (let i = 1; i <= 7; i += 1) {
        const next = C.hours.days[(day + i) % 7];
        if (next) return `Closed now · opens ${i === 1 ? 'tomorrow' : DAY_NAMES[(day + i) % 7]} at ${label(next[0])}`;
      }
      return 'Closed';
    };
    const render = () => { const text = describe(); statusEls.forEach((el) => { el.textContent = text; }); };
    render();
    setInterval(render, 60000);
  }

  /* 12. Plan your visit: one question at a time; nothing stored or sent. The result
         writes the plan into a WhatsApp message. Timings come from each treatment's config. */
  document.querySelectorAll('[data-planner]').forEach((planner) => {
    const P = C.planner || {};
    const steps = [...planner.querySelectorAll('.planner__step')];
    const city = planner.querySelector('#planner-city');
    const daysValue = planner.querySelector('[data-days-value]');
    const state = { treatment: null, city: '', days: P.startDays || 5 };
    const show = (name) => {
      steps.forEach((s) => {
        const on = s.dataset.step === String(name);
        s.classList.toggle('is-active', on);
        s.inert = !on;
      });
      const active = steps.find((s) => s.dataset.step === String(name));
      setTimeout(() => (name === 2 ? city : active.querySelector('[tabindex="-1"]')).focus({ preventScroll: true }), reduceMotion ? 0 : 450);
    };
    const result = () => {
      const t = (C.treatments || []).find((x) => x.slug === state.treatment);
      const name = t ? t.name : 'A consultation';
      const dayWord = state.days === 1 ? 'day' : 'days';
      planner.querySelector('[data-summary]').textContent = `${name}. ${state.city ? `From ${state.city}. ` : ''}${state.days} ${dayWord} in ${P.city}.`;
      planner.querySelector('[data-detail]').textContent = t ? t.planner.days : P.unsure;
      const msg = `Hello ${C.name}, I'm planning a visit for ${t ? t.name.toLowerCase() : 'a consultation'}.`
        + `${state.city ? ` I'm travelling from ${state.city}` : " I'm travelling"} and can be in ${P.city} for ${state.days} ${dayWord}.`
        + ' Could we arrange a video consultation first?';
      const send = planner.querySelector('[data-whatsapp]');
      send.href = `https://wa.me/${C.contact.whatsapp}?text=${encodeURIComponent(msg)}`;
      send.onclick = () => track('Planner sent', { treatment: name, days: state.days });
      show('result');
    };
    planner.querySelectorAll('[data-treatment]').forEach((button) => button.addEventListener('click', () => {
      state.treatment = button.dataset.treatment;
      planner.querySelectorAll('[data-treatment]').forEach((b) => b.setAttribute('aria-pressed', String(b === button)));
      setTimeout(() => show(2), reduceMotion ? 0 : 250);
    }));
    planner.querySelectorAll('[data-planner-next]').forEach((button) => button.addEventListener('click', () => {
      if (button.closest('[data-step="2"]')) {
        state.city = city.value.trim().replace(/\s+/g, ' ');
        show(3);
      } else {
        result();
      }
    }));
    city.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter') return;
      e.preventDefault();
      planner.querySelector('[data-step="2"] [data-planner-next]').click();
    });
    planner.querySelectorAll('[data-days]').forEach((button) => button.addEventListener('click', () => {
      state.days = Math.min(P.maxDays || 30, Math.max(P.minDays || 1, state.days + Number(button.dataset.days)));
      daysValue.textContent = state.days;
    }));
    planner.querySelector('[data-planner-restart]').addEventListener('click', () => {
      Object.assign(state, { treatment: null, city: '', days: P.startDays || 5 });
      city.value = '';
      daysValue.textContent = state.days;
      planner.querySelectorAll('[data-treatment]').forEach((b) => b.setAttribute('aria-pressed', 'false'));
      show(1);
    });
  });

  /* 13a. Map: Google Maps loads only after a click (privacy and speed) */
  document.querySelectorAll('[data-map-src]').forEach((button) => button.addEventListener('click', () => {
    const frame = document.createElement('iframe');
    frame.src = button.dataset.mapSrc;
    frame.title = button.dataset.mapTitle || 'Map';
    frame.loading = 'lazy';
    frame.referrerPolicy = 'no-referrer-when-downgrade';
    frame.allowFullscreen = true;
    button.replaceWith(frame);
    frame.focus();
  }));

  /* 13b. Demo mode: call and WhatsApp links explain themselves instead of dialling a placeholder */
  if (C.demo) {
    const note = document.createElement('div');
    note.className = 'demo-note';
    note.setAttribute('role', 'status');
    document.body.append(note);
    let timer = 0;
    document.addEventListener('click', (e) => {
      const link = e.target.closest('a[href^="tel:"], a[href*="wa.me/"], a[data-google-reviews]');
      if (!link) return;
      e.preventDefault();
      if (link.matches('[data-google-reviews]')) {
        note.innerHTML = '<strong>Demo site</strong>';
        note.append('On the live site this opens the clinic’s Google reviews.');
        note.classList.add('is-visible');
        clearTimeout(timer);
        timer = setTimeout(() => note.classList.remove('is-visible'), 7000);
        return;
      }
      const whatsapp = link.href.includes('wa.me/');
      const text = whatsapp ? new URL(link.href).searchParams.get('text') : '';
      note.innerHTML = '<strong>Demo site</strong>';
      note.append(whatsapp
        ? `On the live site this opens WhatsApp to the clinic${text ? `, with this message ready to send: “${text}”` : '.'}`
        : 'On the live site this calls the clinic.');
      note.classList.add('is-visible');
      clearTimeout(timer);
      timer = setTimeout(() => note.classList.remove('is-visible'), 7000);
    });
  }

  /* 13c. Riya: the mascot, a round launcher, and a one-time hint on desktop. The chat window
          (riya.js) loads on the first click. Mascot colours come from config.riya.mascot. */
  const TOOTH = 'M20 9C13 9 9 15 10 23C11 31 14 35 15 43C16 50 18 55 21 55C24 55 25 50 26 45C27 41 29 40 32 40'
    + 'C35 40 37 41 38 45C39 50 40 55 43 55C46 55 48 50 49 43C50 35 53 31 54 23C55 15 51 9 44 9C39 9 36 12 32 12C28 12 25 9 20 9Z';
  const mascotSVG = (cls = '') => {
    const m = (C.riya && C.riya.mascot) || {};
    const pal = (C.theme && C.theme.colors) || {};
    const col = (key, fallback) => pal[m[key] || fallback] || m[key] || fallback;
    const headset = m.showHeadset === false ? '' : `
      <path d="M12 25C12 0 52 0 52 25" fill="none" stroke="${col('headset', 'accent')}" stroke-width="2.4" stroke-linecap="round"/>`;
    const pads = m.showHeadset === false ? '' : `
      <rect x="7.5" y="19" width="6" height="12" rx="3" fill="${col('headset', 'accent')}"/>
      <rect x="50.5" y="19" width="6" height="12" rx="3" fill="${col('headset', 'accent')}"/>
      <path d="M10.5 30C11 37 16 40.5 21.5 40.5" fill="none" stroke="${col('headset', 'accent')}" stroke-width="2.2" stroke-linecap="round"/>
      <circle cx="22.5" cy="40.5" r="2.4" fill="${col('headset', 'accent')}"/>`;
    return `<svg class="mascot ${cls}" viewBox="0 0 64 64" aria-hidden="true" focusable="false">
      <circle cx="32" cy="32" r="32" fill="${col('circle', 'ink')}"/>
      <g class="mascot__body"><g transform="translate(32 34) scale(.82) translate(-32 -32)">${headset}
        <path d="${TOOTH}" fill="${col('body', 'bg')}"/>${pads}
        <circle cx="21.5" cy="31.5" r="2.6" fill="${col('cheeks', 'stone')}"/>
        <circle cx="42.5" cy="31.5" r="2.6" fill="${col('cheeks', 'stone')}"/>
        <g class="mascot__eyes"><ellipse cx="25.5" cy="25.5" rx="2.8" ry="3.4" fill="${col('features', 'ink')}"/><ellipse cx="38.5" cy="25.5" rx="2.8" ry="3.4" fill="${col('features', 'ink')}"/></g>
        <path d="M27.5 31.5Q32 35.8 36.5 31.5" fill="none" stroke="${col('features', 'ink')}" stroke-width="2" stroke-linecap="round"/>
      </g></g></svg>`;
  };
  window.clinicMascot = mascotSVG;
  const riya = C.riya;
  if (riya && riya.enabled) {
    const launcher = document.createElement('button');
    launcher.type = 'button';
    launcher.className = 'riya-launcher';
    launcher.innerHTML = mascotSVG();
    launcher.setAttribute('aria-expanded', 'false');
    launcher.setAttribute('aria-label', `Ask ${riya.name}, the clinic’s receptionist`);
    document.body.append(launcher);
    let chat = null;
    let bubble = null;
    const getChat = async () => {
      if (!chat) {
        const { mountRiya } = await import(`${ASSETS}js/riya.js`);
        chat = mountRiya({ clinic: C, launcher, mascot: mascotSVG });
      }
      return chat;
    };
    const remember = (key) => { try { sessionStorage.setItem(key, '1'); } catch (e) { /* storage blocked */ } };
    const seen = (key) => { try { return Boolean(sessionStorage.getItem(key)); } catch (e) { return true; } };
    const hideBubble = () => {
      if (!bubble) return;
      const el = bubble;
      bubble = null;
      el.classList.remove('is-visible');
      setTimeout(() => el.remove(), reduceMotion ? 0 : 300);
    };
    launcher.addEventListener('click', async () => {
      hideBubble();
      remember('riya-opened');
      const c = await getChat();
      if (!launcher.matches('[aria-expanded="true"]')) track('Riya opened');
      c.toggle();
    });

    // Proactive bubble: once per session, after a few seconds or some scrolling, never after the chat was opened
    const B = riya.bubble;
    if (B && !seen('riya-bubble') && !seen('riya-opened')) {
      let timer = 0;
      const onScroll = () => {
        const read = (window.scrollY + window.innerHeight) / document.documentElement.scrollHeight * 100;
        if (read >= (B.scroll || 30)) showBubble();
      };
      function showBubble() {
        clearTimeout(timer);
        window.removeEventListener('scroll', onScroll);
        if (chat || bubble || seen('riya-opened') || root.classList.contains('is-locked')) return;
        remember('riya-bubble');
        bubble = document.createElement('div');
        bubble.className = 'riya-bubble';
        bubble.setAttribute('role', 'dialog');
        bubble.setAttribute('aria-label', `Message from ${riya.name}`);
        bubble.innerHTML = `<p class="riya-bubble__text"></p><div class="riya-bubble__chips"></div>
          <button class="riya-bubble__close" type="button" aria-label="Dismiss">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 7l10 10M17 7L7 17" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>
          </button>`;
        bubble.querySelector('.riya-bubble__text').textContent = B.text;
        B.chips.forEach((label) => {
          const chip = document.createElement('button');
          chip.type = 'button';
          chip.textContent = label;
          chip.addEventListener('click', async () => {
            track('riya_bubble_clicked', { chip: label });
            hideBubble();
            remember('riya-opened');
            const c = await getChat();
            c.open();
            track('Riya opened');
            c.ask(label);
          });
          bubble.querySelector('.riya-bubble__chips').append(chip);
        });
        bubble.querySelector('.riya-bubble__close').addEventListener('click', hideBubble);
        document.body.append(bubble);
        requestAnimationFrame(() => bubble && bubble.classList.add('is-visible'));
        // The mascot waves once
        const m = launcher.querySelector('.mascot');
        if (m && !reduceMotion) {
          m.classList.add('is-waving');
          m.addEventListener('animationend', () => m.classList.remove('is-waving'), { once: true });
        }
        track('riya_bubble_shown');
      }
      timer = setTimeout(showBubble, (B.delay || 5) * 1000);
      window.addEventListener('scroll', onScroll, { passive: true });
    }

    // Demo: ?riya=open opens the full chat straight away (for showing prospects)
    if (C.demo && new URLSearchParams(window.location.search).get('riya') === 'open') {
      remember('riya-opened');
      getChat().then((c) => { c.open(); track('Riya opened', { via: 'url' }); });
    }
  }
})();
