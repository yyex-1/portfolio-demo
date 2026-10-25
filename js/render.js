/**
 * render.js — 渲染层（访客模式 + 管理员模式共用）
 * 职责：根据 Store 数据生成 HTML 并填入 DOM。
 * 管理员模式下由 admin.js 调用 Render.renderAll() 后追加编辑组件。
 */
(function (global) {
  'use strict';

  var Store = global.Store;

  // 占位图（深色风格）
  var PLACEHOLDER = 'data:image/svg+xml;utf8,' + encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="800" height="500" viewBox="0 0 800 500">' +
    '<rect width="800" height="500" fill="#0f1629"/>' +
    '<text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="#2a3a5c" font-size="18" font-family="sans-serif">No Preview</text>' +
    '</svg>'
  );

  // 搜索状态
  var searchKeyword = '';

  // ---- 工具 ----
  function esc(str) {
    var d = document.createElement('div');
    d.textContent = str || '';
    return d.innerHTML;
  }

  function sectionHeading(num, label, id) {
    return '<h2 class="flex items-center text-2xl font-bold text-slate-200 mb-10" id="' + id + '-heading">' +
      '<span class="text-accent font-mono text-sm mr-2">' + num + '.</span>' + label +
      '<span class="flex-1 ml-4 h-px bg-navy-700"></span>' +
      '</h2>';
  }

  function tagPills(tags) {
    return (tags || []).map(function (t) {
      return '<span class="px-2.5 py-1 text-xs font-mono rounded-full border border-navy-700 text-accent bg-navy-800/50">' + esc(t) + '</span>';
    }).join('');
  }

  function extLink(href, label, showArrow) {
    if (!href) return '';
    var arrow = showArrow ? '<span class="link-arrow">↗</span>' : '';
    return '<a href="' + esc(href) + '" target="_blank" rel="noopener noreferrer" ' +
      'class="ext-link text-sm text-accent hover:underline">' + esc(label) + ' ' + arrow + '</a>';
  }

  // ---- 侧边栏 ----
  function renderSidebar() {
    var info = Store.getSiteInfo();
    var el = document.getElementById('sidebar');
    if (!el) return;

    var navItems = [
      { id: 'about', num: '01', label: 'About' },
      { id: 'experience', num: '02', label: 'Experience' },
      { id: 'featured', num: '03', label: 'Featured Projects' },
      { id: 'other', num: '04', label: 'Other Projects' },
    ];

    var navHtml = navItems.map(function (n) {
      return '<a href="#' + n.id + '" class="nav-link text-sm text-slate-400 hover:text-accent transition-colors py-1.5" ' +
        'data-target="' + n.id + '">' +
        '<span class="text-accent font-mono text-xs mr-1">' + n.num + '.</span>' + n.label + '</a>';
    }).join('');

    var socialHtml = (info.social || []).map(function (s) {
      return '<a href="' + esc(s.url) + '" target="_blank" rel="noopener noreferrer" ' +
        'class="text-slate-400 hover:text-accent transition-colors text-sm">' + esc(s.label) + '</a>';
    }).join('');

    el.innerHTML =
      '<div class="flex flex-col">' +
        '<div class="text-sm font-mono text-accent mb-3">@&nbsp;' + esc(info.name) + '</div>' +
        '<h1 class="text-2xl font-bold text-slate-200 mb-2">' + esc(info.name) + '</h1>' +
        '<p class="text-accent text-sm font-mono mb-5">' + esc(info.slogan) + '</p>' +
        '<p class="text-slate-400 text-sm leading-relaxed mb-8 max-w-xs">' + esc(info.intro) + '</p>' +
        '<nav class="hidden lg:flex lg:flex-col gap-2.5 mb-10">' + navHtml + '</nav>' +
        '<div class="flex items-center gap-6 text-sm">' +
          (info.email ? '<a href="mailto:' + esc(info.email) + '" class="text-slate-400 hover:text-accent transition-colors">Email</a>' : '') +
          (info.github ? '<a href="' + esc(info.github) + '" target="_blank" rel="noopener noreferrer" class="text-slate-400 hover:text-accent transition-colors">GitHub</a>' : '') +
          socialHtml +
        '</div>' +
      '</div>';
  }

  // ---- About ----
  function renderAbout() {
    var info = Store.getSiteInfo();
    return '<section id="about" class="mb-28 scroll-mt-24">' +
      sectionHeading('01', 'About', 'about') +
      '<div class="space-y-6 text-slate-400 leading-loose text-sm">' +
        '<p>Hello! My name is ' + esc(info.name) + '，' + esc(info.slogan) + '。</p>' +
        '<p>' + esc(info.intro) + '</p>' +
        '<p>以下是我参与或独立完成的前端项目，点击卡片查看技术细节。</p>' +
      '</div>' +
    '</section>';
  }

  // ---- Experience ----
  function renderExperience() {
    var list = Store.getExperience();
    var items = list.map(function (e) {
      return '<div class="flex gap-8 pb-10">' +
        '<div class="text-slate-500 text-sm font-mono whitespace-nowrap w-28 shrink-0">' + esc(e.time) + '</div>' +
        '<div class="flex-1">' +
          '<h3 class="text-slate-200 font-semibold text-base">' + esc(e.role) +
            '&nbsp;<span class="text-slate-400 font-normal text-sm">@ ' + esc(e.org) + '</span>' +
          '</h3>' +
          '<p class="text-slate-400 text-sm mt-3 leading-relaxed">' + esc(e.desc) + '</p>' +
          '<div class="flex flex-wrap gap-2 mt-4">' + tagPills(e.tags) + '</div>' +
        '</div>' +
      '</div>';
    }).join('');

    return '<section id="experience" class="mb-28 scroll-mt-24">' +
      sectionHeading('02', 'Experience', 'experience') +
      items +
    '</section>';
  }

  // ---- 项目卡片 HTML ----
  function projectCardHTML(p, featured) {
    var cover = p.coverUrl ? esc(p.coverUrl) : PLACEHOLDER;
    var adminAttrs = global.Admin && global.Admin.isActive
      ? 'draggable="true" data-project-id="' + esc(p.id) + '"'
      : '';

    var links = '<div class="flex items-center gap-4 mt-5">' +
      (p.demoUrl ? extLink(p.demoUrl, 'Demo', true) : '') +
      (p.githubUrl ? extLink(p.githubUrl, 'Code', true) : '') +
    '</div>';

    if (featured) {
      return '<article class="card-hover group relative rounded-lg overflow-hidden border border-navy-700 hover:border-accent/40 transition-colors bg-navy-800 ' + adminAttrs + '">' +
        '<div class="flex flex-col sm:flex-row">' +
          '<div class="sm:w-2/5 aspect-video sm:aspect-auto overflow-hidden">' +
            '<img src="' + cover + '" alt="' + esc(p.title) + '" loading="lazy" ' +
            'onerror="this.src=\'' + PLACEHOLDER + '\'" class="w-full h-full object-cover">' +
          '</div>' +
          '<div class="sm:w-3/5 p-8 flex flex-col justify-center">' +
            '<p class="text-accent font-mono text-xs mb-1">Featured Project</p>' +
            '<h3 class="text-slate-200 font-bold text-lg group-hover:text-accent transition-colors">' + esc(p.title) + '</h3>' +
            '<p class="text-slate-400 text-sm mt-3 leading-relaxed flex-1">' + esc(p.desc) + '</p>' +
            '<div class="flex flex-wrap gap-2 mt-4">' + tagPills(p.tags) + '</div>' +
            links +
          '</div>' +
        '</div>' +
      '</article>';
    }

    // other card
    return '<article class="card-hover group relative rounded-lg overflow-hidden border border-navy-700 hover:border-accent/40 transition-colors bg-navy-800 ' + adminAttrs + '">' +
      '<div class="aspect-video overflow-hidden">' +
        '<img src="' + cover + '" alt="' + esc(p.title) + '" loading="lazy" ' +
        'onerror="this.src=\'' + PLACEHOLDER + '\'" class="w-full h-full object-cover">' +
      '</div>' +
      '<div class="p-6">' +
        '<h3 class="text-slate-200 font-semibold group-hover:text-accent transition-colors">' + esc(p.title) + '</h3>' +
        '<p class="text-slate-400 text-sm mt-2 leading-relaxed line-clamp-2">' + esc(p.desc) + '</p>' +
        '<div class="flex flex-wrap gap-1.5 mt-4">' + tagPills(p.tags) + '</div>' +
        links +
      '</div>' +
    '</article>';
  }

  // ---- Featured + Other Projects ----
  function renderProjects() {
    var featured = Store.getFeaturedProjects();
    var others = Store.getOtherProjects();
    var all = Store.getProjects();

    // 搜索过滤
    var kw = searchKeyword.trim().toLowerCase();
    if (kw) {
      featured = featured.filter(function (p) {
        return matchSearch(p, kw);
      });
      others = others.filter(function (p) {
        return matchSearch(p, kw);
      });
      all = all.filter(function (p) { return matchSearch(p, kw); });
    }

    // 搜索框
    var searchBox = '<div class="mb-8 relative">' +
      '<input type="search" id="project-search" value="' + esc(searchKeyword) + '" ' +
      'placeholder="搜索项目名称或标签…" ' +
      'class="w-full bg-navy-800 border border-navy-700 rounded-lg pl-10 pr-4 py-2.5 text-sm text-slate-300 ' +
      'placeholder-slate-600 focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/30">' +
      '<svg class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">' +
      '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>' +
    '</div>';

    // 搜索结果合并模式
    var projectsHtml = '';
    if (kw) {
      var cards = all.map(function (p) { return projectCardHTML(p, false); }).join('');
      projectsHtml = searchBox +
        '<p class="text-sm text-slate-500 mb-6">共 ' + all.length + ' 个结果</p>' +
        (all.length === 0
          ? '<p class="text-slate-600 text-center py-12">没有匹配的项目，试试其他关键词。</p>'
          : '<div class="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">' + cards + '</div>');
    } else {
      // 正常分区模式
      var featuredHtml = featured.map(function (p) { return projectCardHTML(p, true); }).join('');
      var otherHtml = others.map(function (p) { return projectCardHTML(p, false); }).join('');

      projectsHtml = searchBox;

      if (featured.length) {
        projectsHtml += '<div class="space-y-8 mb-16">' + featuredHtml + '</div>';
      }

      projectsHtml +=
        '<h3 class="text-lg font-semibold text-slate-300 mb-6 flex items-center">' +
        'Other Projects' +
        '<span class="flex-1 ml-4 h-px bg-navy-700"></span>' +
        '</h3>';

      if (others.length) {
        projectsHtml += '<div class="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">' + otherHtml + '</div>';
      } else if (!featured.length) {
        // 访客模式下不暴露任何「添加作品」相关提示，仅在编辑模式显示
        var emptyHint = (global.Admin && global.Admin.isActive)
          ? '暂无项目，拖拽网页链接到上方区域即可添加。'
          : '暂无项目。';
        projectsHtml += '<p class="text-slate-600 text-center py-12">' + emptyHint + '</p>';
      }
    }

    return '<section id="featured" class="mb-28 scroll-mt-24">' +
      sectionHeading('03', 'Featured Projects', 'featured') +
      projectsHtml +
    '</section>';
  }

  function matchSearch(p, kw) {
    var hay = [p.title, p.desc, (p.tags || []).join(' ')].join(' ').toLowerCase();
    return hay.indexOf(kw) >= 0;
  }

  // ---- Footer ----
  function renderFooter() {
    var info = Store.getSiteInfo();
    return '<footer class="py-12 border-t border-navy-800 text-center text-slate-600 text-sm">' +
      esc(info.footer) +
    '</footer>';
  }

  // ---- 全量渲染 ----
  function renderContent() {
    var el = document.getElementById('content');
    if (!el) return;

    var html = renderAbout() + renderExperience() + renderProjects() + renderFooter();
    el.innerHTML = html;

    // 绑定搜索
    var search = document.getElementById('project-search');
    if (search) {
      var timer = null;
      search.addEventListener('input', function (e) {
        clearTimeout(timer);
        var val = e.target.value;
        timer = setTimeout(function () {
          searchKeyword = val;
          // 只重渲染 projects 部分
          var featured = document.getElementById('featured');
          if (featured) {
            featured.outerHTML = renderProjects();
            // 重新绑定搜索（因为 DOM 被替换了）
            var newSearch = document.getElementById('project-search');
            if (newSearch) {
              newSearch.addEventListener('input', arguments.callee);
              newSearch.focus();
              // 光标移到末尾
              var len = newSearch.value.length;
              newSearch.setSelectionRange(len, len);
            }
          }
        }, 200);
      });
    }

    // 如果管理员模式激活，追加编辑组件
    if (global.Admin && global.Admin.isActive) {
      global.Admin.mountCardActions();
      global.Admin.mountDropZone();
    }
  }

  function renderAll() {
    renderSidebar();
    renderContent();
  }

  // ---- 暴露 ----
  global.Render = {
    renderSidebar: renderSidebar,
    renderContent: renderContent,
    renderAll: renderAll,
    projectCardHTML: projectCardHTML,
    PLACEHOLDER: PLACEHOLDER,
  };
})(window);
