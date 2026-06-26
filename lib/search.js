import { glob } from 'glob';
import fs from 'fs/promises';
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
const MAX_RESULTS = 50;
const SNIPPET_RADIUS = 80;

export async function searchProjects(projects, query) {
  const q = query.trim().toLowerCase();
  if (!q) return [];

  const results = [];

  for (const project of projects) {
    const files = await glob('**/*.md', {
      cwd: project.path,
      nodir: true,
      ignore: IGNORE,
      posix: true,
    });

    for (const filePath of files) {
      if (results.length >= MAX_RESULTS) break;

      const fullPath = path.join(project.path, filePath);
      let content;
      try {
        content = await fs.readFile(fullPath, 'utf-8');
      } catch {
        continue;
      }

      const lower = content.toLowerCase();
      const idx = lower.indexOf(q);
      if (idx === -1) continue;

      const start = Math.max(0, idx - SNIPPET_RADIUS);
      const end = Math.min(content.length, idx + q.length + SNIPPET_RADIUS);
      let snippet = content.slice(start, end).replace(/\s+/g, ' ').trim();
      if (start > 0) snippet = '…' + snippet;
      if (end < content.length) snippet = snippet + '…';

      results.push({
        project: project.name,
        path: filePath,
        name: path.basename(filePath),
        snippet,
      });
    }

    if (results.length >= MAX_RESULTS) break;
  }

  return results;
}
