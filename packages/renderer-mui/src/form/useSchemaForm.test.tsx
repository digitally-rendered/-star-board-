import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { useSchemaForm } from './useSchemaForm.js';

const PetCreate = z.object({
  name: z.string().min(1, 'Name is required'),
  age: z.number().int().min(0, 'Age cannot be negative'),
  owner: z.object({ id: z.string().min(1, 'Owner is required') }),
});

describe('useSchemaForm', () => {
  it('validates with the zod schema and exposes the first message per field, nested paths included', async () => {
    const onValid = vi.fn();
    const onInvalid = vi.fn();
    const { result } = renderHook(() =>
      useSchemaForm(PetCreate, { name: '', age: -1, owner: { id: '' } }),
    );
    await act(async () => {
      await result.current.handleSubmit(onValid, onInvalid)();
    });
    expect(onValid).not.toHaveBeenCalled();
    expect(onInvalid).toHaveBeenCalledTimes(1);
    expect(result.current.fieldError('name')).toBe('Name is required');
    expect(result.current.fieldError('age')).toBe('Age cannot be negative');
    expect(result.current.fieldError('owner.id')).toBe('Owner is required');
  });

  it('submits the parsed output when valid and clears errors', async () => {
    const onValid = vi.fn();
    const { result } = renderHook(() =>
      useSchemaForm(PetCreate, { name: 'Rex', age: 3, owner: { id: 'o1' } }),
    );
    await act(async () => {
      await result.current.handleSubmit(onValid)();
    });
    expect(onValid).toHaveBeenCalledWith({ name: 'Rex', age: 3, owner: { id: 'o1' } }, undefined);
    expect(result.current.fieldError('name')).toBeUndefined();
    expect(result.current.control).toBe(result.current.form.control);
  });
});
