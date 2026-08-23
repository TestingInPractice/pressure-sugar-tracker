import type { Reminder, ReminderState } from '../types';
import { MAX_REPEATS, REPEAT_INTERVAL_MIN } from '../constants';

const INTERVAL_MS = REPEAT_INTERVAL_MIN * 60_000;

export interface DueInput {
  masterOn: boolean;
  reminder?: Reminder;
  state?: ReminderState;
  latestEntryAt?: number;
}

/** true — пора показать внутреннее уведомление. */
export function computeDue(input: DueInput, now: number): boolean {
  const { masterOn, reminder, state, latestEntryAt } = input;
  if (!masterOn || !reminder || !reminder.enabled) return false;
  const scheduledAt = Date.parse(reminder.datetime);
  if (Number.isNaN(scheduledAt) || now < scheduledAt) return false;
  if (latestEntryAt !== undefined && latestEntryAt > scheduledAt) return false;
  if (!state) return true; // первое срабатывание
  if (state.repeatsDone >= MAX_REPEATS) return false;
  if (state.lastNotifiedAt !== undefined && now - state.lastNotifiedAt < INTERVAL_MS) return false;
  return true;
}

export function onFired(state: ReminderState | undefined, now: number): ReminderState {
  return { repeatsDone: (state?.repeatsDone ?? 0) + 1, lastNotifiedAt: now };
}

export function onEntryRecorded(): ReminderState {
  return { repeatsDone: 0 };
}

export function onReconfigured(): ReminderState {
  return { repeatsDone: 0 };
}
