# Developing

Static site, no build. ES modules + an importmap (three.js 0.170 from jsdelivr, GSAP 3.13 + ScrollTrigger), so it must be served over http, never opened as `file://`.

## Run

```bash
python3 -m http.server 8777
```

Then open http://localhost:8777/ . Useful URLs:

| URL | What |
|---|---|
| `/?skip=1` | hero straight away, no opening |
| `/?o=bc` | the opening explicitly (it is the default) |
| `/?o=bc&bct=1.3` | freeze the opening at 1.3 s |
| `/?hc=2.9,8.5,1.9` | debug hero camera: y, z, look-at y |

`window.__openingDone` turns true when the hero is live; `window.__shell` exposes the dock and the opening context for automation.

## Verify before pushing

```bash
uv run --with playwright python -I tools/verify.py http://localhost:8777/
```

Screenshots land in `tools/out/` (ignored by git): hero, Profile Box after an icon click, footer, at 1440×900@2, 1280×720@1 and 390×844@3, plus a reload-while-scrolled check. The script exits non-zero on page errors or if the reload check fails. Look at the images; most regressions here are visual.

The desktop app's browser pane throttles `requestAnimationFrame` while hidden, so openings look stuck there; use headless Chrome (what the script does) for timing.

## Edit the schematics

Lenovo, Asteria and Ride Compare images are drawings, not screenshots. Edit `assets/screens/src/<name>.html`, then:

```bash
uv run --with playwright python -I tools/render-schematic.py lenovo
```

## Publish

Push to `main`. GitHub Pages serves the repo root; changes are live within about a minute. `.nojekyll` is present so `_`-prefixed paths work.

## Keep out of this repository

- Exact figures for the Lenovo work (the public copy is deliberately blurred, see `CONTENT.md`).
- Personal data, resume drafts, private notes, API keys.
- The rejected opening variants and lab pages; they live in Austin's private workspace and are not needed here.
