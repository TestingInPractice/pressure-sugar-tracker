import { useEffect, useState } from 'react';
import type { Report, Entry } from '../types';
import { getReport, listEntries, putEntry, deleteEntry, putReport, deleteReport } from '../db/db';
import { genId } from '../logic/report-config';
import { datetimeFieldId, filterByRange } from '../logic/print-filter';
import { numberingFieldId, nextEntryNumber } from '../logic/entry-number';
import { onEntryRecorded } from '../logic/reminders';
import { classifySync, plural } from '../logic/sync';
import { getSyncState, putSyncState } from '../db/db';
import { saveSyncFile } from '../logic/sync-file';
import { useSettings } from '../hooks/useSettings';
import EntriesTable from './EntriesTable';
import EntryForm from './EntryForm';
import FieldsEditor from './FieldsEditor';
import ReminderPanel from './ReminderPanel';

interface Props { reportId: string; onBack: () => void }

export default function ReportScreen({ reportId, onBack }: Props) {
  const [report, setReport] = useState<Report | null>(null);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingEntry, setEditingEntry] = useState<Entry | null>(null);
  const [showEditor, setShowEditor] = useState(false);
  const [showReminder, setShowReminder] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [nameDraft, setNameDraft] = useState('');
  const [showRange, setShowRange] = useState(false);
  const [range, setRange] = useState<{ from: string; to: string } | null>(null);
  const [syncMsg, setSyncMsg] = useState('');
  const { settings } = useSettings();

  useEffect(() => {
    void getReport(reportId).then(r => setReport(r ?? null));
    void listEntries(reportId).then(setEntries);
  }, [reportId]);

  if (!report) return <p>Не найден</p>;

  const dtFieldId = datetimeFieldId(report.fields);
  const numId = numberingFieldId(report.fields);
  const visibleEntries = filterByRange(entries, dtFieldId, range);
  const setRangePart = (part: 'from' | 'to', value: string) =>
    setRange(prev => ({ ...(prev ?? { from: '', to: '' }), [part]: value }));

  const saveEntry = async (values: Record<string, string | number>) => {
    const vals = { ...values };
    const nid = numberingFieldId(report.fields);
    if (!editingEntry && nid !== undefined) {
      const cur = vals[nid];
      if (cur === undefined || String(cur).trim() === '') {
        vals[nid] = nextEntryNumber(entries, nid) ?? 1;
      }
    }
    await putEntry({ id: editingEntry?.id ?? genId('ent'), reportId, values: vals,
                     createdAt: editingEntry?.createdAt ?? Date.now() });
    if (report.reminder) {
      await putReport({ ...report, reminderState: onEntryRecorded(), updatedAt: Date.now() });
      setReport({ ...report, reminderState: { repeatsDone: 0 } });
    }
    setEditingEntry(null); setShowForm(false);
    setEntries(await listEntries(reportId));
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
      const now = Date.now();
      if (outcome.kind === 'append-only') {
        if (!synced) {
          setSyncMsg(`Синхронизация создана (${currentEntries.length} ${plural(currentEntries.length, ['запись', 'записи', 'записей'])})`);
        } else {
          setSyncMsg(`Синхронизировано: добавлено ${outcome.added.length} ${plural(outcome.added.length, ['строка', 'строки', 'строк'])} (файл обновлён)`);
        }
      } else {
        const ok = window.confirm('В файле синхронизации есть записи, которые были изменены или удалены. Заменить их текущими данными отчёта?');
        if (!ok) {
          setSyncMsg('Файл не изменён');
          return;
        }
        setSyncMsg('Файл обновлён');
      }
      await putSyncState({
        reportId, reportName: report.name, fields: report.fields,
        entries: currentEntries, syncedAt: now,
      });
      await saveSyncFile(report, currentEntries, now);
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
      {showEditor ? (
        <FieldsEditor
          report={report}
          onSaved={r => {
            setReport(r);
            setShowEditor(false);
            void listEntries(reportId).then(setEntries);
          }}
        />
      ) : (
        <>
          <button className="no-print" onClick={() => setShowEditor(true)}>Настроить поля</button>
          <button className="no-print" onClick={async () => { await putReport({ ...report, archived: true }); onBack(); }}>Архивировать</button>
          <button className="no-print btn-danger" onClick={() => void removeReport()}>Удалить отчёт</button>
          <button className="no-print" onClick={() => setShowReminder(v => !v)}>Напоминание</button>
          <button className="no-print" onClick={() => void syncReport()}>Синхронизация</button>
          {syncMsg && <p className="hint no-print">{syncMsg}</p>}
          <button className="no-print primary" onClick={() => { setEditingEntry(null); setShowForm(true); }}>+ Запись</button>
          <button className="no-print"
                  onClick={() => (dtFieldId ? setShowRange(v => !v) : window.print())}>Печать/PDF</button>
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
            />
          )}
          {showForm && (
            <EntryForm
              key={editingEntry?.id ?? 'new'}
              fields={report.fields}
              initial={editingEntry?.values ??
                       (numId ? { [numId]: nextEntryNumber(entries, numId) ?? 1 } : undefined)}
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
      )}
    </div>
  );
}
