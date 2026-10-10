import InboxOutlinedIcon from '@mui/icons-material/InboxOutlined';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { useId } from 'react';
import type { StateProps } from '../contracts.js';

/** `state.empty` — a labelled region with an optional primary action. */
export function EmptyState(props: StateProps) {
  const titleId = useId();
  return (
    <Stack
      role="region"
      aria-labelledby={titleId}
      spacing={1}
      sx={{ p: 4, textAlign: 'center', alignItems: 'center' }}
      data-testid="state-empty"
    >
      <InboxOutlinedIcon fontSize="large" aria-hidden="true" />
      <Typography id={titleId} component="h2" variant="h6">
        {props.title}
      </Typography>
      {props.description !== undefined && (
        <Typography variant="body2" color="text.secondary">
          {props.description}
        </Typography>
      )}
      {props.action !== undefined && (
        <Button variant="contained" onClick={props.action.onClick} data-testid="state-empty-action">
          {props.action.label}
        </Button>
      )}
    </Stack>
  );
}
