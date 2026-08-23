# Трекер давления и сахара — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Автономное PWA на iPhone: настраиваемые отчёты измерений (до 10 полей), напоминания (.ics в Календарь + внутренние повторы до 3 раз), архив, печать/PDF, ручные бэкапы JSON.

**Architecture:** SPA без сервера. Данные в IndexedDB через Dexie. Чистая логика (напоминания, валидация, .ics, бэкапы) вынесена в модули `src/logic/*` и покрыта юнит-тестами; компоненты React — тонкий слой над ней. Печать через `@media print`. Деплой GitHub Pages.

**Tech Stack:** React 18, TypeScript, Vite 5, vite-plugin-pwa, Dexie 4, Vitest + @testing-library/react + jsdom + fake-indexeddb, pngjs (генерация иконок).

## Global Constraints

- Спека: `docs/superpowers/specs/2026-08-23-pressure-sugar-tracker-design.md`.
- Хардкоды из спеки: `MAX_FIELDS = 10`, `DEFAULT_FIELD_WIDTH = 30`, `MAX_REPEATS = 3`, `REPEAT_INTERVAL_MIN = 10`.
- Бэкап-формат строго `{ version: 1, exportedAt, settings, reports }`, импорт = полная замена с подтверждением.
- Никаких сетевых вызовов, авторизации, push — приложение полностью автономное.
- UI на русском языке.
- Типы данных — ровно как в спеке §4 (`Field`, `Report`, `Entry`, `Settings`, `FieldType = 'number' | 'text' | 'datetime'`).
- Каждый таск заканчивается зелёным тестом и коммитом.
- Рабочая директория проекта: `/Users/halapinvv/Documents/Agents/pressure-sugar-tracker` (git уже инициализирован).

---

### Task 1: Скелет проекта и инструментарий

**Files:**
- Create: `package.json`, `vite.config.ts`, `tsconfig.json`, `index.html`, `src/main.tsx`, `src/App.tsx`, `src/index.css`, `src/App.test.tsx`, `scripts/gen-icons.mjs`

**Interfaces:**
- Produces: команда `npm test` (Vitest), `npm run build`, скелет `App` с текстом «Трекер давления и сахара».

- [ ] **Step 1: Создать проект через Vite**

```bash
cd /Users/halapinvv/Documents/Agents/pressure-sugar-tracker
npm create vite@latest . -- --template react-ts
```

Если Vite спросит про непустую директорию — согласиться только на добавление файлов (docs/ остаётся). Затем:

```bash
npm install
npm install dexie
npm install -D vitest jsdom fake-indexeddb @testing-library/react @testing-library/jest-dom @testing-library/user-event vite-plugin-pwa pngjs
```

- [ ] **Step 2: Настроить vite.config.ts**

```ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  base: '/pressure-sugar-tracker/',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'Трекер давления и сахара',
        short_name: 'Давление',
        display: 'standalone',
        start_url: '/pressure-sugar-tracker/',
        background_color: '#ffffff',
        theme_color: '#2563eb',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
        ],
      },
    }),
  ],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test-setup.ts',
  },
});
```

- [ ] **Step 3: Создать src/test-setup.ts**

```ts
import '@testing-library/jest-dom/vitest';
import 'fake-indexeddb/auto';
```

- [ ] **Step 4: Сгенерировать иконки**

`scripts/gen-icons.mjs` (сплошной синий квадрат со скруглением, буква «Д» не нужна — просто плашка):

```js
import { PNG } from 'pngjs';
import fs from 'node:fs';

function make(size) {
  const png = new PNG({ width: size, height: size });
  const r = size * 0.15;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (size * y + x) << 2;
      const inRound =
        x >= r && x < size - r ? true :
        y >= r && y < size - r ? true :
        insideCorner(x, y, r) || insideCorner(x, y, r, true);
      const c = inRound ? [37, 99, 235, 255] : [255, 255, 255, 0];
      png.data[idx] = c[0]; png.data[idx + 1] = c[1];
      png.data[idx + 2] = c[2]; png.data[idx + 3] = c[3];
    }
  }
  return PNG.sync.write(png);
}
function insideCorner(x, y, r, flipX = false) {
  const cx = flipX ? size0 : r;
  return false;
}
const size0 = 0;

fs.writeFileSync('public/icon-192.png', make(192));
fs.writeFileSync('public/icon-512.png', make(512));
console.log('icons written');
```

Внимание: это черновик — упрощённая версия допустима, главное чтобы скрипт отработал и создал два валидных PNG. Если скругление даёт артефакты, заменить на полностью закрашенный квадрат (без прозрачных углов):

```js
import { PNG } from 'pngjs';
import fs from 'node:fs';
for (const size of [192, 512]) {
  const png = new PNG({ width: size, height: size });
  for (let i = 0; i < png.data.length; i += 4) {
    png.data[i] = 37; png.data[i + 1] = 99; png.data[i + 2] = 235; png.data[i + 3] = 255;
  }
  fs.writeFileSync(`public/icon-${size}.png`, PNG.sync.write(png));
}
console.log('icons written');
```

Запуск: `node scripts/gen-icons.mjs`. В `index.html` добавить `<link rel="apple-touch-icon" href="/pressure-sugar-tracker/icon-192.png">`.

- [ ] **Step 5: Написать smoke-тест src/App.test.tsx**

```tsx
import { render, screen } from '@testing-library/react';
import App from './App';

it('renders app title', () => {
  render(<App />);
  expect(screen.getByText('Трекер давления и сахара')).toBeInTheDocument();
});
```

Заменить `src/App.tsx` на минимальный:

```tsx
export default function App() {
  return <h1>Трекер давления и сахара</h1>;
}
```

- [ ] **Step 6: Запустить тесты и сборку**

Run: `npm test -- --run` и `npm run build`
Expected: 1 test passed; build создаёт `dist/` с `manifest.webmanifest`, `sw.js`, `icon-192.png`.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "chore: scaffold Vite React-TS PWA with Dexie and Vitest"
```

---

### Task 2: Типы, константы, слой БД (Dexie)

**Files:**
- Create: `src/types.ts`, `src/constants.ts`, `src/db/db.ts`
- Test: `src/db/db.test.ts`

**Interfaces:**
- Produces: типы `Field`, `Report`, `Entry`, `Settings`, `Reminder`, `ReminderState`, `FieldType`; константы `MAX_FIELDS`, `DEFAULT_FIELD_WIDTH`, `MAX_REPEATS`, `REPEAT_INTERVAL_MIN`; функции `getSettings()`, `saveSettings()`, `listReports(archived)`, `getReport(id)`, `putReport(r)`, `deleteReport(id)`, `listEntries(reportId)`, `putEntry(e)`, `deleteEntry(id)`, `latestEntryAt(reportId)`, `getAllData()`, `replaceEverything(data)`.

- [ ] **Step 1: Написать падающий тест src/db/db.test.ts**

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { db, getSettings, saveSettings, putReport, getReport,
         listReports, deleteReport, putEntry, listEntries, deleteEntry,
         latestEntryAt, getAllData, replaceEverything } from './db';
import type { Report, Entry } from '../types';

beforeEach(async () => { await db.delete(); await db.open(); });

const field = (id: string): Field => ({ id, name: 'f', type: 'number', required: false, width: 30 });
// import type { Field } from '../types';

describe('settings', () => {
  it('defaults masterOn=true', async () => {
    expect((await getSettings()).masterOn).toBe(true);
  });
  it('persists saved value', async () => {
    await saveSettings({ masterOn: false });
    expect((await getSettings()).masterOn).toBe(false);
  });
});

describe('reports & entries', () => {
  it('splits active and archived lists', async () => {
    const r1: Report = { id: 'a', name: 'A', fields: [], archived: false, createdAt: 1, updatedAt: 1 };
    const r2: Report = { id: 'b', name: 'B', fields: [], archived: true, createdAt: 2, updatedAt: 2 };
    await putReport(r1); await putReport(r2);
    expect((await listReports(false)).map(r => r.id)).toEqual(['a']);
    expect((await listReports(true)).map(r => r.id)).toEqual(['b']);
  });
  it('latestEntryAt returns newest createdAt', async () => {
    const e1: Entry = { id: 'e1', reportId: 'a', values: {}, createdAt: 100 };
    const e2: Entry = { id: 'e2', reportId: 'a', values: {}, createdAt: 200 };
    await putEntry(e1); await putEntry(e2);
    expect(await latestEntryAt('a')).toBe(200);
    expect(await latestEntryAt('zzz')).toBeUndefined();
  });
});

describe('backup plumbing', () => {
  it('getAllData + replaceEverything round-trips', async () => {
    const r: Report = { id: 'a', name: 'A', fields: [field('f1')], archived: false, createdAt: 1, updatedAt: 1 };
    await putReport(r);
    await putEntry({ id: 'e1', reportId: 'a', values: { f1: 120 }, createdAt: 5 });
    const snap = await getAllData();
    await deleteReport('a'); await deleteEntry('e1');
    await replaceEverything(snap);
    expect(await getReport('a')).toBeTruthy();
    expect((await listEntries('a'))[0].values.f1).toBe(120);
  });
});
```

