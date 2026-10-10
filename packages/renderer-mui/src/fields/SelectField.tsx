import MenuItem from '@mui/material/MenuItem';
import MuiTextField from '@mui/material/TextField';
import type { SelectFieldProps } from '../contracts.js';
import { testId, useFieldIds } from './shared.js';

/** `field.select` */
export function SelectField(props: SelectFieldProps) {
  const { id, helperId } = useFieldIds(props.name);
  const hasError = props.error !== undefined;
  return (
    <MuiTextField
      select
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
        select: {
          'aria-describedby': hasError || props.help ? helperId : undefined,
          inputProps: { 'data-testid': `${testId(props.name)}-input` },
        },
        formHelperText: { id: helperId, role: hasError ? 'alert' : undefined },
      }}
    >
      {props.options.map((o) => (
        <MenuItem
          key={o.value}
          value={o.value}
          data-testid={`${testId(props.name)}-option-${o.value}`}
        >
          {o.label}
        </MenuItem>
      ))}
    </MuiTextField>
  );
}
