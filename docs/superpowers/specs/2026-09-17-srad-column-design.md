# СрАД (Mean Arterial Pressure) column + САД/ДАД/Pulse labels — Design

**Date:** 2026-09-17
**Status:** Draft (pending user review)

## Objective

Add a computed Mean Arterial Pressure column (СрАД) to the entries table with a textual
classification (гипотония / нормотония / гипертония), and rename the BP field sub-labels
from ВД/НД/П to САД/ДАД/Пульс so the app uses standard medical terminology for systolic
and diastolic pressure.

## Decisions (user-confirmed 2026-09-17)

- **Formula:** СрАД = (САД + 2×ДАД)/3, rounded to integer — the standard clinical approximation of mean arterial pressure.
- **Classification by СрАД:** <70 → гипотония; 70–110 → нормотония; >110 → гипертония. Boundaries inclusive in нормотония (70 and 110 are нормотония).
- **Labels:** САД / ДАД / Пульс (ВД/НД/П renamed; «Верхнее/Нижнее» → «Систолическое/Диастолическое» in norms panel).
- **Placement:** separate column in the entries table (desktop) + a line in the mobile card.

## Scientific rationale

The formula MAP = (SBP + 2×DBP)/3 is the standard clinical estimate of mean arterial pressure:

- **Meaney E, et al.** «Formula and nomogram for the sphygmomanometric calculation of the mean arterial pressure.» *Heart* 2000;84(1):64. DOI [10.1136/heart.84.1.64](https://doi.org/10.1136/heart.84.1.64) — «The traditional formula for the calculation of MAP is the following: MAP = DP + 0.333(SP − DP) or [SP + (2DP)]/3»; MAP defined as the time-weighted average of instantaneous pressures.
- **Tien LYH, et al.** «Optimal Calculation of Mean Pressure From Pulse Pressure.» *Am J Hypertens* 2023;36(6):297–305. DOI [10.1093/ajh/hpad026](https://doi.org/10.1093/ajh/hpad026) — the standard estimate is Gauer's method (DP + ⅓·PP, 1960); normal MAP 70–100 mmHg; hypoperfusion concern ≈60 mmHg.
- **Evans L, et al.** Surviving Sepsis Campaign 2021. *Intensive Care Med* 2021;47(11):1181–1247. DOI [10.1007/s00134-021-06506-y](https://doi.org/10.1007/s00134-021-06506-y) — MAP target ≥65 mmHg; MAP below ≈60 mmHg associated with decreased organ perfusion.
- **Hall JE.** Guyton & Hall Textbook of Medical Physiology, 13th ed., ch. 15 — physiological definition: MAP is the millisecond-by-millisecond average over time; determined ≈60% by diastolic and ≈40% by systolic pressure.
- **DeMers D, Wachs D.** «Physiology, Mean Arterial Pressure.» *StatPearls* 2023. PMID 30855814 — formula MAP = ДАД + ⅓(САД − ДАД); minimum MAP 60 mmHg to perfuse vital organs.

Precision note: the ⅓-weighting slightly underestimates true MAP (≈2–5 mmHg; Bos et al., *J Hypertens* 2007;25(4):751–5). Acceptable for a consumer tracker; user chose the standard formula over alternative weighting (0.4 of PP).

## Scope

Included:
- New pure logic module `src/logic/srad.ts` (+ `srad.test.ts`): `computeSrad`, `classifySrad`, category label + color maps.
- Computed «СрАД» column in `EntriesTable` (desktop table + mobile card line): value + colored category label.
- Label rename → САД/ДАД/Пульс in: `report-config.ts` (BP_PARTS + default field name «САД / ДАД / Пульс»), `format.ts` fallback labels, `EntryForm.tsx` legacy-BP ternary, `ReportScreen.tsx` (TARGET_LABELS and targetsSummary).
- `isBPFieldName` extended to also detect «САД» (legacy text-BP recognition), «ВД» kept for old reports.
- Tests updated for renamed defaults; new tests for srad logic and table rendering.

Excluded:
- PDF export (`jsPDF` builds its own table — the column is intentionally NOT added there; separate task if wanted).
- DB / backup / sync migration — СрАД computed at render time; `BPValues` schema unchanged.
- Existing row color classification (`classifyBP` by САД/ДАД thresholds) — left untouched; the СрАД column is an independent classification.
- Chart series for СрАД; dashboard summary; alarm thresholds — not requested.
- Migrating labels of existing reports (their parts stay «ВД/НД/П» — labels are data-driven, stored in each report).

## Design

### 1. Logic — `src/logic/srad.ts`

```ts
import type { BPValues } from '../types';
import type { StatusColor } from './classification';

export type SradCategory = 'hypotension' | 'normotension' | 'hypertension';

/** СрАД = (САД + 2×ДАД)/3, округление до целого. undefined при отсутствии/нечисловых значениях. */
export function computeSrad(bp: BPValues | undefined): number | undefined;

/** Классификация по СрАД: <70 гипотония, 70–110 нормотония, >110 гипертония. */
export function classifySrad(map: number | undefined): SradCategory | undefined;

export const SRAD_CATEGORY_LABEL: Record<SradCategory, string>;

export const SRAD_CATEGORY_COLOR: Record<SradCategory, StatusColor>;
```

- `computeSrad`: requires both systolic and diastolic to be finite numbers → `Math.round((sys + 2*dia) / 3)`; otherwise `undefined`.
- `classifySrad`: `map < 70` → `'hypotension'`; `map <= 110` → `'normotension'`; else `'hypertension'`; `undefined` → `undefined`.
- Labels: «Гипотония» / «Нормотония» / «Гипертония».
- Colors (reuse `StatusColor` + existing CSS `status-green/yellow/red`):
  - Нормотония → **green**
  - Гипотония → **red** (dangerous low)
  - Гипертония → **yellow**
  - *(Decision taken per recommendation; user can change during spec review.)*

### 2. Label renames

- `report-config.ts`: `BP_PARTS` labels → `'САД' | 'ДАД' | 'Пульс'`; `mkBPField` default name → `'САД / ДАД / Пульс'`.
- `format.ts`: fallback `parts` array labels → САД/ДАД/Пульс.
- `EntryForm.tsx` (legacy BP ternary, ~line 107): `'САД' / 'ДАД' / 'Пульс'`.
- `classification.ts` `isBPFieldName`: now `name.includes('ВД') || name.includes('САД')`.
- `ReportScreen.tsx`: `TARGET_LABELS` → `{ sys: 'Систолическое (САД)', dia: 'Диастолическое (ДАД)', pulse: 'Пульс', sugar: 'Сахар' }`; `targetsSummary` → `САД ${sys}`, `ДАД ${dia}`, `Пульс ${pulse}`.

### 3. EntriesTable rendering

- BP fields identified by `f.type === 'bp' || isBPFieldName(f.name)` (existing helper).
- **Desktop table:** render one extra `<th>СрАД</th>` after the **first BP column** and a matching `<td>` per row; only when the report has ≥1 BP field. Fixed column width (`.col-srad`, ≈88px) so existing proportional field widths are untouched; «Нет записей» `colSpan` grows by 1.
- **Cell content:** formatted `computeSrad(bp)` value («93») + category label («Нормотония») wrapped in the category color class; empty string when `undefined`.
- **Mobile cards:** separate line (`.entry-card__srad`) — «СрАД 93 · Нормотония», colored by category; rendered only when BP field exists and value computable. Existing `extractHighlights` untouched.
- **Browser print** (window.print) uses the same DOM table — column appears in print output too. Consistent with «prints what is visible»; jsPDF export deliberately unchanged (Scope).

### 4. Edge cases

- Empty / non-numeric systole or diastole → empty cell.
- Only one of sys/dia present → empty cell (cannot compute).
- 0/0 → formula yields 0 → «Гипотония» (formally consistent; unrealistic input, covered by test).
- Old reports named «ВД / НД / П» (type `'bp'`): column still appears (detected by type); form labels stay old in that report.

### 5. Tests

- New `src/logic/srad.test.ts`:
  - `computeSrad`: 120/80 → 93; 140/90 → 107; 100/60 → 73; rounding (120/79 → 93); missing/invalid → undefined.
  - `classifySrad`: 69 → hypotension; 70 → normotension; 110 → normotension; 111 → hypertension; undefined → undefined.
- Updated: `CreateReportScreen.test.tsx` (default field name → «САД / ДАД / Пульс»), `report-config.test.ts`; tests that construct parts with explicit labels («ВД»/«НД»/«П») keep passing as-is; `EntriesTable.test.tsx` — new column rendering cases.
- Full gate: `npx vitest run`, `npx tsc -b`, `npm run build`.

## Risks

- **Color mismatch:** a row may be red (old classification, e.g. 140/95) while СрАД says «Нормотония» (≈106). Accepted: two independent classifications; the СрАД column is documented as separate. Option to unify later.
- **Labels show only on new reports:** old reports keep «ВД/НД/П» until their fields are recreated (labels are data-driven). Accepted — no data migration.
- **Column width on narrow screens:** table already scrolls horizontally (`.entries-scroll`); fixed ≈88px column is acceptable.

## Validation

- `npx vitest run` (all tests incl. new/updated), `npx tsc -b`, `npm run build`.
- Manual spot-check: create default report → form shows САД/ДАД/Пульс; entry 120/80/70 → table shows «93 Нормотония» (green); 150/95 → «≈113 Гипертония» (yellow); 100/50 → «≈67 Гипотония» (red); empty BP → empty cell.