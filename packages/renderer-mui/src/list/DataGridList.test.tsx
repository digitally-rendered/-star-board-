import { render, screen, waitFor, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { expectNoViolations } from '../../test/a11y.js';
import type { ColumnDescriptor } from '../contracts.js';
import {
  BooleanCell,
  DateTimeCell,
  EnumCell,
  NumberCell,
  ReferenceCell,
  StringCell,
} from './columns.js';
import { DataGridList, toColDef } from './DataGridList.js';

interface Pet extends Record<string, unknown> {
  id: string;
  name: string;
  age: number;
  vaccinated: boolean;
  born: string;
  species: string;
  owner: { id: string; label: string };
}

const species = [
  { value: 'cat', label: 'Cat' },
  { value: 'dog', label: 'Dog' },
];
const nameColumn: ColumnDescriptor = { field: 'name', headerName: 'Name', type: 'string', flex: 1 };
const columns: ColumnDescriptor[] = [
  nameColumn,
  { field: 'age', headerName: 'Age', type: 'number', width: 90 },
  { field: 'vaccinated', headerName: 'Vaccinated', type: 'boolean' },
  { field: 'born', headerName: 'Born', type: 'date-time' },
  { field: 'species', headerName: 'Species', type: 'enum', options: species },
  { field: 'owner', headerName: 'Owner', type: 'reference', sortable: false, filterable: false },
];
const rows: Pet[] = [
  {
    id: '1',
    name: 'Rex',
    age: 3,
    vaccinated: true,
    born: '2021-01-02T03:04:00.000Z',
    species: 'dog',
    owner: { id: 'o1', label: 'Ann' },
  },
  {
    id: '2',
    name: 'Tom',
    age: 5,
    vaccinated: false,
    born: '2019-06-07T08:09:00.000Z',
    species: 'cat',
    owner: { id: 'o2', label: 'Bob' },
  },
];

function handlers() {
  return { onPage: vi.fn(), onSort: vi.fn(), onFilter: vi.fn(), onRowClick: vi.fn() };
}

function renderGrid(overrides: Partial<Parameters<typeof DataGridList<Pet>>[0]> = {}) {
  const h = handlers();
  const utils = render(
    <DataGridList<Pet>
      rows={rows}
      columns={columns}
      total={25}
      page={0}
      pageSize={10}
      getRowId={(row) => row.id}
      emptyLabel="No pets yet"
      disableVirtualization
      {...h}
      {...overrides}
    />,
  );
  return { ...utils, ...h };
}

describe('DataGridList', () => {
  // axe over a DataGrid takes several seconds in jsdom.
  it(
    'renders the columns and the rows through the typed cell renderers',
    { timeout: 30_000 },
    async () => {
      const { container } = renderGrid();
      const grid = screen.getByRole('grid');
      for (const c of columns) {
        expect(screen.getByRole('columnheader', { name: c.headerName })).toBeTruthy();
      }
      await waitFor(() => {
        expect(within(grid).getAllByRole('row').length).toBeGreaterThanOrEqual(3);
      });
      expect(screen.getByText('Rex')).toBeTruthy();
      expect(screen.getByText('Tom')).toBeTruthy();
      expect(screen.getByRole('img', { name: 'Yes' })).toBeTruthy();
      expect(screen.getByRole('img', { name: 'No' })).toBeTruthy();
      expect(screen.getByText('Dog')).toBeTruthy();
      expect(screen.getByText('Ann')).toBeTruthy();
      expect(container.querySelectorAll('time')).toHaveLength(2);
      expect(screen.getByText('1–10 of 25')).toBeTruthy();
      await expectNoViolations(container);
    },
  );

  it(
    'pages, sorts and filters on the server side through the callbacks',
    { timeout: 30_000 },
    async () => {
      const { onPage, onSort, onFilter, onRowClick } = renderGrid();
      await userEvent.click(screen.getByRole('button', { name: /next page/i }));
      expect(onPage).toHaveBeenCalledWith(1);

      const header = (field: string) => {
        const el = screen
          .getByRole('grid')
          .querySelector(`[role="columnheader"][data-field="${field}"]`);
        if (!(el instanceof HTMLElement)) throw new Error(`no column header for ${field}`);
        return el;
      };
      await userEvent.click(header('age'));
      expect(onSort).toHaveBeenLastCalledWith('age', 'asc');
      await userEvent.click(header('age'));
      expect(onSort).toHaveBeenLastCalledWith('age', 'desc');

      // The menu button is `visibility: hidden` until hover, which strips its accessible name; find it by label.
      await userEvent.click(screen.getByLabelText('Name column menu'));
      await userEvent.click(await screen.findByRole('menuitem', { name: /filter/i }));
      const input = await screen.findByLabelText(/value/i);
      await userEvent.type(input, 'Re');
      await waitFor(() => {
        expect(onFilter).toHaveBeenLastCalledWith('name', 'Re');
      });

      await userEvent.click(screen.getByText('Tom'));
      expect(onRowClick).toHaveBeenCalledWith(rows[1]);
    },
  );

  it('shows the empty state when there are no rows and the loading state while loading', async () => {
    const { rerender } = renderGrid({ rows: [], total: 0 });
    expect(await screen.findByRole('region', { name: 'No pets yet' })).toBeTruthy();
    rerender(
      <DataGridList<Pet>
        rows={[]}
        columns={columns}
        total={0}
        page={0}
        pageSize={10}
        getRowId={(row) => row.id}
        emptyLabel="No pets yet"
        loading
        disableVirtualization
        {...handlers()}
      />,
    );
    expect(screen.queryByRole('region')).toBeNull();
    expect(document.querySelector('.MuiDataGrid-skeletonLoadingOverlay')).not.toBeNull();
  });

  it('maps column descriptors to DataGrid column definitions', () => {
    const defs = columns.map((c) => toColDef(c, {}));
    expect(defs.map((d) => d.type)).toEqual([
      'string',
      'number',
      'boolean',
      'string',
      'singleSelect',
      'string',
    ]);
    expect(defs[0]?.flex).toBe(1);
    expect(defs[1]?.width).toBe(90);
    expect(defs[5]?.sortable).toBe(false);
    expect(defs[5]?.filterable).toBe(false);
    const Custom = () => <i>custom</i>;
    expect(toColDef(nameColumn, { string: Custom }).renderCell).toBeDefined();
  });
});

describe('list.column.<type> cells', () => {
  const column = (type: ColumnDescriptor['type']): ColumnDescriptor => ({
    field: 'f',
    headerName: 'F',
    type,
    options: species,
  });
  it('render each value kind', () => {
    const { container } = render(
      <>
        <StringCell value="text" row={{}} column={column('string')} />
        <StringCell value={null} row={{}} column={column('string')} />
        <StringCell value={{ a: 1 }} row={{}} column={column('string')} />
        <NumberCell value={1234.5} row={{}} column={column('number')} />
        <NumberCell value="n/a" row={{}} column={column('number')} />
        <BooleanCell value={true} row={{}} column={column('boolean')} />
        <DateTimeCell value="2024-01-02T03:04:00.000Z" row={{}} column={column('date-time')} />
        <DateTimeCell value="not a date" row={{}} column={column('date-time')} />
        <DateTimeCell value={null} row={{}} column={column('date-time')} />
        <EnumCell value="cat" row={{}} column={column('enum')} />
        <EnumCell value="unknown" row={{}} column={column('enum')} />
        <EnumCell value="" row={{}} column={column('enum')} />
        <ReferenceCell value={{ id: 'x', name: 'Named' }} row={{}} column={column('reference')} />
        <ReferenceCell value="plain-id" row={{}} column={column('reference')} />
      </>,
    );
    expect(screen.getByText('text')).toBeTruthy();
    expect(screen.getByText('{"a":1}')).toBeTruthy();
    expect(screen.getByText(new Intl.NumberFormat().format(1234.5))).toBeTruthy();
    expect(screen.getByText('n/a')).toBeTruthy();
    expect(screen.getByRole('img', { name: 'Yes' })).toBeTruthy();
    const times = container.querySelectorAll('time');
    expect(times).toHaveLength(2);
    expect(times[0]?.getAttribute('datetime')).toBe('2024-01-02T03:04:00.000Z');
    expect(times[1]?.textContent).toBe('not a date');
    expect(screen.getByText('Cat')).toBeTruthy();
    expect(screen.getByText('unknown')).toBeTruthy();
    expect(screen.getByText('Named')).toBeTruthy();
    expect(screen.getByText('plain-id')).toBeTruthy();
    expect(screen.getAllByTestId('cell-f').length).toBe(14);
  });
});
