# План реализации — распознавание давления с главного экрана отчёта

Дата: 2026-08-31
Спека: `docs/superpowers/specs/2026-08-31-photo-entry-from-screen-design.md`

## Цель

Перенести запуск OCR с кнопки внутри поля «ВД / НД / П» на главный экран отчёта. По нажатию «Фото» → выбор изображения → локальное распознавание → открывается полная `EntryForm` с текущей датой в «Дата и время» и распознанным значением в «ВД / НД / П». Пользователь правит и сохраняет. Форма открывается всегда (даже при ошибке/мусоре).

## Область

**In scope:**
- ReportScreen: кнопка «Фото» (видна только при наличии поля «ВД / НД / П»), скрытый file input, `handlePhoto`, состояние `ocrStatus`/`photoMessage`, передача `initial` и `photoResult` в EntryForm.
- EntryForm: новый необязательный prop `photoResult`, отображение статус-строки; удаление старой OCR-логики (кнопка «Фото», `handlePhoto`, статусы).
- index.css: удалить `.photo-row`/`.photo-btn`/`.photo-btn:hover`/`.photo-row em.ok`; статус-строка использует существующие `em.ok`/`em.error`.
- Тесты ReportScreen (новые), EntryForm (удалить старые OCR-тесты, добавить тесты `photoResult`).

**Out of scope:**
- `ocr.ts`, `ocr-parse.ts` — без изменений.
- Офлайн-ассеты tessdata, SW — без изменений.
- Настройка полей (FieldsEditor) — без изменений.

## Неизменные зависимости

- `recognizeTextFromImage(file): Promise<string>` — src/logic/ocr.ts.
- `parsePressureText(raw): PressureReading`, `formatPressureReading(r): string` — src/logic/ocr-parse.ts.
- `toLocalInputValue(iso): string` — src/logic/reminders.ts (локальный `yyyy-MM-ddTHH:mm`).
- `datetimeFieldId(fields): string | undefined` — src/logic/print-filter.ts.
- Текущая дата: `toLocalInputValue(new Date().toISOString())`.

---

## Task A: Кнопка «Фото» в ReportScreen + предзаполнение EntryForm

**Files:**
- Modify: `src/components/ReportScreen.tsx`
- Modify: `src/components/EntryForm.tsx` (добавить prop `photoResult` — НЕ удалять старую логику в этом таске)
- Modify: `src/components/ReportScreen.test.tsx` (новые тесты)

### Интерфейсы

EntryForm — добавить необязательный prop:
```ts
interface PhotoResult { status: 'idle' | 'done' | 'error'; message: string }
interface Props {
  fields: Field[];
  initial?: Record<string, string | number>;
  onSave: (values: Record<string, string | number>) => void;
  onCancel: () => void;
  photoResult?: PhotoResult;
}
```

EntryForm рендер — статус-строка (после map-полей, перед кнопками):
```tsx
{photoResult && photoResult.status !== 'idle' && (
  <p className={photoResult.status === 'done' ? 'hint ok' : 'hint error'}>
    {photoResult.message}
  </p>
)}
```
> Не используем `em.ok`/`em.error` в EntryForm новыми — это классы в нашем CSS. Для простоты: статус-строка `<p className="hint">`, окраска через инлайн не нужна — сообщение само говорит. Либо добавить два класса в css. Ниже в Task B решим про CSS. В Task A достаточно `<p className="hint photo-msg">{message}</p>`.

### ReportScreen.tsx

Добавить импорты:
```ts
import { recognizeTextFromImage } from '../logic/ocr';
import { parsePressureText, formatPressureReading } from '../logic/ocr-parse';
import { toLocalInputValue } from '../logic/reminders';
```

Новые состояния (после существующих useState):
```ts
const [ocrStatus, setOcrStatus] = useState<'idle' | 'working' | 'done' | 'error'>('idle');
const [photoMessage, setPhotoMessage] = useState('');
```

Вычислить поля:
```ts
const bpField = report.fields.find(f => f.name === 'ВД / НД / П');
```

`handlePhoto`:
```ts
const handlePhoto = async (file: File | undefined) => {
  if (!file || !bpField || ocrStatus === 'working') return;
  setOcrStatus('working');
  setPhotoMessage('');
  setEditingEntry(null);
  let message = '';
  let formatted = '';
  let status: 'done' | 'error' = 'done';
  try {
    const text = await recognizeTextFromImage(file);
    formatted = formatPressureReading(parsePressureText(text));
    message = formatted === ''
      ? 'Не удалось распознать. Попробуйте другое фото'
      : `Готово: ${formatted}`;
    if (formatted === '') status = 'error';
  } catch {
    status = 'error';
    message = 'Распознавание недоступно. Попробуйте ещё раз';
  }
  setOcrStatus(status);
  setPhotoMessage(message);
  const photoInitial: Record<string, string | number> = {};
  if (dtFieldId) photoInitial[dtFieldId] = toLocalInputValue(new Date().toISOString());
  if (formatted !== '' && bpField) photoInitial[bpField.id] = formatted;
  setPhotoInitial(photoInitial);
  setPhotoSeq(s => s + 1);
  setShowForm(true);
};
```
Новое состояние для initial фото + счётчик ключей:
```ts
const [photoInitial, setPhotoInitial] = useState<Record<string, string | number> | undefined>(undefined);
const [photoSeq, setPhotoSeq] = useState(0);
```
> `photoSeq` нужен для `key` EntryForm: без него повторное «Фото» не ре-маунтит форму и `initial` не обновится (React переиспользует компонент). В `handlePhoto` в конце: `setPhotoSeq(s => s + 1)`.

