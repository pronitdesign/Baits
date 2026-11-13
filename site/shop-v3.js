/* Product carousel (cards). Prices are fictitious (same source as the cart). */
import { PRODUCTS, add, fly } from './cart.js?v=4';

const ITEMS = [
  { id: 'coffee-wake', mood: 'start', tag: 'Mais vendido', name: 'Coffee Wake', desc: 'Cereal de café e granola · 350 g', img: 'assets/box-coffee-wake.png', hover: 'assets/hover-coffee-wake.jpg' },
  { id: 'brownie-cafe', mood: 'start', tag: 'Novo', name: 'Brownie de Café', desc: 'Barra de proteína · 45 g', img: 'assets/bar-brownie-cafe.png?v=2', hover: 'assets/hover-brownie-cafe.jpg', bar: true },
  { id: 'flow-crunch', mood: 'flow', name: 'Flow Crunch', desc: 'Chocolate branco e cookie · 350 g', img: 'assets/box-flow-crunch.png', hover: 'assets/hover-flow-crunch.jpg' },
  { id: 'avela-coco', mood: 'flow', tag: 'Favorito', name: 'Avelã com Coco', desc: 'Barra de proteína · 45 g', img: 'assets/bar-avela-coco.png?v=2', hover: 'assets/hover-avela-coco.jpg', bar: true },
  { id: 'banana-rings', mood: 'reset', name: 'Banana Rings', desc: 'Banana caramelizada e canela · 350 g', img: 'assets/box-banana-rings.png', hover: 'assets/hover-banana-rings.jpg' },
  { id: 'banana-nozes', mood: 'reset', tag: 'Novo', name: 'Banana com Nozes', desc: 'Barra de proteína · 45 g', img: 'assets/bar-banana-nozes.png?v=2', hover: 'assets/hover-banana-nozes.jpg', bar: true },
  { id: 'combo', mood: 'all', tag: 'Combo −11%', name: 'Combo Trio', desc: 'Os três cereais · 3 × 350 g', combo: true },
];
const MOOD = { start: 'Start', flow: 'Flow', reset: 'Reset', all: 'Start · Flow · Reset' };
const brl = (v) => `R$ ${v.toFixed(2).replace('.', ',')}`;

const track = document.getElementById('shop-track');

const media = (it) => it.combo
  ? `<span class="pcard__combo"><img src="assets/box-coffee-wake.png" alt="" loading="lazy"><img src="assets/box-banana-rings.png" alt="" loading="lazy"><img src="assets/box-flow-crunch.png" alt="" loading="lazy"></span>`
  : `<img class="pcard__product${it.bar ? ' is-bar' : ''}" src="${it.img}" alt="${it.name}" width="1200" height="1200" loading="lazy">`
    + (it.hover ? `<img class="pcard__photo" src="${it.hover}" alt="" loading="lazy">` : '');

track.innerHTML = ITEMS.map((it) => `
  <li class="pcard" data-id="${it.id}">
    <div class="pcard__media">
      ${it.tag ? `<span class="pcard__tag">${it.tag}</span>` : ''}
      ${media(it)}
    </div>
    <div class="pcard__body">
      <p class="pcard__mood"><i class="dot dot--${it.mood}"></i>${MOOD[it.mood]}</p>
      <h3>${it.name}</h3>
      <p class="pcard__desc">${it.desc}</p>
      <div class="pcard__row">
        <strong>${brl(PRODUCTS[it.id].price)}</strong>
        <button type="button" class="pcard__add" aria-label="Adicionar ${it.name} ao carrinho">
          <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 8h10M8 3v10"/></svg>Carrinho
        </button>
      </div>
    </div>
  </li>`).join('');

track.addEventListener('click', (e) => {
  const b = e.target.closest('.pcard__add'); if (!b) return;
  const card = b.closest('.pcard');
  const id = card.dataset.id;
  b.classList.add('is-added'); setTimeout(() => b.classList.remove('is-added'), 900);
  fly(id, card.querySelector('.pcard__media')).then(() => add(id));
});

/* arrows scroll one card at a time; disabled at the ends */
const arrows = [...document.querySelectorAll('.shop__arrow')];
const step = () => track.firstElementChild.getBoundingClientRect().width + parseFloat(getComputedStyle(track).columnGap || 0);
arrows.forEach((a) => a.addEventListener('click', () => track.scrollBy({ left: step() * Number(a.dataset.dir), behavior: 'smooth' })));
function edges() {
  arrows[0].disabled = track.scrollLeft < 4;
  arrows[1].disabled = track.scrollLeft + track.clientWidth > track.scrollWidth - 4;
}
track.addEventListener('scroll', edges, { passive: true });

/* mouse drag (touch already scrolls natively): follow the pointer, fling with momentum, settle on a card */
let drag = null, suppress = false;
track.addEventListener('dragstart', (e) => e.preventDefault());
track.addEventListener('pointerdown', (e) => {
  if (e.pointerType !== 'mouse' || e.button !== 0 || e.target.closest('button')) return;
  drag = { x: e.clientX, left: track.scrollLeft, moved: false, id: e.pointerId, hist: [[e.timeStamp, e.clientX]] };
});
window.addEventListener('pointermove', (e) => {
  if (!drag || e.pointerId !== drag.id) return;
  const dx = e.clientX - drag.x;
  if (!drag.moved) {
    if (Math.abs(dx) < 5) return;
    drag.moved = true; track.classList.add('is-dragging');
    try { track.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
  }
  track.scrollLeft = drag.left - dx;
  drag.hist.push([e.timeStamp, e.clientX]); if (drag.hist.length > 6) drag.hist.shift();
});
function endDrag(e) {
  if (!drag || e.pointerId !== drag.id) return;
  const d = drag; drag = null;
  if (!d.moved) return;
  suppress = true; setTimeout(() => { suppress = false; }, 0);
  const [t0, x0] = d.hist[0], [t1, x1] = d.hist[d.hist.length - 1];
  const v = t1 > t0 ? (x1 - x0) / (t1 - t0) : 0;            // px/ms
  const s = step(), max = track.scrollWidth - track.clientWidth;
  const fling = Math.max(-2 * s, Math.min(2 * s, -v * 260));   // at most two cards of momentum
  const target = Math.max(0, Math.min(max, Math.round((track.scrollLeft + fling) / s) * s));
  track.scrollTo({ left: target, behavior: 'smooth' });
  const done = () => track.classList.remove('is-dragging');
  if ('onscrollend' in window) track.addEventListener('scrollend', done, { once: true });
  setTimeout(done, 900);
}
window.addEventListener('pointerup', endDrag);
window.addEventListener('pointercancel', endDrag);
track.addEventListener('click', (e) => { if (suppress) { e.preventDefault(); e.stopPropagation(); } }, true);
window.addEventListener('resize', edges);
edges();
