import MuiTextField from '@mui/material/TextField';
import type { TextFieldProps } from '../contracts.js';
import { testId, useFieldIds } from './shared.js';

/** `field.text` */
export function TextField(props: TextFieldProps) {
  const { id, helperId } = useFieldIds(props.name);
  const hasError = props.error !== undefined;
  return (
    <MuiTextField
      id={id}
      name={props.name}
      label={props.label}
      value={props.value}
      onChange={(e) => {
        props.onChange(e.target.value);
      }}
      required={props.required ?? false}
      disabled={props.disabled ?? false}
      error={hasError}
      helperText={props.error ?? props.help}
      fullWidth
      data-testid={testId(props.name)}
      slotProps={{
        input: { 'aria-describedby': hasError || props.help ? helperId : undefined },
        formHelperText: { id: helperId, role: hasError ? 'alert' : undefined },
      }}
    />
  );
}
