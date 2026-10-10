import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * typescript/13 §6: the design MCP server is read-only through the permission allowlist. The
 * fragment in docs/ pre-approves only the server's read tools; this test parses it and holds it
 * to that. The server is `figma` and read tools start with `get_` or `list_`.
 */
const FRAGMENT_URL = new URL('../../../../docs/design-permissions.json', import.meta.url);
const SERVER = 'figma';
const READ_PREFIXES = [`mcp__${SERVER}__get_`, `mcp__${SERVER}__list_`];

interface Fragment {
  readonly permissions: { readonly allow: readonly string[]; readonly deny?: readonly string[] };
}

describe('docs/design-permissions.json', () => {
  const fragment = JSON.parse(readFileSync(FRAGMENT_URL, 'utf8')) as Fragment;

  it('allows only read tools of the figma server, named exactly', () => {
    expect(fragment.permissions.allow.length).toBeGreaterThan(0);
    for (const rule of fragment.permissions.allow) {
      expect(READ_PREFIXES.some((p) => rule.startsWith(p))).toBe(true);
      expect(rule).toMatch(/^mcp__figma__(get|list)_[a-z_*]+$/);
    }
  });

  it('never approves the whole server or a mutating tool', () => {
    const allow = fragment.permissions.allow;
    expect(allow).not.toContain(`mcp__${SERVER}`);
    expect(allow).not.toContain(`mcp__${SERVER}__*`);
    expect(
      allow.some((r) =>
        /__(use|create|update|delete|set|add|publish|generate|comment|export)_?/.test(r),
      ),
    ).toBe(false);
    expect(new Set(allow).size).toBe(allow.length);
  });
});
