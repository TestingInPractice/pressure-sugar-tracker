import { useMemo } from 'react';
import type { Entry, Field, BPValues } from '../types';
import { datetimeFieldId } from '../logic/print-filter';
import { classifyBP, classifySugar, isBPFieldName, isSugarField } from '../logic/classification';
import type { StatusColor } from '../logic/classification';

/** Точки для графика: значение + цвет + дата. */
export interface ChartPoint {
  date: number;   // timestamp ms
  value: number;
  color: ChartPointColor;
}

export type ChartPointColor = StatusColor | 'accent';

export interface ChartSeries {
  id: string;
  label: string;
  points: ChartPoint[];
  dashed?: boolean;
  hollow?: boolean;
}

export interface TargetLine {
  id: string;
  label: string;
  value: number;
  color?: string;
  dashed?: boolean;
}

export const TARGET_LINE_COLOR = '#f97316';

/** Авто-бакет: ≤90 дней → daily, иначе → weekly. */
export type BucketMode = 'day' | 'week';

const CHART_W = 340;
const CHART_H = 140;
const PAD = { top: 10, right: 10, bottom: 24, left: 36 };

/** Группирует точки по дате (день или неделя) и усредняет. */
export function bucketPoints(
  points: ChartPoint[],
  mode: BucketMode,
): ChartPoint[] {
  if (points.length === 0) return [];
  const sorted = [...points].sort((a, b) => a.date - b.date);
  const groups = new Map<string, ChartPoint[]>();
  for (const p of sorted) {
    const d = new Date(p.date);
    let key: string;
    if (mode === 'day') {
      key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    } else {
      // week: use ISO week start (Monday)
      const day = d.getDay();
      const diff = (day === 0 ? -6 : 1) - day;
      const monday = new Date(d);
      monday.setDate(d.getDate() + diff);
      key = monday.toISOString().slice(0, 10);
    }
    const arr = groups.get(key) ?? [];
    arr.push(p);
    groups.set(key, arr);
  }
  const result: ChartPoint[] = [];
  for (const [key, arr] of groups) {
    const avg = arr.reduce((s, p) => s + p.value, 0) / arr.length;
    const colors = arr.map(p => p.color);
    const color: ChartPointColor = colors.every(c => c === 'accent')
      ? 'accent'
      : worstOf(colors.filter((c): c is StatusColor => c !== 'accent'));
    result.push({ date: new Date(key + 'T12:00:00').getTime(), value: avg, color });
  }
  return result.sort((a, b) => a.date - b.date);
}

function worstOf(colors: StatusColor[]): StatusColor {
  if (colors.includes('red')) return 'red';
  if (colors.includes('yellow')) return 'yellow';
  return 'green';
}

/** Последние n точек (самые свежие по дате), порядок — по возрастанию даты. */
export function takeLast(points: ChartPoint[], n: number): ChartPoint[] {
  return [...points].sort((a, b) => b.date - a.date).slice(0, n).sort((a, b) => a.date - b.date);
}

/** Определяем bucket mode по диапазону дат. */
export function autoBucket(dates: number[]): BucketMode {
  if (dates.length < 2) return 'day';
  const min = Math.min(...dates);
  const max = Math.max(...dates);
  const spanDays = (max - min) / (1000 * 60 * 60 * 24);
  return spanDays <= 90 ? 'day' : 'week';
}

export function findBPField(fields: Field[]): Field | undefined {
  return fields.find(f => !f.hidden && (f.type === 'bp' || isBPFieldName(f.name)));
}

export function findSugarField(fields: Field[]): Field | undefined {
  return fields.find(f => !f.hidden && isSugarField(f.name, f.unit));
}

export function findPulseField(fields: Field[]): Field | undefined {
  return fields.find(f => !f.hidden && f.type !== 'bp' && /пульс/i.test(f.name));
}

