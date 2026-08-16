import type { ProviderInfo } from '@/types';

export interface ProviderMeta {
  id: string;
  label: string;
  mediaType: 'movie' | 'series' | 'anime' | 'manga' | 'game' | 'music';
  needsKey: boolean;
  keySetting: string | null;
  docUrl: string;
}

/**
 * Static metadata for all API providers. This mirrors the Rust registry
 * (`src-tauri/src/api/registry.rs`) and is used for UI grouping/labels.
 */
export const PROVIDER_METADATA: ProviderMeta[] = [
  { id: 'tmdb', label: 'TMDB', mediaType: 'movie', needsKey: true, keySetting: 'api_key_tmdb', docUrl: 'https://developer.themoviedb.org/docs' },
  { id: 'omdb', label: 'OMDb', mediaType: 'movie', needsKey: true, keySetting: 'api_key_omdb', docUrl: 'https://www.omdbapi.com/apikey.aspx' },
  { id: 'tmdb', label: 'TMDB', mediaType: 'series', needsKey: true, keySetting: 'api_key_tmdb', docUrl: 'https://developer.themoviedb.org/docs' },
  { id: 'tvmaze', label: 'TVMaze', mediaType: 'series', needsKey: false, keySetting: null, docUrl: 'https://www.tvmaze.com/api' },
  { id: 'jikan_anime', label: 'Jikan (MyAnimeList)', mediaType: 'anime', needsKey: false, keySetting: null, docUrl: 'https://docs.api.jikan.moe/' },
  { id: 'anilist_anime', label: 'AniList', mediaType: 'anime', needsKey: false, keySetting: null, docUrl: 'https://docs.anilist.co/' },
  { id: 'jikan_manga', label: 'Jikan (MyAnimeList)', mediaType: 'manga', needsKey: false, keySetting: null, docUrl: 'https://docs.api.jikan.moe/' },
  { id: 'anilist_manga', label: 'AniList', mediaType: 'manga', needsKey: false, keySetting: null, docUrl: 'https://docs.anilist.co/' },
  { id: 'rawg', label: 'RAWG', mediaType: 'game', needsKey: true, keySetting: 'api_key_rawg', docUrl: 'https://rawg.io/apidocs' },
  { id: 'thegamesdb', label: 'TheGamesDB', mediaType: 'game', needsKey: true, keySetting: 'api_key_thegamesdb', docUrl: 'https://api.thegamesdb.net/key.php' },
  { id: 'musicbrainz', label: 'MusicBrainz', mediaType: 'music', needsKey: false, keySetting: null, docUrl: 'https://musicbrainz.org/doc/MusicBrainz_API' },
  { id: 'itunes', label: 'iTunes', mediaType: 'music', needsKey: false, keySetting: null, docUrl: 'https://performance-partners.apple.com/search-api' },
];

export const MEDIA_TYPE_LABELS: Record<ProviderMeta['mediaType'], string> = {
  movie: 'movie',
  series: 'series',
  anime: 'anime',
  manga: 'manga',
  game: 'game',
  music: 'music',
};

/**
 * Group providers by media type for UI display.
 */
export function getProvidersByType(): Record<string, ProviderMeta[]> {
  const groups: Record<string, ProviderMeta[]> = {};
  for (const p of PROVIDER_METADATA) {
    if (!groups[p.mediaType]) groups[p.mediaType] = [];
    groups[p.mediaType].push(p);
  }
  return groups;
}

/**
 * The unique provider IDs (some appear twice for different media types).
 */
export function getUniqueProviderIds(): string[] {
  return [...new Set(PROVIDER_METADATA.map((p) => p.id))];
}

/**
 * API keys that need to be configured in Settings.
 */
export const API_KEY_SETTINGS: { key: string; label: string; docUrl: string }[] = [
  { key: 'api_key_tmdb', label: 'TMDB', docUrl: 'https://developer.themoviedb.org/docs' },
  { key: 'api_key_omdb', label: 'OMDb', docUrl: 'https://www.omdbapi.com/apikey.aspx' },
  { key: 'api_key_rawg', label: 'RAWG', docUrl: 'https://rawg.io/apidocs' },
  { key: 'api_key_thegamesdb', label: 'TheGamesDB', docUrl: 'https://api.thegamesdb.net/key.php' },
];

/**
 * Parse the api_providers JSON string from a collection into an array of
 * provider IDs. Returns empty array if null/invalid.
 */
export function parseApiProviders(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * Serialize an array of provider IDs into the JSON string stored in the DB.
 */
export function serializeApiProviders(ids: string[]): string {
  return JSON.stringify(ids);
}

/**
 * Merge the static metadata with the runtime availability info from the
 * backend, returning a list of providers grouped by media type with their
 * availability status.
 */
export function mergeProviderInfo(
  providers: ProviderInfo[],
): Record<string, (ProviderMeta & { available: boolean })[]> {
  const groups: Record<string, (ProviderMeta & { available: boolean })[]> = {};
  for (const info of providers) {
    const meta = PROVIDER_METADATA.find(
      (m) => m.id === info.id && m.mediaType === info.media_type,
    );
    if (!meta) continue;
    if (!groups[meta.mediaType]) groups[meta.mediaType] = [];
    groups[meta.mediaType].push({ ...meta, available: info.available });
  }
  return groups;
}
