const API = '/api';
const DEFAULT_TIMEOUT = 120_000;

async function fetchWithTimeout(url, options = {}, timeoutMs = DEFAULT_TIMEOUT) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchProjects() {
  const res = await fetchWithTimeout(`${API}/projects`, {}, 15_000);
  if (!res.ok) throw new Error('Failed to load projects');
  return res.json();
}

export async function fetchTree(project) {
  const res = await fetchWithTimeout(
    `${API}/tree?project=${encodeURIComponent(project)}`,
    {},
    120_000
  );
  if (!res.ok) throw new Error('Failed to load tree');
  return res.json();
}

/** Poll until scan completes, then return the tree. */
export async function fetchTreeWhenReady(project, { onScanning } = {}) {
  const maxAttempts = 600;
  for (let i = 0; i < maxAttempts; i++) {
    const tree = await fetchTree(project);
    if (tree.status === 'scanning') {
      onScanning?.();
      await new Promise((r) => setTimeout(r, 1000));
      continue;
    }
    return tree;
  }
  throw new Error('Timed out waiting for project scan');
}

export async function fetchFile(project, filePath) {
  const res = await fetchWithTimeout(
    `${API}/file?project=${encodeURIComponent(project)}&path=${encodeURIComponent(filePath)}`,
    {},
    30_000
  );
  if (!res.ok) throw new Error('Failed to load file');
  return res.json();
}

export async function searchDocs(query) {
  const res = await fetch(`${API}/search?q=${encodeURIComponent(query)}`);
  if (!res.ok) throw new Error('Search failed');
  return res.json();
}

export async function refreshProject(project) {
  const res = await fetch(`${API}/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(project ? { project } : {}),
  });
  if (!res.ok) throw new Error('Refresh failed');
  return res.json();
}

export async function openProjectFolder(project) {
  const res = await fetch(`${API}/open-project`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ project }),
  });
  if (!res.ok) throw new Error('Failed to open project folder');
  return res.json();
}

export async function revealInFolder(project, filePath) {
  const res = await fetch(`${API}/reveal`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ project, path: filePath }),
  });
  if (!res.ok) throw new Error('Failed to open folder');
  return res.json();
}

export async function openInCursor(project, filePath) {
  const res = await fetch(`${API}/cursor`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ project, path: filePath }),
  });
  if (!res.ok) throw new Error('Failed to open in Cursor');
  return res.json();
}

export function assetUrl(project, filePath) {
  return `${API}/raw?project=${encodeURIComponent(project)}&path=${encodeURIComponent(filePath)}`;
}
