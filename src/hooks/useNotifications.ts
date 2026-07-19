import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { tauriApi } from '@/lib/tauri-api';

export function useNotifications(profileId: string | null) {
  return useQuery({
    queryKey: ['notifications', profileId],
    queryFn: () => profileId ? tauriApi.notifications.getAll(profileId, 100) : [],
    enabled: !!profileId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

export function useUnreadCount(profileId: string | null) {
  return useQuery({
    queryKey: ['notifications', 'unread', profileId],
    queryFn: () => profileId ? tauriApi.notifications.getUnreadCount(profileId) : 0,
    enabled: !!profileId,
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
}

export function useMarkAsRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (notificationId: number) => tauriApi.notifications.markAsRead(notificationId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['notifications', 'unread'] });
    },
  });
}

export function useMarkAllAsRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (profileId: string) => tauriApi.notifications.markAllAsRead(profileId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['notifications', 'unread'] });
    },
  });
}

export function useDeleteNotification() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (notificationId: number) => tauriApi.notifications.delete(notificationId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['notifications', 'unread'] });
    },
  });
}
