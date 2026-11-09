# Content notes

All copy lives in `shared/content.js`. This file records where it comes from and what the rules are.

## Positioning

Tagline: **"I design AI that sharpens people’s judgment."** Leader card (Profile Box, first card; `PROFILE.headline` then `PROFILE.lead`): **"I use AI to make work a little more fun, more accessible, and more human."** / "AI takes the repetitive work; people stay in the pilot seat." / "I make information clear at a glance and traceable to its source, so people can check it, correct it, and keep thinking." (Austin, 2026-11-09; the lever under the evidence: Sales Buddy's plain-language reasons, Artopath's source labels, CareCost's sourced prices.) The enterprise evidence is Lenovo (research → budget → launch → adoption); the personal evidence is CareCost, Artopath, WiseShopper and Ride Compare (built end to end with AI tooling); Asteria is the agent-governance story (what runs alone, what needs a human signature).

## Cards, in order

| Card | Kind of evidence | Image | Link | Upstream repo · licence |
|---|---|---|---|---|
| Lenovo Seller Platform | employer work, internal platform | schematic (`src/lenovo.html`) | none, on purpose | — |
| CareCost | hackathon win, public repo | real screenshot (no patient or doctor names) | GitHub repo | `doriru89/Carecost` · no licence file |
| Asteria | personal agent workbench (harness on Claude Code) | schematic (`src/asteria.html`) | public shell + demo at doriru89.github.io/asteria | `doriru89/asteria` · MIT |
| Chronicle | Asteria's visual layer: every AI coding session as a quest; its own card on purpose (Austin, 2026-11-06) | screenshot of the public page (fictional data) | doriru89.github.io/asteria/chronicle.html | `doriru89/asteria` · MIT |
| WiseShopper | open-source Claude Code skill (`/shop`) | screenshot of the public demo | live demo at doriru89.github.io/wiseshopper/demo/shop-workflow.html (Pages enabled 2026-11-06) | `doriru89/wiseshopper` (was `shop-skill`; GitHub redirects) · MIT |
| Ride Compare | Android utility, public repo | schematic (`src/ridecompare.html`) | GitHub repo | `doriru89/ride-compare` · MIT |
| Artopath | personal media library | real screenshot | none (repo private) | private |

## When an upstream repo changes

The cards are copies, not views: nothing updates them. After a push to `asteria`, `shop-skill` or `ride-compare`, check the card's

- **framing words** against the repo's README first paragraph (Asteria drifted from "operating system" to "harness + Chronicle" within one evening);
- **screenshot** if the demo page changed (`tools/render-schematic.py` for drawings; a 1600×1000 headless screenshot for live pages);
- **counts** read from the repo, never from memory;
- **demoUrl** still answers 200 (`tools/verify.py` checks this).

## Rules

- **No invented metrics.** Every number on a card was read from a source Austin can show (a repository, a published result, a resume line). If it cannot be sourced, it is not on the card.
- **Lenovo figures are blurred on purpose** (seven-figure, hundreds, ~3×, "most"): the platform is internal. The exact numbers stay in Austin's resume and are not to be restored here, in the copy or in the schematic.
- Asteria counts (skills, agents, commits, errata, golden-set size) were read from the repository when the card was written; refresh them from the repository, not from memory.
- Ride Compare's "about ten minutes" is self-reported and the card says so by phrasing ("after about ten minutes of chat").
- Schematics carry the word "schematic" or "diagram" on the image and `imageNote` says so.
- Role lines say what the work was, not a title inflated for effect.

## Open

- Resume link (`PROFILE.links`) is still `#`: needs a PDF URL.
- CareCost: a hosted demo would beat the repo link.
