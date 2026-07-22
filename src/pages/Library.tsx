import React, { useState, useEffect, useRef, useCallback, useMemo, useLayoutEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { createPortal } from 'react-dom';
import Tooltip from '@/components/Tooltip';
import CustomDatePicker from '@/components/CustomDatePicker';
import RangeSlider from '@/components/RangeSlider';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Library as LibraryIcon,
  Search,
  SlidersHorizontal,
  LayoutGrid,
  List,
  Plus,
  Grid3X3,
  Grid2X2,
  Pencil,
  Trash2,
  X,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Star,
  Clock,
  Eye,
  Check,
  CheckCircle2,
  PlayCircle,
  PauseCircle,
  XCircle,
  GripVertical,
  Hash,
  TrendingUp,
  CalendarDays,
  BookOpen,
  User,
  Users,
  RotateCcw,
  CircleDot,
  Save,
  FolderOpen,
  ArrowRightLeft,
  Circle,
} from 'lucide-react';
import type { SortCriterion, SortPreset, FilterCriterion, FilterPreset, FilterType, NumericFilterValue, NumericOperator } from '@/stores/useFiltersStore';
import { useGenres } from '@/hooks/useGenres';
import { usePeople } from '@/hooks/usePeople';
import type { Genre, Person } from '@/types';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  type Modifier,
} from '@dnd-kit/core';
import {
  SortableContext,
  horizontalListSortingStrategy,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { AppShell, MainContent } from '@/components/Layout';
import { useNavigationStore } from '@/stores/useNavigationStore';
import { useProfileSettingsStore } from '@/hooks/useProfileSettingsStore';
import type { CardDensity } from '@/stores/useSettingsStore';
import { formatDateFr, getProgressStatus } from '@/lib/utils';
import { PROGRESS_STATUS_LABELS, PROGRESS_STATUS_COLORS, MEDIA_STATUS_LABELS, MEDIA_STATUS_COLORS } from '@/lib/status-labels';
import { useCollections, useDeleteCollectionWithOptions, useReorderCollections } from '@/hooks/useCollections';
import { useMedia, useUpdateMedia, useDeleteMedia, useMediaCount, useProgressRange, useDistinctCreators, convertFiltersToBackend } from '@/hooks/useMedia';
import { useFiltersStore } from '@/stores/useFiltersStore';
import { usePaginationStore } from '@/stores/usePaginationStore';
import { MemoizedMediaCard } from '@/components/MediaCard';
import { MediaCardSkeleton } from '@/components/MediaCardSkeleton';
import { getCollectionIconComponent } from '@/components/CollectionIcons';
import SharedHeader from '@/components/SharedHeader';
import ConfirmDialog from '@/components/ConfirmDialog';
import ContextMenu from '@/components/ContextMenu';
import { Pagination } from '@/components/Pagination';
import type { Collection, Media } from '@/types';

import { getRatingColor } from '@/utils/ratingColors';
import i18next from 'i18next';
import { tauriApi } from '@/lib/tauri-api';

const restrictToHorizontalAxis: Modifier = ({ transform }) => {
  if (!transform) return transform;
  return { ...transform, y: 0 };
};

/* ================================================================== */
/*  Dynamic list headers based on collection settings                     */
/* ================================================================== */
const getListHeaders = (collection?: Collection | null) => {
  const creatorLabel = collection?.creator_label || i18next.t('common.creator');
  const dateLabel = collection?.date_label || i18next.t('common.experienceDate');

  return [
    { label: i18next.t('common.collection'), className: 'text-center' },
    { label: i18next.t('common.title'), className: 'text-center' },
    { label: creatorLabel, className: 'text-center' },
    { label: i18next.t('common.releaseDate'), className: 'text-center whitespace-pre-line' },
    { label: collection?.duration_label || i18next.t('common.total'), className: 'text-center' },
    { label: i18next.t('common.progressStatus'), className: 'text-center whitespace-pre-line' },
    { label: dateLabel, className: 'text-center whitespace-pre-line' },
    { label: i18next.t('common.progression'), className: 'text-center' },
    { label: i18next.t('common.rating'), className: 'text-center' },
  ];
};


/* ================================================================== */
/*  Sort panel — multi-level sort criteria                              */
/* ================================================================== */
function getSortFields(collection?: Collection | null): { id: string; label: string; icon: React.ElementType }[] {
  const creatorLabel = collection?.creator_label || i18next.t('common.creator');
  const dateLabel = collection?.date_label || i18next.t('common.experienceDate');
  return [
    { id: 'title', label: i18next.t('common.title'), icon: Hash },
    { id: 'rating', label: i18next.t('common.rating'), icon: Star },
    { id: 'progress', label: i18next.t('common.progression'), icon: TrendingUp },
    { id: 'media_status', label: i18next.t('common.mediaStatus'), icon: CircleDot },
    { id: 'progress_status', label: i18next.t('common.progressStatus'), icon: PlayCircle },
    { id: 'release_date', label: i18next.t('common.releaseDate'), icon: CalendarDays },
    { id: 'experience_date', label: dateLabel, icon: BookOpen },
    { id: 'creator', label: creatorLabel, icon: User },
    { id: 'created_at', label: i18next.t('common.dateAdded'), icon: Clock },
  ];
}

type SortFieldDef = { id: string; label: string; icon: React.ElementType };

const SortCriterionRow: React.FC<{
  criterion: SortCriterion;
  index: number;
  sortableId: string;
  sortFields: SortFieldDef[];
  onUpdate: (index: number, updates: Partial<SortCriterion>) => void;
  onRemove: (index: number) => void;
  usedFields: string[];
}> = ({ criterion, index, sortableId, sortFields, onUpdate, onRemove, usedFields }) => {
  const [isFieldOpen, setIsFieldOpen] = useState(false);
  const fieldRef = useRef<HTMLButtonElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: sortableId });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    zIndex: isDragging ? 50 : undefined,
  };

  useEffect(() => {
    if (!isFieldOpen) return;
    const handler = (e: MouseEvent) => {
      if (dropRef.current && !dropRef.current.contains(e.target as Node) &&
          fieldRef.current && !fieldRef.current.contains(e.target as Node)) {
        setIsFieldOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [isFieldOpen]);

  const currentField = sortFields.find(f => f.id === criterion.field) || sortFields[0];
  const CurrentIcon = currentField.icon;

  // Compute dropdown position synchronously when opening to avoid flash at (0,0)
  const getDropdownPos = () => {
    if (!fieldRef.current) return { top: 0, left: 0, width: 0 };
    const rect = fieldRef.current.getBoundingClientRect();
    return { top: rect.bottom + 4, left: rect.left, width: Math.max(rect.width, 180) };
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} className="flex items-center gap-1.5 py-1.5 px-2 rounded-lg bg-white/[0.02] border border-white/5 hover:border-white/10 transition-colors">
      <div {...listeners} className="cursor-grab active:cursor-grabbing shrink-0 touch-none">
        <GripVertical className="w-3.5 h-3.5 text-white/15" />
      </div>
      {/* Field selector */}
      <div className="relative flex-1 min-w-0">
        <button
          ref={fieldRef}
          onClick={() => setIsFieldOpen(!isFieldOpen)}
          className="flex items-center gap-2 w-full px-2.5 py-1.5 bg-white/[0.03] hover:bg-white/[0.06] rounded-md text-[13px] text-white transition-colors cursor-pointer"
        >
          <CurrentIcon className="w-3.5 h-3.5 text-primary shrink-0" />
          <span className="flex-1 text-left font-semibold truncate">{currentField.label}</span>
        </button>
        {/* Field dropdown — portal to escape transform context */}
        {isFieldOpen && (() => {
          const pos = getDropdownPos();
          return createPortal(
            <div
              ref={dropRef}
              data-sort-dropdown
              className="fixed bg-[#1a1a1f] border border-white/10 rounded-xl shadow-2xl py-1 z-[100] animate-scale-in"
              style={{ top: pos.top, left: pos.left, width: pos.width }}
            >
              {sortFields.filter(f => !usedFields.includes(f.id) || f.id === criterion.field).map(f => {
                const FIcon = f.icon;
                const isActive = f.id === criterion.field;
                return (
                  <button
                    key={f.id}
                    onClick={() => { onUpdate(index, { field: f.id }); setIsFieldOpen(false); }}
                    className={`flex items-center gap-2.5 w-full px-3 py-2 text-[13px] transition-colors cursor-pointer ${
                      isActive ? 'text-primary bg-primary/10' : 'text-white/60 hover:bg-white/[0.06] hover:text-white'
                    }`}
                  >
                    <FIcon className="w-3.5 h-3.5" />
                    <span className="font-medium">{f.label}</span>
                    {isActive && <Check className="w-3 h-3 ml-auto text-primary" />}
                  </button>
                );
              })}
            </div>,
            document.body
          );
        })()}
      </div>
      {/* Asc/Desc toggle */}
      <button
        onClick={() => onUpdate(index, { order: criterion.order === 'asc' ? 'desc' : 'asc' })}
        className="flex items-center justify-center w-7 h-7 rounded-md bg-white/[0.03] hover:bg-white/[0.08] transition-colors cursor-pointer"
        title={criterion.order === 'asc' ? i18next.t('library.ascending') : i18next.t('library.descending')}
      >
        {criterion.order === 'asc'
          ? <ArrowUp className="w-3.5 h-3.5 text-primary" />
          : <ArrowDown className="w-3.5 h-3.5 text-primary" />
        }
      </button>
      {/* Remove */}
      <button
        onClick={() => onRemove(index)}
        className="flex items-center justify-center w-7 h-7 rounded-md hover:bg-red-500/10 transition-colors cursor-pointer"
      >
        <X className="w-3.5 h-3.5 text-white/20 hover:text-red-400" />
      </button>
    </div>
  );
};

const SortPanel: React.FC<{
  criteria: SortCriterion[];
  sortFields: SortFieldDef[];
  onAdd: (c: SortCriterion) => void;
  onRemove: (i: number) => void;
  onUpdate: (i: number, c: Partial<SortCriterion>) => void;
  onReorder: (from: number, to: number) => void;
  onReset: () => void;
  presets: SortPreset[];
  onSavePreset: (name: string) => void;
  onLoadPreset: (id: string) => void;
  onDeletePreset: (id: string) => void;
  isOpen: boolean;
  onToggle: () => void;
  buttonRef: React.RefObject<HTMLButtonElement | null>;
}> = ({ criteria, sortFields, onAdd, onRemove, onUpdate, onReorder, onReset, presets, onSavePreset, onLoadPreset, onDeletePreset, isOpen, onToggle, buttonRef }) => {
  const panelRef = useRef<HTMLDivElement>(null);
  const sortSensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 3 } }));
  const [presetName, setPresetName] = useState('');
  const [showPresets, setShowPresets] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      // Ignore clicks inside portalized sort-field dropdowns
      if (target.closest?.('[data-sort-dropdown]')) return;
      if (
        panelRef.current && !panelRef.current.contains(target) &&
        buttonRef.current && !buttonRef.current.contains(target)
      ) onToggle();
    };
    const keyHandler = (e: KeyboardEvent) => { if (e.key === 'Escape') onToggle(); };
    document.addEventListener('mousedown', handler);
    document.addEventListener('keydown', keyHandler);
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('keydown', keyHandler);
    };
  }, [isOpen, onToggle, buttonRef]);

  if (!isOpen) return null;

  const usedFields = criteria.map(c => c.field);
  const availableFields = sortFields.filter(f => !usedFields.includes(f.id));
  const canAdd = availableFields.length > 0;
  const isNonDefault = criteria.length !== 1 || criteria[0].field !== 'created_at' || criteria[0].order !== 'desc';

  const sortableIds = criteria.map((_, i) => `sort-${i}`);

  const handleSortDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = sortableIds.indexOf(active.id as string);
    const newIndex = sortableIds.indexOf(over.id as string);
    if (oldIndex !== -1 && newIndex !== -1) onReorder(oldIndex, newIndex);
  };

  return (
    <div
      ref={panelRef}
      className="absolute top-full right-0 mt-2 w-80 bg-[#111115] border border-white/10 rounded-2xl shadow-2xl z-50 animate-scale-in"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
        <div className="flex items-center gap-2.5">
          {canAdd && (
            <button
              onClick={() => {
                if (!isNonDefault) {
                  // Replace default sort with the first available non-default field
                  const firstNonDefault = sortFields.find(f => f.id !== 'created_at');
                  if (firstNonDefault) {
                    onUpdate(0, { field: firstNonDefault.id, order: 'asc' });
                  }
                } else {
                  const next = availableFields[0];
                  if (next) onAdd({ field: next.id, order: 'asc' });
                }
              }}
              className="flex items-center justify-center w-7 h-7 rounded-lg bg-primary/15 hover:bg-primary/25 text-primary transition-colors cursor-pointer"
              title={i18next.t('library.addCriterion')}
            >
              <Plus className="w-4 h-4" />
            </button>
          )}
          <span className="text-[11px] font-bold text-white/40 uppercase tracking-[0.15em]">{i18next.t('library.sort')}</span>
        </div>
        <div className="flex items-center gap-1.5">
          {isNonDefault && (
            <button
              onClick={onReset}
              className="flex items-center justify-center w-7 h-7 rounded-lg hover:bg-white/10 text-white/25 hover:text-white transition-colors cursor-pointer"
              title={i18next.t('library.reset')}
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
      {/* Criteria list */}
      <div className="px-3 py-3 space-y-1.5">
        {isNonDefault ? (
          <DndContext sensors={sortSensors} collisionDetection={closestCenter} onDragEnd={handleSortDragEnd}>
            <SortableContext items={sortableIds} strategy={verticalListSortingStrategy}>
              {criteria.map((criterion, index) => (
                <SortCriterionRow
                  key={`sort-row-${index}`}
                  criterion={criterion}
                  index={index}
                  sortableId={sortableIds[index]}
                  sortFields={sortFields}
                  onUpdate={onUpdate}
                  onRemove={onRemove}
                  usedFields={usedFields}
                />
              ))}
            </SortableContext>
          </DndContext>
        ) : (
          <p className="text-center text-[11px] text-white/25 py-3">{i18next.t('library.defaultSort')}</p>
        )}
      </div>
      {/* Presets section */}
      <div className="border-t border-white/5 px-3 py-2.5">
        <button
          onClick={() => setShowPresets(!showPresets)}
          className="flex items-center gap-2 w-full text-[11px] font-semibold text-white/30 uppercase tracking-wider hover:text-white/50 transition-colors cursor-pointer py-1"
        >
          <FolderOpen className="w-3 h-3" />
          {i18next.t('library.presets')}
          <svg className={`w-3 h-3 ml-auto transition-transform ${showPresets ? 'rotate-180' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9" /></svg>
        </button>
        {showPresets && (
          <div className="mt-2 space-y-1.5">
            {/* Save current */}
            {isNonDefault && (
              <div className="flex items-center gap-1.5">
                <input
                  type="text"
                  value={presetName}
                  onChange={(e) => setPresetName(e.target.value)}
                  placeholder={i18next.t('library.presetNamePlaceholder')}
                  className="flex-1 px-2.5 py-1.5 bg-white/5 border border-white/10 rounded-lg text-xs text-white placeholder:text-white/20 focus:outline-none focus:border-primary/40 transition-colors"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && presetName.trim()) {
                      onSavePreset(presetName.trim());
                      setPresetName('');
                    }
                  }}
                />
                <button
                  onClick={() => { if (presetName.trim()) { onSavePreset(presetName.trim()); setPresetName(''); } }}
                  disabled={!presetName.trim()}
                  className="flex items-center justify-center w-7 h-7 rounded-lg bg-primary/15 hover:bg-primary/25 text-primary transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-default"
                  title={i18next.t('library.save')}
                >
                  <Save className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
            {/* Preset list */}
            {presets.length > 0 ? (
              presets.map((p) => (
                <div key={p.id} className="flex items-center gap-1.5 group">
                  <button
                    onClick={() => onLoadPreset(p.id)}
                    className="flex-1 flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs text-white/50 hover:bg-white/5 hover:text-white transition-colors cursor-pointer text-left truncate"
                  >
                    <FolderOpen className="w-3 h-3 shrink-0" />
                    <span className="truncate">{p.name}</span>
                    <span className="text-[10px] text-white/20 ml-auto shrink-0">{p.criteria.length} critère{p.criteria.length > 1 ? 's' : ''}</span>
                  </button>
                  <button
                    onClick={() => onDeletePreset(p.id)}
                    className="flex items-center justify-center w-6 h-6 rounded-md opacity-0 group-hover:opacity-100 hover:bg-red-500/10 transition-all cursor-pointer"
                  >
                    <X className="w-3 h-3 text-white/20 hover:text-red-400" />
                  </button>
                </div>
              ))
            ) : (
              <p className="text-[10px] text-white/15 text-center py-2">{i18next.t('library.noPresets')}</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

/* ================================================================== */
/*  Filter system — pill-based UI with per-criterion popups             */
/* ================================================================== */
// Fonctions pour éviter que les labels soient capturés une seule fois au chargement
// du module (avant que i18next soit initialisé avec la bonne langue).
function getMediaStatusOpts() {
  return [
    { value: 'UPCOMING', label: MEDIA_STATUS_LABELS.UPCOMING, color: MEDIA_STATUS_COLORS.UPCOMING },
    { value: 'ONGOING', label: MEDIA_STATUS_LABELS.ONGOING, color: MEDIA_STATUS_COLORS.ONGOING },
    { value: 'COMPLETED', label: MEDIA_STATUS_LABELS.COMPLETED, color: MEDIA_STATUS_COLORS.COMPLETED },
    { value: 'hiatus', label: i18next.t('media.status.hiatus'), color: '#f59e0b' },
    { value: 'ABANDONED', label: MEDIA_STATUS_LABELS.ABANDONED, color: MEDIA_STATUS_COLORS.ABANDONED },
  ];
}

function getProgressStatusOpts() {
  return [
    { value: 'NOT_STARTED', label: PROGRESS_STATUS_LABELS.NOT_STARTED, color: PROGRESS_STATUS_COLORS.NOT_STARTED },
    { value: 'IN_PROGRESS', label: PROGRESS_STATUS_LABELS.IN_PROGRESS, color: PROGRESS_STATUS_COLORS.IN_PROGRESS },
    { value: 'ON_HOLD',     label: PROGRESS_STATUS_LABELS.ON_HOLD,     color: PROGRESS_STATUS_COLORS.ON_HOLD     },
    { value: 'ABANDONED',   label: PROGRESS_STATUS_LABELS.ABANDONED,   color: PROGRESS_STATUS_COLORS.ABANDONED   },
    { value: 'COMPLETED',   label: PROGRESS_STATUS_LABELS.COMPLETED,   color: PROGRESS_STATUS_COLORS.COMPLETED   },
  ];
}

type FilterTypeDef = { type: FilterType; label: string; icon: React.ElementType };

function getFilterTypes(collection?: Collection | null): FilterTypeDef[] {
  const creatorLabel = collection?.creator_label || i18next.t('common.creator');
  const dateLabel = collection?.date_label || i18next.t('common.experienceDate');
  return [
    { type: 'media_status', label: i18next.t('common.mediaStatus'), icon: CircleDot },
    { type: 'progress_status', label: i18next.t('common.progressStatus'), icon: PlayCircle },
    { type: 'genres', label: i18next.t('common.genre'), icon: Hash },
    { type: 'people', label: i18next.t('common.people'), icon: Users },
    { type: 'rating', label: i18next.t('common.rating'), icon: Star },
    { type: 'progression', label: i18next.t('common.progression'), icon: TrendingUp },
    { type: 'release_date', label: i18next.t('common.releaseDate'), icon: CalendarDays },
    { type: 'experience_date', label: dateLabel, icon: BookOpen },
    { type: 'creator', label: creatorLabel, icon: User },
    { type: 'created_at', label: i18next.t('common.dateAdded'), icon: Clock },
  ];
}

const NUMERIC_OP_LABELS: Record<NumericOperator, string> = {
  gte: '≥', lte: '≤', eq: '=', neq: '≠', between: '↔',
};

function getNumericSummary(nf: NumericFilterValue): string {
  if (nf.value == null && nf.value2 == null) return i18next.t('common.all');
  if (nf.operator === 'between') {
    if (nf.value != null && nf.value2 != null) return `${nf.value} – ${nf.value2}`;
    if (nf.value != null) return `≥ ${nf.value}`;
    if (nf.value2 != null) return `≤ ${nf.value2}`;
    return i18next.t('common.all');
  }
  return `${NUMERIC_OP_LABELS[nf.operator]} ${nf.value}`;
}

function getFilterSummary(filter: FilterCriterion, genres: Genre[], people: Person[]): string {
  switch (filter.type) {
    case 'media_status': {
      const vals = filter.value as string[];
      if (!vals.length) return i18next.t('common.all');
      return vals.map(v => {
        if (v === 'cancelled') return MEDIA_STATUS_LABELS.ABANDONED;
        return getMediaStatusOpts().find(o => o.value === v)?.label || v;
      }).join(', ');
    }
    case 'progress_status': {
      const vals = filter.value as string[];
      if (!vals.length) return i18next.t('common.all');
      return vals.map(v => getProgressStatusOpts().find(o => o.value === v)?.label || v).join(', ');
    }
    case 'genres': {
      const ids = filter.value as number[];
      if (!ids.length) return i18next.t('common.all');
      return ids.map(id => genres.find(g => g.id === id)?.name || `#${id}`).join(', ');
    }
    case 'people': {
      const ids = filter.value as number[];
      if (!ids.length) return i18next.t('common.all');
      return ids.map(id => people.find(p => p.id === id)?.name || `#${id}`).join(', ');
    }
    case 'rating':
    case 'progression':
    case 'duration': {
      const nf = filter.value as NumericFilterValue;
      if (!nf || nf.value == null) return i18next.t('common.all');
      return getNumericSummary(nf);
    }
    case 'creator': {
      const vals = filter.value as string[];
      if (!vals || !vals.length) return i18next.t('common.all');
      return vals.join(', ');
    }
    case 'release_date':
    case 'experience_date':
    case 'created_at': {
      const { from, to } = filter.value as { from: string; to: string };
      if (from && to) return `${from} → ${to}`;
      if (from) return i18next.t('common.fromDate', { date: from });
      if (to) return i18next.t('common.toDate', { date: to });
      return i18next.t('common.allDates');
    }
    default: return '';
  }
}

/** Reusable numeric filter UI with operator selector and interactive slider */
const NumericFilterPopup: React.FC<{
  value: NumericFilterValue;
  onChange: (v: NumericFilterValue) => void;
  min?: number;
  max?: number;
  step?: number;
  placeholder?: string;
}> = ({ value, onChange, min = 180, max, step = 1, placeholder = '0' }) => {
  const ops: { op: NumericOperator; label: string; desc: string }[] = [
    { op: 'gte', label: '≥', desc: 'Supérieur ou égal' },
    { op: 'lte', label: '≤', desc: 'Inférieur ou égal' },
    { op: 'eq', label: '=', desc: 'Égal à' },
    { op: 'neq', label: '≠', desc: 'Différent de' },
    { op: 'between', label: '↔', desc: 'Entre' },
  ];

  const handleSliderChange = (val: number | null, val2?: number | null) => {
    onChange({ ...value, value: val, value2: val2 ?? null });
  };

  return (
    <div className="p-3 space-y-3">
      {/* Operator selector */}
      <div className="flex gap-1">
        {ops.map(({ op, label, desc }) => (
          <button
            key={op}
            onClick={() => onChange({ ...value, operator: op })}
            title={desc}
            className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              value.operator === op
                ? 'bg-primary/20 text-primary border border-primary/30'
                : 'bg-white/5 text-white/40 border border-white/10 hover:bg-white/10 hover:text-white'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Interactive slider - hidden for = and ≠ operators */}
      {value.operator !== 'eq' && value.operator !== 'neq' && (
        <div>
          <RangeSlider
            value={value.value}
            value2={value.value2}
            min={min ?? 0}
            max={max ?? 100}
            step={step}
            operator={value.operator}
            onChange={handleSliderChange}
            className="mb-3"
          />
        </div>
      )}

      {/* Value inputs for precise control */}
      <div className={`grid gap-2 ${value.operator === 'between' ? 'grid-cols-2' : 'grid-cols-1'}`}>
        <div>
          <label className="text-[10px] font-medium text-white/40 mb-1 block">
            {value.operator === 'between' ? 'Min' : 'Valeur'}
          </label>
          <input
            type="number" min={min} max={max} step={step}
            value={value.value ?? ''}
            onChange={e => onChange({ ...value, value: e.target.value !== '' ? parseFloat(e.target.value) : null })}
            placeholder={placeholder}
            className="w-full px-2.5 py-2 bg-white/5 border border-white/10 rounded-lg text-xs text-white placeholder:text-white/20 focus:outline-none focus:border-primary/40 transition-colors"
          />
        </div>
        {value.operator === 'between' && (
          <div>
            <label className="text-[10px] font-medium text-white/40 mb-1 block">{i18next.t('library.max')}</label>
            <input
              type="number" min={min} max={max} step={step}
              value={value.value2 ?? ''}
              onChange={e => onChange({ ...value, value2: e.target.value !== '' ? parseFloat(e.target.value) : null })}
              placeholder={max?.toString() || '100'}
              className="w-full px-2.5 py-2 bg-white/5 border border-white/10 rounded-lg text-xs text-white placeholder:text-white/20 focus:outline-none focus:border-primary/40 transition-colors"
            />
          </div>
        )}
      </div>
    </div>
  );
};

const ProgressionFilterPopup: React.FC<{
  value: NumericFilterValue;
  onChange: (value: any) => void;
  collectionId: number | null;
}> = ({ value, onChange, collectionId }) => {
  const { data: progressRange } = useProgressRange(collectionId);
  const min = progressRange?.min ?? 0;
  const max = progressRange?.max ?? 100;
  return <NumericFilterPopup value={value} onChange={onChange} min={min} max={max} placeholder={min.toString()} />;
};

/** Popup content for a single filter — adapts based on type */
const FilterPopupContent: React.FC<{
  filter: FilterCriterion;
  genres: Genre[];
  people: Person[];
  creators: string[] | undefined;
  onUpdate: (value: any) => void;
  collectionId?: number | null;
}> = ({ filter, genres, people, creators: availableCreators, onUpdate, collectionId }) => {
  switch (filter.type) {
    case 'media_status': {
      const selected = (filter.value as string[]) || [];
      return (
        <div className="space-y-1 p-2">
          {getMediaStatusOpts().map(opt => {
            const isOn = opt.value === 'ABANDONED'
              ? (selected.includes('ABANDONED') || selected.includes('cancelled'))
              : selected.includes(opt.value);
            return (
              <button
                key={opt.value}
                onClick={() => {
                  let newSelected = [...selected];
                  if (opt.value === 'ABANDONED') {
                    if (isOn) {
                      newSelected = newSelected.filter(v => v !== 'ABANDONED' && v !== 'cancelled');
                    } else {
                      newSelected.push('ABANDONED');
                    }
                  } else {
                    if (isOn) {
                      newSelected = newSelected.filter(v => v !== opt.value);
                    } else {
                      newSelected.push(opt.value);
                    }
                  }
                  onUpdate(newSelected);
                }}
                className={`flex items-center gap-2.5 w-full px-2.5 py-2 rounded-lg text-xs transition-colors cursor-pointer ${isOn ? 'bg-white/10 text-white' : 'text-white/50 hover:bg-white/5 hover:text-white'}`}
              >
                <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: opt.color }} />
                <span className="flex-1 text-left">{opt.label}</span>
                {isOn && <Check className="w-3 h-3 text-primary shrink-0" />}
              </button>
            );
          })}
        </div>
      );
    }
    case 'progress_status': {
      const selected = (filter.value as string[]) || [];
      return (
        <div className="space-y-1 p-2">
          {getProgressStatusOpts().map(opt => {
            const isOn = selected.includes(opt.value);
            return (
              <button
                key={opt.value}
                onClick={() => onUpdate(isOn ? selected.filter(v => v !== opt.value) : [...selected, opt.value])}
                className={`flex items-center gap-2.5 w-full px-2.5 py-2 rounded-lg text-xs transition-colors cursor-pointer ${isOn ? 'bg-white/10 text-white' : 'text-white/50 hover:bg-white/5 hover:text-white'}`}
              >
                <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: opt.color }} />
                <span className="flex-1 text-left">{opt.label}</span>
                {isOn && <Check className="w-3 h-3 text-primary shrink-0" />}
              </button>
            );
          })}
        </div>
      );
    }
    case 'genres': {
      const selectedIds = (filter.value as number[]) || [];
      const [search, setSearch] = useState('');
      const DEFAULT_GENRE_COUNT = 10;
      const hasSearch = search.trim().length > 0;
      const selectedGenres = selectedIds.map(id => genres.find(g => g.id === id)).filter(Boolean) as Genre[];
      const availableGenres = genres.filter(g => !selectedIds.includes(g.id));
      const filtered = hasSearch
        ? availableGenres.filter(g => g.name.toLowerCase().includes(search.toLowerCase()))
        : availableGenres.slice(0, DEFAULT_GENRE_COUNT);
      const hiddenCount = !hasSearch ? Math.max(0, availableGenres.length - DEFAULT_GENRE_COUNT) : 0;

      const toggleGenre = (genreId: number) => {
        onUpdate(selectedIds.includes(genreId)
          ? selectedIds.filter(id => id !== genreId)
          : [...selectedIds, genreId]
        );
      };

      return (
        <div className="p-2 space-y-2">
          {/* Selected genres as colored pills */}
          {selectedGenres.length > 0 && (
            <div className="grid grid-cols-2 gap-1.5 pb-2 border-b border-white/5">
              {selectedGenres.map(g => (
                <span
                  key={g.id}
                  className="inline-flex items-center gap-1.5 pl-2 pr-1.5 py-1 rounded-full text-xs font-medium select-none cursor-grab hover:opacity-80 transition-all"
                  style={{
                    backgroundColor: `${g.color}20`,
                    border: `1px solid ${g.color}40`,
                    color: `color-mix(in srgb, ${g.color} 75%, white)`,
                  }}
                  onClick={() => toggleGenre(g.id)}
                  title={i18next.t('library.clickToRemove')}
                >
                  <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: g.color }} />
                  <span className="truncate max-w-[100px]">{g.name}</span>
                  <button
                    onClick={(e) => { e.stopPropagation(); toggleGenre(g.id); }}
                    className="inline-flex items-center justify-center w-4 h-4 rounded-full hover:bg-black/20 transition-colors"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
          )}

          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={i18next.t('library.searchGenre')}
            className="w-full px-2.5 py-1.5 bg-white/5 border border-white/10 rounded-lg text-xs text-white placeholder:text-white/20 focus:outline-none focus:border-primary/40 transition-colors"
            autoFocus
          />

          <div className="max-h-48 overflow-y-auto custom-scrollbar">
            {filtered.length > 0 ? (
              <div className="grid grid-cols-2 gap-1.5 py-1">
                {filtered.map(g => (
                  <button
                    key={g.id}
                    onClick={() => toggleGenre(g.id)}
                    className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium transition-all cursor-pointer hover:opacity-80"
                    style={{
                      backgroundColor: `${g.color}20`,
                      border: `1px solid ${g.color}50`,
                      color: `color-mix(in srgb, ${g.color} 75%, white)`,
                    }}
                  >
                    {g.name}
                  </button>
                ))}
              </div>
            ) : <p className="text-[10px] text-white/20 text-center py-2">{i18next.t('library.noGenre')}</p>}
          </div>

          {hiddenCount > 0 && !hasSearch && (
            <p className="text-[10px] text-white/25 text-center py-1">
              {i18next.t('library.otherResults', { count: hiddenCount })}
            </p>
          )}
        </div>
      );
    }
    case 'people': {
      const selectedIds = (filter.value as number[]) || [];
      const [search, setSearch] = useState('');
      const DEFAULT_PERSON_COUNT = 10;
      const hasSearch = search.trim().length > 0;
      const selectedPeople = selectedIds.map(id => people.find(p => p.id === id)).filter(Boolean) as Person[];
      const availablePeople = people.filter(p => !selectedIds.includes(p.id));
      const filtered = hasSearch
        ? availablePeople.filter(p => p.name.toLowerCase().includes(search.toLowerCase()))
        : availablePeople.slice(0, DEFAULT_PERSON_COUNT);
      const hiddenCount = !hasSearch ? Math.max(0, availablePeople.length - DEFAULT_PERSON_COUNT) : 0;

      const togglePerson = (personId: number) => {
        onUpdate(selectedIds.includes(personId)
          ? selectedIds.filter(id => id !== personId)
          : [...selectedIds, personId]
        );
      };

      return (
        <div className="p-2 space-y-2">
          {/* Selected people as pills */}
          {selectedPeople.length > 0 && (
            <div className="grid grid-cols-2 gap-1.5 pb-2 border-b border-white/5">
              {selectedPeople.map(p => (
                <span
                  key={p.id}
                  className="inline-flex items-center gap-1.5 pl-2 pr-1.5 py-1 rounded-full text-xs font-medium select-none cursor-grab hover:opacity-80 transition-all bg-primary/20 border border-primary/30 text-primary"
                  onClick={() => togglePerson(p.id)}
                  title={i18next.t('library.clickToRemove')}
                >
                  <Users className="w-3 h-3" />
                  <span className="truncate max-w-[100px]">{p.name}</span>
                  <button
                    onClick={(e) => { e.stopPropagation(); togglePerson(p.id); }}
                    className="inline-flex items-center justify-center w-4 h-4 rounded-full hover:bg-black/20 transition-colors"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
          )}

          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={i18next.t('library.searchPerson')}
            className="w-full px-2.5 py-1.5 bg-white/5 border border-white/10 rounded-lg text-xs text-white placeholder:text-white/20 focus:outline-none focus:border-primary/40 transition-colors"
            autoFocus
          />

          <div className="max-h-48 overflow-y-auto custom-scrollbar">
            {filtered.length > 0 ? (
              <div className="grid grid-cols-2 gap-1.5 py-1">
                {filtered.map(p => (
                  <button
                    key={p.id}
                    onClick={() => togglePerson(p.id)}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer hover:opacity-80 bg-white/5 border border-white/10 text-white/70 hover:text-white hover:bg-white/10"
                  >
                    <Users className="w-3 h-3 shrink-0 opacity-40" />
                    <span className="truncate">{p.name}</span>
                  </button>
                ))}
              </div>
            ) : <p className="text-[10px] text-white/20 text-center py-2">{i18next.t('library.noPerson')}</p>}
          </div>

          {hiddenCount > 0 && !hasSearch && (
            <p className="text-[10px] text-white/25 text-center py-1">
              {i18next.t('library.otherResults', { count: hiddenCount })}
            </p>
          )}
        </div>
      );
    }
    case 'rating': {
      const nf = (filter.value as NumericFilterValue) || { operator: 'gte', value: null, value2: null };
      return <NumericFilterPopup value={nf} onChange={onUpdate} min={0} max={100} placeholder="0" />;
    }
    case 'progression': {
      const nf = (filter.value as NumericFilterValue) || { operator: 'gte', value: null, value2: null };
      return <ProgressionFilterPopup value={nf} onChange={onUpdate} collectionId={collectionId ?? null} />;
    }
    case 'duration': {
      const nf = (filter.value as NumericFilterValue) || { operator: 'gte', value: null, value2: null };
      return <NumericFilterPopup value={nf} onChange={onUpdate} min={0} placeholder="0" />;
    }
    case 'creator': {
      const selected = (Array.isArray(filter.value) ? filter.value : []) as string[];
      const [search, setSearch] = useState('');
      const DEFAULT_CREATOR_COUNT = 10;
      const hasSearch = search.trim().length > 0;

      const splitCreators = (() => {
        if (!availableCreators) return [];
        const set = new Set<string>();
        availableCreators.forEach(c => {
          if (c) {
            c.split(';').forEach(part => {
              const trimmed = part.trim();
              if (trimmed) set.add(trimmed);
            });
          }
        });
        return Array.from(set).sort((a, b) => a.localeCompare(b));
      })();

      const filtered = hasSearch
        ? splitCreators.filter(c => c.toLowerCase().includes(search.toLowerCase()))
        : splitCreators.slice(0, DEFAULT_CREATOR_COUNT);
      const hiddenCount = !hasSearch ? Math.max(0, splitCreators.length - DEFAULT_CREATOR_COUNT) : 0;
      // Always show selected creators
      const selectedNotShown = selected.filter(c => !filtered.includes(c));
      const visible = [...selectedNotShown, ...filtered.filter(c => !selectedNotShown.includes(c))];
      return (
        <div className="p-2 space-y-2">
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={i18next.t('library.searchPlaceholder')}
            className="w-full px-2.5 py-1.5 bg-white/5 border border-white/10 rounded-lg text-xs text-white placeholder:text-white/20 focus:outline-none focus:border-primary/40 transition-colors"
            autoFocus
          />
          <div className="max-h-48 overflow-y-auto custom-scrollbar space-y-0.5">
            {visible.length > 0 ? visible.map(c => {
              const isOn = selected.includes(c);
              return (
                <button
                  key={c}
                  onClick={() => onUpdate(isOn ? selected.filter(v => v !== c) : [...selected, c])}
                  className={`flex items-center gap-2.5 w-full px-2.5 py-1.5 rounded-lg text-xs transition-colors cursor-pointer ${isOn ? 'bg-white/10 text-white' : 'text-white/50 hover:bg-white/5 hover:text-white'}`}
                >
                  <User className="w-3 h-3 shrink-0 opacity-40" />
                  <span className="flex-1 text-left truncate">{c}</span>
                  {isOn && <Check className="w-3 h-3 text-primary shrink-0" />}
                </button>
              );
            }) : <p className="text-[10px] text-white/20 text-center py-2">{i18next.t('library.noCreator')}</p>}
          </div>
          {hiddenCount > 0 && !hasSearch && (
            <p className="text-[10px] text-white/25 text-center py-1">
              {i18next.t('library.otherResultsShort', { count: hiddenCount })}
            </p>
          )}
        </div>
      );
    }
    case 'release_date':
    case 'experience_date':
    case 'created_at': {
      const { from, to } = (filter.value as { from: string; to: string }) || { from: '', to: '' };
      return (
        <div className="p-3 space-y-2.5">
          <div>
            <CustomDatePicker
              value={from}
              onChange={(val) => onUpdate({ from: val, to })}
              placeholder={i18next.t('objectiveCreate.start')}
              compact
            />
          </div>
          <div>
            <CustomDatePicker
              value={to}
              onChange={(val) => onUpdate({ from, to: val })}
              placeholder={i18next.t('objectiveCreate.end')}
              compact
            />
          </div>
        </div>
      );
    }
    default: return null;
  }
};

/** A single filter pill with popup */
const FilterPill: React.FC<{
  filter: FilterCriterion;
  label: string;
  icon: React.ElementType;
  genres: Genre[];
  people: Person[];
  creators: string[] | undefined;
  onUpdate: (value: any) => void;
  onRemove: () => void;
  collectionId?: number | null;
}> = ({ filter, label, icon: Icon, genres, people, creators, onUpdate, onRemove, collectionId }) => {
  const [isOpen, setIsOpen] = useState(false);
  const pillRef = useRef<HTMLDivElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: MouseEvent) => {
      if (pillRef.current && !pillRef.current.contains(e.target as Node) &&
          popupRef.current && !popupRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    const keyHandler = (e: KeyboardEvent) => { if (e.key === 'Escape') setIsOpen(false); };
    document.addEventListener('mousedown', handler);
    document.addEventListener('keydown', keyHandler);
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('keydown', keyHandler);
    };
  }, [isOpen]);

  const summary = getFilterSummary(filter, genres, people);
  const hasValue = summary !== i18next.t('common.all');

  const getPopupPos = () => {
    if (!pillRef.current) return { top: 0, left: 0 };
    const rect = pillRef.current.getBoundingClientRect();
    const minMargin = 8;
    const estimatedWidth = 320;
    const maxLeft = Math.max(minMargin, window.innerWidth - estimatedWidth - minMargin);
    return { top: rect.bottom + 6, left: Math.min(Math.max(rect.left, minMargin), maxLeft) };
  };

  return (
    <div ref={pillRef} className="relative shrink-0">
      <div
        role="button"
        tabIndex={0}
        onClick={() => setIsOpen(!isOpen)}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setIsOpen(!isOpen); }}
        className={`inline-flex items-center gap-1.5 h-8 px-2.5 rounded-lg border text-[11px] font-medium transition-all cursor-pointer ${
          hasValue
            ? 'bg-primary/10 border-primary/25 text-primary'
            : 'bg-white/5 border-white/10 text-white/50 hover:bg-white/10 hover:text-white'
        }`}
      >
        <Icon className="w-3 h-3 shrink-0" />
        <span className="truncate max-w-[120px]">{label}{hasValue ? `: ${summary}` : ''}</span>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onRemove(); }}
          className="ml-0.5 hover:text-red-400 transition-colors cursor-pointer"
        >
          <X className="w-3 h-3" />
        </button>
      </div>
      {isOpen && (() => {
        const pos = getPopupPos();
        return createPortal(
          <div
            ref={popupRef}
            className="fixed min-w-[220px] bg-[#111115] border border-white/10 rounded-xl shadow-2xl z-[100] animate-scale-in"
            style={{ top: pos.top, left: pos.left }}
          >
            <div className="flex items-center justify-between px-3 py-2 border-b border-white/5">
              <span className="text-[10px] font-bold text-white/40 uppercase tracking-wider">{label}</span>
            </div>
            <FilterPopupContent filter={filter} genres={genres} people={people} creators={creators} onUpdate={onUpdate} collectionId={collectionId} />
          </div>,
          document.body
        );
      })()}
    </div>
  );
};

