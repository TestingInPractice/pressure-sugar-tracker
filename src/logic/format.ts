import type { Field } from '../types';

const DT = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/;

export function formatCell(f: Field, raw: string): string {
  if (f.type !== 'datetime') return raw;
  const m = DT.exec(raw);
  return m ? `${m[3]}.${m[2]} ${m[4]}:${m[5]}` : raw;
}
