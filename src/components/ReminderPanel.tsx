import { useState } from 'react';
import type { Report } from '../types';
import { putReport } from '../db/db';
import { buildIcs, icsFilename } from '../logic/ics';
import { onReconfigured, toLocalInputValue } from '../logic/reminders';
import { buildShortcutsUrl } from '../logic/shortcuts';

interface Props { report: Report; masterOn: boolean; onChanged: () => void }

export default function ReminderPanel({ report, masterOn, onChanged }: Props) {
  const rem = report.reminder;
  const [dt, setDt] = useState(toLocalInputValue(rem?.datetime));

  const persist = async (enabled: boolean) => {
    if (!dt) return;
    await putReport({
      ...report,
      reminder: { enabled, datetime: new Date(dt).toISOString() },
      reminderState: onReconfigured(),
      updatedAt: Date.now(),
    });
    onChanged();
  };

  const downloadIcs = () => {
    const blob = new Blob(
      [buildIcs(`${report.id}-${rem?.datetime ?? new Date(dt).toISOString()}`, `Внести измерения: ${report.name}`, new Date(dt).toISOString())],
      { type: 'text/calendar' },
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = icsFilename(report.name);
    a.click();
    URL.revokeObjectURL(url);
  };

  const openShortcut = () => {
    const a = document.createElement('a');
    a.href = buildShortcutsUrl(dt);
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  return (
    <section className="reminder-panel no-print">
      {!masterOn && <p className="hint">Рубильник напоминаний выключен — напоминания молчат.</p>}
      <label>
        <input type="checkbox" checked={rem?.enabled ?? false} disabled={!masterOn || !dt}
               onChange={e => void persist(e.target.checked)} />
        Напоминание о заполнении
      </label>
      <input type="datetime-local" value={dt} onChange={e => setDt(e.target.value)} />
      <button onClick={downloadIcs} disabled={!dt || !masterOn}>
        Добавить в Календарь (.ics)
      </button>
      <button onClick={openShortcut} disabled={!dt}>
        ⏰ Поставить будильник в Часах
      </button>
      <details className="shortcut-help no-print">
        <summary>Как создать команду «Будильник» (один раз)</summary>
        <ol>
          <li>Открой «Быстрые команды» → «+» → Новая команда.</li>
          <li>Название: Будильник — точно так.</li>
          <li>Добавь действие «Создать будильник» (раздел Часы).</li>
          <li>В поле времени нажми «Выбрать переменную» → «Входные данные».</li>
          <li>Для ежедневного повтора включи в действии «Повторение» → «Каждый день».</li>
        </ol>
        <p className="hint">
          При нажатии кнопки iOS спросит «Запустить?» — подтверди, и в «Часах» появится
          будильник на выбранное время.
        </p>
      </details>
      <p className="hint">Повтор внутри приложения: до 3 раз каждые 10 минут, пока запись не внесена.</p>
    </section>
  );
}
