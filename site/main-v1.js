import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

/* ------------------------------------------------------------------ content
   Nutrition values mirror the badges printed on the box (350 g · 12 g · 80 kcal).
   Prices are fictitious. */
const PACK_SPECS = [
  { v: '12', u: 'g', l: 'Proteína por porção' },
  { v: '80', u: 'kcal', l: 'Energia por porção' },
  { v: '350', u: 'g', l: 'Caixa' },
];
const FLAVORS = [
  {
    id: 'coffee-wake', name: ['Coffee', 'Wake'], ghost: 'Start', pill: ['Linha', 'START'],
    tagline: 'Seu dia começa pela colher.',
    text: 'Café e granola crocante em uma combinação que dá vontade de sair da cama. Sirva, acrescente seu leite favorito e comece pelo sabor.',
    cta: 'Quero Coffee Wake', price: ['29', ',90'], unit: 'por caixa de 350 g', specs: PACK_SPECS,
  },
  {
    id: 'flow-crunch', name: ['Flow', 'Crunch'], ghost: 'Flow', pill: ['Linha', 'FLOW'],
    tagline: 'Uma colherada. Várias ideias.',
    text: 'Cereais crocantes, chocolate branco e pedacinhos de cookie de baunilha. Uma combinação de sabores e texturas para deixar seu intervalo mais gostoso.',
    cta: 'Quero Flow Crunch', price: ['27', ',90'], unit: 'por caixa de 350 g', specs: PACK_SPECS,
  },
  {
    id: 'banana-rings', name: ['Banana', 'Rings'], ghost: 'Reset', pill: ['Linha', 'RESET'],
    tagline: 'Um respiro com gosto de banana.',
    text: 'Anéis de banana caramelizada, granola crocante e um toque de canela. Para sentar, saborear e dar um tempo antes da próxima ideia.',
    cta: 'Quero Banana Rings', price: ['26', ',90'], unit: 'por caixa de 350 g', specs: PACK_SPECS,
  },
  {
    id: 'combo', name: ['Combo', 'Trio'], ghost: 'Mix', pill: ['Kit', 'TRIO'],
    tagline: 'Um sabor pra cada momento do dia.',
    text: 'Coffee Wake pra acordar, Flow Crunch pro intervalo e Banana Rings pra desacelerar. As três caixas juntas, com preço de combo.',
    cta: 'Quero o combo', price: ['74', ',90'], was: 'R$ 84,70', unit: '3 caixas de 350 g',
    specs: [
      { v: '3', u: 'caixas', l: 'Coffee · Flow · Banana' },
      { v: '1,05', u: 'kg', l: 'De cereal no total' },
      { v: '9,80', u: 'R$', pre: true, l: 'De economia' },
    ],
  },
];
const COMBO = 3;

const $ = (s, r = document) => r.querySelector(s);
const section = $('.flavors');
const canvas = $('#scene');
const stage = $('#stage');
const glow = $('#glow');
const tabs = [...document.querySelectorAll('.picker__item')];
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const total = FLAVORS.length;

let current = 0;
let busy = false;
let queued = null;

/* ------------------------------------------------------------------ copy + chrome */
function renderCopy(f, i) {
  section.dataset.flavor = f.id;
  $('#d-pill-label').textContent = f.pill[0];
  $('#d-line').textContent = f.pill[1];
  $('#d-name-1').textContent = f.name[0];
  $('#d-name-2').textContent = f.name[1];
  $('#d-tagline').textContent = f.tagline;
  $('#d-text').textContent = f.text;
  $('#d-cta-label').textContent = f.cta;
  $('#d-cta').setAttribute('aria-label', `${f.cta}, R$ ${f.price.join('')}`);
  $('#d-price').textContent = f.price[0];
  $('#d-cents').textContent = f.price[1];
  $('#d-was').textContent = f.was || '';
  $('#d-was').hidden = !f.was;
  $('#d-unit').textContent = f.unit;
  $('#d-specs').innerHTML = f.specs.map((s) => `<li class="spec">
      <span class="spec__value">${s.pre ? `<small>${s.u}</small>${s.v}` : `${s.v}<small>${s.u}</small>`}</span>
      <span class="spec__label">${s.l}</span></li>`).join('');
  $('.ghost__word').textContent = f.ghost;
  $('#counter-now').textContent = String(i + 1).padStart(2, '0');
  document.querySelectorAll('.bg__layer').forEach((l) => l.classList.toggle('is-on', l.dataset.bg === f.id));
  tabs.forEach((t, k) => { t.setAttribute('aria-selected', String(k === i)); t.tabIndex = k === i ? 0 : -1; });
  const fb = $('#fallback'); if (fb) fb.src = `assets/thumb-${i === COMBO ? 'flow-crunch' : f.id}.png`;
}
$('#counter-total').textContent = String(total).padStart(2, '0');
renderCopy(FLAVORS[0], 0);

