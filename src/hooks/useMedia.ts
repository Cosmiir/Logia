import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { tauriApi } from '@/lib/tauri-api';
import type { CreateMediaDto, UpdateMediaDto } from '@/types';
import type { FilterCriterion } from '@/stores/useFiltersStore';
import { useTriggerNotifications } from './useTriggerNotifications';

// Convert frontend filters to backend params
export function convertFiltersToBackend(filters: FilterCriterion[]) {
  const params: Record<string, unknown> = {};

  for (const filter of filters) {
    switch (filter.type) {
      case 'media_status': {
        const statuses = filter.value as string[];
        const mappedStatuses = [...statuses];
        if (statuses.includes('ABANDONED') && !statuses.includes('cancelled')) {
          mappedStatuses.push('cancelled');
        }
        if (statuses.includes('cancelled') && !statuses.includes('ABANDONED')) {
          mappedStatuses.push('ABANDONED');
        }
        params.mediaStatuses = mappedStatuses;
        break;
      }
      case 'progress_status':
        params.progressStatuses = filter.value as string[];
        break;
      case 'genres':
        params.genreIds = filter.value as number[];
        break;
      case 'people':
        params.personIds = filter.value as number[];
        break;
      case 'rating': {
        const val = filter.value as { operator: string; value: number | null; value2: number | null };
        if (val.operator === 'gte' && val.value != null) params.minRating = val.value;
        if (val.operator === 'lte' && val.value != null) params.maxRating = val.value;
        if (val.operator === 'eq' && val.value != null) {
          params.minRating = val.value;
          params.maxRating = val.value;
        }
        if (val.operator === 'between') {
          if (val.value != null) params.minRating = val.value;
          if (val.value2 != null) params.maxRating = val.value2;
        }
        break;
      }
      case 'duration': {
        const val = filter.value as { operator: string; value: number | null; value2: number | null };
        if (val.operator === 'gte' && val.value != null) params.progressTotalMin = val.value;
        if (val.operator === 'lte' && val.value != null) params.progressTotalMax = val.value;
        if (val.operator === 'between') {
          if (val.value != null) params.progressTotalMin = val.value;
          if (val.value2 != null) params.progressTotalMax = val.value2;
        }
        break;
      }
      case 'progression': {
        const val = filter.value as { operator: string; value: number | null; value2: number | null };
        if (val.operator === 'gte' && val.value != null) params.progressCurrentMin = val.value;
        if (val.operator === 'lte' && val.value != null) params.progressCurrentMax = val.value;
        if (val.operator === 'between') {
          if (val.value != null) params.progressCurrentMin = val.value;
          if (val.value2 != null) params.progressCurrentMax = val.value2;
        }
        break;
      }
      case 'creator':
        params.creators = filter.value as string[];
        break;
      case 'release_date': {
        const val = filter.value as { from: string; to: string };
        if (val.from) params.releaseDateFrom = val.from;
        if (val.to) params.releaseDateTo = val.to;
        break;
      }
      case 'experience_date': {
        const val = filter.value as { from: string; to: string };
        if (val.from) params.experienceDateFrom = val.from;
        if (val.to) params.experienceDateTo = val.to;
        break;
      }
      case 'created_at': {
        const val = filter.value as { from: string; to: string };
        if (val.from) params.createdAtFrom = val.from;
        if (val.to) params.createdAtTo = val.to;
        break;
      }
    }
  }

  return params;
}

function withoutCreatorFilter(filters: FilterCriterion[]) {
  return filters.filter((filter) => filter.type !== 'creator');
}

interface UseMediaParams {
  collectionId?: number;
  searchQuery?: string;
  filters?: FilterCriterion[];
  sortCriteria?: { field: string; order: 'asc' | 'desc' }[];
  limit?: number;
  offset?: number;
}

