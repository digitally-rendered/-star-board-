import { axe } from 'vitest-axe';
import { expect } from 'vitest';

/** Runs axe over `root` and fails with the violations spelled out. */
export async function expectNoViolations(root: Element): Promise<void> {
  const results = await axe(root);
  const summary = results.violations.map(
    (v) => `${v.id}: ${v.help} — ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`,
  );
  expect(summary).toEqual([]);
}
