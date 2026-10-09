/* ==========================================================================
   FAKTORY — interaction engine
   - Tilt engine: device orientation (mobile) / pointer (desktop) -> --tx/--ty
   - Motion: reveals, scroll velocity, pinned rail, parallax, word scrub,
     magnetic buttons, tilt cards, text scramble, glitch, custom cursor
   - Commerce: AJAX cart drawer, variant picker, studio booking
   ========================================================================== */
(() => {
  'use strict';

  const F = (window.Faktory = window.Faktory || {});
  F.settings = F.settings || {};
  F.strings = F.strings || {};
  F.routes = F.routes || {};

  const root = document.documentElement;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  const clamp = (v, min, max) => Math.min(max, Math.max(min, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const $ = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* storage blocked */ } }
  };

  /* ------------------------------------------------------------------------
     Tilt engine
     ------------------------------------------------------------------------ */
  const Tilt = (F.tilt = {
    x: 0, y: 0,           // smoothed, -1..1
    tx: 0, ty: 0,         // target
    source: 'idle',       // idle | pointer | device
    base: null,
    intensity: F.settings.tiltIntensity || 1
  });
  window.FaktoryTilt = Tilt;

  function onPointerTilt(e) {
    if (Tilt.source === 'device') return;
    Tilt.source = 'pointer';
    Tilt.tx = (e.clientX / window.innerWidth) * 2 - 1;
    Tilt.ty = (e.clientY / window.innerHeight) * 2 - 1;
  }

  function onDeviceTilt(e) {
    if (e.beta == null || e.gamma == null) return;
    let beta = e.beta;
    let gamma = e.gamma;
    const angle = (screen.orientation && screen.orientation.angle) || window.orientation || 0;
    if (angle === 90) { [beta, gamma] = [-gamma, beta]; }
    else if (angle === -90 || angle === 270) { [beta, gamma] = [gamma, -beta]; }
    if (!Tilt.base) Tilt.base = { beta, gamma };
    // Drift the baseline toward the current hold position so the effect
    // re-centres naturally however the phone is being held.
    Tilt.base.beta = lerp(Tilt.base.beta, beta, 0.004);
    Tilt.base.gamma = lerp(Tilt.base.gamma, gamma, 0.004);
    Tilt.source = 'device';
    Tilt.tx = clamp((gamma - Tilt.base.gamma) / 28, -1, 1);
    Tilt.ty = clamp((beta - Tilt.base.beta) / 28, -1, 1);
  }

  function enableDeviceTilt() {
    window.addEventListener('deviceorientation', onDeviceTilt, { passive: true });
  }

  function initTiltPermission() {
    const btn = $('[data-tilt-permission]');
    const DOE = window.DeviceOrientationEvent;
    if (!DOE) return;
    if (typeof DOE.requestPermission !== 'function') {
      enableDeviceTilt();
      return;
    }
    // iOS 13+: permission must be requested from a user gesture.
    const ask = () =>
      DOE.requestPermission()
        .then((state) => {
          store.set('fk-tilt', state);
          if (state === 'granted') enableDeviceTilt();
          if (btn) btn.hidden = true;
        })
        .catch(() => { if (btn) btn.hidden = true; });

    const prior = store.get('fk-tilt');
    if (prior === 'granted') {
      // Previously granted: re-request silently on the first touch.
      window.addEventListener('touchend', ask, { once: true, passive: true });
    } else if (prior !== 'denied' && btn && !finePointer) {
      btn.hidden = false;
      btn.addEventListener('click', ask, { once: true });
      setTimeout(() => { btn.hidden = true; }, 14000);
    }
  }

  let lastX = 99, lastY = 99;
  function tiltLoop(t) {
    const idle = Tilt.source === 'idle';
    // Idle drift keeps chrome alive even before any input.
    const driftX = Math.sin(t / 2400) * 0.35;
    const driftY = Math.cos(t / 3100) * 0.25;
    const goalX = idle ? driftX : Tilt.tx * Tilt.intensity + driftX * 0.15;
    const goalY = idle ? driftY : Tilt.ty * Tilt.intensity + driftY * 0.15;
    const k = Tilt.source === 'device' ? 0.12 : 0.08;
    Tilt.x = clamp(lerp(Tilt.x, goalX, k), -1.5, 1.5);
    Tilt.y = clamp(lerp(Tilt.y, goalY, k), -1.5, 1.5);
    if (Math.abs(Tilt.x - lastX) > 0.002 || Math.abs(Tilt.y - lastY) > 0.002) {
      root.style.setProperty('--tx', Tilt.x.toFixed(3));
      root.style.setProperty('--ty', Tilt.y.toFixed(3));
      lastX = Tilt.x; lastY = Tilt.y;
      if (hudX) { hudX.textContent = Tilt.x.toFixed(2); hudY.textContent = Tilt.y.toFixed(2); }
    }
    requestAnimationFrame(tiltLoop);
  }
  let hudX, hudY;

  function initTilt() {
    hudX = $('[data-hud-x]');
    hudY = $('[data-hud-y]');
    if (F.settings.tilt === false || reduceMotion) return;
    window.addEventListener('pointermove', onPointerTilt, { passive: true });
    initTiltPermission();
    requestAnimationFrame(tiltLoop);
  }

  /* ------------------------------------------------------------------------
     Custom cursor
     ------------------------------------------------------------------------ */
  function initCursor() {
    const el = $('.cursor');
    if (!el || !finePointer || reduceMotion) return;
    root.classList.add('has-cursor');
    let mx = -100, my = -100, rx = -100, ry = -100;
    window.addEventListener('pointermove', (e) => {
      mx = e.clientX; my = e.clientY;
      el.style.setProperty('--cx', mx + 'px');
      el.style.setProperty('--cy', my + 'px');
    }, { passive: true });
    const loop = () => {
      rx = lerp(rx, mx, 0.18); ry = lerp(ry, my, 0.18);
      el.style.setProperty('--rx2', rx + 'px');
      el.style.setProperty('--ry2', ry + 'px');
      requestAnimationFrame(loop);
    };
    loop();
    document.addEventListener('pointerover', (e) => {
      const t = e.target;
      el.classList.toggle('is-drag', !!t.closest('faktory-scene, model-viewer'));
      el.classList.toggle('is-hover', !!t.closest('a, button, label, summary, [data-tilt-card]') && !t.closest('faktory-scene'));
    });
  }

  /* ------------------------------------------------------------------------
     Reveal on scroll
     ------------------------------------------------------------------------ */
  let revealObserver;
  function initReveal(ctx = document) {
    const els = $$('.reveal:not(.is-in)', ctx);
    if (!('IntersectionObserver' in window) || reduceMotion) {
      els.forEach((el) => el.classList.add('is-in'));
      return;
    }
    revealObserver = revealObserver || new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-in');
          revealObserver.unobserve(entry.target);
        }
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.05 });
    els.forEach((el) => revealObserver.observe(el));
  }

  /* ------------------------------------------------------------------------
     Scroll-driven: header state, velocity, rail, parallax, word scrub
     ------------------------------------------------------------------------ */
  const scrollFx = { rails: [], parallax: [], scrub: [] };
  let lastScroll = window.scrollY, velocity = 0, ticking = false;

  function collectScrollFx() {
    scrollFx.rails = $$('[data-rail]').map((viewport) => ({ viewport, track: $('[data-rail-track]', viewport) }));
    scrollFx.parallax = $$('[data-parallax]');
    scrollFx.scrub = $$('[data-scrub-words]').map((el) => ({ el, words: $$('.statement__word', el) }));
    layoutRails();
  }

  function layoutRails() {
    const pinEnabled = window.innerWidth >= 990 && !reduceMotion;
    scrollFx.rails.forEach(({ viewport, track }) => {
      if (!track) return;
      if (!pinEnabled) {
        viewport.classList.remove('is-pinned');
        viewport.style.removeProperty('--rail-h');
        track.style.removeProperty('--rail-x');
        return;
      }
      const distance = Math.max(0, track.scrollWidth - window.innerWidth);
      if (distance < 40) { viewport.classList.remove('is-pinned'); return; }
      viewport.classList.add('is-pinned');
      viewport.style.setProperty('--rail-h', track.offsetHeight + distance + 'px');
      viewport.dataset.distance = distance;
    });
  }

  function onScrollFrame() {
    ticking = false;
    const y = window.scrollY;
    const vh = window.innerHeight;
    const delta = y - lastScroll;
    velocity = lerp(velocity, clamp(delta / 40, -1, 1), 0.3);
    root.style.setProperty('--scroll-v', velocity.toFixed(3));
    document.body.classList.toggle('is-scrolled', y > 40);
    document.body.classList.toggle('header-hidden', delta > 4 && y > 400 && !document.body.classList.contains('menu-open'));
    if (delta < -4) document.body.classList.remove('header-hidden');
    lastScroll = y;

    scrollFx.rails.forEach(({ viewport, track }) => {
      if (!viewport.classList.contains('is-pinned')) return;
      const rect = viewport.getBoundingClientRect();
      const distance = parseFloat(viewport.dataset.distance) || 0;
      const stickyTop = parseFloat(getComputedStyle(track).top) || 0;
      const progress = clamp((stickyTop - rect.top) / (distance || 1), 0, 1);
      track.style.setProperty('--rail-x', (-progress * distance).toFixed(1) + 'px');
    });

    if (!reduceMotion) {
      scrollFx.parallax.forEach((el) => {
        const rect = el.getBoundingClientRect();
        if (rect.bottom < 0 || rect.top > vh) return;
        const speed = parseFloat(el.dataset.parallax) || 0.15;
        const offset = (rect.top + rect.height / 2 - vh / 2) * -speed;
        el.style.setProperty('--parallax', offset.toFixed(1) + 'px');
      });
    }

    scrollFx.scrub.forEach(({ el, words }) => {
      const rect = el.getBoundingClientRect();
      const progress = clamp((vh * 0.85 - rect.top) / (rect.height + vh * 0.35), 0, 1);
      const lit = Math.round(progress * words.length);
      words.forEach((w, i) => w.classList.toggle('is-lit', i < lit));
    });
  }

  function initScroll() {
    collectScrollFx();
    window.addEventListener('scroll', () => {
      if (!ticking) { ticking = true; requestAnimationFrame(onScrollFrame); }
    }, { passive: true });
    window.addEventListener('resize', () => { layoutRails(); onScrollFrame(); });
    window.addEventListener('load', () => { layoutRails(); onScrollFrame(); });
    // Decay velocity when scrolling stops.
    setInterval(() => {
      if (Math.abs(velocity) > 0.01) { velocity *= 0.6; root.style.setProperty('--scroll-v', velocity.toFixed(3)); }
    }, 120);
    onScrollFrame();
  }

  /* ------------------------------------------------------------------------
     Micro-interactions
     ------------------------------------------------------------------------ */
  function initTiltCards(ctx = document) {
    if (!finePointer || reduceMotion) return;
    $$('[data-tilt-card]', ctx).forEach((card) => {
      if (card.dataset.tiltBound) return;
      card.dataset.tiltBound = '1';
      card.addEventListener('pointermove', (e) => {
        const r = card.getBoundingClientRect();
        const px = (e.clientX - r.left) / r.width;
        const py = (e.clientY - r.top) / r.height;
        card.style.setProperty('--ry', ((px - 0.5) * 14).toFixed(2));
        card.style.setProperty('--rx', ((0.5 - py) * 14).toFixed(2));
        card.style.setProperty('--gx', (px * 100).toFixed(1) + '%');
        card.style.setProperty('--gy', (py * 100).toFixed(1) + '%');
        card.classList.add('is-tilting');
      });
      card.addEventListener('pointerleave', () => {
        card.style.setProperty('--rx', 0);
        card.style.setProperty('--ry', 0);
        card.classList.remove('is-tilting');
      });
    });
  }

  const GLYPHS = '!<>-_\\/[]{}—=+*^?#01ΔΣΞ';
  function scramble(el) {
    if (el.dataset.scrambling) return;
    const original = el.dataset.original || el.textContent;
    el.dataset.original = original;
    el.dataset.scrambling = '1';
    let frame = 0;
    const total = Math.max(12, original.length * 2);
    const step = () => {
      const revealCount = Math.floor((frame / total) * original.length);
      el.textContent = original
        .split('')
        .map((ch, i) => (i < revealCount || ch === ' ' ? ch : GLYPHS[Math.floor(Math.random() * GLYPHS.length)]))
        .join('');
      frame++;
      if (frame <= total) requestAnimationFrame(step);
      else { el.textContent = original; delete el.dataset.scrambling; }
    };
    step();
  }
  function initScramble(ctx = document) {
    if (reduceMotion) return;
    $$('[data-scramble]', ctx).forEach((el) => {
      if (el.dataset.scrambleBound) return;
      el.dataset.scrambleBound = '1';
      const trigger = el.closest('a, article') || el;
      trigger.addEventListener('pointerenter', () => scramble(el));
    });
  }

  function initMagnetic(ctx = document) {
    if (!finePointer || reduceMotion) return;
    $$('[data-magnetic]', ctx).forEach((el) => {
      if (el.dataset.magBound) return;
      el.dataset.magBound = '1';
      el.addEventListener('pointermove', (e) => {
        const r = el.getBoundingClientRect();
        const x = e.clientX - (r.left + r.width / 2);
        const y = e.clientY - (r.top + r.height / 2);
        el.style.transform = `translate(${x * 0.25}px, ${y * 0.35}px)`;
      });
      el.addEventListener('pointerleave', () => { el.style.transform = ''; });
    });
  }

  function initGlitch(ctx = document) {
    if (reduceMotion) return;
    $$('[data-glitch]', ctx).forEach((el) => {
      if (el.dataset.glitchBound) return;
      el.dataset.glitchBound = '1';
      const fire = () => {
        el.classList.add('is-glitching');
        setTimeout(() => el.classList.remove('is-glitching'), 750);
      };
      el.addEventListener('pointerenter', fire);
      setInterval(() => { if (Math.random() > 0.6) fire(); }, 4200);
    });
  }

  function initHoverReveal(ctx = document) {
    $$('[data-hover-reveal]', ctx).forEach((list) => {
      const section = list.closest('section');
      const box = section && $('.hover-reveal', section);
      const img = box && $('[data-hover-img]', box);
      if (!box || !img || !finePointer) return;
      let x = 0, y = 0, cx = 0, cy = 0, raf = null, lastX = 0;
      const loop = () => {
        cx = lerp(cx, x, 0.15); cy = lerp(cy, y, 0.15);
        box.style.setProperty('--hx', cx + 'px');
        box.style.setProperty('--hy', cy + 'px');
        box.style.setProperty('--hr', clamp((x - lastX) * 0.4, -12, 12) + 'deg');
        lastX = lerp(lastX, x, 0.1);
        raf = requestAnimationFrame(loop);
      };
      list.addEventListener('pointermove', (e) => { x = e.clientX; y = e.clientY; });
      $$('[data-img]', list).forEach((item) => {
        item.addEventListener('pointerenter', () => {
          if (!item.dataset.img) return;
          img.src = item.dataset.img;
          box.classList.add('is-on');
          if (!raf) { cx = x; cy = y; loop(); }
        });
      });
      list.addEventListener('pointerleave', () => {
        box.classList.remove('is-on');
        cancelAnimationFrame(raf); raf = null;
      });
    });
  }

  /* ------------------------------------------------------------------------
     Menu
     ------------------------------------------------------------------------ */
  function initMenu() {
    const btn = $('[data-menu-toggle]');
    const menu = $('[data-menu]');
    if (!btn || !menu) return;
    const set = (open) => {
      document.body.classList.toggle('menu-open', open);
      btn.setAttribute('aria-expanded', open);
      menu.setAttribute('aria-hidden', !open);
    };
    btn.addEventListener('click', () => set(!document.body.classList.contains('menu-open')));
    menu.addEventListener('click', (e) => { if (e.target.closest('a')) set(false); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') set(false); });
  }

  /* ------------------------------------------------------------------------
     Content hub
     ------------------------------------------------------------------------ */
  function initHub(ctx = document) {
    $$('[data-hub]', ctx).forEach((hub) => {
      $$('[data-hub-filter]', hub).forEach((btn) => {
        btn.addEventListener('click', () => {
          const kind = btn.dataset.hubFilter;
          $$('[data-hub-filter]', hub).forEach((b) => {
            b.classList.toggle('is-active', b === btn);
            b.setAttribute('aria-selected', b === btn);
          });
          $$('[data-kind]', hub).forEach((tile) => {
            tile.classList.toggle('is-filtered', kind !== 'all' && tile.dataset.kind !== kind);
          });
        });
      });
    });
    $$('[data-lite-embed]', ctx).forEach((btn) => {
      btn.addEventListener('click', () => {
        const src = btn.dataset.liteEmbed;
        if (!src) return;
        const iframe = document.createElement('iframe');
        iframe.src = src;
        iframe.allow = 'autoplay; encrypted-media; fullscreen; picture-in-picture';
        iframe.allowFullscreen = true;
        iframe.title = btn.getAttribute('aria-label') || 'Video';
        const wrap = document.createElement('div');
        wrap.className = btn.className;
        wrap.appendChild(iframe);
        btn.replaceWith(wrap);
      }, { once: true });
    });
  }

  /* ------------------------------------------------------------------------
     Money
     ------------------------------------------------------------------------ */
  function formatMoney(cents, format) {
    if (typeof cents === 'string') cents = cents.replace('.', '');
    const fmt = format || F.moneyFormat || '${{amount}}';
    const delimit = (n, precision, thousands, decimal) => {
      if (isNaN(n) || n == null) return '0';
      const num = (n / 100).toFixed(precision);
      const parts = num.split('.');
      const dollars = parts[0].replace(/(\d)(?=(\d\d\d)+(?!\d))/g, '$1' + thousands);
      return dollars + (parts[1] ? decimal + parts[1] : '');
    };
    return fmt.replace(/\{\{\s*(\w+)\s*\}\}/, (_, key) => {
      switch (key) {
        case 'amount_no_decimals': return delimit(cents, 0, ',', '.');
        case 'amount_with_comma_separator': return delimit(cents, 2, '.', ',');
        case 'amount_no_decimals_with_comma_separator': return delimit(cents, 0, '.', ',');
        case 'amount_with_apostrophe_separator': return delimit(cents, 2, "'", '.');
        case 'amount_with_space_separator': return delimit(cents, 2, ' ', ',');
        default: return delimit(cents, 2, ',', '.');
      }
    });
  }
  F.formatMoney = formatMoney;

  const escapeHtml = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  /* ------------------------------------------------------------------------
     Cart drawer
     ------------------------------------------------------------------------ */
  const Cart = (F.cart = {
    drawer: null,
    lastFocus: null,
    open() {
      if (!this.drawer) return false;
      this.lastFocus = document.activeElement;
      this.drawer.classList.add('is-open');
      this.drawer.setAttribute('aria-hidden', 'false');
      document.body.style.overflow = 'hidden';
      const panel = $('.drawer__panel', this.drawer);
      if (panel) panel.focus();
      return true;
    },
    close() {
      if (!this.drawer) return;
      this.drawer.classList.remove('is-open');
      this.drawer.setAttribute('aria-hidden', 'true');
      document.body.style.overflow = '';
      if (this.lastFocus) this.lastFocus.focus();
    },
    async fetch() {
      const res = await fetch((F.routes.cart || '/cart') + '.js', { headers: { Accept: 'application/json' } });
      const cart = await res.json();
      this.render(cart);
      return cart;
    },
    async add(formData) {
      const res = await fetch((F.routes.cartAdd || '/cart/add') + '.js', {
        method: 'POST',
        headers: { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
        body: formData
      });
      const data = await res.json();
      if (!res.ok || data.status) throw new Error(data.description || data.message || F.strings.error);
      await this.fetch();
      this.open();
      return data;
    },
    async change(key, quantity) {
      const res = await fetch((F.routes.cartChange || '/cart/change') + '.js', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ id: key, quantity })
      });
      const cart = await res.json();
      this.render(cart);
    },
    render(cart) {
      $$('[data-cart-count]').forEach((el) => { el.textContent = cart.item_count; });
      if (!this.drawer) return;
      const items = $('[data-cart-items]', this.drawer);
      const subtotal = $('[data-cart-subtotal]', this.drawer);
      if (subtotal) subtotal.textContent = formatMoney(cart.total_price);
      if (!items) return;
      if (!cart.items.length) {
        items.innerHTML = `<p class="drawer__empty mono">${escapeHtml(F.strings.cartEmpty)}</p>`;
        return;
      }
      items.innerHTML = cart.items.map((item, i) => {
        const img = item.image ? item.image.replace(/(\.[a-z]+)(\?|$)/i, '_200x$1$2') : '';
        const props = item.properties
          ? Object.entries(item.properties)
              .filter(([k, v]) => v && k.charAt(0) !== '_')
              .map(([k, v]) => `<div class="mono drawer-line__meta">${escapeHtml(k)}: ${escapeHtml(v)}</div>`)
              .join('')
          : '';
        const variant = item.variant_title && item.variant_title !== 'Default Title'
          ? `<div class="mono drawer-line__meta">${escapeHtml(item.variant_title)}</div>` : '';
        return `
          <div class="drawer-line" style="animation-delay:${i * 60}ms">
            <a href="${escapeHtml(item.url)}">${img ? `<img src="${escapeHtml(img)}" alt="" loading="lazy" width="84" height="105">` : ''}</a>
            <div>
              <a href="${escapeHtml(item.url)}" class="drawer-line__title">${escapeHtml(item.product_title)}</a>
              ${variant}${props}
              <div class="drawer-line__qty mono">
                <button type="button" data-qty="${escapeHtml(item.key)}" data-to="${item.quantity - 1}" aria-label="-"><svg class="icon" viewBox="0 0 24 24"><path d="M4 12h16" stroke="currentColor" stroke-width="2"/></svg></button>
                <span>${item.quantity}</span>
                <button type="button" data-qty="${escapeHtml(item.key)}" data-to="${item.quantity + 1}" aria-label="+"><svg class="icon" viewBox="0 0 24 24"><path d="M12 4v16M4 12h16" stroke="currentColor" stroke-width="2"/></svg></button>
              </div>
            </div>
            <div class="drawer-line__price mono">
              <span>${formatMoney(item.final_line_price)}</span>
              <button type="button" class="drawer-line__remove mono" data-qty="${escapeHtml(item.key)}" data-to="0">${escapeHtml(F.strings.remove)}</button>
            </div>
          </div>`;
      }).join('');
    },
    init() {
      this.drawer = $('[data-cart-drawer]');
      document.addEventListener('click', (e) => {
        const opener = e.target.closest('[data-cart-open]');
        if (opener && this.drawer && document.body.classList.contains('template-cart') === false) {
          e.preventDefault();
          this.fetch();
          this.open();
          return;
        }
        if (e.target.closest('[data-cart-close]')) { this.close(); return; }
        const qty = e.target.closest('[data-qty]');
        if (qty) this.change(qty.dataset.qty, Math.max(0, parseInt(qty.dataset.to, 10)));
      });
      document.addEventListener('keydown', (e) => { if (e.key === 'Escape') this.close(); });
    }
  });

  /* ------------------------------------------------------------------------
     Product form
     ------------------------------------------------------------------------ */
  function initProduct(ctx = document) {
    $$('[data-product]', ctx).forEach((section) => {
      const form = $('[data-product-form]', section);
      const jsonEl = $('[data-product-json]', section);
      if (!form || !jsonEl) return;
      const product = JSON.parse(jsonEl.textContent);
      const idInput = $('[data-variant-input]', form);
      const addBtn = $('[data-add-btn]', form);
      const addLabel = $('[data-add-label]', form);
      const priceEl = $('[data-price-current]', section);
      const compareEl = $('[data-price-compare]', section);
      const errorEl = $('[data-form-error]', form);

      const currentOptions = () => $$('fieldset.option', form).map((fs) => {
        const checked = $('input:checked', fs);
        return checked ? checked.value : null;
      });

      const update = () => {
        const opts = currentOptions();
        $$('fieldset.option', form).forEach((fs, i) => {
          const label = $('[data-option-value]', fs);
          if (label) label.textContent = opts[i];
        });
        const variant = product.variants.find((v) => v.options.every((o, i) => o === opts[i]));
        if (!variant) {
          addBtn.disabled = true;
          addLabel.textContent = F.strings.unavailable;
          return;
        }
        idInput.value = variant.id;
        addBtn.disabled = !variant.available;
        addLabel.textContent = variant.available ? F.strings.addToCart : F.strings.soldOut;
        if (priceEl) priceEl.textContent = formatMoney(variant.price);
        if (compareEl) {
          const sale = variant.compare_at_price && variant.compare_at_price > variant.price;
          compareEl.hidden = !sale;
          if (sale) compareEl.textContent = formatMoney(variant.compare_at_price);
        }
        const url = new URL(window.location.href);
        url.searchParams.set('variant', variant.id);
        window.history.replaceState({}, '', url.toString());
        if (variant.featured_media) {
          const media = $(`[data-media-id="${variant.featured_media.id}"]`, section);
          if (media) media.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'nearest', inline: 'center' });
        }
      };

      form.addEventListener('change', (e) => { if (e.target.name && e.target.name.indexOf('option-') === 0) update(); });

      form.addEventListener('submit', async (e) => {
        if (!Cart.drawer) return;
        e.preventDefault();
        errorEl.hidden = true;
        addBtn.disabled = true;
        const prev = addLabel.textContent;
        addLabel.textContent = '...';
        try {
          const data = new FormData(form);
          Array.from(data.keys()).filter((k) => k.indexOf('option-') === 0).forEach((k) => data.delete(k));
          await Cart.add(data);
          addLabel.textContent = F.strings.added;
          setTimeout(() => { addLabel.textContent = prev; addBtn.disabled = false; }, 1400);
        } catch (err) {
          errorEl.textContent = err.message;
          errorEl.hidden = false;
          addLabel.textContent = prev;
          addBtn.disabled = false;
        }
      });

      // Let model-viewer media spin and offer AR.
      $$('model-viewer', section).forEach((mv) => {
        mv.setAttribute('auto-rotate', '');
        mv.setAttribute('camera-controls', '');
        mv.setAttribute('ar', '');
        mv.setAttribute('shadow-intensity', '1');
      });
    });
  }

  /* ------------------------------------------------------------------------
     Steppers (quantity / hours)
     ------------------------------------------------------------------------ */
  function initSteppers(ctx = document) {
    $$('.stepper', ctx).forEach((stepper) => {
      if (stepper.dataset.bound) return;
      stepper.dataset.bound = '1';
      const input = $('input', stepper);
      $$('[data-step]', stepper).forEach((btn) => {
        btn.addEventListener('click', () => {
          const min = parseInt(input.min || '1', 10);
          const max = parseInt(input.max || '999', 10);
          input.value = clamp((parseInt(input.value, 10) || min) + parseInt(btn.dataset.step, 10), min, max);
          input.dispatchEvent(new Event('input', { bubbles: true }));
        });
      });
    });
  }

  /* ------------------------------------------------------------------------
     Studio booking
     ------------------------------------------------------------------------ */
  function initBooking(ctx = document) {
    $$('[data-studio]', ctx).forEach((studio) => {
      const form = $('.booking__form', studio);
      if (!form) return;
      const date = $('[data-booking-date]', form);
      const hours = $('[data-booking-hours]', form);
      const estimate = $('[data-booking-estimate]', form);
      const deposit = $('[data-booking-deposit]', form);

      if (date) {
        const today = new Date();
        today.setMinutes(today.getMinutes() - today.getTimezoneOffset());
        date.min = today.toISOString().slice(0, 10);
      }

      const selectedRoom = () => $('input[name="contact[Room]"]:checked', form);

      const recalc = () => {
        const room = selectedRoom();
        const rate = room ? parseFloat(room.dataset.rate) || 0 : 0;
        const h = parseInt(hours && hours.value, 10) || 0;
        if (estimate) estimate.textContent = rate ? formatMoney(Math.round(rate * h * 100)) : '—';
        if (deposit) deposit.disabled = !(room && room.dataset.variant);
      };
      form.addEventListener('input', recalc);
      form.addEventListener('change', recalc);
      recalc();

      // "Book this room" buttons on room cards preselect the room.
      $$('[data-room-pick]', studio).forEach((link) => {
        link.addEventListener('click', () => {
          const input = $(`input[data-room-id="${link.dataset.roomPick}"]`, form);
          if (input) { input.checked = true; recalc(); }
        });
      });

      if (deposit) {
        deposit.addEventListener('click', async () => {
          const room = selectedRoom();
          if (!room || !room.dataset.variant) return;
          if (!form.reportValidity()) return;
          const fd = new FormData(form);
          const body = new FormData();
          body.append('id', room.dataset.variant);
          body.append('quantity', parseInt(hours.value, 10) || 1);
          body.append('properties[Room]', room.value);
          ['Session date', 'Start time', 'Hours', 'Project type'].forEach((k) => {
            const v = fd.get(`contact[${k}]`);
            if (v) body.append(`properties[${k}]`, v);
          });
          const name = fd.get('contact[name]');
          if (name) body.append('properties[Booked by]', name);
          const notes = fd.get('contact[body]');
          if (notes) body.append('properties[Notes]', notes);
          deposit.disabled = true;
          try {
            await Cart.add(body);
            if (!Cart.drawer) window.location.href = F.routes.cart || '/cart';
          } catch (err) {
            alert(err.message);
          } finally {
            deposit.disabled = false;
          }
        });
      }
    });
  }

  /* ------------------------------------------------------------------------
     Collection sort & filters
     ------------------------------------------------------------------------ */
  function initCollection(ctx = document) {
    const sort = $('[data-sort-select]', ctx);
    const filterForm = $('[data-filter-form]', ctx);
    const go = () => {
      const params = filterForm ? new URLSearchParams(new FormData(filterForm)) : new URLSearchParams(window.location.search);
      if (sort) params.set('sort_by', sort.value);
      params.delete('page');
      window.location.search = params.toString();
    };
    if (sort) sort.addEventListener('change', go);
    if (filterForm) filterForm.addEventListener('change', go);
  }

  function initAccountToggles() {
    $$('[data-toggle-recover]').forEach((link) => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        const rec = $('#RecoverForm');
        const login = $('#LoginForm');
        if (!rec || !login) return;
        const showRecover = rec.hidden;
        rec.hidden = !showRecover;
        login.hidden = showRecover;
      });
    });
    if (window.location.hash === '#recover') {
      const rec = $('#RecoverForm');
      const login = $('#LoginForm');
      if (rec && login) { rec.hidden = false; login.hidden = true; }
    }
  }

  /* ------------------------------------------------------------------------
     Boot
     ------------------------------------------------------------------------ */
  function initSection(ctx) {
    initReveal(ctx);
    initTiltCards(ctx);
    initScramble(ctx);
    initMagnetic(ctx);
    initGlitch(ctx);
    initHoverReveal(ctx);
    initHub(ctx);
    initProduct(ctx);
    initSteppers(ctx);
    initBooking(ctx);
  }

  function boot() {
    if (!document.body.classList.contains('no-reveal')) initReveal();
    else $$('.reveal').forEach((el) => el.classList.add('is-in'));
    initTilt();
    initCursor();
    initMenu();
    Cart.init();
    initScroll();
    initTiltCards();
    initScramble();
    initMagnetic();
    initGlitch();
    initHoverReveal();
    initHub();
    initProduct();
    initSteppers();
    initBooking();
    initCollection();
    initAccountToggles();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

  // Theme editor support
  document.addEventListener('shopify:section:load', (e) => {
    initSection(e.target);
    collectScrollFx();
    onScrollFrame();
  });
  document.addEventListener('shopify:section:unload', () => setTimeout(collectScrollFx, 0));
  document.addEventListener('shopify:block:select', (e) => {
    const el = e.target;
    if (el.classList.contains('reveal')) el.classList.add('is-in');
  });
})();
