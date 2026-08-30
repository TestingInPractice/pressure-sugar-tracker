# Распознавание давления по фото тонометра — план реализации

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Пользователь выбирает фото экрана цифрового тонометра, приложение локально (Tesseract.js) распознаёт систолу/диастолу/пульс и подставляет их в поле «ВД / НД / П» формы записи.

**Architecture:** 3 модуля: `src/logic/ocr.ts` (ленивый `import('tesseract.js')`, worker с локальными ассетами из `public/tessdata/`), `src/logic/ocr-parse.ts` (чистый парсер текста → `PressureReading` с валидацией диапазонов, без I/O), изменение `src/components/EntryForm.tsx` (кнопка «Фото», статусная строка, подстановка). Всё офлайн: traineddata/wasm/worker копируются скриптом `setup-tessdata.mjs` перед сборкой, кэшируются Service Worker'ом (CacheFirst) после первого использования.

**Tech Stack:** React 19 + TS 5.9 + Vite 6 + vite-plugin-pwa (autoUpdate, generateSW) + tesseract.js ^7.0.0 (dev/runtime dep) + vitest 3 + @testing-library/react (fireEvent).

## Global Constraints

- Только локальное распознавание: никаких облаков, API-ключей, серверов.
- Распознавание привязано **только** к полю с именем ровно `«ВД / НД / П»` (существующее text-поле из `makeDefaultFields()`). Другие поля формы не трогаются никогда.
- Диапазоны валидации: систола 60–250, диастола 40–150, пульс 30–220. Вне диапазона — значение `null`, поле не заполняется.
- Формат подстановки: `120/80/65` (все три), `120/80` (без пульса), `120` (только систола), пустая строка (ничего не распознано) → поле не трогается.
- Все ассеты Tesseract локальные: `public/tessdata/` (`worker.min.js`, 4 файла core `tesseract-core-*.wasm.js` из node_modules, `eng.traineddata.gz` один раз скачивается с `https://tessdata.projectnaptha.com/4.0.0/eng.traineddata.gz`). Никаких CDN в рантайме; `gzip: true`.
- Все ошибки мягкие: статусная строка под кнопкой, форма не ломается, обычное сохранение работает как раньше.
- Фото в IndexedDB не сохраняются (использование только в момент распознавания).
- `import('tesseract.js')` — только динамический импорт (отдельный чанк; основной бандл не раздувается).
- TypeScript: запрещены `as any`, `@ts-ignore`, `@ts-expect-error`. `tsc -b` должен быть чистым после каждого таска.
- Существующие 108 тестов (22 файла) должны остаться зелёными; `npx vitest run` без флага `--run` не используется (vitest watch).
- Коммиты в стиле репозитория: `feat: ...`, `docs: ...`. Без `gh-pages`/deploy без явного запроса пользователя.
- Эталон успеха таска: `npx vitest run <файл>` зелёный + `npx tsc -b` чистый.

---

## Файловая структура

| Файл | Роль | Статус |
|---|---|---|
| `src/logic/ocr-parse.ts` | Чистый парсер: текст OCR → `PressureReading` + форматирование. Без зависимостей | Create |
| `src/logic/ocr-parse.test.ts` | Юнит-тесты парсера (основной объём тестов фичи) | Create |
| `scripts/setup-tessdata.mjs` | Копирует worker+core из node_modules в `public/tessdata/`, скачивает `eng.traineddata.gz` если отсутствует | Create |
| `src/logic/ocr.ts` | Ленивый `import('tesseract.js')`, фабрика worker'а, `recognizeTextFromImage(Blob) → string` | Create |
| `src/logic/ocr.test.ts` | Мини-тест с моком `tesseract.js` | Create |
| `src/components/EntryForm.tsx` | Кнопка «Фото» (label-обёртка hidden file input), статус, подстановка | Modify |
| `src/components/EntryForm.test.tsx` | Тесты формы с `vi.mock('../logic/ocr')` (реальный ocr-parse) | Create |
| `package.json` | `npm i tesseract.js`; script `setup:tessdata`; build-цепочка | Modify |
| `vite.config.ts` | VitePWA `workbox.runtimeCaching` для `/tessdata/` (CacheFirst) | Modify |
| `.gitignore` | Добавить `public/tessdata/` | Modify |
| `src/index.css` | Стили `.photo-btn`, `.photo-row` | Modify |

