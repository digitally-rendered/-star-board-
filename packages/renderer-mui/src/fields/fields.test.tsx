import { render, screen, waitFor, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { expectNoViolations } from '../../test/a11y.js';
import type { FieldDescriptor } from '../contracts.js';
import { BooleanField } from './BooleanField.js';
import { DateTimeField, fromLocalInput, toLocalInput } from './DateTimeField.js';
import { NumberField } from './NumberField.js';
import { ReferenceField } from './ReferenceField.js';
import { SelectField } from './SelectField.js';
import { SubformField } from './SubformField.js';
import { TagsField } from './TagsField.js';
import { TextField } from './TextField.js';

const options = [
  { value: 'cat', label: 'Cat' },
  { value: 'dog', label: 'Dog' },
];

/** The control an assistive technology would reach: the thing labelled by `label`. */
function control(label: string): HTMLInputElement {
  return screen.getByLabelText<HTMLInputElement>(new RegExp(`^${label}`));
}

function describedText(el: HTMLElement): string {
  const ids = el.getAttribute('aria-describedby');
  expect(ids).toBeTruthy();
  return (ids ?? '')
    .split(' ')
    .map((id) => document.getElementById(id)?.textContent ?? '')
    .join(' ');
}

describe('field.text', () => {
  it('renders label, help, required marker, test id and calls onChange', async () => {
    const onChange = vi.fn();
    const { container } = render(
      <TextField
        name="name"
        label="Name"
        help="Shown on the tag"
        required
        value="Rex"
        onChange={onChange}
      />,
    );
    const input = control('Name');
    expect(input.getAttribute('id')).toBeTruthy();
    expect(input.required).toBe(true);
    expect(screen.getByText('*')).toBeTruthy();
    expect(describedText(input)).toContain('Shown on the tag');
    expect(screen.getByTestId('field-name')).toBeTruthy();
    await userEvent.type(input, '!');
    expect(onChange).toHaveBeenLastCalledWith('Rex!');
    await expectNoViolations(container);
  });

  it('shows the error in place of the help and announces it', async () => {
    const { container } = render(
      <TextField
        name="name"
        label="Name"
        help="Help"
        error="Required"
        value=""
        onChange={vi.fn()}
      />,
    );
    const input = control('Name');
    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect(describedText(input)).toBe('Required');
    expect(screen.getByRole('alert').textContent).toBe('Required');
    expect(screen.queryByText('Help')).toBeNull();
    await expectNoViolations(container);
  });

  it('can be disabled', () => {
    render(<TextField name="name" label="Name" disabled value="" onChange={vi.fn()} />);
    expect((control('Name') as HTMLButtonElement).disabled).toBe(true);
  });
});

describe('field.select', () => {
  it('lists the options, marks required, describes help, and emits the chosen value', async () => {
    const onChange = vi.fn();
    const { container } = render(
      <SelectField
        name="species"
        label="Species"
        help="Pick one"
        required
        options={options}
        value="cat"
        onChange={onChange}
      />,
    );
    const combo = screen.getByRole('combobox', { name: /Species/ });
    expect(describedText(combo)).toContain('Pick one');
    expect(screen.getByText('*')).toBeTruthy();
    expect(screen.getByTestId('field-species')).toBeTruthy();
    await userEvent.click(combo);
    await userEvent.click(await screen.findByRole('option', { name: 'Dog' }));
    expect(onChange).toHaveBeenLastCalledWith('dog');
    await expectNoViolations(container);
  });

  it('shows the error', () => {
    render(
      <SelectField
        name="species"
        label="Species"
        options={options}
        error="Choose a species"
        value=""
        onChange={vi.fn()}
      />,
    );
    expect(screen.getByRole('alert').textContent).toBe('Choose a species');
  });
});

describe('field.datetime', () => {
  it('round-trips ISO 8601 through the local control', () => {
    const iso = '2024-05-06T07:08:00.000Z';
    expect(fromLocalInput(toLocalInput(iso))).toBe(iso);
    expect(toLocalInput('')).toBe('');
    expect(toLocalInput('garbage')).toBe('');
    expect(fromLocalInput('')).toBe('');
    expect(fromLocalInput('nonsense')).toBe('');
  });

  it('renders a datetime-local control with help, required marker and error, and emits ISO', async () => {
    const onChange = vi.fn();
    const { container, rerender } = render(
      <DateTimeField
        name="born"
        label="Born"
        help="Local time"
        required
        value=""
        onChange={onChange}
      />,
    );
    const input = control('Born');
    expect(input.getAttribute('type')).toBe('datetime-local');
    expect(input.required).toBe(true);
    expect(describedText(input)).toContain('Local time');
    expect(screen.getByTestId('field-born')).toBeTruthy();
    await userEvent.type(input, '2024-05-06T07:08');
    const last = onChange.mock.lastCall?.[0] as string;
    expect(last).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    expect(toLocalInput(last)).toBe('2024-05-06T07:08');
    rerender(
      <DateTimeField name="born" label="Born" error="Too early" value="" onChange={onChange} />,
    );
    expect(screen.getByRole('alert').textContent).toBe('Too early');
    await expectNoViolations(container);
  });
});

describe('field.number', () => {
  it('applies min, max and step, emits numbers and null, shows help/required/error', async () => {
    const onChange = vi.fn();
    const { container, rerender } = render(
      <NumberField
        name="age"
        label="Age"
        help="In years"
        required
        min={0}
        max={30}
        step={1}
        value={3}
        onChange={onChange}
      />,
    );
    const input = control('Age');
    expect(input.getAttribute('type')).toBe('number');
    expect(input.getAttribute('min')).toBe('0');
    expect(input.getAttribute('max')).toBe('30');
    expect(input.getAttribute('step')).toBe('1');
    expect(input.required).toBe(true);
    expect(describedText(input)).toContain('In years');
    expect(screen.getByTestId('field-age')).toBeTruthy();
    await userEvent.type(input, '1');
    expect(onChange).toHaveBeenLastCalledWith(31);
    await userEvent.clear(input);
    expect(onChange).toHaveBeenLastCalledWith(null);
    rerender(<NumberField name="age" label="Age" error="Too old" value={99} onChange={onChange} />);
    expect(screen.getByRole('alert').textContent).toBe('Too old');
    await expectNoViolations(container);
  });
});

describe('field.boolean', () => {
  it('is a switch with label, help, required marker and error; toggles', async () => {
    const onChange = vi.fn();
    const { container, rerender } = render(
      <BooleanField
        name="vaccinated"
        label="Vaccinated"
        help="Per the record"
        required
        value={false}
        onChange={onChange}
      />,
    );
    const toggle = screen.getByRole('switch', { name: /Vaccinated/ });
    expect(toggle.getAttribute('id')).toBeTruthy();
    expect(describedText(toggle)).toContain('Per the record');
    expect(screen.getByText('*')).toBeTruthy();
    expect(screen.getByTestId('field-vaccinated')).toBeTruthy();
    await userEvent.click(toggle);
    expect(onChange).toHaveBeenLastCalledWith(true);
    rerender(
      <BooleanField
        name="vaccinated"
        label="Vaccinated"
        error="Must be confirmed"
        value={false}
        onChange={onChange}
      />,
    );
    expect(screen.getByRole('alert').textContent).toBe('Must be confirmed');
    await expectNoViolations(container);
  });
});

describe('field.tags', () => {
  it('renders chips for the value, adds on Enter, removes on delete, and describes help and error', async () => {
    const onChange = vi.fn();
    const { container, rerender } = render(
      <TagsField
        name="tags"
        label="Tags"
        help="Comma free"
        required
        value={['calm']}
        onChange={onChange}
      />,
    );
    const input = screen.getByTestId<HTMLInputElement>('field-tags-input');
    expect(describedText(input)).toContain('Comma free');
    expect(screen.getByText('*')).toBeTruthy();
    expect(screen.getByText('calm')).toBeTruthy();
    await userEvent.type(input, 'fast{Enter}');
    expect(onChange).toHaveBeenLastCalledWith(['calm', 'fast']);
    await userEvent.type(input, '{Backspace}');
    expect(onChange).toHaveBeenLastCalledWith([]);
    rerender(
      <TagsField name="tags" label="Tags" error="At least one" value={[]} onChange={onChange} />,
    );
    expect(screen.getByRole('alert').textContent).toBe('At least one');
    await expectNoViolations(container);
  });
});

describe('field.reference', () => {
  it('searches as the user types, shows the label for the value, emits the id, and describes help/error', async () => {
    const search = vi.fn((q: string) =>
      Promise.resolve(options.filter((o) => o.label.toLowerCase().includes(q.toLowerCase()))),
    );
    const onChange = vi.fn();
    const { container, rerender } = render(
      <ReferenceField
        name="owner"
        label="Owner"
        help="Who pays"
        required
        value="cat"
        search={search}
        onChange={onChange}
      />,
    );
    const input = screen.getByTestId<HTMLInputElement>('field-owner-input');
    expect(describedText(input)).toContain('Who pays');
    expect(screen.getByText('*')).toBeTruthy();
    await waitFor(() => {
      expect(search).toHaveBeenCalledWith('');
    });
    await waitFor(() => {
      expect(input.value).toBe('Cat');
    });
    await userEvent.clear(input);
    await userEvent.type(input, 'do');
    await waitFor(() => {
      expect(search).toHaveBeenLastCalledWith('do');
    });
    await userEvent.click(await screen.findByRole('option', { name: 'Dog' }));
    expect(onChange).toHaveBeenLastCalledWith('dog');
    rerender(
      <ReferenceField
        name="owner"
        label="Owner"
        error="Unknown owner"
        value={null}
        search={search}
        onChange={onChange}
      />,
    );
    expect(screen.getByRole('alert').textContent).toBe('Unknown owner');
    await expectNoViolations(container);
  });

  it('falls back to the id as label when the search does not know it, and to no options on failure', async () => {
    const search = vi.fn(() => Promise.reject(new Error('boom')));
    render(
      <ReferenceField name="owner" label="Owner" value="x1" search={search} onChange={vi.fn()} />,
    );
    const input = screen.getByTestId<HTMLInputElement>('field-owner-input');
    await waitFor(() => {
      expect(search).toHaveBeenCalled();
    });
    expect(input.value).toBe('x1');
  });
});

describe('field.subform', () => {
  const fields: FieldDescriptor[] = [
    { name: 'street', label: 'Street', kind: 'text', required: true },
    { name: 'number', label: 'Number', kind: 'number', min: 1 },
    { name: 'primary', label: 'Primary', kind: 'boolean' },
    { name: 'kind', label: 'Kind', kind: 'select', options },
    { name: 'since', label: 'Since', kind: 'datetime' },
    { name: 'labels', label: 'Labels', kind: 'tags' },
    { name: 'owner', label: 'Owner', kind: 'reference', search: () => Promise.resolve(options) },
    {
      name: 'geo',
      label: 'Geo',
      kind: 'subform',
      fields: [{ name: 'lat', label: 'Lat', kind: 'number' }],
    },
  ];

  it(
    'renders a fieldset with legend, help, required marker, error and nested fields that patch the object',
    { timeout: 20_000 },
    async () => {
      const onChange = vi.fn();
      const value = {
        street: 'Main',
        number: 2,
        primary: true,
        kind: 'cat',
        since: '',
        labels: ['a'],
        owner: null,
        geo: { lat: 1 },
      };
      const { container, rerender } = render(
        <SubformField
          name="address"
          label="Address"
          help="Postal"
          required
          fields={fields}
          value={value}
          onChange={onChange}
        />,
      );
      const group = screen.getByRole('group', { name: /Address/ });
      expect(group.tagName).toBe('FIELDSET');
      expect(describedText(group)).toContain('Postal');
      expect(screen.getByTestId('field-address')).toBe(group);
      expect(screen.getByTestId('field-address.street')).toBeTruthy();
      expect(screen.getByTestId('field-address.geo.lat')).toBeTruthy();
      await userEvent.type(within(group).getByLabelText(/^Street/), 'X');
      expect(onChange).toHaveBeenLastCalledWith({ ...value, street: 'MainX' });
      await userEvent.click(within(group).getByRole('switch'));
      expect(onChange).toHaveBeenLastCalledWith({ ...value, primary: false });
      rerender(
        <SubformField
          name="address"
          label="Address"
          error="Incomplete"
          fields={fields}
          value={value}
          onChange={onChange}
        />,
      );
      expect(screen.getByRole('alert').textContent).toBe('Incomplete');
      expect(group.getAttribute('aria-invalid')).toBe('true');
      await expectNoViolations(container);
    },
  );

  it('tolerates values of the wrong shape', () => {
    render(
      <SubformField
        name="a"
        label="A"
        fields={fields}
        value={{ street: 1, number: 'x', primary: 'yes', labels: 'no', geo: [] }}
        onChange={vi.fn()}
      />,
    );
    expect(screen.getByLabelText<HTMLInputElement>(/^Street/).value).toBe('');
    expect(screen.getByLabelText<HTMLInputElement>(/^Number/).value).toBe('');
    expect(screen.getByRole<HTMLInputElement>('switch').checked).toBe(false);
  });
});
