import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { NotificationPreferences } from '@/types';
import { settingsApi } from '@/lib/tauri-api';

/* ================================================================== */
/*  Types                                                              */
/* ================================================================== */
export type LogoVariant = 'classic' | 'glow' | 'split' | 'tight' | 'dot' | 'fade';
export type CardDensity = 'compact' | 'normal' | 'large' | 'detailed';
export type WindowControlsStyle = 'windows' | 'macos' | 'hybrid';

export interface ProfileState {
  username: string;
  /** 'default-1' … 'default-6' for built-in avatars, or a data-URL / file path for custom */
  avatarId: string;
  /** Base64 data-URL stored when user imports a custom image */
  customAvatarDataUrl: string | null;
}

export interface PersonalizationState {
  themeId: string;
  logoVariant: LogoVariant;
  cardDensity: CardDensity;
  animationsEnabled: boolean;
  windowControlsStyle: WindowControlsStyle;
  showProfileSelectorOnStartup: boolean;
}

export interface WindowState {
  isMaximized: boolean;
}

export interface SettingsState {
  // Profile
  profile: ProfileState;
  setUsername: (name: string) => void;
  setAvatar: (avatarId: string, customDataUrl?: string | null) => void;

  // Personalization
  personalization: PersonalizationState;
  setThemeId: (themeId: string) => void;
  setLogoVariant: (variant: LogoVariant) => void;
  setCardDensity: (density: CardDensity) => void;
  setAnimationsEnabled: (enabled: boolean) => void;
  setWindowControlsStyle: (style: WindowControlsStyle) => void;
  setShowProfileSelectorOnStartup: (show: boolean) => void;

  // Language
  language: string;
  setLanguage: (language: string) => void;

  // Notifications
  notifications: NotificationPreferences;
  setStagnantMedia: (enabled: boolean) => void;
  setWaitingMedia: (enabled: boolean) => void;
  setNearCompletion: (enabled: boolean) => void;
  setObjectiveDeadline: (enabled: boolean) => void;
  setObjectiveStalled: (enabled: boolean) => void;
  setObjectiveAchieved: (enabled: boolean) => void;
  setMonthlyReport: (enabled: boolean) => void;

  // Window
  window: WindowState;
  setIsMaximized: (isMaximized: boolean) => void;

  // Library View Mode
  libraryViewMode: 'grid' | 'list';
  setLibraryViewMode: (viewMode: 'grid' | 'list') => void;
}

/* ================================================================== */
/*  Defaults                                                           */
/* ================================================================== */
const DEFAULT_PROFILE: ProfileState = {
  username: 'Utilisateur',
  avatarId: 'default-1',
  customAvatarDataUrl: null,
};

const DEFAULT_PERSONALIZATION: PersonalizationState = {
  themeId: 'nebula',
  logoVariant: 'classic',
  cardDensity: 'normal',
  animationsEnabled: true,
  windowControlsStyle: 'windows',
  showProfileSelectorOnStartup: true,
};

const DEFAULT_NOTIFICATIONS: NotificationPreferences = {
  stagnantMedia: true,
  waitingMedia: true,
  nearCompletion: true,
  objectiveDeadline: true,
  objectiveStalled: true,
  objectiveAchieved: true,
  monthlyReport: true,
};

const DEFAULT_WINDOW: WindowState = {
  isMaximized: false,
};

const DEFAULT_LANGUAGE = 'en';

const validVariants: LogoVariant[] = ['classic', 'glow', 'split', 'tight', 'dot', 'fade'];

