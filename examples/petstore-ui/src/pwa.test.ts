import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/*
 * The installable shell (typescript/05 §6): a valid manifest linked from index.html, icons that
 * exist, the viewport meta. No service worker and no offline data: msw's worker is the dev mock,
 * not an offline cache.
 */

const ROOT = join(import.meta.dirname, '..');
// Vite's `publicDir` is public/generated (see vite.config.ts), served at `/`.
const PUBLIC = join(ROOT, 'public', 'generated');

interface Manifest {
  name: string;
  short_name: string;
  start_url: string;
  display: string;
  icons: { src: string; sizes: string; type: string }[];
}

describe('PWA shell', () => {
  const html = readFileSync(join(ROOT, 'index.html'), 'utf8');

  it('index.html links the manifest and sets the viewport', () => {
    expect(html).toMatch(/<link rel="manifest" href="\/manifest\.webmanifest" \/>/);
    expect(html).toMatch(/<meta name="viewport" content="width=device-width, initial-scale=1" \/>/);
    expect(html).not.toMatch(/serviceWorker|navigator\.serviceWorker/);
  });

  it('the manifest is valid JSON for a standalone app whose icons exist', () => {
    const path = join(PUBLIC, 'manifest.webmanifest');
    expect(existsSync(path)).toBe(true);
    const manifest = JSON.parse(readFileSync(path, 'utf8')) as Manifest;
    expect(manifest.name).toBe('petstore-ui');
    expect(manifest.short_name.length).toBeLessThanOrEqual(12);
    expect(manifest.start_url).toBe('/');
    expect(manifest.display).toBe('standalone');
    expect(manifest.icons.length).toBeGreaterThanOrEqual(2);
    for (const icon of manifest.icons) {
      expect(icon.src.startsWith('/')).toBe(true);
      expect(existsSync(join(PUBLIC, icon.src))).toBe(true);
      expect(icon.type).toBe('image/svg+xml');
      expect(icon.sizes).toMatch(/^\d+x\d+$/);
    }
  });
});
