import { useEffect, useState, useRef } from 'react';
import type { Report, Entry } from '../types';
import { getReport, listEntries, putEntry, deleteEntry, putReport, deleteReport } from '../db/db';
import { genId } from '../logic/report-config';
import { datetimeFieldId, filterByRange } from '../logic/print-filter';
import { numberingFieldId, nextEntryNumber } from '../logic/entry-number';
import { onEntryRecorded, nowLocalInput } from '../logic/reminders';
import { classifySync, plural, syncFilename } from '../logic/sync';
import { getSyncState, putSyncState, getSyncFileHandle } from '../db/db';
import { saveSyncFile } from '../logic/sync-file';
import { syncAfterEntry } from '../logic/entry-sync';
import { useSettings } from '../hooks/useSettings';
import EntriesTable from './EntriesTable';
import EntryForm from './EntryForm';
import ReminderPanel from './ReminderPanel';
import TrendChart, { metricAvailable, buildMetricSeries, buildMetricTargets } from './TrendChart';
import type { MetricId } from './TrendChart';

interface Props { reportId: string; onBack: () => void; autoOpenEntry?: boolean; onEntryFormOpened?: () => void }

const TARGET_LABELS = { sys: 'Верхнее (ВД)', dia: 'Нижнее (НД)', pulse: 'Пульс', sugar: 'Сахар' } as const;
type TargetKey = keyof typeof TARGET_LABELS;
const IOS_AUTO_SYNC_HINT = 'На iPhone автосинхронизация недоступна — обновите файл кнопкой «Синхронизация»';

