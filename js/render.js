/**
 * render.js — 渲染层（极简等宽排版风格）
 * 结构：顶部导航 + 巨型名字 + 01 About / 02 Experience / 03 Projects / 04 Contact
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
      return '<a href="#' + n.id + '" class="head-link">' + n.label + '</a>';
    }).join('');

    el.innerHTML =
      '<a href="#top" class="head-name">' + esc(info.name) + '</a>' +
      '<nav class="head-nav">' + nav + '</nav>' +
      '<div class="head-meta">' +
        (info.email ? '<a href="mailto:' + esc(info.email) + '" class="head-link">' + esc(info.email) + '</a>' : '') +
      '</div>';
  }

  // ---- 巨型名字（masthead）----
  function renderMasthead() {
    var info = Store.getSiteInfo();
    return '<section id="top" class="masthead">' +
        '<h1 class="masthead-name">' + esc(info.name) + '</h1>' +
        '<div class="masthead-grid">' +
          '<p class="masthead-slogan">' + esc(info.slogan) + '</p>' +
          '<p class="masthead-intro">' + esc(info.intro) + '</p>' +
        '</div>' +
        '<div class="masthead-foot">' +
          '<span class="micro">AVAILABLE FOR WORK</span>' +
          '<span class="micro">SCROLL ↓</span>' +
        '</div>' +
      '</section>';
  }

  // ---- 章节标题 ----
  function sectionHead(num, label, id) {
    return '<div class="sec-head" id="' + id + '">' +
        '<span class="sec-num">' + num + '</span>' +
        '<span class="sec-label">' + label + '</span>' +
        '<span class="sec-line"></span>' +
      '</div>';
  }

  // ---- 01 About ----
  function renderAbout() {
    var info = Store.getSiteInfo();
    return '<section class="sec">' +
        sectionHead('01', 'ABOUT', 'about') +
        '<p class="about-text">' + esc(info.intro) + '</p>' +
        '<p class="about-sub">' + esc(info.slogan) + '。以下是我参与或独立完成的项目。</p>' +
      '</section>';
  }

  // ---- 02 Experience ----
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

    return '<section class="sec">' +
        sectionHead('02', 'EXPERIENCE', 'experience') +
        '<div class="rows">' + rows + '</div>' +
      '</section>';
  }

  // ---- 03 Projects ----
  function renderProjects() {
    var all = Store.getProjects() || [];
    var featuredIds = (Store.getFeaturedProjects() || []).map(function (p) { return p.id; });

    var rows = all.map(function (p, i) {
      var isFeatured = featuredIds.indexOf(p.id) >= 0;
      var adminAttrs = global.Admin && global.Admin.isActive
        ? ' draggable="true" data-project-id="' + esc(p.id) + '"'
        : '';
      var links = '';
      if (p.demoUrl) links += '<a href="' + esc(p.demoUrl) + '" target="_blank" rel="noopener noreferrer" class="plink">DEMO ↗</a>';
      if (p.githubUrl) links += '<a href="' + esc(p.githubUrl) + '" target="_blank" rel="noopener noreferrer" class="plink">CODE ↗</a>';

      return '<article class="proj" data-project-id="' + esc(p.id) + '"' + adminAttrs + '>' +
          '<div class="proj-num">' + pad(i + 1) + '</div>' +
          '<div class="proj-main">' +
            '<h3 class="proj-title">' + (isFeatured ? '<span class="dot" aria-hidden="true"></span>' : '') + esc(p.title) + '</h3>' +
            '<div class="proj-sub">' +
              '<p class="proj-desc">' + esc(p.desc) + '</p>' +
              (p.tags && p.tags.length ? '<div class="tags">' + p.tags.map(function (t) { return '[' + esc(t) + ']'; }).join('') + '</div>' : '') +
              (links ? '<div class="proj-links">' + links + '</div>' : '') +
            '</div>' +
          '</div>' +
        '</article>';
    }).join('');

    return '<section class="sec">' +
        sectionHead('03', 'PROJECTS', 'projects') +
        '<div class="proj-list">' + rows + '</div>' +
        (all.length === 0
          ? '<p class="empty">' + ((global.Admin && global.Admin.isActive) ? '暂无项目，拖拽网页链接到此处即可添加。' : '暂无项目。') + '</p>'
          : '') +
      '</section>';
  }

  // ---- 04 Contact ----
  function renderContact() {
    var info = Store.getSiteInfo();
    var social = (info.social || []).map(function (s) {
      return '<a class="clink" href="' + esc(s.url) + '" target="_blank" rel="noopener noreferrer">' + esc(s.label) + '</a>';
    }).join('');
    return '<section class="sec sec-contact">' +
        sectionHead('04', 'CONTACT', 'contact') +
        (info.email ? '<a class="contact-mail" href="mailto:' + esc(info.email) + '">' + esc(info.email) + '</a>' : '') +
        '<div class="contact-links">' +
          (info.github ? '<a class="clink" href="' + esc(info.github) + '" target="_blank" rel="noopener noreferrer">GITHUB ↗</a>' : '') +
          social +
        '</div>' +
      '</section>';
  }

  function renderFooter() {
    var info = Store.getSiteInfo();
    return '<footer class="site-foot">' +
        '<span>© ' + new Date().getFullYear() + ' ' + esc(info.name) + '</span>' +
        '<span class="foot-note">' + esc(info.footer) + '</span>' +
      '</footer>';
  }

  // ---- 全量渲染 ----
  function renderContent() {
    var el = document.getElementById('content');
    if (!el) return;
    el.innerHTML = renderMasthead() + renderAbout() + renderExperience() + renderProjects() + renderContact() + renderFooter();

    // 锚点平滑滚动（原生 scroll-behavior 亦可，这里兜底老浏览器）
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
