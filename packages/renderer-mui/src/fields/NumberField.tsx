import MuiTextField from '@mui/material/TextField';
import type { NumberFieldProps } from '../contracts.js';
import { testId, useFieldIds } from './shared.js';

/** `field.number` — min, max and step come from the schema. */
export function NumberField(props: NumberFieldProps) {
  const { id, helperId } = useFieldIds(props.name);
  const hasError = props.error !== undefined;
  return (
    <MuiTextField
      id={id}
      type="number"
      name={props.name}
      label={props.label}
      value={props.value ?? ''}
      onChange={(e) => {
        const raw = e.target.value;
        props.onChange(raw === '' ? null : Number(raw));
      }}
      required={props.required ?? false}
      disabled={props.disabled ?? false}
      error={hasError}
      helperText={props.error ?? props.help}
      fullWidth
      data-testid={testId(props.name)}
      slotProps={{
        htmlInput: { min: props.min, max: props.max, step: props.step, inputMode: 'decimal' },
        input: { 'aria-describedby': hasError || props.help ? helperId : undefined },
        formHelperText: { id: helperId, role: hasError ? 'alert' : undefined },
      }}
    />
  );
}
