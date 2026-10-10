// @vitest-environment jsdom
import { fixtures, setupServerFromModel } from '@star-board/testing';
import { expectNoViolations, renderRoutes } from '@star-board/testing/harness';
import { screen, waitFor, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { appRoutes } from './app.js';
import { MODEL } from './model.js';
import { harnessOptions, registerWithOverrides } from './testing.js';

/*
 * Checkpoint 14: the full workflow through the generated routes, answered by msw from the
 * document — list → create → detail → edit (If-Match) → delete (confirm) → list → 404.
 */

const { server, store } = setupServerFromModel(MODEL);
const ifMatchHeaders: string[] = [];
beforeAll(() => {
  server.listen();
  server.events.on('request:start', ({ request }) => {
    if (request.method === 'PATCH') ifMatchHeaders.push(request.headers.get('if-match') ?? '');
  });
});
afterEach(() => {
  store.reset();
  ifMatchHeaders.length = 0;
});
afterAll(() => {
  server.close();
});

async function selectOption(
  user: ReturnType<typeof userEvent.setup>,
  field: string,
  value: string,
) {
  await user.click(within(screen.getByTestId(`field-${field}`)).getByRole('combobox'));
  await user.click(await screen.findByTestId(`field-${field}-option-${value}`));
}

describe('petstore workflow', () => {
  it('lists, creates, shows, edits with If-Match, deletes with confirmation and 404s the deleted id', async () => {
    const user = userEvent.setup();
    const seeded = store.seed('pet', fixtures(MODEL, 'pet', 3, { seed: 5 }));
    const { router, container } = renderRoutes({
      ...harnessOptions(registerWithOverrides),
      routes: appRoutes(),
      initialEntries: ['/pet'],
    });

    // List shows the seeded rows.
    await screen.findByTestId('pet-list-table');
    for (const row of seeded)
      expect(screen.getByTestId(`pet-list-row-${String(row.entity_id)}`)).toBeTruthy();
    await expectNoViolations(container);

    // Create: fill name and species through the field test ids, submit.
    await user.click(screen.getByTestId('action-pet_create'));
    await screen.findByTestId('pet-create-screen');
    await user.type(within(screen.getByTestId('field-name')).getByRole('textbox'), 'Rex');
    expect(screen.getByTestId('pet-name-counter').textContent).toBe('3/80');
    await selectOption(user, 'species', 'dog');
    await expectNoViolations(container);
    await user.click(
      within(screen.getByTestId('pet-create-actions')).getByTestId('action-pet_create'),
    );

    // Detail shows the new row (through the whole-screen override).
    await screen.findByTestId('pet-detail-screen');
    const id = router.state.location.pathname.split('/').pop() ?? '';
    expect(store.get('pet', id)?.name).toBe('Rex');
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Rex');
    expect(screen.getByTestId('pet-status-chip').getAttribute('data-status')).toBe('available');
    await expectNoViolations(container);

    // Edit: change status, save; the PATCH carries the document's If-Match and bumps the version.
    await user.click(screen.getByTestId('action-pet_update'));
    await screen.findByTestId('pet-edit-screen');
    await selectOption(user, 'status', 'sold');
    await expectNoViolations(container);
    await user.click(
      within(screen.getByTestId('pet-edit-actions')).getByTestId('action-pet_update'),
    );
    await screen.findByTestId('pet-detail-screen');
    await waitFor(() => {
      expect(screen.getByTestId('pet-status-chip').getAttribute('data-status')).toBe('sold');
    });
    expect(ifMatchHeaders).toEqual([`W/"${id}:1"`]);
    expect(store.get('pet', id)?.record_version).toBe(2);

    // Delete goes through the confirmation dialog, then the list no longer shows the row.
    await user.click(screen.getByTestId('action-pet_delete'));
    await user.click(await screen.findByTestId('action-pet_delete-confirm'));
    await screen.findByTestId('pet-list-table');
    expect(screen.queryByTestId(`pet-list-row-${id}`)).toBeNull();
    expect(store.get('pet', id)).toBeUndefined();

    // The detail route of the deleted id answers 404 → the not-found (empty) state.
    await router.navigate(`/pet/${id}`);
    await screen.findByTestId('state-empty');
    expect(screen.queryByTestId('pet-detail-screen')).toBeNull();
    await expectNoViolations(container);
  });

  it('shows the grid view with its filter and sorts the list', async () => {
    const user = userEvent.setup();
    store.seed('pet', fixtures(MODEL, 'pet', 4, { seed: 9 }));
    const { router } = renderRoutes({
      ...harnessOptions(registerWithOverrides),
      routes: appRoutes(),
      initialEntries: ['/views/available_pets'],
    });
    await screen.findByTestId('pet-grid-table');
    expect(screen.getByTestId('pet-grid-filters')).toBeTruthy();
    await selectOption(user, 'species', 'cat');
    await waitFor(() => {
      for (const cell of screen.queryAllByTestId('cell-species'))
        expect(cell.textContent).toBe('Cat');
    });
    await router.navigate('/pet');
    await screen.findByTestId('pet-list-table');
    await user.click(screen.getByTestId('pet-list-sort-name'));
    await waitFor(() => {
      const names = screen.getAllByTestId('cell-name').map((cell) => cell.textContent);
      expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
    });
  });
});
