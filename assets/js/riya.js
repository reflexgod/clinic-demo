/* ==========================================================================
   Riya, the clinic's AI receptionist: chat window. Loaded on the launcher's first click.
   With config.riya.webhookUrl set, it talks to an n8n Chat Trigger webhook using the request
   the @n8n/chat widget sends: POST { action: 'sendMessage', sessionId, chatInput } -> { output }.
   With no webhook, it gives demo answers built from clinic.config.js.
   Nothing is sent until the visitor sends a message or taps a suggestion.
   ========================================================================== */

// Demo answers: simple keyword matching over the clinic's own config
function demoReply(text, C) {
  const t = text.toLowerCase();
  const has = (...words) => words.some((w) => t.includes(w));
  // Keywords from each slug, minus generic words and words in the clinic's name ("implants" -> "implant")
  const generic = ['dental', 'treatment', 'and', 'ups', ...C.name.toLowerCase().split(/\W+/)];
  const treatment = C.treatments.find((x) => x.slug.split('-')
    .filter((w) => w.length > 3 && !generic.includes(w))
    .some((w) => t.includes(w.replace(/s$/, ''))));
  if (treatment) return `${treatment.name}: ${treatment.summary} ${treatment.intro.split('. ')[0]}. Would you like me to request an appointment?`;
  if (has('time', 'timing', 'hour', 'open', 'close', 'sunday')) return `We are open ${C.hours.summary.join('; ')}.`;
  if (has('where', 'address', 'locat', 'direction', 'map', 'park')) return `We are at ${C.address.lines.join(', ')}${C.address.landmark ? ` (${C.address.landmark})` : ''}. ${C.address.access}.`;
  if (has('treatment', 'service', 'offer', 'do you')) return `We offer ${C.treatments.map((x) => x.name.toLowerCase()).join(', ')}. Which would you like to know about?`;
  if (has('book', 'appointment', 'visit', 'slot', 'consult')) return 'I can request an appointment for you. Please share your name, a phone number and a day that suits you, and the team will call to confirm.';
  if (has('price', 'cost', 'fee', 'charge')) return 'Costs depend on what each person needs, so the team explains them clearly at your first visit, before anything is booked.';
  if (has('hello', 'hi', 'hey', 'namaste')) return 'Hello! How can I help today?';
  return 'Thank you. I’ll pass that to the clinic team, who can answer in detail. Is there anything else, such as timings or directions?';
}

