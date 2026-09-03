import { useState } from 'react';
import type { Field, FieldType, Report } from '../types';
import { MAX_FIELDS, DEFAULT_FIELD_WIDTH } from '../constants';
import { genId, assertFieldsLimit, stripRemovedFieldValues } from '../logic/report-config';
import { onReconfigured } from '../logic/reminders';
import { listEntries, putEntry, putReport } from '../db/db';

interface Props {
  report: Report;
  onSaved: (r: Report) => void;
  saveLabel?: string;
}

export default function FieldsEditor({ report, onSaved, saveLabel = 'Сохранить поля' }: Props) {
  const [fields, setFields] = useState<Field[]>(report.fields);

  const update = (id: string, patch: Partial<Field>) =>
    setFields(prev => prev.map(f => (f.id === id ? { ...f, ...patch } : f)));

  const addField = () =>
    setFields(prev => [
      ...prev,
      { id: genId('fld'), name: '', type: 'number' as FieldType, required: false, width: DEFAULT_FIELD_WIDTH },
    ]);

  const removeField = (id: string) =>
    setFields(prev => prev.filter(f => f.id !== id));

  const save = () => {
    assertFieldsLimit(fields.length);
    const newIds = new Set(fields.map(f => f.id));
    const removedIds = report.fields.map(f => f.id).filter(id => !newIds.has(id));
    const updated: Report = {
      ...report,
      fields,
      updatedAt: Date.now(),
      reminderState: onReconfigured(),
    };
    void (async () => {
      if (removedIds.length > 0) {
        const entries = await listEntries(report.id);
        const cleaned = stripRemovedFieldValues(entries, newIds);
        await Promise.all(cleaned.map(e => putEntry(e)));
      }
      await putReport(updated);
    })();
    onSaved(updated);
  };

  return (
    <div className="fields-editor no-print">
      <h3>Настройка полей</h3>
      {fields.map(f => (
        <fieldset key={f.id}>
          <input
            value={f.name}
            placeholder="Название"
            onChange={e => update(f.id, { name: e.target.value })}
          />
          <select
            value={f.type}
            onChange={e => update(f.id, { type: e.target.value as FieldType })}
          >
            <option value="number">Число</option>
            <option value="text">Текст</option>
            <option value="datetime">Дата и время</option>
          </select>
          <input
            value={f.unit ?? ''}
            placeholder="Размерность"
            onChange={e => update(f.id, { unit: e.target.value || undefined })}
          />
          <label>
            <input
              type="checkbox"
              checked={f.required}
              onChange={e => update(f.id, { required: e.target.checked })}
            />{' '}
            обязательное
          </label>
          <input
            type="number"
            aria-label="Ширина колонки"
            min={1}
            value={f.width ?? DEFAULT_FIELD_WIDTH}
            onChange={e => {
              const w = Number(e.target.value);
              update(f.id, { width: Number.isFinite(w) && w > 0 ? w : DEFAULT_FIELD_WIDTH });
            }}
          />
          <button
            type="button"
            className="btn-danger"
            aria-label="Удалить поле"
            disabled={fields.length === 1}
            onClick={() => removeField(f.id)}
          >
            ✕
          </button>
        </fieldset>
      ))}
      <button type="button" aria-label="+ Поле" disabled={fields.length >= MAX_FIELDS} onClick={addField}>
        + Поле
      </button>
      <button type="button" className="primary" onClick={save}>
        {saveLabel}
      </button>
    </div>
  );
}
