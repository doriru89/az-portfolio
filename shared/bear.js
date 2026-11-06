// Bear rig — CONTRACT (owned by the bear agent; keep the export shape stable).
//   createBearRig(THREE) -> {
//     group,            // THREE.Group, add to scene. Head centred at y=0, ears y≈1.55, chin y≈-1.0
//     head,             // THREE.Group that turns toward the mouse
//     riders,           // THREE.Group parented to head, sits on top of the head between the ears (cats + rabbit go here)
//     update(dt, mouse) // call every frame; mouse = {x,y} in [-1,1] (NDC). Handles mouse-follow + idle drift
//   }
//   optional 2nd arg: createBearRig(THREE, { riderScale: 0.8 }) — scales the rider trio about its seat point
//   addBearLights(THREE, scene)
//   Every outlined part carries a child mesh named 'outline' (BackSide hull, same geometry); traversals that measure
//   vertex bounds see the same extents. New head parts (2026-11-05): leftCheek/rightCheek, jaw, neck, shoulders.
// Skull + ears ported 1:1 from personal-website/app/components/bear/BearGeometry.ts (2026-11-05).
// Face reworked 2026-11-05; riders (ginger longhair cat · grey rabbit · brown tabby) built procedurally.
//
// WHY THE OLD FACE FAILED — and what makes a faceted mascot face read as friendly:
//  1. Features must SIT ON the surface. The old eyes (z=1.2) and nose were buried inside the r=1.8 skull,
//     so the face showed only a stray triangle. Every face part is now ray-cast onto the faceted skull /
//     muzzle and pushed out along the surface normal, so it can never sink into a facet again.
//  2. The muzzle is a separate, LIGHTER volume (MetaMask fox, Kenney/Quaternius animals, Duolingo-style
//     bears all do this). A cream ellipsoid that protrudes ~0.3 from the skull gives the face a focal
//     point, a value contrast, and a readable shape even at 80px.
//  3. Nose = rounded inverted triangle, wide on top, the darkest and biggest thing on the muzzle, set at
//     the top-front of the muzzle with a small specular highlight so it reads as wet/soft, not a hole.
//  4. Mouth line = philtrum + "ω". A short vertical stroke from the nose into two U arcs is the single
//     cheapest cue for "content / smiling animal"; without it a low-poly snout reads as a blank block.
//  5. Eyes: large-ish, set WIDE and LOW (at or slightly below the horizontal midline — baby-schema
//     proportions), slightly taller than wide, angled to face forward (not along the side normals),
//     each with one bright highlight on the same side (shared light direction = they look alive).
//  6. Keep the face sparse and high-contrast: 3 dark shapes (2 eyes + nose) forming a triangle is what
//     survives downscaling to a logo; small details (mouth, blush, highlights) are bonuses at hero size.
//  7. A faint warm blush facet on each cheek softens the big flat cheek planes without changing palette.
//  8. Life comes from rare, small motions (blink every 2–6 s, ear twitch, tail sway) — constant motion
//     reads as mechanical; the riders also glance toward the cursor so the group feels attentive.
//
// 2026-11-05 LOOK v2 (toon): every part is MeshToonMaterial with a 3-band NearestFilter ramp (+ hemisphere
// sky/ground tint), flat facets kept by rendering non-indexed geometry with per-face normals, a warm key +
// cool rim light, vertex-colour "AO" on the undersides, and a geometry outline: an inverted-hull (BackSide)
// shell per part whose thickness is computed in the vertex shader to be ~1.5 css px at any framing (capped in
// world units so the pixel/ASCII openings and the 148px dock never get a fat border). No post-processing —
// the page's single renderer is shared with openings that render the rig to small targets and quantise it.
export const COLORS = {
  body: '#C49A5C', bodyDark: '#8B6914', bodyLight: '#E0C088',   // 2026-11-05 Austin: back to the pre-toon values
  ear: '#F0C060', nose: '#2a1a0a', eye: '#1a0a00', snout: '#D4B070',
  muzzle: '#EBD3A4', blush: '#E0A27A', highlight: '#FFFFFF',
  earInner: '#E6A077',      // warm inner ear (toon v2)
  outline: '#3A2116',       // inverted-hull outline: dark brown, not black
};
export const RIDER_COLORS = {
  ginger: '#F5B638', gingerDark: '#D9921E', cream: '#FBE7B0',   // 2026-11-05: more yellow (Austin)
  tabby: '#7E6550', tabbyDark: '#3E2B1F', white: '#F5EFE7',
  rabbit: '#A9A3AF', rabbitLight: '#EFEBEE', pink: '#F0A3B2', pinkDark: '#D9788E',
  catNose: '#D9788E', catEye: '#1a1208',
};

