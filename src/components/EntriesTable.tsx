import type { Report, Entry } from '../types';
import { formatCell } from '../logic/format';

interface Props {
  report: Pick<Report, 'fields'>;
  entries: Entry[];
  onEdit: (e: Entry) => void;
  onDelete: (e: Entry) => void;
}

export default function EntriesTable({ report, entries, onEdit, onDelete }: Props) {
  const total = report.fields.reduce((s, f) => s + Math.max(1, f.width ?? 1), 0);
  return (
    <div className="entries-scroll">
      <table className="entries-table">
      <thead>
        <tr>
          {report.fields.map(f => (
            <th key={f.id} style={{ width: `${(Math.max(1, f.width ?? 1) / total) * 100}%` }}>
              {f.name}{f.unit ? `, ${f.unit}` : ''}
              {f.required ? ' *' : ''}
            </th>
          ))}
          <th className="actions-col" />
        </tr>
      </thead>
      <tbody>
        {entries.map(e => (
          <tr key={e.id}>
            {report.fields.map(f => (
              <td key={f.id} className="wrap-cell">
                {formatCell(f, String(e.values[f.id] ?? ''))}
              </td>
            ))}
            <td className="actions-col">
              <button onClick={() => onEdit(e)}>✎</button>
              <button onClick={() => onDelete(e)}>🗑</button>
            </td>
          </tr>
        ))}
        {entries.length === 0 && (
          <tr><td colSpan={report.fields.length + 1}>Нет записей</td></tr>
        )}
      </tbody>
      </table>
    </div>
  );
}
