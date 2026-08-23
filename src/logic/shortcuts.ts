export const SHORTCUT_NAME = 'Будильник';

/**
 * Ссылка на команду «Быстрых команд», которая создаёт нативный будильник
 * в штатном приложении «Часы». Время берётся из datetime-local значения.
 * Команду пользователь создаёт один раз вручную (рецепт в UI).
 */
export function buildShortcutsUrl(datetimeLocal: string, name = SHORTCUT_NAME): string {
  const time = datetimeLocal.slice(11, 16);
  return `shortcuts://run-shortcut?name=${encodeURIComponent(name)}&input=text&text=${encodeURIComponent(time)}`;
}
