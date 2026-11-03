/**
 * pager.js — 整屏分页控制器
 * 页面不滚动：视图叠在同一视口内，切换时上下错位淡入淡出
 * 交互：导航点击 / 滚轮 / 方向键 / 触屏上下滑 / 右下角翻页按钮 / 地址栏 hash
 */
(function (global) {
  'use strict';

  var stage, views = [], current = 0, lockedAt = 0, mounted = false;
  var LOCK_MS = 680;

  function list() {
    return Array.prototype.slice.call(document.querySelectorAll('#content .view'));
  }

  function pad(n) { return n < 10 ? '0' + n : '' + n; }

  function canScroll(el, dy) {
    if (!el) return false;
    if (el.scrollHeight <= el.clientHeight + 2) return false;
    if (dy > 0) return el.scrollTop + el.clientHeight < el.scrollHeight - 2;
    return el.scrollTop > 2;
  }

  function paint() {
    var name = views[current] && views[current].getAttribute('data-view');

    views.forEach(function (v, k) {
      v.classList.toggle('is-active', k === current);
      v.classList.toggle('is-prev', k < current);
      v.classList.toggle('is-next', k > current);
    });

    Array.prototype.forEach.call(document.querySelectorAll('[data-view]'), function (a) {
      if (!a.classList.contains('head-link') && !a.classList.contains('head-name')) return;
      a.classList.toggle('is-current', a.getAttribute('data-view') === name);
    });

    var cur = document.getElementById('pager-curr');
    var tot = document.getElementById('pager-total');
    if (cur) cur.textContent = pad(current + 1);
    if (tot) tot.textContent = pad(views.length);

    var prev = document.querySelector('[data-pager="prev"]');
    var next = document.querySelector('[data-pager="next"]');
    if (prev) prev.disabled = current === 0;
    if (next) next.disabled = current === views.length - 1;

    var bar = document.getElementById('pager-bar');
    if (bar) bar.style.transform = 'scaleY(' + ((current + 1) / views.length) + ')';
  }

  function goTo(i, opts) {
    opts = opts || {};
    if (!views.length) return;
    i = Math.max(0, Math.min(views.length - 1, i));
    if (i === current && !opts.force) return;

    var from = current;
    current = i;
    paint();

    // 回到顶部（内部滚动容器）
    if (from !== i) {
      var target = views[i];
      target.scrollTop = 0;
      Array.prototype.forEach.call(target.querySelectorAll('.scrollable'), function (s) { s.scrollTop = 0; });
    }

    var name = views[i].getAttribute('data-view');
    if (!opts.silent) {
      var url = name === 'home' ? location.pathname + location.search : '#' + name;
      try { history.replaceState(null, '', url); } catch (e) {}
    }
    document.dispatchEvent(new CustomEvent('viewchange', { detail: { index: i, name: name } }));
  }

  function step(delta) {
    var now = Date.now();
    if (now - lockedAt < LOCK_MS) return;
    lockedAt = now;
    goTo(current + delta);
  }

  function indexOfView(name) {
    for (var i = 0; i < views.length; i++) {
      if (views[i].getAttribute('data-view') === name) return i;
    }
    return -1;
  }

  // ---- 事件绑定（只绑一次） ----
  function bind() {
    if (mounted) return;
    mounted = true;

    // 导航点击
    document.addEventListener('click', function (e) {
      var link = e.target.closest('[data-view]');
      if (link && (link.classList.contains('head-link') || link.classList.contains('head-name'))) {
        e.preventDefault();
        var i = indexOfView(link.getAttribute('data-view'));
        if (i >= 0) goTo(i);
        return;
      }
      var pg = e.target.closest('[data-pager]');
      if (pg) {
        e.preventDefault();
        goTo(current + (pg.getAttribute('data-pager') === 'next' ? 1 : -1));
      }
    });

    // 滚轮
    global.addEventListener('wheel', function (e) {
      if (e.ctrlKey || e.metaKey) return;
      var dy = e.deltaY;
      if (Math.abs(dy) < 10) return;
      var sc = e.target.closest('.scrollable');
      if (sc && canScroll(sc, dy)) return;   // 内部列表还能滚 → 交给它
      e.preventDefault();
      step(dy > 0 ? 1 : -1);
    }, { passive: false });

    // 键盘
    global.addEventListener('keydown', function (e) {
      if (e.target.matches('input, textarea, select, [contenteditable="true"]')) return;
      var k = e.key;
      if (k === 'ArrowDown' || k === 'PageDown' || k === ' ') { e.preventDefault(); step(1); }
      else if (k === 'ArrowUp' || k === 'PageUp') { e.preventDefault(); step(-1); }
      else if (k === 'Home') { e.preventDefault(); goTo(0); }
      else if (k === 'End') { e.preventDefault(); goTo(views.length - 1); }
    });

    // 触屏上下滑
    var ty = 0, tx = 0, moved = false;
    global.addEventListener('touchstart', function (e) {
      if (e.touches.length !== 1) return;
      ty = e.touches[0].clientY;
      tx = e.touches[0].clientX;
      moved = false;
    }, { passive: true });
    global.addEventListener('touchmove', function () {
      if (!moved) { moved = true; }
    }, { passive: true });
    global.addEventListener('touchend', function (e) {
      if (!ty) return;
      var t = e.changedTouches[0];
      var dy = ty - t.clientY;
      var dx = tx - t.clientX;
      if (Math.abs(dy) < 46 || Math.abs(dy) < Math.abs(dx) * 1.4) { ty = 0; return; }

      var active = views[current];
      if (active) {
        var sc = active.querySelector('.scrollable');
        if (sc && canScroll(sc, dy)) { ty = 0; return; }
        if (active.scrollHeight > active.clientHeight + 2) {
          if (dy > 0 && active.scrollTop + active.clientHeight < active.scrollHeight - 2) { ty = 0; return; }
          if (dy < 0 && active.scrollTop > 2) { ty = 0; return; }
        }
      }
      ty = 0;
      step(dy > 0 ? 1 : -1);
    }, { passive: true });

    // hash 直达
    global.addEventListener('hashchange', function () {
      var name = location.hash.replace('#', '');
      var i = indexOfView(name);
      if (i >= 0) goTo(i, { silent: true });
    });
  }

  // ---- 初始化 / 重渲染后复位 ----
  function mount(preferName) {
    stage = document.getElementById('content');
    views = list();
    if (!views.length) return;
    bind();

    var name = preferName || location.hash.replace('#', '');
    var i = indexOfView(name);
    current = i >= 0 ? i : 0;
    goTo(current, { force: true, silent: true });
  }

  global.Pager = {
    mount: mount,
    go: goTo,
    next: function () { goTo(current + 1); },
    prev: function () { goTo(current - 1); },
    current: function () {
      return views[current] ? views[current].getAttribute('data-view') : 'home';
    }
  };
})(window);
