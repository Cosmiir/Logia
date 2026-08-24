import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, X, Loader2, Check, AlertCircle, Image as ImageIcon } from 'lucide-react';
import { useApiSearch, useApiDetail } from '@/hooks/useApiEnrichment';
import type { ApiSearchResult, ApiMediaDetail } from '@/types';

interface ApiSearchModalProps {
  open: boolean;
  onClose: () => void;
  providers: string[];
  onSelect: (detail: ApiMediaDetail) => void;
}

const PROVIDER_LABELS: Record<string, string> = {
  tmdb: 'TMDB',
  omdb: 'OMDb',
  tvmaze: 'TVMaze',
  jikan_anime: 'Jikan',
  jikan_manga: 'Jikan',
  anilist_anime: 'AniList',
  anilist_manga: 'AniList',
  rawg: 'RAWG',
  igdb: 'IGDB',
  musicbrainz: 'MusicBrainz',
  itunes: 'iTunes',
  google_books: 'Google Books',
  openlibrary: 'Open Library',
  bgg: 'BoardGameGeek',
};

const ApiSearchModal: React.FC<ApiSearchModalProps> = ({
  open,
  onClose,
  providers,
  onSelect,
}) => {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [selectedResult, setSelectedResult] = useState<ApiSearchResult | null>(null);

  const searchMutation = useApiSearch();
  const detailMutation = useApiDetail();

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), 500);
    return () => clearTimeout(timer);
  }, [query]);

  // Trigger search when debounced query changes
  useEffect(() => {
    if (debouncedQuery.trim().length >= 2 && providers.length > 0) {
      searchMutation.mutate({ providers, query: debouncedQuery.trim() });
    }
  }, [debouncedQuery, providers]);

  // Reset on close
  useEffect(() => {
    if (!open) {
      setQuery('');
      setDebouncedQuery('');
      setSelectedResult(null);
      searchMutation.reset();
      detailMutation.reset();
    }
  }, [open]);

  const handleSelectResult = useCallback(
    async (result: ApiSearchResult) => {
      setSelectedResult(result);
      try {
        const detail = await detailMutation.mutateAsync({
          provider: result.provider,
          id: result.provider_id,
        });
        onSelect(detail);
      } catch {
        // Error is shown via detailMutation.isError
      }
    },
    [detailMutation, onSelect],
  );

  const results = searchMutation.data ?? [];
  const isLoading = searchMutation.isPending;
  const isFetchingDetail = detailMutation.isPending;
  const detailError = detailMutation.isError ? detailMutation.error : null;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            className="glass-card rounded-2xl w-full max-w-2xl max-h-[80vh] flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-white/10">
              <div className="flex items-center gap-2">
                <Search className="w-5 h-5 text-flashy-purple" />
                <h2 className="text-base font-semibold text-white">
                  {t('apiSearch.title')}
                </h2>
              </div>
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg hover:bg-white/10 transition-colors"
              >
                <X className="w-4 h-4 text-white/60" />
              </button>
            </div>

            {/* Search input */}
            <div className="p-4 border-b border-white/10">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={t('apiSearch.placeholder')}
                  autoFocus
                  className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-white/[0.03] border border-white/10 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-flashy-purple/40 transition-colors"
                />
                {isLoading && (
                  <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-flashy-purple" />
                )}
              </div>
              <p className="text-[10px] text-white/30 mt-2">
                {t('apiSearch.searchingIn', { count: providers.length })}
              </p>
            </div>

            {/* Results */}
            <div className="flex-1 overflow-y-auto custom-scrollbar p-4">
              {detailError && (
                <div className="flex items-center gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20 mb-3">
                  <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                  <p className="text-xs text-red-300">
                    {t('apiSearch.detailError')}: {String(detailError)}
                  </p>
                </div>
              )}

              {results.length === 0 && !isLoading && debouncedQuery.trim().length >= 2 && (
                <p className="text-sm text-white/30 text-center py-8">
                  {t('apiSearch.noResults')}
                </p>
              )}

              {results.length === 0 && debouncedQuery.trim().length < 2 && (
                <p className="text-sm text-white/30 text-center py-8">
                  {t('apiSearch.typeToSearch')}
                </p>
              )}

              <div className="space-y-2">
                {results.map((result, idx) => {
                  const isSelected =
                    selectedResult?.provider === result.provider &&
                    selectedResult?.provider_id === result.provider_id;
                  return (
                    <button
                      key={`${result.provider}-${result.provider_id}-${idx}`}
                      onClick={() => handleSelectResult(result)}
                      disabled={isFetchingDetail}
                      className={`w-full flex items-center gap-3 p-3 rounded-xl border text-left transition-all ${
                        isSelected
                          ? 'border-flashy-purple/40 bg-flashy-purple/10'
                          : 'border-white/10 bg-white/[0.03] hover:bg-white/[0.06] hover:border-white/15'
                      } ${isFetchingDetail && !isSelected ? 'opacity-50' : ''}`}
                    >
                      {/* Thumbnail */}
                      <div className="w-12 h-16 rounded-lg overflow-hidden bg-white/5 shrink-0 flex items-center justify-center">
                        {result.thumbnail_b64 ? (
                          <img
                            src={result.thumbnail_b64.startsWith('data:') ? result.thumbnail_b64 : `data:image/jpeg;base64,${result.thumbnail_b64}`}
                            alt={result.title}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <ImageIcon className="w-4 h-4 text-white/20" />
                        )}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-white truncate">
                          {result.title}
                        </p>
                        <div className="flex items-center gap-2 mt-0.5">
                          {result.year && (
                            <span className="text-[11px] text-white/40">{result.year}</span>
                          )}
                          {result.creator && (
                            <span className="text-[11px] text-white/40 truncate">
                              · {result.creator}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Source badge */}
                      <span className="text-[9px] font-semibold px-2 py-0.5 rounded-full bg-white/10 text-white/50 shrink-0">
                        {PROVIDER_LABELS[result.provider] ?? result.provider}
                      </span>

                      {/* Loading indicator on selected */}
                      {isSelected && isFetchingDetail && (
                        <Loader2 className="w-4 h-4 animate-spin text-flashy-purple shrink-0" />
                      )}
                      {isSelected && !isFetchingDetail && !detailError && (
                        <Check className="w-4 h-4 text-green-400 shrink-0" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default ApiSearchModal;
