import { useStore } from 'zustand';
import { useActiveProfile } from './useProfiles';
import { getSettingsStore, type SettingsState } from '@/stores/useSettingsStore';

/**
 * Hook that automatically resolves the correct settings store
 * based on the active profile. This ensures all settings components
 * use the same store instance as the rest of the app.
 */
export function useProfileSettingsStore<T>(selector: (state: SettingsState) => T): T {
  const { data: activeProfile } = useActiveProfile();
  const profileId = activeProfile?.id ?? 'default';
  const store = getSettingsStore(profileId);
  return useStore(store, selector);
}
