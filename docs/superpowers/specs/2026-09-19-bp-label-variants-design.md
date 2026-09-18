# Дизайн: переключатель обозначений полей давления (3 варианта)

Дата: 2026-09-19
Статус: утверждён пользователем

## Проблема

Подписи полей давления (систолическое / диастолическое / пульс) сейчас разбросаны по
приложению с **разными строками** в разных местах:

| Место | Текущие строки |
|---|---|
| Форма ввода (новые отчёты) | `САД / ДАД / Пульс` |
| Форма ввода (старые импортированные) | `ВД / НД / П` |
| Легенда графиков | `Верхнее / Нижнее / Пульс` |
| Панель «Мои нормы» | `Систолическое (САД) / Диастолическое (ДАД) / Пульс` |
| Заголовок таблицы / PDF | имя поля отчёта (`САД / ДАД / Пульс`) |

Пользователь хочет **единый переключатель на 3 варианта обозначений**, применяемый
единообразно во всём приложении:

1. **САД** — текущий русский: `САД / ДАД / Пульс`
2. **ВД** — старый русский: `ВД / НД / П`
3. **SYS** — английский: `SYS / DIA / PULSE`

## Решение

### 1. Словарь вариантов (`src/logic/bp-labels.ts`)

Единый источник истины. Ключ — стабильные id частей `systolic` / `diastolic` / `pulse`
(уже есть в `types.ts` и `report-config.ts`), плюс `name` (заголовок колонки/поля) и
подписи для панели норм и графиков.

```ts
export type BpLabelVariant = 'sad' | 'vd' | 'en';

export interface BpLabelSet {
  name: string;            // 'САД / ДАД / Пульс'
  sys: string;             // 'САД' | 'ВД' | 'SYS'
  dia: string;             // 'ДАД' | 'НД' | 'DIA'
  pulse: string;           // 'Пульс' | 'П' | 'PULSE'
  sysLong: string;         // 'Систолическое (САД)' | 'Верхнее (ВД)' | 'SYS'
  diaLong: string;         // 'Диастолическое (ДАД)' | 'Нижнее (НД)' | 'DIA'
  pulseLong: string;       // 'Пульс' | 'Пульс (П)' | 'PULSE'
  chartSys: string;        // 'САД' | 'ВД' | 'SYS'
  chartDia: string;        // 'ДАД' | 'НД' | 'DIA'
  chartPulse: string;      // 'Пульс' | 'Пульс' | 'PULSE'
  normSys: string;         // 'Норма САД' | 'Норма ВД' | 'Norm SYS'
  normDia: string;         // 'Норма ДАД' | 'Норма НД' | 'Norm DIA'
  normPulse: string;       // 'Норма пульса' | 'Норма пульса' | 'Norm PULSE'
}

export const BP_LABEL_VARIANTS: Record<BpLabelVariant, BpLabelSet> = {
  sad: { name: 'САД / ДАД / Пульс', sys: 'САД', dia: 'ДАД', pulse: 'Пульс',
         sysLong: 'Систолическое (САД)', diaLong: 'Диастолическое (ДАД)', pulseLong: 'Пульс',
         chartSys: 'САД', chartDia: 'ДАД', chartPulse: 'Пульс',
         normSys: 'Норма САД', normDia: 'Норма ДАД', normPulse: 'Норма пульса' },
  vd:  { name: 'ВД / НД / П', sys: 'ВД', dia: 'НД', pulse: 'П',
         sysLong: 'Верхнее (ВД)', diaLong: 'Нижнее (НД)', pulseLong: 'Пульс (П)',
         chartSys: 'ВД', chartDia: 'НД', chartPulse: 'Пульс',
         normSys: 'Норма ВД', normDia: 'Норма НД', normPulse: 'Норма пульса' },
  en:  { name: 'SYS / DIA / PULSE', sys: 'SYS', dia: 'DIA', pulse: 'PULSE',
         sysLong: 'SYS', diaLong: 'DIA', pulseLong: 'PULSE',
         chartSys: 'SYS', chartDia: 'DIA', chartPulse: 'PULSE',
         normSys: 'Norm SYS', normDia: 'Norm DIA', normPulse: 'Norm PULSE' },
};

export const BP_LABEL_VARIANTS_LIST = [
  { id: 'sad' as const, label: 'САД' },
  { id: 'vd' as const, label: 'ВД' },
  { id: 'en' as const, label: 'SYS' },
];

export const DEFAULT_BP_LABEL_VARIANT: BpLabelVariant = 'sad';
```

