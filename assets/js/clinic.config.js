/* ==========================================================================
   CLINIC CONFIG: the one file to edit for a new prospect.

   tools/build.py writes every page from it (names, copy, colours, fonts,
   treatments, cases, reviews, contact details, SEO tags):
       .venv/Scripts/python -I tools/build.py
   The browser reads it too, for the open-now status, the planner, the case
   view, demo mode and Riya. So: edit, rebuild, done.

   Plain data only: strings, numbers, true/false, null, lists and objects.
   Images are base names of files in assets/img (e.g. 'photo-talk' means
   assets/img/photo-talk-{640,1280,1920}.{avif,webp,jpg}); new photos go
   through tools/images.py. "pos" is the focal point (object-position).
   ========================================================================== */
window.CLINIC = {
  // Demo mode: call and WhatsApp links show a short note instead of opening anything,
  // and the footer says the clinic is fictional. Set false for a real clinic.
  demo: true,

  site: {
    url: 'https://example.com/', // canonical address, with trailing slash
    lang: 'en-IN',
    locale: 'en_IN',
    noindex: true, // keep out of search engines (also robots.txt) until launch
    year: 2026,
    credit: 'Demo prepared by Viraaj',
  },

  name: 'Smile Dental Clinic',
  wordmark: 'Smile Dental Clinic', // text logo in the heading font (header and footer)
  tagline: 'Calm, careful dentistry in Shivajinagar.',
  description: 'A calm, modern dental clinic on FC Road, Shivajinagar, Pune. Check-ups, implants, aligners, smile design and root canal treatment, explained clearly and done at your pace.',

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
      heading: { family: 'Fraunces', file: 'fraunces.woff2', weight: '300 450', fallback: 'Georgia', use: 340 },
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
    mapQuery: 'FC Road, Shivajinagar, Pune', // what Google Maps searches for
    access: 'Ground floor · Step-free entrance · Street parking nearby',
  },

  hours: {
    timeZone: 'Asia/Kolkata',
    // 0 = Sunday ... 6 = Saturday; null = closed. 24-hour times.
    days: [null, ['10:00', '20:00'], ['10:00', '20:00'], ['10:00', '20:00'], ['10:00', '20:00'], ['10:00', '20:00'], ['10:00', '20:00']],
    summary: ['Monday to Saturday, 10 AM to 8 PM', 'Sunday closed'],
  },

  doctors: [
    {
      name: 'Dr. Mehta',
      role: 'Lead dentist',
      credentials: 'BDS, MDS (Prosthodontics) · Sample profile',
      quote: 'Good dentistry should feel unhurried. I would rather explain twice than rush once.',
      bio: 'Dr. Mehta plans every treatment around the person in the chair: their bite, their face and how much time they want to spend with us.',
      image: 'photo-mirror-tool',
      imageAlt: 'A dental mirror and explorer resting in soft light',
      pos: '40% 50%',
    },
  ],

  hero: {
    label: 'Dental clinic · Shivajinagar, Pune',
    lines: ['Calm, careful', 'dentistry, close', 'to home.'], // each line reveals from its own mask
    lede: 'Check-ups to complete smiles, explained clearly and done at your pace.',
    cta: 'Book a visit',
    image: 'photo-interior',
    imageAlt: 'A bright treatment room with a white dental chair and a wooden floor',
    pos: '55% 50%',
    video: null, // optional base path, e.g. 'assets/video/hero-' + 720/1080 + '.mp4'
  },

  intro: {
    label: 'The clinic',
    text: 'A neighbourhood clinic for precise, unhurried dentistry. We listen first, explain everything, and never recommend treatment you do not need.',
    link: 'Meet Dr. Mehta',
    image: 'photo-waiting-reader',
    imageAlt: 'A patient reading in a quiet, light-filled waiting area',
    pos: '50% 60%',
  },

  // Order here is the order of the treatments index (01, 02, ...). Each gets its own page.
  treatments: [
    {
      slug: 'check-ups-and-hygiene',
      name: 'Check-ups & hygiene',
      short: 'Six-monthly care',
      summary: 'A thorough examination and a gentle clean, so small problems stay small.',
      image: 'photo-toothbrushes',
      imageAlt: 'Bamboo toothbrushes in a glass jar beside eucalyptus leaves',
      pos: '35% 50%',
      intro: 'Most dental problems are easier, quicker and kinder to treat when they are found early. A regular check-up gives us time to notice the small things and to keep your gums healthy.',
      steps: [
        ['Examination', 'Teeth, gums, bite and soft tissues, with X-rays only when they are needed.'],
        ['Professional clean', 'Scaling and polishing to remove what brushing cannot reach.'],
        ['Your next steps', 'Clear advice for home care, and any treatment explained before it is booked.'],
      ],
      faq: [
        ['How often should I come?', 'Most people do well with a visit every six months. We will suggest what suits your teeth and gums.'],
        ['Does a clean hurt?', 'For most people it feels like pressure and vibration, not pain. Tell us if anything is sensitive and we will adjust.'],
      ],
      planner: { days: 'A single visit of about an hour.' },
    },
    {
      slug: 'dental-implants',
      name: 'Dental implants',
      short: 'Replacing missing teeth',
      summary: 'A fixed replacement for a missing tooth, planned around the tooth you will see.',
      image: 'photo-implant',
      imageAlt: 'A gloved hand holding a dental implant with its crown',
      pos: '50% 40%',
      intro: 'An implant is a small titanium post that takes the place of a missing tooth’s root. Once it has settled into the jaw, a crown, bridge or denture is fixed on top. We plan the visible tooth first, then place the implant to support it.',
      steps: [
        ['Consultation', 'An examination, the scans needed to plan safely, and a clear explanation of your options.'],
        ['Placement', 'The implant is placed under local anaesthetic, at a pace that keeps you comfortable.'],
        ['Healing', 'The bone bonds with the implant over the following weeks. We review how it is settling.'],
        ['Your new tooth', 'A crown made to match your smile, fitted with your bite checked carefully.'],
      ],
      faq: [
        ['Am I suitable for implants?', 'It depends on your gums, your bone and your general health. A consultation is the only way to know.'],
        ['How long does it take?', 'Usually a few months from placement to the final tooth, with healing time in between. You will get a personal timeline.'],
        ['How long do implants last?', 'With good home care and regular reviews, implants can last for many years.'],
      ],
      planner: { days: 'Sample: typically 2 visits, about 3–5 days each, a few months apart.' },
    },
    {
      slug: 'clear-aligners',
      name: 'Clear aligners',
      short: 'Straightening, discreetly',
      summary: 'Nearly invisible trays that move teeth gradually, without fixed braces.',
      image: 'photo-aligner',
      imageAlt: 'A woman fitting a clear aligner over her upper teeth',
      pos: '50% 40%',
      intro: 'Clear aligners are thin, removable trays, each one moving your teeth a little further. Treatment is planned digitally, so you can see the expected result before you begin.',
      steps: [
        ['Assessment', 'We check whether aligners suit your teeth and bite, and take a digital scan.'],
        ['Your plan', 'A step-by-step digital plan showing how your teeth will move.'],
        ['Wearing aligners', 'A new set every week or two, with short reviews along the way.'],
        ['Keeping it', 'Retainers keep your teeth in their new position.'],
      ],
      faq: [
        ['How long will I wear them?', 'Many cases take six to eighteen months. Your plan will show your own timeline.'],
        ['Can I take them out?', 'Yes, to eat, drink anything other than water, and clean your teeth. They work best worn about 22 hours a day.'],
      ],
      planner: { days: 'Sample: 1 visit of about 2 days to start, then remote reviews.' },
    },
    {
      slug: 'smile-design-and-veneers',
      name: 'Smile design & veneers',
      short: 'Shape, shade and balance',
      summary: 'Small, considered changes to shape and shade, previewed before anything is done.',
      image: 'stock-natural-smile',
      imageAlt: 'Close-up of a natural smile',
      pos: '50% 40%',
      intro: 'Smile design starts with your face, not your teeth. We plan proportions and shade together, preview the result with you, and then choose the gentlest way to get there: whitening, bonding or thin porcelain veneers.',
      steps: [
        ['Conversation', 'What you would like to change, and what you would like to keep.'],
        ['Preview', 'A mock-up of the planned smile, so you can see it before any treatment.'],
        ['Treatment', 'Veneers or bonding made to the agreed design, fitted over one or two visits.'],
      ],
      faq: [
        ['Will it look natural?', 'That is the aim. We plan shade and shape to suit your face, never a single template.'],
        ['Do veneers damage teeth?', 'Thin veneers need very little preparation, and sometimes none. We will explain exactly what is involved for you.'],
      ],
      planner: { days: 'Sample: typically 2 visits, about 7–10 days in all.' },
    },
    {
      slug: 'root-canal-treatment',
      name: 'Root canal treatment',
      short: 'Saving a painful tooth',
      summary: 'Relief from toothache, and a way to keep a tooth that might otherwise be lost.',
      image: 'photo-instruments',
      imageAlt: 'A gloved hand holding a set of dental examination instruments',
      pos: '50% 35%',
      intro: 'When the nerve inside a tooth is inflamed or infected, root canal treatment removes it, cleans the canals and seals the tooth. It is done under local anaesthetic and is usually far more comfortable than people expect.',
      steps: [
        ['Diagnosis', 'An examination and an X-ray to confirm the cause of the pain.'],
        ['Treatment', 'The canals are cleaned and sealed, in one or two visits.'],
        ['Protection', 'A filling or crown to protect the tooth for the long term.'],
      ],
      faq: [
        ['Is it painful?', 'The treatment itself is done with local anaesthetic. Most people say it feels like a long filling.'],
        ['Will I need a crown?', 'Back teeth often do, to protect them from cracking. We will tell you what your tooth needs.'],
      ],
      planner: { days: 'Sample: 1–2 visits over about 3 days.' },
    },
    {
      slug: 'crowns-and-bridges',
      name: 'Crowns & bridges',
      short: 'Restoring strength',
      summary: 'Strong, natural-looking restorations for worn, broken or missing teeth.',
      image: 'photo-model',
      imageAlt: 'A dentist explaining a restoration on a model of the teeth',
      pos: '45% 50%',
      intro: 'A crown covers and protects a weakened tooth; a bridge replaces a missing tooth by joining to the teeth either side. Both are made to match the shade and shape of your own teeth.',
      steps: [
        ['Preparation', 'The tooth is shaped and a precise impression or scan is taken.'],
        ['Temporary', 'A temporary crown protects the tooth while yours is made.'],
        ['Fitting', 'The final crown or bridge is fitted and your bite is checked.'],
      ],
      faq: [
        ['How long does a crown take?', 'Usually two visits, about a week apart.'],
        ['Crown, bridge or implant?', 'Each has its place. We will explain the trade-offs for your situation.'],
      ],
      planner: { days: 'Sample: typically 2 visits, about 5–7 days apart.' },
    },
  ],

  firstVisit: {
    label: 'Your first visit',
    title: 'What to expect, step by step',
    steps: [
      { title: 'We listen', text: 'Fifteen unhurried minutes to talk about what brings you in, what worries you and what you would like.', image: 'photo-talk', imageAlt: 'A dentist and a patient talking, both seated, in a treatment room', pos: '55% 50%' },
      { title: 'We look, and explain', text: 'A careful examination, with X-rays only if they are needed. Everything we see is shown and explained on screen.', image: 'photo-screen', imageAlt: 'A dentist showing a patient an X-ray on a screen', pos: '60% 40%' },
      { title: 'You decide', text: 'You leave with clear options, honest costs and time to think. Nothing is booked until you are ready.', image: 'photo-mirror-smile', imageAlt: 'A smiling patient looking at her reflection in a hand mirror', pos: '50% 35%' },
    ],
  },

  beforeAfter: {
    title: 'See the difference',
    text: 'Drag to compare.',
    before: 'sample-ba-before',
    after: 'sample-ba-after',
    note: 'Sample · simulated whitening on a stock photo, for demonstration only',
  },

  // Sample cases (stock photos). Set sample: false only for real, consented cases.
  // cat links a case to a treatment slug (filters and treatment pages).
  cases: [
    {
      name: 'Dental implants', cat: 'dental-implants', meta: 'Sample case · 3 visits · 4 months', sample: true, image: 'stock-case-1', face: 'stock-case-1-face',
      concern: 'A missing tooth had made eating on one side uncomfortable.',
      plan: 'A single implant, with a crown designed to match the neighbouring teeth.',
      result: 'A tooth that looks, feels and works like the patient’s own.',
      note: 'The aim is a tooth nobody notices, including the patient.',
    },
    {
      name: 'Smile design & veneers', cat: 'smile-design-and-veneers', meta: 'Sample case · 3 visits · 3 weeks', sample: true, image: 'stock-case-2', face: 'stock-case-2-face',
      concern: 'Uneven, worn front teeth the patient had become self-conscious about.',
      plan: 'A smile designed around the face and previewed first, then thin porcelain veneers.',
      result: 'A brighter, balanced smile that still looks entirely natural.',
      note: 'Less is usually more. The best veneers look like the patient on a good day.',
    },
    {
      name: 'Clear aligners', cat: 'clear-aligners', meta: 'Sample case · 8 visits · 9 months', sample: true, image: 'stock-case-4', face: 'stock-case-4-face',
      concern: 'Crowded lower teeth that were difficult to keep clean.',
      plan: 'Clear aligners planned digitally, with short reviews along the way.',
      result: 'Straighter teeth and easier daily care, without fixed braces.',
      note: 'Straight teeth matter, but a healthy, even bite matters more.',
    },
    {
      name: 'Crowns & bridges', cat: 'crowns-and-bridges', meta: 'Sample case · 2 visits · 2 weeks', sample: true, image: 'stock-case-3', face: null,
      concern: 'Worn back teeth were making chewing uncomfortable.',
      plan: 'Two ceramic crowns, with the bite rebalanced at the same time.',
      result: 'Comfortable chewing and teeth protected for the long term.',
      note: 'We restore the bite first; appearance follows from it.',
    },
    {
      name: 'Dental implants', cat: 'dental-implants', meta: 'Sample case · 4 visits · 5 months', sample: true, image: 'stock-case-5', face: null,
      concern: 'A front tooth that could not be saved after an old injury.',
      plan: 'The extraction and the implant planned together, with a temporary tooth in between.',
      result: 'A front tooth that matches its neighbours in shape and shade.',
      note: 'Front teeth are judged in millimetres. Planning is everything.',
    },
    {
      name: 'Smile design & veneers', cat: 'smile-design-and-veneers', meta: 'Sample case · 2 visits · 2 weeks', sample: true, image: 'stock-case-6', face: 'stock-case-6-face',
      concern: 'Small gaps and chipped edges on the front teeth.',
      plan: 'Composite bonding to close the gaps and repair the edges, without drilling.',
      result: 'An even smile line, finished in two short visits.',
      note: 'The gentlest option that achieves the result is usually the right one.',
    },
  ],
  featuredCases: 3, // how many cases the homepage shows

  reviews: {
    label: 'Sample reviews',
    items: [
      { quote: 'They explained every step before starting. I have never felt so calm in a dentist’s chair.', source: 'Sample review' },
      { quote: 'Gentle, precise and on time. The clinic is quiet and spotless.', source: 'Sample review' },
      { quote: 'No pressure, no upselling. Just clear advice and very good work.', source: 'Sample review' },
    ],
  },

  // "Plan your visit": for patients coming from out of town. Per-treatment timings live on
  // each treatment (planner.days). Nothing is stored; the result opens WhatsApp.
  planner: {
    title: 'Plan your visit',
    intro: 'Coming from out of town? Three quick questions, and we will show how treatment could fit around your trip.',
    city: 'Pune',
    unsure: 'We will recommend the right treatment and timeline after a short video consultation.',
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
    lede: 'Choose a visit to the clinic, or a video consultation from wherever you are.',
    inPerson: { label: 'At the clinic', title: 'In-person visit', text: 'A full examination and a clear explanation of your options, with time for every question.', image: 'photo-interior', imageAlt: 'A bright treatment room with a white dental chair', pos: '55% 50%', message: 'Hello Smile Dental Clinic, I’d like to book an in-person visit.' },
    virtual: { label: 'From anywhere', title: 'Video consultation', text: 'Talk through your concerns, share any X-rays you already have, and plan treatment before you travel.', image: 'stock-virtual-call', imageAlt: 'A man talking to a clinician on a video call from home', pos: '40% 50%', message: 'Hello Smile Dental Clinic, I’d like to book a video consultation.' },
  },

  // Riya, the AI receptionist. With a webhookUrl (n8n Chat Trigger) she answers live;
  // with webhookUrl empty she gives demo answers drawn from this config.
  riya: {
    enabled: true,
    name: 'Riya',
    webhookUrl: '',
    welcome: 'Hello, I’m Riya. I can answer questions about the clinic or take an appointment request for you.',
    quick: ['Clinic timings', 'Where are you?', 'Treatments', 'Book a visit'],
  },
};