function pointDate(entry: Entry, dtFieldId: string | undefined): number | undefined {
  const dtRaw = dtFieldId ? entry.values[dtFieldId] : undefined;
  const dtStr = typeof dtRaw === 'string' ? dtRaw : '';
  const date = new Date(dtStr).getTime();
  return Number.isFinite(date) ? date : undefined;
}

function sysColor(v: number): StatusColor {
  return v >= 140 ? 'red' : v >= 120 ? 'yellow' : 'green';
}

function diaColor(v: number): StatusColor {
  return v >= 90 ? 'red' : v >= 80 ? 'yellow' : 'green';
}

/** Две линии давления: верхнее (залитые кружки) + нижнее (пунктирные). */
export function buildPressureSeries(
  entries: Entry[],
  bpFieldId: string,
  dtFieldId: string | undefined,
): { sys: ChartPoint[]; dia: ChartPoint[] } {
  const sys: ChartPoint[] = [];
  const dia: ChartPoint[] = [];
  for (const e of entries) {
    const date = pointDate(e, dtFieldId);
    if (date === undefined) continue;
    const bp = e.values[bpFieldId] as BPValues | undefined;
    const s = Number(bp?.systolic);
    const d = Number(bp?.diastolic);
    if (Number.isFinite(s)) sys.push({ date, value: s, color: sysColor(s) });
    if (Number.isFinite(d)) dia.push({ date, value: d, color: diaColor(d) });
  }
  return { sys, dia };
}

/** Пульс: из композитного поля давления или отдельного числового поля. */
export function buildPulseSeries(
  entries: Entry[],
  pulseFieldId: string,
  dtFieldId: string | undefined,
  fromBP: boolean,
): ChartPoint[] {
  const points: ChartPoint[] = [];
  for (const e of entries) {
    const date = pointDate(e, dtFieldId);
    if (date === undefined) continue;
    const raw = fromBP ? (e.values[pulseFieldId] as BPValues | undefined)?.pulse : e.values[pulseFieldId];
    const v = Number(raw);
    if (Number.isFinite(v)) points.push({ date, value: v, color: 'accent' });
  }
  return points;
}

