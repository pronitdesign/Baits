/* Footer: giant wordmark sized to the card width, light sweep (only while visible) + cursor spotlight.
   Newsletter is a prototype (nothing is sent). */
import { toast } from './cart.js?v=5';

const mark = document.getElementById('foot-mark');
mark.dataset.text = mark.textContent;

const foot = document.querySelector('.foot');
const card = foot.querySelector('.foot__card');
const page = document.querySelector('.page');
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

/* fit "Baits" edge to edge, but keep the whole footer within one screen so it can be revealed */
function fit() {
  mark.style.fontSize = '100px';
  const range = document.createRange(); range.selectNodeContents(mark);
  let fs = (100 * mark.clientWidth * 0.995) / range.getBoundingClientRect().width;
  mark.style.fontSize = `${fs}px`;
  const over = foot.offsetHeight - innerHeight;
  if (over > 0) { fs -= over / (mark.offsetHeight / fs); mark.style.fontSize = `${Math.max(60, fs)}px`; }
  foot.classList.toggle('is-reveal', foot.offsetHeight <= innerHeight);
  reveal();
}

/* as the page slides up, the card drops in from above */
function reveal() {
  if (reduce || !foot.classList.contains('is-reveal')) { card.style.transform = ''; return; }
  const h = foot.offsetHeight;
  const p = Math.min(1, Math.max(0, (innerHeight - page.getBoundingClientRect().bottom) / h));
  const e = 1 - (1 - p) ** 3;
  card.style.transform = `translate3d(0, ${-(1 - e) * h * 0.3}px, 0) scale(${0.96 + 0.04 * e})`;
}
addEventListener('scroll', reveal, { passive: true });
document.fonts.ready.then(fit);
addEventListener('resize', fit);
fit();

new IntersectionObserver(([e]) => mark.classList.toggle('is-visible', e.isIntersecting)).observe(mark);
mark.addEventListener('pointermove', (e) => {
  const r = mark.getBoundingClientRect();
  mark.style.setProperty('--mx', `${e.clientX - r.left}px`);
  mark.style.setProperty('--my', `${e.clientY - r.top}px`);
});

document.getElementById('foot-news').addEventListener('submit', (e) => {
  e.preventDefault();
  const input = e.target.email;
  if (!input.checkValidity()) { input.focus(); toast('Confere o e-mail: parece que faltou alguma coisa.'); return; }
  input.value = '';
  toast('Protótipo: o cadastro ainda não está conectado.');
});
