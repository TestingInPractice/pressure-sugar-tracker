import { useEffect, useState, useCallback } from 'react';
import type { Report, Entry } from '../types';
import { listReports, listEntries, putEntry, putReport } from '../db/db';
import { genId } from '../logic/report-config';
import { datetimeFieldId } from '../logic/print-filter';
import { numberingFieldId, nextEntryNumber } from '../logic/entry-number';
import { nowLocalInput } from '../logic/reminders';
import { onEntryRecorded } from '../logic/reminders';
import TrendChart, {
  buildPressureSeries, buildPulseSeries, buildChartPoints, takeLast,
  findBPField, findSugarField, findPulseField,
} from './TrendChart';
import type { ChartSeries, TargetLine } from './TrendChart';
import EntryForm from './EntryForm';
import InstallHint from './InstallHint';

interface Props {
  onCreate: () => void;
  onGoMore?: () => void;
}

type Metric = 'bp' | 'pulse' | 'sugar';

const METRICS: { id: Metric; label: string }[] = [
  { id: 'bp', label: 'Давление' },
  { id: 'pulse', label: 'Пульс' },
  { id: 'sugar', label: 'Сахар' },
];

export default function DashboardTab({ onCreate, onGoMore }: Props) {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [quickAddReport, setQuickAddReport] = useState<Report | null>(null);
  const [quickAddEntries, setQuickAddEntries] = useState<Entry[]>([]);
  const [undoMsg, setUndoMsg] = useState('');
  const [lastBackup, setLastBackup] = useState<string | null>(null);
  const [chartReportId, setChartReportId] = useState<string | null>(null);
  const [metric, setMetric] = useState<Metric>('bp');
  const [chartEntries, setChartEntries] = useState<Entry[]>([]);
  const [showTargets, setShowTargets] = useState(() => localStorage.getItem('chart-show-targets') !== '0');

  const toggleTargets = () => {
    setShowTargets(prev => {
      localStorage.setItem('chart-show-targets', prev ? '0' : '1');
      return !prev;
    });
  };

  const reload = useCallback(async () => {
    const list = await listReports(false);
    setReports(list);
    setLoading(false);
    setLastBackup(localStorage.getItem('last-backup-at'));
    setChartReportId(prev => {
      if (list.some(r => r.id === prev)) return prev;
      return list.find(r => findBPField(r.fields))?.id ?? list[0]?.id ?? null;
    });
  }, []);

  useEffect(() => { void reload(); }, [reload]);

  useEffect(() => {
    if (!chartReportId) { setChartEntries([]); return; }
    void listEntries(chartReportId).then(setChartEntries);
  }, [chartReportId, reports]);

  const openQuickAdd = async (report: Report) => {
    const entries = await listEntries(report.id);
    setQuickAddReport(report);
    setQuickAddEntries(entries);
  };

  const handleQuickSave = async (values: Entry['values']) => {
    if (!quickAddReport) return;
    const vals = { ...values };
    const dtFieldId = datetimeFieldId(quickAddReport.fields);
    const numId = numberingFieldId(quickAddReport.fields);

    if (numId !== undefined) {
      const cur = vals[numId];
      if (cur === undefined || String(cur).trim() === '') {
        vals[numId] = nextEntryNumber(quickAddEntries, numId) ?? 1;
      }
    }
    if (dtFieldId !== undefined) {
      const cur = vals[dtFieldId];
      if (cur === undefined || String(cur).trim() === '') {
        vals[dtFieldId] = nowLocalInput();
      }
    }

    await putEntry({
      id: genId('ent'),
      reportId: quickAddReport.id,
      values: vals,
      createdAt: Date.now(),
    });
    if (quickAddReport.reminder) {
      await putReport({
        ...quickAddReport,
        reminderState: onEntryRecorded(Date.now()),
        updatedAt: Date.now(),
      });
    }
    setQuickAddReport(null);
    setUndoMsg('Запись сохранена');
    setTimeout(() => setUndoMsg(''), 3000);
    void reload();
  };

  const prefilled = useCallback((): Entry['values'] | undefined => {
    if (!quickAddReport) return undefined;
    const dtFieldId = datetimeFieldId(quickAddReport.fields);
    const numId = numberingFieldId(quickAddReport.fields);
    const last = quickAddEntries[0];
    const initial: Entry['values'] = {};
    if (dtFieldId) initial[dtFieldId] = nowLocalInput();
    if (numId) initial[numId] = nextEntryNumber(quickAddEntries, numId) ?? 1;
    // Prefill last values from most recent entry (except dt/num)
    if (last) {
      for (const f of quickAddReport.fields) {
        if (f.id === dtFieldId || f.id === numId) continue;
        if (last.values[f.id] !== undefined) initial[f.id] = last.values[f.id];
      }
    }
    return initial;
  }, [quickAddReport, quickAddEntries]);

  const chartReport = reports.find(r => r.id === chartReportId) ?? null;
  const chartBp = chartReport ? findBPField(chartReport.fields) : undefined;
  const chartSugar = chartReport ? findSugarField(chartReport.fields) : undefined;
  const chartPulseStandalone = chartReport ? findPulseField(chartReport.fields) : undefined;
  const chartDt = chartReport ? datetimeFieldId(chartReport.fields) : undefined;

  const chartAvailable: Record<Metric, boolean> = {
    bp: !!chartBp,
    pulse: !!(chartBp || chartPulseStandalone),
    sugar: !!chartSugar,
  };

  let chartSeries: ChartSeries[] = [];
  let chartEmptyHint = '';
  if (chartReport && chartEntries.length === 0) {
    chartEmptyHint = 'Нет записей для графика';
  } else if (chartReport && !chartAvailable[metric]) {
    chartEmptyHint = `В отчёте нет данных «${METRICS.find(m => m.id === metric)?.label}»`;
  } else if (chartReport) {
    if (metric === 'bp' && chartBp) {
      const { sys, dia } = buildPressureSeries(chartEntries, chartBp.id, chartDt);
      chartSeries = [
        { id: 'sys', label: 'Верхнее', points: takeLast(sys, 10) },
        { id: 'dia', label: 'Нижнее', points: takeLast(dia, 10), dashed: true, hollow: true },
      ];
    } else if (metric === 'pulse' && (chartBp || chartPulseStandalone)) {
      const pts = chartBp
        ? buildPulseSeries(chartEntries, chartBp.id, chartDt, true)
        : buildPulseSeries(chartEntries, chartPulseStandalone!.id, chartDt, false);
      chartSeries = [{ id: 'pulse', label: 'Пульс', points: takeLast(pts, 10) }];
    } else if (metric === 'sugar' && chartSugar) {
      chartSeries = [{ id: 'sugar', label: 'Сахар', points: takeLast(buildChartPoints(chartEntries, chartSugar.id, chartSugar, chartDt), 10) }];
    }
  }

  const targetLines: TargetLine[] = [];
  if (showTargets && chartReport?.targets) {
    const t = chartReport.targets;
    if (metric === 'bp') {
      if (t.sys !== undefined) targetLines.push({ id: 't-sys', label: 'Норма ВД', value: t.sys, dashed: false });
      if (t.dia !== undefined) targetLines.push({ id: 't-dia', label: 'Норма НД', value: t.dia });
    } else if (metric === 'pulse' && t.pulse !== undefined) {
      targetLines.push({ id: 't-pulse', label: 'Норма пульса', value: t.pulse, dashed: false });
    } else if (metric === 'sugar' && t.sugar !== undefined) {
      targetLines.push({ id: 't-sugar', label: 'Норма сахара', value: t.sugar, dashed: false });
    }
  }

  if (loading) {
    return <div className="dashboard"><p className="hint">Загрузка...</p></div>;
  }

  // Empty state
  if (reports.length === 0) {
    return (
      <div className="dashboard dashboard--empty">
        <InstallHint />
        <div className="empty-state">
          <div className="empty-state__icon" aria-hidden="true">📋</div>
          <h2 className="empty-state__title">Начните отслеживать показатели</h2>
          <p className="empty-state__text">
            Создайте первый отчёт для записи давления и сахара
          </p>
          <button className="primary" onClick={onCreate}>Новый отчёт</button>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard">
      <InstallHint />
      {onGoMore && (
        <div className="backup-row" role="note">
          <span className="backup-row__label">
            Бэкап{lastBackup ? `: ${new Date(lastBackup).toLocaleDateString('ru-RU')}` : ''}
          </span>
          <button type="button" onClick={onGoMore}>Настроить</button>
        </div>
      )}
      {undoMsg && <div className="undo-toast" role="status">{undoMsg}</div>}
      <section className="dash-chart" aria-label="График показателей">
        <div className="dash-chart__controls">
          <select aria-label="Отчёт для графика" value={chartReport?.id ?? ''}
                  onChange={e => setChartReportId(e.target.value)}>
            {reports.map(r => (
              <option key={r.id} value={r.id}>{r.name}</option>
            ))}
          </select>
          <div className="segmented" role="group" aria-label="Показатель">
            {METRICS.map(m => (
              <button key={m.id} type="button" aria-pressed={metric === m.id}
                      disabled={!chartAvailable[m.id]} onClick={() => setMetric(m.id)}>
                {m.label}
              </button>
            ))}
          </div>
          <label className="dash-chart__targets">
            <input type="checkbox" checked={showTargets} onChange={toggleTargets} />
            Норма на графике
          </label>
        </div>
        {chartSeries.length > 0
          ? <TrendChart series={chartSeries} targetLines={targetLines} noBucket height={160} width={340} />
          : <p className="hint">{chartEmptyHint || 'Нет данных для графика'}</p>}
      </section>
      <button
        className="primary dash-quick"
        disabled={!chartReport}
        onClick={() => { if (chartReport) void openQuickAdd(chartReport); }}
        aria-label={chartReport ? `Добавить запись в ${chartReport.name}` : 'Добавить запись'}
      >
        + Запись
      </button>

      {/* Bottom-sheet quick-add form */}
      {quickAddReport && (
        <div className="bottom-sheet-overlay" onClick={() => setQuickAddReport(null)}>
          <div className="bottom-sheet" onClick={e => e.stopPropagation()}>
            <div className="bottom-sheet__grabber" />
            <div className="bottom-sheet__header">
              <span className="bottom-sheet__title">{quickAddReport.name}</span>
              <button className="btn-icon" onClick={() => setQuickAddReport(null)} aria-label="Закрыть">✕</button>
            </div>
            <EntryForm
              key={quickAddReport.id}
              fields={quickAddReport.fields}
              initial={prefilled()}
              onSave={v => void handleQuickSave(v)}
              onCancel={() => setQuickAddReport(null)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
