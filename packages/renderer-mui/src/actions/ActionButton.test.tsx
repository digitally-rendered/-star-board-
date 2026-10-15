import { render, screen, waitFor } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { expectNoViolations } from '../../test/a11y.js';
import { CreateAction, CustomAction, DeleteAction, UpdateAction } from './ActionButton.js';

describe('actions', () => {
  it('action.create / update / custom call onClick directly and carry the operation id', async () => {
    const onClick = vi.fn();
    const { container } = render(
      <>
        <CreateAction operationId="pet_create" label="New pet" onClick={onClick} />
        <UpdateAction operationId="pet_update" label="Save" onClick={onClick} />
        <CustomAction operationId="pet_archive" label="Archive" onClick={onClick} disabled />
      </>,
    );
    await userEvent.click(screen.getByTestId('action-pet_create'));
    await userEvent.click(screen.getByTestId('action-pet_update'));
    expect(onClick).toHaveBeenCalledTimes(2);
    expect(screen.getByTestId<HTMLButtonElement>('action-pet_archive').disabled).toBe(true);
    expect(screen.getByTestId('action-pet_create').getAttribute('data-operation-id')).toBe(
      'pet_create',
    );
    expect(screen.queryByRole('dialog')).toBeNull();
    await expectNoViolations(container);
  });

  it('honours variant and testId for buttons that are not operations', () => {
    render(
      <>
        <CustomAction
          operationId="cancel"
          label="Cancel"
          onClick={vi.fn()}
          variant="text"
          testId="pet-create-cancel"
        />
        <UpdateAction operationId="pet_update" label="Save" onClick={vi.fn()} variant="contained" />
        <CreateAction operationId="pet_create" label="New" onClick={vi.fn()} />
      </>,
    );
    const cancel = screen.getByTestId('pet-create-cancel');
    expect(cancel.className).toContain('MuiButton-text');
    expect(screen.queryByTestId('action-cancel')).toBeNull();
    expect(screen.getByTestId('action-pet_update').className).toContain('MuiButton-contained');
    expect(screen.getByTestId('action-pet_create').className).toContain('MuiButton-contained');
  });

  it('action.delete opens a confirmation dialog and calls onClick only on confirm', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm');
    const onClick = vi.fn(() => Promise.resolve());
    render(
      <DeleteAction
        operationId="pet_delete"
        label="Delete"
        confirm="Delete Rex for good?"
        onClick={onClick}
      />,
    );
    await userEvent.click(screen.getByTestId('action-pet_delete'));
    const dialog = await screen.findByRole('dialog', { name: 'Delete' });
    expect(dialog.textContent).toContain('Delete Rex for good?');
    expect(onClick).not.toHaveBeenCalled();
    await userEvent.click(screen.getByTestId('action-pet_delete-cancel'));
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });
    expect(onClick).not.toHaveBeenCalled();
    await userEvent.click(screen.getByTestId('action-pet_delete'));
    await userEvent.click(await screen.findByTestId('action-pet_delete-confirm'));
    expect(onClick).toHaveBeenCalledTimes(1);
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });
    expect(confirmSpy).not.toHaveBeenCalled();
    confirmSpy.mockRestore();
  });

  it('the dialog is accessible and uses the default confirm text', async () => {
    render(<DeleteAction operationId="pet_delete" label="Delete" onClick={vi.fn()} />);
    await userEvent.click(screen.getByTestId('action-pet_delete'));
    const dialog = await screen.findByRole('dialog');
    expect(dialog.textContent).toContain('This cannot be undone');
    await expectNoViolations(dialog);
  });

  it('a confirm text on a non-delete action also goes through the dialog; busy while pending', async () => {
    let release: () => void = () => undefined;
    const onClick = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          release = resolve;
        }),
    );
    render(
      <CustomAction
        operationId="pet_archive"
        label="Archive"
        confirm="Archive it?"
        onClick={onClick}
      />,
    );
    await userEvent.click(screen.getByTestId('action-pet_archive'));
    await userEvent.click(await screen.findByTestId('action-pet_archive-confirm'));
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId<HTMLButtonElement>('action-pet_archive-confirm').disabled).toBe(true);
    release();
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });
    expect(screen.getByTestId<HTMLButtonElement>('action-pet_archive').disabled).toBe(false);
  });
});
