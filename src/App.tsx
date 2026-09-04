import { useEffect, useState } from 'react';
import MasterSwitch from './components/MasterSwitch';
import DashboardTab from './components/DashboardTab';
import ReportsTab from './components/ReportsTab';
import ArchiveTab from './components/ArchiveTab';
import ReportScreen from './components/ReportScreen';
import CreateReportScreen from './components/CreateReportScreen';
import MoreTab from './components/MoreTab';
import { useSettings } from './hooks/useSettings';
import { useReminderEngine } from './hooks/useReminderEngine';
import { listReports, putReport } from './db/db';
import { APP_TITLE } from './constants';
import type { Report } from './types';

type Tab = 'home' | 'reports' | 'archive' | 'more';

function useOffline() {
  const [offline, setOffline] = useState(!navigator.onLine);
  useEffect(() => {
    const on = () => setOffline(false);
    const off = () => setOffline(true);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);
  return offline;
}

export default function App() {
  const { settings, setMasterOn, setSyncOn } = useSettings();
  const [tab, setTab] = useState<Tab>('home');
  const [openReportId, setOpenReportId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [autoOpenEntry, setAutoOpenEntry] = useState(false);
  const [, setDataVersion] = useState(0);
  const masterOn = settings?.masterOn ?? false;
  const syncOn = settings?.syncOn ?? false;
  const { dueItems, dismissDue } = useReminderEngine(masterOn);
  const offline = useOffline();

  useEffect(() => {
    void (async () => {
      const [active, archived] = await Promise.all([listReports(false), listReports(true)]);
      if (active.length === 0 && archived.length === 0) {
        if (window.confirm('База пуста. Импортировать резервную копию?')) setTab('more');
      }
    })();
  }, []);

  const toggleMaster = (on: boolean) => {
    if (on) {
      try { void Notification.requestPermission(); } catch { /* окружение без Notification API */ }
    }
    setMasterOn(on);
  };

  const handleDueNavigate = (reportId: string) => {
    setOpenReportId(reportId);
    setAutoOpenEntry(true);
    dismissDue();
  };

  const goTab = (t: Tab) => {
    setCreating(false);
    setOpenReportId(null);
    setAutoOpenEntry(false);
    setTab(t);
  };

  return (
    <div className="app">
      <header className="app-header">
        <h1>{APP_TITLE}</h1>
        {offline && <span className="offline-pill no-print" role="status">Офлайн</span>}
        {settings && (
          <div className="app-switches">
            <MasterSwitch on={masterOn} onToggle={toggleMaster} />
            <MasterSwitch label="Синхронизация" on={syncOn} onToggle={setSyncOn} />
          </div>
        )}
      </header>
      {dueItems.length > 0 && (
        <div className="due-banner no-print" role="alert">
          <div className="due-banner__text">
            <span>Пора внести: {dueItems.map(d => d.title).join(', ')}</span>
          </div>
          <div className="due-banner__actions">
            {dueItems.map(d => (
              <button key={d.reportId} className="due-banner__enter"
                      onClick={() => handleDueNavigate(d.reportId)}>
                Внести: {d.title}
              </button>
            ))}
            <button onClick={dismissDue}>Скрыть</button>
          </div>
        </div>
      )}
      <main>
        {creating ? (
          <CreateReportScreen
            onCreate={async (r: Report) => { await putReport(r); setCreating(false); setOpenReportId(r.id); }}
            onCancel={() => setCreating(false)}
          />
        ) : openReportId !== null ? (
          <ReportScreen reportId={openReportId} onBack={() => setOpenReportId(null)}
                        autoOpenEntry={autoOpenEntry} onEntryFormOpened={() => setAutoOpenEntry(false)} />
        ) : (
          <>
            {tab === 'home' && <DashboardTab onCreate={() => setCreating(true)}
                                              onGoMore={() => setTab('more')} />}
            {tab === 'reports' && <ReportsTab openReport={setOpenReportId} onCreate={() => setCreating(true)} />}
            {tab === 'archive' && <ArchiveTab openReport={setOpenReportId} />}
            {tab === 'more' && <MoreTab onDataChanged={() => setDataVersion(v => v + 1)} />}
          </>
        )}
      </main>
      <nav className="tabbar">
        <button onClick={() => goTab('home')} aria-current={tab === 'home'}>Главная</button>
        <button onClick={() => goTab('reports')} aria-current={tab === 'reports'}>Отчёты</button>
        <button onClick={() => goTab('archive')} aria-current={tab === 'archive'}>Архив</button>
        <button onClick={() => goTab('more')} aria-current={tab === 'more'}>Ещё</button>
      </nav>
    </div>
  );
}
