import { useEffect, useState, useCallback } from 'react';
import type { Report } from '../types';
import { listReports, putReport } from '../db/db';
import { createDefaultReport } from '../logic/report-config';

interface Props { openReport: (id: string) => void }

export default function ReportsTab({ openReport }: Props) {
  const [reports, setReports] = useState<Report[]>([]);

  const reload = useCallback(async () => setReports(await listReports(false)), []);
  useEffect(() => { void reload(); }, [reload]);

  const add = useCallback(async () => {
    await putReport(createDefaultReport());
    await reload();
  }, [reload]);

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
      <button className="primary" onClick={() => void add()}>+ Добавить отчёт</button>
    </div>
  );
}
