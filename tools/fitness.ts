#!/usr/bin/env node
/**
 * Layer classification for a consuming app (hexagonal-rules typescript/12 §5): `generated/*` and
 * `features/<schema>/*` are classified by sub-folder so the React hexagon import rules
 * (typescript/01) apply to both, and the import statements of every `examples/*\/src` file are
 * checked against them. Run as `pnpm check:fitness`; imported by nothing else.
 *
 *   domain       generated/domain, features/<schema>/components — props-only components: no
 *                application or adapter import, no runtime data hook (the registry hook is allowed)
 *   application  generated/application, features/<schema>/hooks — no adapter import except the
 *                generated client (type-only imports of the generated `paths` are fine)
 *   adapters     generated/adapters
 *   registry     generated/registry.ts, features/<schema>/index.ts — the override index holds
 *                imports and `registry.register(...)` calls only
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

export type Layer = 'domain' | 'application' | 'adapters' | 'registry';

export function classify(path: string): Layer | null {
  const normalised = path.split('\\').join('/');
  const m =
    /(?:^|\/)(?:generated|features\/[^/]+)\/(domain|components|application|hooks|adapters)\//.exec(
      normalised,
    );
  if (!m) {
    return /(?:^|\/)generated\/registry\.ts$|features\/[^/]+\/index\.ts$/.test(normalised)
      ? 'registry'
      : null;
  }
  const seg = m[1];
  return seg === 'components' ? 'domain' : seg === 'hooks' ? 'application' : (seg as Layer);
}

export interface Violation {
  file: string;
  line: number;
  rule: string;
  detail: string;
}

interface ImportStatement {
  line: number;
  specifier: string;
  names: string[];
  typeOnly: boolean;
}

const IMPORT = /^\s*import\s+(type\s+)?(?:([^'"]*?)\s+from\s+)?['"]([^'"]+)['"]/;

/** Static `import` statements (one per line, as the generator and prettier write them). */
export function importsOf(text: string): ImportStatement[] {
  const out: ImportStatement[] = [];
  const lines = text.split('\n');
  for (let i = 0; i < lines.length; i++) {
    let statement = lines[i] ?? '';
    if (!/^\s*import\b/.test(statement)) continue;
    let end = i;
    // A multi-line import ends on the line that names the module.
    while (
      !/from\s+['"][^'"]+['"]|^\s*import\s+['"][^'"]+['"]/.test(statement) &&
      end < lines.length - 1
    ) {
      end++;
      statement += ` ${lines[end] ?? ''}`;
    }
    const m = IMPORT.exec(statement.replace(/\s+/g, ' '));
    if (m) {
      const clause = m[2] ?? '';
      const names = clause
        .replace(/[{}]/g, ' ')
        .split(/[\s,]+/)
        .filter((n) => n !== '' && n !== 'type' && n !== 'as')
        .map((n) => n.trim());
      out.push({ line: i + 1, specifier: m[3] ?? '', names, typeOnly: m[1] !== undefined });
    }
    i = end;
  }
  return out;
}

/** The runtime's data and service hooks: application concerns a domain component never touches. */
export const RUNTIME_DATA_HOOKS: ReadonlySet<string> = new Set([
  'useEntity',
  'useEntityList',
  'useView',
  'useMutation',
  'useCapability',
  'useCapabilities',
  'useServices',
  'useOperations',
  'useAgent',
  'useAgentTools',
  'createClient',
]);

const RUNTIME = '@star-board/runtime';

function isLayerPath(specifier: string, layer: 'application' | 'adapters' | 'domain'): boolean {
  return new RegExp(`(^|/)${layer}(/|\\.js$|$)`).test(specifier) && specifier.startsWith('.');
}

