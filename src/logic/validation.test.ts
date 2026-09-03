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
  it('bp: optional and empty is ok', () => {
    const bp = f({ type: 'bp', parts: [{ id: 'systolic', label: 'ВД' }, { id: 'diastolic', label: 'НД' }, { id: 'pulse', label: 'П' }] });
    expect(validateEntry([bp], {})).toEqual({});
  });
  it('bp: required flags empty', () => {
    const bp = f({ required: true, type: 'bp', parts: [{ id: 'systolic', label: 'ВД' }, { id: 'diastolic', label: 'НД' }, { id: 'pulse', label: 'П' }] });
    expect(validateEntry([bp], { f1: {} }).f1).toBeTruthy();
  });
  it('bp: flags non-numeric part value', () => {
    const bp = f({ type: 'bp', parts: [{ id: 'systolic', label: 'ВД' }, { id: 'diastolic', label: 'НД' }, { id: 'pulse', label: 'П' }] });
    expect(validateEntry([bp], { f1: { systolic: 120, diastolic: 'abc' } }).f1).toBeTruthy();
  });
  it('bp: accepts numeric parts', () => {
    const bp = f({ type: 'bp', parts: [{ id: 'systolic', label: 'ВД' }, { id: 'diastolic', label: 'НД' }, { id: 'pulse', label: 'П' }] });
    expect(validateEntry([bp], { f1: { systolic: '120', diastolic: '80', pulse: 70 } })).toEqual({});
  });
});
