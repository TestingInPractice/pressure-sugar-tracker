# Переключатель обозначений давления (3 варианта) — план реализации

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Единый переключатель обозначений полей давления (САД/ДАД/Пульс · ВД/НД/П · SYS/DIA/PULSE), применяемый единообразно: форма, таблица, графики, нормы, PDF.

**Architecture:** Словарь `BP_LABEL_VARIANTS` + React Context `useBpLabelVariant` (провайдер в App, localStorage `bp-label-variant`). Вариант применяется ТОЛЬКО при отображении — данные (`Field.name`/`parts[].label`) не меняются. Новый компонент `BpLabelSwitcher` — 3-позиционный переключатель со сдвигом максимум на 1 позицию за клик.

**Tech Stack:** React 19, TypeScript, Vite, vitest, localStorage.

## Global Constraints

- Данные не изменяются: IndexedDB, бэкапы, синхронизация, `isBPFieldName` — не трогать.
- Запрещены `as any`, `@ts-ignore`, `@ts-expect-error`, non-null `!`.
- Существующие 299 тестов должны остаться зелёными (кроме осознанных обновлений строк «Верхнее/Нижнее» → «САД/ДАД», согласованных в дизайне).
- Никаких новых зависимостей.
- Коммиты НЕ выполняет агент — выполнять `npx vitest run` и `npx tsc -b` обязан.

---

### Task 1: Словарь — `src/logic/bp-labels.ts` (новый)

**Files:**
- Create: `src/logic/bp-labels.ts`
- Test: `src/logic/bp-labels.test.ts` (новый)

**Interfaces:**
- Consumes: — (чистый модуль)
- Produces:
  - `export type BpLabelVariant = 'sad' | 'vd' | 'en'`
  - `export interface BpLabelSet { name: string; sys: string; dia: string; pulse: string; sysLong: string; diaLong: string; pulseLong: string; chartSys: string; chartDia: string; chartPulse: string; normSys: string; normDia: string; normPulse: string }`
  - `export const BP_LABEL_VARIANTS: Record<BpLabelVariant, BpLabelSet>`
  - `export const BP_LABEL_VARIANTS_LIST: { id: BpLabelVariant; label: string }[]`
  - `export const DEFAULT_BP_LABEL_VARIANT: BpLabelVariant`

- [ ] **Шаг 1: Написать тест**

Содержимое словаря (точные строки — единственный источник истины для всех задач):

| Поле | sad | vd | en |
|---|---|---|---|
| name | `САД / ДАД / Пульс` | `ВД / НД / П` | `SYS / DIA / PULSE` |
| sys | `САД` | `ВД` | `SYS` |
| dia | `ДАД` | `НД` | `DIA` |
| pulse | `Пульс` | `П` | `PULSE` |
| sysLong | `Систолическое (САД)` | `Верхнее (ВД)` | `SYS` |
| diaLong | `Диастолическое (ДАД)` | `Нижнее (НД)` | `DIA` |
| pulseLong | `Пульс` | `Пульс (П)` | `PULSE` |
| chartSys | `САД` | `ВД` | `SYS` |
| chartDia | `ДАД` | `НД` | `DIA` |
| chartPulse | `Пульс` | `Пульс` | `PULSE` |
| normSys | `Норма САД` | `Норма ВД` | `Norm SYS` |
| normDia | `Норма ДАД` | `Норма НД` | `Norm DIA` |
| normPulse | `Норма пульса` | `Норма пульса` | `Norm PULSE` |

`BP_LABEL_VARIANTS_LIST = [{ id: 'sad', label: 'САД' }, { id: 'vd', label: 'ВД' }, { id: 'en', label: 'SYS' }]`.

Тест: все 3 варианта присутствуют, все 13 полей непусты, id списка = ключам словаря, порядок sad→vd→en.

- [ ] **Шаг 2: Прогнать тест** — ожидается FAIL (модуля нет)
- [ ] **Шаг 3: Реализовать `bp-labels.ts`** — как в таблице.
- [ ] **Шаг 4: Прогнать тест** — PASS
- [ ] **Шаг 5: `npx vitest run`** — все файлы зелёные

---

### Task 2: Контекст — `src/hooks/useBpLabelVariant.tsx` (новый)

**Files:**
- Create: `src/hooks/useBpLabelVariant.tsx`
- Modify: `src/App.tsx` (обернуть `<main>`-контент в провайдер)

**Interfaces:**
- Consumes: `BpLabelVariant`, `BpLabelSet`, `BP_LABEL_VARIANTS`, `DEFAULT_BP_LABEL_VARIANT` из `bp-labels`
- Produces:
  - `export function BpLabelVariantProvider({ children }: { children: ReactNode })` — ленивая инициализация из `localStorage.getItem('bp-label-variant')` (валидация: значение из `ROWS`), персист через `useEffect` на изменение.
  - `export function useBpLabelVariant(): { variant: BpLabelVariant; labels: BpLabelSet; setVariant: (v: BpLabelVariant) => void }` — вне провайдера возвращает `DEFAULT_BP_LABEL_VARIANT` (не падать, чтобы не ломать существующие тесты компонентов без провайдера).

