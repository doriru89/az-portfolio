// Icon wallpaper — owned by the shell agent. A faint, sparse field of hand-drawn line icons (24x24, stroke 1.5)
// behind everything, with gentle scroll + mouse parallax. A few "hot" icons (one per project) are coloured;
// hover shows a label, click calls onOpen(projectId).
// mountIconField(el, { projects, colors, onOpen, reducedMotion }) -> { destroy() }
const P = (d) => `<path d="${d}"/>`;
export const ICONS = {
  computer: P('M4 3h16v12H4z') + P('M7 6h10v6H7z') + P('M9 15l-1 3h8l-1-3') + P('M5 21h14') + P('M15 10h1'),
  joystick: P('M5 16h14v4H5z') + P('M12 16V9') + '<circle cx="12" cy="6.5" r="2.5"/>' + P('M16 18h1') + P('M8 14l1-2'),
  cassette: P('M3 6h18v12H3z') + '<circle cx="8.5" cy="11" r="1.6"/><circle cx="15.5" cy="11" r="1.6"/>' + P('M10.1 11h3.8') + P('M7 18l1.5-3h7L17 18'),
  floppy: P('M4 4h13l3 3v13H4z') + P('M7 4v5h8V4') + P('M12.5 5.5v2') + P('M7 20v-6h10v6'),
  camera: P('M3 8h4l2-2.5h6L17 8h4v11H3z') + '<circle cx="12" cy="13" r="3.5"/>' + P('M18 10.5h.5'),
  cat: P('M5 20c0-6 2-8 7-8s7 2 7 8') + P('M7 12.8L6 6l4 3.5') + P('M17 12.8L18 6l-4 3.5') + P('M10 15.5h.01M14 15.5h.01') + P('M11.2 17.4h1.6'),
  pin: P('M12 21s-6.5-6.2-6.5-11a6.5 6.5 0 0113 0c0 4.8-6.5 11-6.5 11z') + '<circle cx="12" cy="10" r="2.3"/>',
  graph: '<circle cx="6" cy="6" r="2.2"/><circle cx="18" cy="8" r="2.2"/><circle cx="9" cy="18" r="2.2"/><circle cx="19" cy="18.5" r="1.6"/>' + P('M8 7l7.9.7M7 8l1.6 7.8M11.1 17.6l6.3.7M17.6 10.1l1.2 6.8'),
  terminal: P('M3 4h18v16H3z') + P('M3 8h18') + P('M7 12l3 2.2L7 16.4') + P('M12 17h5'),
  gameboy: P('M6 2.5h12v19H6z') + P('M8.5 5h7v6h-7z') + P('M9.5 15v3M8 16.5h3') + '<circle cx="14.5" cy="15.5" r=".6"/><circle cx="16" cy="17.5" r=".6"/>',
  headphones: P('M4 15v-3a8 8 0 0116 0v3') + P('M4 14h3v6H4zM17 14h3v6h-3z'),
  bulb: P('M9 17h6M10 20h4') + P('M8.5 14.5A6 6 0 1115.5 14.5c-.7.6-1 1.5-1 2.5h-5c0-1-.3-1.9-1-2.5z'),
  heart: P('M7 4h4v2h2V4h4v2h2v5h-2v2h-2v2h-2v2h-2v-2H9v-2H7v-2H5V6h2z'),
  mouse: P('M7 9a5 5 0 0110 0v6a5 5 0 01-10 0z') + P('M12 4v5M7 10h10') + P('M12 4c0-2 2-2 3-3'),
  compass: '<circle cx="12" cy="12" r="9"/>' + P('M15.5 8.5l-2 5-5 2 2-5z'),
  plant: P('M7 15h10l-1.5 6h-7z') + P('M12 15V8') + P('M12 10c-3 0-5-2-5-5 3 0 5 2 5 5zM12 9c0-3 2-5 5-5 0 3-2 5-5 5z'),
  laptop: P('M5 5h14v10H5z') + P('M2.5 18h19l-1.5-3H4z') + P('M10.5 16.5h3'),
  cross: P('M9 3h6v6h6v6h-6v6H9v-6H3V9h6z'),
  coffee: P('M5 9h11v6a5 5 0 01-5 5h-1a5 5 0 01-5-5z') + P('M16 11h1.5a2.5 2.5 0 010 5H16') + P('M8 3.5c0 1.5 1 1.5 1 3M12 3.5c0 1.5 1 1.5 1 3'),
  fold: P('M4 4h7v16H4z') + P('M13 4h7v16h-7z') + P('M8 12h8M14 9.5l2.5 2.5-2.5 2.5'),
  rocket: P('M12 2.5c3 2.5 4.5 6 4.5 10L14 16h-4l-2.5-3.5c0-4 1.5-7.5 4.5-10z') + '<circle cx="12" cy="9.5" r="1.6"/>' + P('M7.5 12.5L5 15l1 3 3-2M16.5 12.5L19 15l-1 3-3-2M11 19l1 2.5 1-2.5'),
};
// project id -> icon + where it lives (fractions of the viewport; kept in the side margins, clear of the hero copy)
// 2026-11-06 Austin: CareCost ↔ Asteria and Lenovo ↔ Artopath swapped (CareCost + Lenovo up top, Asteria + Artopath by the bear)
const HOT = { carecost: ['cross', .08, .24], aios: ['terminal', .1, .68], lenovo: ['laptop', .9, .22], asteria: ['terminal', .1, .68], artopath: ['graph', .9, .64], shop: ['compass', .5, .14, .5, .56], ridecompare: ['fold', .9, .43, .5, .15] };   // ridecompare (2026-11-06): desktop right margin between Lenovo and Artopath (the pixel heart's old slot); phone: top band under the nav, centred   // shop: centred between the nav and the name; phone (4th/5th = x,y): the lower band, between Asteria and Artopath

