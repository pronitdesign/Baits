import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { initCart, add as addToCart, fly, open as openCart } from './cart.js?v=5';

/* ------------------------------------------------------------------ content (prices are fictitious) */
const FLAVORS = [
  {
    id: 'coffee-wake', name: 'Coffee Wake', head: ['Seu dia começa', 'pela colher'],
    text: 'Café e granola crocante pra começar o dia com vontade.',
    cta: 'Quero Coffee Wake', price: ['29', ',90'], unit: 'caixa de 350 g · 12 g de proteína',
  },
  {
    id: 'flow-crunch', name: 'Flow Crunch', head: ['Uma colherada,', 'várias ideias'],
    text: 'Chocolate branco, cookie de baunilha e um crunch que merece uma pausa.',
    cta: 'Quero Flow Crunch', price: ['27', ',90'], unit: 'caixa de 350 g · 12 g de proteína',
  },
  {
    id: 'banana-rings', name: 'Banana Rings', head: ['Um respiro', 'com gosto de banana'],
    text: 'Banana caramelizada, granola e um toque de canela.',
    cta: 'Quero Banana Rings', price: ['26', ',90'], unit: 'caixa de 350 g · 12 g de proteína',
  },
  {
    id: 'combo', name: 'Combo Trio', head: ['Um sabor', 'pra cada momento'],
    text: 'Os três sabores juntos, com preço de combo.',
    cta: 'Quero o combo', price: ['74', ',90'], was: 'R$ 84,70', unit: '3 caixas de 350 g',
  },
];
const COMBO = 3;

const $ = (s, r = document) => r.querySelector(s);
const section = $('.flavors');
const canvas = $('#scene');
const stage = $('#stage');
const glow = $('#glow');
const hint = $('#hint');
const tabs = [...document.querySelectorAll('.picker__item')];
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const total = FLAVORS.length;

let current = 0;
let busy = false;
let queued = null;

/* ------------------------------------------------------------------ copy + chrome */
function renderCopy(f, i) {
  section.dataset.flavor = f.id;
  document.documentElement.dataset.flavor = f.id;
  [['#d-head-a', f.head[0]], ['#d-head-b', f.head[1]]].forEach(([sel, txt]) => {
    const el = $(sel); el.textContent = txt;
    el.style.fontSize = txt.length > 16 ? '.74em' : '';            // long halves step down so they keep 2 lines
  });
  $('#d-name').textContent = f.name;
  $('#d-text').textContent = f.text;
  $('#d-cta-label').textContent = f.cta;
  $('#d-cta').setAttribute('aria-label', `${f.cta}, R$ ${f.price.join('')}`);
  $('#d-price').textContent = f.price[0];
  $('#d-cents').textContent = f.price[1];
  $('#d-was').textContent = f.was ? `de ${f.was}` : '';
  $('#d-was').hidden = !f.was;
  $('#d-unit').textContent = f.unit;
  $('#counter-now').textContent = String(i + 1).padStart(2, '0');
  document.querySelectorAll('.bg__layer').forEach((l) => l.classList.toggle('is-on', l.dataset.bg === f.id));
  tabs.forEach((t, k) => { t.setAttribute('aria-selected', String(k === i)); t.tabIndex = k === i ? 0 : -1; });
  const fb = $('#fallback'); if (fb) fb.src = `assets/thumb-${i === COMBO ? 'flow-crunch' : f.id}.png`;
}
$('#counter-total').textContent = String(total).padStart(2, '0');
renderCopy(FLAVORS[0], 0);


/* ------------------------------------------------------------------ three.js */
let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
} catch (e) {
  $('#fallback').hidden = false;
}

const BOX_H = 0.2525, BOX_W = 0.19;
const BASE_ROT = { x: 0.06, y: -0.42 };
const pivots = [];
const shadows = [];
let camera, scene, visW = 1;

/** where every visible box sits for a given selection */
function poses(idx) {
  if (idx !== COMBO) return [{ i: idx, x: 0, z: 0, rotY: BASE_ROT.y, s: 1 }];
  const sp = Math.min(0.14, Math.max(0.1, visW * 0.15));
  return [
    { i: 0, x: -sp, z: -0.1, rotY: -0.16, s: 0.66 },
    { i: 2, x: sp, z: -0.1, rotY: -0.7, s: 0.66 },
    { i: 1, x: 0, z: 0.02, rotY: -0.42, s: 0.72 },
  ];
}

