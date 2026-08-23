import { useEffect, useState } from 'react';
import { listReports, putReport, latestEntryAt, getSettings } from '../db/db';
import { computeDue, onFired } from '../logic/reminders';

export type NotifyFn = (title: string) => void;

export async function runEngineTick(
  now: number,
  notify: NotifyFn,
  overrides?: { masterOn?: boolean },
): Promise<string[]> {
  const settings = overrides?.masterOn !== undefined
    ? { masterOn: overrides.masterOn }
    : await getSettings();
  const fired: string[] = [];
  const reports = await listReports(false);
  for (const report of reports) {
    if (!report.reminder) continue;
    const latest = await latestEntryAt(report.id);
    if (!computeDue(
      { masterOn: settings.masterOn, reminder: report.reminder, state: report.reminderState, latestEntryAt: latest },
      now,
    )) continue;
    fired.push(report.name);
    notify(report.name);
    await putReport({ ...report, reminderState: onFired(report.reminderState, now) });
  }
  return fired;
}

export function useReminderEngine(enabled: boolean) {
  const [dueTitles, setDueTitles] = useState<string[]>([]);
  useEffect(() => {
    if (!enabled) return;
    const notify: NotifyFn = title => {
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification(`Внесите измерения: ${title}`);
      }
      setDueTitles(prev => (prev.includes(title) ? prev : [...prev, title]));
    };
    const tick = () => void runEngineTick(Date.now(), notify).catch(console.error);
    tick();
    const timer = window.setInterval(tick, 30_000);
    return () => window.clearInterval(timer);
  }, [enabled]);
  return { dueTitles, dismissDue: () => setDueTitles([]) };
}
