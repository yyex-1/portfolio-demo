/**
 * app.js — 主入口
 * 职责：初始化、渲染、管理员入口绑定、Store 变更监听、整屏分页初始化。
 */
(function () {
  'use strict';

  var Store = window.Store;
  var Render = window.Render;
  var Admin = window.Admin;
  var Pager = window.Pager;

  // 初始渲染
  Render.renderAll();
  Pager.mount();

  // 初始化管理员入口（锁图标）
  Admin.init();

  // 监听 Store 变更 → 重渲染，并停留在当前这一屏
  Store.subscribe(function () {
    var keep = Pager.current();
    Render.renderAll();
    Pager.mount(keep);
    if (Admin.isActive) Admin.mountCardActions();
  });
})();