if (renderer) {
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NoToneMapping; // printed colours as calibrated in Blender

  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(24, 1, 0.05, 20);

  // even studio light (calibrated so the print renders at its own colour) + a soft key for form
  const hemi = new THREE.HemisphereLight(0xffffff, 0xffffff, 1.45); scene.add(hemi);
  const key = new THREE.DirectionalLight(0xffffff, 0.55); key.position.set(-1.1, 1.2, 1.6); scene.add(key);
  const rim = new THREE.DirectionalLight(0xffffff, 0.35); rim.position.set(1.4, 0.9, -1.2); scene.add(rim);

  // cursor light: follows the pointer in front of the boxes, fades in over a box
  const hover = new THREE.PointLight(0xfff1dc, 0, 1.4, 2); hover.position.set(0, 0, 0.26); scene.add(hover);


  // soft contact shadows (one per box)
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const g = c.getContext('2d'); const grd = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  grd.addColorStop(0, 'rgba(30,10,40,.42)'); grd.addColorStop(.55, 'rgba(30,10,40,.16)'); grd.addColorStop(1, 'rgba(30,10,40,0)');
  g.fillStyle = grd; g.fillRect(0, 0, 256, 256);
  const shadowTex = new THREE.CanvasTexture(c);

  const loader = new GLTFLoader();
  FLAVORS.slice(0, COMBO).forEach((f, i) => {
    const pivot = new THREE.Group();
    pivot.visible = i === 0;
    pivot.userData = { x: 0, z: 0, rotY: BASE_ROT.y, scale: 1, spin: 0, vel: 0, lift: 0, liftAmt: 0, isOpen: false, open: 0, openV: 0 };
    scene.add(pivot); pivots[i] = pivot;
    const sh = new THREE.Mesh(new THREE.PlaneGeometry(0.46, 0.2),
      new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false }));
    sh.rotation.x = -Math.PI / 2; sh.renderOrder = -1; scene.add(sh); shadows[i] = sh;
    loader.load(`assets/baits-${f.id}.glb`, (gltf) => {
      const m = gltf.scene; m.position.y = -BOX_H / 2;
      m.traverse((o) => {
        if (!o.isMesh) return;
        o.userData.pivot = i;
        if (o.material.map) o.material.map.anisotropy = renderer.capabilities.getMaxAnisotropy();
        o.material.roughness = Math.min(o.material.roughness ?? 1, 0.62); o.material.metalness = 0;
      });
      pivot.add(m);
      rigBox(pivot, m, i);
      if (i === 0 || i === current) canvas.classList.add('is-ready');
    }, undefined, () => { $('#fallback').hidden = false; });
  });


  /* ---------------- opening rig: hinges built from the exported parts (lid, tuck flap, dust flaps) */
  /* contents: an opened liner bag + a heap of cereal rings in the flavour colour */
  const CEREAL = [0x5b2c1a, 0xc7313b, 0xf0b636];                     // chocolate · strawberry · banana
  const linerGeo = (() => {
    const g = new THREE.CylinderGeometry(1, 1, 0.05, 72, 10, true);
    g.translate(0, 0.237, 0);                                        // y 0.212 → 0.262
    const p = g.attributes.position;
    for (let k = 0; k < p.count; k++) {
      const x = p.getX(k), y = p.getY(k), z = p.getZ(k);
      const a = Math.atan2(z, x), c = Math.cos(a), sn = Math.sin(a);
      const h = (y - 0.212) / 0.05;                                  // 0 bottom → 1 top
      const flare = 1 + Math.pow(h, 3) * 0.06;                       // the rim rolls outwards
      const crumple = Math.sin(a * 23 + y * 300) * Math.cos(a * 9 - y * 520) * 0.0016 * h;
      const px = Math.sign(c) * Math.pow(Math.abs(c), 0.18) * 0.0926 * flare + c * crumple;
      const pz = Math.sign(sn) * Math.pow(Math.abs(sn), 0.18) * 0.0326 * flare + sn * crumple;
      p.setXYZ(k, px, y + Math.sin(a * 7) * 0.0035 * h, pz);
    }
    g.computeVertexNormals();
    return g;
  })();
  const linerMat = new THREE.MeshStandardMaterial({ color: 0xe8e5df, roughness: 0.34, metalness: 0.08, side: THREE.DoubleSide });
  const ringGeo = new THREE.TorusGeometry(0.0062, 0.0029, 10, 22);
  const ringMat = new THREE.MeshStandardMaterial({ roughness: 0.78, metalness: 0 });
  function cerealHeap(color, seed) {
    let r = seed * 9301 + 49297; const rnd = () => ((r = (r * 9301 + 49297) % 233280) / 233280);
    const N = 230, mesh = new THREE.InstancedMesh(ringGeo, ringMat, N);
    const o = new THREE.Object3D(), base = new THREE.Color(color), c = new THREE.Color();
    for (let k = 0; k < N; k++) {
      const layer = k / N;                                           // later instances sit higher
      const x = (rnd() * 2 - 1) * 0.084, z = (rnd() * 2 - 1) * 0.027;
      const mound = 0.011 * (1 - (x / 0.092) ** 2) * (1 - (z / 0.034) ** 2);
      o.position.set(x, 0.225 + layer * 0.012 + mound * layer + rnd() * 0.002, z);
      o.rotation.set(Math.PI / 2 + (rnd() - 0.5) * 1.6, rnd() * 6.28, (rnd() - 0.5) * 1.2);
      o.scale.setScalar(0.85 + rnd() * 0.3);
      o.updateMatrix(); mesh.setMatrixAt(k, o.matrix);
      c.copy(base).multiplyScalar((0.62 + layer * 0.38) * (0.9 + rnd() * 0.2));   // deeper = darker
      mesh.setColorAt(k, c);
    }
    return mesh;
  }
  function rigBox(pivot, m, i) {
    m.updateMatrixWorld(true);
    const get = (n) => m.getObjectByName(n);
    const lid = get('Box_Lid'); if (!lid) return;
    const hinge = (parent, x, y, z) => { const h = new THREE.Group(); h.position.set(x, y, z); parent.add(h); h.updateMatrixWorld(true); return h; };
    const lidH = hinge(m, 0, 0.2515, -0.035);                        // back edge of the lid
    lidH.attach(lid); if (get('Box_TuckFold')) lidH.attach(get('Box_TuckFold'));
    const flapH = hinge(lidH, 0, 0, 0.0696);                         // front edge of the lid
    if (get('Box_TuckFlap')) flapH.attach(get('Box_TuckFlap'));
    const dlH = hinge(m, -0.0944, 0.2513, 0), drH = hinge(m, 0.0944, 0.2513, 0);
    if (get('Box_DustFlap_L')) dlH.attach(get('Box_DustFlap_L'));
    if (get('Box_DustFlap_R')) drH.attach(get('Box_DustFlap_R'));
    const bag = new THREE.Group();                                  // liner + cereal, raised as the box opens
    const liner = new THREE.Mesh(linerGeo, linerMat); liner.userData.pivot = i; bag.add(liner);
    const heap = cerealHeap(CEREAL[i], i + 3); heap.userData.pivot = i; bag.add(heap);
    m.add(bag);
    pivot.userData.rig = { lidH, flapH, dlH, drH, bag };
  }
  const clamp01 = (v) => Math.min(1, Math.max(0, v));
  function poseRig(u) {
    const r = u.rig; if (!r) return;
    const o = Math.max(-0.05, u.open);
    r.lidH.rotation.x = -o * 2.05;                                   // ~117° fully open
    r.flapH.rotation.x = -clamp01((o - 0.08) / 0.6) * 1.15;          // tuck flap springs out
    const d = clamp01((o - 0.4) / 0.6);
    r.dlH.rotation.z = d * 1.8; r.drH.rotation.z = -d * 1.8;         // dust flaps fold outwards last
    r.bag.position.y = -0.016 + clamp01((o - 0.3) / 0.7) * 0.016;  // contents rise into view once open
  }

  /* ---------------- layout: fit the box to the stage */
  function resize() {
    const w = stage.clientWidth, h = stage.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    const mobile = w < 760;
    const fill = mobile ? 0.62 : 0.6;              // share of stage height used by the box
    const t = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    let d = (BOX_H / fill) / (2 * t);
    d = Math.max(d, (0.24 / (mobile ? 0.62 : 0.36)) / (2 * t * camera.aspect));
    const visH = 2 * d * t; visW = visH * camera.aspect;
    camera.position.set(0, 0.03, d);
    camera.lookAt(0, mobile ? 0 : -visH * 0.03, 0);
    camera.updateProjectionMatrix();
    if (!busy) poses(current).forEach((p) => Object.assign(pivots[p.i].userData, { x: p.x, z: p.z }));
  }
  new ResizeObserver(resize).observe(stage); resize();

  /* ---------------- pointer: hover light, drag to rotate (with inertia, eases back) */
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), tmp = new THREE.Vector3();
  let drag = null, idle = 0, tiltX = 0, tiltY = 0, hovered = -1, inside = false, lastDx = 0;
  const setNdc = (e) => {
    const r = canvas.getBoundingClientRect();
    const u = (e.clientX - r.left) / r.width, v = (e.clientY - r.top) / r.height;
    ndc.set(u * 2 - 1, -(v * 2 - 1));
    return { u, v, x: e.clientX - r.left, y: e.clientY - r.top };
  };
  const pick = () => {
    ray.setFromCamera(ndc, camera);
    const hit = ray.intersectObjects(pivots.filter((p) => p.visible), true)[0];
    return hit ? hit.object.userData.pivot ?? -1 : -1;
  };
  const held = () => (!drag ? [] : drag.who >= 0 ? [pivots[drag.who]] : []);
  canvas.addEventListener('pointermove', (e) => {
    const p = setNdc(e); inside = true;
    tiltX = p.v - 0.5; tiltY = p.u - 0.5;
    hovered = pick();
    canvas.classList.toggle('is-over', hovered >= 0 || !!drag);
    glow.style.setProperty('--mx', `${p.x}px`); glow.style.setProperty('--my', `${p.y}px`);
    if (!drag) return;
    const dx = e.clientX - drag.x; drag.x = e.clientX;
    if (dx) lastDx = dx;
    held().forEach((pv) => { pv.userData.spin += dx * 0.0105; pv.userData.vel = dx * 0.0105; });
    idle = 0;
  });
  canvas.addEventListener('pointerdown', (e) => {
    setNdc(e);
    const who = pick();
    if (who < 0 && current === COMBO) return;            // empty space in the combo: nothing to grab
    drag = { x: e.clientX, sx: e.clientX, sy: e.clientY, t: performance.now(), hit: who, who: current === COMBO ? who : current };
    canvas.setPointerCapture(e.pointerId); lastDx = 0; idle = 0;
    held().forEach((pv) => { pv.userData.vel = 0; pv.userData.lift = 1; });
    canvas.classList.add('is-over', 'is-dragging');
    hint.classList.add('is-done');
  });
  const end = (e) => {
    if (!drag) return;
    const moved = e && e.type === 'pointerup' ? Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) : 99;
    if (moved < 6 && performance.now() - drag.t < 500 && drag.hit >= 0) {     // a click on a box: open / close it
      const u = pivots[drag.hit].userData; u.isOpen = !u.isOpen; u.openV += u.isOpen ? 1.5 : -1;
    }
    held().forEach((pv) => { pv.userData.lift = 0; });
    drag = null; canvas.classList.remove('is-dragging');
  };
  canvas.addEventListener('pointerup', end); canvas.addEventListener('pointercancel', end);
  canvas.addEventListener('pointerleave', () => { tiltX = tiltY = 0; inside = false; hovered = -1; canvas.classList.remove('is-over'); });

  /* ---------------- tweens */
  const tweens = [];
  const ease = {
    in: (t) => t * t * t,
    out: (t) => 1 - Math.pow(1 - t, 4),
    back: (t) => { const c1 = 1.25, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); },
    pop: (t) => { const c1 = 1.9, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); },
  };
  function tween(obj, to, dur, fn, delay = 0) {
    return new Promise((res) => {
      tweens.push({ obj, from: {}, to, dur, fn, start: performance.now() + delay, res, init: false });
    });
  }
  function stepTweens(now) {
    for (let i = tweens.length - 1; i >= 0; i--) {
      const tw = tweens[i];
      if (now < tw.start) continue;
      if (!tw.init) { for (const k in tw.to) tw.from[k] = tw.obj[k]; tw.init = true; }
      const k = Math.min(1, (now - tw.start) / tw.dur);
      const e = tw.fn(k);
      for (const key in tw.to) tw.obj[key] = tw.from[key] + (tw.to[key] - tw.from[key]) * e;
      if (k === 1) { tweens.splice(i, 1); tw.res(); }
    }
  }

  /* ---------------- swap: boxes that stay glide to their new spot, the others fly in/out */
  window.__swap3d = async (from, to, dir) => {
    const A = poses(from), B = poses(to);
    const off = visW * 0.5 + BOX_W * 1.4;
    const TAU = Math.PI * 2;
    const jobs = [];
    pivots.forEach((pv) => { pv.userData.isOpen = false; });
    A.forEach((a) => {
      if (B.some((b) => b.i === a.i)) return;
      const u = pivots[a.i].userData;
      jobs.push(tween(u, { x: a.x - dir * off, rotY: a.rotY - dir * 1.1, scale: a.s * 0.86 }, 720, ease.in)
        .then(() => { pivots[a.i].visible = false; Object.assign(u, { spin: 0, vel: 0 }); }));
    });
    B.forEach((b, k) => {
      const u = pivots[b.i].userData;
      const stays = A.some((a) => a.i === b.i);
      if (!stays) {
        Object.assign(u, { x: b.x + dir * off, z: b.z, rotY: b.rotY + dir * 1.35, scale: b.s * 0.86, spin: 0, vel: 0 });
        pivots[b.i].visible = true;
      }
      u.vel = 0;
      jobs.push(tween(u, { x: b.x, z: b.z, rotY: b.rotY, scale: b.s, spin: Math.round(u.spin / TAU) * TAU },
        stays ? 900 : 1050, stays ? ease.out : ease.back, stays ? 120 : 260 + k * 90));
    });
    await Promise.all(jobs);
  };

  /* ---------------- loop (paused while the section is off-screen) */
  let running = true, last = performance.now(), hoverAmt = 0;
  new IntersectionObserver(([e]) => { running = e.isIntersecting; if (running) { last = performance.now(); requestAnimationFrame(loop); } }).observe(section);
  function loop(now) {
    if (!running) return;
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    stepTweens(now);
    const t = now / 1000;
    if (!drag) idle += dt;
    const rest = poses(current);
    const grabbed = held();
    let maxSpeed = 0, turn = 0;
    pivots.forEach((pv, i) => {
      const u = pv.userData, sh = shadows[i];
      sh.visible = pv.visible;
      if (!pv.visible) return;
      if (!grabbed.includes(pv)) {                    // inertia, then drift back to the hero pose
        u.vel *= Math.pow(0.04, dt); u.spin += u.vel;
        if (idle > 1.6 && !busy) u.spin += (Math.round(u.spin / (Math.PI * 2)) * Math.PI * 2 - u.spin) * (1 - Math.pow(0.12, dt));
      }
      const sp = Math.abs(u.vel) / Math.max(dt, 1e-3);
      if (sp > maxSpeed) { maxSpeed = sp; turn = u.vel; }
      const openTo = u.isOpen ? 1 : hovered === i && !drag && !busy ? 0.17 : 0;   // hover = a peek
      u.openV += ((openTo - u.open) * 110 - u.openV * 15) * dt;
      u.open += u.openV * dt;
      poseRig(u);
      const liftTo = u.lift ? 1 : hovered === i ? 0.35 : 0;
      u.liftAmt += (liftTo - u.liftAmt) * (1 - Math.pow(0.0015, dt));
      const lift = u.liftAmt;
      const float = reduceMotion ? 0 : Math.sin(t * 1.3 + i * 1.7) * 0.0045;
      const op = Math.max(0, u.open);
      pv.position.set(u.x, float + lift * 0.012 - op * 0.04 * u.scale, u.z);
      pv.rotation.set(BASE_ROT.x + tiltX * 0.08 + op * 0.52, u.rotY + u.spin + tiltY * 0.14, reduceMotion ? 0 : Math.sin(t * 0.9 + i) * 0.012);
      pv.scale.setScalar(u.scale * (1 + lift * 0.025 - op * 0.06));
      const home = rest.find((p) => p.i === i);
      const away = Math.min(1, Math.abs(u.x - (home ? home.x : 0)) * 2.5);
      sh.position.set(u.x, -BOX_H / 2 * u.scale - 0.004, u.z);
      sh.scale.setScalar(u.scale * (1 - away * 0.6) * (1 - lift * 0.08));
      sh.material.opacity = (1 - away) * (1 - (reduceMotion ? 0 : Math.sin(t * 1.3 + i * 1.7) * 0.08)) * (1 - lift * 0.25);
    });

    ray.setFromCamera(ndc, camera);

    // cursor light
    const want = hovered >= 0 || drag ? 1 : inside ? 0.25 : 0;
    hoverAmt += (want - hoverAmt) * (1 - Math.pow(0.004, dt));
    const kz = (0.26 - ray.ray.origin.z) / ray.ray.direction.z;      // where the pointer ray crosses z = 0.26
    tmp.copy(ray.ray.direction).multiplyScalar(kz).add(ray.ray.origin);
    hover.position.lerp(tmp, 1 - Math.pow(0.0002, dt));
    hover.intensity = hoverAmt * LIGHT.point;
    hemi.intensity = 1.45 - hoverAmt * LIGHT.dip;
    glow.style.opacity = (hoverAmt * 0.9).toFixed(3);

    renderer.render(scene, camera);
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
}
const LIGHT = { point: 0.06, dip: 0.16 };
window.__light = LIGHT;   // tweak live from the console

