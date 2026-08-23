import { useEffect, useState } from 'react';
import type { Report } from '../types';
import { getReport } from '../db/db';

interface Props { reportId: string; onBack: () => void }

export default function ReportScreen({ reportId, onBack }: Props) {
  const [report, setReport] = useState<Report | null>(null);
  useEffect(() => { void getReport(reportId).then(r => setReport(r ?? null)); }, [reportId]);

  if (!report) return <p>Не найден</p>;
  return (
    <div>
      <button onClick={onBack}>← Назад</button>
      <h2>{report.name}</h2>
      {/* таблица и действия появятся в следующих задачах */}
    </div>
  );
}
