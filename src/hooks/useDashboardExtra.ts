import { useQuery } from '@tanstack/react-query';
import { tauriApi } from '@/lib/tauri-api';
import type { Media, Collection } from '@/types';

/**
 * Hook to get media counts for all collections efficiently.
 */
export function useCollectionsMediaCounts(collections: Collection[]) {
  const collectionIds = collections.map((c) => c.id);

  return useQuery<Record<number, number>>({
    queryKey: ['collections-media-counts', collectionIds],
    queryFn: async () => {
      const counts: Record<number, number> = {};
      await Promise.all(
        collectionIds.map(async (id) => {
          try {
            const count = await tauriApi.media.countByCollection({ collectionId: id });
            counts[id] = count;
          } catch {
            counts[id] = 0;
          }
        })
      );
      return counts;
    },
    enabled: collectionIds.length > 0,
    staleTime: 30 * 1000,
  });
}

export interface ActivityItem {
  id: number;
  mediaId: number;
  title: string;
  creator?: string | null;
  coverImage?: string;
  collectionId: number | null;
  status: 'COMPLETED' | 'IN_PROGRESS' | 'ON_HOLD' | 'ABANDONED' | 'NOT_STARTED' | 'ADDED';
  progressCurrent?: number | null;
  progressTotal?: number | null;
  experienceDate?: string | null;
  updatedAt: string;
  createdAt: string;
  rating?: number | null;
}

/**
 * Hook to get recent activity based on recently updated media.
 */
export function useRecentActivity(limit: number = 4) {
  return useQuery<ActivityItem[]>({
    queryKey: ['recent-activity', limit],
    queryFn: async () => {
      const recentMedia = await tauriApi.media.getAll({
        sortCriteria: [{ field: 'updated_at', order: 'desc' }],
        limit: limit * 2,
      });

      return recentMedia.slice(0, limit).map((m: Media) => {
        let status: ActivityItem['status'] = 'ADDED';
        if (m.progress_status === 'COMPLETED') {
          status = 'COMPLETED';
        } else if (m.progress_status === 'IN_PROGRESS') {
          status = 'IN_PROGRESS';
        } else if (m.progress_status === 'ON_HOLD') {
          status = 'ON_HOLD';
        } else if (m.progress_status === 'ABANDONED') {
          status = 'ABANDONED';
        } else if (m.progress_status === 'NOT_STARTED') {
          status = 'ADDED';
        }

        return {
          id: m.id,
          mediaId: m.id,
          title: m.title,
          creator: m.creator,
          coverImage: m.cover_image,
          collectionId: m.collection_id,
          status,
          progressCurrent: m.progress_current,
          progressTotal: m.progress_total,
          experienceDate: m.experience_date,
          updatedAt: m.updated_at || m.created_at,
          createdAt: m.created_at,
          rating: m.user_rating,
        };
      });
    },
    staleTime: 30 * 1000,
  });
}

/**
 * Hook to get all media (for Hero Spotlight).
 * Backdrop filtering is done client-side based on user preference.
 */
export function useAllMediaWithBackdrops() {
  return useQuery<Media[]>({
    queryKey: ['media', 'with-backdrops'],
    queryFn: async () => {
      return tauriApi.media.getAll({
        limit: 5000,
      });
    },
    staleTime: 60 * 1000,
  });
}
