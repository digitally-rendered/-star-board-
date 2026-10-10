import Alert from '@mui/material/Alert';
import AlertTitle from '@mui/material/AlertTitle';
import Button from '@mui/material/Button';
import type { StateProps } from '../contracts.js';

/** `state.forbidden` — the capability was absent; the message never names what was hidden. */
export function ForbiddenState(props: StateProps) {
  return (
    <Alert
      severity="warning"
      role="status"
      data-testid="state-forbidden"
      action={
        props.action !== undefined ? (
          <Button
            color="inherit"
            size="small"
            onClick={props.action.onClick}
            data-testid="state-forbidden-action"
          >
            {props.action.label}
          </Button>
        ) : undefined
      }
    >
      <AlertTitle>{props.title}</AlertTitle>
      {props.description}
    </Alert>
  );
}
