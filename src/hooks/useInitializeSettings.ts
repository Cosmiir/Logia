import { useEffect, useRef } from 'react';
import i18n from 'i18next';
import { useActiveProfile } from './useProfiles';
import { getSettingsStore, hydrateStoreFromBackend } from '@/stores/useSettingsStore';

/**
 * Hook to initialize settings store for the active profile on app startup.
 * Must be called in a component that has access to the active profile.
 */
export function useInitializeSettings() {
  const { data: activeProfile, isLoading } = useActiveProfile();
  const initializedRef = useRef<string | null>(null);

  useEffect(() => {
    if (isLoading || !activeProfile) return;

    // Only initialize once per profile
    if (initializedRef.current === activeProfile.id) return;

    const init = async () => {
      const store = getSettingsStore(activeProfile.id);
      await hydrateStoreFromBackend(activeProfile.id, store);
      const state = store.getState();
      if (state.language && state.language !== i18n.language) {
        i18n.changeLanguage(state.language);
      }
      initializedRef.current = activeProfile.id;
    };

    init();
  }, [activeProfile, isLoading]);

  // Return the current profile's store (or default if not ready)
  return {
    isReady: !isLoading && !!activeProfile,
    activeProfileId: activeProfile?.id ?? 'default',
  };
}