/* ------------------------------------------------------------------ switching */
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
async function go(next) {
  if (next === current) return;
  if (busy) { queued = next; return; }
  busy = true;
  const prev = current, dir = next > prev ? 1 : -1;
  current = next;
  if (reduceMotion) {
    renderCopy(FLAVORS[next], next);
    if (pivots.length) {
      pivots.forEach((p) => { p.visible = false; });
      poses(next).forEach((p) => { pivots[p.i].visible = true; Object.assign(pivots[p.i].userData, { x: p.x, z: p.z, rotY: p.rotY, scale: p.s }); });
    }
    busy = false; return;
  }
  section.dataset.dir = dir;
  section.classList.add('is-leaving');
  const swap3d = window.__swap3d ? window.__swap3d(prev, next, dir) : Promise.resolve();
  await wait(330);
  renderCopy(FLAVORS[next], next);
  section.classList.remove('is-leaving');
  section.classList.add('is-entering');
  void section.offsetWidth;                         // commit the "entering" start state
  requestAnimationFrame(() => section.classList.remove('is-entering'));
  await swap3d;
  busy = false;
  if (queued !== null) { const q = queued; queued = null; go(q); }
}

tabs.forEach((t, i) => t.addEventListener('click', () => go(i)));
$('.picker__list').addEventListener('keydown', (e) => {
  if (!['ArrowRight', 'ArrowLeft', 'Home', 'End'].includes(e.key)) return;
  e.preventDefault();
  const n = e.key === 'Home' ? 0 : e.key === 'End' ? total - 1
    : (current + (e.key === 'ArrowRight' ? 1 : -1) + total) % total;
  go(n); tabs[n].focus();
});

/* ------------------------------------------------------------------ cart */
initCart();
const pickerThumb = () => tabs[current].querySelector('.picker__thumb');
$('#d-add').addEventListener('click', async (e) => {
  const id = FLAVORS[current].id;
  const b = e.currentTarget; b.classList.add('is-added');
  await fly(id, canvas.classList.contains('is-ready') ? canvas : pickerThumb());
  addToCart(id);
  setTimeout(() => b.classList.remove('is-added'), 1400);
});
$('#d-cta').addEventListener('click', () => { addToCart(FLAVORS[current].id); openCart(); });
