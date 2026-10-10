import Chip, { type ChipProps } from '@mui/material/Chip';
import type { CellProps } from '@star-board/renderer-mui';
import type { ReactElement } from 'react';

/** Palette slot per status; colours come from the theme (tokens), never from literals. */
const STATUS_COLOR: Readonly<Record<string, ChipProps['color']>> = {
  available: 'success',
  pending: 'warning',
  sold: 'default',
};

/**
 * Column-renderer override (typescript/12 §3): `list.column.enum` for `pet`/`status`, a coloured
 * chip in place of the renderer's neutral one. Same `CellProps`; the label still comes from the
 * column's options so translations keep working.
 */
export function StatusChip(props: CellProps): ReactElement {
  const raw = typeof props.value === 'string' ? props.value : '';
  const label = props.column.options?.find((o) => o.value === raw)?.label ?? raw;
  return (
    <Chip
      size="small"
      variant="outlined"
      color={STATUS_COLOR[raw] ?? 'default'}
      // The status colour sits on the border; the label keeps the text colour so the chip meets
      // the 4.5:1 contrast ratio on every palette slot (axe in the browser E2E checks this).
      sx={{ color: 'text.primary', fontWeight: 500 }}
      label={label}
      data-testid="pet-status-chip"
      data-status={raw}
    />
  );
}
