// Projector — CONTRACT (owned by the projector agent; keep the export shape stable).
//   mountProjector(container, projects, { THREE, profile }) -> { destroy() }
//   profile (optional): PROFILE from content.js; the leader card prints profile.headline, then profile.lead[]
//
// A walnut split-flap "AZ Profile Box" (after the 六周年 flipbook): every project is a reel —
// one chapter card (name, kicker, impact, details) then one page per screenshot (image +
// title + description). Each card is split at a brass spindle; the top half falls forward
// and its back is the next card's bottom half. Scrolling the page turns the crank: the
// section is sticky-pinned while the reader scrolls through one card per notch, at most one
// flip every 100 ms, both directions; then it lets go. The house lights dim to a warm dark
// while the reel runs, and come back up at the end.
//
// Assets: two small walnut textures (≈190 KB, Poly Haven walnut veneer, cropped) in
// shared/projector-assets/. Lighting is procedural (RoomEnvironment), no HDR.

const ATARI = ['#e4202e', '#f47920', '#ffb000', '#4caf50', '#2196f3'];
const INK = '#1e0f3c', GOLD = '#d4a042', PEACH = '#FFF1EB', HOUSE = '#1a0f22';
const CARD_ASPECT = 0.78;   // card height / width — the box window is 14.4 × 11.7, a 4:3 card left dark slack above and below
const FLIP_MS = 170, MIN_GAP = 100;          // flip length, shortest gap between flips
const CARD_VH = 42;                           // scroll distance per card, in vh
const ASSETS = {                              // swap for data: URLs when inlining
  woodDiff: new URL('./projector-assets/walnut_diff.jpg', import.meta.url).href,
  woodNor: new URL('./projector-assets/walnut_nor.jpg', import.meta.url).href,
};

