import { useState } from 'react';
import type { Field, Entry, BPValues } from '../types';
import { validateEntry } from '../logic/validation';

interface Props {
  fields: Field[];
  initial?: Entry['values'];
  onSave: (values: Entry['values']) => void;
  onCancel: () => void;
}

export default function EntryForm({ fields, initial, onSave, onCancel }: Props) {
  const [values, setValues] = useState<Entry['values']>(initial ?? {});
  const [errors, setErrors] = useState<Record<string, string>>({});

  const set = (id: string, v: string) =>
    setValues(prev => ({ ...prev, [id]: v }));

  const setBP = (id: string, part: string, v: string) =>
    setValues(prev => {
      const cur = (prev[id] ?? {}) as BPValues;
      return { ...prev, [id]: { ...cur, [part]: v } };
    });

  const submit = () => {
    const errs = validateEntry(fields, values);
    setErrors(errs);
    if (Object.keys(errs).length === 0) onSave(values);
  };

  return (
    <form className="no-print" onSubmit={e => { e.preventDefault(); submit(); }}>
      {fields.map(f => {
        if (f.type === 'bp') {
          const bp = (values[f.id] ?? {}) as BPValues;
          const parts = f.parts ?? [];
          return (
            <div key={f.id} className="bp-group">
              <span className="bp-label">
                {f.name}{f.required ? ' *' : ''}
              </span>
              <div className="bp-inputs">
                {parts.map(p => (
                  <label key={p.id} className="bp-part">
                    {p.label}
                    <input inputMode="decimal" value={String(bp[p.id as keyof BPValues] ?? '')}
                           onChange={e => setBP(f.id, p.id, e.target.value)} />
                  </label>
                ))}
              </div>
              {errors[f.id] && <em className="error">{errors[f.id]}</em>}
            </div>
          );
        }
        return (
          <label key={f.id}>
            {f.name}{f.unit ? `, ${f.unit}` : ''}{f.required ? ' *' : ''}
            {f.type === 'datetime' ? (
              <input type="datetime-local" value={String(values[f.id] ?? '')}
                     onChange={e => set(f.id, e.target.value)} />
            ) : f.type === 'number' ? (
              <input inputMode="decimal" value={String(values[f.id] ?? '')}
                     onChange={e => set(f.id, e.target.value)} />
            ) : f.unit ? (
              <input type="text"
                     value={String(values[f.id] ?? '')}
                     onChange={e => set(f.id, e.target.value)} />
            ) : (
              <textarea value={String(values[f.id] ?? '')}
                        onChange={e => set(f.id, e.target.value)} />
            )}
            {errors[f.id] && <em className="error">{errors[f.id]}</em>}
          </label>
        );
      })}
      <button type="submit" className="primary">Сохранить</button>
      <button type="button" onClick={onCancel}>Отмена</button>
    </form>
  );
}
