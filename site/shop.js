/* Product grid: six big cards, 2 columns × 3 rows. Prices are fictitious (same source as the cart). */
import { PRODUCTS, add, fly } from './cart.js?v=5';

const ITEMS = [
  { id: 'coffee-wake', mood: 'start', tag: 'Mais vendido', name: 'Coffee Wake', desc: 'Cereal de café e granola · 350 g', img: 'assets/box-coffee-wake.png', hover: 'assets/hover-coffee-wake.jpg' },
  { id: 'brownie-cafe', mood: 'start', tag: 'Novo', name: 'Brownie de Café', desc: 'Barra de proteína · 45 g', img: 'assets/bar-brownie-cafe.png?v=2', hover: 'assets/hover-brownie-cafe.jpg', bar: true },
  { id: 'flow-crunch', mood: 'flow', name: 'Flow Crunch', desc: 'Chocolate branco e cookie · 350 g', img: 'assets/box-flow-crunch.png', hover: 'assets/hover-flow-crunch.jpg' },
  { id: 'avela-coco', mood: 'flow', tag: 'Favorito', name: 'Avelã com Coco', desc: 'Barra de proteína · 45 g', img: 'assets/bar-avela-coco.png?v=2', hover: 'assets/hover-avela-coco.jpg', bar: true },
  { id: 'banana-rings', mood: 'reset', name: 'Banana Rings', desc: 'Banana caramelizada e canela · 350 g', img: 'assets/box-banana-rings.png', hover: 'assets/hover-banana-rings.jpg' },
  { id: 'banana-nozes', mood: 'reset', tag: 'Novo', name: 'Banana com Nozes', desc: 'Barra de proteína · 45 g', img: 'assets/bar-banana-nozes.png?v=2', hover: 'assets/hover-banana-nozes.jpg', bar: true },
];
const MOOD = { start: 'Start', flow: 'Flow', reset: 'Reset' };
const brl = (v) => `R$ ${v.toFixed(2).replace('.', ',')}`;

const grid = document.getElementById('shop-track');

grid.innerHTML = ITEMS.map((it) => `
  <li class="pcard" data-id="${it.id}">
    <div class="pcard__media">
      ${it.tag ? `<span class="pcard__tag">${it.tag}</span>` : ''}
      <img class="pcard__product${it.bar ? ' is-bar' : ''}" src="${it.img}" alt="${it.name}" width="800" height="800" loading="lazy">
      <img class="pcard__photo" src="${it.hover}" alt="" loading="lazy">
    </div>
    <div class="pcard__body">
      <div class="pcard__info">
        <p class="pcard__mood"><i class="dot dot--${it.mood}"></i>${MOOD[it.mood]}</p>
        <h3>${it.name}</h3>
        <p class="pcard__desc">${it.desc}</p>
      </div>
      <div class="pcard__row">
        <strong>${brl(PRODUCTS[it.id].price)}</strong>
        <button type="button" class="pcard__add" aria-label="Adicionar ${it.name} ao carrinho">
          <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 8h10M8 3v10"/></svg>Carrinho
        </button>
      </div>
    </div>
  </li>`).join('');

grid.addEventListener('click', (e) => {
  const b = e.target.closest('.pcard__add'); if (!b) return;
  const card = b.closest('.pcard');
  const id = card.dataset.id;
  b.classList.add('is-added'); setTimeout(() => b.classList.remove('is-added'), 900);
  fly(id, card.querySelector('.pcard__media')).then(() => add(id));
});
