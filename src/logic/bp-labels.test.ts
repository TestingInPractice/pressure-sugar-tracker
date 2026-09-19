import { describe, expect, it } from 'vitest';
import {
  BP_LABEL_VARIANTS,
  BP_LABEL_VARIANTS_LIST,
  DEFAULT_BP_LABEL_VARIANT,
} from './bp-labels';
import type { BpLabelSet } from './bp-labels';

const LABEL_FIELDS: (keyof BpLabelSet)[] = [
  'name',
  'sys',
  'dia',
  'pulse',
  'sysLong',
  'diaLong',
  'pulseLong',
  'chartSys',
  'chartDia',
  'chartPulse',
  'normSys',
  'normDia',
  'normPulse',
];

describe('BP_LABEL_VARIANTS', () => {
  it('contains all 3 variants with all 13 fields non-empty', () => {
    for (const item of BP_LABEL_VARIANTS_LIST) {
      const set = BP_LABEL_VARIANTS[item.id];
      expect(set).toBeDefined();
      for (const field of LABEL_FIELDS) {
        expect(set[field], `${item.id}.${field}`).not.toBe('');
      }
    }
  });

  it('list ids match dictionary keys in order sad → vd → en', () => {
    expect(Object.keys(BP_LABEL_VARIANTS)).toEqual(['sad', 'vd', 'en']);
    expect(BP_LABEL_VARIANTS_LIST.map(item => item.id)).toEqual(Object.keys(BP_LABEL_VARIANTS));
  });

  it('default variant is sad', () => {
    expect(DEFAULT_BP_LABEL_VARIANT).toBe('sad');
  });
});