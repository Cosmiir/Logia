import { useQuery, useMutation } from '@tanstack/react-query';
import { tauriApi } from '@/lib/tauri-api';
import type { ApiMediaDetail } from '@/types';

/**
 * Fetch the list of available API providers with their key-availability status.
 */
export function useApiProviders() {
  return useQuery({
    queryKey: ['api-providers'],
    queryFn: () => tauriApi.apiEnrichment.getProviders(),
    staleTime: 60_000, // 1 min — keys don't change often
  });
}

/**
 * Search across multiple providers. Returns a mutation so the caller controls
 * when to fire (e.g. after debounce).
 */
export function useApiSearch() {
  return useMutation({
    mutationFn: (params: { providers: string[]; query: string }) =>
      tauriApi.apiEnrichment.search(params.providers, params.query),
  });
}

/**
 * Fetch detail for a single media item from a provider.
 */
export function useApiDetail() {
  return useMutation({
    mutationFn: (params: { provider: string; id: string }): Promise<ApiMediaDetail> =>
      tauriApi.apiEnrichment.getDetail(params.provider, params.id),
  });
}

/**
 * Download an image from a URL and save it to a media's gallery.
 */
export function useDownloadApiImage() {
  return useMutation({
    mutationFn: (params: { url: string; mediaId: number }) =>
      tauriApi.apiEnrichment.downloadImage(params.url, params.mediaId),
  });
}
