import Alert from '@mui/material/Alert';
import AlertTitle from '@mui/material/AlertTitle';
import Button from '@mui/material/Button';
import type { StateProps } from '../contracts.js';
import { useText } from '../i18n.js';

/** `state.error` — an alert with a retry action. */
export function ErrorState(props: StateProps) {
  const t = useText();
  return (
    <Alert
      severity="error"
      role="alert"
      data-testid="state-error"
      action={
        props.action !== undefined ? (
          <Button
            color="inherit"
            size="small"
            onClick={props.action.onClick}
            data-testid="state-error-action"
          >
            {props.action.label || t('state.retry')}
          </Button>
        ) : undefined
      }
    >
      <AlertTitle>{props.title}</AlertTitle>
      {props.description}
    </Alert>
  );
}