### 2. Контекст (`src/context/BpLabelVariantContext.tsx`)

React Context с провайдером в `App.tsx` (поверх вкладок) и хуком `useBpLabelVariant()`.
Хранит выбранный вариант в `localStorage['bp-label-variant']` (`'sad' | 'vd' | 'en'`),
по умолчанию `'sad'`. Автоперсист через `useEffect` (паттерн `chart-show-targets`).

Подписи для экранов: единый хук вытаскивает `BP_LABEL_VARIANTS[variant]` — все точки
отображения читают из него, никакого прокидывания пропсов через дерево.

### 3. Переключатель (`src/components/BpLabelSwitcher.tsx`)

- 3 положения: `САД | ВД | SYS` (подписи из `BP_LABEL_VARIANTS_LIST`).
- Сегмент-контрол в стиле `.segmented` (DashboardTab), `aria-pressed` на кнопках.
- **Сдвиг только на 1 за раз**: клик по кнопке двигает активное положение только на
  соседнюю позицию (не перепрыгивает). Если кликнули на кнопку через одну — сначала
  переходит на соседнюю (или игнорируется — решает UX: **переходит на соседнюю по
  направлению клика**, т.е. максимум 1 шаг за клик).
- Размещение в `DashboardTab` над блоком графика (рядом с сегментом выбора метрики).
- Стили: в `index.css` рядом с `.segmented`.

### 4. Точки внедрения

| Файл | Что меняется |
|---|---|
| `App.tsx` | Обернуть контент в `BpLabelVariantProvider` |
| `DashboardTab.tsx` | Рендер `BpLabelSwitcher` над графиком; `chartSeries`/`targetLines` собираются с учётом варианта |
| `TrendChart.tsx` | `buildMetricSeries`/`buildMetricTargets` принимают опциональный вариант (или читают контекст) — подписи серий `Верхнее/Нижнее/Пульс`, таргетов `Норма ВД/НД`, тултипы, легенда |
| `EntryForm.tsx` | Подписи `.bp-part` и legacy-ветка `САД/ДАД/Пульс` → вариант |
| `EntriesTable.tsx` | Заголовок колонки давления: `f.name` → `variant.name` |
| `ReportScreen.tsx` | `TARGET_LABELS`, `targetsSummary` (строка норм в PDF), печатные графики → вариант |
| `pdf-export.ts` | `FIELD_HEAD` заголовка таблицы → `variant.name` (прокинуть в `PdfMeta` или формировать заголовки в ReportScreen) |

### 5. Критичные ограничения

- **Данные не меняются**: сохранённые `Field.name` / `parts[].label` в IndexedDB и
  бэкапах остаются как есть. Вариант применяется **только при отображении**.
  Не ломаются: синхронизация, бэкапы, `isBPFieldName`.
- `isBPFieldName` (classification.ts) не трогать — он распознаёт 'ВД' и 'САД'.
- PDF: заголовок колонки и строка норм формируются из варианта на момент экспорта.

### 6. Тесты

Обновить существующие (строка «Верхнее/Нижнее» в легенде графиков — по умолчанию
вариант `sad` → «САД/ДАД» в легенде; часть тестов ожидает «Верхнее» — обновить на
«САД» или явно выставить вариант). Новые тесты:

- `bp-labels.test.ts` — словарь: все 3 варианта полны, ключи стабильны.
- `BpLabelSwitcher.test.tsx` — 3 положения; клик на соседнее — переключение; клик
  через позицию — только 1 шаг; aria-pressed.
- `EntryForm.test.tsx` — вариант «ВД»: подписи `ВД/НД/П`.
- `EntriesTable.test.tsx` / `ReportScreen.test.tsx` / `pdf-export.test.ts` — заголовки
  и строка норм по варианту.