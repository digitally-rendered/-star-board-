import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import type { StateProps } from '../contracts.js';

/** `state.loading` — a polite live status with skeleton placeholders. */
export function LoadingState(props: StateProps) {
  return (
    <Stack
      role="status"
      aria-live="polite"
      aria-busy="true"
      spacing={1}
      sx={{ p: 2 }}
      data-testid="state-loading"
    >
      <Typography variant="body2" color="text.secondary">
        {props.title}
      </Typography>
      {props.description !== undefined && (
        <Typography variant="caption" color="text.secondary">
          {props.description}
        </Typography>
      )}
      <Skeleton variant="text" aria-hidden="true" />
      <Skeleton variant="rectangular" height={120} aria-hidden="true" />
      <Skeleton variant="text" width="60%" aria-hidden="true" />
    </Stack>
  );
}
