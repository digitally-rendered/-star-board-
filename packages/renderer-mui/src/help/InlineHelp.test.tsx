import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { expectNoViolations } from '../../test/a11y.js';
import { InlineHelp } from './InlineHelp.js';

describe('help.inline', () => {
  it('renders addressable helper text', async () => {
    const { container } = render(
      <div>
        <input aria-label="Name" aria-describedby="help-name" />
        <InlineHelp id="help-name" text="Shown on the invoice." />
      </div>,
    );
    const note = screen.getByRole('note');
    expect(note.id).toBe('help-name');
    expect(note.textContent).toContain('Shown on the invoice.');
    expect(screen.getByTestId('help-help-name')).toBe(note);
    await expectNoViolations(container);
  });
});
