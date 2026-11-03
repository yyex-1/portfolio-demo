/**
 * sand.js — 沙滩粒子层
 * 画布贴在细边框画框内，三层景深沙粒随风流动：
 *   · 风场：正弦叠加的缓慢涡流，整体向左漂移
 *   · 沙丘：底部两层起伏的沙丘 + 细沙纹，随时间轻微呼吸
 *   · 交互：鼠标经过把沙粒推开并带动气流，点击迸起一撮沙
 * 明暗主题自动换色；离开页面暂停；prefers-reduced-motion 只画一帧。
 */
(function () {
  'use strict';

  var canvas = document.getElementById('sand-canvas');
  if (!canvas) return;

  var ctx = canvas.getContext('2d', { alpha: true });
  var root = document.documentElement;
  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var DPR = Math.min(2, window.devicePixelRatio || 1);
  var W = 0, H = 0;
  var grains = [];
  var time = 0;
  var rafId = 0;
  var visible = true;
  var sprite = null, spriteKey = '';
  var mouse = { x: -1e4, y: -1e4, px: -1e4, py: -1e4, vx: 0, vy: 0, inside: false };

  function isDark() {
    return root.getAttribute('data-theme') === 'dark';
  }

  /* ---------- 柔光精灵（近景沙粒用，避免每帧建渐变） ---------- */
  function spriteImage() {
    var key = isDark() ? 'dark' : 'light';
    if (key === spriteKey) return sprite;

    var c = document.createElement('canvas');
    c.width = c.height = 64;
    var g2 = c.getContext('2d');
    var rgb = isDark() ? '255,246,229' : '94,85,66';
    var grad = g2.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, 'rgba(' + rgb + ',1)');
    grad.addColorStop(0.35, 'rgba(' + rgb + ',.62)');
    grad.addColorStop(1, 'rgba(' + rgb + ',0)');
    g2.fillStyle = grad;
    g2.fillRect(0, 0, 64, 64);

    sprite = c;
    spriteKey = key;
    return sprite;
  }

  /* ---------- 沙粒 ---------- */
  function newGrain(x, y) {
    var depth = Math.random();
    return {
      x: x,
      y: y,
      vx: 0,
      vy: 0,
      depth: depth,
      size: 0.55 + depth * 2.1 + Math.random() * 0.55,
      alpha: (0.07 + Math.random() * 0.2) * (0.5 + depth * 0.95),
      phase: Math.random() * Math.PI * 2,
      twinkle: 0.35 + Math.random() * 0.9,
      soft: depth > 0.74
    };
  }

  function seed() {
    var total = Math.round(Math.min(1900, Math.max(760, (W * H) / 1250)));
    grains.length = 0;
    for (var i = 0; i < total; i++) {
      grains.push(newGrain(Math.random() * W, Math.random() * H));
    }
  }

  /* ---------- 风场：正弦涡流 + 主风向 ---------- */
  function flow(x, y) {
    var fx = Math.sin(y * 0.0032 + time * 0.55) * 0.22 +
             Math.sin((x + y * 0.6) * 0.0015 - time * 0.32) * 0.14 -
             0.40;
    var fy = Math.cos(x * 0.0027 + time * 0.48) * 0.17 +
             Math.cos((x - y) * 0.0019 + time * 0.24) * 0.10;
    return [fx, fy];
  }

  function duneLine(x) {
    return H * 0.70 + Math.sin(x * 0.004 + time * 0.12) * H * 0.02;
  }

  /* ---------- 物理步进 ---------- */
  function step() {
    var R = 150, R2 = R * R;

    for (var i = 0; i < grains.length; i++) {
      var g = grains[i];
      var f = flow(g.x, g.y);
      var speed = 0.22 + g.depth * 0.95;

      // 缓动趋向风场，避免突变
      g.vx += (f[0] * speed - g.vx) * 0.035;
      g.vy += (f[1] * speed - g.vy) * 0.035;

      // 落到沙丘上就变慢、沉积
      if (g.y > duneLine(g.x)) {
        g.vx *= 0.962;
        g.vy *= 0.955;
      }

      // 鼠标把沙粒推开，并带起气流
      if (mouse.inside) {
        var dx = g.x - mouse.x;
        var dy = g.y - mouse.y;
        var d2 = dx * dx + dy * dy;
        if (d2 < R2) {
          var d = Math.sqrt(d2) || 1;
          var k = 1 - d / R;
          k = k * k;
          var push = k * (0.5 + g.depth * 0.95);
          g.vx += (dx / d) * push;
          g.vy += (dy / d) * push;
          g.vx += mouse.vx * 0.055 * k;
          g.vy += mouse.vy * 0.055 * k;
        }
      }

      // 速度上限
      if (g.vx > 4.2) g.vx = 4.2; else if (g.vx < -4.2) g.vx = -4.2;
      if (g.vy > 4.2) g.vy = 4.2; else if (g.vy < -4.2) g.vy = -4.2;

      g.x += g.vx;
      g.y += g.vy;

      // 环绕出界
      if (g.x < -30) { g.x = W + 30; g.y = Math.random() * H; }
      else if (g.x > W + 30) { g.x = -30; g.y = Math.random() * H; }
      if (g.y < -30) g.y = H + 30;
      else if (g.y > H + 30) g.y = -30;

      g.phase += 0.012 * g.twinkle;
    }

    mouse.vx *= 0.86;
    mouse.vy *= 0.86;
  }

  /* ---------- 沙丘与沙纹 ---------- */
  function dunePath(baseY, amp1, k1, amp2, k2, ph, speed) {
    ctx.beginPath();
    ctx.moveTo(-40, H + 4);
    for (var x = -40; x <= W + 40; x += 10) {
      var y = baseY +
        Math.sin(x * k1 + time * speed + ph) * amp1 +
        Math.sin(x * k2 - time * speed * 0.7 + ph * 1.7) * amp2;
      ctx.lineTo(x, y);
    }
    ctx.lineTo(W + 40, H + 4);
    ctx.closePath();
  }

  function drawDunes() {
    var dark = isDark();

    // 远沙丘
    dunePath(H * 0.66, H * 0.035, 0.0021, H * 0.012, 0.0068, 0.6, 0.08);
    var g1 = ctx.createLinearGradient(0, H * 0.58, 0, H);
    g1.addColorStop(0, dark ? 'rgba(255,246,226,0.008)' : 'rgba(124,112,90,0.028)');
    g1.addColorStop(1, dark ? 'rgba(255,246,226,0.042)' : 'rgba(124,112,90,0.072)');
    ctx.fillStyle = g1;
    ctx.fill();

    // 近沙丘
    dunePath(H * 0.78, H * 0.045, 0.0016, H * 0.016, 0.0052, 2.4, 0.055);
    var g2 = ctx.createLinearGradient(0, H * 0.68, 0, H);
    g2.addColorStop(0, dark ? 'rgba(255,246,226,0.006)' : 'rgba(124,112,90,0.022)');
    g2.addColorStop(1, dark ? 'rgba(255,246,226,0.062)' : 'rgba(124,112,90,0.105)');
    ctx.fillStyle = g2;
    ctx.fill();

    // 沙纹（风蚀纹路）
    ctx.lineWidth = 1;
    ctx.strokeStyle = dark ? 'rgba(255,246,226,0.032)' : 'rgba(108,96,76,0.052)';
    for (var i = 0; i < 5; i++) {
      var base = H * (0.795 + i * 0.036);
      ctx.beginPath();
      for (var x = -40; x <= W + 40; x += 14) {
        var y = base + Math.sin(x * 0.0045 + i * 0.9 + time * 0.05) * (H * 0.011 + i * 1.1);
        if (x === -40) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
  }

  /* ---------- 绘制 ---------- */
  function paint() {
    ctx.clearRect(0, 0, W, H);
    drawDunes();

    var img = spriteImage();
    for (var i = 0; i < grains.length; i++) {
      var g = grains[i];
      var a = g.alpha * (0.76 + 0.24 * Math.sin(g.phase));
      if (g.soft) {
        var s = g.size * 3.4;
        ctx.globalAlpha = a * 0.92;
        ctx.drawImage(img, g.x - s / 2, g.y - s / 2, s, s);
      } else {
        ctx.globalAlpha = a;
        ctx.fillRect(g.x, g.y, g.size, g.size);
      }
    }
    ctx.globalAlpha = 1;
  }

  /* ---------- 帧循环 ---------- */
  var last = 0;
  function loop(now) {
    rafId = requestAnimationFrame(loop);
    if (!visible) { last = now; return; }
    var dt = Math.min(48, (now - last) || 16);
    last = now;
    time += dt / 1000;
    step();
    paint();
  }

  /* ---------- 尺寸 ---------- */
  function resize() {
    var r = canvas.getBoundingClientRect();
    W = Math.max(1, Math.round(r.width));
    H = Math.max(1, Math.round(r.height));
    canvas.width = Math.round(W * DPR);
    canvas.height = Math.round(H * DPR);
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    seed();
    paint();
  }

  var rt = 0;
  window.addEventListener('resize', function () {
    clearTimeout(rt);
    rt = setTimeout(resize, 160);
  });

  /* ---------- 交互 ---------- */
  window.addEventListener('pointermove', function (e) {
    var r = canvas.getBoundingClientRect();
    var nx = e.clientX - r.left;
    var ny = e.clientY - r.top;

    if (mouse.px > -1e3) {
      mouse.vx += (nx - mouse.px) * 0.55;
      mouse.vy += (ny - mouse.py) * 0.55;
    }
    mouse.px = nx;
    mouse.py = ny;
    mouse.x = nx;
    mouse.y = ny;
    mouse.inside = nx > -80 && ny > -80 && nx < r.width + 80 && ny < r.height + 80;
  }, { passive: true });

  window.addEventListener('pointerleave', function () {
    mouse.inside = false;
    mouse.px = mouse.py = -1e4;
  }, { passive: true });

  window.addEventListener('pointerdown', function (e) {
    var r = canvas.getBoundingClientRect();
    var x = e.clientX - r.left;
    var y = e.clientY - r.top;
    if (x < -20 || y < -20 || x > r.width + 20 || y > r.height + 20) return;

    for (var i = 0; i < 34; i++) {
      var ang = Math.random() * Math.PI * 2;
      var spd = 0.5 + Math.random() * 3.2;
      var g = newGrain(x, y);
      g.depth = 0.5 + Math.random() * 0.5;
      g.size = 0.9 + g.depth * 2.3;
      g.alpha = 0.22 + Math.random() * 0.3;
      g.soft = Math.random() > 0.45;
      g.vx = Math.cos(ang) * spd;
      g.vy = Math.sin(ang) * spd - 0.3;
      grains.push(g);
    }
    if (grains.length > 2600) grains.splice(0, grains.length - 2600);
  }, { passive: true });

  document.addEventListener('visibilitychange', function () {
    visible = !document.hidden;
  });

  /* ---------- 启动 ---------- */
  resize();

  if (reduceMotion) {
    paint();
  } else {
    rafId = requestAnimationFrame(loop);
  }

  // 供调试/主题切换时手动重绘
  window.Sand = { repaint: paint };
})();
