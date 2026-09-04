import { useState } from 'react';
import type { Report, Reminder } from '../types';
import { putReport } from '../db/db';
import { buildIcs, icsFilename } from '../logic/ics';
import { normalizeReminder, onReconfigured } from '../logic/reminders';
import { buildShortcutUrls } from '../logic/shortcuts';
import ShortcutHelp from './ShortcutHelp';

interface Props { report: Report; masterOn: boolean; onChanged: () => void; onEnableMaster?: () => void }

export default function ReminderPanel({ report, masterOn, onChanged, onEnableMaster }: Props) {
  const initial = normalizeReminder(report.reminder);
  const enabled = report.reminder?.enabled ?? false;
  const [times, setTimes] = useState<string[]>(initial && initial.enabled ? initial.times : []);

  const persist = async (enabledNext: boolean, nextTimes: string[]) => {
    const reminder: Reminder = { enabled: enabledNext, times: nextTimes };
    await putReport({
      ...report,
      reminder,
      reminderState: onReconfigured(),
      updatedAt: Date.now(),
    });
    onChanged();
  };

  const validTimes = times.filter(t => /^\d{2}:\d{2}$/.test(t));

  const setTimeAt = (i: number, value: string) => {
    const next = times.map((t, idx) => (idx === i ? value : t));
    setTimes(next);
    if (enabled) void persist(true, next);
  };

  const addTime = () => {
    const next = [...times, '08:00'];
    setTimes(next);
    if (enabled) void persist(true, next);
  };

  const removeTime = (i: number) => {
    const next = times.filter((_, idx) => idx !== i);
    setTimes(next);
    if (enabled) void persist(true, next);
  };

  const openAlarms = () => {
    const urls = buildShortcutUrls(validTimes);
    urls.forEach(url => {
      const a = document.createElement('a');
      a.href = url;
      document.body.appendChild(a);
      a.click();
      a.remove();
    });
  };

  const requestNotificationPermission = async () => {
    if ('Notification' in window && Notification.permission === 'default') {
      try { await Notification.requestPermission(); } catch { /* окружение без Notification API */ }
    }
  };

  const downloadIcs = () => {
    if (validTimes.length === 0) return;
    const day = new Date().toISOString().slice(0, 10);
    const blob = new Blob([buildIcs(`Внести измерения: ${report.name}`, validTimes, day)], { type: 'text/calendar' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = icsFilename(report.name);
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <section className="reminder-panel no-print">
      {!masterOn && (
        <div className="master-gate-warning">
          <p>Рубильник напоминаний выключен — напоминания не будут срабатывать.</p>
          {onEnableMaster && (
            <button type="button" className="primary" onClick={onEnableMaster}>
              Включить напоминания
            </button>
          )}
        </div>
      )}
      <label>
        <input type="checkbox" checked={enabled}
               onChange={e => void persist(e.target.checked, times)} />
        Напоминание о заполнении
      </label>
      {enabled && 'Notification' in window && Notification.permission === 'default' && (
        <p className="hint">
          Разрешите уведомления, чтобы напоминания срабатывали автоматически.
        </p>
      )}
      {enabled && 'Notification' in window && Notification.permission === 'default' && (
        <button type="button" onClick={() => void requestNotificationPermission()}>
          Разрешить уведомления
        </button>
      )}
      <div className="reminder-times">
        {times.map((t, i) => (
          <div className="reminder-time-row" key={i}>
            <input type="time" value={t} onChange={e => setTimeAt(i, e.target.value)} />
            <button type="button" onClick={() => removeTime(i)} aria-label={`Удалить время ${i + 1}`}>
              ✕
            </button>
          </div>
        ))}
        <button type="button" onClick={addTime}>+ Добавить время</button>
      </div>
      <div className="reminder-actions">
        <button onClick={openAlarms} disabled={!enabled || !masterOn || validTimes.length === 0}>
          ⏰ Поставить будильник в Часах ({validTimes.length})
        </button>
        <button onClick={downloadIcs} disabled={!enabled || !masterOn || validTimes.length === 0}>
          Добавить в Календарь (.ics)
        </button>
      </div>
      <ShortcutHelp />
      <p className="hint">
        Будильник ставится на каждое время отдельно. Повтор «каждый день» включается в самой
        команде «Будильник». Если времён несколько — команда запустится несколько раз.
      </p>
    </section>
  );
}
