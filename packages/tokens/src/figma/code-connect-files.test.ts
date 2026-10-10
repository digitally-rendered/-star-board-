import { describe, expect, it } from 'vitest';
import { buildContract } from '../build/contract.js';
import { expectTokensInvalid } from '../fixture.test-helper.js';
import {
  CODE_CONNECT_CONFIG_FILE,
  emitCodeConnect,
  emitCodeConnectConfig,
  NODE_ID_PLACEHOLDER,
} from './code-connect-files.js';

const options = {
  rendererPackage: '@star-board/renderer-mui',
  figmaFileUrl: 'https://www.figma.com/design/FILEKEY/star-board',
};

describe('emitCodeConnect', () => {
  it('yields one .figma.tsx per contract key importing that key’s renderer component', () => {
    const contract = buildContract();
    const files = emitCodeConnect(contract, options);
    expect(files).toHaveLength(contract.length);
    expect(files.map((f) => f.path)).toEqual(contract.map((r) => `codeconnect/${r.key}.figma.tsx`));
    for (const row of contract) {
      const file = files.find((f) => f.path === `codeconnect/${row.key}.figma.tsx`);
      expect(file?.contents).toContain(`import figma from '@figma/code-connect';`);
      expect(file?.contents).toContain(
        `import { ${row.componentName} } from '@star-board/renderer-mui';`,
      );
      expect(file?.contents).toContain(
        `figma.connect(${row.componentName}, '${options.figmaFileUrl}?node-id=${NODE_ID_PLACEHOLDER}'`,
      );
      expect(file?.contents).toContain(`example: (props) => <${row.componentName} {...props} />`);
      expect(file?.contents).toContain(`Figma component: ${row.figmaComponent}.`);
    }
  });

  it('maps string, boolean and enum props to the matching figma helpers', () => {
    const files = emitCodeConnect(buildContract(), options);
    const text =
      files.find((f) => f.path === 'codeconnect/action.create.figma.tsx')?.contents ?? '';
    expect(text).toContain(`label: figma.string("Label")`);
    expect(text).toContain(`disabled: figma.boolean("Disabled")`);
    expect(text).toContain(
      `variant: figma.enum("Variant", { contained: "contained", outlined: "outlined", text: "text" })`,
    );
    const column =
      files.find((f) => f.path === 'codeconnect/list.column.date-time.figma.tsx')?.contents ?? '';
    expect(column).toContain(`import { DateTimeCell } from`);
    expect(column).toContain(`align: figma.enum("Align", { left: "left", right: "right" })`);
  });

  it('matches the snapshot for field.text', () => {
    const file = emitCodeConnect(buildContract(), options).find(
      (f) => f.path === 'codeconnect/field.text.figma.tsx',
    );
    expect(file?.contents).toMatchSnapshot();
  });

  it('rejects a file URL with a query or a bad package name', () => {
    expectTokensInvalid(() =>
      emitCodeConnect(buildContract(), {
        ...options,
        figmaFileUrl: `${options.figmaFileUrl}?node-id=1-2`,
      }),
    );
    expectTokensInvalid(() =>
      emitCodeConnect(buildContract(), { ...options, rendererPackage: 'Not A Pkg' }),
    );
  });
});

describe('emitCodeConnectConfig', () => {
  it('emits figma.config.json with the React parser over codeconnect/**', () => {
    expect(CODE_CONNECT_CONFIG_FILE).toBe('figma.config.json');
    const text = emitCodeConnectConfig();
    expect(text.endsWith('\n')).toBe(true);
    expect(JSON.parse(text)).toEqual({
      codeConnect: { parser: 'react', include: ['codeconnect/**'], label: 'React' },
    });
    expect(JSON.parse(emitCodeConnectConfig({ label: 'MUI' }))).toMatchObject({
      codeConnect: { label: 'MUI' },
    });
  });
});