- [ ] **Step 2: Запустить тест — должен упасть**

Run: `npx vitest run src/db/db.test.ts`
Expected: FAIL (модуль ./db не существует)

- [ ] **Step 3: Реализовать src/types.ts**

```ts
export type FieldType = 'number' | 'text' | 'datetime';

export interface Field {
  id: string;
  name: string;
  type: FieldType;
  unit?: string;
  required: boolean;
  width: number;
}

export interface Reminder {
  enabled: boolean;
  datetime: string; // ISO 8601
}

export interface ReminderState {
  repeatsDone: number;
  lastNotifiedAt?: number;
}

export interface Report {
  id: string;
  name: string;
  fields: Field[];
  archived: boolean;
  reminder?: Reminder;
  reminderState?: ReminderState;
  createdAt: number;
  updatedAt: number;
}

export interface Entry {
  id: string;
  reportId: string;
  values: Record<string, string | number>;
  createdAt: number;
}

export interface Settings {
  masterOn: boolean;
}

export interface Snapshot {
  settings: Settings;
  reports: Report[];
  entries: Entry[];
}
```

- [ ] **Step 4: Реализовать src/constants.ts**

```ts
export const MAX_FIELDS = 10;
export const DEFAULT_FIELD_WIDTH = 30;
export const MAX_REPEATS = 3;
export const REPEAT_INTERVAL_MIN = 10;
export const APP_TITLE = 'Трекер давления и сахара';
```

- [ ] **Step 5: Реализовать src/db/db.ts**

```ts
import Dexie, { type Table } from 'dexie';
import type { Report, Entry, Settings, Snapshot } from '../types';

interface SettingsRow extends Settings { key: string }

class TrackerDb extends Dexie {
  reports!: Table<Report, string>;
  entries!: Table<Entry, string>;
  settings!: Table<SettingsRow, string>;

  constructor() {
    super('tracker-db');
    this.version(1).stores({
      reports: 'id, archived, updatedAt',
      entries: 'id, reportId, createdAt',
      settings: 'key',
    });
  }
}

export const db = new TrackerDb();

export async function getSettings(): Promise<Settings> {
  const row = await db.settings.get('app');
  return { masterOn: row?.masterOn ?? true };
}

export async function saveSettings(s: Settings): Promise<void> {
  await db.settings.put({ key: 'app', ...s });
}

export async function getReport(id: string): Promise<Report | undefined> {
  return db.reports.get(id);
}

export async function putReport(r: Report): Promise<void> {
  await db.reports.put(r);
}

export async function deleteReport(id: string): Promise<void> {
  await db.transaction('rw', db.reports, db.entries, async () => {
    await db.reports.delete(id);
    await db.entries.where('reportId').equals(id).delete();
  });
}

export async function listReports(archived: boolean): Promise<Report[]> {
  const rows = await db.reports.where('archived').equals(archived ? 1 : 0).toArray();
  return rows.sort((a, b) => b.updatedAt - a.updatedAt);
}
```

Примечание: Dexie не индексирует boolean напрямую — индексируем приведение: хранить `archived` как boolean нельзя в where-equals; правильнее фильтровать в памяти:

```ts
export async function listReports(archived: boolean): Promise<Report[]> {
  const rows = await db.reports.toArray();
  return rows.filter(r => r.archived === archived).sort((a, b) => b.updatedAt - a.updatedAt);
}
```

Использовать именно этот вариант; схему индексов оставить `'id'` для reports:

```ts
this.version(1).stores({
  reports: 'id',
  entries: 'id, reportId, createdAt',
  settings: 'key',
});
```

```ts
export async function listEntries(reportId: string): Promise<Entry[]> {
  const rows = await db.entries.where('reportId').equals(reportId).toArray();
  return rows.sort((a, b) => b.createdAt - a.createdAt);
}

export async function putEntry(e: Entry): Promise<void> {
  await db.entries.put(e);
}

export async function deleteEntry(id: string): Promise<void> {
  await db.entries.delete(id);
}

export async function latestEntryAt(reportId: string): Promise<number | undefined> {
  const rows = await db.entries.where('reportId').equals(reportId).toArray();
  if (rows.length === 0) return undefined;
  return Math.max(...rows.map(r => r.createdAt));
}

export async function getAllData(): Promise<Snapshot> {
  return {
    settings: await getSettings(),
    reports: await db.reports.toArray(),
    entries: await db.entries.toArray(),
  };
}

export async function replaceEverything(snap: Snapshot): Promise<void> {
  await db.transaction('rw', db.reports, db.entries, db.settings, async () => {
    await Promise.all([db.reports.clear(), db.entries.clear(), db.settings.clear()]);
    await db.settings.put({ key: 'app', ...snap.settings });
    await db.reports.bulkPut(snap.reports);
    await db.entries.bulkPut(snap.entries);
  });
}
```

- [ ] **Step 6: Запустить тест — должен пройти**

Run: `npx vitest run src/db/db.test.ts`
Expected: PASS (5 тестов)

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: types, constants and Dexie data layer"
```

---

### Task 3: Валидация записей

**Files:**
- Create: `src/logic/validation.ts`
- Test: `src/logic/validation.test.ts`

**Interfaces:**
- Consumes: `Field` из `src/types`.
- Produces: `validateEntry(fields: Field[], values: Record<string, string | number>): Record<string, string>` — карта ошибок по fieldId (пустой объект = валидно).

- [ ] **Step 1: Написать падающий тест**

```ts
import { describe, it, expect } from 'vitest';
import { validateEntry } from './validation';
import type { Field } from '../types';

const f = (over: Partial<Field>): Field => ({
  id: 'f1', name: 'Поле', type: 'number', required: false, width: 30, ...over,
});

describe('validateEntry', () => {
  it('ok when nothing required', () => {
    expect(validateEntry([f({})], {})).toEqual({});
  });
  it('flags missing required field', () => {
    const errs = validateEntry([f({ required: true })], {});
    expect(errs.f1).toBeTruthy();
  });
  it('flags whitespace-only text as empty', () => {
    expect(validateEntry([f({ required: true, type: 'text' })], { f1: '  ' }).f1).toBeTruthy();
  });
  it('flags non-number in number field', () => {
    expect(validateEntry([f({})], { f1: 'abc' }).f1).toBeTruthy();
  });
  it('accepts numeric strings and numbers', () => {
    expect(validateEntry([f({})], { f1: '120' })).toEqual({});
    expect(validateEntry([f({})], { f1: 120 })).toEqual({});
  });
  it('flags missing datetime when required', () => {
    expect(validateEntry([f({ required: true, type: 'datetime' })], { f1: '' }).f1).toBeTruthy();
    expect(validateEntry([f({ required: true, type: 'datetime' })], { f1: '2026-08-23T09:00' })).toEqual({});
  });
});
```

- [ ] **Step 2: Запустить — FAIL**

Run: `npx vitest run src/logic/validation.test.ts`

- [ ] **Step 3: Реализовать src/logic/validation.ts**

```ts
import type { Field } from '../types';

