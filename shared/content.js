// Content — CONTRACT (owned by the content agent; keep the export shape stable).
//   PROFILE = { name, tagline, email, links: [{label, href}] }  (+ optional: headline, role, location)
//   PROJECTS = [{ id, name, kicker, title, impact, description, details[], tech[], image, demoUrl|null }]
//              (+ optional: year, role, imageNote)
//   image paths are relative to mockups/ (e.g. 'assets/screens/lenovo.jpg').
// Rewritten 2026-11-05 from the Oct 2026 resume draft, the Bullet Bank, 求职岗位地图 and the Asteria docs.
// Every number traces to a source listed in ../CONTENT-NOTES.md; do not add numbers without one.
export const PROFILE = {
  name: 'Austin Zheng',
  tagline: 'I design AI workflows where every answer is clear at a glance and traceable to its source, so people can check it, correct it, and keep thinking.',
  headline: 'Product lead for AI tools inside real workflows. I research the users, win the budget, ship it, and build the prototypes myself with AI agents.',
  role: 'AI Product · Enterprise Workflows · Human-in-the-loop · Yale SOM ’26',
  location: 'Boston, MA',
  email: 'aozuozheng@gmail.com',
  links: [
    { label: 'Resume', href: '#' }, // TODO: resume PDF URL
    { label: 'LinkedIn', href: 'https://www.linkedin.com/in/aozuozheng' },
    { label: 'GitHub', href: 'https://github.com/doriru89' },
  ],
};

