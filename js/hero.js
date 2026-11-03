/**
 * hero.js — 开场屏（原创实现，灵感来自电影感 hero 的通用手法）
 * 结构：全屏 hero 区块，内含
 *  - 背景画布 #hero-canvas：竖向流光（缓慢下坠的光柱）+ 粒子星座
 *  - 粒子交互：鼠标靠近时被吸引、彼此连线；点击迸发一圈新粒子
 *  - 标题视差：鼠标移动时内容层轻微反向偏移
 *  - 标题逐字浮现、名字/头衔/链接错峰淡入
 * 性能：hero 离开视口或页面隐藏时自动停帧；尊重 prefers-reduced-motion
 */
(function () {
  'use strict';

  var hero = document.getElementById('hero');
  var canvas = document.getElementById('hero-canvas');
  if (!hero || !canvas) return;
  var ctx = canvas.getContext('2d');

  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ---- 填充文字内容（与 Store 数据保持一致）----
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
  } catch (e) { /* Store 未就绪时保持占位 */ }

  // ---- 标题逐字浮现 ----
  var title = document.getElementById('hero-title');
  if (title) {
    var text = title.textContent.trim();
    title.setAttribute('aria-label', text);
    title.innerHTML = text.split('').map(function (ch, i) {
      return '<span class="ch" style="transition-delay:' + (i * 110) + 'ms">' + ch + '</span>';
    }).join('');
    // 首帧渲染后再触发，保证 transition 生效
    requestAnimationFrame(function () {
      requestAnimationFrame(function () { title.classList.add('in'); });
    });
  }

  // ---- 画布尺寸 ----
  var dpr = Math.min(window.devicePixelRatio || 1, 2);
  var W = 0, H = 0;
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

  // ---- 竖向流光 ----
  var streaks = [];
  function initStreaks() {
    streaks = [];
    var count = Math.min(52, Math.max(18, Math.round(W / 52)));
    for (var i = 0; i < count; i++) {
      streaks.push({
        x: Math.random() * W,
        y: Math.random() * H,
        len: 90 + Math.random() * 220,          // 光柱长度
        speed: 10 + Math.random() * 34,         // px/s，缓慢下坠
        width: Math.random() < 0.82 ? 1 : 2,
        alpha: 0.04 + Math.random() * 0.13,
        accent: Math.random() < 0.18            // 少量薄荷绿流光
      });
    }
  }

  function drawStreaks(dt) {
    for (var i = 0; i < streaks.length; i++) {
      var s = streaks[i];
      s.y += s.speed * dt;
      if (s.y - s.len > H) { s.y = -20; s.x = Math.random() * W; }
      var g = ctx.createLinearGradient(s.x, s.y - s.len, s.x, s.y);
      var rgb = s.accent ? '100,255,218' : '146,180,222';
      var a = s.accent ? s.alpha * 0.7 : s.alpha;
      g.addColorStop(0, 'rgba(' + rgb + ',0)');
      g.addColorStop(0.55, 'rgba(' + rgb + ',' + a + ')');
      g.addColorStop(1, 'rgba(' + rgb + ',0)');
      ctx.fillStyle = g;
      ctx.fillRect(s.x - s.width / 2, s.y - s.len, s.width, s.len);
    }
  }

  // ---- 粒子星座 ----
  var particles = [];
  var LINK_DIST = 96;        // 粒子间连线距离
  var MOUSE_DIST = 150;      // 与鼠标连线/吸引距离
  function initParticles() {
    particles = [];
    var count = Math.min(96, Math.max(36, Math.round(W * H / 24000)));
    for (var i = 0; i < count; i++) {
      particles.push({
        x: Math.random() * W,
        y: Math.random() * H,
        vx: (Math.random() - 0.5) * 8,
        vy: (Math.random() - 0.5) * 8,
        r: 0.8 + Math.random() * 1.4,
        life: 1                       // 点击迸发的粒子带生命周期，常规粒子恒为 1
      });
    }
  }

  var mouse = { x: -9999, y: -9999, inside: false };

  function updateParticles(dt) {
    for (var i = particles.length - 1; i >= 0; i--) {
      var p = particles[i];
      // 鼠标吸引（温和，仅在半径内）
      if (mouse.inside) {
        var dx = mouse.x - p.x, dy = mouse.y - p.y;
        var d2 = dx * dx + dy * dy;
        if (d2 < MOUSE_DIST * MOUSE_DIST && d2 > 1) {
          var d = Math.sqrt(d2);
          p.vx += (dx / d) * 14 * dt;
          p.vy += (dy / d) * 14 * dt;
        }
      }
      // 阻尼 + 移动
      p.vx *= 0.985; p.vy *= 0.985;
      p.x += p.vx * dt; p.y += p.vy * dt;
      // 边界环绕
      if (p.x < -10) p.x = W + 10; else if (p.x > W + 10) p.x = -10;
      if (p.y < -10) p.y = H + 10; else if (p.y > H + 10) p.y = -10;
      // 生命周期（迸发粒子）
      if (p.life < 1) {
        p.life -= dt * 0.9;
        if (p.life <= 0) { particles.splice(i, 1); continue; }
      }
    }
  }

  function drawParticles() {
    // 连线
    ctx.lineWidth = 1;
    for (var i = 0; i < particles.length; i++) {
      var a = particles[i];
      // 粒子—鼠标连线
      if (mouse.inside) {
        var mdx = a.x - mouse.x, mdy = a.y - mouse.y;
        var md2 = mdx * mdx + mdy * mdy;
        if (md2 < MOUSE_DIST * MOUSE_DIST) {
          var md = Math.sqrt(md2);
          ctx.strokeStyle = 'rgba(100,255,218,' + (0.30 * (1 - md / MOUSE_DIST) * a.life) + ')';
          ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(mouse.x, mouse.y); ctx.stroke();
        }
      }
      // 粒子—粒子连线
      for (var j = i + 1; j < particles.length; j++) {
        var b = particles[j];
        var dx = a.x - b.x, dy = a.y - b.y;
        var d2 = dx * dx + dy * dy;
        if (d2 < LINK_DIST * LINK_DIST) {
          var d = Math.sqrt(d2);
          ctx.strokeStyle = 'rgba(125,180,230,' + (0.16 * (1 - d / LINK_DIST) * Math.min(a.life, b.life)) + ')';
          ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
        }
      }
    }
    // 点
    for (var k = 0; k < particles.length; k++) {
      var q = particles[k];
      ctx.fillStyle = 'rgba(160,205,240,' + (0.55 * q.life) + ')';
      ctx.beginPath(); ctx.arc(q.x, q.y, q.r, 0, Math.PI * 2); ctx.fill();
    }
  }

  // ---- 点击迸发 ----
  hero.addEventListener('click', function (e) {
    if (reduced) return;
    if (e.target.closest('a')) return;   // 链接点击不触发
    var rect = hero.getBoundingClientRect();
    var x = e.clientX - rect.left, y = e.clientY - rect.top;
    for (var i = 0; i < 14; i++) {
      var ang = Math.random() * Math.PI * 2;
      var sp = 40 + Math.random() * 120;
      particles.push({
        x: x, y: y,
        vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp,
        r: 0.8 + Math.random() * 1.6,
        life: 0.99
      });
    }
    if (particles.length > 200) particles.splice(0, particles.length - 200);
    schedule();
  });

  // ---- 鼠标视差（内容层轻微偏移）----
  var inner = hero.querySelector('.hero-inner');
  hero.addEventListener('mousemove', function (e) {
    var rect = hero.getBoundingClientRect();
    mouse.x = e.clientX - rect.left;
    mouse.y = e.clientY - rect.top;
    mouse.inside = true;
    schedule();
  }, { passive: true });
  hero.addEventListener('mouseleave', function () {
    mouse.inside = false; mouse.x = -9999; mouse.y = -9999;
    if (inner) inner.style.transform = '';
    schedule();
  });

  function parallax() {
    if (!inner || !mouse.inside) return;
    var px = mouse.x / W - 0.5, py = mouse.y / H - 0.5;
    inner.style.transform = 'translate3d(' + (px * -16).toFixed(1) + 'px,' + (py * -10).toFixed(1) + 'px,0)';
  }

  // ---- 主循环（可见才跑）----
  var running = false, visible = true, scheduled = false, lastT = 0;

  function tick(now) {
    scheduled = false;
    if (!running) return;
    var dt = Math.min(0.05, (now - lastT) / 1000 || 0.016);
    lastT = now;
    ctx.clearRect(0, 0, W, H);
    drawStreaks(dt);
    updateParticles(dt);
    drawParticles();
    parallax();
    schedule();
  }
  function schedule() {
    if (scheduled || !running) return;
    scheduled = true;
    requestAnimationFrame(tick);
  }
  function setRunning(on) {
    if (on && !running) {
      running = true; lastT = performance.now(); schedule();
    } else if (!on) { running = false; }
  }

  // hero 滚出视口即停帧
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

  // ---- 启动 ----
  resize();
  if (reduced) {
    // 静态一帧，不做动画
    ctx.clearRect(0, 0, W, H);
    drawStreaks(0); drawParticles();
  } else {
    setRunning(true);
  }
})();
