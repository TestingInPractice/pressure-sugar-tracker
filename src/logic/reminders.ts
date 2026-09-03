import type { Reminder, ReminderState } from '../types';

export interface DueInput {
  masterOn: boolean;
  reminder?: Reminder;
  state?: ReminderState;
  latestEntryAt?: number;
}

const pad2 = (n: number) => String(n).padStart(2, '0');
const pad4 = (n: number) => String(n).padStart(4, '0');

function localYmd(now: number): string {
  const d = new Date(now);
  return `${pad4(d.getFullYear())}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

/** Локальный timestamp сегодня в HH:MM. */
function todayTimeToMs(time: string, now: number): number {
  const d = new Date(now);
  const [hh = '0', mm = '0'] = time.split(':');
  d.setHours(Number(hh), Number(mm), 0, 0);
  return d.getTime();
}

/** Нормализует Reminder: переносит старый datetime (ISO) в times. */
export function normalizeReminder(reminder: Reminder | undefined): Reminder | undefined {
  if (!reminder) return undefined;
  if (Array.isArray(reminder.times)) return reminder;
  const legacy = reminder as Reminder & { datetime?: string };
  if (!legacy.datetime) return undefined;
  const d = new Date(legacy.datetime);
  if (Number.isNaN(d.getTime())) return undefined;
  return {
    enabled: reminder.enabled,
    times: [`${pad2(d.getHours())}:${pad2(d.getMinutes())}`],
  };
}

function earliestDueTime(rem: Reminder, done: string[], now: number): string | undefined {
  const candidates = rem.times
    .filter(time => !done.includes(time) && todayTimeToMs(time, now) <= now)
    .sort();
  return candidates[0];
}

/** true — пора показать уведомление для одного из времён дня. Одно срабатывание на время в день. */
export function computeDue(input: DueInput, now: number): boolean {
  const { masterOn, reminder, state, latestEntryAt } = input;
  const rem = normalizeReminder(reminder);
  if (!masterOn || !rem || !rem.enabled || rem.times.length === 0) return false;
  const day = localYmd(now);
  const done = state && state.day === day ? state.doneTimes : [];
  const t = earliestDueTime(rem, done, now);
  if (t === undefined) return false;
  if (state && state.day === day && latestEntryAt !== undefined) {
    return latestEntryAt < todayTimeToMs(t, now);
  }
  return true;
}

/** Отмечает самое раннее наступившее неотработанное время дня как обработанное. */
export function onFired(reminder: Reminder, state: ReminderState | undefined, now: number): ReminderState {
  const rem = normalizeReminder(reminder);
  const day = localYmd(now);
  const done = state && state.day === day ? [...state.doneTimes] : [];
  const t = earliestDueTime(rem ?? { enabled: true, times: [] }, done, now);
  if (t !== undefined) done.push(t);
  return { day, doneTimes: done };
}

/** Сбрасывает отработанные времена для нового дня (вызывается при записи входа). */
export function onEntryRecorded(now: number): ReminderState {
  return { day: localYmd(now), doneTimes: [] };
}

export function onReconfigured(): ReminderState {
  return { day: '', doneTimes: [] };
}

/** Offset-aware ISO → значение для <input type="datetime-local"> в ЛОКАЛЬНЫХ компонентах. */
export function toLocalInputValue(iso: string | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return (
    `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}` +
    `T${pad2(d.getHours())}:${pad2(d.getMinutes())}`
  );
}

/** Текущие локальные дата и время для <input type="datetime-local">: YYYY-MM-DDTHH:mm */
export function nowLocalInput(now: number = Date.now()): string {
  const d = new Date(now);
  return (
    `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}` +
    `T${pad2(d.getHours())}:${pad2(d.getMinutes())}`
  );
}
