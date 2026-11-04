/**
 * store.js — 数据层
 * 职责：localStorage 读写、默认数据、CRUD、导入导出。
 * 上层（render.js / admin.js）只调用 Store 暴露的方法，不直接操作 localStorage。
 */
(function (global) {
  'use strict';

  var STORAGE_KEY = 'bc-portfolio-v3';
  var ADMIN_PASSWORD = 'WORLDISWORTH0924';

  // ---- 默认数据 ----
  var DEFAULT_DATA = {
    siteInfo: {
      name: '张同学',
      slogan: '构建优雅的Web体验',
      intro: '前端开发工程师，专注现代化 Web 应用开发。热爱将复杂问题转化为简洁的解决方案，擅长 Vue 生态与可视化方向。',
      avatarUrl: '',
      email: 'your.email@example.com',
      github: 'https://github.com/yourname',
      social: [],
      footer: 'Built with HTML + TailwindCSS + Vanilla JS'
    },
    experience: [
      {
        time: '2024.07 — 至今',
        role: '前端开发实习生',
        org: '某科技公司',
        desc: '参与核心业务前端架构设计，负责组件库封装与性能优化，推动工程化规范落地。',
        tags: ['Vue3', 'TypeScript', 'Vite']
      },
      {
        time: '2023.09 — 2024.06',
        role: '校园项目技术负责人',
        org: '计算机创新实验室',
        desc: '主导校园活动平台从 0 到 1 开发，负责需求分析、架构设计与前后端协调。',
        tags: ['React', 'Node.js', 'MongoDB']
      },
      {
        time: '2023.03 — 2023.09',
        role: '开源贡献者',
        org: 'GitHub',
        desc: '参与多个前端开源项目，提交 PR 修复 Bug 与新增特性，活跃于技术社区。',
        tags: ['开源', 'Git', '社区']
      }
    ],
    categories: ['Web应用', '工具', '可视化'],
    projects: [
      {
        id: 'leaflet-global-map',
        title: 'Leaflet全球交互地图',
        date: '2025.10',
        desc: '基于Leaflet与GeoJSON实现的可交互全球地图程序，支持点位标记、信息弹窗，适配多端。',
        coverUrl: '',
        demoUrl: 'https://willowy-paletas-04cf3b.netlify.app/',
        githubUrl: '',
        tags: ['Leaflet', 'GeoJSON', 'JavaScript', 'HTML/CSS'],
        category: '可视化',
        featured: true,
        sortIndex: 0
      },
      {
        id: 'realtime-whiteboard',
        title: '实时协同白板',
        date: '2025.06',
        desc: '基于 WebSocket 的多人实时白板，支持笔迹同步、撤销重做与房间分享。',
        coverUrl: '',
        demoUrl: '',
        githubUrl: '',
        tags: ['WebSocket', 'Canvas', 'Node.js'],
        category: 'Web应用',
        featured: true,
        sortIndex: 1
      },
      {
        id: 'data-dashboard',
        title: '数据可视化大屏',
        date: '2025.03',
        desc: '面向业务监控的可视化大屏，ECharts 自定义主题与增量渲染，万级数据流畅交互。',
        coverUrl: '',
        demoUrl: '',
        githubUrl: '',
        tags: ['ECharts', 'Vue3', 'DataV'],
        category: '可视化',
        featured: true,
        sortIndex: 2
      },
      {
        id: 'campus-platform',
        title: '校园活动平台',
        date: '2024.11',
        desc: '校园活动发布与报名一体化平台，从 0 到 1 完成需求分析、架构设计与前后端协调。',
        coverUrl: '',
        demoUrl: '',
        githubUrl: '',
        tags: ['React', 'Node.js', 'MongoDB'],
        category: 'Web应用',
        featured: true,
        sortIndex: 3
      },
      {
        id: 'miniui-components',
        title: 'MiniUI 组件库',
        date: '2024.06',
        desc: '轻量级 Vue3 组件库，20+ 高频组件，完整的主题定制与按需引入方案。',
        coverUrl: '',
        demoUrl: '',
        githubUrl: '',
        tags: ['Vue3', 'TypeScript', 'Vite'],
        category: '工具',
        featured: true,
        sortIndex: 4
      },
      {
        id: 'tech-blog',
        title: '技术博客与文章集',
        date: '2024.01',
        desc: '静态站点生成的前端博客，记录学习笔记与工程实践，SSR 与 SEO 优化。',
        coverUrl: '',
        demoUrl: '',
        githubUrl: '',
        tags: ['VitePress', 'Markdown', 'SSR'],
        category: '工具',
        featured: true,
        sortIndex: 5
      }
    ],
    faq: [
      {
        q: '这个背景效果是怎么做的？',
        a: '背景是用 Canvas 绘制的程序化沙丘：多倍频噪声生成地形高度场，按坡度明暗决定沙点的疏密，没有用任何贴图。沙粒有海浪式风场，鼠标停留越久、能搅动越深的沙层。'
      },
      {
        q: '可以看一下源码吗？',
        a: '本站托管在 GitHub 上，欢迎 Star 与交流。'
      },
      {
        q: '可以使用你的代码吗？',
        a: '布局与视觉设计请不要直接整站搬运；技术实现的思路欢迎参考和讨论，注明出处即可。'
      },
      {
        q: '你是如何学习前端的？',
        a: '书籍、文档和开源项目，边做边学。推荐几个常翻的资源：',
        links: [
          { label: 'MDN Web Docs', url: 'https://developer.mozilla.org/zh-CN/' },
          { label: 'Vue 官方文档', url: 'https://cn.vuejs.org/' },
          { label: 'ECharts 示例库', url: 'https://echarts.apache.org/examples/zh/' },
          { label: 'The Book of Shaders', url: 'https://thebookofshaders.com/' }
        ]
      }
    ],
    copycats: {
      note: '参考了本站布局与视觉的作品会列在这里。',
      desc: '借鉴学习是正常的事，我也不排斥别人模仿着做自己的作品集——但请直接复制源码后改成完全一样、再署上自己的名字。如果你发现自己的网站被抄袭了，或者想告诉我你做了类似的作品，欢迎写信给我：',
      sites: []
    }
  };

  // ---- 内部状态 ----
  var state = null;
  var listeners = [];

  // ---- 工具 ----
  function deepClone(obj) {
    return JSON.parse(JSON.stringify(obj));
  }

  function mergeDefaults(data) {
    data = data || {};
    return {
      siteInfo: Object.assign({}, DEFAULT_DATA.siteInfo, data.siteInfo || {}),
      experience: Array.isArray(data.experience) ? data.experience : deepClone(DEFAULT_DATA.experience),
      categories: Array.isArray(data.categories) ? data.categories : deepClone(DEFAULT_DATA.categories),
      projects: Array.isArray(data.projects) ? data.projects : deepClone(DEFAULT_DATA.projects),
      faq: Array.isArray(data.faq) ? data.faq : deepClone(DEFAULT_DATA.faq),
      copycats: data.copycats ? Object.assign({}, DEFAULT_DATA.copycats, data.copycats) : deepClone(DEFAULT_DATA.copycats),
    };
  }

  function save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      console.warn('[Store] save failed:', e);
    }
  }

  function notify(type) {
    listeners.forEach(function (fn) { fn(type); });
  }

  // ---- 初始化 ----
  function load() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        state = mergeDefaults(JSON.parse(raw));
      } else {
        state = mergeDefaults(DEFAULT_DATA);
        save();
      }
    } catch (e) {
      console.warn('[Store] load failed, using defaults:', e);
      state = mergeDefaults(DEFAULT_DATA);
    }
  }
  load();

  // ---- Projects CRUD ----
  function getProjects() { return state.projects; }
  function getFeaturedProjects() {
    return state.projects.filter(function (p) { return p.featured; })
      .sort(function (a, b) { return (a.sortIndex || 0) - (b.sortIndex || 0); });
  }
  function getOtherProjects() {
    return state.projects.filter(function (p) { return !p.featured; })
      .sort(function (a, b) { return (a.sortIndex || 0) - (b.sortIndex || 0); });
  }
  function addProject(project) {
    project.id = project.id || ('p-' + Date.now());
    project.sortIndex = project.sortIndex != null ? project.sortIndex : state.projects.length;
    state.projects.push(project);
    save();
    notify('projects');
  }
  function updateProject(id, updates) {
    var idx = state.projects.findIndex(function (p) { return p.id === id; });
    if (idx >= 0) {
      state.projects[idx] = Object.assign({}, state.projects[idx], updates);
      save();
      notify('projects');
    }
  }
  function deleteProject(id) {
    state.projects = state.projects.filter(function (p) { return p.id !== id; });
    save();
    notify('projects');
  }
  function reorderProjects(orderedIds) {
    orderedIds.forEach(function (id, i) {
      var p = state.projects.find(function (p) { return p.id === id; });
      if (p) p.sortIndex = i;
    });
    save();
    notify('projects');
  }

  // ---- Experience CRUD ----
  function getExperience() { return state.experience; }
  function addExperience(exp) { state.experience.push(exp); save(); notify('experience'); }
  function updateExperience(index, updates) {
    if (state.experience[index]) {
      state.experience[index] = Object.assign({}, state.experience[index], updates);
      save(); notify('experience');
    }
  }
  function deleteExperience(index) {
    state.experience.splice(index, 1); save(); notify('experience');
  }

  // ---- FAQ / Copycats ----
  function getFaq() { return state.faq; }
  function getCopycats() { return state.copycats; }

  // ---- SiteInfo ----
  function getSiteInfo() { return state.siteInfo; }
  function updateSiteInfo(updates) {
    state.siteInfo = Object.assign({}, state.siteInfo, updates);
    save(); notify('siteInfo');
  }

  // ---- Categories ----
  function getCategories() { return state.categories; }
  function addCategory(cat) {
    if (!state.categories.includes(cat)) { state.categories.push(cat); save(); notify('categories'); }
  }
  function updateCategory(index, newName) {
    if (state.categories[index] !== undefined) { state.categories[index] = newName; save(); notify('categories'); }
  }
  function deleteCategory(index) {
    state.categories.splice(index, 1); save(); notify('categories');
  }

  // ---- Import / Export ----
  function exportData() { return JSON.stringify(state, null, 2); }
  function importData(jsonStr) {
    try {
      var data = JSON.parse(jsonStr);
      state = mergeDefaults(data);
      save(); notify('all');
      return true;
    } catch (e) { console.warn('[Store] import failed:', e); return false; }
  }

  function subscribe(fn) { listeners.push(fn); }

  // ---- 暴露 ----
  global.Store = {
    ADMIN_PASSWORD: ADMIN_PASSWORD,
    getProjects: getProjects,
    getFeaturedProjects: getFeaturedProjects,
    getOtherProjects: getOtherProjects,
    addProject: addProject,
    updateProject: updateProject,
    deleteProject: deleteProject,
    reorderProjects: reorderProjects,
    getExperience: getExperience,
    addExperience: addExperience,
    updateExperience: updateExperience,
    deleteExperience: deleteExperience,
    getSiteInfo: getSiteInfo,
    updateSiteInfo: updateSiteInfo,
    getCategories: getCategories,
    getFaq: getFaq,
    getCopycats: getCopycats,
    addCategory: addCategory,
    updateCategory: updateCategory,
    deleteCategory: deleteCategory,
    exportData: exportData,
    importData: importData,
    subscribe: subscribe,
  };
})(window);
