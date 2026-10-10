import ts from 'typescript';
import { describe, expect, it } from 'vitest';
import { generate, type GeneratedFile } from '../src/index.js';
import { petstore, petstoreWithCustomOperations } from './fixture.js';

/*
 * The generated-text lint (hexagonal-rules typescript/05 §7): every user-facing string in the
 * emitted code goes through `t(key, vars)`. Parses each emitted file with the TypeScript compiler
 * and fails on a JSX text node, a string literal inside a JSX expression, a string literal given to
 * a user-facing attribute, or a string literal assigned to a user-facing property. Punctuation,
 * whitespace and placeholders are allowed; identifiers (test ids, roles, keys, paths) are not
 * user-facing and are not checked.
 */

const OPTS = { out: 'src/generated', features: 'src/features' };

/** Attributes and object properties whose value a user reads. */
const USER_FACING = new Set([
  'aria-label',
  'aria-description',
  'aria-placeholder',
  'aria-roledescription',
  'aria-valuetext',
  'title',
  'placeholder',
  'alt',
  'label',
  'text',
  'headerName',
  'description',
  'help',
  'confirm',
  'emptyLabel',
  'legend',
]);

/** Punctuation, symbols, whitespace and `{placeholders}` carry no language. */
const NO_LANGUAGE = /^[\s\p{P}\p{S}\d]*$|^\{\w+\}$/u;

export function lintGeneratedText(file: GeneratedFile): string[] {
  const violations: string[] = [];
  const source = ts.createSourceFile(
    file.path,
    file.contents,
    ts.ScriptTarget.ESNext,
    true,
    file.path.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  const where = (node: ts.Node): string => {
    const { line } = source.getLineAndCharacterOfPosition(node.getStart(source));
    return `${file.path}:${String(line + 1)}`;
  };
  const report = (node: ts.Node, kind: string, text: string): void => {
    if (NO_LANGUAGE.test(text)) return;
    violations.push(`${where(node)} ${kind}: ${JSON.stringify(text)}`);
  };
  const literalText = (node: ts.Node): string | undefined =>
    ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node) ? node.text : undefined;
  const visit = (node: ts.Node): void => {
    if (ts.isJsxText(node)) {
      report(node, 'JSX text', node.text.trim());
    } else if (ts.isJsxExpression(node) && node.expression !== undefined) {
      const text = literalText(node.expression);
      if (text !== undefined) report(node, 'JSX string expression', text);
    } else if (ts.isJsxAttribute(node) && node.initializer !== undefined) {
      const name = node.name.getText(source);
      if (USER_FACING.has(name)) {
        const text =
          literalText(node.initializer) ??
          (ts.isJsxExpression(node.initializer) && node.initializer.expression !== undefined
            ? literalText(node.initializer.expression)
            : undefined);
        if (text !== undefined) report(node, `attribute ${name}`, text);
      }
    } else if (ts.isPropertyAssignment(node) && USER_FACING.has(node.name.getText(source))) {
      const text = literalText(node.initializer);
      if (text !== undefined) report(node, `property ${node.name.getText(source)}`, text);
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return violations;
}

describe('generated-text lint', () => {
  it.each([
    ['petstore', () => generate(petstore(), OPTS)],
    ['petstore with Tier 3 operations', () => generate(petstoreWithCustomOperations(), OPTS)],
    ['petstore with i18n: false', () => generate(petstore(), { ...OPTS, i18n: false })],
  ])('%s: every user-facing string in the emitted code is a t(key) call', (_label, files) => {
    const emitted = files().filter((f) => /\.tsx?$/.test(f.path) && f.path !== 'i18n.ts');
    expect(emitted.length).toBeGreaterThan(10);
    expect(emitted.flatMap(lintGeneratedText)).toEqual([]);
  });

  it('catches a literal where one slips in', () => {
    const bad: GeneratedFile = {
      path: 'domain/x/Bad.tsx',
      contents: [
        'export const a = <p>Hello there</p>;',
        "export const b = <p>{'Plain'}</p>;",
        'export const c = <input aria-label="Search" />;',
        "export const d = { label: 'Save' };",
        "export const ok = <p>{t('x.y')} — ({n})</p>;",
        'export const ok2 = <b data-testid="pet-list-row">{value}</b>;',
      ].join('\n'),
    };
    expect(lintGeneratedText(bad)).toEqual([
      'domain/x/Bad.tsx:1 JSX text: "Hello there"',
      'domain/x/Bad.tsx:2 JSX string expression: "Plain"',
      'domain/x/Bad.tsx:3 attribute aria-label: "Search"',
      'domain/x/Bad.tsx:4 property label: "Save"',
    ]);
  });
});
