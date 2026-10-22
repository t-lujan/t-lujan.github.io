(() => {
  'use strict';
  const doc = document.documentElement;
  doc.classList.add('js');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];

  /* ---------- theme ---------- */
  const themeBtn = $('.theme');
  const setTheme = (dark) => {
    doc.classList.toggle('dark', dark);
    doc.classList.toggle('light', !dark);
    themeBtn.setAttribute('aria-checked', String(dark));
    $('.theme-label').textContent = dark ? 'DARK' : 'LIGHT';
    $('meta[name="theme-color"]').setAttribute('content', dark ? '#28283F' : '#F4FBFA');
    try { localStorage.setItem('theme', dark ? 'dark' : 'light'); } catch (e) {}
    pong && pong.refreshColors();
  };
  themeBtn.addEventListener('click', () => setTheme(!doc.classList.contains('dark')));
  if (!doc.classList.contains('dark')) { themeBtn.setAttribute('aria-checked', 'false'); $('.theme-label').textContent = 'LIGHT'; $('meta[name="theme-color"]').setAttribute('content', '#F4FBFA'); }

  /* ---------- nav ---------- */
  const nav = $('.nav');
  const onScroll = () => nav.classList.toggle('scrolled', scrollY > 30);
  addEventListener('scroll', onScroll, { passive: true }); onScroll();
  const links = $$('.nav-links a');
  const secObs = new IntersectionObserver((es) => {
    es.forEach((e) => {
      if (e.isIntersecting) links.forEach((a) => {
        const on = a.getAttribute('href') === '#' + e.target.id;
        a.classList.toggle('active', on);
        on ? a.setAttribute('aria-current', 'true') : a.removeAttribute('aria-current');
      });
    });
  }, { rootMargin: '-45% 0px -50% 0px' });
  $$('section[id]').forEach((s) => secObs.observe(s));

  /* ---------- reveal + counters ---------- */
  const countUp = (el) => {
    const end = +el.dataset.count; if (reduce) { el.textContent = end; return; }
    const t0 = performance.now(), dur = 1200;
    const tick = (t) => { const p = Math.min(1, (t - t0) / dur); el.textContent = Math.round(end * (1 - Math.pow(1 - p, 3))); if (p < 1) requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
  };
  const revObs = new IntersectionObserver((es) => {
    es.forEach((e) => {
      if (!e.isIntersecting) return;
      e.target.classList.add('in');
      $$('[data-count]', e.target).forEach(countUp);
      revObs.unobserve(e.target);
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
  // stagger siblings
  $$('.reveal').forEach((el) => {
    const sibs = $$(':scope > .reveal', el.parentElement);
    el.style.setProperty('--d', (Math.min(sibs.indexOf(el), 5) * 0.08) + 's');
    revObs.observe(el);
  });

  /* ---------- card spotlight + tilt ---------- */
  if (!reduce && matchMedia('(hover: hover)').matches) {
    $$('[data-tilt]').forEach((card) => {
      card.addEventListener('pointermove', (e) => {
        const r = card.getBoundingClientRect();
        const x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
        card.style.setProperty('--mx', x * 100 + '%'); card.style.setProperty('--my', y * 100 + '%');
        card.style.transform = `perspective(1400px) rotateX(${(0.5 - y) * 2.2}deg) rotateY(${(x - 0.5) * 2.2}deg) translateY(-3px)`;
      });
      card.addEventListener('pointerleave', () => { card.style.transform = ''; });
    });
  }

  /* ---------- utilities ---------- */
  const toast = $('.toast'); let tt;
  const say = (m) => { toast.textContent = m; toast.classList.add('show'); clearTimeout(tt); tt = setTimeout(() => toast.classList.remove('show'), 2200); };
  $$('[data-copy]').forEach((b) => b.addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(b.dataset.copy); say('Email copied'); } catch (e) { say(b.dataset.copy); }
  }));
  $$('[data-print]').forEach((b) => b.addEventListener('click', () => print()));
  $$('[data-year]').forEach((e) => (e.textContent = new Date().getFullYear()));

  const form = $('#note');
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    let ok = true;
    $$('input,textarea', form).forEach((f) => { const bad = !f.checkValidity() || !f.value.trim(); f.setAttribute('aria-invalid', String(bad)); if (bad && ok) { f.focus(); ok = false; } });
    const status = $('.form-status', form);
    if (!ok) { status.textContent = 'Fill in all three fields.'; return; }
    const d = Object.fromEntries(new FormData(form));
    const body = `${d.message}\n\n${d.name}\n${d.email}`;
    location.href = `mailto:lujan.m.tyler@gmail.com?subject=${encodeURIComponent('Hello from ' + d.name)}&body=${encodeURIComponent(body)}`;
    status.textContent = 'Opening your email app…';
  });

  /* ---------- PONG ---------- */
  const pong = (() => {
    const hero = $('.hero'), cv = $('.court'), ctx = cv.getContext('2d');
    const scoreEls = { l: $('[data-score="l"]'), r: $('[data-score="r"]') };
    const hint = $('.hint');
    let W = 0, H = 0, dpr = 1, col = {}, running = false, visible = true, last = 0;
    const S = { l: 0, r: 0 };
    const P = { l: { y: 0, t: 0 }, r: { y: 0, t: 0 } };
    const ball = { x: 0, y: 0, vx: 0, vy: 0, r: 7 };
    let playing = false, trail = [], sparks = [], userUntil = 0, keys = { w: 0, s: 0 }, pH = 120, pW = 10, inset = 28, base = 520, serveAt = 0;

    function refreshColors() {
      const cs = getComputedStyle(doc);
      col = { fg: cs.getPropertyValue('--paddle').trim(), acc: cs.getPropertyValue('--accent').trim(), acc2: cs.getPropertyValue('--accent-2').trim(), line: cs.getPropertyValue('--line-2').trim() };
      if (!running) draw();
    }
    function size() {
      const r = hero.getBoundingClientRect(); dpr = Math.min(devicePixelRatio || 1, 2);
      W = r.width; H = r.height; cv.width = W * dpr; cv.height = H * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const small = W < 600;
      pH = small ? Math.max(96, Math.min(150, H * 0.17)) : Math.max(70, Math.min(140, H * 0.15));
      pW = small ? 9 : 10; inset = small ? 14 : 30;
      base = Math.max(320, Math.min(640, W * 0.42)); ball.r = W < 600 ? 5 : 7;
      if (!ball.vx) serve(Math.random() < 0.5 ? 1 : -1, true);
      P.l.y = Math.min(Math.max(P.l.y || H / 2, pH / 2), H - pH / 2); P.r.y = Math.min(Math.max(P.r.y || H / 2, pH / 2), H - pH / 2);
      if (!running) draw();
    }
    /* ---- match + easter egg: first to 5 while a human is playing wins confetti ---- */
    const WIN = 5;
    let matchLive = false, lastHuman = -1e9, celebrating = false;
    const humanNow = () => playing || keys.w || keys.s || performance.now() < userUntil;
    const showScore = () => { scoreEls.l.textContent = S.l; scoreEls.r.textContent = S.r; };
    const resetScore = () => { S.l = 0; S.r = 0; showScore(); };
    // Called whenever a human takes the paddle: a fresh match starts at 0:0 (attract-mode points never count).
    function humanTouch() {
      const now = performance.now();
      if (!matchLive || now - lastHuman > 15000) { matchLive = true; resetScore(); }
      lastHuman = now;
    }
    function point(side) {
      if (celebrating) return;
      const human = humanNow();
      if (matchLive && !human && performance.now() - lastHuman > 15000) { matchLive = false; resetScore(); }
      if (matchLive && !human) return;            // human stepped away mid-match: freeze the score
      S[side]++; showScore();
      if (matchLive && side === 'l' && S.l >= WIN) celebrate();
      else if (S.r >= WIN || S.l >= WIN) resetScore(); // computer won (or attract mode hit 5): reset quietly
    }
    function celebrate() {
      celebrating = true; serveAt = Infinity;
      const done = () => {
        celebrating = false; matchLive = false; userUntil = 0; keys.w = keys.s = 0; P.l.t = P.l.y;
        if (playing) setPlaying(false);
        resetScore(); serve(Math.random() < 0.5 ? 1 : -1);
      };
      tip.classList.add('gone'); trail = [];
      if (!reduce) say('You win.');
      if (reduce) flourish(done); else confetti(done);
    }
    function confetti(done) {
      const c = document.createElement('canvas'); c.className = 'confetti'; c.setAttribute('aria-hidden', 'true');
      document.body.appendChild(c);
      const g = c.getContext('2d'), d = Math.min(devicePixelRatio || 1, 2);
      const vw = document.documentElement.clientWidth, vh = innerHeight;
      c.width = vw * d; c.height = vh * d; g.scale(d, d);
      const colors = ['#28283F', '#FFFFFF', '#E1F5F3', '#B8E6E6', '#2C6A8C'];
      const n = Math.round(Math.min(220, Math.max(90, vw * 0.16)));
      const bits = Array.from({ length: n }, () => ({
        x: Math.random() * vw, y: -20 - Math.random() * vh * 0.6, w: 6 + Math.random() * 7, h: 8 + Math.random() * 10,
        vy: 140 + Math.random() * 220, vx: -40 + Math.random() * 80, rot: Math.random() * 6.3, vr: -6 + Math.random() * 12,
        sway: Math.random() * 6.3, sw: 1.5 + Math.random() * 2.5, c: colors[(Math.random() * colors.length) | 0], round: Math.random() < 0.25
      }));
      const DUR = 3000, t0 = performance.now(); let prev = t0;
      const frame = (t) => {
        const el = t - t0, dt = Math.min(0.05, (t - prev) / 1000); prev = t;
        g.clearRect(0, 0, vw, vh);
        g.globalAlpha = el > DUR - 700 ? Math.max(0, (DUR - el) / 700) : 1;
        for (const b of bits) {
          b.vy += 60 * dt; b.y += b.vy * dt; b.sway += b.sw * dt; b.x += (b.vx + Math.sin(b.sway) * 60) * dt; b.rot += b.vr * dt;
          if (b.y > vh + 30) continue;
          g.save(); g.translate(b.x, b.y); g.rotate(b.rot); g.fillStyle = b.c;
          if (b.c === '#28283F') { g.strokeStyle = 'rgba(184,230,230,.55)'; g.lineWidth = 1; }
          if (b.round) { g.beginPath(); g.arc(0, 0, b.w / 2, 0, 7); g.fill(); }
          else { const sx = Math.abs(Math.cos(b.rot * 1.3)) * b.w + 1; g.fillRect(-sx / 2, -b.h / 2, sx, b.h); if (b.c === '#28283F') g.strokeRect(-sx / 2, -b.h / 2, sx, b.h); }
          g.restore();
        }
        if (el < DUR) requestAnimationFrame(frame); else { c.remove(); done(); }
      };
      requestAnimationFrame(frame);
    }
    function flourish(done) {
      const f = document.createElement('div'); f.className = 'win-flourish mono'; f.setAttribute('aria-hidden', 'true');
      f.innerHTML = '<span>✦</span> You win. <span>✦</span>';
      document.body.appendChild(f);
      setTimeout(() => { f.remove(); done(); }, 2000);
    }

    function serve(dir, now) {
      ball.x = W / 2; ball.y = H * (0.3 + Math.random() * 0.4);
      const a = (Math.random() * 0.7 - 0.35);
      ball.vx = Math.cos(a) * base * dir; ball.vy = Math.sin(a) * base;
      trail = []; serveAt = now ? 0 : performance.now() + 700;
    }
    function burst(x, y, n, c) {
      for (let i = 0; i < n; i++) { const a = Math.random() * Math.PI * 2, s = 80 + Math.random() * 260; sparks.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 1, c }); }
    }
    function ai(p, isLeft, dt) {
      const coming = isLeft ? ball.vx < 0 : ball.vx > 0;
      const target = coming ? ball.y + Math.sin(performance.now() / 700 + (isLeft ? 0 : 2)) * pH * 0.28 : H / 2;
      const spd = (isLeft ? 520 : 470) * (W < 600 ? 0.8 : 1);
      p.y += Math.max(-spd * dt, Math.min(spd * dt, target - p.y));
    }
    function step(dt) {
      const now = performance.now(), user = now < userUntil;
      // left paddle
      if (keys.w || keys.s) { P.l.y += (keys.s - keys.w) * 640 * dt; userUntil = now + 4000; }
      else if (playing) P.l.y += (P.l.t - P.l.y) * Math.min(1, dt * 28);
      else if (user) P.l.y += (P.l.t - P.l.y) * Math.min(1, dt * 18);
      else ai(P.l, true, dt);
      ai(P.r, false, dt);
      for (const k of ['l', 'r']) P[k].y = Math.min(Math.max(P[k].y, pH / 2), H - pH / 2);
      if (now < serveAt) return;
      ball.x += ball.vx * dt; ball.y += ball.vy * dt;
      if (ball.y < ball.r) { ball.y = ball.r; ball.vy *= -1; }
      if (ball.y > H - ball.r) { ball.y = H - ball.r; ball.vy *= -1; }
      const hit = (p, x, dir) => {
        if (Math.abs(ball.y - p.y) <= pH / 2 + ball.r) {
          const off = (ball.y - p.y) / (pH / 2), sp = Math.min(Math.hypot(ball.vx, ball.vy) * 1.045, base * 2.1), a = off * 0.85;
          ball.vx = Math.cos(a) * sp * dir; ball.vy = Math.sin(a) * sp; ball.x = x;
          burst(x, ball.y, 14, dir > 0 ? col.acc : col.acc2); burst(x, ball.y, 6, col.fg); return true;
        }
        return false;
      };
      const lx = inset + pW + ball.r, rx = W - inset - pW - ball.r;
      if (ball.vx < 0 && ball.x <= lx && ball.x > lx - 24) hit(P.l, lx, 1);
      if (ball.vx > 0 && ball.x >= rx && ball.x < rx + 24) hit(P.r, rx, -1);
      if (ball.x < -40) { burst(0, ball.y, 30, col.fg); point('r'); serve(1); }
      if (ball.x > W + 40) { burst(W, ball.y, 30, col.acc); point('l'); serve(-1); }
      trail.push({ x: ball.x, y: ball.y }); if (trail.length > 18) trail.shift();
      sparks = sparks.filter((s) => (s.life -= dt * 1.6) > 0);
      sparks.forEach((s) => { s.x += s.vx * dt; s.y += s.vy * dt; s.vx *= 0.96; s.vy *= 0.96; });
    }
    function rr(x, y, w, h, r) { ctx.beginPath(); ctx.roundRect ? ctx.roundRect(x, y, w, h, r) : ctx.rect(x, y, w, h); ctx.fill(); }
    function draw() {
      ctx.clearRect(0, 0, W, H);
      ctx.strokeStyle = col.line; ctx.lineWidth = 1; ctx.setLineDash([6, 14]);
      ctx.beginPath(); ctx.moveTo(W / 2, 0); ctx.lineTo(W / 2, H); ctx.stroke(); ctx.setLineDash([]);
      if (!celebrating) trail.forEach((t, i) => { const k = i / trail.length; ctx.globalAlpha = k * 0.35; ctx.fillStyle = col.fg; ctx.beginPath(); ctx.arc(t.x, t.y, ball.r * k, 0, 7); ctx.fill(); });
      sparks.forEach((s) => { ctx.globalAlpha = s.life; ctx.fillStyle = s.c; ctx.fillRect(s.x, s.y, 2.5, 2.5); });
      ctx.globalAlpha = 1;
      ctx.shadowBlur = 24; ctx.shadowColor = col.acc; ctx.fillStyle = col.acc;
      rr(inset, P.l.y - pH / 2, pW, pH, pW / 2);
      ctx.shadowColor = col.fg; ctx.fillStyle = col.fg; ctx.shadowBlur = 16;
      rr(W - inset - pW, P.r.y - pH / 2, pW, pH, pW / 2);
      if (!celebrating) { ctx.beginPath(); ctx.arc(ball.x, ball.y, ball.r, 0, 7); ctx.fill(); }
      ctx.shadowBlur = 0;
    }
    function loop(t) {
      if (!running) return;
      const dt = Math.min(0.033, (t - (last || t)) / 1000); last = t;
      step(dt); draw(); requestAnimationFrame(loop);
    }
    function start() { if (running || (reduce && !playing) || !visible || document.hidden) return; running = true; last = 0; requestAnimationFrame(loop); }
    function stop() { running = false; }
    const engage = (y) => { if (celebrating) return; humanTouch(); P.l.t = y; userUntil = performance.now() + 4000; hint.classList.add('gone'); };
    // Mouse / pen: hover anywhere on the court (desktop behaviour unchanged). Touch outside play mode is ignored so the page scrolls.
    const relY = (e) => e.clientY - cv.getBoundingClientRect().top;
    hero.addEventListener('pointermove', (e) => { if (e.pointerType !== 'touch') engage(relY(e)); });
    hero.addEventListener('pointerdown', (e) => { if (e.pointerType !== 'touch') engage(relY(e)); });

    // Touch play mode: tap "Tap to play" -> the whole court captures touch, the paddle follows the finger's height.
    const layer = $('.play-layer', hero), btn = $('.play-btn', hero), tip = $('.play-tip', hero), txt = $('.play-txt', hero);
    const isTouch = matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0 || 'ontouchstart' in window;
    if (isTouch) { doc.classList.add('touch'); btn.hidden = false; }
    let activeId = null, lastToggle = 0;
    const setPlaying = (on) => {
      if (on === playing) return;
      playing = on; hero.classList.toggle('playing', on); doc.classList.toggle('pong-playing', on);
      btn.setAttribute('aria-pressed', String(on)); txt.textContent = on ? 'Done' : 'Tap to play';
      $('.play-ico', hero).textContent = on ? '✕' : '▶';
      tip.hidden = !on;
      if (on) {
        tip.classList.remove('gone'); P.l.t = P.l.y; userUntil = Infinity; matchLive = false; humanTouch();
        const top = hero.getBoundingClientRect().top + scrollY;
        if (Math.abs(scrollY - top) > 2) scrollTo({ top, behavior: reduce ? 'auto' : 'smooth' });
        start();
      } else { activeId = null; userUntil = 0; if (reduce) stop(); }
    };
    // Toggle on pointerup (fast, reliable on iOS) and on click (keyboard / fallback); ignore the click that follows a pointerup.
    const toggle = () => { const now = performance.now(); if (now - lastToggle < 450) return; lastToggle = now; setPlaying(!playing); };
    btn.addEventListener('pointerup', (e) => { if (e.pointerType !== 'mouse') toggle(); });
    btn.addEventListener('click', toggle);
    layer.addEventListener('pointerdown', (e) => {
      if (!playing || e.target.closest('.play-btn')) return;
      e.preventDefault(); activeId = e.pointerId;
      try { layer.setPointerCapture(e.pointerId); } catch (_) {}
      P.l.t = relY(e); tip.classList.add('gone'); lastHuman = performance.now();
    });
    layer.addEventListener('pointermove', (e) => { if (playing && e.pointerId === activeId) { e.preventDefault(); P.l.t = relY(e); } });
    const release = (e) => { if (e.pointerId === activeId) activeId = null; };
    layer.addEventListener('pointerup', release); layer.addEventListener('pointercancel', release);
    // iOS Safari: block scroll/zoom only for touches on the play surface while playing, and track the finger
    // with touch events too (older iOS or in-app browsers that deliver pointer events late).
    const touchY = (e) => { const t = e.touches[0] || e.changedTouches[0]; return t ? t.clientY - cv.getBoundingClientRect().top : null; };
    ['touchstart', 'touchmove'].forEach((type) => layer.addEventListener(type, (e) => {
      if (!playing || e.target.closest('.play-btn')) return;
      e.preventDefault();
      const y = touchY(e); if (y != null) { P.l.t = y; tip.classList.add('gone'); }
    }, { passive: false }));
    addEventListener('keydown', (e) => { if (e.key === 'Escape' && playing) setPlaying(false); });
    addEventListener('keydown', (e) => {
      const k = e.key.toLowerCase(); if ((k === 'w' || k === 's') && !e.target.closest('input,textarea') && visible) { if (!celebrating) { humanTouch(); keys[k] = 1; } hint.classList.add('gone'); }
    });
    addEventListener('keyup', (e) => { const k = e.key.toLowerCase(); if (k === 'w' || k === 's') keys[k] = 0; });
    new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (!visible) setPlaying(false); visible ? start() : stop(); }).observe(hero);
    document.addEventListener('visibilitychange', () => (document.hidden ? stop() : start()));
    new ResizeObserver(size).observe(hero);
    refreshColors(); size(); start();
    if (/[?&]pongtest\b/.test(location.search)) window.__pong = { point, score: () => ({ ...S }), human: humanNow, playing: () => playing, celebrating: () => celebrating, engage: () => engage(H / 2) };
    return { refreshColors };
  })();
})();
