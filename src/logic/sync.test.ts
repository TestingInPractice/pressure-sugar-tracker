import { describe, it, expect } from 'vitest';
import { classifySync, buildSyncJson, syncFilename, plural } from './sync';
import type { Entry, Report } from '../types';

const entry = (id: string, v = 1, createdAt = 0): Entry =>
  ({ id, reportId: 'r1', values: { f1: v }, createdAt });

const report: Pick<Report, 'id' | 'name' | 'fields'> = {
  id: 'r1', name: 'Давление',
  fields: [{ id: 'f1', name: 'ВД / НД / П', type: 'text', required: false, width: 30 }],
};

describe('classifySync', () => {
  it('identical: same ids and values in any order', () => {
    expect(classifySync([entry('a'), entry('b')], [entry('b'), entry('a')]))
      .toEqual({ kind: 'identical' });
  });

  it('append-only: only new ids', () => {
    expect(classifySync([entry('a'), entry('b')], [entry('a')]))
      .toEqual({ kind: 'append-only', added: [entry('b')] });
  });

  it('append-only: several new rows', () => {
    const cur = [entry('a'), entry('b'), entry('c')];
    const out = classifySync(cur, [entry('a')]);
    expect(out.kind).toBe('append-only');
    if (out.kind === 'append-only') expect(out.added).toHaveLength(2);
  });

  it('conflict: modified old row', () => {
    expect(classifySync([entry('a', 2)], [entry('a', 1)]))
      .toEqual({ kind: 'conflict', added: [], modified: [entry('a', 2)], deleted: [] });
  });

  it('conflict: deleted row', () => {
    expect(classifySync([entry('a')], [entry('a'), entry('b')]))
      .toEqual({ kind: 'conflict', added: [], modified: [], deleted: [entry('b')] });
  });

  it('conflict: new + modified together', () => {
    const out = classifySync([entry('a', 2), entry('c')], [entry('a', 1)]);
    expect(out.kind).toBe('conflict');
    if (out.kind === 'conflict') {
      expect(out.added.map(e => e.id)).toEqual(['c']);
      expect(out.modified.map(e => e.id)).toEqual(['a']);
      expect(out.deleted).toHaveLength(0);
    }
  });

  it('first sync (no synced state): all current rows are added', () => {
    const out = classifySync([entry('a'), entry('b')], undefined);
    expect(out.kind).toBe('append-only');
    if (out.kind === 'append-only') expect(out.added).toHaveLength(2);
  });

  it('empty report vs empty synced: identical', () => {
    expect(classifySync([], [])).toEqual({ kind: 'identical' });
    expect(classifySync([], undefined)).toEqual({ kind: 'identical' });
  });
});

describe('buildSyncJson', () => {
  it('produces valid versioned JSON with report meta and entries', () => {
    const json = buildSyncJson(report, [entry('a')], 1000);
    const parsed = JSON.parse(json) as Record<string, unknown>;
    expect(parsed.version).toBe(1);
    expect(parsed.reportId).toBe('r1');
    expect(parsed.reportName).toBe('Давление');
    expect(parsed.syncedAt).toBe('1970-01-01T00:00:01.000Z');
    expect(Array.isArray(parsed.fields)).toBe(true);
    expect((parsed.entries as unknown[])).toHaveLength(1);
    expect(JSON.parse(json)).toHaveProperty('entries.0.values.f1', 1);
  });
});

describe('syncFilename', () => {
  it('sanitizes unsafe chars and appends -sync.json', () => {
    expect(syncFilename('Давление/Утро')).toBe('Давление_Утро-sync.json');
    expect(syncFilename('Отчёт: давление')).toBe('Отчёт_ давление-sync.json');
  });
  it('falls back for empty name', () => {
    expect(syncFilename('   ')).toBe('otchet-sync.json');
  });
});

describe('plural', () => {
  it('handles Russian plural forms', () => {
    const f: [string, string, string] = ['запись', 'записи', 'записей'];
    expect(plural(1, f)).toBe('запись');
    expect(plural(2, f)).toBe('записи');
    expect(plural(5, f)).toBe('записей');
    expect(plural(11, f)).toBe('записей');
    expect(plural(21, f)).toBe('запись');
  });
});
