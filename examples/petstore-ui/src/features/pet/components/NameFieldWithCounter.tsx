import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { TextField, type FieldProps } from '@star-board/renderer-mui';
import type { ReactElement } from 'react';

/** `name` is `maxLength: 80` in the document; the counter shows how much of it is used. */
export const NAME_MAX_LENGTH = 80;

/**
 * Field-widget override (typescript/12 §3, narrowest granularity): `field.text` for `pet`/`name`.
 * It wraps the renderer default and adds a live character counter; same props, same test ids.
 * The counter sits where the field's helper text sits (same inset, right-aligned, its own line),
 * so it never collides with the next field's floating label.
 */
export function NameFieldWithCounter(props: FieldProps<string>): ReactElement {
  const used = props.value.length;
  return (
    <Box data-testid="pet-name-field">
      <TextField {...props} />
      <Typography
        component="div"
        variant="caption"
        color={used > NAME_MAX_LENGTH ? 'error' : 'text.secondary'}
        aria-live="polite"
        sx={{ mt: 0.5, px: 1.75, textAlign: 'right', lineHeight: 1.66 }}
        data-testid="pet-name-counter"
      >
        {used}/{NAME_MAX_LENGTH}
      </Typography>
    </Box>
  );
}
