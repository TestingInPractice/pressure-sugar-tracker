import { useState } from 'react';
import type { Report } from '../types';
import { createDefaultReport } from '../logic/report-config';

interface Props {
  onCreate: (r: Report) => void;
  onCancel: () => void;
}

export default function CreateReportScreen({ onCreate, onCancel }: Props) {
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
      <p className="hint no-print">
        Поля стандартные: номер, дата и время, давление, сахар, примечание.
        Ненужные можно скрыть внутри отчёта.
      </p>
      <button type="button" className="no-print primary create-btn"
              onClick={() => onCreate(createDefaultReport(name.trim() || 'Новый отчёт'))}>
        Создать отчёт
      </button>
    </div>
  );
}
