// Opening "BC" — resolution ramp with the 3D bear as the subject.
// OPENING CONTRACT: export default async function play(ctx) — see index.html.
//
// One full-screen ShaderMaterial pass over (bear render target + hero-text canvas + ribbon field):
//   ASCII mode : cell → glyph from a canvas-drawn atlas (ramp + shade blocks + marquee letters)
//   PIXEL mode : cell → composite colour, Atari palette / posterize + 4x4 Bayer dither
// The cell size steps down discretely (ASCII 16→12→9, pixels 9→6→4→3→2→1) until the frame is the
// clean render; the last frame is pixel-identical in layout to the DOM hero, then we hand off.
//
// Beats (t = seconds after the shared intro resolves, INTRO_END 0.68s):
//   0.00  first frame = five solid ribbons drawn as full-block glyphs (DOM intro removed under it)
//   0.00–0.45  blocks decay █▓▒░ into marquee text rows as an ORDERED sweep (each ribbon from the side it flew in,
//              Bayer-staggered, 2×2 chunky shade blocks) — 2026-11-05 review: the old per-cell random decay read as TV static
//   0.15–1.00  bear rises from the bottom in ASCII; rows drain top→bottom (Bayer-ordered), only bear cells stay
//   0.42–0.92  AUSTIN ZHENG scrambles in as ASCII tinted with the ribbon stripes (5 per line, like AB)
//   0.85  ASCII cell 16 → 12
//   1.10  ASCII → chunky Atari-palette pixels (10px); black → peach dither sweep rises from the bottom; the name keeps
//         its stripes until the sweep line passes it, then it is ink
//   …pixels 10 → 7 → 5 → 4 → 3 → 2 → 1.5 (posterize 4 → 6 → 10 → 18) → clean at 1.95, hand-off 2.12 (≈2.8s total)

// 2026-11-05 Austin: "it stalls for a moment while the bear is still ASCII". Measured: no dropped frames — the bear's
// cubic rise was parked by t≈0.6 and the pixel stage only began at 1.30, so ~0.6s of near-static ASCII read as a
// freeze. Now the rise is quadratic and lasts until the pixel stage starts (1.10), the ASCII glyphs shimmer while
// they wait, and the later stages are pulled forward (≈2.8s total).
const T = {
  decay: [0.0, 0.45],
  rise: [0.15, 1.15],
  drain: [0.45, 1.05],
  text: [0.42, 0.92],
  bg: [1.10, 1.86],
  nav: 1.80,
  end: 2.12,
};
// [startTime, mode(0 ascii / 1 pixel), cell css px, colour mode (0 Atari palette, n = posterize levels, -1 clean)]
const STAGES = [
  [0.00, 0, 16, 0],
  [0.85, 0, 12, 0],
  [1.10, 1, 10, 0],
  [1.28, 1, 7, 0],
  [1.40, 1, 5, 0],
  [1.52, 1, 4, 4],
  [1.63, 1, 3, 6],
  [1.72, 1, 2, 10],
  [1.84, 1, 1.5, 18],
  [1.95, 1, 1, -1],
];

// debug: ?bct=<seconds> freezes the BC timeline at that time (for deterministic screenshots)
const FREEZE = (() => { const v = new URLSearchParams(location.search).get('bct'); return v === null ? -1 : parseFloat(v); })();

const RAMP = [' ', '.', ':', '-', '=', '+', '*', '#', '%', '@'];   // 0..9
const SHADE0 = RAMP.length;                                        // 10..13 = ░ ▒ ▓ █
const MSG = 'AUSTIN ZHENG * PRODUCT * AI * DESIGN * BUILDER * ';
const MSG0 = SHADE0 + 4;
const SLOT = 48;

