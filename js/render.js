/**
 * render.js — 渲染层（psaholic 式布局复刻）
 * 结构：细边框画布内 — 左上大名字+副标题、竖排导航（当前项为圆点●）、右侧窄列内容、左下版权
 * 视图：home / projects / info / contact（由 js/pager.js 整屏切换）
 * 与 admin.js 的契约：项目仍渲染为 #content 内的 <article data-project-id>
 */
(function (global) {
  'use strict';

  var Store = global.Store;

  function esc(str) {
    var d = document.createElement('div');
    d.textContent = str || '';
    return d.innerHTML;
  }

  // ---- 左上：名字 + 副标题；其下：竖排导航 ----
  function renderSidebar() {
    var info = Store.getSiteInfo();
    var el = document.getElementById('site-head');
    if (!el) return;

    var nav = [
      { id: 'home', label: 'Home' },
      { id: 'projects', label: 'Projects' },
      { id: 'info', label: 'Info' },
      { id: 'contact', label: 'Contact' }
    ].map(function (n) {
      return '<a href="#' + n.id + '" class="nav-link" data-view="' + n.id + '"><span>' + n.label + '</span></a>';
    }).join('');

    el.innerHTML =
      '<div class="brand">' +
        '<h1 class="brand-name"><a href="#home" data-view="home">' + esc(info.name) + '</a></h1>' +
        '<p class="brand-sub">Frontend Developer</p>' +
      '</div>' +
      '<nav class="side-nav">' + nav + '</nav>';
  }

  // ---- 视图外壳 ----
  function view(id, inner) {
    return '<section class="view view-' + id + '" id="view-' + id + '" data-view="' + id + '">' + inner + '</section>';
  }

  // ---- Home：右下角 manifesto ----
  function renderHome() {
    var info = Store.getSiteInfo();
    var text = (info.slogan ? info.slogan + '\n' : '') + (info.intro || '');
    var inner =
      '<div class="manifesto">' +
        text.split('\n').filter(Boolean).map(function (line) {
          return '<span class="manifesto-line">' + esc(line) + '</span>';
        }).join('') +
      '</div>';
    return view('home', inner);
  }

  // ---- Projects：右侧窄列，右对齐大标题 + meta 行 ----
  function renderProjects() {
    var all = Store.getProjects() || [];

    var rows = all.map(function (p, i) {
      var adminAttrs = global.Admin && global.Admin.isActive
        ? ' draggable="true" data-project-id="' + esc(p.id) + '"'
        : '';

      var meta = [];
      if (p.tags && p.tags.length) meta.push(esc(p.tags.join(' / ')));
      if (p.githubUrl) meta.push('<a class="proj-code" href="' + esc(p.githubUrl) + '" target="_blank" rel="noopener noreferrer">CODE</a>');

      var item =
        '<h2 class="proj-title">' + esc(p.title) + '</h2>' +
        (meta.length ? '<p class="proj-meta">' + meta.join('<span class="meta-sep"> / </span>') + '</p>' : '') +
        '<p class="proj-desc">' + esc(p.desc) + '</p>';

      var open = p.demoUrl
        ? '<a class="proj-item" href="' + esc(p.demoUrl) + '" target="_blank" rel="noopener noreferrer">'
        : '<div class="proj-item">';
      var close = p.demoUrl ? '</a>' : '</div>';

      return '<article class="proj" data-project-id="' + esc(p.id) + '"' + adminAttrs + '>' +
          open + item + close +
        '</article>';
    }).join('');

    var inner =
      '<div id="projects-drop-mount"></div>' +
      '<div class="proj-list scrollable">' + rows + '</div>' +
      (all.length === 0
        ? '<p class="empty">' + ((global.Admin && global.Admin.isActive) ? '暂无项目，拖拽网页链接到此处即可添加。' : '暂无项目。') + '</p>'
        : '');
    return view('projects', inner);
  }

  // ---- Info：右上外链 / 中部社交 / 右下经历 ----
  function renderInfo() {
    var info = Store.getSiteInfo();
    var exp = Store.getExperience() || [];

    var topLinks = [];
    if (info.github) topLinks.push('<a class="ilink" href="' + esc(info.github) + '" target="_blank" rel="noopener noreferrer">github.com/' + esc((info.github.split('/').pop() || 'github')) + ' ↗</a>');
    (info.social || []).slice(0, 2).forEach(function (s) {
      topLinks.push('<a class="ilink" href="' + esc(s.url) + '" target="_blank" rel="noopener noreferrer">' + esc(s.label) + ' ↗</a>');
    });

    var social = (info.social || []).map(function (s) {
      return '<a class="ilink" href="' + esc(s.url) + '" target="_blank" rel="noopener noreferrer">' + esc(s.label) + ' ↗</a>';
    }).join('');
    if (!social && info.email) {
      social = '<a class="ilink" href="mailto:' + esc(info.email) + '">Email ↗</a>';
    }

    var rows = exp.map(function (e) {
      return '<div class="award">' +
          '<span class="award-k">' + esc(e.time) + ' — ' + esc(e.org) + '</span>' +
          '<span class="award-v">' + esc(e.role) + '</span>' +
          (e.desc ? '<span class="award-d">' + esc(e.desc) + '</span>' : '') +
        '</div>';
    }).join('');

    var inner =
      '<div class="info-top">' + topLinks.join('') + '</div>' +
      '<div class="info-social">' + social + '</div>' +
      '<div class="info-awards">' +
        rows +
        (info.intro ? '<div class="award"><span class="award-k">ABOUT</span><span class="award-v">' + esc(info.slogan || '') + '</span><span class="award-d">' + esc(info.intro) + '</span></div>' : '') +
      '</div>';
    return view('info', inner);
  }

  // ---- Contact：右下角一行邮箱 ----
  function renderContact() {
    var info = Store.getSiteInfo();
    var inner =
      '<div class="contact-note">' +
        (info.email ? '<a class="ilink" href="mailto:' + esc(info.email) + '">' + esc(info.email) + '</a>' : '') +
      '</div>';
    return view('contact', inner);
  }

  // ---- 全量渲染 ----
  function renderContent() {
    var el = document.getElementById('content');
    if (!el) return;
    el.innerHTML = renderHome() + renderProjects() + renderInfo() + renderContact();

    if (global.Admin && global.Admin.isActive) {
      global.Admin.mountCardActions();
      global.Admin.mountDropZone();
    }
  }

  function renderAll() {
    renderSidebar();
    renderContent();
    // 左下版权
    var info = Store.getSiteInfo();
    var c = document.getElementById('copyright');
    if (c) c.textContent = '© ' + new Date().getFullYear() + ' ' + info.name;
  }

  // 兼容旧接口
  function projectCardHTML(p) {
    return '<article class="proj" data-project-id="' + esc(p.id) + '"><h2 class="proj-title">' + esc(p.title) + '</h2></article>';
  }

  global.Render = {
    renderSidebar: renderSidebar,
    renderContent: renderContent,
    renderAll: renderAll,
    projectCardHTML: projectCardHTML,
    PLACEHOLDER: ''
  };
})(window);
