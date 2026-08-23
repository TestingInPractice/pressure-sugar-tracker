import { describe, it, expect } from 'vitest';
import { validateEntry } from './validation';
import type { Field } from '../types';

const f = (over: Partial<Field>): Field => ({
  id: 'f1', name: 'Поле', type: 'number', required: false, width: 30, ...over,
});

describe('validateEntry', () => {
  it('ok when nothing required', () => {
    expect(validateEntry([f({})], {})).toEqual({});
  });
  it('flags missing required field', () => {
    const errs = validateEntry([f({ required: true })], {});
    expect(errs.f1).toBeTruthy();
  });
  it('flags whitespace-only text as empty', () => {
    expect(validateEntry([f({ required: true, type: 'text' })], { f1: '  ' }).f1).toBeTruthy();
  });
  it('flags non-number in number field', () => {
    expect(validateEntry([f({})], { f1: 'abc' }).f1).toBeTruthy();
  });
  it('accepts numeric strings and numbers', () => {
    expect(validateEntry([f({})], { f1: '120' })).toEqual({});
    expect(validateEntry([f({})], { f1: 120 })).toEqual({});
  });
  it('flags missing datetime when required', () => {
    expect(validateEntry([f({ required: true, type: 'datetime' })], { f1: '' }).f1).toBeTruthy();
    expect(validateEntry([f({ required: true, type: 'datetime' })], { f1: '2026-08-23T09:00' })).toEqual({});
  });
});