export default function ReportScreen({ reportId, onBack, autoOpenEntry, onEntryFormOpened }: Props) {
  const [report, setReport] = useState<Report | null>(null);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingEntry, setEditingEntry] = useState<Entry | null>(null);
  const [showReminder, setShowReminder] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [nameDraft, setNameDraft] = useState('');
  const [showRange, setShowRange] = useState(false);
  const [range, setRange] = useState<{ from: string; to: string } | null>(null);
  const [printCharts, setPrintCharts] = useState({ bp: true, pulse: true, sugar: true, norms: true });
  const [syncMsg, setSyncMsg] = useState('');
  const [pdfMsg, setPdfMsg] = useState('');
  const [autoSyncHint, setAutoSyncHint] = useState('');
  const [syncInfo, setSyncInfo] = useState<{ fileName: string; syncedAt: number; count: number } | null>(null);
  const [targetsDraft, setTargetsDraft] = useState<Record<TargetKey, string> | null>(null);
  const { settings, setMasterOn } = useSettings();
  const autoSyncReady = useRef(false);
  const menuRef = useRef<HTMLDetailsElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const closeMenu = () => menuRef.current?.removeAttribute('open');

  // Полный путь браузер не отдаёт (приватность File System Access),
  // поэтому показываем имя файла + дату и число записей из sync-state.
  const refreshSyncInfo = async (rep: Report) => {
    const synced = await getSyncState(rep.id);
    if (!synced) { setSyncInfo(null); return; }
    let fileName = syncFilename(synced.reportName);
    try {
      const handle = await getSyncFileHandle(rep.id);
      if (handle) fileName = (await handle.getFile()).name;
    } catch { /* нет доступа — показываем ожидаемое имя */ }
    setSyncInfo({ fileName, syncedAt: synced.syncedAt, count: synced.entries.length });
  };

  useEffect(() => {
    void getReport(reportId).then(r => {
      setReport(r ?? null);
      if (r) void refreshSyncInfo(r);
    });
    void listEntries(reportId).then(setEntries);
  }, [reportId]);

  useEffect(() => {
    if (autoOpenEntry && report) {
      setShowForm(true);
      onEntryFormOpened?.();
    }
  }, [autoOpenEntry, report, onEntryFormOpened]);

  useEffect(() => {
    if (!settings?.syncOn || !report) return;
    if (!autoSyncReady.current) { autoSyncReady.current = true; return; }
    const t = setTimeout(async () => {
      const res = await syncAfterEntry(report, entries, { allowFirstSave: false });
      if (res === 'ios-manual') {
        setAutoSyncHint(IOS_AUTO_SYNC_HINT);
        return;
      }
      setAutoSyncHint('');
    }, 500);
    return () => clearTimeout(t);
  }, [entries, report, settings?.syncOn]);

  if (!report) return <p>Не найден</p>;

  const dtFieldId = datetimeFieldId(report.fields);
  const numId = numberingFieldId(report.fields);
  const visibleEntries = filterByRange(entries, dtFieldId, range);

  const PRINT_METRICS: { id: MetricId; label: string }[] = [
    { id: 'bp', label: 'График: давление' },
    { id: 'pulse', label: 'График: пульс' },
    { id: 'sugar', label: 'График: сахар' },
  ];
  const printSeries = PRINT_METRICS.flatMap(m =>
    printCharts[m.id] && metricAvailable(report.fields, m.id)
      ? [{ metric: m.id, label: m.label, series: buildMetricSeries(visibleEntries, report.fields, m.id) }]
      : [],
  ).filter(g => g.series.some(s => s.points.length > 0));
  const setRangePart = (part: 'from' | 'to', value: string) =>
    setRange(prev => ({ ...(prev ?? { from: '', to: '' }), [part]: value }));

  const saveEntry = async (values: Entry['values']) => {
    const vals = { ...values };
    const nid = numberingFieldId(report.fields);
    if (!editingEntry && nid !== undefined) {
      const cur = vals[nid];
      if (cur === undefined || String(cur).trim() === '') {
        vals[nid] = nextEntryNumber(entries, nid) ?? 1;
      }
    }
    if (!editingEntry && dtFieldId !== undefined) {
      const cur = vals[dtFieldId];
      if (cur === undefined || String(cur).trim() === '') {
        vals[dtFieldId] = nowLocalInput();
      }
    }
    await putEntry({ id: editingEntry?.id ?? genId('ent'), reportId, values: vals,
                     createdAt: editingEntry?.createdAt ?? Date.now() });
    if (report.reminder) {
      await putReport({ ...report, reminderState: onEntryRecorded(Date.now()), updatedAt: Date.now() });
      setReport({ ...report, reminderState: { day: '', doneTimes: [] } });
    }
    setEditingEntry(null); setShowForm(false);
    const updatedEntries = await listEntries(reportId);
    setEntries(updatedEntries);
    if (settings?.syncOn && updatedEntries.length > 0) {
      const res = await syncAfterEntry(report, updatedEntries, { allowFirstSave: true });
      setAutoSyncHint(res === 'ios-manual' ? IOS_AUTO_SYNC_HINT : '');
    }
  };

  const removeEntry = async (e: Entry) => {
    if (!window.confirm('Удалить эту запись?')) return;
    await deleteEntry(e.id);
    setEntries(await listEntries(reportId));
  };

  const saveRename = async () => {
    const name = nameDraft.trim();
    if (!name) return;
    const updated = { ...report, name, updatedAt: Date.now() };
    await putReport(updated);
    setReport(updated);
    setRenaming(false);
  };

  const toggleFieldHidden = async (id: string) => {
    const updated = {
      ...report,
      fields: report.fields.map(f => (f.id === id ? { ...f, hidden: !f.hidden } : f)),
      updatedAt: Date.now(),
    };
    await putReport(updated);
    setReport(updated);
  };

  const openTargets = () => setTargetsDraft({
    sys: report.targets?.sys?.toString() ?? '',
    dia: report.targets?.dia?.toString() ?? '',
    pulse: report.targets?.pulse?.toString() ?? '',
    sugar: report.targets?.sugar?.toString() ?? '',
  });

  const saveTargets = async () => {
    if (!targetsDraft) return;
    const num = (s: string) => {
      const v = Number(s.replace(',', '.'));
      return s.trim() === '' || !Number.isFinite(v) ? undefined : v;
    };
    const updated = {
      ...report,
      targets: { sys: num(targetsDraft.sys), dia: num(targetsDraft.dia), pulse: num(targetsDraft.pulse), sugar: num(targetsDraft.sugar) },
      updatedAt: Date.now(),
    };
    await putReport(updated);
    setReport(updated);
    setTargetsDraft(null);
  };

  const targetsSummary = () => {
    const t = report.targets;
    const parts: string[] = [];
    if (t?.sys !== undefined) parts.push(`ВД ${t.sys}`);
    if (t?.dia !== undefined) parts.push(`НД ${t.dia}`);
    if (t?.pulse !== undefined) parts.push(`П ${t.pulse}`);
    if (t?.sugar !== undefined) parts.push(`сахар ${t.sugar}`);
    return parts.length > 0 ? parts.join(' · ') : 'Нормы не заданы';
  };

  const fmtRuDate = (iso?: string) => {
    if (!iso) return '';
    const [y, m, d] = iso.split('-');
    return d && m && y ? `${d}.${m}.${y}` : iso;
  };

  const exportPdf = async () => {
    setPdfMsg('');
    try {
      const { buildReportPdf } = await import('../logic/pdf-export');
      const rangeLabel = range
        ? `Период: ${fmtRuDate(range.from) || '…'} — ${fmtRuDate(range.to) || '…'}`
        : undefined;
      const norms = targetsSummary();
      const blob = buildReportPdf(report, visibleEntries, {
        rangeLabel,
        normsLabel: norms === 'Нормы не заданы' ? undefined : norms,
      });
      const safeName = report.name.replace(/[\\/:*?"<>|]/g, '_').trim() || 'report';
      const file = new File([blob], `${safeName}.pdf`, { type: 'application/pdf' });
      try {
        await navigator.share({ files: [file], title: report.name });
      } catch {
        window.print();
      }
    } catch (e) {
      setPdfMsg('Не удалось создать PDF');
    }
  };

  const removeReport = async () => {
    if (!window.confirm('Удалить отчёт со всеми записями?')) return;
    await deleteReport(reportId);
    onBack();
  };

  const syncReport = async () => {
    try {
      const currentEntries = await listEntries(reportId);
      const synced = await getSyncState(reportId);
      const outcome = classifySync(currentEntries, synced?.entries);
      if (outcome.kind === 'identical') {
        setSyncMsg('Актуализация не нужна');
        return;
      }
      if (outcome.kind === 'conflict') {
        const ok = window.confirm('В файле синхронизации есть записи, которые были изменены или удалены. Заменить их текущими данными отчёта?');
        if (!ok) {
          setSyncMsg('Файл не изменён');
          return;
        }
      }
      const now = Date.now();
      const saved = await saveSyncFile(report, currentEntries, now);
      if (saved.kind === 'cancelled') {
        setSyncMsg('Сохранение отменено');
        return;
      }
      await putSyncState({
        reportId, reportName: report.name, fields: report.fields,
        entries: currentEntries, syncedAt: now,
      });
      await refreshSyncInfo(report);
      if (saved.kind === 'created') {
        setSyncMsg(!synced
          ? `Создан файл синхронизации (${currentEntries.length} ${plural(currentEntries.length, ['запись', 'записи', 'записей'])})`
          : 'Файл синхронизации создан');
        return;
      }
      if (outcome.kind === 'append-only') {
        setSyncMsg(`Синхронизировано: добавлено ${outcome.added.length} ${plural(outcome.added.length, ['строка', 'строки', 'строк'])} (файл обновлён)`);
      } else {
        setSyncMsg('Файл обновлён');
      }
    } catch {
      setSyncMsg('Не удалось выполнить синхронизацию. Попробуйте ещё раз');
    }
  };

  return (
    <div className="screen">
      <div className="report-nav no-print">
        <button className="btn-back" onClick={onBack}>← Назад</button>
        {renaming ? (
          <form className="rename-row"
                onSubmit={e => { e.preventDefault(); void saveRename(); }}>
            <input aria-label="Название отчёта" value={nameDraft} autoFocus
                   onChange={e => setNameDraft(e.target.value)} />
            <button type="submit" className="primary" disabled={!nameDraft.trim()}>✓</button>
            <button type="button" onClick={() => setRenaming(false)}>✕</button>
          </form>
        ) : (
          <h2 className="report-nav__title">{report.name}</h2>
        )}
        <button className="btn-icon" aria-label="Экспорт PDF" onClick={() => setShowRange(true)}>🖨</button>
        <details ref={menuRef} className="overflow-menu" onToggle={e => setMenuOpen(e.currentTarget.open)}>
          <summary aria-label="Дополнительные действия">⋯</summary>
          {menuOpen && <div className="overflow-menu__backdrop" onClick={closeMenu} />}
          <div className="overflow-menu__popover">
            <button onClick={() => { closeMenu(); void syncReport(); }}>Синхронизация</button>
            <button onClick={() => { closeMenu(); setShowReminder(v => !v); }}>Напоминание</button>
            <button aria-label="Переименовать отчёт"
                    onClick={() => { closeMenu(); setNameDraft(report.name); setRenaming(true); }}>Переименовать</button>
            <button onClick={() => { closeMenu(); void putReport({ ...report, archived: true }).then(onBack); }}>Архивировать</button>
            <button className="btn-danger" onClick={() => { closeMenu(); void removeReport(); }}>Удалить отчёт</button>
            <details className="fields-visibility">
              <summary>Поля отчёта</summary>
              {report.fields.map(f => {
                const locked = f.id === numId || f.id === dtFieldId;
                return (
                  <label key={f.id}>
                    <input type="checkbox" checked={!f.hidden} disabled={locked}
                           onChange={() => void toggleFieldHidden(f.id)} />
                    {f.name}{locked ? ' (всегда)' : ''}
                  </label>
                );
              })}
            </details>
          </div>
        </details>
      </div>
      <>
          <button className="no-print primary report-add"
                  onClick={() => { setEditingEntry(null); setShowForm(true); }}>+ Запись</button>
          <section className="norms-panel no-print" aria-label="Мои нормы">
            {targetsDraft ? (
              <>
                <div className="norms-panel__fields">
                  {(Object.keys(TARGET_LABELS) as TargetKey[]).map(k => (
                    <label key={k}>
                      <span>{TARGET_LABELS[k]}</span>
                      <input inputMode="decimal" aria-label={TARGET_LABELS[k]} value={targetsDraft[k]}
                             onChange={e => setTargetsDraft({ ...targetsDraft, [k]: e.target.value })} />
                    </label>
                  ))}
                </div>
                <div className="btn-row">
                  <button type="button" className="primary" onClick={() => void saveTargets()}>Сохранить</button>
                  <button type="button" onClick={() => setTargetsDraft(null)}>Отмена</button>
                </div>
              </>
            ) : (
              <div className="norms-panel__row">
                <span className="norms-panel__title">Мои нормы</span>
                <span className="norms-panel__values">{targetsSummary()}</span>
                <button type="button" className="btn-icon" aria-label="Изменить" onClick={openTargets}>✎</button>
              </div>
            )}
          </section>
          {syncInfo && (
            <p className="hint no-print">
              Файл: {syncInfo.fileName} · синх. {new Date(syncInfo.syncedAt).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })} · {syncInfo.count} {plural(syncInfo.count, ['запись', 'записи', 'записей'])}
            </p>
          )}
          {syncMsg && <p className="hint no-print">{syncMsg}</p>}
          {pdfMsg && <p className="hint no-print">{pdfMsg}</p>}
          {autoSyncHint && <p className="hint no-print">{autoSyncHint}</p>}
          {showRange && (
            <div className="bottom-sheet-overlay no-print" onClick={() => setShowRange(false)}>
              <div className="bottom-sheet" onClick={e => e.stopPropagation()}>
                <div className="bottom-sheet__grabber" />
                <div className="bottom-sheet__header">
                  <span className="bottom-sheet__title">Экспорт отчёта</span>
                  <button className="btn-icon" onClick={() => setShowRange(false)} aria-label="Закрыть">✕</button>
                </div>
                <div className="range-row">
                  <input type="date" aria-label="С" value={range?.from ?? ''}
                         onChange={e => setRangePart('from', e.target.value)} />
                  <input type="date" aria-label="По" value={range?.to ?? ''}
                         onChange={e => setRangePart('to', e.target.value)} />
                </div>
                {PRINT_METRICS.map(m => (
                  <label key={m.id} className="print-opt">
                    <input type="checkbox" checked={printCharts[m.id]}
                           disabled={!metricAvailable(report.fields, m.id)}
                           onChange={() => setPrintCharts(prev => ({ ...prev, [m.id]: !prev[m.id] }))} />
                    {m.label}
                  </label>
                ))}
                <label className="print-opt">
                  <input type="checkbox" checked={printCharts.norms}
                         onChange={() => setPrintCharts(prev => ({ ...prev, norms: !prev.norms }))} />
                  Норма на графиках
                </label>
                <div className="btn-row">
                  <button type="button" className="primary" onClick={() => { window.print(); }}>Печать</button>
                  <button type="button" className="primary" onClick={() => void exportPdf()}>Сохранить PDF</button>
                  <button type="button" onClick={() => { setRange(null); }}>Сбросить</button>
                  <button type="button" onClick={() => setShowRange(false)}>Закрыть</button>
                </div>
              </div>
            </div>
          )}
          {showReminder && settings && (
            <ReminderPanel
              report={report}
              masterOn={settings.masterOn}
              onChanged={() => { void getReport(reportId).then(r => r && setReport(r)); }}
              onEnableMaster={() => { setMasterOn(true); try { void Notification.requestPermission(); } catch { /* */ } }}
            />
          )}
          {showForm && (
            <div className="bottom-sheet-overlay" onClick={() => { setEditingEntry(null); setShowForm(false); }}>
              <div className="bottom-sheet" onClick={e => e.stopPropagation()}>
                <div className="bottom-sheet__grabber" />
                <div className="bottom-sheet__header">
                  <span className="bottom-sheet__title">{report.name}</span>
                  <button className="btn-icon" onClick={() => { setEditingEntry(null); setShowForm(false); }}
                          aria-label="Закрыть">✕</button>
                </div>
                <EntryForm
                  key={editingEntry?.id ?? 'new'}
                  fields={report.fields}
                  initial={editingEntry?.values ??
                    (numId || dtFieldId
                      ? {
                          ...(numId ? { [numId]: nextEntryNumber(entries, numId) ?? 1 } : {}),
                          ...(dtFieldId ? { [dtFieldId]: nowLocalInput() } : {}),
                        }
                      : undefined)}
                  onSave={v => void saveEntry(v)}
                  onCancel={() => { setEditingEntry(null); setShowForm(false); }}
                />
              </div>
            </div>
          )}
          <h2 className="print-title">{report.name}</h2>
          <EntriesTable
            report={report}
            entries={visibleEntries}
            onEdit={e => { setEditingEntry(e); setShowForm(true); }}
            onDelete={e => void removeEntry(e)}
          />
          {printSeries.length > 0 && (
            <div className="print-charts" aria-hidden="true">
              {printSeries.map(g => (
                <div key={g.metric} className="print-chart">
                  <div className="print-chart__title">{g.label.replace('График: ', '')}</div>
                  <TrendChart
                    series={g.series}
                    targetLines={printCharts.norms ? buildMetricTargets(report.targets, g.metric) : []}
                    height={150} width={520}
                    printMode
                  />
                </div>
              ))}
            </div>
          )}
        </>
    </div>
  );
}