export function mountRiya({ clinic: C, launcher, mascot }) {
  const R = C.riya;
  const root = document.documentElement;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const isPhone = () => window.matchMedia('(max-width: 599px)').matches;
  const live = Boolean(R.webhookUrl);
  let sessionId = '';
  try { sessionId = sessionStorage.getItem('riya-session') || ''; } catch (e) { /* storage blocked */ }
  if (!sessionId) {
    sessionId = (crypto.randomUUID && crypto.randomUUID()) || String(Date.now()) + Math.random().toString(16).slice(2);
    try { sessionStorage.setItem('riya-session', sessionId); } catch (e) { /* storage blocked */ }
  }
  const panel = document.createElement('section');
  panel.className = 'riya';
  panel.id = 'riya';
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-labelledby', 'riya-title');
  panel.hidden = true;
  panel.innerHTML = `
    <header class="riya__head">
      <span class="riya__avatar riya__avatar--head">${mascot()}</span>
      <div class="riya__id">
        <p class="riya__name" id="riya-title"></p>
        <p class="riya__status"><span class="riya__clinic"></span><span class="riya__online"><span class="riya__dot" aria-hidden="true"></span>Online</span></p>
      </div>
      <button class="riya__close" type="button" aria-label="Close chat">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>
      </button>
    </header>
    <div class="riya__log" aria-live="polite"></div>
    <form class="riya__form">
      <label class="visually-hidden" for="riya-input">Message</label>
      <textarea id="riya-input" rows="1" autocomplete="off"></textarea>
      <button class="riya__send" type="submit" aria-label="Send message">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h13M13 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
      </button>
    </form>
    <p class="riya__note"></p>`;
  panel.querySelector('.riya__name').textContent = R.name;
  panel.querySelector('.riya__clinic').textContent = `${C.name} ·`;
  panel.querySelector('#riya-input').placeholder = `Message ${R.name}…`;
  panel.querySelector('.riya__note').textContent = live
    ? (R.note || `${R.name} is an AI assistant. Appointments are confirmed by the clinic team.`)
    : `Demo: ${R.name} answers from the clinic’s details.`;
  document.body.append(panel);

  const log = panel.querySelector('.riya__log');
  const form = panel.querySelector('.riya__form');
  const input = panel.querySelector('#riya-input');
  const send = panel.querySelector('.riya__send');
  const headAvatar = panel.querySelector('.riya__avatar--head');
  let busy = false;

  const scrollDown = () => { log.scrollTop = log.scrollHeight; };
  const lastIsBot = () => { const last = log.lastElementChild; return Boolean(last && last.classList.contains('riya__row--bot')); };
  // A bot row carries the mascot only when it starts a new group of bot messages
  const botRow = (content) => {
    const row = document.createElement('div');
    row.className = 'riya__row riya__row--bot';
    const avatar = document.createElement('span');
    avatar.className = 'riya__avatar';
    if (!lastIsBot()) avatar.innerHTML = mascot();
    row.append(avatar, content);
    log.append(row);
    scrollDown();
    return row;
  };
  const bubble = (text) => {
    const p = document.createElement('p');
    p.className = 'riya__msg';
    p.textContent = text;
    return p;
  };
  const bounce = (el) => {
    if (!el || reduceMotion) return;
    el.classList.remove('is-bouncing');
    void el.offsetWidth;
    el.classList.add('is-bouncing');
    el.addEventListener('animationend', () => el.classList.remove('is-bouncing'), { once: true });
  };
  const addUser = (text) => {
    const row = document.createElement('div');
    row.className = 'riya__row riya__row--user';
    row.append(bubble(text));
    log.append(row);
    scrollDown();
  };

  // Welcome message and the suggestion chips
  const welcome = botRow(bubble(R.welcome));
  const quick = document.createElement('div');
  quick.className = 'riya__quick';
  quick.setAttribute('role', 'group');
  quick.setAttribute('aria-label', 'Suggested questions');
  R.quick.forEach((q) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = q;
    quick.append(b);
  });
  welcome.append(quick);

  async function reply(text) {
    if (!live) {
      await new Promise((r) => setTimeout(r, reduceMotion ? 0 : 900));
      return demoReply(text, C);
    }
    const res = await fetch(R.webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'sendMessage', sessionId, chatInput: text }),
    });
    const raw = await res.text();
    if (!res.ok) throw new Error(String(res.status));
    try {
      const data = JSON.parse(raw);
      const item = Array.isArray(data) ? data[0] : data;
      return item.output ?? item.text ?? item.message ?? raw;
    } catch (e) {
      return raw;
    }
  }

  async function ask(text) {
    text = text.trim();
    if (!text || busy) return;
    busy = true;
    send.disabled = true;
    quick.hidden = true; // suggestions only before the conversation starts
    addUser(text);
    if (window.clinicTrack) window.clinicTrack('Riya request sent');
    const dots = document.createElement('p');
    dots.className = 'riya__typing';
    dots.setAttribute('aria-label', `${R.name} is typing`);
    dots.innerHTML = '<span></span><span></span><span></span>';
    const typingRow = botRow(dots);
    typingRow.classList.add('is-typing');
    headAvatar.classList.add('is-typing');
    let answer;
    try {
      answer = String((await reply(text)) || '…');
    } catch (e) {
      answer = `Sorry, I couldn’t reach the clinic just now. Please call ${C.contact.phoneDisplay} or message us on WhatsApp.`;
    }
    typingRow.remove();
    headAvatar.classList.remove('is-typing');
    const row = botRow(bubble(answer));
    bounce(row.querySelector('.mascot') || headAvatar.querySelector('.mascot'));
    busy = false;
    send.disabled = false;
  }

  quick.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (b) ask(b.textContent);
  });
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const text = input.value;
    input.value = '';
    input.style.height = '';
    ask(text);
  });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      form.requestSubmit();
    }
  });
  input.addEventListener('input', () => {
    input.style.height = '';
    input.style.height = `${Math.min(input.scrollHeight, 120)}px`;
  });

  // Phones: full-height sheet that follows the visual viewport, so the input stays above the keyboard
  const fit = () => { panel.style.height = isPhone() && window.visualViewport ? `${window.visualViewport.height}px` : ''; };
  if (window.visualViewport) window.visualViewport.addEventListener('resize', fit);

  let closeTimer = 0;
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  function open() {
    clearTimeout(closeTimer);
    fit();
    panel.hidden = false;
    launcher.setAttribute('aria-expanded', 'true');
    if (isPhone()) root.classList.add('is-locked');
    requestAnimationFrame(() => {
      panel.classList.add('is-open');
      input.focus({ preventScroll: true });
    });
    document.addEventListener('keydown', onKey);
  }
  function close() {
    panel.classList.remove('is-open');
    launcher.setAttribute('aria-expanded', 'false');
    root.classList.remove('is-locked');
    document.removeEventListener('keydown', onKey);
    closeTimer = setTimeout(() => { panel.hidden = true; }, reduceMotion ? 0 : 300);
    launcher.focus({ preventScroll: true });
  }
  panel.querySelector('.riya__close').addEventListener('click', close);
  launcher.setAttribute('aria-controls', 'riya');
  return { open, close, toggle: () => (panel.classList.contains('is-open') ? close() : open()) };
}
