import { useState } from 'react';
import type { Field } from '../types';
import { validateEntry } from '../logic/validation';
import { recognizeTextFromImage } from '../logic/ocr';
import { parsePressureText, formatPressureReading } from '../logic/ocr-parse';

type OcrStatus = 'idle' | 'working' | 'done' | 'error';

interface Props {
  fields: Field[];
  initial?: Record<string, string | number>;
  onSave: (values: Record<string, string | number>) => void;
  onCancel: () => void;
}

export default function EntryForm({ fields, initial, onSave, onCancel }: Props) {
  const [values, setValues] = useState<Record<string, string | number>>(initial ?? {});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [ocrStatus, setOcrStatus] = useState<OcrStatus>('idle');
  const [ocrMessage, setOcrMessage] = useState('');

  const bpField = fields.find(f => f.name === 'ВД / НД / П');

  const set = (id: string, v: string) =>
    setValues(prev => ({ ...prev, [id]: v }));

  const handlePhoto = async (file: File | undefined) => {
    if (!file || !bpField || ocrStatus === 'working') return;
    setOcrStatus('working');
    setOcrMessage('');
    try {
      const text = await recognizeTextFromImage(file);
      const reading = parsePressureText(text);
      const formatted = formatPressureReading(reading);
      if (formatted === '') {
        setOcrStatus('error');
        setOcrMessage('Не удалось распознать. Попробуйте другое фото');
        return;
      }
      set(bpField.id, formatted);
      setOcrStatus('done');
      setOcrMessage(`Готово: ${formatted}`);
    } catch {
      setOcrStatus('error');
      setOcrMessage('Распознавание недоступно. Попробуйте ещё раз');
    }
  };

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
          {f.name === 'ВД / НД / П' && (
            <span className="photo-row">
              <label className="photo-btn">
                {ocrStatus === 'working' ? 'Распознаю…' : 'Фото'}
                <input type="file" accept="image/*" aria-label="Фото" hidden
                       onChange={e => { void handlePhoto(e.target.files?.[0]); e.target.value = ''; }} />
              </label>
              {ocrStatus === 'done' && <em className="ok">{ocrMessage}</em>}
              {ocrStatus === 'error' && <em className="error">{ocrMessage}</em>}
            </span>
          )}
          {errors[f.id] && <em className="error">{errors[f.id]}</em>}
        </label>
      ))}
      <button type="submit" className="primary">Сохранить</button>
      <button type="button" onClick={onCancel}>Отмена</button>
    </form>
  );
}
