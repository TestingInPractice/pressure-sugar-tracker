import { useEffect, useRef, useState } from 'react';
import type { Field } from '../types';
import { validateEntry } from '../logic/validation';

export interface PhotoResult {
  status: 'idle' | 'done' | 'error';
  message: string;
}

interface Props {
  fields: Field[];
  initial?: Record<string, string | number>;
  onSave: (values: Record<string, string | number>) => void;
  onCancel: () => void;
  photoResult?: PhotoResult;
  /** id поля, значение которого пришло из распознавания фото — подсветить и выделить содержимое */
  draftFieldId?: string;
}

export default function EntryForm({ fields, initial, onSave, onCancel, photoResult, draftFieldId }: Props) {
  const [values, setValues] = useState<Record<string, string | number>>(initial ?? {});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const draftRef = useRef<HTMLInputElement | null>(null);

  const set = (id: string, v: string) =>
    setValues(prev => ({ ...prev, [id]: v }));

  const submit = () => {
    const errs = validateEntry(fields, values);
    setErrors(errs);
    if (Object.keys(errs).length === 0) onSave(values);
  };

  useEffect(() => {
    const el = draftRef.current;
    if (el) {
      el.focus();
      el.select();
    }
  }, []);

  return (
    <form className="no-print" onSubmit={e => { e.preventDefault(); submit(); }}>
      {fields.map(f => (
        <label key={f.id} className={f.id === draftFieldId ? 'draft-field' : undefined}>
          {f.name}{f.unit ? `, ${f.unit}` : ''}{f.required ? ' *' : ''}
          {f.type === 'datetime' ? (
            <input type="datetime-local" value={String(values[f.id] ?? '')}
                   onChange={e => set(f.id, e.target.value)} />
          ) : f.type === 'number' ? (
            <input inputMode="decimal" value={String(values[f.id] ?? '')}
                   onChange={e => set(f.id, e.target.value)} />
          ) : f.unit ? (
            <input type="text" ref={f.id === draftFieldId ? draftRef : undefined}
                   value={String(values[f.id] ?? '')}
                   onChange={e => set(f.id, e.target.value)} />
          ) : (
            <textarea value={String(values[f.id] ?? '')}
                      onChange={e => set(f.id, e.target.value)} />
          )}
          {errors[f.id] && <em className="error">{errors[f.id]}</em>}
        </label>
      ))}
      {photoResult && photoResult.status !== 'idle' && (
        <p className={`hint photo-msg ${photoResult.status === 'done' ? 'photo-msg-done' : 'photo-msg-error'}`}>
          {photoResult.message}
        </p>
      )}
      <button type="submit" className="primary">Сохранить</button>
      <button type="button" onClick={onCancel}>Отмена</button>
    </form>
  );
}
