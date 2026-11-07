/**
 * theme.js — 明暗主题切换（左边缘竖排按钮）
 * 记忆到 localStorage，刷新后保持
 */
(function () {
  'use strict';

  var KEY = 'bc-theme';
  var root = document.documentElement;

  try {
    var saved = localStorage.getItem(KEY);
    // 默认配色为黑色（dark）；仅当用户显式选过 light 才用浅色
    root.setAttribute('data-theme', saved === 'light' ? 'light' : 'dark');
  } catch (e) { /* 隐私模式下忽略 */ }

  var btn = document.getElementById('theme-toggle');
  if (!btn) return;

  btn.addEventListener('click', function () {
    var next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    root.setAttribute('data-theme', next);
    try { localStorage.setItem(KEY, next); } catch (e) {}
  });
})();
