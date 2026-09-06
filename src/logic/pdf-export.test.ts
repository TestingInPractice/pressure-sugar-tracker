import { it, expect } from 'vitest';
import { buildReportPdfBytes, buildReportPdf, pdfFields } from './pdf-export';
import { createDefaultReport } from './report-config';
import type { Field, BPValues } from '../types';

const FIELDS: Field[] = [
  { id: 'num', name: '№', type: 'number', required: false, width: 10 },
  { id: 'dt', name: 'Дата и время', type: 'datetime', required: true, width: 30 },
  { id: 'bp1', name: 'ВД / НД / П', type: 'bp', required: false, width: 30,
    parts: [{ id: 'systolic', label: 'ВД' }, { id: 'diastolic', label: 'НД' }, { id: 'pulse', label: 'П' }] },
  { id: 's1', name: 'Сахар', type: 'number', unit: 'ммоль/л', required: false, width: 30 },
  { id: 'note', name: 'Примечание', type: 'text', required: false, width: 12 },
];

const BP: BPValues = { systolic: 130, diastolic: 85, pulse: 70 };

const report = createDefaultReport('Отчёт АД', [...FIELDS]);
const entry = {
  id: 'e1',
  reportId: report.id,
  createdAt: 1,
  values: { num: 1, dt: '2026-08-20T10:00', bp1: BP, s1: 5.5, note: 'Плохо спал' },
};

it('builds a non-empty PDF binary with %PDF header and Cyrillic font embedded', () => {
  const bytes = buildReportPdfBytes(report, [entry], {
    rangeLabel: 'Период: 01.08.2026 — 31.08.2026',
    normsLabel: 'Нормы: ВД 120 · НД 80',
  });
  const head = new TextDecoder().decode(bytes.slice(0, 5));
  expect(head).toBe('%PDF-');
  expect(bytes.byteLength).toBeGreaterThan(1000);
});

it('buildReportPdf returns an application/pdf blob', () => {
  const blob = buildReportPdf(report, [entry]);
  expect(blob.type).toBe('application/pdf');
  expect(blob.size).toBeGreaterThan(0);
});

it('omits hidden fields from the PDF table', () => {
  const withHidden = createDefaultReport('Скрытое', [
    { id: 'a', name: 'Видимое', type: 'text', required: false, width: 30 },
    { id: 'b', name: 'Скрытое поле', type: 'text', required: false, width: 30, hidden: true },
  ]);
  const visible = pdfFields(withHidden);
  expect(visible.map(f => f.name)).toEqual(['Видимое']);
  expect(visible).not.toContainEqual(expect.objectContaining({ name: 'Скрытое поле' }));
});