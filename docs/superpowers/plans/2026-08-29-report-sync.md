# Синхронизация отчёта с локальным файлом — план реализации

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Кнопка «Синхронизация» в каждом отчёте, которая сравнивает записи отчёта с последней синхронизированной копией (IndexedDB) и пересохраняет локальный JSON-файл отчёта на телефон: identical → «Актуализация не нужна», только новые строки → автообновление, изменённые/удалённые старые → подтверждение замены.

**Architecture:** Слепок последней синхронизации хранится в новой таблице Dexie `syncs` (одна строка на отчёт). Чистая diff-логика в `src/logic/sync.ts` (без DOM — полностью тестируемая). Сохранение файла — утилита `src/logic/sync-file.ts` (Web Share API, fallback `<a download>`). Кнопка и поток — в `ReportScreen.tsx`. Тесты: vitest + Testing Library на fake-indexeddb, как в остальном проекте.

**Tech Stack:** React 19 · TypeScript 5.9 · Dexie 4 (IndexedDB) · Vitest 3 + Testing Library + fake-indexeddb · Web Share API.

**Spec:** `docs/superpowers/specs/2026-08-29-report-sync-design.md`

## Global Constraints

- Синхронизация односторонняя: веб → файл. Импорт из файла обратно в приложение НЕ делаем.
- Дифф оценивается ТОЛЬКО по записям (`entries`), не по полям/названию/настройкам.
- Сравнение записей по `id` и `values` (deep equal). `createdAt` в diff не участвует.
- Первая синхронизация (`getSyncState` вернул `undefined`) = все записи «новые» → `append-only` без вопросов.
- «Нет» при конфликте: слепок и файл не трогаем, ничего в веб не пишем.
- Сообщения — inline под кнопкой (не `alert`); подтверждение конфликта — `window.confirm`.
- Пустой отчёт / пустой слепок → `identical`.
- Тесты пишутся ДО реализации (TDD), стиль существующих: `describe/it/expect`, `beforeEach` reset БД.
- React компоненты — без подавления типов (`as any` не использовать).

---

### Task 1: Тип SyncState и слой хранения (Dexie v2)

**Files:**
- Modify: `src/types.ts` (добавить интерфейс `SyncState`)
- Modify: `src/db/db.ts` (схема v2, таблица `syncs`, API-функции, каскад в `deleteReport`)
- Test: `src/db/db.test.ts`

**Interfaces:**
- Produces: `interface SyncState { reportId: string; reportName: string; fields: Field[]; entries: Entry[]; syncedAt: number }` (мс)
- Produces: `getSyncState(reportId: string): Promise<SyncState | undefined>`
- Produces: `putSyncState(state: SyncState): Promise<void>`
- Produces: `deleteSyncState(reportId: string): Promise<void>`
- Produces: `deleteReport(id)` также удаляет строку из `syncs`

- [ ] **Step 1: Написать падающие тесты** — дописать в `src/db/db.test.ts`:

```ts
import { getSyncState, putSyncState, deleteSyncState } from './db';
import type { SyncState } from '../types';

describe('sync state', () => {
  it('round-trips a sync state', async () => {
    const st: SyncState = {
      reportId: 'a', reportName: 'Отчёт',
      fields: [{ id: 'f1', name: 'ВД / НД / П', type: 'text', required: false, width: 30 }],
      entries: [{ id: 'e1', reportId: 'a', values: { f1: '120/80' }, createdAt: 5 }],
      syncedAt: 100,
    };
    await putSyncState(st);
    expect(await getSyncState('a')).toEqual(st);
    expect(await getSyncState('zzz')).toBeUndefined();
  });

  it('deleteSyncState removes the row', async () => {
    await putSyncState({ reportId: 'a', reportName: 'R', fields: [], entries: [], syncedAt: 1 });
    await deleteSyncState('a');
    expect(await getSyncState('a')).toBeUndefined();
  });

  it('deleteReport cascades to sync state', async () => {
    await putReport({ id: 'a', name: 'A', fields: [], archived: false, createdAt: 1, updatedAt: 1 });
    await putSyncState({ reportId: 'a', reportName: 'A', fields: [], entries: [], syncedAt: 1 });
    await deleteReport('a');
    expect(await getSyncState('a')).toBeUndefined();
  });
});
```

