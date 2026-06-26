import * as api from './js/api.js';
import * as storage from './js/storage.js';
import {
  initMarkdown,
  renderMarkdown,
  extractToc,
  renderMermaid,
  attachCopyButtons,
  setFileContext,
  formatBytes,
  formatDate,
} from './js/markdown.js';
import {
  initTree,
  renderTree,
  setActivePath,
  expandToPath,
  loadExpanded,
  saveExpanded,
  setFilter,
} from './js/tree.js';
import { initResizer, applyPanelWidth } from './js/resizer.js';

const $ = (sel) => document.querySelector(sel);

const els = {
  sidebar: $('#sidebar'),
  projectSelect: $('#project-select'),
  fileTree: $('#file-tree'),
  treeFilter: $('#tree-filter'),
  breadcrumb: $('#breadcrumb'),
  searchTrigger: $('#search-trigger'),
  markdownContainer: $('#markdown-container'),
  markdownContent: $('#markdown-content'),
  viewer: $('#viewer'),
  welcome: $('#welcome'),
  sidebarResizer: $('#sidebar-resizer'),
  tocResizer: $('#toc-resizer'),
  toc: $('#toc'),
  tocPanel: $('#toc-panel'),
  fileMeta: $('#file-meta'),
  metaName: $('#meta-name'),
  metaSize: $('#meta-size'),
  metaModified: $('#meta-modified'),
  loading: $('#loading'),
  toast: $('#toast'),
  searchModal: $('#search-modal'),
  modalSearchInput: $('#modal-search-input'),
  searchResults: $('#search-results'),
  recentList: $('#recent-list'),
  favoritesList: $('#favorites-list'),
  btnFavorite: $('#btn-favorite'),
  btnOpenFolder: $('#btn-open-folder'),
  btnCopyMd: $('#btn-copy-md'),
  btnCursor: $('#btn-cursor'),
  btnReveal: $('#btn-reveal'),
  btnRefresh: $('#btn-refresh'),
  btnTheme: $('#btn-theme'),
  sidebarToggle: $('#sidebar-toggle'),
  sidebarClose: $('#sidebar-close'),
  tocClose: $('#toc-close'),
};

const state = {
  projects: [],
  currentProject: null,
  tree: null,
  currentFile: null,
  rawContent: '',
  searchTimer: null,
};

function showLoading(show) {
  els.loading.classList.toggle('hidden', !show);
}

function showToast(message) {
  els.toast.textContent = message;
  els.toast.classList.remove('hidden');
  clearTimeout(showToast._timer);
  showToast._timer = setTimeout(() => els.toast.classList.add('hidden'), 2500);
}

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  const isDark = theme === 'dark';
  els.btnTheme.querySelector('.icon-sun').classList.toggle('hidden', !isDark);
  els.btnTheme.querySelector('.icon-moon').classList.toggle('hidden', isDark);
  storage.setTheme(theme);
}

function toggleSidebar() {
  const collapsed = document.body.classList.toggle('sidebar-collapsed');
  storage.setSidebarCollapsed(collapsed);
}

function renderBreadcrumb(project, filePath) {
  if (!filePath) {
    els.breadcrumb.innerHTML = `<span class="crumb">${escapeHtml(project)}</span>`;
    return;
  }

  const parts = filePath.split('/');
  let html = `<span class="crumb">${escapeHtml(project)}</span>`;
  let acc = '';

  for (let i = 0; i < parts.length; i++) {
    acc = acc ? `${acc}/${parts[i]}` : parts[i];
    const isLast = i === parts.length - 1;
    html += `<span class="crumb-sep">/</span>`;
    if (isLast) {
      html += `<span class="crumb current">${escapeHtml(parts[i])}</span>`;
    } else {
      html += `<span class="crumb">${escapeHtml(parts[i])}</span>`;
    }
  }

  els.breadcrumb.innerHTML = html;
}

function renderToc(headings) {
  if (!headings.length) {
    els.toc.innerHTML = '<p class="toc-empty">No headings</p>';
    return;
  }

  els.toc.innerHTML = headings
    .map(
      (h) =>
        `<a href="#${h.id}" class="toc-link depth-${h.depth}">${escapeHtml(h.text)}</a>`
    )
    .join('');

  els.toc.querySelectorAll('a').forEach((link) => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const target = document.getElementById(link.getAttribute('href').slice(1));
      target?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });
}

function renderMiniList(listEl, items, emptyText) {
  if (!items.length) {
    listEl.innerHTML = `<li class="mini-empty">${emptyText}</li>`;
    return;
  }

  listEl.innerHTML = items
    .map(
      (item) =>
        `<li><button type="button" class="mini-link" data-project="${escapeAttr(item.project)}" data-path="${escapeAttr(item.path)}">${escapeHtml(item.name || item.path)}</button></li>`
    )
    .join('');

  listEl.querySelectorAll('.mini-link').forEach((btn) => {
    btn.addEventListener('click', () => {
      selectProject(btn.dataset.project).then(() => openFile(btn.dataset.path));
    });
  });
}

