import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('core dependency allowlist (CLAUDE.md)', () => {
  it('depends on zod only', () => {
    const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as {
      dependencies?: Record<string, string>;
    };
    expect(Object.keys(pkg.dependencies ?? {})).toEqual(['zod']);
  });
});
