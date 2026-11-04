/**
 * sand.js — 沙砾粒子层（沙丘起伏版）
 * 背景瓷白，画面上只有细沙，分三层：
 *   · 远景沙丘：多倍频噪声 + 域扭曲生成有机沙丘群，等高带勾出沙脊，
 *     烘焙为 1.6 倍画布的无缝纹理，缓慢滚动 —— 有起伏、不重复
 *   · 中层浮沙：细粒随风摆动、鼠标驻留穿透、点击迸沙
 *   · 近景粗沙：大颗粒、高对比、随鼠标视差，看得到"沙"本身
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
  var W = 0, H = 0, TW = 0, TH = 0;
  var grains = [];
  var near = [];
  var time = 0;
  var visible = true;
  var sprite = null, spriteKey = '';
  var tex = null, texKey = '';
  var mouse = { x: -1e4, y: -1e4, px: -1e4, py: -1e4, vx: 0, vy: 0, inside: false, dwell: 0 };

  var TEX_SCALE = 1.6;   // 纹理比视口大，图案不在每屏重复

  /* 背景：单层纹理，极慢漂移（原速的 1/10）；
   * 方向按“事件”突然跳变（隔几秒换一个方向），
   * 转向本身用低通缓动 → 走弧线、有黏滞感；
   * 每次换向时速度先掉下来再慢慢加上去 → 有加减速的过程 */
  var BG_SPEED = 0.23;              // 原本 2.3 的十分之一
  var bg = {
    ox: 0, oy: 0, vx: 0, vy: 0,
    ang: -2.35, tAng: -2.35,
    ramp: 1, nextTurn: 2
  };
  var dtCache = 16;

  function advanceBackground(dt) {
    var k = dt / 16.7;
    var sec = dt / 1000;

    /* 换向倒计时到了 → 目标方向突然跳一个随机大角度，速度归零重新加速 */
    bg.nextTurn -= sec;
    if (bg.nextTurn <= 0) {
      var jump = (Math.random() < 0.5 ? -1 : 1) * Math.PI * (0.25 + Math.random() * 0.55);
      bg.tAng += jump;
      bg.ramp = 0;
      bg.nextTurn = 2;
    }

    /* 加速过程：0 → 1 用约 1.15 秒（2s 换一次向，留一段满速巡航），
     * smoothstep 收尾所以尾段是减速 */
    bg.ramp = Math.min(1, bg.ramp + sec / 1.15);
    var r = bg.ramp;
    var ease = 0.3 + 0.7 * (r * r * (3 - 2 * r));

    /* 方向低通跟踪：转起来是弧线，不是瞬间折线 → 黏滞感 */
    bg.ang += (bg.tAng - bg.ang) * Math.min(1, 0.05 * k);

    var tx = Math.cos(bg.ang) * BG_SPEED * ease;
    var ty = Math.sin(bg.ang) * BG_SPEED * 0.72 * ease;
    bg.vx += (tx - bg.vx) * Math.min(1, 0.022 * k);
    bg.vy += (ty - bg.vy) * Math.min(1, 0.022 * k);

    bg.ox += bg.vx * k;
    bg.oy += bg.vy * k;
  }

  function isDark() {
    return root.getAttribute('data-theme') === 'dark';
  }

  /* ================= 噪声（周期化，可无缝平铺） ================= */
  function hash2(ix, iy) {
    var n = Math.imul(ix, 374761393) + Math.imul(iy, 668265263);
    n = Math.imul(n ^ (n >>> 13), 1274126177);
    return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
  }

  function vnoise(x, y, period) {
    var xi = Math.floor(x), yi = Math.floor(y);
    var xf = x - xi, yf = y - yi;
    var u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    var x0 = ((xi % period) + period) % period;
    var y0 = ((yi % period) + period) % period;
    var x1 = (x0 + 1) % period, y1 = (y0 + 1) % period;
    var a = hash2(x0, y0), b = hash2(x1, y0);
    var c = hash2(x0, y1), d = hash2(x1, y1);
    var top = a + (b - a) * u;
    var bot = c + (d - c) * u;
    return top + (bot - top) * v;
  }

  function fbm(u, v, baseP) {
    var s = 0, amp = 0.5, p = baseP, norm = 0;
    for (var o = 0; o < 4; o++) {
      s += amp * vnoise(u * p, v * p, p);
      norm += amp;
      amp *= 0.52;
      p *= 2;
    }
    return s / norm;
  }

  /* 域扭曲：先用噪声推歪采样坐标，打散正弦式的规则感 */
  function heightAt(u, v) {
    var wx = fbm(u + 0.13, v + 0.37, 3) - 0.5;
    var wy = fbm(u + 0.52, v + 0.09, 3) - 0.5;
    return fbm(u + wx * 0.30, v + wy * 0.30, 4);
  }

  /* ================= 高度场 → 明暗密度图 =================
   * 先算一张低分辨率高度网格，再由坡度算出明暗（左上光源）；
   * 烘焙时只按明暗决定该处点子的疏密 —— 不用任何线条，
   * 纯靠黑白灰的密度差读地形起伏。 */
  var grid = null;

  function buildGrid() {
    var GW = 168;
    var GH = Math.max(64, Math.round(GW * H / Math.max(1, W)));
    var h = new Float32Array(GW * GH);
    var gx, gy;

    for (gy = 0; gy < GH; gy++) {
      for (gx = 0; gx < GW; gx++) {
        h[gy * GW + gx] = heightAt(gx / GW, gy / GH);
      }
    }

    var sh = new Float32Array(GW * GH);
    var mn = 1e9, mx = -1e9;
    for (gy = 0; gy < GH; gy++) {
      for (gx = 0; gx < GW; gx++) {
        var xm = (gx - 1 + GW) % GW, xp = (gx + 1) % GW;
        var ym = (gy - 1 + GH) % GH, yp = (gy + 1) % GH;
        var dx = h[gy * GW + xp] - h[gy * GW + xm];
        var dy = h[yp * GW + gx] - h[ym * GW + gx];
        var v = 0.5 + dx * 11 + dy * 12;   // 左上受光
        sh[gy * GW + gx] = v;
        if (v < mn) mn = v;
        if (v > mx) mx = v;
      }
    }

    var span = (mx - mn) || 1;
    for (var i = 0; i < sh.length; i++) sh[i] = (sh[i] - mn) / span;

    grid = { h: h, sh: sh, GW: GW, GH: GH };
    return grid;
  }

  function sampleSh(u, v) {
    var g = grid;
    var fx = u * g.GW - 0.5, fy = v * g.GH - 0.5;
    fx = fx < 0 ? 0 : (fx > g.GW - 1.001 ? g.GW - 1.001 : fx);
    fy = fy < 0 ? 0 : (fy > g.GH - 1.001 ? g.GH - 1.001 : fy);
    var x0 = fx | 0, y0 = fy | 0;
    var tx = fx - x0, ty = fy - y0;
    var i0 = y0 * g.GW + x0, i1 = i0 + g.GW;
    var a = g.sh[i0] + (g.sh[i0 + 1] - g.sh[i0]) * tx;
    var b = g.sh[i1] + (g.sh[i1 + 1] - g.sh[i1]) * tx;
    return a + (b - a) * ty;
  }

  function sampleH(u, v) {
    var g = grid;
    var fx = u * g.GW - 0.5, fy = v * g.GH - 0.5;
    fx = fx < 0 ? 0 : (fx > g.GW - 1.001 ? g.GW - 1.001 : fx);
    fy = fy < 0 ? 0 : (fy > g.GH - 1.001 ? g.GH - 1.001 : fy);
    var x0 = fx | 0, y0 = fy | 0;
    var tx = fx - x0, ty = fy - y0;
    var i0 = y0 * g.GW + x0, i1 = i0 + g.GW;
    var a = g.h[i0] + (g.h[i0 + 1] - g.h[i0]) * tx;
    var b = g.h[i1] + (g.h[i1 + 1] - g.h[i1]) * tx;
    return a + (b - a) * ty;
  }

  /* ================= 柔光精灵 ================= */
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

  /* ================= 中层浮沙 ================= */
  function newGrain(x, y) {
    /* 幂次取样：指数越大越偏向深层（0 = 深层细沙），表层大颗粒更稀 */
    var depth = Math.pow(Math.random(), 2.6);
    return {
      x: x,
      y: y,
      vx: 0,
      vy: 0,
      depth: depth,
      size: 0.12 + depth * 0.42 + Math.random() * 0.16,
      alpha: (0.16 + Math.random() * 0.34) * (0.72 + depth * 0.82),
      phase: Math.random() * Math.PI * 2,
      twinkle: 0.35 + Math.random() * 0.9,
      bobF: 0.8 + Math.random() * 1.9,
      soft: depth > 0.82
    };
  }

  /* ================= 近景粗沙 ================= */
  function newNear(x, y) {
    return {
      x: x,
      y: y,
      vx: 0,
      vy: 0,
      size: 0.62 + Math.random() * 0.9,
      alpha: 0.5 + Math.random() * 0.4,
      phase: Math.random() * Math.PI * 2,
      bobF: 0.5 + Math.random() * 1.3,
      speed: 0.85 + Math.random() * 1.5
    };
  }

  function targetCount() {
    var cap = W < 760 ? 9800 : 18000;
    return Math.round(Math.min(cap, Math.max(6200, (W * H) / 100)));
  }

  function seed() {
    var total = targetCount();
    grains.length = 0;
    for (var i = 0; i < total; i++) {
      grains.push(newGrain(Math.random() * W, Math.random() * H));
    }
    var nn = W < 760 ? 420 : 900;
    near.length = 0;
    for (var j = 0; j < nn; j++) {
      near.push(newNear(Math.random() * W, Math.random() * H));
    }
  }

  /* ================= 风场（浮沙用） ================= */
  function flow(x, y) {
    var ph = x * 0.0042 + y * 0.0018 - time * 1.3;
    var ph2 = (x + y) * 0.0011 - time * 0.5;
    var fx = Math.cos(ph) * 0.55 + Math.cos(ph2) * 0.22 - 0.45;
    var fy = Math.sin(ph) * 0.5 + Math.sin(ph2) * 0.16;
    return [fx, fy];
  }

  /* ================= 沙丘纹理烘焙 =================
   * 按明暗度打点：背光坡面点密（深灰）、受光坡面点疏（留白），
   * 中间调自然过渡 —— 起伏完全由密度读出来，没有任何线条。 */
  function bakeTexture() {
    var key = (isDark() ? 'd' : 'l') + 'x' + W + 'x' + H;
    if (tex && key === texKey) return tex;

    TW = Math.max(2, Math.round(W * TEX_SCALE));
    TH = Math.max(2, Math.round(H * TEX_SCALE));

    if (!grid) buildGrid();

    var c = document.createElement('canvas');
    c.width = Math.round(TW * DPR);
    c.height = Math.round(TH * DPR);
    var g2 = c.getContext('2d');
    g2.setTransform(DPR, 0, 0, DPR, 0, 0);

    var rgb = isDark() ? '236,241,247' : '44,52,62';
    g2.fillStyle = 'rgb(' + rgb + ')';

    var tries = Math.round((TW * TH) / 2.4);
    for (var i = 0; i < tries; i++) {
      var x = Math.random() * TW;
      var y = Math.random() * TH;
      var u = x / TW, v = y / TH;

      var shv = sampleSh(u, v);          // 0 = 全暗（背光），1 = 全亮（受光）
      var hv = sampleH(u, v);

      var dark = 1 - shv;
      var dens = 0.04 + 0.96 * Math.pow(dark, 1.1) * (0.3 + 0.7 * hv) + 0.22 * hv * hv;
      if (dens > 1) dens = 1;
      if (Math.random() > dens) continue;

      var d = Math.pow(Math.random(), 1.4);
      var s = 0.34 + d * 0.6 + dens * 0.7;
      g2.globalAlpha = 0.07 + 0.55 * dens * (0.5 + 0.5 * d);
      g2.fillRect(x, y, s, s);
    }

    tex = c;
    texKey = key;
    return tex;
  }

  /* ================= 物理步进 ================= */
  function step(dt) {
    var DWELL_MAX = 3.4;

    if (mouse.inside) {
      var moving = Math.abs(mouse.vx) + Math.abs(mouse.vy);
      if (moving < 1.4) mouse.dwell = Math.min(DWELL_MAX, mouse.dwell + dt / 1000);
      else mouse.dwell = Math.max(0, mouse.dwell - dt / 1000 * 4);
    } else {
      mouse.dwell = Math.max(0, mouse.dwell - dt / 1000 * 2.2);
    }

    var dwellN = mouse.dwell / DWELL_MAX;
    var R = 20 + dwellN * 80, R2 = R * R;   // 刚悬停 20px → 停满 100px
    var depthGate = 0.78 - dwellN * 0.78;   // 0.78 → 0：越停越往深处掏
    var dwellBoost = 0.7 + dwellN * 0.75;

    var i, g;

    /* 中层浮沙 */
    for (i = 0; i < grains.length; i++) {
      g = grains[i];
      var f = flow(g.x, g.y);
      var speed = 0.3 + g.depth * 0.95;

      g.vx += (f[0] * speed - g.vx) * 0.042;
      g.vy += (f[1] * speed - g.vy) * 0.042;

      if (mouse.inside && g.depth >= depthGate) {
        var dx = g.x - mouse.x;
        var dy = g.y - mouse.y;
        var d2 = dx * dx + dy * dy;
        if (d2 < R2) {
          var d = Math.sqrt(d2) || 1;
          var k = 1 - d / R;
          k = k * k;
          var push = k * (0.6 + g.depth * 1.15) * dwellBoost;
          g.vx += (dx / d) * push;
          g.vy += (dy / d) * push;
          g.vx += mouse.vx * 0.06 * k;
          g.vy += mouse.vy * 0.06 * k;
        }
      }

      if (g.vx > 4) g.vx = 4; else if (g.vx < -4) g.vx = -4;
      if (g.vy > 4) g.vy = 4; else if (g.vy < -4) g.vy = -4;

      g.x += g.vx;
      g.y += g.vy + Math.sin(time * g.bobF + g.phase) * 0.12 * (0.4 + g.depth);

      if (g.x < -20) { g.x = W + 20; g.y = Math.random() * H; }
      else if (g.x > W + 20) { g.x = -20; g.y = Math.random() * H; }
      if (g.y < -20) g.y = H + 20;
      else if (g.y > H + 20) g.y = -20;

      g.phase += 0.012 * g.twinkle;
    }

    /* 近景粗沙：比浮沙稍快一点，被推开的范围随驻留增长 */
    var R2n = R * R * 2.2;
    for (i = 0; i < near.length; i++) {
      g = near[i];
      var fn = flow(g.x * 0.7, g.y * 0.7);
      g.vx += (fn[0] * g.speed * 0.85 - g.vx) * 0.045;
      g.vy += (fn[1] * g.speed * 0.85 - g.vy) * 0.045;

      if (mouse.inside) {
        var ndx = g.x - mouse.x;
        var ndy = g.y - mouse.y;
        var nd2 = ndx * ndx + ndy * ndy;
        if (nd2 < R2n) {
          var nd = Math.sqrt(nd2) || 1;
          var nk = 1 - nd / (R * 1.48);
          nk = nk > 0 ? nk * nk : 0;
          var npush = nk * (1.2 + dwellN * 2.4);
          g.vx += (ndx / nd) * npush;
          g.vy += (ndy / nd) * npush;
          g.vx += mouse.vx * 0.05 * nk;
          g.vy += mouse.vy * 0.05 * nk;
        }
      }

      if (g.vx > 3) g.vx = 3; else if (g.vx < -3) g.vx = -3;
      if (g.vy > 3) g.vy = 3; else if (g.vy < -3) g.vy = -3;

      g.x += g.vx;
      g.y += g.vy + Math.sin(time * g.bobF + g.phase) * 0.2;

      if (g.x < -12) { g.x = W + 12; g.y = Math.random() * H; }
      else if (g.x > W + 12) { g.x = -12; g.y = Math.random() * H; }
      if (g.y < -12) g.y = H + 12;
      else if (g.y > H + 12) g.y = -12;

      g.phase += 0.02;
    }

    mouse.vx *= 0.86;
    mouse.vy *= 0.86;
  }

  /* ================= 绘制 ================= */
  function paint() {
    ctx.clearRect(0, 0, W, H);

    /* 远景沙丘：单层慢速漂移，方向随时间缓慢旋转 */
    var t = bakeTexture();
    advanceBackground(dtCache);
    /* 取模强制为正：负偏移时若不修正，平铺会在左/上留出空白带 */
    var sx = ((bg.ox % TW) + TW) % TW;
    var sy = ((bg.oy % TH) + TH) % TH;
    ctx.globalAlpha = 0.95;
    ctx.drawImage(t, -sx, -sy, TW, TH);
    ctx.drawImage(t, TW - sx, -sy, TW, TH);
    ctx.drawImage(t, -sx, TH - sy, TW, TH);
    ctx.drawImage(t, TW - sx, TH - sy, TW, TH);

    /* 中层浮沙 */
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

    /* 近景粗沙：鼠标视差 + 清晰墨点 */
    var px = mouse.inside ? -(mouse.x - W / 2) * 0.016 : 0;
    var py = mouse.inside ? -(mouse.y - H / 2) * 0.016 : 0;
    ctx.fillStyle = isDark() ? 'rgb(238,243,249)' : 'rgb(34,42,52)';
    for (i = 0; i < near.length; i++) {
      g = near[i];
      ctx.globalAlpha = Math.min(0.92, g.alpha * (0.82 + 0.18 * Math.sin(g.phase)));
      ctx.fillRect(g.x + px, g.y + py, g.size, g.size);
    }

    ctx.globalAlpha = 1;
  }

  /* ================= 帧循环 ================= */
  var last = 0;
  function loop(now) {
    requestAnimationFrame(loop);
    if (!visible) { last = now; return; }
    var dt = Math.min(48, (now - last) || 16);
    last = now;
    dtCache = dt;
    time += dt / 1000;
    step(dt);
    paint();
  }

  /* ================= 尺寸 ================= */
  function resize() {
    var r = canvas.getBoundingClientRect();
    W = Math.max(1, Math.round(r.width));
    H = Math.max(1, Math.round(r.height));
    canvas.width = Math.round(W * DPR);
    canvas.height = Math.round(H * DPR);
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    texKey = '';
    grid = null;
    seed();
    paint();
  }

  var rt = 0;
  window.addEventListener('resize', function () {
    clearTimeout(rt);
    rt = setTimeout(resize, 160);
  });

  /* ================= 交互 ================= */
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

    var i, ang, g;
    for (i = 0; i < 40; i++) {
      ang = Math.random() * Math.PI * 2;
      g = newGrain(x, y);
      g.depth = 0.5 + Math.random() * 0.5;
      g.size = 0.16 + g.depth * 0.5;
      g.alpha = 0.3 + Math.random() * 0.34;
      g.soft = Math.random() > 0.6;
      g.vx = Math.cos(ang) * (0.4 + Math.random() * 1.6);
      g.vy = Math.sin(ang) * (0.4 + Math.random() * 1.6) - 0.3;
      grains.push(g);
    }
    for (i = 0; i < 14; i++) {
      ang = Math.random() * Math.PI * 2;
      g = newNear(x, y);
      g.vx = Math.cos(ang) * (0.6 + Math.random() * 2);
      g.vy = Math.sin(ang) * (0.6 + Math.random() * 2) - 0.6;
      near.push(g);
    }
    if (grains.length > 18600) grains.splice(0, grains.length - 18600);
    if (near.length > 1500) near.splice(0, near.length - 1500);
  }, { passive: true });

  document.addEventListener('visibilitychange', function () {
    visible = !document.hidden;
  });

  /* ================= 启动 ================= */
  resize();

  if (reduceMotion) {
    paint();
  } else {
    requestAnimationFrame(loop);
  }

  window.Sand = { repaint: paint };
})();