function buildAtlas() {
  const n = MSG0 + MSG.length;
  const c = document.createElement('canvas');
  c.width = n * SLOT; c.height = SLOT;
  const g = c.getContext('2d');
  g.fillStyle = '#fff';
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.font = `700 ${SLOT * 0.82}px "JetBrains Mono", ui-monospace, Menlo, monospace`;
  const glyph = (ch, i) => g.fillText(ch, i * SLOT + SLOT / 2, SLOT / 2 + SLOT * 0.04);
  RAMP.forEach(glyph);
  // shade blocks drawn procedurally (fonts rarely agree on these): 2×2 quads per cell, so ░▒▓ read as
  // deliberate chunky pixels (1, 2, 3 of 4 quads lit), not fine-grain noise
  const q = SLOT / 2;
  [[1, 0, 0, 0], [1, 0, 0, 1], [1, 1, 0, 1], [1, 1, 1, 1]].forEach((quads, k) => {
    const x0 = (SHADE0 + k) * SLOT;
    quads.forEach((on, i) => { if (on) g.fillRect(x0 + (i & 1) * q, (i >> 1) * q, q, q); });
  });
  [...MSG].forEach((ch, i) => glyph(ch, MSG0 + i));
  return { canvas: c, count: n };
}

const VERT = /* glsl */`
varying vec2 vUv;
void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;

const FRAG = /* glsl */`
precision highp float;
uniform sampler2D tScene, tText, tTextR, tGlyph, tIcon;
uniform float uIconCell;
uniform vec2 uRes;
uniform float uCell, uMode, uColorMode, uTime, uPR;
uniform float uDecay, uDrain, uText, uBg, uRowShift;
uniform float uGlyphCount, uRamp0, uShade0, uMsg0, uMsgLen;
uniform vec3 uAtari[5];
uniform vec3 uPal[10];
uniform vec3 uPeach, uInk;
varying vec2 vUv;

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float bayer4(vec2 p) {
  vec2 q = mod(floor(p), 4.0);
  int i = int(q.x + q.y * 4.0);
  float m[16];
  m[0]=0.;m[1]=8.;m[2]=2.;m[3]=10.;m[4]=12.;m[5]=4.;m[6]=14.;m[7]=6.;
  m[8]=3.;m[9]=11.;m[10]=1.;m[11]=9.;m[12]=15.;m[13]=7.;m[14]=13.;m[15]=5.;
  for (int k = 0; k < 16; k++) if (k == i) return (m[k] + 0.5) / 16.0;
  return 0.5;
}
vec3 toSRGB(vec3 c) { c = max(c, 0.0); return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c)); }
float luma(vec3 c) { return dot(c, vec3(0.299, 0.587, 0.114)); }

// bear: premultiplied linear → straight sRGB + alpha
vec4 bearAt(vec2 uv) {
  vec4 s = texture2D(tScene, uv);
  vec3 c = s.a > 0.001 ? s.rgb / s.a : vec3(0.0);
  return vec4(toSRGB(c), clamp(s.a, 0.0, 1.0));
}
vec4 bearCell(vec2 uvC, vec2 cellUv) {
  // 5 taps for stable coverage inside a cell
  vec4 a = bearAt(uvC);
  vec4 b = bearAt(uvC + cellUv * vec2(-0.3, -0.3));
  vec4 c = bearAt(uvC + cellUv * vec2( 0.3, -0.3));
  vec4 d = bearAt(uvC + cellUv * vec2(-0.3,  0.3));
  vec4 e = bearAt(uvC + cellUv * vec2( 0.3,  0.3));
  float al = (a.a + b.a + c.a + d.a + e.a) / 5.0;
  vec3 col = (a.rgb * a.a + b.rgb * b.a + c.rgb * c.a + d.rgb * d.a + e.rgb * e.a) / max(1e-4, al * 5.0);
  return vec4(col, al);
}
vec3 band(float y) {           // y: 0 top → 1 bottom (DOM ribbons: 5 × 20vh)
  float i = clamp(floor(y * 5.0), 0.0, 4.0);
  vec3 c = uAtari[0];
  if (i > 0.5) c = uAtari[1];
  if (i > 1.5) c = uAtari[2];
  if (i > 2.5) c = uAtari[3];
  if (i > 3.5) c = uAtari[4];
  return c;
}
float glyphMask(float idx, vec2 f) {
  vec2 uv = vec2((idx + f.x) / uGlyphCount, f.y);
  return texture2D(tGlyph, uv).r;
}
vec3 nearestPal(vec3 c) {
  vec3 best = uPal[0]; float bd = 1e9;
  for (int k = 0; k < 10; k++) {
    vec3 d = c - uPal[k];
    float dd = dot(d * vec3(0.30, 0.59, 0.11), d) ;
    if (dd < bd) { bd = dd; best = uPal[k]; }
  }
  return best;
}

