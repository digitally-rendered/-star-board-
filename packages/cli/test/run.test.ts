import {
  existsSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { BUILD_VERSION as TOKENS_BUILD_VERSION } from '@star-board/tokens';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { CONFIG_FILE, INIT_FILES, run, TOKEN_OUTPUTS } from '../src/index.js';

const FIXTURE = fileURLToPath(new URL('../../../fixtures/petstore.json', import.meta.url));
const TOKENS = fileURLToPath(new URL('../../../tokens/reference.tokens.json', import.meta.url));
const GENERATED_FILE_COUNT = 23;

interface Capture {
  cwd: string;
  stdout: (text: string) => void;
  stderr: (text: string) => void;
  out: () => string;
  err: () => string;
}

function capture(cwd: string): Capture {
  const out: string[] = [];
  const err: string[] = [];
  return {
    cwd,
    stdout: (text) => {
      out.push(text);
    },
    stderr: (text) => {
      err.push(text);
    },
    out: () => out.join(''),
    err: () => err.join(''),
  };
}

function listFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];
  const result: string[] = [];
  const walk = (current: string, prefix: string): void => {
    for (const entry of readdirSync(current).sort()) {
      const full = join(current, entry);
      const rel = prefix === '' ? entry : `${prefix}/${entry}`;
      if (statSync(full).isDirectory()) walk(full, rel);
      else result.push(rel);
    }
  };
  walk(dir, '');
  return result;
}

