import { useEffect, useMemo, useState } from 'react';
import Autocomplete from '@mui/material/Autocomplete';
import MuiTextField from '@mui/material/TextField';
import type { Option, ReferenceFieldProps } from '../contracts.js';
import { useText } from '../i18n.js';
import { testId, useFieldIds } from './shared.js';

export const REFERENCE_SEARCH_DEBOUNCE_MS = 200;

/** `field.reference` — an async picker over the referenced list; the value is the entity id. */
export function ReferenceField(props: ReferenceFieldProps) {
  const { id, helperId } = useFieldIds(props.name);
  const t = useText();
  const hasError = props.error !== undefined;
  const [query, setQuery] = useState('');
  const [options, setOptions] = useState<Option[]>([]);
  const [loading, setLoading] = useState(false);
  const { search } = props;

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const handle = setTimeout(() => {
      search(query)
        .then((found) => {
          if (!cancelled) setOptions(found);
        })
        .catch(() => {
          if (!cancelled) setOptions([]);
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }, REFERENCE_SEARCH_DEBOUNCE_MS);
    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [query, search]);

  const selected = useMemo<Option | null>(() => {
    if (props.value === null) return null;
    return (
      options.find((o) => o.value === props.value) ?? { value: props.value, label: props.value }
    );
  }, [options, props.value]);

  return (
    <Autocomplete<Option>
      id={id}
      options={options}
      value={selected}
      loading={loading}
      loadingText={t('field.loading')}
      noOptionsText={t('field.noOptions')}
      isOptionEqualToValue={(a, b) => a.value === b.value}
      getOptionLabel={(o) => o.label}
      filterOptions={(all) => all}
      onInputChange={(_, value, reason) => {
        if (reason === 'input') setQuery(value);
      }}
      onChange={(_, value) => {
        props.onChange(value?.value ?? null);
      }}
      disabled={props.disabled ?? false}
      data-testid={testId(props.name)}
      renderInput={(params) => (
        <MuiTextField
          {...params}
          name={props.name}
          label={props.label}
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
              'data-testid': `${testId(props.name)}-input`,
            },
            formHelperText: { id: helperId, role: hasError ? 'alert' : undefined },
          }}
        />
      )}
    />
  );
}