export function useMedia(params: UseMediaParams = {}) {
  const { collectionId, searchQuery, filters = [], sortCriteria, limit, offset } = params;

  return useQuery({
    queryKey: ['media', params],
    queryFn: async () => {
      const filterParams = convertFiltersToBackend(filters);

      let result;
      if (collectionId === undefined) {
        result = await tauriApi.media.getAll({
          searchQuery,
          ...filterParams,
          sortCriteria,
          limit,
          offset,
        });
      } else {
        result = await tauriApi.media.getByCollection({
          collectionId,
          searchQuery,
          ...filterParams,
          sortCriteria,
          limit,
          offset,
        });
      }

      return result;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes - éviter les re-fetchs inutiles
    placeholderData: keepPreviousData, // garder les anciennes données pendant le refetch (évite les skeletons quand itemsPerPage change)
  });
}

export function useMediaCount(params: { collectionId?: number; searchQuery?: string; filters?: FilterCriterion[] } = {}) {
  const { collectionId, searchQuery, filters = [] } = params;

  return useQuery({
    queryKey: ['media', 'count', params],
    queryFn: async () => {
      const filterParams = convertFiltersToBackend(filters);

      if (collectionId === undefined) {
        return tauriApi.media.countAll({
          searchQuery,
          ...filterParams,
        });
      }
      return tauriApi.media.countByCollection({
        collectionId,
        searchQuery,
        ...filterParams,
      });
    },
    staleTime: 5 * 60 * 1000,
    placeholderData: keepPreviousData,
  });
}

export function useDistinctCreators(params: { collectionId?: number; searchQuery?: string; filters?: FilterCriterion[]; enabled?: boolean } = {}) {
  const { collectionId, searchQuery, filters = [], enabled = true } = params;

  return useQuery({
    queryKey: ['media', 'distinct_creators', params],
    queryFn: async () => {
      const filterParams = convertFiltersToBackend(withoutCreatorFilter(filters));
      return tauriApi.media.getDistinctCreators({
        collectionId,
        searchQuery,
        ...filterParams,
      });
    },
    staleTime: 5 * 60 * 1000,
    enabled,
  });
}

export function useMediaDetail(mediaId: number | null) {
  return useQuery({
    queryKey: ['media', 'detail', mediaId],
    queryFn: () => mediaId ? tauriApi.media.getById(mediaId) : null,
    enabled: !!mediaId,
  });
}

export function useCreateMedia() {
  const queryClient = useQueryClient();
  const { triggerNotifications } = useTriggerNotifications();

  return useMutation({
    mutationFn: (data: CreateMediaDto) => tauriApi.media.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['media'] });
      queryClient.invalidateQueries({ queryKey: ['stats'] });
      triggerNotifications();
    },
  });
}

export function useUpdateMedia() {
  const queryClient = useQueryClient();
  const { triggerNotifications } = useTriggerNotifications();

  return useMutation({
    mutationFn: (data: UpdateMediaDto) => tauriApi.media.update(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['media'] });
      queryClient.invalidateQueries({ queryKey: ['stats'] });
      triggerNotifications();
    },
  });
}

export function useDeleteMedia() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (mediaId: number) => tauriApi.media.delete(mediaId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['media'] });
      queryClient.invalidateQueries({ queryKey: ['stats'] });
    },
  });
}

export function useSimilarMedia(mediaId: number | null, collectionId: number | null, limit: number = 4) {
  return useQuery({
    queryKey: ['media', 'similar', mediaId, collectionId, limit],
    queryFn: async () => {
      if (!mediaId || !collectionId) return [];

      const result = await tauriApi.media.getSimilar(mediaId, collectionId, limit);
      return result;
    },
    enabled: !!mediaId && !!collectionId,
    staleTime: 5 * 60 * 1000,
  });
}

export function useProgressRange(collectionId: number | null) {
  return useQuery({
    queryKey: ['media', 'progress_range', collectionId],
    queryFn: async () => {
      if (collectionId === null) return { min: 0, max: 100 };
      const [min, max] = await tauriApi.media.getProgressCurrentRange(collectionId);
      return { min, max };
    },
    enabled: collectionId !== null,
    staleTime: 5 * 60 * 1000,
  });
}
