import Box from '@mui/material/Box';
import Breadcrumbs from '@mui/material/Breadcrumbs';
import Link from '@mui/material/Link';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import type { ScreenShellProps } from '../contracts.js';
import { useText } from '../i18n.js';

export type ScreenKind = 'list' | 'grid' | 'detail' | 'create' | 'edit' | 'custom';

/** The id a skip-to-content link targets. */
export const MAIN_CONTENT_ID = 'main-content';

/**
 * `screen.<kind>` — the page shell: one `h1`, breadcrumbs, the actions group and a `main` landmark
 * that is the skip-to-content target. Breadcrumb links are plain anchors; an app on a client router
 * registers its own shell override.
 */
export function ScreenShell(props: ScreenShellProps & { kind?: ScreenKind }) {
  const t = useText();
  return (
    <Box
      component="main"
      id={MAIN_CONTENT_ID}
      tabIndex={-1}
      data-testid="screen"
      data-screen-kind={props.kind ?? 'custom'}
      sx={{ p: 3, outline: 'none' }}
    >
      {props.breadcrumbs !== undefined && props.breadcrumbs.length > 0 && (
        <Breadcrumbs aria-label={t('screen.breadcrumbs')} sx={{ mb: 1 }}>
          {props.breadcrumbs.map((crumb, index) =>
            crumb.to !== undefined ? (
              <Link
                key={`${crumb.label}-${index}`}
                href={crumb.to}
                underline="hover"
                color="inherit"
              >
                {crumb.label}
              </Link>
            ) : (
              <Typography key={`${crumb.label}-${index}`} color="text.primary">
                {crumb.label}
              </Typography>
            ),
          )}
        </Breadcrumbs>
      )}
      <Stack
        direction="row"
        spacing={2}
        sx={{ mb: 2, alignItems: 'center', justifyContent: 'space-between' }}
      >
        <Typography component="h1" variant="h4">
          {props.title}
        </Typography>
        {props.actions !== undefined && (
          <Stack
            direction="row"
            spacing={1}
            role="group"
            aria-label={t('screen.actions')}
            data-testid="screen-actions"
          >
            {props.actions}
          </Stack>
        )}
      </Stack>
      <Box component="section" data-testid="screen-body">
        {props.children}
      </Box>
    </Box>
  );
}

function shell(kind: ScreenKind) {
  const Shell = (props: ScreenShellProps) => <ScreenShell {...props} kind={kind} />;
  Shell.displayName = `ScreenShell.${kind}`;
  return Shell;
}

/** `screen.list` */
export const ListScreen = shell('list');
/** `screen.grid` */
export const GridScreen = shell('grid');
/** `screen.detail` */
export const DetailScreen = shell('detail');
/** `screen.create` */
export const CreateScreen = shell('create');
/** `screen.edit` */
export const EditScreen = shell('edit');
/** `screen.custom` */
export const CustomScreen = shell('custom');