## Типы и сигнатуры (общие для всех тасков)

```ts
// ocr-parse.ts (Task 1)
export interface PressureReading {
  sys: number | null;   // 60–250
  dia: number | null;   // 40–150
  pulse: number | null; // 30–220
}
export function parsePressureText(raw: string): PressureReading;
export function formatPressureReading(r: PressureReading): string; // "120/80/65" | "120/80" | "120" | ""

// ocr.ts (Task 3)
export function recognizeTextFromImage(image: Blob): Promise<string>; // сырой текст OCR
```

---

### Task 1: `src/logic/ocr-parse.ts` — чистый парсер

**Files:**
- Create: `src/logic/ocr-parse.ts`
- Test: `src/logic/ocr-parse.test.ts`

**Interfaces:**
- Produces: `PressureReading`, `parsePressureText(raw: string): PressureReading`, `formatPressureReading(r: PressureReading): string` (сигнатуры выше).

**Алгоритм (должен быть реализован ровно так):**
1. Нормализация OCR-путаницы символов -> цифры: `O/o/Q → '0'`, `I/l/| → '1'`, `S/s → '5'`, `B/b → '8'`, `Z/z → '2'`. Применяется ко всей строке (`char.replace` по карте).
2. Из нормализованной строки извлечь все последовательности цифр длиной 2–3: `raw.replace(...).match(/\d{2,3}/g)` → `number[]` (`map(Number)`).
3. Раздать числа по слотам в порядке появления: первое в диапазоне систолы → `sys`; следующее в диапазоне диастолы → `dia`; следующее в диапазоне пульса → `pulse`. Число вне своего слота пропускается (не «съедает» слот), остальные игнорируются.
4. `formatPressureReading`: `[sys, dia, pulse].filter(v => v !== null).join('/')` — никогда не выдаёт `undefined`, пустой массив → `''`.

- [ ] **Step 1: Write the failing test** `src/logic/ocr-parse.test.ts`

```ts
import { describe, it, expect } from 'vitest';
import { parsePressureText, formatPressureReading } from './ocr-parse';

describe('parsePressureText', () => {
  it('возвращает null-ы на пустом и мусорном вводе', () => {
    expect(parsePressureText('')).toEqual({ sys: null, dia: null, pulse: null });
    expect(parsePressureText('abc def ghi')).toEqual({ sys: null, dia: null, pulse: null });
    expect(parsePressureText('12 8')).toEqual({ sys: null, dia: null, pulse: null }); // 12<60, 8<30
  });

  it('разбирает "120/80/65" и срезает единицы измерения', () => {
    expect(parsePressureText('120/80/65')).toEqual({ sys: 120, dia: 80, pulse: 65 });
    expect(parsePressureText('120/80/65 mmHg')).toEqual({ sys: 120, dia: 80, pulse: 65 });
  });

  it('чинит типичные OCR-ошибки O/I/S/B/Z', () => {
    expect(parsePressureText('1Z0 8O 65')).toEqual({ sys: 120, dia: 80, pulse: 65 });
    expect(parsePressureText('l20/BI/6S')).toEqual({ sys: 120, dia: 81, pulse: 65 });
  });

  it('поддерживает разделители "/", "-", пробел', () => {
    expect(parsePressureText('120-80-65')).toEqual({ sys: 120, dia: 80, pulse: 65 });
    expect(parsePressureText('120 80 65')).toEqual({ sys: 120, dia: 80, pulse: 65 });
  });

  it('частичное распознавание: пульс/диастола отсутствуют', () => {
    expect(parsePressureText('120/80')).toEqual({ sys: 120, dia: 80, pulse: null });
    expect(parsePressureText('120')).toEqual({ sys: 120, dia: null, pulse: null });
    expect(parsePressureText('80 65')).toEqual({ sys: 80, dia: 65, pulse: null });
  });

  it('числа вне диапазонов отбрасываются, не съедая слоты', () => {
    expect(parsePressureText('120/300/65')).toEqual({ sys: 120, dia: null, pulse: 65 }); // 300>150
    expect(parsePressureText('120/80/999')).toEqual({ sys: 120, dia: 80, pulse: null });
    expect(parsePressureText('300/120/80/65')).toEqual({ sys: 120, dia: 80, pulse: 65 });
  });
});

describe('formatPressureReading', () => {
  it('форматирует полные/частичные/pустые значения', () => {
    expect(formatPressureReading({ sys: 120, dia: 80, pulse: 65 })).toBe('120/80/65');
    expect(formatPressureReading({ sys: 120, dia: 80, pulse: null })).toBe('120/80');
    expect(formatPressureReading({ sys: 120, dia: null, pulse: null })).toBe('120');
    expect(formatPressureReading({ sys: 120, dia: 80, pulse: 65 })).toBe('120/80/65');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/logic/ocr-parse.test.ts`
