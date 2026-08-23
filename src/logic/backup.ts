import type { Snapshot } from '../types';

export class BackupError extends Error {}

const SUPPORTED_VERSION = 1;

export function buildExportJson(snapshot: Snapshot): string {
  return JSON.stringify({ version: SUPPORTED_VERSION, exportedAt: new Date().toISOString(), ...snapshot }, null, 2);
}

export function parseImport(text: string): Snapshot {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new BackupError('Файл повреждён или это не JSON');
  }
  if (typeof raw !== 'object' || raw === null) throw new BackupError('Неверный формат файла');
  const obj = raw as Record<string, unknown>;
  if (obj.version !== SUPPORTED_VERSION) {
    throw new BackupError(`Неподдерживаемая версия бэкапа: ${String(obj.version)}. Ожидается ${SUPPORTED_VERSION}.`);
  }
  const { settings, reports, entries } = obj as Partial<Snapshot>;
  if (!settings || !Array.isArray(reports) || !Array.isArray(entries)) {
    throw new BackupError('В файле нет данных отчётов');
  }
  const isValidReport = (r: unknown): boolean =>
    typeof r === 'object' && r !== null &&
    typeof (r as { id?: unknown }).id === 'string' &&
    Array.isArray((r as { fields?: unknown }).fields);
  const isValidEntry = (e: unknown): boolean =>
    typeof e === 'object' && e !== null &&
    typeof (e as { id?: unknown }).id === 'string' &&
    typeof (e as { values?: unknown }).values === 'object' &&
    (e as { values?: unknown }).values !== null;
  if (!reports.every(isValidReport) || !entries.every(isValidEntry)) {
    throw new BackupError('Структура файла не соответствует формату бэкапа');
  }
  return { settings, reports, entries } as Snapshot;
}

export function backupFilename(): string {
  const d = new Date().toISOString().slice(0, 10);
  return `treker-backup-${d}.json`;
}