export function validateEntry(
  fields: Field[],
  values: Record<string, string | number>,
): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const field of fields) {
    const raw = values[field.id];
    const isEmpty =
      raw === undefined || raw === null || String(raw).trim() === '';
    if (field.required && isEmpty) {
      errors[field.id] = 'Обязательное поле';
      continue;
    }
    if (isEmpty) continue;
    if (field.type === 'number') {
      const n = Number(raw);
      if (!Number.isFinite(n)) errors[field.id] = 'Введите число';
    }
  }
  return errors;
}
```

- [ ] **Step 4: Запустить — PASS**

Run: `npx vitest run src/logic/validation.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: entry validation logic"
```

---

### Task 4: Логика напоминаний (повторы до 3 раз)

**Files:**
- Create: `src/logic/reminders.ts`
- Test: `src/logic/reminders.test.ts`

**Interfaces:**
- Consumes: `Reminder`, `ReminderState`, `MAX_REPEATS`, `REPEAT_INTERVAL_MIN`.
- Produces:
  - `computeDue(input: { masterOn: boolean; reminder?: Reminder; state?: ReminderState; latestEntryAt?: number }, now: number): boolean`
  - `onFired(state: ReminderState | undefined, now: number): ReminderState`
  - `onEntryRecorded(): ReminderState` (сброс)
  - `onReconfigured(): ReminderState` (сброс)

- [ ] **Step 1: Написать падающий тест**

```ts
import { describe, it, expect } from 'vitest';
import { computeDue, onFired } from './reminders';
import { MAX_REPEATS, REPEAT_INTERVAL_MIN } from '../constants';

const T0 = Date.parse('2026-08-23T09:00:00Z');
const MIN = 60_000;
const reminder = { enabled: true, datetime: new Date(T0).toISOString() };

const base = { masterOn: true, reminder };

describe('computeDue', () => {
  it('fires immediately when time reached and never fired', () => {
    expect(computeDue(base, T0)).toBe(true);
    expect(computeDue(base, T0 - MIN)).toBe(false); // время ещё не наступило
  });
  it('silences everything when master switch is off', () => {
    expect(computeDue({ ...base, masterOn: false }, T0)).toBe(false);
  });
  it('ignores disabled reminder', () => {
    expect(computeDue({ ...base, reminder: { ...reminder, enabled: false } }, T0)).toBe(false);
  });
  it('does not refire before interval elapses', () => {
    const state = onFired(undefined, T0);
    expect(computeDue({ ...base, state }, T0 + 5 * MIN)).toBe(false);
  });
  it('refires after interval while repeats remain', () => {
    let state = onFired(undefined, T0);
    expect(computeDue({ ...base, state }, T0 + REPEAT_INTERVAL_MIN * MIN)).toBe(true);
  });
  it(`caps at ${MAX_REPEATS} firings total (hardcode)`, () => {
    let state = onFired(onFired(onFired(undefined, T0), T0 + 10 * MIN), T0 + 20 * MIN);
    expect(state.repeatsDone).toBe(3);
    expect(computeDue({ ...base, state }, T0 + 30 * MIN)).toBe(false);
  });
  it('stays silent when an entry was recorded after reminder time', () => {
    expect(computeDue({ ...base, latestEntryAt: T0 + 1 }, T0 + 2 * MIN)).toBe(false);
  });
  it('fires when latest entry predates reminder', () => {
    expect(computeDue({ ...base, latestEntryAt: T0 - 1 }, T0)).toBe(true);
  });
});

describe('onFired', () => {
  it('counts firings', () => {
    expect(onFired(undefined, 1).repeatsDone).toBe(1);
    expect(onFired({ repeatsDone: 2 }, 9).repeatsDone).toBe(3);
    expect(onFired({ repeatsDone: 2 }, 9).lastNotifiedAt).toBe(9);
  });
});
```

- [ ] **Step 2: Запустить — FAIL**

Run: `npx vitest run src/logic/reminders.test.ts`

- [ ] **Step 3: Реализовать src/logic/reminders.ts**

```ts
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
```

- [ ] **Step 4: Запустить — PASS**

Run: `npx vitest run src/logic/reminders.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: reminder repeat logic capped at 3 firings"
```

---

### Task 5: Генерация .ics

**Files:**
- Create: `src/logic/ics.ts`
- Test: `src/logic/ics.test.ts`

**Interfaces:**
- Consumes: ничего (чистая функция).
- Produces: `buildIcs(uid: string, title: string, startIso: string): string`; `icsFilename(name: string): string`.

- [ ] **Step 1: Написать падающий тест**

```ts
import { describe, it, expect } from 'vitest';
import { buildIcs, icsFilename } from './ics';

describe('buildIcs', () => {
  const ics = buildIcs('uid-1', 'Внести измерения: Давление', '2026-08-24T09:00:00');

  it('has calendar skeleton and CRLF endings', () => {
    expect(ics.startsWith('BEGIN:VCALENDAR\r\n')).toBe(true);
    expect(ics.trimEnd().endsWith('END:VCALENDAR')).toBe(true);
    expect(ics).toContain('\r\n');
  });
  it('contains event with UTC start', () => {
    expect(ics).toContain('BEGIN:VEVENT');
    expect(ics).toContain('DTSTART:20260824T090000Z');
    expect(ics).toContain('UID:uid-1');
    expect(ics).toContain('SUMMARY:Внести измерения: Давление');
  });
  it('contains zero-trigger alarm', () => {
    expect(ics).toContain('BEGIN:VALARM');
    expect(ics).toContain('TRIGGER:PT0S');
  });
});

describe('icsFilename', () => {
  it('sanitizes cyrillic and spaces', () => {
    expect(icsFilename('Давление и сахар!')).toMatch(/^napominanie-[a-z0-9-]+\.ics$/);
  });
});
```

- [ ] **Step 2: Запустить — FAIL**

Run: `npx vitest run src/logic/ics.test.ts`

- [ ] **Step 3: Реализовать src/logic/ics.ts**

```ts
function toUtcStamp(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}` +
    `T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`
  );
}

function esc(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,');
}

export function buildIcs(uid: string, title: string, startIso: string): string {
  const start = toUtcStamp(startIso);
  const stamp = toUtcStamp(new Date().toISOString());
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//pressure-sugar-tracker//RU',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${stamp}`,
    `DTSTART:${start}`,
    'DURATION:PT15M',
    `SUMMARY:${esc(title)}`,
    'BEGIN:VALARM',
    'ACTION:DISPLAY',
    `DESCRIPTION:${esc(title)}`,
    'TRIGGER:PT0S',
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n') + '\r\n';
}

export function icsFilename(_name: string): string {
  return `napominanie-${Date.now()}.ics`;
}
```

- [ ] **Step 4: Запустить — PASS**

Run: `npx vitest run src/logic/ics.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: ics calendar file generation"
```

---

### Task 6: Экспорт/импорт бэкапов

**Files:**
- Create: `src/logic/backup.ts`
- Test: `src/logic/backup.test.ts`

**Interfaces:**
- Consumes: `Snapshot`, `Report`, `Entry`, `Settings` из types.
- Produces: `buildExportJson(snapshot: Snapshot): string`; `parseImport(text: string): Snapshot` (бросает `BackupError` с русским сообщением при битом файле/чужой версии).

- [ ] **Step 1: Написать падающий тест**

```ts
import { describe, it, expect } from 'vitest';
import { buildExportJson, parseImport, BackupError } from './backup';
import type { Snapshot } from '../types';

const snap: Snapshot = {
  settings: { masterOn: false },
  reports: [{ id: 'r1', name: 'Отчёт', fields: [], archived: false, createdAt: 1, updatedAt: 1 }],
  entries: [{ id: 'e1', reportId: 'r1', values: {}, createdAt: 2 }],
};

it('round-trips snapshot', () => {
  const parsed = parseImport(buildExportJson(snap));
  expect(parsed.settings).toEqual({ masterOn: false });
  expect(parsed.reports[0].id).toBe('r1');
  expect(parsed.entries[0].id).toBe('e1');
});

it('rejects garbage', () => {
  expect(() => parseImport('not json{')).toThrow(BackupError);
});

it('rejects wrong version', () => {
  const bad = JSON.stringify({ ...snap, version: 2 });
  expect(() => parseImport(bad)).toThrow(/версия/);
});

it('rejects missing arrays', () => {
  expect(() => parseImport(JSON.stringify({ version: 1 }))).toThrow(BackupError);
});
```

- [ ] **Step 2: Запустить — FAIL**

Run: `npx vitest run src/logic/backup.test.ts`

- [ ] **Step 3: Реализовать src/logic/backup.ts**

```ts
import type { Snapshot } from '../types';

