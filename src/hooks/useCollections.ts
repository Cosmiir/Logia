import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { tauriApi } from '@/lib/tauri-api';
import type { CreateCollectionDto, UpdateCollectionDto } from '@/types';

export function useCollections() {
  return useQuery({
    queryKey: ['collections'],
    queryFn: () => tauriApi.collections.getAll(),
    staleTime: Infinity,
  });
}

export function useCollection(collectionId: number | null) {
  return useQuery({
    queryKey: ['collections', collectionId],
    queryFn: () => collectionId ? tauriApi.collections.getById(collectionId) : null,
    enabled: !!collectionId,
  });
}

export function useCreateCollection() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateCollectionDto) => tauriApi.collections.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['collections'] });
    },
  });
}

export function useUpdateCollection() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: UpdateCollectionDto) => tauriApi.collections.update(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['collections'] });
    },
  });
}

export function useDeleteCollection() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (collectionId: number) => tauriApi.collections.delete(collectionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['collections'] });
      queryClient.invalidateQueries({ queryKey: ['media'] });
      queryClient.invalidateQueries({ queryKey: ['stats'] });
    },
  });
}

export function useDeleteCollectionWithOptions() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (params: { collectionId: number; mode: 'delete_media' | 'unlink' | 'transfer'; targetCollectionId?: number }) =>
      tauriApi.collections.deleteWithOptions(params.collectionId, params.mode, params.targetCollectionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['collections'] });
      queryClient.invalidateQueries({ queryKey: ['media'] });
      queryClient.invalidateQueries({ queryKey: ['stats'] });
    },
  });
}

export function useReorderCollections() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (collectionIds: number[]) => tauriApi.collections.reorder(collectionIds),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['collections'] });
    },
  });
}
