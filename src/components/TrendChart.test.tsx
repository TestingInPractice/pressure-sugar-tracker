import { describe, expect, it } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import TrendChart, {
  bucketPoints, autoBucket, buildChartPoints, takeLast, MAX_UNBUCKETED_POINTS,
  buildPressureSeries, buildPulseSeries, buildSradSeries, findBPField, findSugarField, findPulseField,
  metricAvailable, buildMetricSeries, buildMetricTargets,
} from './TrendChart';
import type { Field, Entry, BPValues } from '../types';

const bpField: Field = {
  id: 'bp1', name: 'ВД / НД / П', type: 'bp', required: false, width: 30,
  parts: [{ id: 'systolic', label: 'ВД' }, { id: 'diastolic', label: 'НД' }, { id: 'pulse', label: 'П' }],
};
const sugarField: Field = { id: 's1', name: 'Сахар', type: 'number', unit: 'ммоль/л', required: false, width: 30 };
const dtField: Field = { id: 'd1', name: 'Дата и время', type: 'datetime', required: true, width: 30 };

describe('autoBucket', () => {
  it('returns day for ≤90 day span', () => {
    const now = Date.now();
    expect(autoBucket([now - 30 * 86400000, now])).toBe('day');
  });

  it('returns week for >90 day span', () => {
    const now = Date.now();
    expect(autoBucket([now - 100 * 86400000, now])).toBe('week');
  });

  it('returns day for single point', () => {
    expect(autoBucket([Date.now()])).toBe('day');
  });
});

describe('bucketPoints', () => {
  it('returns empty for empty input', () => {
    expect(bucketPoints([], 'day')).toEqual([]);
  });

  it('groups daily points by date key', () => {
    const base = new Date('2026-08-20T10:00:00').getTime();
    const points = [
      { date: base, value: 120, color: 'green' as const },
      { date: base + 3600000, value: 130, color: 'yellow' as const },
    ];
    const result = bucketPoints(points, 'day');
    expect(result).toHaveLength(1);
    expect(result[0].value).toBe(125); // average
    expect(result[0].color).toBe('yellow'); // worst wins
  });

  it('groups weekly points by ISO week start', () => {
    const mon = new Date('2026-08-17T10:00:00').getTime();
    const tue = new Date('2026-08-18T10:00:00').getTime();
    const points = [
      { date: mon, value: 120, color: 'green' as const },
      { date: tue, value: 145, color: 'red' as const },
    ];
    const result = bucketPoints(points, 'week');
    expect(result).toHaveLength(1);
    expect(result[0].color).toBe('red');
  });
});

describe('buildChartPoints', () => {
  it('extracts BP systolic as value with classification', () => {
    const entries: Entry[] = [
      { id: 'e1', reportId: 'r1', values: { bp1: { systolic: 150, diastolic: 90 } as BPValues, d1: '2026-08-20T10:00' }, createdAt: 1 },
    ];
    const pts = buildChartPoints(entries, 'bp1', bpField, 'd1');
    expect(pts).toHaveLength(1);
    expect(pts[0].value).toBe(150);
    expect(pts[0].color).toBe('red');
  });

  it('extracts sugar as value with classification', () => {
    const entries: Entry[] = [
      { id: 'e1', reportId: 'r1', values: { s1: 6.2, d1: '2026-08-20T10:00' }, createdAt: 1 },
    ];
    const pts = buildChartPoints(entries, 's1', sugarField, 'd1');
    expect(pts).toHaveLength(1);
    expect(pts[0].value).toBe(6.2);
    expect(pts[0].color).toBe('yellow');
  });

  it('skips entries without datetime', () => {
    const entries: Entry[] = [
      { id: 'e1', reportId: 'r1', values: { s1: 5.0 }, createdAt: 1 },
    ];
    const pts = buildChartPoints(entries, 's1', sugarField, 'd1');
    expect(pts).toHaveLength(0);
  });
});

