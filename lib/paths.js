import path from 'path';

export function resolveSafePath(projectRoot, relativePath) {
  const root = path.resolve(projectRoot);
  const normalized = path.normalize(relativePath).replace(/^(\.\.(\/|\\|$))+/, '');
  const full = path.resolve(root, normalized);

  if (full !== root && !full.startsWith(root + path.sep)) {
    throw new Error('Invalid path');
  }

  return full;
}

export function toPosixPath(filePath) {
  return filePath.split(path.sep).join('/');
}
