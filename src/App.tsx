import { useState } from 'react';
import MasterSwitch from './components/MasterSwitch';
import ReportsTab from './components/ReportsTab';
import ReportScreen from './components/ReportScreen';
import { useSettings } from './hooks/useSettings';
import { APP_TITLE } from './constants';

type Tab = 'reports' | 'archive' | 'more';

export default function App() {
  const { settings, setMasterOn } = useSettings();
  const [tab, setTab] = useState<Tab>('reports');
  const [openReportId, setOpenReportId] = useState<string | null>(null);

  return (
    <div className="app">
      <header className="app-header">
        <h1>{APP_TITLE}</h1>
        {settings && (
          <MasterSwitch on={settings.masterOn} onToggle={setMasterOn} />
        )}
      </header>
      <main>
        {openReportId !== null ? (
          <ReportScreen reportId={openReportId} onBack={() => setOpenReportId(null)} />
        ) : (
          <>
            {tab === 'reports' && <ReportsTab openReport={setOpenReportId} />}
            {tab === 'archive' && <p>Архив (в разработке)</p>}
            {tab === 'more' && <p>Бэкапы (в разработке)</p>}
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
