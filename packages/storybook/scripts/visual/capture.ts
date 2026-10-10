/**
 * Captures the visual matrix: serves a built `storybook-static/`, opens every cell's story iframe
 * in headless Chromium at a fixed viewport with animations frozen, and screenshots the story root
 * (`[data-testid="star-board-story-root"]`). Shared by `capture-baselines.ts` (writes
 * `visual/baselines/`) and `compare-baselines.ts` (writes a temporary directory and diffs).
 */
import { createReadStream, existsSync, readFileSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import type { IncomingMessage, Server, ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import { basename, dirname, extname, join, resolve, sep } from 'node:path';
import { chromium } from 'playwright';
import type { Page } from 'playwright';
import { baselinePath, storyUrl, visualMatrix } from '@star-board/storybook';
import type { VisualCell } from '@star-board/storybook';

/** The package root (`packages/storybook`), from which `baselinePath()` is relative. */
export const PACKAGE_ROOT = resolve(import.meta.dirname, '../..');
export const STATIC_DIR = resolve(PACKAGE_ROOT, 'storybook-static');
export const BASELINES_DIR = resolve(PACKAGE_ROOT, 'visual/baselines');
export const REPORT_PATH = resolve(PACKAGE_ROOT, 'visual/report.json');

export const STORY_ROOT_SELECTOR = '[data-testid="star-board-story-root"]';
export const VIEWPORT = { width: 1024, height: 768 } as const;
export const STORY_TIMEOUT_MS = 20_000;
const DEFAULT_CONCURRENCY = 4;

/** Belt and braces next to Playwright's `animations: 'disabled'` and `reducedMotion: 'reduce'`. */
const FREEZE_CSS =
  '*, *::before, *::after { transition: none !important; animation: none !important; caret-color: transparent !important; }';

const MIME: Readonly<Record<string, string>> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
};

/** The file name of a cell's baseline (`<storyId>__<mode>__<density>.png`). */
export function baselineFile(cell: VisualCell): string {
  const path = baselinePath(cell);
  if (dirname(path) !== 'visual/baselines') {
    throw new Error(`baselinePath() left visual/baselines/: ${path}`);
  }
  return basename(path);
}

/**
 * The story ids of a Storybook build (`index.json`). Throws with the command to run when the
 * build is missing, so the scripts never build on their own.
 */
export function builtStoryIds(staticDir: string = STATIC_DIR): Set<string> {
  const index = join(staticDir, 'index.json');
  if (!existsSync(join(staticDir, 'iframe.html')) || !existsSync(index)) {
    throw new Error(
      `no Storybook build at ${staticDir}; run \`pnpm build && pnpm -F @star-board/storybook build-storybook\` first`,
    );
  }
  const parsed = JSON.parse(readFileSync(index, 'utf8')) as {
    entries?: Record<string, { id: string; type: string }>;
  };
  return new Set(
    Object.values(parsed.entries ?? {})
      .filter((e) => e.type === 'story')
      .map((e) => e.id),
  );
}

/** The matrix, checked against the build: a story the build does not contain is an error. */
export function cellsToCapture(staticDir: string = STATIC_DIR): VisualCell[] {
  const built = builtStoryIds(staticDir);
  const cells = visualMatrix();
  const missing = [...new Set(cells.map((c) => c.storyId))].filter((id) => !built.has(id));
  if (missing.length > 0) {
    throw new Error(
      `stories in visualMatrix() but not in ${staticDir}/index.json (rebuild storybook-static): ${missing.join(', ')}`,
    );
  }
  return cells;
}

export interface StaticServer {
  readonly baseUrl: string;
  close(): Promise<void>;
}

/** Serves a directory read-only on a free localhost port. */
export async function serveStatic(root: string): Promise<StaticServer> {
  const rootPath = resolve(root);
  const handler = (req: IncomingMessage, res: ServerResponse): void => {
    const url = new URL(req.url ?? '/', 'http://localhost');
    let file = resolve(rootPath, `.${decodeURIComponent(url.pathname)}`);
    if (file !== rootPath && !file.startsWith(rootPath + sep)) {
      res.writeHead(403).end();
      return;
    }
    if (existsSync(file) && statSync(file).isDirectory()) file = join(file, 'index.html');
    if (!existsSync(file) || !statSync(file).isFile()) {
      res.writeHead(404).end();
      return;
    }
    res.writeHead(200, {
      'content-type': MIME[extname(file)] ?? 'application/octet-stream',
      'cache-control': 'no-store',
    });
    createReadStream(file).pipe(res);
  };
  const server: Server = createServer(handler);
  await new Promise<void>((done) => {
    server.listen(0, '127.0.0.1', done);
  });
  const { port } = server.address() as AddressInfo;
  return {
    baseUrl: `http://127.0.0.1:${port}`,
    close: () =>
      new Promise<void>((done, fail) => {
        server.close((error) => {
          if (error) fail(error);
          else done();
        });
      }),
  };
}

export interface CaptureFailure {
  readonly cell: VisualCell;
  readonly file: string;
  readonly error: string;
}

export interface CaptureResult {
  readonly captured: readonly string[];
  readonly failed: readonly CaptureFailure[];
}

export interface CaptureOptions {
  readonly cells: readonly VisualCell[];
  readonly outDir: string;
  readonly staticDir?: string;
  readonly concurrency?: number;
  readonly log?: (line: string) => void;
}

async function captureCell(page: Page, cell: VisualCell, baseUrl: string, outFile: string) {
  await page.goto(storyUrl(cell, baseUrl), {
    waitUntil: 'networkidle',
    timeout: STORY_TIMEOUT_MS,
  });
  const root = page.locator(STORY_ROOT_SELECTOR);
  await root.waitFor({ state: 'visible', timeout: STORY_TIMEOUT_MS });
  if ((await page.locator('body.sb-show-errordisplay').count()) > 0) {
    throw new Error('Storybook showed its error display for this story');
  }
  const mode = await root.getAttribute('data-mode');
  const density = await root.getAttribute('data-density');
  if (mode !== cell.mode || (density ?? 'default') !== cell.density) {
    throw new Error(
      `story root carries mode=${String(mode)} density=${String(density)}, expected ${cell.mode}/${cell.density}`,
    );
  }
  await page.addStyleTag({ content: FREEZE_CSS });
  await page.evaluate(() => document.fonts.ready);
  await page.evaluate(
    () =>
      new Promise<void>((done) => {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            done();
          });
        });
      }),
  );
  await root.screenshot({
    path: outFile,
    type: 'png',
    animations: 'disabled',
    caret: 'hide',
    scale: 'css',
  });
}