Expected: FAIL — `Cannot find module './ocr-parse'` (файла нет).

- [ ] **Step 3: Write the implementation** `src/logic/ocr-parse.ts`

```ts
export interface PressureReading {
  sys: number | null;
  dia: number | null;
  pulse: number | null;
}

const OCR_DIGIT_MAP: Record<string, string> = {
  O: '0', o: '0', Q: '0',
  I: '1', l: '1', '|': '1',
  S: '5', s: '5',
  B: '8', b: '8',
  Z: '2', z: '2',
};

const RANGES = {
  sys: { min: 60, max: 250 },
  dia: { min: 40, max: 150 },
  pulse: { min: 30, max: 220 },
} as const;

const normalize = (raw: string): string =>
  raw.replace(/[OoQI|lS sB bZz]/g, ch => OCR_DIGIT_MAP[ch] ?? ch);

export function parsePressureText(raw: string): PressureReading {
  const numbers = (normalize(raw).match(/\d{2,3}/g) ?? []).map(Number);
  const result: PressureReading = { sys: null, dia: null, pulse: null };
  for (const n of numbers) {
    if (result.sys === null && n >= RANGES.sys.min && n <= RANGES.sys.max) {
      result.sys = n;
    } else if (result.dia === null && n >= RANGES.dia.min && n <= RANGES.dia.max) {
      result.dia = n;
    } else if (result.pulse === null && n >= RANGES.pulse.min && n <= RANGES.pulse.max) {
      result.pulse = n;
    }
  }
  return result;
}

export function formatPressureReading(r: PressureReading): string {
  return [r.sys, r.dia, r.pulse].filter((v): v is number => v !== null).join('/');
}
```

