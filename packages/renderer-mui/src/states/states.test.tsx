import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { expectNoViolations } from '../../test/a11y.js';
import { EmptyState, ErrorState, ForbiddenState, LoadingState } from './index.js';

describe('state components', () => {
  it('state.empty is a labelled region with an optional action', async () => {
    const onClick = vi.fn();
    const { container } = render(
      <EmptyState title="No pets yet" description="Add one." action={{ label: 'Add', onClick }} />,
    );
    const region = screen.getByRole('region', { name: 'No pets yet' });
    expect(region.textContent).toContain('Add one.');
    screen.getByTestId('state-empty-action').click();
    expect(onClick).toHaveBeenCalledTimes(1);
    await expectNoViolations(container);
  });

  it('state.loading is a polite, busy status', async () => {
    const { container } = render(<LoadingState title="Loading pets" />);
    const status = screen.getByRole('status');
    expect(status.getAttribute('aria-busy')).toBe('true');
    expect(status.getAttribute('aria-live')).toBe('polite');
    expect(status.textContent).toContain('Loading pets');
    await expectNoViolations(container);
  });

  it('state.error is an alert with a retry action', async () => {
    const onClick = vi.fn();
    const { container } = render(
      <ErrorState
        title="Could not load"
        description="Try again later."
        action={{ label: 'Retry', onClick }}
      />,
    );
    const alert = screen.getByRole('alert');
    expect(alert.textContent).toContain('Could not load');
    expect(alert.textContent).toContain('Try again later.');
    screen.getByTestId('state-error-action').click();
    expect(onClick).toHaveBeenCalledTimes(1);
    await expectNoViolations(container);
  });

  it('state.forbidden is a status, not an alert, and never names the hidden thing', async () => {
    const { container } = render(<ForbiddenState title="You do not have access" />);
    expect(screen.getByRole('status').textContent).toContain('You do not have access');
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.queryByTestId('state-forbidden-action')).toBeNull();
    await expectNoViolations(container);
  });
});
