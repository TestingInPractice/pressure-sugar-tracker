import { useEffect, useState, useRef } from 'react';
import type { Report, Entry } from '../types';
import { getReport, listEntries, putEntry, deleteEntry, putReport, deleteReport } from '../db/db';
import { genId } from '../logic/report-config';
import { datetimeFieldId, filterByRange } from '../logic/print-filter';
import { numberingFieldId, nextEntryNumber } from '../logic/entry-number';
import { onEntryRecorded, nowLocalInput } from '../logic/reminders';
import { classifySync, plural, syncFilename } from '../logic/sync';
import { getSyncState, putSyncState, getSyncFileHandle } from '../db/db';
import { saveSyncFile, autoSyncIfHandle } from '../logic/sync-file';
import { useSettings } from '../hooks/useSettings';
import EntriesTable from './EntriesTable';
import EntryForm from './EntryForm';
import ReminderPanel from './ReminderPanel';

interface Props { reportId: string; onBack: () => void; autoOpenEntry?: boolean; onEntryFormOpened?: () => void }

const TARGET_LABELS = { sys: 'Верхнее (ВД)', dia: 'Нижнее (НД)', pulse: 'Пульс', sugar: 'Сахар (ммоль/л)' } as const;
type TargetKey = keyof typeof TARGET_LABELS;

