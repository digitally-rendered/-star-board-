import AppBar from '@mui/material/AppBar';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Container from '@mui/material/Container';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import { MAIN_CONTENT_ID, SkipToContent } from '@star-board/renderer-mui';
import type { ReactElement } from 'react';
import { Link, Outlet } from 'react-router';
import { useT } from './generated/i18n.js';
import { nav } from './generated/nav.js';

/**
 * The app frame: the skip link first (typescript/05 §9), one navigation entry per schema (from the
 * generated `nav`, labelled through the provider's `t` so a locale switch reaches it), then the
 * route inside the `main` landmark the skip link targets.
 */
export function Layout(): ReactElement {
  const t = useT();
  return (
    <>
      <SkipToContent />
      <AppBar position="static" component="header">
        <Toolbar>
          <Typography variant="h6" component="span" sx={{ flexGrow: 1 }}>
            petstore-ui
          </Typography>
          <Box component="nav" aria-label={t('common.navigation')} data-testid="app-nav">
            {nav.map((entry) => (
              <Button
                key={entry.schema}
                component={Link}
                to={entry.path}
                color="inherit"
                data-testid={`nav-${entry.schema}`}
              >
                {t(entry.i18nKey)}
              </Button>
            ))}
          </Box>
        </Toolbar>
      </AppBar>
      <Container
        component="main"
        id={MAIN_CONTENT_ID}
        tabIndex={-1}
        maxWidth="lg"
        sx={{ py: 3, outline: 'none' }}
      >
        <Outlet />
      </Container>
    </>
  );
}
