import { useEffect, useState } from 'react';
import type { Report, Entry } from '../types';
import { getReport, listEntries, putEntry, deleteEntry, putReport } from '../db/db';
import { genId } from '../logic/report-config';
import { onEntryRecorded } from '../logic/reminders';
import EntriesTable from './EntriesTable';
import EntryForm from './EntryForm';
import FieldsEditor from './FieldsEditor';

interface Props { reportId: string; onBack: () => void }

export default function ReportScreen({ reportId, onBack }: Props) {
  const [report, setReport] = useState<Report | null>(null);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingEntry, setEditingEntry] = useState<Entry | null>(null);
  const [showEditor, setShowEditor] = useState(false);

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
    await deleteEntry(e.id);
    setEntries(await listEntries(reportId));
  };

  return (
    <div>
      <button onClick={onBack}>← Назад</button>
      <h2>{report.name}</h2>
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
          <button onClick={() => setShowEditor(true)}>Настроить поля</button>
          <button onClick={() => { setEditingEntry(null); setShowForm(true); }}>+ Запись</button>
          {showForm && (
            <EntryForm
              key={editingEntry?.id ?? 'new'}
              fields={report.fields}
              initial={editingEntry?.values}
              onSave={v => void saveEntry(v)}
              onCancel={() => { setEditingEntry(null); setShowForm(false); }}
            />
          )}
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
