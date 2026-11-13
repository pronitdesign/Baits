/* Cart: state (kept in this browser), drawer UI, nav counter, fly-to-cart animation.
   Prices are fictitious. */
export const PRODUCTS = {
  'coffee-wake': { name: 'Coffee Wake', desc: 'Café e granola crocante. Caixa de 350 g.', price: 29.9, thumb: 'assets/box-coffee-wake.png' },
  'flow-crunch': { name: 'Flow Crunch', desc: 'Chocolate branco e cookie de baunilha. Caixa de 350 g.', price: 27.9, thumb: 'assets/box-flow-crunch.png' },
  'banana-rings': { name: 'Banana Rings', desc: 'Banana caramelizada e canela. Caixa de 350 g.', price: 26.9, thumb: 'assets/box-banana-rings.png' },
  'brownie-cafe': { name: 'Barra Brownie de Café', desc: 'Barra de proteína, 45 g. 12 g de proteína.', price: 8.9, thumb: 'assets/bar-brownie-cafe.png?v=2' },
  'avela-coco': { name: 'Barra Avelã com Coco', desc: 'Barra de proteína, 45 g. 12 g de proteína.', price: 8.9, thumb: 'assets/bar-avela-coco.png?v=2' },
  'banana-nozes': { name: 'Barra Banana com Nozes', desc: 'Barra de proteína, 45 g. 12 g de proteína.', price: 8.9, thumb: 'assets/bar-banana-nozes.png?v=2' },
  combo: { name: 'Combo Trio', desc: 'Os três sabores, 3 caixas de 350 g.', price: 74.9, thumb: 'assets/thumb-flow-crunch.png', combo: true },
};
const brl = (v) => `R$ ${v.toFixed(2).replace('.', ',')}`;
const KEY = 'baits-cart';
const $ = (s, r = document) => r.querySelector(s);

let items = {};
try { items = JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { items = {}; }
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(items)); } catch (e) { /* storage blocked */ } };
const count = () => Object.values(items).reduce((a, b) => a + b, 0);

const root = $('#cart');
const panel = $('.cart__panel', root);
let lastFocus = null;
let onAddHook = () => {};

function thumb(id) {
  const p = PRODUCTS[id];
  if (!p.combo) return `<img src="${p.thumb}" alt="" width="120" height="120">`;
  return `<span class="cart-thumb-combo"><img src="assets/thumb-coffee-wake.png" alt=""><img src="assets/thumb-banana-rings.png" alt=""><img src="assets/thumb-flow-crunch.png" alt=""></span>`;
}

function render() {
  const n = count();
  $('#nav-count').textContent = n;
  $('#open-cart').setAttribute('aria-label', `Carrinho, ${n} ${n === 1 ? 'item' : 'itens'}`);
  $('#cart-count').textContent = n;
  const ids = Object.keys(items);
  $('#cart-items').innerHTML = ids.map((id) => {
    const p = PRODUCTS[id];
    return `<li class="cart-item" data-id="${id}">
      <div class="cart-item__thumb">${thumb(id)}</div>
      <div class="cart-item__info">
        <h3>${p.name}</h3>
        <p>${p.desc}</p>
        <strong>${brl(p.price * items[id])}</strong>
        <div class="cart-item__row">
          <div class="qty">
            <button type="button" class="qty__btn" data-act="dec" aria-label="Diminuir ${p.name}"><svg viewBox="0 0 16 16"><path d="M3 8h10"/></svg></button>
            <span aria-live="polite">${items[id]}</span>
            <button type="button" class="qty__btn qty__btn--plus" data-act="inc" aria-label="Aumentar ${p.name}"><svg viewBox="0 0 16 16"><path d="M3 8h10M8 3v10"/></svg></button>
          </div>
          <button type="button" class="qty__btn qty__btn--trash" data-act="del" aria-label="Remover ${p.name}"><svg viewBox="0 0 16 16"><path d="M3 4.5h10M6.5 4.5V3h3v1.5M4.5 4.5l.6 8.5h5.8l.6-8.5M7 7v4M9 7v4"/></svg></button>
        </div>
      </div>
    </li>`;
  }).join('');
  $('#cart-empty').hidden = ids.length > 0;
  const recs = Object.keys(PRODUCTS).filter((id) => !items[id]).slice(0, 2);
  $('#cart-recs-wrap').hidden = recs.length === 0;
  $('#cart-recs').innerHTML = recs.map((id) => {
    const p = PRODUCTS[id];
    return `<li class="cart-item cart-item--rec" data-id="${id}">
      <div class="cart-item__thumb">${thumb(id)}</div>
      <div class="cart-item__info">
        <h3>${p.name}</h3>
        <strong>${brl(p.price)}</strong>
        <button type="button" class="cart-add" data-act="add">Adicionar</button>
      </div>
    </li>`;
  }).join('');
  const sub = ids.reduce((s, id) => s + PRODUCTS[id].price * items[id], 0);
  $('#cart-subtotal').textContent = brl(sub);
  root.querySelectorAll('.cart__foot .btn').forEach((b) => { b.disabled = ids.length === 0; });
}