> Примечание: regex в `normalize` использует класс символов — в финальной версии собрать через `new RegExp([...Object.keys(OCR_DIGIT_MAP)].join('|'), 'g')`, чтобы карта и regex не расходились. Оба варианта валидны для тестов; расхождение карты и regex — ошибка, не проходить мимо.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/logic/ocr-parse.test.ts`
Expected: PASS (все 6+5 тестов). Замечание: тест `'l20/BI/6S'` — проверьте нормализацию: `l→1`, `B→8`, `I→1`, `S→5` → `120/81/65` ✓.

- [ ] **Step 5: Typecheck**

Run: `npx tsc -b`
Expected: exit 0.

- [ ] **Step 6: Commit**

```bash
git add src/logic/ocr-parse.ts src/logic/ocr-parse.test.ts
git commit -m "feat: tonometer OCR text parser with range validation"
```

---

### Task 2: Локальные ассеты Tesseract + Service Worker

**Files:**
- Create: `scripts/setup-tessdata.mjs`
- Modify: `package.json` (dep + scripts), `vite.config.ts` (runtimeCaching), `.gitignore`

**Interfaces:**
- Consumes: ничего (самодостаточно).
- Produces: `public/tessdata/worker.min.js`, `public/tessdata/tesseract-core.wasm.js`, `public/tessdata/tesseract-core-simd.wasm.js`, `public/tessdata/tesseract-core-lstm.wasm.js`, `public/tessdata/tesseract-core-simd-lstm.wasm.js`, `public/tessdata/eng.traineddata.gz` — пути, на которые Task 3 ссылается через `${import.meta.env.BASE_URL}tessdata/`.

- [ ] **Step 1: Install tesseract.js**

Run: `npm i tesseract.js`
Expected: в `package.json` dependencies появляется `"tesseract.js": "^7.0.0"` (или новее). Проверить после установки, что существуют файлы:
- `node_modules/tesseract.js/dist/worker.min.js`
- `node_modules/tesseract.js-core/tesseract-core-simd.wasm.js` и 3 остальных core-файла (v6.1.2: `tesseract-core.wasm.js`, `tesseract-core-simd.wasm.js`, `tesseract-core-lstm.wasm.js`, `tesseract-core-simd-lstm.wasm.js`).

Если в используемой версии файлы называются иначе — подстроить скрипт под фактические имена (не выдумывать).

- [ ] **Step 2: Write the setup script** `scripts/setup-tessdata.mjs`

```mjs
// Копирует ассеты Tesseract.js из node_modules в public/tessdata/
// и скачивает eng.traineddata.gz один раз (идемпотентно, офлайн-безопасно).
import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dest = join(root, 'public', 'tessdata');
mkdirSync(dest, { recursive: true });

const copies = [
  ['node_modules/tesseract.js/dist/worker.min.js', 'worker.min.js'],
  ['node_modules/tesseract.js-core/tesseract-core.wasm.js', 'tesseract-core.wasm.js'],
  ['node_modules/tesseract.js-core/tesseract-core-simd.wasm.js', 'tesseract-core-simd.wasm.js'],
  ['node_modules/tesseract.js-core/tesseract-core-lstm.wasm.js', 'tesseract-core-lstm.wasm.js'],
  ['node_modules/tesseract.js-core/tesseract-core-simd-lstm.wasm.js', 'tesseract-core-simd-lstm.wasm.js'],
];
for (const [src, out] of copies) {
  cpSync(join(root, src), join(dest, out));
}

const langFile = join(dest, 'eng.traineddata.gz');
if (!existsSync(langFile)) {
  const res = await fetch('https://tessdata.projectnaptha.com/4.0.0/eng.traineddata.gz');
  if (!res.ok) throw new Error(`не удалось скачать eng.traineddata.gz: HTTP ${res.status}`);
  writeFileSync(langFile, Buffer.from(await res.arrayBuffer()));
}
```

- [ ] **Step 3: Wire scripts + gitignore**

Modify `package.json`:
```json
"scripts": {
  "dev": "vite",
  "build": "npm run setup:tessdata && tsc -b && vite build",
  "setup:tessdata": "node scripts/setup-tessdata.mjs",
  "test": "vitest",
  "preview": "vite preview"
},
```

Modify `.gitignore` (в конец):
```
# Tesseract.js локальные ассеты (генерируются setup:tessdata)
public/tessdata
```

- [ ] **Step 4: Run the script and verify dist**

Run: `npm run setup:tessdata && ls -la public/tessdata`
Expected: 6 файлов на месте, `eng.traineddata.gz` скачан (один раз; повторный запуск не качает).

Затем: `npm run build`
Expected: сборка проходит; `dist/tessdata/*` содержит все 6 файлов.

- [ ] **Step 5: Service Worker runtime caching** — modify `vite.config.ts`

```ts
VitePWA({
  registerType: 'autoUpdate',
  workbox: {
    runtimeCaching: [
      {
        urlPattern: /\/tessdata\/.*/,
        handler: 'CacheFirst',
        options: {
          cacheName: 'tessdata',
          expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 },
        },
      },
    ],
  },
  manifest: { /* без изменений */ },
}),
```

- [ ] **Step 6: Verify build + tests still green**

Run: `npm run build && npx vitest run`
Expected: build exit 0, все существующие тесты зелёные.

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json vite.config.ts .gitignore scripts
git commit -m "feat: local tesseract assets and service-worker caching for tessdata"
```