- [ ] **Step 2: Запустить и убедиться, что падает**

Run: `npx vitest run src/db/db.test.ts`
Expected: FAIL — `getSyncState is not a function` / таблица `syncs` отсутствует.

- [ ] **Step 3: Реализовать** — в `src/types.ts` (после `Entry`):

```ts
export interface SyncState {
  reportId: string;
  reportName: string;
  fields: Field[];
  entries: Entry[];
  syncedAt: number; // мс, время последней записи файла
}
```

В `src/db/db.ts`:

```ts
import type { Report, Entry, Settings, Snapshot, SyncState } from '../types';
```

Класс (после `settings!`):

```ts
  syncs!: Table<SyncState, string>;
```

Конструктор — после существующей v1 (не удалять v1, Dexie мигрирует):

```ts
    this.version(2).stores({
      syncs: 'reportId',
    });
```

`deleteReport` — добавить таблицу в транзакцию и удаление слепка:

```ts
export async function deleteReport(id: string): Promise<void> {
  await db.transaction('rw', db.reports, db.entries, db.syncs, async () => {
    await db.reports.delete(id);
    await db.entries.where('reportId').equals(id).delete();
    await db.syncs.delete(id);
  });
}
```

API в конец файла:

```ts
export async function getSyncState(reportId: string): Promise<SyncState | undefined> {
  return db.syncs.get(reportId);
}

export async function putSyncState(state: SyncState): Promise<void> {
  await db.syncs.put(state);
}

export async function deleteSyncState(reportId: string): Promise<void> {
  await db.syncs.delete(reportId);
}
```

- [ ] **Step 4: Запустить и убедиться, что проходит**

Run: `npx vitest run src/db/db.test.ts`
Expected: PASS (все тесты, включая новые 3).

- [ ] **Step 5: Запустить всю логику целиком (регрессия БД)**

Run: `npx vitest run`
Expected: 85 passed (82 старых + 3 новых).

- [ ] **Step 6: Commit**

```bash
git add src/types.ts src/db/db.ts src/db/db.test.ts
git commit -m "feat: sync state storage in IndexedDB"
```

---

### Task 2: Чистая diff-логика `src/logic/sync.ts`

**Files:**
- Create: `src/logic/sync.ts`
- Test: `src/logic/sync.test.ts`

**Interfaces:**
- Consumes: `Entry` из `../types`
- Produces: `type SyncOutcome = { kind: 'identical' } | { kind: 'append-only'; added: Entry[] } | { kind: 'conflict'; added: Entry[]; modified: Entry[]; deleted: Entry[] }`
- Produces: `classifySync(current: Entry[], synced: Entry[] | undefined): SyncOutcome`
- Produces: `buildSyncJson(report: Pick<Report, 'id' | 'name' | 'fields'>, entries: Entry[], syncedAtMs: number): string`
- Produces: `syncFilename(reportName: string): string`
- Produces: `plural(n: number, forms: [string, string, string]): string` (русские склонения: 1 — forms[0], 2–4 — forms[1], 5+ — forms[2]; исключения 11–14 → forms[2])