Кнопка «Фото» — в блоке действий (рядом с «+ Запись» и «Печать/PDF»), только при `bpField`:
```tsx
{bpField && (
  <label className="no-print primary photo-entry">
    {ocrStatus === 'working' ? 'Распознаю…' : 'Фото'}
    <input type="file" accept="image/*" hidden aria-label="Фото"
           onChange={e => { void handlePhoto(e.target.files?.[0]); e.target.value = ''; }} />
  </label>
)}
```

Передача в EntryForm (заменить текущий блок `showForm`):
```tsx
{showForm && (
  <EntryForm
    key={editingEntry?.id ?? `photo-${photoSeq}`}
    fields={report.fields}
    initial={editingEntry?.values ??
             photoInitial ??
             (numId ? { [numId]: nextEntryNumber(entries, numId) ?? 1 } : undefined)}
    photoResult={editingEntry ? undefined : { status: ocrStatus, message: photoMessage }}
    onSave={v => void saveEntry(v)}
    onCancel={() => { setEditingEntry(null); setShowForm(false); }}
  />
)}
```
> Ключ: `editingEntry?.id` (редактирование) либо `photo-${photoSeq}` (новая/фото-форма). Поскольку `photoSeq` растёт на каждом фото, каждая фото-форма получает новый key → React ре-маунтит и `useState(initial)` инициализируется свежим `initial`. Для обычного «+ Запись» photoSeq не меняется — key стабильно `photo-0`. 
> `photoResult` передаём только когда это НЕ редактирование существующей записи (иначе статус «Готово: …» липнет к редактору). После cancel сбросить `photoInitial` и статус:
> ```ts
> onCancel={() => { setEditingEntry(null); setShowForm(false); setPhotoInitial(undefined); setOcrStatus('idle'); setPhotoMessage(''); }}
> ```
> Также при обычном «+ Запись» (не фото) сбросить `photoInitial`:
> ```ts
> onClick={() => { setEditingEntry(null); setPhotoInitial(undefined); setOcrStatus('idle'); setPhotoMessage(''); setShowForm(true); }}
> ```

### ReportScreen.test.tsx — новые тесты

Мок OCR в верхней части:
```ts
import { recognizeTextFromImage } from '../logic/ocr';
vi.mock('../logic/ocr', () => ({ recognizeTextFromImage: vi.fn() }));
const mockRecognize = vi.mocked(recognizeTextFromImage);
```

Отчёт с полем «ВД / НД / П» и «Дата и время»:
```ts
const seedWithBP = () =>
  putReport({ id: 'pBp', name: 'БП', archived: false, createdAt: 1, updatedAt: 1,
    fields: [
      { id: 'bp', name: 'ВД / НД / П', type: 'text', required: false, width: 30 },
      { id: 'd', name: 'Дата и время', type: 'datetime', required: true, width: 30 },
    ] });
```

Тесты:
1. `показывает кнопку «Фото» при наличии поля «ВД / НД / П»` — seedWithBP, `findByRole('button', { name: 'Фото' })`.
2. `скрывает кнопку «Фото» при отсутствии поля` — seed() (fields=[]), `queryByLabelText('Фото')` null.
3. `успех: открывает форму с датой и значением` — mockRecognize resolves '120/80/65'; клик по label Фото → fireEvent.change file input; await форма; date input value = сегодня (`/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/`), bp field textarea value = '120/80/65'; сообщение «Готово».
4. `мусор: форма открывается, поле пусто, сообщение об ошибке` — resolves 'zxcvbn'; bp value '', сообщение «Не удалось распознать», дата стоит.
5. `worker ошибка: форма открывается, сообщение «Недоступно»` — rejects; сообщение «Распознавание недоступно», поле пусто.
6. `после cancel статус сбрасывается` — после cancel снова «+ Запись» → photoResult не показан (нет сообщения).

Файл: в ReportScreen тест file input — `screen.getByLabelText('Фото')`, `fireEvent.change(input, { target: { files: [new File(['x'],'bp.png',{type:'image/png'})] } })`.

### Commit

```bash
git add src/components/ReportScreen.tsx src/components/EntryForm.tsx src/components/ReportScreen.test.tsx
git commit -m "feat: photo recognition entry from report screen with prefilled form"
```

---

## Task B: Удалить старую OCR-логику из EntryForm

**Files:**
- Modify: `src/components/EntryForm.tsx`
- Modify: `src/components/EntryForm.test.tsx`
- Modify: `src/index.css`

### EntryForm.tsx

