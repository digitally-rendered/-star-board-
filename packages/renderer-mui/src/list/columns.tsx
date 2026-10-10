import CheckIcon from '@mui/icons-material/Check';
import CloseIcon from '@mui/icons-material/Close';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import type { ListColumnType } from '@star-board/tokens';
import type { ComponentType } from 'react';
import type { CellProps } from '../contracts.js';
import { useText } from '../i18n.js';

function text(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') {
    return String(value);
  }
  return JSON.stringify(value);
}

/** `list.column.string` */
export function StringCell(props: CellProps) {
  return <span data-testid={`cell-${props.column.field}`}>{text(props.value)}</span>;
}

/** `list.column.number` — locale-formatted, right-aligned. */
export function NumberCell(props: CellProps) {
  const label =
    typeof props.value === 'number'
      ? new Intl.NumberFormat().format(props.value)
      : text(props.value);
  return (
    <Box
      component="span"
      sx={{ display: 'block', width: '100%', textAlign: 'right' }}
      data-testid={`cell-${props.column.field}`}
    >
      {label}
    </Box>
  );
}

/** `list.column.boolean` — an icon with a spoken label. */
export function BooleanCell(props: CellProps) {
  const t = useText();
  const yes = props.value === true;
  const label = yes ? t('field.yes') : t('field.no');
  return (
    <Box
      component="span"
      role="img"
      aria-label={label}
      title={label}
      data-testid={`cell-${props.column.field}`}
      sx={{ display: 'inline-flex', alignItems: 'center' }}
    >
      {yes ? <CheckIcon fontSize="small" /> : <CloseIcon fontSize="small" />}
    </Box>
  );
}

/** `list.column.date-time` — a `<time>` with the machine value and a locale-formatted label. */
export function DateTimeCell(props: CellProps) {
  const raw = text(props.value);
  if (raw === '') return <span data-testid={`cell-${props.column.field}`} />;
  const date = new Date(raw);
  const valid = !Number.isNaN(date.getTime());
  return (
    <time dateTime={valid ? date.toISOString() : raw} data-testid={`cell-${props.column.field}`}>
      {valid
        ? new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(
            date,
          )
        : raw}
    </time>
  );
}

/** `list.column.enum` — the option label as a chip. */
export function EnumCell(props: CellProps) {
  const raw = text(props.value);
  if (raw === '') return <span data-testid={`cell-${props.column.field}`} />;
  const label = props.column.options?.find((o) => o.value === raw)?.label ?? raw;
  return <Chip size="small" label={label} data-testid={`cell-${props.column.field}`} />;
}

function referenceLabel(value: unknown): string {
  if (typeof value === 'object' && value !== null) {
    const record = value as Record<string, unknown>;
    for (const key of ['label', 'name', 'title', 'id']) {
      const candidate = record[key];
      if (typeof candidate === 'string') return candidate;
    }
  }
  return text(value);
}

/** `list.column.reference` — the referenced entity's label (or id). */
export function ReferenceCell(props: CellProps) {
  return <span data-testid={`cell-${props.column.field}`}>{referenceLabel(props.value)}</span>;
}

/** The default cell renderer per `list.column.<type>`. */
export const CELLS: Readonly<Record<ListColumnType, ComponentType<CellProps>>> = {
  string: StringCell,
  number: NumberCell,
  boolean: BooleanCell,
  'date-time': DateTimeCell,
  enum: EnumCell,
  reference: ReferenceCell,
};
