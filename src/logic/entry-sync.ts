import type { Report, Entry } from '../types';
import { autoSyncIfHandle, hasFsAccess, saveSyncFile } from './sync-file';
import { getSyncFileHandle, getSyncState, putSyncState } from '../db/db';

/**
 * Результат автосинхронизации после добавления записи.
 * - 'written'     — файл тихо обновлён по сохранённому handle (десктоп/iOS с handle).
 * - 'first-saved' — первый файл создан через picker/share (десктоп, живой жест).
 * - 'noop'        — синхронизация не нужна / уже запрошена / записей нет.
 * - 'ios-manual'  — handle нет и браузер не поддерживает File System Access (iPhone):
 *                   автосинк невозможен, файл обновляется только кнопкой «Синхронизация».
 * - 'failed'      — ошибка записи.
 */
export type SyncAfterEntryResult =
  | 'written'
  | 'first-saved'
  | 'noop'
  | 'ios-manual'
  | 'failed';

/** Первый выбор файла предлагается один раз на отчёт за сессию (как было в ReportScreen). */
const firstSyncRequested = new Set<string>();

/**
 * Вызывается ПОСЛЕ добавления записи (settings.syncOn === true).
 *
 * - Есть сохранённый handle → тихая перезапись файла.
 * - Handle нет + File System Access (Chrome/Edge на десктопе) → при allowFirstSave
 *   один раз предложить выбрать файл (нужен живой жест пользователя).
 * - Handle нет + нет FSAccess (iOS Safari) → 'ios-manual': автосинк невозможен.
 */
export async function syncAfterEntry(
  report: Pick<Report, 'id' | 'name' | 'fields'>,
  entries: Entry[],
  opts: { allowFirstSave?: boolean } = {},
): Promise<SyncAfterEntryResult> {
  if (entries.length === 0) return 'noop';

  const handle = await getSyncFileHandle(report.id);
  if (handle) {
    const res = await autoSyncIfHandle(report, entries);
    return res === 'written' ? 'written' : res === 'failed' ? 'failed' : 'noop';
  }

  if (!hasFsAccess()) return 'ios-manual';
  if (!opts.allowFirstSave) return 'noop';
  if (firstSyncRequested.has(report.id)) return 'noop';

  // Файл уже синхронизирован, но handle не сохранён (импорт из бэкапа) — не трогаем молча.
  if (await getSyncState(report.id)) return 'noop';

  firstSyncRequested.add(report.id);
  const now = Date.now();
  let saved: Awaited<ReturnType<typeof saveSyncFile>>;
  try {
    saved = await saveSyncFile(report, entries, now);
  } catch {
    return 'failed';
  }
  if (saved.kind === 'cancelled') return 'noop';
  await putSyncState({
    reportId: report.id,
    reportName: report.name,
    fields: report.fields,
    entries,
    syncedAt: now,
  });
  return 'first-saved';
}