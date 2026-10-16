import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

const TYPES: Record<string, string> = {
  html: 'text/html; charset=utf-8',
  js: 'text/javascript; charset=utf-8',
  css: 'text/css; charset=utf-8',
  svg: 'image/svg+xml',
  png: 'image/png',
};

/**
 * The phone controller page (apps/controller/dist, copied next to the bundled handler), served by
 * the HTTP API when the stack runs without CloudFront. `file` is "index.html" or a file name from
 * the assets folder; anything else returns null.
 */
export function readControllerFile(dir: string, file: string): { body: Buffer; type: string; cache: string } | null {
  if (!/^[\w.-]+$/.test(file)) return null; // a plain file name, never a path
  const path = file === 'index.html' ? join(dir, 'index.html') : join(dir, 'assets', file);
  if (!existsSync(path)) return null;
  return {
    body: readFileSync(path),
    type: TYPES[file.split('.').pop() ?? ''] ?? 'application/octet-stream',
    // Asset names carry a content hash; the page itself must always be fresh.
    cache: file === 'index.html' ? 'no-cache' : 'public, max-age=31536000, immutable',
  };
}
