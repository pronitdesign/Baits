/* "Por dentro" — scroll-driven video. The 8 s clip is a WebP frame sequence painted on a canvas;
   the scroll position is smoothed (lerp) so the playback glides. The card opens from a small window
   to full bleed, then four callouts draw their lines to the layers as the bar comes apart. */
const section = document.getElementById('por-dentro');
if (section) {
  const stage = section.querySelector('.inside__stage');
  const frame = section.querySelector('.inside__frame');
  const media = section.querySelector('.inside__media');
  const bgCanvas = section.querySelector('.inside__bg');
  const canvas = section.querySelector('.inside__canvas');
  const ctx = canvas.getContext('2d');
  const intro = section.querySelector('.inside__intro');
  const copy = section.querySelector('.inside__copy');
  const hint = section.querySelector('.inside__hint');
  const gramsEl = document.getElementById('inside-grams');
  const svg = section.querySelector('.inside__lines');
  const items = [...section.querySelectorAll('.inside__callouts li')].map((li) => ({
    li, x: +li.dataset.x, y: +li.dataset.y, g: +li.dataset.g,
  }));
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  const COUNT = 193, IW = 1236, IH = 668;           // frames 0..8 s @ 24 fps, cropped size
  const src = (i) => `assets/inside/${String(i).padStart(3, '0')}.webp?v=2`;
  const frames = new Array(COUNT).fill(null);

  /* ---- helpers */
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const seg = (v, a, b) => clamp((v - a) / (b - a));
  const lerp = (a, b, t) => a + (b - a) * t;
  const easeIO = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
  const easeSine = (t) => -(Math.cos(Math.PI * t) - 1) / 2;
  const easeOut = (t) => 1 - (1 - t) ** 3;

  /* ---- lines (one group per callout) */
  const NS = 'http://www.w3.org/2000/svg';
  items.forEach((it) => {
    const g = document.createElementNS(NS, 'g');
    it.path = document.createElementNS(NS, 'path'); it.path.setAttribute('pathLength', '1');
    it.path.style.strokeDasharray = '1'; it.path.style.strokeDashoffset = '1';
    it.ring = document.createElementNS(NS, 'circle'); it.ring.setAttribute('class', 'ring'); it.ring.setAttribute('r', '7');
    it.core = document.createElementNS(NS, 'circle'); it.core.setAttribute('class', 'core'); it.core.setAttribute('r', '2.6');
    g.append(it.path, it.ring, it.core); svg.append(g);
  });

  /* ---- loading: first/last frame right away, the rest once the section is near */
  let started = false;
  function load(i) {
    return new Promise((res) => {
      const im = new Image(); im.decoding = 'async';
      im.onload = () => { frames[i] = im; if (!sampled) sampleBg(im); dirty = true; res(); };
      im.onerror = res; im.src = src(i);
    });
  }
  function loadAll() {
    if (started) return; started = true;
    const order = [];
    for (let step = 16; step >= 1; step = Math.floor(step / 2)) {             // coarse-to-fine
      for (let i = 0; i < COUNT; i += step) if (!order.includes(i)) order.push(i);
      if (step === 1) break;
    }
    let k = 0;
    const worker = async () => { while (k < order.length) { const i = order[k++]; if (!frames[i]) await load(i); } };
    for (let w = 0; w < 6; w++) worker();
  }
  load(0);

  /* ---- geometry */
  /* the frame is framed (not full cover) so the bar never runs under the copy;
     its edges are feathered into a backdrop built from the clip's own edge colours */
  let sampled = false;
  function sampleBg(im) {
    sampled = true;
    const t = document.createElement('canvas'); t.width = 64; t.height = 36;
    const c = t.getContext('2d'); c.drawImage(im, 0, 0, 64, 36);
    const px = (x, y) => c.getImageData(Math.round(x * 63), Math.round(y * 35), 1, 1).data;
    const g = bgCanvas.getContext('2d'); const out = g.createImageData(3, 3);
    const P = [[.02, .04], [.5, .04], [.98, .04], [.02, .5], [.5, .5], [.98, .5], [.02, .96], [.5, .96], [.98, .96]];
    P.forEach(([x, y], k) => {
      let d = px(x, y);
      if (k === 4) { const a = px(.5, .04), b = px(.5, .96); d = [0, 1, 2].map((j) => (a[j] + b[j]) / 2); }
      out.data.set([d[0], d[1], d[2], 255], k * 4);
    });
    g.putImageData(out, 0, 0);
  }

  let W = 0, H = 0, dpr = 1, fit = { s: 1, ox: 0, oy: 0 }, mobile = false;
  function measure() {
    W = stage.clientWidth; H = stage.clientHeight; dpr = Math.min(2, devicePixelRatio || 1);
    mobile = W <= 760;
    // exploded stack spans x .17–.80 and y .15–.89 of the clip; bar centre ≈ (.485, .52)
    let s, cx, cy;
    if (mobile) {                                         // between the copy (top) and the callout grid (bottom)
      const top = copy.offsetTop + copy.offsetHeight + 8;
      const list = section.querySelector('.inside__callouts');
      const bottom = H - list.offsetHeight - 34;
      const avail = Math.max(120, bottom - top);
      s = Math.min((W * 0.92) / (0.63 * IW), avail / (0.74 * IH)); cx = W * 0.5; cy = top + avail / 2;
    }
    else {
      s = Math.min((W * 0.54) / (0.63 * IW), (H * 0.84) / (0.74 * IH), (W / IW) * 1.05);
      cx = W * 0.5; cy = H * 0.55;
    }
    fit = { s, ox: cx - 0.485 * IW * s, oy: cy - 0.52 * IH * s };
    const w = IW * s, h = IH * s;
    Object.assign(canvas.style, { left: `${fit.ox}px`, top: `${fit.oy}px`, width: `${w}px`, height: `${h}px` });
    canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    drawn = -1; dirty = true;
  }
  const mapX = (x) => fit.ox + x * IW * fit.s;
  const mapY = (y) => fit.oy + y * IH * fit.s;

  /* ---- paint */
  let drawn = -1, dirty = true;
  function paint(idx) {
    let i = idx;
    if (!frames[i]) {                                    // nearest decoded frame
      for (let d = 1; d < COUNT; d++) {
        if (frames[idx - d]) { i = idx - d; break; }
        if (frames[idx + d]) { i = idx + d; break; }
      }
    }
    if (!frames[i] || (i === drawn && !dirty)) return;
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(frames[i], 0, 0, canvas.width, canvas.height);
    drawn = i; dirty = false;
  }

  /* ---- timeline */
  let target = 0, cur = 0, last = performance.now(), active = false, grams = 0;
  function readScroll() {
    const r = section.getBoundingClientRect();
    target = clamp(-r.top / Math.max(1, section.offsetHeight - stage.clientHeight));
  }

  function render() {
    const p = cur;
    // 1. the window opens
    const open = easeIO(seg(p, 0, 0.17));
    const m = 14;
    const w0 = mobile ? W * 0.84 : Math.min(W * 0.44, 760), h0 = mobile ? H * 0.42 : H * 0.44;
    const side = lerp((W - w0) / 2, m, open);
    const top = lerp(H * (mobile ? 0.42 : 0.42), m, open);
    const bot = lerp(H - H * 0.42 - h0, m, open);
    frame.style.setProperty('--cx', `${side}px`);
    frame.style.setProperty('--ct', `${top}px`);
    frame.style.setProperty('--cb', `${Math.max(m, bot)}px`);
    frame.style.setProperty('--cr', `${lerp(36, 28, open)}px`);
    media.style.transform = `scale(${lerp(1.22, 1, open)})`;
    intro.style.opacity = String(1 - seg(p, 0.03, 0.12));
    intro.style.transform = `translateY(${-open * 70}px) scale(${1 - open * 0.08})`;
    hint.style.opacity = String(1 - seg(p, 0.01, 0.06));

    // 2. the clip plays (0 → 8 s) with a soft start and landing
    const vt = easeSine(seg(p, 0.06, 0.74));
    paint(Math.round(vt * (COUNT - 1)));

    // 3. copy on the left
    const c = easeOut(seg(p, 0.15, 0.27));
    copy.style.opacity = String(c);
    copy.style.transform = mobile ? `translateY(${(1 - c) * 24}px)` : `translateY(calc(-50% + ${(1 - c) * 40}px))`;

    // 4. callouts: line draws from the layer, then the label settles in
    let sum = 0;
    if (!mobile) {                                        // spread label rows (min gap), centred on the anchors
      const G = Math.max(...items.map((it) => it.li.offsetHeight)) + 18;
      const ys = items.map((it) => mapY(it.y));
      const mid = (ys[0] + ys[ys.length - 1]) / 2, span = Math.max(ys[ys.length - 1] - ys[0], G * (ys.length - 1));
      items.forEach((it, i) => { it.ly = Math.min(H - G / 2 - 20, Math.max(G / 2 + 90, mid - span / 2 + (span * i) / (ys.length - 1))); });
    }
    const colX = Math.min(mapX(0.76), W - 15.5 * 16 - 28);
    items.forEach((it, i) => {
      const a = 0.6 + i * 0.055;
      const k = seg(p, a, a + 0.1);
      const line = easeOut(seg(k, 0, 0.65)), label = easeOut(seg(k, 0.35, 1));
      sum += it.g * easeOut(seg(k, 0.3, 1));
      it.li.style.opacity = String(label);
      if (mobile) { it.li.style.transform = `translateY(${(1 - label) * 16}px)`; return; }
      const ax = mapX(it.x), ay = mapY(it.y);
      const lx = Math.max(colX, ax + 90), ly = it.ly;
      const kx = ax + Math.min(36, (lx - ax) * 0.3);       // elbow
      it.path.setAttribute('d', `M${ax + 7} ${ay} H${kx} L${lx - 46} ${ly} H${lx - 14}`);
      it.path.style.strokeDashoffset = String(1 - line);
      it.ring.setAttribute('cx', ax); it.ring.setAttribute('cy', ay);
      it.core.setAttribute('cx', ax); it.core.setAttribute('cy', ay);
      const dot = clamp(k * 6);
      it.ring.style.opacity = it.core.style.opacity = String(dot);
      it.ring.setAttribute('r', String(7 * (0.4 + 0.6 * easeOut(dot))));
      it.li.style.setProperty('--lx', `${lx + (1 - label) * 18}px`);
      it.li.style.setProperty('--ly', `${ly}px`);
    });
    const g = Math.round(sum);
    if (g !== grams) { grams = g; gramsEl.textContent = String(g); }
  }

  function tick(now) {
    const dt = Math.min(64, now - last); last = now;
    readScroll();
    const k = reduce ? 1 : 1 - Math.exp(-dt / 140);       // cinematic glide behind the scroll
    cur += (target - cur) * k;
    if (Math.abs(target - cur) < 0.00005) cur = target;
    if (cur !== rendered || dirty) { render(); rendered = cur; }
    if (active || cur !== target) requestAnimationFrame(tick);
    else running = false;
  }
  let running = false, rendered = -1;
  const kick = () => { if (!running) { running = true; last = performance.now(); requestAnimationFrame(tick); } };

  new IntersectionObserver(([e]) => {
    active = e.isIntersecting;
    if (active) { loadAll(); kick(); }
  }, { rootMargin: '150% 0px' }).observe(section);
  addEventListener('scroll', kick, { passive: true });
  addEventListener('resize', () => { measure(); rendered = -1; kick(); });

  measure(); readScroll(); cur = target; render();
}
