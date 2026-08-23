import { useCallback, useEffect, useState } from 'react';
import type { Report } from '../types';
import { listReports, putReport } from '../db/db';

interface Props { openReport: (id: string) => void }

export default function ArchiveTab({ openReport }: Props) {
  const [reports, setReports] = useState<Report[]>([]);
  const reload = useCallback(async () => setReports(await listReports(true)), []);
  useEffect(() => { void reload(); }, [reload]);

  return (
    <ul className="report-list">
      {reports.map(r => (
        <li key={r.id}>
          <button onClick={() => openReport(r.id)}>{r.name}</button>
          <button onClick={async () => { await putReport({ ...r, archived: false }); await reload(); }}>
            Разархивировать
          </button>
        </li>
      ))}
      {reports.length === 0 && <li className="empty">Архив пуст</li>}
    </ul>
  );
}
