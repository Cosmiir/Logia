import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { settingsApi } from '@/lib/tauri-api';

export const PROFILE_SETTINGS_KEY = ['profile-settings'] as const;

export interface ProfileSettings {
  theme_id: string;
  logo_variant: string;
  card_density: string;
  animations_enabled: boolean;
  window_controls_style: string;
  show_profile_selector_on_startup: boolean;
  notification_prefs: {
    stagnantMedia: boolean;
    waitingMedia: boolean;
    nearCompletion: boolean;
    objectiveDeadline: boolean;
    objectiveStalled: boolean;
    objectiveAchieved: boolean;
    monthlyReport: boolean;
  };
  library_view_mode: string;
}

function parseSettings(raw: Record<string, string>): ProfileSettings {
  return {
    theme_id: raw.theme_id || 'nebula',
    logo_variant: raw.logo_variant || 'classic',
    card_density: raw.card_density || 'normal',
    animations_enabled: raw.animations_enabled === 'true',
    window_controls_style: raw.window_controls_style || 'windows',
    show_profile_selector_on_startup: raw.show_profile_selector_on_startup !== 'false',
    notification_prefs: raw.notification_prefs 
      ? JSON.parse(raw.notification_prefs) 
      : {
          stagnantMedia: true,
          waitingMedia: true,
          nearCompletion: true,
          objectiveDeadline: true,
          objectiveStalled: true,
          objectiveAchieved: true,
          monthlyReport: true,
        },
    library_view_mode: raw.library_view_mode || 'grid',
  };
}

function serializeSettings(settings: Partial<ProfileSettings>): Record<string, string> {
  const result: Record<string, string> = {};
  
  if (settings.theme_id !== undefined) result.theme_id = settings.theme_id;
  if (settings.logo_variant !== undefined) result.logo_variant = settings.logo_variant;
  if (settings.card_density !== undefined) result.card_density = settings.card_density;
  if (settings.animations_enabled !== undefined) result.animations_enabled = String(settings.animations_enabled);
  if (settings.window_controls_style !== undefined) result.window_controls_style = settings.window_controls_style;
  if (settings.show_profile_selector_on_startup !== undefined) result.show_profile_selector_on_startup = String(settings.show_profile_selector_on_startup);
  if (settings.notification_prefs !== undefined) result.notification_prefs = JSON.stringify(settings.notification_prefs);
  if (settings.library_view_mode !== undefined) result.library_view_mode = settings.library_view_mode;
  
  return result;
}

export function useProfileSettings() {
  return useQuery({
    queryKey: PROFILE_SETTINGS_KEY,
    queryFn: async () => {
      const raw = await settingsApi.getAll();
      return parseSettings(raw);
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

export function useUpdateSetting() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ key, value }: { key: keyof ProfileSettings; value: unknown }) => {
      const serialized = serializeSettings({ [key]: value } as Partial<ProfileSettings>);
      await settingsApi.update(key as string, serialized[key as string]);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PROFILE_SETTINGS_KEY });
    },
  });
}

export function useUpdateSettingsBatch() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (settings: Partial<ProfileSettings>) => {
      const serialized = serializeSettings(settings);
      await settingsApi.updateBatch(serialized);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PROFILE_SETTINGS_KEY });
    },
  });
}
