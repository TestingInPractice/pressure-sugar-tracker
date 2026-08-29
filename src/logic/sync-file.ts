import type { Report, Entry } from '../types';
import { buildSyncJson, syncFilename } from './sync';

export async function saveSyncFile(
  report: Pick<Report, 'id' | 'name' | 'fields'>,
  entries: Entry[],
  syncedAtMs: number,
): Promise<void> {
  const json = buildSyncJson(report, entries, syncedAtMs);
  const name = syncFilename(report.name);
  const file = new File([json], name, { type: 'application/json' });

  if (typeof navigator.share === 'function' && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file] });
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return;
      throw e;
    }
    return;
  }

  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}