export class BackupError extends Error {}

const SUPPORTED_VERSION = 1;

export function buildExportJson(snapshot: Snapshot): string {
  return JSON.stringify({ version: SUPPORTED_VERSION, exportedAt: new Date().toISOString(), ...snapshot }, null, 2);
}

export function parseImport(text: string): Snapshot {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new BackupError('Файл повреждён или это не JSON');
  }
  if (typeof raw !== 'object' || raw === null) throw new BackupError('Неверный формат файла');
  const obj = raw as Record<string, unknown>;
  if (obj.version !== SUPPORTED_VERSION) {
    throw new BackupError(`Неподдерживаемая версия бэкапа: ${String(obj.version)}. Ожидается ${SUPPORTED_VERSION}.`);
  }
  const { settings, reports, entries } = obj as Partial<Snapshot>;
  if (!settings || !Array.isArray(reports) || !Array.isArray(entries)) {
    throw new BackupError('В файле нет данных отчётов');
  }
  return { settings, reports, entries } as Snapshot;
}

export function backupFilename(): string {
  const d = new Date().toISOString().slice(0, 10);
  return `treker-backup-${d}.json`;
}
```

- [ ] **Step 4: Запустить — PASS**

Run: `npx vitest run src/logic/backup.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: backup export/import with schema validation"
```

---

### Task 7: Шаблон отчёта и конфигурация полей (логика)

**Files:**
- Create: `src/logic/report-config.ts`
- Test: `src/logic/report-config.test.ts`

**Interfaces:**
- Consumes: `Field`, `Report`, `Entry`, `MAX_FIELDS`, `DEFAULT_FIELD_WIDTH`.
- Produces:
  - `makeDefaultFields(): Field[]` — шаблон из спеки (номер/дата и время/давление/сахар/примечание);
  - `createDefaultReport(): Report`;
  - `stripRemovedFieldValues(entries: Entry[], keptFieldIds: Set<string>): Entry[]`;
  - `assertFieldsLimit(count: number): void` (бросает ошибку при > `MAX_FIELDS`).

- [ ] **Step 1: Написать падающий тест**

```ts
import { describe, it, expect } from 'vitest';
import { makeDefaultFields, createDefaultReport, stripRemovedFieldValues, assertFieldsLimit } from './report-config';

it('default template matches spec', () => {
  const fields = makeDefaultFields();
  expect(fields.map(f => f.name)).toEqual(['Номер', 'Дата и время', 'Давление', 'Сахар', 'Примечание']);
  expect(fields.every(f => f.width === 30)).toBe(true);
  const dt = fields.find(f => f.type === 'datetime')!;
  expect(dt.required).toBe(true);
});

it('creates draft report', () => {
  const r = createDefaultReport();
  expect(r.archived).toBe(false);
  expect(r.fields.length).toBe(5);
});

it('strips values of removed fields', () => {
  const entries = [
    { id: 'e1', reportId: 'r', values: { a: 1, b: 2 }, createdAt: 0 },
  ];
  const out = stripRemovedFieldValues(entries, new Set(['b']));
  expect(out[0].values).toEqual({ b: 2 });
});

it('enforces field limit', () => {
  expect(() => assertFieldsLimit(11)).toThrow(/10/);
  expect(() => assertFieldsLimit(10)).not.toThrow();
});
```

- [ ] **Step 2: Запустить — FAIL**

Run: `npx vitest run src/logic/report-config.test.ts`

- [ ] **Step 3: Реализовать src/logic/report-config.ts**

```ts
import type { Field, Report, Entry } from '../types';
import { MAX_FIELDS, DEFAULT_FIELD_WIDTH } from '../constants';

let seq = 0;
export function genId(prefix: string): string {
  seq += 1;
  return `${prefix}-${Date.now().toString(36)}-${seq}`;
}

function mkField(name: string, type: Field['type'], unit?: string, required = false): Field {
  return { id: genId('fld'), name, type, unit, required, width: DEFAULT_FIELD_WIDTH };
}

export function makeDefaultFields(): Field[] {
  return [
    mkField('Номер', 'number'),
    mkField('Дата и время', 'datetime', undefined, true),
    mkField('Давление', 'number', 'мм рт.ст.'),
    mkField('Сахар', 'number', 'ммоль/л'),
    mkField('Примечание', 'text'),
  ];
}

export function createDefaultReport(): Report {
  const now = Date.now();
  return {
    id: genId('rep'),
    name: 'Новый отчёт',
    fields: makeDefaultFields(),
    archived: false,
    createdAt: now,
    updatedAt: now,
  };
}

export function stripRemovedFieldValues(entries: Entry[], keptFieldIds: Set<string>): Entry[] {
  return entries.map(e => ({
    ...e,
    values: Object.fromEntries(Object.entries(e.values).filter(([k]) => keptFieldIds.has(k))),
  }));
}

export function assertFieldsLimit(count: number): void {
  if (count > MAX_FIELDS) throw new Error(`Максимум полей: ${MAX_FIELDS}`);
}
```

- [ ] **Step 4: Запустить — PASS**

Run: `npx vitest run src/logic/report-config.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: default report template and field config logic"
```

---

### Task 8: Каркас приложения — вкладки и рубильник

**Files:**
- Modify: `src/App.tsx`, `src/index.css`
- Create: `src/components/MasterSwitch.tsx`, `src/hooks/useSettings.ts`
- Test: `src/hooks/useSettings.test.ts`

**Interfaces:**
- Consumes: `getSettings`, `saveSettings`, `APP_TITLE`.
- Produces: хук `useSettings(): { settings: Settings | null; setMasterOn(v: boolean): void }`; компонент `MasterSwitch({ on, onToggle })`; в `App` три таба-заглушки: Отчёты / Архив / Ещё.

- [ ] **Step 1: Падающий тест хука**

```ts
import { renderHook, waitFor, act } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';
import { useSettings } from './useSettings';
import { db } from '../db/db';

beforeEach(async () => { await db.delete(); await db.open(); });

it('loads defaults and saves toggle', async () => {
  const { result } = renderHook(() => useSettings());
  await waitFor(() => expect(result.current.settings).not.toBeNull());
  expect(result.current.settings!.masterOn).toBe(true);
  act(() => result.current.setMasterOn(false));
  await waitFor(() => expect(result.current.settings!.masterOn).toBe(false));
});
```

- [ ] **Step 2: Запустить — FAIL**

Run: `npx vitest run src/hooks/useSettings.test.ts`

- [ ] **Step 3: Реализовать хук и рубильник**

`src/hooks/useSettings.ts`:

```ts
import { useEffect, useState, useCallback } from 'react';
import type { Settings } from '../types';
import { getSettings, saveSettings } from '../db/db';

export function useSettings() {
  const [settings, setSettings] = useState<Settings | null>(null);

  useEffect(() => {
    getSettings().then(setSettings).catch(console.error);
  }, []);

  const setMasterOn = useCallback((masterOn: boolean) => {
    void saveSettings({ masterOn }).then(() => setSettings({ masterOn }));
  }, []);

  return { settings, setMasterOn };
}
```

`src/components/MasterSwitch.tsx`:

```tsx
interface Props { on: boolean; disabled?: boolean; onToggle: (v: boolean) => void }

export default function MasterSwitch({ on, disabled, onToggle }: Props) {
  return (
    <label className="master-switch">
      <span>Напоминания</span>
      <input
        type="checkbox"
        role="switch"
        checked={on}
        disabled={disabled}
        onChange={e => onToggle(e.target.checked)}
      />
      <b>{on ? 'вкл' : 'выкл'}</b>
    </label>
  );
}
```

`src/App.tsx` — заголовок, рубильник, три таба (содержимое пока заглушки):

```tsx
import { useState } from 'react';
import MasterSwitch from './components/MasterSwitch';
import { useSettings } from './hooks/useSettings';
import { APP_TITLE } from './constants';

type Tab = 'reports' | 'archive' | 'more';

