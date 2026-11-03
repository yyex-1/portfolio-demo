/**
 * sand.js — 沙砾粒子层（纯净版）
 * 背景：纯色，无任何图案；画面上只有细小沙粒随风流动
 *   · 三层景深，颗粒小而密
 *   · 鼠标经过推开沙粒并带起气流，点击迸起一撮沙
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
  var visible = true;
  var sprite = null, spriteKey = '';
  var mouse = { x: -1e4, y: -1e4, px: -1e4, py: -1e4, vx: 0, vy: 0, inside: false };

  function isDark() {
    return root.getAttribute('data-theme') === 'dark';
  }

  /* ---------- 柔光精灵（近景沙粒用） ---------- */
  function spriteImage() {
    var key = isDark() ? 'dark' : 'light';
    if (key === spriteKey) return sprite;

    var c = document.createElement('canvas');
    c.width = c.height = 48;
    var g2 = c.getContext('2d');
    var rgb = isDark() ? '240,244,249' : '58,62,70';
    var grad = g2.createRadialGradient(24, 24, 0, 24, 24, 24);
    grad.addColorStop(0, 'rgba(' + rgb + ',1)');
    grad.addColorStop(0.35, 'rgba(' + rgb + ',.62)');
    grad.addColorStop(1, 'rgba(' + rgb + ',0)');
    g2.fillStyle = grad;
    g2.fillRect(0, 0, 48, 48);

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
      size: 0.3 + depth * 1.0 + Math.random() * 0.35,
      alpha: (0.12 + Math.random() * 0.3) * (0.55 + depth * 0.95),
      phase: Math.random() * Math.PI * 2,
      twinkle: 0.35 + Math.random() * 0.9,
      soft: depth > 0.82
    };
  }

  function targetCount() {
    var cap = W < 760 ? 2800 : 4400;
    return Math.round(Math.min(cap, Math.max(1500, (W * H) / 480)));
  }

  function seed() {
    var total = targetCount();
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

  /* ---------- 物理步进 ---------- */
  function step() {
    var R = 150, R2 = R * R;

    for (var i = 0; i < grains.length; i++) {
      var g = grains[i];
      var f = flow(g.x, g.y);
      var speed = 0.22 + g.depth * 0.95;

      g.vx += (f[0] * speed - g.vx) * 0.035;
      g.vy += (f[1] * speed - g.vy) * 0.035;

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

      if (g.vx > 4.2) g.vx = 4.2; else if (g.vx < -4.2) g.vx = -4.2;
      if (g.vy > 4.2) g.vy = 4.2; else if (g.vy < -4.2) g.vy = -4.2;

      g.x += g.vx;
      g.y += g.vy;

      if (g.x < -20) { g.x = W + 20; g.y = Math.random() * H; }
      else if (g.x > W + 20) { g.x = -20; g.y = Math.random() * H; }
      if (g.y < -20) g.y = H + 20;
      else if (g.y > H + 20) g.y = -20;

      g.phase += 0.012 * g.twinkle;
    }

    mouse.vx *= 0.86;
    mouse.vy *= 0.86;
  }

  /* ---------- 绘制 ---------- */
  function paint() {
    ctx.clearRect(0, 0, W, H);

    var img = spriteImage();
    for (var i = 0; i < grains.length; i++) {
      var g = grains[i];
      var a = g.alpha * (0.76 + 0.24 * Math.sin(g.phase));
      if (g.soft) {
        var s = g.size * 2.6;
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
    requestAnimationFrame(loop);
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

    for (var i = 0; i < 46; i++) {
      var ang = Math.random() * Math.PI * 2;
      var spd = 0.5 + Math.random() * 3.2;
      var g = newGrain(x, y);
      g.depth = 0.5 + Math.random() * 0.5;
      g.size = 0.4 + g.depth * 1.2;
      g.alpha = 0.28 + Math.random() * 0.34;
      g.soft = Math.random() > 0.6;
      g.vx = Math.cos(ang) * spd;
      g.vy = Math.sin(ang) * spd - 0.3;
      grains.push(g);
    }
    if (grains.length > 5200) grains.splice(0, grains.length - 5200);
  }, { passive: true });

  document.addEventListener('visibilitychange', function () {
    visible = !document.hidden;
  });

  /* ---------- 启动 ---------- */
  resize();

  if (reduceMotion) {
    paint();
  } else {
    requestAnimationFrame(loop);
  }

  window.Sand = { repaint: paint };
})();
