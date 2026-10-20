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
    const toMinutes = (t) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
    const label = (t) => {
      const [h, m] = t.split(':').map(Number);
      return `${((h + 11) % 12) + 1}${m ? `:${String(m).padStart(2, '0')}` : ''} ${h < 12 ? 'AM' : 'PM'}`;
    };
    const now = () => {
      const parts = Object.fromEntries(new Intl.DateTimeFormat('en-GB', {
        timeZone: C.hours.timeZone, weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
      }).formatToParts(new Date()).map((p) => [p.type, p.value]));
      return { day: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(parts.weekday), minutes: Number(parts.hour) * 60 + Number(parts.minute) };
    };
    const describe = () => {
      const { day, minutes } = now();
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
      planner.querySelector('[data-whatsapp]').href = `https://wa.me/${C.contact.whatsapp}?text=${encodeURIComponent(msg)}`;
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
      const link = e.target.closest('a[href^="tel:"], a[href*="wa.me/"]');
      if (!link) return;
      e.preventDefault();
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

  /* 13c. Riya: only a small launcher is drawn; the chat loads on the first click */
  const riya = C.riya;
  if (riya && riya.enabled) {
    const launcher = document.createElement('button');
    launcher.type = 'button';
    launcher.className = 'riya-launcher';
    launcher.textContent = `Ask ${riya.name}`;
    launcher.setAttribute('aria-expanded', 'false');
    launcher.setAttribute('aria-label', `Chat with ${riya.name}, the clinic’s receptionist`);
    document.body.append(launcher);
    let chat = null;
    launcher.addEventListener('click', async () => {
      if (!chat) {
        const { mountRiya } = await import(`${ASSETS}js/riya.js`);
        chat = mountRiya({ clinic: C, launcher });
      }
      chat.toggle();
    });
  }
})();
