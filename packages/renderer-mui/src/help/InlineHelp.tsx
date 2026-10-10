import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import Typography from '@mui/material/Typography';
import type { HelpProps } from '../contracts.js';

/**
 * `help.inline` — helper text from `x-*-reason` or a description, addressable by `id` so a control
 * can point `aria-describedby` at it.
 */
export function InlineHelp(props: HelpProps) {
  return (
    <Typography
      id={props.id}
      component="p"
      variant="caption"
      color="text.secondary"
      role="note"
      data-testid={`help-${props.id}`}
      sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}
    >
      <InfoOutlinedIcon fontSize="inherit" aria-hidden="true" />
      {props.text}
    </Typography>
  );
}