const str = v => (v == null ? '' : String(v));
const arr = v => (Array.isArray(v) ? v : v ? [v] : []);
const clamp01 = x => Math.max(0, Math.min(1, x));
const easeInOut = x => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
const easeOut = x => 1 - Math.pow(1 - x, 3);
const pad2 = n => String(n).padStart(2, '0');
const esc = s => str(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// ---------- deck: leader, per project (chapter + pages), end ----------
function buildDeck(projects, profile) {
  const deck = [{ kind: 'leader', profile: profile || {} }];
  arr(projects).forEach((p, i) => {
    if (!p) return;
    const color = ATARI[i % ATARI.length], reel = i + 1;
    deck.push({ kind: 'chapter', p, color, reel });
    const imgs = arr(p.images).length ? arr(p.images) : arr(p.image);
    const list = imgs.length ? imgs : [null];
    list.forEach((im, k) => deck.push({
      kind: 'page', p, color, reel, k, n: list.length,
      src: im && typeof im === 'object' ? str(im.src) : str(im),
      caption: im && typeof im === 'object' ? str(im.caption) : '',
    }));
  });
  deck.push({ kind: 'end' });
  deck.forEach((c, i) => { c.i = i; c.N = deck.length; c.reels = arr(projects).length; });
  return deck;
}
const cardLabel = c => c.kind === 'leader' ? 'Leader' : c.kind === 'end' ? 'Fin'
  : `Project ${pad2(c.reel)} · ${str(c.p.name)}`;

// ---------- reduced motion / no-WebGL: plain accessible list ----------
function mountList(container, projects) {
  container.innerHTML = `<style>
    .pj-list{max-width:960px;margin:0 auto;padding:96px 24px;display:grid;gap:40px;font-family:'Space Grotesk',system-ui,sans-serif;color:${INK}}
    .pj-list h2{font-size:clamp(2rem,5vw,3.2rem)}
    .pj-item{display:grid;grid-template-columns:1.2fr 1fr;gap:28px;align-items:start;background:#fff;border-radius:16px;padding:24px;border-top:6px solid var(--c)}
    .pj-item img{width:100%;aspect-ratio:3/2;object-fit:cover;object-position:top;border-radius:8px;display:block}
    .pj-item small{font:500 .8rem 'JetBrains Mono',monospace;letter-spacing:.12em;text-transform:uppercase;color:var(--c)}
    .pj-item h3{font-size:1.6rem;margin:6px 0 2px}
    .pj-item .t{font-weight:500;margin-bottom:10px}
    .pj-item .imp{margin-top:12px;font-weight:700}
    .pj-item ul{margin:10px 0 0 1.1em;line-height:1.5}
    .pj-item a{color:${INK}}
    @media (max-width:700px){.pj-item{grid-template-columns:1fr}}
  </style><div class="pj-list"><h2>Selected work</h2>${arr(projects).map((p, i) => `
    <article class="pj-item" style="--c:${ATARI[i % 5]}">
      ${p.image ? `<img src="${esc(p.image)}" alt="Screenshot of ${esc(p.name)}" loading="lazy">` : '<div></div>'}
      <div><small>Project ${pad2(i + 1)} · ${esc(p.kicker)}</small><h3>${esc(p.name)}</h3>
        <p class="t">${esc(p.title)}</p><p>${esc(p.description)}</p>
        ${arr(p.details).length ? `<ul>${arr(p.details).map(d => `<li>${esc(d)}</li>`).join('')}</ul>` : ''}
        ${p.impact ? `<p class="imp">${esc(p.impact)}</p>` : ''}
        ${p.demoUrl ? `<p><a href="${esc(p.demoUrl)}" target="_blank" rel="noopener">Open demo ↗</a></p>` : ''}
      </div></article>`).join('')}</div>`;
  return { destroy() { container.innerHTML = ''; } };
}

// ---------- card art (2D canvas → CanvasTexture) ----------
const SG = "'Space Grotesk', system-ui, sans-serif", MONO = "'JetBrains Mono', ui-monospace, monospace", PIX = "'Press Start 2P', monospace";

function wrap(g, text, maxW) {
  const words = str(text).split(/\s+/).filter(Boolean), lines = [];
  let line = '';
  for (const w of words) {
    const t = line ? line + ' ' + w : w;
    if (g.measureText(t).width > maxW && line) { lines.push(line); line = w; } else line = t;
  }
  if (line) lines.push(line);
  return lines;
}
// largest size (≤ max) at which text wraps into ≤ maxLines; returns { size, lines }
function fit(g, text, weight, family, max, min, maxW, maxLines) {
  let size = max, lines;
  for (; size >= min; size -= 2) {
    g.font = `${weight} ${size}px ${family}`;
    lines = wrap(g, text, maxW);
    if (lines.length <= maxLines) return { size, lines };
  }
  g.font = `${weight} ${min}px ${family}`;
  lines = wrap(g, text, maxW);
  if (lines.length > maxLines) { lines = lines.slice(0, maxLines); lines[maxLines - 1] = lines[maxLines - 1].replace(/\s*\S*$/, '') + '…'; }
  return { size: min, lines };
}
function rrect(g, x, y, w, h, r) {
  g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
}
function paperBG(g, W, H, seed) {
  const gr = g.createRadialGradient(W * 0.5, H * 0.38, W * 0.05, W * 0.5, H * 0.5, W * 0.78);
  gr.addColorStop(0, '#fcf6ee'); gr.addColorStop(1, '#ebdfcc');
  g.fillStyle = gr; g.fillRect(0, 0, W, H);
  let s = seed * 9301 + 49297; const rnd = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
  for (let k = 0; k < 2600; k++) {            // paper fibre
    g.fillStyle = rnd() < 0.5 ? 'rgba(120,90,60,0.05)' : 'rgba(255,255,255,0.18)';
    g.fillRect(rnd() * W, rnd() * H, 1 + rnd() * 3, 1);
  }
}
// Atari stripes: five bars, staggered like the logo's rainbow
function stripes(g, x, y, len, th, gap, first) {
  const order = first ? [first, ...ATARI.filter(c => c !== first)] : ATARI;
  order.forEach((c, k) => { g.fillStyle = c; g.fillRect(x, y + k * (th + gap), len * (1 - k * 0.12), th); });
}
function frameMark(g, W, c, dark) {          // tiny frame number, top right, like an edge code
  g.font = `500 ${W * 0.017}px ${MONO}`; g.textAlign = 'right'; g.textBaseline = 'top';
  g.fillStyle = dark ? 'rgba(255,241,235,0.45)' : 'rgba(30,15,60,0.4)';
  g.fillText(`FR ${pad2(c.i + 1)}/${pad2(c.N)}`, W * 0.965, W * 0.03);
  g.textAlign = 'left'; g.textBaseline = 'alphabetic';
}
function chips(g, items, x, y, size, color, maxX) {
  g.font = `500 ${size}px ${MONO}`; g.textBaseline = 'middle';
  for (const t of items) {
    const w = g.measureText(t).width + size * 1.3, h = size * 1.9;
    if (x + w > maxX) break;
    rrect(g, x, y - h / 2, w, h, h / 2); g.strokeStyle = color; g.lineWidth = Math.max(2, size * 0.09); g.stroke();
    g.fillStyle = color; g.fillText(t, x + size * 0.65, y + 1);
    x += w + size * 0.6;
  }
  return x;
}

function drawLeader(g, W, H, c) {
  g.fillStyle = HOUSE; g.fillRect(0, 0, W, H);
  const vg = g.createRadialGradient(W / 2, H / 2, H * 0.1, W / 2, H / 2, W * 0.7);
  vg.addColorStop(0, '#2c1a3c'); vg.addColorStop(1, '#120a18'); g.fillStyle = vg; g.fillRect(0, 0, W, H);
  // Academy-leader crosshair + rings (faint: the brand copy sits on top of them)
  g.strokeStyle = 'rgba(212,160,66,0.13)'; g.lineWidth = 2;
  g.beginPath(); g.moveTo(0, H / 2); g.lineTo(W, H / 2); g.moveTo(W / 2, 0); g.lineTo(W / 2, H); g.stroke();
  for (const r of [0.30, 0.36]) { g.beginPath(); g.arc(W / 2, H / 2, H * r, 0, Math.PI * 2); g.stroke(); }
  g.textAlign = 'center'; g.textBaseline = 'alphabetic';
  g.fillStyle = GOLD; g.font = `400 ${W * 0.018}px ${PIX}`; g.fillText('AUSTIN ZHENG PRESENTS', W / 2, H * 0.11);
  g.fillStyle = PEACH; g.font = `700 ${W * 0.06}px ${SG}`; g.fillText('Selected Work', W / 2, H * 0.205);
  g.fillStyle = 'rgba(255,241,235,0.6)'; g.font = `500 ${W * 0.022}px ${MONO}`;
  g.fillText(`${c.reels} PROJECTS  ·  ${c.N} FRAMES`, W / 2, H * 0.26);   // 2026-11-05 Austin: say 'projects', HR does not count reels
  // 2026-11-09 Austin: the brand line, then how (PROFILE.headline, PROFILE.lead[])
  const pr = c.profile || {}, maxW = W * 0.86;
  let y = H * 0.38;
  if (pr.headline) {
    const hd = fit(g, str(pr.headline), 700, SG, W * 0.042, W * 0.034, maxW, 2);
    g.fillStyle = PEACH;
    hd.lines.forEach((l, k) => g.fillText(l, W / 2, y + k * hd.size * 1.22));
    y += (hd.lines.length - 1) * hd.size * 1.22 + W * 0.04;
    g.fillStyle = GOLD; g.fillRect(W / 2 - W * 0.03, y - W * 0.012, W * 0.06, 4);
    y += W * 0.045;
  }
  for (const t of arr(pr.lead)) {
    const ld = fit(g, str(t), 400, SG, W * 0.029, W * 0.026, maxW, 3);
    g.fillStyle = 'rgba(255,241,235,0.82)';
    ld.lines.forEach((l, k) => g.fillText(l, W / 2, y + k * ld.size * 1.3));
    y += ld.lines.length * ld.size * 1.3 + W * 0.018;
  }
  // 2026-11-05 Austin: no stripes under the title; the instruction is big, pixel-font, with a pixel chevron — people must know what to do
  g.fillStyle = GOLD; g.font = `400 ${W * 0.024}px ${PIX}`;
  g.fillText('SCROLL TO TURN THE CRANK', W / 2, H * 0.875);
  const u = W * 0.006, cx = W / 2, cy = H * 0.905;          // 11×6 pixel "V"
  for (let k = 0; k < 6; k++) { g.fillRect(cx + (k - 5.5) * u, cy + k * u, u, u); g.fillRect(cx + (4.5 - k) * u, cy + k * u, u, u); }
  frameMark(g, W, c, true);
}

function drawChapter(g, W, H, c) {
  const p = c.p, m = W * 0.075, maxW = W - 2 * m;
  paperBG(g, W, H, c.i + 1);
  // chapter band: full-height colour edge + stripes
  g.fillStyle = c.color; g.fillRect(0, 0, W * 0.022, H);
  stripes(g, m, H * 0.075, W * 0.26, H * 0.014, H * 0.009, c.color);
  g.textBaseline = 'alphabetic'; g.textAlign = 'left';
  g.fillStyle = c.color; g.font = `400 ${W * 0.02}px ${PIX}`;
  g.fillText(`PROJECT ${pad2(c.reel)}`, m + W * 0.3, H * 0.075 + H * 0.06);
  frameMark(g, W, c);
  // name
  const nm = fit(g, str(p.name), 700, SG, W * 0.1, W * 0.06, maxW, 2);
  let y = H * 0.2 + nm.size * 0.82;
  g.fillStyle = INK;
  nm.lines.forEach((l, k) => g.fillText(l, m - nm.size * 0.04, y + k * nm.size * 0.98));
  y += (nm.lines.length - 1) * nm.size * 0.98 + W * 0.045;
  // kicker
  g.fillStyle = '#7a5f3a'; g.font = `500 ${W * 0.022}px ${MONO}`;
  g.fillText(str(p.kicker).toUpperCase(), m, y);
  y += W * 0.03;
  g.fillStyle = GOLD; g.fillRect(m, y, W * 0.06, 4);
  y += W * 0.065;
  // impact, with a colour rule
  if (p.impact) {
    const im = fit(g, str(p.impact), 500, SG, W * 0.042, W * 0.028, maxW - W * 0.03, 2);
    g.fillStyle = c.color; g.fillRect(m, y - im.size * 0.85, 6, im.size * (1.18 * im.lines.length) - im.size * 0.2);
    g.fillStyle = INK;
    im.lines.forEach((l, k) => g.fillText(l, m + W * 0.028, y + k * im.size * 1.18));
    y += im.lines.length * im.size * 1.18 + W * 0.03;
  }
  // details
  const det = arr(p.details).slice(0, 3);
  g.font = `400 ${W * 0.0235}px ${SG}`;
  for (const d of det) {
    const f = fit(g, str(d), 400, SG, W * 0.0235, W * 0.019, maxW - W * 0.03, 2);
    if (y + (f.lines.length - 1) * f.size * 1.3 > H * 0.85) break;   // keep clear of the tech row
    g.fillStyle = c.color; g.fillRect(m + 2, y - f.size * 0.5, f.size * 0.36, f.size * 0.36);
    g.fillStyle = '#3e2f55';
    f.lines.forEach((l, k) => g.fillText(l, m + W * 0.028, y + k * f.size * 1.3));
    y += f.lines.length * f.size * 1.3 + W * 0.012;
  }
  chips(g, arr(p.tech).map(str), m, H * 0.925, W * 0.0175, '#5a4a6e', W - m);
}

function drawPage(g, W, H, c, img) {
  const p = c.p, m = W * 0.035;
  paperBG(g, W, H, c.i + 7);
  // film gate: dark frame, rounded, with the screenshot inside
  const gx = m, gy = m, gw = W - 2 * m, gh = H * 0.6;     // 2026-11-05: taller gate, bigger screenshot
  g.fillStyle = '#14101a'; rrect(g, gx, gy, gw, gh, W * 0.014); g.fill();
  const ix = gx + W * 0.008, iy = gy + W * 0.008, iw = gw - W * 0.016, ih = gh - W * 0.016;
  g.save(); rrect(g, ix, iy, iw, ih, W * 0.008); g.clip();
  if (img) {
    const k = Math.max(iw / img.width, ih / img.height), dw = img.width * k, dh = img.height * k;
    const tall = img.height / img.width > ih / iw * 1.2;    // tall screenshots: show the top
    g.drawImage(img, ix + (iw - dw) / 2, tall ? iy : iy + (ih - dh) / 2, dw, dh);
    const v = g.createLinearGradient(0, iy, 0, iy + ih);   // gentle gate falloff
    v.addColorStop(0, 'rgba(0,0,0,0.10)'); v.addColorStop(0.2, 'rgba(0,0,0,0)'); v.addColorStop(0.85, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,0.18)');
    g.fillStyle = v; g.fillRect(ix, iy, iw, ih);
  } else {
    g.fillStyle = '#231833'; g.fillRect(ix, iy, iw, ih);
    stripes(g, ix + iw * 0.3, iy + ih * 0.4, iw * 0.4, ih * 0.035, ih * 0.02, c.color);
  }
  g.restore();
  // caption block
  const tx = m + W * 0.01, maxW = W - 2 * tx;
  let y = gy + gh + W * 0.042;
  g.textAlign = 'left'; g.textBaseline = 'alphabetic';
  g.fillStyle = c.color; g.font = `700 ${W * 0.0165}px ${MONO}`;
  g.fillText(`PROJECT ${pad2(c.reel)} · ${str(p.name).toUpperCase()}`, tx, y);
  g.textAlign = 'right'; g.fillStyle = 'rgba(30,15,60,0.45)'; g.font = `500 ${W * 0.0165}px ${MONO}`;
  g.fillText(c.n > 1 ? `SCREEN ${c.k + 1}/${c.n}` : `FR ${pad2(c.i + 1)}/${pad2(c.N)}`, W - tx, y);
  g.textAlign = 'left';
  const ti = fit(g, str(c.caption || p.title), 700, SG, W * 0.04, W * 0.025, maxW - W * 0.1, 1);
  y += ti.size * 1.15;
  g.fillStyle = INK; g.fillText(ti.lines[0] || '', tx, y);
  y += W * 0.012;
  const dsc = fit(g, str(p.description), 400, SG, W * 0.023, W * 0.0185, maxW, 3);
  g.fillStyle = '#3e2f55';
  dsc.lines.forEach((l, k) => g.fillText(l, tx, y + dsc.size * 1.38 * (k + 1)));
  const endX = chips(g, arr(p.tech).map(str), tx, H - m - W * 0.006, W * 0.0155, '#5a4a6e', W - tx - (p.demoUrl ? W * 0.2 : 0));
  if (p.demoUrl) chips(g, ['▶ OPEN DEMO'], Math.max(endX, W - tx - W * 0.17), H - m - W * 0.006, W * 0.0155, c.color, W);
}

function drawEnd(g, W, H, c) {
  g.fillStyle = HOUSE; g.fillRect(0, 0, W, H);
  const vg = g.createRadialGradient(W / 2, H * 0.45, H * 0.1, W / 2, H / 2, W * 0.7);
  vg.addColorStop(0, '#2c1a3c'); vg.addColorStop(1, '#120a18'); g.fillStyle = vg; g.fillRect(0, 0, W, H);
  g.textAlign = 'center'; g.textBaseline = 'alphabetic';
  const L = W * 0.24, th = H * 0.014;
  ATARI.forEach((col, k) => { g.fillStyle = col; g.fillRect(W / 2 - L / 2, H * 0.22 + k * th * 1.7, L, th); });
  g.fillStyle = PEACH; g.font = `700 ${W * 0.13}px ${SG}`; g.fillText('fin.', W / 2, H * 0.6);
  g.fillStyle = GOLD; g.font = `500 ${W * 0.026}px ${MONO}`; g.fillText('THANKS FOR WATCHING', W / 2, H * 0.7);
  g.fillStyle = 'rgba(255,241,235,0.5)'; g.font = `500 ${W * 0.019}px ${MONO}`;
  g.fillText('KEEP SCROLLING  ↓', W / 2, H * 0.93);
  frameMark(g, W, c, true);
}

// ---------- mount ----------
export function mountProjector(container, projects, { THREE, profile } = {}) {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const deck = buildDeck(projects, profile);
  const N = deck.length;
  if (reduced || !THREE || !deck.some(c => c.kind !== 'leader' && c.kind !== 'end')) return mountList(container, projects);
  const hasGL = (() => { try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch { return false; } })();
  if (!hasGL) return mountList(container, projects);

  container.innerHTML = `<style>
    .pj-track{position:relative;height:calc(100vh + ${N * CARD_VH}vh)}
    .pj-stage{position:sticky;top:0;height:100vh;overflow:hidden;display:flex;flex-direction:column;background:${PEACH};font-family:${SG}}
    .pj-glow{position:absolute;inset:0;pointer-events:none;opacity:0;
      background:radial-gradient(ellipse 46% 52% at 50% 46%,rgba(255,196,120,.34),rgba(255,160,90,.10) 55%,transparent 75%)}
    .pj-grain{position:absolute;inset:-50%;pointer-events:none;opacity:0;mix-blend-mode:overlay;animation:pjGrain .5s steps(4) infinite}
    @keyframes pjGrain{0%{transform:translate(0,0)}25%{transform:translate(-3%,2%)}50%{transform:translate(2%,-3%)}75%{transform:translate(-2%,-1%)}}
    .pj-view{position:relative;flex:1;min-height:0;margin-top:clamp(56px,9vh,88px)}   /* 2026-11-05: box is bigger; start it under the porthole's calling card */
    .pj-view canvas{position:absolute;inset:0;width:100%;height:100%;display:block;outline:none}
    .pj-hud{position:absolute;left:0;right:0;bottom:0;display:flex;justify-content:space-between;align-items:flex-end;gap:16px;
      padding:0 clamp(16px,3vw,40px) clamp(16px,3vh,32px);font:500 12px/1.4 ${MONO};letter-spacing:.14em;text-transform:uppercase;pointer-events:none;opacity:0}
    .pj-hud b{font-weight:700;color:${GOLD}}
    .pj-hud .pj-reel{color:rgba(255,241,235,.75)} .pj-hud .pj-frame{color:rgba(255,241,235,.75);text-align:right}
    .pj-hint{position:absolute;left:50%;bottom:clamp(16px,3vh,32px);transform:translateX(-50%);font:400 13px ${PIX};letter-spacing:.06em;
      color:${GOLD};text-transform:uppercase;transition:opacity .6s;white-space:nowrap;animation:pjBlink 1.6s steps(1) infinite}
    @keyframes pjBlink{0%,70%{opacity:1}71%,100%{opacity:.4}}
    .pj-demo{pointer-events:auto;display:none;color:${INK};background:${GOLD};border-radius:99px;padding:6px 12px;text-decoration:none;font-weight:700;letter-spacing:.1em}
    .pj-cap{display:none}
    .pj-sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
    @media (max-width:700px),(max-aspect-ratio:3/4){
      .pj-view{flex:0 0 auto;height:min(58vh,92vw);margin-top:72px}
      .pj-cap{display:block;position:relative;padding:4px 20px 0;color:rgba(255,241,235,.9);opacity:0}
      .pj-cap small{font:700 11px ${MONO};letter-spacing:.14em;text-transform:uppercase}
      .pj-cap h3{font-size:20px;line-height:1.2;margin:6px 0 6px;color:${PEACH}}
      .pj-cap p{font-size:14px;line-height:1.45;color:rgba(255,241,235,.75)}
      .pj-cap ul{margin:10px 0 0 1.1em;font-size:13px;line-height:1.45;color:rgba(255,241,235,.6)}
      .pj-hint{display:none}
      .pj-hud .pj-reel{display:none}
      .pj-hud{justify-content:space-between;align-items:center}
      .pj-hud{position:relative;margin-top:auto}
    }
  </style>
  <div class="pj-track" role="region" aria-roledescription="film viewer" aria-label="Selected work — scroll to flip through the projects">
    <div class="pj-stage">
      <div class="pj-grain"></div>
      <div class="pj-view"><div class="pj-glow"></div><canvas aria-hidden="true"></canvas></div>
      <div class="pj-cap" aria-hidden="true"><small></small><h3></h3><p></p><ul></ul></div>
      <div class="pj-hud"><div class="pj-reel"></div><a class="pj-demo" target="_blank" rel="noopener">Open demo ↗</a><div class="pj-frame"></div></div>
      <div class="pj-hint">Scroll to turn the crank</div>
      <div class="pj-sr" aria-live="polite"></div>
    </div>
  </div>`;
  const $ = s => container.querySelector(s);
  const track = $('.pj-track'), stage = $('.pj-stage'), view = $('.pj-view'), canvas = $('canvas');
  const glowEl = $('.pj-glow'), grainEl = $('.pj-grain'), hud = $('.pj-hud'), hint = $('.pj-hint'), capEl = $('.pj-cap');
  const reelEl = $('.pj-reel'), frameEl = $('.pj-frame'), demoEl = $('.pj-demo'), srEl = $('.pj-sr');

  // film grain tile (tiny, generated)
  {
    const c = document.createElement('canvas'); c.width = c.height = 96;
    const g = c.getContext('2d'), d = g.createImageData(96, 96);
    for (let k = 0; k < d.data.length; k += 4) { const v = Math.random() * 255; d.data[k] = d.data[k + 1] = d.data[k + 2] = v; d.data[k + 3] = 255; }
    g.putImageData(d, 0, 0);
    grainEl.style.backgroundImage = `url(${c.toDataURL()})`;
  }

  // track geometry → scroll progress (sticky pin; no scroll hijacking)
  const metrics = () => {
    const r = track.getBoundingClientRect(), vh = innerHeight, run = Math.max(1, r.height - vh);
    return { r, vh, run, enter: clamp01(1 - r.top / vh), p: clamp01(-r.top / run), exit: clamp01((vh - r.bottom) / vh), pinned: r.top <= 1 && r.bottom >= vh - 1 };
  };
  const targetFor = p => Math.min(N - 1, Math.floor(p * N));
  const scrollFor = i => { const r = track.getBoundingClientRect(); return scrollY + r.top + ((i + 0.5) / N) * Math.max(1, r.height - innerHeight); };
  // 2026-11-05: clicking a wallpaper icon "loads the reel": scroll into the pinned track and crank to that project's chapter card.
  // Shell dispatches a cancelable 'portfolio:open-project' {id}; we take it (preventDefault) so the shell doesn't scroll too.
  const onOpenProject = e => {
    const id = e.detail && e.detail.id;
    const idx = id ? deck.findIndex(c => c.kind === 'chapter' && c.p && c.p.id === id) : 0;
    e.preventDefault();
    const top = scrollFor(idx < 0 ? 0 : idx);
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    window.scrollTo({ top, behavior: reduce ? 'auto' : 'smooth' });
  };
  addEventListener('portfolio:open-project', onOpenProject);

  // ---------- lazy 3D init ----------
  let gl = null, alive = true, nearby = false;
  const io = new IntersectionObserver(es => {
    nearby = es.some(e => e.isIntersecting);
    if (nearby && !gl) init().catch(err => { console.error('[projector]', err); });
    if (gl && gl.renderer) gl.renderer.setAnimationLoop(nearby ? gl.loop : null);
  }, { rootMargin: '120% 0px 120% 0px' });
  io.observe(track);
  window.ScrollTrigger?.refresh?.();

  async function init() {
    gl = { pending: true };
    const [{ RoundedBoxGeometry }, { RoomEnvironment }] = await Promise.all([
      import('three/addons/geometries/RoundedBoxGeometry.js'),
      import('three/addons/environments/RoomEnvironment.js'),
    ]);
    if (!alive) return;
    const fontsReady = Promise.race([
      Promise.all([`700 40px 'Space Grotesk'`, `500 40px 'Space Grotesk'`, `400 40px 'Space Grotesk'`, `500 20px 'JetBrains Mono'`, `700 20px 'JetBrains Mono'`, `400 20px 'Press Start 2P'`]
        .map(f => document.fonts?.load(f).catch(() => null))),
      new Promise(r => setTimeout(r, 2500)),
    ]);
    const disposables = new Set();
    const keep = o => { disposables.add(o); return o; };

    // ---------- renderer / scene ----------
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
    renderer.setClearColor(0x000000, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(30, 1, 1, 600);
    const pmrem = new THREE.PMREMGenerator(renderer);
    const envRT = pmrem.fromScene(new RoomEnvironment(), 0.04);
    pmrem.dispose();
    scene.environment = envRT.texture;
    scene.environmentIntensity = 0.32;
    scene.add(new THREE.HemisphereLight('#ffe9cf', '#2a1a2c', 0.5));
    const key = new THREE.DirectionalLight('#ffe0b8', 2.4); key.position.set(-30, 26, 18); scene.add(key);
    const rim = new THREE.DirectionalLight('#b0a0ff', 0.5); rim.position.set(24, 10, -20); scene.add(rim);

    // ---------- materials ----------
    const texLoader = new THREE.TextureLoader();
    const woodTex = (url, srgb, rx, ry) => {
      const t = keep(texLoader.load(url));
      t.wrapS = t.wrapT = THREE.MirroredRepeatWrapping; t.repeat.set(rx, ry); t.offset.set(0.32, 0.18);   // keep box UVs inside one tile: no seam at x=0
      t.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
      if (srgb) t.colorSpace = THREE.SRGBColorSpace;
      return t;
    };
    const R = 1 / 50;                                       // crop covers ~50 cm of veneer; extrude UVs are in cm
    const woodLook = { normalScale: new THREE.Vector2(0.55, 0.55), color: '#b07a58', roughness: 0.6, clearcoat: 0.35, clearcoatRoughness: 0.35 };
    const walnut = keep(new THREE.MeshPhysicalMaterial({ map: woodTex(ASSETS.woodDiff, true, R, R), normalMap: woodTex(ASSETS.woodNor, false, R, R), ...woodLook }));
    const walnutSmall = keep(new THREE.MeshPhysicalMaterial({ map: woodTex(ASSETS.woodDiff, true, 0.12, 0.12), normalMap: woodTex(ASSETS.woodNor, false, 0.12, 0.12), ...woodLook }));
    const darkWood = keep(new THREE.MeshStandardMaterial({ color: '#2a1a10', roughness: 0.9 }));
    const cavityMat = keep(new THREE.MeshStandardMaterial({ color: '#24170f', roughness: 0.95, envMapIntensity: 0.2 }));
    const brass = keep(new THREE.MeshStandardMaterial({ color: '#c49a5c', metalness: 0.9, roughness: 0.32 }));

    // ---------- box (cm-ish) ----------
    const Y0 = 2.0;                                         // extra bottom rail for the Atari strip
    const BW = 15.4, BH = 13.4 + Y0, BD = 11;
    const WW = 14.4, WH = 11.7, WY = 6.85 + Y0;
    const CAV_W = 15.3, CAV_H = 13.0, CAV_Y = 6.7 + Y0;
    const CW = 14.0, CH = CW * CARD_ASPECT, HALF = CH / 2;   // card fits inside the window (text must not be clipped); 2026-11-06: taller card (0.79, was 4:3) fills the window
    const PLATE_BACK = -0.5, AXLE_Z = -(HALF + 0.85), AXLE_Y = 6.73 + Y0;

    const rig = new THREE.Group(); scene.add(rig);
    const box = new THREE.Group(); box.position.set(0, -BH / 2, BD / 2); rig.add(box);
    const add = (geo, mat, parent = box) => { keep(geo); const m = new THREE.Mesh(geo, mat); parent.add(m); return m; };
    const rounded = (w, h, r, cy = 0) => {
      const s = new THREE.Shape();
      s.moveTo(-w / 2 + r, cy - h / 2);
      s.lineTo(w / 2 - r, cy - h / 2); s.quadraticCurveTo(w / 2, cy - h / 2, w / 2, cy - h / 2 + r);
      s.lineTo(w / 2, cy + h / 2 - r); s.quadraticCurveTo(w / 2, cy + h / 2, w / 2 - r, cy + h / 2);
      s.lineTo(-w / 2 + r, cy + h / 2); s.quadraticCurveTo(-w / 2, cy + h / 2, -w / 2, cy + h / 2 - r);
      s.lineTo(-w / 2, cy - h / 2 + r); s.quadraticCurveTo(-w / 2, cy - h / 2, -w / 2 + r, cy - h / 2);
      return s;
    };
    const bevel = { bevelEnabled: true, bevelThickness: 0.35, bevelSize: 0.3, bevelSegments: 4, curveSegments: 16 };
    const plateShape = rounded(BW, BH, 0.9);
    plateShape.holes.push(new THREE.Path(rounded(WW, WH, 0.35, WY - BH / 2).getPoints(24)));
    const plateGeo = new THREE.ExtrudeGeometry(plateShape, { depth: 0.15, ...bevel }); plateGeo.translate(0, BH / 2, -0.15);
    add(plateGeo, walnut);
    const bodyShape = rounded(BW + 0.6, BH + 0.6, 1.2);
    bodyShape.holes.push(rounded(CAV_W, CAV_H, 0.5, CAV_Y - BH / 2));
    const bodyGeo = new THREE.ExtrudeGeometry(bodyShape, { depth: BD - 0.8, bevelEnabled: false, curveSegments: 16 }); bodyGeo.translate(0, BH / 2, -BD + 0.4);
    add(bodyGeo, walnut);
    const backGeo = new THREE.ExtrudeGeometry(rounded(BW, BH, 0.9), { depth: 0.15, ...bevel }); backGeo.translate(0, BH / 2, -BD);
    add(backGeo, walnut);
    // brass film-gate lip just inside the window
    {
      const s = rounded(WW + 0.02, WH + 0.02, 0.36, WY);
      s.holes.push(new THREE.Path(rounded(WW - 0.34, WH - 0.34, 0.24, WY).getPoints(24)));
      const g = new THREE.ExtrudeGeometry(s, { depth: 0.12, bevelEnabled: false, curveSegments: 16 }); g.translate(0, 0, 0.06);
      add(g, brass);
    }
    // dark sleeve lining the cavity
    const cavFront = PLATE_BACK, cavBack = -BD + 0.55, cavDepth = cavFront - cavBack;
    for (const [w, h, x, y, ry, rx] of [
      [cavDepth, CAV_H, -CAV_W / 2 + 0.03, CAV_Y, Math.PI / 2, 0], [cavDepth, CAV_H, CAV_W / 2 - 0.03, CAV_Y, -Math.PI / 2, 0],
      [CAV_W, cavDepth, 0, CAV_Y + CAV_H / 2 - 0.03, 0, Math.PI / 2], [CAV_W, cavDepth, 0, CAV_Y - CAV_H / 2 + 0.03, 0, -Math.PI / 2],
    ]) { const m = add(new THREE.PlaneGeometry(w, h), cavityMat); m.position.set(x, y, (cavFront + cavBack) / 2); m.rotation.set(rx, ry, 0); }
    add(new THREE.PlaneGeometry(CAV_W, CAV_H), darkWood).position.set(0, CAV_Y, cavBack);
    // spindle + end discs
    const axle = add(new THREE.CylinderGeometry(0.16, 0.16, CAV_W - 0.1, 20), brass); axle.rotation.z = Math.PI / 2; axle.position.set(0, AXLE_Y, AXLE_Z);
    for (const sx of [-1, 1]) { const d = add(new THREE.CylinderGeometry(0.9, 0.9, 0.06, 32), darkWood); d.rotation.z = Math.PI / 2; d.position.set(sx * (CW / 2 + 0.05), AXLE_Y, AXLE_Z); }
    // the bulb
    const bulbMat = keep(new THREE.MeshStandardMaterial({ color: '#fff3d6', emissive: '#ffcf7a', emissiveIntensity: 3 }));
    const bulb = add(new THREE.CapsuleGeometry(0.26, 0.34, 6, 16), bulbMat); bulb.position.set(0, 12.13 + Y0, -1.5);
    const bulbLight = new THREE.PointLight('#ffc678', 12, 16, 1.6); bulbLight.position.copy(bulb.position).add(new THREE.Vector3(0, -0.4, 0.6)); box.add(bulbLight);
    const socket = add(new THREE.CylinderGeometry(0.2, 0.24, 0.3, 16), brass); socket.position.copy(bulb.position).add(new THREE.Vector3(0, 0.42, 0));
    const cordTop = CAV_Y + CAV_H / 2, cordLen = cordTop - socket.position.y;
    add(new THREE.CylinderGeometry(0.04, 0.04, cordLen, 8), darkWood).position.set(0, socket.position.y + cordLen / 2, bulb.position.z);
    const glowTex = (() => {
      const c = document.createElement('canvas'); c.width = c.height = 128;
      const g = c.getContext('2d'), r = g.createRadialGradient(64, 64, 0, 64, 64, 64);
      r.addColorStop(0, 'rgba(255,214,140,0.85)'); r.addColorStop(0.3, 'rgba(255,190,100,0.25)'); r.addColorStop(1, 'rgba(255,170,80,0)');
      g.fillStyle = r; g.fillRect(0, 0, 128, 128); return keep(new THREE.CanvasTexture(c));
    })();
    const haloMat = keep(new THREE.SpriteMaterial({ map: glowTex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
    const halo = new THREE.Sprite(haloMat); halo.scale.set(2.6, 2.6, 1); halo.position.copy(bulb.position).add(new THREE.Vector3(0, 0, 0.3)); box.add(halo);
    // glass
    add(new THREE.PlaneGeometry(WW, WH), keep(new THREE.MeshPhysicalMaterial({ color: '#ffffff', roughness: 0.04, transparent: true, opacity: 0.06, envMapIntensity: 1.6 }))).position.set(0, WY, -0.1);
    // Atari strip on the bottom rail: black ribs, rainbow, name, and a little frame counter
    const stripCanvas = document.createElement('canvas'); stripCanvas.width = 1024; stripCanvas.height = 144;
    const stripTex = keep(new THREE.CanvasTexture(stripCanvas)); stripTex.colorSpace = THREE.SRGBColorSpace; stripTex.anisotropy = 8;
    const stripW = BW - 2.2, stripH = stripW * 144 / 1024;
    const strip = add(new THREE.PlaneGeometry(stripW, stripH), keep(new THREE.MeshStandardMaterial({ map: stripTex, roughness: 0.45, metalness: 0.1 })));
    strip.position.set(0, (WY - WH / 2) / 2 + 0.05, 0.36);
    function drawStrip(i) {
      const g = stripCanvas.getContext('2d'), W = 1024, H = 144;
      g.fillStyle = '#121014'; g.fillRect(0, 0, W, H);
      for (let y = 0; y < H; y += 6) { g.fillStyle = 'rgba(255,255,255,0.035)'; g.fillRect(0, y, W, 2); }   // ribs
      ATARI.forEach((c, k) => {                              // slanted rainbow bars
        g.fillStyle = c; g.beginPath();
        const x = 40 + k * 30; g.moveTo(x + 22, 24); g.lineTo(x + 40, 24); g.lineTo(x + 18, 120); g.lineTo(x, 120); g.closePath(); g.fill();
      });
      g.fillStyle = '#d9c9a8'; g.font = `700 34px ${SG}`; g.textBaseline = 'middle'; g.letterSpacing = '8px';
      g.fillText('AZ  PROFILE BOX', 230, 74); g.letterSpacing = '0px';
      g.font = `500 18px ${MONO}`; g.fillStyle = 'rgba(217,201,168,0.55)'; g.fillText('HAND-CRANKED · 4:3', 232, 112);
      // counter: drum cells
      const txt = `${pad2(i + 1)}/${pad2(N)}`, cw = 44, x0 = W - 40 - txt.length * cw;
      g.fillStyle = '#050405'; rrect(g, x0 - 12, 26, txt.length * cw + 24, 92, 10); g.fill();
      for (let k = 0; k < txt.length; k++) {
        const x = x0 + k * cw;
        if (txt[k] !== '/') {
          const gr = g.createLinearGradient(0, 34, 0, 110); gr.addColorStop(0, '#2a2629'); gr.addColorStop(0.5, '#efe6d6'); gr.addColorStop(1, '#2a2629');
          g.fillStyle = gr; g.fillRect(x + 3, 34, cw - 6, 76);
        }
        g.fillStyle = txt[k] === '/' ? '#d9c9a8' : '#121014'; g.font = `700 50px ${MONO}`; g.textAlign = 'center';
        g.fillText(txt[k], x + cw / 2, 74);
      }
      g.textAlign = 'left';
      stripTex.needsUpdate = true;
    }
    // crank on the right
    const crank = new THREE.Group(); crank.position.set(BW / 2 + 0.35, AXLE_Y, AXLE_Z); box.add(crank);
    const hub = add(new THREE.CylinderGeometry(0.75, 0.75, 0.6, 28), walnutSmall, crank); hub.rotation.z = Math.PI / 2; hub.position.x = 0.3;
    add(new RoundedBoxGeometry(0.45, 3.4, 0.7, 3, 0.18), walnutSmall, crank).position.set(0.75, 1.3, 0);
    const knob = add(new THREE.CylinderGeometry(0.42, 0.36, 1.8, 24), walnutSmall, crank); knob.rotation.z = Math.PI / 2; knob.position.set(1.7, 2.7, 0);
    add(new THREE.SphereGeometry(0.42, 20, 12), walnutSmall, crank).position.set(2.6, 2.7, 0);
    const pin = add(new THREE.CylinderGeometry(0.12, 0.12, 0.5, 12), brass, crank); pin.rotation.z = Math.PI / 2; pin.position.set(0.7, 0, 0);
    // soft floor shadow (scene space, under the box)
    const shadowTex = (() => {
      const c = document.createElement('canvas'); c.width = c.height = 256;
      const g = c.getContext('2d'), r = g.createRadialGradient(128, 128, 10, 128, 128, 128);
      r.addColorStop(0, 'rgba(8,4,10,0.9)'); r.addColorStop(0.5, 'rgba(8,4,10,0.4)'); r.addColorStop(1, 'rgba(8,4,10,0)');
      g.fillStyle = r; g.fillRect(0, 0, 256, 256); return keep(new THREE.CanvasTexture(c));
    })();
    const shadowMat = keep(new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false }));
    const shadow = new THREE.Mesh(keep(new THREE.PlaneGeometry(BW * 1.5, BD * 1.2)), shadowMat); shadow.rotation.x = -Math.PI / 2; scene.add(shadow);

    // ---------- cards ----------
    const halfGeo = top => {
      const g = keep(new THREE.PlaneGeometry(CW, HALF)), uv = g.attributes.uv;
      for (let i = 0; i < uv.count; i++) uv.setY(i, top ? 0.5 + uv.getY(i) * 0.5 : uv.getY(i) * 0.5);
      g.translate(0, top ? HALF / 2 : -HALF / 2, 0); return g;
    };
    const paperCol = new THREE.Color('#efe6d6');
    const cardMat = () => keep(new THREE.MeshBasicMaterial({ color: paperCol.clone(), toneMapped: false }));
    const cards = new THREE.Group(); cards.position.set(0, AXLE_Y, AXLE_Z + 0.3); box.add(cards);
    const staticTop = new THREE.Mesh(halfGeo(true), cardMat()), staticBottom = new THREE.Mesh(halfGeo(false), cardMat());
    staticTop.position.z = staticBottom.position.z = -0.02;
    const flap = new THREE.Group();
    const flapFront = new THREE.Mesh(halfGeo(true), cardMat()), flapBack = new THREE.Mesh(halfGeo(false), cardMat());
    flapBack.rotation.x = Math.PI; flapBack.position.z = -0.004;
    flap.add(flapFront, flapBack); cards.add(staticTop, staticBottom, flap);
    const edgeMat = keep(new THREE.MeshStandardMaterial({ color: '#e9e0d0', roughness: 0.9 }));
    for (let k = 1; k <= 7; k++) {                          // waiting cards behind, so it reads as a deck
      const e = new THREE.Mesh(keep(new THREE.PlaneGeometry(CW, HALF).translate(0, HALF / 2, 0)), edgeMat);
      e.position.z = -0.05 - k * 0.07; e.rotation.x = -0.035 * k; cards.add(e);
    }

    // ---------- textures ----------
    const mobile = Math.min(innerWidth, innerHeight) < 700;
    const TW = mobile ? 1024 : 1440, TH = Math.round(TW * CARD_ASPECT);
    const imgCache = new Map();
    const loadImg = src => {
      if (!src) return Promise.resolve(null);
      if (!imgCache.has(src)) imgCache.set(src, new Promise(ok => { const im = new Image(); im.decoding = 'async'; im.onload = () => ok(im); im.onerror = () => ok(null); im.src = src; }));
      return imgCache.get(src);
    };
    const textures = new Map(), ready = new Map();
    function tex(i) {
      if (i < 0 || i >= N) return Promise.resolve(null);
      if (!textures.has(i)) {
        const c = deck[i];
        const pr = Promise.all([fontsReady, c.kind === 'page' ? loadImg(c.src) : null]).then(([, img]) => {
          const cv = document.createElement('canvas'); cv.width = TW; cv.height = TH;
          const g = cv.getContext('2d');
          try {
            if (c.kind === 'leader') drawLeader(g, TW, TH, c);
            else if (c.kind === 'chapter') drawChapter(g, TW, TH, c);
            else if (c.kind === 'page') drawPage(g, TW, TH, c, img);
            else drawEnd(g, TW, TH, c);
          } catch (e) { console.warn('[projector] card draw', e); g.fillStyle = '#efe6d6'; g.fillRect(0, 0, TW, TH); }
          const t = new THREE.CanvasTexture(cv);
          t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
          t.minFilter = THREE.LinearMipmapLinearFilter;
          ready.set(i, t); return t;
        });
        textures.set(i, pr);
      }
      return textures.get(i);
    }
    function prefetch(i) {
      for (let k = i - 3; k <= i + 6; k++) tex(k);
      for (const [k, t] of ready) if (k < i - 6 || k > i + 10) { t.dispose(); ready.delete(k); textures.delete(k); }
    }
    function setMap(mesh, t, shade) {
      const m = mesh.material;
      if (m.map !== (t || null)) { m.map = t || null; m.needsUpdate = true; }
      if (t) m.color.setRGB(shade, shade, shade); else m.color.copy(paperCol).multiplyScalar(shade);
    }
    // fall with gravity, then a small bounce on the stop
    const flapAngle = p => { if (p < 0.82) { const q = p / 0.82; return Math.PI * q * q; } const q = (p - 0.82) / 0.18; return Math.PI - 0.16 * Math.sin(q * Math.PI) * (1 - q); };
    function drawCards(a, b, p) {
      const cur = ready.get(a) || null, nxt = ready.get(b) || null;
      if (p > 0 && p < 1) {
        const ang = flapAngle(p);
        flap.visible = true; flap.rotation.x = ang;
        const s = Math.sin(Math.min(ang, Math.PI / 2)), c = Math.max(0, -Math.cos(ang));
        setMap(flapFront, cur, 1 - 0.55 * s);
        setMap(flapBack, nxt, 0.5 + 0.5 * c);
        setMap(staticTop, nxt, 0.55 + 0.45 * Math.min(1, p * 1.6));
        setMap(staticBottom, cur, 1 - 0.3 * s);
      } else {
        const t = p >= 1 ? nxt : cur;
        flap.visible = false; setMap(staticTop, t, 1); setMap(staticBottom, t, 1);
      }
    }

    // ---------- paging: scroll position is the source of truth ----------
    let page = 0, anim = null, lastStart = -1e9, target = 0, shown = -1, freeze = null, flash = 0;
    function stepPaging(now) {
      if (anim && now - anim.start >= FLIP_MS) { page = anim.to; anim = null; }
      const base = anim ? anim.to : page;
      if (target !== base && now - lastStart >= MIN_GAP) {
        const to = base + Math.sign(target - base);
        if (!ready.has(to) || !ready.has(base)) return;
        if (anim) page = anim.to;                          // fast scrolling: snap the previous flip
        anim = { from: page, to, start: now }; lastStart = now; flash = 1;
        hint.style.opacity = '0';
      }
    }
    function drawPaging(now) {
      if (!anim) { drawCards(page, page, 0); return page; }
      const p = Math.min(1, (now - anim.start) / FLIP_MS);
      if (anim.to > anim.from) drawCards(anim.from, anim.to, p); else drawCards(anim.to, anim.from, 1 - p);
      return anim.to;
    }
    function onShown(j) {
      shown = j;
      const c = deck[j];
      drawStrip(j);
      reelEl.innerHTML = c.kind === 'leader' ? `<b>●</b> Leader` : c.kind === 'end' ? `<b>●</b> End of reel`
        : `<b style="color:${c.color}">●</b> Project ${pad2(c.reel)} — ${esc(c.p.name)}`;
      frameEl.textContent = `Frame ${pad2(j + 1)} / ${pad2(N)}`;
      const url = c.p && c.p.demoUrl;
      demoEl.style.display = url ? 'inline-block' : 'none';
      if (url) hint.style.opacity = '0';
      hint.style.visibility = url ? 'hidden' : '';   // 2026-11-06: the blink animation overrides opacity, so the hint showed through the OPEN DEMO pill
      if (url) demoEl.href = url;
      const cap = capEl.children;
      cap[3].innerHTML = c.kind === 'chapter' ? arr(c.p.details).slice(0, 3).map(d => `<li>${esc(d)}</li>`).join('') : '';
      if (c.kind === 'chapter') { cap[0].textContent = `Project ${pad2(c.reel)} · ${str(c.p.kicker)}`; cap[0].style.color = c.color; cap[1].textContent = str(c.p.name); cap[2].textContent = str(c.p.impact); }
      else if (c.kind === 'page') { cap[0].textContent = `Project ${pad2(c.reel)} · ${str(c.p.name)}`; cap[0].style.color = c.color; cap[1].textContent = str(c.caption || c.p.title); cap[2].textContent = str(c.p.description); }
      else { cap[0].textContent = ''; cap[1].textContent = c.kind === 'leader' ? 'Selected Work' : 'fin.'; cap[2].textContent = c.kind === 'leader' ? 'Scroll to turn the crank.' : 'Thanks for watching.'; }
      srEl.textContent = c.kind === 'page' ? `${cardLabel(c)}. ${str(c.p.title)}. ${str(c.p.description)}`
        : c.kind === 'chapter' ? `${cardLabel(c)}. ${str(c.p.kicker)}. ${str(c.p.impact)}. ${arr(c.p.details).map(str).join('. ')}` : cardLabel(c);
    }

    // ---------- framing ----------
    const poses = { air: null, low: null };
    let vw = 1, vh = 1, portrait = false;
    function frame() {
      const r = view.getBoundingClientRect(); vw = Math.max(1, r.width); vh = Math.max(1, r.height);
      renderer.setSize(vw, vh, false);
      camera.aspect = vw / vh; camera.updateProjectionMatrix();
      const tan = Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2);
      portrait = vw < 700 || vw < vh * 1.05;
      // 2026-11-05 Austin: "the display inside could be bigger" — the box now fills ~88% of the view height (was 80%)
      // 2026-11-06: 88% of a ≥835px view; on shorter views (720p laptops) the box bottom reached the crank hint, so the fill eases
      // down to 78% there. Tried 92% / 90% for everyone — the hint hit the rail. Size on big screens comes from the taller card.
      const fill = portrait ? 0.88 : Math.max(0.78, Math.min(0.88, 0.88 * vh / 835));
      const byH = BH / (fill * 2 * tan);
      const byW = (BW + 0.6 + (portrait ? 3.4 : 4)) / ((portrait ? 0.94 : 0.9) * 2 * tan * camera.aspect);
      const df = Math.max(byH, byW);
      poses.air = { pos: new THREE.Vector3(portrait ? -1.2 : -1.0, 0.3, -(df + BD / 2)), rot: new THREE.Euler(0.03, -0.087, 0), d: df + BD / 2 };   // 2026-11-05 Austin: near front-on, a 5° turn (crank side forward) so it reads as a thing in a room, not a flat picture
      poses.low = { pos: new THREE.Vector3(poses.air.pos.x + 4, poses.air.pos.y - df * tan * 1.2, poses.air.pos.z - 16), rot: new THREE.Euler(0.55, -0.55, 0.06) };
    }
    const ro = new ResizeObserver(frame); ro.observe(view); frame();

    function pose(u, now) {
      const a = poses.low, b = poses.air;
      const ed = easeInOut(clamp01((u - 0.1) / 0.9)), ey = easeOut(u);
      const hop = Math.sin(Math.PI * clamp01(u / 0.5)) * 2.2;
      rig.position.set(a.pos.x + (b.pos.x - a.pos.x) * ed, a.pos.y + (b.pos.y - a.pos.y) * ey + hop * (1 - ed), a.pos.z + (b.pos.z - a.pos.z) * ed);
      const arc = Math.sin(Math.PI * ed);
      rig.rotation.set(a.rot.x + (b.rot.x - a.rot.x) * ed - arc * 0.12, a.rot.y + (b.rot.y - a.rot.y) * ed + arc * 0.14, a.rot.z + (b.rot.z - a.rot.z) * ed);
      const hover = clamp01(u * 2 - 1);
      rig.position.y += hover * 0.14 * Math.sin(now / 650);
      rig.rotation.z += hover * 0.008 * Math.sin(now / 900);
      rig.rotation.x += hover * 0.007 * Math.sin(now / 1100);
      shadow.position.set(rig.position.x + 0.6, rig.position.y - BH / 2 - 2.2, rig.position.z);
      shadowMat.opacity = 0.55 * clamp01(u);
    }

    // ---------- input: keys + click-through to demo ----------
    const raycaster = new THREE.Raycaster(), ndc = new THREE.Vector2();
    const demoAt = e => {
      const c = deck[shown]; if (!c || !c.p || !c.p.demoUrl) return null;
      const r = canvas.getBoundingClientRect();
      ndc.set((e.clientX - r.left) / r.width * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      raycaster.setFromCamera(ndc, camera);
      return raycaster.intersectObjects([staticTop, staticBottom], false).length ? c.p.demoUrl : null;
    };
    const onClick = e => { const u = demoAt(e); if (u) window.open(u, '_blank', 'noopener'); };
    const onMove = e => { canvas.style.cursor = demoAt(e) ? 'pointer' : ''; };
    const onKey = e => {
      if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey || /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName || '') || document.activeElement?.isContentEditable) return;
      const m = metrics(); if (!m.pinned) return;
      const fwd = e.key === 'ArrowDown' || e.key === 'ArrowRight', back = e.key === 'ArrowUp' || e.key === 'ArrowLeft';
      if (!fwd && !back) return;
      const base = targetFor(m.p), to = base + (fwd ? 1 : -1);
      if (to < 0 || to >= N) return;                         // at the ends, let the page scroll on
      e.preventDefault();
      window.scrollTo({ top: scrollFor(to), behavior: 'instant' });
    };
    canvas.addEventListener('click', onClick);
    canvas.addEventListener('pointermove', onMove);
    addEventListener('keydown', onKey);

    // ---------- loop ----------
    const lerpColor = (a, b, t) => { const x = parseInt(a.slice(1), 16), y = parseInt(b.slice(1), 16); const ch = s => Math.round(((x >> s) & 255) + (((y >> s) & 255) - ((x >> s) & 255)) * t); return `rgb(${ch(16)},${ch(8)},${ch(0)})`; };
    const loop = (now = performance.now()) => {
      const m = metrics();
      const u = freeze ? 1 : clamp01((m.enter - 0.2) / 0.8);
      // house lights: dim on the way in, up again over the last card and the exit
      const dim = freeze ? 1 : Math.min(0.45 * clamp01((m.enter - 0.8) / 0.2) + 0.55 * clamp01(m.p * N / 0.7), 1 - clamp01(m.exit * 1.6));   // lights go down as the crank starts
      stage.style.background = lerpColor(PEACH, HOUSE, easeInOut(clamp01(dim)));
      flash *= 0.86;
      glowEl.style.opacity = (dim * (0.85 + 0.15 * Math.sin(now / 90) * Math.sin(now / 37) + flash * 0.35)).toFixed(3);
      grainEl.style.opacity = (dim * 0.09).toFixed(3);
      hud.style.opacity = capEl.style.opacity = clamp01(dim * 1.4 - 0.3).toFixed(3);
      if (!freeze) {
        target = targetFor(m.p);
        if (u < 0.98 && !anim) { page = target; }           // still arriving: no flips yet, just be on the right card
        stepPaging(now);
      } else {
        anim = freeze.p > 0 ? { from: freeze.i, to: freeze.i + 1, start: now - freeze.p * FLIP_MS } : null; page = freeze.i;
      }
      pose(u, now);
      bulbMat.emissiveIntensity = 2.6 + 2 * dim + 0.25 * Math.sin(now / 900) + flash;
      bulbLight.intensity = 10 + 4 * dim + flash * 4;
      const j = drawPaging(now);
      if (j !== shown) onShown(j);
      crank.rotation.x = (anim ? anim.from + (anim.to - anim.from) * Math.min(1, (now - anim.start) / FLIP_MS) : page) * (Math.PI / 2);
      prefetch(j);
      renderer.render(scene, camera);
    };

    Object.assign(gl, {
      pending: false, renderer, loop, ready, scene, disposables, ro, envRT, onClick, onMove, onKey,
      debug: {
        freeze(i, p = 0) { freeze = { i, p }; return Promise.all([tex(i), tex(i + 1)]); },
        unfreeze() { freeze = null; },
        ready: () => Promise.all(deck.map((_, i) => tex(i))),
        N,
      },
    });
    await Promise.all([tex(0), tex(1), tex(targetFor(metrics().p))]);
    if (!alive) return;
    page = targetFor(metrics().p);
    renderer.setAnimationLoop(nearby ? loop : null);
  }

  return {
    get debug() { return gl && gl.debug; },
    destroy() {
      removeEventListener('portfolio:open-project', onOpenProject);
      alive = false;
      io.disconnect();
      if (gl && !gl.pending) {
        gl.renderer.setAnimationLoop(null);
        removeEventListener('keydown', gl.onKey);
        canvas.removeEventListener('click', gl.onClick);
        canvas.removeEventListener('pointermove', gl.onMove);
        gl.ro.disconnect();
        gl.scene.traverse(o => { if (o.isSprite) o.geometry?.dispose?.(); });
        for (const d of gl.disposables) d.dispose?.();
        for (const t of gl.ready.values()) t.dispose();
        gl.envRT.dispose();
        gl.renderer.dispose();
        gl.renderer.forceContextLoss?.();
      }
      container.innerHTML = '';
      window.ScrollTrigger?.refresh?.();
    },
  };
}
