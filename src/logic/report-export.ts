import type { Report, Entry, SyncFileResult } from '../types';
import { BackupError } from './backup';

const SUPPORTED_VERSION = 1;

function isReportLike(r: unknown): boolean {
  return typeof r === 'object' && r !== null &&
    typeof (r as { id?: unknown }).id === 'string' &&
    typeof (r as { name?: unknown }).name === 'string' &&
    Array.isArray((r as { fields?: unknown }).fields);
}

function isEntryLike(e: unknown): boolean {
  return typeof e === 'object' && e !== null &&
    typeof (e as { id?: unknown }).id === 'string' &&
    typeof (e as { reportId?: unknown }).reportId === 'string' &&
    typeof (e as { values?: unknown }).values === 'object' &&
    (e as { values?: unknown }).values !== null;
}

export function buildReportExportJson(report: Report, entries: Entry[]): string {
  return JSON.stringify({
    version: SUPPORTED_VERSION,
    kind: 'report',
    exportedAt: new Date().toISOString(),
    report,
    entries: entries.filter(e => e.reportId === report.id),
  }, null, 2);
}

export function parseReportImport(text: string): { report: Report; entries: Entry[] } {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new BackupError('Файл повреждён или это не JSON');
  }
  if (typeof raw !== 'object' || raw === null) throw new BackupError('Неверный формат файла');
  const obj = raw as Record<string, unknown>;
  if (obj.version !== SUPPORTED_VERSION) {
    throw new BackupError(`Неподдерживаемая версия файла отчёта: ${String(obj.version)}. Ожидается ${SUPPORTED_VERSION}.`);
  }
  if (obj.kind !== 'report') {
    if (Array.isArray(obj.reports)) {
      throw new BackupError('Это полный бэкап — импортируйте его кнопкой «Импорт бэкапа»');
    }
    throw new BackupError('Это не файл отчёта');
  }
  const { report, entries } = obj as Partial<{ report: unknown; entries: unknown }>;
  if (!isReportLike(report)) throw new BackupError('В файле нет данных отчёта');
  if (!Array.isArray(entries) || !entries.every(isEntryLike)) {
    throw new BackupError('Структура файла не соответствует формату отчёта');
  }
  const r = report as Report;
  return { report: r, entries: (entries as Entry[]).filter(e => e.reportId === r.id) };
}

export function reportExportFilename(reportName: string): string {
  const safe = reportName.trim().replace(/[^\wа-яё -]/gi, '_').replace(/\s+/g, '-') || 'report';
  return `${safe}-${new Date().toISOString().slice(0, 10)}.json`;
}

export async function shareReportFile(json: string, name: string, title: string): Promise<SyncFileResult> {
  const file = new File([json], name, { type: 'application/json' });
  if (typeof navigator.share === 'function' && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title });
      return { kind: 'shared' };
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return { kind: 'cancelled' };
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