- [ ] **Шаг 1: Реализовать файл** (тест на контекст не обязателен — покрывается Task 3-6; но допустим мини-тест рендера с провайдером).
- [ ] **Шаг 2: `App.tsx`** — импорт `BpLabelVariantProvider`, обернуть всё внутри `<div className="app">` (или только `<main>`) — провайдер должен покрывать DashboardTab и ReportScreen. Меню/таббар неважно. Оборачивать ВНУТРИ return: `<BpLabelVariantProvider>…</BpLabelVariantProvider>` на верхнем уровне.
- [ ] **Шаг 3: `npx vitest run`** — зелёно (App.test и др. без провайдера не падают — хук имеет default).

---

### Task 3: Переключатель — `src/components/BpLabelSwitcher.tsx` (новый) + CSS

**Files:**
- Create: `src/components/BpLabelSwitcher.tsx`
- Modify: `src/index.css` (рядом с `.segmented`)
- Test: `src/components/BpLabelSwitcher.test.tsx` (новый)

**Interfaces:**
- Consumes: `useBpLabelVariant`, `BP_LABEL_VARIANTS_LIST`
- Produces: `export default function BpLabelSwitcher()` — рендер 3 кнопок `САД | ВД | SYS`

**Поведение:**
- Контейнер `className="segmented"` + `role="group"` `aria-label="Обозначения давления"` (стиль как в DashboardTab).
- Кнопки с `aria-pressed={variant === item.id}`.
- **Сдвиг только на 1 за клик**: клик по кнопке с индексом `k` при текущем индексе `i`:
  - `k === i` → ничего
  - `|k - i| === 1` → `setVariant(k)`
  - `|k - i| > 1` → шагнуть на 1 в сторону клика: `setVariant(i + Math.sign(k - i))` (не перепрыгивать)
- inline-подпись перед кнопками: `<span className="segmented-hint">Обозначения:</span>` (12px, `--text-secondary`).
- CSS: минимальный `.segmented-hint` в `index.css` рядом с `.segmented` (существующие стили кнопок переиспользуются).

- [ ] **Шаг 1: Написать тест** — клик на соседнюю переключает; клик через позицию двигает ровно на 1; `aria-pressed` корректен; отображаются `САД`, `ВД`, `SYS`.
- [ ] **Шаг 2: Прогнать тест** — FAIL
- [ ] **Шаг 3: Реализовать компонент + CSS**
- [ ] **Шаг 4: Прогнать тест** — PASS
- [ ] **Шаг 5: `npx vitest run`**

---

### Task 4: TrendChart — вариант в сериях и таргетах

**Files:**
- Modify: `src/components/TrendChart.tsx`

**Изменения сигнатур (опциональный последний параметр, обратная совместимость):**
- `buildMetricSeries(entries, fields, metric, variant: BpLabelVariant = 'sad')`:
  - bp: `label: labels.chartSys` / `labels.chartDia`
  - pulse: `label: labels.chartPulse`
  - srad/sugar: без изменений (`СрАд` / `Сахар` — не входят в варианты)
- `buildMetricTargets(targets, metric, variant: BpLabelVariant = 'sad')`:
  - bp: `'Норма ВД'` → `labels.normSys`, `'Норма НД'` → `labels.normDia`
  - pulse: `'Норма пульса'` → `labels.normPulse`
  - sugar: без изменений

- [ ] **Шаг 1: Реализовать** (импорт типа + словаря)
- [ ] **Шаг 2: `npx vitest run`** — существующие тесты TrendChart ожидают «Верхнее/Нижнее» → обновить их на «САД/ДАД» (sad — дефолт). Это осознанное изменение по дизайну. Проверить также DashboardTab.test, ReportScreen.test, pdf-export.test на «Верхнее»/«Нижнее» и обновить.

---

### Task 5: EntryForm — подписи полей давления

**Files:**
- Modify: `src/components/EntryForm.tsx`

- [ ] **Шаг 1: Использовать вариант** (хук `useBpLabelVariant` внутри компонента):
  - BP-блок (строки ~73-89): подпись `.bp-label` — если `f.name` BP-поле (`isBPFieldName(f.name)`), показывать `labels.name` вместо `f.name`. Подписи `parts` (строка ~81 `{p.label}`): для полей типа `'bp'` заменять на вариант по id части: `systolic → labels.sys`, `diastolic → labels.dia`, `pulse → labels.pulse` (по стабильным id, НЕ индексу).
  - Legacy-блок (строки ~94-117): `.bp-label` — `labels.name`; подписи (строка 107 `'САД'/'ДАД'/'Пульс'`) — `labels.sys/dia/pulse`.
