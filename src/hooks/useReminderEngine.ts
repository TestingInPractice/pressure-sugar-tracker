import { useEffect, useState } from 'react';
import { listReports, putReport, latestEntryAt, getSettings } from '../db/db';
import { computeDue, onFired } from '../logic/reminders';

export type NotifyFn = (title: string) => void;

export interface DueItem {
  reportId: string;
  title: string;
}

export async function runEngineTick(
  now: number,
  notify: NotifyFn,
  overrides?: { masterOn?: boolean },
): Promise<DueItem[]> {
  const settings = overrides?.masterOn !== undefined
    ? { masterOn: overrides.masterOn }
    : await getSettings();
  const fired: DueItem[] = [];
  const reports = await listReports(false);
  for (const report of reports) {
    if (!report.reminder) continue;
    const latest = await latestEntryAt(report.id);
    if (!computeDue(
      { masterOn: settings.masterOn, reminder: report.reminder, state: report.reminderState, latestEntryAt: latest },
      now,
    )) continue;
    fired.push({ reportId: report.id, title: report.name });
    notify(report.name);
    await putReport({ ...report, reminderState: onFired(report.reminder, report.reminderState, now) });
  }
  return fired;
}

export function useReminderEngine(enabled: boolean) {
  const [dueItems, setDueItems] = useState<DueItem[]>([]);
  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    const notify: NotifyFn = title => {
      if (!alive) return;
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification(`Внесите измерения: ${title}`);
      }
    };
    const tick = () => void runEngineTick(Date.now(), notify).then(items => {
      if (!alive || items.length === 0) return;
      setDueItems(prev => {
        const existingIds = new Set(prev.map(d => d.reportId));
        const newItems = items.filter(d => !existingIds.has(d.reportId));
        return newItems.length > 0 ? [...prev, ...newItems] : prev;
      });
    }).catch(console.error);
    tick();
    const timer = window.setInterval(tick, 30_000);
    return () => { alive = false; window.clearInterval(timer); };
  }, [enabled]);
  return { dueItems, dismissDue: () => setDueItems([]) };
}