// 2026-11-05 Austin: four more, more visible, pixel style. Placeholder slots for projects he will add later.
// 10x10 sprites: '#' = colour A, '+' = colour B, '.' = empty. Rendered as crisp SVG rects.
const SPRITES = {
  invader: ['..#....#..', '...#..#...', '..######..', '.##.##.##.', '##########', '#.######.#', '#.#....#.#', '...##.##..', '..........', '..........'],
  heart:   ['..........', '.##...##..', '#++#.#++#.', '#++###++#.', '#+++++++#.', '.#+++++#..', '..#+++#...', '...#+#....', '....#.....', '..........'],
  pad:     ['..........', '.########.', '#.+......#', '#+++..#.##', '#.+..#.#.#', '#........#', '.###..###.', '..........', '..........', '..........'],
  star:    ['....#.....', '....#.....', '...#+#....', '####+####.', '.#+++++#..', '..#+++#...', '..#+.+#...', '.#+...+#..', '.#.....#..', '..........'],
};
const PIXEL_SLOTS = [  // [sprite, x, y(fraction of viewport), colourA idx, colourB idx]
  ['invader', .05, .52, 3, 3], ['pad', .21, .13, 4, 2], ['star', .79, .88, 2, 1],   // heart slot (.95,.46) became Ride Compare on 2026-11-06
];
const pixelSvg = (rows, a, b) => `<svg viewBox="0 0 10 10" shape-rendering="crispEdges" aria-hidden="true">${rows.map((r, y) => [...r].map((c, x) =>
  c === '#' ? `<rect x="${x}" y="${y}" width="1" height="1" fill="${a}"/>` : c === '+' ? `<rect x="${x}" y="${y}" width="1" height="1" fill="${b}"/>` : '').join('')).join('')}</svg>`;

function rnd(seed) { return () => (seed = (seed * 16807) % 2147483647) / 2147483647; }

