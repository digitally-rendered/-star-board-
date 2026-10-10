import { act, cleanup, render, screen } from '@testing-library/react';
import { useState, type ReactElement } from 'react';
import { createMemoryRouter, RouterProvider, useNavigate } from 'react-router';
import { afterEach, describe, expect, it } from 'vitest';
import { useUnsavedChanges } from './useUnsavedChanges.js';

function Form(): ReactElement {
  const navigate = useNavigate();
  const [dirty, setDirty] = useState(false);
  const unsaved = useUnsavedChanges(dirty);
  return (
    <div>
      <button
        type="button"
        data-testid="edit"
        onClick={() => {
          setDirty(true);
        }}
      >
        edit
      </button>
      <button
        type="button"
        data-testid="go"
        onClick={() => {
          void navigate('/elsewhere');
        }}
      >
        go
      </button>
      <button
        type="button"
        data-testid="save"
        onClick={() => {
          unsaved.release(() => void navigate('/elsewhere'));
        }}
      >
        save
      </button>
      {unsaved.blocked ? (
        <div role="dialog" data-testid="dialog">
          <button type="button" data-testid="stay" onClick={unsaved.stay}>
            stay
          </button>
          <button type="button" data-testid="leave" onClick={unsaved.leave}>
            leave
          </button>
        </div>
      ) : null}
    </div>
  );
}

function mount() {
  const router = createMemoryRouter(
    [
      { path: '/form', element: <Form /> },
      { path: '/elsewhere', element: <p data-testid="elsewhere">elsewhere</p> },
    ],
    { initialEntries: ['/form'] },
  );
  render(<RouterProvider router={router} />);
  return router;
}

afterEach(() => {
  cleanup();
});

describe('useUnsavedChanges', () => {
  it('lets a clean form navigate and holds a dirty one until the user decides', async () => {
    const router = mount();
    await act(async () => {
      screen.getByTestId('go').click();
      await Promise.resolve();
    });
    expect(screen.getByTestId('elsewhere')).toBeTruthy();
    expect(router.state.location.pathname).toBe('/elsewhere');

    await act(async () => {
      await router.navigate('/form');
    });
    await act(async () => {
      screen.getByTestId('edit').click();
      await Promise.resolve();
    });
    await act(async () => {
      screen.getByTestId('go').click();
      await Promise.resolve();
    });
    expect(screen.getByTestId('dialog')).toBeTruthy();
    expect(router.state.location.pathname).toBe('/form');

    await act(async () => {
      screen.getByTestId('stay').click();
      await Promise.resolve();
    });
    expect(screen.queryByTestId('dialog')).toBeNull();
    expect(router.state.location.pathname).toBe('/form');

    await act(async () => {
      screen.getByTestId('go').click();
      await Promise.resolve();
    });
    await act(async () => {
      screen.getByTestId('leave').click();
      await Promise.resolve();
    });
    expect(await screen.findByTestId('elsewhere')).toBeTruthy();
  });

  it('release navigates a dirty form without asking (the save path)', async () => {
    const router = mount();
    await act(async () => {
      screen.getByTestId('edit').click();
      await Promise.resolve();
    });
    await act(async () => {
      screen.getByTestId('save').click();
      await Promise.resolve();
    });
    expect(await screen.findByTestId('elsewhere')).toBeTruthy();
    expect(router.state.location.pathname).toBe('/elsewhere');
  });

  it('asks before the tab unloads only while dirty', async () => {
    mount();
    const unload = () => {
      const event = new Event('beforeunload', { cancelable: true });
      window.dispatchEvent(event);
      return event.defaultPrevented;
    };
    expect(unload()).toBe(false);
    await act(async () => {
      screen.getByTestId('edit').click();
      await Promise.resolve();
    });
    expect(unload()).toBe(true);
  });
});