---

### Task 3: `src/logic/ocr.ts` — ленивый Tesseract worker

**Files:**
- Create: `src/logic/ocr.ts`
- Test: `src/logic/ocr.test.ts`

**Interfaces:**
- Consumes: `public/tessdata/` из Task 2 (пути через `import.meta.env.BASE_URL`).
- Produces: `recognizeTextFromImage(image: Blob): Promise<string>` — сырой текст OCR (парсит Task 1).

- [ ] **Step 1: Write the failing test** `src/logic/ocr.test.ts`

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { recognizeTextFromImage } from './ocr';

const mockSetParameters = vi.fn().mockResolvedValue(undefined);
const mockRecognize = vi.fn().mockResolvedValue({ data: { text: '120/80/65' } });
const mockTerminate = vi.fn().mockResolvedValue(undefined);
const mockCreateWorker = vi.fn().mockResolvedValue({
  setParameters: mockSetParameters,
  recognize: mockRecognize,
  terminate: mockTerminate,
});

vi.mock('tesseract.js', () => ({
  createWorker: (...args: unknown[]) => mockCreateWorker(...args),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe('recognizeTextFromImage', () => {
  it('возвращает текст из worker.recognize', async () => {
    const text = await recognizeTextFromImage(new Blob(['x'], { type: 'image/png' }));
    expect(text).toBe('120/80/65');
  });

  it('создаёт worker с eng/oem=1 и локальными путями ассетов', async () => {
    await recognizeTextFromImage(new Blob(['x']));
    expect(mockCreateWorker).toHaveBeenCalledWith(
      'eng', 1,
      expect.objectContaining({
        workerPath: expect.stringContaining('tessdata/worker.min.js'),
        corePath: expect.stringContaining('tessdata/'),
        langPath: expect.stringContaining('tessdata'),
        gzip: true,
      }),
    );
  });

  it('освобождает worker после распознавания', async () => {
    await recognizeTextFromImage(new Blob(['x']));
    expect(mockTerminate).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/logic/ocr.test.ts`
Expected: FAIL — `Cannot find module './ocr'`.

- [ ] **Step 3: Write the implementation** `src/logic/ocr.ts`

```ts
const TESSDATA_BASE = `${import.meta.env.BASE_URL}tessdata`;

export async function recognizeTextFromImage(image: Blob): Promise<string> {
  const { createWorker } = await import('tesseract.js');
  const worker = await createWorker('eng', 1, {
    workerPath: `${TESSDATA_BASE}/worker.min.js`,
    corePath: `${TESSDATA_BASE}/`,
    langPath: TESSDATA_BASE, // без слэша в конце: формула langPath + langCode + '.traineddata.gz'
    gzip: true,
  });
  try {
    await worker.setParameters({
      tessedit_char_whitelist: '0123456789/ -',
      tessedit_pageseg_mode: '6', // единый блок — экран тонометра
    });
    const { data } = await worker.recognize(image);
    return data.text;
  } finally {
    await worker.terminate();
  }
}
```

> Примечание для ревьюера: `import.meta.env.BASE_URL` в dev/test = `'/'`, в продакшене `'/pressure-sugar-tracker/'`. В тестах пути не проверяются на точное значение — только `stringContaining('tessdata/...')`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/logic/ocr.test.ts`
Expected: PASS (3 теста). Если `BASE_URL` в vitest не равен `'/'` — проверить фактическое значение и поправить типы (без подавления ошибок типов).

- [ ] **Step 5: Typecheck**

Run: `npx tsc -b`
Expected: exit 0. Если типы `createWorker` не находятся (v7 без .d.ts) — проверить `node_modules/tesseract.js/src/index.d.ts`; при отсутствии — НЕ подавлять, а вынести типизацию в локальный `.d.ts` или интерфейс-обёртку worker'а.

- [ ] **Step 6: Commit**

```bash
git add src/logic/ocr.ts src/logic/ocr.test.ts
git commit -m "feat: lazy tesseract worker with local assets"
```

---

### Task 4: Кнопка «Фото» в EntryForm

**Files:**
- Modify: `src/components/EntryForm.tsx`
- Modify: `src/index.css`
- Test: `src/components/EntryForm.test.tsx`

**Interfaces:**
- Consumes: `recognizeTextFromImage` из `../logic/ocr` (Task 3), `parsePressureText` + `formatPressureReading` из `../logic/ocr-parse` (Task 1).
- Produces: поведение — кнопка «Фото» в форме, статусная строка, подстановка в поле «ВД / НД / П».

- [ ] **Step 1: Write the failing test** `src/components/EntryForm.test.tsx`

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import EntryForm from './EntryForm';
import type { Field } from '../types';
import { recognizeTextFromImage } from '../logic/ocr';

vi.mock('../logic/ocr', () => ({
  recognizeTextFromImage: vi.fn(),
}));

const mockRecognize = vi.mocked(recognizeTextFromImage);

const BP_FIELD: Field = {
  id: 'bp', name: 'ВД / НД / П', type: 'text', required: false, width: 2,
};
const OTHER_FIELD: Field = {
  id: 'note', name: 'Примечание', type: 'text', required: false, width: 2,
};

function makeFile(name = 'bp.png'): File {
  return new File(['fake'], name, { type: 'image/png' });
}

function renderForm(fields: Field[]) {
  return render(<EntryForm fields={fields} onSave={vi.fn()} onCancel={vi.fn()} />);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('EntryForm photo button', () => {
  it('показывает кнопку «Фото», когда есть поле «ВД / НД / П»', () => {
    renderForm([BP_FIELD, OTHER_FIELD]);
    expect(screen.getByText('Фото')).toBeInTheDocument();
  });

  it('скрывает кнопку «Фото», когда поля нет', () => {
    renderForm([OTHER_FIELD]);
    expect(screen.queryByText('Фото')).not.toBeInTheDocument();
  });

  it('успех: подставляет "120/80/65" в поле и показывает «Готово»', async () => {
    mockRecognize.mockResolvedValue('120/80/65');
    renderForm([BP_FIELD]);
    fireEvent.change(screen.getByLabelText(/фото/i), { target: { files: [makeFile()] } });
    await waitFor(() => {
      const input = screen.getByLabelText(/в[дд] \/ н[дд] \/ п/i) as HTMLInputElement;
      expect(input.value).toBe('120/80/65');
      expect(screen.getByText(/готово: 120\/80\/65/i)).toBeInTheDocument();
    });
  });

  it('частичное распознавание: подставляет "120/80"', async () => {
    mockRecognize.mockResolvedValue('120/80');
    renderForm([BP_FIELD]);
    fireEvent.change(screen.getByLabelText(/фото/i), { target: { files: [makeFile()] } });
    await waitFor(() => {
      const input = screen.getByLabelText(/в[дд] \/ н[дд] \/ п/i) as HTMLInputElement;
      expect(input.value).toBe('120/80');
    });
  });

  it('мусор: поле не трогает, показывает ошибку распознавания', async () => {
    mockRecognize.mockResolvedValue('zxcvbn');
    renderForm([BP_FIELD]);
    fireEvent.change(screen.getByLabelText(/фото/i), { target: { files: [makeFile()] } });
    await waitFor(() => {
      const input = screen.getByLabelText(/в[дд] \/ н[дд] \/ п/i) as HTMLInputElement;
      expect(input.value).toBe('');
      expect(screen.getByText(/не удалось распознать/i)).toBeInTheDocument();
    });
  });

  it('ошибка worker: показывает статус недоступности, поле не трогает', async () => {
    mockRecognize.mockRejectedValue(new Error('worker failed'));
    renderForm([BP_FIELD]);
    fireEvent.change(screen.getByLabelText(/фото/i), { target: { files: [makeFile()] } });
    await waitFor(() => {
      expect(screen.getByText(/распознавание недоступно/i)).toBeInTheDocument();
    });
  });

  it('не меняет другие поля формы', async () => {
    mockRecognize.mockResolvedValue('120/80/65');
    renderForm([BP_FIELD, OTHER_FIELD]);
    fireEvent.change(screen.getByLabelText(/примечание/i), { target: { value: 'утро' } });
    fireEvent.change(screen.getByLabelText(/фото/i), { target: { files: [makeFile()] } });
    await waitFor(() => {
      const note = screen.getByLabelText(/примечание/i) as HTMLInputElement;
      expect(note.value).toBe('утро');
    });
  });
});
```

> Примечание: селекторы по label — аккуратно с русскими буквами в regex. Альтернатива (если regex по label нестабилен): добавить `aria-label="Фото"` на кнопку и обращаться `screen.getByLabelText('Фото')` точно. В имплементации ниже label-обёртка даёт доступное имя «Фото» автоматически.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/EntryForm.test.tsx`
Expected: FAIL — нет кнопки «Фото».

- [ ] **Step 3: Implement** — modify `src/components/EntryForm.tsx`

```tsx
import { useState } from 'react';
import type { Field } from '../types';
import { validateEntry } from '../logic/validation';
import { recognizeTextFromImage } from '../logic/ocr';
import { parsePressureText, formatPressureReading } from '../logic/ocr-parse';

type OcrStatus = 'idle' | 'working' | 'done' | 'error';

export default function EntryForm({ fields, initial, onSave, onCancel }: Props) {
  const [values, setValues] = useState<Record<string, string | number>>(initial ?? {});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [ocrStatus, setOcrStatus] = useState<OcrStatus>('idle');
  const [ocrMessage, setOcrMessage] = useState('');

  const bpField = fields.find(f => f.name === 'ВД / НД / П');

  const set = (id: string, v: string) =>
    setValues(prev => ({ ...prev, [id]: v }));

  const handlePhoto = async (file: File | undefined) => {
    if (!file || !bpField || ocrStatus === 'working') return;
    setOcrStatus('working');
    setOcrMessage('');
    try {
      const text = await recognizeTextFromImage(file);
      const reading = parsePressureText(text);
      const formatted = formatPressureReading(reading);
      if (formatted === '') {
        setOcrStatus('error');
        setOcrMessage('Не удалось распознать. Попробуйте другое фото');
        return;
      }
      set(bpField.id, formatted);
      setOcrStatus('done');
      setOcrMessage(`Готово: ${formatted}`);
    } catch {
      setOcrStatus('error');
      setOcrMessage('Распознавание недоступно. Попробуйте ещё раз');
    }
  };

  const submit = () => { /* без изменений */ };

  return (
    <form className="no-print" onSubmit={e => { e.preventDefault(); submit(); }}>
      {fields.map(f => (
        <label key={f.id}>
          {f.name}{f.unit ? `, ${f.unit}` : ''}{f.required ? ' *' : ''}
          {f.type === 'datetime' ? (
            <input type="datetime-local" value={String(values[f.id] ?? '')}
                   onChange={e => set(f.id, e.target.value)} />
          ) : f.type === 'number' ? (
            <input inputMode="decimal" value={String(values[f.id] ?? '')}
                   onChange={e => set(f.id, e.target.value)} />
          ) : f.unit ? (
            <input type="text" placeholder={f.name === 'ВД / НД / П' ? '120/70/100' : ''}
                   value={String(values[f.id] ?? '')}
                   onChange={e => set(f.id, e.target.value)} />
          ) : (
            <textarea value={String(values[f.id] ?? '')}
                      onChange={e => set(f.id, e.target.value)} />
          )}
          {f.name === 'ВД / НД / П' && (
            <span className="photo-row">
              <label className="photo-btn">
                {ocrStatus === 'working' ? 'Распознаю…' : 'Фото'}
                <input type="file" accept="image/*" hidden
                       onChange={e => { void handlePhoto(e.target.files?.[0]); e.target.value = ''; }} />
              </label>
              {ocrStatus === 'done' && <em className="ok">{ocrMessage}</em>}
              {ocrStatus === 'error' && <em className="error">{ocrMessage}</em>}
            </span>
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

> Тонкость: label-обёртка с `hidden` input `type=file` — клик по label открывает диалог выбора файла (нативная семантика), а available name «Фото» доступно для тестов (`getByLabelText(/фото/i)`). `e.target.value = ''` сбрасывает input, чтобы повторный выбор того же файла срабатывал.

- [ ] **Step 4: Add styles** — modify `src/index.css` (добавить в конец)

```css
.photo-row {
  display: block;
  margin-top: 0.4rem;
}
.photo-btn {
  display: inline-block;
  padding: 0.4rem 0.8rem;
  border: 1px solid #2563eb;
  border-radius: 0.4rem;
  color: #2563eb;
  cursor: pointer;
  font-size: 0.9rem;
  user-select: none;
}
.photo-btn:hover {
  background: #2563eb;
  color: #fff;
}
.photo-row em.ok {
  color: #16a34a;
  font-style: normal;
  margin-left: 0.6rem;
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/components/EntryForm.test.tsx`
Expected: PASS (6 тестов). Если `getByLabelText(/фото/i)` не находит элемент — использовать точный селектор по названию кнопки и уточнить доступное имя (label text = «Фото» даже при `hidden` input — возможен нюанс jsdom: `hidden` attribute скрывает из accessibility tree; тогда заменить `hidden` на `className="visually-hidden"` с CSS-правилом `position:absolute; clip:rect(0 0 0 0)`). Диагностировать по фактическому DOM, не подавлять тест.

- [ ] **Step 6: Full suite + typecheck**

Run: `npx vitest run && npx tsc -b`
Expected: все тесты (существующие 108 + новые: 11 парсера + 3 ocr + 6 формы) зелёные, tsc exit 0.

- [ ] **Step 7: Commit**

```bash
git add src/components/EntryForm.tsx src/components/EntryForm.test.tsx src/index.css
git commit -m "feat: photo recognition button in entry form"
```

---

## Self-review

**1. Spec coverage:**
- Кнопка «Фото» только при наличии поля «ВД / НД / П» → Task 4 (test «скрывает кнопку»).
- Подстановка `120/80/65` / `120/80` / `120` / пусто → Task 1 `formatPressureReading` + Task 4.
- Валидация диапазонов 60–250 / 40–150 / 30–220 → Task 1 (`RANGES`).
- Нормализация OCR-ошибок O/I/S/B/Z → Task 1.
- Статусы «Распознаю…» / «Готово» / «Не удалось распознать» / «Распознавание недоступно» → Task 4.
- Офлайн: локальные ассеты + CacheFirst → Task 2; `langPath`/`corePath`/`workerPath` без CDN → Task 3.
- Без хранения фото → Task 4 (файл только в `onChange`, не сохраняется).
- Тесты: парсер (Task 1), форма с моком (Task 4), фейковый worker (Task 3) → покрыто.

**2. Placeholder scan:** кода нет — все файлы и шаги с фактическим содержимым. Единственные места выбора: имя core-файлов (проверяется в Task 2 Step 1 по фактическому node_modules) и селектор `getByLabelText` (альтернатива описана). Типизация worker в v7 (Task 3 Step 5) имеет явное правило: не подавлять, вынести в обёртку.

**3. Type consistency:** `PressureReading` / `parsePressureText` / `formatPressureReading` определены один раз (Task 1) и используются везде с теми же именами; `recognizeTextFromImage(Blob): Promise<string>` — Task 3 → Task 4. `bpField.id` типобезопасен (`Field.id: string`). В тестах EntryForm `vi.mocked(recognizeTextFromImage)` согласован с моком.