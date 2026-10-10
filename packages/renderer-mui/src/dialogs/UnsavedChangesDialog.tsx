import { useId } from 'react';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogTitle from '@mui/material/DialogTitle';
import { useText } from '../i18n.js';

/**
 * The registry target of the dialog: `screen.custom` at `unsaved-changes`, schema `'*'`. The
 * generated `UnsavedChangesSlot` resolves it, so an app replaces the dialog for one schema by
 * registering at the same key and target without a new contract key.
 */
export const UNSAVED_CHANGES_TARGET = 'unsaved-changes';

export interface UnsavedChangesDialogProps {
  /** True while the runtime's `useUnsavedChanges` holds a navigation back. */
  open: boolean;
  /** Keep editing. */
  onStay: () => void;
  /** Discard the changes and continue the navigation. */
  onLeave: () => void;
  /** Optional wording override; default the `unsaved.text` message. */
  text?: string;
}

/**
 * The unsaved-changes primitive (typescript/05 §9), the component half: a modal that asks before
 * a dirty form is left. Pairs with the runtime's `useUnsavedChanges(isDirty)`; "stay" is the
 * default focused action so Enter never discards work.
 */
export function UnsavedChangesDialog(props: UnsavedChangesDialogProps) {
  const t = useText();
  const titleId = useId();
  const textId = useId();
  return (
    <Dialog
      open={props.open}
      onClose={props.onStay}
      aria-labelledby={titleId}
      aria-describedby={textId}
      data-testid="unsaved-changes-dialog"
    >
      <DialogTitle id={titleId}>{t('unsaved.title')}</DialogTitle>
      <DialogContent>
        <DialogContentText id={textId}>{props.text ?? t('unsaved.text')}</DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button
          type="button"
          variant="contained"
          onClick={props.onStay}
          autoFocus
          data-testid="unsaved-changes-stay"
        >
          {t('unsaved.stay')}
        </Button>
        <Button
          type="button"
          color="error"
          onClick={props.onLeave}
          data-testid="unsaved-changes-leave"
        >
          {t('unsaved.leave')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
