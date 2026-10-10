// @vitest-environment jsdom
import { fixtures, setupServerFromModel } from '@star-board/testing';
import { renderRoutes } from '@star-board/testing/harness';
import { screen, waitFor, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { appRoutes } from './app.js';
import { MODEL } from './model.js';
import { harnessOptions, registerDefaultsOnly } from './testing.js';

/*
 * The unsaved-changes primitive end to end (typescript/05 §9): the generated create container
 * holds navigation while the form is dirty and asks through the renderer's dialog; a clean form
 * leaves at once. The save path (`release`) is covered by the workflow test, which creates a pet
 * and lands on its detail screen without a prompt.
 */

const { server, store } = setupServerFromModel(MODEL);
beforeAll(() => {
  server.listen();
});
afterEach(() => {
  store.reset();
});
afterAll(() => {
  server.close();
});

describe('unsaved changes on the create screen', () => {
  it('leaves a clean form without asking', async () => {
    const user = userEvent.setup();
    store.seed('pet', fixtures(MODEL, 'pet', 2, { seed: 21 }));
    const { router } = renderRoutes({
      ...harnessOptions(registerDefaultsOnly),
      routes: appRoutes(),
      initialEntries: ['/pet/new'],
    });
    await screen.findByTestId('pet-create-screen');
    await user.click(screen.getByTestId('pet-create-cancel'));
    await screen.findByTestId('pet-list-screen');
    expect(screen.queryByTestId('unsaved-changes-dialog')).toBeNull();
    expect(router.state.location.pathname).toBe('/pet');
  });

  it('holds a dirty form: stay keeps editing, leave discards and navigates', async () => {
    const user = userEvent.setup();
    store.seed('pet', fixtures(MODEL, 'pet', 2, { seed: 22 }));
    const { router } = renderRoutes({
      ...harnessOptions(registerDefaultsOnly),
      routes: appRoutes(),
      initialEntries: ['/pet/new'],
    });
    await screen.findByTestId('pet-create-screen');
    await user.type(within(screen.getByTestId('field-name')).getByRole('textbox'), 'Rex');

    await user.click(screen.getByTestId('pet-create-cancel'));
    const dialog = await screen.findByTestId('unsaved-changes-dialog');
    expect(within(dialog).getByRole('heading').textContent).toBe('Leave without saving?');
    expect(router.state.location.pathname).toBe('/pet/new');

    await user.click(screen.getByTestId('unsaved-changes-stay'));
    // MUI closes the dialog through a transition.
    await waitFor(() => {
      expect(screen.queryByTestId('unsaved-changes-dialog')).toBeNull();
    });
    expect(router.state.location.pathname).toBe('/pet/new');
    expect(within(screen.getByTestId('field-name')).getByRole('textbox')).toHaveProperty(
      'value',
      'Rex',
    );

    await user.click(screen.getByTestId('pet-create-cancel'));
    await user.click(await screen.findByTestId('unsaved-changes-leave'));
    await screen.findByTestId('pet-list-screen');
    expect(router.state.location.pathname).toBe('/pet');
  });
});
