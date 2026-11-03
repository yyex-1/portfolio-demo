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
    if (saved === 'dark' || saved === 'light') root.setAttribute('data-theme', saved);
  } catch (e) { /* 隐私模式下忽略 */ }

  var btn = document.getElementById('theme-toggle');
  if (!btn) return;

  btn.addEventListener('click', function () {
    var next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    root.setAttribute('data-theme', next);
    try { localStorage.setItem(KEY, next); } catch (e) {}
  });
})();
