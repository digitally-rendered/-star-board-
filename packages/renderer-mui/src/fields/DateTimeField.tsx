import MuiTextField from '@mui/material/TextField';
import type { DateTimeFieldProps } from '../contracts.js';
import { testId, useFieldIds } from './shared.js';

/** ISO 8601 → the `datetime-local` control value (`YYYY-MM-DDTHH:mm`, local time). */
export function toLocalInput(iso: string): string {
  if (iso === '') return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** `datetime-local` control value → ISO 8601 (UTC), `''` when empty or unparsable. */
export function fromLocalInput(local: string): string {
  if (local === '') return '';
  const date = new Date(local);
  return Number.isNaN(date.getTime()) ? '' : date.toISOString();
}

/** `field.datetime` — a native date-time control; the value crosses the contract as ISO 8601. */
export function DateTimeField(props: DateTimeFieldProps) {
  const { id, helperId } = useFieldIds(props.name);
  const hasError = props.error !== undefined;
  return (
    <MuiTextField
      id={id}
      type="datetime-local"
      name={props.name}
      label={props.label}
      value={toLocalInput(props.value)}
      onChange={(e) => {
        props.onChange(fromLocalInput(e.target.value));
      }}
      required={props.required ?? false}
      disabled={props.disabled ?? false}
      error={hasError}
      helperText={props.error ?? props.help}
      fullWidth
      data-testid={testId(props.name)}
      slotProps={{
        inputLabel: { shrink: true },
        input: { 'aria-describedby': hasError || props.help ? helperId : undefined },
        formHelperText: { id: helperId, role: hasError ? 'alert' : undefined },
      }}
    />
  );
}
