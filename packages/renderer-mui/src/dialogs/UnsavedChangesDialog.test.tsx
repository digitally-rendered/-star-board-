import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { expectNoViolations } from '../../test/a11y.js';
import { UnsavedChangesDialog } from './UnsavedChangesDialog.js';

describe('UnsavedChangesDialog', () => {
  it('renders nothing while closed', () => {
    render(<UnsavedChangesDialog open={false} onStay={vi.fn()} onLeave={vi.fn()} />);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('is a labelled modal whose default action keeps editing; leave discards', async () => {
    const onStay = vi.fn();
    const onLeave = vi.fn();
    render(<UnsavedChangesDialog open onStay={onStay} onLeave={onLeave} />);
    const dialog = screen.getByRole('dialog', { name: 'Leave without saving?' });
    expect(dialog.textContent).toContain('Your changes have not been saved');
    expect(document.activeElement).toBe(screen.getByTestId('unsaved-changes-stay'));
    await userEvent.keyboard('{Enter}');
    expect(onStay).toHaveBeenCalledTimes(1);
    expect(onLeave).not.toHaveBeenCalled();
    await userEvent.click(screen.getByTestId('unsaved-changes-leave'));
    expect(onLeave).toHaveBeenCalledTimes(1);
    await userEvent.keyboard('{Escape}');
    expect(onStay).toHaveBeenCalledTimes(2);
    await expectNoViolations(dialog);
  });

  it('takes a wording override', () => {
    render(<UnsavedChangesDialog open onStay={vi.fn()} onLeave={vi.fn()} text="Really?" />);
    expect(screen.getByRole('dialog').textContent).toContain('Really?');
  });
});
