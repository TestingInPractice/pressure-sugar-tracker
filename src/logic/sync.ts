import type { Report, Entry } from '../types';

const SUPPORTED_VERSION = 1;

export type SyncOutcome =
  | { kind: 'identical' }
  | { kind: 'append-only'; added: Entry[] }
  | { kind: 'conflict'; added: Entry[]; modified: Entry[]; deleted: Entry[] };

function sameValues(a: Record<string, string | number>, b: Record<string, string | number>): boolean {
  const ka = Object.keys(a);
  const kb = Object.keys(b);
  if (ka.length !== kb.length) return false;
  return ka.every(k => a[k] === b[k]);
}

export function classifySync(current: Entry[], synced: Entry[] | undefined): SyncOutcome {
  const base = synced ?? [];
  const syncedById = new Map(base.map(e => [e.id, e]));
  const currentIds = new Set(current.map(e => e.id));

  const added: Entry[] = [];
  const modified: Entry[] = [];
  const deleted: Entry[] = [];

  for (const e of current) {
    const old = syncedById.get(e.id);
    if (!old) {
      added.push(e);
    } else if (!sameValues(e.values, old.values)) {
      modified.push(e);
    }
  }
  for (const e of base) {
    if (!currentIds.has(e.id)) deleted.push(e);
  }

  if (added.length === 0 && modified.length === 0 && deleted.length === 0) {
    return { kind: 'identical' };
  }
  if (modified.length === 0 && deleted.length === 0) {
    return { kind: 'append-only', added };
  }
  return { kind: 'conflict', added, modified, deleted };
}

export function buildSyncJson(
  report: Pick<Report, 'id' | 'name' | 'fields'>,
  entries: Entry[],
  syncedAtMs: number,
): string {
  return JSON.stringify({
    version: SUPPORTED_VERSION,
    reportId: report.id,
    reportName: report.name,
    syncedAt: new Date(syncedAtMs).toISOString(),
    fields: report.fields,
    entries,
  }, null, 2);
}

export function syncFilename(reportName: string): string {
  const safe = reportName.trim().replace(/[^\wа-яё -]/gi, '_') || 'otchet';
  return `${safe}-sync.json`;
}

export function plural(n: number, forms: [string, string, string]): string {
  const n10 = n % 10;
  const n100 = n % 100;
  if (n10 === 1 && n100 !== 11) return forms[0];
  if (n10 >= 2 && n10 <= 4 && (n100 < 12 || n100 > 14)) return forms[1];
  return forms[2];
}
