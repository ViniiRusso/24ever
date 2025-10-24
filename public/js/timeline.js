// Timeline: iOS-safe, com prefetch e fallback de nomes.
// - No iOS: 6 primeiras imagens "eager" (evita bug do lazy).
// - Em outros: 3 com prioridade alta, demais lazy.
// - Sem content-visibility/contain aqui (hotfix está no CSS).

(async function(){
  const container = document.getElementById('timelineSlides');
  if (!container) return;

  const total = 59;
  const BASE = '/images/timeline';

  const isIOS = (() => {
    const ua = navigator.userAgent || '';
    return /iP(hone|ad|od)/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  })();

  const captions = await tryLoadCaptions();

  // montar slides
  const frag = document.createDocumentFragment();
  for (let i = 1; i <= total; i++) {
    const slide = document.createElement('div');
    slide.className = 'swiper-slide';
    const card = document.createElement('div');
    card.className = 'timeline-card bg-white rounded-2xl p-4 shadow';

    const p = document.createElement('p');
    p.className = 'mt-3 text-sm text-gray-600 text-center';
    p.textContent = `Legenda da foto ${i} 💗`;

    const img = createSmartImg(i, p);
    img.dataset.index = String(i);
    img.style.cursor = 'zoom-in';
    img.addEventListener('click', () => openLightbox(Number(img.dataset.index)), {passive:true});

    card.appendChild(img);
    card.appendChild(p);
    slide.appendChild(card);
    frag.appendChild(slide);
  }
  container.appendChild(frag);

  // Swiper
  new Swiper('.swiper', {
    speed: 650,
    effect: 'cards',
    cardsEffect: { perSlideOffset: 12, perSlideRotate: 2, rotate: true, slideShadows: true },
    grabCursor: true,
    centeredSlides: true,
    slidesPerView: 'auto',
    spaceBetween: 24,
    pagination: { el: '.swiper-pagination', clickable: true },
    navigation: { nextEl: '.swiper-button-next', prevEl: '.swiper-button-prev' },
    breakpoints: {
      0: { slidesPerView: 1, centeredSlides: false },
      640: { slidesPerView: 2, centeredSlides: true },
      1024: { slidesPerView: 3, centeredSlides: true }
    }
  });

  // helpers
  function createSmartImg(i, captionEl){
    const el = document.createElement('img');

    // Prioridade / lazy policy
    if (isIOS) {
      // vários relatos de images+lazy quebrando no iOS em carrossel:
      el.loading = i <= 6 ? 'eager' : 'lazy';
      if (i <= 6) el.decoding = 'sync';
    } else {
      el.loading = i <= 3 ? 'eager' : 'lazy';
      el.decoding = 'async';
      if (i <= 3) el.setAttribute('fetchpriority', 'high');
    }

    el.className = 'rounded-xl w-full h-64 object-cover';
    el.alt = `Foto ${i}`;

    const nameCandidates = [
      `foto${i}.jpg`,`Foto ${i}.JPG`,`Foto ${i}.jpg`,`foto ${i}.jpg`,
      `foto_${i}.jpg`,`foto${i}.jpeg`,`Foto ${i}.JPEG`,`foto${i}.png`
    ];
    const urls = nameCandidates.map(n => `${BASE}/${encodeURIComponent(n)}`);

    let idx = 0;
    el.src = urls[idx];

    el.onload = () => {
      const used = decodeURIComponent(el.src.split('/').pop() || '');
      const meta = getMetaFor(i, used, captions);
      if (meta.caption && captionEl) captionEl.textContent = meta.caption;
      if (meta.alt) el.alt = meta.alt;
      el.dataset.filename = used;
    };

    el.onerror = () => {
      idx++;
      if (idx < urls.length) {
        el.src = urls[idx];
      } else {
        el.onerror = null;
        el.src = svgFallback(i);
        el.dataset.filename = '';
      }
    };
    return el;
  }

  function svgFallback(i){
    return `data:image/svg+xml;charset=utf-8,`+encodeURIComponent(
      `<svg xmlns='http://www.w3.org/2000/svg' width='600' height='400'>
        <rect width='100%' height='100%' fill='#f1f5f9'/>
        <text x='50%' y='50%' dominant-baseline='middle' text-anchor='middle'
          fill='#64748b' font-family='Arial' font-size='20'>Foto ${i} não encontrada</text>
      </svg>`
    );
  }

  async function tryLoadCaptions() {
    try {
      const r = await fetch(`${BASE}/captions.json`, { cache: 'no-store' });
      if (r.ok) return await r.json();
    } catch {}
    return null;
  }

  function getMetaFor(index, filename, caps) {
    const fallback = { caption: `Legenda da foto ${index} 💗`, alt: `Foto ${index}` };
    if (!caps) return fallback;
    let entry = caps[filename] || caps[String(filename).toLowerCase()] || caps[String(index)];
    if (typeof entry === 'string') return { caption: entry || fallback.caption, alt: entry || fallback.alt };
    if (entry && typeof entry === 'object')
      return { caption: entry.caption || fallback.caption, alt: entry.alt || entry.caption || fallback.alt };
    return fallback;
  }

  // LIGHTBOX (igual ao que já usamos)
  const lb = createLightboxDOM();
  let pinch = {scale:1, start:1};
  let drag = {startY:0, deltaY:0, active:false};

  function openLightbox(index) {
    renderLightbox(index);
    lb.root.classList.add('show');
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey, {passive:true});
  }
  function closeLightbox() {
    lb.root.classList.add('closing');
    setTimeout(() => {
      lb.root.classList.remove('show','closing','dragging');
      lb.dialog.style.transform = '';
      lb.backdrop.style.opacity = '';
      document.body.style.overflow = '';
    }, 160);
    window.removeEventListener('keydown', onKey);
    resetZoom();
  }
  function onKey(e){
    if (e.key === 'Escape') return closeLightbox();
    if (e.key === 'ArrowRight') return renderLightbox(lb.current + 1);
    if (e.key === 'ArrowLeft') return renderLightbox(lb.current - 1);
  }
  function renderLightbox(index) {
    if (index < 1) index = total;
    if (index > total) index = 1;
    lb.current = index;

    const imgEl = container.querySelector(`img[data-index="${index}"]`);
    const src = imgEl?.src || '';
    const filename = imgEl?.dataset.filename || '';
    const meta = getMetaFor(index, filename, captions);

    lb.img.src = src;
    lb.img.alt = meta.alt || `Foto ${index}`;
    lb.caption.textContent = meta.caption || `Legenda da foto ${index}`;
    lb.count.textContent = `${index} / ${total}`;
    resetZoom();
  }
  function resetZoom(){
    pinch.scale = 1; pinch.start = 1;
    lb.img.style.transform = 'translate3d(0,0,0) scale(1)';
  }
  function createLightboxDOM(){
    const root = document.createElement('div');
    root.id = 'lightbox';
    root.innerHTML = `
      <div class="lb-backdrop"></div>
      <div class="lb-dialog glass">
        <button class="lb-close" aria-label="Fechar">×</button>
        <div class="lb-content">
          <img class="lb-img" alt="" />
          <aside class="lb-aside">
            <div class="lb-meta">
              <div class="lb-count">1 / ${total}</div>
              <div class="lb-caption"></div>
            </div>
            <div class="lb-actions">
              <button class="lb-prev" aria-label="Anterior">←</button>
              <button class="lb-next" aria-label="Próxima">→</button>
            </div>
          </aside>
        </div>
      </div>
    `;
    document.body.appendChild(root);

    const backdrop = root.querySelector('.lb-backdrop');
    const dialog = root.querySelector('.lb-dialog');
    const btnClose = root.querySelector('.lb-close');
    const btnPrev = root.querySelector('.lb-prev');
    const btnNext = root.querySelector('.lb-next');
    const img = root.querySelector('.lb-img');
    const caption = root.querySelector('.lb-caption');
    const count = root.querySelector('.lb-count');

    backdrop.addEventListener('click', closeLightbox, {passive:true});
    btnClose.addEventListener('click', closeLightbox, {passive:true});
    btnPrev.addEventListener('click', () => renderLightbox(lb.current - 1), {passive:true});
    btnNext.addEventListener('click', () => renderLightbox(lb.current + 1), {passive:true});

    // swipe-down para fechar
    dialog.addEventListener('touchstart', (e)=>{
      if (e.touches.length !== 1) return;
      drag.active = true; drag.startY = e.touches[0].clientY; drag.deltaY = 0;
      root.classList.add('dragging');
    }, {passive:true});

    dialog.addEventListener('touchmove', (e)=>{
      if (!drag.active || e.touches.length !== 1) return;
      drag.deltaY = e.touches[0].clientY - drag.startY;
      if (drag.deltaY < 0) drag.deltaY = 0;
      const progress = Math.min(1, drag.deltaY / 200);
      dialog.style.transform = `translateY(${drag.deltaY}px)`;
      backdrop.style.opacity = String(1 - progress*0.6);
    }, {passive:true});

    dialog.addEventListener('touchend', ()=>{
      if (!drag.active) return;
      root.classList.remove('dragging');
      drag.active = false;
      if (drag.deltaY > 100) {
        closeLightbox();
      } else {
        dialog.style.transform = '';
        backdrop.style.opacity = '';
      }
    }, {passive:true});

    // pinch-zoom (iOS)
    dialog.addEventListener('gesturestart', (e)=>{ e.preventDefault(); pinch.start = pinch.scale; });
    dialog.addEventListener('gesturechange', (e)=>{
      pinch.scale = Math.min(3, Math.max(1, pinch.start * e.scale));
      img.style.transform = `translate3d(0,0,0) scale(${pinch.scale})`;
      e.preventDefault();
    });
    dialog.addEventListener('gestureend', (e)=>{ e.preventDefault(); });

    return { root, dialog, backdrop, img, caption, count, current: 1 };
  }
})();