export const PROJECTS = [
  // 2026-11-06 Austin: internal platform — figures deliberately blurred on the public site (exact numbers stay in the resume)
  { id: 'lenovo', name: 'Lenovo Seller Platform', kicker: 'Enterprise · internal B2B sales platform',
    title: 'One console for over a thousand B2B sellers, replacing a seven-tool hop',
    impact: 'Seven-figure roadmap funded · hundreds of sellers active monthly · GenAI pilot rated useful by most',
    description: "Product lead (no direct reports) for Lenovo's one-stop seller platform. Turned seller pain points into a multi-year roadmap, won seven-figure funding through months of VP and director workshops, and led a cross-functional Design/SWE/IT squad to ship it.",
    details: [
      'Built a seller council of 100+ that tested every release; weekly users nearly tripled in two months',
      'Started a GenAI sales assistant for purchase data and collateral; a VP approved global rollout after a short pilot',
      'Earlier: rescued a delayed ML prospecting tool; sellers credited it with eight-figure deal flow in its first quarter (Dream Team Award)',
    ],
    tech: ['Microsoft Dynamics', 'Qlik', 'GenAI · text-to-SQL', 'Jira'],
    year: '2022–2025', role: 'Product lead (official title: DT Business Process Design Sr. Specialist)',
    image: 'assets/screens/lenovo.jpg', imageNote: 'Schematic, not a screenshot: the platform is internal.',
    demoUrl: null },

  { id: 'carecost', name: 'CareCost', kicker: 'Healthcare price transparency',
    title: 'See what care costs before it costs you',
    impact: 'YHack 2026 1st place (Lava API track) · ~1 TB of price files → 2.07M comparable rates',
    description: 'A free price lookup for Boston care. Hospitals and insurers must publish their negotiated rates, but the files are huge and inconsistent; CareCost reconciles them into one comparable price, each rate traced to its public source.',
    details: [
      'Built the whole product with AI coding agents: 55 of 56 commits, FastAPI + React',
      'Deterministic ETL sets every price; AI only maps symptoms to billing codes, never a number',
      'Rebuilding it solo as a chat-first demo: describe a symptom, see the visit and test prices',
    ],
    tech: ['Python', 'FastAPI', 'React', 'PostgreSQL'],
    year: '2026', role: 'Co-founder & product engineer',
    image: 'assets/screens/carecost.jpg', demoUrl: 'https://github.com/doriru89/Carecost' },

  { id: 'asteria', name: 'Asteria', kicker: 'Personal AI workbench',
    title: 'An operating system where agents do the volume and I sign the decisions',
    impact: '135 skills · 37 subagent roles · 2,100+ commits since March 2026',
    description: 'My own agent workbench on Claude Code: a thin harness (hooks, skills, a browser) over one git folder of plain files, designed around the questions companies now face with agents: what an agent may do alone, what needs human sign-off, and how mistakes become checks.',
    details: [
      'Tiered memory: persistent writes are proposals a human approves',
      'Every repeated failure becomes an errata entry and a write-time check (70+ so far)',
      'Draws one thing for itself: the Chronicle, where every session is a quest (next card)',
    ],
    tech: ['Claude Code', 'Python', 'MCP', 'SQLite FTS5 + vectors'],
    year: '2026', role: 'Designer & sole builder',
    image: 'assets/screens/asteria.jpg', imageNote: 'Schematic of the loop; counts read from the repository.',
    demoUrl: 'https://doriru89.github.io/asteria/demo.html' },   // 2026-11-06: public shell repo github.com/doriru89/asteria; reframed as harness + Chronicle the same night the Chronicle page shipped

  // 2026-11-06 Austin: the Chronicle is its own card, set apart from Asteria, because it is the visual for AI coding sessions. Copy from asteria/README.md and chronicle.html (fictional data on the public page).
  { id: 'chronicle', name: 'Chronicle', kicker: "Asteria's visual layer · every AI coding session as a quest",
    title: 'A scroll where every coding session is a quest, and side quests branch off and merge back',
    impact: 'One star per session, sized by prompts · questlines as lanes · influence edges between sessions · growth replay',
    description: 'The one thing Asteria draws for itself. Each session (Claude Code, Codex) leaves a card and a ledger line; the Chronicle reads only those files and draws them as a scroll: main quests as lanes, merges as rings, four kinds of influence between sessions, and a Quest Log that keeps what happened apart from a rolling-wave future.',
    details: [
      'Any document leads back to the conversation that made it: cards, briefs and the ledger are plain files appended by hooks',
      'Side quests have a lifecycle (proposed → live → merged / closed) and carry a context capsule into the new session',
      'One HTML file, no build step; the public page runs on fictional data',
    ],
    tech: ['Vanilla JS', 'SVG + canvas', 'JSONL ledger', 'Claude Code hooks'],
    year: '2026', role: 'Designer & sole builder',
    image: 'assets/screens/chronicle.jpg', imageNote: 'Screenshot of the public page (fictional data).',
    demoUrl: 'https://doriru89.github.io/asteria/chronicle.html' },

  // 2026-11-06: fifth card — the purchase-decision skill, public at github.com/doriru89/shop-skill (Austin named it WiseShopper; the command stays /shop)
  { id: 'shop', name: 'WiseShopper', kicker: 'Open-source Claude Code skill · maps the whole market before it picks',
    title: 'A buying assistant that maps the whole market before it forms an opinion',
    impact: 'Four steps, a human decision between each · every claim carries a source · 14 revisions against real purchases',
    description: 'A purchase-decision skill for Claude Code. It breaks the frame of the question, censuses the market with counted gates (brands, products, sources), reveals what the buyer actually values through forced tradeoffs, and says what it could not verify. Finds your best product, not the best product.',
    details: [
      'Gates are mechanical: brands ≥ 8, products ≥ 20, ≥ 2 independent sources per shortlisted product, ≥ 2 named blind spots',
      'Evidence and decision never share a turn: the evidence is rendered first, the decision asked next',
      'Interactive demo: a market map (price × yearly effort) that narrows with every answer until one sweet spot is left; flip the "thin census" switch to watch a gate fail',
    ],
    tech: ['Claude Code', 'Markdown skills', 'WebSearch + Playwright MCP'],
    year: '2026', role: 'Designer & sole builder',
    image: 'assets/screens/shop.jpg', imageNote: 'Screenshot of the public demo.',
    demoUrl: 'https://doriru89.github.io/wiseshopper/demo/shop-workflow.html' },   // 2026-11-06: repo renamed doriru89/wiseshopper, Pages enabled; the pill opens the interactive demo, the README is one click from there

  // 2026-11-06: sixth card — Ride Compare, public at github.com/doriru89/ride-compare (Android utility Austin built with an AI assistant on his phone; numbers from the repo's README/VALIDATION.md and the LinkedIn draft)
  { id: 'ridecompare', name: 'Ride Compare', kicker: 'Android utility · built by chatting with an AI on the phone itself',
    title: 'Pick a destination once; Uber and Lyft open side by side with the same route',
    impact: 'First working APK after about ten minutes of chat · 76 deterministic checks · no backend, SDK or account',
    description: 'A small Android app for my foldable. Share a place from Google Maps, keep the current location or choose a pickup, and both ride apps open in split screen with the same coordinates. Prices and booking stay in their apps; this only removes the repeated typing.',
    details: [
      'Dependency-light build: Java sources, the Android SDK command-line tools and a 50-line shell script, no Gradle',
      'The hard parts were the edges: Maps short links that 404 at random, GPS callbacks overwriting a manual pickup, a keyboard that hides the save button on a folding screen',
      'Ships with a privacy note, a validation log and an honest list of what has not been checked on a device yet',
    ],
    tech: ['Java', 'Android 12L+', 'Android intents · split screen', 'Shell'],
    year: '2026', role: 'Maker (prototype)',
    image: 'assets/screens/ridecompare.jpg', imageNote: 'Schematic, not a screenshot: prices are shown by the ride apps themselves.',
    demoUrl: 'https://github.com/doriru89/ride-compare' },

  { id: 'artopath', name: 'Artopath', kicker: 'Personal media library',
    title: 'Every film linked to the people behind it and the places it was made',
    impact: 'Featured in Poets&Quants · Yale Tsai CITY Launchpad',
    description: 'A media library for films and books that maps creators, influences and real-world locations. Facts come from a TMDb + Wikidata database; AI only fills gaps, and every AI claim is labeled by source and confidence.',
    details: [
      'Rebuilt on a database after AI-inferred links proved unreliable',
      'Red-teamed its own API: added a prompt guard with 35 tests across six LLM-calling files',
      'MCP server so outside AI agents can search it',
    ],
    tech: ['Django', 'PostgreSQL', 'TMDb + Wikidata', 'Mapbox'],
    year: '2025–', role: 'Creator & product engineer',
    image: 'assets/screens/artopath.jpg', demoUrl: null },
];
