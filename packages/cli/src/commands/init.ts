import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { DEFAULT_RENDERER } from '@star-board/generator';
import { CONFIG_FILE } from '../config.js';
import { CliUsageError, EXIT, type ExitCode } from '../errors.js';
import {
  optionString,
  printJson,
  printLines,
  toJson,
  type Context,
  type RawOptions,
} from '../io.js';

export interface InitInputs {
  readonly document: string;
  readonly renderer: string;
}

/** Relative paths of the skeleton `init` writes. */
export const INIT_FILES = [
  CONFIG_FILE,
  'src/features/README.md',
  'src/main.tsx',
  'src/App.tsx',
] as const;

export function skeleton(
  inputs: InitInputs,
): Readonly<Record<(typeof INIT_FILES)[number], string>> {
  return {
    [CONFIG_FILE]: toJson({
      document: inputs.document,
      out: 'src/generated',
      features: 'src/features',
      renderer: inputs.renderer,
    }),
    'src/features/README.md': FEATURES_README,
    'src/main.tsx': MAIN_TSX,
    'src/App.tsx': APP_TSX,
  };
}

/**
 * `star-board init <dir>`: a minimal consumer skeleton. Refuses to overwrite: when any target
 * exists nothing is written and the command exits 2 listing the files.
 */
export function runInit(ctx: Context, dir: string, raw: RawOptions): ExitCode {
  const root = resolve(ctx.cwd, dir);
  const inputs: InitInputs = {
    document: optionString(raw, 'document') ?? 'openapi.json',
    renderer: optionString(raw, 'renderer') ?? DEFAULT_RENDERER,
  };
  const files = skeleton(inputs);
  const existing = INIT_FILES.filter((path) => existsSync(join(root, path)));
  if (existing.length > 0) {
    throw new CliUsageError(
      `refusing to overwrite ${existing.length} existing file(s) under ${root}`,
      {
        dir: root,
        existing,
      },
    );
  }
  for (const path of INIT_FILES) {
    const target = join(root, path);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, files[path], 'utf8');
  }
  if (ctx.json) {
    printJson(ctx, { command: 'init', dir: root, files: [...INIT_FILES] });
    return EXIT.ok;
  }
  printLines(
    ctx,
    INIT_FILES.map((path) => join(root, path)),
  );
  printLines(ctx, [
    `initialised ${root}; next: star-board generate (reads ${CONFIG_FILE}), then wire src/main.tsx into your bundler`,
  ]);
  return EXIT.ok;
}

const FEATURES_README = `# src/features — overrides

\`src/generated/**\` is written by \`star-board generate\` and never edited; \`star-board check\`
fails on a hand edit. Everything hand-written lives here, one folder per schema:

\`\`\`
src/features/<schema>/
├── components/   React components that replace a generated screen, field, column, action or state
├── hooks/        application hooks the components need
└── index.ts      registerComponent calls only
\`\`\`

## Overriding

The generated screens register in the component registry at
\`(key, schema, target)\` with \`source: 'generated'\`. An override registers at the same
coordinates with \`source: 'override'\` and wins; the registry scores specificity so a narrower
registration (one field of one schema) beats a wider one (every field of every schema).

\`\`\`ts
// src/features/<schema>/index.ts
import type { ComponentRegistry } from '@star-board/core';
import { MySchemaListScreen } from './components/MySchemaListScreen';

export function registerMySchemaOverrides(registry: ComponentRegistry): void {
  registry.registerComponent({
    key: 'screen.list',
    schema: '<schema>',
    target: '<schema>_list',
    source: 'override',
    component: MySchemaListScreen,
  });
}
\`\`\`

Call it from \`src/App.tsx\` after \`createGeneratedRegistry()\`. Registering twice at equal
specificity is a build error, so one owner per coordinate.
`;

const MAIN_TSX = `import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';

const container = document.getElementById('root');
if (container === null) throw new Error('index.html needs an element with id="root"');
createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
`;

const APP_TSX = `import { useMemo } from 'react';
import { createBrowserRouter, RouterProvider } from 'react-router';
import { RegistryProvider, ServicesProvider, createClient } from '@star-board/runtime';
import { createGeneratedRegistry } from './generated/setup';
import { routes } from './generated/routes';

const BASE_URL = import.meta.env.VITE_API_URL ?? '/api';

export function App() {
  // The renderer defaults first, then the generated screens; register overrides from
  // src/features/<schema>/index.ts here, after createGeneratedRegistry().
  const registry = useMemo(() => createGeneratedRegistry(), []);
  const services = useMemo(
    () => ({
      client: createClient(BASE_URL, { token: () => null }),
      auth: { principal: () => null, capabilities: () => [] },
      notify: { notify: () => undefined },
    }),
    [],
  );
  const router = useMemo(() => createBrowserRouter(routes), []);
  return (
    <RegistryProvider registry={registry}>
      <ServicesProvider services={services}>
        <RouterProvider router={router} />
      </ServicesProvider>
    </RegistryProvider>
  );
}
`;
