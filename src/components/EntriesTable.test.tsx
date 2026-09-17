import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import EntriesTable from './EntriesTable';
import EntryForm from './EntryForm';
import type { Field, Entry } from '../types';
import userEvent from '@testing-library/user-event';

const fields: Field[] = [
  { id: 'f1', name: 'Давление', type: 'number', unit: 'мм рт.ст.', required: true, width: 30 },
  { id: 'f2', name: 'Примечание', type: 'text', required: false, width: 30 },
];

const entry: Entry = { id: 'e1', reportId: 'r', values: { f1: 120, f2: 'утром' }, createdAt: 5 };

describe('EntriesTable + EntryForm', () => {
  it('renders rows with proportional column widths and wraps values', () => {
    render(<EntriesTable report={{ fields }} entries={[entry]} onEdit={() => {}} onDelete={() => {}} />);
    expect(screen.getByText('120')).toBeInTheDocument();
    expect(screen.getByText('утром')).toBeInTheDocument();
    const header = screen.getByText(/Давление/).closest('th')!;
    expect(header).toHaveStyle({ width: '50%' });
    const cell = screen.getByText('утром').closest('td')!;
    expect(cell).toHaveClass('wrap-cell');
    expect(cell).not.toHaveStyle({ maxWidth: '30ch' });
  });

  it('marks the numbering column with col-number class', () => {
    const numbered: Field[] = [
      { id: 'n', name: 'Номер', type: 'number', required: false, width: 30 },
      { id: 'd', name: 'Дата и время', type: 'datetime', required: true, width: 30 },
    ];
    render(
      <EntriesTable
        report={{ fields: numbered }}
        entries={[{ id: 'e3', reportId: 'r', values: { n: 1, d: '2026-08-23T19:00' }, createdAt: 7 }]}
        onEdit={() => {}}
        onDelete={() => {}}
      />,
    );
    expect(screen.getByRole('columnheader', { name: 'Номер' })).toHaveClass('col-number');
    expect(screen.getByText('1').closest('td')).toHaveClass('col-number');
    expect(screen.getByRole('columnheader', { name: /Дата и время/ })).not.toHaveClass('col-number');
  });

  it('formats datetime values compactly', () => {
    const dtFields: Field[] = [
      { id: 'd', name: 'Дата и время', type: 'datetime', required: true, width: 30 },
    ];
    render(
      <EntriesTable
        report={{ fields: dtFields }}
        entries={[{ id: 'e2', reportId: 'r', values: { d: '2026-08-23T19:00' }, createdAt: 6 }]}
        onEdit={() => {}}
        onDelete={() => {}}
      />,
    );
    expect(screen.getByText('23.08 19:00')).toBeInTheDocument();
  });

  it('renders bp values as sys/dia pulse in one cell', () => {
    const bp: Field = {
      id: 'bp1', name: 'ВД / НД / П', type: 'bp', required: false, width: 30,
      parts: [{ id: 'systolic', label: 'ВД' }, { id: 'diastolic', label: 'НД' }, { id: 'pulse', label: 'П' }],
    };
    render(
      <EntriesTable
        report={{ fields: [bp] }}
        entries={[{ id: 'e5', reportId: 'r', values: { bp1: { systolic: 120, diastolic: 80, pulse: 70 } }, createdAt: 8 }]}
        onEdit={() => {}}
        onDelete={() => {}}
      />,
    );
    expect(screen.getByText('120/80 70')).toBeInTheDocument();
  });

  it('form validates required fields before save', async () => {
    const saved: unknown[] = [];
    render(<EntryForm fields={fields} onSave={v => saved.push(v)} onCancel={() => {}} />);
    await userEvent.click(screen.getByRole('button', { name: 'Сохранить' }));
    expect(saved).toHaveLength(0);
    expect(screen.getByText('Обязательное поле')).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText(/^Давление/), '130');
    await userEvent.click(screen.getByRole('button', { name: 'Сохранить' }));
    expect(saved).toHaveLength(1);
  });

  it('renders СрАД column after first BP field with value and category label', () => {
    const bp: Field = {
      id: 'bp1', name: 'САД / ДАД / Пульс', type: 'bp', required: false, width: 30,
      parts: [{ id: 'systolic', label: 'САД' }, { id: 'diastolic', label: 'ДАД' }, { id: 'pulse', label: 'Пульс' }],
    };
    const note: Field = { id: 'f2', name: 'Примечание', type: 'text', required: false, width: 30 };
    render(
      <EntriesTable
        report={{ fields: [bp, note] }}
        entries={[{ id: 'e5', reportId: 'r', values: { bp1: { systolic: 120, diastolic: 80, pulse: 70 }, f2: '' }, createdAt: 8 }]}
        onEdit={() => {}}
        onDelete={() => {}}
      />,
    );
    const headers = screen.getAllByRole('columnheader');
    expect(headers.map(h => h.textContent)).toEqual(['САД / ДАД / Пульс', 'СрАД', 'Примечание', '']);
    const badge = screen.getByText('93 Нормотония');
    expect(badge).toBeInTheDocument();
    expect(badge.closest('td')).toHaveClass('col-srad');
  });

  it('does not render СрАД column when report has no BP field', () => {
    render(
      <EntriesTable
        report={{ fields }}
        entries={[entry]}
        onEdit={() => {}}
        onDelete={() => {}}
      />,
    );
    expect(screen.queryByText('СрАД')).toBeNull();
  });

  it('grows Нет записей colSpan when СрАД column present', () => {
    const bp: Field = {
      id: 'bp1', name: 'САД / ДАД / Пульс', type: 'bp', required: false, width: 30,
      parts: [{ id: 'systolic', label: 'САД' }, { id: 'diastolic', label: 'ДАД' }, { id: 'pulse', label: 'Пульс' }],
    };
    render(
      <EntriesTable
        report={{ fields: [bp] }}
        entries={[]}
        onEdit={() => {}}
        onDelete={() => {}}
      />,
    );
    expect(screen.getByText('Нет записей')).toHaveAttribute('colspan', '3');
  });

  it('renders СрАД line in mobile card when BP value computable', () => {
    const mq = { matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() };
    vi.stubGlobal('matchMedia', vi.fn().mockReturnValue(mq));
    const bp: Field = {
      id: 'bp1', name: 'САД / ДАД / Пульс', type: 'bp', required: false, width: 30,
      parts: [{ id: 'systolic', label: 'САД' }, { id: 'diastolic', label: 'ДАД' }, { id: 'pulse', label: 'Пульс' }],
    };
    render(
      <EntriesTable
        report={{ fields: [bp] }}
        entries={[{ id: 'e5', reportId: 'r', values: { bp1: { systolic: 120, diastolic: 80, pulse: 70 } }, createdAt: 8 }]}
        onEdit={() => {}}
        onDelete={() => {}}
      />,
    );
    const sradLine = document.querySelector('.entry-card__srad');
    expect(sradLine).not.toBeNull();
    expect(sradLine?.textContent).toContain('СрАД 93');
    expect(sradLine?.textContent).toContain('Нормотония');
    vi.unstubAllGlobals();
  });
});
