import path from 'node:path';

export function validateSafePath(target: string, allowRoot: boolean = true): string {
  if (!target || typeof target !== 'string') {
    throw new Error('Path must be a non-empty string');
  }
  const clean = target.replace(/\\/g, '/');
  // Disallow any ".." directory traversal segment
  const segments = clean.split('/');
  if (segments.includes('..')) {
    throw new Error(`Invalid path: "${target}" contains directory traversal`);
  }
  const normalized = path.posix.normalize(clean);
  if (!allowRoot && (normalized === '/' || normalized === '.' || normalized === '')) {
    throw new Error('Operation on root directory "/" is forbidden for safety');
  }
  return normalized.startsWith('/') ? normalized : `/${normalized}`;
}

const BINARY_EXTENSIONS = new Set([
  '.jar', '.zip', '.tar', '.gz', '.bz2', '.7z', '.rar',
  '.exe', '.bin', '.iso', '.dat', '.db', '.png', '.jpg',
  '.jpeg', '.gif', '.mp4', '.ogg', '.wav', '.mp3',
]);

export function isBinaryPath(target: string): boolean {
  const ext = path.posix.extname(target).toLowerCase();
  return BINARY_EXTENSIONS.has(ext);
}
