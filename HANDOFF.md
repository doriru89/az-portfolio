# Handoff — az-portfolio

Austin Zheng's portfolio for recruiters. Live at https://doriru89.github.io/az-portfolio/ (GitHub Pages, `main`, repo root).
**This repository is the source of truth since 2026-11-06.** Earlier it was a mirror of a folder in Austin's private workspace; that folder now only holds a pointer back here plus the variant openings that were not chosen.

Read this file, then `DEV.md` (how to run and verify) and `CONTENT.md` (where each card's facts come from, what may not be published).

## What the page is

One scroll, three scenes:

1. **Opening "BC"**: the shared intro (glitch, colour bars), then the bear rises as ASCII that resolves into pixels and into the 3D head, the name drops in. The project icons and their labels resolve with it (finer ASCII grid, then the same pixel stages). ≈2.8 s. `?skip=1` skips it.
2. **Hero**: the name, a tagline, a low-poly bear head peeking from the bottom edge with three riders (rabbit centre, two cats on the slope), a sparse line-icon wallpaper with one coloured, labelled icon per project, and a pixel "SCROLL" plate.
3. **Profile Box**: on the first scroll the bear flies to a porthole top-left and the page lands on a hand-cranked split-flap box ("AZ PROFILE BOX") that turns one card per scroll: leader, then per project a chapter card and a screenshot page, then "fin.". Footer: "Let's build something together." with Resume / LinkedIn / GitHub buttons.

## Files

| File | Role |
|---|---|
| `index.html` | shell: opening loader + `ctx` contract, hero, the ONE WebGL canvas, scroll choreography (dock on first scroll, auto-advance to the box), icon field mount (before the opening, which reads the hot icons' rects), projector mount (after the opening), footer |
| `shared/content.js` | all copy: `PROFILE`, `PROJECTS[]` (id, name, kicker, title, impact, description, details, tech, image, demoUrl) |
| `shared/intro.js` | shared intro, `INTRO_END = 0.68` |
| `openings/bc.js` | the chosen opening (`?bct=<s>` freezes a frame) |
| `shared/bear.js` | bear + riders; flat-shaded, inverted-hull outline, riders seated by raycast on the skull |
| `shared/shell-dock.js` | hero framing via `camera.setViewOffset` and the flight to the porthole; `HERO_SCALE` sets the head width (62 % desktop / 96 % phone × 1.3) |
| `shared/shell-icons.js` | wallpaper + project hot icons (`HOT` table: icon, x, y, optional phone x, y) |
| `shared/projector.js` | the Profile Box (own renderer, sticky track); cards are canvas textures (`CARD_ASPECT = 0.78`) |
| `shared/shell.css` | everything else; pixel UI tokens (ink plate, peach border, Press Start 2P, `* ` bullet) |
| `assets/screens/*.jpg` | one image per project; `src/` holds the HTML the schematics are rendered from |
| `tools/verify.py` | headless screenshots + error check at desktop and phone sizes |
| `tools/render-schematic.py` | renders `assets/screens/src/<name>.html` to `assets/screens/<name>.jpg` |

## Decisions Austin made (do not relitigate)

- Opening **BC** (ASCII → pixels → bear). Project icons + labels go ASCII → pixels → clear with the bear (2026-11-08); the hero's final look is unchanged. AB / C / D / ABC variants were compared and dropped; they stay in his private workspace only.
- Bear hero with riders; no bear eyes; symmetric nose; riders still once docked. Head size: `HERO_SCALE 1.3`; porthole `--dock: 126px` (phone 75px).
- Hero camera `(0, 2.9, 8.5)` looking at `(0, 1.9, 0)`: further back for a rounder dome; the head's on-screen width is fixed by `relayout()`, so camera distance does not change size.
- Scroll plate centred, `bottom: 6vh`, pixel chevrons; touch devices show "SWIPE UP" with chevrons flipped.
- Project icons always carry their name in an Undertale-style box; positions: CareCost top-left, Chronicle left-middle (desktop only: on phones the six slots beside the name are full, phone x `false` in `HOT`), Lenovo top-right, WiseShopper top-centre (phone, and desktop screens too short for it above the name such as 1280×720: under the tagline, centred), Asteria lower-left, Artopath lower-right, Ride Compare right-middle (phone: top band).
- Chronicle is its own card right after Asteria (2026-11-06): it is the visual for AI coding sessions and Austin wants it told apart from the workbench. Asteria's card points to it.
- **No calling card** next to the porthole (name + email was removed 2026-11-06); contact lives in the nav's Email link and the footer.
- Profile Box: 5° turn, crank side forward; box fills 88 % of the view height on ≥ 835 px views, easing to 78 % on short views so the crank hint clears the rail; card is 0.78 tall (was 4:3) to fill the window; "Project", never "Reel"; leader reads "<n> PROJECTS · <m> FRAMES"; no "PLAYER 2" wording anywhere (this is for HR).
- Footer: title "Let's build something together.", lead "AI in the work, people in the pilot seat." (his own phrasing of "keep the human in the pilot seat"; the words "human spark" are jargon to HR and are not used).
- Nav: AUSTIN · Projects · Email (mailto) · Resume ↗.

## Bugs found and their causes (so they are not re-found)

- **Bear off-centre / phone opening "snapped" at the end**: `#bear-canvas` had no CSS size, so on any devicePixelRatio > 1 it took its drawing-buffer size (2× the viewport). Fix: explicit `width:100%; height:100%`. Measured at 11 sizes afterwards: bear centre within 0–15 px of the name.
- **Reload landed on the Profile Box**: Chrome restored the old scroll position under the opening. `history.scrollRestoration = 'manual'` must run in an inline `<head>` script (a module script is too late), plus `scrollTo(0,0)` after the opening.
- **Opening "stall"**: not dropped frames (measured); the bear's rise parked ~0.6 s before the pixel stage. Fixed by compressing the timeline, a quadratic rise, glyph shimmer, a warm-up render, and mounting the projector after the opening (its init cost ~80 ms on the main thread).
- **Crank hint showing through the OPEN DEMO pill**: the hint's blink animation overrides inline opacity; it is hidden with `visibility` instead.
- **Dark wedge beside the mouth**: muzzle sphere facets; 16×8 with `phiStart π/16`.
- `bounds()` in shell-dock resets idle yaw before measuring, otherwise relayout drifted 1–2 px.

## Known, not fixed

- Windows classic scrollbars make `innerWidth` 17 px wider than the viewport (bear ~8 px right of the name). Not reproducible headless.
- Idle yaw + mouse at a screen edge: the head looks turned the instant the opening ends.
- Projector caption (DOM, below the box on phones) runs one card ahead of the flip.
- Phone: empty space below the box stage.

## Open

- Resume link is `#` in `content.js` (needs a PDF URL, or hide the link).
- CareCost demo is the GitHub repo; a hosted demo would be better.
- Artopath has no public link (repo private).