export function mountIconField(el, { projects = [], colors = [], onOpen = () => {}, reducedMotion = false } = {}) {
  const layer = document.createElement('div');
  layer.className = 'icon-field__layer';
  el.appendChild(layer);
  const names = Object.keys(ICONS).filter(n => !['cross', 'laptop', 'terminal', 'graph', 'fold'].includes(n));
  const svg = (n, sw = 1.5) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[n]}</svg>`;
  let hots = [];

  function build() {
    const W = innerWidth, H = innerHeight, mobile = W <= 640;
    const tall = H * 1.5;                                 // layer is taller than the screen; scroll slides it up
    layer.style.height = tall + 'px';
    const cell = mobile ? 130 : 190, r = rnd(7);
    let html = '', i = 0;
    for (let y = 0; y < tall; y += cell) for (let x = 0; x < W; x += cell) {
      if (r() < 0.42) { r(); r(); continue; }                // sparse: drop ~40% of the cells
      const s = (mobile ? 22 : 26) + r() * 14, px = x + r() * (cell - s), py = y + r() * (cell - s), rot = (r() - .5) * 36;
      html += `<i class="ico" style="left:${px | 0}px;top:${py | 0}px;width:${s | 0}px;height:${s | 0}px;transform:rotate(${rot | 0}deg)">${svg(names[i++ % names.length])}</i>`;
    }
    layer.innerHTML = html;
    hots = [];
    projects.forEach((p, j) => {
      const h = HOT[p.id]; if (!h) return;
      const b = document.createElement('button');
      const s = mobile ? 30 : 40;
      const hx = mobile && h[3] != null ? h[3] : h[1];
      b.className = `ico ico--hot ico--named ${hx < 0.5 ? 'ico--l' : hx > 0.5 ? 'ico--r' : 'ico--c'}`; b.type = 'button';   // named: label always on (2026-11-05); side from the x actually used (phone may differ, 2026-11-06)
      b.setAttribute('aria-label', `Open ${p.name}`);
      const hy = mobile ? (h[4] != null ? h[4] : Math.min(Math.max(h[2], 0.2), 0.56)) : h[2];   // an explicit phone y is trusted; a desktop y is clamped (2026-11-06)   // phone: the bear's ears reach ~0.69H, keep every project icon (and its label) above them (and under the nav pill)
      Object.assign(b.style, { left: `calc(${hx * 100}% - ${s / 2}px)`, top: `${hy * H}px`, width: s + 'px', height: s + 'px', color: colors[j % colors.length] || 'currentColor' });
      b.innerHTML = svg(h[0], 1.8) + `<span class="ico__label">${p.name}</span>`;
      b.addEventListener('click', () => onOpen(p.id));
      layer.appendChild(b); hots.push(b);
    });
    // pixel slots (more visible; label says more projects are coming)
    PIXEL_SLOTS.forEach(([name, fx, fy, ca, cb]) => {
      const b = document.createElement('button');
      b.className = 'ico ico--hot ico--pixel'; b.type = 'button';
      b.setAttribute('aria-label', 'More projects coming soon');
      const s = mobile ? 34 : 46;
      Object.assign(b.style, { left: `calc(${fx * 100}% - ${s / 2}px)`, top: `${fy * H}px`, width: s + 'px', height: s + 'px' });
      b.innerHTML = pixelSvg(SPRITES[name], colors[ca] || '#1e0f3c', colors[cb] || '#1e0f3c') + '<span class="ico__label">More soon ✦</span>';
      b.addEventListener('click', () => onOpen(null));   // no project yet: open the reel from the start
      layer.appendChild(b); hots.push(b);
    });
  }

  const m = { x: 0, y: 0, tx: 0, ty: 0 };
  const onMove = e => { m.tx = (e.clientX / innerWidth - .5) * 2; m.ty = (e.clientY / innerHeight - .5) * 2; };
  let raf = 0;
  function tick() {
    const max = Math.max(1, document.documentElement.scrollHeight - innerHeight);
    const p = Math.min(1, scrollY / max);
    m.x += (m.tx - m.x) * .05; m.y += (m.ty - m.y) * .05;
    layer.style.transform = `translate3d(${(-m.x * 8).toFixed(2)}px, ${(-p * innerHeight * .5 - m.y * 8).toFixed(2)}px, 0)`;
    raf = requestAnimationFrame(tick);
  }
  build();
  addEventListener('resize', build);
  if (!reducedMotion) { addEventListener('mousemove', onMove, { passive: true }); tick(); }
  return { destroy() { cancelAnimationFrame(raf); removeEventListener('resize', build); removeEventListener('mousemove', onMove); layer.remove(); } };
}
