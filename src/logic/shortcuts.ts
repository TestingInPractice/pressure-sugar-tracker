export const SHORTCUT_NAME = 'Будильник';

/**
 * Ссылка на команду «Быстрых команд», которая создаёт нативный будильник
 * в штатном приложении «Часы». Время — локальная строка "HH:MM".
 * Команду пользователь создаёт один раз вручную (рецепт в UI).
 */
export function buildShortcutUrl(time: string, name = SHORTCUT_NAME): string {
  return `shortcuts://run-shortcut?name=${encodeURIComponent(name)}&input=text&text=${encodeURIComponent(time)}`;
}

/** Ссылки для каждого времени (каждый запуск команды создаёт отдельный будильник). */
export function buildShortcutUrls(times: string[], name = SHORTCUT_NAME): string[] {
  return times.map(time => buildShortcutUrl(time, name));
}
