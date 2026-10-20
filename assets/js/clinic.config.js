/* ==========================================================================
   CLINIC CONFIG: the one file to edit for a new prospect.

   tools/build.py writes every page from it (names, copy, colours, fonts,
   treatments, cases, reviews, contact details, SEO tags):
       .venv/Scripts/python -I tools/build.py
   The browser reads it too, for the open-now status, the planner, the case
   view, demo mode and Riya. So: edit, rebuild, done.

   Plain data only: strings, numbers, true/false, null, lists and objects.
   Images are base names of files in assets/img (e.g. 'photo-family' means
   assets/img/photo-family-{640,1280,1920}.{avif,webp,jpg}); new photos go
   through tools/stock.py or tools/images.py. "pos" is the focal point
   (CSS object-position). Keep copy short: one idea per line.
   ========================================================================== */
window.CLINIC = {
  // Demo mode: call and WhatsApp links show a short note instead of opening anything,
  // and the footer says the clinic is fictional. Set false for a real clinic.
  demo: true,

  site: {
    url: 'https://demo.viraajautomates.tech/', // canonical address, with trailing slash
    lang: 'en-IN',
    locale: 'en_IN',
    noindex: true, // keep out of search engines (also robots.txt) until launch
    year: 2026,
    credit: 'Demo prepared by Viraaj',
  },

  name: 'Smile Dental Clinic',
  wordmark: 'Smile Dental Clinic', // set beside the logo mark in the heading font (header and footer)
  logo: {
    // The mark: SVG path data in a 40 x 40 box, drawn as a round-capped stroke: ink on light
    // backgrounds, limestone on dark ones and photos. This one is a single-line tooth with a smile.
    // tools/build.py also writes assets/logo/*.svg and the favicons from it.
    mark: 'M14 7C9 7 6.5 11 7.3 16.5C8 21.5 10 24 10.6 29C11.2 33.5 12.5 35.5 14.3 35.5C16.3 35.5 16.8 32 17.4 29C18 26.5 18.8 25.5 20 25.5C21.2 25.5 22 26.5 22.6 29C23.2 32 23.7 35.5 25.7 35.5C27.5 35.5 28.8 33.5 29.4 29C30 24 32 21.5 32.7 16.5C33.5 11 31 7 26 7C23.5 7 22 8.6 20 8.6C18 8.6 16.5 7 14 7Z M14.5 17Q20 22.5 25.5 17',
    stroke: 2.4,
  },
  tagline: 'Your family dentist on FC Road.',
  description: 'Family dental clinic on FC Road, Shivajinagar, Pune. Every step explained, no unnecessary treatment, and evening appointments until 8 PM, Monday to Saturday.',

  theme: {
    colors: {
      bg: '#F5F2EC', // warm limestone: page background
      ink: '#1F2A3A', // deep navy: text and dark surfaces
      stone: '#E6E0D6', // secondary surfaces
      accent: '#8A9A88', // muted sage: link underlines and hover only
    },
    fonts: {
      // Files live in assets/fonts (tools/fonts.py downloads them). fallback = local font
      // the metrics are matched to, so nothing shifts when the web font arrives.
      heading: { family: 'Fraunces', file: 'fraunces.woff2', weight: '300 450', fallback: 'Georgia', use: 360 },
      body: { family: 'Manrope', file: 'manrope.woff2', weight: '400 600', fallback: 'Arial', use: 400 },
    },
  },

  contact: {
    // Demo placeholder: an invalid number that reaches no one.
    phoneDisplay: '+91 00000 00000',
    phoneTel: '+910000000000',
    whatsapp: '910000000000', // digits only, with country code
    whatsappGreeting: 'Hello Smile Dental Clinic, I’d like to book a visit.',
    email: null,
  },

  address: {
    lines: ['FC Road, Shivajinagar', 'Pune 411004'],
    street: 'FC Road, Shivajinagar',
    locality: 'Pune',
    region: 'Maharashtra',
    postalCode: '411004',
    country: 'IN',
    landmark: 'Near Fergusson College', // optional, shown on the map block
    mapQuery: 'FC Road, Shivajinagar, Pune', // used in the map's title
    // Google Maps embed of the area (not a specific business in the demo); each client sets their own
    mapEmbed: 'https://www.google.com/maps?q=FC+Road,+Shivajinagar,+Pune&z=15&output=embed',
    access: 'Ground floor · Step-free entrance · Street parking nearby',
  },

  hours: {
    timeZone: 'Asia/Kolkata',
    // 0 = Sunday ... 6 = Saturday; null = closed. 24-hour times.
    days: [null, ['10:00', '20:00'], ['10:00', '20:00'], ['10:00', '20:00'], ['10:00', '20:00'], ['10:00', '20:00'], ['10:00', '20:00']],
    summary: ['Monday to Saturday, 10 AM to 8 PM', 'Sunday closed'],
  },

  // Review rating shown under the hero CTA. sample: true adds "Sample" in the demo.
  rating: { value: '4.9', count: '200+', source: 'Google', sample: true },

  // Small proof lines placed under primary calls to action
  proof: {
    evenings: 'Evening slots till 8 PM, Monday to Saturday',
    explained: 'Every step explained before we start',
    noPressure: 'No pressure: nothing is booked until you decide',
  },

  // "What it costs" on treatment pages. Leave a field empty ('') to hide it.
  pricing: {
    consultation: '₹500 consultation',
    estimate: 'A clear written estimate before any treatment',
    emi: 'EMI options available',
    note: 'Sample prices for the demo.',
  },

  // 3-tap quick request (treatment, day, time), sent as a prefilled WhatsApp message
  quickRequest: {
    days: 6, // how many open days ahead to offer
    times: [['Morning', '10:00', '13:00'], ['Afternoon', '13:00', '17:00'], ['Evening', '17:00', '20:00']],
  },

  // Emergency line in the visit section: a call during opening hours, a WhatsApp request outside them
  emergency: {
    title: 'Toothache or a broken tooth?',
    open: 'Call now and we will try to see you today.',
    closed: 'Send a WhatsApp request; we reply first thing when we open.',
  },

  // Privacy-friendly analytics (for example Plausible: src 'https://plausible.io/js/script.js',
  // domain 'yourclinic.in'). Empty in the demo: events are logged to the console instead.
  analytics: { src: '', domain: '' },

  // Sample numbers for the hidden /stats page (how the clinic would see the results)
  stats: {
    month: 'This month (sample)',
    items: [['Calls from the site', 46], ['WhatsApp chats started', 118], ['Quick requests sent', 37], ['Riya conversations', 64], ['Riya appointment requests', 19], ['Visit plans sent', 8]],
    scroll: [['Read a quarter of the page', '82%'], ['Half', '61%'], ['Three quarters', '44%'], ['All of it', '29%']],
  },

  doctors: [
    {
      name: 'Dr. Mehta',
      role: 'Your dentist',
      credentials: 'BDS, MDS (Prosthodontics)',
      years: '12 years in practice',
      memberships: 'Member, Indian Dental Association',
      sample: true, // labels portrait, credentials and video as samples in the demo
      quote: 'I would rather explain twice than rush once.',
      image: 'photo-doctor',
      imageAlt: 'Sample portrait: a dentist in a white shirt with a stethoscope',
      pos: '50% 30%',
      video: null, // a 20-second "Meet the doctor" MP4; null shows the poster only
      videoPoster: 'photo-consult-desk',
    },
  ],

  hero: {
    label: 'FC Road, Shivajinagar, Pune', // the open-now status is shown beside it
    lines: ['Family & cosmetic dentist', 'on FC Road, Pune.'], // each line reveals from its own mask
    lede: 'Every step explained. No treatment you don’t need. Evening appointments till 8 PM.',
    secondary: 'WhatsApp us',
    cta: 'Book a visit',
    image: 'photo-clinic-room',
    imageAlt: 'A calm consulting room with a sage-green wall, a desk and a treatment chair',
    pos: '50% 55%',
    video: null, // optional base path; site.js adds 720.mp4 or 1080.mp4
  },

  intro: {
    title: 'A neighbourhood clinic that explains first',
    text: 'For children, parents and grandparents, a short walk from Fergusson College.',
  },

  // Three photos edge to edge under the intro
  pillars: [
    { title: 'Everything explained', text: 'You see your X-rays and hear your options before anything is done.', image: 'photo-dentist-patient', imageAlt: 'A dentist adjusting the light over a patient in the chair', pos: '65% 40%' },
    { title: 'No unnecessary treatment', text: 'Only what your teeth need, with a written estimate first.', image: 'photo-older-man', imageAlt: 'A smiling older man in a white shirt, relaxed in a sunlit café', pos: '55% 35%' },
    { title: 'Evenings till 8 PM', text: 'Monday to Saturday, so a visit fits around work and school.', image: 'photo-family', imageAlt: 'A mother and her young daughter laughing together on a sofa', pos: '55% 50%' },
  ],

  clinic: {
    label: 'The clinic',
    text: 'Check-ups, fillings, root canals, implants and aligners, under one roof on FC Road.',
    link: 'Meet Dr. Mehta',
    image: 'photo-clinic-chairs',
    imageAlt: 'A bright treatment room with dental chairs and tall windows',
    pos: '50% 55%',
  },

  // Treatments grid on the homepage, in this order. Each also gets its own page.
  treatments: [
    {
      slug: 'check-ups-and-hygiene',
      cost: 'Sample: ₹800–1,500 for a check-up and clean.',
      name: 'Check-ups & cleaning',
      summary: 'Every six months, for the whole family.',
      image: 'photo-checkup-child',
      imageAlt: 'A dentist gently checking a young boy’s teeth in a bright clinic',
      pos: '50% 40%',
      intro: 'Most problems are quicker and kinder to treat when they are found early. A check-up and a gentle clean keep small things small.',
      steps: [
        ['Check-up', 'Teeth, gums and bite, with X-rays only when needed.'],
        ['Cleaning', 'Scaling and polishing for what brushing can’t reach.'],
        ['Advice', 'Simple home care, and any treatment explained first.'],
      ],
      faq: [
        ['How often should I come?', 'Every six months suits most people. We will tell you what suits you.'],
        ['Is it suitable for children?', 'Yes. Children’s visits are short, gentle and unhurried.'],
      ],
      planner: { days: 'One visit of about 45 minutes.' },
    },
    {
      slug: 'dental-implants',
      cost: 'Sample: from ₹30,000 per implant, crown included.',
      name: 'Dental implants',
      summary: 'A fixed tooth to replace a missing one.',
      image: 'photo-implant',
      imageAlt: 'A gloved hand holding a dental implant with its crown',
      pos: '50% 40%',
      intro: 'An implant is a small titanium post that replaces a missing tooth’s root. Once it has settled, a crown is fixed on top that looks and works like your own tooth.',
      steps: [
        ['Consultation', 'An examination and the scans needed to plan safely.'],
        ['Placement', 'The implant is placed under local anaesthetic.'],
        ['Healing', 'A few weeks for the bone to bond with the implant.'],
        ['Your new tooth', 'A crown matched to your smile, with your bite checked.'],
      ],
      faq: [
        ['Am I suitable?', 'It depends on your gums, bone and general health. A consultation tells us.'],
        ['How long does it take?', 'Usually a few months from placement to the final tooth.'],
      ],
      planner: { days: 'Sample: typically 2 visits, about 3–5 days each, a few months apart.' },
    },
    {
      slug: 'clear-aligners',
      cost: 'Sample: from ₹60,000 for a full course.',
      name: 'Clear aligners',
      summary: 'Straighter teeth without metal braces.',
      image: 'photo-smile-man',
      imageAlt: 'A young man with an easy, natural smile',
      pos: '50% 45%',
      intro: 'Clear aligners are thin, removable trays that move your teeth a little at a time. You see the planned result before you begin.',
      steps: [
        ['Assessment', 'We check whether aligners suit your teeth and bite.'],
        ['Your plan', 'A digital plan showing how your teeth will move.'],
        ['Wearing them', 'A new set every week or two, with short reviews.'],
        ['Keeping it', 'Retainers hold your teeth in their new place.'],
      ],
      faq: [
        ['How long will it take?', 'Often six to eighteen months. Your plan shows your timeline.'],
        ['Can I take them out?', 'Yes, to eat and to brush. They work best worn most of the day.'],
      ],
      planner: { days: 'Sample: 1 visit of about 2 days to start, then reviews by video.' },
    },
    {
      slug: 'smile-design-and-veneers',
      cost: 'Sample: from ₹8,000 per tooth.',
      name: 'Smile design & veneers',
      summary: 'Small changes to shape and shade, previewed first.',
      image: 'photo-smile-woman',
      imageAlt: 'A young woman smiling, her chin resting on her hands',
      pos: '50% 50%',
      intro: 'We plan shape and shade around your face, show you a preview, then choose the gentlest way there: whitening, bonding or thin veneers.',
      steps: [
        ['Conversation', 'What you would like to change, and what to keep.'],
        ['Preview', 'A mock-up of the new smile before any treatment.'],
        ['Treatment', 'Bonding or veneers made to the agreed design.'],
      ],
      faq: [
        ['Will it look natural?', 'That is the aim. Shade and shape are planned to suit your face.'],
        ['Do veneers harm teeth?', 'Thin veneers need very little preparation, sometimes none.'],
      ],
      planner: { days: 'Sample: typically 2 visits, about 7–10 days in all.' },
    },
    {
      slug: 'root-canal-treatment',
      cost: 'Sample: ₹4,000–8,000, plus a crown if needed.',
      name: 'Root canal treatment',
      summary: 'Ends the toothache and saves the tooth.',
      image: 'photo-treatment',
      imageAlt: 'A dentist in blue scrubs treating a patient reclining in the chair',
      pos: '68% 50%',
      intro: 'When the nerve inside a tooth is infected, root canal treatment cleans and seals it. It is done under local anaesthetic and feels much like a long filling.',
      steps: [
        ['Diagnosis', 'An examination and an X-ray to find the cause.'],
        ['Treatment', 'The canals are cleaned and sealed in one or two visits.'],
        ['Protection', 'A filling or crown to protect the tooth.'],
      ],
      faq: [
        ['Does it hurt?', 'It is done with local anaesthetic. Most people feel pressure, not pain.'],
        ['Will I need a crown?', 'Back teeth often do. We will tell you what yours needs.'],
      ],
      planner: { days: 'Sample: 1–2 visits over about 3 days.' },
    },
    {
      slug: 'crowns-and-bridges',
      cost: 'Sample: from ₹6,000 per crown.',
      name: 'Crowns & bridges',
      summary: 'Strength back for worn or broken teeth.',
      image: 'photo-model',
      imageAlt: 'A dentist explaining a restoration on a model of the teeth',
      pos: '45% 50%',
      intro: 'A crown covers and protects a weak tooth. A bridge replaces a missing tooth by joining the teeth on either side. Both are matched to your own teeth.',
      steps: [
        ['Preparation', 'The tooth is shaped and a precise scan is taken.'],
        ['Temporary', 'A temporary crown protects it while yours is made.'],
        ['Fitting', 'The final crown is fitted and your bite is checked.'],
      ],
      faq: [
        ['How long does a crown take?', 'Usually two visits, about a week apart.'],
        ['Crown, bridge or implant?', 'Each has its place. We explain the trade-offs for you.'],
      ],
      planner: { days: 'Sample: typically 2 visits, about 5–7 days apart.' },
    },
  ],

  firstVisit: {
    label: 'Your first visit',
    title: 'Nervous about the dentist?',
    text: 'Gentle care, every step explained, and you can ask to pause at any time.',
    steps: [
      { title: 'We listen', text: 'Ten minutes to hear what’s bothering you, before anyone looks in your mouth.', image: 'photo-consult-desk', imageAlt: 'A clinician seated at her desk in a bright consulting room', pos: '60% 50%' },
      { title: 'We show you', text: 'A gentle check-up, with X-rays only if needed. You see what we see.', image: 'photo-checkup-child', imageAlt: 'A dentist gently checking a young boy’s teeth in a bright clinic', pos: '50% 40%' },
      { title: 'You decide', text: 'Clear options and costs in writing. Nothing is booked until you’re ready.', image: 'photo-smile-woman', imageAlt: 'A young woman smiling, her chin resting on her hands', pos: '50% 50%' },
    ],
  },

  // One sample photo until the clinic supplies a real, consented before/after pair.
  beforeAfter: {
    title: 'Results that look natural',
    before: 'sample-ba-before',
    after: 'sample-ba-after',
    note: 'Sample: simulated whitening on a stock photo. Real, consented cases replace it at launch.',
  },

  // Sample cases (stock portraits). Set sample: false only for real, consented cases.
  // cat links a case to a treatment slug (filters and treatment pages).
  cases: [
    {
      name: 'Dental implants', cat: 'dental-implants', meta: 'Sample case · 3 visits · 4 months', sample: true, image: 'smile-2', face: null,
      concern: 'A missing back tooth made chewing on one side difficult.',
      plan: 'One implant, with a crown matched to the teeth beside it.',
      result: 'Comfortable chewing on both sides again.',
      note: 'The best implant is the one nobody notices.',
    },
    {
      name: 'Clear aligners', cat: 'clear-aligners', meta: 'Sample case · 8 visits · 9 months', sample: true, image: 'smile-3', face: null,
      concern: 'Crowded lower teeth that were hard to clean.',
      plan: 'Clear aligners, with short reviews every six weeks.',
      result: 'Straighter teeth and easier brushing, no braces.',
      note: 'A healthy bite matters as much as straight teeth.',
    },
  ],
  featuredCases: 2, // how many cases the homepage shows

  reviews: {
    title: 'What patients say',
    googleUrl: 'https://www.google.com/maps', // the clinic's Google reviews link
    sample: true,
    items: [
      { name: 'Priya', treatment: 'Root canal', text: 'They showed me the X-ray and explained it before doing anything. Painless.' },
      { name: 'Rahul', treatment: 'Check-up', text: 'An evening slot after work, on time, and no waiting.' },
      { name: 'Sneha', treatment: 'Clear aligners', text: 'Honest advice. They told me what I didn’t need, too.' },
      { name: 'Anil', treatment: 'Implant', text: 'Calm clinic, careful work. My new tooth feels like my own.' },
      { name: 'Meera', treatment: 'Children’s check-up', text: 'My son actually looks forward to his check-ups now.' },
      { name: 'Vikram', treatment: 'Crown', text: 'Clear estimate up front and no surprises on the bill.' },
    ],
    photos: [
      { image: 'photo-clinic-room', imageAlt: 'The consulting room with a sage-green wall', pos: '50% 50%' },
      { image: 'photo-video-call', imageAlt: 'A patient on a video consultation at home', pos: '70% 50%' },
    ],
  },

  // "Plan your visit": for patients coming from out of town. Per-treatment timings live on
  // each treatment (planner.days). Nothing is stored; the result opens WhatsApp.
  planner: {
    title: 'Plan your visit',
    intro: 'Coming from out of town? Three quick questions, and we’ll show how treatment could fit your trip.',
    city: 'Pune',
    unsure: 'We will suggest the right treatment and timeline after a short video call.',
    minDays: 1,
    maxDays: 30,
    startDays: 5,
    image: 'stock-arrival',
    imageAlt: 'A suitcase standing by a softly lit window',
    pos: '45% 50%',
    note: 'Sample timings. Your exact plan is confirmed after a consultation.',
  },

  book: {
    title: 'Book a visit',
    lede: 'Come to the clinic, or start with a video call from home.',
    inPerson: { label: 'At the clinic', title: 'In-person visit', text: 'A full check-up and a clear explanation of your options.', image: 'photo-clinic-chairs', imageAlt: 'A bright treatment room with dental chairs and tall windows', pos: '45% 50%', message: 'Hello Smile Dental Clinic, I’d like to book an in-person visit.' },
    virtual: { label: 'From home', title: 'Video consultation', text: 'Talk it through and share any X-rays before you travel.', image: 'photo-video-call', imageAlt: 'A woman on a video call at a table by a window', pos: '70% 50%', message: 'Hello Smile Dental Clinic, I’d like to book a video consultation.' },
  },

  // Riya, the AI receptionist. With a webhookUrl (n8n Chat Trigger) she answers live;
  // with webhookUrl empty she gives demo answers drawn from this config.
  riya: {
    enabled: true,
    name: 'Riya',
    webhookUrl: 'https://viraaj19.app.n8n.cloud/webhook/36a7ae43-365d-4cc8-b5bc-33d197384391/chat',
    welcome: 'Hello, I’m Riya. I can answer questions about the clinic or take an appointment request for you.',
    quick: ['Clinic timings', 'Treatments', 'Book a visit', 'Where are you?'],
    // Proactive bubble beside the launcher: once per session, after `delay` seconds or `scroll` % of the
    // page (whichever comes first), never if the chat was already opened. Chips open the chat and send
    // their text. Add ?riya=open to the URL in demo mode to open the chat straight away.
    bubble: { text: 'Hi! Looking for an appointment or have a question?', chips: ['Book a visit', 'Ask a question'], delay: 5, scroll: 30 },
    note: 'Riya can check availability and book your appointment instantly.', // small line under the chat input // shown once beside the launcher on desktop, after 6 seconds
    // Mascot colours: theme colour names (bg, ink, stone, accent) or any hex value.
    mascot: { circle: 'ink', body: 'bg', features: 'ink', cheeks: 'stone', headset: 'accent', showHeadset: true },
  },
};
