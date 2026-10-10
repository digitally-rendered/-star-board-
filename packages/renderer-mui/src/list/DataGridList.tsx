import { useCallback, useMemo } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardActions from '@mui/material/CardActions';
import CardContent from '@mui/material/CardContent';
import Stack from '@mui/material/Stack';
import TablePagination from '@mui/material/TablePagination';
import Typography from '@mui/material/Typography';
import {
  DataGrid,
  type GridColDef,
  type GridFilterModel,
  type GridPaginationModel,
  type GridSortModel,
  type GridValidRowModel,
} from '@mui/x-data-grid';
import { useCompactLayout } from '@star-board/runtime';
import type { ComponentType } from 'react';
import type { CellProps, ColumnDescriptor, ListProps } from '../contracts.js';
import { useText } from '../i18n.js';
import { EmptyState } from '../states/EmptyState.js';
import { LoadingState } from '../states/LoadingState.js';
import { CELLS } from './columns.js';

export interface DataGridListProps<Row> extends ListProps<Row> {
  /** Cell renderers by column type; defaults to {@link CELLS}. An app resolves overrides through the registry and passes them here. */
  cells?: Partial<Record<ColumnDescriptor['type'], ComponentType<CellProps>>>;
  /**
   * Test seam: jsdom has no layout, so the virtualised grid renders no rows there. Set it in tests
   * only; production always virtualises.
   */
  disableVirtualization?: boolean;
}

/** How many columns a compact card shows (typescript/05 §6: wider tables need a responsive pattern). */
export const COMPACT_CARD_COLUMNS = 3;

/** A filter value as the string the contract carries; the server parses by column type. */
export function filterValueText(value: unknown): string {
  if (value === undefined || value === null) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') {
    return String(value);
  }
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(filterValueText).join(',');
  return JSON.stringify(value);
}

export function toColDef<Row extends GridValidRowModel>(
  column: ColumnDescriptor,
  cells: Partial<Record<ColumnDescriptor['type'], ComponentType<CellProps>>>,
): GridColDef<Row> {
  const Cell = cells[column.type] ?? CELLS[column.type];
  const base: GridColDef<Row> = {
    field: column.field,
    headerName: column.headerName,
    sortable: column.sortable ?? true,
    filterable: column.filterable ?? true,
    renderCell: (params) => (
      <Cell value={params.value as unknown} row={params.row} column={column} />
    ),
    ...(column.width !== undefined ? { width: column.width } : {}),
    ...(column.flex !== undefined ? { flex: column.flex } : {}),
  };
  switch (column.type) {
    case 'number':
      return { ...base, type: 'number' };
    case 'boolean':
      return { ...base, type: 'boolean' };
    case 'enum':
      return {
        ...base,
        type: 'singleSelect',
        valueOptions: (column.options ?? []).map((o) => ({ value: o.value, label: o.label })),
      };
    case 'string':
    case 'date-time':
    case 'reference':
      return { ...base, type: 'string' };
  }
}

/**
 * The default `screen.list` / `screen.grid` body: MUI X DataGrid (community) in server mode for
 * pagination, sorting and filtering; the caller owns the query and the data (typescript/02 §3).
 * Under the `sm` breakpoint (or with `compact`) it is a card list instead: the first
 * {@link COMPACT_CARD_COLUMNS} columns per row, the row action as a full-width button, and a pager.
 */
export function DataGridList<Row extends GridValidRowModel>(props: DataGridListProps<Row>) {
  const viewportCompact = useCompactLayout();
  const compact = props.compact ?? viewportCompact;
  return compact ? <CardList {...props} /> : <Grid {...props} />;
}

