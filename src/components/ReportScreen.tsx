import { useEffect, useState } from 'react';
import type { Report, Entry } from '../types';
import { getReport, listEntries, putEntry, deleteEntry, putReport, deleteReport } from '../db/db';
import { genId } from '../logic/report-config';
import { onEntryRecorded } from '../logic/reminders';
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
  const { settings } = useSettings();

  useEffect(() => {
    void getReport(reportId).then(r => setReport(r ?? null));
    void listEntries(reportId).then(setEntries);
  }, [reportId]);

  if (!report) return <p>Не найден</p>;

  const saveEntry = async (values: Record<string, string | number>) => {
    await putEntry({ id: editingEntry?.id ?? genId('ent'), reportId, values,
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

  return (
    <div>
      <button className="no-print" onClick={onBack}>← Назад</button>
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
          <button className="no-print" aria-label="Переименовать отчёт"
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
          <button className="no-print" onClick={() => void removeReport()}>Удалить отчёт</button>
          <button className="no-print" onClick={() => setShowReminder(v => !v)}>Напоминание</button>
          <button className="no-print" onClick={() => { setEditingEntry(null); setShowForm(true); }}>+ Запись</button>
          <button className="no-print" onClick={() => window.print()}>Печать/PDF</button>
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
              initial={editingEntry?.values}
              onSave={v => void saveEntry(v)}
              onCancel={() => { setEditingEntry(null); setShowForm(false); }}
            />
          )}
          <h2 className="print-title">{report.name}</h2>
          <EntriesTable
            report={report}
            entries={entries}
            onEdit={e => { setEditingEntry(e); setShowForm(true); }}
            onDelete={e => void removeEntry(e)}
          />
        </>
      )}
    </div>
  );
}
