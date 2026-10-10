import Autocomplete from '@mui/material/Autocomplete';
import MuiTextField from '@mui/material/TextField';
import type { TagsFieldProps } from '../contracts.js';
import { useText } from '../i18n.js';
import { testId, useFieldIds } from './shared.js';

/** `field.tags` — a chip input over an array of primitives. */
export function TagsField(props: TagsFieldProps) {
  const { id, helperId } = useFieldIds(props.name);
  const t = useText();
  const hasError = props.error !== undefined;
  return (
    <Autocomplete<string, true, false, true>
      id={id}
      multiple
      freeSolo
      options={[]}
      value={props.value}
      onChange={(_, value) => {
        props.onChange(value);
      }}
      disabled={props.disabled ?? false}
      data-testid={testId(props.name)}
      slotProps={{ chip: { size: 'small' } }}
      renderInput={(params) => (
        <MuiTextField
          {...params}
          name={props.name}
          label={props.label}
          placeholder={t('field.addTag')}
          required={props.required ?? false}
          error={hasError}
          helperText={props.error ?? props.help}
          slotProps={{
            ...params.slotProps,
            input: {
              ...params.slotProps.input,
              'aria-describedby': hasError || props.help ? helperId : undefined,
            },
            htmlInput: {
              ...params.slotProps.htmlInput,
              // The marker shows whenever the field is required; the native constraint only while it is empty.
              required: (props.required ?? false) && props.value.length === 0,
              'data-testid': `${testId(props.name)}-input`,
            },
            formHelperText: { id: helperId, role: hasError ? 'alert' : undefined },
          }}
        />
      )}
    />
  );
}
