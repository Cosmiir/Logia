import { useEffect, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { tauriApi } from '@/lib/tauri-api';
import { useActiveProfile } from './useProfiles';
import { useProfileSettingsStore } from './useProfileSettingsStore';

export function useTriggerNotifications() {
  const queryClient = useQueryClient();
  const { data: activeProfile } = useActiveProfile();
  const preferences = useProfileSettingsStore((state) => state.notifications);

  const triggerNotifications = useCallback(async () => {
    if (!activeProfile?.id) return;

    try {
      await tauriApi.notifications.generateNotifications(activeProfile.id, preferences);
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['notifications', 'unread'] });
    } catch (error) {
      console.error('Failed to generate notifications:', error);
    }
  }, [activeProfile?.id, preferences, queryClient]);

  return { triggerNotifications };
}

export function useAutoGenerateNotifications() {
  const { triggerNotifications } = useTriggerNotifications();
  const { data: activeProfile } = useActiveProfile();

  // Generate notifications on profile load (startup)
  useEffect(() => {
    const generate = async () => {
      if (activeProfile?.id) {
        await triggerNotifications();
      }
    };
    generate();
  }, [activeProfile?.id, triggerNotifications]);
}
