import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { Report, Entry, BPValues } from '../types';
import { formatCell, formatBP } from './format';
import type { ChartPointColor } from '../components/TrendChart';
import regularFont from '../assets/fonts/PT_Sans-Web-Regular-subset.ttf?inline';
import boldFont from '../assets/fonts/PT_Sans-Web-Bold-subset.ttf?inline';

const MARGIN = 36;

/** data URI вида "data:font/ttf;base64,…" → голый base64 для addFileToVFS. */
const toBase64 = (dataUri: string) => dataUri.split(',')[1];

export interface PdfChart {
  title: string;
  series: { id: string; label: string; dashed?: boolean; hollow?: boolean; points: { date: number; value: number; color: ChartPointColor }[] }[];
  targets: { id: string; label: string; value: number; color?: string; dashed?: boolean }[];
}

export interface PdfMeta {
  rangeLabel?: string;
  normsLabel?: string;
  charts?: PdfChart[];
}

export function pdfFields(report: Report): Report['fields'] {
  return report.fields.filter(f => !f.hidden);
}

const FIELD_HEAD = (f: Report['fields'][number]) =>
  `${f.name}${f.unit ? `, ${f.unit}` : ''}${f.required ? ' *' : ''}`;

const CHART_POINT_COLORS: Record<ChartPointColor, string> = {
  green: '#12855f',
  yellow: '#e6a817',
  red: '#d92d20',
  accent: '#0e7490',
};
const CHART_LINE_COLOR = '#0e7490';
const CHART_GRID_COLOR = '#cbd5e1';
const CHART_TEXT_COLOR = '#5c6f81';
const CHART_TARGET_COLOR = '#f97316';

