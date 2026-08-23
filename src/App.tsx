import { useEffect, useState } from 'react';
import MasterSwitch from './components/MasterSwitch';
import ReportsTab from './components/ReportsTab';
import ArchiveTab from './components/ArchiveTab';
import ReportScreen from './components/ReportScreen';
import MoreTab from './components/MoreTab';
import { useSettings } from './hooks/useSettings';
import { useReminderEngine } from './hooks/useReminderEngine';
import { listReports } from './db/db';
import { APP_TITLE } from './constants';

type Tab = 'reports' | 'archive' | 'more';

export default function App() {
  const { settings, setMasterOn } = useSettings();
  const [tab, setTab] = useState<Tab>('reports');
  const [openReportId, setOpenReportId] = useState<string | null>(null);
  const [, setDataVersion] = useState(0);
  const masterOn = settings?.masterOn ?? false;
  const { dueTitles, dismissDue } = useReminderEngine(masterOn);

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

  return (
    <div className="app">
      <header className="app-header">
        <h1>{APP_TITLE}</h1>
        {settings && (
          <MasterSwitch on={masterOn} onToggle={toggleMaster} />
        )}
      </header>
      {dueTitles.length > 0 && (
        <div className="due-banner" role="alert">
          <span>Пора внести измерения: {dueTitles.join(', ')}</span>
          <button onClick={dismissDue}>Скрыть</button>
        </div>
      )}
      <main>
        {openReportId !== null ? (
          <ReportScreen reportId={openReportId} onBack={() => setOpenReportId(null)} />
        ) : (
          <>
            {tab === 'reports' && <ReportsTab openReport={setOpenReportId} />}
            {tab === 'archive' && <ArchiveTab openReport={setOpenReportId} />}
            {tab === 'more' && <MoreTab onDataChanged={() => setDataVersion(v => v + 1)} />}
          </>
        )}
      </main>
      {openReportId === null && (
        <nav className="tabbar">
          <button onClick={() => setTab('reports')} aria-current={tab === 'reports'}>Отчёты</button>
          <button onClick={() => setTab('archive')} aria-current={tab === 'archive'}>Архив</button>
          <button onClick={() => setTab('more')} aria-current={tab === 'more'}>Ещё</button>
        </nav>
      )}
    </div>
  );
}