- [ ] **Step 1: Написать падающие тесты** — создать `src/logic/sync.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { classifySync, buildSyncJson, syncFilename, plural } from './sync';
import type { Entry, Report } from '../types';

const entry = (id: string, v = 1, createdAt = 0): Entry =>
  ({ id, reportId: 'r1', values: { f1: v }, createdAt });

const report: Pick<Report, 'id' | 'name' | 'fields'> = {
  id: 'r1', name: 'Давление',
  fields: [{ id: 'f1', name: 'ВД / НД / П', type: 'text', required: false, width: 30 }],
};

describe('classifySync', () => {
  it('identical: same ids and values in any order', () => {
    expect(classifySync([entry('a'), entry('b')], [entry('b'), entry('a')]))
      .toEqual({ kind: 'identical' });
  });

  it('append-only: only new ids', () => {
    expect(classifySync([entry('a'), entry('b')], [entry('a')]))
      .toEqual({ kind: 'append-only', added: [entry('b')] });
  });

  it('append-only: several new rows', () => {
    const cur = [entry('a'), entry('b'), entry('c')];
    const out = classifySync(cur, [entry('a')]);
    expect(out.kind).toBe('append-only');
    if (out.kind === 'append-only') expect(out.added).toHaveLength(2);
  });

  it('conflict: modified old row', () => {
    expect(classifySync([entry('a', 2)], [entry('a', 1)]))
      .toEqual({ kind: 'conflict', added: [], modified: [entry('a', 2)], deleted: [] });
  });

  it('conflict: deleted row', () => {
    expect(classifySync([entry('a')], [entry('a'), entry('b')]))
      .toEqual({ kind: 'conflict', added: [], modified: [], deleted: [entry('b')] });
  });

  it('conflict: new + modified together', () => {
    const out = classifySync([entry('a', 2), entry('c')], [entry('a', 1)]);
    expect(out.kind).toBe('conflict');
    if (out.kind === 'conflict') {
      expect(out.added.map(e => e.id)).toEqual(['c']);
      expect(out.modified.map(e => e.id)).toEqual(['a']);
      expect(out.deleted).toHaveLength(0);
    }
  });

  it('first sync (no synced state): all current rows are added', () => {
    const out = classifySync([entry('a'), entry('b')], undefined);
    expect(out.kind).toBe('append-only');
    if (out.kind === 'append-only') expect(out.added).toHaveLength(2);
  });

  it('empty report vs empty synced: identical', () => {
    expect(classifySync([], [])).toEqual({ kind: 'identical' });
    expect(classifySync([], undefined)).toEqual({ kind: 'identical' });
  });
});

describe('buildSyncJson', () => {
  it('produces valid versioned JSON with report meta and entries', () => {
    const json = buildSyncJson(report, [entry('a')], 1000);
    const parsed = JSON.parse(json) as Record<string, unknown>;
    expect(parsed.version).toBe(1);
    expect(parsed.reportId).toBe('r1');
    expect(parsed.reportName).toBe('Давление');
    expect(parsed.syncedAt).toBe('1970-01-01T00:00:01.000Z');
    expect(Array.isArray(parsed.fields)).toBe(true);
    expect((parsed.entries as unknown[])).toHaveLength(1);
    expect(JSON.parse(json)).toHaveProperty('entries.0.values.f1', 1);
  });
});

describe('syncFilename', () => {
  it('sanitizes unsafe chars and appends -sync.json', () => {
    expect(syncFilename('Давление/Утро')).toBe('Давление_Утро-sync.json');
    expect(syncFilename('Отчёт: давление')).toBe('Отчёт_ давление-sync.json');
  });
  it('falls back for empty name', () => {
    expect(syncFilename('   ')).toBe('otchet-sync.json');
  });
});

describe('plural', () => {
  it('handles Russian plural forms', () => {
    const f: [string, string, string] = ['запись', 'записи', 'записей'];
    expect(plural(1, f)).toBe('запись');
    expect(plural(2, f)).toBe('записи');
    expect(plural(5, f)).toBe('записей');
    expect(plural(11, f)).toBe('записей');
    expect(plural(21, f)).toBe('запись');
  });
});
```

- [ ] **Step 2: Запустить и убедиться, что падает**

Run: `npx vitest run src/logic/sync.test.ts`
Expected: FAIL — `Cannot find module './sync'`.

- [ ] **Step 3: Реализовать** — создать `src/logic/sync.ts`:

```ts
import type { Report, Entry } from '../types';

const SUPPORTED_VERSION = 1;

export type SyncOutcome =
  | { kind: 'identical' }
  | { kind: 'append-only'; added: Entry[] }
  | { kind: 'conflict'; added: Entry[]; modified: Entry[]; deleted: Entry[] };

function sameValues(a: Record<string, string | number>, b: Record<string, string | number>): boolean {
  const ka = Object.keys(a);
  const kb = Object.keys(b);
  if (ka.length !== kb.length) return false;
  return ka.every(k => a[k] === b[k]);
}

export function classifySync(current: Entry[], synced: Entry[] | undefined): SyncOutcome {
  const base = synced ?? [];
  const syncedById = new Map(base.map(e => [e.id, e]));
  const currentIds = new Set(current.map(e => e.id));

  const added: Entry[] = [];
  const modified: Entry[] = [];
  const deleted: Entry[] = [];

  for (const e of current) {
    const old = syncedById.get(e.id);
    if (!old) {
      added.push(e);
    } else if (!sameValues(e.values, old.values)) {
      modified.push(e);
    }
  }
  for (const e of base) {
    if (!currentIds.has(e.id)) deleted.push(e);
  }

  if (added.length === 0 && modified.length === 0 && deleted.length === 0) {
    return { kind: 'identical' };
  }
  if (modified.length === 0 && deleted.length === 0) {
    return { kind: 'append-only', added };
  }
  return { kind: 'conflict', added, modified, deleted };
}

export function buildSyncJson(
  report: Pick<Report, 'id' | 'name' | 'fields'>,
  entries: Entry[],
  syncedAtMs: number,
): string {
  return JSON.stringify({
    version: SUPPORTED_VERSION,
    reportId: report.id,
    reportName: report.name,
    syncedAt: new Date(syncedAtMs).toISOString(),
    fields: report.fields,
    entries,
  }, null, 2);
}

export function syncFilename(reportName: string): string {
  const safe = reportName.trim().replace(/[^\wа-яё -]/gi, '_') || 'otchet';
  return `${safe}-sync.json`;
}

export function plural(n: number, forms: [string, string, string]): string {
  const n10 = n % 10;
  const n100 = n % 100;
  if (n10 === 1 && n100 !== 11) return forms[0];
  if (n10 >= 2 && n10 <= 4 && (n100 < 12 || n100 > 14)) return forms[1];
  return forms[2];
}
```

Проверка `sameValues` покрывает и «лишние ключи»: длина ключей разная → `false`.

- [ ] **Step 4: Запустить и убедиться, что проходит**

Run: `npx vitest run src/logic/sync.test.ts`
Expected: PASS (все тесты Task 2).

- [ ] **Step 5: Commit**

```bash
git add src/logic/sync.ts src/logic/sync.test.ts
git commit -m "feat: classify sync diff and build sync file"
```

---

### Task 3: Сохранение файла `src/logic/sync-file.ts`

**Files:**
- Create: `src/logic/sync-file.ts`
- Test: `src/logic/sync-file.test.ts`

**Interfaces:**
- Consumes: `buildSyncJson`, `syncFilename` из `./sync`
- Produces: `saveSyncFile(report: Pick<Report, 'id' | 'name' | 'fields'>, entries: Entry[], syncedAtMs: number): Promise<void>`
  — использует Web Share API (`navigator.share` + `canShare`), при отмене пользователем (AbortError) молча выходит; fallback — Blob + `<a download>`.