export function checkImports(file: string, text: string): Violation[] {
  const layer = classify(file);
  if (layer === null) return [];
  const violations: Violation[] = [];
  const add = (line: number, rule: string, detail: string): void => {
    violations.push({ file, line, rule, detail });
  };
  const imports = importsOf(text);
  if (layer === 'domain') {
    for (const imp of imports) {
      if (isLayerPath(imp.specifier, 'application'))
        add(imp.line, 'domain-no-application', `imports ${imp.specifier}`);
      if (isLayerPath(imp.specifier, 'adapters'))
        add(imp.line, 'domain-no-adapters', `imports ${imp.specifier}`);
      if (imp.specifier === RUNTIME) {
        for (const name of imp.names.filter((n) => RUNTIME_DATA_HOOKS.has(n)))
          add(imp.line, 'domain-no-runtime-data-hook', `imports ${name} from ${RUNTIME}`);
      }
      if (/\bfetch\(/.test(text)) add(1, 'domain-no-fetch', 'calls fetch');
    }
  }
  if (layer === 'application') {
    for (const imp of imports) {
      if (
        isLayerPath(imp.specifier, 'adapters') &&
        !imp.typeOnly &&
        !/adapters\/client(\.js)?$/.test(imp.specifier)
      )
        add(imp.line, 'application-adapters-only-client', `imports ${imp.specifier}`);
    }
  }
  if (layer === 'registry' && /features\/[^/]+\/index\.ts$/.test(file.split('\\').join('/'))) {
    violations.push(...checkOverrideIndex(file, text));
  }
  return violations;
}

const INDEX_ALLOWED: readonly RegExp[] = [
  /^\s*$/,
  /^\s*(\/\/|\/\*|\*)/, // comments
  /^\s*import\b/,
  /^\s*[A-Za-z0-9_$,{}\s]+\} from ['"][^'"]+['"];?\s*$/, // the tail of a multi-line import
  /^\s*[A-Za-z0-9_$]+,?\s*$/, // one imported name per line
  /^\s*export function register[A-Za-z0-9_]*\(registry: ComponentRegistry\): void \{\s*$/,
  /^\s*registry\.register\(\{.*\}\);\s*$/,
  /^\s*registry\.register\(\{\s*$/,
  /^\s*(key|schema|target|scope|component|source):\s.*,?\s*$/, // a multi-line register call
  /^\s*\}\);\s*$/,
  /^\s*\}\s*$/,
];

/** `features/<schema>/index.ts`: imports and `registry.register(...)` calls inside one function. */
export function checkOverrideIndex(file: string, text: string): Violation[] {
  const violations: Violation[] = [];
  let inBlockComment = false;
  text.split('\n').forEach((line, index) => {
    if (inBlockComment) {
      if (line.includes('*/')) inBlockComment = false;
      return;
    }
    if (line.trimStart().startsWith('/*') && !line.includes('*/')) {
      inBlockComment = true;
      return;
    }
    if (!INDEX_ALLOWED.some((re) => re.test(line))) {
      violations.push({
        file,
        line: index + 1,
        rule: 'override-index-register-only',
        detail: `only imports and registry.register(...) calls belong here: ${line.trim()}`,
      });
    }
  });
  if (!text.includes('registry.register(')) {
    violations.push({
      file,
      line: 1,
      rule: 'override-index-register-only',
      detail: 'registers nothing',
    });
  }
  return violations;
}

const SKIP = new Set(['node_modules', 'dist', '.tsbuild', 'coverage']);

function walk(dir: string, out: string[]): void {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return;
  }
  for (const entry of entries.sort()) {
    if (SKIP.has(entry) || entry.startsWith('.')) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.(ts|tsx)$/.test(entry) && !/\.test\.tsx?$/.test(entry)) out.push(full);
  }
}

/** Every `examples/*\/src` file, classified and checked; files of no layer pass. */
export function checkExamples(root = 'examples'): {
  files: number;
  classified: number;
  violations: Violation[];
} {
  const files: string[] = [];
  for (const example of readdirSync(root).sort()) {
    const src = join(root, example, 'src');
    if (statSync(join(root, example)).isDirectory()) walk(src, files);
  }
  const violations: Violation[] = [];
  let classified = 0;
  for (const file of files) {
    const rel = relative(process.cwd(), file);
    if (classify(rel) !== null) classified++;
    violations.push(...checkImports(rel, readFileSync(file, 'utf8')));
  }
  return { files: files.length, classified, violations };
}

if (import.meta.main) {
  const result = checkExamples();
  for (const v of result.violations)
    console.error(`${v.file}:${String(v.line)}: [${v.rule}] ${v.detail}`);
  if (result.violations.length > 0) {
    console.error(`fitness: ${String(result.violations.length)} violation(s)`);
    process.exit(1);
  }
  console.log(
    `fitness: ok (${String(result.classified)} classified of ${String(result.files)} files under examples/*/src)`,
  );
}
