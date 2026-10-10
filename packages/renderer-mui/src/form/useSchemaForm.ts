import { zodResolver } from '@hookform/resolvers/zod';
import {
  useForm,
  type Control,
  type DefaultValues,
  type FieldErrors,
  type FieldValues,
  type Path,
  type UseFormHandleSubmit,
  type UseFormReturn,
} from 'react-hook-form';
import type { z } from 'zod';

export interface SchemaForm<Input extends FieldValues, Output> {
  control: Control<Input, unknown, Output>;
  handleSubmit: UseFormHandleSubmit<Input, Output>;
  /** The first validation message for a field, for the field component's `error` prop. */
  fieldError: (name: Path<Input>) => string | undefined;
  /** The underlying react-hook-form instance for anything beyond the three above. */
  form: UseFormReturn<Input, unknown, Output>;
}

/** The message at a dotted path in the errors tree (`owner.id`), if any. */
function messageAt(errors: FieldErrors, path: string): string | undefined {
  let node: unknown = errors;
  for (const part of path.split('.')) {
    if (typeof node !== 'object' || node === null) return undefined;
    node = (node as Record<string, unknown>)[part];
  }
  if (typeof node !== 'object' || node === null) return undefined;
  const message = (node as { message?: unknown }).message;
  return typeof message === 'string' ? message : undefined;
}

/**
 * React Hook Form over the generated zod schema (typescript/12 §3: the schema validates in the UI
 * exactly as the backend does). Validation runs on blur and again on submit.
 */
export function useSchemaForm<Input extends FieldValues, Output = Input>(
  schema: z.ZodType<Output, Input>,
  defaults: DefaultValues<Input>,
): SchemaForm<Input, Output> {
  const form = useForm<Input, unknown, Output>({
    resolver: zodResolver<Input, unknown, Output>(schema),
    defaultValues: defaults,
    mode: 'onTouched',
  });
  // Reading `errors` during render subscribes this hook to them (react-hook-form's formState proxy),
  // so a validation pass re-renders the caller and `fieldError` reads fresh state.
  const { errors } = form.formState;
  return {
    control: form.control,
    handleSubmit: form.handleSubmit,
    fieldError: (name) => messageAt(errors, name),
    form,
  };
}
