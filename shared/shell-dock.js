// Bear dock — owned by the shell agent.
// Moves the ONE bear render between the hero framing (big head peeking from the bottom edge, under the tagline)
// and a corner logo (~84px, top-left), with the flip-box flight: hop up first, then travel on an arc with a tilt,
// then a damped wobble to settle. Motion curves are the flipbook's pose(): height leads (easeOut), travel waits
// for the hop (easeInOut from u=.12), arc = sin(pi*travel) drives the tilt.
//
// How it frames without a second renderer: the camera keeps aspect = W/H and we use camera.setViewOffset to
// render a "virtual screen" of k*W x k*H whose centre (the projection of the look-at point) sits at anchor A.
// k=1 & A=screen centre is the plain full-screen camera. Small k + A in the corner = the logo.
//
// createBearDock({ THREE, camera, pivot, rig, gsap, reducedMotion, canvas, seat, heroText }) -> {
//   frame(dt, now, mouseClient) -> {x,y} NDC mouse for rig.update   (call every frame after the opening)
//   applyHero()   // put the camera in the hero framing (used during the opening too)
//   relayout()    // recompute hero/dock framing (resize, fonts, riders changed)
//   dock(), undock(), get u(), set u(v) (debug), docked
// }
const clamp01 = x => Math.max(0, Math.min(1, x));
const easeInOut = x => x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
const easeOut = x => 1 - Math.pow(1 - x, 3);
const lerp = (a, b, t) => a + (b - a) * t;

const HERO_SCALE = 1.3;    // 2026-11-06 Austin: hero head +8% (was 1.2)