/** The "add filter" button + dropdown */
const FilterAddButton: React.FC<{
  filterTypes: FilterTypeDef[];
  usedTypes: FilterType[];
  onAdd: (type: FilterType) => void;
}> = ({ filterTypes, usedTypes, onAdd }) => {
  const [isOpen, setIsOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: MouseEvent) => {
      if (btnRef.current && !btnRef.current.contains(e.target as Node) &&
          dropRef.current && !dropRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [isOpen]);

  const available = filterTypes.filter(t => !usedTypes.includes(t.type));
  if (!available.length) return null;

  const getDropdownPos = () => {
    if (!btnRef.current) return { top: 0, left: 0 };
    const rect = btnRef.current.getBoundingClientRect();
    return { top: rect.bottom + 6, left: rect.left };
  };

  return (
    <div className="relative shrink-0">
      <button
        ref={btnRef}
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-center w-8 h-8 rounded-lg border border-dashed border-white/15 text-white/30 hover:border-white/30 hover:text-white/60 hover:bg-white/5 transition-all cursor-pointer"
        title={i18next.t('library.addCriterion')}
      >
        <Plus className="w-3.5 h-3.5" />
      </button>
      {isOpen && (() => {
        const pos = getDropdownPos();
        return createPortal(
          <div
            ref={dropRef}
            className="fixed min-w-[200px] bg-[#111115] border border-white/10 rounded-xl shadow-2xl z-[100] py-1 animate-scale-in"
            style={{ top: pos.top, left: pos.left }}
          >
            {available.map(t => {
              const TIcon = t.icon;
              return (
                <button
                  key={t.type}
                  onClick={() => { onAdd(t.type); setIsOpen(false); }}
                  className="flex items-center gap-2.5 w-full px-3 py-2 text-xs text-white/50 hover:bg-white/5 hover:text-white transition-colors cursor-pointer"
                >
                  <TIcon className="w-3.5 h-3.5 text-primary shrink-0" />
                  {t.label}
                </button>
              );
            })}
          </div>,
          document.body
        );
      })()}
    </div>
  );
};

/** Filter presets menu (attached to the filter button) */
const FilterPresetsMenu: React.FC<{
  isOpen: boolean;
  onToggle: () => void;
  buttonRef: React.RefObject<HTMLButtonElement | null>;
  presets: FilterPreset[];
  activeFilters: FilterCriterion[];
  onSavePreset: (name: string) => void;
  onLoadPreset: (id: string) => void;
  onDeletePreset: (id: string) => void;
  onClearAll: () => void;
}> = ({ isOpen, onToggle, buttonRef, presets, activeFilters, onSavePreset, onLoadPreset, onDeletePreset, onClearAll }) => {
  const panelRef = useRef<HTMLDivElement>(null);
  const [presetName, setPresetName] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node) &&
          buttonRef.current && !buttonRef.current.contains(e.target as Node)) onToggle();
    };
    const keyHandler = (e: KeyboardEvent) => { if (e.key === 'Escape') onToggle(); };
    document.addEventListener('mousedown', handler);
    document.addEventListener('keydown', keyHandler);
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('keydown', keyHandler);
    };
  }, [isOpen, onToggle, buttonRef]);

  if (!isOpen) return null;

  return (
    <div ref={panelRef} className="absolute top-full right-0 mt-2 w-72 bg-[#111115] border border-white/10 rounded-2xl shadow-2xl z-50 animate-scale-in">
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
        <span className="text-[11px] font-bold text-white/40 uppercase tracking-[0.15em]">{i18next.t('library.filters')}</span>
        {activeFilters.length > 0 && (
          <button onClick={onClearAll} className="flex items-center justify-center w-6 h-6 rounded-md hover:bg-white/5 text-primary hover:text-primary/80 transition-all cursor-pointer" title={i18next.t('library.clearAll')}>
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Presets */}
      <div className="px-3 py-2.5 space-y-1.5">
        {/* Save current */}
        {activeFilters.length > 0 && (
          <div className="flex items-center gap-1.5 mb-2">
            <input
              type="text"
              value={presetName}
              onChange={(e) => setPresetName(e.target.value)}
              placeholder={i18next.t('library.presetNamePlaceholder')}
              className="flex-1 px-2.5 py-1.5 bg-white/5 border border-white/10 rounded-lg text-xs text-white placeholder:text-white/20 focus:outline-none focus:border-primary/40 transition-colors"
              onKeyDown={(e) => { if (e.key === 'Enter' && presetName.trim()) { onSavePreset(presetName.trim()); setPresetName(''); } }}
            />
            <button
              onClick={() => { if (presetName.trim()) { onSavePreset(presetName.trim()); setPresetName(''); } }}
              disabled={!presetName.trim()}
              className="flex items-center justify-center w-7 h-7 rounded-lg bg-primary/15 hover:bg-primary/25 text-primary transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-default"
              title={i18next.t('common.save')}
            >
              <Save className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Preset list */}
        {presets.length > 0 ? (
          presets.map((p) => (
            <div key={p.id} className="flex items-center gap-1.5 group">
              <button
                onClick={() => { onLoadPreset(p.id); onToggle(); }}
                className="flex-1 flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs text-white/50 hover:bg-white/5 hover:text-white transition-colors cursor-pointer text-left truncate"
              >
                <FolderOpen className="w-3 h-3 shrink-0" />
                <span className="truncate">{p.name}</span>
                <span className="text-[10px] text-white/20 ml-auto shrink-0">{p.filters.length} filtre{p.filters.length > 1 ? 's' : ''}</span>
              </button>
              <button
                onClick={() => onDeletePreset(p.id)}
                className="flex items-center justify-center w-6 h-6 rounded-md opacity-0 group-hover:opacity-100 hover:bg-red-500/10 transition-all cursor-pointer"
              >
                <X className="w-3 h-3 text-white/20 hover:text-red-400" />
              </button>
            </div>
          ))
        ) : (
          <p className="text-[10px] text-white/15 text-center py-2">{i18next.t('library.noPreset')}</p>
        )}
      </div>
    </div>
  );
};

/* ================================================================== */
/*  Sortable pill                                                      */
/* ================================================================== */
const SortableCollectionPill: React.FC<{
  collection: Collection;
  isActive: boolean;
  onSelect: (id: number) => void;
  onContextMenu: (e: React.MouseEvent, c: Collection) => void;
}> = ({ collection, isActive, onSelect, onContextMenu }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: collection.id });

  const Icon = getCollectionIconComponent(collection.name, collection.icon);
  const color = collection.color || '#8B5CF6';

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    ...(isActive ? {
      backgroundColor: `${color}20`,
      borderColor: `${color}60`,
      boxShadow: `0 0 14px ${color}30`,
    } : {}),
  };

  return (
    <button
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={() => onSelect(collection.id)}
      onContextMenu={(e) => onContextMenu(e, collection)}
      className={`shrink-0 relative flex items-center gap-2 h-[42px] rounded-full px-4 text-xs font-semibold tracking-wider uppercase border transition-colors duration-200 cursor-pointer select-none ${
        isActive
          ? 'text-white'
          : 'border-white/10 bg-white/5 text-gray-400 hover:text-white hover:bg-white/10 hover:border-white/20'
      }`}
    >
      <Icon className="w-3.5 h-3.5 shrink-0" style={isActive ? { color } : undefined} />
      <span>{collection.name}</span>
    </button>
  );
};

