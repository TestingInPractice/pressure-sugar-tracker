import { useRef, useState } from 'react';
import { getAllData, replaceEverything, getReport, importReportData } from '../db/db';
import { buildExportJson, parseImport, backupFilename, BackupError } from '../logic/backup';
import { parseReportImport } from '../logic/report-export';
import { CLOUDTIPS_URL } from '../constants';
import BpLabelSwitcher from './BpLabelSwitcher';

interface Props { onDataChanged: () => void }

function readFileText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error('Не удалось прочитать файл'));
    reader.readAsText(file);
  });
}

export default function MoreTab({ onDataChanged }: Props) {
  const [error, setError] = useState('');
  const [reportError, setReportError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const reportFileRef = useRef<HTMLInputElement>(null);

  const exportBackup = async () => {
    const snap = await getAllData();
    const blob = new Blob([buildExportJson(snap)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = backupFilename();
    a.click();
    URL.revokeObjectURL(url);
    localStorage.setItem('last-backup-at', new Date().toISOString());
  };

  const importBackup = async (file: File) => {
    setError('');
    try {
      const text = await readFileText(file);
      const snap = parseImport(text);
      if (!window.confirm('Текущие данные будут заменены данными из файла. Продолжить?')) return;
      await replaceEverything(snap);
      onDataChanged();
    } catch (e) {
      setError(e instanceof BackupError ? e.message : 'Не удалось импортировать файл');
    }
  };

  const importReportFile = async (file: File) => {
    setReportError('');
    try {
      const text = await readFileText(file);
      const { report, entries } = parseReportImport(text);
      const existing = await getReport(report.id);
      const asCopy = Boolean(existing) && !window.confirm(
        `Отчёт «${report.name}» уже есть на этом устройстве. Заменить его данными из файла?\n«Отмена» — добавить копию.`
      );
      await importReportData(report, entries, asCopy);
      onDataChanged();
    } catch (e) {
      setReportError(e instanceof BackupError ? e.message : 'Не удалось импортировать отчёт');
    }
  };

  return (
    <div className="more-tab">
      <button className="primary" onClick={() => void exportBackup()}>Экспорт бэкапа</button>
      <hr />
      <label>
        Импорт бэкапа
        <input type="file" accept="application/json,.json" ref={fileRef}
               onChange={e => { const f = e.target.files?.[0]; if (f) void importBackup(f); }} />
      </label>
      {error && <p className="error">{error}</p>}
      <p className="hint">Храните файл в «Файлах» или iCloud Drive. После переустановки приложения импортируйте его — данные восстановятся.</p>
      <hr />
      <label>
        Импорт отчёта
        <input type="file" accept="application/json,.json" ref={reportFileRef}
               onChange={e => { const f = e.target.files?.[0]; if (f) void importReportFile(f); }} />
      </label>
      {reportError && <p className="error">{reportError}</p>}
      <p className="hint">Один отчёт из другого устройства: выберите файл, и он добавится к текущим данным. Если отчёт уже есть — замените его или добавьте копию.</p>
      <hr />
      <section className="more-tab__labels">
        <p>Обозначения давления в приложении</p>
        <BpLabelSwitcher />
        <p className="hint">Выбранные обозначения применяются в форме записи, таблице, на графиках и в PDF.</p>
      </section>
      <hr />
      <details className="help">
        <summary>Справка</summary>
        <p><strong>САД</strong> — систолическое артериальное давление («верхнее»). Давление в артериях в момент сокращения сердца.</p>
        <p><strong>ДАД</strong> — диастолическое артериальное давление («нижнее»). Давление в артериях в момент расслабления сердца.</p>
        <p><strong>СрАд</strong> — среднее артериальное давление за цикл сокращения. Считается автоматически в колонке «СрАд»: <code>СрАд = (САД + 2 × ДАД) / 3</code>.</p>
        <p className="help-label">Нормы</p>
        <ul>
          <li>САД: меньше 120 — норма, 120–139 — пограничное, 140 и выше — высокое.</li>
          <li>ДАД: меньше 80 — норма, 80–89 — пограничное, 90 и выше — высокое.</li>
          <li>СрАд: меньше 70 — гипотония, 70–110 — нормотония, выше 110 — гипертония.</li>
          <li>Сахар: меньше 5.5 — норма, 5.5–6.9 — пограничное, 7.0 и выше — высокий (ммоль/л).</li>
        </ul>
        <p className="hint">Цвет подсветки в таблице (зелёный / жёлтый / красный) подсказывает, в норме ли показатель. Это справочная информация и не заменяет консультацию врача.</p>
      </details>
      <hr />
      <section className="donate">
        <h2>Поддержать проект</h2>
        <p className="hint">
          Поддержка позволит нам разрабатывать новые приложения и оплачивать
          виртуальные машины для текущих — приложения останутся бесплатными.
        </p>
        <button className="primary" onClick={() => window.open(CLOUDTIPS_URL, '_blank', 'noopener')}>
          ♥️ Поддержать
        </button>
      </section>
    </div>
  );
}
