import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CONFIG_PATH = path.join(__dirname, '..', 'config.json');

export async function loadConfig() {
  const raw = await fs.readFile(CONFIG_PATH, 'utf-8');
  const config = JSON.parse(raw);

  if (!Array.isArray(config.projects) || config.projects.length === 0) {
    throw new Error('config.json must contain a non-empty "projects" array');
  }

  for (const project of config.projects) {
    if (!project.name || !project.path) {
      throw new Error('Each project requires "name" and "path"');
    }
    project.path = path.resolve(project.path);
  }

  return config;
}

export function getProjectByName(config, name) {
  return config.projects.find((p) => p.name === name) ?? null;
}
