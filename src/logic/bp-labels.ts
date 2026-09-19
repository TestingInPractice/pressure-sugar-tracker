export type BpLabelVariant = 'sad' | 'vd' | 'en';

export interface BpLabelSet {
  name: string;
  sys: string;
  dia: string;
  pulse: string;
  sysLong: string;
  diaLong: string;
  pulseLong: string;
  chartSys: string;
  chartDia: string;
  chartPulse: string;
  normSys: string;
  normDia: string;
  normPulse: string;
}

export const BP_LABEL_VARIANTS: Record<BpLabelVariant, BpLabelSet> = {
  sad: {
    name: 'САД / ДАД / Пульс',
    sys: 'САД',
    dia: 'ДАД',
    pulse: 'Пульс',
    sysLong: 'Систолическое (САД)',
    diaLong: 'Диастолическое (ДАД)',
    pulseLong: 'Пульс',
    chartSys: 'САД',
    chartDia: 'ДАД',
    chartPulse: 'Пульс',
    normSys: 'Норма САД',
    normDia: 'Норма ДАД',
    normPulse: 'Норма пульса',
  },
  vd: {
    name: 'ВД / НД / П',
    sys: 'ВД',
    dia: 'НД',
    pulse: 'П',
    sysLong: 'Верхнее (ВД)',
    diaLong: 'Нижнее (НД)',
    pulseLong: 'Пульс (П)',
    chartSys: 'ВД',
    chartDia: 'НД',
    chartPulse: 'Пульс',
    normSys: 'Норма ВД',
    normDia: 'Норма НД',
    normPulse: 'Норма пульса',
  },
  en: {
    name: 'SYS / DIA / PULSE',
    sys: 'SYS',
    dia: 'DIA',
    pulse: 'PULSE',
    sysLong: 'SYS',
    diaLong: 'DIA',
    pulseLong: 'PULSE',
    chartSys: 'SYS',
    chartDia: 'DIA',
    chartPulse: 'PULSE',
    normSys: 'Norm SYS',
    normDia: 'Norm DIA',
    normPulse: 'Norm PULSE',
  },
};

export const BP_LABEL_VARIANTS_LIST: { id: BpLabelVariant; label: string }[] = [
  { id: 'sad', label: 'САД' },
  { id: 'vd', label: 'ВД' },
  { id: 'en', label: 'SYS' },
];

export const DEFAULT_BP_LABEL_VARIANT: BpLabelVariant = 'sad';