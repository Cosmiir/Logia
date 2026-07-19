import { useState, useEffect } from 'react';
import { listen } from '@tauri-apps/api/event';
import { dataApi } from '@/lib/tauri-api';
import type { AppStatus } from '@/types';

export function useAppStatus() {
  const [status, setStatus] = useState<AppStatus | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Load initial status
    dataApi.getAppStatus()
      .then(setStatus)
      .catch(console.error)
      .finally(() => setLoading(false));

    // Listen for status changes
    const unlisten = listen<boolean>('storage-status-changed', () => {
      dataApi.getAppStatus()
        .then(setStatus)
        .catch(console.error);
    });

    return () => {
      unlisten.then(f => f());
    };
  }, []);

  return { status, loading };
}
