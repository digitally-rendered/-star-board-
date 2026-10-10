import Link from '@mui/material/Link';
import { useText } from '../i18n.js';
import { MAIN_CONTENT_ID } from './ScreenShell.js';

export interface SkipToContentProps {
  /** The landmark to jump to; default the shell's `main` (`MAIN_CONTENT_ID`). */
  targetId?: string;
}

/**
 * The skip link (typescript/05 §9): the first focusable element of the page, visually hidden until
 * it receives focus, jumping to the `main` landmark every shell renders. Mount it once in the app
 * frame before the navigation.
 */
export function SkipToContent(props: SkipToContentProps) {
  const t = useText();
  const target = props.targetId ?? MAIN_CONTENT_ID;
  return (
    <Link
      href={`#${target}`}
      data-testid="skip-to-content"
      onClick={(event) => {
        const element = document.getElementById(target);
        if (element === null) return;
        event.preventDefault();
        element.focus();
        element.scrollIntoView();
      }}
      sx={{
        position: 'absolute',
        left: 0,
        top: 0,
        zIndex: (theme) => theme.zIndex.tooltip,
        px: 2,
        py: 1,
        minHeight: 'var(--sb-density-row)',
        bgcolor: 'background.paper',
        // Off-canvas until focused, never `display: none`, so keyboard users reach it first.
        transform: 'translateY(-200%)',
        '&:focus': { transform: 'none' },
      }}
    >
      {t('screen.skipToContent')}
    </Link>
  );
}