export function createBearDock({ THREE, camera, pivot, rig, gsap, reducedMotion, canvas, seat, heroText }) {
  // camera poses (world units; head centred at y=0, ears ~1.55, riders above)
  const hc = (new URLSearchParams(location.search).get('hc') || '').split(',').map(Number); // debug: ?hc=y,z,lookY
  const HERO = hc.length === 3 ? { pos: new THREE.Vector3(0, hc[0], hc[1]), look: new THREE.Vector3(0, hc[2], 0) }
    : { pos: new THREE.Vector3(0, 2.9, 8.5), look: new THREE.Vector3(0, 1.9, 0) };  // 2026-11-05 Austin: "face not round enough" — camera lower and further back (less perspective), size held by relayout()
  const DOCK = { pos: new THREE.Vector3(0, 1.2, 7.2), look: new THREE.Vector3(0, 0.5, 0) };  // front-on, whole head
  const st = { u: 0, landedAt: -1, landedDir: 0, docked: false };
  const L = { W: 1, H: 1, hero: { k: 1, ax: 0, ay: 0 }, dock: { k: .1, ax: 0, ay: 0, cx: 0, cy: 0 } };
  const tmpCam = camera.clone();
  const v = new THREE.Vector3();
  let tween = null;

  // screen bounds (px, full-screen frame, k=1) of every bear vertex for a camera pose
  function bounds(pose) {
    tmpCam.aspect = L.W / L.H; tmpCam.clearViewOffset(); tmpCam.position.copy(pose.pos); tmpCam.lookAt(pose.look);
    tmpCam.updateProjectionMatrix(); tmpCam.updateMatrixWorld(true);
    // measure the resting bear: ignore flight tilt AND any offset an opening is still animating on rig.group
    // ...and the idle mouse-follow (head/group yaw), so relayout() gives the same answer whenever it runs (was drifting 1–2px)
    const saved = [pivot.rotation.clone(), pivot.scale.clone(), rig.group.position.clone(), rig.group.rotation.clone(), rig.head.rotation.clone()];
    pivot.rotation.set(0, 0, 0); pivot.scale.set(1, 1, 1); rig.group.position.set(0, 0, 0);
    rig.group.rotation.set(-0.03, 0.15, 0); rig.head.rotation.set(0, 0, 0); pivot.updateMatrixWorld(true);
    const b = { x0: Infinity, x1: -Infinity, y0: Infinity, y1: -Infinity };
    pivot.traverse(o => {
      const pa = o.isMesh && o.geometry && o.geometry.attributes.position; if (!pa) return;
      for (let i = 0; i < pa.count; i++) {
        v.fromBufferAttribute(pa, i).applyMatrix4(o.matrixWorld).project(tmpCam);
        const x = (v.x + 1) / 2 * L.W, y = (1 - v.y) / 2 * L.H;
        if (x < b.x0) b.x0 = x; if (x > b.x1) b.x1 = x; if (y < b.y0) b.y0 = y; if (y > b.y1) b.y1 = y;
      }
    });
    pivot.rotation.copy(saved[0]); pivot.scale.copy(saved[1]); rig.group.position.copy(saved[2]);
    rig.group.rotation.copy(saved[3]); rig.head.rotation.copy(saved[4]); pivot.updateMatrixWorld(true);
    return b;
  }

  function relayout() {
    L.W = innerWidth; L.H = innerHeight;
    const mobile = L.W <= 640;
    // HERO: top of the bear (ears / riders) sits a little below the tagline; scale down if it would be clipped sideways
    const hb = bounds(HERO);
    const tl = heroText.tagline;
    const tagBottom = tl.offsetTop + tl.offsetHeight + (heroText.root.offsetTop || 0);
    const gap = Math.max(18, L.H * (mobile ? 0.035 : 0.045));
    // cap how much bear shows (portrait screens would otherwise reveal the whole face)
    // 2026-11-05 Austin: bear lower — the ears clearly, plus a sliver of dome (and the riders on it); less drop on phones
    const topY = Math.min(Math.max(tagBottom + gap, L.H * (mobile ? 0.67 : 0.58)) + 1.6 * (parseFloat(getComputedStyle(tl).lineHeight) || tl.offsetHeight) + L.H * (mobile ? 0.05 : 0.05), L.H * 0.95);
    // 2026-11-05: the head's on-screen WIDTH is fixed (fraction of the viewport), whatever the camera distance —
    // so the camera can sit further back (less perspective, rounder dome) without the bear shrinking
    const maxW = L.W * (mobile ? 0.96 : 0.62);           // desktop: keep the head a centred mound, not a wall
    let k = maxW / (hb.x1 - hb.x0);
    k *= HERO_SCALE;                                     // 2026-11-05 Austin: bear head 20% bigger by default
    L.hero = { k, ax: L.W / 2, ay: topY - (hb.y0 - L.H / 2) * k, top: topY };
    // DOCK: whole head (+riders) fills the seat
    const db = bounds(DOCK);
    const r = { left: seat.offsetLeft, top: seat.offsetTop, width: seat.offsetWidth || 84, height: seat.offsetHeight || 84 }; // untransformed
    const size = r.width;
    const kd = (size * 1.02) / Math.max(db.y1 - db.y0, (db.x1 - db.x0) * 0.92);
    const cx = r.left + r.width / 2, cy = r.top + r.height * 0.5;
    const bcx = (db.x0 + db.x1) / 2 - L.W / 2, bcy = (db.y0 + db.y1) / 2 - L.H / 2; // bbox centre offset from frame centre
    L.dock = { k: kd, ax: cx - bcx * kd, ay: cy - bcy * kd, cx, cy };
  }

  function setFrame(k, ax, ay) {
    camera.aspect = L.W / L.H;
    if (Math.abs(k - 1) < 1e-4 && Math.abs(ax - L.W / 2) < .5 && Math.abs(ay - L.H / 2) < .5) camera.clearViewOffset();
    else camera.setViewOffset(k * L.W, k * L.H, -(ax - k * L.W / 2), -(ay - k * L.H / 2), L.W, L.H);
    camera.updateProjectionMatrix();
  }

  function applyHero() {
    pivot.rotation.set(0, 0, 0); pivot.scale.set(1, 1, 1);
    camera.position.copy(HERO.pos); camera.lookAt(HERO.look);
    setFrame(L.hero.k, L.hero.ax, L.hero.ay);
  }

  const lookTmp = new THREE.Vector3();
  function pose(u, now) {
    const H = L.hero, D = L.dock;
    const ey = easeOut(u);                                   // height / reveal leads
    const ed = easeInOut(clamp01((u - 0.12) / 0.88));        // travel starts after the hop
    const ek = easeOut(clamp01(u / 0.78));                    // shrink leads, so the hop never looms over the name
    // camera swings from "looking down at the ears" to front-on
    camera.position.lerpVectors(HERO.pos, DOCK.pos, ey);
    lookTmp.lerpVectors(HERO.look, DOCK.look, ey); camera.lookAt(lookTmp);
    const k = Math.exp(lerp(Math.log(H.k), Math.log(D.k), ek));
    const hop = Math.sin(Math.PI * clamp01(u / 0.45)) * L.H * 0.07 * (1 - ed);
    let ax = lerp(H.ax, D.ax, ed);
    let ay = lerp(H.ay, D.ay, Math.max(ed, easeOut(clamp01((u - 0.05) / 0.95)))) - hop;
    // flight tilt: lean into the travel (to the upper-left), nose up, quarter-turn toward the corner
    const arc = Math.sin(Math.PI * ed);
    let rz = arc * 0.32, rx = -arc * 0.22, ry = -arc * 0.35, sq = 0;
    // settle: damped wobble after touching down at either end
    if (st.landedAt > 0) {
      const t = (now - st.landedAt) / 1000;
      if (t < 1.6) { const w = Math.exp(-t * 4.2) * Math.sin(t * 13); rz += w * 0.22 * st.landedDir; sq = w * 0.07; }
    }
    pivot.rotation.set(rx, ry, rz);
    pivot.scale.set(1 + sq * 0.6, 1 - sq, 1 + sq * 0.6);
    setFrame(k, ax, ay);
    // hero copy leaves early; seat medallion arrives late
    const t = easeOut(clamp01(u / 0.5));
    heroText.name.style.transform = `translateY(${-t * 60}px) scale(${1 - t * 0.06})`;
    heroText.name.style.opacity = String(1 - t);
    heroText.tagline.style.transform = `translateY(${-t * 36}px)`;
    heroText.tagline.style.opacity = String(1 - clamp01(u / 0.35));
    const sOp = clamp01((u - 0.55) / 0.35);
    seat.style.opacity = String(sOp);
    seat.style.transform = `scale(${0.6 + 0.4 * easeOut(sOp)})`;
    return ed;
  }

  function go(to) {
    if (reducedMotion) {   // no flight: cross-fade the canvas while the pose jumps
      gsap.killTweensOf(canvas);
      gsap.to(canvas, { opacity: 0, duration: 0.22, onComplete: () => { st.u = to; gsap.to(canvas, { opacity: 1, duration: 0.35 }); } });
      return;
    }
    if (tween) tween.kill();
    const dur = 1.25 * Math.abs(to - st.u) + 0.05;
    st.landedAt = -1;
    tween = gsap.to(st, { u: to, duration: dur, ease: 'none', onComplete: () => { st.landedAt = performance.now(); st.landedDir = to ? 1 : -0.6; } });
  }

  function frame(dt, now, mc) {
    const ed = pose(st.u, now);
    // mouse relative to where the head is: plain NDC in the hero, relative to the corner when docked
    const D = L.dock;
    const cx = lerp(L.W / 2, D.cx, ed), cy = lerp(L.H / 2, D.cy, ed);
    const sx = lerp(L.W / 2, 260, ed), sy = lerp(L.H / 2, 220, ed);
    return { x: clamp01(((mc.x - cx) / sx + 1) / 2) * 2 - 1, y: clamp01((-(mc.y - cy) / sy + 1) / 2) * 2 - 1 };
  }

  relayout();
  return {
    frame, applyHero, relayout,
    dock() { if (!st.docked) { st.docked = true; go(1); } },
    undock() { if (st.docked) { st.docked = false; go(0); } },
    get docked() { return st.docked; },
    get u() { return st.u; }, set u(x) { if (tween) tween.kill(); st.u = x; },
    layout: L,
  };
}