// Helper to hydrate store from backend settings
export const hydrateStoreFromBackend = async (_profileId: string, store: ReturnType<typeof createSettingsStore>) => {
  try {
    const raw = await settingsApi.getAll();
    
    // Map backend keys to store structure
    const state = store.getState();
    
    if (raw.theme_id) {
      state.setThemeId(raw.theme_id);
    }
    if (raw.logo_variant && validVariants.includes(raw.logo_variant as LogoVariant)) {
      state.setLogoVariant(raw.logo_variant as LogoVariant);
    }
    if (raw.card_density) {
      state.setCardDensity(raw.card_density as CardDensity);
    }
    if (raw.animations_enabled !== undefined) {
      state.setAnimationsEnabled(raw.animations_enabled === 'true');
    }
    if (raw.window_controls_style) {
      state.setWindowControlsStyle(raw.window_controls_style as WindowControlsStyle);
    }
    if (raw.show_profile_selector_on_startup !== undefined) {
      state.setShowProfileSelectorOnStartup(raw.show_profile_selector_on_startup !== 'false');
    }
    if (raw.library_view_mode) {
      state.setLibraryViewMode(raw.library_view_mode as 'grid' | 'list');
    }
    if (raw.language) {
      state.setLanguage(raw.language);
    }
    if (raw.notification_prefs) {
      try {
        const prefs = JSON.parse(raw.notification_prefs);
        // Apply each notification preference
        if (prefs.stagnantMedia !== undefined) state.setStagnantMedia(prefs.stagnantMedia);
        if (prefs.waitingMedia !== undefined) state.setWaitingMedia(prefs.waitingMedia);
        if (prefs.nearCompletion !== undefined) state.setNearCompletion(prefs.nearCompletion);
        if (prefs.objectiveDeadline !== undefined) state.setObjectiveDeadline(prefs.objectiveDeadline);
        if (prefs.objectiveStalled !== undefined) state.setObjectiveStalled(prefs.objectiveStalled);
        if (prefs.objectiveAchieved !== undefined) state.setObjectiveAchieved(prefs.objectiveAchieved);
        if (prefs.monthlyReport !== undefined) state.setMonthlyReport(prefs.monthlyReport);
      } catch (e) {
        console.error('Failed to parse notification_prefs:', e);
      }
    }
  } catch (e) {
    console.error('Failed to hydrate store from backend:', e);
  }
};

/* ================================================================== */
/*  Store                                                              */
/* ================================================================== */
// Helper to get storage key for a specific profile
const getStorageKey = (profileId: string) => `logia-settings-${profileId}`;

// Helper to sync a setting to the backend
const syncToBackend = async (key: string, value: unknown) => {
  try {
    let serialized: string;
    if (typeof value === 'boolean') {
      serialized = String(value);
    } else if (typeof value === 'object') {
      serialized = JSON.stringify(value);
    } else {
      serialized = String(value);
    }
    await settingsApi.update(key, serialized);
  } catch (e) {
    console.error('Failed to sync setting to backend:', e);
  }
};

