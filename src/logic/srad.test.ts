import { describe, expect, it } from 'vitest';
import { computeSrad, classifySrad, SRAD_CATEGORY_LABEL, SRAD_CATEGORY_COLOR } from './srad';

describe('computeSrad', () => {
  it('computes (САД + 2×ДАД)/3 rounded to integer', () => {
    expect(computeSrad({ systolic: 120, diastolic: 80 })).toBe(93);
    expect(computeSrad({ systolic: 140, diastolic: 90 })).toBe(107);
    expect(computeSrad({ systolic: 100, diastolic: 60 })).toBe(73);
  });

  it('rounds to nearest integer', () => {
    expect(computeSrad({ systolic: 120, diastolic: 79 })).toBe(93);
  });

  it('returns undefined for missing values', () => {
    expect(computeSrad(undefined)).toBeUndefined();
    expect(computeSrad({})).toBeUndefined();
    expect(computeSrad({ systolic: 120 })).toBeUndefined();
    expect(computeSrad({ diastolic: 80 })).toBeUndefined();
  });

  it('returns undefined for empty strings', () => {
    expect(computeSrad({ systolic: '', diastolic: '' })).toBeUndefined();
    expect(computeSrad({ systolic: '120', diastolic: '' })).toBeUndefined();
  });

  it('returns undefined for non-numeric values', () => {
    expect(computeSrad({ systolic: 'abc', diastolic: 'xyz' })).toBeUndefined();
  });

  it('computes 0/0 as 0 (formally consistent)', () => {
    expect(computeSrad({ systolic: 0, diastolic: 0 })).toBe(0);
  });
});

describe('classifySrad', () => {
  it('classifies hypotension below 70', () => {
    expect(classifySrad(69)).toBe('hypotension');
    expect(classifySrad(0)).toBe('hypotension');
  });

  it('classifies normotension 70–110 inclusive', () => {
    expect(classifySrad(70)).toBe('normotension');
    expect(classifySrad(93)).toBe('normotension');
    expect(classifySrad(110)).toBe('normotension');
  });

  it('classifies hypertension above 110', () => {
    expect(classifySrad(111)).toBe('hypertension');
  });

  it('returns undefined for undefined', () => {
    expect(classifySrad(undefined)).toBeUndefined();
  });
});

describe('SRAD maps', () => {
  it('labels match categories', () => {
    expect(SRAD_CATEGORY_LABEL).toEqual({
      hypotension: 'Гипотония',
      normotension: 'Нормотония',
      hypertension: 'Гипертония',
    });
  });

  it('colors: normotension green, hypotension red, hypertension yellow', () => {
    expect(SRAD_CATEGORY_COLOR).toEqual({
      hypotension: 'red',
      normotension: 'green',
      hypertension: 'yellow',
    });
  });
});