function refreshSidebarLists() {
  renderMiniList(els.recentList, storage.getRecent(), 'No recent files');
  renderMiniList(els.favoritesList, storage.getFavorites(), 'No favorites yet');
}

function updateToolbarState() {
  const hasFile = !!state.currentFile;
  els.btnFavorite.disabled = !hasFile;
  els.btnCopyMd.disabled = !hasFile;
  els.btnCursor.disabled = !hasFile;
  els.btnReveal.disabled = !hasFile;

  if (hasFile) {
    const fav = storage.isFavorite(state.currentProject, state.currentFile.path);
    els.btnFavorite.classList.toggle('active', fav);
  } else {
    els.btnFavorite.classList.remove('active');
  }
}

function showTreeLoading(message = 'Scanning markdown files…') {
  els.fileTree.innerHTML = `<p class="tree-loading"><span class="tree-spinner"></span>${escapeHtml(message)}</p>`;
}

async function selectProject(name) {
  if (state.currentProject === name && state.tree?.status === 'ready') return;

  state.currentProject = name;
  storage.setSelectedProject(name);
  els.projectSelect.value = name;
  showTreeLoading();

  try {
    loadExpanded(name);
    state.tree = await api.fetchTreeWhenReady(name, {
      onScanning: () => showTreeLoading('Scanning markdown files…'),
    });
    renderTree(els.fileTree, state.tree, {
      onFileSelect: openFile,
      filter: els.treeFilter.value,
    });
    renderBreadcrumb(name, state.currentFile?.path);
  } catch (err) {
    els.fileTree.innerHTML = `<p class="tree-empty">${escapeHtml(err.message)}</p>`;
    showToast(err.message);
  }
}

async function openFile(filePath) {
  if (!state.currentProject || !filePath) return;

  showLoading(true);
  try {
    const data = await api.fetchFile(state.currentProject, filePath);
    state.currentFile = data;
    state.rawContent = data.content;

    setFileContext(state.currentProject, filePath);
    storage.setLastFile(state.currentProject, filePath);
    storage.addRecent(state.currentProject, filePath, data.name);

    expandToPath(state.tree, filePath);
    saveExpanded(state.currentProject);
    setActivePath(filePath);
    renderTree(els.fileTree, state.tree, {
      onFileSelect: openFile,
      filter: els.treeFilter.value,
    });

    renderBreadcrumb(state.currentProject, filePath);

    els.welcome.classList.add('hidden');
    els.markdownContainer.classList.remove('hidden');

    const html = await renderMarkdown(data.content);
    els.markdownContent.innerHTML = html;

    await renderMermaid(els.markdownContent);
    attachCopyButtons(els.markdownContent);

    const headings = extractToc(data.content);
    renderToc(headings);

    els.fileMeta.classList.remove('hidden');
    els.metaName.textContent = data.name;
    els.metaSize.textContent = formatBytes(data.size);
    els.metaModified.textContent = `Modified ${formatDate(data.modified)}`;

    refreshSidebarLists();
    updateToolbarState();
  } catch (err) {
    showToast(err.message);
  } finally {
    showLoading(false);
  }
}

function openSearchModal() {
  els.searchModal.classList.remove('hidden');
  els.modalSearchInput.value = '';
  els.searchResults.innerHTML = '';
  els.modalSearchInput.focus();
}

function closeSearchModal() {
  els.searchModal.classList.add('hidden');
}

