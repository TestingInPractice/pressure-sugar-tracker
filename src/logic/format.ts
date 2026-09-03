import type { Field, BPValues } from '../types';

const DT = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/;

export function formatBP(v: BPValues | undefined, parts: Field['parts']): string {
  if (!v) return '';
  const order = parts && parts.length > 0 ? parts : [
    { id: 'systolic', label: 'ВД' },
    { id: 'diastolic', label: 'НД' },
    { id: 'pulse', label: 'П' },
  ];
  const vals = order
    .map(p => (v as Record<string, unknown>)[p.id])
    .filter(x => x !== undefined && String(x).trim() !== '')
    .map(x => String(x));
  if (vals.length === 0) return '';
  if (vals.length === 3) return `${vals[0]}/${vals[1]} ${vals[2]}`;
  if (vals.length === 2) return `${vals[0]}/${vals[1]}`;
  return vals[0];
}

export function formatCell(f: Field, raw: string): string {
  if (f.type !== 'datetime') return raw;
  const m = DT.exec(raw);
  return m ? `${m[3]}.${m[2]} ${m[4]}:${m[5]}` : raw;
}