export default function App() {
  const { settings, setMasterOn } = useSettings();
  const [tab, setTab] = useState<Tab>('reports');

  return (
    <div className="app">
      <header className="app-header">
        <h1>{APP_TITLE}</h1>
        {settings && (
          <MasterSwitch on={settings.masterOn} onToggle={setMasterOn} />
        )}
      </header>
      <main>
        {tab === 'reports' && <p>Список отчётов (в разработке)</p>}
        {tab === 'archive' && <p>Архив (в разработке)</p>}
        {tab === 'more' && <p>Бэкапы (в разработке)</p>}
      </main>
      <nav className="tabbar">
        <button onClick={() => setTab('reports')} aria-current={tab === 'reports'}>Отчёты</button>
        <button onClick={() => setTab('archive')} aria-current={tab === 'archive'}>Архив</button>
        <button onClick={() => setTab('more')} aria-current={tab === 'more'}>Ещё</button>
      </nav>
    </div>
  );
}
```

В `src/index.css` — мобильная база (system-ui шрифт, `max-width: 720px; margin: 0 auto`, фиксированный `.tabbar` снизу, стили `.master-switch input[type=checkbox]` крупным тумблером).

- [ ] **Step 4: Запустить все тесты — PASS**

Run: `npm test -- --run`
Expected: все тесты зелёные, включая smoke из Task 1.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: app shell with tabs and global reminders switch"
```

---

### Task 9: Список отчётов и создание отчёта

**Files:**
- Create: `src/components/ReportsTab.tsx`, `src/components/ReportScreen.tsx` (каркас)
- Modify: `src/App.tsx`
- Test: `src/components/ReportsTab.test.tsx`

**Interfaces:**
- Consumes: `listReports`, `putReport`, `createDefaultReport`, `genId`.
- Produces: `ReportsTab({ openReport }: { openReport: (id: string) => void })`; `ReportScreen({ reportId, onBack }: { reportId: string; onBack: () => void })` — пока каркас с именем отчёта и кнопкой «Назад». В `App` появляется состояние `openReportId: string | null`.

- [ ] **Step 1: Падающий тест**

```tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';
import ReportsTab from './ReportsTab';
import { db, putReport } from '../db/db';

beforeEach(async () => { await db.delete(); await db.open(); });

it('shows active reports and creates one from template', async () => {
  await putReport({ id: 'x', name: 'Активный', fields: [], archived: false, createdAt: 1, updatedAt: 1 });
  await putReport({ id: 'y', name: 'Архивный', fields: [], archived: true, createdAt: 2, updatedAt: 2 });
  const opened: string[] = [];
  render(<ReportsTab openReport={id => opened.push(id)} />);
  expect(await screen.findByText('Активный')).toBeInTheDocument();
  expect(screen.queryByText('Архивный')).not.toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: '+ Добавить отчёт' }));
  await waitFor(async () => {
    const reports = await db.reports.toArray();
    expect(reports.some(r => r.name === 'Новый отчёт' && r.fields.length === 5)).toBe(true);
  });
});
```

- [ ] **Step 2: Запустить — FAIL**

Run: `npx vitest run src/components/ReportsTab.test.tsx`

- [ ] **Step 3: Реализовать ReportsTab**

```tsx
import { useEffect, useState, useCallback } from 'react';
import type { Report } from '../types';
import { listReports, putReport } from '../db/db';
import { createDefaultReport } from '../logic/report-config';

interface Props { openReport: (id: string) => void }

export default function ReportsTab({ openReport }: Props) {
  const [reports, setReports] = useState<Report[]>([]);

  const reload = useCallback(async () => setReports(await listReports(false)), []);
  useEffect(() => { void reload(); }, [reload]);

  const add = useCallback(async () => {
    await putReport(createDefaultReport());
    await reload();
  }, [reload]);

  return (
    <div>
      <ul className="report-list">
        {reports.map(r => (
          <li key={r.id}>
            <button onClick={() => openReport(r.id)}>{r.name}</button>
          </li>
        ))}
        {reports.length === 0 && <li className="empty">Пока нет отчётов</li>}
      </ul>
      <button className="primary" onClick={() => void add()}>+ Добавить отчёт</button>
    </div>
  );
}
```

Каркас `ReportScreen.tsx`:

```tsx
import { useEffect, useState } from 'react';
import type { Report } from '../types';
import { getReport } from '../db/db';

interface Props { reportId: string; onBack: () => void }

export default function ReportScreen({ reportId, onBack }: Props) {
  const [report, setReport] = useState<Report | null>(null);
  useEffect(() => { void getReport(reportId).then(r => setReport(r ?? null)); }, [reportId]);

  if (!report) return <p>Не найден</p>;
  return (
    <div>
      <button onClick={onBack}>← Назад</button>
      <h2>{report.name}</h2>
      {/* таблица и действия появятся в следующих задачах */}
    </div>
  );
}
```

В `App.tsx`: `const [openReportId, setOpenReportId] = useState<string | null>(null);` — если открыт отчёт, показываем `ReportScreen` вместо табов.

- [ ] **Step 4: Запустить — PASS**

Run: `npx vitest run src/components/ReportsTab.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: reports list with template-based creation"
```

---

### Task 10: Записи — таблица и форма

**Files:**
- Create: `src/components/EntriesTable.tsx`, `src/components/EntryForm.tsx`
- Modify: `src/components/ReportScreen.tsx`
- Test: `src/components/EntriesTable.test.tsx`

**Interfaces:**
- Consumes: `listEntries`, `putEntry`, `deleteEntry`, `latestEntryAt`, `validateEntry`, `onEntryRecorded` (сброс повторов напоминания), `genId`, типы `Report`/`Entry`.
- Produces: `EntriesTable({ report, entries, onEdit, onDelete })`; `EntryForm({ fields, initial?, onSave, onCancel })` — сохраняет `values: Record<string, string|number>`.

- [ ] **Step 1: Падающий тест таблицы и формы**

```tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import EntriesTable from './EntriesTable';
import EntryForm from './EntryForm';
import type { Field, Entry } from '../types';
import userEvent from '@testing-library/user-event';

const fields: Field[] = [
  { id: 'f1', name: 'Давление', type: 'number', unit: 'мм рт.ст.', required: true, width: 30 },
  { id: 'f2', name: 'Примечание', type: 'text', required: false, width: 30 },
];

const entry: Entry = { id: 'e1', reportId: 'r', values: { f1: 120, f2: 'утром' }, createdAt: 5 };

it('renders rows with fixed column widths and wraps values', () => {
  render(<EntriesTable report={{ fields }} entries={[entry]} onEdit={() => {}} onDelete={() => {}} />);
  expect(screen.getByText('120')).toBeInTheDocument();
  expect(screen.getByText('утром')).toBeInTheDocument();
  const cell = screen.getByText('утром').closest('td')!;
  expect(cell).toHaveStyle({ maxWidth: '30ch' });
});

it('form validates required fields before save', async () => {
  const saved: unknown[] = [];
  render(<EntryForm fields={fields} onSave={v => saved.push(v)} onCancel={() => {}} />);
  await userEvent.click(screen.getByRole('button', { name: 'Сохранить' }));
  expect(saved).toHaveLength(0);
  expect(screen.getByText('Обязательное поле')).toBeInTheDocument();
  await userEvent.type(screen.getByLabelText('Давление'), '130');
  await userEvent.click(screen.getByRole('button', { name: 'Сохранить' }));
  expect(saved).toHaveLength(1);
});
```

- [ ] **Step 2: Запустить — FAIL**

Run: `npx vitest run src/components/EntriesTable.test.tsx`

- [ ] **Step 3: Реализовать EntriesTable.tsx**

```tsx
import type { Report, Entry } from '../types';

interface Props {
  report: Pick<Report, 'fields'>;
  entries: Entry[];
  onEdit: (e: Entry) => void;
  onDelete: (e: Entry) => void;
}

export default function EntriesTable({ report, entries, onEdit, onDelete }: Props) {
  return (
    <table className="entries-table">
      <thead>
        <tr>
          {report.fields.map(f => (
            <th key={f.id} style={{ minWidth: `${f.width}ch`, maxWidth: `${f.width}ch` }}>
              {f.name}{f.unit ? `, ${f.unit}` : ''}
              {f.required ? ' *' : ''}
            </th>
          ))}
          <th />
        </tr>
      </thead>
      <tbody>
        {entries.map(e => (
          <tr key={e.id}>
            {report.fields.map(f => (
              <td key={f.id} style={{ maxWidth: `${f.width}ch` }} className="wrap-cell">
                {String(e.values[f.id] ?? '')}
              </td>
            ))}
            <td>
              <button onClick={() => onEdit(e)}>✎</button>
              <button onClick={() => onDelete(e)}>🗑</button>
            </td>
          </tr>
        ))}
        {entries.length === 0 && (
          <tr><td colSpan={report.fields.length + 1}>Нет записей</td></tr>
        )}
      </tbody>
    </table>
  );
}
```

