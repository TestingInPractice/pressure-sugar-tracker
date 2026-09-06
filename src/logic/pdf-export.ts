import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { Report, Entry, BPValues } from '../types';
import { formatCell, formatBP } from './format';
import regularFont from '../assets/fonts/PT_Sans-Web-Regular-subset.ttf?inline';
import boldFont from '../assets/fonts/PT_Sans-Web-Bold-subset.ttf?inline';

const MARGIN = 36;

/** data URI вида "data:font/ttf;base64,…" → голый base64 для addFileToVFS. */
const toBase64 = (dataUri: string) => dataUri.split(',')[1];

export interface PdfMeta {
  rangeLabel?: string;
  normsLabel?: string;
}

export function pdfFields(report: Report): Report['fields'] {
  return report.fields.filter(f => !f.hidden);
}

const FIELD_HEAD = (f: Report['fields'][number]) =>
  `${f.name}${f.unit ? `, ${f.unit}` : ''}${f.required ? ' *' : ''}`;

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

  return doc.output('arraybuffer') as ArrayBuffer;
}

export function buildReportPdf(report: Report, entries: Entry[], meta?: PdfMeta): Blob {
  return new Blob([buildReportPdfBytes(report, entries, meta)], { type: 'application/pdf' });
}