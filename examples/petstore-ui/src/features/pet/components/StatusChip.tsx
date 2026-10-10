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
      color={STATUS_COLOR[raw] ?? 'default'}
      label={label}
      data-testid="pet-status-chip"
      data-status={raw}
    />
  );
}