export function add(id, qty = 1) {
  items[id] = (items[id] || 0) + qty; save(); render();
  const btn = $('#open-cart');
  btn.classList.remove('is-bump'); void btn.offsetWidth; btn.classList.add('is-bump');
  onAddHook(id);
}

/** a copy of the product thumbnail arcs from `fromEl` into the nav cart */
export function fly(id, fromEl) {
  const target = $('#open-cart .nav__icon');
  if (!fromEl || !target || matchMedia('(prefers-reduced-motion: reduce)').matches) return Promise.resolve();
  const a = fromEl.getBoundingClientRect(), b = target.getBoundingClientRect();
  const img = document.createElement('img');
  img.src = PRODUCTS[id].thumb; img.alt = ''; img.className = 'fly-thumb';
  const size = 84;
  img.style.left = `${a.left + a.width / 2 - size / 2}px`; img.style.top = `${a.top + a.height / 2 - size / 2}px`;
  document.body.appendChild(img);
  const dx = b.left + b.width / 2 - (a.left + a.width / 2), dy = b.top + b.height / 2 - (a.top + a.height / 2);
  const anim = img.animate([
    { transform: 'translate(0,0) scale(1) rotate(0deg)', opacity: 1 },
    { transform: `translate(${dx * 0.45}px, ${dy * 0.45 - 120}px) scale(.8) rotate(-12deg)`, opacity: 1, offset: 0.45 },
    { transform: `translate(${dx}px, ${dy}px) scale(.18) rotate(-24deg)`, opacity: 0.4 },
  ], { duration: 820, easing: 'cubic-bezier(.45,0,.2,1)' });
  return anim.finished.then(() => img.remove());
}

export function open() {
  lastFocus = document.activeElement;
  root.classList.add('is-open'); root.setAttribute('aria-hidden', 'false'); root.inert = false;
  document.documentElement.classList.add('is-locked');
  setTimeout(() => panel.focus(), 50);
}
export function close() {
  root.classList.remove('is-open'); root.setAttribute('aria-hidden', 'true'); root.inert = true;
  document.documentElement.classList.remove('is-locked');
  if (lastFocus) lastFocus.focus();
}

export function toast(msg) {
  const t = $('#toast'); t.textContent = msg; t.classList.add('is-on');
  clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('is-on'), 2600);
}

export function initCart({ onAdd } = {}) {
  if (onAdd) onAddHook = onAdd;
  root.inert = true;
  $('#open-cart').addEventListener('click', open);
  root.addEventListener('click', (e) => {
    if (e.target.closest('[data-close]')) { close(); return; }
    const b = e.target.closest('[data-act]'); if (!b) return;
    const id = b.closest('[data-id]').dataset.id;
    const act = b.dataset.act;
    if (act === 'inc') items[id]++;
    if (act === 'dec') { items[id]--; if (items[id] <= 0) delete items[id]; }
    if (act === 'del') delete items[id];
    if (act === 'add') { add(id); return; }
    save(); render();
  });
  document.addEventListener('keydown', (e) => {
    if (!root.classList.contains('is-open')) return;
    if (e.key === 'Escape') close();
    if (e.key === 'Tab') {                                    // keep focus inside the drawer
      const f = [...panel.querySelectorAll('button:not([disabled]), summary, textarea, input, a[href]')].filter((el) => el.offsetParent);
      if (!f.length) return;
      if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
      else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
    }
  });
  $('#checkout').addEventListener('click', () => toast('Protótipo: o checkout ainda não está conectado.'));
  $('#view-cart').addEventListener('click', () => toast('Protótipo: página do carrinho ainda não existe.'));
  render();
}
