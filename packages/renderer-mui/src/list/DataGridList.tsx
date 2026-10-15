import { useCallback, useMemo } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardActions from '@mui/material/CardActions';
import CardContent from '@mui/material/CardContent';
import Stack from '@mui/material/Stack';
import TablePagination, { type TablePaginationProps } from '@mui/material/TablePagination';
import Typography from '@mui/material/Typography';
import {
  DataGrid,
  GridRow,
  type GridColDef,
  type GridFilterModel,
  type GridPaginationModel,
  type GridRowProps,
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

declare module '@mui/x-data-grid' {
  /** The grid's pagination slot is MUI's TablePagination; its slot props carry the pager test ids. */
  interface BasePaginationPropsOverrides {
    slotProps?: TablePaginationProps['slotProps'];
  }
}

/**
 * The registry target of the list body: `screen.list` and `screen.grid` at `table`, schema `'*'`.
 * A generated screen resolves it there and an app replaces the body for one schema by registering
 * at the same key and target (no new contract key, like the agent panel and the dialog).
 */
export const LIST_BODY_TARGET = 'table';

export interface DataGridListProps<Row> extends ListProps<Row> {
  /** Cell renderers by column type for fields without a `cells` entry; defaults to {@link CELLS}. */
  cellsByType?: Partial<Record<ColumnDescriptor['type'], ComponentType<CellProps>>>;
  /**
   * Test seam: jsdom has no layout, so the virtualised grid renders no rows there. The testing
   * harness sets it through its own registration; production always virtualises.
   */
  disableVirtualization?: boolean;
}

/** How many columns a compact card shows (typescript/05 §6: wider tables need a responsive pattern). */
export const COMPACT_CARD_COLUMNS = 3;

/** The field of the trailing column that opens a row (present when `onRowClick` is given). */
export const OPEN_COLUMN_FIELD = '__open';

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

/** `<prefix>-<part>` when a prefix is set, else undefined (no attribute). */
function testIdOf(prefix: string | undefined, ...parts: string[]): string | undefined {
  return prefix === undefined ? undefined : [prefix, ...parts].join('-');
}

/** A `data-testid` as slot props; MUI's slot prop types list no data attributes, so it is opaque. */
function testIdAttr(id: string | undefined): object {
  return id === undefined ? {} : { 'data-testid': id };
}

export function toColDef<Row extends GridValidRowModel>(
  column: ColumnDescriptor,
  Cell: ComponentType<CellProps>,
  testIdPrefix?: string,
): GridColDef<Row> {
  const sortable = column.sortable ?? true;
  const sortId = sortable ? testIdOf(testIdPrefix, 'sort', column.field) : undefined;
  const base: GridColDef<Row> = {
    field: column.field,
    headerName: column.headerName,
    sortable,
    filterable: column.filterable ?? true,
    renderCell: (params) => (
      <Cell value={params.value as unknown} row={params.row} column={column} />
    ),
    // The sort id sits on the title so a click on it reaches the header's own sort handler.
    ...(sortId === undefined
      ? {}
      : { renderHeader: () => <span data-testid={sortId}>{column.headerName}</span> }),
    // Without a width or flex the column shares the grid's width rather than sitting at 100px.
    ...(column.width !== undefined ? { width: column.width } : {}),
    ...(column.flex !== undefined
      ? { flex: column.flex }
      : column.width === undefined
        ? { flex: 1, minWidth: 120 }
        : {}),
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

function cellFor(
  cells: ListProps['cells'],
  cellsByType: DataGridListProps<unknown>['cellsByType'],
  column: ColumnDescriptor,
): ComponentType<CellProps> {
  return cells?.[column.field] ?? cellsByType?.[column.type] ?? CELLS[column.type];
}

function Grid<Row extends GridValidRowModel>(props: DataGridListProps<Row>) {
  const t = useText();
  const { onPage, onSort, onFilter, onRowClick, getRowId, testIdPrefix, cells, cellsByType } =
    props;
  const openLabel = t('list.open');
  const columns = useMemo<GridColDef<Row>[]>(() => {
    const defs = props.columns.map((c) =>
      toColDef<Row>(c, cellFor(cells, cellsByType, c), testIdPrefix),
    );
    if (onRowClick === undefined) return defs;
    // A visible, keyboard-reachable way to open a row beside the row click.
    defs.push({
      field: OPEN_COLUMN_FIELD,
      headerName: openLabel,
      sortable: false,
      filterable: false,
      hideable: false,
      disableColumnMenu: true,
      align: 'right',
      headerAlign: 'right',
      width: 96,
      renderCell: (params) => (
        <Button
          type="button"
          size="small"
          variant="text"
          onClick={(event) => {
            event.stopPropagation();
            onRowClick(params.row);
          }}
          data-testid={testIdOf(testIdPrefix, 'open', String(params.id))}
        >
          {openLabel}
        </Button>
      ),
    });
    return defs;
  }, [props.columns, cells, cellsByType, onRowClick, openLabel, testIdPrefix]);
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
  // Each row carries the page-object id (`<prefix>-row-<id>`) beside the grid's own `data-id`.
  const Row = useCallback(
    (rowProps: GridRowProps) => (
      <GridRow {...rowProps} data-testid={testIdOf(testIdPrefix, 'row', String(rowProps.rowId))} />
    ),
    [testIdPrefix],
  );

  return (
    <Box data-testid={testIdOf(testIdPrefix, 'table')} data-layout="grid">
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
        slots={{ noRowsOverlay: NoRows, row: Row }}
        localeText={{ noRowsLabel: emptyLabel, noResultsOverlayLabel: emptyLabel }}
        aria-label={t('list.loading')}
        aria-busy={props.loading ?? false}
        data-testid="data-grid-list"
        sx={{
          minHeight: 320,
          ...(onRowClick === undefined ? {} : { '& .MuiDataGrid-row': { cursor: 'pointer' } }),
        }}
        slotProps={{
          loadingOverlay: { variant: 'skeleton', noRowsVariant: 'skeleton' },
          basePagination: {
            'data-testid': testIdOf(testIdPrefix, 'pager'),
            slotProps: {
              displayedRows: testIdAttr(testIdOf(testIdPrefix, 'page', 'current')),
              actions: {
                previousButton: testIdAttr(testIdOf(testIdPrefix, 'page', 'previous')),
                nextButton: testIdAttr(testIdOf(testIdPrefix, 'page', 'next')),
              },
            },
          },
        }}
      />
    </Box>
  );
}

/** The compact body: one card per row, labelled values for the first columns, the row action. */
function CardList<Row extends GridValidRowModel>(props: DataGridListProps<Row>) {
  const t = useText();
  const { onRowClick, getRowId, onPage, testIdPrefix, cells, cellsByType } = props;
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
        data-testid={testIdOf(testIdPrefix, 'table')}
        data-layout="cards"
      >
        {props.rows.map((row) => {
          const id = getRowId(row);
          return (
            <Card
              key={id}
              component="li"
              variant="outlined"
              data-testid={testIdOf(testIdPrefix, 'row', id) ?? `data-grid-card-${id}`}
            >
              <CardContent component="dl" sx={{ m: 0 }}>
                {shown.map((column) => {
                  const Cell = cellFor(cells, cellsByType, column);
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
                    data-testid={testIdOf(testIdPrefix, 'open', id) ?? `data-grid-open-${id}`}
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
        data-testid={testIdOf(testIdPrefix, 'pager')}
        slotProps={{
          displayedRows: testIdAttr(testIdOf(testIdPrefix, 'page', 'current')),
          actions: {
            previousButton: {
              sx: { minHeight: 'var(--sb-density-row)' },
              ...testIdAttr(testIdOf(testIdPrefix, 'page', 'previous')),
            },
            nextButton: {
              sx: { minHeight: 'var(--sb-density-row)' },
              ...testIdAttr(testIdOf(testIdPrefix, 'page', 'next')),
            },
          },
        }}
      />
    </Box>
  );
}