/* ------------------------------------------------------------------ cereal sound (synthesised, no files)
   Dry flakes rattling in a carton: short band-passed noise grains + a soft cardboard thump. */
const Sound = (() => {
  let ctx, out, noise, enabled = true;
  try { enabled = localStorage.getItem('baits-sound') !== 'off'; } catch (e) { /* storage blocked */ }
  function init() {
    if (ctx) return true;
    if (!enabled) return false;
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return false;
    ctx = new AC();
    const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -18; comp.ratio.value = 6;
    out = ctx.createGain(); out.gain.value = 0.55;
    out.connect(comp).connect(ctx.destination);
    noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = noise.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return true;
  }
  function grain(t, amp) {
    const src = ctx.createBufferSource(); src.buffer = noise;
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass';
    bp.frequency.value = 1400 + Math.random() * 5200; bp.Q.value = 0.9 + Math.random() * 2.6;
    const g = ctx.createGain(); const dur = 0.008 + Math.random() * 0.028;
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(amp, t + 0.0015);
    g.gain.exponentialRampToValueAtTime(0.0005, t + dur);
    src.connect(bp).connect(g).connect(out);
    src.start(t, Math.random() * 0.9, dur + 0.01);
  }
  function thump(t, amp) {
    const src = ctx.createBufferSource(); src.buffer = noise;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 260; lp.Q.value = 1.2;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(amp, t + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0005, t + 0.11);
    src.connect(lp).connect(g).connect(out); src.start(t, Math.random() * 0.8, 0.13);
  }
  return {
    get on() { return enabled; },
    set on(v) {
      enabled = v; try { localStorage.setItem('baits-sound', v ? 'on' : 'off'); } catch (e) { /* ignore */ }
      if (ctx) out.gain.setTargetAtTime(v ? 0.55 : 0, ctx.currentTime, 0.03);
    },
    /** a burst: grab, change of direction */
    shake(power = 1) {
      if (!enabled || !init()) return;
      if (ctx.state === 'suspended') ctx.resume();
      const t0 = ctx.currentTime + 0.005, n = Math.round(14 + 34 * power), spread = 0.07 + 0.16 * power;
      thump(t0, 0.5 * power + 0.15);
      for (let k = 0; k < n; k++) {
        const r = Math.random();
        grain(t0 + spread * r * r, (0.2 + Math.random() * 0.5) * (1 - r * 0.6) * (0.5 + power * 0.5));
      }
    },
    /** continuous rattle while the box turns; call every frame with angular speed (rad/s) */
    rattle(speed, dt) {
      if (!enabled || !ctx || speed < 0.6) return;
      const rate = Math.min(140, speed * 14);                     // grains per second
      let n = rate * dt; const t0 = ctx.currentTime + 0.01;
      while (n > 0) {
        if (n >= 1 || Math.random() < n) grain(t0 + Math.random() * dt, Math.min(0.5, 0.06 + speed * 0.03) * (0.4 + Math.random() * 0.6));
        n -= 1;
      }
    },
  };
})();

