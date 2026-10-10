import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import FormHelperText from '@mui/material/FormHelperText';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import type { FieldDescriptor, SubformFieldProps, SubformValue } from '../contracts.js';
import { BooleanField } from './BooleanField.js';
import { DateTimeField } from './DateTimeField.js';
import { NumberField } from './NumberField.js';
import { ReferenceField } from './ReferenceField.js';
import { SelectField } from './SelectField.js';
import { TagsField } from './TagsField.js';
import { TextField } from './TextField.js';
import { testId, useFieldIds } from './shared.js';

const NO_SEARCH = () => Promise.resolve([]);

function isRecord(value: unknown): value is SubformValue {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Renders one nested field by its descriptor; `value` is the parent's slot for `d.name`. */
export function NestedField(props: {
  descriptor: FieldDescriptor;
  name: string;
  value: unknown;
  onChange: (v: unknown) => void;
}) {
  const { descriptor: d, name, value, onChange } = props;
  const common = {
    name,
    label: d.label,
    ...(d.help !== undefined ? { help: d.help } : {}),
    ...(d.required !== undefined ? { required: d.required } : {}),
    ...(d.disabled !== undefined ? { disabled: d.disabled } : {}),
  };
  switch (d.kind) {
    case 'text':
      return (
        <TextField {...common} value={typeof value === 'string' ? value : ''} onChange={onChange} />
      );
    case 'select':
      return (
        <SelectField
          {...common}
          options={[...(d.options ?? [])]}
          value={typeof value === 'string' ? value : ''}
          onChange={onChange}
        />
      );
    case 'datetime':
      return (
        <DateTimeField
          {...common}
          value={typeof value === 'string' ? value : ''}
          onChange={onChange}
        />
      );
    case 'number':
      return (
        <NumberField
          {...common}
          {...(d.min !== undefined ? { min: d.min } : {})}
          {...(d.max !== undefined ? { max: d.max } : {})}
          {...(d.step !== undefined ? { step: d.step } : {})}
          value={typeof value === 'number' ? value : null}
          onChange={onChange}
        />
      );
    case 'boolean':
      return <BooleanField {...common} value={value === true} onChange={onChange} />;
    case 'tags':
      return (
        <TagsField
          {...common}
          value={
            Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : []
          }
          onChange={onChange}
        />
      );
    case 'reference':
      return (
        <ReferenceField
          {...common}
          search={d.search ?? NO_SEARCH}
          value={typeof value === 'string' ? value : null}
          onChange={onChange}
        />
      );
    case 'subform':
      return (
        <SubformField
          {...common}
          fields={[...(d.fields ?? [])]}
          value={isRecord(value) ? value : {}}
          onChange={onChange}
        />
      );
  }
}

/** `field.subform` — a nested form section over an object value. */
export function SubformField(props: SubformFieldProps) {
  const { id, helperId } = useFieldIds(props.name);
  const hasError = props.error !== undefined;
  const helper = props.error ?? props.help;
  const legendId = `${id}-legend`;
  return (
    <Card
      component="fieldset"
      variant="outlined"
      id={id}
      aria-labelledby={legendId}
      aria-describedby={helper !== undefined ? helperId : undefined}
      aria-required={props.required ?? false}
      aria-invalid={hasError}
      disabled={props.disabled ?? false}
      data-testid={testId(props.name)}
      sx={{ border: 1, borderColor: hasError ? 'error.main' : 'divider', p: 0, m: 0, minWidth: 0 }}
    >
      <CardContent>
        <Typography component="legend" id={legendId} variant="subtitle1" sx={{ px: 0 }}>
          {props.label}
          {props.required === true && <span aria-hidden="true"> *</span>}
        </Typography>
        {helper !== undefined && (
          <FormHelperText id={helperId} error={hasError} role={hasError ? 'alert' : undefined}>
            {helper}
          </FormHelperText>
        )}
        <Stack spacing={2} sx={{ mt: 1 }}>
          {props.fields.map((d) => (
            <NestedField
              key={d.name}
              descriptor={d}
              name={`${props.name}.${d.name}`}
              value={props.value[d.name]}
              onChange={(v) => {
                props.onChange({ ...props.value, [d.name]: v });
              }}
            />
          ))}
        </Stack>
      </CardContent>
    </Card>
  );
}
