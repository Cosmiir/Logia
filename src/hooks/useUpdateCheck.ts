import { useState, useCallback, useRef, useEffect } from 'react';
import { check, Update } from '@tauri-apps/plugin-updater';
import { relaunch } from '@tauri-apps/plugin-process';

export type UpdateStatus =
  | 'idle'
  | 'checking'
  | 'available'
  | 'not-available'
  | 'downloading'
  | 'installing'
  | 'error';

export interface UpdateCheckResult {
  status: UpdateStatus;
  update: Update | null;
  error: string | null;
  /** 0-100 progress during download/install */
  progress: number;
  /** True if the available update was skipped by the user for this version */
  skipped: boolean;
}

const SKIPPED_VERSION_KEY = 'logia.skippedVersion';

function getSkippedVersion(): string | null {
  try {
    return localStorage.getItem(SKIPPED_VERSION_KEY);
  } catch {
    return null;
  }
}

function setSkippedVersion(version: string) {
  try {
    localStorage.setItem(SKIPPED_VERSION_KEY, version);
  } catch {
    /* ignore */
  }
}

export function useUpdateCheck(autoCheckOnMount = true) {
  const [state, setState] = useState<UpdateCheckResult>({
    status: 'idle',
    update: null,
    error: null,
    progress: 0,
    skipped: false,
  });
  // Keep a ref to the latest Update object so async callbacks can access it
  const updateRef = useRef<Update | null>(null);

  const runCheck = useCallback(async (ignoreSkip = false): Promise<void> => {
    setState((s) => ({ ...s, status: 'checking', error: null }));
    try {
      const update = await check();
      updateRef.current = update;
      if (update) {
        const skippedVersion = getSkippedVersion();
        const isSkipped = !ignoreSkip && skippedVersion === update.version;
        setState({
          status: isSkipped ? 'not-available' : 'available',
          update,
          error: null,
          progress: 0,
          skipped: isSkipped,
        });
      } else {
        setState({
          status: 'not-available',
          update: null,
          error: null,
          progress: 0,
          skipped: false,
        });
      }
    } catch (err) {
      setState({
        status: 'error',
        update: null,
        error: err instanceof Error ? err.message : String(err),
        progress: 0,
        skipped: false,
      });
    }
  }, []);

  const downloadAndInstall = useCallback(async (): Promise<void> => {
    const update = updateRef.current;
    if (!update) return;
    setState((s) => ({ ...s, status: 'downloading', progress: 0 }));
    try {
      let received = 0;
      let total = 0;
      await update.downloadAndInstall((event) => {
        switch (event.event) {
          case 'Started':
            total = event.data.contentLength ?? 0;
            received = 0;
            setState((s) => ({ ...s, status: 'downloading', progress: 0 }));
            break;
          case 'Progress':
            received += event.data.chunkLength;
            setState((s) => ({
              ...s,
              status: 'downloading',
              progress: total > 0 ? Math.min(100, Math.round((received / total) * 100)) : s.progress,
            }));
            break;
          case 'Finished':
            setState((s) => ({ ...s, status: 'installing', progress: 100 }));
            break;
        }
      });
      // Installation finished — relaunch the app
      await relaunch();
    } catch (err) {
      setState({
        status: 'error',
        update: updateRef.current,
        error: err instanceof Error ? err.message : String(err),
        progress: 0,
        skipped: false,
      });
    }
  }, []);

  const skipVersion = useCallback((): void => {
    const update = updateRef.current;
    if (!update) return;
    setSkippedVersion(update.version);
    setState((s) => ({ ...s, status: 'not-available', skipped: true }));
  }, []);

  const ignoreForNow = useCallback((): void => {
    setState((s) => ({ ...s, status: 'not-available' }));
  }, []);

  const reset = useCallback((): void => {
    updateRef.current = null;
    setState({
      status: 'idle',
      update: null,
      error: null,
      progress: 0,
      skipped: false,
    });
  }, []);

  useEffect(() => {
    if (autoCheckOnMount) {
      // Defer the check slightly so it never blocks initial render
      const id = window.setTimeout(() => {
        runCheck(false).catch(() => { /* handled in runCheck */ });
      }, 800);
      return () => window.clearTimeout(id);
    }
  }, [autoCheckOnMount, runCheck]);

  return {
    ...state,
    runCheck,
    downloadAndInstall,
    skipVersion,
    ignoreForNow,
    reset,
  };
}