- [ ] **Шаг 2: Тест** — `EntryForm.test.tsx`: добавить тест с обёрткой провайдера variant='vd' → подписи `ВД/НД/П` и заголовок `ВД / НД / П`. (Существующие тесты без провайдера → default sad → зелёные.)
- [ ] **Шаг 3: `npx vitest run`**

---

### Task 6: EntriesTable — заголовок колонки

**Files:**
- Modify: `src/components/EntriesTable.tsx`

- [ ] **Шаг 1: Вариант в заголовке** (хук в компоненте): строка ~114 `{f.name}` — если `isBPFieldName(f.name)`, рендерить `labels.name`. `unit`/звёздочка — без изменений. Импорт `useBpLabelVariant`, `isBPFieldName` (уже ли есть импорт? проверить).
- [ ] **Шаг 2: Тест** — `EntriesTable.test.tsx`: вариант 'vd' → заголовок `ВД / НД / П`; по умолчанию sad → `САД / ДАД / Пульс`.
- [ ] **Шаг 3: `npx vitest run`**

---

### Task 7: ReportScreen — нормы, печать, PDF

**Files:**
- Modify: `src/components/ReportScreen.tsx`

- [ ] **Шаг 1: Вариант в точке норм**:
  - `TARGET_LABELS` (строка 25): заменить константу на использование `labels.sysLong / labels.diaLong / labels.pulseLong` для sys/dia/pulse (sugar — `Сахар`, не меняется). Применяется в панели «Мои нормы».
  - `targetsSummary()` (строки 191-199): `САД` → `labels.sys`, `ДАД` → `labels.dia`, `Пульс` → `labels.pulse` (sugar — без изменений).
- [ ] **Шаг 2: Передать вариант в графики**: `buildMetricSeries`/`buildMetricTargets` вызовы (printSeries и exportPdf charts) — передать `variant` из хука.
- [ ] **Шаг 3: PdfMeta.bpFieldName** — при экспорте передать `bpFieldName: labels.name`.
- [ ] **Шаг 4: Тесты** — `ReportScreen.test.tsx`: вариант 'vd' → строка норм `ВД 120 · НД 80`; вариант 'en' → заголовки норм `SYS`/`DIA`/`PULSE`. Существующие тесты «Систолическое (САД)», «САД 120 · ДАД 80» — обновить на sad-строки при необходимости (они и есть sad — должны остаться зелёными, т.к. default sad; проверить).
- [ ] **Шаг 5: `npx vitest run`**

---

### Task 8: PDF — заголовок колонки давления

**Files:**
- Modify: `src/logic/pdf-export.ts`

- [ ] **Шаг 1: `PdfMeta.bpFieldName?: string`** (строка 23-27). В месте формирования `head` (строка ~225 `head: [fields.map(FIELD_HEAD)]`): подменять `f.name` на `meta.bpFieldName`, если `isBPFieldName(f.name)` и bpFieldName задан (импорт `isBPFieldName` из `classification`). FIELD_HEAD оставить, но в map использовать обёртку.
- [ ] **Шаг 2: Тест** — `pdf-export.test.ts`: `buildReportPdfBytes(report, [entry], { bpFieldName: 'SYS / DIA / PULSE' })` → строка байтов содержит подпись (проверить через поиск в байтах/в decode, либо заголовок таблицы не проверяем байтово — можно декодировать всю строку и проверить `includes`; приём: `new TextDecoder().decode(bytes)` содержит `SYS / DIA / PULSE`).
- [ ] **Шаг 3: `npx vitest run`**

---

### Task 9: DashboardTab — разместить переключатель

**Files:**
- Modify: `src/components/DashboardTab.tsx`

- [ ] **Шаг 1: Рендер** — импорт `BpLabelSwitcher`; размещение в `.dash-chart__controls` (над графиком, рядом с сегментом показателя/периода). Передать `variant` в вызовы `buildMetricSeries`/`buildMetricTargets` (хук в компоненте).
- [ ] **Шаг 2: Тест** — `DashboardTab.test.tsx`: `САД | ВД | SYS` кнопки присутствуют; клик «ВД» → кнопка `aria-pressed`; легенда графика меняет «САД» на «ВД» (после клика). Обновить существующие ожидания «Верхнее/Нижнее» → «САД/ДАД».
- [ ] **Шаг 3: `npx vitest run` + `npx tsc -b`** — обе команды зелёные.

---

## Self-Review

- Покрытие спеки: словарь (T1), контекст+localStorage (T2), переключатель шаг-на-1 (T3), графики (T4), форма (T5), таблица (T6), нормы/печать/PDF-charts (T7), PDF-заголовок (T8), размещение на главном (T9). Локально всё.
- Места без изменения: `isBPFieldName`, `classification.ts`, `format.ts`, данные DB — соблюдено.
- Типы согласованы: `BpLabelVariant`, `BpLabelSet`, сигнатуры с опциональным `variant` — едины по всем задачам.