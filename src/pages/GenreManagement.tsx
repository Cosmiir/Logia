import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Tag, Trash2, Palette, Plus, Search, X } from 'lucide-react';
import { AppShell, MainContent } from '@/components/Layout';
import SharedHeader from '@/components/SharedHeader';
import ConfirmDialog from '@/components/ConfirmDialog';
import ColorPicker from '@/components/ColorPicker';
import { useNavigationStore } from '@/stores/useNavigationStore';
import { tauriApi } from '@/lib/tauri-api';
import { COLLECTION_COLORS } from '@/lib/collection-icons';
import type { Genre } from '@/types';

const GenreManagement: React.FC = () => {
  const { t } = useTranslation();
  const { goBack } = useNavigationStore();
  const [genres, setGenres] = useState<Genre[]>([]);
  const [search, setSearch] = useState('');
  const [editingColorId, setEditingColorId] = useState<number | null>(null);
  const [newGenreName, setNewGenreName] = useState('');
  const [genreToDelete, setGenreToDelete] = useState<number | null>(null);
  const colorPickerRef = useRef<HTMLDivElement>(null);

  // Multi-select state
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedGenreIds, setSelectedGenreIds] = useState<number[]>([]);
  const [isBulkDeleteConfirmOpen, setIsBulkDeleteConfirmOpen] = useState(false);

  const toggleSelectionMode = () => {
    setIsSelectionMode(!isSelectionMode);
    setSelectedGenreIds([]);
  };

  const toggleGenreSelected = (genreId: number) => {
    setSelectedGenreIds((prev) =>
      prev.includes(genreId) ? prev.filter((id) => id !== genreId) : [...prev, genreId]
    );
  };

  const handleSelectAll = () => {
    if (selectedGenreIds.length === filtered.length) {
      setSelectedGenreIds([]);
    } else {
      setSelectedGenreIds(filtered.map((g) => g.id));
    }
  };

  const handleDeleteSelected = () => {
    setIsBulkDeleteConfirmOpen(true);
  };

  const confirmDeleteGenres = async () => {
    if (selectedGenreIds.length === 0) return;
    try {
      await Promise.all(selectedGenreIds.map((id) => tauriApi.genres.delete(id)));
      setGenres((prev) => prev.filter((g) => !selectedGenreIds.includes(g.id)));
      setSelectedGenreIds([]);
      setIsSelectionMode(false);
      setIsBulkDeleteConfirmOpen(false);
    } catch (err) {
      console.error('Failed to delete genres:', err);
    }
  };

  const loadGenres = async () => {
    try {
      const all = await tauriApi.genres.getAll();
      setGenres(all);
    } catch { /* ignore */ }
  };

  useEffect(() => { loadGenres(); }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (colorPickerRef.current && !colorPickerRef.current.contains(e.target as Node)) {
        setEditingColorId(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleDelete = async (genreId: number) => {
    setGenreToDelete(genreId);
  };

  const confirmDeleteGenre = async () => {
    if (!genreToDelete) return;
    try {
      await tauriApi.genres.delete(genreToDelete);
      setGenres((prev) => prev.filter((g) => g.id !== genreToDelete));
      setGenreToDelete(null);
    } catch (err) {
      console.error('Failed to delete genre:', err);
    }
  };

  const genreToDeleteName = genres.find(g => g.id === genreToDelete)?.name;

  const handleColorChange = async (genreId: number, color: string) => {
    try {
      await tauriApi.genres.updateColor(genreId, color);
      setGenres((prev) => prev.map((g) => g.id === genreId ? { ...g, color } : g));
    } catch (err) {
      console.error('Failed to update color:', err);
    }
  };

  const handleCreateGenre = async () => {
    if (!newGenreName.trim()) return;
    try {
      const randomColor = COLLECTION_COLORS[Math.floor(Math.random() * COLLECTION_COLORS.length)];
      const id = await tauriApi.genres.create(newGenreName.trim(), randomColor);
      setGenres((prev) => [...prev, { id, name: newGenreName.trim(), color: randomColor, created_at: new Date().toISOString() }]);
      setNewGenreName('');
    } catch { /* may already exist */ }
  };

  const filtered = search.trim()
    ? genres.filter((g) => g.name.toLowerCase().includes(search.toLowerCase()))
    : genres;

  return (
    <AppShell>
      <SharedHeader activePage="genre-management" />
      <MainContent>
        {/* Top bar */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={goBack}
              className="flex items-center justify-center w-9 h-9 rounded-xl bg-white/5 border border-white/10 text-text-secondary hover:bg-white/10 hover:text-white transition-all cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: '#8b5cf620' }}>
                <Tag className="w-4 h-4" style={{ color: '#8b5cf6' }} />
              </div>
              <h1 className="text-lg font-bold text-white">{t('genreManagement.title')}</h1>
            </div>
          </div>
          <span className="text-sm text-white/30">{genres.length} {t('genreManagement.genre', { count: genres.length })}</span>
        </div>

        <div className="glass-card rounded-2xl p-6">
          {/* Search + Create */}
          <div className="flex gap-3 mb-6">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t('genreManagement.searchPlaceholder')}
                className="w-full pl-10 pr-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-primary/30 transition-colors"
              />
              {search && (
                <button type="button" onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white cursor-pointer">
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={newGenreName}
                onChange={(e) => setNewGenreName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleCreateGenre(); }}
                placeholder={t('genreManagement.newGenrePlaceholder')}
                className="w-44 px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-primary/30 transition-colors"
              />
              <button
                type="button"
                onClick={handleCreateGenre}
                disabled={!newGenreName.trim()}
                className="flex items-center gap-1.5 px-4 py-2.5 bg-primary hover:bg-primary-dark rounded-xl text-sm font-semibold text-white transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Plus className="w-4 h-4" />
                {t('genreManagement.create')}
              </button>
            </div>
          </div>

          {/* Selection Actions Bar */}
          {genres.length > 0 && (
            <div className="flex items-center justify-between mb-5 px-3 py-2 bg-white/[0.02] border border-white/5 rounded-xl animate-fade-in">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={toggleSelectionMode}
                  className={`text-xs font-semibold px-3 py-1.5 rounded-lg border transition-all cursor-pointer ${
                    isSelectionMode
                      ? 'bg-primary/10 border-primary/30 text-primary hover:bg-primary/20'
                      : 'bg-white/5 border-white/10 text-white/60 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  {isSelectionMode ? 'Annuler la sélection' : 'Sélectionner plusieurs'}
                </button>
                {isSelectionMode && (
                  <button
                    type="button"
                    onClick={handleSelectAll}
                    className="text-xs font-medium px-3 py-1.5 bg-white/5 border border-white/10 hover:bg-white/10 text-white/80 rounded-lg cursor-pointer transition-colors"
                  >
                    {selectedGenreIds.length === filtered.length ? 'Tout désélectionner' : 'Tout sélectionner'}
                  </button>
                )}
              </div>
              {isSelectionMode && (
                <div className="flex items-center gap-3">
                  <span className="text-xs text-white/40">{selectedGenreIds.length} sélectionné{selectedGenreIds.length > 1 ? 's' : ''}</span>
                  <button
                    type="button"
                    onClick={handleDeleteSelected}
                    disabled={selectedGenreIds.length === 0}
                    className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/25 rounded-lg cursor-pointer transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Supprimer
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Genre list */}
          {filtered.length === 0 ? (
            <div className="text-center py-12 text-white/20">
              <Tag className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">{search ? t('genreManagement.noGenreFound') : t('genreManagement.noGenreCreated')}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {filtered.map((genre) => {
                const isSelected = selectedGenreIds.includes(genre.id);
                return (
                  <div
                    key={genre.id}
                    onClick={() => {
                      if (isSelectionMode) {
                        toggleGenreSelected(genre.id);
                      }
                    }}
                    className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group border ${
                      isSelectionMode
                        ? isSelected
                          ? 'bg-primary/10 border-primary/30 hover:bg-primary/15 cursor-pointer'
                          : 'bg-white/[0.01] border-white/5 hover:bg-white/[0.03] cursor-pointer'
                        : 'bg-transparent border-transparent hover:bg-white/5'
                    }`}
                  >
                    {/* Checkbox in selection mode */}
                    {isSelectionMode && (
                      <div className="shrink-0 flex items-center justify-center">
                        <div
                          className={`w-4 h-4 rounded border flex items-center justify-center transition-all ${
                            isSelected
                              ? 'bg-primary border-primary text-white'
                              : 'border-white/20 hover:border-white/40'
                          }`}
                        >
                          {isSelected && (
                            <svg className="w-3 h-3 stroke-[3] text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" strokeWidth="3" />
                            </svg>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Color indicator */}
                    <div className="relative" ref={editingColorId === genre.id ? colorPickerRef : undefined}>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (!isSelectionMode) {
                            setEditingColorId(editingColorId === genre.id ? null : genre.id);
                          } else {
                            toggleGenreSelected(genre.id);
                          }
                        }}
                        className={`w-8 h-8 rounded-lg border border-white/10 flex items-center justify-center transition-colors ${
                          !isSelectionMode ? 'cursor-pointer hover:border-white/30' : ''
                        }`}
                        style={{ backgroundColor: `${genre.color}30` }}
                      >
                        <div className="w-4 h-4 rounded-full" style={{ backgroundColor: genre.color }} />
                      </button>
                      {editingColorId === genre.id && !isSelectionMode && (
                        <div className="absolute z-50 top-full left-0 mt-2 p-3 bg-[#12141f]/98 backdrop-blur-2xl border border-white/10 rounded-xl shadow-2xl w-[260px]">
                          <ColorPicker
                            value={genre.color}
                            onChange={(c) => handleColorChange(genre.id, c)}
                            label={t('common.color')}
                          />
                        </div>
                      )}
                    </div>

                    {/* Genre name pill */}
                    <span
                      className="inline-flex items-center justify-center px-3 py-1.5 rounded-full text-xs font-medium flex-1 select-none"
                      style={{ backgroundColor: `${genre.color}20`, border: `1px solid ${genre.color}50`, color: `color-mix(in srgb, ${genre.color} 75%, white)` }}
                    >
                      {genre.name}
                    </span>

                    {/* Actions */}
                    {!isSelectionMode && (
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingColorId(editingColorId === genre.id ? null : genre.id);
                          }}
                          className="w-8 h-8 flex items-center justify-center rounded-lg text-white/30 hover:text-white hover:bg-white/10 transition-all cursor-pointer"
                          title={t('genreManagement.changeColor')}
                        >
                          <Palette className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(genre.id);
                          }}
                          className="w-8 h-8 flex items-center justify-center rounded-lg text-white/30 hover:text-red-400 hover:bg-red-500/10 transition-all cursor-pointer"
                          title={t('media.delete')}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </MainContent>

      {/* Confirm delete genre dialog */}
      <ConfirmDialog
        open={genreToDelete !== null || isBulkDeleteConfirmOpen}
        onClose={() => {
          setGenreToDelete(null);
          setIsBulkDeleteConfirmOpen(false);
        }}
        title={
          genreToDelete !== null
            ? `Supprimer "${genreToDeleteName}" ?`
            : `Supprimer ${selectedGenreIds.length} genres ?`
        }
        description={
          genreToDelete !== null
            ? "Ce genre sera retiré de tous les médias qui l'utilisent."
            : `Ces ${selectedGenreIds.length} genres seront retirés de tous les médias qui les utilisent.`
        }
        iconColor="#ef4444"
        actions={[{
          label: 'Supprimer',
          variant: 'danger',
          icon: Trash2,
          onClick: genreToDelete !== null ? confirmDeleteGenre : confirmDeleteGenres,
        }]}
      />
    </AppShell>
  );
};

export default GenreManagement;