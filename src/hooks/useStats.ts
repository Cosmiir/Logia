import { useQuery } from '@tanstack/react-query';
import { tauriApi } from '@/lib/tauri-api';

export function useDashboardStats() {
  return useQuery({
    queryKey: ['stats', 'dashboard'],
    queryFn: () => tauriApi.stats.getDashboard(),
    staleTime: 60 * 1000,
  });
}
