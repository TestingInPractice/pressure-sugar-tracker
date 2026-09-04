import { useState, useMemo } from 'react';
import type { Field, Entry, BPValues } from '../types';
import { validateEntry } from '../logic/validation';
import { numberingFieldId } from '../logic/entry-number';
import { isBPFieldName } from '../logic/classification';

/**
 * Парсит текстовое значение BP формата «120/80/70» или «120/80»
 * в объект BPValues. Если формат не распознан — возвращает undefined.
 */
export function parseBPLegacyText(text: string): BPValues | undefined {
  const cleaned = text.trim();
  if (!cleaned) return undefined;
  // Match "120/80/70" or "120/80"
  const m = cleaned.match(/^(\d+(?:[.,]\d+)?)\s*\/\s*(\d+(?:[.,]\d+)?)\s*(?:\/\s*(\d+(?:[.,]\d+)?))?$/);
  if (!m) return undefined;
  const sys = Number(m[1].replace(',', '.'));
  const dia = Number(m[2].replace(',', '.'));
  const pulse = m[3] ? Number(m[3].replace(',', '.')) : undefined;
  if (!Number.isFinite(sys) || !Number.isFinite(dia)) return undefined;
  const result: BPValues = { systolic: sys, diastolic: dia };
  if (Number.isFinite(pulse)) result.pulse = pulse;
  return result;
}

interface Props {
  fields: Field[];
  initial?: Entry['values'];
  onSave: (values: Entry['values']) => void;
  onCancel: () => void;
}

export default function EntryForm({ fields, initial, onSave, onCancel }: Props) {
  const [values, setValues] = useState<Entry['values']>(initial ?? {});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const numId = numberingFieldId(fields);

  /** Определяем, является ли поле «текстовым BP» — имя содержит ВД, но тип не 'bp' и нет parts. */
  const legacyBPFields = useMemo(() => {
    const ids = new Set<string>();
    for (const f of fields) {
      if (f.type !== 'bp' && isBPFieldName(f.name) && (!f.parts || f.parts.length === 0)) {
        ids.add(f.id);
      }
    }
    return ids;
  }, [fields]);

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
        if (f.hidden || f.id === numId) return null;

        // BP field (type 'bp' with parts)
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

        // Legacy BP fallback: field name contains ВД but type is not 'bp'
        // Renders as 3 numeric inputs, parses "120/80/70" on save.
        if (legacyBPFields.has(f.id)) {
          const raw = String(values[f.id] ?? '');
          const currentBP: BPValues = typeof values[f.id] === 'object'
            ? (values[f.id] as BPValues)
            : parseBPLegacyText(raw) ?? {};
          return (
            <div key={f.id} className="bp-group">
              <span className="bp-label">
                {f.name}{f.required ? ' *' : ''}
              </span>
              <div className="bp-inputs">
                {(['systolic', 'diastolic', 'pulse'] as const).map(part => (
                  <label key={part} className="bp-part">
                    {part === 'systolic' ? 'ВД' : part === 'diastolic' ? 'НД' : 'П'}
                    <input inputMode="decimal"
                           value={String((currentBP as Record<string, unknown>)[part] ?? '')}
                           onChange={e => setBP(f.id, part, e.target.value)} />
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
