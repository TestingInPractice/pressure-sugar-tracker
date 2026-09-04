import { useRef, useEffect, useCallback, useState } from 'react';
import type { Report, Entry, BPValues } from '../types';
import { formatCell, formatBP } from '../logic/format';
import { numberingFieldId } from '../logic/entry-number';
import { classifyBP, classifySugar, isBPFieldName, isSugarField } from '../logic/classification';
import type { StatusColor } from '../logic/classification';
import { datetimeFieldId } from '../logic/print-filter';

const COLOR_CLASS: Record<StatusColor, string> = {
  green: 'status-green',
  yellow: 'status-yellow',
  red: 'status-red',
};

function classifyEntry(entry: Entry, fields: Report['fields']): StatusColor {
  let worst: StatusColor = 'green';
  for (const f of fields) {
    if (f.type === 'bp' || isBPFieldName(f.name)) {
      const bp = entry.values[f.id] as BPValues | undefined;
      const s = classifyBP(bp);
      if (s === 'red') return 'red';
      if (s === 'yellow') worst = 'yellow';
    } else if (isSugarField(f.name, f.unit)) {
      const s = classifySugar(entry.values[f.id]);
      if (s === 'red') return 'red';
      if (s === 'yellow') worst = 'yellow';
    }
  }
  return worst;
}

function extractHighlights(entry: Entry, fields: Report['fields']): string[] {
  const highlights: string[] = [];
  for (const f of fields) {
    if (f.id === numberingFieldId(fields)) continue;
    if (f.type === 'bp' || isBPFieldName(f.name)) {
      const bp = entry.values[f.id] as BPValues | undefined;
      const formatted = formatBP(bp, f.parts);
      if (formatted) highlights.push(formatted);
    } else if (isSugarField(f.name, f.unit)) {
      const v = entry.values[f.id];
      if (v !== undefined && v !== '') highlights.push(`${v} ${f.unit ?? ''}`.trim());
    }
  }
  return highlights;
}

function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(max-width: 480px)');
    setIsMobile(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);
  return isMobile;
}

interface Props {
  report: Pick<Report, 'fields'>;
  entries: Entry[];
  onEdit: (e: Entry) => void;
  onDelete: (e: Entry) => void;
}

export default function EntriesTable({ report, entries, onEdit, onDelete }: Props) {
  const fields = report.fields.filter(f => !f.hidden);
  const total = fields.reduce((s, f) => s + Math.max(1, f.width ?? 1), 0);
  const numId = numberingFieldId(report.fields);
  const dtId = datetimeFieldId(report.fields);
  const scrollRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();

  const checkOverflow = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const canScroll = el.scrollWidth > el.clientWidth;
    el.classList.toggle('has-overflow', canScroll);
    el.classList.toggle('scrolled-right', canScroll && el.scrollLeft < el.scrollWidth - el.clientWidth - 2);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    checkOverflow();
    el.addEventListener('scroll', checkOverflow, { passive: true });
    const ro = new ResizeObserver(checkOverflow);
    ro.observe(el);
    return () => { el.removeEventListener('scroll', checkOverflow); ro.disconnect(); };
  }, [checkOverflow, entries]);

  if (isMobile) {
    return (
      <div className="entries-cards" role="list">
        {entries.map(e => {
          const status = classifyEntry(e, fields);
          const highlights = extractHighlights(e, fields);
          const dtField = dtId ? report.fields.find(f => f.id === dtId) : undefined;
          const dtRaw = dtId ? e.values[dtId] : undefined;
          const dateStr = dtRaw && dtField ? formatCell(dtField, String(dtRaw)) : '';
          const noteField = fields.find(f => f.type === 'text' && !isBPFieldName(f.name));
          const context = noteField ? String(e.values[noteField.id] ?? '') : '';
          const cleanContext = context.replace(/^\[[^\]]*\]\s*/, '');

          return (
            <div key={e.id} className="entry-card" role="listitem">
              <div className="entry-card__top">
                <span className={`entry-card__dot ${COLOR_CLASS[status]}`} />
                <span className="entry-card__date">{dateStr}</span>
                <div className="entry-card__actions">
                  <button onClick={() => onEdit(e)} aria-label="Редактировать">✎</button>
                  <button onClick={() => onDelete(e)} aria-label="Удалить">🗑</button>
                </div>
              </div>
              <div className="entry-card__values">
                {highlights.map((h, i) => (
                  <span key={i} className="entry-card__value">{h}</span>
                ))}
              </div>
              {cleanContext && <div className="entry-card__context">{cleanContext}</div>}
            </div>
          );
        })}
        {entries.length === 0 && (
          <div className="entry-card entry-card--empty">Нет записей</div>
        )}
      </div>
    );
  }

  return (
    <div className="entries-scroll" ref={scrollRef}>
      <table className="entries-table">
      <thead>
        <tr>
          {fields.map(f => (
            <th key={f.id} className={f.id === numId ? 'col-number' : undefined}
                style={{ width: `${(Math.max(1, f.width ?? 1) / total) * 100}%` }}>
              {f.name}{f.unit ? `, ${f.unit}` : ''}
              {f.required ? ' *' : ''}
            </th>
          ))}
          <th className="actions-col" />
        </tr>
      </thead>
      <tbody>
        {entries.map(e => (
          <tr key={e.id}>
            {fields.map(f => (
              <td key={f.id} className={f.id === numId ? 'col-number wrap-cell' : 'wrap-cell'}>
                {f.type === 'bp'
                  ? formatBP(e.values[f.id] as BPValues, f.parts)
                  : formatCell(f, String(e.values[f.id] ?? ''))}
              </td>
            ))}
            <td className="actions-col">
              <button onClick={() => onEdit(e)}>✎</button>
              <button onClick={() => onDelete(e)}>🗑</button>
            </td>
          </tr>
        ))}
        {entries.length === 0 && (
          <tr><td colSpan={fields.length + 1}>Нет записей</td></tr>
        )}
      </tbody>
      </table>
    </div>
  );
}
