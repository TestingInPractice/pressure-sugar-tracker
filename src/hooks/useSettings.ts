import { useEffect, useState, useCallback } from 'react';
import type { Settings } from '../types';
import { getSettings, saveSettings } from '../db/db';

export function useSettings() {
  const [settings, setSettings] = useState<Settings | null>(null);

  useEffect(() => {
    getSettings().then(setSettings).catch(console.error);
  }, []);

  const setMasterOn = useCallback((masterOn: boolean) => {
    setSettings(s => {
      const next = { masterOn, syncOn: s?.syncOn ?? false };
      void saveSettings(next);
      return next;
    });
  }, []);

  const setSyncOn = useCallback((syncOn: boolean) => {
    setSettings(s => {
      const next = { masterOn: s?.masterOn ?? true, syncOn };
      void saveSettings(next);
      return next;
    });
  }, []);

  return { settings, setMasterOn, setSyncOn };
}
