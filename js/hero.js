/**
 * hero.js — 开场屏 v2（华丽版）
 * 视觉层次（从下到上）：
 *   1. CSS 极光光斑（.aurora-*）—— 深海青、靛蓝、紫罗兰三团弥散光
 *   2. canvas 竖向流光 + 三层星尘 + 粒子星座
 *   3. 鼠标光晕（加法混合）、点击冲击波
 *   4. 大标题（随机口号，逐字浮现，每 9 秒轮换）
 * 性能：sprite 预渲染、加法混合替代 shadowBlur、离屏/后台停帧
 */
(function () {
  'use strict';

  var hero = document.getElementById('hero');
  var canvas = document.getElementById('hero-canvas');
  if (!hero || !canvas) return;
  var ctx = canvas.getContext('2d');

  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ================= 口号池：每次刷新随机一句，之后每 9 秒轮换 ================= */
  var SLOGANS = [
    '洪波涌起',   // 曹操《观沧海》
    '星汉灿烂',   // 曹操《观沧海》
    '日月之行',   // 曹操《观沧海》
    '心游万仞',   // 陆机《文赋》
    '以码为楫',   // 自拟：以代码为舟桨
    '落笔成章',
    '行远自迩',   // 《礼记》
    '乘风破浪',   // 《宋书·宗悫传》
    '万象归真',
    '灯火可亲'
  ];
  var sloganIdx = Math.floor(Math.random() * SLOGANS.length);
  var ROTATE_MS = 9000;

  var titleEl = document.getElementById('hero-title');
  var titleTimer = null;

  function paintTitle(text, animate) {
    if (!titleEl) return;
    titleEl.setAttribute('aria-label', text);
    titleEl.innerHTML = text.split('').map(function (ch, i) {
      return '<span class="ch" style="transition-delay:' + (i * 90) + 'ms">' + ch + '</span>';
    }).join('');
    if (animate) {
      requestAnimationFrame(function () {
        requestAnimationFrame(function () { titleEl.classList.add('in'); });
      });
    } else {
      titleEl.classList.add('in');
    }
  }

  function nextTitle() {
    if (!titleEl) return;
    titleEl.classList.remove('in');
    titleEl.classList.add('is-out');
    setTimeout(function () {
      sloganIdx = (sloganIdx + 1) % SLOGANS.length;
      titleEl.classList.remove('is-out');
      paintTitle(SLOGANS[sloganIdx], true);
    }, 420);
  }

  function startRotation() {
    if (reduced) return;
    if (titleTimer) clearInterval(titleTimer);
    titleTimer = setInterval(nextTitle, ROTATE_MS);
  }

  /* ================= 文字内容（来自 Store） ================= */
  try {
    var info = window.Store && window.Store.getSiteInfo();
    if (info) {
      var nameEl = document.getElementById('hero-name');
      var roleEl = document.getElementById('hero-role');
      var linksEl = document.getElementById('hero-links');
      if (nameEl && info.name) nameEl.textContent = info.name;
      if (roleEl && info.slogan) roleEl.textContent = info.slogan;
      if (linksEl) {
        var html = '';
        if (info.github) html += '<a href="' + info.github + '" target="_blank" rel="noopener noreferrer">GitHub</a>';
        if (info.email) html += '<a href="mailto:' + info.email + '">Email</a>';
        (info.social || []).forEach(function (s) {
          html += '<a href="' + s.url + '" target="_blank" rel="noopener noreferrer">' + s.label + '</a>';
        });
        linksEl.innerHTML = html;
      }
    }
  } catch (e) { /* Store 未就绪时用占位 */ }

  paintTitle(SLOGANS[sloganIdx], true);

  /* ================= 画布基础 ================= */
  var dpr = Math.min(window.devicePixelRatio || 1, 2);
  var W = 0, H = 0;

  // 预渲染发光点（避免每帧创建渐变）
  function makeGlowSprite(rgb) {
    var size = 64, c = document.createElement('canvas');
    c.width = c.height = size;
    var g = c.getContext('2d');
    var grad = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    grad.addColorStop(0, 'rgba(' + rgb + ',1)');
    grad.addColorStop(0.25, 'rgba(' + rgb + ',0.45)');
    grad.addColorStop(1, 'rgba(' + rgb + ',0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, size, size);
    return c;
  }
  var SPRITE_TEAL = makeGlowSprite('100,255,218');
  var SPRITE_BLUE = makeGlowSprite('140,190,255');
  var SPRITE_VIOLET = makeGlowSprite('170,150,255');

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = hero.clientWidth;
    H = hero.clientHeight;
    canvas.width = Math.floor(W * dpr);
    canvas.height = Math.floor(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    initStreaks();
    initParticles();
  }

  /* ================= 竖向流光 ================= */
  var streaks = [];
  function initStreaks() {
    streaks = [];
    var count = Math.min(58, Math.max(20, Math.round(W / 46)));
    for (var i = 0; i < count; i++) {
      var r = Math.random();
      streaks.push({
        x: Math.random() * W,
        y: Math.random() * H,
        len: 110 + Math.random() * 300,
        speed: 12 + Math.random() * 46,
        width: r < 0.7 ? 1 : r < 0.94 ? 2 : 3,
        alpha: 0.05 + Math.random() * 0.16,
        tint: r < 0.24 ? '100,255,218' : r < 0.7 ? '140,190,255' : '170,150,255',
        sway: Math.random() * Math.PI * 2,
        swaySpeed: 0.2 + Math.random() * 0.5
      });
    }
  }

  function drawStreaks(dt, t) {
    for (var i = 0; i < streaks.length; i++) {
      var s = streaks[i];
      s.y += s.speed * dt;
      if (s.y - s.len > H) { s.y = -30; s.x = Math.random() * W; }
      var x = s.x + Math.sin(t * s.swaySpeed + s.sway) * 6;   // 轻微摆动
      var g = ctx.createLinearGradient(x, s.y - s.len, x, s.y);
      g.addColorStop(0, 'rgba(' + s.tint + ',0)');
      g.addColorStop(0.5, 'rgba(' + s.tint + ',' + s.alpha + ')');
      g.addColorStop(0.85, 'rgba(' + s.tint + ',' + (s.alpha * 1.5) + ')');
      g.addColorStop(1, 'rgba(' + s.tint + ',0)');
      ctx.fillStyle = g;
      ctx.fillRect(x - s.width / 2, s.y - s.len, s.width, s.len);
    }
  }

  /* ================= 星尘 / 粒子星座 ================= */
  var particles = [];
  var LINK_DIST = 104;
  var MOUSE_DIST = 170;

  function initParticles() {
    particles = [];
    var count = Math.min(120, Math.max(46, Math.round(W * H / 19000)));
    for (var i = 0; i < count; i++) {
      var z = 0.4 + Math.random() * 0.6;   // 景深
      particles.push({
        x: Math.random() * W,
        y: Math.random() * H,
        vx: (Math.random() - 0.5) * 9 * z,
        vy: (Math.random() - 0.5) * 9 * z,
        r: (0.7 + Math.random() * 1.6) * z,
        z: z,
        tw: Math.random() * Math.PI * 2,     // 闪烁相位
        tws: 0.6 + Math.random() * 1.8,      // 闪烁速度
        sprite: Math.random() < 0.55 ? SPRITE_TEAL : Math.random() < 0.6 ? SPRITE_BLUE : SPRITE_VIOLET,
        life: 1
      });
    }
  }

  var mouse = { x: -9999, y: -9999, sx: -9999, sy: -9999, inside: false };

  function updateParticles(dt, t) {
    for (var i = particles.length - 1; i >= 0; i--) {
      var p = particles[i];
      if (mouse.inside) {
        var dx = mouse.x - p.x, dy = mouse.y - p.y;
        var d2 = dx * dx + dy * dy;
        if (d2 < MOUSE_DIST * MOUSE_DIST && d2 > 1) {
          var d = Math.sqrt(d2);
          var pull = (1 - d / MOUSE_DIST) * 26;
          p.vx += (dx / d) * pull * dt;
          p.vy += (dy / d) * pull * dt;
        }
      }
      p.vx *= 0.986; p.vy *= 0.986;
      p.x += p.vx * dt; p.y += p.vy * dt;
      if (p.x < -12) p.x = W + 12; else if (p.x > W + 12) p.x = -12;
      if (p.y < -12) p.y = H + 12; else if (p.y > H + 12) p.y = -12;
      if (p.life < 1) {
        p.life -= dt * 0.85;
        if (p.life <= 0) { particles.splice(i, 1); continue; }
      }
    }
  }

  function drawParticles(t) {
    // 连线（先画，避免压住亮点）
    for (var i = 0; i < particles.length; i++) {
      var a = particles[i];
      if (mouse.inside) {
        var mdx = a.x - mouse.x, mdy = a.y - mouse.y;
        var md2 = mdx * mdx + mdy * mdy;
        if (md2 < MOUSE_DIST * MOUSE_DIST) {
          var md = Math.sqrt(md2);
          ctx.strokeStyle = 'rgba(100,255,218,' + (0.34 * (1 - md / MOUSE_DIST) * a.life) + ')';
          ctx.lineWidth = 0.8 + 0.8 * (1 - md / MOUSE_DIST);
          ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(mouse.x, mouse.y); ctx.stroke();
        }
      }
      for (var j = i + 1; j < particles.length; j++) {
        var b = particles[j];
        var dx = a.x - b.x, dy = a.y - b.y;
        var d2 = dx * dx + dy * dy;
        if (d2 < LINK_DIST * LINK_DIST) {
          var d = Math.sqrt(d2);
          ctx.strokeStyle = 'rgba(140,185,255,' + (0.15 * (1 - d / LINK_DIST) * Math.min(a.life, b.life)) + ')';
          ctx.lineWidth = 0.6;
          ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
        }
      }
    }

    // 发光点（加法混合）
    ctx.globalCompositeOperation = 'lighter';
    for (var k = 0; k < particles.length; k++) {
      var q = particles[k];
      var twinkle = 0.55 + 0.45 * Math.sin(t * q.tws + q.tw);
      var alpha = twinkle * q.life;
      var size = q.r * 9;
      ctx.globalAlpha = alpha;
      ctx.drawImage(q.sprite, q.x - size / 2, q.y - size / 2, size, size);
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }

  /* ================= 鼠标光晕 ================= */
  function drawMouseOrb() {
    if (!mouse.inside) return;
    var r = 190;
    var g = ctx.createRadialGradient(mouse.sx, mouse.sy, 0, mouse.sx, mouse.sy, r);
    g.addColorStop(0, 'rgba(100,255,218,0.10)');
    g.addColorStop(0.45, 'rgba(90,180,220,0.05)');
    g.addColorStop(1, 'rgba(90,180,220,0)');
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(mouse.sx, mouse.sy, r, 0, Math.PI * 2); ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
  }

  /* ================= 点击冲击波 ================= */
  var waves = [];
  hero.addEventListener('click', function (e) {
    if (reduced) return;
    if (e.target.closest('a')) return;
    var rect = hero.getBoundingClientRect();
    var x = e.clientX - rect.left, y = e.clientY - rect.top;
    waves.push({ x: x, y: y, born: performance.now() });
    if (waves.length > 4) waves.shift();
    // 迸发粒子
    for (var i = 0; i < 22; i++) {
      var ang = Math.random() * Math.PI * 2;
      var sp = 50 + Math.random() * 170;
      particles.push({
        x: x, y: y,
        vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp,
        r: 0.9 + Math.random() * 1.8,
        z: 1, tw: Math.random() * 6.28, tws: 2,
        sprite: Math.random() < 0.7 ? SPRITE_TEAL : SPRITE_VIOLET,
        life: 1
      });
    }
    if (particles.length > 240) particles.splice(0, particles.length - 240);
    schedule();
  });

  function drawWaves(now) {
    for (var i = waves.length - 1; i >= 0; i--) {
      var w = waves[i];
      var life = 1100;
      var t = (now - w.born) / life;
      if (t >= 1) { waves.splice(i, 1); continue; }
      ctx.globalCompositeOperation = 'lighter';
      for (var k = 0; k < 2; k++) {
        var tt = Math.max(0, t - k * 0.12);
        if (tt <= 0) continue;
        ctx.strokeStyle = 'rgba(100,255,218,' + (0.5 * (1 - tt) * (1 - k * 0.5)) + ')';
        ctx.lineWidth = 2 - k * 0.8;
        ctx.beginPath();
        ctx.arc(w.x, w.y, 8 + tt * 180, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.globalCompositeOperation = 'source-over';
    }
  }

  /* ================= 交互 ================= */
  var inner = hero.querySelector('.hero-inner');
  hero.addEventListener('mousemove', function (e) {
    var rect = hero.getBoundingClientRect();
    mouse.x = e.clientX - rect.left;
    mouse.y = e.clientY - rect.top;
    if (!mouse.inside) { mouse.sx = mouse.x; mouse.sy = mouse.y; }
    mouse.inside = true;
    schedule();
  }, { passive: true });

  hero.addEventListener('mouseleave', function () {
    mouse.inside = false;
    mouse.x = mouse.y = -9999;
    if (inner) inner.style.transform = '';
    schedule();
  });

  function parallax() {
    if (!inner || !mouse.inside) return;
    var px = mouse.x / W - 0.5, py = mouse.y / H - 0.5;
    inner.style.transform = 'translate3d(' + (px * -18).toFixed(1) + 'px,' + (py * -12).toFixed(1) + 'px,0)';
  }

  /* ================= 主循环 ================= */
  var running = false, visible = true, scheduled = false, lastT = 0, elapsed = 0;

  function tick(now) {
    scheduled = false;
    if (!running) return;
    var dt = Math.min(0.05, (now - lastT) / 1000 || 0.016);
    lastT = now;
    elapsed += dt;

    ctx.clearRect(0, 0, W, H);
    drawStreaks(dt, elapsed);
    updateParticles(dt, elapsed);
    drawParticles(elapsed);
    drawMouseOrb();
    drawWaves(now);
    parallax();

    if (mouse.inside) {
      mouse.sx += (mouse.x - mouse.sx) * 0.18;
      mouse.sy += (mouse.y - mouse.sy) * 0.18;
    }
    schedule();
  }
  function schedule() {
    if (scheduled || !running) return;
    scheduled = true;
    requestAnimationFrame(tick);
  }
  function setRunning(on) {
    if (on && !running) {
      running = true;
      lastT = performance.now();
      schedule();
      startRotation();
    } else if (!on) {
      running = false;
      if (titleTimer) { clearInterval(titleTimer); titleTimer = null; }
    }
  }

  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (entries) {
      visible = entries[0].isIntersecting;
      setRunning(visible && !document.hidden);
    }, { threshold: 0.02 }).observe(hero);
  }
  document.addEventListener('visibilitychange', function () {
    setRunning(visible && !document.hidden);
  });
  window.addEventListener('resize', resize);

  /* ================= 启动 ================= */
  resize();
  if (reduced) {
    ctx.clearRect(0, 0, W, H);
    drawStreaks(0, 0);
    drawParticles(0);
  } else {
    setRunning(true);
  }
})();