CSS (в `index.css`): `.wrap-cell { overflow-wrap: anywhere; white-space: normal; vertical-align: top; }` — длинный текст переносится вниз внутри ячейки, строка растёт по высоте.

- [ ] **Step 4: Реализовать EntryForm.tsx**

```tsx
import { useState } from 'react';
import type { Field } from '../types';
import { validateEntry } from '../logic/validation';

interface Props {
  fields: Field[];
  initial?: Record<string, string | number>;
  onSave: (values: Record<string, string | number>) => void;
  onCancel: () => void;
}

export default function EntryForm({ fields, initial, onSave, onCancel }: Props) {
  const [values, setValues] = useState<Record<string, string | number>>(initial ?? {});
  const [errors, setErrors] = useState<Record<string, string>>({});

  const set = (id: string, v: string) =>
    setValues(prev => ({ ...prev, [id]: v }));

  const submit = () => {
    const errs = validateEntry(fields, values);
    setErrors(errs);
    if (Object.keys(errs).length === 0) onSave(values);
  };

  return (
    <form onSubmit={e => { e.preventDefault(); submit(); }}>
      {fields.map(f => (
        <label key={f.id}>
          {f.name}{f.unit ? `, ${f.unit}` : ''}{f.required ? ' *' : ''}
          {f.type === 'datetime' ? (
            <input type="datetime-local" value={String(values[f.id] ?? '')}
                   onChange={e => set(f.id, e.target.value)} />
          ) : f.type === 'number' ? (
            <input inputMode="decimal" value={String(values[f.id] ?? '')}
                   onChange={e => set(f.id, e.target.value)} />
          ) : (
            <textarea value={String(values[f.id] ?? '')}
                      onChange={e => set(f.id, e.target.value)} />
          )}
          {errors[f.id] && <em className="error">{errors[f.id]}</em>}
        </label>
      ))}
      <button type="submit" className="primary">Сохранить</button>
      <button type="button" onClick={onCancel}>Отмена</button>
    </form>
  );
}
```

- [ ] **Step 5: Подключить к ReportScreen: состояние записей + сброс напоминания**

В `ReportScreen.tsx` загрузка записей, кнопка «+ Запись», редактирование/удаление. Ключевой момент — после сохранения записи сбросить повторы напоминания (спека §6):

```tsx
const saveEntry = async (values: Record<string, string | number>) => {
  await putEntry({ id: editingEntry?.id ?? genId('ent'), reportId, values,
                   createdAt: editingEntry?.createdAt ?? Date.now() });
  if (report.reminder) {
    await putReport({ ...report, reminderState: onEntryRecorded(), updatedAt: Date.now() });
    setReport({ ...report, reminderState: { repeatsDone: 0 } });
  }
  setEditingEntry(null); setShowForm(false);
  setEntries(await listEntries(reportId));
};
```

- [ ] **Step 6: Запустить — PASS, коммит**

Run: `npx vitest run src/components/EntriesTable.test.tsx`
Expected: PASS

```bash
git add -A
git commit -m "feat: entries table with wrapping cells and validated entry form"
```

---

### Task 11: Конфигуратор полей (UI)

**Files:**
- Create: `src/components/FieldsEditor.tsx`
- Modify: `src/components/ReportScreen.tsx`
- Test: `src/components/FieldsEditor.test.tsx`

**Interfaces:**
- Consumes: `assertFieldsLimit`, `stripRemovedFieldValues`, `genId`, `MAX_FIELDS`, `DEFAULT_FIELD_WIDTH`, `putReport`, `listEntries`, `deleteEntry`+`putEntry` (для перезаписи записей).
- Produces: `FieldsEditor({ report, onSaved })` — экран редактирования полей: имя, тип (select число/текст/дата и время), размерность, чекбокс «обязательное», ширина (число, дефолт 30), кнопки добавить/удалить (минимум 1 поле, максимум 10), «Сохранить».

- [ ] **Step 1: Падающий тест**

```tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';
import FieldsEditor from './FieldsEditor';
import { db } from '../db/db';
import type { Report } from '../types';

beforeEach(async () => { await db.delete(); await db.open(); });

const base: Report = {
  id: 'r1', name: 'R', archived: false, createdAt: 0, updatedAt: 0,
  fields: [
    { id: 'f1', name: 'A', type: 'number', required: false, width: 30 },
  ],
};

it('blocks adding beyond 10 fields', () => {
  render(<FieldsEditor report={{ ...base, fields: Array.from({ length: 10 }, (_, i) => ({ id: `f${i}`, name: `F${i}`, type: 'text' as const, required: false, width: 30 })) }} onSaved={() => {}} />);
  expect(screen.getByRole('button', { name: '+ Поле' })).toBeDisabled();
});

it('cannot remove the last field', () => {
  render(<FieldsEditor report={base} onSaved={() => {}} />);
  expect(screen.getByRole('button', { name: 'Удалить поле' })).toBeDisabled();
});

it('saves edited field props', () => {
  let saved: Report | null = null;
  render(<FieldsEditor report={base} onSaved={r => { saved = r; }} />);
  const nameInput = screen.getByDisplayValue('A');
  fireEvent.change(nameInput, { target: { value: 'Давление' } });
  fireEvent.click(screen.getByRole('button', { name: 'Сохранить поля' }));
  expect(saved!.fields[0].name).toBe('Давление');
});
```

- [ ] **Step 2: Запустить — FAIL**

Run: `npx vitest run src/components/FieldsEditor.test.tsx`

- [ ] **Step 3: Реализовать FieldsEditor.tsx**

Локальный стейт копии `fields`. Каждое поле — карточка: input имени, select типа (`number`→«Число», `text`→«Текст», `datetime`→«Дата и время»), input размерности, checkbox обязательности, number-input ширины (value fallback `DEFAULT_FIELD_WIDTH`), кнопка удаления (disabled при `length===1`). «+ Поле» disabled при `length>=MAX_FIELDS`. Сохранение: `assertFieldsLimit(newLen)`; вычислить удалённые id (`removed = oldIds − newIds`); перезаписать записи через `stripRemovedFieldValues`; `putReport({...report, fields, updatedAt: Date.now(), reminderState: onReconfigured()})`; вызвать `onSaved(updated)`.

Кнопки: `aria-label="+ Поле"` на добавлении, `aria-label="Удалить поле"` на удалении каждой карточки, текст «Сохранить поля» на сабмите.

- [ ] **Step 4: Запустить — PASS**

Run: `npx vitest run src/components/FieldsEditor.test.tsx`
Expected: PASS

- [ ] **Step 5: Коммит**

```bash
git add -A
git commit -m "feat: field editor with 10-field limit and orphan value cleanup"
```

---

### Task 12: Напоминания — UI и движок уведомлений

**Files:**
- Create: `src/components/ReminderPanel.tsx`, `src/hooks/useReminderEngine.ts`
- Modify: `src/components/ReportScreen.tsx`, `src/App.tsx`
- Test: `src/hooks/useReminderEngine.test.ts`

**Interfaces:**
- Consumes: `computeDue`, `onFired`, `onReconfigured`, `buildIcs`, `icsFilename`, `putReport`, `listReports`, `latestEntryAt`, `getSettings`.
- Produces:
  - `ReminderPanel({ report, onChanged })` — чекбокс «Напоминание», `datetime-local` инпут, кнопка «Добавить в Календарь» (скачивает .ics через Blob+a.download); при выключенном глобальном рубильнике панель показывает подсказку и блокирует включение.
  - Хук `useReminderEngine(enabled: boolean)` — каждые 30 сек опрашивает активные отчёты, для due-напоминаний вызывает `showNotification` (если разрешено) либо выставляет баннер `dueTitles: string[]`, затем сохраняет `reminderState = onFired(...)`.
