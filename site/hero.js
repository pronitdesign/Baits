/* Hero carousel: draggable, eased transitions with layered parallax (photo, then each text line),
   next-slide preview card with autoplay progress, pause/play. Images stay still at rest. */
const hero = document.querySelector('.hero');
const card = hero.querySelector('.hero__card');
const slides = [...hero.querySelectorAll('.hero__slide')];
const previews = [...hero.querySelectorAll('.hero__next-media img')];
const bar = hero.querySelector('.hero__next-bar i');
const nowEl = hero.querySelector('#hero-now');
const nextBtn = hero.querySelector('.hero__next');
const playBtn = hero.querySelector('.hero__play');
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const N = slides.length;
const DUR = 7000;

const parts = slides.map((s) => ({
  el: s, img: s.querySelector('.hero__img'), lines: [...s.querySelectorAll('.hero__in')],
}));

let pos = 0;              // continuous slide position (0 = first slide centred)
let index = 0;            // settled slide
let anim = null;          // { from, to, t0, dur, ease }
let progress = 0, playing = !reduce, visible = true, last = performance.now();
let drag = null, suppressClick = false;

const wrap = (d) => ((((d + N / 2) % N) + N) % N) - N / 2;   // -> [-N/2, N/2)
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const easeInOut = (t) => (t < 0.5 ? 8 * t ** 4 : 1 - (-2 * t + 2) ** 4 / 2);   // quart
const easeOut = (t) => 1 - (1 - t) ** 4;

function layout() {
  const w = card.clientWidth;
  parts.forEach((p, k) => {
    const d = wrap(k - pos);                    // -1..1 around the viewport
    const a = Math.abs(d);
    p.el.style.transform = `translate3d(${d * w}px,0,0)`;
    p.el.style.visibility = a >= 1 ? 'hidden' : 'visible';
    p.el.style.zIndex = a < 0.5 ? 1 : 0;
    p.img.style.transform = `translate3d(${-d * w * 0.38}px,0,0)`;              // photo lags behind
    p.lines.forEach((ln, i) => {                                                // text lines cascade
      ln.style.transform = `translate3d(${d * w * (0.12 + i * 0.07)}px,0,0)`;
      ln.style.opacity = String(clamp(1 - a * (1.6 + i * 0.25), 0, 1));
    });
  });
}

function setIndex(n) {
  index = ((n % N) + N) % N;
  slides.forEach((s, k) => {
    const on = k === index;
    s.classList.toggle('is-on', on);
    s.setAttribute('aria-hidden', String(!on));
    s.querySelectorAll('a').forEach((a) => { a.tabIndex = on ? 0 : -1; });
    if (on) s.querySelector('.hero__img').loading = 'eager';
  });
  const next = (index + 1) % N;
  previews.forEach((img, k) => img.classList.toggle('is-on', k === next));
  nowEl.textContent = String(index + 1).padStart(2, '0');
  progress = 0;
}

function goTo(target, { dur = 1150, ease = easeInOut } = {}) {
  if (reduce) { pos = target; setIndex(Math.round(target)); layout(); return; }
  anim = { from: pos, to: target, t0: performance.now(), dur, ease };
  setIndex(Math.round(target));
}
const next = () => goTo(Math.round(pos) + 1);

function setPlaying(v) {
  playing = v;
  hero.classList.toggle('is-paused', !v);
  playBtn.setAttribute('aria-pressed', String(!v));
  playBtn.setAttribute('aria-label', v ? 'Pausar carrossel' : 'Reproduzir carrossel');
}

function tick(now) {
  const dt = now - last; last = now;
  if (anim) {
    const t = clamp((now - anim.t0) / anim.dur, 0, 1);
    pos = anim.from + (anim.to - anim.from) * anim.ease(t);
    if (t >= 1) anim = null;
    layout();
  }
  if (playing && visible && !document.hidden && !drag && !anim) {
    progress += dt / DUR;
    if (progress >= 1) next();
  }
  bar.style.transform = `scaleX(${drag || anim ? 0 : Math.min(1, progress)})`;
  requestAnimationFrame(tick);
}

/* ---- dragging */
card.addEventListener('pointerdown', (e) => {
  if (e.button !== 0 || e.target.closest('a, button')) return;
  anim = null;
  drag = { x: e.clientX, y: e.clientY, start: pos, moved: false, hist: [[e.timeStamp, e.clientX]], id: e.pointerId };
});
window.addEventListener('pointermove', (e) => {
  if (!drag || e.pointerId !== drag.id) return;
  const dx = e.clientX - drag.x;
  if (!drag.moved) {
    if (Math.abs(dx) < 6) return;
    if (Math.abs(e.clientY - drag.y) > Math.abs(dx)) { drag = null; return; }    // vertical: let the page scroll
    drag.moved = true; card.classList.add('is-dragging');
    try { card.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
  }
  pos = drag.start - dx / card.clientWidth;
  drag.hist.push([e.timeStamp, e.clientX]); if (drag.hist.length > 6) drag.hist.shift();
  layout();
});
function endDrag(e) {
  if (!drag || (e && e.pointerId !== drag.id)) return;
  const d = drag; drag = null; card.classList.remove('is-dragging');
  if (!d.moved) return;
  suppressClick = true; setTimeout(() => { suppressClick = false; }, 0);
  const [t0, x0] = d.hist[0], [t1, x1] = d.hist[d.hist.length - 1];
  const v = t1 > t0 ? (x1 - x0) / (t1 - t0) : 0;                               // px/ms
  let target = Math.round(pos);
  if (Math.abs(v) > 0.35) target = v < 0 ? Math.floor(pos) + 1 : Math.ceil(pos) - 1;
  else if (Math.abs(pos - d.start) > 0.18) target = pos > d.start ? Math.ceil(pos) : Math.floor(pos);
  target = clamp(target, Math.floor(d.start) - 1, Math.ceil(d.start) + 1);
  goTo(target, { dur: 900, ease: easeOut });
}
window.addEventListener('pointerup', endDrag);
window.addEventListener('pointercancel', endDrag);
card.addEventListener('click', (e) => { if (suppressClick) { e.preventDefault(); e.stopPropagation(); } }, true);

/* ---- controls */
nextBtn.addEventListener('click', next);
playBtn.addEventListener('click', () => setPlaying(!playing));
card.tabIndex = -1;
hero.addEventListener('keydown', (e) => {
  if (e.key === 'ArrowRight') next();
  if (e.key === 'ArrowLeft') goTo(Math.round(pos) - 1);
});
window.addEventListener('resize', layout);
new IntersectionObserver(([e]) => { visible = e.isIntersecting; }).observe(hero);

/* header: transparent over the banner, filled once the page scrolls */
const nav = document.getElementById('nav');
const navState = () => nav.classList.toggle('is-top', scrollY < 24);
addEventListener('scroll', navState, { passive: true });
navState();

setIndex(0); layout(); setPlaying(playing);
requestAnimationFrame((t) => { last = t; hero.classList.add('is-ready'); tick(t); });
