import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { profilesApi } from '@/lib/tauri-api';
import type { CreateProfileDto, UpdateProfileDto } from '@/types';
import { clearSettingsStore, getSettingsStore, hydrateStoreFromBackend } from '@/stores/useSettingsStore';

export const PROFILES_KEY = ['profiles'] as const;
export const ACTIVE_PROFILE_KEY = ['active-profile'] as const;

export function useProfiles() {
  return useQuery({
    queryKey: PROFILES_KEY,
    queryFn: () => profilesApi.getAll(),
  });
}

export function useActiveProfile() {
  return useQuery({
    queryKey: ACTIVE_PROFILE_KEY,
    queryFn: () => profilesApi.getActive(),
  });
}

export function useCreateProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dto: CreateProfileDto) => profilesApi.create(dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PROFILES_KEY });
    },
  });
}

export function useUpdateProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dto: UpdateProfileDto) => profilesApi.update(dto),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: PROFILES_KEY });
      queryClient.invalidateQueries({ queryKey: ACTIVE_PROFILE_KEY });
    },
  });
}

export function useDeleteProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (profileId: string) => profilesApi.delete(profileId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PROFILES_KEY });
    },
  });
}

export function useSwitchProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (profileId: string) => {
      // Clear old profile's settings store from cache
      clearSettingsStore('current');
      
      // Switch profile in backend (changes DB connection)
      const result = await profilesApi.switch(profileId);
      
      // Get or create the new profile's settings store and hydrate it
      const newStore = getSettingsStore(profileId);
      await hydrateStoreFromBackend(profileId, newStore);
      
      return result;
    },
    onSuccess: () => {
      // Invalidate everything — the DB connection has changed
      queryClient.invalidateQueries();
    },
  });
}
