import chokidar from 'chokidar';
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
  '**/.DS_Store',
];

export function createWatcher(projects, onChange) {
  const roots = projects.map((p) => p.path);
  const debounceTimers = new Map();

  const watcher = chokidar.watch(roots, {
    ignored: IGNORE,
    ignoreInitial: true,
    persistent: true,
    awaitWriteFinish: { stabilityThreshold: 300, pollInterval: 100 },
  });

  const scheduleRescan = (projectName) => {
    clearTimeout(debounceTimers.get(projectName));
    debounceTimers.set(
      projectName,
      setTimeout(() => {
        debounceTimers.delete(projectName);
        onChange(projectName);
      }, 400)
    );
  };

  const findProject = (changedPath) =>
    projects.find((p) => {
      const rel = path.relative(p.path, changedPath);
      return rel && !rel.startsWith('..') && !path.isAbsolute(rel);
    });

  const handle = (changedPath) => {
    if (!changedPath.endsWith('.md')) return;
    const project = findProject(changedPath);
    if (project) scheduleRescan(project.name);
  };

  watcher.on('add', handle);
  watcher.on('change', handle);
  watcher.on('unlink', handle);

  return watcher;
}