/* ================================================================== */
/*  Media list row (for list view)                                     */
/* ================================================================== */
const LIST_STATUS_LABELS = PROGRESS_STATUS_LABELS;
const LIST_STATUS_COLORS = PROGRESS_STATUS_COLORS;

const GRID_COLS = 'grid-cols-[100px_minmax(0,1fr)_110px_90px_120px_100px_90px_80px_44px]';

const MediaListRow: React.FC<{
  media: Media;
  collectionName: string;
  collectionIcon?: string | null;
  collectionColor?: string;
  progressionLabel?: string;
  pluralWithS?: boolean;
  isSelected: boolean;
  onSelect: (id: number, e: React.MouseEvent) => void;
  onContextMenu: (e: React.MouseEvent, media: Media) => void;
  onDoubleClick?: () => void;
  onNavigate?: () => void;
}> = ({ media, collectionName, collectionIcon, collectionColor, progressionLabel, pluralWithS, isSelected, onSelect, onContextMenu, onDoubleClick, onNavigate }) => {
  const Icon = getCollectionIconComponent(collectionName, collectionIcon);
  const color = collectionColor || '#8B5CF6';
  const status = getProgressStatus(media);
  const statusLabel = LIST_STATUS_LABELS[status] ?? status;
  const statusColor = LIST_STATUS_COLORS[status] ?? '#6b7280';

  // Utility function for duration display
  const formatDurationDisplay = (media: Media) => {
    if (media.progress_total != null && media.progress_total > 0) {
      const label = progressionLabel || 'Episode';
      const withS = pluralWithS ?? false;
      return `${media.progress_total} ${label}${withS && media.progress_total !== 1 ? 's' : ''}`;
    }
    return '—';
  };

  // Utility function for progression display with percentage
  const formatProgressionDisplay = (media: Media) => {
    if (media.progress_current != null && media.progress_total != null) {
      const percentage = Math.round((media.progress_current / media.progress_total) * 100);
      return `${media.progress_current}/${media.progress_total} (${percentage}%)`;
    }
    return '0%';
  };

  // Get progress percentage for bar
  const getProgressPercentage = (media: Media) => {
    if (media.progress_current != null && media.progress_total != null) {
      return (media.progress_current / media.progress_total) * 100;
    }
    return 0;
  };

  return (
    <div
      onClick={(e) => {
        if (e.ctrlKey || e.metaKey || e.shiftKey) {
          // Selection mode - handle selection
          onSelect(media.id, e);
        } else if (onNavigate) {
          // Normal mode - navigate to details
          onNavigate();
        }
      }}
      onDoubleClick={onDoubleClick}
      onContextMenu={(e) => onContextMenu(e, media)}
      className={`grid ${GRID_COLS} items-center gap-2 px-3 py-2.5 rounded-xl border transition-all cursor-pointer group text-[12px] ${
        isSelected
          ? 'bg-primary/10 border-primary/30'
          : 'bg-white/[0.02] border-white/5 hover:bg-white/5 hover:border-white/10'
      }`}
    >
      {/* Collection */}
      <Tooltip content={collectionName} className="overflow-hidden">
        <span className="flex items-center gap-1.5 truncate w-full justify-center" style={{ color }}>
          <Icon className="w-3.5 h-3.5 shrink-0" style={{ color }} />
          <span className="truncate text-[11px]">{collectionName}</span>
        </span>
      </Tooltip>
      {/* Title */}
      <Tooltip content={media.title} className="overflow-hidden">
        <span className="font-semibold text-white truncate text-center block">{media.title}</span>
      </Tooltip>
      {/* Author */}
      <Tooltip content={media.creator ? media.creator.split(';').map(c => c.trim()).filter(Boolean).join(', ') : ''} className="overflow-hidden">
        <span className="text-white/40 truncate text-center block">
          {media.creator ? media.creator.split(';').map(c => c.trim()).filter(Boolean).join(', ') : '—'}
        </span>
      </Tooltip>
      {/* Release date */}
      <span className="text-white/30 truncate text-center">{formatDateFr(media.release_date)}</span>
      {/* Duration / Details */}
      <Tooltip content={formatDurationDisplay(media)} className="overflow-hidden">
        <span className="text-white/30 truncate text-center block">
          {formatDurationDisplay(media)}
        </span>
      </Tooltip>
      {/* Status */}
      <div className="flex items-center justify-center w-full">
        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-bold uppercase" style={{ backgroundColor: `${statusColor}18`, color: statusColor }}>
          <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: statusColor }} />
          {statusLabel}
        </span>
      </div>
      {/* Experience date */}
      <span className="text-white/30 text-center">{formatDateFr(media.experience_date)}</span>
      {/* Progression */}
      <Tooltip content={formatProgressionDisplay(media)} className="overflow-hidden">
        <div className="flex flex-col items-center gap-1 text-center">
          <div className="text-white/50 tabular-nums text-[11px] truncate w-full">
            {media.progress_current != null && media.progress_total != null
              ? `${media.progress_current}/${media.progress_total}`
              : '0%'}
          </div>
          <div className="w-full h-1 bg-white/10 rounded-full overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-blue-500 to-purple-500 rounded-full transition-all duration-300"
              style={{ width: `${Math.min(getProgressPercentage(media), 100)}%` }}
            />
          </div>
        </div>
      </Tooltip>
            {/* Rating */}
      <span className="font-bold tabular-nums text-center" style={{ color: media.user_rating !== null ? getRatingColor(media.user_rating) : 'rgba(255,255,255,0.25)' }}>
        {media.user_rating !== null ? media.user_rating : '—'}
      </span>
    </div>
  );
};

