# Content notes

All copy lives in `shared/content.js`. This file records where it comes from and what the rules are.

## Positioning

Tagline: **"I put AI into the work people already do."** The enterprise evidence is Lenovo (research → budget → launch → adoption); the personal evidence is CareCost, Artopath, WiseShopper and Ride Compare (built end to end with AI tooling); Asteria is the agent-governance story (what runs alone, what needs a human signature).

## Cards, in order

| Card | Kind of evidence | Image | Link |
|---|---|---|---|
| Lenovo Seller Platform | employer work, internal platform | schematic (`src/lenovo.html`) | none, on purpose |
| CareCost | hackathon win, public repo | real screenshot (no patient or doctor names) | GitHub repo |
| Asteria | personal agent workbench | schematic (`src/asteria.html`) | public shell + demo at doriru89.github.io/asteria |
| WiseShopper | open-source Claude Code skill (`/shop`) | screenshot of the public demo | GitHub repo |
| Ride Compare | Android utility, public repo | schematic (`src/ridecompare.html`) | GitHub repo |
| Artopath | personal media library | real screenshot | none (repo private) |

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