describe('TrendChart component', () => {
  it('renders empty state when no data', () => {
    render(<TrendChart entries={[]} fields={[sugarField, dtField]} />);
    expect(screen.getByText('Нет данных для графика')).toBeInTheDocument();
  });

  it('renders SVG chart with data', () => {
    const entries: Entry[] = [
      { id: 'e1', reportId: 'r1', values: { s1: 5.0, d1: '2026-08-20T10:00' }, createdAt: 1 },
      { id: 'e2', reportId: 'r1', values: { s1: 6.5, d1: '2026-08-21T10:00' }, createdAt: 2 },
    ];
    const { container } = render(<TrendChart entries={entries} fields={[sugarField, dtField]} />);
    const svg = container.querySelector('svg');
    expect(svg).not.toBeNull();
    const circles = container.querySelectorAll('circle');
    expect(circles.length).toBeGreaterThan(0);
  });

  it('renders with target range band', () => {
    const entries: Entry[] = [
      { id: 'e1', reportId: 'r1', values: { s1: 5.0, d1: '2026-08-20T10:00' }, createdAt: 1 },
    ];
    const { container } = render(
      <TrendChart entries={entries} fields={[sugarField, dtField]} targetRange={{ low: 4.0, high: 7.0 }} />
    );
    const band = container.querySelector('rect[fill="var(--accent-soft)"]');
    expect(band).not.toBeNull();
    expect(container.querySelector('rect[data-band="norm"]')).not.toBeNull();
  });

  it('renders target lines in standout color', () => {
    const entries: Entry[] = [
      { id: 'e1', reportId: 'r1', values: { s1: 5.0, d1: '2026-08-20T10:00' }, createdAt: 1 },
    ];
    const { container } = render(
      <TrendChart entries={entries} fields={[sugarField, dtField]}
                  targetLines={[{ id: 't', label: 'Норма', value: 5.5 }]} />
    );
    expect(container.querySelector('[data-target="t"]')?.getAttribute('stroke')).toBe('#f97316');
  });

  it('renders two series with hollow markers as outlined circles', () => {
    const entries: Entry[] = [
      { id: 'e1', reportId: 'r1', values: { bp1: { systolic: 120, diastolic: 80 }, d1: '2026-08-20T10:00' }, createdAt: 1 },
      { id: 'e2', reportId: 'r1', values: { bp1: { systolic: 130, diastolic: 85 }, d1: '2026-08-21T10:00' }, createdAt: 2 },
    ];
    const { sys, dia } = buildPressureSeries(entries, 'bp1', 'd1');
    const { container } = render(
      <TrendChart
        series={[
          { id: 'sys', label: 'САД', points: sys },
          { id: 'dia', label: 'ДАД', points: dia, dashed: true, hollow: true },
        ]}
      />
    );
    const paths = container.querySelectorAll('path');
    expect(paths.length).toBe(2);
    expect(paths[1].getAttribute('stroke-dasharray')).toBe('5,3');
    const hollow = container.querySelectorAll('circle[stroke-width="3"]');
    expect(hollow.length).toBe(2);
    expect(screen.getByText('САД')).toBeInTheDocument();
    expect(screen.getByText('ДАД')).toBeInTheDocument();
  });

  it('printMode uses explicit hex colors without var() in SVG attributes', () => {
    const entries: Entry[] = [
      { id: 'e1', reportId: 'r1', values: { s1: 5.0, d1: '2026-08-20T10:00' }, createdAt: 1 },
      { id: 'e2', reportId: 'r1', values: { s1: 6.5, d1: '2026-08-21T10:00' }, createdAt: 2 },
    ];
    const { container } = render(<TrendChart entries={entries} fields={[sugarField, dtField]} printMode />);
    const circles = Array.from(container.querySelectorAll('circle'));
    expect(circles.length).toBeGreaterThan(0);
    for (const c of circles) {
      expect(c.getAttribute('fill')).not.toMatch(/^var\(/);
      expect(c.getAttribute('stroke')).not.toMatch(/^var\(/);
    }
    const path = container.querySelector('path');
    expect(path?.getAttribute('stroke')).toBe('#0e7490');
    const svgTexts = Array.from(container.querySelectorAll('text')).map(t => t.getAttribute('fill'));
    expect(svgTexts.every(f => f && !f.startsWith('var('))).toBe(true);
  });
});

describe('metric builders', () => {
  const entries: Entry[] = [
    { id: 'e1', reportId: 'r1', values: { bp1: { systolic: 150, diastolic: 95, pulse: 72 }, d1: '2026-08-20T10:00' }, createdAt: 1 },
    { id: 'e2', reportId: 'r1', values: { bp1: { systolic: 118, diastolic: 78, pulse: 68 }, d1: '2026-08-21T10:00' }, createdAt: 2 },
  ];

  it('buildPressureSeries splits sys/dia with per-value colors', () => {
    const { sys, dia } = buildPressureSeries(entries, 'bp1', 'd1');
    expect(sys.map(p => p.value)).toEqual([150, 118]);
    expect(sys.map(p => p.color)).toEqual(['red', 'green']);
    expect(dia.map(p => p.value)).toEqual([95, 78]);
    expect(dia.map(p => p.color)).toEqual(['red', 'green']);
  });

  it('buildPulseSeries extracts pulse from BP field', () => {
    const pts = buildPulseSeries(entries, 'bp1', 'd1', true);
    expect(pts.map(p => p.value)).toEqual([72, 68]);
    expect(pts.every(p => p.color === 'accent')).toBe(true);
  });

  it('finders locate bp/sugar/pulse fields', () => {
    const pulseField: Field = { id: 'p1', name: 'Пульс', type: 'number', required: false, width: 30 };
    const fields = [bpField, sugarField, pulseField, dtField];
    expect(findBPField(fields)?.id).toBe('bp1');
    expect(findSugarField(fields)?.id).toBe('s1');
    expect(findPulseField(fields)?.id).toBe('p1');
    expect(findPulseField([bpField, dtField])).toBeUndefined();
  });

  it('bucketPoints keeps accent color for pulse groups', () => {
    const base = new Date('2026-08-20T10:00:00').getTime();
    const result = bucketPoints([
      { date: base, value: 70, color: 'accent' as const },
      { date: base + 3600000, value: 72, color: 'accent' as const },
    ], 'day');
    expect(result).toHaveLength(1);
    expect(result[0].value).toBe(71);
    expect(result[0].color).toBe('accent');
  });

  it('takeLast returns freshest n points in ascending order', () => {
    const pts = [3, 1, 2].map(d => ({ date: d, value: d * 10, color: 'green' as const }));
    expect(takeLast(pts, 2).map(p => p.date)).toEqual([2, 3]);
    expect(takeLast(pts, 10)).toHaveLength(3);
  });

  it('noBucket keeps same-day points separate', () => {
    const entries: Entry[] = [0, 1, 2].map(i => ({
      id: `e${i}`, reportId: 'r1',
      values: { bp1: { systolic: 120 + i, diastolic: 80 }, d1: `2026-08-20T1${i}:00` },
      createdAt: i,
    }));
    const { sys } = buildPressureSeries(entries, 'bp1', 'd1');
    const { container } = render(
      <TrendChart series={[{ id: 'sys', label: 'САД', points: takeLast(sys, 10) }]} noBucket />
    );
    expect(container.querySelectorAll('circle')).toHaveLength(3);
  });

  it('keeps a measurement per point for small series (no bucketing below threshold)', () => {
    const entries: Entry[] = Array.from({ length: 9 }, (_, i) => ({
      id: `e${i}`, reportId: 'r1',
      values: { bp1: { systolic: 120 + i, diastolic: 80 }, d1: `2026-08-2${i % 3}T1${i}:00` },
      createdAt: i,
    }));
    const { sys } = buildPressureSeries(entries, 'bp1', 'd1');
    expect(sys).toHaveLength(9);
    const { container } = render(
      <TrendChart series={[{ id: 'sys', label: 'САД', points: sys }]} />
    );
    expect(container.querySelectorAll('circle')).toHaveLength(9);
  });

  it('buckets long series above threshold', () => {
    const n = MAX_UNBUCKETED_POINTS + 7;
    const entries: Entry[] = Array.from({ length: n }, (_, i) => ({
      id: `e${i}`, reportId: 'r1',
      values: { bp1: { systolic: 120 + (i % 5), diastolic: 80 }, d1: `2026-0${1 + Math.floor(i / 30)}-${String((i % 28) + 1).padStart(2, '0')}T10:00` },
      createdAt: i,
    }));
    const { sys } = buildPressureSeries(entries, 'bp1', 'd1');
    expect(sys).toHaveLength(n);
    const { container } = render(
      <TrendChart series={[{ id: 'sys', label: 'САД', points: sys }]} />
    );
    const circles = container.querySelectorAll('circle');
    expect(circles.length).toBeLessThan(n);
  });

  it('renders no date labels and spaces points evenly', () => {
    const entries: Entry[] = ['08', '12', '20'].map((h, i) => ({
      id: `e${i}`, reportId: 'r1',
      values: { s1: 5 + i, d1: `2026-08-20T${h}:00` },
      createdAt: i,
    }));
    const { container } = render(
      <TrendChart entries={entries} fields={[sugarField, dtField]} noBucket />
    );
    expect(container.querySelectorAll('circle')).toHaveLength(3);
    const texts = Array.from(container.querySelectorAll('text')).map(t => t.textContent);
    expect(texts.some(t => t?.includes('20.08'))).toBe(false);
    const xs = Array.from(container.querySelectorAll('circle')).map(c => Number(c.getAttribute('cx')));
    expect(new Set(xs).size).toBe(3);
  });

  it('orders points chronologically when input arrives newest-first (All period)', () => {
    const series = [{
      id: 'sys', label: 'САД',
      points: [
        { date: new Date('2026-08-22T10:00').getTime(), value: 30, color: 'green' as const },
        { date: new Date('2026-08-21T10:00').getTime(), value: 20, color: 'green' as const },
        { date: new Date('2026-08-20T10:00').getTime(), value: 10, color: 'green' as const },
      ],
    }];
    const { container } = render(<TrendChart series={series} noBucket />);
    const circles = Array.from(container.querySelectorAll('circle'));
    expect(circles).toHaveLength(3);
    const cx = circles.map(c => Number(c.getAttribute('cx')));
    const cy = circles.map(c => Number(c.getAttribute('cy')));
    const oldestIndex = cx.indexOf(Math.min(...cx));
    const lowestValueIndex = cy.indexOf(Math.max(...cy));
    expect(oldestIndex).toBe(lowestValueIndex);
  });

  it('shows value and measurement date when a point is clicked', () => {
    const entries: Entry[] = [
      { id: 'e1', reportId: 'r1', values: { bp1: { systolic: 120, diastolic: 80 }, d1: '2026-08-20T10:00' }, createdAt: 1 },
    ];
    const { sys } = buildPressureSeries(entries, 'bp1', 'd1');
    const { container } = render(
      <TrendChart series={[{ id: 'sys', label: 'САД', points: sys }]} noBucket />
    );
    fireEvent.click(container.querySelector('circle')!);
    expect(screen.getByText('САД: 120')).toBeInTheDocument();
    expect(screen.getByText(/20\.08\.2026/)).toBeInTheDocument();
  });

  it('hides the point tooltip when the same point is clicked again', () => {
    const entries: Entry[] = [
      { id: 'e1', reportId: 'r1', values: { bp1: { systolic: 120, diastolic: 80 }, d1: '2026-08-20T10:00' }, createdAt: 1 },
    ];
    const { sys } = buildPressureSeries(entries, 'bp1', 'd1');
    const { container } = render(
      <TrendChart series={[{ id: 'sys', label: 'САД', points: sys }]} noBucket />
    );
    const circle = container.querySelector('circle')!;
    fireEvent.click(circle);
    expect(screen.getByText('САД: 120')).toBeInTheDocument();
    fireEvent.click(circle);
    expect(screen.queryByText('САД: 120')).toBeNull();
  });
});

describe('srad metric', () => {
  const sradEntries: Entry[] = [
    { id: 'e1', reportId: 'r1', values: { bp1: { systolic: 130, diastolic: 80 }, d1: '2026-08-20T10:00' }, createdAt: 1 },
    { id: 'e2', reportId: 'r1', values: { bp1: { systolic: 150, diastolic: 100 }, d1: '2026-08-21T10:00' }, createdAt: 2 },
    { id: 'e3', reportId: 'r1', values: { bp1: { systolic: 60, diastolic: 40 }, d1: '2026-08-22T10:00' }, createdAt: 3 },
    { id: 'e4', reportId: 'r1', values: { d1: '2026-08-23T10:00' }, createdAt: 4 },
  ];

  it('buildSradSeries computes MAP with category colors', () => {
    const pts = buildSradSeries(sradEntries, 'bp1', 'd1');
    expect(pts.map(p => p.value)).toEqual([97, 117, 47]);
    expect(pts.map(p => p.color)).toEqual(['green', 'yellow', 'red']);
  });

  it('buildSradSeries skips entries without BP value or date', () => {
    const pts = buildSradSeries(sradEntries, 'bp1', 'd1');
    expect(pts).toHaveLength(3);
    const noDate = buildSradSeries(
      [{ id: 'e5', reportId: 'r1', values: { bp1: { systolic: 120, diastolic: 80 } }, createdAt: 5 }],
      'bp1', 'd1',
    );
    expect(noDate).toHaveLength(0);
  });

  it('buildMetricSeries returns srad series with label', () => {
    const series = buildMetricSeries(sradEntries, [bpField, dtField], 'srad');
    expect(series).toHaveLength(1);
    expect(series[0].id).toBe('srad');
    expect(series[0].label).toBe('СрАд');
    expect(series[0].points).toHaveLength(3);
  });

  it('metricAvailable srad matches bp availability', () => {
    expect(metricAvailable([bpField, dtField], 'srad')).toBe(true);
    expect(metricAvailable([sugarField, dtField], 'srad')).toBe(false);
  });

  it('buildMetricTargets returns no targets for srad', () => {
    expect(buildMetricTargets({ sys: 120, dia: 80 }, 'srad')).toEqual([]);
    expect(buildMetricTargets(undefined, 'srad')).toEqual([]);
  });
});
