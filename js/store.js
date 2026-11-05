/**
 * store.js — 数据层
 * 职责：localStorage 读写、默认数据、CRUD、导入导出。
 * 上层（render.js / admin.js）只调用 Store 暴露的方法，不直接操作 localStorage。
 */
(function (global) {
  'use strict';

  var STORAGE_KEY = 'bc-portfolio-v5';
  var ADMIN_PASSWORD = 'WORLDISWORTH0924';

  // ---- 默认数据（真实信息，不含虚构实习/公司） ----
  var DEFAULT_DATA = {
    siteInfo: {
      name: '闫雅欣',
      slogan: '用 AI 把想法变成能上线的作品',
      intro: '在校学生，前端方向自学。习惯和 AI 结对做完整项目——拆需求、写代码、调样式、部署上线，把想法变成能访问的页面。',
      avatarUrl: '',
      email: 'yyex1114@qq.com',
      github: 'https://github.com/yyex-1',
      social: [],
      footer: 'Built with HTML + Canvas + Vanilla JS'
    },
    experience: [
      {
        time: '2026',
        role: '校赛一等奖 · 团队作品',
        org: '「工行杯」大学生金融科技创新大赛',
        desc: '与团队完整走完选题、方案与演示，我负责前端界面与交互实现，作品获校赛一等奖。',
        tags: ['团队协作', '前端实现']
      },
      {
        time: '2026',
        role: '足迹地图 · 全球足迹记录（个人项目）',
        org: '课程实践',
        desc: '用 Leaflet + TopoJSON 把「去过哪里」画成可染色的世界地图，按大洲/国家/省份统计足迹，支持导出分享海报与离线加载。',
        tags: ['Leaflet', 'TopoJSON', 'Canvas']
      },
      {
        time: '持续',
        role: 'AI 辅助开发实践',
        org: '自学',
        desc: '用 AI 结对的方式学前端：拆需求、读文档、写代码、调试与部署，独立做出作品集站点与足迹地图两个上线项目。',
        tags: ['AI 协作', '调试', '部署']
      }
    ],
    categories: ['Web应用', '可视化', '工具'],
    projects: [
      {
        id: 'wander-pins',
        title: 'Wander Pins',
        date: '2026',
        desc: '足迹地图 · 全球足迹记录：用 Leaflet + TopoJSON 把「去过哪里」画成可染色的世界地图——点位落在真实行政区划内自动染色，按大洲/国家/省份统计足迹，一键导出 1080×1920 分享海报；地图与依赖全部本地化，断网也能演示。',
        coverUrl: '',
        demoUrl: 'https://yyex-1.github.io/wander-pins/',
        githubUrl: 'https://github.com/yyex-1/wander-pins',
        tags: ['Leaflet', 'TopoJSON', 'Canvas'],
        category: '可视化',
        featured: true,
        sortIndex: 0
      },
      {
        id: 'portfolio-site',
        title: '作品集站点',
        date: '2026',
        desc: '本站：Canvas 程序化沙丘背景 + 极简排版，纯静态部署在 GitHub Pages，不用任何框架。',
        coverUrl: '',
        demoUrl: 'https://yyex-1.github.io/portfolio-demo/',
        githubUrl: 'https://github.com/yyex-1/portfolio-demo',
        tags: ['Canvas', 'Vanilla JS', 'GitHub Pages'],
        category: 'Web应用',
        featured: true,
        sortIndex: 1
      }
    ],
    faq: [
      {
        q: '这个背景效果是怎么做的？',
        a: '背景是用 Canvas 绘制的程序化沙丘：多倍频噪声生成地形高度场，按坡度明暗决定沙点的疏密，没有用任何贴图。沙粒有海浪式风场，鼠标停留越久、能搅动越深的沙层。'
      },
      {
        q: '可以看一下源码吗？',
        a: '可以，本站和足迹地图都开源在 GitHub（yyex-1），欢迎 Star 与交流。',
        links: [
          { label: 'portfolio-demo — 本站源码', url: 'https://github.com/yyex-1/portfolio-demo' },
          { label: 'wander-pins — 足迹地图', url: 'https://github.com/yyex-1/wander-pins' }
        ]
      },
      {
        q: '可以使用你的代码吗？',
        a: '布局与视觉设计请不要直接整站搬运；技术实现的思路欢迎参考和讨论，注明出处即可。'
      },
      {
        q: '你是如何学习前端的？',
        a: '以做项目为主：遇到问题先查文档，再和 AI 一起拆解、写代码、调试。常翻的几个资源：',
        links: [
          { label: 'MDN Web Docs', url: 'https://developer.mozilla.org/zh-CN/' },
          { label: 'Leaflet 文档', url: 'https://leafletjs.com/' },
          { label: 'TopoJSON 说明', url: 'https://github.com/topojson/topojson-client' },
          { label: 'The Book of Shaders', url: 'https://thebookofshaders.com/' }
        ]
      }
    ]
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

  // ---- FAQ ----
  function getFaq() { return state.faq; }

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
    addCategory: addCategory,
    updateCategory: updateCategory,
    deleteCategory: deleteCategory,
    exportData: exportData,
    importData: importData,
    subscribe: subscribe,
  };
})(window);