describe('star-board run()', () => {
  let root: string;
  let out: string;
  let features: string;
  let io: Capture;
  const documentArgs = (): string[] => [
    '--document',
    FIXTURE,
    '--out',
    out,
    '--features',
    features,
  ];

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'star-board-cli-'));
    out = join(root, 'src', 'generated');
    features = join(root, 'src', 'features');
    io = capture(root);
  });
  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  describe('generate', () => {
    it('writes the manifest and every generated file, printing the count and manifest hash', async () => {
      const code = await run(['generate', ...documentArgs()], io);
      expect(code).toBe(0);
      const files = listFiles(out);
      expect(files).toHaveLength(GENERATED_FILE_COUNT);
      expect(files).toContain('manifest.json');
      const manifest = JSON.parse(readFileSync(join(out, 'manifest.json'), 'utf8')) as {
        files: unknown[];
      };
      expect(manifest.files).toHaveLength(GENERATED_FILE_COUNT - 1);
      expect(io.out()).toContain(`generated ${GENERATED_FILE_COUNT} file(s)`);
      expect(io.out()).toMatch(/manifest [0-9a-f]{64}/);
      expect(existsSync(features)).toBe(false);
    });

    it('--dry-run lists the files and writes nothing', async () => {
      const code = await run(['generate', ...documentArgs(), '--dry-run'], io);
      expect(code).toBe(0);
      expect(existsSync(out)).toBe(false);
      const lines = io.out().trim().split('\n');
      expect(lines).toContain('manifest.json');
      expect(lines).toContain('domain/pet/types.ts');
      expect(lines.at(-1)).toContain(`dry run: ${GENERATED_FILE_COUNT} file(s)`);
    });

    it('--json output parses and carries the count, the hash and the file list', async () => {
      const code = await run(['generate', ...documentArgs(), '--json', '--dry-run'], io);
      expect(code).toBe(0);
      const parsed = JSON.parse(io.out()) as {
        command: string;
        count: number;
        manifest: string;
        dryRun: boolean;
        files: string[];
      };
      expect(parsed.command).toBe('generate');
      expect(parsed.count).toBe(GENERATED_FILE_COUNT);
      expect(parsed.manifest).toMatch(/^[0-9a-f]{64}$/);
      expect(parsed.dryRun).toBe(true);
      expect(parsed.files).toHaveLength(GENERATED_FILE_COUNT);
    });

    it('--no-i18n drops i18n.defaults.json', async () => {
      const code = await run(['generate', ...documentArgs(), '--no-i18n'], io);
      expect(code).toBe(0);
      expect(listFiles(out)).not.toContain('i18n.defaults.json');
      expect(listFiles(out)).toContain('i18n.ts');
    });

    it('reads defaults from star-board.config.json in cwd', async () => {
      writeFileSync(
        join(root, CONFIG_FILE),
        JSON.stringify({ document: FIXTURE, out: 'src/generated', features: 'src/features' }),
      );
      const code = await run(['generate'], io);
      expect(code).toBe(0);
      expect(listFiles(out)).toHaveLength(GENERATED_FILE_COUNT);
    });

    it('exits 2 with a SPEC_* error when the document path does not exist', async () => {
      const code = await run(
        [
          'generate',
          '--document',
          join(root, 'missing.json'),
          '--out',
          out,
          '--features',
          features,
        ],
        io,
      );
      expect(code).toBe(2);
      expect(io.err()).toMatch(/^SPEC_INVALID: Cannot read OpenAPI document/);
      expect(io.err()).not.toMatch(/^\s+at /m);
      expect(existsSync(out)).toBe(false);
    });

    it('exits 2 with a usage message when --document is missing and no config exists', async () => {
      const code = await run(['generate', '--out', out, '--features', features], io);
      expect(code).toBe(2);
      expect(io.err()).toContain('usage: missing --document');
    });

    it('reports a StarBoardError as JSON on stderr under --json', async () => {
      const code = await run(
        [
          'generate',
          '--json',
          '--document',
          join(root, 'missing.json'),
          '--out',
          out,
          '--features',
          features,
        ],
        io,
      );
      expect(code).toBe(2);
      const parsed = JSON.parse(io.err()) as { error: { code: string; details: { path: string } } };
      expect(parsed.error.code).toBe('SPEC_INVALID');
      expect(parsed.error.details.path).toContain('missing.json');
    });

    it('prints the stack only under --verbose', async () => {
      const args = [
        'generate',
        '--document',
        join(root, 'missing.json'),
        '--out',
        out,
        '--features',
        features,
      ];
      await run(args, io);
      expect(io.err()).not.toMatch(/\n\s+at /);
      const verbose = capture(root);
      await run([...args, '--verbose'], verbose);
      expect(verbose.err()).toMatch(/\n\s+at /);
    });
  });

  describe('check', () => {
    beforeEach(async () => {
      await run(['generate', ...documentArgs()], capture(root));
    });

    it('is clean right after generate', async () => {
      const code = await run(['check', ...documentArgs()], io);
      expect(code).toBe(0);
      expect(io.out()).toContain('check:');
      expect(io.out()).toContain('matches petstore@');
    });

    it('exits 1 after a hand edit and lists the file', async () => {
      writeFileSync(join(out, 'domain', 'pet', 'types.ts'), '// edited\n', { flag: 'a' });
      const code = await run(['check', ...documentArgs()], io);
      expect(code).toBe(1);
      expect(io.out()).toContain('changed domain/pet/types.ts');
      expect(io.out()).toContain('1 drifted file(s)');
    });

    it('--json output parses and lists the drift rows', async () => {
      writeFileSync(join(out, 'domain', 'pet', 'Hand.tsx'), 'export {};\n');
      const code = await run(['check', ...documentArgs(), '--json'], io);
      expect(code).toBe(1);
      const parsed = JSON.parse(io.out()) as {
        count: number;
        drifts: { path: string; kind: string }[];
      };
      expect(parsed.count).toBe(1);
      expect(parsed.drifts).toEqual([{ path: 'domain/pet/Hand.tsx', kind: 'extra' }]);
    });
  });

  describe('init', () => {
    it('creates the skeleton and refuses to overwrite it', async () => {
      const target = join(root, 'app');
      const code = await run(['init', target, '--document', 'api/openapi.json'], io);
      expect(code).toBe(0);
      for (const file of INIT_FILES) expect(existsSync(join(target, file))).toBe(true);
      const config = JSON.parse(readFileSync(join(target, CONFIG_FILE), 'utf8')) as Record<
        string,
        string
      >;
      expect(config).toEqual({
        document: 'api/openapi.json',
        out: 'src/generated',
        features: 'src/features',
        renderer: '@star-board/renderer-mui',
      });
      const app = readFileSync(join(target, 'src', 'App.tsx'), 'utf8');
      expect(app).toContain("from './generated/setup'");
      expect(app).toContain("from './generated/routes'");
      expect(readFileSync(join(target, 'src', 'features', 'README.md'), 'utf8')).toContain(
        'registry.register',
      );

      writeFileSync(join(target, 'src', 'App.tsx'), 'mine\n');
      const again = capture(root);
      const second = await run(['init', target], again);
      expect(second).toBe(2);
      expect(again.err()).toContain('refusing to overwrite');
      expect(again.err()).toContain('src/App.tsx');
      expect(readFileSync(join(target, 'src', 'App.tsx'), 'utf8')).toBe('mine\n');
    });

    it('--json output parses', async () => {
      const code = await run(['init', 'app', '--json'], io);
      expect(code).toBe(0);
      const parsed = JSON.parse(io.out()) as { command: string; dir: string; files: string[] };
      expect(parsed.command).toBe('init');
      expect(parsed.dir).toBe(join(root, 'app'));
      expect(parsed.files).toEqual([...INIT_FILES]);
    });
  });

  describe('tokens', () => {
    it('build writes the five outputs from the reference tokens', async () => {
      const dir = join(root, 'theme');
      const code = await run(['tokens', 'build', '--tokens', TOKENS, '--out', dir], io);
      expect(code).toBe(0);
      const files = listFiles(dir);
      expect(files).toHaveLength(5);
      expect(files.sort()).toEqual(TOKEN_OUTPUTS.map((o) => o.file).sort());
      const cssVars = JSON.parse(readFileSync(join(dir, 'theme.css-vars.json'), 'utf8')) as Record<
        string,
        unknown
      >;
      expect(cssVars).toHaveProperty(':root');
      expect(io.out()).toContain('tokens build: 5 file(s)');
    });

    it('build --json without --out prints the build to stdout', async () => {
      const code = await run(['tokens', 'build', '--tokens', TOKENS, '--json'], io);
      expect(code).toBe(0);
      const parsed = JSON.parse(io.out()) as { build: { version: string; contract: unknown[] } };
      expect(parsed.build.version).toBe(TOKENS_BUILD_VERSION);
      expect(parsed.build.contract.length).toBeGreaterThan(0);
    });

    it('build without --out and without --json is a usage error', async () => {
      const code = await run(['tokens', 'build', '--tokens', TOKENS], io);
      expect(code).toBe(2);
      expect(io.err()).toContain('usage: missing --out');
    });

    it('lint exits 0 on the reference tokens and --json parses', async () => {
      const code = await run(['tokens', 'lint', '--tokens', TOKENS], io);
      expect(code).toBe(0);
      expect(io.out()).toContain('is clean');
      const json = capture(root);
      expect(await run(['tokens', 'lint', '--tokens', TOKENS, '--json'], json)).toBe(0);
      const parsed = JSON.parse(json.out()) as { count: number; findings: unknown[] };
      expect(parsed.count).toBe(0);
      expect(parsed.findings).toEqual([]);
    });

    it('lint exits 1 when a mode is missing', async () => {
      const code = await run(
        ['tokens', 'lint', '--tokens', TOKENS, '--modes', 'light,dark,sepia'],
        io,
      );
      expect(code).toBe(1);
      expect(io.out()).toContain('semantic-mode-complete');
      expect(io.out()).toMatch(/\d+ finding\(s\)/);
    });

    it('reads tokens.file from the config and exits 2 on an unreadable token file', async () => {
      writeFileSync(join(root, CONFIG_FILE), JSON.stringify({ tokens: { file: 'nope.json' } }));
      const code = await run(['tokens', 'lint'], io);
      expect(code).toBe(2);
      expect(io.err()).toContain('Cannot read token file');
    });
  });

  describe('parity', () => {
    it('is green over a fresh generate and prints one row per operation', async () => {
      expect(await run(['generate', ...documentArgs()], io)).toBe(0);
      const code = await run(['parity', ...documentArgs()], io);
      expect(code).toBe(0);
      expect(io.out()).toContain('pet_create');
      expect(io.out()).toContain('parity: ok (7 operation(s))');
      expect(io.out()).toContain('n/a');
    });

    it('exits 1 and names the cell when a generated screen is missing', async () => {
      expect(await run(['generate', ...documentArgs()], io)).toBe(0);
      rmSync(join(root, 'src', 'generated', 'domain', 'pet', 'PetCreateScreen.tsx'));
      const jsonIo = capture(root);
      const code = await run(['parity', '--json', ...documentArgs()], jsonIo);
      expect(code).toBe(1);
      const parsed = JSON.parse(jsonIo.out()) as { ok: boolean; missing: string[] };
      expect(parsed.ok).toBe(false);
      expect(parsed.missing).toContain('pet_create: screenOrAction');
    });

    it('compares an MCP tools/list file: every operation present passes, a dropped tool fails', async () => {
      expect(await run(['generate', ...documentArgs()], io)).toBe(0);
      const ids = [
        'available_pets_query',
        'pet_create',
        'pet_delete',
        'pet_get',
        'pet_history',
        'pet_list',
        'pet_update',
      ];
      writeFileSync(
        join(root, 'tools.json'),
        JSON.stringify({ tools: ids.map((name) => ({ name })) }),
      );
      expect(await run(['parity', '--mcp-tools', 'tools.json', ...documentArgs()], io)).toBe(0);
      expect(io.out()).not.toContain('n/a            ok');
      writeFileSync(
        join(root, 'tools.json'),
        JSON.stringify(ids.slice(1).map((name) => ({ name }))),
      );
      expect(await run(['parity', '--mcp-tools', 'tools.json', ...documentArgs()], io)).toBe(1);
      expect(io.out()).toContain('available_pets_query: mcpTool');
    });

    it('is a usage error without a generated tree or with a malformed tools file', async () => {
      expect(await run(['parity', ...documentArgs()], io)).toBe(2);
      expect(io.err()).toContain('no generated files');
      expect(await run(['generate', ...documentArgs()], io)).toBe(0);
      writeFileSync(join(root, 'tools.json'), '{ "tools": [{ "nope": 1 }] }');
      expect(await run(['parity', '--mcp-tools', 'tools.json', ...documentArgs()], io)).toBe(2);
      expect(io.err()).toContain('no string "name"');
      writeFileSync(join(root, 'tools.json'), '{ not json');
      expect(await run(['parity', '--mcp-tools', 'tools.json', ...documentArgs()], io)).toBe(2);
      expect(await run(['parity', '--mcp-tools', 'missing.json', ...documentArgs()], io)).toBe(2);
      expect(io.err()).toContain('Cannot read MCP tools file');
    });
  });

  describe('usage', () => {
    it('an unknown command exits 2 and prints nothing on stdout', async () => {
      const code = await run(['frobnicate'], io);
      expect(code).toBe(2);
      expect(io.err()).toContain('unknown command');
      expect(io.out()).toBe('');
    });

    it('--help exits 0 and lists the commands', async () => {
      const code = await run(['--help'], io);
      expect(code).toBe(0);
      for (const name of ['generate', 'check', 'init', 'tokens', 'parity'])
        expect(io.out()).toContain(name);
    });

    it('a malformed star-board.config.json is a usage error', async () => {
      writeFileSync(join(root, CONFIG_FILE), '{ not json');
      const code = await run(['generate', ...documentArgs()], io);
      expect(code).toBe(2);
      expect(io.err()).toContain(`${CONFIG_FILE} is not valid JSON`);
    });
  });
});