function Grid<Row extends GridValidRowModel>(props: DataGridListProps<Row>) {
  const t = useText();
  const { onPage, onSort, onFilter, onRowClick, getRowId } = props;
  const cells = props.cells;
  const columns = useMemo(
    () => props.columns.map((c) => toColDef<Row>(c, cells ?? {})),
    [props.columns, cells],
  );
  const paginationModel = useMemo<GridPaginationModel>(
    () => ({ page: props.page, pageSize: props.pageSize }),
    [props.page, props.pageSize],
  );
  const handlePagination = useCallback(
    (model: GridPaginationModel) => {
      if (model.page !== props.page) onPage(model.page);
    },
    [onPage, props.page],
  );
  const handleSort = useCallback(
    (model: GridSortModel) => {
      const first = model[0];
      if (first && (first.sort === 'asc' || first.sort === 'desc')) onSort(first.field, first.sort);
    },
    [onSort],
  );
  const handleFilter = useCallback(
    (model: GridFilterModel) => {
      for (const item of model.items) {
        onFilter(item.field, filterValueText(item.value));
      }
    },
    [onFilter],
  );
  const emptyLabel = props.emptyLabel;
  const NoRows = useCallback(() => <EmptyState title={emptyLabel} />, [emptyLabel]);

  return (
    <DataGrid<Row>
      rows={props.rows}
      columns={columns}
      getRowId={(row) => getRowId(row)}
      loading={props.loading ?? false}
      rowCount={props.total}
      paginationMode="server"
      sortingMode="server"
      filterMode="server"
      paginationModel={paginationModel}
      onPaginationModelChange={handlePagination}
      pageSizeOptions={[props.pageSize]}
      onSortModelChange={handleSort}
      onFilterModelChange={handleFilter}
      onRowClick={(params) => {
        onRowClick?.(params.row as Row);
      }}
      disableRowSelectionOnClick
      disableVirtualization={props.disableVirtualization ?? false}
      slots={{ noRowsOverlay: NoRows }}
      localeText={{ noRowsLabel: emptyLabel, noResultsOverlayLabel: emptyLabel }}
      aria-label={t('list.loading')}
      aria-busy={props.loading ?? false}
      data-testid="data-grid-list"
      sx={{ minHeight: 320 }}
      slotProps={{ loadingOverlay: { variant: 'skeleton', noRowsVariant: 'skeleton' } }}
    />
  );
}

/** The compact body: one card per row, labelled values for the first columns, the row action. */
function CardList<Row extends GridValidRowModel>(props: DataGridListProps<Row>) {
  const t = useText();
  const { onRowClick, getRowId, onPage } = props;
  const cells = props.cells ?? {};
  const shown = props.columns.slice(0, COMPACT_CARD_COLUMNS);
  if (props.loading === true) return <LoadingState title={t('list.loading')} />;
  if (props.rows.length === 0) return <EmptyState title={props.emptyLabel} />;
  return (
    <Box data-testid="data-grid-list" data-compact="true">
      <Stack
        component="ul"
        spacing={1}
        aria-label={t('list.cards')}
        sx={{ listStyle: 'none', p: 0, m: 0 }}
      >
        {props.rows.map((row) => {
          const id = getRowId(row);
          return (
            <Card key={id} component="li" variant="outlined" data-testid={`data-grid-card-${id}`}>
              <CardContent component="dl" sx={{ m: 0 }}>
                {shown.map((column) => {
                  const Cell = cells[column.type] ?? CELLS[column.type];
                  return (
                    <Box key={column.field} sx={{ mb: 1 }}>
                      <Typography component="dt" variant="caption" color="text.secondary">
                        {column.headerName}
                      </Typography>
                      <Box component="dd" sx={{ m: 0 }}>
                        <Cell
                          value={(row as Record<string, unknown>)[column.field]}
                          row={row}
                          column={column}
                        />
                      </Box>
                    </Box>
                  );
                })}
              </CardContent>
              {onRowClick !== undefined && (
                <CardActions>
                  <Button
                    type="button"
                    fullWidth
                    variant="outlined"
                    // ≥ 44px touch target from the density token (dense mode opts into 32px).
                    sx={{ minHeight: 'var(--sb-density-row)' }}
                    onClick={() => {
                      onRowClick(row);
                    }}
                    data-testid={`data-grid-open-${id}`}
                  >
                    {t('list.open')}
                  </Button>
                </CardActions>
              )}
            </Card>
          );
        })}
      </Stack>
      <TablePagination
        component="div"
        count={props.total}
        page={props.page}
        rowsPerPage={props.pageSize}
        rowsPerPageOptions={[props.pageSize]}
        onPageChange={(_event, page) => {
          onPage(page);
        }}
        slotProps={{
          actions: {
            previousButton: { sx: { minHeight: 'var(--sb-density-row)' } },
            nextButton: { sx: { minHeight: 'var(--sb-density-row)' } },
          },
        }}
      />
    </Box>
  );
}
