import { useState } from 'react';
import type { Report } from '../types';
import { createDefaultReport } from '../logic/report-config';
import FieldsEditor from './FieldsEditor';

interface Props {
  onCreate: (r: Report) => void;
  onCancel: () => void;
}

export default function CreateReportScreen({ onCreate, onCancel }: Props) {
  const [draft] = useState(() => createDefaultReport());
  const [name, setName] = useState('Новый отчёт');

  return (
    <div className="screen">
      <button className="no-print btn-back" onClick={onCancel}>← Назад</button>
      <h2 className="no-print">Новый отчёт</h2>
      <label className="no-print">
        Название
        <input aria-label="Название отчёта" value={name} autoFocus
               onChange={e => setName(e.target.value)} />
      </label>
      <FieldsEditor
        report={draft}
        saveLabel="Создать отчёт"
        onSaved={r => onCreate({ ...r, name: name.trim() || 'Новый отчёт' })}
      />
    </div>
  );
}