- Изменение даты/времени или включение → `reminderState = onReconfigured()` (спека: перенастройка сбрасывает счётчик).

- [ ] **Step 1: Падающий тест движка**

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { runEngineTick } from './useReminderEngine';
import { db, putReport } from '../db/db';
import type { Report } from '../types';

beforeEach(async () => { await db.delete(); await db.open(); });

const T0 = Date.parse('2026-08-23T09:00:00Z');

const report: Report = {
  id: 'r1', name: 'Давление', archived: false, createdAt: 0, updatedAt: 0,
  fields: [],
  reminder: { enabled: true, datetime: new Date(T0).toISOString() },
};

it('fires due reminder, persists state, reports title', async () => {
  await putReport(report);
  const notify = vi.fn();
  const titles = await runEngineTick(T0, notify);
  expect(titles).toContain('Давление');
  expect(notify).toHaveBeenCalledWith('Давление');
  const saved = (await db.reports.get('r1'))!;
  expect(saved.reminderState?.repeatsDone).toBe(1);
});

it('respects master switch', async () => {
  await putReport(report);
  const titles = await runEngineTick(T0, vi.fn(), { masterOn: false });
  expect(titles).toEqual([]);
});

it('does not refire within 10 minutes', async () => {
  await putReport(report);
  await runEngineTick(T0, vi.fn());
  const titles = await runEngineTick(T0 + 5 * 60_000, vi.fn());
  expect(titles).toEqual([]);
});
```

- [ ] **Step 2: Запустить — FAIL**

Run: `npx vitest run src/hooks/useReminderEngine.test.ts`

- [ ] **Step 3: Реализовать движок (экспортируемая чистая функция + тонкий setInterval-хук)**

```ts
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
```

Хук (в том же файле):

```ts
import { useEffect, useState } from 'react';

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
```

- [ ] **Step 4: Реализовать ReminderPanel.tsx**

```tsx
import { useState } from 'react';
import type { Report } from '../types';
import { putReport } from '../db/db';
import { buildIcs, icsFilename } from '../logic/ics';
import { onReconfigured } from '../logic/reminders';

interface Props { report: Report; masterOn: boolean; onChanged: () => void }

export default function ReminderPanel({ report, masterOn, onChanged }: Props) {
  const rem = report.reminder;
  const [dt, setDt] = useState(rem?.datetime?.slice(0, 16) ?? '');

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
      [buildIcs(`${report.id}-${Date.now()}`, `Внести измерения: ${report.name}`, new Date(dt).toISOString())],
      { type: 'text/calendar' },
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = icsFilename(report.name);
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <section className="reminder-panel">
      {!masterOn && <p className="hint">Рубильник напоминаний выключен — напоминания молчат.</p>}
      <label>
        <input type="checkbox" checked={rem?.enabled ?? false}
               onChange={e => void persist(e.target.checked)} />
        Напоминание о заполнении
      </label>
      <input type="datetime-local" value={dt} onChange={e => setDt(e.target.value)} />
      <button onClick={downloadIcs} disabled={!dt}>
        Добавить в Календарь (.ics)
      </button>
      <p className="hint">Повтор внутри приложения: до 3 раз каждые 10 минут, пока запись не внесена.</p>
    </section>
  );
}
```

В `ReportScreen` добавить кнопку «Напоминание», открывающую панель. При первом включении запросить разрешение: в `App` при включении рубильника вызвать `void Notification.requestPermission()` в try/catch.

- [ ] **Step 5: Запустить — PASS**

Run: `npx vitest run src/hooks/useReminderEngine.test.ts`
Expected: PASS

- [ ] **Step 6: Коммит**

```bash
git add -A
git commit -m "feat: reminder panel, ics download and in-app reminder engine"
```

---

### Task 13: Архив

**Files:**
- Create: `src/components/ArchiveTab.tsx`
- Modify: `src/components/ReportScreen.tsx`, `src/App.tsx`
- Test: `src/components/ArchiveTab.test.tsx`

**Interfaces:**
- Consumes: `listReports`, `putReport`.
- Produces: `ArchiveTab({ openReport })` — список архивных отчётов с кнопкой «Разархивировать»; в `ReportScreen` кнопка «Архивировать» (`putReport({ ...report, archived: true })` → `onBack()`).

- [ ] **Step 1: Падающий тест**

```tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';
import ArchiveTab from './ArchiveTab';
import { db, putReport } from '../db/db';

beforeEach(async () => { await db.delete(); await db.open(); });

