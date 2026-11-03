/**
 * render.js — 渲染层（极简等宽排版 · 整屏分页）
 * 结构：5 个整屏视图 HOME / 01 ABOUT / 02 EXPERIENCE / 03 PROJECTS / 04 CONTACT
 * 不滚动：每个 .view 固定占满视口，由 js/pager.js 切换
 * 与 admin.js 的契约：项目仍渲染为 #content 内的 <article data-project-id>，供拖拽排序与编辑按钮挂载
 */
(function (global) {
  'use strict';

  var Store = global.Store;

  function esc(str) {
    var d = document.createElement('div');
    d.textContent = str || '';
    return d.innerHTML;
  }

  function pad(n) {
    return n < 10 ? '0' + n : '' + n;
  }

  // ---- 顶部导航 ----
  function renderSidebar() {
    var info = Store.getSiteInfo();
    var el = document.getElementById('site-head');
    if (!el) return;

    var nav = [
      { id: 'about', label: 'ABOUT' },
      { id: 'experience', label: 'EXPERIENCE' },
      { id: 'projects', label: 'PROJECTS' },
      { id: 'contact', label: 'CONTACT' }
    ].map(function (n) {
      return '<a href="#' + n.id + '" class="head-link" data-view="' + n.id + '">' + n.label + '</a>';
    }).join('');

    el.innerHTML =
      '<a href="#home" class="head-name" data-view="home">' + esc(info.name) + '</a>' +
      '<nav class="head-nav">' + nav + '</nav>' +
      '<div class="head-meta">' +
        (info.email ? '<a href="mailto:' + esc(info.email) + '" class="head-link">' + esc(info.email) + '</a>' : '') +
      '</div>';
  }

  // ---- 视图外壳 ----
  function view(id, inner) {
    return '<section class="view view-' + id + '" id="view-' + id + '" data-view="' + id + '">' +
        '<div class="view-in">' + inner + '</div>' +
      '</section>';
  }

  // ---- 00 HOME ----
  function renderHome() {
    var info = Store.getSiteInfo();
    var inner =
      '<div class="home-top">' +
        '<p class="micro">INDEX 00 — HOME</p>' +
        '<h1 class="masthead-name">' + esc(info.name) + '</h1>' +
      '</div>' +
      '<div class="home-grid">' +
        '<p class="masthead-slogan">' + esc(info.slogan) + '</p>' +
        '<p class="masthead-intro">' + esc(info.intro) + '</p>' +
      '</div>' +
      '<div class="home-foot">' +
        '<span class="micro">AVAILABLE FOR WORK</span>' +
        '<span class="micro">↑ ↓ / WHEEL / SWIPE</span>' +
      '</div>';
    return view('home', inner);
  }

  // ---- 章节标题 ----
  function sectionHead(num, label, id) {
    return '<div class="sec-head" id="' + id + '">' +
        '<span class="sec-num">' + num + '</span>' +
        '<span class="sec-label">' + label + '</span>' +
        '<span class="sec-line"></span>' +
      '</div>';
  }

  // ---- 01 ABOUT ----
  function renderAbout() {
    var info = Store.getSiteInfo();
    var projects = Store.getProjects() || [];
    var exp = Store.getExperience() || [];

    var inner =
      sectionHead('01', 'ABOUT', 'about') +
      '<div class="about-body">' +
        '<p class="about-text">' + esc(info.intro) + '</p>' +
      '</div>' +
      '<div class="about-facts">' +
        '<div class="fact"><span class="fact-k">PROJECTS</span><span class="fact-v">' + pad(projects.length) + '</span></div>' +
        '<div class="fact"><span class="fact-k">EXPERIENCE</span><span class="fact-v">' + pad(exp.length) + '</span></div>' +
        '<div class="fact"><span class="fact-k">STATUS</span><span class="fact-v">AVAILABLE</span></div>' +
        (info.email ? '<div class="fact"><span class="fact-k">MAIL</span><span class="fact-v fact-mail">' + esc(info.email) + '</span></div>' : '') +
      '</div>';
    return view('about', inner);
  }

  // ---- 02 EXPERIENCE ----
  function renderExperience() {
    var list = Store.getExperience() || [];
    var rows = list.map(function (e) {
      return '<div class="row">' +
          '<div class="row-year">' + esc(e.time) + '</div>' +
          '<div class="row-main">' +
            '<h3 class="row-title">' + esc(e.role) + '<span class="row-org">@ ' + esc(e.org) + '</span></h3>' +
            '<p class="row-desc">' + esc(e.desc) + '</p>' +
            (e.tags && e.tags.length ? '<div class="tags">' + e.tags.map(function (t) { return '[' + esc(t) + ']'; }).join('') + '</div>' : '') +
          '</div>' +
        '</div>';
    }).join('');

    var inner =
      sectionHead('02', 'EXPERIENCE', 'experience') +
      '<div class="rows scrollable">' + rows + '</div>' +
      '<div class="view-foot"><span class="micro">' + pad(list.length) + ' ENTRIES</span><span class="micro">2019 — NOW</span></div>';
    return view('experience', inner);
  }

  // ---- 03 PROJECTS ----
  function renderProjects() {
    var all = Store.getProjects() || [];

    var rows = all.map(function (p, i) {
      var adminAttrs = global.Admin && global.Admin.isActive
        ? ' draggable="true" data-project-id="' + esc(p.id) + '"'
        : '';
      var links = '';
      if (p.demoUrl) links += '<a href="' + esc(p.demoUrl) + '" target="_blank" rel="noopener noreferrer" class="plink">DEMO ↗</a>';
      if (p.githubUrl) links += '<a href="' + esc(p.githubUrl) + '" target="_blank" rel="noopener noreferrer" class="plink">CODE ↗</a>';

      return '<article class="proj" data-project-id="' + esc(p.id) + '"' + adminAttrs + '>' +
          '<div class="proj-num">' + pad(i + 1) + '</div>' +
          '<div class="proj-main">' +
            '<h3 class="proj-title">' + (p.featured ? '<span class="dot" aria-hidden="true"></span>' : '') + esc(p.title) + '</h3>' +
            '<div class="proj-sub">' +
              '<p class="proj-desc">' + esc(p.desc) + '</p>' +
              (p.tags && p.tags.length ? '<div class="tags">' + p.tags.map(function (t) { return '[' + esc(t) + ']'; }).join('') + '</div>' : '') +
              (links ? '<div class="proj-links">' + links + '</div>' : '') +
            '</div>' +
          '</div>' +
        '</article>';
    }).join('');

    var inner =
      sectionHead('03', 'PROJECTS', 'projects') +
      '<div id="projects-drop-mount"></div>' +
      '<div class="proj-list scrollable">' + rows + '</div>' +
      (all.length === 0
        ? '<p class="empty">' + ((global.Admin && global.Admin.isActive) ? '暂无项目，拖拽网页链接到此处即可添加。' : '暂无项目。') + '</p>'
        : '') +
      '<div class="view-foot"><span class="micro">' + pad(all.length) + ' WORKS</span><span class="micro">CLICK / HOVER FOR DETAIL</span></div>';
    return view('projects', inner);
  }

  // ---- 04 CONTACT ----
  function renderContact() {
    var info = Store.getSiteInfo();
    var social = (info.social || []).map(function (s) {
      return '<a class="clink" href="' + esc(s.url) + '" target="_blank" rel="noopener noreferrer">' + esc(s.label) + '</a>';
    }).join('');

    var inner =
      sectionHead('04', 'CONTACT', 'contact') +
      '<div class="contact-body">' +
        (info.email ? '<a class="contact-mail" href="mailto:' + esc(info.email) + '">' + esc(info.email) + '</a>' : '') +
        '<div class="contact-links">' +
          (info.github ? '<a class="clink" href="' + esc(info.github) + '" target="_blank" rel="noopener noreferrer">GITHUB ↗</a>' : '') +
          social +
        '</div>' +
      '</div>' +
      '<div class="site-foot">' +
        '<span>© ' + new Date().getFullYear() + ' ' + esc(info.name) + '</span>' +
        '<span class="foot-note">' + esc(info.footer) + '</span>' +
      '</div>';
    return view('contact', inner);
  }

  // ---- 全量渲染 ----
  function renderContent() {
    var el = document.getElementById('content');
    if (!el) return;
    el.innerHTML = renderHome() + renderAbout() + renderExperience() + renderProjects() + renderContact();

    if (global.Admin && global.Admin.isActive) {
      global.Admin.mountCardActions();
      global.Admin.mountDropZone();
    }
  }

  function renderAll() {
    renderSidebar();
    renderContent();
  }

  // 兼容旧接口
  function projectCardHTML(p) {
    return '<article class="proj" data-project-id="' + esc(p.id) + '"><h3 class="proj-title">' + esc(p.title) + '</h3></article>';
  }

  global.Render = {
    renderSidebar: renderSidebar,
    renderContent: renderContent,
    renderAll: renderAll,
    projectCardHTML: projectCardHTML,
    PLACEHOLDER: ''
  };
})(window);
