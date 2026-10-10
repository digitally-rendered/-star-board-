import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { expectNoViolations } from '../../test/a11y.js';
import {
  CreateScreen,
  CustomScreen,
  DetailScreen,
  EditScreen,
  GridScreen,
  ListScreen,
  MAIN_CONTENT_ID,
  ScreenShell,
} from './ScreenShell.js';

describe('screen shells', () => {
  it('renders exactly one h1, a main landmark that is the skip target, breadcrumbs and actions', async () => {
    const { container } = render(
      <ScreenShell
        title="Pets"
        breadcrumbs={[{ label: 'Home', to: '/' }, { label: 'Pets' }]}
        actions={<button type="button">New</button>}
      >
        <p>body</p>
      </ScreenShell>,
    );
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Pets');
    const main = screen.getByRole('main');
    expect(main.id).toBe(MAIN_CONTENT_ID);
    expect(main.tabIndex).toBe(-1);
    const nav = screen.getByRole('navigation', { name: 'Breadcrumb' });
    expect(within(nav).getByRole('link', { name: 'Home' }).getAttribute('href')).toBe('/');
    expect(within(nav).getByText('Pets')).toBeTruthy();
    expect(within(screen.getByRole('group', { name: 'Actions' })).getByRole('button')).toBeTruthy();
    expect(screen.getByTestId('screen-body').textContent).toBe('body');
    await expectNoViolations(container);
  });

  it('omits breadcrumbs and the actions group when not given', () => {
    render(<ScreenShell title="Pets">body</ScreenShell>);
    expect(screen.queryByRole('navigation')).toBeNull();
    expect(screen.queryByRole('group')).toBeNull();
  });

  it.each([
    ['list', ListScreen],
    ['grid', GridScreen],
    ['detail', DetailScreen],
    ['create', CreateScreen],
    ['edit', EditScreen],
    ['custom', CustomScreen],
  ] as const)('screen.%s marks its kind on the shell', (kind, Screen) => {
    render(<Screen title={kind}>x</Screen>);
    expect(screen.getByTestId('screen').getAttribute('data-screen-kind')).toBe(kind);
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
  });
});