// Create the store factory (for per-profile stores)
const createSettingsStore = (profileId: string) => {
  return create<SettingsState>()(
    persist(
      (set) => ({
        // --- Profile ---
        profile: DEFAULT_PROFILE,
        setUsername: (name) =>
          set((s) => ({ profile: { ...s.profile, username: name } })),
        setAvatar: (avatarId, customDataUrl) =>
          set((s) => ({
            profile: {
              ...s.profile,
              avatarId,
              customAvatarDataUrl: customDataUrl ?? (avatarId.startsWith('default-') ? null : s.profile.customAvatarDataUrl),
            },
          })),

        // --- Personalization ---
        personalization: DEFAULT_PERSONALIZATION,
        setThemeId: (themeId) => {
          syncToBackend('theme_id', themeId);
          set((s) => ({ personalization: { ...s.personalization, themeId } }));
        },
        setLogoVariant: (variant) => {
          syncToBackend('logo_variant', variant);
          set((s) => ({ personalization: { ...s.personalization, logoVariant: variant } }));
        },
        setCardDensity: (density) => {
          syncToBackend('card_density', density);
          set((s) => {
            const libraryViewMode = density === 'detailed' ? 'list' : 'grid';
            syncToBackend('library_view_mode', libraryViewMode);
            return {
              personalization: { ...s.personalization, cardDensity: density },
              libraryViewMode
            };
          });
        },
        setAnimationsEnabled: (enabled) => {
          syncToBackend('animations_enabled', enabled);
          set((s) => ({ personalization: { ...s.personalization, animationsEnabled: enabled } }));
        },
        setWindowControlsStyle: (style) => {
          syncToBackend('window_controls_style', style);
          set((s) => ({ personalization: { ...s.personalization, windowControlsStyle: style } }));
        },
        setShowProfileSelectorOnStartup: (show) => {
          syncToBackend('show_profile_selector_on_startup', show);
          set((s) => ({ personalization: { ...s.personalization, showProfileSelectorOnStartup: show } }));
        },

        // --- Language ---
        language: DEFAULT_LANGUAGE,
        setLanguage: (language) => {
          syncToBackend('language', language);
          set(() => ({ language }));
        },

        // --- Notifications ---
        notifications: DEFAULT_NOTIFICATIONS,
        setStagnantMedia: (enabled) => {
          set((s) => {
            const newNotifications = { ...s.notifications, stagnantMedia: enabled };
            syncToBackend('notification_prefs', newNotifications);
            return { notifications: newNotifications };
          });
        },
        setWaitingMedia: (enabled) => {
          set((s) => {
            const newNotifications = { ...s.notifications, waitingMedia: enabled };
            syncToBackend('notification_prefs', newNotifications);
            return { notifications: newNotifications };
          });
        },
        setNearCompletion: (enabled) => {
          set((s) => {
            const newNotifications = { ...s.notifications, nearCompletion: enabled };
            syncToBackend('notification_prefs', newNotifications);
            return { notifications: newNotifications };
          });
        },
        setObjectiveDeadline: (enabled) => {
          set((s) => {
            const newNotifications = { ...s.notifications, objectiveDeadline: enabled };
            syncToBackend('notification_prefs', newNotifications);
            return { notifications: newNotifications };
          });
        },
        setObjectiveStalled: (enabled) => {
          set((s) => {
            const newNotifications = { ...s.notifications, objectiveStalled: enabled };
            syncToBackend('notification_prefs', newNotifications);
            return { notifications: newNotifications };
          });
        },
        setObjectiveAchieved: (enabled) => {
          set((s) => {
            const newNotifications = { ...s.notifications, objectiveAchieved: enabled };
            syncToBackend('notification_prefs', newNotifications);
            return { notifications: newNotifications };
          });
        },
        setMonthlyReport: (enabled) => {
          set((s) => {
            const newNotifications = { ...s.notifications, monthlyReport: enabled };
            syncToBackend('notification_prefs', newNotifications);
            return { notifications: newNotifications };
          });
        },

        // --- Window ---
        window: DEFAULT_WINDOW,
        setIsMaximized: (isMaximized) =>
          set((s) => ({ window: { ...s.window, isMaximized } })),
        
        // --- Library View Mode ---
        libraryViewMode: 'grid',
        setLibraryViewMode: (viewMode) => {
          syncToBackend('library_view_mode', viewMode);
          set((s) => {
            let newDensity = s.personalization.cardDensity;
            if (viewMode === 'list') {
              newDensity = 'detailed';
            } else if (newDensity === 'detailed') {
              newDensity = 'normal';
            }
            syncToBackend('card_density', newDensity);
            return {
              libraryViewMode: viewMode,
              personalization: { ...s.personalization, cardDensity: newDensity }
            };
          });
        },
      }),
      {
        name: getStorageKey(profileId),
        storage: createJSONStorage(() => localStorage),
        partialize: (state) => ({
          profile: state.profile,
          personalization: state.personalization,
          language: state.language,
          notifications: state.notifications,
          libraryViewMode: state.libraryViewMode,
          // window intentionally excluded — runtime state only
        }),
      }
    )
  );
};

// Store cache to avoid recreating stores
const storeCache = new Map<string, ReturnType<typeof createSettingsStore>>();

// Get or create store for a profile
export const getSettingsStore = (profileId: string) => {
  if (!storeCache.has(profileId)) {
    storeCache.set(profileId, createSettingsStore(profileId));
  }
  return storeCache.get(profileId)!;
};

// Clear store from cache (when switching profiles)
export const clearSettingsStore = (profileId: string) => {
  storeCache.delete(profileId);
};

/**
 * @deprecated Use useProfileSettingsStore() from '@/hooks/useProfileSettingsStore' instead.
 * This default store uses a hardcoded 'default' profile and will be out of sync
 * with the actual active profile's settings.
 */
export const useSettingsStore = createSettingsStore('default');