vec3 nearestAscii(vec3 c) {     // Atari 5 + peach (greys/whites → peach)
  vec3 best = uPeach; float bd = 1e9;
  float sat = max(c.r, max(c.g, c.b)) - min(c.r, min(c.g, c.b));
  if (sat < 0.12) return mix(uPeach * 0.75, uPeach, step(0.45, luma(c)));
  for (int k = 0; k < 5; k++) {
    vec3 d = c / max(1e-3, max(c.r, max(c.g, c.b))) - uAtari[k] / max(1e-3, max(uAtari[k].r, max(uAtari[k].g, uAtari[k].b)));
    float dd = dot(d, d);
    if (dd < bd) { bd = dd; best = uAtari[k]; }
  }
  return best;
}

void main() {
  vec2 frag = vec2(vUv.x, 1.0 - vUv.y) * uRes;      // pixel coords, origin top-left
  float cell = uCell;
  vec2 cid = floor(frag / cell);
  vec2 f = fract(frag / cell);
  vec2 cCenter = (cid + 0.5) * cell;
  vec2 uvC = vec2(cCenter.x / uRes.x, 1.0 - cCenter.y / uRes.y);
  vec2 cellUv = vec2(cell / uRes.x, cell / uRes.y);
  float yN = cCenter.y / uRes.y;

  // background: black → peach through an ordered dither at cell scale
  float bgOn = step(bayer4(cid) * 0.5 + (1.0 - yN) * 0.5, uBg);
  vec3 bg = mix(vec3(0.0), uPeach, bgOn);

  vec4 text = texture2D(tText, uvC);
  vec4 textR = texture2D(tTextR, uvC);   // same text, name filled with the 5 ribbon stripes per line
  vec4 bear = cell > 1.01 ? bearCell(uvC, cellUv) : bearAt(vUv);

  if (uMode < 0.5) {
    // ───────── ASCII ─────────
    float h = hash(cid);
    float h2 = hash(cid + 17.3);
    float tick = floor(uTime * 14.0);
    float idx = 0.0;
    vec3 col = band(yN);

    // ribbon rows: █ → ▓ → ▒ → ░ → marquee letter, then drain
    float dir = mod(floor(yN * 5.0), 2.0) < 0.5 ? -1.0 : 1.0;   // ribbons flew in from alternating sides
    // ordered sweep: a front travels along each ribbon from the side it flew in, Bayer-staggered (no per-cell noise)
    float xs = dir < 0.0 ? cCenter.x / uRes.x : 1.0 - cCenter.x / uRes.x;
    float s = clamp((uDecay * 1.6 - (xs * 0.75 + bayer4(cid) * 0.25)) / 0.6, 0.0, 1.0);
    float row = cid.y;
    float mi = mod(floor(cid.x + dir * uRowShift + row * 7.0), uMsgLen);
    float ribbonIdx = s < 1.0 ? uShade0 + 3.0 - floor(s * 4.0) : uMsg0 + mi;
    float dr = clamp((uDrain * 1.45 - (yN * 0.7 + bayer4(cid + 2.0) * 0.3 + h2 * 0.05)) / 0.4, 0.0, 1.0);   // ordered drain, top→bottom
    if (dr > 0.0 && dr < 1.0) ribbonIdx = uRamp0 + 1.0 + floor(hash(cid + tick) * 8.0);
    float ribbonOn = 1.0 - step(1.0, dr);

    // bear glyph from luminance × coverage
    float bl = bear.a > 0.15 ? clamp(0.12 + (luma(bear.rgb) - 0.22) * 1.9, 0.12, 1.0) * smoothstep(0.15, 0.7, bear.a) : 0.0;
    if (bl > 0.0) bl = clamp(bl + (hash(cid + tick * 0.37) - 0.5) * 0.14, 0.08, 1.0);   // shimmer: the ASCII bear never sits still
    float bearIdx = uRamp0 + floor(bl * 9.49);

    // name/tagline: peach glyphs, scrambling in
    float tr = clamp((uText - h * 0.6) / 0.4, 0.0, 1.0);
    float tl = text.a * step(0.001, tr);
    float textIdx = tr < 1.0 ? uRamp0 + 1.0 + floor(hash(cid + tick + 3.1) * 8.0) : uRamp0 + floor(clamp(text.a * 1.2, 0.0, 1.0) * 9.49);

    vec3 gcol = col;
    if (ribbonOn > 0.5) idx = ribbonIdx;
    if (tl > 0.12) { idx = textIdx; gcol = textR.rgb; }
    if (bl > 0.06) { idx = bearIdx; gcol = dr >= 1.0 ? nearestAscii(bear.rgb) : col; }

    float m = idx > 0.5 ? glyphMask(idx, vec2(f.x, f.y)) : 0.0;
    vec3 outc = mix(bg, gcol, m);

    // project icons + labels: their own finer grid, so a 40 px icon is ~8×8 glyphs and reads as ASCII art
    vec2 fid = floor(frag / uIconCell);
    vec2 ff = fract(frag / uIconCell);
    vec2 fc = (fid + 0.5) * uIconCell;
    vec2 fuv = vec2(fc.x / uRes.x, 1.0 - fc.y / uRes.y);
    vec2 fd = vec2(uIconCell / uRes.x, uIconCell / uRes.y) * 0.3;
    vec4 i0 = texture2D(tIcon, fuv), i1 = texture2D(tIcon, fuv + fd * vec2(-1., -1.)), i2 = texture2D(tIcon, fuv + fd * vec2(1., -1.)),
         i3 = texture2D(tIcon, fuv + fd * vec2(-1., 1.)), i4 = texture2D(tIcon, fuv + fd * vec2(1., 1.));
    float ia = (i0.a + i1.a + i2.a + i3.a + i4.a) / 5.0;
    if (ia > 0.06 && bl <= 0.06) {
      vec3 icol = (i0.rgb * i0.a + i1.rgb * i1.a + i2.rgb * i2.a + i3.rgb * i3.a + i4.rgb * i4.a) / max(1e-4, ia * 5.0);
      float ir = clamp((uText - hash(fid + 5.7) * 0.6) / 0.4, 0.0, 1.0);
      float iidx = ir < 1.0 ? uRamp0 + 1.0 + floor(hash(fid + tick + 9.2) * 8.0) : uRamp0 + floor(clamp(0.25 + ia * 1.1, 0.0, 1.0) * 9.49);
      float im = step(0.001, ir) * glyphMask(iidx, ff);
      outc = mix(outc, icol, im);
    }
    gl_FragColor = vec4(outc, 1.0);
    return;
  }

  // ───────── PIXEL ─────────
  // name flips peach→ink exactly where the (undithered) sweep line has passed — keeps letters clean
  float swept = step((1.0 - yN) * 0.5 + 0.25, uBg);
  vec3 tcol = swept > 0.5 ? text.rgb : textR.rgb;
  vec4 icon = texture2D(tIcon, uvC);
  vec3 c = mix(bg, tcol, text.a);
  c = mix(c, icon.rgb, icon.a);
  c = mix(c, bear.rgb, bear.a);
  float fg = max(max(text.a, icon.a), bear.a);

  if (uColorMode > -0.5 && fg > 0.02) {   // quantize foreground only: bg already is a clean 1-bit dither
    float d = bayer4(cid) - 0.5;
    vec3 q;
    if (uColorMode < 0.5) q = nearestPal(c + d * 0.30);
    else q = floor(c * uColorMode + d + 0.5) / uColorMode;
    c = fg > 0.5 ? q : bg;
  }
  gl_FragColor = vec4(clamp(c, 0.0, 1.0), 1.0);
}`;

const clamp01 = x => Math.min(1, Math.max(0, x));
const prog = ([a, b], t) => clamp01((t - a) / (b - a));

// rainbow: fill the NAME with the five ribbon stripes per line (cap top → baseline+descent), tagline unchanged
function heroTextCanvas(hero, w, h, pr, rainbow = null) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  g.scale(pr, pr);
  const drawWords = (el, stripes) => {
    const cs = getComputedStyle(el);
    g.font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
    g.fillStyle = cs.color;
    g.textBaseline = 'alphabetic';
    if ('letterSpacing' in g) g.letterSpacing = cs.letterSpacing === 'normal' ? '0px' : cs.letterSpacing;
    const m = g.measureText('Hg');
    const asc = m.fontBoundingBoxAscent;
    const cap = g.measureText('AUSTINZHENG'), capA = cap.actualBoundingBoxAscent, capD = Math.max(0, cap.actualBoundingBoxDescent);
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    for (let node; (node = walker.nextNode());) {
      const txt = node.textContent;
      const re = /\S+/g;
      for (let mm; (mm = re.exec(txt));) {
        const r = document.createRange();
        r.setStart(node, mm.index); r.setEnd(node, mm.index + mm[0].length);
        const rect = r.getClientRects()[0];
        if (!rect) continue;
        const base = rect.top + asc;
        if (stripes) {
          const gr = g.createLinearGradient(0, base - capA, 0, base + capD);
          stripes.forEach((c, b) => { gr.addColorStop(b / 5, c); gr.addColorStop((b + 1) / 5 - 1e-4, c); });
          g.fillStyle = gr;
        }
        g.fillText(mm[0], rect.left, base);
      }
    }
  };
  drawWords(hero.name, rainbow);
  drawWords(hero.tagline, null);
  if (hero.eyebrow) drawWords(hero.eyebrow, null);
  return c;
}
function iconCanvas(w, h, pr, icons) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  g.scale(pr, pr);
  drawHotIcons(g, icons);
  return c;
}

// Project icons resolve with the bear: the hero's hot icons (already mounted under the opening) are drawn into the
// own texture at their live rects; the shader gives them a finer ASCII grid than the bear (a 40 px icon would be 3×3
// glyphs at the bear's cell size), then they sharpen through the pixel stages with the name,
// and the DOM icons take over at the hand-off in the same place.
async function loadHotIcons() {
  const out = [];
  for (const b of document.querySelectorAll('#icon-field .ico--hot')) {
    const svg = b.querySelector('svg'); if (!svg) continue;
    const r = b.getBoundingClientRect();
    const k = 4;   // raster at 4× so the icon is still crisp at the last (1 px) stage
    const s = svg.cloneNode(true);
    s.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    s.setAttribute('width', r.width * k); s.setAttribute('height', r.height * k);
    const color = getComputedStyle(b).color;
    const img = new Image();
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(s.outerHTML.replaceAll('currentColor', color));
    out.push({ b, img, color });
  }
  await Promise.all(out.map(o => o.img.decode().catch(() => {})));
  return out;
}

function drawHotIcons(g, icons) {
  for (const { b, img, color } of icons) {
    const r = b.getBoundingClientRect();
    const cs = getComputedStyle(b);
    g.save();
    g.globalAlpha = parseFloat(cs.opacity) || 1;
    if (img.complete && img.naturalWidth) g.drawImage(img, r.left, r.top, r.width, r.height);
    if (b.classList.contains('ico--named')) {
      // dashed ring (::before: inset -9px, 2px dashed, opacity .55)
      g.save(); g.globalAlpha *= 0.55; g.strokeStyle = color; g.lineWidth = 2; g.setLineDash([5, 4]);
      g.beginPath(); g.arc(r.left + r.width / 2, r.top + r.height / 2, r.width / 2 + 8, 0, Math.PI * 2); g.stroke(); g.restore();
      // Undertale label: ink outline + offset shadow, peach border, ink plate, "* " in a3 then the name in peach
      const l = b.querySelector('.ico__label');
      if (l) {
        const lr = l.getBoundingClientRect(), ls = getComputedStyle(l), bw = parseFloat(ls.borderTopWidth) || 0;
        g.fillStyle = 'rgba(30,15,60,.25)'; g.fillRect(lr.left + 1, lr.top + 1, lr.width + 4, lr.height + 4);
        g.fillStyle = ls.backgroundColor; g.fillRect(lr.left - 2, lr.top - 2, lr.width + 4, lr.height + 4);
        g.fillStyle = ls.borderTopColor; g.fillRect(lr.left, lr.top, lr.width, lr.height);
        g.fillStyle = ls.backgroundColor; g.fillRect(lr.left + bw, lr.top + bw, lr.width - 2 * bw, lr.height - 2 * bw);
        g.font = `${ls.fontWeight} ${ls.fontSize} ${ls.fontFamily}`;
        if ('letterSpacing' in g) g.letterSpacing = ls.letterSpacing === 'normal' ? '0px' : ls.letterSpacing;
        g.textBaseline = 'top';
        let x = lr.left + bw + parseFloat(ls.paddingLeft);
        const y = lr.top + bw + parseFloat(ls.paddingTop);
        g.fillStyle = getComputedStyle(l, '::before').color; g.fillText('* ', x, y); x += g.measureText('* ').width;
        g.fillStyle = ls.color; g.fillText(l.textContent, x, y);
      }
    }
    g.restore();
  }
}

export default async function play(ctx) {
  const { THREE, gsap, hero, bear, palette } = ctx;
  if (ctx.reducedMotion) { await ctx.intro().then(({ root }) => root.remove()).catch(() => {}); return ctx.showHero({ duration: 0 }); }

  // prep while the intro runs
  const fontsP = Promise.all([
    document.fonts.load('700 100px "Space Grotesk"'),
    document.fonts.load('400 20px "Space Grotesk"'),
    document.fonts.load('700 40px "JetBrains Mono"'),
    document.fonts.load('400 8px "Press Start 2P"'),
  ]).catch(() => {});
  const introP = ctx.intro();
  await fontsP;
  const icons = await loadHotIcons();

  const { renderer, scene, camera, rig, canvas } = bear;
  const prevPR = renderer.getPixelRatio();
  // cap the buffer at ~4 Mpx: the frame is cell-quantised anyway, and a 4K/5K viewport at 1.5× would be 4× the fill
  const pr = Math.min(devicePixelRatio, 1.5, Math.sqrt(4.0e6 / (innerWidth * innerHeight)));
  renderer.setPixelRatio(pr);
  renderer.setSize(innerWidth, innerHeight, false);

  const size = renderer.getDrawingBufferSize(new THREE.Vector2());
  const rt = new THREE.WebGLRenderTarget(size.x, size.y, { type: THREE.HalfFloatType, samples: 4, depthBuffer: true });
  const atlas = buildAtlas();
  const glyphTex = new THREE.CanvasTexture(atlas.canvas);
  glyphTex.minFilter = THREE.LinearFilter; glyphTex.generateMipmaps = false;
  const { ATARI, UI } = palette;
  const mkText = rainbow => { const t = new THREE.CanvasTexture(heroTextCanvas(hero, size.x, size.y, pr, rainbow)); t.minFilter = THREE.LinearFilter; t.generateMipmaps = false; return t; };
  let textTex = mkText(null), textTexR = mkText(ATARI);
  const mkIcon = () => { const t = new THREE.CanvasTexture(iconCanvas(size.x, size.y, pr, icons)); t.minFilter = THREE.LinearFilter; t.generateMipmaps = false; return t; };
  let iconTex = mkIcon();

  const raw = h => { const c = new THREE.Color(); c.setHex(parseInt(h.slice(1), 16), THREE.NoColorSpace); return new THREE.Vector3(c.r, c.g, c.b); };
  const pal = [ '#000000', UI.peach, UI.ink, ...ATARI, '#7a3e12', '#c49a5c' ].map(raw);

  const mat = new THREE.ShaderMaterial({
    vertexShader: VERT, fragmentShader: FRAG, depthTest: false, depthWrite: false,
    uniforms: {
      tScene: { value: rt.texture }, tText: { value: textTex }, tTextR: { value: textTexR }, tGlyph: { value: glyphTex }, tIcon: { value: iconTex }, uIconCell: { value: 5 * pr },
      uRes: { value: size.clone() }, uCell: { value: 16 * pr }, uMode: { value: 0 }, uColorMode: { value: 0 },
      uTime: { value: 0 }, uPR: { value: pr },
      uDecay: { value: 0 }, uDrain: { value: 0 }, uText: { value: 0 }, uBg: { value: 0 }, uRowShift: { value: 0 },
      uGlyphCount: { value: atlas.count }, uRamp0: { value: 0 }, uShade0: { value: SHADE0 }, uMsg0: { value: MSG0 }, uMsgLen: { value: MSG.length },
      uAtari: { value: ATARI.map(raw) }, uPal: { value: pal },
      uPeach: { value: raw(UI.peach) }, uInk: { value: raw(UI.ink) },
    },
  });
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat);
  quad.frustumCulled = false;
  const postScene = new THREE.Scene(); postScene.add(quad);
  const postCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

  const RISE_FROM = -5.2;
  rig.group.position.y = RISE_FROM;

  // warm-up while the DOM intro still covers the screen: shader link, render-target allocation and texture uploads
  // all happen now, not on the first visible frame (the bear canvas is at opacity 0, so nothing shows)
  renderer.setRenderTarget(rt); renderer.clear(); renderer.render(scene, camera);
  renderer.setRenderTarget(null); renderer.render(postScene, postCam);

  const { root } = await introP;
  const t0 = performance.now();
  let first = true;
  const U = mat.uniforms;

  await new Promise(resolve => {
    ctx.setRenderOverride(renderer => {
      const t = FREEZE >= 0 ? (window.__bct ?? FREEZE) : (performance.now() - t0) / 1000;
      // resize safety
      renderer.getDrawingBufferSize(size);
      if (size.x !== rt.width || size.y !== rt.height) {
        rt.setSize(size.x, size.y); U.uRes.value.copy(size);
        textTex.dispose(); textTexR.dispose(); textTex = mkText(null); textTexR = mkText(ATARI); U.tText.value = textTex; U.tTextR.value = textTexR;
        iconTex.dispose(); iconTex = mkIcon(); U.tIcon.value = iconTex;
      }

      if (t >= T.end) {
        // hand-off: DOM hero takes over at its exact rect, default render resumes on transparent clear
        rig.group.position.y = 0;
        gsap.set([hero.root, canvas], { opacity: 1 });
        ctx.setRenderOverride(null);
        renderer.setPixelRatio(prevPR);
        renderer.setSize(innerWidth, innerHeight, false);
        renderer.setRenderTarget(null);
        renderer.render(scene, camera);
        rt.dispose(); mat.dispose(); quad.geometry.dispose(); glyphTex.dispose(); textTex.dispose(); textTexR.dispose(); iconTex.dispose();
        resolve();
        return;
      }

      if (t >= T.nav && ctx.showNav) ctx.showNav();   // screen is clean peach by now: nav slides in with the hero
      let st = STAGES[0];
      for (const s of STAGES) if (t >= s[0]) st = s;
      // narrow screens: smaller cells so the name is still legible as ASCII (390px phone: 16 → ~10px)
      const cellK = Math.max(0.6, Math.min(1, innerWidth / 900));
      U.uMode.value = st[1]; U.uCell.value = (st[2] >= 3 ? Math.max(3, st[2] * cellK) : st[2]) * pr; U.uColorMode.value = st[3];
      U.uTime.value = t;
      U.uDecay.value = prog(T.decay, t);
      U.uDrain.value = prog(T.drain, t);
      U.uText.value = prog(T.text, t);
      U.uBg.value = prog(T.bg, t) * 1.0001;
      U.uRowShift.value = t * 9;
      const r = prog(T.rise, t);
      rig.group.position.y = RISE_FROM * Math.pow(1 - r, 2);   // quadratic: still visibly climbing when the pixels start

      renderer.setRenderTarget(rt);
      renderer.clear();
      renderer.render(scene, camera);
      renderer.setRenderTarget(null);
      renderer.render(postScene, postCam);

      if (first) { first = false; canvas.style.opacity = '1'; root.remove(); window.__bcReady = true; }
    });
  });
}
