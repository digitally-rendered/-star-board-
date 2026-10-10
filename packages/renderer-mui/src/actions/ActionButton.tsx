import { useId, useState } from 'react';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogTitle from '@mui/material/DialogTitle';
import type { ActionProps } from '../contracts.js';
import { useText } from '../i18n.js';

export type ActionKind = 'create' | 'update' | 'delete' | 'custom';

export function actionTestId(operationId: string): string {
  return `action-${operationId}`;
}

/**
 * `action.<kind>`: one operation as a button. `delete`, `destructive` and any `confirm` text go
 * through a dialog (never the browser's `confirm()`); `onClick` runs only after confirmation and
 * the button stays disabled while a returned promise is pending.
 */
export function ActionButton(props: ActionProps & { kind: ActionKind }) {
  const t = useText();
  const titleId = useId();
  const textId = useId();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const destructive = props.destructive ?? props.kind === 'delete';
  const needsConfirm = props.kind === 'delete' || destructive || props.confirm !== undefined;
  const confirmText = props.confirm ?? t('action.confirmDelete');
  const testId = actionTestId(props.operationId);

  const run = async () => {
    setBusy(true);
    try {
      await props.onClick();
    } finally {
      setBusy(false);
      setOpen(false);
    }
  };

  return (
    <>
      <Button
        type="button"
        variant={props.kind === 'create' ? 'contained' : 'outlined'}
        color={destructive ? 'error' : 'primary'}
        disabled={(props.disabled ?? false) || busy}
        onClick={() => {
          if (needsConfirm) setOpen(true);
          else void run();
        }}
        data-testid={testId}
        data-operation-id={props.operationId}
        data-action-kind={props.kind}
      >
        {props.label}
      </Button>
      {needsConfirm && (
        <Dialog
          open={open}
          onClose={() => {
            if (!busy) setOpen(false);
          }}
          aria-labelledby={titleId}
          aria-describedby={textId}
          data-testid={`${testId}-dialog`}
        >
          <DialogTitle id={titleId}>{props.label}</DialogTitle>
          <DialogContent>
            <DialogContentText id={textId}>{confirmText}</DialogContentText>
          </DialogContent>
          <DialogActions>
            <Button
              type="button"
              onClick={() => {
                setOpen(false);
              }}
              disabled={busy}
              data-testid={`${testId}-cancel`}
            >
              {t('action.cancel')}
            </Button>
            <Button
              type="button"
              variant="contained"
              color={destructive ? 'error' : 'primary'}
              onClick={() => void run()}
              disabled={busy}
              autoFocus
              data-testid={`${testId}-confirm`}
            >
              {props.label}
            </Button>
          </DialogActions>
        </Dialog>
      )}
    </>
  );
}

/** `action.create` */
export function CreateAction(props: ActionProps) {
  return <ActionButton {...props} kind="create" />;
}
/** `action.update` */
export function UpdateAction(props: ActionProps) {
  return <ActionButton {...props} kind="update" />;
}
/** `action.delete` — always confirms. */
export function DeleteAction(props: ActionProps) {
  return <ActionButton {...props} kind="delete" />;
}
/** `action.custom` */
export function CustomAction(props: ActionProps) {
  return <ActionButton {...props} kind="custom" />;
}