function extractValue(entry: Entry, fieldId: string, field: Field): number | undefined {
  const v = entry.values[fieldId];
  if (v === undefined || v === null || v === '') return undefined;
  if (field.type === 'bp') {
    const bp = v as BPValues;
    return Number(bp.systolic) || undefined;
  }
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

/** Строит массив точек из записей. */
export function buildChartPoints(
  entries: Entry[],
  fieldId: string,
  field: Field,
  dtFieldId: string | undefined,
): ChartPoint[] {
  const isBP = field.type === 'bp' || isBPFieldName(field.name);
  const isSugarF = isSugarField(field.name, field.unit);

  return entries
    .map((e): ChartPoint | null => {
      const dtRaw = dtFieldId ? e.values[dtFieldId] : undefined;
      const dtStr = typeof dtRaw === 'string' ? dtRaw : '';
      const date = new Date(dtStr).getTime();
      if (!Number.isFinite(date)) return null;

      let value: number | undefined;
      let color: ChartPointColor = 'green';

      if (isBP) {
        const bp = e.values[fieldId] as BPValues | undefined;
        value = Number(bp?.systolic);
        color = classifyBP(bp);
      } else if (isSugarF) {
        value = extractValue(e, fieldId, field);
        color = classifySugar(e.values[fieldId]);
      } else {
        value = extractValue(e, fieldId, field);
      }

      if (value === undefined || !Number.isFinite(value)) return null;
      return { date, value, color };
    })
    .filter((p): p is ChartPoint => p !== null);
}

interface Props {
  entries?: Entry[];
  fields?: Field[];
  series?: ChartSeries[];
  targetLines?: TargetLine[];
  noBucket?: boolean;
  targetRange?: { low: number; high: number };
  height?: number;
  width?: number;
}

const COLOR_MAP: Record<ChartPointColor, string> = {
  green: 'var(--success)',
  yellow: '#e6a817',
  red: 'var(--danger)',
  accent: 'var(--accent)',
};

/**
 * TrendChart — чистый SVG line chart без внешних зависимостей.
 * Показывает линию + точки, окрашенные по classification.
 * Ось X порядковая: замеры идут последовательно, без подписей дат.
 */
export default function TrendChart({
  entries = [],
  fields = [],
  series: seriesProp,
  targetLines = [],
  noBucket = false,
  targetRange,
  height = CHART_H,
  width = CHART_W,
}: Props) {
  const dtFieldId = datetimeFieldId(fields);

  // Find the first BP or sugar field to chart
  const chartField = useMemo(() => {
    return fields.find(f => f.type === 'bp' || isBPFieldName(f.name) || isSugarField(f.name, f.unit));
  }, [fields]);

  const legacyRaw = useMemo(() => {
    if (!chartField) return [];
    return buildChartPoints(entries, chartField.id, chartField, dtFieldId);
  }, [entries, chartField, dtFieldId]);

  const rawSeries: ChartSeries[] = useMemo(() => {
    if (seriesProp) return seriesProp;
    return [{ id: 'main', label: '', points: legacyRaw }];
  }, [seriesProp, legacyRaw]);

  const bucket = useMemo(
    () => autoBucket(rawSeries.flatMap(s => s.points.map(p => p.date))),
    [rawSeries],
  );

  const cooked: ChartSeries[] = useMemo(
    () => rawSeries.map(s => ({ ...s, points: noBucket ? s.points : bucketPoints(s.points, bucket) })),
    [rawSeries, bucket, noBucket],
  );
  const visible = useMemo(() => cooked.filter(s => s.points.length > 0), [cooked]);
  const maxLen = useMemo(() => Math.max(0, ...visible.map(s => s.points.length)), [visible]);

  const inner = useMemo(() => ({
    x: PAD.left,
    y: PAD.top,
    w: width - PAD.left - PAD.right,
    h: height - PAD.top - PAD.bottom,
  }), [width, height]);

  const { yMin, yMax } = useMemo(() => {
    const all = visible.flatMap(s => s.points);
    if (all.length === 0) return { yMin: 0, yMax: 100 };
    const vals = all.map(p => p.value);
    let vMin = Math.min(...vals);
    let vMax = Math.max(...vals);
    // Include target range and target lines in y-scale
    if (targetRange) {
      vMin = Math.min(vMin, targetRange.low);
      vMax = Math.max(vMax, targetRange.high);
    }
    for (const l of targetLines) {
      vMin = Math.min(vMin, l.value);
      vMax = Math.max(vMax, l.value);
    }
    const pad = (vMax - vMin) * 0.1 || 1;
    const yMinCalc = vMin - pad;
    const yMaxCalc = vMax + pad;
    return {
      yMin: yMinCalc,
      yMax: yMaxCalc,
    };
  }, [visible, inner, targetRange, targetLines]);

  const yScale = useMemo(() => {
    return (v: number) => inner.y + inner.h - ((v - yMin) / (yMax - yMin)) * inner.h;
  }, [inner, yMin, yMax]);

  const xPos = useMemo(() => {
    const span = Math.max(maxLen - 1, 1);
    return (i: number) => inner.x + (i / span) * inner.w;
  }, [inner, maxLen]);

  // Line paths, one per series
  const linePaths = useMemo(() => {
    return visible.map(s => ({
      id: s.id,
      dashed: s.dashed,
      d: s.points.map((p, i) => {
        const cx = xPos(i);
        const cy = yScale(p.value);
        return `${i === 0 ? 'M' : 'L'}${cx},${cy}`;
      }).join(' '),
    }));
  }, [visible, xPos, yScale]);

  // Target range band
  const bandRect = useMemo(() => {
    if (!targetRange) return null;
    const y1 = yScale(targetRange.high);
    const y2 = yScale(targetRange.low);
    return { x: inner.x, y: y1, width: inner.w, height: y2 - y1 };
  }, [targetRange, yScale, inner]);

  // Y-axis ticks (3-4 values)
  const yTicks = useMemo(() => {
    const count = 4;
    const step = (yMax - yMin) / (count - 1);
    return Array.from({ length: count }, (_, i) => Math.round(yMin + step * i));
  }, [yMin, yMax]);

  const showLegend = visible.length > 1 || (visible[0]?.label ?? '') !== '';

  if (visible.length === 0) {
    return (
      <div className="trend-chart trend-chart--empty">
        <svg viewBox={`0 0 ${width} ${height}`} width="100%" role="img" aria-label="Нет данных для графика">
          <text x={width / 2} y={height / 2} textAnchor="middle" fill="var(--text-muted)" fontSize="13" dominantBaseline="middle">
            Нет данных для графика
          </text>
        </svg>
      </div>
    );
  }

  return (
    <div className="trend-chart">
      {showLegend && (
        <div className="trend-chart__legend" aria-hidden="true">
          {visible.map(s => (
            <span key={s.id} className="trend-chart__legend-item">
              <span className={s.dashed ? 'trend-chart__swatch trend-chart__swatch--hollow' : 'trend-chart__swatch'} />
              {s.label}
            </span>
          ))}
          {targetLines.map(l => (
            <span key={l.id} className="trend-chart__legend-item">
              <span className={l.dashed === false ? 'trend-chart__line-swatch' : 'trend-chart__line-swatch trend-chart__line-swatch--dashed'}
                    style={{ borderColor: l.color ?? TARGET_LINE_COLOR }} />
              {l.label}
            </span>
          ))}
        </div>
      )}
      <svg viewBox={`0 0 ${width} ${height}`} width="100%" role="img" aria-label="График показателей">
        {/* Target range band */}
        {bandRect && (
          <rect x={bandRect.x} y={bandRect.y} width={bandRect.width} height={bandRect.height}
                fill="var(--accent-soft)" rx="2" />
        )}
        {/* Target lines */}
        {targetLines.map(l => (
          <line key={l.id} data-target={l.id}
                x1={inner.x} y1={yScale(l.value)} x2={inner.x + inner.w} y2={yScale(l.value)}
                stroke={l.color ?? TARGET_LINE_COLOR} strokeWidth="2"
                strokeDasharray={l.dashed === false ? undefined : '6,4'} />
        ))}
        {/* Y-axis grid lines + labels */}
        {yTicks.map(v => (
          <g key={v}>
            <line x1={inner.x} y1={yScale(v)} x2={inner.x + inner.w} y2={yScale(v)}
                  stroke="var(--border)" strokeWidth="0.5" strokeDasharray="4,3" />
            <text x={inner.x - 4} y={yScale(v)} textAnchor="end" dominantBaseline="middle"
                  fill="var(--text-muted)" fontSize="10">
              {v}
            </text>
          </g>
        ))}
        {/* Lines */}
        {linePaths.map(l => (
          <path key={l.id} d={l.d} fill="none" stroke="var(--accent)" strokeWidth="2"
                strokeLinejoin="round" strokeDasharray={l.dashed ? '5,3' : undefined} />
        ))}
        {/* Points */}
        {visible.map(s => s.points.map((p, i) => (
          <circle key={`${s.id}-${i}`} cx={xPos(i)} cy={yScale(p.value)} r="4"
                  fill={s.hollow ? 'var(--surface)' : COLOR_MAP[p.color]}
                  stroke={s.hollow ? COLOR_MAP[p.color] : 'var(--surface)'}
                  strokeWidth={s.hollow ? 2 : 1.5}
                  strokeDasharray={s.hollow ? '3,2' : undefined} />
        )))}
      </svg>
    </div>
  );
}
