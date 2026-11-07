/**
 * intro.js — 开场动画
 * 仿 p5aholic.me：纯黑屏居中「名字 + Portfolio」，停留片刻后淡出进入站点
 * 点击可跳过；prefers-reduced-motion 时由 CSS 直接隐藏
 */
(function () {
  'use strict';

  var intro = document.getElementById('intro');
  if (!intro) return;

  // 名字与管理后台数据保持一致
  try {
    if (window.Store && typeof Store.getSiteInfo === 'function') {
      var info = Store.getSiteInfo();
      var nameEl = intro.querySelector('.intro-name');
      if (info && info.name && nameEl) nameEl.textContent = info.name;
    }
  } catch (e) { /* 忽略 */ }

  var done = false;
  function finish() {
    if (done) return;
    done = true;
    intro.classList.add('is-done');
    setTimeout(function () {
      if (intro.parentNode) intro.parentNode.removeChild(intro);
    }, 850);
  }

  // 停留约 1.6 秒后淡出
  setTimeout(finish, 1600);
  intro.addEventListener('click', finish);
})();
