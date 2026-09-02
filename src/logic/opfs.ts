import type { Entry, Field } from '../types';
import { buildSyncJson } from './sync';

const LOCAL_FILE = 'local-backup.json';

/** Перезаписываемый снапшот текущего отчёта в OPFS (тихая локальная копия). */
export interface LocalSnapshot {
  version: 1;
  reportId: string;
  reportName: string;
  fields: Field[];
  entries: Entry[];
  syncedAt: string; // ISO-8601
}

function supportsOpfs(): boolean {
  return typeof navigator !== 'undefined'
    && typeof navigator.storage !== 'undefined'
    && typeof navigator.storage.getDirectory === 'function';
}

async function openFileHandle(create: boolean): Promise<FileSystemFileHandle | undefined> {
  if (!supportsOpfs()) return undefined;
  try {
    const root = await navigator.storage.getDirectory();
    return await root.getFileHandle(LOCAL_FILE, { create });
  } catch {
    return undefined;
  }
}

/** Пишет и перезаписывает локальный снапшот текущего отчёта в OPFS. Тихая операция. */
export async function writeLocalSnapshot(
  report: Pick<{ id: string; name: string; fields: Field[] }, 'id' | 'name' | 'fields'>,
  entries: Entry[],
  syncedAtMs: number,
): Promise<boolean> {
  const handle = await openFileHandle(true);
  if (!handle) return false;
  try {
    const snapshot: LocalSnapshot = {
      version: 1,
      reportId: report.id,
      reportName: report.name,
      fields: report.fields,
      entries,
      syncedAt: new Date(syncedAtMs).toISOString(),
    };
    const writable = await handle.createWritable();
    await writable.write(JSON.stringify(snapshot, null, 2));
    await writable.close();
    return true;
  } catch {
    return false;
  }
}

/** Проверяет формат загруженного снапшота. */
function isLocalSnapshot(raw: unknown): raw is LocalSnapshot {
  if (typeof raw !== 'object' || raw === null) return false;
  const o = raw as Record<string, unknown>;
  return o.version === 1
    && typeof o.reportId === 'string'
    && typeof o.reportName === 'string'
    && Array.isArray(o.fields)
    && Array.isArray(o.entries)
    && typeof o.syncedAt === 'string';
}

/** Читает локальный снапшот текущего отчёта из OPFS, если он существует. */
export async function readLocalSnapshot(): Promise<LocalSnapshot | undefined> {
  const handle = await openFileHandle(false);
  if (!handle) return undefined;
  try {
    const file = await handle.getFile();
    const parsed: unknown = JSON.parse(await file.text());
    return isLocalSnapshot(parsed) ? parsed : undefined;
  } catch {
    return undefined;
  }
}

/** Сериализует текущий отчёт для скачивания (совместимо с форматом синхронизации). */
export function buildLocalJson(report: Pick<{ id: string; name: string; fields: Field[] }, 'id' | 'name' | 'fields'>, entries: Entry[]): string {
  return buildSyncJson(report, entries, Date.now());
}
