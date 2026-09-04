import { describe, expect, it } from 'vitest';
import { classifyBP, classifySugar, isBPFieldName, isSugarField } from './classification';

describe('classifyBP', () => {
  it('returns green for normal BP (<120/<80)', () => {
    expect(classifyBP({ systolic: 110, diastolic: 70 })).toBe('green');
  });

  it('returns yellow for elevated systolic (120–139)', () => {
    expect(classifyBP({ systolic: 130, diastolic: 75 })).toBe('yellow');
  });

  it('returns yellow for elevated diastolic (80–89)', () => {
    expect(classifyBP({ systolic: 115, diastolic: 85 })).toBe('yellow');
  });

  it('returns red for high systolic (≥140)', () => {
    expect(classifyBP({ systolic: 150, diastolic: 75 })).toBe('red');
  });

  it('returns red for high diastolic (≥90)', () => {
    expect(classifyBP({ systolic: 115, diastolic: 95 })).toBe('red');
  });

  it('returns red when either is high', () => {
    expect(classifyBP({ systolic: 145, diastolic: 75 })).toBe('red');
    expect(classifyBP({ systolic: 110, diastolic: 92 })).toBe('red');
  });

  it('returns yellow when one is elevated and other normal', () => {
    expect(classifyBP({ systolic: 125, diastolic: 70 })).toBe('yellow');
  });

  it('returns green for undefined', () => {
    expect(classifyBP(undefined)).toBe('green');
  });

  it('returns green for empty object', () => {
    expect(classifyBP({})).toBe('green');
  });

  it('returns green for non-numeric values', () => {
    expect(classifyBP({ systolic: 'abc', diastolic: 'xyz' })).toBe('green');
  });
});

describe('classifySugar', () => {
  it('returns green for normal sugar (<5.5)', () => {
    expect(classifySugar(5.0)).toBe('green');
    expect(classifySugar('4.8')).toBe('green');
  });

  it('returns yellow for elevated sugar (5.5–6.9)', () => {
    expect(classifySugar(6.0)).toBe('yellow');
    expect(classifySugar('6.5')).toBe('yellow');
  });

  it('returns red for high sugar (≥7.0)', () => {
    expect(classifySugar(7.5)).toBe('red');
    expect(classifySugar('8.0')).toBe('red');
  });

  it('returns green for undefined/empty', () => {
    expect(classifySugar(undefined)).toBe('green');
    expect(classifySugar('')).toBe('green');
  });

  it('returns green for non-numeric string', () => {
    expect(classifySugar('abc')).toBe('green');
  });
});

describe('isBPFieldName', () => {
  it('detects ВД in name', () => {
    expect(isBPFieldName('ВД / НД / П')).toBe(true);
    expect(isBPFieldName('Давление')).toBe(false);
  });
});

describe('isSugarField', () => {
  it('detects sugar by name', () => {
    expect(isSugarField('Сахар')).toBe(true);
    expect(isSugarField('Давление')).toBe(false);
  });

  it('detects sugar by unit', () => {
    expect(isSugarField('Значение', 'ммоль/л')).toBe(true);
  });
});
