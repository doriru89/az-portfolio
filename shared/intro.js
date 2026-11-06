// Intro 0–3.5s — ported from OUTPUT/html/narrative-yat-siu-intro-2026-03-29.html (phases 1–2, kept as-is).
// playIntro(stage, gsap) -> Promise<{ root, ribbons }>, resolves at t=INTRO_END (0.68s).
// 2026-11-05 Austin: glitch flicker ~0.2s only, the colour bars are the point; bars hold shorter.
// END STATE CONTRACT at resolve (bars fully landed ~0.56s, tiny hold): black stage, faint grid + drifting rainbow particles,
// five full-width ribbons (each 20vh, ATARI[0..4] top→bottom) covering the whole viewport, no blur.
// Everything after 3.5s belongs to the opening variant.
import { ATARI } from './palette.js';

export const INTRO_END = 0.68;   // 2026-11-05 Austin: the bars are an in-between, ~0.5s on screen

export function playIntro(stage, gsap) {
  const root = document.createElement('div');
  root.className = 'intro-root';
  root.innerHTML = `
    <style>
      .intro-root{position:absolute;inset:0;background:#000;overflow:hidden}
      .intro-root::before{content:'';position:absolute;inset:0;z-index:1;pointer-events:none;
        background-image:linear-gradient(rgba(255,255,255,.015) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.015) 1px,transparent 1px);background-size:40px 40px}
      .intro-scan{position:absolute;inset:0;z-index:2;pointer-events:none;
        background:repeating-linear-gradient(to bottom,transparent 0,transparent 3px,rgba(255,255,255,.03) 3px,rgba(255,255,255,.03) 4px);
        animation:introScan .35s linear forwards}
      @keyframes introScan{0%{clip-path:inset(0 0 100% 0);opacity:1}80%{clip-path:inset(0);opacity:1}100%{clip-path:inset(0);opacity:0}}
      .intro-gl{position:absolute;left:0;height:2px;z-index:3;opacity:0}
      .intro-particles{position:absolute;inset:0;z-index:2;pointer-events:none}
      .intro-p{position:absolute;border-radius:50%;animation:introDrift linear infinite}
      @keyframes introDrift{0%{transform:translate(0,0);opacity:0}10%{opacity:1}90%{opacity:.6}100%{transform:translate(var(--drift),-100vh);opacity:0}}
      .intro-ribbons{position:absolute;inset:0;z-index:4;display:flex;flex-direction:column;pointer-events:none}
      .intro-ribbon{width:100vw;height:20vh;flex-shrink:0}
    </style>
    <div class="intro-scan"></div>
    <div class="intro-particles"></div>
    ${[[18, 60, 0, 0], [37, 35, 30, 2], [72, 45, 10, 4], [55, 25, 55, 3]].map(([t, w, l, c]) =>
      `<div class="intro-gl" style="top:${t}%;width:${w}%;left:${l}%;background:${ATARI[c]}"></div>`).join('')}
    <div class="intro-ribbons">${ATARI.map(c => `<div class="intro-ribbon" style="background:${c}"></div>`).join('')}</div>`;
  stage.appendChild(root);

  const pc = root.querySelector('.intro-particles');
  for (let i = 0; i < 30; i++) {
    const p = document.createElement('div'); p.className = 'intro-p';
    const s = Math.random() > .5 ? 2 : 3;
    p.style.cssText = `background:${ATARI[i % 5]};opacity:.2;width:${s}px;height:${s}px;left:${Math.random() * 100}%;top:${Math.random() * 100}%;--drift:${((Math.random() - .5) * 60) | 0}px;animation-duration:${15 + Math.random() * 25}s;animation-delay:${-Math.random() * 30}s`;
    pc.appendChild(p);
  }
  const ribbons = [...root.querySelectorAll('.intro-ribbon')];
  const tl = gsap.timeline();
  // glitch: one quick flicker per line, all inside ~0.2s
  root.querySelectorAll('.intro-gl').forEach((el, i) =>
    tl.to(el, { opacity: 0.6 + Math.random() * 0.4, duration: 0.035, repeat: 1, yoyo: true, ease: 'none' }, 0.01 + i * 0.025));
  // bars fly in right after, fast stagger
  ribbons.forEach((el, i) => {
    tl.set(el, { x: i % 2 === 0 ? '-110vw' : '110vw', filter: 'blur(4px)' }, 0);
    tl.to(el, { x: 0, filter: 'blur(0px)', duration: 0.3, ease: 'power4.out' }, 0.1 + i * 0.04);
  });
  return new Promise(res => tl.call(() => res({ root, ribbons }), null, INTRO_END));
}
