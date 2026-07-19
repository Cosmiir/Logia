import { useQuery } from '@tanstack/react-query';
import { tauriApi } from '@/lib/tauri-api';
import type { Media } from '@/types';

const IN_PROGRESS_LIMIT = 28;
const RECENT_LIMIT = 15;

/**
 * Hook optimisé pour récupérer uniquement les médias "En cours"
 * Utilise le filtre backend IN_PROGRESS avec limite pour de meilleures perfs
 */
export function useInProgressMedia() {
  return useQuery<Media[], Error>({
    queryKey: ['media', 'in_progress', IN_PROGRESS_LIMIT],
    queryFn: async () => {
      return tauriApi.media.getAll({
        progressStatuses: ['IN_PROGRESS'],
        sortCriteria: [{ field: 'updated_at', order: 'desc' }],
        limit: IN_PROGRESS_LIMIT,
      });
    },
    staleTime: 30 * 1000, // 30s
  });
}

/**
 * Hook optimisé pour récupérer les derniers médias ajoutés
 * Utilise le tri backend created_at avec limite pour de meilleures perfs
 */
export function useRecentMedia() {
  return useQuery<Media[], Error>({
    queryKey: ['media', 'recent', RECENT_LIMIT],
    queryFn: async () => {
      return tauriApi.media.getAll({
        sortCriteria: [{ field: 'created_at', order: 'desc' }],
        limit: RECENT_LIMIT,
      });
    },
    staleTime: 30 * 1000, // 30s
  });
}
