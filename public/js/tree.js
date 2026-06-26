import { getExpandedFolders, setExpandedFolders } from './storage.js';
import { chevron, folderClosed, folderOpen, markdownFile } from './icons.js';

let expanded = new Set();
let activePath = null;
let filterText = '';

export function initTree(container, { onFileSelect, onExpandedChange }) {
  container.addEventListener('click', (e) => {
    const toggle = e.target.closest('[data-toggle]');
    if (toggle) {
      e.preventDefault();
      e.stopPropagation();
      const path = toggle.dataset.toggle;
      if (expanded.has(path)) expanded.delete(path);
      else expanded.add(path);
      onExpandedChange?.([...expanded]);
      renderTree(container, lastTree, { onFileSelect, filter: filterText });
      return;
    }

    const file = e.target.closest('[data-file]');
    if (file) {
      e.preventDefault();
      onFileSelect(file.dataset.file);
    }
  });
}

let lastTree = null;

export function setFilter(text) {
  filterText = text.toLowerCase().trim();
}

export function setExpanded(paths) {
  expanded = new Set(paths);
}

export function setActivePath(path) {
  activePath = path;
}

export function renderTree(container, tree, { onFileSelect, filter = '' }) {
  lastTree = tree;
  filterText = filter.toLowerCase().trim();

  if (!tree || !tree.children?.length) {
    container.innerHTML = '<p class="tree-empty">No markdown files found</p>';
    return;
  }

  container.innerHTML = renderNode(tree, '', filterText, 0);

  if (activePath) {
    const active = container.querySelector(`[data-file="${CSS.escape(activePath)}"]`);
    active?.classList.add('active');
    active?.scrollIntoView({ block: 'nearest' });
  }
}

function nodeMatchesFilter(node, filter) {
  if (!filter) return true;
  if (node.type === 'file') {
    return node.name.toLowerCase().includes(filter) || node.path.toLowerCase().includes(filter);
  }
  return node.children.some((c) => nodeMatchesFilter(c, filter));
}

function renderNode(node, parentPath, filter, depth) {
  if (!node.children) return '';

  return node.children
    .filter((child) => nodeMatchesFilter(child, filter))
    .map((child) => {
      if (child.type === 'folder') {
        const folderPath = parentPath ? `${parentPath}/${child.name}` : child.name;
        const isOpen = expanded.has(folderPath) || !!filter;
        const childrenHtml = isOpen ? renderNode(child, folderPath, filter, depth + 1) : '';
        const folderIcon = isOpen ? folderOpen : folderClosed;

        return `<div class="tree-folder">
          <button type="button" class="tree-item folder" data-toggle="${escapeAttr(folderPath)}" aria-expanded="${isOpen}" style="--depth:${depth}">
            <span class="tree-twistie ${isOpen ? 'expanded' : ''}">${chevron}</span>
            <span class="tree-icon">${folderIcon}</span>
            <span class="tree-label">${escapeHtml(child.name)}</span>
          </button>
          ${isOpen ? `<div class="tree-children animate-in">${childrenHtml}</div>` : ''}
        </div>`;
      }

      const isActive = activePath === child.path;
      const icon = child.name.endsWith('.md') ? markdownFile : markdownFile;

      return `<button type="button" class="tree-item file ${isActive ? 'active' : ''}" data-file="${escapeAttr(child.path)}" style="--depth:${depth}">
        <span class="tree-twistie leaf"></span>
        <span class="tree-icon">${icon}</span>
        <span class="tree-label">${escapeHtml(child.name)}</span>
      </button>`;
    })
    .join('');
}

function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function escapeAttr(str) {
  return str.replace(/"/g, '&quot;');
}

export function expandToPath(tree, filePath) {
  const parts = filePath.split('/');
  parts.pop();
  let current = tree;
  let path = '';

  for (const part of parts) {
    path = path ? `${path}/${part}` : part;
    expanded.add(path);
    current = current.children?.find((c) => c.type === 'folder' && c.name === part);
    if (!current) break;
  }
}

export function saveExpanded(project) {
  setExpandedFolders(project, [...expanded]);
}

export function loadExpanded(project) {
  expanded = new Set(getExpandedFolders(project));
}
