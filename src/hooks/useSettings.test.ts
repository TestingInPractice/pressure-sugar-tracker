import { renderHook, waitFor, act } from '@testing-library/react';
import { it, expect, beforeEach } from 'vitest';
import { useSettings } from './useSettings';
import { db } from '../db/db';

beforeEach(async () => { await db.delete(); await db.open(); });

it('loads defaults and saves toggle', async () => {
  const { result } = renderHook(() => useSettings());
  await waitFor(() => expect(result.current.settings).not.toBeNull());
  expect(result.current.settings!.masterOn).toBe(true);
  act(() => result.current.setMasterOn(false));
  await waitFor(() => expect(result.current.settings!.masterOn).toBe(false));
});
