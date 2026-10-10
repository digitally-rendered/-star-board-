import FormControl from '@mui/material/FormControl';
import FormControlLabel from '@mui/material/FormControlLabel';
import FormHelperText from '@mui/material/FormHelperText';
import Switch from '@mui/material/Switch';
import type { BooleanFieldProps } from '../contracts.js';
import { testId, useFieldIds } from './shared.js';

/** `field.boolean` — a switch (`x-ui-widget: checkbox` is an override concern). */
export function BooleanField(props: BooleanFieldProps) {
  const { id, helperId } = useFieldIds(props.name);
  const hasError = props.error !== undefined;
  const helper = props.error ?? props.help;
  return (
    <FormControl
      error={hasError}
      disabled={props.disabled ?? false}
      required={props.required ?? false}
      data-testid={testId(props.name)}
    >
      <FormControlLabel
        label={props.label}
        required={props.required ?? false}
        control={
          <Switch
            id={id}
            name={props.name}
            checked={props.value}
            onChange={(_, checked) => {
              props.onChange(checked);
            }}
            slotProps={{
              input: { 'aria-describedby': helper !== undefined ? helperId : undefined },
            }}
          />
        }
      />
      {helper !== undefined && (
        <FormHelperText id={helperId} role={hasError ? 'alert' : undefined}>
          {helper}
        </FormHelperText>
      )}
    </FormControl>
  );
}
