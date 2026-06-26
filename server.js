import express from 'express';
import fs from 'fs/promises';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import open from 'open';
import { fileURLToPath } from 'url';

import { loadConfig, getProjectByName } from './lib/config.js';
import { resolveSafePath, toPosixPath } from './lib/paths.js';
import { scanProject } from './lib/scanner.js';
import { searchProjects } from './lib/search.js';
import { createWatcher } from './lib/watcher.js';

const execAsync = promisify(exec);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3456;

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

let config;
const trees = new Map();
const scanStatus = new Map();

async function rescanProject(projectName) {
  const project = getProjectByName(config, projectName);
  if (!project) return null;

  scanStatus.set(projectName, 'scanning');
  try {
    const tree = await scanProject(project.path);
    trees.set(projectName, tree);
    scanStatus.set(projectName, 'ready');
    return tree;
  } catch (err) {
    scanStatus.set(projectName, 'error');
    throw err;
  }
}

async function rescanAll() {
  for (const project of config.projects) {
    await rescanProject(project.name);
  }
}

function getTree(projectName) {
  return trees.get(projectName) ?? null;
}

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, projects: config?.projects?.length ?? 0 });
});

app.get('/api/projects', (_req, res) => {
  res.json(
    config.projects.map(({ name }) => ({
      name,
      status: scanStatus.get(name) ?? 'pending',
    }))
  );
});

app.get('/api/tree', (req, res) => {
  const { project: projectName } = req.query;
  if (!projectName) {
    return res.status(400).json({ error: 'Missing "project" query parameter' });
  }

  const name = String(projectName);
  const status = scanStatus.get(name) ?? 'pending';

  if (status === 'scanning' || status === 'pending') {
    return res.json({ status: 'scanning', name: '', type: 'folder', children: [] });
  }

  if (status === 'error') {
    return res.status(500).json({ error: 'Scan failed for this project' });
  }

  const tree = getTree(name);
  if (!tree) {
    return res.status(404).json({ error: 'Project not found' });
  }

  res.json({ ...tree, status: 'ready' });
});

app.get('/api/file', async (req, res) => {
  const projectName = String(req.query.project ?? '');
  const filePath = String(req.query.path ?? '');

  if (!projectName || !filePath) {
    return res.status(400).json({ error: 'Missing "project" or "path" query parameter' });
  }

  const project = getProjectByName(config, projectName);
  if (!project) {
    return res.status(404).json({ error: 'Project not found' });
  }

  try {
    const fullPath = resolveSafePath(project.path, filePath);
    const stat = await fs.stat(fullPath);

    if (!stat.isFile()) {
      return res.status(404).json({ error: 'File not found' });
    }

    const content = await fs.readFile(fullPath, 'utf-8');
    res.json({
      content,
      path: toPosixPath(filePath),
      name: path.basename(filePath),
      size: stat.size,
      modified: stat.mtime.toISOString(),
    });
  } catch (err) {
    if (err.code === 'ENOENT') {
      return res.status(404).json({ error: 'File not found' });
    }
    if (err.message === 'Invalid path') {
      return res.status(400).json({ error: 'Invalid path' });
    }
    console.error(err);
    res.status(500).json({ error: 'Failed to read file' });
  }
});

app.get('/api/raw', async (req, res) => {
  const projectName = String(req.query.project ?? '');
  const filePath = String(req.query.path ?? '');

  if (!projectName || !filePath) {
    return res.status(400).json({ error: 'Missing "project" or "path" query parameter' });
  }

  const project = getProjectByName(config, projectName);
  if (!project) {
    return res.status(404).json({ error: 'Project not found' });
  }

  try {
    const fullPath = resolveSafePath(project.path, filePath);
    res.sendFile(fullPath);
  } catch (err) {
    if (err.message === 'Invalid path') {
      return res.status(400).json({ error: 'Invalid path' });
    }
    res.status(404).json({ error: 'Asset not found' });
  }
});

app.get('/api/search', async (req, res) => {
  const q = String(req.query.q ?? '').trim();
  if (!q) {
    return res.json([]);
  }

  try {
    const results = await searchProjects(config.projects, q);
    res.json(results);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Search failed' });
  }
});

app.post('/api/refresh', async (req, res) => {
  const { project: projectName } = req.body ?? {};

  try {
    if (projectName) {
      const tree = await rescanProject(String(projectName));
      if (!tree) {
        return res.status(404).json({ error: 'Project not found' });
      }
      return res.json({ ok: true, project: projectName });
    }

    await rescanAll();
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Refresh failed' });
  }
});

app.post('/api/open-project', async (req, res) => {
  const { project: projectName } = req.body ?? {};

  if (!projectName) {
    return res.status(400).json({ error: 'Missing "project"' });
  }

  const project = getProjectByName(config, String(projectName));
  if (!project) {
    return res.status(404).json({ error: 'Project not found' });
  }

  try {
    await open(project.path);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to open project folder' });
  }
});

app.post('/api/reveal', async (req, res) => {
  const { project: projectName, path: filePath } = req.body ?? {};

  if (!projectName || !filePath) {
    return res.status(400).json({ error: 'Missing "project" or "path"' });
  }

  const project = getProjectByName(config, String(projectName));
  if (!project) {
    return res.status(404).json({ error: 'Project not found' });
  }

  try {
    const fullPath = resolveSafePath(project.path, String(filePath));
    const dir = path.dirname(fullPath);

    if (process.platform === 'win32') {
      await execAsync(`explorer /select,"${fullPath.replace(/\//g, '\\')}"`);
    } else if (process.platform === 'darwin') {
      await execAsync(`open -R "${fullPath}"`);
    } else {
      await open(dir);
    }

    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to open folder' });
  }
});

app.post('/api/cursor', async (req, res) => {
  const { project: projectName, path: filePath } = req.body ?? {};

  if (!projectName || !filePath) {
    return res.status(400).json({ error: 'Missing "project" or "path"' });
  }

  const project = getProjectByName(config, String(projectName));
  if (!project) {
    return res.status(404).json({ error: 'Project not found' });
  }

  try {
    const fullPath = resolveSafePath(project.path, String(filePath));
    const commands = [`cursor "${fullPath}"`, `code "${fullPath}"`];

    for (const cmd of commands) {
      try {
        await execAsync(cmd);
        return res.json({ ok: true });
      } catch {
        /* try next editor */
      }
    }

    res.status(500).json({ error: 'Could not open editor (cursor/code not found)' });
  } catch (err) {
    if (err.message === 'Invalid path') {
      return res.status(400).json({ error: 'Invalid path' });
    }
    console.error(err);
    res.status(500).json({ error: 'Failed to open in editor' });
  }
});

app.get('/api/config-path', (_req, res) => {
  res.json({ path: path.join(__dirname, 'config.json') });
});

async function start() {
  config = await loadConfig();
  console.log(`Loaded ${config.projects.length} project(s) from config.json`);

  for (const project of config.projects) {
    scanStatus.set(project.name, 'pending');
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Docs Hub running at http://localhost:${PORT}`);
  });

  rescanAll()
    .then(() => {
      console.log('Initial scan complete');
      setTimeout(() => {
        createWatcher(config.projects, async (projectName) => {
          console.log(`Rescanning "${projectName}" (filesystem change detected)`);
          await rescanProject(projectName);
        });
        console.log('Filesystem watcher started');
      }, 1500);
    })
    .catch((err) => {
      console.error('Initial scan failed:', err);
    });
}

start().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
