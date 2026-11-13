/* Hero background carousel: cross-fade + slow zoom, progress bars, pause/play. */
const hero = document.querySelector('.hero');
const slides = [...hero.querySelectorAll('.hero__slide')];
const dots = [...hero.querySelectorAll('.hero__dot')];
const playBtn = hero.querySelector('.hero__play');
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const DUR = 6500;

let index = 0, progress = 0, playing = !reduce, visible = true, last = performance.now();

function show(n) {
  slides[index].classList.remove('is-on'); slides[index].setAttribute('aria-hidden', 'true');
  dots[index].classList.remove('is-on'); dots[index].removeAttribute('aria-current');
  dots[index].querySelector('i').style.transform = '';
  index = (n + slides.length) % slides.length;
  const s = slides[index];
  s.loading = 'eager';
  s.classList.remove('is-on'); void s.offsetWidth;                     // restart the zoom
  s.classList.add('is-on'); s.removeAttribute('aria-hidden');
  dots[index].classList.add('is-on'); dots[index].setAttribute('aria-current', 'true');
  progress = 0;
}

function setPlaying(v) {
  playing = v;
  hero.classList.toggle('is-paused', !v);
  playBtn.setAttribute('aria-pressed', String(!v));
  playBtn.setAttribute('aria-label', v ? 'Pausar carrossel' : 'Reproduzir carrossel');
}

function tick(now) {
  const dt = now - last; last = now;
  if (playing && visible && !document.hidden) {
    progress += dt / DUR;
    if (progress >= 1) show(index + 1);
  }
  dots[index].querySelector('i').style.transform = `scaleX(${Math.min(1, progress)})`;
  requestAnimationFrame(tick);
}

dots.forEach((d, k) => d.addEventListener('click', () => { if (k !== index) show(k); }));
playBtn.addEventListener('click', () => setPlaying(!playing));
new IntersectionObserver(([e]) => { visible = e.isIntersecting; hero.classList.toggle('is-offscreen', !visible); }).observe(hero);

setPlaying(playing);
requestAnimationFrame((t) => { last = t; hero.classList.add('is-ready'); tick(t); });