// toon ramp: 6 texels over dotNL∈[-1,1] → the lit hemisphere gets 3 bands (shadow / mid / lit); the back gets
// only the hemisphere + fill light. NearestFilter = hard steps, which also quantise cleanly in the pixel openings.
let rampTex = null;
function toonRamp(THREE) {
  if (rampTex) return rampTex;
  const steps = [0, 0, 0, 0.40, 0.72, 1.0];
  rampTex = new THREE.DataTexture(new Uint8Array(steps.map(v => Math.round(v * 255))), steps.length, 1, THREE.RedFormat);
  rampTex.minFilter = rampTex.magFilter = THREE.NearestFilter; rampTex.generateMipmaps = false; rampTex.needsUpdate = true;
  return rampTex;
}
// inverted-hull outline material: BackSide shell pushed out along the (smooth, radial) normal in VIEW space by
// `uPx` buffer pixels, capped at `uMax` world units. uViewH is refreshed per draw from the current target.
function outlineMaterial(THREE) {
  return new THREE.ShaderMaterial({
    name: 'bearOutline',
    uniforms: { uColor: { value: new THREE.Color(COLORS.outline) }, uPx: { value: 1.5 }, uViewH: { value: 800 }, uMax: { value: 0.045 } },
    vertexShader: `
      uniform float uPx, uViewH, uMax;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vec3 n = normalize(normalMatrix * normal);
        float d = max(-mv.z, 0.05);
        float pxPerUnit = projectionMatrix[1][1] * uViewH * 0.5 / d;
        float off = min(uPx / pxPerUnit, uMax);
        mv.xyz += n * off;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      uniform vec3 uColor;
      void main() { gl_FragColor = vec4(uColor, 1.0);
      #include <colorspace_fragment>
      }`,
    side: THREE.BackSide,
  });
}

