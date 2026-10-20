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

export function mountRiya({ clinic: C, launcher }) {
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
      <div>
        <p class="riya__name" id="riya-title"></p>
        <p class="riya__status"></p>
      </div>
      <button class="riya__close" type="button">Close</button>
    </header>
    <div class="riya__log" aria-live="polite">
      <p class="riya__msg riya__msg--bot"></p>
      <div class="riya__quick" role="group" aria-label="Suggested questions"></div>
    </div>
    <form class="riya__form">
      <label class="visually-hidden" for="riya-input">Message</label>
      <textarea id="riya-input" rows="1" autocomplete="off"></textarea>
      <button class="riya__send" type="submit">Send</button>
    </form>
    <p class="riya__note"></p>`;
  panel.querySelector('.riya__name').textContent = R.name;
  panel.querySelector('.riya__status').textContent = `${C.name} · ${live ? 'Replies instantly' : 'Demo replies'}`;
  panel.querySelector('.riya__msg--bot').textContent = R.welcome;
  panel.querySelector('#riya-input').placeholder = `Ask ${R.name} anything…`;
  panel.querySelector('.riya__note').textContent = live
    ? `${R.name} passes your request to the clinic team. Appointments are confirmed by phone.`
    : `Demo: ${R.name} answers from the clinic’s details. On a live site she is connected to the clinic.`;
  const quick = panel.querySelector('.riya__quick');
  R.quick.forEach((q) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = q;
    quick.append(b);
  });
  document.body.append(panel);

  const log = panel.querySelector('.riya__log');
  const form = panel.querySelector('.riya__form');
  const input = panel.querySelector('#riya-input');
  const send = panel.querySelector('.riya__send');
  let busy = false;

  const addMessage = (text, who) => {
    const p = document.createElement('p');
    p.className = `riya__msg riya__msg--${who}`;
    p.textContent = text;
    log.append(p);
    log.scrollTop = log.scrollHeight;
  };

  async function reply(text) {
    if (!live) {
      await new Promise((r) => setTimeout(r, reduceMotion ? 0 : 600));
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
    addMessage(text, 'user');
    const typing = document.createElement('p');
    typing.className = 'riya__typing';
    typing.textContent = `${R.name} is typing…`;
    log.append(typing);
    log.scrollTop = log.scrollHeight;
    try {
      const answer = await reply(text);
      typing.remove();
      addMessage(String(answer || '…'), 'bot');
    } catch (e) {
      typing.remove();
      addMessage(`Sorry, I couldn’t reach the clinic just now. Please call ${C.contact.phoneDisplay} or message us on WhatsApp.`, 'bot');
    }
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