/** Screenshots every cell into `outDir/<baselineFile(cell)>`; never throws per cell. */
export async function captureCells(options: CaptureOptions): Promise<CaptureResult> {
  const { cells, outDir } = options;
  const log = options.log ?? (() => undefined);
  const server = await serveStatic(options.staticDir ?? STATIC_DIR);
  const browser = await chromium.launch();
  const captured: string[] = [];
  const failed: CaptureFailure[] = [];
  try {
    const context = await browser.newContext({
      viewport: { ...VIEWPORT },
      deviceScaleFactor: 1,
      colorScheme: 'light',
      reducedMotion: 'reduce',
      locale: 'en-US',
      timezoneId: 'UTC',
    });
    let next = 0;
    const worker = async (): Promise<void> => {
      const page = await context.newPage();
      await page.emulateMedia({ reducedMotion: 'reduce', colorScheme: 'light' });
      while (next < cells.length) {
        const cell = cells[next++];
        if (!cell) break;
        const file = baselineFile(cell);
        try {
          await captureCell(page, cell, server.baseUrl, join(outDir, file));
          captured.push(file);
          log(`captured ${file}`);
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          failed.push({ cell, file, error: message });
          log(`FAILED ${file}: ${message}`);
        }
      }
      await page.close();
    };
    const workers = Math.max(1, Math.min(options.concurrency ?? DEFAULT_CONCURRENCY, cells.length));
    await Promise.all(Array.from({ length: workers }, worker));
  } finally {
    await browser.close();
    await server.close();
  }
  return { captured, failed };
}
