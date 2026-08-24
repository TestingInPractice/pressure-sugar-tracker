import { useRef, useState } from 'react';
import { getAllData, replaceEverything } from '../db/db';
import { buildExportJson, parseImport, backupFilename, BackupError } from '../logic/backup';
import ShortcutHelp from './ShortcutHelp';

interface Props { onDataChanged: () => void }

export default function MoreTab({ onDataChanged }: Props) {
  const [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const exportBackup = async () => {
    const snap = await getAllData();
    const blob = new Blob([buildExportJson(snap)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = backupFilename();
    a.click();
    URL.revokeObjectURL(url);
  };

  const importBackup = async (file: File) => {
    setError('');
    try {
      // FileReader вместо file.text(): работает и в браузерах, и в jsdom-тестах.
      const text = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(reader.error ?? new Error('Не удалось прочитать файл'));
        reader.readAsText(file);
      });
      const snap = parseImport(text);
      if (!window.confirm('Текущие данные будут заменены данными из файла. Продолжить?')) return;
      await replaceEverything(snap);
      onDataChanged();
    } catch (e) {
      setError(e instanceof BackupError ? e.message : 'Не удалось импортировать файл');
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
      <section className="alarm-help">
        <h2>Будильник в «Часах»</h2>
        <p className="hint">
          В отчёте откройте «Напоминание», выберите время и нажмите
          «⏰ Поставить будильник в Часах» — телефон зазвонит как от обычного
          будильника, даже если приложение закрыто.
        </p>
        <ShortcutHelp />
      </section>
    </div>
  );
}
