import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { expectNoViolations } from '../../test/a11y.js';
import { MAIN_CONTENT_ID, ScreenShell } from './ScreenShell.js';
import { SkipToContent } from './SkipToContent.js';

// jsdom has no layout: the landmark is focused, the scroll is the browser's.
beforeAll(() => {
  Element.prototype.scrollIntoView = vi.fn();
});

describe('SkipToContent', () => {
  it('links to the shell landmark and moves focus there on activation', async () => {
    const { container } = render(
      <>
        <SkipToContent />
        <nav aria-label="Primary">
          <a href="/pet">Pets</a>
        </nav>
        <ScreenShell title="Pets">body</ScreenShell>
      </>,
    );
    const link = screen.getByRole('link', { name: 'Skip to main content' });
    expect(link.getAttribute('href')).toBe(`#${MAIN_CONTENT_ID}`);
    await userEvent.tab();
    expect(document.activeElement).toBe(link);
    await userEvent.keyboard('{Enter}');
    expect(document.activeElement).toBe(screen.getByRole('main'));
    await expectNoViolations(container);
  });

  it('accepts another target and leaves the default behaviour when it is missing', async () => {
    render(<SkipToContent targetId="content" />);
    const link = screen.getByTestId('skip-to-content');
    expect(link.getAttribute('href')).toBe('#content');
    await userEvent.click(link);
    expect(document.activeElement).toBe(link);
  });
});
