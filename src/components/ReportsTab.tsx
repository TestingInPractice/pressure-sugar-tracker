import { useEffect, useState, useCallback } from 'react';
import type { Report } from '../types';
import { listReports } from '../db/db';

interface Props { openReport: (id: string) => void; onCreate: () => void }

export default function ReportsTab({ openReport, onCreate }: Props) {
  const [reports, setReports] = useState<Report[]>([]);

  const reload = useCallback(async () => setReports(await listReports(false)), []);
  useEffect(() => { void reload(); }, [reload]);

  return (
    <div className="reports-tab">
      <ul className="report-list">
        {reports.map(r => (
          <li key={r.id}>
            <button onClick={() => openReport(r.id)}>{r.name}</button>
          </li>
        ))}
        {reports.length === 0 && <li className="empty">Пока нет отчётов</li>}
      </ul>
      <button className="primary" onClick={onCreate}>Новый отчёт</button>
    </div>
  );
}
