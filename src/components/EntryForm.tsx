import { useState } from 'react';
import type { Field } from '../types';
import { validateEntry } from '../logic/validation';

interface Props {
  fields: Field[];
  initial?: Record<string, string | number>;
  onSave: (values: Record<string, string | number>) => void;
  onCancel: () => void;
}

export default function EntryForm({ fields, initial, onSave, onCancel }: Props) {
  const [values, setValues] = useState<Record<string, string | number>>(initial ?? {});
  const [errors, setErrors] = useState<Record<string, string>>({});

  const set = (id: string, v: string) =>
    setValues(prev => ({ ...prev, [id]: v }));

  const submit = () => {
    const errs = validateEntry(fields, values);
    setErrors(errs);
    if (Object.keys(errs).length === 0) onSave(values);
  };

  return (
    <form className="no-print" onSubmit={e => { e.preventDefault(); submit(); }}>
      {fields.map(f => (
        <label key={f.id}>
          {f.name}{f.unit ? `, ${f.unit}` : ''}{f.required ? ' *' : ''}
          {f.type === 'datetime' ? (
            <input type="datetime-local" value={String(values[f.id] ?? '')}
                   onChange={e => set(f.id, e.target.value)} />
          ) : f.type === 'number' ? (
            <input inputMode="decimal" value={String(values[f.id] ?? '')}
                   onChange={e => set(f.id, e.target.value)} />
          ) : f.unit ? (
            <input type="text" placeholder={f.name === 'ВД / НД / П' ? '120/70/100' : ''}
                   value={String(values[f.id] ?? '')}
                   onChange={e => set(f.id, e.target.value)} />
          ) : (
            <textarea value={String(values[f.id] ?? '')}
                      onChange={e => set(f.id, e.target.value)} />
          )}
          {errors[f.id] && <em className="error">{errors[f.id]}</em>}
        </label>
      ))}
      <button type="submit" className="primary">Сохранить</button>
      <button type="button" onClick={onCancel}>Отмена</button>
    </form>
  );
}