const MemoizedMediaListRow = React.memo(MediaListRow, (prev, next) => {
  return (
    prev.media.id === next.media.id &&
    prev.media.title === next.media.title &&
    prev.media.progress_status === next.media.progress_status &&
    prev.media.user_rating === next.media.user_rating &&
    prev.media.progress_current === next.media.progress_current &&
    prev.media.progress_total === next.media.progress_total &&
    prev.media.updated_at === next.media.updated_at &&
    prev.isSelected === next.isSelected &&
    prev.collectionName === next.collectionName &&
    prev.collectionColor === next.collectionColor &&
    prev.collectionIcon === next.collectionIcon &&
    prev.progressionLabel === next.progressionLabel &&
    prev.pluralWithS === next.pluralWithS &&
    prev.onSelect === next.onSelect &&
    prev.onContextMenu === next.onContextMenu
  );
});
/* ================================================================== */
const SelectionBar: React.FC<{
  count: number;
  onClear: () => void;
  onDelete: () => void;
}> = ({ count, onClear, onDelete }) => (
  <motion.div
    initial={{ y: 60, opacity: 0 }}
    animate={{ y: 0, opacity: 1 }}
    exit={{ y: 60, opacity: 0 }}
    transition={{ type: 'spring', stiffness: 400, damping: 30 }}
    className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 flex items-center gap-3 px-5 py-3 bg-[#18181b] border border-white/10 rounded-2xl shadow-2xl"
  >
    <span className="text-sm font-semibold text-white">
      {count} {i18next.t('common.media')} {i18next.t('library.selected', { count })}
    </span>
    <div className="w-px h-5 bg-white/10" />
    <button
      onClick={onDelete}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer"
    >
      <Trash2 className="w-3.5 h-3.5" />
      {i18next.t('media.delete')}
    </button>
    <button
      onClick={onClear}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-text-secondary hover:bg-white/10 hover:text-white transition-colors cursor-pointer"
    >
      <X className="w-3.5 h-3.5" />
      {i18next.t('common.cancel')}
    </button>
  </motion.div>
);

/* ================================================================== */
/*  Library page                                                       */
/* ================================================================== */
const Library: React.FC = () => {
  const { t } = useTranslation();
  const { selectedCollectionId, setSelectedCollection, navigateToCollectionEdit, navigateToMediaCreate, navigateToMediaDetail, focusLibrarySearch, setFocusLibrarySearch } = useNavigationStore();
  const { data: collections } = useCollections();
  const libraryViewMode = useProfileSettingsStore((s) => s.libraryViewMode);
  const setLibraryViewMode = useProfileSettingsStore((s) => s.setLibraryViewMode);
  const cardDensity = useProfileSettingsStore((s) => s.personalization.cardDensity);
  const setCardDensity = useProfileSettingsStore((s) => s.setCardDensity);
  const {
    searchQuery, sortCriteria, sortPresets,
    setSearchQuery, addSortCriterion, removeSortCriterion, updateSortCriterion,
    activeFilters, filterPresets, addFilter, removeFilter, updateFilter, clearAllFilters,
    saveFilterPreset, loadFilterPreset, deleteFilterPreset,
    reorderSortCriteria, resetSort, saveSortPreset: saveSortPresetAction, loadSortPreset: loadSortPresetAction, deleteSortPreset: deleteSortPresetAction,
  } = useFiltersStore();
  const { data: allGenres = [] } = useGenres();
  const { data: allPeople = [] } = usePeople();
  const updateMediaMutation = useUpdateMedia();
  const deleteMediaMutation = useDeleteMedia();
  const reorderMutation = useReorderCollections();

  // Search state
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchContainerRef = useRef<HTMLDivElement>(null);

  // View mode from persistent store
  const viewMode = libraryViewMode;

  // Sizing submenu state
  const [isDensityMenuOpen, setIsDensityMenuOpen] = useState(false);

  // Sort & filter dropdowns
  const [isSortOpen, setIsSortOpen] = useState(false);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const sortBtnRef = useRef<HTMLButtonElement>(null);
  const filterBtnRef = useRef<HTMLButtonElement>(null);

  // Multi-selection
  const [selectedMediaIds, setSelectedMediaIds] = useState<Set<number>>(new Set());
  const [lastSelectedId, setLastSelectedId] = useState<number | null>(null);

  // Context menus
  type CollectionMenuState = { x: number; y: number; collection: Collection };
  type MediaMenuState = { x: number; y: number; media: Media };
  type MultiSelectMenuState = { x: number; y: number; count: number };
  const [collectionMenu, setCollectionMenu] = useState<CollectionMenuState | null>(null);
  const [mediaMenu, setMediaMenu] = useState<MediaMenuState | null>(null);
  const [multiSelectMenu, setMultiSelectMenu] = useState<MultiSelectMenuState | null>(null);
  const [isHoveringNav, setIsHoveringNav] = useState(false);

  // Nav scroll fade indicators state
  const navScrollRef = useRef<HTMLDivElement>(null);
  const [navFadeLeft, setNavFadeLeft] = useState(false);
  const [navFadeRight, setNavFadeRight] = useState(false);

  const updateNavFades = useCallback(() => {
    const el = navScrollRef.current;
    if (!el) return;
    const atLeft = el.scrollLeft <= 2;
    const atRight = el.scrollLeft + el.clientWidth >= el.scrollWidth - 2;
    setNavFadeLeft(!atLeft);
    setNavFadeRight(!atRight);
  }, []);

  // Update fades on scroll + on collections change (resize)
  useEffect(() => {
    const el = navScrollRef.current;
    if (!el) return;
    updateNavFades();
    el.addEventListener('scroll', updateNavFades, { passive: true });
    const ro = new ResizeObserver(updateNavFades);
    ro.observe(el);
    return () => {
      el.removeEventListener('scroll', updateNavFades);
      ro.disconnect();
    };
  }, [updateNavFades]);

  // Re-check fades when collections list changes
  useEffect(() => {
    requestAnimationFrame(updateNavFades);
  }, [collections, updateNavFades]);

  // Transfer dialog state
  const [transferDialogOpen, setTransferDialogOpen] = useState(false);
  const [transferTargetCollection, setTransferTargetCollection] = useState<number | null>(null);

  // Confirm dialog states
  const [mediaToDelete, setMediaToDelete] = useState<number | null>(null);
  const [bulkDeletePending, setBulkDeletePending] = useState(false);
  const [collectionToDelete, setCollectionToDelete] = useState<Collection | null>(null);
  const [collDeleteMode, setCollDeleteMode] = useState<'delete_media' | 'unlink' | 'transfer'>('delete_media');
  const [collTransferTarget, setCollTransferTarget] = useState<number | null>(null);
  const deleteCollWithOptionsMutation = useDeleteCollectionWithOptions();

  // Selection box (drag select)
  const [selectionBox, setSelectionBox] = useState<{ startX: number; startY: number; endX: number; endY: number } | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const mainContentRef = useRef<HTMLElement>(null);
  const paginationRef = useRef<HTMLDivElement>(null);
  const desiredScrollRef = useRef<number>(0);
  const pageChangePendingRef = useRef<boolean>(false);

  // Focus search on open (use rAF to ensure input is mounted after state change)
  useEffect(() => {
    if (isSearchOpen) {
      requestAnimationFrame(() => {
        searchInputRef.current?.focus();
      });
    }
  }, [isSearchOpen]);

  // Handle global shortcut Ctrl+F: open and focus search
  useEffect(() => {
    if (focusLibrarySearch) {
      setIsSearchOpen(true);
      setFocusLibrarySearch(false);
      requestAnimationFrame(() => {
        searchInputRef.current?.focus();
      });
    }
  }, [focusLibrarySearch, setFocusLibrarySearch]);

  // Close search on click outside (keep query)
  useEffect(() => {
    if (!isSearchOpen) return;
    const handler = (e: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        setIsSearchOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [isSearchOpen]);

  const { currentPage, setCurrentPage, resetPage, getOffset, getPageRange, lastCollectionId, setLastCollectionId } = usePaginationStore();

  // Wrapper pour setSelectedCollection qui reset la page avant (évite les double requêtes)
  const handleSetCollection = useCallback((collectionId: number | null) => {
    resetPage();
    setSelectedCollection(collectionId);
  }, [resetPage, setSelectedCollection]);

  // Calculate items per page based on actual rendered grid columns
  const [itemsPerPage, setItemsPerPage] = useState(45); // Default: 5 rows * 9 cards

  useEffect(() => {
    if (!gridRef.current) return;

    let debounceTimer: NodeJS.Timeout | null = null;

    const resizeObserver = new ResizeObserver(() => {
      // Debounce: annuler le timer précédent et créer un nouveau
      if (debounceTimer) {
        clearTimeout(debounceTimer);
      }

      debounceTimer = setTimeout(() => {
        if (!gridRef.current) return;
        const style = getComputedStyle(gridRef.current);
        const cols = style.gridTemplateColumns.split(' ').length;
        setItemsPerPage(Math.max(4, Math.min(9, cols)) * 5); // 5 rows per page
      }, 150); // 150ms debounce
    });

    resizeObserver.observe(gridRef.current);
    return () => {
      resizeObserver.disconnect();
      if (debounceTimer) {
        clearTimeout(debounceTimer);
      }
    };
  }, []);

  // Ctrl + Mouse Wheel listener on Grid to zoom card width/density
  useEffect(() => {
    const gridEl = gridRef.current;
    if (!gridEl || viewMode !== 'grid') return;

    const handleWheel = (e: WheelEvent) => {
      if (e.ctrlKey) {
        e.preventDefault();
        
        const sizes: CardDensity[] = ['compact', 'normal', 'large'];
        const currentIndex = sizes.indexOf(cardDensity);
        
        if (e.deltaY < 0) {
          if (currentIndex !== -1 && currentIndex < sizes.length - 1) {
            setCardDensity(sizes[currentIndex + 1]);
          }
        } else if (e.deltaY > 0) {
          if (currentIndex !== -1 && currentIndex > 0) {
            setCardDensity(sizes[currentIndex - 1]);
          }
        }
      }
    };

    gridEl.addEventListener('wheel', handleWheel, { passive: false });
    return () => {
      gridEl.removeEventListener('wheel', handleWheel);
    };
  }, [cardDensity, setCardDensity, viewMode]);

  // Ref to track mount status and avoid resetting the page on initial load
  const isMountedRef = useRef(false);

  // Reset page when filters/sort changes (but NOT collection - handled separately)
  useEffect(() => {
    if (!isMountedRef.current) {
      isMountedRef.current = true;
      return;
    }
    resetPage();
  }, [searchQuery, activeFilters, sortCriteria, resetPage]);

  // Reset page only when the collection actually changes (handles dashboard navigation / direct switches)
  useEffect(() => {
    if (selectedCollectionId !== lastCollectionId) {
      setLastCollectionId(selectedCollectionId);
      resetPage();
    }
  }, [selectedCollectionId, lastCollectionId, setLastCollectionId, resetPage]);

  const handlePageChange = useCallback((page: number) => {
    // Save current scroll position before changing page
    const scrollContainer = mainContentRef.current;
    desiredScrollRef.current = scrollContainer?.scrollTop ?? window.scrollY;
    pageChangePendingRef.current = true;

    setCurrentPage(page);
  }, [setCurrentPage, currentPage]);

  // Fetch media with pagination and backend filtering
  const { data: media, isLoading: mediaLoading } = useMedia({
    collectionId: selectedCollectionId ?? undefined,
    searchQuery: searchQuery || undefined,
    filters: activeFilters,
    sortCriteria: sortCriteria.length > 0 ? sortCriteria : [{ field: 'created_at', order: 'desc' }],
    limit: itemsPerPage,
    offset: getOffset(itemsPerPage),
  });

  const { data: distinctCreators } = useDistinctCreators({
    collectionId: selectedCollectionId ?? undefined,
    searchQuery: searchQuery || undefined,
    filters: activeFilters,
    enabled: isFilterOpen || activeFilters.some(f => f.type === 'creator'),
  });

  // Restore scroll position after media loading completes
  useLayoutEffect(() => {
    if (mediaLoading) return;
    
    // Only restore scroll if we came from an explicit page change
    if (!pageChangePendingRef.current) return;
    pageChangePendingRef.current = false;
    
    // Double rAF: first for DOM update, second for layout/paint completion
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const scrollContainer = mainContentRef.current;
        const desiredScroll = desiredScrollRef.current;
        
        if (scrollContainer) {
          // Check if container is scrollable
          const isScrollable = scrollContainer.scrollHeight > scrollContainer.clientHeight;
          
          if (isScrollable) {
            // Restore scroll position (clamped to max possible)
            const maxScroll = scrollContainer.scrollHeight - scrollContainer.clientHeight;
            scrollContainer.scrollTop = Math.min(desiredScroll, maxScroll);
          }
        }
        
        // Always ensure pagination is visible (especially important in fullscreen)
        paginationRef.current?.scrollIntoView({ block: 'nearest', behavior: 'instant' });
      });
    });
  }, [mediaLoading, currentPage]);

  // Get total count for pagination
  const { data: totalCount = 0 } = useMediaCount({
    collectionId: selectedCollectionId ?? undefined,
    searchQuery: searchQuery || undefined,
    filters: activeFilters,
  });

  const totalPages = Math.ceil(totalCount / itemsPerPage);
  const { start: pageStart, end: pageEnd } = getPageRange(totalCount, itemsPerPage);


  // Deduplicate collections by name
  const seen = new Set<string>();
  const uniqueCollections = (collections ?? []).filter((c) => {
    const key = c.name.toLowerCase().trim();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  // Local order state for optimistic drag reorder
  const [orderedIds, setOrderedIds] = useState<number[]>([]);
  useEffect(() => {
    setOrderedIds(uniqueCollections.map((c) => c.id));
  }, [collections]);

  const orderedCollections = orderedIds.length > 0
    ? orderedIds
        .map((id) => uniqueCollections.find((c) => c.id === id))
        .filter(Boolean) as Collection[]
    : uniqueCollections;

  const selectedCollection = collections?.find(c => c.id === selectedCollectionId);

  const collectionMap = useMemo(() => {
    const map = new Map<number, Collection>();
    for (const c of collections ?? []) map.set(c.id, c);
    return map;
  }, [collections]);

  // Dynamic sort fields based on selected collection
  const sortFields = useMemo(() => getSortFields(selectedCollection), [selectedCollection]);

  // Dynamic filter types based on selected collection
  const filterTypes = useMemo(() => getFilterTypes(selectedCollection), [selectedCollection]);

  // Count active filters (for badge)
  const activeFilterCount = activeFilters.length;
  const isSortNonDefault = sortCriteria.length !== 1 || sortCriteria[0]?.field !== 'created_at' || sortCriteria[0]?.order !== 'desc';

  // Collection context menu handlers
  const handleCollectionContextMenu = useCallback((e: React.MouseEvent, collection: Collection) => {
    e.preventDefault();
    setCollectionMenu({ x: e.clientX, y: e.clientY, collection });
  }, []);

  const handleDeleteCollection = useCallback((collection: Collection) => {
    setCollectionToDelete(collection);
    setCollDeleteMode('delete_media');
    setCollTransferTarget(null);
  }, []);

  const confirmDeleteCollection = useCallback(async () => {
    if (!collectionToDelete) return;
    if (selectedCollectionId === collectionToDelete.id) handleSetCollection(null);
    if (collDeleteMode === 'transfer' && collTransferTarget) {
      await deleteCollWithOptionsMutation.mutateAsync({ collectionId: collectionToDelete.id, mode: 'transfer', targetCollectionId: collTransferTarget });
    } else if (collDeleteMode === 'unlink') {
      await deleteCollWithOptionsMutation.mutateAsync({ collectionId: collectionToDelete.id, mode: 'unlink' });
    } else {
      await deleteCollWithOptionsMutation.mutateAsync({ collectionId: collectionToDelete.id, mode: 'delete_media' });
    }
    setCollectionToDelete(null);
  }, [collectionToDelete, collDeleteMode, collTransferTarget, deleteCollWithOptionsMutation, selectedCollectionId, handleSetCollection]);

  // Media context menu
  const handleMediaContextMenu = useCallback((e: React.MouseEvent, m: Media) => {
    e.preventDefault();
    // Check if we have a multi-selection and the clicked media is part of it
    if (selectedMediaIds.size > 1 && selectedMediaIds.has(m.id)) {
      setMultiSelectMenu({ x: e.clientX, y: e.clientY, count: selectedMediaIds.size });
    } else {
      setMediaMenu({ x: e.clientX, y: e.clientY, media: m });
    }
  }, [selectedMediaIds]);

  const handleDeleteMedia = useCallback((mediaId: number) => {
    setMediaToDelete(mediaId);
  }, []);

  const handleMarkCompleted = useCallback((m: Media) => {
    updateMediaMutation.mutate({ media_id: m.id, progress_status: 'COMPLETED', progress_current: m.progress_total ?? undefined, progress_total: m.progress_total ?? undefined });
  }, [updateMediaMutation]);

  const handleMarkAbandoned = useCallback((m: Media) => {
    updateMediaMutation.mutate({ media_id: m.id, progress_status: 'ABANDONED' });
  }, [updateMediaMutation]);

  const handleMarkInProgress = useCallback((m: Media) => {
    const current = m.progress_current ?? 0;
    const total = m.progress_total ?? 1;
    const newCurrent = current === 0 ? 1 : current;
    updateMediaMutation.mutate({ media_id: m.id, progress_status: 'IN_PROGRESS', progress_current: newCurrent, progress_total: total });
  }, [updateMediaMutation]);

  const handleMarkOnHold = useCallback((m: Media) => {
    updateMediaMutation.mutate({ media_id: m.id, progress_status: 'ON_HOLD' });
  }, [updateMediaMutation]);

  const confirmDeleteMedia = useCallback(async () => {
    if (mediaToDelete === null) return;
    await deleteMediaMutation.mutateAsync(mediaToDelete);
    setSelectedMediaIds((prev) => { const next = new Set(prev); next.delete(mediaToDelete); return next; });
    setMediaToDelete(null);
  }, [mediaToDelete, deleteMediaMutation]);

  // Bulk delete
  const handleBulkDelete = useCallback(() => {
    if (selectedMediaIds.size === 0) return;
    setBulkDeletePending(true);
  }, [selectedMediaIds]);

  const confirmBulkDelete = useCallback(async () => {
    for (const id of selectedMediaIds) {
      try { await deleteMediaMutation.mutateAsync(id); } catch {}
    }
    setSelectedMediaIds(new Set());
    setBulkDeletePending(false);
  }, [selectedMediaIds, deleteMediaMutation]);

  // Bulk status change handlers
  const handleBulkMarkInProgress = useCallback(() => {
    selectedMediaIds.forEach((id) => {
      const mediaItem = media?.find((m) => m.id === id);
      if (mediaItem) {
        const current = mediaItem.progress_current ?? 0;
        const total = mediaItem.progress_total ?? 1;
        const newCurrent = current === 0 ? 1 : current;
        updateMediaMutation.mutate({ media_id: id, progress_status: 'IN_PROGRESS', progress_current: newCurrent, progress_total: total });
      }
    });
  }, [selectedMediaIds, media, updateMediaMutation]);

  const handleBulkMarkCompleted = useCallback(() => {
    selectedMediaIds.forEach((id) => {
      const mediaItem = media?.find((m) => m.id === id);
      if (mediaItem) {
        updateMediaMutation.mutate({ media_id: id, progress_status: 'COMPLETED', progress_current: mediaItem.progress_total ?? undefined, progress_total: mediaItem.progress_total ?? undefined });
      }
    });
  }, [selectedMediaIds, media, updateMediaMutation]);

  const handleBulkMarkAbandoned = useCallback(() => {
    selectedMediaIds.forEach((id) => {
      updateMediaMutation.mutate({ media_id: id, progress_status: 'ABANDONED' });
    });
  }, [selectedMediaIds, updateMediaMutation]);

  const handleBulkMarkOnHold = useCallback(() => {
    selectedMediaIds.forEach((id) => {
      updateMediaMutation.mutate({ media_id: id, progress_status: 'ON_HOLD' });
    });
  }, [selectedMediaIds, updateMediaMutation]);

  const handleBulkMarkNotStarted = useCallback(() => {
    selectedMediaIds.forEach((id) => {
      updateMediaMutation.mutate({ media_id: id, progress_status: 'NOT_STARTED', progress_current: 0 });
    });
  }, [selectedMediaIds, updateMediaMutation]);

  // Bulk transfer handler
  const handleBulkTransfer = useCallback(async () => {
    if (!transferTargetCollection) return;
    for (const id of selectedMediaIds) {
      try {
        await updateMediaMutation.mutateAsync({ media_id: id, collection_id: transferTargetCollection });
      } catch {}
    }
    setTransferDialogOpen(false);
    setTransferTargetCollection(null);
    setSelectedMediaIds(new Set());
  }, [selectedMediaIds, transferTargetCollection, updateMediaMutation]);

  // Multi-select handler
  const handleMediaSelect = useCallback((id: number, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.ctrlKey || e.metaKey) {
      // Toggle single
      setSelectedMediaIds((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id); else next.add(id);
        return next;
      });
      setLastSelectedId(id);
    } else if (e.shiftKey && media) {
      const currentIds = media.map((m) => m.id);

      const doRangeSelect = (allIds: number[]) => {
        const anchorId = lastSelectedId !== null && allIds.includes(lastSelectedId) ? lastSelectedId : allIds[0];
        if (anchorId == null) return;
        const startIdx = allIds.indexOf(anchorId);
        const endIdx = allIds.indexOf(id);
        if (startIdx !== -1 && endIdx !== -1) {
          const [from, to] = startIdx < endIdx ? [startIdx, endIdx] : [endIdx, startIdx];
          const range = allIds.slice(from, to + 1);
          setSelectedMediaIds(new Set(range));
        }
      };

      if (lastSelectedId !== null && currentIds.includes(lastSelectedId)) {
        // Range select on current page
        doRangeSelect(currentIds);
      } else {
        // Cross-page range select
        const fetchAllAndSelect = async () => {
          try {
            const filterParams = convertFiltersToBackend(activeFilters);
            const allIds = selectedCollectionId === null
              ? await tauriApi.media.getAllIds({
                  searchQuery: searchQuery || undefined,
                  ...filterParams,
                  sortCriteria: sortCriteria,
                })
              : await tauriApi.media.getIdsByCollection({
                  collectionId: selectedCollectionId,
                  searchQuery: searchQuery || undefined,
                  ...filterParams,
                  sortCriteria: sortCriteria,
                });
            doRangeSelect(allIds);
          } catch (err) {
            console.error('Failed to perform cross-page range selection:', err);
          }
        };
        fetchAllAndSelect();
      }
    } else {
      // Single click without modifier — don't select, could be used for detail view later
    }
  }, [lastSelectedId, media, activeFilters, sortCriteria, selectedCollectionId, searchQuery]);

  // Stable callbacks for grid cards — avoid creating inline functions per card that break memoization
  const handleStableCardClick = useCallback((e?: React.MouseEvent) => {
    if (e && (e.ctrlKey || e.metaKey || e.shiftKey)) return;
    if (selectedMediaIds.size > 0) return;
    const target = e?.target as HTMLElement;
    const cardDiv = target?.closest('[data-media-id]') as HTMLElement | null;
    const mediaId = cardDiv?.dataset.mediaId;
    if (mediaId) navigateToMediaDetail(Number(mediaId));
  }, [navigateToMediaDetail, selectedMediaIds.size]);

  const handleStableCardContextMenu = useCallback((e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    const cardDiv = target?.closest('[data-media-id]') as HTMLElement | null;
    const mediaId = cardDiv?.dataset.mediaId;
    if (mediaId) {
      const m = media?.find(item => item.id === Number(mediaId));
      if (m) handleMediaContextMenu(e, m);
    }
  }, [media, handleMediaContextMenu]);

  // Drag selection box (content scroll relative)
  const handleContentMouseDown = useCallback((e: React.MouseEvent) => {
    // Only start drag selection on left click with no modifiers
    if (e.button !== 0 || e.ctrlKey || e.shiftKey || e.metaKey) return;
    const target = e.target as HTMLElement;
    // Don't start drag on interactive elements or cards
    const isOnCard = !!target.closest('[data-media-id]');
    const isOnInteractive = !!target.closest('button, input, select, a, [role="button"], [data-no-drag]');
    if (isOnCard || isOnInteractive) return;
    if (!gridRef.current || !mainContentRef.current) return;

    const container = mainContentRef.current;
    const containerRect = container.getBoundingClientRect();
    const startX = e.clientX - containerRect.left + container.scrollLeft;
    const startY = e.clientY - containerRect.top + container.scrollTop;
    setSelectionBox({ startX, startY, endX: startX, endY: startY });

    const computeSelection = (box: { startX: number; startY: number; endX: number; endY: number }) => {
      if (!gridRef.current || !mainContentRef.current) return;
      const container = mainContentRef.current;
      const containerRect = container.getBoundingClientRect();
      const cards = gridRef.current.querySelectorAll('[data-media-id]');
      const scrollTop = container.scrollTop;
      const scrollLeft = container.scrollLeft;

      const selBox = {
        left: Math.min(box.startX, box.endX) - scrollLeft + containerRect.left,
        right: Math.max(box.startX, box.endX) - scrollLeft + containerRect.left,
        top: Math.min(box.startY, box.endY) - scrollTop + containerRect.top,
        bottom: Math.max(box.startY, box.endY) - scrollTop + containerRect.top,
      };

      const newIds = new Set<number>();
      cards.forEach((card) => {
        const r = card.getBoundingClientRect();
        if (r.left < selBox.right && r.right > selBox.left && r.top < selBox.bottom && r.bottom > selBox.top) {
          const id = parseInt(card.getAttribute('data-media-id') ?? '0');
          if (id) newIds.add(id);
        }
      });
      setSelectedMediaIds(newIds);
    };

    const handleMouseMove = (ev: MouseEvent) => {
      if (!mainContentRef.current) return;
      const container = mainContentRef.current;
      const containerRect = container.getBoundingClientRect();
      const endX = ev.clientX - containerRect.left + container.scrollLeft;
      const endY = ev.clientY - containerRect.top + container.scrollTop;

      const newBox = { startX, startY, endX, endY };
      setSelectionBox(newBox);
      computeSelection(newBox);
    };

    const handleMouseUp = () => {
      setSelectionBox(null);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [media]);

  // DnD sensors — require 5px movement to avoid interfering with clicks
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = orderedIds.indexOf(active.id as number);
    const newIndex = orderedIds.indexOf(over.id as number);
    const newOrder = arrayMove(orderedIds, oldIndex, newIndex);
    setOrderedIds(newOrder);
    reorderMutation.mutate(newOrder);
  }, [orderedIds, reorderMutation]);

  // Clear selection on collection change
  useEffect(() => {
    setSelectedMediaIds(new Set());
  }, [selectedCollectionId]);

  // Density config for card width — la hauteur n'est plus fixée ici : elle
  // découle automatiquement de la largeur via aspect-ratio (2:3, le format
  // de vos covers) directement dans MediaCard, pour rester toujours en phase
  // avec l'image quelle que soit la largeur réelle de la colonne.
  const densityWidthMap: Record<string, string> = {
    compact: '140px',
    normal: '175px',
    large: '210px',
    detailed: '175px',
  };

  const densityConfig = densityWidthMap[cardDensity] || densityWidthMap.normal;

  return (
    <AppShell>
      <SharedHeader activePage="library" />

      <MainContent ref={mainContentRef} onMouseDown={handleContentMouseDown} className="relative">
        {/* Collection pill nav */}
        <div
          ref={navScrollRef}
          className={`flex items-center gap-2 mb-6 overflow-x-auto pb-1 custom-scrollbar transition-[scrollbar-color] duration-300 ${isHoveringNav ? '' : 'scrollbar-thumb-hidden'}`}
          onMouseEnter={() => setIsHoveringNav(true)}
          onMouseLeave={() => setIsHoveringNav(false)}
          style={{
            maskImage: navFadeLeft && navFadeRight
              ? 'linear-gradient(to right, transparent 0%, black 56px, black calc(100% - 56px), transparent 100%)'
              : navFadeLeft
              ? 'linear-gradient(to right, transparent 0%, black 56px)'
              : navFadeRight
              ? 'linear-gradient(to left, transparent 0%, black 56px)'
              : 'none',
            WebkitMaskImage: navFadeLeft && navFadeRight
              ? 'linear-gradient(to right, transparent 0%, black 56px, black calc(100% - 56px), transparent 100%)'
              : navFadeLeft
              ? 'linear-gradient(to right, transparent 0%, black 56px)'
              : navFadeRight
              ? 'linear-gradient(to left, transparent 0%, black 56px)'
              : 'none',
          }}
        >
          {/* "Tous" pill */}
          <button
            onClick={() => handleSetCollection(null)}
            className={`shrink-0 flex items-center h-[42px] rounded-full px-4 text-xs font-semibold tracking-wider uppercase border transition-colors duration-200 cursor-pointer ${
              selectedCollectionId === null
                ? 'bg-white/10 border-white/5 text-white shadow-sm'
                : 'border-white/10 bg-white/5 text-gray-400 hover:text-white hover:bg-white/10'
            }`}
          >
            {t('library.all')}
          </button>

          {/* Sortable collection pills */}
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
            modifiers={[restrictToHorizontalAxis]}
          >
            <SortableContext items={orderedIds} strategy={horizontalListSortingStrategy}>
              {orderedCollections.map((collection) => (
                <SortableCollectionPill
                  key={collection.id}
                  collection={collection}
                  isActive={selectedCollectionId === collection.id}
                  onSelect={handleSetCollection}
                  onContextMenu={handleCollectionContextMenu}
                />
              ))}
            </SortableContext>
          </DndContext>

          {/* "+" add collection pill — inline */}
          <button
            onClick={() => navigateToCollectionEdit()}
            className={`shrink-0 flex items-center justify-center h-[42px] w-[42px] rounded-full border border-white/10 text-gray-400 hover:text-white hover:bg-white/10 hover:border-white/20 transition-all duration-200 cursor-pointer ${
              isHoveringNav ? 'opacity-100' : 'opacity-0 pointer-events-none'
            }`}
            title={t('library.newCollection')}
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>

        {/* Search & Filters Bar */}
        <div className="flex items-center gap-4 mb-6">
          {/* Left side — search pill + active filter pills */}
          <div className="flex-1 flex items-center gap-2 min-w-0 overflow-x-auto custom-scrollbar pb-0.5">
            {searchQuery && !isSearchOpen && (
              <span className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-lg border text-[11px] font-medium transition-all shrink-0 bg-primary/10 border-primary/25 text-primary">
                <Search className="w-3 h-3 shrink-0" />
                <span className="truncate max-w-[120px]">« {searchQuery} »</span>
                <button onClick={() => setSearchQuery('')} className="ml-0.5 hover:text-red-400 transition-colors cursor-pointer">
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
            {activeFilters.map((filter) => {
              const def = filterTypes.find(t => t.type === filter.type);
              if (!def) return null;
              return (
                <FilterPill
                  key={filter.id}
                  filter={filter}
                  label={def.label}
                  icon={def.icon}
                  genres={allGenres}
                  people={allPeople}
                  creators={distinctCreators}
                  onUpdate={(value) => updateFilter(filter.id, value)}
                  onRemove={() => removeFilter(filter.id)}
                  collectionId={selectedCollectionId ?? null}
                />
              );
            })}
            <FilterAddButton
              filterTypes={filterTypes}
              usedTypes={activeFilters.map(f => f.type)}
              onAdd={addFilter}
            />
          </div>

          {/* Right side — search, filters, sort, view toggle, nouveau */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Collapsible search — single element, smooth width transition */}
            <div ref={searchContainerRef} className="relative flex items-center">
              <motion.div
                initial={false}
                animate={{ width: isSearchOpen ? 288 : 40 }}
                transition={{ duration: 0.25, ease: [0.25, 1, 0.5, 1] }}
                className={`relative h-10 rounded-xl border overflow-hidden cursor-pointer ${
                  isSearchOpen
                    ? 'bg-white/5 border-primary/30'
                    : searchQuery
                      ? 'bg-primary/15 border-primary/30'
                      : 'bg-white/5 border-white/10 hover:bg-white/10'
                }`}
                onClick={() => { if (!isSearchOpen) setIsSearchOpen(true); }}
                title={isSearchOpen ? undefined : t('library.search')}
              >
                <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 z-10 transition-colors ${
                  isSearchOpen ? 'text-text-secondary' : searchQuery ? 'text-primary' : 'text-text-secondary'
                }`} />
                {isSearchOpen && (
                  <>
                    <input
                      ref={searchInputRef}
                      type="text"
                      placeholder={t('library.searchPlaceholder')}
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Escape') setIsSearchOpen(false); }}
                      className="absolute inset-0 w-full h-full pl-10 pr-9 bg-transparent text-sm text-white placeholder:text-text-secondary focus:outline-none"
                    />
                    {searchQuery && (
                      <button
                        onClick={(e) => { e.stopPropagation(); setSearchQuery(''); }}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white transition-colors cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </>
                )}
              </motion.div>
            </div>

            {/* Filter button — icon only */}
            <div className="relative">
              <button
                ref={filterBtnRef}
                onClick={() => { setIsFilterOpen(!isFilterOpen); setIsSortOpen(false); }}
                className={`relative flex items-center justify-center w-10 h-10 rounded-xl border transition-all cursor-pointer ${
                  activeFilterCount > 0
                    ? 'bg-primary/15 border-primary/30 text-primary'
                    : 'bg-white/5 border-white/10 text-text-secondary hover:bg-white/10 hover:text-white'
                }`}
                title={t('library.filters')}
              >
                <SlidersHorizontal className="w-4 h-4" />
                {activeFilterCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 flex items-center justify-center bg-primary rounded-full text-[9px] font-bold text-white">
                    {activeFilterCount}
                  </span>
                )}
              </button>
              <FilterPresetsMenu
                isOpen={isFilterOpen}
                onToggle={() => setIsFilterOpen(false)}
                buttonRef={filterBtnRef}
                presets={filterPresets}
                activeFilters={activeFilters}
                onSavePreset={saveFilterPreset}
                onLoadPreset={loadFilterPreset}
                onDeletePreset={deleteFilterPreset}
                onClearAll={clearAllFilters}
              />
            </div>

            {/* Sort button */}
            <div className="relative">
              <button
                ref={sortBtnRef}
                onClick={() => { setIsSortOpen(!isSortOpen); setIsFilterOpen(false); }}
                className={`flex items-center justify-center w-10 h-10 rounded-xl border transition-all cursor-pointer ${
                  isSortNonDefault
                    ? 'bg-primary/15 border-primary/30 text-primary'
                    : 'bg-white/5 border-white/10 text-text-secondary hover:bg-white/10 hover:text-white'
                }`}
                title={t('library.sort')}
              >
                <ArrowUpDown className="w-4 h-4" />
              </button>
              <SortPanel
                criteria={sortCriteria}
                sortFields={sortFields}
                onAdd={addSortCriterion}
                onRemove={removeSortCriterion}
                onUpdate={updateSortCriterion}
                onReorder={reorderSortCriteria}
                onReset={resetSort}
                presets={sortPresets}
                onSavePreset={saveSortPresetAction}
                onLoadPreset={loadSortPresetAction}
                onDeletePreset={deleteSortPresetAction}
                isOpen={isSortOpen}
                onToggle={() => setIsSortOpen(false)}
                buttonRef={sortBtnRef}
              />
            </div>

            {/* View toggle */}
            <div className="relative flex items-center bg-white/5 border border-white/10 rounded-xl p-1">
              {/* Sliding indicator */}
              <div
                className="absolute h-[calc(100%-8px)] w-[calc(50%-4px)] bg-white/10 rounded-lg transition-all duration-200 ease-in-out"
                style={{ left: viewMode === 'list' ? 'calc(50% + 0px)' : '4px', top: '4px' }}
              />
              
              {/* Grid button with hover submenu */}
              <div
                className="relative z-[1]"
                onMouseEnter={() => setIsDensityMenuOpen(true)}
                onMouseLeave={() => setIsDensityMenuOpen(false)}
              >
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (viewMode === 'list') {
                      setIsDensityMenuOpen(!isDensityMenuOpen);
                    }
                  }}
                  className={`p-1.5 rounded-lg transition-colors duration-200 cursor-pointer ${viewMode === 'grid' ? 'text-white' : 'text-text-secondary hover:text-white'}`}
                  title={t('personalization.cardDensity')}
                >
                  <LayoutGrid className="w-4 h-4" />
                </button>

                {/* Grid density selector hover menu */}
                <AnimatePresence>
                  {isDensityMenuOpen && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95, y: 4 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95, y: 4 }}
                      transition={{ duration: 0.12 }}
                      className="absolute left-1/2 -translate-x-1/2 top-full mt-2 bg-[#141418]/95 border border-white/10 rounded-xl p-1 gap-1 shadow-2xl flex flex-row items-center z-[100] backdrop-blur-md"
                    >
                      {/* Hover bridge to prevent closing on gap crossing */}
                      <div className="absolute -top-2 left-0 right-0 h-2 bg-transparent" />
                      
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setCardDensity('compact');
                          setIsDensityMenuOpen(false);
                        }}
                        className={`p-1.5 rounded-lg transition-colors cursor-pointer ${viewMode === 'grid' && cardDensity === 'compact' ? 'text-primary bg-primary/10' : 'text-text-secondary hover:bg-white/5 hover:text-white'}`}
                        title={t('personalization.density.compact')}
                      >
                        <Grid3X3 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setCardDensity('normal');
                          setIsDensityMenuOpen(false);
                        }}
                        className={`p-1.5 rounded-lg transition-colors cursor-pointer ${viewMode === 'grid' && cardDensity === 'normal' ? 'text-primary bg-primary/10' : 'text-text-secondary hover:bg-white/5 hover:text-white'}`}
                        title={t('personalization.density.normal')}
                      >
                        <LayoutGrid className="w-4 h-4" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setCardDensity('large');
                          setIsDensityMenuOpen(false);
                        }}
                        className={`p-1.5 rounded-lg transition-colors cursor-pointer ${viewMode === 'grid' && cardDensity === 'large' ? 'text-primary bg-primary/10' : 'text-text-secondary hover:bg-white/5 hover:text-white'}`}
                        title={t('personalization.density.large')}
                      >
                        <Grid2X2 className="w-4 h-4" />
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <button
                onClick={() => setLibraryViewMode('list')}
                className={`relative z-[1] p-1.5 rounded-lg transition-colors duration-200 cursor-pointer ${viewMode === 'list' ? 'text-white' : 'text-text-secondary hover:text-white'}`}
                title={t('personalization.density.detailed')}
              >
                <List className="w-4 h-4" />
              </button>
            </div>

            {/* Nouveau button */}
            <button
              onClick={() => navigateToMediaCreate(selectedCollectionId)}
              className="flex items-center gap-2 px-4 py-2.5 bg-primary/20 border border-primary/40 rounded-xl text-sm font-semibold text-white hover:bg-primary/30 hover:border-primary/60 hover:shadow-[0_0_15px_rgba(217,70,239,0.2)] transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              {t('library.new')}
            </button>
          </div>
        </div>

        {/* Header info */}
        <div className="flex items-center mb-6">
          <h1 className="text-xl font-bold text-white">
            {selectedCollection ? selectedCollection.name : t('library.allMedia')}
          </h1>
          {totalCount > 0 && (
            <span className="ml-3 text-sm text-text-secondary bg-white/5 px-2.5 py-1 rounded-full">
              {totalCount} {t('common.media')}
              {totalCount > itemsPerPage && (
                <span className="text-white/40 ml-1">({pageStart}-{pageEnd})</span>
              )}
            </span>
          )}
        </div>

        {/* Media Grid / List */}
          {viewMode === 'grid' ? (
          <div>
            <div
              ref={gridRef}
              className="grid gap-4 grid-bg relative min-h-[200px] content-start"
              style={{ 
                // Colonnes flexibles : les cartes remplissent toute la largeur
                // du conteneur (1fr), avec une largeur minimale par density.
                // auto-fill ajoute une colonne dès qu'il y a la place.
                gridTemplateColumns: `repeat(auto-fill, minmax(${densityConfig}, 1fr))`,
                // Chaque carte a maintenant sa propre hauteur (calée sur le
                // ratio réel de son cover) : on évite que la grille les
                // étire pour matcher la plus haute carte de la ligne.
                alignItems: 'start',
              }}
              data-context-menu-open={!!mediaMenu}
            >
              {mediaLoading ? (
                <MediaCardSkeleton count={12} />
              ) : media && media.length > 0 ? (
                media.map((item) => {
                  const collection = item.collection_id != null ? collectionMap.get(item.collection_id) : undefined;
                  const isSelected = selectedMediaIds.has(item.id);
                  return (
                    <div
                      key={item.id}
                      data-media-id={item.id}
                      className={`relative overflow-visible transition-all rounded-2xl ${isSelected ? 'ring-2 ring-primary/60 ring-offset-2 ring-offset-[#0a0a0f]' : ''}`}
                      style={{ minWidth: 0 }}
                      onClick={(e) => {
                        if (e.ctrlKey || e.metaKey || e.shiftKey) {
                          handleMediaSelect(item.id, e);
                          return;
                        }
                        if (selectedMediaIds.size > 0) {
                          handleMediaSelect(item.id, e);
                          return;
                        }
                      }}
                    >
                      {isSelected && (
                        <div className="absolute -top-2 -right-2 z-30 w-6 h-6 rounded-full bg-primary border-2 border-[#0a0a0f] flex items-center justify-center shadow-lg">
                          <Check className="w-3.5 h-3.5 text-white" />
                        </div>
                      )}
                       <MemoizedMediaCard
                        media={item}
                        collectionName={collection?.name ?? ''}
                        collectionIcon={collection?.icon}
                        collectionColor={collection?.color}
                        cardDensity={cardDensity}
                        progressionLabel={collection?.progression_label}
                        progressionShortLabel={collection?.progression_short_label ?? undefined}
                        pluralWithS={collection?.plural_with_s ?? false}
                        creatorLabel={collection?.creator_label}
                        experienceDateLabel={collection?.date_label}
                        onContextMenu={handleStableCardContextMenu}
                        onClick={handleStableCardClick}
                      />
                    </div>
                  );
                })
              ) : (
                <div className="flex flex-col items-center justify-center w-full py-20 text-center">
                  <LibraryIcon className="w-16 h-16 text-white/10 mb-4" />
                  <h3 className="text-lg font-semibold text-white/60 mb-2">{t('library.noMedia')}</h3>
                  <p className="text-sm text-text-secondary max-w-sm">
                    {selectedCollection
                      ? t('library.emptyCollection', { name: selectedCollection.name })
                      : t('library.emptyLibrary')}
                  </p>
                </div>
              )}

            </div>
            {/* Pagination */}
            <div ref={paginationRef}>
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                totalItems={totalCount}
                pageStart={pageStart}
                pageEnd={pageEnd}
                onPageChange={handlePageChange}
              />
            </div>
          </div>
        ) : (
          /* List view */
          <div className="flex flex-col gap-1.5">
            {/* List header */}
            <div className={`grid ${GRID_COLS} items-center gap-2 px-3 py-2 text-[10px] font-semibold text-white/25 uppercase tracking-wider`}>
              {getListHeaders(selectedCollection).map((header, index) => (
                <span key={index} className={header.className}>
                  {header.label}
                </span>
              ))}
            </div>
            {mediaLoading ? (
              Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="h-16 bg-white/[0.02] rounded-xl animate-pulse" />
              ))
            ) : media && media.length > 0 ? (
              media.map((item) => {
                const collection = item.collection_id != null ? collectionMap.get(item.collection_id) : undefined;
                return (
                  <MemoizedMediaListRow
                    key={item.id}
                    media={item}
                    collectionName={collection?.name ?? ''}
                    collectionIcon={collection?.icon}
                    collectionColor={collection?.color}
                    progressionLabel={collection?.progression_label}
                    pluralWithS={collection?.plural_with_s ?? false}
                    isSelected={selectedMediaIds.has(item.id)}
                    onSelect={handleMediaSelect}
                    onContextMenu={handleMediaContextMenu}
                    onDoubleClick={selectedMediaIds.size === 0 ? () => navigateToMediaDetail(item.id) : undefined}
                    onNavigate={selectedMediaIds.size === 0 ? () => navigateToMediaDetail(item.id) : undefined}
                  />
                );
              })
            ) : (
              <div className="flex flex-col items-center justify-center w-full py-20 text-center">
                <LibraryIcon className="w-16 h-16 text-white/10 mb-4" />
                <h3 className="text-lg font-semibold text-white/60 mb-2">{t('library.noMedia')}</h3>
                <p className="text-sm text-text-secondary max-w-sm">
                  {selectedCollection
                    ? t('library.emptyCollection', { name: selectedCollection.name })
                    : t('library.emptyLibrary')}
                </p>
              </div>
            )}
            {/* Pagination */}
            <div ref={paginationRef}>
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                totalItems={totalCount}
                pageStart={pageStart}
                pageEnd={pageEnd}
                onPageChange={handlePageChange}
              />
            </div>
          </div>
        )}

        {/* Selection box overlay */}
        {selectionBox && (
          <div
            className="absolute border border-primary/50 bg-primary/10 pointer-events-none z-30 rounded"
            style={{
              left: Math.min(selectionBox.startX, selectionBox.endX),
              top: Math.min(selectionBox.startY, selectionBox.endY),
              width: Math.abs(selectionBox.endX - selectionBox.startX),
              height: Math.abs(selectionBox.endY - selectionBox.startY),
            }}
          />
        )}
      </MainContent>

      {/* Collection context menu */}
      {collectionMenu && (
        <ContextMenu
          x={collectionMenu.x}
          y={collectionMenu.y}
          title={collectionMenu.collection.name}
          items={[
            { label: t('media.edit'), icon: Pencil, onClick: () => navigateToCollectionEdit(collectionMenu.collection.id) },
            { label: t('media.delete'), icon: Trash2, danger: true, onClick: () => handleDeleteCollection(collectionMenu.collection) },
          ]}
          onClose={() => setCollectionMenu(null)}
        />
      )}

      {/* Media context menu */}
      {mediaMenu && (() => {
        const m = mediaMenu.media;
        const status = getProgressStatus(m);
        const items = [
          { label: t('media.viewDetails'), icon: Eye, onClick: () => navigateToMediaDetail(m.id) },
          { label: t('media.edit'), icon: Pencil, onClick: () => navigateToMediaCreate(null, m.id) },
          ...(status !== 'IN_PROGRESS' ? [{ label: t('media.markInProgress'), icon: PlayCircle,  onClick: () => handleMarkInProgress(m) }] : []),
          ...(status !== 'ON_HOLD'     ? [{ label: t('media.markOnHold'),      icon: PauseCircle, onClick: () => handleMarkOnHold(m)     }] : []),
          ...(status !== 'COMPLETED'   ? [{ label: t('media.markCompleted'),   icon: CheckCircle2,onClick: () => handleMarkCompleted(m)   }] : []),
          ...(status !== 'ABANDONED'   ? [{ label: t('media.markAbandoned'),   icon: XCircle,     onClick: () => handleMarkAbandoned(m)   }] : []),
          { label: t('media.delete'), icon: Trash2, danger: true, onClick: () => handleDeleteMedia(m.id) },
        ];
        return (
          <ContextMenu
            x={mediaMenu.x}
            y={mediaMenu.y}
            title={m.title}
            items={items}
            onClose={() => setMediaMenu(null)}
          />
        );
      })()}

      {/* Multi-select context menu */}
      {multiSelectMenu && (
        <ContextMenu
          x={multiSelectMenu.x}
          y={multiSelectMenu.y}
          title={`${multiSelectMenu.count} ${t('common.media').toUpperCase()}`}
          items={[
            { label: t('media.markInProgress'), icon: PlayCircle,  onClick: handleBulkMarkInProgress },
            { label: t('media.markOnHold'),      icon: PauseCircle, onClick: handleBulkMarkOnHold     },
            { label: t('media.markCompleted'),   icon: CheckCircle2,onClick: handleBulkMarkCompleted  },
            { label: t('media.markAbandoned'),   icon: XCircle,     onClick: handleBulkMarkAbandoned  },
            { label: t('media.markNotStarted'),  icon: Circle,      onClick: handleBulkMarkNotStarted },
            { label: t('media.transferToAnotherCollection'), icon: ArrowRightLeft, onClick: () => { setTransferDialogOpen(true); setTransferTargetCollection(null); } },
            { label: t('media.delete'), icon: Trash2, danger: true, onClick: handleBulkDelete },
          ]}
          onClose={() => setMultiSelectMenu(null)}
        />
      )}

      {/* Transfer dialog for multi-select */}
      <ConfirmDialog
        open={transferDialogOpen}
        onClose={() => { setTransferDialogOpen(false); setTransferTargetCollection(null); }}
        title={t('media.transferCount', { count: selectedMediaIds.size })}
        description={t('media.chooseDestinationCollection')}
        iconColor="#3b82f6"
        actions={[{
          label: t('media.transfer'),
          variant: 'primary',
          icon: ArrowRightLeft,
          onClick: handleBulkTransfer,
          disabled: !transferTargetCollection,
        }]}
      >
        <div className="mt-3">
          <span className="text-[10px] font-semibold text-white/30 uppercase tracking-wider mb-1.5 block">{t('media.targetCollection')}</span>
          {(() => {
            const transferOptions = collections?.filter(c => c.id !== selectedCollectionId) ?? [];
            if (transferOptions.length === 0) {
              return <p className="text-[11px] text-white/30 text-center py-2 mt-1">{t('media.noOtherCollection')}</p>;
            }
            return (
              <div className="max-h-[200px] overflow-y-auto custom-scrollbar rounded-xl border border-white/10 bg-white/[0.02] p-1.5 space-y-1">
                {transferOptions.map(c => {
                  const Icon = getCollectionIconComponent(c.name, c.icon);
                  const isChosen = transferTargetCollection === c.id;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setTransferTargetCollection(c.id)}
                      className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                        isChosen ? 'border-blue-500/40 bg-blue-500/10' : 'border-white/10 bg-white/[0.03] hover:bg-white/[0.06] hover:border-white/15'
                      }`}
                    >
                      <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: `${c.color}15` }}>
                        <Icon className="w-3.5 h-3.5" style={{ color: c.color }} />
                      </div>
                      <span className={`text-sm font-medium truncate flex-1 ${isChosen ? 'text-white' : 'text-white/60'}`}>{c.name}</span>
                      {isChosen && <CheckCircle2 className="w-4 h-4 text-blue-400 shrink-0" />}
                    </button>
                  );
                })}
              </div>
            );
          })()}
        </div>
      </ConfirmDialog>

      {/* Bulk selection bar */}
      <AnimatePresence>
        {selectedMediaIds.size > 0 && (
          <SelectionBar
            count={selectedMediaIds.size}
            onClear={() => setSelectedMediaIds(new Set())}
            onDelete={handleBulkDelete}
          />
        )}
      </AnimatePresence>

      {/* Confirm: delete single media */}
      <ConfirmDialog
        open={mediaToDelete !== null}
        onClose={() => setMediaToDelete(null)}
        title={t('media.confirmDeleteTitle')}
        description={t('media.confirmDeleteDescriptionImages')}
        iconColor="#ef4444"
        actions={[{
          label: t('media.delete'),
          variant: 'danger',
          icon: Trash2,
          onClick: confirmDeleteMedia,
        }]}
      />

      {/* Confirm: bulk delete media */}
      <ConfirmDialog
        open={bulkDeletePending}
        onClose={() => setBulkDeletePending(false)}
        title={t('media.confirmBulkDeleteTitle', { count: selectedMediaIds.size })}
        description={t('media.confirmDeleteDescription')}
        iconColor="#ef4444"
        actions={[{
          label: t('media.deleteAll'),
          variant: 'danger',
          icon: Trash2,
          onClick: confirmBulkDelete,
        }]}
      />

      {/* Confirm: delete collection with options */}
      <ConfirmDialog
        open={collectionToDelete !== null}
        onClose={() => setCollectionToDelete(null)}
        title={t('media.confirmDeleteCollectionTitle', { name: collectionToDelete?.name })}
        description={t('media.chooseWhatToDoWithMedia')}
        iconColor="#ef4444"
        actions={[{
          label: collDeleteMode === 'transfer' ? t('media.transferAndDelete') : collDeleteMode === 'unlink' ? t('media.unlinkAndDelete') : t('media.deleteAll'),
          variant: 'danger',
          icon: Trash2,
          onClick: confirmDeleteCollection,
        }]}
      >
        <div className="space-y-2">
          {/* Option 1: Delete media */}
          <label className="flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all hover:bg-white/5"
            style={{ borderColor: collDeleteMode === 'delete_media' ? 'rgba(239,68,68,0.4)' : 'rgba(255,255,255,0.1)', backgroundColor: collDeleteMode === 'delete_media' ? 'rgba(239,68,68,0.05)' : 'transparent' }}
            onClick={() => setCollDeleteMode('delete_media')}
          >
            <input type="radio" name="collDeleteMode" checked={collDeleteMode === 'delete_media'} onChange={() => setCollDeleteMode('delete_media')} className="accent-red-500" />
            <div>
              <p className="text-sm font-semibold text-white">{t('media.deleteMedia')}</p>
              <p className="text-[11px] text-white/40">{t('media.deleteMediaHint')}</p>
            </div>
          </label>
          {/* Option 2: Unlink — keep media with no collection */}
          <label className="flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all hover:bg-white/5"
            style={{ borderColor: collDeleteMode === 'unlink' ? 'rgba(168,85,247,0.4)' : 'rgba(255,255,255,0.1)', backgroundColor: collDeleteMode === 'unlink' ? 'rgba(168,85,247,0.05)' : 'transparent' }}
            onClick={() => setCollDeleteMode('unlink')}
          >
            <input type="radio" name="collDeleteMode" checked={collDeleteMode === 'unlink'} onChange={() => setCollDeleteMode('unlink')} className="accent-purple-500" />
            <div>
              <p className="text-sm font-semibold text-white">{t('media.keepMediaWithoutCollection')}</p>
              <p className="text-[11px] text-white/40">{t('media.keepMediaHint')}</p>
            </div>
          </label>
          {/* Option 3: Transfer */}
          <label className="flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all hover:bg-white/5"
            style={{ borderColor: collDeleteMode === 'transfer' ? 'rgba(59,130,246,0.4)' : 'rgba(255,255,255,0.1)', backgroundColor: collDeleteMode === 'transfer' ? 'rgba(59,130,246,0.05)' : 'transparent' }}
            onClick={() => setCollDeleteMode('transfer')}
          >
            <input type="radio" name="collDeleteMode" checked={collDeleteMode === 'transfer'} onChange={() => setCollDeleteMode('transfer')} className="accent-blue-500" />
            <div>
              <p className="text-sm font-semibold text-white">{t('media.transferToAnotherCollection')}</p>
              <p className="text-[11px] text-white/40">{t('media.transferHint')}</p>
            </div>
          </label>
          {collDeleteMode === 'transfer' && (
            <div className="mt-3 pl-6">
              <span className="text-[10px] font-semibold text-white/30 uppercase tracking-wider mb-1.5 block">{t('media.targetCollection')}</span>
              {(() => {
                const transferOptions = collections?.filter(c => c.id !== collectionToDelete?.id) ?? [];
                if (transferOptions.length === 0) {
                  return <p className="text-[11px] text-white/30 text-center py-2 mt-1">{t('media.noOtherCollection')}</p>;
                }
                return (
                  <div className="max-h-[200px] overflow-y-auto custom-scrollbar rounded-xl border border-white/10 bg-white/[0.02] p-1.5 space-y-1">
                    {transferOptions.map(c => {
                      const Icon = getCollectionIconComponent(c.name, c.icon);
                      const isChosen = collTransferTarget === c.id;
                      return (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => setCollTransferTarget(c.id)}
                          className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                            isChosen ? 'border-blue-500/40 bg-blue-500/10' : 'border-white/10 bg-white/[0.03] hover:bg-white/[0.06] hover:border-white/15'
                          }`}
                        >
                          <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: `${c.color}15` }}>
                            <Icon className="w-3.5 h-3.5" style={{ color: c.color }} />
                          </div>
                          <span className={`text-sm font-medium truncate flex-1 ${isChosen ? 'text-white' : 'text-white/60'}`}>{c.name}</span>
                          {isChosen && <CheckCircle2 className="w-4 h-4 text-blue-400 shrink-0" />}
                        </button>
                      );
                    })}
                  </div>
                );
              })()}
            </div>
          )}
        </div>
      </ConfirmDialog>
    </AppShell>
  );
};

export default Library;