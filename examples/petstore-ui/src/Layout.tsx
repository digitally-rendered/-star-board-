import AppBar from '@mui/material/AppBar';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Container from '@mui/material/Container';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import type { ReactElement } from 'react';
import { Link, Outlet } from 'react-router';
import { nav } from './generated/nav.js';

/** The app frame: one navigation entry per schema (from the generated `nav`), then the route. */
export function Layout(): ReactElement {
  return (
    <>
      <AppBar position="static" component="header">
        <Toolbar>
          <Typography variant="h6" component="span" sx={{ flexGrow: 1 }}>
            petstore-ui
          </Typography>
          <Box component="nav" aria-label="Schemas" data-testid="app-nav">
            {nav.map((entry) => (
              <Button
                key={entry.schema}
                component={Link}
                to={entry.path}
                color="inherit"
                data-testid={`nav-${entry.schema}`}
              >
                {entry.label}
              </Button>
            ))}
          </Box>
        </Toolbar>
      </AppBar>
      <Container component="main" maxWidth="lg" sx={{ py: 3 }}>
        <Outlet />
      </Container>
    </>
  );
}