Удалить:
- импорты `recognizeTextFromImage` (ocr), `parsePressureText`/`formatPressureReading` (ocr-parse)
- тип `OcrStatus`
- состояние `ocrStatus`, `ocrMessage`
- переменную `bpField` (больше не нужна)
- `handlePhoto`
- блок `.photo-row` внутри JSX
- placeholder `120/70/100` (ветка `f.unit` теперь без bp-спекефики — у bp поля нет unit, ветка и так мёртвая; просто убрать placeholder)
- `OcrStatus` не нужен

Остаётся:
- prop `photoResult?: PhotoResult` (из Task A) + рендер статус-строки.
- обычная логика полей/валидации/сохранения.

Итоговый EntryForm (минимальное состояние):
```ts
import { useState } from 'react';
import type { Field } from '../types';
import { validateEntry } from '../logic/validation';

export interface PhotoResult {
  status: 'idle' | 'done' | 'error';
  message: string;
}
interface Props {
  fields: Field[];
  initial?: Record<string, string | number>;
  onSave: (values: Record<string, string | number>) => void;
  onCancel: () => void;
  photoResult?: PhotoResult;
}
```

### EntryForm.test.tsx

Удалить:
- мок `../logic/ocr` и `mockRecognize`
- весь `describe('EntryForm photo button')` block (6 тестов)
- `makeFile`, `BP_FIELD`

Добавить тесты для `photoResult`:
1. `показывает статус done` — render с `photoResult={{ status:'done', message:'Готово: 120/80/65' }}`, `getByText('Готово: 120/80/65')`.
2. `показывает статус error` — `{ status:'error', message:'Не удалось распознать. Попробуйте другое фото' }`, `getByText(...)`.
3. `не показывает сообщение при idle/undefined` — render без photoResult или `{ status:'idle', message:'' }`, `queryByText(...)` null.

`renderForm` helper остаётся (fields, onSave, onCancel). `OTHER_FIELD` не нужен — оставить только простые поля, если тесты используют; проще упростить helper.

### index.css

Удалить блоки:
```css
.photo-row { ... }
.photo-btn { ... }
.photo-btn:hover { ... }
.photo-row em.ok { ... }
```
(строки ~946-968). Добавить (если нужно):
```css
.photo-msg { margin: 0.5rem 0; }
```

### Commit

```bash
git add src/components/EntryForm.tsx src/components/EntryForm.test.tsx src/index.css
git commit -m "refactor: remove old in-field photo button from entry form"
```

---

## Проверка (после обоих тасков)

```bash
npx vitest run        # все зелёные (ожидается: текущие 125, минус 6 OCR-тестов формы, плюс ~6 новых ReportScreen + 3 EntryForm photoResult)
npx tsc -b            # exit 0
npm run build         # exit 0 (сборка с новым UI)
```

Ожидаемое число тестов: 125 − 6 (EntryForm OCR) + ~6 (ReportScreen) + 3 (EntryForm photoResult) ≈ 128.

## Артефакты ревью (SDD)

Workspace `.superpowers/sdd/<дата>-photo-entry/`:
- Task A brief + report + review
- Task B brief + report + review
- final review

## Self-review плана

**1. Спека покрыта?**
- Кнопка «Фото» на главном экране, только при поле ВД/НД/П → Task A, ReportScreen.
- По нажатию → форма с текущей датой + распознанным значением → Task A, handlePhoto + initial.
- Форма открывается всегда (ошибка/мусор) → Task A, handlePhoto всегда setShowForm(true).
- Дата в «Дата и время» → Task A, toLocalInputValue(dtFieldId).
- Кнопка в поле удалена → Task B.
- Статус-сообщения → Task A photoResult + Task A ReportScreen message.

**2. Плейсхолдеры:** нет. Файлы и шаги с фактическим содержимым.

**3. Консистентность типов:** `PhotoResult` определён один раз (Task A, EntryForm экспортирует), используется в ReportScreen и EntryForm. `recognizeTextFromImage/parsePressureText/formatPressureReading/toLocalInputValue` — неизменные сигнатуры.

**4. Возможные неоднозначности:**
- `key` EntryForm: при фото `key={'new'}` (editingEntry null) — после первой фото-формы key не меняется на повторное фото (обе 'new'). Чтобы форма ре-маунтилась для каждого нового фото с новым initial, нужен изменяемый key. Решение: использовать счётчик или timestamp в key для фото-формы — `key={editingEntry?.id ?? `photo-${photoSeq}`}` где `photoSeq` инкрементится в handlePhoto. Иначе useState(initial) не обновится. **Это важный момент — включить в Task A.**
- Cancel сбрасывает initial (photoInitial undefined) → следующая фото-форма получит свежий. ✓

**5. Рендер поля ВД/НД/П = textarea** (нет unit): значение через `values[bpField.id]`, рендер textarea — менять не требуется.

**6. photoResult липнет к редактору:** передаём только при `!editingEntry`; cancel сбрасывает. ✓

---

## Порядок исполнения (SDD)

1. Task A (implementer → review)
2. Task B (implementer → review)
3. Финальное целостное ревью
4. Финальная верификация (vitest + tsc + build)
5. Отчёт + опция деплоя
