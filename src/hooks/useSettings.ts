import { useEffect, useState, useCallback } from 'react';
import type { Settings } from '../types';
import { getSettings, saveSettings } from '../db/db';

export function useSettings() {
  const [settings, setSettings] = useState<Settings | null>(null);

  useEffect(() => {
    getSettings().then(setSettings).catch(console.error);
  }, []);

  const setMasterOn = useCallback((masterOn: boolean) => {
    void saveSettings({ masterOn }).then(() => setSettings({ masterOn }));
  }, []);

  return { settings, setMasterOn };
}
