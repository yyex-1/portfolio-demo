/**
 * sand.js — 沙砾粒子层（点彩云浪版）
 * 背景瓷白，画面上只有细沙：
 *   · 底层：高密度 stipple 云——两列大尺度波场决定浓淡，
 *     烘焙成离屏纹理后沿对角线缓慢滚动，像云浪滚过页面
 *   · 顶层：稀疏的活沙粒子，随风摆动、鼠标推开、点击迸沙
 * 明暗主题自动换色重烘焙；离开页面暂停；prefers-reduced-motion 只画一帧。
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
  var tex = null, texKey = '';
  var mouse = { x: -1e4, y: -1e4, px: -1e4, py: -1e4, vx: 0, vy: 0, inside: false, dwell: 0 };

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
    var rgb = isDark() ? '238,243,249' : '52,62,74';
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

  /* ---------- 活沙粒子 ---------- */
  function newGrain(x, y) {
    var depth = Math.pow(Math.random(), 1.7);
    return {
      x: x,
      y: y,
      vx: 0,
      vy: 0,
      depth: depth,
      size: 0.16 + depth * 0.62 + Math.random() * 0.22,
      alpha: (0.14 + Math.random() * 0.32) * (0.6 + depth * 0.9),
      phase: Math.random() * Math.PI * 2,
      twinkle: 0.35 + Math.random() * 0.9,
      bobF: 0.8 + Math.random() * 1.9,
      soft: depth > 0.82
    };
  }

  function targetCount() {
    var cap = W < 760 ? 4600 : 8000;
    return Math.round(Math.min(cap, Math.max(2600, (W * H) / 240)));
  }

  function seed() {
    var total = targetCount();
    grains.length = 0;
    for (var i = 0; i < total; i++) {
      grains.push(newGrain(Math.random() * W, Math.random() * H));
    }
  }

  /* ---------- 活沙风场：海浪式轨道流 ---------- */
  function flow(x, y) {
    var ph = x * 0.0042 + y * 0.0018 - time * 1.3;
    var ph2 = (x + y) * 0.0011 - time * 0.5;
    var fx = Math.cos(ph) * 0.55 + Math.cos(ph2) * 0.22 - 0.45;
    var fy = Math.sin(ph) * 0.5 + Math.sin(ph2) * 0.16;
    return [fx, fy];
  }

  /* ---------- 云浪纹理（烘焙一次，滚动播放） ----------
   * 周期化波场保证纹理可无缝平铺；
   * 点的疏密直接由波场决定 —— 浪峰浓、浪谷空。 */
  function fieldTile(u, v) {
    var s = Math.sin(2 * Math.PI * (2 * u + v)) * 0.58 +
            Math.sin(2 * Math.PI * (u - 2 * v) + 1.7) * 0.42;
    var f = s * 0.5 + 0.5;
    return f * f;
  }

  function bakeTexture() {
    var key = (isDark() ? 'd' : 'l') + 'x' + W + 'x' + H;
    if (tex && key === texKey) return tex;

    var c = document.createElement('canvas');
    c.width = Math.max(2, Math.round(W * DPR));
    c.height = Math.max(2, Math.round(H * DPR));
    var g2 = c.getContext('2d');
    g2.setTransform(DPR, 0, 0, DPR, 0, 0);

    var rgb = isDark() ? '236,241,247' : '47,56,66';
    var tries = Math.round((W * H) / 3.2);
    for (var i = 0; i < tries; i++) {
      var x = Math.random() * W;
      var y = Math.random() * H;
      var f = fieldTile(x / W, y / H);
      if (Math.random() > f * 1.05) continue;

      var d = Math.pow(Math.random(), 1.6);
      var s = 0.35 + d * 0.75 + f * 0.4;
      g2.globalAlpha = 0.08 + 0.4 * f * (0.5 + d * 0.5);
      g2.fillStyle = 'rgb(' + rgb + ')';
      g2.fillRect(x, y, s, s);
    }

    tex = c;
    texKey = key;
    return tex;
  }

  /* ---------- 物理步进（活沙 + 鼠标驻留穿透） ---------- */
  function step(dt) {
    var DWELL_MAX = 2.4;

    if (mouse.inside) {
      var moving = Math.abs(mouse.vx) + Math.abs(mouse.vy);
      if (moving < 1.4) mouse.dwell = Math.min(DWELL_MAX, mouse.dwell + dt / 1000);
      else mouse.dwell = Math.max(0, mouse.dwell - dt / 1000 * 4);
    } else {
      mouse.dwell = Math.max(0, mouse.dwell - dt / 1000 * 2.2);
    }

    var dwellN = mouse.dwell / DWELL_MAX;
    var R = 120 + dwellN * 150, R2 = R * R;
    var depthGate = 0.6 - dwellN * 0.6;
    var dwellBoost = 0.75 + dwellN * 0.45;

    for (var i = 0; i < grains.length; i++) {
      var g = grains[i];
      var f = flow(g.x, g.y);
      var speed = 0.4 + g.depth * 1.7;

      g.vx += (f[0] * speed - g.vx) * 0.055;
      g.vy += (f[1] * speed - g.vy) * 0.055;

      if (mouse.inside && g.depth >= depthGate) {
        var dx = g.x - mouse.x;
        var dy = g.y - mouse.y;
        var d2 = dx * dx + dy * dy;
        if (d2 < R2) {
          var d = Math.sqrt(d2) || 1;
          var k = 1 - d / R;
          k = k * k;
          var push = k * (0.5 + g.depth * 0.95) * dwellBoost;
          g.vx += (dx / d) * push;
          g.vy += (dy / d) * push;
          g.vx += mouse.vx * 0.055 * k;
          g.vy += mouse.vy * 0.055 * k;
        }
      }

      if (g.vx > 7) g.vx = 7; else if (g.vx < -7) g.vx = -7;
      if (g.vy > 7) g.vy = 7; else if (g.vy < -7) g.vy = -7;

      g.x += g.vx;
      g.y += g.vy + Math.sin(time * g.bobF + g.phase) * 0.16 * (0.4 + g.depth);

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

    /* 云浪：纹理沿对角线缓慢滚动，四份平铺无缝衔接 */
    var t = bakeTexture();
    var ox = (time * 13) % W;
    var oy = (time * 7.5) % H;
    ctx.globalAlpha = 0.92;
    ctx.drawImage(t, -ox, -oy, W, H);
    ctx.drawImage(t, W - ox, -oy, W, H);
    ctx.drawImage(t, -ox, H - oy, W, H);
    ctx.drawImage(t, W - ox, H - oy, W, H);

    /* 活沙：稀疏一层，跟随呼吸与鼠标 */
    var img = spriteImage();
    for (var i = 0; i < grains.length; i++) {
      var g = grains[i];
      var a = g.alpha * (0.76 + 0.24 * Math.sin(g.phase));
      if (g.soft) {
        var s = g.size * 2.6;
        ctx.globalAlpha = Math.min(0.6, a * 0.92);
        ctx.drawImage(img, g.x - s / 2, g.y - s / 2, s, s);
      } else {
        ctx.globalAlpha = Math.min(0.6, a);
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
    step(dt);
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
    texKey = '';
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
      g.size = 0.22 + g.depth * 0.8;
      g.alpha = 0.28 + Math.random() * 0.34;
      g.soft = Math.random() > 0.6;
      g.vx = Math.cos(ang) * spd;
      g.vy = Math.sin(ang) * spd - 0.3;
      grains.push(g);
    }
    if (grains.length > 10000) grains.splice(0, grains.length - 10000);
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