- [ ] **Step 1: Написать падающие тесты** — создать `src/logic/sync-file.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest';
import { saveSyncFile } from './sync-file';
import type { Entry, Report } from '../types';

const report: Pick<Report, 'id' | 'name' | 'fields'> = { id: 'r1', name: 'Отчёт АД', fields: [] };
const entries: Entry[] = [{ id: 'e1', reportId: 'r1', values: { f: 1 }, createdAt: 2 }];

describe('saveSyncFile', () => {
  it('uses Web Share API when supported', async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { ...navigator, share, canShare: () => true });
    await saveSyncFile(report, entries, 1000);
    expect(share).toHaveBeenCalledTimes(1);
    const arg = share.mock.calls[0][0] as { files: File[] };
    expect(arg.files[0].name).toBe('Отчёт АД-sync.json');
    expect(arg.files[0].type).toBe('application/json');
    // JSON внутри файла валиден и содержит отчёт
    const text = await arg.files[0].text();
    const parsed = JSON.parse(text) as { reportId: string };
    expect(parsed.reportId).toBe('r1');
    vi.unstubAllGlobals();
  });

  it('ignores user cancellation (AbortError)', async () => {
    const share = vi.fn().mockRejectedValue(new DOMException('cancel', 'AbortError'));
    vi.stubGlobal('navigator', { ...navigator, share, canShare: () => true });
    await expect(saveSyncFile(report, entries, 1000)).resolves.toBeUndefined();
    vi.unstubAllGlobals();
  });

  it('falls back to <a download> when share is unavailable', async () => {
    vi.stubGlobal('navigator', { ...navigator, share: undefined });
    vi.stubGlobal('URL', { createObjectURL: () => 'blob:x', revokeObjectURL: () => {} });
    let clicked = '';
    const origCreate = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation(tag => {
      const el = origCreate(tag);
      if (tag === 'a') el.addEventListener('click', () => { clicked = 'dl'; });
      return el;
    });
    await saveSyncFile(report, entries, 1000);
    expect(clicked).toBe('dl');
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });
});
```

- [ ] **Step 2: Запустить и убедиться, что падает**

Run: `npx vitest run src/logic/sync-file.test.ts`
Expected: FAIL — `Cannot find module './sync-file'`.

- [ ] **Step 3: Реализовать** — создать `src/logic/sync-file.ts`:

```ts
import type { Report, Entry } from '../types';
import { buildSyncJson, syncFilename } from './sync';

export async function saveSyncFile(
  report: Pick<Report, 'id' | 'name' | 'fields'>,
  entries: Entry[],
  syncedAtMs: number,
): Promise<void> {
  const json = buildSyncJson(report, entries, syncedAtMs);
  const name = syncFilename(report.name);
  const file = new File([json], name, { type: 'application/json' });

  if (typeof navigator.share === 'function' && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file] });
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return;
      throw e;
    }
    return;
  }

  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}
```

- [ ] **Step 4: Запустить и убедиться, что проходит**

Run: `npx vitest run src/logic/sync-file.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/logic/sync-file.ts src/logic/sync-file.test.ts
git commit -m "feat: save sync file via Web Share or download"
```

---

### Task 4: Кнопка «Синхронизация» в `ReportScreen`

**Files:**
- Modify: `src/components/ReportScreen.tsx` (кнопка, обработчик, inline-сообщение)
- Test: `src/components/ReportScreen.test.tsx` (новые тесты + добавить кнопку в no-print-проверку)

**Interfaces:**
- Consumes: `classifySync`, `plural` из `../logic/sync`; `getSyncState`, `putSyncState` из `../db/db`; `saveSyncFile` из `../logic/sync-file`
- Produces: кнопка `Синхронизация` (class `no-print`), inline-сообщение `<p className="hint no-print">`

- [ ] **Step 1: Написать падающие тесты** — дописать в `src/components/ReportScreen.test.tsx`:

Заголовок импортов дополнить:

```ts
import { getSyncState, putSyncState } from '../db/db';
import { saveSyncFile } from '../logic/sync-file';

vi.mock('../logic/sync-file', () => ({ saveSyncFile: vi.fn().mockResolvedValue(undefined) }));
const saveSyncMock = vi.mocked(saveSyncFile);
```

В существующем тесте `has hidden .print-title...` в список имен кнопок добавить `'Синхронизация'`:

```ts
for (const name of ['← Назад', 'Настроить поля', 'Архивировать', 'Напоминание', 'Синхронизация', '+ Запись', 'Печать/PDF']) {
```

В `beforeEach` (уже есть reset БД) добавить `saveSyncMock.mockClear();`

Новые тесты (в конец файла):

