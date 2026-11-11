(() => {
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const body = document.body;
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = matchMedia('(pointer: fine)').matches;
  const rand = (a, b) => a + Math.random() * (b - a);
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

  /* ---------- Toast ---------- */
  const toast = $('#toast');
  let toastT;
  const showToast = (msg) => {
    toast.textContent = msg;
    toast.classList.add('show');
    clearTimeout(toastT);
    toastT = setTimeout(() => toast.classList.remove('show'), 2200);
  };

  /* =========================================================
     ENTRY SHUTTER
     ========================================================= */
  const door = $('#door');
  const nowPlaying = $('.now-playing');
  let doorOpen = false;
  const updateNP = () => nowPlaying.classList.toggle('hide', !doorOpen || window.scrollY < innerHeight * 0.55);
  window.addEventListener('scroll', updateNP, { passive: true });
  const startHero = () => {
    $('.marker')?.classList.add('drawn');
    doorOpen = true;
    updateNP();
  };
  let seen = false;
  try { seen = sessionStorage.getItem('door') === '1'; } catch (e) { /* storage blocked */ }

  if (!door || seen || reduceMotion || location.hash.length > 1) {
    door?.classList.add('gone');
    startHero();
  } else {
    body.classList.add('locked');
    let opened = false;
    const openDoor = () => {
      if (opened) return;
      opened = true;
      door.classList.add('up');
      body.classList.remove('locked');
      try { sessionStorage.setItem('door', '1'); } catch (e) { /* ignore */ }
      setTimeout(startHero, 450);
      setTimeout(() => door.classList.add('gone'), 1200);
      ['click', 'wheel', 'touchmove'].forEach((t) => door.removeEventListener(t, openDoor));
      window.removeEventListener('keydown', openDoor);
    };
    door.addEventListener('click', openDoor);
    door.addEventListener('wheel', openDoor, { passive: true });
    door.addEventListener('touchmove', openDoor, { passive: true });
    window.addEventListener('keydown', openDoor);
  }

  /* =========================================================
     ACTIVE SECTION: nav, now-playing, setlist
     ========================================================= */
  const navLinks = $$('.nav a');
  const setLinks = $$('.setlist a');
  const npName = $('#npName');
  const npDisc = $('.np-disc');
  const secColors = { home: '#e9ff2e', about: '#ff3d8b', experience: '#3dff8a', projects: '#22d3ff', skills: '#ffb12b', credentials: '#ff3b24', contact: '#e9ff2e' };
  let activeId = '';
  const setActive = (id) => {
    if (id === activeId) return;
    activeId = id;
    navLinks.forEach((a) => {
      const on = a.getAttribute('href') === `#${id}`;
      if (a.classList.contains('active') && !on) a.classList.add('visited');
      a.classList.toggle('active', on);
    });
    setLinks.forEach((a) => a.classList.toggle('active', a.dataset.sec === id));
    const link = setLinks.find((a) => a.dataset.sec === id);
    if (link) npName.textContent = `${$('.sl-code', link).textContent} · ${$('.sl-t', link).textContent}`;
    npDisc.style.setProperty('--np', secColors[id] || '#e9ff2e');
  };
  /* =========================================================
     SLIDING LAYERS
     Each section is position:sticky. Its `top` is set so a tall section
     scrolls fully before it sticks; the next section then slides over it
     and the covered one dims. Active section comes from the zero-height
     .anchor before each layer (sticky boxes can't be measured reliably).
     ========================================================= */
  //
  // Performance notes (this runs on every scroll frame):
  //  - all layout reads happen first, then all writes (no forced re-layouts)
  //  - the darkening is a real child element; only its opacity changes, and
  //    only when the value actually changed (no inherited CSS variables)
  //  - the viewport height comes from a 100lvh probe, so the mobile address bar
  //    showing/hiding doesn't re-measure the layers and make them jump
  const layers = $$('.layer');
  const dims = layers.map((l) => {
    const d = document.createElement('div');
    d.className = 'layer-dim';
    d.setAttribute('aria-hidden', 'true');
    l.appendChild(d);
    return d;
  });
  const lastDim = layers.map(() => -1);
  const vhProbe = document.createElement('div');
  vhProbe.setAttribute('aria-hidden', 'true');
  vhProbe.style.cssText = 'position:fixed;left:0;top:0;width:0;height:100vh;height:100lvh;visibility:hidden;pointer-events:none';
  body.appendChild(vhProbe);
  const ghosts = reduceMotion ? [] : $$('[data-drift]');

  let anchorTops = [];
  let vh = vhProbe.offsetHeight || innerHeight;
  let lastW = innerWidth;

  const measureLayers = () => {
    vh = vhProbe.offsetHeight || innerHeight;
    lastW = innerWidth;
    const heights = layers.map((l) => l.offsetHeight); // read all…
    layers.forEach((l, i) => { // …then write all
      l.style.zIndex = String(i + 1);
      if (!reduceMotion) l.style.top = `${Math.min(0, vh - heights[i])}px`;
    });
    anchorTops = layers.map((l) => {
      const a = l.previousElementSibling;
      return a && a.classList.contains('anchor') ? a.getBoundingClientRect().top + window.scrollY : 0;
    });
    frame();
  };

  // One scroll frame: active section, layer darkening, ghost-text drift
  const frame = () => {
    // reads
    const y = window.scrollY;
    const tops = reduceMotion ? [] : layers.map((l) => l.getBoundingClientRect().top);
    const ghostRects = ghosts.map((g) => g.parentElement.getBoundingClientRect());
    // writes
    let cur = 0;
    anchorTops.forEach((t, i) => { if (y + vh * 0.45 >= t) cur = i; });
    if (layers[cur]) setActive(layers[cur].dataset.sec);
    if (reduceMotion) return;
    layers.forEach((l, i) => {
      const nextTop = i + 1 < layers.length ? tops[i + 1] : vh;
      const d = Math.round(clamp(1 - nextTop / vh, 0, 1) * 60) / 100; // 0 … 0.6
      if (d !== lastDim[i]) {
        lastDim[i] = d;
        dims[i].style.opacity = d;
      }
    });
    ghosts.forEach((g, i) => {
      const r = ghostRects[i];
      if (r.bottom < 0 || r.top > vh) return;
      const p = (vh - r.top) / (vh + r.height);
      g.style.transform = `translate3d(${(-p * 35).toFixed(2)}%, 0, 0)`;
    });
  };
  let ticking = false;
  window.addEventListener('scroll', () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => { frame(); ticking = false; });
  }, { passive: true });

  let layerRT;
  const remeasure = () => { clearTimeout(layerRT); layerRT = setTimeout(measureLayers, 150); };
  // 100lvh ignores the phone address bar, so its show/hide no longer re-measures
  // (that was the "blip"); real resizes and rotations still do.
  window.addEventListener('resize', () => {
    const widthChanged = innerWidth !== lastW;
    const heightChanged = Math.abs((vhProbe.offsetHeight || innerHeight) - vh) > 1;
    if (widthChanged || heightChanged) remeasure();
  });
  if ('ResizeObserver' in window) {
    const ro = new ResizeObserver(remeasure);
    layers.forEach((l) => ro.observe(l));
  }
  document.fonts?.ready.then(measureLayers);
  window.addEventListener('load', measureLayers);
  measureLayers();

  /* =========================================================
     DRAWER
     ========================================================= */
  const drawer = $('#drawer');
  const openers = $$('[aria-controls="drawer"]');
  let lastFocus;
  const setDrawer = (open) => {
    openers.forEach((b) => b.setAttribute('aria-expanded', String(open)));
    if (open) {
      lastFocus = document.activeElement;
      drawer.hidden = false;
      body.classList.add('locked');
      requestAnimationFrame(() => requestAnimationFrame(() => drawer.classList.add('open')));
      setTimeout(() => $('.drawer-close').focus(), 50);
    } else {
      drawer.classList.remove('open');
      body.classList.remove('locked');
      setTimeout(() => { drawer.hidden = true; }, reduceMotion ? 0 : 600);
      lastFocus?.focus?.({ preventScroll: true });
    }
  };
  openers.forEach((b) => b.addEventListener('click', () => setDrawer(true)));
  $('.drawer-close').addEventListener('click', () => setDrawer(false));
  setLinks.forEach((a) => a.addEventListener('click', () => setDrawer(false)));
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !drawer.hidden) setDrawer(false); });

  /* =========================================================
     MOUSE PARALLAX + LAMP
     ========================================================= */
  // Throttled to one update per frame, rects read before any writes.
  if (finePointer && !reduceMotion) {
    const hero = $('.hero');
    const movers = $$('[data-mouse]', hero);
    const lamps = $$('.lamp');
    let px = 0;
    let py = 0;
    let queued = false;
    const apply = () => {
      queued = false;
      const nx = px / innerWidth - 0.5;
      const ny = py / innerHeight - 0.5;
      const lampRects = lamps.map((l) => l.getBoundingClientRect());
      const heroVisible = hero.getBoundingClientRect().bottom > 0;
      if (heroVisible) {
        movers.forEach((el) => {
          const f = parseFloat(el.dataset.mouse);
          el.style.setProperty('--mx', `${(nx * f).toFixed(1)}px`);
          el.style.setProperty('--my', `${(ny * f).toFixed(1)}px`);
        });
      }
      lamps.forEach((l, i) => {
        const r = lampRects[i];
        if (r.bottom < 0 || r.top > innerHeight) return;
        l.style.setProperty('--lx', `${Math.round(px - r.left)}px`);
        l.style.setProperty('--ly', `${Math.round(py - r.top)}px`);
      });
    };
    window.addEventListener('pointermove', (e) => {
      px = e.clientX;
      py = e.clientY;
      if (!queued) { queued = true; requestAnimationFrame(apply); }
    }, { passive: true });
  }

  /* =========================================================
     SCROLL REVEAL
     ========================================================= */
  const revealEls = $$('.section-head, .poster, .flyer, .bp, .deck, .tracks, .rack, .album-wall, .tape-detail, .contact-inner, .tagwall, .led-strip');
  revealEls.forEach((el) => el.classList.add('rv'));
  const revObs = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (!e.isIntersecting) return;
      e.target.classList.add('in');
      revObs.unobserve(e.target);
    });
  }, { threshold: 0.12 });
  revealEls.forEach((el) => revObs.observe(el));

  /* =========================================================
     LED SEVEN-SEGMENT STATS
     ========================================================= */
  const SEG = { 0: 'abcdef', 1: 'bc', 2: 'abdeg', 3: 'abcdg', 4: 'bcfg', 5: 'acdfg', 6: 'acdefg', 7: 'abc', 8: 'abcdefg', 9: 'abcdfg', ' ': '' };
  const renderLed = (el, str, suffix) => {
    el.innerHTML = [...str].map((ch) => {
      if (ch === '.') return '<span class="led-dot"></span>';
      const on = SEG[ch] ?? '';
      return `<span class="digit">${'abcdefg'.split('').map((s) => `<i class="${s}${on.includes(s) ? ' on' : ''}"></i>`).join('')}</span>`;
    }).join('') + (suffix ? `<span class="led-suffix">${suffix}</span>` : '');
  };
  const leds = $$('.led[data-value]');
  const fmt = (v, dec) => v.toFixed(dec);
  leds.forEach((el) => {
    const dec = parseInt(el.dataset.decimals || '0', 10);
    renderLed(el, fmt(0, dec).padStart(fmt(+el.dataset.value, dec).length, ' '), el.dataset.suffix);
  });
  const countLed = (el) => {
    const target = parseFloat(el.dataset.value);
    const dec = parseInt(el.dataset.decimals || '0', 10);
    const len = fmt(target, dec).length;
    const suffix = el.dataset.suffix || '';
    if (reduceMotion) return renderLed(el, fmt(target, dec), suffix);
    const dur = 1400;
    const t0 = performance.now();
    const step = (now) => {
      const p = Math.min(1, (now - t0) / dur);
      const eased = 1 - Math.pow(1 - p, 3);
      renderLed(el, fmt(target * eased, dec).padStart(len, ' '), suffix);
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  };
  const ledObs = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (!e.isIntersecting) return;
      $$('.led[data-value]', e.target).forEach((el, i) => setTimeout(() => countLed(el), i * 120));
      ledObs.unobserve(e.target);
    });
  }, { threshold: 0.4 });
  const strip = $('.led-strip');
  if (strip) ledObs.observe(strip);

  /* =========================================================
     TURNTABLE (Experience)
     ========================================================= */
  const deckSec = $('.deck-section');
  const record = $('#record');
  if (record) {
    const label = $('#recordLabel');
    const tonearm = $('#tonearm');
    const playBtn = $('#playBtn');
    const tracks = $$('.track', deckSec);
    const details = $$('.td', deckSec);
    let cur = 0;
    let playing = false;
    let angle = 0;
    let vel = 0;
    let autoT;

    const setArm = () => tonearm.style.setProperty('--arm', playing ? `${20 + cur * 5}deg` : '0deg');
    const setTrack = (i, kick = true) => {
      cur = (i + tracks.length) % tracks.length;
      const t = tracks[cur];
      tracks.forEach((b, j) => b.setAttribute('aria-current', String(j === cur)));
      details.forEach((d, j) => d.classList.toggle('on', j === cur));
      label.style.setProperty('--lbl', t.style.getPropertyValue('--tc'));
      label.innerHTML = `<span class="rl-side">${$('.side', t).textContent}</span><span class="rl-co">${t.dataset.co}</span><span class="rl-yr">${t.dataset.yr}</span><span class="rl-hole"></span>`;
      record.setAttribute('aria-valuenow', String(cur + 1));
      record.setAttribute('aria-valuetext', `${$('.t-co', t).textContent}, ${$('.t-role', t).textContent}`);
      setArm();
      if (kick && !reduceMotion) { vel += 520; wake(); }
      if (playing) scheduleNext();
    };
    const scheduleNext = () => {
      clearTimeout(autoT);
      autoT = setTimeout(() => setTrack(cur + 1), 8000);
    };
    const setPlaying = (on) => {
      playing = on;
      deckSec.classList.toggle('playing', on);
      playBtn.setAttribute('aria-pressed', String(on));
      playBtn.setAttribute('aria-label', on ? 'Pause' : 'Play');
      $('span', playBtn).textContent = on ? 'Pause' : 'Play';
      setArm();
      if (on) scheduleNext(); else clearTimeout(autoT);
      wake();
    };

    // Spin loop — runs only while something moves and the deck is on screen
    let last = performance.now();
    let dragging = false;
    let running = false;
    let deckVisible = true;
    const loop = (now) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (!dragging) {
        const base = playing && !reduceMotion ? 200 : 0; // ~33⅓ rpm
        vel += (base - vel) * Math.min(1, dt * 2.2);
        angle += vel * dt;
      }
      record.style.transform = `rotate(${angle.toFixed(2)}deg)`;
      const idle = !playing && !dragging && Math.abs(vel) < 0.5;
      if (idle || !deckVisible) { running = false; return; }
      requestAnimationFrame(loop);
    };
    const wake = () => {
      if (running || !deckVisible) return;
      running = true;
      last = performance.now();
      requestAnimationFrame(loop);
    };
    new IntersectionObserver((entries) => {
      deckVisible = entries[0].isIntersecting;
      if (deckVisible) wake();
    }).observe(record);

    // Drag the record to scratch through tracks
    let prevA = 0;
    let acc = 0;
    const ptrAngle = (e) => {
      const r = record.getBoundingClientRect();
      return Math.atan2(e.clientY - (r.top + r.height / 2), e.clientX - (r.left + r.width / 2)) * 180 / Math.PI;
    };
    record.addEventListener('pointerdown', (e) => {
      dragging = true;
      wake();
      acc = 0;
      prevA = ptrAngle(e);
      record.setPointerCapture(e.pointerId);
    });
    record.addEventListener('pointermove', (e) => {
      if (!dragging) return;
      const a = ptrAngle(e);
      let d = a - prevA;
      if (d > 180) d -= 360;
      if (d < -180) d += 360;
      prevA = a;
      angle += d;
      acc += d;
      if (acc > 80) { acc = 0; setTrack(cur + 1, false); }
      if (acc < -80) { acc = 0; setTrack(cur - 1, false); }
    });
    const endDrag = () => { dragging = false; vel = 0; };
    record.addEventListener('pointerup', endDrag);
    record.addEventListener('pointercancel', endDrag);
    record.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowRight' || e.key === 'ArrowUp') { e.preventDefault(); setTrack(cur + 1); }
      if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') { e.preventDefault(); setTrack(cur - 1); }
      if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); setPlaying(!playing); }
    });
    tracks.forEach((t, i) => t.addEventListener('click', () => setTrack(i)));
    playBtn.addEventListener('click', () => setPlaying(!playing));
    setTrack(0, false);
  }

  /* =========================================================
     STICKER WALL (Skills)
     ========================================================= */
  const wall = $('#stickerWall');
  if (wall) {
    const stickers = $$('.sticker', wall);
    let topZ = 10;
    let lastW = 0;

    // Default layout: technical stickers on the left, soft skills on the right
    // (stacked on narrow screens), each group under its graffiti title.
    const groupItems = (name) => $$(`.sticker-group[data-group="${name}"] .sticker`, wall);
    const tagBottom = (sel) => {
      const t = $(sel, wall);
      return t ? t.offsetTop + t.offsetHeight + 16 : 0;
    };
    // Scatter stickers inside a zone: biggest first, each one tries many
    // random spots and keeps the one that overlaps the others least.
    const placeZone = (items, z, startDelay) => {
      const placed = [];
      const sized = items
        .map((s) => ({ s, hw: s.offsetWidth / 2 + 6, hh: s.offsetHeight / 2 + 6 }))
        .sort((a, b) => b.hw * b.hh - a.hw * a.hh);
      sized.forEach(({ s, hw, hh }) => {
        let best = null;
        for (let t = 0; t < 60; t++) {
          const x = rand(z.x0 + hw, Math.max(z.x0 + hw, z.x1 - hw));
          const y = rand(z.y0 + hh, Math.max(z.y0 + hh, z.y1 - hh));
          let overlap = 0;
          placed.forEach((p) => {
            const ox = Math.min(x + hw, p.x + p.hw) - Math.max(x - hw, p.x - p.hw);
            const oy = Math.min(y + hh, p.y + p.hh) - Math.max(y - hh, p.y - p.hh);
            if (ox > 0 && oy > 0) overlap += ox * oy;
          });
          if (!best || overlap < best.overlap) best = { x, y, overlap };
          if (overlap === 0) break;
        }
        placed.push({ x: best.x, y: best.y, hw, hh });
        s.style.setProperty('--x', `${best.x}px`);
        s.style.setProperty('--y', `${best.y}px`);
        s.style.setProperty('--rot', `${rand(-12, 12).toFixed(1)}deg`);
      });
      items
        .map((s, i) => i)
        .sort(() => Math.random() - 0.5)
        .forEach((idx, k) => items[idx].style.setProperty('--d', `${startDelay + k * 70}ms`));
    };
    // Narrow screens: a loose 2-column grid reads better than a random scatter.
    const gridZone = (items, z, startDelay) => {
      const cols = 2;
      const rows = Math.ceil(items.length / cols);
      const cw = (z.x1 - z.x0) / cols;
      const ch = (z.y1 - z.y0) / rows;
      items
        .map((s, i) => i)
        .sort(() => Math.random() - 0.5)
        .forEach((idx, k) => {
          const s = items[idx];
          const sw = s.offsetWidth / 2;
          const sh = s.offsetHeight / 2;
          const x = clamp(z.x0 + cw * ((k % cols) + 0.5) + rand(-cw * 0.12, cw * 0.12), z.x0 + sw + 4, z.x1 - sw - 4);
          const y = clamp(z.y0 + ch * (Math.floor(k / cols) + 0.5) + rand(-ch * 0.12, ch * 0.12), z.y0 + sh + 4, z.y1 - sh - 4);
          s.style.setProperty('--x', `${x}px`);
          s.style.setProperty('--y', `${y}px`);
          s.style.setProperty('--rot', `${rand(-10, 10).toFixed(1)}deg`);
          s.style.setProperty('--d', `${startDelay + k * 70}ms`);
        });
    };
    const layout = () => {
      const W = wall.clientWidth;
      const H = wall.clientHeight;
      lastW = W;
      const tech = groupItems('tech');
      const soft = groupItems('soft');
      if (W >= 700) {
        const split = W * 0.64;
        placeZone(tech, { x0: 0, x1: split - 10, y0: tagBottom('.wall-tag-tech'), y1: H }, 0);
        placeZone(soft, { x0: split + 10, x1: W, y0: tagBottom('.wall-tag-soft'), y1: H }, tech.length * 70);
      } else {
        const split = H * 0.71;
        gridZone(tech, { x0: 0, x1: W, y0: tagBottom('.wall-tag-tech'), y1: split - 10 }, 0);
        gridZone(soft, { x0: 0, x1: W, y0: tagBottom('.wall-tag-soft'), y1: H }, tech.length * 70);
      }
    };
    wall.classList.add('placing');
    layout();
    requestAnimationFrame(() => requestAnimationFrame(() => wall.classList.remove('placing')));

    const slapIn = () => stickers.forEach((s) => {
      s.classList.remove('in');
      void s.offsetWidth;
      s.classList.add('in');
    });
    const wallObs = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) { slapIn(); wallObs.disconnect(); }
    }, { threshold: 0.25 });
    wallObs.observe(wall);

    $('#shuffleBtn').addEventListener('click', () => { layout(); slapIn(); });
    let rT;
    window.addEventListener('resize', () => {
      clearTimeout(rT);
      rT = setTimeout(() => { if (Math.abs(wall.clientWidth - lastW) > 40) layout(); }, 200);
    });

    stickers.forEach((s) => {
      let ox = 0;
      let oy = 0;
      let active = false;
      const move = (x, y) => {
        const sw = s.offsetWidth / 2;
        const sh = s.offsetHeight / 2;
        s.style.setProperty('--x', `${clamp(x, sw, wall.clientWidth - sw)}px`);
        s.style.setProperty('--y', `${clamp(y, sh, wall.clientHeight - sh)}px`);
      };
      s.addEventListener('pointerdown', (e) => {
        active = true;
        s.setPointerCapture(e.pointerId);
        s.classList.add('dragging');
        s.style.setProperty('--z', ++topZ);
        const wr = wall.getBoundingClientRect();
        ox = e.clientX - wr.left - parseFloat(s.style.getPropertyValue('--x'));
        oy = e.clientY - wr.top - parseFloat(s.style.getPropertyValue('--y'));
      });
      s.addEventListener('pointermove', (e) => {
        if (!active) return;
        const wr = wall.getBoundingClientRect();
        move(e.clientX - wr.left - ox, e.clientY - wr.top - oy);
      });
      const end = () => {
        if (!active) return;
        active = false;
        s.classList.remove('dragging');
        s.style.setProperty('--rot', `${rand(-10, 10).toFixed(1)}deg`);
      };
      s.addEventListener('pointerup', end);
      s.addEventListener('pointercancel', end);
      s.addEventListener('keydown', (e) => {
        const map = { ArrowLeft: [-20, 0], ArrowRight: [20, 0], ArrowUp: [0, -20], ArrowDown: [0, 20] };
        if (!map[e.key]) return;
        e.preventDefault();
        s.style.setProperty('--z', ++topZ);
        move(parseFloat(s.style.getPropertyValue('--x')) + map[e.key][0], parseFloat(s.style.getPropertyValue('--y')) + map[e.key][1]);
      });
    });
  }

  /* =========================================================
     CREDENTIALS — vinyl rack + gatefold album + lightbox
     Picking a record: the album cover on the right swings shut,
     gets re-dressed with the new sleeve, then swings open on its
     spine to unveil the document printed on the inside.
     ========================================================= */
  const rail = $('#lpRail');
  if (rail) {
    const items = $$('.lp', rail);
    const cds = $$('#lpDetail .cd');
    const album = $('#album');
    const cover = $('#albumCover');
    const coverFront = $('#coverFront');
    const docFrame = $('#docFrame');
    const docMedia = $('#docMedia');
    const bar = $('#rackBar');
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    let cur = 0;
    let swapToken = 0;
    let albumLive = reduceMotion; // becomes true once the album has scrolled into view

    const captionFor = (i) => {
      const a = cds[i];
      return a ? `${$('.cd-title', a).textContent} — ${$('.cd-inst', a).textContent}` : '';
    };
    // An uploaded document image, or the summary card for credentials without one
    const buildMedia = (t) => {
      if (t.dataset.doc) {
        const img = new Image();
        img.src = t.dataset.doc;
        img.alt = t.dataset.alt || '';
        img.decoding = 'async';
        return img;
      }
      const card = document.getElementById(t.dataset.card).cloneNode(true);
      card.removeAttribute('id');
      return card;
    };
    // The album cover reuses the rack sleeve's markup (sized in em, so it scales up)
    const dressCover = (t) => {
      coverFront.className = `cover-front ${[...t.classList].filter((c) => c.startsWith('lp-')).join(' ')}`;
      coverFront.style.setProperty('--lab', t.style.getPropertyValue('--lab'));
      coverFront.replaceChildren($('.lp-sleeve', t).cloneNode(true));
      $('#coverBackTitle').textContent = $('.lp-title', t).textContent;
    };
    const openAlbum = () => album.classList.add('open');

    const showDoc = async (i, animate) => {
      const token = ++swapToken;
      const t = items[i];
      const node = buildMedia(t);
      // wait for the image to decode, but never hang the swap on it
      const ready = node.tagName === 'IMG' && node.decode
        ? Promise.race([node.decode().catch(() => {}), wait(1200)])
        : Promise.resolve();
      const fancy = animate && !reduceMotion && albumLive && album.classList.contains('open');
      if (fancy) {
        album.classList.remove('open'); // cover swings shut
        await Promise.all([ready, wait(470)]);
      } else {
        await ready;
      }
      if (token !== swapToken) return; // a newer record was picked meanwhile
      dressCover(t);
      docMedia.replaceChildren(node);
      docFrame.style.setProperty('--dr', `${rand(-2.5, 2.5).toFixed(1)}deg`);
      docFrame.setAttribute('aria-label', `Open full size: ${captionFor(i)}`);
      if (!albumLive) return; // it will open when it scrolls into view
      if (fancy) {
        await wait(110); // let the new cover register before it swings open
        if (token !== swapToken) return;
      }
      openAlbum();
    };

    const centerItem = (t, smooth = true) => {
      const r = rail.getBoundingClientRect();
      const tr = t.getBoundingClientRect();
      rail.scrollBy({ left: tr.left + tr.width / 2 - (r.left + r.width / 2), behavior: smooth && !reduceMotion ? 'smooth' : 'auto' });
    };

    const select = (i, { focus = false, animate = true } = {}) => {
      i = clamp(i, 0, items.length - 1);
      const changed = i !== cur;
      cur = i;
      items.forEach((t, j) => {
        t.setAttribute('aria-selected', String(j === i));
        t.tabIndex = j === i ? 0 : -1;
      });
      cds.forEach((c, j) => c.classList.toggle('on', j === i));
      if (focus) items[i].focus({ preventScroll: true });
      centerItem(items[i], animate);
      if (changed || !animate) showDoc(i, animate && changed);
    };

    items.forEach((t, i) => t.addEventListener('click', () => select(i)));
    $('.rack-prev').addEventListener('click', () => select(cur - 1));
    $('.rack-next').addEventListener('click', () => select(cur + 1));
    rail.addEventListener('keydown', (e) => {
      const map = { ArrowRight: cur + 1, ArrowDown: cur + 1, ArrowLeft: cur - 1, ArrowUp: cur - 1, Home: 0, End: items.length - 1 };
      if (!(e.key in map)) return;
      e.preventDefault();
      select(map[e.key], { focus: true });
    });
    // A closed cover can be clicked to open it
    cover.addEventListener('click', () => { albumLive = true; openAlbum(); });

    // First time the album scrolls into view, the gatefold opens by itself
    if (!albumLive) {
      const albumObs = new IntersectionObserver((entries) => {
        if (!entries[0].isIntersecting) return;
        albumObs.disconnect();
        setTimeout(() => { albumLive = true; openAlbum(); }, 250);
      }, { threshold: 0.45 });
      albumObs.observe(album);
    }

    // Progress bar under the rack
    const updateBar = () => {
      const max = rail.scrollWidth;
      bar.style.setProperty('--w', `${(rail.clientWidth / max) * 100}%`);
      bar.style.setProperty('--l', `${(rail.scrollLeft / max) * 100}%`);
    };
    rail.addEventListener('scroll', updateBar, { passive: true });
    window.addEventListener('resize', updateBar);

    // Mouse drag to slide the rack (touch uses native swipe)
    let dragX = 0;
    let dragLeft = 0;
    let dragging = false;
    let moved = false;
    rail.addEventListener('pointerdown', (e) => {
      if (e.pointerType !== 'mouse' || e.button !== 0) return;
      dragging = true;
      moved = false;
      dragX = e.clientX;
      dragLeft = rail.scrollLeft;
    });
    window.addEventListener('pointermove', (e) => {
      if (!dragging) return;
      const dx = e.clientX - dragX;
      if (!moved && Math.abs(dx) > 6) { moved = true; rail.classList.add('grabbing'); }
      if (moved) rail.scrollLeft = dragLeft - dx;
    });
    window.addEventListener('pointerup', () => {
      if (!dragging) return;
      dragging = false;
      setTimeout(() => rail.classList.remove('grabbing'), 0);
    });

    select(0, { animate: false });
    updateBar();

    /* ---------- Lightbox ---------- */
    const lb = $('#lightbox');
    const lbMedia = $('#lbMedia');
    const lbCap = $('#lbCap');
    const lbClose = $('.lb-close', lb);
    let lbLast = null;
    const openLb = () => {
      lbMedia.replaceChildren(buildMedia(items[cur]));
      lbCap.textContent = captionFor(cur);
      lbLast = document.activeElement;
      lb.hidden = false;
      body.classList.add('locked');
      void lb.offsetWidth;
      lb.classList.add('open');
      lbClose.focus({ preventScroll: true });
    };
    const closeLb = () => {
      if (lb.hidden) return;
      lb.classList.remove('open');
      body.classList.remove('locked');
      setTimeout(() => { lb.hidden = true; lbMedia.replaceChildren(); }, reduceMotion ? 0 : 320);
      lbLast?.focus?.({ preventScroll: true });
    };
    docFrame.addEventListener('click', openLb);
    $$('[data-lb-close]', lb).forEach((el) => el.addEventListener('click', closeLb));
    document.addEventListener('keydown', (e) => {
      if (lb.hidden) return;
      if (e.key === 'Escape') closeLb();
      if (e.key === 'Tab') { e.preventDefault(); lbClose.focus(); } // only one control inside
    });
  }

  /* =========================================================
     PROJECT SHEET — posters open a modal with screenshot + details
     ========================================================= */
  const pm = $('#projModal');
  if (pm) {
    const pmSheet = $('#pmSheet');
    const pmBody = $('#pmBody');
    const pmClose = $('.lb-close', pm);
    let pmLast = null;
    let pmTimer;
    const openPm = (key, trigger) => {
      const tpl = document.getElementById(`proj-${key}`);
      if (!tpl) return;
      clearTimeout(pmTimer);
      pmBody.replaceChildren(tpl.content.cloneNode(true));
      pmSheet.classList.toggle('is-portrait', tpl.dataset.layout === 'portrait');
      pmLast = trigger;
      pm.hidden = false;
      pm.scrollTop = 0;
      body.classList.add('locked');
      void pm.offsetWidth;
      pm.classList.add('open');
      pmClose.focus({ preventScroll: true });
    };
    const closePm = () => {
      if (pm.hidden) return;
      pm.classList.remove('open');
      body.classList.remove('locked');
      pmTimer = setTimeout(() => { pm.hidden = true; pmBody.replaceChildren(); }, reduceMotion ? 0 : 320);
      pmLast?.focus?.({ preventScroll: true });
    };
    $$('.bp-open[data-project]').forEach((btn) => btn.addEventListener('click', () => openPm(btn.dataset.project, btn)));
    $$('[data-pm-close]', pm).forEach((el) => el.addEventListener('click', closePm));
    document.addEventListener('keydown', (e) => {
      if (pm.hidden) return;
      if (e.key === 'Escape') closePm();
      if (e.key === 'Tab') { e.preventDefault(); pmClose.focus(); } // only one control inside
    });
  }

  /* =========================================================
     COPY EMAIL
     ========================================================= */
  const copyBtn = $('#copyEmail');
  copyBtn?.addEventListener('click', async () => {
    const email = copyBtn.dataset.email;
    try {
      await navigator.clipboard.writeText(email);
    } catch (e) {
      const ta = document.createElement('textarea');
      ta.value = email;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
    }
    showToast('Email copied!');
  });

  /* =========================================================
     TAG WALL (spray canvas)
     ========================================================= */
  const canvas = $('#tagCanvas');
  if (canvas) {
    const ctx = canvas.getContext('2d');
    const hint = $('#tagHint');
    let color = '#e9ff2e';
    let nozzle = 'fat';
    const NOZ = { skinny: { r: 7, n: 26 }, fat: { r: 20, n: 70 }, splatter: { r: 30, n: 22 } };
    let dpr = 1;

    const resize = () => {
      const prev = document.createElement('canvas');
      prev.width = canvas.width;
      prev.height = canvas.height;
      if (canvas.width) prev.getContext('2d').drawImage(canvas, 0, 0);
      dpr = Math.min(2, window.devicePixelRatio || 1);
      const r = canvas.getBoundingClientRect();
      canvas.width = Math.round(r.width * dpr);
      canvas.height = Math.round(r.height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (prev.width) ctx.drawImage(prev, 0, 0, prev.width / dpr, prev.height / dpr);
    };
    resize();
    let crT;
    window.addEventListener('resize', () => { clearTimeout(crT); crT = setTimeout(resize, 200); });

    const drips = [];
    const stamp = (x, y) => {
      const { r, n } = NOZ[nozzle];
      ctx.fillStyle = color;
      // soft core
      const g = ctx.createRadialGradient(x, y, 0, x, y, r * 0.7);
      g.addColorStop(0, `${color}55`);
      g.addColorStop(1, `${color}00`);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, y, r * 0.7, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = color;
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2;
        const d = r * Math.pow(Math.random(), 0.75);
        const s = nozzle === 'splatter' ? rand(0.8, 3.6) : rand(0.4, 1.4);
        ctx.globalAlpha = rand(0.35, 0.9);
        ctx.beginPath();
        ctx.arc(x + Math.cos(a) * d, y + Math.sin(a) * d, s, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      const dripChance = nozzle === 'fat' ? 0.012 : nozzle === 'splatter' ? 0.02 : 0.003;
      if (Math.random() < dripChance && drips.length < 30) {
        drips.push({ x: x + rand(-r * 0.4, r * 0.4), y, len: 0, max: rand(20, 90), w: rand(1.4, 3), c: color });
        startDrips();
      }
    };
    const animDrips = () => {
      for (let i = drips.length - 1; i >= 0; i--) {
        const d = drips[i];
        const step = Math.max(0.3, (d.max - d.len) * 0.05);
        ctx.strokeStyle = d.c;
        ctx.lineWidth = d.w;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(d.x, d.y + d.len);
        ctx.lineTo(d.x, d.y + d.len + step);
        ctx.stroke();
        d.len += step;
        if (d.len >= d.max) {
          ctx.fillStyle = d.c;
          ctx.beginPath();
          ctx.arc(d.x, d.y + d.len, d.w * 0.9, 0, Math.PI * 2);
          ctx.fill();
          drips.splice(i, 1);
        }
      }
      if (drips.length) requestAnimationFrame(animDrips);
      else dripping = false;
    };
    // only animate while there are drips running down the wall
    let dripping = false;
    const startDrips = () => {
      if (dripping) return;
      dripping = true;
      requestAnimationFrame(animDrips);
    };

    let painting = false;
    let lx = 0;
    let ly = 0;
    const pos = (e) => {
      const r = canvas.getBoundingClientRect();
      return [e.clientX - r.left, e.clientY - r.top];
    };
    canvas.addEventListener('pointerdown', (e) => {
      painting = true;
      canvas.setPointerCapture(e.pointerId);
      [lx, ly] = pos(e);
      stamp(lx, ly);
      hint.classList.add('hide');
    });
    canvas.addEventListener('pointermove', (e) => {
      if (!painting) return;
      const [x, y] = pos(e);
      const dist = Math.hypot(x - lx, y - ly);
      const spacing = NOZ[nozzle].r * 0.35;
      const steps = Math.max(1, Math.floor(dist / spacing));
      for (let i = 1; i <= steps; i++) stamp(lx + ((x - lx) * i) / steps, ly + ((y - ly) * i) / steps);
      lx = x;
      ly = y;
    });
    const stop = () => { painting = false; };
    canvas.addEventListener('pointerup', stop);
    canvas.addEventListener('pointercancel', stop);

    const radio = (els, el) => els.forEach((b) => b.setAttribute('aria-checked', String(b === el)));
    const swatches = $$('.swatch');
    swatches.forEach((b) => b.addEventListener('click', () => {
      color = getComputedStyle(b).getPropertyValue('--c').trim();
      radio(swatches, b);
    }));
    const nozzles = $$('.nozzle');
    nozzles.forEach((b) => b.addEventListener('click', () => { nozzle = b.dataset.n; radio(nozzles, b); }));

    $('#tagClear').addEventListener('click', () => {
      drips.length = 0;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      hint.classList.remove('hide');
    });
    $('#tagSave').addEventListener('click', () => {
      const out = document.createElement('canvas');
      out.width = canvas.width;
      out.height = canvas.height;
      const o = out.getContext('2d');
      o.fillStyle = '#24272d';
      o.fillRect(0, 0, out.width, out.height);
      o.drawImage(canvas, 0, 0);
      o.font = `${22 * dpr}px "Permanent Marker", cursive`;
      o.fillStyle = 'rgba(244,241,234,.45)';
      o.fillText('wall by Naufal', 16 * dpr, out.height - 16 * dpr);
      const a = document.createElement('a');
      a.download = 'my-tag.png';
      a.href = out.toDataURL('image/png');
      a.click();
      showToast('Tag saved!');
    });
  }

  /* ---------- Year ---------- */
  const year = $('#year');
  if (year) year.textContent = new Date().getFullYear();
})();
