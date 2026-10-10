import { TokensError } from '@star-board/core';
import { buildCodeConnectMap, type CodeConnectProp } from '../build/code-connect.js';
import type { ContractRow } from '../build/contract.js';

/**
 * `design/map-components` (typescript/13 §5): the files `@figma/code-connect`'s React parser
 * consumes, one per contract key, generated from `contract.json` so renaming a key renames both
 * sides. Tokens emits text only; the package is never a dependency here and the CLI writes the
 * files. The node id of each Figma component is a placeholder until the design file is mapped.
 */
export const CODE_CONNECT_DIR = 'codeconnect';
export const CODE_CONNECT_CONFIG_FILE = 'figma.config.json';
export const NODE_ID_PLACEHOLDER = '<node-id>';

export interface EmitCodeConnectOptions {
  /** Package the components are imported from, e.g. `@star-board/renderer-mui`. */
  readonly rendererPackage: string;
  /** The design file URL without a query, e.g. `https://www.figma.com/design/<key>/<name>`. */
  readonly figmaFileUrl: string;
}

export interface EmittedFile {
  /** Relative path, `codeconnect/<key>.figma.tsx`. */
  readonly path: string;
  readonly contents: string;
}

const IDENTIFIER = /^[A-Za-z_$][A-Za-z0-9_$]*$/;

function objectKey(name: string): string {
  return IDENTIFIER.test(name) ? name : JSON.stringify(name);
}

function propExpression(prop: CodeConnectProp): string {
  const figmaName = JSON.stringify(prop.figma);
  switch (prop.kind) {
    case 'string':
      return `figma.string(${figmaName})`;
    case 'boolean':
      return `figma.boolean(${figmaName})`;
    case 'enum': {
      const values = (prop.values ?? []).map((v) => `${objectKey(v)}: ${JSON.stringify(v)}`);
      return `figma.enum(${figmaName}, { ${values.join(', ')} })`;
    }
  }
}

function checkOptions(options: EmitCodeConnectOptions): void {
  const problems: string[] = [];
  if (!/^@?[a-z0-9][a-z0-9._/-]*$/.test(options.rendererPackage)) {
    problems.push(
      `rendererPackage ${JSON.stringify(options.rendererPackage)} is not a package name`,
    );
  }
  if (!/^https:\/\/[^\s?#'"]+$/.test(options.figmaFileUrl)) {
    problems.push(
      `figmaFileUrl ${JSON.stringify(options.figmaFileUrl)} must be an https URL without a query`,
    );
  }
  if (problems.length > 0) {
    throw new TokensError('TOKENS_INVALID', `Cannot emit Code Connect: ${problems.join('; ')}`, {
      problems,
    });
  }
}

function fileFor(
  row: ContractRow,
  props: Readonly<Record<string, CodeConnectProp>>,
  options: EmitCodeConnectOptions,
): EmittedFile {
  const url = `${options.figmaFileUrl}?node-id=${NODE_ID_PLACEHOLDER}`;
  const propLines = Object.keys(props)
    .sort()
    .map((name) => {
      const prop = props[name];
      return prop === undefined ? undefined : `    ${objectKey(name)}: ${propExpression(prop)},`;
    })
    .filter((line): line is string => line !== undefined);
  const contents = [
    `// Generated from contract.json by @star-board/tokens; do not edit (\`star-board tokens map-components\`).`,
    `// Contract key: ${row.key}. Figma component: ${row.figmaComponent}.`,
    `// Replace ${NODE_ID_PLACEHOLDER} with the component's node id in the design file.`,
    `import figma from '@figma/code-connect';`,
    `import { ${row.componentName} } from '${options.rendererPackage}';`,
    ``,
    `figma.connect(${row.componentName}, '${url}', {`,
    `  props: {`,
    ...propLines,
    `  },`,
    `  example: (props) => <${row.componentName} {...props} />,`,
    `});`,
    ``,
  ].join('\n');
  return { path: `${CODE_CONNECT_DIR}/${row.key}.figma.tsx`, contents };
}

/** One `.figma.tsx` per contract row, sorted by key. */
export function emitCodeConnect(
  contract: readonly ContractRow[],
  options: EmitCodeConnectOptions,
): readonly EmittedFile[] {
  checkOptions(options);
  const map = buildCodeConnectMap(contract);
  return [...contract]
    .sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0))
    .map((row) => fileFor(row, map[row.figmaComponent]?.props ?? {}, options));
}

export interface CodeConnectConfigOptions {
  /** Shown in Figma as the code language label; defaults to `React`. */
  readonly label?: string;
}

/** `figma.config.json` text: the React parser over the emitted directory. */
export function emitCodeConnectConfig(options: CodeConnectConfigOptions = {}): string {
  const config = {
    codeConnect: {
      parser: 'react',
      include: [`${CODE_CONNECT_DIR}/**`],
      label: options.label ?? 'React',
    },
  };
  return `${JSON.stringify(config, null, 2)}\n`;
}
