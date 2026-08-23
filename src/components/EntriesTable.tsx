import type { Report, Entry } from '../types';

interface Props {
  report: Pick<Report, 'fields'>;
  entries: Entry[];
  onEdit: (e: Entry) => void;
  onDelete: (e: Entry) => void;
}

export default function EntriesTable({ report, entries, onEdit, onDelete }: Props) {
  return (
    <table className="entries-table">
      <thead>
        <tr>
          {report.fields.map(f => (
            <th key={f.id} style={{ minWidth: `${f.width}ch`, maxWidth: `${f.width}ch` }}>
              {f.name}{f.unit ? `, ${f.unit}` : ''}
              {f.required ? ' *' : ''}
            </th>
          ))}
          <th />
        </tr>
      </thead>
      <tbody>
        {entries.map(e => (
          <tr key={e.id}>
            {report.fields.map(f => (
              <td key={f.id} style={{ maxWidth: `${f.width}ch` }} className="wrap-cell">
                {String(e.values[f.id] ?? '')}
              </td>
            ))}
            <td>
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
  );
}
