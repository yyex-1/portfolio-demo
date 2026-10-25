/**
 * app.js — 主入口
 * 职责：初始化、渲染、管理员入口绑定、Store 变更监听。
 */
(function () {
  'use strict';

  var Store = window.Store;
  var Render = window.Render;
  var Admin = window.Admin;

  // 初始渲染
  Render.renderAll();

  // 初始化管理员入口（锁图标）
  Admin.init();

  // 监听 Store 变更 → 自动重渲染
  Store.subscribe(function (type) {
    // 保存滚动位置
    var scrollY = window.scrollY;
    Render.renderAll();
    // 恢复滚动位置（搜索过滤时不跳顶）
    if (type !== 'projects') {
      window.scrollTo(0, scrollY);
    }
    // 管理员模式下重新挂载编辑组件
    if (Admin.isActive) {
      Admin.mountCardActions();
    }
  });

  // 锚点导航平滑滚动
  document.addEventListener('click', function (e) {
    var link = e.target.closest('a[href^="#"]');
    if (!link) return;
    var targetId = link.getAttribute('href').slice(1);
    var target = document.getElementById(targetId);
    if (target) {
      e.preventDefault();
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });
})();
