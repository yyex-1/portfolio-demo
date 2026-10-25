/**
 * admin.js — 管理员编辑模式
 * 核心原则：访客模式下 DOM 不存在任何编辑元素（不是隐藏，是不渲染）。
 * 密码验证通过后才动态挂载编辑组件。
 */
(function (global) {
  'use strict';

  var Store = global.Store;
  var Render = global.Render;
  var PASSWORD = Store.ADMIN_PASSWORD;

  var isActive = false;
  var dropZoneEl = null;
  var settingsDrawerEl = null;

  // ---- 工具 ----
  function esc(str) {
    var d = document.createElement('div');
    d.textContent = str || '';
    return d.innerHTML;
  }

  function showToast(msg) {
    var t = document.createElement('div');
    t.className = 'fixed bottom-6 left-1/2 -translate-x-1/2 z-[200] px-5 py-3 bg-navy-800 border border-navy-700 rounded-lg text-sm text-slate-200 shadow-2xl modal-fade';
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(function () { t.remove(); }, 2500);
  }

  function isValidUrl(str) {
    try { new URL(str); return true; } catch (e) { return false; }
  }

  // ---- 密码弹窗 ----
  function openPasswordModal() {
    var modal = document.createElement('div');
    modal.id = 'password-modal';
    modal.className = 'fixed inset-0 z-[100] bg-black/60 flex items-center justify-center modal-fade';
    modal.innerHTML =
      '<div class="bg-navy-800 border border-navy-700 rounded-xl p-6 w-full max-w-sm mx-4">' +
        '<h2 class="text-slate-200 font-semibold text-lg mb-1">管理员验证</h2>' +
        '<p class="text-slate-500 text-sm mb-4">输入密码进入编辑模式</p>' +
        '<input type="password" id="pwd-input" ' +
          'class="w-full bg-navy-900 border border-navy-700 rounded-lg px-4 py-2.5 text-sm text-slate-200 ' +
          'placeholder="密码" focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/30" ' +
          'autocomplete="off">' +
        '<p id="pwd-error" class="text-red-400 text-sm mt-2 hidden">密码错误，请重试。</p>' +
        '<div class="flex gap-3 mt-4">' +
          '<button id="pwd-cancel" class="flex-1 px-4 py-2 rounded-lg border border-navy-700 text-slate-400 text-sm hover:bg-navy-700">取消</button>' +
          '<button id="pwd-submit" class="flex-1 px-4 py-2 rounded-lg bg-accent text-navy-900 font-semibold text-sm hover:opacity-90">确认</button>' +
        '</div>' +
      '</div>';

    document.body.appendChild(modal);

    function close() { modal.remove(); }
    function submit() {
      var input = modal.querySelector('#pwd-input');
      if (input.value === PASSWORD) {
        close();
        enter();
      } else {
        modal.querySelector('#pwd-error').classList.remove('hidden');
        input.value = '';
        input.focus();
      }
    }

    modal.querySelector('#pwd-cancel').addEventListener('click', close);
    modal.querySelector('#pwd-submit').addEventListener('click', submit);
    modal.addEventListener('click', function (e) { if (e.target === modal) close(); });
    modal.querySelector('#pwd-input').addEventListener('keydown', function (e) {
      if (e.key === 'Enter') submit();
      if (e.key === 'Escape') close();
    });
    // 聚焦
    setTimeout(function () { modal.querySelector('#pwd-input').focus(); }, 50);
  }

  // ---- 进入/退出编辑模式 ----
  function enter() {
    isActive = true;
    updateLockIcon();
    mountAdminUI();
    Render.renderAll();
    showToast('已进入编辑模式');
  }

  function exit() {
    isActive = false;
    updateLockIcon();
    unmountAdminUI();
    Render.renderAll();
    showToast('已退出编辑模式');
  }

  function updateLockIcon() {
    var btn = document.getElementById('lock-toggle');
    if (!btn) return;
    if (isActive) {
      btn.title = '退出编辑模式';
      btn.innerHTML = '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M8 11V7a4 4 0 00-8 0v4M5 15v2m6-2v6H3v-6h8zm10-4V7a4 4 0 10-8 0v4m5 0v6h-6v-2"/></svg>';
      btn.classList.add('text-accent');
      btn.classList.remove('text-slate-600');
    } else {
      btn.title = '管理员入口';
      btn.innerHTML = '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/></svg>';
      btn.classList.remove('text-accent');
      btn.classList.add('text-slate-600');
    }
  }

  // ---- 挂载/卸载管理组件 ----
  function mountAdminUI() {
    // 设置入口按钮（右上角锁旁边）
    var settingsBtn = document.createElement('button');
    settingsBtn.id = 'settings-trigger';
    settingsBtn.className = 'fixed top-4 right-14 z-50 text-slate-600 hover:text-accent transition-colors opacity-50 hover:opacity-100';
    settingsBtn.title = '网站设置';
    settingsBtn.innerHTML = '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/></svg>';
    settingsBtn.addEventListener('click', function () { openSettingsDrawer(); });
    document.body.appendChild(settingsBtn);
  }

  function unmountAdminUI() {
    var el;
    el = document.getElementById('admin-dropzone'); if (el) el.remove();
    el = document.getElementById('settings-trigger'); if (el) el.remove();
    el = document.getElementById('settings-drawer'); if (el) el.remove();
    el = document.getElementById('edit-modal'); if (el) el.remove();
    el = document.getElementById('delete-modal'); if (el) el.remove();
    dropZoneEl = null;
    settingsDrawerEl = null;
  }

  // ---- 拖拽投放区 ----
  function mountDropZone() {
    var content = document.getElementById('content');
    if (!content) return;
    // 移除旧的
    var old = document.getElementById('admin-dropzone');
    if (old) old.remove();

    var dz = document.createElement('div');
    dz.id = 'admin-dropzone';
    dz.className = 'mb-8 p-6 border-2 border-dashed border-navy-700 rounded-lg text-center text-slate-500 ' +
      'hover:border-accent/40 hover:text-accent transition-colors cursor-pointer';
    dz.innerHTML = '<p class="text-sm">📎 拖拽网页链接到此处，自动新增作品 &nbsp;|&nbsp; 或点击手动添加</p>';

    // 拖拽事件
    dz.addEventListener('dragover', function (e) {
      e.preventDefault();
      dz.classList.add('dropzone-active');
    });
    dz.addEventListener('dragleave', function () {
      dz.classList.remove('dropzone-active');
    });
    dz.addEventListener('drop', function (e) {
      e.preventDefault();
      dz.classList.remove('dropzone-active');
      var url = e.dataTransfer.getData('text/uri-list') || e.dataTransfer.getData('text/plain');
      if (url && isValidUrl(url)) {
        var title = '';
        try { title = new URL(url).hostname.replace('www.', ''); } catch (err) { title = ''; }
        openEditModal(null, { demoUrl: url, title: title });
      } else {
        showToast('请拖拽有效的网页链接');
      }
    });
    // 点击手动添加
    dz.addEventListener('click', function () { openEditModal(null); });

    content.insertBefore(dz, content.firstChild);
    dropZoneEl = dz;
  }

  // ---- 卡片编辑/删除按钮 ----
  function mountCardActions() {
    var cards = document.querySelectorAll('#content article[data-project-id]');
    cards.forEach(function (card) {
      var id = card.getAttribute('data-project-id');
      // 移除旧按钮
      var oldBtns = card.querySelector('.card-admin-actions');
      if (oldBtns) oldBtns.remove();

      var btns = document.createElement('div');
      btns.className = 'card-admin-actions absolute top-2 right-2 flex gap-1 z-10';
      btns.innerHTML =
        '<button class="p-1.5 rounded bg-navy-900/80 border border-navy-700 text-slate-400 hover:text-accent hover:border-accent/50 transition-colors" title="编辑">' +
          '<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>' +
        '</button>' +
        '<button class="p-1.5 rounded bg-navy-900/80 border border-navy-700 text-slate-400 hover:text-red-400 hover:border-red-400/50 transition-colors" title="删除">' +
          '<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>' +
        '</button>';

      // 确保 card 是 relative
      card.style.position = 'relative';
      card.appendChild(btns);

      btns.children[0].addEventListener('click', function (e) {
        e.stopPropagation();
        var p = Store.getProjects().find(function (p) { return p.id === id; });
        if (p) openEditModal(p);
      });
      btns.children[1].addEventListener('click', function (e) {
        e.stopPropagation();
        openDeleteModal(id);
      });
    });

    // 卡片拖拽排序（仅 other projects 区域）
    enableCardSorting();
  }

  // ---- 卡片拖拽排序 ----
  var dragSrcId = null;
  function enableCardSorting() {
    var cards = document.querySelectorAll('#content article[data-project-id]');
    cards.forEach(function (card) {
      card.addEventListener('dragstart', function (e) {
        dragSrcId = card.getAttribute('data-project-id');
        card.classList.add('card-dragging');
        e.dataTransfer.effectAllowed = 'move';
      });
      card.addEventListener('dragend', function () {
        card.classList.remove('card-dragging');
      });
      card.addEventListener('dragover', function (e) {
        e.preventDefault();
        card.classList.add('card-drag-over');
      });
      card.addEventListener('dragleave', function () {
        card.classList.remove('card-drag-over');
      });
      card.addEventListener('drop', function (e) {
        e.preventDefault();
        card.classList.remove('card-drag-over');
        var targetId = card.getAttribute('data-project-id');
        if (dragSrcId && targetId && dragSrcId !== targetId) {
          // 获取所有卡片 ID 的当前顺序
          var allCards = document.querySelectorAll('#content article[data-project-id]');
          var ids = [];
          allCards.forEach(function (c) { ids.push(c.getAttribute('data-project-id')); });
          // 交换位置
          var srcIdx = ids.indexOf(dragSrcId);
          var tgtIdx = ids.indexOf(targetId);
          ids.splice(tgtIdx, 0, ids.splice(srcIdx, 1)[0]);
          Store.reorderProjects(ids);
          dragSrcId = null;
        }
      });
    });
  }

  // ---- 编辑/新增弹窗 ----
  function openEditModal(project, prefill) {
    var existing = document.getElementById('edit-modal');
    if (existing) existing.remove();

    var isEdit = !!project;
    var data = project || prefill || {};

    var modal = document.createElement('div');
    modal.id = 'edit-modal';
    modal.className = 'fixed inset-0 z-[100] bg-black/60 flex items-center justify-center modal-fade p-4';

    var categories = Store.getCategories();
    var catOptions = categories.map(function (c) {
      return '<option value="' + esc(c) + '"' + (data.category === c ? ' selected' : '') + '>' + esc(c) + '</option>';
    }).join('');

    modal.innerHTML =
      '<div class="bg-navy-800 border border-navy-700 rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">' +
        '<div class="p-6">' +
          '<h2 class="text-slate-200 font-semibold text-lg mb-4">' + (isEdit ? '编辑作品' : '新增作品') + '</h2>' +
          '<div class="space-y-4">' +
            field('标题', 'title', data.title || '', 'text', '项目名称') +
            field('简介', 'desc', data.desc || '', 'textarea', '一句话描述项目价值') +
            field('封面URL', 'coverUrl', data.coverUrl || '', 'text', '封面图片地址（可空）') +
            field('Demo链接', 'demoUrl', data.demoUrl || '', 'text', '在线演示地址') +
            field('GitHub源码', 'githubUrl', data.githubUrl || '', 'text', '源码仓库地址') +
            field('技术标签', 'tags', (data.tags || []).join(', '), 'text', '逗号分隔，如 Vue3,Leaflet') +
            '<div>' +
              '<label class="block text-slate-400 text-sm mb-1">分类</label>' +
              '<select id="ef-category" class="w-full bg-navy-900 border border-navy-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-accent/50">' + catOptions + '</select>' +
            '</div>' +
            '<div class="flex items-center gap-2">' +
              '<input type="checkbox" id="ef-featured" ' + (data.featured ? 'checked' : '') + ' class="rounded border-navy-700 bg-navy-900 text-accent focus:ring-accent/30">' +
              '<label for="ef-featured" class="text-slate-400 text-sm">设为精选作品</label>' +
            '</div>' +
            field('排序权重', 'sortIndex', data.sortIndex != null ? data.sortIndex : 0, 'number', '数字越小越靠前') +
          '</div>' +
          '<div class="flex gap-3 mt-6">' +
            '<button id="ef-cancel" class="flex-1 px-4 py-2.5 rounded-lg border border-navy-700 text-slate-400 text-sm hover:bg-navy-700">取消</button>' +
            '<button id="ef-save" class="flex-1 px-4 py-2.5 rounded-lg bg-accent text-navy-900 font-semibold text-sm hover:opacity-90">保存</button>' +
          '</div>' +
        '</div>' +
      '</div>';

    document.body.appendChild(modal);

    function close() { modal.remove(); }

    modal.querySelector('#ef-cancel').addEventListener('click', close);
    modal.addEventListener('click', function (e) { if (e.target === modal) close(); });
    document.addEventListener('keydown', function escClose(e) {
      if (e.key === 'Escape') { close(); document.removeEventListener('keydown', escClose); }
    });

    modal.querySelector('#ef-save').addEventListener('click', function () {
      var val = function (id) { return modal.querySelector('#' + id).value.trim(); };
      var tags = val('ef-tags').split(',').map(function (t) { return t.trim(); }).filter(Boolean);
      var payload = {
        title: val('ef-title') || '未命名项目',
        desc: val('ef-desc'),
        coverUrl: val('ef-coverUrl'),
        demoUrl: val('ef-demoUrl'),
        githubUrl: val('ef-githubUrl'),
        tags: tags,
        category: modal.querySelector('#ef-category').value,
        featured: modal.querySelector('#ef-featured').checked,
        sortIndex: parseInt(val('ef-sortIndex')) || 0,
      };

      if (isEdit) {
        Store.updateProject(project.id, payload);
        showToast('作品已更新');
      } else {
        Store.addProject(payload);
        showToast('作品已添加');
      }
      close();
    });
  }

  function field(label, id, value, type, placeholder) {
    if (type === 'textarea') {
      return '<div><label class="block text-slate-400 text-sm mb-1">' + label + '</label>' +
        '<textarea id="ef-' + id + '" rows="2" placeholder="' + esc(placeholder) + '" ' +
        'class="w-full bg-navy-900 border border-navy-700 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-accent/50">' + esc(value) + '</textarea></div>';
    }
    return '<div><label class="block text-slate-400 text-sm mb-1">' + label + '</label>' +
      '<input type="' + type + '" id="ef-' + id + '" value="' + esc(value) + '" placeholder="' + esc(placeholder) + '" ' +
      'class="w-full bg-navy-900 border border-navy-700 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-accent/50"></div>';
  }

  // ---- 删除确认弹窗 ----
  function openDeleteModal(id) {
    var modal = document.createElement('div');
    modal.id = 'delete-modal';
    modal.className = 'fixed inset-0 z-[100] bg-black/60 flex items-center justify-center modal-fade p-4';
    modal.innerHTML =
      '<div class="bg-navy-800 border border-navy-700 rounded-xl p-6 w-full max-w-sm">' +
        '<h2 class="text-slate-200 font-semibold text-lg mb-2">确认删除</h2>' +
        '<p class="text-slate-500 text-sm mb-4">删除后无法撤销，确定要删除这个作品吗？</p>' +
        '<div class="flex gap-3">' +
          '<button id="del-cancel" class="flex-1 px-4 py-2 rounded-lg border border-navy-700 text-slate-400 text-sm hover:bg-navy-700">取消</button>' +
          '<button id="del-confirm" class="flex-1 px-4 py-2 rounded-lg bg-red-500/80 text-white font-semibold text-sm hover:bg-red-500">删除</button>' +
        '</div>' +
      '</div>';

    document.body.appendChild(modal);
    function close() { modal.remove(); }
    modal.querySelector('#del-cancel').addEventListener('click', close);
    modal.addEventListener('click', function (e) { if (e.target === modal) close(); });
    modal.querySelector('#del-confirm').addEventListener('click', function () {
      Store.deleteProject(id);
      close();
      showToast('作品已删除');
    });
  }

  // ---- 设置抽屉 ----
  function openSettingsDrawer() {
    var existing = document.getElementById('settings-drawer');
    if (existing) existing.remove();

    var info = Store.getSiteInfo();
    var cats = Store.getCategories();

    var drawer = document.createElement('div');
    drawer.id = 'settings-drawer';
    drawer.className = 'fixed top-0 right-0 h-full w-full max-w-md bg-navy-850 border-l border-navy-700 z-[100] overflow-y-auto drawer-slide';

    drawer.innerHTML =
      '<div class="p-6">' +
        '<div class="flex items-center justify-between mb-6">' +
          '<h2 class="text-slate-200 font-bold text-lg">网站设置</h2>' +
          '<button id="sd-close" class="text-slate-500 hover:text-slate-200 p-1">' +
            '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>' +
          '</button>' +
        '</div>' +

        // Tab 切换
        '<div class="flex gap-1 mb-6 border-b border-navy-700">' +
          '<button data-tab="info" class="sd-tab px-4 py-2 text-sm border-b-2 border-accent text-accent">网站信息</button>' +
          '<button data-tab="cat" class="sd-tab px-4 py-2 text-sm border-b-2 border-transparent text-slate-500 hover:text-slate-300">分类管理</button>' +
          '<button data-tab="data" class="sd-tab px-4 py-2 text-sm border-b-2 border-transparent text-slate-500 hover:text-slate-300">数据备份</button>' +
        '</div>' +

        // Tab: 网站信息
        '<div id="sd-info" class="space-y-4">' +
          sdField('名字', 'si-name', info.name) +
          sdField('Slogan', 'si-slogan', info.slogan) +
          sdTextarea('简介', 'si-intro', info.intro) +
          sdField('头像链接', 'si-avatar', info.avatarUrl) +
          sdField('邮箱', 'si-email', info.email) +
          sdField('GitHub', 'si-github', info.github) +
          sdField('页脚文字', 'si-footer', info.footer) +
          '<button id="si-save" class="w-full px-4 py-2.5 rounded-lg bg-accent text-navy-900 font-semibold text-sm hover:opacity-90">保存网站信息</button>' +
        '</div>' +

        // Tab: 分类管理
        '<div id="sd-cat" class="hidden space-y-3">' +
          '<div id="cat-list">' + cats.map(function (c, i) {
            return '<div class="flex items-center gap-2 mb-2">' +
              '<input type="text" value="' + esc(c) + '" data-cat-idx="' + i + '" class="flex-1 bg-navy-900 border border-navy-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-accent/50">' +
              '<button data-cat-del="' + i + '" class="p-2 text-slate-500 hover:text-red-400"><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7"/></svg></button>' +
            '</div>';
          }).join('') + '</div>' +
          '<button id="cat-add" class="w-full px-4 py-2 rounded-lg border border-dashed border-navy-700 text-slate-500 text-sm hover:border-accent/50 hover:text-accent">+ 新增分类</button>' +
        '</div>' +

        // Tab: 数据备份
        '<div id="sd-data" class="hidden space-y-4">' +
          '<div>' +
            '<h3 class="text-slate-300 text-sm font-semibold mb-2">导出数据</h3>' +
            '<p class="text-slate-500 text-xs mb-3">下载完整网站配置与作品数据的 JSON 备份。</p>' +
            '<button id="exp-btn" class="w-full px-4 py-2.5 rounded-lg border border-navy-700 text-slate-300 text-sm hover:bg-navy-700">导出 JSON</button>' +
          '</div>' +
          '<div>' +
            '<h3 class="text-slate-300 text-sm font-semibold mb-2">导入数据</h3>' +
            '<p class="text-slate-500 text-xs mb-3">从 JSON 备份恢复，将覆盖当前所有数据。</p>' +
            '<input type="file" id="imp-file" accept=".json" class="w-full text-sm text-slate-400 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-navy-700 file:text-slate-200">' +
          '</div>' +
        '</div>' +
      '</div>';

    document.body.appendChild(drawer);
    settingsDrawerEl = drawer;

    // 遮罩
    var overlay = document.createElement('div');
    overlay.id = 'sd-overlay';
    overlay.className = 'fixed inset-0 z-[99] bg-black/40 modal-fade';
    document.body.appendChild(overlay);

    function close() { drawer.remove(); overlay.remove(); }
    drawer.querySelector('#sd-close').addEventListener('click', close);
    overlay.addEventListener('click', close);

    // Tab 切换
    drawer.querySelectorAll('.sd-tab').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var tab = btn.getAttribute('data-tab');
        drawer.querySelectorAll('.sd-tab').forEach(function (b) {
          b.classList.remove('border-accent', 'text-accent');
          b.classList.add('border-transparent', 'text-slate-500');
        });
        btn.classList.add('border-accent', 'text-accent');
        btn.classList.remove('border-transparent', 'text-slate-500');
        drawer.querySelector('#sd-info').classList.toggle('hidden', tab !== 'info');
        drawer.querySelector('#sd-cat').classList.toggle('hidden', tab !== 'cat');
        drawer.querySelector('#sd-data').classList.toggle('hidden', tab !== 'data');
      });
    });

    // 网站信息保存
    drawer.querySelector('#si-save').addEventListener('click', function () {
      var val = function (id) { return drawer.querySelector('#' + id).value.trim(); };
      Store.updateSiteInfo({
        name: val('si-name'),
        slogan: val('si-slogan'),
        intro: val('si-intro'),
        avatarUrl: val('si-avatar'),
        email: val('si-email'),
        github: val('si-github'),
        footer: val('si-footer'),
      });
      showToast('网站信息已保存');
      close();
    });

    // 分类管理
    drawer.querySelector('#cat-add').addEventListener('click', function () {
      var newName = '新分类';
      Store.addCategory(newName);
      // 重新渲染分类列表
      var catList = drawer.querySelector('#cat-list');
      var cats2 = Store.getCategories();
      catList.innerHTML = cats2.map(function (c, i) {
        return '<div class="flex items-center gap-2 mb-2">' +
          '<input type="text" value="' + esc(c) + '" data-cat-idx="' + i + '" class="flex-1 bg-navy-900 border border-navy-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-accent/50">' +
          '<button data-cat-del="' + i + '" class="p-2 text-slate-500 hover:text-red-400"><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7"/></svg></button>' +
        '</div>';
      }).join('');
      bindCatEvents();
    });

    function bindCatEvents() {
      drawer.querySelectorAll('[data-cat-idx]').forEach(function (input) {
        input.addEventListener('change', function () {
          var idx = parseInt(input.getAttribute('data-cat-idx'));
          Store.updateCategory(idx, input.value.trim());
          showToast('分类已更新');
        });
      });
      drawer.querySelectorAll('[data-cat-del]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          var idx = parseInt(btn.getAttribute('data-cat-del'));
          Store.deleteCategory(idx);
          btn.parentElement.remove();
          showToast('分类已删除');
        });
      });
    }
    bindCatEvents();

    // 导出
    drawer.querySelector('#exp-btn').addEventListener('click', function () {
      var data = Store.exportData();
      var blob = new Blob([data], { type: 'application/json' });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      a.download = 'portfolio-backup-' + new Date().toISOString().slice(0, 10) + '.json';
      a.click();
      URL.revokeObjectURL(url);
      showToast('已导出 JSON 备份');
    });

    // 导入
    drawer.querySelector('#imp-file').addEventListener('change', function (e) {
      var file = e.target.files[0];
      if (!file) return;
      var reader = new FileReader();
      reader.onload = function (ev) {
        if (Store.importData(ev.target.result)) {
          showToast('数据导入成功');
          close();
          Render.renderAll();
          if (isActive) mountCardActions();
        } else {
          showToast('导入失败：JSON 格式错误');
        }
      };
      reader.readAsText(file);
    });
  }

  function sdField(label, id, value) {
    return '<div><label class="block text-slate-400 text-sm mb-1">' + label + '</label>' +
      '<input type="text" id="' + id + '" value="' + esc(value) + '" ' +
      'class="w-full bg-navy-900 border border-navy-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-accent/50"></div>';
  }

  function sdTextarea(label, id, value) {
    return '<div><label class="block text-slate-400 text-sm mb-1">' + label + '</label>' +
      '<textarea id="' + id + '" rows="3" ' +
      'class="w-full bg-navy-900 border border-navy-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-accent/50">' + esc(value) + '</textarea></div>';
  }

  // ---- 暴露 ----
  global.Admin = {
    isActive: false, // 外部只读标志
    init: function () {
      var lockBtn = document.getElementById('lock-toggle');
      if (lockBtn) {
        lockBtn.addEventListener('click', function () {
          if (isActive) {
            exit();
          } else {
            openPasswordModal();
          }
        });
      }
    },
    enter: enter,
    exit: exit,
    mountDropZone: mountDropZone,
    mountCardActions: mountCardActions,
    openEditModal: openEditModal,
  };

  // 同步 isActive 到外部标志
  Object.defineProperty(global.Admin, 'isActive', {
    get: function () { return isActive; },
    set: function (v) { isActive = v; },
  });
})(window);