function drawPdfChart(
  doc: jsPDF,
  chart: PdfChart,
  x: number,
  yTop: number,
  w: number,
  h: number,
): void {
  doc.setFont('PTSans', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(30);
  doc.text(chart.title, x, yTop);

  const innerTop = yTop + 8;
  const innerH = h - 14;
  const innerBottom = innerTop + innerH;
  const right = x + w;

  const allPoints = chart.series.flatMap(s => s.points);
  const allVals = allPoints.map(p => p.value);
  const targetVals = chart.targets.map(t => t.value);
  if (allVals.length === 0) {
    doc.setFont('PTSans', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(CHART_TEXT_COLOR);
    doc.text('Нет данных для графика', x, innerTop + innerH / 2);
    return;
  }
  let vMin = Math.min(...allVals, ...targetVals);
  let vMax = Math.max(...allVals, ...targetVals);
  const pad = (vMax - vMin) * 0.1 || 1;
  vMin -= pad;
  vMax += pad;

  const yScale = (v: number) => innerBottom - ((v - vMin) / (vMax - vMin)) * innerH;
  const n = Math.max(...chart.series.map(s => s.points.length));
  const xPos = (i: number) => x + (n <= 1 ? w / 2 : (i / (n - 1)) * w);

  doc.setFont('PTSans', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(CHART_TEXT_COLOR);
  for (let k = 0; k < 4; k++) {
    const v = vMin + ((vMax - vMin) * k) / 3;
    const yy = yScale(v);
    doc.setDrawColor(CHART_GRID_COLOR);
    doc.setLineWidth(0.4);
    doc.setLineDashPattern([2, 2], 0);
    doc.line(x, yy, right, yy);
    doc.setLineDashPattern([], 0);
    doc.text(String(Math.round(v)), x - 3, yy, { align: 'right' });
  }

  for (const t of chart.targets) {
    const yy = yScale(t.value);
    doc.setDrawColor(t.color ?? CHART_TARGET_COLOR);
    doc.setLineWidth(1);
    doc.setLineDashPattern(t.dashed === false ? [] : [4, 3], 0);
    doc.line(x, yy, right, yy);
    doc.setLineDashPattern([], 0);
  }

  for (const s of chart.series) {
    const pts = s.points;
    if (pts.length === 0) continue;
    doc.setDrawColor(CHART_LINE_COLOR);
    doc.setLineWidth(1);
    doc.setLineDashPattern(s.dashed ? [3, 2] : [], 0);
    for (let i = 0; i < pts.length - 1; i++) {
      doc.line(xPos(i), yScale(pts[i].value), xPos(i + 1), yScale(pts[i + 1].value));
    }
    doc.setLineDashPattern([], 0);
  }

  for (const s of chart.series) {
    const pts = s.points;
    for (let i = 0; i < pts.length; i++) {
      const cx = xPos(i);
      const cy = yScale(pts[i].value);
      const fill = CHART_POINT_COLORS[pts[i].color];
      doc.setDrawColor(fill);
      doc.setLineWidth(1);
      doc.setFillColor(s.hollow ? 'ffffff' : fill);
      doc.circle(cx, cy, 2.2, 'FD');
    }
  }

  let lx = right;
  doc.setFont('PTSans', 'normal');
  doc.setFontSize(7);
  for (const s of chart.series) {
    const tw = doc.getTextWidth(s.label);
    lx -= tw + 4;
    doc.setTextColor(30);
    doc.text(s.label, lx, yTop + 2, { align: 'right' });
    lx -= 8;
  }
}

export function buildReportPdfBytes(report: Report, entries: Entry[], meta?: PdfMeta): ArrayBuffer {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
  doc.addFileToVFS('PTSans-Regular.ttf', toBase64(regularFont));
  doc.addFont('PTSans-Regular.ttf', 'PTSans', 'normal');
  doc.addFileToVFS('PTSans-Bold.ttf', toBase64(boldFont));
  doc.addFont('PTSans-Bold.ttf', 'PTSans', 'bold');

  const fields = pdfFields(report);
  const total = fields.reduce((s, f) => s + Math.max(1, f.width ?? 1), 0);
  const pageW = doc.internal.pageSize.getWidth();
  const avail = pageW - MARGIN * 2;

  const columnStyles: Record<number, { cellWidth: number }> = {};
  fields.forEach((f, i) => {
    columnStyles[i] = { cellWidth: (Math.max(1, f.width ?? 1) / total) * avail };
  });

  doc.setFont('PTSans', 'bold');
  doc.setFontSize(13);
  let y = 48;
  const title = doc.splitTextToSize(report.name, avail) as string[];
  doc.text(title, MARGIN, y);
  y += title.length * 15;

  const subtitle = [meta?.rangeLabel, meta?.normsLabel].filter(Boolean).join(' · ');
  if (subtitle) {
    doc.setFont('PTSans', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(100);
    const lines = doc.splitTextToSize(subtitle, avail) as string[];
    doc.text(lines, MARGIN, y);
    y += lines.length * 12 + 4;
    doc.setTextColor(0);
  } else {
    y += 8;
  }

  autoTable(doc, {
    startY: y,
    head: [fields.map(FIELD_HEAD)],
    body: entries.map(e =>
      fields.map(f =>
        f.type === 'bp'
          ? formatBP(e.values[f.id] as BPValues | undefined, f.parts)
          : formatCell(f, String(e.values[f.id] ?? '')),
      ),
    ),
    margin: { left: MARGIN, right: MARGIN },
    styles: { font: 'PTSans', fontStyle: 'normal', fontSize: 8, cellPadding: 3, overflow: 'linebreak' },
    headStyles: { font: 'PTSans', fontStyle: 'bold', fillColor: [226, 232, 240], textColor: 30 },
    columnStyles,
    theme: 'grid',
  });

  const charts = meta?.charts ?? [];
  if (charts.length > 0) {
    const pageH = doc.internal.pageSize.getHeight();
    const chartH = 110;
    let cy = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 18;
    for (const chart of charts) {
      if (cy + chartH > pageH - MARGIN) {
        doc.addPage();
        cy = MARGIN;
      }
      drawPdfChart(doc, chart, MARGIN, cy, avail, chartH);
      cy += chartH + 14;
    }
  }

  return doc.output('arraybuffer') as ArrayBuffer;
}

export function buildReportPdf(report: Report, entries: Entry[], meta?: PdfMeta): Blob {
  return new Blob([buildReportPdfBytes(report, entries, meta)], { type: 'application/pdf' });
}