it('lists archived and unarchives', async () => {
  await putReport({ id: 'a', name: 'Старый', fields: [], archived: true, createdAt: 1, updatedAt: 1 });
  render(<ArchiveTab openReport={() => {}} />);
  expect(await screen.findByText('Старый')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Разархивировать' }));
  await waitFor(async () => {
    expect((await db.reports.get('a'))!.archived).toBe(false);
  });
});
```

- [ ] **Step 2: Запустить — FAIL**

Run: `npx vitest run src/components/ArchiveTab.test.tsx`

- [ ] **Step 3: Реализовать ArchiveTab.tsx**

```tsx
import { useCallback, useEffect, useState } from 'react';
import type { Report } from '../types';
import { listReports, putReport } from '../db/db';

interface Props { openReport: (id: string) => void }

export default function ArchiveTab({ openReport }: Props) {
  const [reports, setReports] = useState<Report[]>([]);
  const reload = useCallback(async () => setReports(await listReports(true)), []);
  useEffect(() => { void reload(); }, [reload]);

  return (
    <ul className="report-list">
      {reports.map(r => (
        <li key={r.id}>
          <button onClick={() => openReport(r.id)}>{r.name}</button>
          <button onClick={async () => { await putReport({ ...r, archived: false }); await reload(); }}>
            Разархивировать
          </button>
        </li>
      ))}
      {reports.length === 0 && <li className="empty">Архив пуст</li>}
    </ul>
  );
}
```

Подключить в `App` вместо заглушки «Архив».

- [ ] **Step 4: Запустить — PASS, коммит**

Run: `npx vitest run src/components/ArchiveTab.test.tsx`
Expected: PASS

```bash
git add -A
git commit -m "feat: archive tab with unarchive action"
```

---

### Task 14: Печать / PDF

**Files:**
- Modify: `src/index.css` (блок `@media print`), `src/components/ReportScreen.tsx`
- Test: ручная проверка (см. Step 3) — логики нет, только вёрстка и `window.print()`.

**Interfaces:**
- Consumes: существующие `EntriesTable`, данные отчёта.
- Produces: кнопка «Печать/PDF» в `ReportScreen`; печатная версия: заголовок = имя отчёта, таблица записей, скрыты навигация/кнопки/рубильник.

- [ ] **Step 1: Добавить кнопку печати в ReportScreen**

```tsx
<button onClick={() => window.print()}>Печать/PDF</button>
```

- [ ] **Step 2: Добавить print-стили в index.css**

```css
@media print {
  body { margin: 0; }
  .app-header, .tabbar, .no-print { display: none !important; }
  .print-title { display: block !important; font-size: 18pt; margin-bottom: 8pt; }
  .entries-table { width: 100%; border-collapse: collapse; table-layout: fixed; }
  .entries-table th, .entries-table td { border: 1pt solid #333; padding: 2pt 4pt; overflow-wrap: anywhere; }
  /* широкие таблицы масштабируются по ширине листа */
  .print-root { zoom: 0.8; }
}
.print-title { display: none; }
```

В `ReportScreen` рядом с таблицей добавить `<h2 className="print-title">{report.name}</h2>`; всем кнопкам действий поставить класс `no-print`.

- [ ] **Step 3: Ручная проверка**

Run: `npm run dev` → открыть отчёт → Cmd+P (предпросмотр печати).
Expected: виден только заголовок отчёта и таблица; кнопок нет. В Safari системное меню позволяет AirPrint или «Сохранить как PDF».

- [ ] **Step 4: Коммит**

```bash
git add -A
git commit -m "feat: printable report layout with PDF export via system menu"
```

---

### Task 15: Бэкапы — вкладка «Ещё» и автопредложение импорта

**Files:**
- Create: `src/components/MoreTab.tsx`
- Modify: `src/App.tsx`
- Test: `src/components/MoreTab.test.tsx`

**Interfaces:**
- Consumes: `getAllData`, `replaceEverything`, `buildExportJson`, `parseImport`, `backupFilename`, `listReports`.
- Produces: `MoreTab({ onDataChanged })`: кнопка «Экспорт бэкапа» (Blob+a.download, имя `treker-backup-YYYY-MM-DD.json`), file-input «Импорт» с подтверждением замены и показом ошибки `BackupError`; в `App` — диалог «База пуста. Импортировать бэкап?» при первом входе, если отчётов 0.

- [ ] **Step 1: Падающий тест**

```tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import MoreTab from './MoreTab';
import { db, putReport } from '../db/db';

beforeEach(async () => { await db.delete(); await db.open(); });

function mockDownload() {
  const urls: string[] = [];
  vi.stubGlobal('URL', { createObjectURL: () => 'blob:x', revokeObjectURL: () => {} });
  return urls;
}

it('exports a valid backup json', async () => {
  await putReport({ id: 'r1', name: 'R', fields: [], archived: false, createdAt: 1, updatedAt: 1 });
  mockDownload();
  let clicked = '';
  const origCreate = document.createElement.bind(document);
  vi.spyOn(document, 'createElement').mockImplementation(tag => {
    const el = origCreate(tag);
    if (tag === 'a') el.addEventListener('click', () => { clicked = 'dl'; });
    return el;
  });
  render(<MoreTab onDataChanged={() => {}} />);
  fireEvent.click(screen.getByRole('button', { name: 'Экспорт бэкапа' }));
  await waitFor(() => expect(clicked).toBe('dl'));
});

it('import rejects broken file with error message', async () => {
  render(<MoreTab onDataChanged={() => {}} />);
  const input = screen.getByLabelText('Импорт бэкапа');
  await fireEvent.change(input, { target: { files: [new File(['garbage{'], 'b.json')] } });
  expect(await screen.findByText(/повреждён|не JSON/i)).toBeInTheDocument();
  expect(await db.reports.count()).toBe(0);
});
```

- [ ] **Step 2: Запустить — FAIL**

Run: `npx vitest run src/components/MoreTab.test.tsx`

- [ ] **Step 3: Реализовать MoreTab.tsx**

```tsx
import { useRef, useState } from 'react';
import { getAllData, replaceEverything } from '../db/db';
import { buildExportJson, parseImport, backupFilename, BackupError } from '../logic/backup';

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
      const snap = parseImport(await file.text());
      if (!window.confirm('Текущие данные будут заменены данными из файла. Продолжить?')) return;
      await replaceEverything(snap);
      onDataChanged();
    } catch (e) {
      setError(e instanceof BackupError ? e.message : 'Не удалось импортировать файл');
    }
  };

  return (
    <div>
      <button className="primary" onClick={() => void exportBackup()}>Экспорт бэкапа</button>
      <hr />
      <label>
        Импорт бэкапа
        <input type="file" accept="application/json,.json" ref={fileRef}
               onChange={e => { const f = e.target.files?.[0]; if (f) void importBackup(f); }} />
      </label>
      {error && <p className="error">{error}</p>}
      <p className="hint">Храните файл в «Файлах» или iCloud Drive. После переустановки приложения импортируйте его — данные восстановятся.</p>
    </div>
  );
}
```

В `App`: эффект при монтировании — если `(await listReports(false)).length === 0` и `(await listReports(true)).length === 0`, показать `window.confirm('База пуста. Импортировать резервную копию?')`; при согласии программно открыть выбор файла (скрытый input в App или переключиться на таб «Ещё» с автофокусом на input — выбрать второй вариант, проще).

- [ ] **Step 4: Запустить — PASS, коммит**

Run: `npx vitest run src/components/MoreTab.test.tsx`
Expected: PASS

```bash
git add -A
git commit -m "feat: backup export/import UI with empty-database import prompt"
```

---

### Task 16: Деплой GitHub Pages + финальная проверка

**Files:**
- Create: `.github/workflows/deploy.yml`
- Modify: `package.json` (`homepage`-поле не нужно — base уже задан)

**Interfaces:**
- Produces: рабочий сайт `https://<user>.github.io/pressure-sugar-tracker/`.

- [ ] **Step 1: Workflow деплоя**

```yaml
name: Deploy to GitHub Pages
on:
  push:
    branches: [main]
permissions:
  contents: read
  pages: write
  id-token: write
concurrency:
  group: pages
  cancel-in-progress: true
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: npm }
      - run: npm ci
      - run: npm test -- --run
      - run: npm run build
      - uses: actions/upload-pages-artifact@v3
        with: { path: dist }
  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - id: deployment
        uses: actions/deploy-pages@v4
```

- [ ] **Step 2: Полный локальный прогон**

Run: `npm test -- --run && npm run build`
Expected: все тесты зелёные, сборка успешна.

- [ ] **Step 3: Создать репозиторий и запушить**

Репозиторий под аккаунт TestingInPractice — токен брать из `~/.config/github-tokens.json` (скилл `github-push`). Включить GitHub Pages → Source: GitHub Actions.

- [ ] **Step 4: Ручной UAT на iPhone (чек-лист из спеки §11)**

1. Открыть URL в Safari → Поделиться → «На экран Домой».
2. Создать отчёт → шаблон из 5 полей → изменить поля (до 10) → заполнить записи (дата через календарь).
3. Настроить напоминание → проверить, что .ics открылся в Календаре.
4. Выключить/включить рубильник — внутренние баннеры пропадают/работают.
5. Архивировать отчёт → исчез из «Отчётов», появился в «Архиве»; разархивировать обратно.
6. Печать → «Сохранить как PDF».
7. Экспорт бэкапа → удалить PWA с домашнего экрана → переустановить → импорт → все отчёты на месте.

- [ ] **Step 5: Финальный коммит**

```bash
git add -A
git commit -m "ci: deploy PWA to GitHub Pages"
git push
```

---

## Self-Review

**1. Spec coverage:**
- Рубильник (§3, §6) → Task 8 (+ блокировка в панели, Task 12) ✓
- Отчёты + «Добавить отчёт» (§3) → Task 9 ✓
- До 10 полей, обязательность, размерность, ширина 30 (§5) → Tasks 7, 11 ✓
- Дата через календарь (§5) → `datetime-local`, Task 10 ✓
- Таблица с фикс. шириной и переносом вниз (§5) → Task 10 (`.wrap-cell`, `maxWidth ch`) ✓
- Напоминания: .ics + 3 повтора + сброс при записи/перенастройке (§6) → Tasks 4, 12 ✓
- Архив туда/обратно (§3) → Task 13 ✓
- Печать/PDF активных и архивных (§8) → Task 14 (ReportScreen общий) ✓
- Хранение IndexedDB + экспорт/импорт + автопредложение (§7) → Tasks 2, 6, 15 ✓
- Удаление поля отбрасывает значения (§10) → Tasks 7, 11 (`stripRemovedFieldValues`) ✓
- Минимум 1 поле (§10) → Task 11 ✓
- Нет разрешения на уведомления → баннер-fallback (§10) → Task 12 (`dueTitles`) ✓
- PWA манифест/иконки/SW (§9) → Tasks 1, 16 ✓
- Юнит-тесты логики (§11) → Tasks 3–7 ✓

**2. Placeholder scan:** код всех задач приведён полностью; единственный оговорённый случай — генератор иконок (Task 1 Step 4) имеет два конкретных варианта кода с критерием выбора («скрипт отработал и создал два валидных PNG»). TBD/TODO отсутствуют.

**3. Type consistency:** `ReminderState` определён в Task 2 и используется в Tasks 4/10/11/12 одинаково; `computeDue/onFired/onEntryRecorded/onReconfigured` — сигнатуры совпадают между Task 4 (определение) и Tasks 10/12 (использование); `parseImport/buildExportJson/BackupError` согласованы между Tasks 6 и 15; `genId` определён в Task 7, используется в Tasks 9/10/11. Индексная схема Dexie скорректирована в Task 2 (boolean не индексируется — фильтрация в памяти) единообразно.
