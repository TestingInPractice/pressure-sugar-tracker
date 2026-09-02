import type { Report, Entry, SyncFileResult } from '../types';
import { buildSyncJson, syncFilename } from './sync';
import { getSyncFileHandle, putSyncFileHandle } from '../db/db';
import { writeLocalSnapshot } from './opfs';

function isAbort(e: unknown): boolean {
  return e instanceof DOMException && e.name === 'AbortError';
}

async function writeHandle(handle: FileSystemFileHandle, json: string): Promise<void> {
  const writable = await handle.createWritable();
  await writable.write(json);
  await writable.close();
}

function hasFsAccess(): boolean {
  return typeof window !== 'undefined'
    && typeof window.showSaveFilePicker === 'function'
    && typeof FileSystemFileHandle !== 'undefined';
}

async function saveViaPicker(
  report: Pick<Report, 'id' | 'name' | 'fields'>,
  json: string,
  name: string,
): Promise<SyncFileResult | undefined> {
  const showPicker = window.showSaveFilePicker;
  if (!showPicker) return undefined;
  const existing = await getSyncFileHandle(report.id);
  if (existing) {
    try {
      if ((await existing.requestPermission({ mode: 'readwrite' })) !== 'granted') {
        return { kind: 'cancelled' };
      }
      await writeHandle(existing, json);
      return { kind: 'updated' };
    } catch (e) {
      if (isAbort(e)) return { kind: 'cancelled' };
    }
  }
  try {
    const handle = await showPicker({
      suggestedName: name,
      types: [{ description: 'Sync JSON', accept: { 'application/json': ['.json'] } }],
    });
    await writeHandle(handle, json);
    await putSyncFileHandle(report.id, handle);
    return { kind: 'created' };
  } catch (e) {
    if (isAbort(e)) return { kind: 'cancelled' };
    return undefined;
  }
}

export async function saveSyncFile(
  report: Pick<Report, 'id' | 'name' | 'fields'>,
  entries: Entry[],
  syncedAtMs: number,
): Promise<SyncFileResult> {
  const json = buildSyncJson(report, entries, syncedAtMs);
  const name = syncFilename(report.name);
  const file = new File([json], name, { type: 'application/json' });

  // Тихая локальная копия в OPFS — не влияет на статус сохранения файла.
  void writeLocalSnapshot(report, entries, syncedAtMs);

  if (hasFsAccess()) {
    const viaPicker = await saveViaPicker(report, json, name);
    if (viaPicker) return viaPicker;
  }

  if (typeof navigator.share === 'function' && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file] });
      return { kind: 'shared' };
    } catch (e) {
      if (isAbort(e)) return { kind: 'cancelled' };
    }
  }

  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
  return { kind: 'created' };
}

