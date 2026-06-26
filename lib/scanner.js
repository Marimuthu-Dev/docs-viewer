import { glob } from 'glob';
import path from 'path';

const IGNORE = [
  '**/node_modules/**',
  '**/.git/**',
  '**/.cursor/**',
  '**/dist/**',
  '**/build/**',
  '**/.next/**',
  '**/coverage/**',
  '**/vendor/**',
  '**/.cache/**',
  '**/target/**',
  '**/__pycache__/**',
  '**/.venv/**',
  '**/venv/**',
];

export async function scanProject(projectRoot) {
  const files = await glob('**/*.md', {
    cwd: projectRoot,
    nodir: true,
    ignore: IGNORE,
    posix: true,
    absolute: false,
  });

  return buildTree(files.sort());
}

function buildTree(files) {
  const root = { name: '', type: 'folder', children: [] };

  for (const filePath of files) {
    const parts = filePath.split('/');
    let current = root;

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const isFile = i === parts.length - 1;

      if (isFile) {
        current.children.push({
          name: part,
          type: 'file',
          path: filePath,
        });
      } else {
        let folder = current.children.find(
          (c) => c.type === 'folder' && c.name === part
        );
        if (!folder) {
          folder = { name: part, type: 'folder', children: [] };
          current.children.push(folder);
        }
        current = folder;
      }
    }
  }

  sortTree(root);
  return root;
}

function sortTree(node) {
  if (!node.children) return;

  node.children.sort((a, b) => {
    if (a.type !== b.type) return a.type === 'folder' ? -1 : 1;
    return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
  });

  for (const child of node.children) {
    sortTree(child);
  }
}

export function getWatchPaths(projectRoot) {
  return [projectRoot];
}