const soundBtn = $('#sound');
function syncSoundBtn() {
  soundBtn.setAttribute('aria-pressed', String(Sound.on));
  soundBtn.querySelector('.sound__label').textContent = Sound.on ? 'Som ligado' : 'Som desligado';
}
soundBtn.addEventListener('click', () => { Sound.on = !Sound.on; syncSoundBtn(); if (Sound.on) Sound.shake(0.5); });
syncSoundBtn();

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
    pivot.userData = { x: 0, z: 0, rotY: BASE_ROT.y, scale: 1, spin: 0, vel: 0, lift: 0, liftAmt: 0 };
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
        // a touch of sheen so the cursor light reads as light on printed board
        o.material.roughness = Math.min(o.material.roughness ?? 1, 0.62); o.material.metalness = 0;
      });
      pivot.add(m);
      if (i === 0 || i === current) canvas.classList.add('is-ready');
    }, undefined, () => { $('#fallback').hidden = false; });
  });

  /* ---------------- layout: fit the box to the stage */
  function resize() {
    const w = stage.clientWidth, h = stage.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    const mobile = w < 900;
    const fill = mobile ? 0.74 : 0.68;             // share of stage height used by the box
    const t = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    let d = (BOX_H / fill) / (2 * t);
    d = Math.max(d, (0.24 / (mobile ? 0.7 : 0.4)) / (2 * t * camera.aspect));
    const visH = 2 * d * t; visW = visH * camera.aspect;
    camera.position.set(0, 0.035, d);
    camera.lookAt(0, mobile ? 0 : -visH * 0.045, 0);
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
    // flipping direction throws the flakes against the other wall
    if (Math.abs(dx) > 6 && lastDx && Math.sign(dx) !== Math.sign(lastDx)) Sound.shake(Math.min(1, Math.abs(dx) / 30));
    if (dx) lastDx = dx;
    held().forEach((pv) => { pv.userData.spin += dx * 0.0105; pv.userData.vel = dx * 0.0105; });
    idle = 0;
  });
  canvas.addEventListener('pointerdown', (e) => {
    setNdc(e);
    const who = pick();
    if (who < 0 && current === COMBO) return;            // empty space in the combo: nothing to grab
    drag = { x: e.clientX, who: current === COMBO ? who : current };
    canvas.setPointerCapture(e.pointerId); lastDx = 0; idle = 0;
    held().forEach((pv) => { pv.userData.vel = 0; pv.userData.lift = 1; });
    canvas.classList.add('is-over', 'is-dragging');
    Sound.shake(0.75);
  });
  const end = () => {
    if (!drag) return;
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
    let maxSpeed = 0;
    pivots.forEach((pv, i) => {
      const u = pv.userData, sh = shadows[i];
      sh.visible = pv.visible;
      if (!pv.visible) return;
      if (!grabbed.includes(pv)) {                    // inertia, then drift back to the hero pose
        u.vel *= Math.pow(0.04, dt); u.spin += u.vel;
        if (idle > 1.6 && !busy) u.spin += (Math.round(u.spin / (Math.PI * 2)) * Math.PI * 2 - u.spin) * (1 - Math.pow(0.12, dt));
      }
      maxSpeed = Math.max(maxSpeed, Math.abs(u.vel) / Math.max(dt, 1e-3));
      const liftTo = u.lift ? 1 : hovered === i ? 0.35 : 0;
      u.liftAmt += (liftTo - u.liftAmt) * (1 - Math.pow(0.0015, dt));
      const lift = u.liftAmt;
      const float = reduceMotion ? 0 : Math.sin(t * 1.3 + i * 1.7) * 0.0045;
      pv.position.set(u.x, float + lift * 0.012, u.z);
      pv.rotation.set(BASE_ROT.x + tiltX * 0.08, u.rotY + u.spin + tiltY * 0.14, reduceMotion ? 0 : Math.sin(t * 0.9 + i) * 0.012);
      pv.scale.setScalar(u.scale * (1 + lift * 0.025));
      const home = rest.find((p) => p.i === i);
      const away = Math.min(1, Math.abs(u.x - (home ? home.x : 0)) * 2.5);
      sh.position.set(u.x, -BOX_H / 2 * u.scale - 0.004, u.z);
      sh.scale.setScalar(u.scale * (1 - away * 0.6) * (1 - lift * 0.08));
      sh.material.opacity = (1 - away) * (1 - (reduceMotion ? 0 : Math.sin(t * 1.3 + i * 1.7) * 0.08)) * (1 - lift * 0.25);
    });
    if (drag) Sound.rattle(maxSpeed, dt);

    // cursor light
    const want = hovered >= 0 || drag ? 1 : inside ? 0.25 : 0;
    hoverAmt += (want - hoverAmt) * (1 - Math.pow(0.004, dt));
    ray.setFromCamera(ndc, camera);
    const k = (0.26 - ray.ray.origin.z) / ray.ray.direction.z;      // where the pointer ray crosses z = 0.26
    tmp.copy(ray.ray.direction).multiplyScalar(k).add(ray.ray.origin);
    hover.position.lerp(tmp, 1 - Math.pow(0.0002, dt));
    hover.intensity = hoverAmt * LIGHT.point;
    hemi.intensity = 1.45 - hoverAmt * LIGHT.dip;                   // tiny dip so the pool of light reads
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