```ts
const seedWithEntry = async (v: number) => {
  await putReport({ id: 'p1', name: 'Отчёт АД', fields: [], archived: false, createdAt: 1, updatedAt: 1 });
  await putEntry({ id: 'e0', reportId: 'p1', values: { f1: v }, createdAt: 1 });
};

const clickSync = async () => {
  fireEvent.click(await screen.findByRole('button', { name: 'Синхронизация' }));
};

it('first sync creates sync state, saves file and reports creation', async () => {
  await seedWithEntry(0);
  render(<ReportScreen reportId="p1" onBack={() => {}} />);
  await clickSync();
  await waitFor(async () => {
    const st = await getSyncState('p1');
    expect(st?.entries).toHaveLength(1);
  });
  expect(await screen.findByText(/Синхронизация создана \(1/)).toBeInTheDocument();
  expect(saveSyncMock).toHaveBeenCalledTimes(1);
  const [argReport, argEntries] = saveSyncMock.mock.calls[0];
  expect(argReport.name).toBe('Отчёт АД');
  expect(argEntries).toHaveLength(1);
});

it('append-only sync updates state without confirm', async () => {
  await seedWithEntry(0);
  await putSyncState({
    reportId: 'p1', reportName: 'Отчёт АД', fields: [], syncedAt: 1,
    entries: [{ id: 'e0', reportId: 'p1', values: { f1: 0 }, createdAt: 1 }],
  });
  await putEntry({ id: 'e9', reportId: 'p1', values: { f1: 9 }, createdAt: 9 });
  render(<ReportScreen reportId="p1" onBack={() => {}} />);
  const confirmSpy = vi.spyOn(window, 'confirm');
  await clickSync();
  await waitFor(async () => expect((await getSyncState('p1'))?.entries).toHaveLength(2));
  expect(confirmSpy).not.toHaveBeenCalled();
  expect(await screen.findByText(/добавлено 1/)).toBeInTheDocument();
  confirmSpy.mockRestore();
});

it('identical sync reports no actualization needed without touching state', async () => {
  await seedWithEntry(0);
  await putSyncState({
    reportId: 'p1', reportName: 'Отчёт АД', fields: [], syncedAt: 1,
    entries: [{ id: 'e0', reportId: 'p1', values: { f1: 0 }, createdAt: 1 }],
  });
  render(<ReportScreen reportId="p1" onBack={() => {}} />);
  await clickSync();
  expect(await screen.findByText('Актуализация не нужна')).toBeInTheDocument();
  expect(saveSyncMock).not.toHaveBeenCalled();
  expect((await getSyncState('p1'))?.syncedAt).toBe(1);
});

it('conflict with confirm replaces sync state and saves file', async () => {
  await seedWithEntry(5);
  await putSyncState({
    reportId: 'p1', reportName: 'Отчёт АД', fields: [], syncedAt: 1,
    entries: [{ id: 'e0', reportId: 'p1', values: { f1: 999 }, createdAt: 1 }],
  });
  const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
  render(<ReportScreen reportId="p1" onBack={() => {}} />);
  await clickSync();
  await waitFor(async () => {
    const st = await getSyncState('p1');
    expect(st?.entries[0].values.f1).toBe(5);
  });
  expect(await screen.findByText('Файл обновлён')).toBeInTheDocument();
  expect(saveSyncMock).toHaveBeenCalledTimes(1);
  confirmSpy.mockRestore();
});

it('conflict with decline leaves sync state and file untouched', async () => {
  await seedWithEntry(5);
  const orig = {
    reportId: 'p1', reportName: 'Отчёт АД', fields: [], syncedAt: 1,
    entries: [{ id: 'e0', reportId: 'p1', values: { f1: 999 }, createdAt: 1 }],
  };
  await putSyncState(orig);
  const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
  render(<ReportScreen reportId="p1" onBack={() => {}} />);
  await clickSync();
  await waitFor(() => expect(confirmSpy).toHaveBeenCalledTimes(1));
  expect(await screen.findByText('Файл не изменён')).toBeInTheDocument();
  expect(await getSyncState('p1')).toEqual(orig);
  expect(saveSyncMock).not.toHaveBeenCalled();
  confirmSpy.mockRestore();
});
```

