const PREFIX = 'docs-hub:';

const keys = {
  theme: `${PREFIX}theme`,
  sidebar: `${PREFIX}sidebar`,
  lastFile: `${PREFIX}last-file`,
  recent: `${PREFIX}recent`,
  favorites: `${PREFIX}favorites`,
  expanded: `${PREFIX}expanded`,
  project: `${PREFIX}project`,
  sidebarWidth: `${PREFIX}sidebar-width`,
  tocWidth: `${PREFIX}toc-width`,
};

function read(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function write(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

export function getTheme() {
  return read(keys.theme, 'dark');
}

export function setTheme(theme) {
  write(keys.theme, theme);
}

export function getSidebarCollapsed() {
  return read(keys.sidebar, false);
}

export function setSidebarCollapsed(collapsed) {
  write(keys.sidebar, collapsed);
}

export function getLastFile() {
  return read(keys.lastFile, null);
}

export function setLastFile(project, path) {
  write(keys.lastFile, { project, path });
}

export function getRecent() {
  return read(keys.recent, []);
}

export function addRecent(project, path, name) {
  const recent = getRecent().filter(
    (r) => !(r.project === project && r.path === path)
  );
  recent.unshift({ project, path, name, at: Date.now() });
  write(keys.recent, recent.slice(0, 15));
}

export function getFavorites() {
  return read(keys.favorites, []);
}

export function toggleFavorite(project, path, name) {
  const favorites = getFavorites();
  const idx = favorites.findIndex(
    (f) => f.project === project && f.path === path
  );
  if (idx >= 0) {
    favorites.splice(idx, 1);
  } else {
    favorites.unshift({ project, path, name });
  }
  write(keys.favorites, favorites);
  return idx < 0;
}

export function isFavorite(project, path) {
  return getFavorites().some(
    (f) => f.project === project && f.path === path
  );
}

export function getExpandedFolders(project) {
  const all = read(keys.expanded, {});
  return all[project] ?? [];
}

export function setExpandedFolders(project, paths) {
  const all = read(keys.expanded, {});
  all[project] = paths;
  write(keys.expanded, all);
}

export function getSelectedProject() {
  return read(keys.project, null);
}

export function setSelectedProject(name) {
  write(keys.project, name);
}

export function getSidebarWidth() {
  return read(keys.sidebarWidth, null);
}

export function setSidebarWidth(width) {
  write(keys.sidebarWidth, width);
}

export function getTocWidth() {
  return read(keys.tocWidth, null);
}

export function setTocWidth(width) {
  write(keys.tocWidth, width);
}