export function createBearRig(THREE, { riderScale = 1 } = {}) {
  const cache = new Map();
  const mat = (c, emissive, vc) => {
    const k = c + (emissive ? '*' : '') + (vc ? '+' : '');
    // 2026-11-05 Austin: "不需要这么明显的光影，以前那样就很好" — flat-shaded standard material again (the toon
    // ramp + vertex AO are kept in the file but unused: vertexColors stays off). The outline hull stays.
    if (!cache.has(k)) cache.set(k, new THREE.MeshStandardMaterial({
      color: new THREE.Color(c), roughness: 0.65, metalness: 0.08, flatShading: true,
      ...(emissive ? { emissive: new THREE.Color(c), emissiveIntensity: 0.6 } : {}),
    }));
    return cache.get(k);
  };
  // MeshToonMaterial has no flatShading: unweld the geometry so every face carries its own normal (facets stay)
  const flat = geo => { const g = geo.index ? geo.toNonIndexed() : geo; g.computeVertexNormals(); g.userData.src = geo; return g; };
  const mesh = (geo, c, pos, rot, name, scale) => {
    const m = new THREE.Mesh(flat(geo), mat(c));
    if (pos) m.position.set(...pos); if (rot) m.rotation.set(...rot); if (name) m.name = name;
    if (scale) m.scale.set(...scale); return m;
  };
  // vertex-colour "ambient occlusion": multiply the base colour by fn(x,y,z)∈[0,1] in the mesh's local space
  const ao = (m, c, fn) => {
    const p = m.geometry.attributes.position, col = new Float32Array(p.count * 3);
    for (let i = 0; i < p.count; i++) { const v = fn(p.getX(i), p.getY(i), p.getZ(i)); col[i * 3] = col[i * 3 + 1] = col[i * 3 + 2] = v; }
    m.geometry.setAttribute('color', new THREE.BufferAttribute(col, 3));
    m.material = mat(c, false, true);
    return m;
  };
  const smooth01 = (x, a, b) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  // outline shell: child of the mesh (so it follows every animation), radial normals = no cracks on unwelded facets
  const outMat = outlineMaterial(THREE); const sizeTmp = new THREE.Vector2();
  const hullGeoCache = new Map();
  function hullGeo(src) {
    if (hullGeoCache.has(src)) return hullGeoCache.get(src);
    const h = new THREE.BufferGeometry(); const p = src.attributes.position; h.setAttribute('position', p); if (src.index) h.setIndex(src.index);
    const n = new Float32Array(p.count * 3); const v = new THREE.Vector3();
    for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i).normalize(); n[i * 3] = v.x; n[i * 3 + 1] = v.y; n[i * 3 + 2] = v.z; }
    h.setAttribute('normal', new THREE.BufferAttribute(n, 3)); hullGeoCache.set(src, h); return h;
  }
  function outline(m) {
    const h = new THREE.Mesh(hullGeo(m.geometry.userData.src || m.geometry), outMat); h.name = 'outline';
    h.onBeforeRender = renderer => {   // thickness in buffer px; small render targets (pixel openings) get a thinner line
      const rt = renderer.getRenderTarget();
      if (rt) { outMat.uniforms.uViewH.value = rt.height; outMat.uniforms.uPx.value = 1.5 * Math.max(0, Math.min(1, (rt.height - 200) / 400)); }   // tiny pixel targets: fade the line out (the openings draw their own sprite outline)
      else { renderer.getDrawingBufferSize(sizeTmp); outMat.uniforms.uViewH.value = sizeTmp.y; outMat.uniforms.uPx.value = 1.5 * renderer.getPixelRatio(); }
      outMat.uniformsNeedUpdate = true;
    };
    m.add(h); return m;
  }
  const sph = (r, w = 6, h = 4) => new THREE.SphereGeometry(r, w, h);
  const deg = d => d * Math.PI / 180;
  const V = (x, y, z) => new THREE.Vector3(x, y, z);

  const group = new THREE.Group(); group.name = 'bear';
  const head = new THREE.Group(); head.name = 'head';

  // ── skull + ears ──
  // 2026-11-05 toon v2: EVEN width segments (8 / 6) so the facets mirror exactly left↔right (odd counts put a
  // vertex column off-centre). AO: the skull darkens toward the underside, the ears toward their root.
  // phiStart = π/segments puts a facet CENTRE (not a vertex column) on the front, so the forehead is a plane.
  // LAYER B brow: the skull's own forehead ring (y≈0.56) is pushed forward, so the brow is a crease of the skull
  // facets rather than a bolted-on ledge (tried: one outlined bar = cap brim, two outlined mounds = closed eyes).
  const skullGeo = new THREE.SphereGeometry(1.8, 8, 5, Math.PI / 8);
  { const p = skullGeo.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const y = p.getY(i), z = p.getZ(i);
      if (Math.abs(y - 0.556) < 0.05 && z > 0) { const k = 1 + 0.13 * Math.pow(z / 1.71, 2); p.setX(i, p.getX(i) * k); p.setZ(i, z * k); }
    } }
  const skull = ao(mesh(skullGeo, COLORS.body, [0, 0, 0], null, 'skull'), COLORS.body,
    (x, y, z) => 1 - 0.28 * smooth01(-y, 0.6, 1.8) - 0.08 * smooth01(-z, 0.8, 1.8));
  head.add(outline(skull));
  for (const sx of [-1, 1]) {
    const ear = ao(mesh(new THREE.SphereGeometry(0.85, 6, 4, Math.PI / 6), COLORS.body, [sx * 1.45, 1.55, -0.1], null, sx < 0 ? 'leftEar' : 'rightEar'), COLORS.body,
      (x, y, z) => 1 - 0.22 * smooth01(-y, 0.2, 0.85));
    head.add(outline(ear));
    // inner ear: warm disc flush with the ear (its hull line draws the ear's inner edge), a touch darker in the middle
    const inner = ao(mesh(new THREE.SphereGeometry(0.47, 8, 4, Math.PI / 8), COLORS.earInner, [sx * 1.42, 1.56, 0.33], null, sx < 0 ? 'leftEarInner' : 'rightEarInner'), COLORS.earInner,
      (x, y, z) => 1 - 0.07 * smooth01(z, 0.1, 0.47));
    head.add(outline(inner));
  }

  // LAYER B volumes (cheeks / jaw / neck / shoulders) removed 2026-11-05 — Austin: head only, the old cheeks were better.

  // ── surface snapping: ray-cast onto the faceted mesh so features never sink ──
  const ray = new THREE.Raycaster();
  function hit(target, origin, dir) {
    target.updateMatrixWorld(true);
    ray.set(origin, dir.clone().normalize());
    const h = ray.intersectObject(target, false)[0];
    if (!h) return { point: origin.clone(), normal: dir.clone().negate() };
    return { point: h.point.clone(), normal: h.face.normal.clone().transformDirection(target.matrixWorld) };
  }
  const front = (target, x, y) => hit(target, V(x, y, 10), V(0, 0, -1));
  // place obj on surface: pushed out `off` along the normal, facing a blend of normal and +z
  function stick(obj, s, off = 0, faceFwd = 0.6) {
    obj.position.copy(s.point).addScaledVector(s.normal, off);
    const look = s.normal.clone().lerp(V(0, 0, 1), faceFwd).normalize();
    obj.lookAt(obj.position.clone().add(look));
    return obj;
  }

  // ── face ──
  const face = new THREE.Group(); face.name = 'face'; head.add(face);
  // muzzle: lighter, protruding ellipsoid
  // 2026-11-05 Austin: "a cut next to the mouth, on the left" — with 10 wide facets the key light (from +x) left the
  // first facet left of centre in hard shadow, a dark wedge. 16×8 facets (phiStart = π/16 keeps a facet centre, not a
  // vertex column, on the front) make the shading step small enough to read as a rounded snout again.
  const muzzle = ao(mesh(new THREE.SphereGeometry(0.8, 16, 8, Math.PI / 16), COLORS.muzzle, [0, -0.62, 1.38], [deg(-8), 0, 0], 'muzzle', [1.0, 0.66, 0.62]), COLORS.muzzle,
    (x, y, z) => 1 - 0.3 * smooth01(-y, 0.1, 0.8) - 0.12 * smooth01(-z, 0.2, 0.8));   // darker underside + where it meets the skull
  face.add(outline(muzzle));
  // nose: rounded inverted triangle
  // 2026-11-05 v3 (Austin: nose looked like a crooked gem). Smooth-shaded, high-segment, mirror-symmetric rounded
  // inverted triangle; its own material (no flat facets, so the violet rim light can't paint one side), no roll.
  const noseGeo = new THREE.SphereGeometry(0.2, 32, 20);
  { const p = noseGeo.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const y = p.getY(i), t = y / 0.2;                       // -1 (bottom) .. 1 (top)
      const w = t < 0 ? 1 + t * 0.55 : 1 - t * t * 0.08;      // narrow towards the bottom tip, soft flat-ish top
      p.setX(i, p.getX(i) * w);
      if (t > 0.35) p.setY(i, 0.2 * (0.35 + (t - 0.35) * 0.6)); // flatten the top edge
    }
    noseGeo.computeVertexNormals(); }
  const nose = new THREE.Mesh(noseGeo, new THREE.MeshStandardMaterial({ color: new THREE.Color(COLORS.nose), roughness: 0.38, metalness: 0.0 }));   // smooth (indexed) normals
  nose.name = 'nose'; nose.scale.set(1.25, 0.9, 0.7);
  { const s0 = front(muzzle, 0, -0.26); nose.position.copy(s0.point); nose.position.z += 0.04; nose.rotation.set(deg(-8), 0, 0); }   // 2026-11-05 Austin: nose a touch higher (was -0.33)
  face.add(nose);
  const noseHi = mesh(new THREE.SphereGeometry(0.04, 12, 8), COLORS.highlight, [0, 0.055, 0.17], null, 'noseHighlight', [1.6, 0.8, 0.6]); // centred
  noseHi.material = mat('#FFF4E6', true); nose.add(noseHi);
  // mouth: philtrum + ω
  const mouth = new THREE.Group(); mouth.name = 'mouth'; face.add(mouth);
  const ph = stick(mesh(new THREE.BoxGeometry(0.045, 0.2, 0.045), COLORS.nose, null, null, 'philtrum'), front(muzzle, 0, -0.52), 0.0, 0.2);
  mouth.add(ph);
  // 2026-11-05 Austin: the mouth was asymmetric — each arc used to be stuck to its own muzzle facet, so the two
  // halves took different tilts. Now both arcs share ONE surface sample (the centre line under the philtrum) and
  // are offset ±x from it, so they are mirror images by construction. The tube radius covers the tiny curvature drop.
  const mc = front(muzzle, 0, -0.62);
  for (const sx of [-1, 1]) {
    const arc = mesh(new THREE.TorusGeometry(0.135, 0.03, 3, 7, Math.PI), COLORS.nose, null, null, 'mouthArc');   // bigger mouth
    stick(arc, mc, 0.01, 0.2);
    arc.position.x += sx * 0.135;
    arc.rotateZ(Math.PI); mouth.add(arc);
  }
  // eyes: removed 2026-11-05 (Austin: the bear needs no eyes). Riders keep theirs and blink.
  const eyes = [];
  // cheek blush: removed 2026-11-05 (Austin: "不要腮帮" — the flat discs read as jowls)

  // ── riders ──
  const riders = new THREE.Group(); riders.name = 'riders'; riders.position.set(0, 1.75, 0.1);
  riders.scale.setScalar(riderScale); // optional: shrink the trio (they dominate the hero framing)
  head.add(riders);
  const animals = [];
  // seat an animal on the skull top at head-space (x,z), facing yaw
  // 2026-11-05: seat on the HIGHEST skull point under the animal's footprint (not just its centre), so paws and
  // fur tufts on the slope never sink into the head (the ginger cat's feet were clipping).
  function seat(a, x, z, yaw = 0, scale = 1, foot = 0.24) {
    let y = -Infinity;
    for (const [dx, dz] of [[0, 0], [foot, 0], [-foot, 0], [0, foot], [0, -foot], [foot * .7, foot * .7], [-foot * .7, foot * .7]])
      y = Math.max(y, hit(skull, V(x + dx * scale * riderScale, 6, z + dz * scale * riderScale), V(0, -1, 0)).point.y);
    a.root.position.set(x, y - riders.position.y + 0.005, z - riders.position.z).divideScalar(riderScale); // stay seated when scaled
    a.root.rotation.y = yaw; a.root.scale.setScalar(scale);
    riders.add(a.root); animals.push(a);
  }
  // FK tail: chain of joints, each holds one segment
  function tail(parent, pos, rot, segs, colorAt, fluffy) {
    const joints = []; let p = parent;
    segs.forEach((sg, i) => {
      const j = new THREE.Group(); j.position.set(...(i === 0 ? pos : [0, segs[i - 1].len, 0]));
      if (i === 0) j.rotation.set(...rot); else j.rotation.x = sg.curl;
      const g = fluffy ? new THREE.IcosahedronGeometry(sg.r, 0) : sph(sg.r, 5, 3);
      const m = mesh(g, colorAt(i), [0, sg.len * 0.5, 0], null, 'tailSeg', fluffy ? [1, 1.3, 1] : [1, (sg.len / sg.r) * 0.62, 1]);
      j.add(m); p.add(j); joints.push(j); p = j;
    });
    return joints;
  }
  const blinkTimer = () => ({ next: 1.5 + Math.random() * 4, t: -1 });
  function blinkScale(b, dt) {
    b.next -= dt;
    if (b.next <= 0 && b.t < 0) { b.t = 0; b.next = 2 + Math.random() * 4; }
    if (b.t >= 0) { b.t += dt; if (b.t > 0.16) { b.t = -1; return 1; } return Math.max(0.1, Math.abs(1 - b.t / 0.08)); }
    return 1;
  }

  function makeCat(kind, side = 1) {
    const C = RIDER_COLORS, long = kind === 'longhair';
    const base = long ? C.ginger : C.tabby, dark = long ? C.gingerDark : C.tabbyDark;
    const light = long ? C.cream : C.white;
    const root = new THREE.Group(); root.name = long ? 'catGinger' : 'catTabby';
    // body (longhair = icosahedron = fluffier silhouette)
    const body = mesh(long ? new THREE.IcosahedronGeometry(0.3, 0) : sph(0.27, 8, 5), base, [0, 0.28, 0], null, 'body', long ? [1.05, 1.08, 1.05] : [1, 1.15, 1.05]);
    root.add(outline(body));
    root.add(mesh(sph(long ? 0.18 : 0.18, 7, 5), light, [0, 0.3, long ? 0.2 : 0.16], null, 'chest', [1, 1.35, 0.7]));
    if (!long) { // tabby stripes: partial sphere bands over the back
      for (const [t0, tl] of [[0.55, 0.16], [0.95, 0.16], [1.35, 0.16]]) {
        const band = mesh(new THREE.SphereGeometry(0.278, 9, 2, Math.PI * 0.95, Math.PI * 1.1, t0, tl), dark, [0, 0.28, 0], [0, 0, 0], 'stripe', [1, 1.15, 1.05]);
        band.material = band.material.clone(); band.material.side = THREE.DoubleSide; root.add(band);
      }
    }
    // paws
    for (const sx of [-1, 1]) root.add(mesh(sph(0.066, 6, 4), long ? C.cream : C.white, [sx * 0.1, 0.035, 0.2], null, 'paw', [1, 0.6, 1.15]));
    // head
    const hp = new THREE.Group(); hp.name = 'headPivot'; hp.position.set(0, 0.6, 0.04); root.add(hp);
    hp.add(outline(mesh(sph(0.21, 8, 5), base, [0, 0.07, 0], null, 'catHead', [1.18, 0.95, 1])));
    if (long) { // ruff + cheek fluff
      hp.add(outline(mesh(new THREE.IcosahedronGeometry(0.23, 0), C.cream, [0, -0.08, 0.05], null, 'ruff', [1.5, 0.8, 1.1])));
      for (const sx of [-1, 1]) hp.add(mesh(new THREE.TetrahedronGeometry(0.11, 0), base, [sx * 0.24, -0.01, 0.0], [0, 0, sx * 0.6], 'cheekFluff'));
      // long fur: tufts around the body flanks and haunches
      for (const [x, y, z, r] of [[-0.27, 0.22, 0.02, 0.1], [0.27, 0.22, 0.02, 0.1], [-0.22, 0.08, -0.08, 0.09], [0.22, 0.08, -0.08, 0.09], [0, 0.42, -0.2, 0.1], [-0.15, 0.4, 0.14, 0.07], [0.15, 0.4, 0.14, 0.07]])
        root.add(mesh(new THREE.IcosahedronGeometry(r, 0), base, [x, y, z], [x * 3, z * 4, y * 2], 'furTuft', [1, 1.25, 1]));
    } else { // forehead "M": three short dark strokes
      for (const sx of [-1, 0, 1]) hp.add(mesh(new THREE.BoxGeometry(0.025, 0.09, 0.02), dark, [sx * 0.055, 0.2, 0.15], [deg(-35), 0, sx * -0.25], 'forehead'));
    }
    hp.add(mesh(sph(long ? 0.095 : 0.11, 6, 4), light, [0, long ? 0.0 : -0.01, 0.17], null, 'catMuzzle', [1.35, 0.8, 0.75]));
    hp.add(mesh(sph(0.026, 4, 2), C.catNose, [0, 0.04, 0.245], null, 'catNose', [1.3, 0.8, 1]));
    const eyesC = [];
    for (const sx of [-1, 1]) {
      const e = mesh(sph(0.036, 5, 3), C.catEye, [sx * 0.085, 0.1, 0.18], null, 'catEye', [1, 1.15, 0.6]);
      hp.add(e); eyesC.push(e);
    }
    const ears = [];
    for (const sx of [-1, 1]) {
      const ep = new THREE.Group(); ep.position.set(sx * 0.12, 0.2, 0.0); ep.rotation.set(deg(-8), 0, sx * -0.35); hp.add(ep);
      ep.add(outline(mesh(new THREE.ConeGeometry(0.085, 0.17, 4), base, [0, 0.07, 0], [0, deg(45), 0], 'catEar')));
      ep.add(mesh(new THREE.ConeGeometry(0.045, 0.1, 3), C.pink, [0, 0.05, 0.035], null, 'catEarInner'));
      if (long) ep.add(mesh(new THREE.ConeGeometry(0.028, 0.12, 3), C.cream, [0, 0.19, 0], null, 'earTuft'));
      ears.push(ep);
    }
    // tail
    const segs = long
      ? [0.08, 0.1, 0.12, 0.13, 0.125].map((r, i) => ({ r, len: 0.13, curl: i ? 0.42 : 0 }))
      : [0.045, 0.045, 0.042, 0.04, 0.038].map((r, i) => ({ r, len: 0.12, curl: i ? 0.4 : 0 }));
    const tj = tail(root, [side * 0.12, 0.1, -0.16], [deg(-25), 0, side * -1.05], segs, i => long ? (i === 4 ? C.cream : base) : (i % 2 ? dark : base), long);
    tj.forEach(j => j.userData.rx = j.rotation.x);
    const blink = blinkTimer(); const twitch = { next: 2 + Math.random() * 4, t: -1, side: 0 };
    const phase = Math.random() * 10;
    return {
      root, update(t, dt, mouse) {
        hp.rotation.y += (mouse.x * 0.45 - hp.rotation.y) * 0.06;
        hp.rotation.x += (-mouse.y * 0.18 + Math.sin(t * 0.6 + phase) * 0.04 - hp.rotation.x) * 0.06;
        hp.rotation.z = Math.sin(t * 0.4 + phase) * 0.06;
        // tail: still (Austin: no tail wagging)
        const s = blinkScale(blink, dt); eyesC.forEach(e => e.scale.y = 1.15 * s);
        twitch.next -= dt;
        if (twitch.next <= 0 && twitch.t < 0) { twitch.t = 0; twitch.side = Math.random() < 0.5 ? 0 : 1; twitch.next = 2.5 + Math.random() * 5; }
        ears.forEach((ep, i) => { ep.rotation.x = deg(-8); });
        if (twitch.t >= 0) { twitch.t += dt; const k = Math.sin(Math.min(1, twitch.t / 0.22) * Math.PI); ears[twitch.side].rotation.x = deg(-8) - k * 0.5; if (twitch.t > 0.22) twitch.t = -1; }
        body.scale.y = (long ? 1.08 : 1.15) * (1 + Math.sin(t * 2.2 + phase) * 0.012); // breathing
      },
    };
  }

  function makeRabbit() {
    const C = RIDER_COLORS;
    const root = new THREE.Group(); root.name = 'rabbit';
    const body = mesh(sph(0.29, 8, 5), C.rabbit, [0, 0.26, -0.02], null, 'body', [1, 0.98, 1.12]);
    root.add(outline(body));
    root.add(mesh(sph(0.16, 6, 4), C.rabbitLight, [0, 0.27, 0.17], null, 'belly', [1, 1.3, 0.7]));
    for (const sx of [-1, 1]) {
      root.add(outline(mesh(sph(0.15, 6, 4), C.rabbit, [sx * 0.2, 0.13, -0.05], null, 'haunch', [0.75, 0.9, 1.2])));
      root.add(mesh(sph(0.06, 6, 4), C.rabbitLight, [sx * 0.1, 0.035, 0.22], null, 'paw', [1, 0.6, 1.2]));
    }
    root.add(mesh(new THREE.IcosahedronGeometry(0.09, 0), C.rabbitLight, [0, 0.16, -0.32], null, 'puffTail'));
    const hp = new THREE.Group(); hp.name = 'headPivot'; hp.position.set(0, 0.56, 0.06); root.add(hp);
    hp.add(outline(mesh(sph(0.2, 8, 5), C.rabbit, [0, 0.05, 0], null, 'rabbitHead', [1.05, 0.98, 1.05])));
    hp.add(mesh(sph(0.1, 6, 4), C.rabbitLight, [0, -0.03, 0.15], null, 'rabbitMuzzle', [1.25, 0.85, 0.8]));
    const nose = mesh(sph(0.028, 4, 2), C.pinkDark, [0, 0.01, 0.235], null, 'rabbitNose', [1.3, 0.9, 1]);
    hp.add(nose);
    const eyesR = [];
    for (const sx of [-1, 1]) { const e = mesh(sph(0.036, 5, 3), C.catEye, [sx * 0.105, 0.09, 0.15], null, 'rabbitEye', [0.9, 1.15, 0.6]); hp.add(e); eyesR.push(e); }
    const ears = [];
    for (const sx of [-1, 1]) {
      const ep = new THREE.Group(); ep.position.set(sx * 0.075, 0.2, -0.02); ep.rotation.set(deg(-12), 0, sx * -0.18); hp.add(ep);
      ep.add(outline(mesh(sph(0.075, 6, 4), C.rabbit, [0, 0.24, 0], null, 'rabbitEar', [0.85, 3.4, 0.55])));
      ep.add(mesh(sph(0.045, 5, 3), C.pink, [0, 0.23, 0.028], null, 'rabbitEarInner', [0.8, 3.6, 0.4]));
      ears.push(ep);
    }
    const blink = blinkTimer(); const phase = Math.random() * 10; const wig = { next: 1.5, t: -1 };
    return {
      root, update(t, dt, mouse) {
        hp.rotation.y += (mouse.x * 0.4 - hp.rotation.y) * 0.05;
        hp.rotation.x += (-mouse.y * 0.15 + Math.sin(t * 0.5 + phase) * 0.03 - hp.rotation.x) * 0.05;
        // nose wiggle in short bursts
        wig.next -= dt; if (wig.next <= 0 && wig.t < 0) { wig.t = 0; wig.next = 1.5 + Math.random() * 3; }
        let n = 0; if (wig.t >= 0) { wig.t += dt; n = Math.sin(wig.t * 40) * 0.25; if (wig.t > 0.6) wig.t = -1; }
        nose.scale.set(1.3 * (1 + n * 0.4), 0.9 * (1 - n), 1);
        ears.forEach((ep, i) => {
          const sx = i ? 1 : -1;
          ep.rotation.z = sx * -0.18 + Math.sin(t * 1.1 + phase + i * 1.7) * 0.06 + (wig.t >= 0 ? sx * Math.sin(wig.t * 20) * 0.05 : 0);
          ep.rotation.x = deg(-12) + Math.sin(t * 0.7 + i) * 0.05;
        });
        const s = blinkScale(blink, dt); eyesR.forEach(e => e.scale.y = 1.15 * s);
        body.scale.y = 0.98 * (1 + Math.sin(t * 2.6 + phase) * 0.015);
      },
    };
  }

  // closer together (2026-11-05): cats tucked in beside the rabbit
  // spacing is in rider units (scales with riderScale) so they stay huddled at any size
  const RS = riderScale, at = (xl, zl) => [xl * RS, 0.1 + zl * RS];
  // 2026-11-05 Austin (live site review): rabbit a little lower (forward on the dome, so it sits below the crown), cats
  // ~0.1 head-units further out, down the slope — "about the width of 'AI' in the tagline" at desktop hero scale
  seat(makeRabbit(), ...at(0, 0.14), 0, 1.0);
  seat(makeCat('longhair', -1), ...at(-0.7, 0.3), deg(12), 0.95, 0.3);   // longhair: wider footprint (fur tufts)
  seat(makeCat('tabby', 1), ...at(0.7, 0.3), deg(-12), 0.95);

  group.add(head);
  group.rotation.set(-0.03, 0.15, 0);

  let drift = 0, time = 0; const target = { x: 0, y: 0 };
  const bearBlink = blinkTimer();
  function update(dt, mouse) {
    dt = dt || 1 / 60; time += dt;
    drift += 0.3 * dt;
    target.x = mouse.x * 0.3 + Math.sin(drift * 0.7) * 0.05;
    target.y = mouse.y * 0.15 + Math.cos(drift * 0.5) * 0.03;
    head.rotation.y += (target.x - head.rotation.y) * 0.08;
    head.rotation.x += (target.y - head.rotation.x) * 0.04;
    group.rotation.y += (0.15 + target.x * 0.3 - group.rotation.y) * 0.024;
    if (!api.ridersStill) for (const a of animals) a.update(time, dt, mouse);   // 2026-11-05: still once the bear is docked
  }
  const api = { group, head, riders, update, ridersStill: false };
  return api;
}

// Lights matching the bear demo (+ a soft frontal fill so the face reads). addBearLights(THREE, scene)
// 2026-11-05 toon v2: hemisphere (warm sky / cool ground) instead of flat ambient, one warm key from the upper
// right-front (quantised by the ramp into the 3 bands), a cool blue rim from behind-left so the silhouette
// separates from the peach page, and a faint warm front fill so the shadow band is not dead.
export function addBearLights(THREE, scene) {
  // 2026-11-05 Austin: back to the bear-demo lights (the toon key/rim set was too dramatic)
  scene.add(new THREE.AmbientLight(0x606060, 1.0));
  const main = new THREE.DirectionalLight(0xfff5e0, 1.5); main.position.set(5, 10, 7); scene.add(main);
  const fill = new THREE.DirectionalLight(0xffe6d0, 0.55); fill.position.set(-2, 1, 9); scene.add(fill);
  const v = new THREE.DirectionalLight(0x8b5cf6, 0.4); v.position.set(-3, 5, -5); scene.add(v);
  const g = new THREE.DirectionalLight(0xd4a042, 0.7); g.position.set(0, 3, -8); scene.add(g);
}