- [ ] **Step 2: Запустить и убедиться, что падает**

Run: `npx vitest run src/components/ReportScreen.test.tsx`
Expected: FAIL — кнопка `Синхронизация` не найдена (`findByRole` таймаут).

- [ ] **Step 3: Реализовать** — в `src/components/ReportScreen.tsx`:

Импорты:

```ts
import { classifySync, plural } from '../logic/sync';
import { getSyncState, putSyncState } from '../db/db';
import { saveSyncFile } from '../logic/sync-file';
```

Состояние (рядом с остальными `useState`):

```ts
const [syncMsg, setSyncMsg] = useState('');
```

Обработчик (после `removeReport`):

```ts
const syncReport = async () => {
  try {
    const currentEntries = await listEntries(reportId);
    const synced = await getSyncState(reportId);
    const outcome = classifySync(currentEntries, synced?.entries);
    if (outcome.kind === 'identical') {
      setSyncMsg('Актуализация не нужна');
      return;
    }
    const now = Date.now();
    if (outcome.kind === 'append-only') {
      if (!synced) {
        setSyncMsg(`Синхронизация создана (${currentEntries.length} ${plural(currentEntries.length, ['запись', 'записи', 'записей'])})`);
      } else {
        setSyncMsg(`Синхронизировано: добавлено ${outcome.added.length} ${plural(outcome.added.length, ['строка', 'строки', 'строк'])} (файл обновлён)`);
      }
    } else {
      const ok = window.confirm('В файле синхронизации есть записи, которые были изменены или удалены. Заменить их текущими данными отчёта?');
      if (!ok) {
        setSyncMsg('Файл не изменён');
        return;
      }
      setSyncMsg('Файл обновлён');
    }
    await putSyncState({
      reportId, reportName: report.name, fields: report.fields,
      entries: currentEntries, syncedAt: now,
    });
    await saveSyncFile(report, currentEntries, now);
  } catch {
    setSyncMsg('Не удалось выполнить синхронизацию. Попробуйте ещё раз');
  }
};
```

Кнопка и сообщение — в фрагменте, сразу после кнопки «Напоминание»:

```tsx
<button className="no-print" onClick={() => void syncReport()}>Синхронизация</button>
{syncMsg && <p className="hint no-print">{syncMsg}</p>}
```

ВАЖНО: в обработчике используется свежий `await listEntries(reportId)` (полный список), а не
`visibleEntries` (отфильтрованный по диапазону печати) — синхронизируются ВСЕ записи отчёта.

- [ ] **Step 4: Запустить и убедиться, что проходит**

Run: `npx vitest run src/components/ReportScreen.test.tsx`
Expected: PASS (все старые + новые тесты).

- [ ] **Step 5: Полная проверка проекта**

Run: `npx vitest run && npx tsc -b`
Expected: все тесты зелёные (105: 82 старых + 23 новых), `tsc` без ошибок.

- [ ] **Step 6: Commit**

```bash
git add src/components/ReportScreen.tsx src/components/ReportScreen.test.tsx
git commit -m "feat: sync button in report screen"
```

---

## Self-Review

**Покрытие спеки → задачи:**
- Таблица `syncs` Dexie v2 + каскад при удалении отчёта → Task 1.
- `classifySync`: identical / append-only / conflict, первая синхронизация, пустой отчёт → Task 2 (тесты 1–8).
- `buildSyncJson` + `syncFilename` → Task 2.
- `saveSyncFile` (Web Share + fallback + AbortError) → Task 3.
- Кнопка, поток 3 сценариев, inline-сообщения, confirm → Task 4.
- Тесты на сценарий (логика, БД, UI) → Tasks 1–4 (тест-файлы).

**Placeholder scan:** все шаги содержат полный код; ссылок на неопределённые типы/функции нет.

**Типы согласованы:** `SyncState` (Task 1) → `classifySync`/`buildSyncJson`/`syncFilename`/`plural` (Task 2) → `saveSyncFile` (Task 3) → `ReportScreen` (Task 4). Склонированные сообщения используют `plural` (Task 2).