export default function ReportScreen({ reportId, onBack, autoOpenEntry, onEntryFormOpened }: Props) {
  const [report, setReport] = useState<Report | null>(null);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingEntry, setEditingEntry] = useState<Entry | null>(null);
  const [showReminder, setShowReminder] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [nameDraft, setNameDraft] = useState('');
  const [showRange, setShowRange] = useState(false);
  const [range, setRange] = useState<{ from: string; to: string } | null>(null);
  const [syncMsg, setSyncMsg] = useState('');
  const [autoSyncHint, setAutoSyncHint] = useState('');
  const [syncInfo, setSyncInfo] = useState<{ fileName: string; syncedAt: number; count: number } | null>(null);
  const [targetsDraft, setTargetsDraft] = useState<Record<TargetKey, string> | null>(null);
  const { settings, setMasterOn } = useSettings();
  const autoSyncReady = useRef(false);
  const firstSyncFor = useRef<string | null>(null);

  // Полный путь браузер не отдаёт (приватность File System Access),
  // поэтому показываем имя файла + дату и число записей из sync-state.
  const refreshSyncInfo = async (rep: Report) => {
    const synced = await getSyncState(rep.id);
    if (!synced) { setSyncInfo(null); return; }
    let fileName = syncFilename(synced.reportName);
    try {
      const handle = await getSyncFileHandle(rep.id);
      if (handle) fileName = (await handle.getFile()).name;
    } catch { /* нет доступа — показываем ожидаемое имя */ }
    setSyncInfo({ fileName, syncedAt: synced.syncedAt, count: synced.entries.length });
  };

  useEffect(() => {
    void getReport(reportId).then(r => {
      setReport(r ?? null);
      if (r) void refreshSyncInfo(r);
    });
    void listEntries(reportId).then(setEntries);
  }, [reportId]);

  useEffect(() => {
    if (autoOpenEntry && report) {
      setShowForm(true);
      onEntryFormOpened?.();
    }
  }, [autoOpenEntry, report, onEntryFormOpened]);

  useEffect(() => {
    if (!settings?.syncOn || !report) return;
    if (!autoSyncReady.current) { autoSyncReady.current = true; return; }
    const t = setTimeout(async () => {
      const res = await autoSyncIfHandle(report, entries);
      if (res !== 'no-handle') { setAutoSyncHint(''); return; }
      if (await ensureFirstSave(entries.length > 0)) { setAutoSyncHint(''); return; }
      const synced = await getSyncState(report.id);
      setAutoSyncHint(synced
        ? 'Автосинхронизация файла недоступна — обновите его кнопкой «Синхронизация»'
        : 'Автосинхронизация: сначала выберите файл кнопкой «Синхронизация»');
    }, 500);
    return () => clearTimeout(t);
  }, [entries, report, settings?.syncOn]);

  if (!report) return <p>Не найден</p>;

  const dtFieldId = datetimeFieldId(report.fields);
  const numId = numberingFieldId(report.fields);
  const visibleEntries = filterByRange(entries, dtFieldId, range);
  const setRangePart = (part: 'from' | 'to', value: string) =>
    setRange(prev => ({ ...(prev ?? { from: '', to: '' }), [part]: value }));

  // Первое сохранение файла — как ручная кнопка «Синхронизация».
  // Вызывается один раз на отчёт: дальше обновления идут через сохранённый handle.
  // Из saveEntry идёт с живым жестом (пикник/шеринг разрешены), из эффекта —
  // с фолбэком на скачивание, если браузер заблокировал диалог без жеста.
  const ensureFirstSave = async (hasEntries: boolean): Promise<boolean> => {
    if (!report || !hasEntries || firstSyncFor.current === reportId) return false;
    const [handle, synced] = await Promise.all([getSyncFileHandle(report.id), getSyncState(report.id)]);
    if (handle || synced) return false;
    firstSyncFor.current = reportId;
    await syncReport();
    return true;
  };

  const saveEntry = async (values: Entry['values']) => {
    const vals = { ...values };
    const nid = numberingFieldId(report.fields);
    if (!editingEntry && nid !== undefined) {
      const cur = vals[nid];
      if (cur === undefined || String(cur).trim() === '') {
        vals[nid] = nextEntryNumber(entries, nid) ?? 1;
      }
    }
    if (!editingEntry && dtFieldId !== undefined) {
      const cur = vals[dtFieldId];
      if (cur === undefined || String(cur).trim() === '') {
        vals[dtFieldId] = nowLocalInput();
      }
    }
    await putEntry({ id: editingEntry?.id ?? genId('ent'), reportId, values: vals,
                     createdAt: editingEntry?.createdAt ?? Date.now() });
    if (report.reminder) {
      await putReport({ ...report, reminderState: onEntryRecorded(Date.now()), updatedAt: Date.now() });
      setReport({ ...report, reminderState: { day: '', doneTimes: [] } });
    }
    setEditingEntry(null); setShowForm(false);
    const updatedEntries = await listEntries(reportId);
    setEntries(updatedEntries);
    if (settings?.syncOn) await ensureFirstSave(updatedEntries.length > 0);
  };

  const removeEntry = async (e: Entry) => {
    if (!window.confirm('Удалить эту запись?')) return;
    await deleteEntry(e.id);
    setEntries(await listEntries(reportId));
  };

  const saveRename = async () => {
    const name = nameDraft.trim();
    if (!name) return;
    const updated = { ...report, name, updatedAt: Date.now() };
    await putReport(updated);
    setReport(updated);
    setRenaming(false);
  };

  const toggleFieldHidden = async (id: string) => {
    const updated = {
      ...report,
      fields: report.fields.map(f => (f.id === id ? { ...f, hidden: !f.hidden } : f)),
      updatedAt: Date.now(),
    };
    await putReport(updated);
    setReport(updated);
  };

  const openTargets = () => setTargetsDraft({
    sys: report.targets?.sys?.toString() ?? '',
    dia: report.targets?.dia?.toString() ?? '',
    pulse: report.targets?.pulse?.toString() ?? '',
    sugar: report.targets?.sugar?.toString() ?? '',
  });

  const saveTargets = async () => {
    if (!targetsDraft) return;
    const num = (s: string) => {
      const v = Number(s.replace(',', '.'));
      return s.trim() === '' || !Number.isFinite(v) ? undefined : v;
    };
    const updated = {
      ...report,
      targets: { sys: num(targetsDraft.sys), dia: num(targetsDraft.dia), pulse: num(targetsDraft.pulse), sugar: num(targetsDraft.sugar) },
      updatedAt: Date.now(),
    };
    await putReport(updated);
    setReport(updated);
    setTargetsDraft(null);
  };

  const targetsSummary = () => {
    const t = report.targets;
    const parts: string[] = [];
    if (t?.sys !== undefined) parts.push(`ВД ${t.sys}`);
    if (t?.dia !== undefined) parts.push(`НД ${t.dia}`);
    if (t?.pulse !== undefined) parts.push(`П ${t.pulse}`);
    if (t?.sugar !== undefined) parts.push(`сахар ${t.sugar}`);
    return parts.length > 0 ? `Норма: ${parts.join(' · ')}` : 'Нормы не заданы';
  };

  const removeReport = async () => {
    if (!window.confirm('Удалить отчёт со всеми записями?')) return;
    await deleteReport(reportId);
    onBack();
  };

  const syncReport = async () => {
    try {
      const currentEntries = await listEntries(reportId);
      const synced = await getSyncState(reportId);
      const outcome = classifySync(currentEntries, synced?.entries);
      if (outcome.kind === 'identical') {
        setSyncMsg('Актуализация не нужна');
        return;
      }
      if (outcome.kind === 'conflict') {
        const ok = window.confirm('В файле синхронизации есть записи, которые были изменены или удалены. Заменить их текущими данными отчёта?');
        if (!ok) {
          setSyncMsg('Файл не изменён');
          return;
        }
      }
      const now = Date.now();
      const saved = await saveSyncFile(report, currentEntries, now);
      if (saved.kind === 'cancelled') {
        setSyncMsg('Сохранение отменено');
        return;
      }
      await putSyncState({
        reportId, reportName: report.name, fields: report.fields,
        entries: currentEntries, syncedAt: now,
      });
      await refreshSyncInfo(report);
      if (saved.kind === 'created') {
        setSyncMsg(!synced
          ? `Создан файл синхронизации (${currentEntries.length} ${plural(currentEntries.length, ['запись', 'записи', 'записей'])})`
          : 'Файл синхронизации создан');
        return;
      }
      if (outcome.kind === 'append-only') {
        setSyncMsg(`Синхронизировано: добавлено ${outcome.added.length} ${plural(outcome.added.length, ['строка', 'строки', 'строк'])} (файл обновлён)`);
      } else {
        setSyncMsg('Файл обновлён');
      }
    } catch {
      setSyncMsg('Не удалось выполнить синхронизацию. Попробуйте ещё раз');
    }
  };

  return (
    <div className="screen">
      <button className="no-print btn-back" onClick={onBack}>← Назад</button>
      {renaming ? (
        <form className="rename-row no-print"
              onSubmit={e => { e.preventDefault(); void saveRename(); }}>
          <input aria-label="Название отчёта" value={nameDraft} autoFocus
                 onChange={e => setNameDraft(e.target.value)} />
          <button type="submit" className="primary" disabled={!nameDraft.trim()}>✓</button>
          <button type="button" onClick={() => setRenaming(false)}>✕</button>
        </form>
      ) : (
        <div className="title-row">
          <h2 className="no-print">{report.name}</h2>
          <button className="no-print btn-icon" aria-label="Переименовать отчёт"
                  onClick={() => { setNameDraft(report.name); setRenaming(true); }}>✎</button>
        </div>
      )}
      <>
          <button className="no-print primary"
                  onClick={() => { setEditingEntry(null); setShowForm(true); }}>+ Запись</button>
          <button className="no-print"
                  onClick={() => (dtFieldId ? setShowRange(v => !v) : window.print())}>Печать/PDF</button>
          <details className="no-print overflow-menu">
            <summary aria-label="Дополнительные действия">⋯</summary>
            <div className="overflow-items">
              <button className="no-print" onClick={async () => { await putReport({ ...report, archived: true }); onBack(); }}>Архивировать</button>
              <button className="no-print" onClick={() => setShowReminder(v => !v)}>Напоминание</button>
              <button className="no-print" onClick={() => void syncReport()}>Синхронизация</button>
              <button className="no-print btn-danger" onClick={() => void removeReport()}>Удалить отчёт</button>
            </div>
          </details>
          {syncInfo && (
            <p className="hint no-print">
              Файл: {syncInfo.fileName} · синх. {new Date(syncInfo.syncedAt).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })} · {syncInfo.count} {plural(syncInfo.count, ['запись', 'записи', 'записей'])}
            </p>
          )}
          {syncMsg && <p className="hint no-print">{syncMsg}</p>}
          <details className="no-print fields-visibility">
            <summary>Поля отчёта</summary>
            {report.fields.map(f => {
              const locked = f.id === numId || f.id === dtFieldId;
              return (
                <label key={f.id}>
                  <input type="checkbox" checked={!f.hidden} disabled={locked}
                         onChange={() => void toggleFieldHidden(f.id)} />
                  {f.name}{locked ? ' (всегда)' : ''}
                </label>
              );
            })}
          </details>
          <details className="no-print fields-visibility">
            <summary>Мои нормы</summary>
            {targetsDraft ? (
              <>
                {(Object.keys(TARGET_LABELS) as TargetKey[]).map(k => (
                  <label key={k}>
                    {TARGET_LABELS[k]}
                    <input inputMode="decimal" aria-label={TARGET_LABELS[k]} value={targetsDraft[k]}
                           onChange={e => setTargetsDraft({ ...targetsDraft, [k]: e.target.value })} />
                  </label>
                ))}
                <div className="btn-row">
                  <button type="button" className="primary" onClick={() => void saveTargets()}>Сохранить</button>
                  <button type="button" onClick={() => setTargetsDraft(null)}>Отмена</button>
                </div>
              </>
            ) : (
              <>
                <p className="hint">{targetsSummary()}</p>
                <button type="button" onClick={openTargets}>Изменить</button>
              </>
            )}
          </details>
          {autoSyncHint && <p className="hint no-print">{autoSyncHint}</p>}
          {showRange && (
            <form className="print-range no-print"
                  onSubmit={e => { e.preventDefault(); window.print(); }}>
              <div className="range-row">
                <input type="date" aria-label="С" value={range?.from ?? ''}
                       onChange={e => setRangePart('from', e.target.value)} />
                <input type="date" aria-label="По" value={range?.to ?? ''}
                       onChange={e => setRangePart('to', e.target.value)} />
              </div>
              <div className="btn-row">
                <button type="submit" className="primary">Печать</button>
                <button type="button" onClick={() => setRange(null)}>Сбросить</button>
                <button type="button" onClick={() => setShowRange(false)}>Закрыть</button>
              </div>
            </form>
          )}
          {showReminder && settings && (
            <ReminderPanel
              report={report}
              masterOn={settings.masterOn}
              onChanged={() => { void getReport(reportId).then(r => r && setReport(r)); }}
              onEnableMaster={() => { setMasterOn(true); try { void Notification.requestPermission(); } catch { /* */ } }}
            />
          )}
          {showForm && (
            <EntryForm
              key={editingEntry?.id ?? 'new'}
              fields={report.fields}
              initial={editingEntry?.values ??
                (numId || dtFieldId
                  ? {
                      ...(numId ? { [numId]: nextEntryNumber(entries, numId) ?? 1 } : {}),
                      ...(dtFieldId ? { [dtFieldId]: nowLocalInput() } : {}),
                    }
                  : undefined)}
              onSave={v => void saveEntry(v)}
              onCancel={() => { setEditingEntry(null); setShowForm(false); }}
            />
          )}
          <h2 className="print-title">{report.name}</h2>
          <EntriesTable
            report={report}
            entries={visibleEntries}
            onEdit={e => { setEditingEntry(e); setShowForm(true); }}
            onDelete={e => void removeEntry(e)}
          />
        </>
    </div>
  );
}