async function runSearch(query) {
  clearTimeout(state.searchTimer);
  if (!query.trim()) {
    els.searchResults.innerHTML = '';
    return;
  }

  state.searchTimer = setTimeout(async () => {
    try {
      const results = await api.searchDocs(query);
      if (!results.length) {
        els.searchResults.innerHTML = '<li class="search-empty">No results found</li>';
        return;
      }

      els.searchResults.innerHTML = results
        .map(
          (r) =>
            `<li><button type="button" class="search-result" data-project="${escapeAttr(r.project)}" data-path="${escapeAttr(r.path)}">
              <span class="result-path">${escapeHtml(r.project)} / ${escapeHtml(r.path)}</span>
              <span class="result-snippet">${escapeHtml(r.snippet)}</span>
            </button></li>`
        )
        .join('');

      els.searchResults.querySelectorAll('.search-result').forEach((btn) => {
        btn.addEventListener('click', () => {
          closeSearchModal();
          selectProject(btn.dataset.project).then(() => openFile(btn.dataset.path));
        });
      });
    } catch (err) {
      showToast(err.message);
    }
  }, 250);
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function escapeAttr(str) {
  return String(str).replace(/"/g, '&quot;');
}

function initPanelResizers() {
  applyPanelWidth('--sidebar-width', storage.getSidebarWidth());
  applyPanelWidth('--toc-width', storage.getTocWidth());

  initResizer({
    handle: els.sidebarResizer,
    cssVar: '--sidebar-width',
    min: 180,
    max: 480,
    onResize: (w, done) => {
      if (done) storage.setSidebarWidth(w);
    },
  });

  initResizer({
    handle: els.tocResizer,
    cssVar: '--toc-width',
    min: 160,
    max: 400,
    invert: true,
    onResize: (w, done) => {
      if (done) storage.setTocWidth(w);
    },
  });
}

function bindEvents() {
  initTree(els.fileTree, {
    onFileSelect: openFile,
    onExpandedChange: () => saveExpanded(state.currentProject),
  });

  initMarkdown((mdPath) => openFile(mdPath));

  els.projectSelect.addEventListener('change', () => {
    state.currentFile = null;
    state.rawContent = '';
    selectProject(els.projectSelect.value);
    updateToolbarState();
  });

  els.treeFilter.addEventListener('input', () => {
    setFilter(els.treeFilter.value);
    renderTree(els.fileTree, state.tree, {
      onFileSelect: openFile,
      filter: els.treeFilter.value,
    });
  });

  els.searchTrigger.addEventListener('click', openSearchModal);

  els.modalSearchInput.addEventListener('input', (e) => runSearch(e.target.value));
  els.searchModal.querySelector('.search-backdrop').addEventListener('click', closeSearchModal);

  els.btnRefresh.addEventListener('click', async () => {
    showTreeLoading('Refreshing…');
    try {
      await api.refreshProject(state.currentProject);
      state.tree = await api.fetchTreeWhenReady(state.currentProject, {
        onScanning: () => showTreeLoading('Refreshing…'),
      });
      renderTree(els.fileTree, state.tree, {
        onFileSelect: openFile,
        filter: els.treeFilter.value,
      });
      if (state.currentFile) await openFile(state.currentFile.path);
      showToast('Refreshed');
    } catch (err) {
      showToast(err.message);
    }
  });

  els.btnTheme.addEventListener('click', () => {
    const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    applyTheme(next);
  });

  els.btnFavorite.addEventListener('click', () => {
    if (!state.currentFile) return;
    const added = storage.toggleFavorite(
      state.currentProject,
      state.currentFile.path,
      state.currentFile.name
    );
    showToast(added ? 'Added to favorites' : 'Removed from favorites');
    refreshSidebarLists();
    updateToolbarState();
  });

  els.btnOpenFolder.addEventListener('click', async () => {
    if (!state.currentProject) return;
    try {
      await api.openProjectFolder(state.currentProject);
      showToast('Opened project folder');
    } catch (err) {
      showToast(err.message);
    }
  });

  els.btnCopyMd.addEventListener('click', async () => {
    if (!state.rawContent) return;
    try {
      await navigator.clipboard.writeText(state.rawContent);
      showToast('Markdown copied');
    } catch {
      showToast('Copy failed');
    }
  });

  els.btnCursor.addEventListener('click', async () => {
    if (!state.currentFile) return;
    try {
      await api.openInCursor(state.currentProject, state.currentFile.path);
      showToast('Opened in Cursor');
    } catch (err) {
      showToast(err.message);
    }
  });

  els.btnReveal.addEventListener('click', async () => {
    if (!state.currentFile) return;
    try {
      await api.revealInFolder(state.currentProject, state.currentFile.path);
      showToast('Opened folder');
    } catch (err) {
      showToast(err.message);
    }
  });

  els.sidebarToggle.addEventListener('click', toggleSidebar);
  els.sidebarClose.addEventListener('click', toggleSidebar);
  els.tocClose.addEventListener('click', () => {
    els.tocPanel.classList.add('hidden-mobile');
  });

  document.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.key === 'k') {
      e.preventDefault();
      openSearchModal();
    }
    if (e.ctrlKey && e.key === 'b') {
      e.preventDefault();
      toggleSidebar();
    }
    if (e.key === 'Escape' && !els.searchModal.classList.contains('hidden')) {
      closeSearchModal();
    }
  });
}

async function init() {
  applyTheme(storage.getTheme());

  if (storage.getSidebarCollapsed()) {
    document.body.classList.add('sidebar-collapsed');
  }

  bindEvents();
  initPanelResizers();
  refreshSidebarLists();
  showTreeLoading('Connecting…');

  try {
    state.projects = await api.fetchProjects();
    els.projectSelect.innerHTML = state.projects
      .map((p) => `<option value="${escapeAttr(p.name)}">${escapeHtml(p.name)}</option>`)
      .join('');

    const savedProject = storage.getSelectedProject();
    const projectName =
      state.projects.find((p) => p.name === savedProject)?.name ??
      state.projects[0]?.name;

    if (projectName) {
      await selectProject(projectName);

      const last = storage.getLastFile();
      if (last && last.project === projectName && state.tree?.status === 'ready') {
        openFile(last.path);
      }
    }
  } catch (err) {
    els.fileTree.innerHTML = `<p class="tree-empty">${escapeHtml(err.message)}</p>`;
    showToast(err.message);
  }
}

init();
