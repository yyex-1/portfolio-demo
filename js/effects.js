/**
 * effects.js — 鼠标交互特效层（仅凹陷暗影 + 点击涟漪）
 * 位于页面最底层背景层：不遮挡文字/卡片/按钮，不影响点击、拖拽、编辑、表单输入
 * - 鼠标移动：柔和圆形凹陷暗影粘滞跟随鼠标（位置滞后拖尾 + 平滑插值）
 * - 鼠标静止 400ms：凹陷在原位加深、定型（生成更明显的凹陷质感）
 * - 点击：在点击坐标生成一圈青色柔和涟漪，缓慢向外扩散后淡出
 * - 鼠标移出窗口：立即清除凹陷与涟漪
 * 不含任何花纹/星型/花朵/电路线条图形
 * 性能：mousemove 通过 requestAnimationFrame 节流并按需渲染
 */
(function () {
  'use strict';

  // 触屏设备无鼠标交互，跳过
  if (window.matchMedia('(hover: none)').matches) return;

  var canvas = document.getElementById('fx-canvas');
  if (!canvas) return;
  var ctx = canvas.getContext('2d');
  var dpr = Math.min(window.devicePixelRatio || 1, 2);

  // 鼠标状态
  var mouse = { x: -9999, y: -9999, inside: false };
  // 凹陷暗影状态（当前位置 + 当前透明度，平滑跟随）
  var dep = { x: -9999, y: -9999, alpha: 0, radius: 216, settled: false };
  // 涟漪队列
  var ripples = [];
  // 空闲定时器（鼠标静止 400ms 后凹陷定型）
  var idleTimer = null;
  // rAF 调度标记
  var scheduled = false;

  // 常量（凹陷更明显 + 粘滞跟随手感）
  var IDLE_DELAY = 400;        // 鼠标静止触发定型时长（ms）
  var MOVE_ALPHA = 0.42;       // 移动跟随时的凹陷透明度（明显压暗）
  var SETTLE_ALPHA = 0.62;     // 静止定型后的凹陷透明度（暗坑更深）
  var MOVE_RADIUS = 216;       // 移动时凹陷半径
  var SETTLE_RADIUS = 304;     // 定型后凹陷半径
  var POS_EASE = 0.12;         // 位置跟随系数（越小越滞后 → 粘滞拖尾感）
  var GROW_EASE = 0.30;        // 透明度/半径变化系数（越快越利落）
  var DEP_RGB = '12,26,54';         // 凹陷外缘颜色（暗蓝，向内收拢）
  var DEP_CORE_RGB = '0,3,12';      // 凹陷核心颜色（近黑，压出明显暗坑）
  var RIPPLE_LIFE = 900;       // 涟漪生命周期（ms）
  var RIPPLE_MAX_R = 72;       // 涟漪最大半径

  // 画布尺寸自适应（高 DPI）；setTransform 后所有绘制均用 CSS 像素坐标
  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.floor(window.innerWidth * dpr);
    canvas.height = Math.floor(window.innerHeight * dpr);
    canvas.style.width = window.innerWidth + 'px';
    canvas.style.height = window.innerHeight + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  window.addEventListener('resize', resize);
  resize();

  // ---- 绘制凹陷暗影（向内压暗的柔软暗坑）----
  // 核心近黑、向边缘柔和收拢，整块压暗形成被按下去的落差，
  // 不引入亮色/光晕，保持低调的暗部阴影。
  function drawDepression() {
    if (dep.alpha <= 0.01) return;
    var cx = dep.x, cy = dep.y, r = dep.radius;
    var a = dep.alpha;
    var g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    g.addColorStop(0.00, 'rgba(' + DEP_CORE_RGB + ',' + a + ')');
    g.addColorStop(0.15, 'rgba(' + DEP_CORE_RGB + ',' + (a * 0.92) + ')');
    g.addColorStop(0.35, 'rgba(' + DEP_CORE_RGB + ',' + (a * 0.72) + ')');
    g.addColorStop(0.55, 'rgba(' + DEP_RGB + ',' + (a * 0.42) + ')');
    g.addColorStop(0.75, 'rgba(' + DEP_RGB + ',' + (a * 0.18) + ')');
    g.addColorStop(1.00, 'rgba(' + DEP_RGB + ',0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // ---- 绘制点击涟漪（一圈青色柔和扩散环）----
  function drawRipples(now) {
    for (var i = ripples.length - 1; i >= 0; i--) {
      var rip = ripples[i];
      var t = (now - rip.born) / RIPPLE_LIFE;
      if (t >= 1) { ripples.splice(i, 1); continue; }
      if (t < 0) continue;
      var radius = 4 + t * RIPPLE_MAX_R;
      var alpha = (1 - t) * 0.42;             // 缓慢淡出
      ctx.beginPath();
      ctx.arc(rip.x, rip.y, radius, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(100,255,218,' + alpha + ')';
      ctx.lineWidth = 1.3;
      ctx.stroke();
    }
  }

  // ---- 动画主循环（按需调度，静止时自动停帧省电）----
  function tick() {
    var now = performance.now();
    ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);

    // 凹陷位置平滑跟随鼠标（粘滞拖尾：位置慢跟、透明度/半径快变）
    if (mouse.inside) {
      dep.x += (mouse.x - dep.x) * POS_EASE;
      dep.y += (mouse.y - dep.y) * POS_EASE;
    }
    // 凹陷目标透明度/半径：静止定型 → 更明显；移动中 → 较弱跟随
    var targetAlpha = mouse.inside ? (dep.settled ? SETTLE_ALPHA : MOVE_ALPHA) : 0;
    var targetRadius = dep.settled ? SETTLE_RADIUS : MOVE_RADIUS;
    dep.alpha += (targetAlpha - dep.alpha) * GROW_EASE;
    dep.radius += (targetRadius - dep.radius) * GROW_EASE;
    if (dep.alpha < 0.005) dep.alpha = 0;

    drawRipples(now);
    drawDepression();

    scheduled = false;

    // 是否需要继续渲染：跟随未收敛 / 透明度未达目标 / 涟漪未结束
    var dx = mouse.inside ? Math.abs(mouse.x - dep.x) : 0;
    var dy = mouse.inside ? Math.abs(mouse.y - dep.y) : 0;
    var following = mouse.inside && (dx > 0.5 || dy > 0.5);
    var fading = Math.abs(dep.alpha - targetAlpha) > 0.005;
    var hasRipple = ripples.length > 0;
    if (following || fading || hasRipple) schedule();
  }
  function schedule() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(tick);
  }

  // ---- 事件绑定 ----
  // mousemove：rAF 节流 —— 事件内仅更新坐标与定时器，绘制统一交给 rAF 循环
  document.addEventListener('mousemove', function (e) {
    // 首次进入：凹陷直接吸附到光标位置并立即可见，避免从屏幕外缓动飞入
    if (!mouse.inside) {
      dep.x = e.clientX;
      dep.y = e.clientY;
      dep.radius = MOVE_RADIUS;
      dep.alpha = Math.max(dep.alpha, MOVE_ALPHA);
    }
    mouse.x = e.clientX;
    mouse.y = e.clientY;
    mouse.inside = true;
    // 移动中：凹陷回到微弱跟随状态
    dep.settled = false;
    // 重置静止定时器，静止 400ms 后凹陷定型
    clearTimeout(idleTimer);
    idleTimer = setTimeout(function () {
      if (!mouse.inside) return;
      dep.settled = true;
      schedule();
    }, IDLE_DELAY);
    schedule();
  }, { passive: true });

  // 点击 → 青色涟漪
  document.addEventListener('click', function (e) {
    if (e.button > 0) return;   // 仅响应主键点击（左键）
    ripples.push({ x: e.clientX, y: e.clientY, born: performance.now() });
    if (ripples.length > 5) ripples.shift();
    schedule();
  }, { passive: true });

  // 清除所有特效
  function clearAll() {
    mouse.inside = false;
    dep.settled = false;
    clearTimeout(idleTimer);
    ripples.length = 0;
    schedule(); // 让凹陷淡出
  }

  // 鼠标移出窗口 → 立即清除凹陷与涟漪（mouseleave 在 document 上可靠触发）
  document.addEventListener('mouseleave', clearAll);

  // 暴露 resize 接口（外部可调用）
  window.FX = { resize: resize };
})();
