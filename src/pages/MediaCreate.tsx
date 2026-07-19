import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Plus,
  Minus,
  ArrowLeft,
  ChevronDown,
  X,
  Upload,
  GripVertical,
  Crown,
  Trash2,
  Search,
  Info,
  Zap,
  Tag,
  PenLine,
  Image as ImageIcon,
  Play,
  CheckCircle2,
  Clock,
  XCircle,
  PauseCircle,
  Save,
  RefreshCw,
  ThumbsUp,
  ThumbsDown,
  Activity,
  Users,
  Paperclip,
  FileText,
} from 'lucide-react';
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragOverEvent,
  useDroppable,
  pointerWithin,
  closestCorners,
} from '@dnd-kit/core';
import {
  SortableContext,
  rectSortingStrategy,
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { AnimatePresence, motion } from 'framer-motion';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { convertFileSrc } from '@tauri-apps/api/core';
import { PersonPhoto, getPersonPhotoUrl, getPersonGradient } from '@/components/PersonPhoto';
import { open as openFileDialog } from '@tauri-apps/plugin-dialog';
import { stat } from '@tauri-apps/plugin-fs';
import { AppShell, MainContent } from '@/components/Layout';
import SharedHeader from '@/components/SharedHeader';
import ConfirmDialog from '@/components/ConfirmDialog';
import CoverCropModal from '@/components/CoverCropModal';
import CustomDatePicker from '@/components/CustomDatePicker';
import GravityMarkdownEditor, { type GravityMarkdownEditorHandle } from '@/components/MarkdownEditor/GravityMarkdownEditor';
import { useNavigationStore } from '@/stores/useNavigationStore';
import { useCollections } from '@/hooks/useCollections';
import { useReviewTemplates } from '@/hooks/useReviewTemplates';
import { usePeople } from '@/hooks/usePeople';
import { useQueryClient } from '@tanstack/react-query';
import { useCreateMedia, useUpdateMedia, useMediaDetail } from '@/hooks/useMedia';
import { getCollectionIconComponent } from '@/components/CollectionIcons';
import { getIconById } from '@/lib/collection-icons';
import { tauriApi } from '@/lib/tauri-api';
import i18next from 'i18next';
import { formatProgression, formatFileSize } from '@/lib/utils';
import {
  MEDIA_TITLE_MAX,
  MAX_GENRES_PER_MEDIA,
  MAX_IMAGES_PER_MEDIA,
  MAX_RATING,
  MIN_RATING,
} from '@/lib/constants';
import type { Genre, MediaAttachment, MediaCredit, Person } from '@/types';

/* ================================================================== */
/*  Types                                                              */
/* ================================================================== */
interface GalleryImage {
  id: string;
  file: File | null; // null for existing server images
  preview: string;
  isExisting?: boolean; // true for images already on the server
  serverImageId?: number; // media_images.id from the backend
  filePath?: string; // original local path for dropped files
}


interface AttachedFile {
  id: string;
  name: string;
  size: number;
  path?: string;
  isExisting?: boolean;
  serverAttachmentId?: number;
}

interface MediaFormState {
  title: string;
  collectionId: number | null;
  creator: string;
  releaseDate: string;
  experienceDate: string;
  synopsis: string;
  progressCurrent: number;
  progressTotal: number | null;
  progressStatus: 'NOT_STARTED' | 'IN_PROGRESS' | 'ON_HOLD' | 'COMPLETED' | 'ABANDONED';
  replayCount: number;
  experienceDates: string[];
  userRating: number | null;
  userReview: string;
  positivePoints: string;
  negativePoints: string;
  mediaStatus: string;
  genres: Genre[];
  genreInput: string;
  images: GalleryImage[];
  attachments: AttachedFile[];
  coverCrop: { x: number; y: number; zoom: number } | null;
  credits: MediaCredit[];
}


import { getRatingColor, getRatingCategory } from '@/utils/ratingColors';
import { PROGRESS_STATUS_LABELS, PROGRESS_STATUS_COLORS } from '@/lib/status-labels';

// MediaStatus labels and colors (imported only when needed)
import { MEDIA_STATUS_LABELS, MEDIA_STATUS_COLORS } from '@/lib/status-labels';

// STATUS_OPTIONS and MEDIA_STATUS_OPTIONS are now built inside each component via useMemo
// to ensure labels are re-evaluated when the language changes.

/* ================================================================== */
/*  Review templates - loaded dynamically from database              */
/* ================================================================== */
// Templates are now loaded via useReviewTemplates hook in the component

/* ================================================================== */
/*  Section Header                                                     */
/* ================================================================== */
const SectionHeader: React.FC<{ icon: React.ElementType; title: string; color?: string }> = ({ icon: Icon, title, color = 'var(--theme-accent)' }) => (
  <div className="flex items-center gap-2.5 mb-5 pb-3 border-b border-white/5">
    <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${color}20` }}>
      <Icon className="w-3.5 h-3.5" style={{ color }} />
    </div>
    <h2 className="text-base font-bold text-white">{title}</h2>
  </div>
);

/* ================================================================== */
/*  Media Status Picker                                                 */
/* ================================================================== */
const MediaStatusPicker: React.FC<{ value: string; onChange: (val: string) => void }> = ({ value, onChange }) => {
  const { i18n } = useTranslation();
  const MEDIA_STATUS_OPTIONS = useMemo(() => [
    { value: 'UPCOMING', label: MEDIA_STATUS_LABELS.UPCOMING, icon: Clock, color: MEDIA_STATUS_COLORS.UPCOMING },
    { value: 'ONGOING', label: MEDIA_STATUS_LABELS.ONGOING, icon: Play, color: MEDIA_STATUS_COLORS.ONGOING },
    { value: 'hiatus', label: i18next.t('media.status.hiatus'), icon: PauseCircle, color: '#f59e0b' },
    { value: 'ABANDONED', label: MEDIA_STATUS_LABELS.ABANDONED, icon: XCircle, color: MEDIA_STATUS_COLORS.ABANDONED },
    { value: 'COMPLETED', label: MEDIA_STATUS_LABELS.COMPLETED, icon: CheckCircle2, color: MEDIA_STATUS_COLORS.COMPLETED },
  ], [i18n.language]);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const current = MEDIA_STATUS_OPTIONS.find((o) => o.value === value) || MEDIA_STATUS_OPTIONS[0];
  const CurrentIcon = current.icon;

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const keyHandler = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', handler);
    document.addEventListener('keydown', keyHandler);
    return () => { document.removeEventListener('mousedown', handler); document.removeEventListener('keydown', keyHandler); };
  }, []);

  return (
    <div ref={ref} className="relative">
      <label className="block text-[11px] font-semibold text-white/40 uppercase tracking-wider mb-1.5">{i18next.t('common.mediaStatus')}</label>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2.5 px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm text-white hover:border-white/20 transition-colors cursor-pointer text-left"
      >
        <CurrentIcon className="w-3.5 h-3.5" style={{ color: current.color }} strokeWidth={2.5} />
        <span className="flex-1 truncate font-bold uppercase" style={{ color: current.color }}>{current.label}</span>
        <svg className={`w-3.5 h-3.5 text-white/30 transition-transform ${open ? 'rotate-180' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9" /></svg>
      </button>
      {open && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1.5 bg-[#12141f]/98 backdrop-blur-2xl border border-white/10 rounded-xl shadow-2xl p-1.5 max-h-64 overflow-y-auto custom-scrollbar">
          {MEDIA_STATUS_OPTIONS.map((opt) => {
            const OptIcon = opt.icon;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => { onChange(opt.value); setOpen(false); }}
                className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 text-sm font-bold uppercase transition-colors cursor-pointer text-left rounded-lg hover:bg-white/8 ${value === opt.value ? 'bg-white/[0.05]' : ''
                  }`}
                style={{ color: opt.color }}
              >
                <OptIcon className="w-3.5 h-3.5" style={{ color: opt.color }} strokeWidth={2.5} />
                <span>{opt.label}</span>
                {value === opt.value && <span className="ml-auto text-primary text-xs">✓</span>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

/* ================================================================== */
/*  Progress Status Picker (popup menu like work status)               */
/* ================================================================== */
type ProgressStatusOption = {
  value: 'NOT_STARTED' | 'IN_PROGRESS' | 'ON_HOLD' | 'COMPLETED' | 'ABANDONED';
  label: string;
  abandoned: boolean;
  color: string;
  icon: React.ElementType;
};

const ProgressStatusPicker: React.FC<{
  progressStatus: 'NOT_STARTED' | 'IN_PROGRESS' | 'ON_HOLD' | 'COMPLETED' | 'ABANDONED';
  onSelect: (opt: ProgressStatusOption) => void;
}> = ({ progressStatus, onSelect }) => {
  const { i18n } = useTranslation();
  const STATUS_OPTIONS = useMemo<ProgressStatusOption[]>(() => [
    { value: 'NOT_STARTED', label: PROGRESS_STATUS_LABELS.NOT_STARTED, abandoned: false, color: PROGRESS_STATUS_COLORS.NOT_STARTED, icon: Clock },
    { value: 'IN_PROGRESS', label: PROGRESS_STATUS_LABELS.IN_PROGRESS, abandoned: false, color: PROGRESS_STATUS_COLORS.IN_PROGRESS, icon: Play },
    { value: 'ON_HOLD', label: PROGRESS_STATUS_LABELS.ON_HOLD, abandoned: false, color: PROGRESS_STATUS_COLORS.ON_HOLD, icon: PauseCircle },
    { value: 'ABANDONED', label: PROGRESS_STATUS_LABELS.ABANDONED, abandoned: true, color: PROGRESS_STATUS_COLORS.ABANDONED, icon: XCircle },
    { value: 'COMPLETED', label: PROGRESS_STATUS_LABELS.COMPLETED, abandoned: false, color: PROGRESS_STATUS_COLORS.COMPLETED, icon: CheckCircle2 },
  ], [i18n.language]);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const keyHandler = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', handler);
    document.addEventListener('keydown', keyHandler);
    return () => { document.removeEventListener('mousedown', handler); document.removeEventListener('keydown', keyHandler); };
  }, []);

  // Determine current active option
  const current = STATUS_OPTIONS.find((opt) => opt.value === progressStatus) || STATUS_OPTIONS[0];

  const CurrentIcon = current.icon;

  return (
    <div ref={ref} className="relative mb-5">
      <label className="block text-[11px] font-semibold text-white/40 uppercase tracking-wider mb-1.5">{i18next.t('common.progressStatus')}</label>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2 px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm text-white hover:border-white/20 transition-colors cursor-pointer text-left"
      >
        <CurrentIcon className="w-3.5 h-3.5" style={{ color: current.color }} strokeWidth={2.5} />
        <span className="flex-1 truncate font-bold uppercase" style={{ color: current.color }}>{current.label}</span>
        <svg className={`w-3.5 h-3.5 text-white/30 transition-transform ${open ? 'rotate-180' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9" /></svg>
      </button>
      {open && (
        <div className="absolute z-[70] top-full left-0 right-0 mt-1.5 bg-[#12141f]/98 backdrop-blur-2xl border border-white/10 rounded-xl shadow-2xl p-1.5 max-h-64 overflow-y-auto custom-scrollbar">
          {STATUS_OPTIONS.map((opt) => {
            const OptIcon = opt.icon;
            const isActive = opt.value === progressStatus;
            return (
              <button
                key={opt.label}
                type="button"
                onClick={() => { onSelect(opt); setOpen(false); }}
                className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 text-sm font-bold uppercase transition-colors cursor-pointer text-left rounded-lg hover:bg-white/8 ${isActive ? 'bg-white/[0.05]' : ''
                  }`}
                style={{ color: opt.color }}
              >
                <OptIcon className="w-3.5 h-3.5" style={{ color: opt.color }} strokeWidth={2.5} />
                <span>{opt.label}</span>
                {isActive && <span className="ml-auto text-primary text-xs">✓</span>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

/* CustomDatePicker is now imported from @/components/CustomDatePicker */

/* ================================================================== */
/*  Creator Selector (tag-based input with suggestions)               */
/* ================================================================== */
const CreatorSelector: React.FC<{
  value: string;
  onChange: (val: string) => void;
  allSuggestions: string[];
  label: string;
  placeholder?: string;
  maxVisible?: number;
}> = ({ value, onChange, allSuggestions, label, placeholder, maxVisible = 5 }) => {
  const { t } = useTranslation();
  const [input, setInput] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);

  const creators = useMemo(() => {
    return value ? value.split(';').map(c => c.trim()).filter(Boolean) : [];
  }, [value]);

  const filtered = useMemo(() => {
    if (!isFocused) return [];
    const available = allSuggestions.filter((s) => !creators.some(c => c.toLowerCase() === s.toLowerCase()));
    if (input.trim().length > 0) {
      const lower = input.toLowerCase();
      return available.filter((s) => s.toLowerCase().includes(lower));
    }
    return available;
  }, [input, allSuggestions, creators, isFocused]);

  const visible = filtered.slice(0, maxVisible);
  const remaining = filtered.length - visible.length;

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsFocused(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Reset active index when visible list changes or input changes
  useEffect(() => {
    setActiveIndex(-1);
  }, [visible.length, input]);

  const handleAdd = (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    if (!creators.some(c => c.toLowerCase() === trimmed.toLowerCase())) {
      const nextCreators = [...creators, trimmed];
      onChange(nextCreators.join('; '));
    }
    setInput('');
  };

  const handleRemove = (name: string) => {
    const nextCreators = creators.filter((c) => c !== name);
    onChange(nextCreators.join('; '));
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const dropdownOpen = isFocused && visible.length > 0;
    if (e.key === 'ArrowDown') {
      if (!dropdownOpen) return;
      e.preventDefault();
      setActiveIndex((prev) => Math.min(prev + 1, visible.length - 1));
    } else if (e.key === 'ArrowUp') {
      if (!dropdownOpen) return;
      e.preventDefault();
      if (activeIndex <= 0) {
        setActiveIndex(-1);
      } else {
        setActiveIndex((prev) => prev - 1);
      }
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (activeIndex >= 0 && activeIndex < visible.length) {
        handleAdd(visible[activeIndex]);
        setActiveIndex(-1);
      } else if (visible.length > 0) {
        handleAdd(visible[0]);
        setActiveIndex(-1);
      } else if (input.trim()) {
        handleAdd(input);
      }
    } else if (e.key === ',' || e.key === ';') {
      e.preventDefault();
      if (input.trim()) {
        handleAdd(input);
      }
    } else if (e.key === 'Backspace' && !input) {
      if (creators.length > 0) {
        handleRemove(creators[creators.length - 1]);
      }
    } else if (e.key === 'Escape') {
      setIsFocused(false);
      setActiveIndex(-1);
    }
  };

  const handleInputChange = (val: string) => {
    setActiveIndex(-1);
    if (val.includes(',') || val.includes(';')) {
      const parts = val.split(/[;,]+/).map(p => p.trim()).filter(Boolean);
      const nextCreators = [...creators];
      parts.forEach(part => {
        if (!nextCreators.some(c => c.toLowerCase() === part.toLowerCase())) {
          nextCreators.push(part);
        }
      });
      onChange(nextCreators.join('; '));
      setInput('');
    } else {
      setInput(val);
    }
  };

  const handleBlur = () => {
    setTimeout(() => {
      if (input.trim()) {
        handleAdd(input);
      }
    }, 150);
  };

  return (
    <div ref={containerRef} className="relative">
      <label className="block text-[11px] font-semibold text-white/40 uppercase tracking-wider mb-1.5">
        {label}
      </label>
      <div className={`w-full min-h-[42px] px-3 py-1.5 bg-white/5 border rounded-xl flex flex-wrap gap-1.5 items-center transition-all ${
        isFocused ? 'border-primary/30 ring-1 ring-primary/20' : 'border-white/10'
      }`}>
        {creators.map((creator) => (
          <span
            key={creator}
            className="inline-flex items-center gap-1 pl-2 pr-1 py-0.5 rounded-lg text-xs bg-white/10 text-white font-medium border border-white/5"
          >
            {creator}
            <button
              type="button"
              onClick={() => handleRemove(creator)}
              className="w-3.5 h-3.5 rounded-md flex items-center justify-center hover:bg-white/10 text-white/40 hover:text-white transition-colors cursor-pointer"
            >
              <X className="w-2.5 h-2.5" />
            </button>
          </span>
        ))}
        <input
          type="text"
          value={input}
          onChange={(e) => handleInputChange(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onKeyDown={handleKeyDown}
          onBlur={handleBlur}
          placeholder={creators.length === 0 ? placeholder : t('mediaCreate.addCreatorPlaceholder', { label })}
          className="flex-1 min-w-[80px] bg-transparent border-0 p-0 text-sm text-white placeholder:text-white/20 focus:outline-none"
        />
      </div>
      {isFocused && visible.length > 0 && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-[#18181b]/98 backdrop-blur-2xl border border-white/10 rounded-xl shadow-2xl py-1.5 custom-scrollbar" style={{ maxHeight: 220, overflowY: 'auto' }}>
          {visible.map((item, idx) => (
            <div key={item} className="px-1.5">
              <button
                type="button"
                onMouseDown={(e) => {
                  // Prevent input blur so that handleBlur doesn't trigger and add the typed query instead
                  e.preventDefault();
                }}
                onClick={() => {
                  handleAdd(item);
                  setIsFocused(false);
                }}
                className={`w-full text-left px-3 py-2 text-sm rounded-lg transition-all cursor-pointer ${
                  idx === activeIndex
                    ? 'bg-white/[0.10] text-white'
                    : 'text-white/60 hover:bg-white/[0.06] hover:text-white'
                }`}
              >
                {item}
              </button>
            </div>
          ))}
          {remaining > 0 && (
            <div className="px-4 py-2 text-[11px] text-white/30 border-t border-white/5 mx-1.5">
              {remaining} autre{remaining > 1 ? 's' : ''} résultat{remaining > 1 ? 's' : ''} — affinez votre recherche
            </div>
          )}
        </div>
      )}
    </div>
  );
};

/* ================================================================== */
/*  Sortable Genre Pill (for drag & drop reordering)                   */
/* ================================================================== */
/*  Genre Pill — sortable, same pattern as gallery                     */
/* ================================================================== */
const SortableGenrePill: React.FC<{
  genre: Genre;
  onRemove: (genreId: number) => void;
}> = ({ genre, onRemove }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: genre.id });

  return (
    <span
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.4 : 1,
        zIndex: isDragging ? 50 : 'auto',
        position: 'relative',
      }}
      className="inline-flex w-full"
    >
      <span
        className="inline-flex items-center gap-1.5 pl-2 pr-1.5 py-1 rounded-full text-xs font-medium select-none w-full"
        style={{
          backgroundColor: isDragging ? `${genre.color}40` : `${genre.color}20`,
          border: `1px solid ${isDragging ? genre.color + '90' : genre.color + '40'}`,
          color: `color-mix(in srgb, ${genre.color} 75%, white)`,
          boxShadow: isDragging ? `0 8px 24px ${genre.color}50, 0 2px 8px rgba(0,0,0,0.5)` : undefined,
          transform: isDragging ? 'scale(1.05)' : undefined,
          cursor: isDragging ? 'grabbing' : 'grab',
          transition: 'background-color 0.15s, border-color 0.15s, box-shadow 0.15s',
          overflow: 'hidden',
        }}
        {...attributes}
        {...listeners}
      >
        <span className="flex flex-col gap-[2px] opacity-30 shrink-0" style={{ pointerEvents: 'none' }}>
          <span className="flex gap-[2px]">
            <span className="w-[2px] h-[2px] rounded-full bg-current" />
            <span className="w-[2px] h-[2px] rounded-full bg-current" />
          </span>
          <span className="flex gap-[2px]">
            <span className="w-[2px] h-[2px] rounded-full bg-current" />
            <span className="w-[2px] h-[2px] rounded-full bg-current" />
          </span>
          <span className="flex gap-[2px]">
            <span className="w-[2px] h-[2px] rounded-full bg-current" />
            <span className="w-[2px] h-[2px] rounded-full bg-current" />
          </span>
        </span>
        <span className="truncate flex-1 text-center" style={{ pointerEvents: 'none' }}>{genre.name}</span>
        <button
          type="button"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => { e.stopPropagation(); onRemove(genre.id); }}
          className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full hover:bg-black/20 transition-all cursor-pointer opacity-50 hover:opacity-100 shrink-0"
          title={i18next.t('common.remove')}
        >
          <X className="w-2.5 h-2.5" />
        </button>
      </span>
    </span>
  );
};

/* ================================================================== */
/*  Droppable Container Helper                                         */
/* ================================================================== */
const DroppableContainer: React.FC<{ id: string; children: React.ReactNode; className: string }> = ({ id, children, className }) => {
  const { setNodeRef } = useDroppable({ id });
  return (
    <div ref={setNodeRef} className={className}>
      {children}
    </div>
  );
};

/* ================================================================== */
/*  Genre Selector (with collection default genres)                    */
/* ================================================================== */
const GenreSelector: React.FC<{
  selectedGenres: Genre[];
  onAdd: (genre: Genre) => void;
  onRemove: (genreId: number) => void;
  onReorder: (newOrder: Genre[]) => void;
  collectionId: number | null;
  collectionGenres: Genre[];
}> = ({ selectedGenres, onAdd, onRemove, onReorder, collectionGenres }) => {
  const [input, setInput] = useState('');
  const [allGenres, setAllGenres] = useState<Genre[]>([]);
  const [isFocused, setIsFocused] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    tauriApi.genres.getAll().then(setAllGenres).catch(() => { });
  }, []);

  const filtered = useMemo(() => {
    if (!isFocused) return [];
    const available = allGenres.filter((g) => !selectedGenres.some((sg) => sg.id === g.id));
    if (input.trim().length > 0) {
      const lower = input.toLowerCase();
      return available.filter((g) => g.name.toLowerCase().includes(lower));
    }
    return available;
  }, [input, allGenres, selectedGenres, isFocused]);

  const visible = filtered.slice(0, 5);
  const remaining = filtered.length - visible.length;

  // Reset active index when visible list changes
  useEffect(() => { setActiveIndex(-1); }, [visible.length, input]);

  const suggestedGenres = useMemo(
    () => collectionGenres.filter((g) => !selectedGenres.some((sg) => sg.id === g.id)).slice(0, 8),
    [collectionGenres, selectedGenres]
  );

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setIsFocused(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleCreate = async () => {
    if (!input.trim()) return;
    try {
      const id = await tauriApi.genres.create(input.trim());
      const newGenre: Genre = { id, name: input.trim(), color: '#8B5CF6', created_at: new Date().toISOString() };
      onAdd(newGenre);
      setInput('');
      setAllGenres((prev) => [...prev, newGenre]);
    } catch { /* Genre may already exist */ }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const dropdownOpen = isFocused && (visible.length > 0 || (input.trim() && visible.length === 0));
    if (e.key === 'ArrowDown') {
      if (!dropdownOpen) return;
      e.preventDefault();
      setActiveIndex((prev) => Math.min(prev + 1, visible.length - 1));
    } else if (e.key === 'ArrowUp') {
      if (!dropdownOpen) return;
      e.preventDefault();
      if (activeIndex <= 0) {
        setActiveIndex(-1);
        // Refocus input (already focused, just reset)
      } else {
        setActiveIndex((prev) => prev - 1);
      }
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (activeIndex >= 0 && activeIndex < visible.length) {
        onAdd(visible[activeIndex]);
        setInput('');
        setActiveIndex(-1);
        inputRef.current?.focus();
      } else if (visible.length > 0) {
        onAdd(visible[0]);
        setInput('');
        setActiveIndex(-1);
        inputRef.current?.focus();
      } else if (input.trim()) {
        handleCreate();
      }
    } else if (e.key === 'Escape') {
      setIsFocused(false);
      setActiveIndex(-1);
    }
  };

  const isMaxReached = selectedGenres.length >= MAX_GENRES_PER_MEDIA;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  const primaryGenres = useMemo(() => {
    return selectedGenres
      .filter(g => g.position === undefined || g.position === null || g.position < 9)
      .sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
  }, [selectedGenres]);

  const secondaryGenres = useMemo(() => {
    return selectedGenres
      .filter(g => g.position !== undefined && g.position !== null && g.position >= 9)
      .sort((a, b) => (a.position ?? 9) - (b.position ?? 9));
  }, [selectedGenres]);

  // STRATÉGIE DE COLLISION PERSONNALISÉE : Règle le problème de la zone vide (3ème position)
  const customCollisionDetection = useCallback((args: any) => {
    // 1. Donne la priorité absolue à ce qui se trouve directement sous le pointeur de la souris
    const pointerCollisions = pointerWithin(args);
    if (pointerCollisions.length > 0) {
      return pointerCollisions;
    }
    // 2. Si le pointeur est un peu à côté, se rabat sur les coins les plus proches (évite la résistance du centre)
    return closestCorners(args);
  }, []);

  // GÈRE LE CHANGEMENT DE CONTENEUR EN TEMPS RÉEL (Le grid suit pendant le déplacement)
  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) return;

    const activeId = active.id;
    const overId = over.id;

    if (activeId === overId) return;

    const activeGenre = selectedGenres.find(g => g.id === activeId);
    if (!activeGenre) return;

    const isActiveInPrimary = primaryGenres.some(g => g.id === activeId);
    const isOverInPrimary = primaryGenres.some(g => g.id === overId) || overId === 'primary-container';
    const isOverInSecondary = secondaryGenres.some(g => g.id === overId) || overId === 'secondary-container';

    // Cas A : L'élément quitte le haut pour aller vers le bas
    if (isActiveInPrimary && isOverInSecondary) {
      if (secondaryGenres.length >= 6) return;

      const nextPrimary = primaryGenres.filter(g => g.id !== activeId).map((g, idx) => ({ ...g, position: idx }));
      let nextSecondary = [...secondaryGenres];
      
      const overIdx = secondaryGenres.findIndex(g => g.id === overId);
      if (overIdx !== -1) {
        nextSecondary.splice(overIdx, 0, activeGenre);
      } else {
        nextSecondary.push(activeGenre); // Déposé dans le vide -> va à la fin (ex: 3éme position)
      }
      nextSecondary = nextSecondary.map((g, idx) => ({ ...g, position: 9 + idx }));

      onReorder([...nextPrimary, ...nextSecondary]);
    }
    // Cas B : L'élément quitte le bas pour aller vers le haut
    else if (!isActiveInPrimary && isOverInPrimary) {
      if (primaryGenres.length >= 9) return;

      const nextSecondary = secondaryGenres.filter(g => g.id !== activeId).map((g, idx) => ({ ...g, position: 9 + idx }));
      let nextPrimary = [...primaryGenres];

      const overIdx = primaryGenres.findIndex(g => g.id === overId);
      if (overIdx !== -1) {
        nextPrimary.splice(overIdx, 0, activeGenre);
      } else {
        nextPrimary.push(activeGenre);
      }
      nextPrimary = nextPrimary.map((g, idx) => ({ ...g, position: idx }));

      onReorder([...nextPrimary, ...nextSecondary]);
    }
  };

  // GÈRE LE TRI AU SEIN DU MÊME CONTENEUR AU LÂCHER DE SOURIS
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;

    const activeId = active.id;
    const overId = over.id;

    const isActiveInPrimary = primaryGenres.some(g => g.id === activeId);
    const isOverInPrimary = primaryGenres.some(g => g.id === overId) || overId === 'primary-container';
    const isOverInSecondary = secondaryGenres.some(g => g.id === overId) || overId === 'secondary-container';

    // Tri interne : section du haut
    if (isActiveInPrimary && isOverInPrimary) {
      const oldIdx = primaryGenres.findIndex(g => g.id === activeId);
      const newIdx = primaryGenres.findIndex(g => g.id === overId);
      if (oldIdx !== -1 && newIdx !== -1 && oldIdx !== newIdx) {
        const reorderedPrimary = arrayMove(primaryGenres, oldIdx, newIdx).map((g, idx) => ({ ...g, position: idx }));
        onReorder([...reorderedPrimary, ...secondaryGenres]);
      }
    }
    // Tri interne : section du bas
    else if (!isActiveInPrimary && isOverInSecondary) {
      const oldIdx = secondaryGenres.findIndex(g => g.id === activeId);
      const newIdx = secondaryGenres.findIndex(g => g.id === overId);
      if (oldIdx !== -1 && newIdx !== -1 && oldIdx !== newIdx) {
        const reorderedSecondary = arrayMove(secondaryGenres, oldIdx, newIdx).map((g, idx) => ({ ...g, position: 9 + idx }));
        onReorder([...primaryGenres, ...reorderedSecondary]);
      }
    }
  };

  return (
    <div>
      <label className="block text-[11px] font-semibold text-white/40 uppercase tracking-wider mb-2">
        Genres
      </label>

      {selectedGenres.length > 0 && (
        <DndContext 
          sensors={sensors} 
          collisionDetection={customCollisionDetection} 
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
        >
          <div className="space-y-4 mb-4">
              
              {/* Section 1 : MATCHING & FILTRES (SortableContext dédié uniquement au haut) */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-white/50 uppercase tracking-wider">
                    MATCHING & FILTRES ({primaryGenres.length}/9)
                  </span>
                </div>
                <p className="text-[9px] text-white/35 italic leading-tight">
                  Ces 9 premiers genres définissent les recommandations d'œuvres similaires.
                </p>
                <SortableContext items={primaryGenres.map((g) => g.id)} strategy={rectSortingStrategy}>
                  <DroppableContainer id="primary-container" className="grid grid-cols-3 gap-1.5 p-2 rounded-xl border border-white/5 bg-white/[0.01] min-h-[50px] transition-all">
                    {primaryGenres.map((genre) => (
                      <SortableGenrePill key={genre.id} genre={genre} onRemove={onRemove} />
                    ))}
                    {primaryGenres.length === 0 && (
                      <div className="col-span-3 flex items-center justify-center py-3 text-[10px] text-white/20 italic">
                        Aucun genre principal
                      </div>
                    )}
                  </DroppableContainer>
                </SortableContext>
              </div>

              {/* Section 2 : FILTRES UNIQUEMENT (SortableContext dédié uniquement au bas) */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-white/50 uppercase tracking-wider">
                    FILTRES UNIQUEMENT ({secondaryGenres.length}/6)
                  </span>
                </div>
                <p className="text-[9px] text-white/35 italic leading-tight">
                  Au-delà de 9, ces genres servent uniquement pour les filtres et la recherche.
                </p>
                <SortableContext items={secondaryGenres.map((g) => g.id)} strategy={rectSortingStrategy}>
                  <DroppableContainer id="secondary-container" className="grid grid-cols-3 gap-1.5 p-2 rounded-xl border border-white/5 bg-white/[0.01] min-h-[50px] transition-all">
                    {secondaryGenres.map((genre) => (
                      <SortableGenrePill key={genre.id} genre={genre} onRemove={onRemove} />
                    ))}
                    {secondaryGenres.length === 0 && (
                      <div className="col-span-3 flex items-center justify-center py-3 text-[10px] text-white/20 italic">
                        Aucun genre secondaire
                      </div>
                    )}
                  </DroppableContainer>
                </SortableContext>
              </div>

          </div>
        </DndContext>
      )}

      {/* Le reste de votre composant (Suggested genres et Input) demeure inchangé */}
      <div ref={containerRef}>
        {suggestedGenres.length > 0 && !isMaxReached && (
          <div className="mb-3">
            <p className="text-[11px] text-white/30 mb-1.5">{i18next.t('mediaCreate.popularGenres')}</p>
            <div className="flex flex-wrap gap-1.5">
              {suggestedGenres.map((g) => (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => { onAdd(g); }}
                  className="inline-flex items-center gap-1 px-2.5 py-1 bg-white/5 border border-white/10 rounded-full text-[11px] text-white/60 hover:bg-white/10 hover:text-white hover:border-white/20 transition-all cursor-pointer"
                >
                  <Plus className="w-2.5 h-2.5" />
                  {g.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {!isMaxReached && (
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => { setInput(e.target.value); setActiveIndex(-1); }}
              onFocus={() => setIsFocused(true)}
              onKeyDown={handleKeyDown}
              placeholder={i18next.t('mediaCreate.addGenrePlaceholder')}
              className="w-full pl-10 pr-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-primary/30 transition-colors"
            />
            {isFocused && (visible.length > 0 || (input.trim() && visible.length === 0)) && (
              <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-[#18181b]/98 backdrop-blur-2xl border border-white/10 rounded-xl shadow-2xl py-1.5 custom-scrollbar" style={{ maxHeight: 220, overflowY: 'auto' }}>
                {visible.map((genre, idx) => (
                  <div key={genre.id} className="px-1.5">
                    <button
                      type="button"
                      onClick={() => { onAdd(genre); setInput(''); setActiveIndex(-1); inputRef.current?.focus(); }}
                      className={`w-full text-left px-3 py-2 text-sm rounded-lg transition-all cursor-pointer ${
                        idx === activeIndex
                          ? 'bg-white/[0.10] text-white'
                          : 'text-text-secondary hover:bg-white/[0.06] hover:text-white'
                      }`}
                    >
                      {genre.name}
                    </button>
                  </div>
                ))}
                {remaining > 0 && (
                  <div className="px-4 py-2 text-[11px] text-white/30 border-t border-white/5 mx-1.5">
                    {remaining} autre{remaining > 1 ? 's' : ''} résultat{remaining > 1 ? 's' : ''} — affinez votre recherche
                  </div>
                )}
                {input.trim() && !filtered.some((s) => s.name.toLowerCase() === input.trim().toLowerCase()) && (
                  <div className="border-t border-white/5 mt-1 pt-1 px-1.5">
                    <button
                      type="button"
                      onClick={handleCreate}
                      className="w-full text-left px-3 py-2 text-sm text-primary hover:bg-primary/10 rounded-lg transition-all cursor-pointer flex items-center gap-2"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Créer « {input.trim()} »
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

/* ================================================================== */
/*  Credits / People Selector Component                              */
/* ================================================================== */
interface CreditsSelectorProps {
  selectedCredits: MediaCredit[];
  allPeople: Person[];
  onChange: (credits: MediaCredit[]) => void;
  onRefreshPeople: () => Promise<void>;
}

const RoleAutocomplete: React.FC<{
  value: string;
  existingRoles: string[];
  onChange: (role: string) => void;
}> = ({ value, existingRoles, onChange }) => {
  const [input, setInput] = useState(value);
  const [isFocused, setIsFocused] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setInput(value);
  }, [value]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsFocused(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const filtered = useMemo(() => {
    if (!isFocused || existingRoles.length === 0) return [];
    if (!input.trim()) return existingRoles;
    const lower = input.toLowerCase();
    return existingRoles.filter((r) => r.toLowerCase().includes(lower));
  }, [input, existingRoles, isFocused]);

  const visible = filtered.slice(0, 5);
  const remaining = filtered.length - visible.length;
  const showDropdown = isFocused && visible.length > 0;

  return (
    <div ref={containerRef} className="relative w-full">
      <input
        type="text"
        value={input}
        onChange={(e) => {
          setInput(e.target.value);
          onChange(e.target.value);
        }}
        onFocus={() => setIsFocused(true)}
        placeholder={i18next.t('mediaCreate.rolePlaceholder')}
        className="w-full px-2 py-1 bg-black/20 border border-white/10 rounded-lg text-[11px] text-white placeholder:text-white/20 focus:outline-none focus:border-primary/40 transition-colors"
      />
      {showDropdown && (
        <div
          className="absolute z-[60] top-full left-0 right-0 mt-1 bg-[#18181b]/98 backdrop-blur-2xl border border-white/10 rounded-xl shadow-2xl py-1.5 custom-scrollbar"
          style={{ maxHeight: 160, overflowY: 'auto' }}
        >
          {visible.map((role) => (
            <div key={role} className="px-1.5">
              <button
                type="button"
                onClick={() => {
                  setInput(role);
                  onChange(role);
                  setIsFocused(false);
                }}
                className="w-full text-left px-3 py-1.5 text-[11px] text-text-secondary hover:bg-white/[0.06] hover:text-white rounded-lg transition-all cursor-pointer"
              >
                {role}
              </button>
            </div>
          ))}
          {remaining > 0 && (
            <div className="px-4 py-1.5 text-[10px] text-white/30 border-t border-white/5 mx-1.5">
              {remaining} autre{remaining > 1 ? 's' : ''} résultat{remaining > 1 ? 's' : ''} — affinez votre recherche
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const SortableCreditCard: React.FC<{
  credit: MediaCredit;
  existingRoles: string[];
  onRoleChange: (personId: number, role: string) => void;
  onRemove: (personId: number) => void;
}> = ({ credit, existingRoles, onRoleChange, onRemove }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: credit.person_id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    zIndex: isDragging ? 50 : 'auto',
  };

  return (
    <div ref={setNodeRef} style={style} className="relative group">
      <div
        className={`relative aspect-[3/4] rounded-xl overflow-hidden border bg-white/[0.02] transition-all ${
          isDragging ? 'border-primary/50 shadow-2xl scale-[1.02]' : 'border-white/10 hover:border-white/20'
        }`}
      >
        {credit.photo_path ? (
          <img
            src={getPersonPhotoUrl(credit.photo_path)}
            alt={credit.name}
            className="w-full h-full object-cover object-top"
            draggable={false}
          />
        ) : (
          <div
            className="w-full h-full flex items-center justify-center text-white text-2xl font-bold"
            style={{ background: getPersonGradient(credit.name) }}
          >
            {credit.name.charAt(0).toUpperCase()}
          </div>
        )}

        <div
          {...attributes}
          {...listeners}
          className="absolute top-2 right-2 w-7 h-7 rounded-lg bg-black/50 backdrop-blur-sm flex items-center justify-center text-white/70 hover:text-white cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100 transition-opacity"
          title={i18next.t('mediaCreate.dragToReorder')}
        >
          <GripVertical className="w-4 h-4" />
        </div>

        <button
          type="button"
          onClick={() => onRemove(credit.person_id)}
          className="absolute top-2 left-2 w-7 h-7 rounded-lg bg-black/50 backdrop-blur-sm flex items-center justify-center text-white/70 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all cursor-pointer"
          title={i18next.t('common.remove')}
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      <p className="mt-1.5 text-[10px] font-bold text-white truncate text-center" title={credit.name}>
        {credit.name}
      </p>

      <div className="mt-1" onPointerDown={(e) => e.stopPropagation()}>
        <RoleAutocomplete
          value={credit.role || ''}
          existingRoles={existingRoles}
          onChange={(role) => onRoleChange(credit.person_id, role)}
        />
      </div>
    </div>
  );
};

const CreditsSelector: React.FC<CreditsSelectorProps> = ({
  selectedCredits,
  allPeople,
  onChange,
  onRefreshPeople,
}) => {
  const [input, setInput] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const [existingRoles, setExistingRoles] = useState<string[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  useEffect(() => {
    tauriApi.people.getUniqueRoles()
      .then(setExistingRoles)
      .catch((err) => console.error('Failed to fetch unique roles:', err));
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsFocused(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredPeople = useMemo(() => {
    if (!isFocused) return [];
    const available = allPeople.filter((p) => !selectedCredits.some((sc) => sc.person_id === p.id));
    if (input.trim()) {
      const lower = input.toLowerCase();
      return available.filter((p) => p.name.toLowerCase().includes(lower));
    }
    return available;
  }, [input, allPeople, selectedCredits, isFocused]);

  const visiblePeople = filteredPeople.slice(0, 5);
  const remainingPeople = filteredPeople.length - visiblePeople.length;

  const handleAddPerson = (person: Person) => {
    const newCredit: MediaCredit = {
      person_id: person.id,
      name: person.name,
      photo_path: person.photo_path,
      role: '',
      position: selectedCredits.length,
    };
    onChange([...selectedCredits, newCredit]);
    setInput('');
  };

  const handleCreateAndAdd = async () => {
    if (!input.trim()) return;
    try {
      const newId = await tauriApi.people.create(input.trim());
      await onRefreshPeople(); // invalide le cache React Query ['people']
      const newCredit: MediaCredit = {
        person_id: newId,
        name: input.trim(),
        photo_path: null,
        role: '',
        position: selectedCredits.length,
      };
      onChange([...selectedCredits, newCredit]);
      setInput('');
    } catch (err) {
      console.error('Failed to create person from credits selector:', err);
    }
  };

  const handleRemoveCredit = (personId: number) => {
    const updated = selectedCredits
      .filter((c) => c.person_id !== personId)
      .map((c, index) => ({ ...c, position: index }));
    onChange(updated);
  };

  const handleRoleChange = (personId: number, role: string) => {
    const updated = selectedCredits.map((c) =>
      c.person_id === personId ? { ...c, role } : c
    );
    onChange(updated);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;
    
    if (active.id !== over.id) {
      const oldIdx = selectedCredits.findIndex((c) => c.person_id === active.id);
      const newIdx = selectedCredits.findIndex((c) => c.person_id === over.id);
      const updated = arrayMove(selectedCredits, oldIdx, newIdx);
      const finalized = updated.map((c, i) => ({ ...c, position: i }));
      onChange(finalized);
    }
  };

  return (
    <div ref={containerRef} className="space-y-4">
      {selectedCredits.length > 0 && (
        <DndContext sensors={sensors} collisionDetection={closestCorners} onDragEnd={handleDragEnd}>
          <SortableContext items={selectedCredits.map((c) => c.person_id)} strategy={rectSortingStrategy}>
            <div className="grid grid-cols-[repeat(auto-fill,minmax(90px,1fr))] gap-3 mb-4 p-2 rounded-xl border border-white/5 bg-white/[0.01]">
              {selectedCredits.map((credit) => (
                <SortableCreditCard
                  key={credit.person_id}
                  credit={credit}
                  existingRoles={existingRoles}
                  onRoleChange={handleRoleChange}
                  onRemove={handleRemoveCredit}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      {/* Autocomplete Search input */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onFocus={() => setIsFocused(true)}
          placeholder={i18next.t('person.searchOrAddForCredits')}
          className="w-full pl-10 pr-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-primary/30 transition-colors"
        />
        {isFocused && (visiblePeople.length > 0 || (input.trim() && visiblePeople.length === 0)) && (
          <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-[#18181b]/98 backdrop-blur-2xl border border-white/10 rounded-xl shadow-2xl py-1.5 custom-scrollbar" style={{ maxHeight: 220, overflowY: 'auto' }}>
            {visiblePeople.map((person) => (
              <div key={person.id} className="px-1.5">
                <button
                  type="button"
                  onClick={() => handleAddPerson(person)}
                  className="w-full text-left px-3 py-2 text-sm text-text-secondary hover:bg-white/[0.06] hover:text-white rounded-lg transition-all cursor-pointer flex items-center gap-2.5"
                >
                  <PersonPhoto name={person.name} photoPath={person.photo_path} widthClass="w-7" textSize="text-[10px]" />
                  <span className="truncate">{person.name}</span>
                </button>
              </div>
            ))}
            {remainingPeople > 0 && (
              <div className="px-4 py-2 text-[11px] text-white/30 border-t border-white/5 mx-1.5">
                {remainingPeople} autre{remainingPeople > 1 ? 's' : ''} résultat{remainingPeople > 1 ? 's' : ''} — affinez votre recherche
              </div>
            )}

            {/* Create option */}
            {input.trim() && !allPeople.some((p) => p.name.toLowerCase() === input.trim().toLowerCase()) && (
              <div className="border-t border-white/5 mt-1 pt-1 px-1.5">
                <button
                  type="button"
                  onClick={handleCreateAndAdd}
                  className="w-full text-left px-3 py-2 text-sm text-primary hover:bg-primary/10 rounded-lg transition-all cursor-pointer flex items-center gap-2"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Créer la personne « {input.trim()} »
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

/* ================================================================== */
/*  Sortable Gallery Image                                             */
/* ================================================================== */
const SortableGalleryImage: React.FC<{
  image: GalleryImage;
  index: number;
  isCover: boolean;
  onRemove: (id: string) => void;
  onSetCover: (index: number) => void;
}> = ({ image, index, isCover, onRemove, onSetCover }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: image.id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="relative group aspect-[3/4] rounded-xl overflow-hidden border border-white/10 bg-white/5">
      <img src={image.preview} alt="" className="w-full h-full object-cover" />
      {isCover && (
        <div className="absolute top-2 left-2 flex items-center gap-1 px-2 py-1 bg-yellow-500/90 rounded-lg text-[10px] font-bold text-black uppercase">
          <Crown className="w-3 h-3" />
          Cover
        </div>
      )}
      {!isCover && (
        <button type="button" onClick={() => onSetCover(index)} className="absolute top-2 left-2 flex items-center gap-1 px-2 py-1 bg-black/60 backdrop-blur-sm rounded-lg text-[10px] font-semibold text-white/70 hover:text-yellow-400 hover:bg-yellow-500/20 cursor-pointer opacity-0 group-hover:opacity-100 transition-all" title={i18next.t('mediaCreate.setAsCover')}>
          <Crown className="w-3 h-3" />
        </button>
      )}
      <div {...attributes} {...listeners} className="absolute top-2 right-2 p-1.5 bg-black/60 backdrop-blur-sm rounded-lg text-white/70 hover:text-white cursor-grab opacity-0 group-hover:opacity-100 transition-opacity">
        <GripVertical className="w-4 h-4" />
      </div>
      <button type="button" onClick={() => onRemove(image.id)} className="absolute bottom-2 right-2 p-1.5 bg-red-500/80 backdrop-blur-sm rounded-lg text-white hover:bg-red-500 cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity">
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </div>
  );
};



/* ================================================================== */
/*  Progress Ring                                                      */
/* ================================================================== */
const ProgressRing: React.FC<{ value: number; size?: number }> = ({ value, size = 72 }) => {
  const stroke = 5;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const displayValue = Math.min(value, 100);
  const offset = circumference - (displayValue / 100) * circumference;
  const getColor = () => {
    if (value > 100) return '#a855f7';
    if (value === 100) return '#10b981';
    if (value >= 50) return '#3b82f6';
    if (value > 0) return '#f59e0b';
    return '#64748b';
  };
  const color = getColor();

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} stroke="rgba(255,255,255,0.05)" strokeWidth={stroke} fill="none" />
        <circle cx={size / 2} cy={size / 2} r={radius} stroke={color} strokeWidth={stroke} fill="none" strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round" className="transition-all duration-500" />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-[11px] font-bold tabular-nums leading-none" style={{ color }}>{value}%</span>
      </div>
    </div>
  );
};

/* ================================================================== */
/*  Cover Preview — reproduces CoverCropModal's coordinate system      */
/* ================================================================== */
const CoverPreviewImg: React.FC<{
  src: string;
  cropData: { x: number; y: number; zoom: number } | null;
  containerW: number;
}> = ({ src, cropData, containerW }) => {
  const [natSize, setNatSize] = useState<{ w: number; h: number } | null>(null);

  useEffect(() => {
    const img = new Image();
    img.onload = () => setNatSize({ w: img.naturalWidth, h: img.naturalHeight });
    img.src = src;
  }, [src]);

  if (!cropData || !natSize) {
    return <img src={src} alt="" className="w-full h-full object-cover select-none pointer-events-none" />;
  }

  // The CoverCropModal uses a 200×300 frame. Reproduce its math at any container size.
  const MODAL_W = 200;
  const MODAL_H = 300;
  const coverScale = Math.max(MODAL_W / natSize.w, MODAL_H / natSize.h);
  const totalScale = coverScale * cropData.zoom;
  // Scale from modal-space to container-space
  const ratio = containerW / MODAL_W;

  return (
    <img
      src={src}
      alt=""
      className="select-none pointer-events-none"
      style={{
        position: 'absolute',
        left: '50%',
        top: '50%',
        transform: `translate(-50%, -50%) translate(${cropData.x * ratio}px, ${cropData.y * ratio}px) scale(${totalScale * ratio})`,
        transformOrigin: 'center center',
        maxWidth: 'none',
      }}
    />
  );
};

/* ================================================================== */
/*  Main MediaCreate Page — Single-page layout                         */
/* ================================================================== */
const MediaCreate: React.FC = () => {
  const { t } = useTranslation();
  const { mediaCreateCollectionId, editingMediaId, goBack, setBeforeNavigate, forceNavigate, navigateToMediaDetail } = useNavigationStore();
  const queryClient = useQueryClient();
  const { data: collections } = useCollections();
  const { data: reviewTemplates } = useReviewTemplates();
  const createMutation = useCreateMedia();
  const updateMutation = useUpdateMedia();
  const isEditMode = !!editingMediaId;
  const { data: existingMedia, isLoading: isLoadingMedia } = useMediaDetail(editingMediaId);

  // Confirm dialog state
  const [showLeaveDialog, setShowLeaveDialog] = useState(false);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isProcessingImages, setIsProcessingImages] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{
    current: number;
    total: number;
    fileName: string;
    stage: string;
    percent: number;
  } | null>(null);
  const [errorToast, setErrorToast] = useState<string | null>(null);
  const [editFormLoaded, setEditFormLoaded] = useState(false);
  // Track existing server images that were removed (to delete on save)
  const [deletedImageIds, setDeletedImageIds] = useState<number[]>([]);
  const [deletedAttachmentIds, setDeletedAttachmentIds] = useState<number[]>([]);
  // Track if cover source changed without explicit recrop
  const [coverSourceChanged, setCoverSourceChanged] = useState(false);

  const [showCollectionDropdown, setShowCollectionDropdown] = useState(false);
  const collectionDropdownRef = useRef<HTMLDivElement>(null);
  const galleryDropZoneRef = useRef<HTMLDivElement>(null);
  const attachmentDropZoneRef = useRef<HTMLDivElement>(null);
  const [showTemplateMenu, setShowTemplateMenu] = useState(false);
  const templateMenuRef = useRef<HTMLDivElement>(null);
  const reviewEditorRef = useRef<GravityMarkdownEditorHandle>(null);

  const [form, setForm] = useState<MediaFormState>({
    title: '',
    collectionId: mediaCreateCollectionId,
    creator: '',
    releaseDate: '',
    experienceDate: '',
    synopsis: '',
    progressCurrent: 0,
    progressTotal: null,
    progressStatus: 'NOT_STARTED',
    replayCount: 0,
    experienceDates: [],
    userRating: null,
    userReview: '',
    positivePoints: '',
    negativePoints: '',
    mediaStatus: 'UPCOMING',
    genres: [],
    genreInput: '',
    images: [],
    attachments: [],
    coverCrop: null,
    credits: [],
  });

  const [showCoverCrop, setShowCoverCrop] = useState(false);
  // Track which image index is used as cover source (independent of drag order)
  const [coverImageIndex, setCoverImageIndex] = useState(0);
  // In edit mode, store the existing cropped cover URL to display instead of full image
  const [editCoverUrl, setEditCoverUrl] = useState<string | null>(null);

  const [currentInputVal, setCurrentInputVal] = useState<string>('0');
  const [totalInputVal, setTotalInputVal] = useState<string>('');

  useEffect(() => {
    const cleanStr = currentInputVal.trim().replace(',', '.');
    if (cleanStr === '' && form.progressCurrent === 0) return;
    const numericVal = parseFloat(cleanStr);
    if (isNaN(numericVal) || numericVal !== form.progressCurrent) {
      setCurrentInputVal(form.progressCurrent.toString());
    }
  }, [form.progressCurrent]);

  useEffect(() => {
    const cleanStr = totalInputVal.trim().replace(',', '.');
    const formVal = form.progressTotal;
    if (formVal === null) {
      if (totalInputVal !== '') setTotalInputVal('');
    } else {
      const numericVal = parseFloat(cleanStr);
      if (isNaN(numericVal) || numericVal !== formVal) {
        setTotalInputVal(formVal.toString());
      }
    }
  }, [form.progressTotal]);

  // Track dropped file paths for native drag-drop (optimized path - no base64 round-trip)
  const droppedFilePathsRef = useRef<string[]>([]);
  const attachmentFilePathsRef = useRef<string[]>([]);

  // Helper to convert File to base64 efficiently
  const toBase64 = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        resolve(result.split(',')[1]); // strip "data:image/...;base64,"
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

  // Edit mode: pre-fill form when existing media data is loaded
  useEffect(() => {
    if (!isEditMode || !existingMedia || editFormLoaded) return;
    const m = existingMedia;
    let parsedDates: string[] = [];
    try { if (m.experience_dates) parsedDates = JSON.parse(m.experience_dates); } catch { /* ignore */ }
    const existingImages: GalleryImage[] = m.images.map((img) => ({
      id: `existing-${img.id}`,
      file: null,
      preview: convertFileSrc(img.full_path),
      isExisting: true,
      serverImageId: img.id,
    }));
    const existingAttachments: AttachedFile[] = (m.attachments || []).map((attachment: MediaAttachment) => ({
      id: `existing-attachment-${attachment.id}`,
      name: attachment.original_name,
      size: attachment.size_bytes,
      path: attachment.stored_path,
      isExisting: true,
      serverAttachmentId: attachment.id,
    }));
    setForm({
      title: m.title,
      collectionId: m.collection_id,
      creator: m.creator || '',
      releaseDate: m.release_date || '',
      experienceDate: m.experience_date || '',
      synopsis: m.synopsis || '',
      progressCurrent: m.progress_current ?? 0,
      progressTotal: m.progress_total ?? null,
      progressStatus: m.progress_status ?? 'NOT_STARTED',
      replayCount: m.replay_count ?? 0,
      experienceDates: parsedDates,
      userRating: m.user_rating ?? null,
      userReview: m.user_review || '',
      positivePoints: m.positive_points || '',
      negativePoints: m.negative_points || '',
      mediaStatus: m.media_status || 'UPCOMING',
      genres: m.genres || [],
      genreInput: '',
      images: existingImages,
      attachments: existingAttachments,
      coverCrop: null,
      credits: m.credits || [],
    });
    // Store cropped cover URL if it exists
    if (m.cover_image) {
      setEditCoverUrl(convertFileSrc(m.cover_image));
    }
    // Restore which image is the cover source
    setCoverImageIndex(m.cover_source_index ?? 0);
    setEditFormLoaded(true);
  }, [isEditMode, existingMedia, editFormLoaded]);

  // Close collection dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (collectionDropdownRef.current && !collectionDropdownRef.current.contains(e.target as Node)) {
        setShowCollectionDropdown(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Close template menu on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (templateMenuRef.current && !templateMenuRef.current.contains(e.target as Node)) {
        setShowTemplateMenu(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Track if form has been modified (for confirm dialog)
  const formDirtyRef = useRef(false);
  const initialFormSnapshotRef = useRef<string | null>(null);

  // Serialize form for comparison (exclude transient fields)
  const serializeForm = useCallback((f: MediaFormState) => {
    return JSON.stringify({
      title: f.title, collectionId: f.collectionId, creator: f.creator,
      releaseDate: f.releaseDate, experienceDate: f.experienceDate,
      synopsis: f.synopsis, progressCurrent: f.progressCurrent,
      progressTotal: f.progressTotal, progressStatus: f.progressStatus,
      replayCount: f.replayCount, experienceDates: f.experienceDates,
      userRating: f.userRating, userReview: f.userReview,
      positivePoints: f.positivePoints, negativePoints: f.negativePoints,
      mediaStatus: f.mediaStatus,
      genres: f.genres.map(g => g.id).sort(), imageCount: f.images.length,
      attachmentCount: f.attachments.length,
      coverCrop: f.coverCrop,
      credits: f.credits.map(c => ({ person_id: c.person_id, role: c.role })),
    });
  }, []);

  // Snapshot initial form after edit-mode load or on first render for create
  useEffect(() => {
    if (isEditMode && !editFormLoaded) return; // wait for edit data
    if (initialFormSnapshotRef.current === null) {
      initialFormSnapshotRef.current = serializeForm(form);
    }
  }, [editFormLoaded, isEditMode, form, serializeForm]);

  // Detect actual changes by comparing to snapshot
  useEffect(() => {
    if (initialFormSnapshotRef.current === null) return;
    formDirtyRef.current = serializeForm(form) !== initialFormSnapshotRef.current;
  }, [form, serializeForm]);

  // Compute which fields changed, grouped by section with colors
  const getChangedFieldGroups = useCallback((): { section: string; color: string; fields: string[] }[] => {
    if (!initialFormSnapshotRef.current) return [];
    try {
      const initial = JSON.parse(initialFormSnapshotRef.current);
      const current = JSON.parse(serializeForm(form));
      const diff = (key: string) => JSON.stringify(initial[key]) !== JSON.stringify(current[key]);

      const infoFields: string[] = [];
      if (diff('title')) infoFields.push(i18next.t('mediaDetail.title'));
      if (diff('collectionId')) infoFields.push(i18next.t('mediaDetail.collection'));
      if (diff('creator')) infoFields.push(i18next.t('common.creator'));
      if (diff('releaseDate')) infoFields.push(i18next.t('media.releaseDate'));
      if (diff('synopsis')) infoFields.push(i18next.t('mediaDetail.synopsis'));
      if (diff('durationInfo')) infoFields.push(i18next.t('mediaDetail.duration'));
      if (diff('mediaStatus')) infoFields.push(i18next.t('mediaDetail.mediaStatus'));
      if (diff('coverCrop')) infoFields.push(i18next.t('mediaDetail.cover'));

      const progressFields: string[] = [];
      if (diff('progressStatus') || diff('progressCurrent')) progressFields.push(i18next.t('common.progress'));
      if (diff('progressTotal')) progressFields.push(i18next.t('mediaDetail.progressTotal'));
      if (diff('experienceDate')) progressFields.push(i18next.t('media.experienceDate'));
      if (diff('replayCount')) progressFields.push(i18next.t('mediaDetail.replays'));
      if (diff('experienceDates')) progressFields.push(i18next.t('mediaDetail.replayDates'));

      const ratingFields: string[] = [];
      if (diff('userRating')) ratingFields.push(i18next.t('mediaCreate.rating'));
      if (diff('userReview')) ratingFields.push(i18next.t('mediaCreate.review'));
      if (diff('positivePoints')) ratingFields.push(i18next.t('mediaDetail.positivePoints'));
      if (diff('negativePoints')) ratingFields.push(i18next.t('mediaDetail.negativePoints'));

      const otherFields: string[] = [];
      if (diff('genres')) otherFields.push(i18next.t('mediaDetail.genres'));
      if (initial.imageCount !== current.imageCount) otherFields.push(i18next.t('mediaDetail.images'));
      if (initial.attachmentCount !== current.attachmentCount) otherFields.push(i18next.t('common.attachments'));

      const groups: { section: string; color: string; fields: string[] }[] = [];
      if (infoFields.length) groups.push({ section: i18next.t('mediaCreate.infoGroup'), color: '#3b82f6', fields: infoFields });
      if (progressFields.length) groups.push({ section: i18next.t('common.progression'), color: '#f59e0b', fields: progressFields });
      if (ratingFields.length) groups.push({ section: i18next.t('mediaCreate.ratingAndReview'), color: '#ec4899', fields: ratingFields });
      if (otherFields.length) groups.push({ section: i18next.t('mediaCreate.others'), color: '#8b5cf6', fields: otherFields });
      return groups;
    } catch { return []; }
  }, [form, serializeForm]);

  // Navigation guard: intercept all navigation when form is dirty
  useEffect(() => {
    setBeforeNavigate(() => {
      if (!formDirtyRef.current) return true;
      setShowLeaveDialog(true);
      return false;
    });
    return () => setBeforeNavigate(null);
  }, [setBeforeNavigate]);

  // Ctrl+V paste handler for images
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      // Ignore if focus is on an input/textarea to avoid interfering with text paste
      const active = document.activeElement;
      if (active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement) return;

      const items = e.clipboardData?.items;
      if (!items) return;

      const imageFiles: File[] = [];
      for (const item of Array.from(items)) {
        if (item.type.startsWith('image/')) {
          const file = item.getAsFile();
          if (file) imageFiles.push(file);
        }
      }

      if (imageFiles.length === 0) return;

      // Respect the limit
      const remainingSlots = MAX_IMAGES_PER_MEDIA - form.images.length;
      if (remainingSlots <= 0) return;
      const limitedFiles = imageFiles.slice(0, remainingSlots);

      // Reuse existing image upload logic
      const newImages: GalleryImage[] = limitedFiles.map((file) => ({
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        file,
        preview: URL.createObjectURL(file),
      }));
      setForm((prev) => ({ ...prev, images: [...prev.images, ...newImages] }));
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [form.images.length]);

  const selectedCollection = useMemo(
    () => collections?.find((c) => c.id === form.collectionId) ?? null,
    [collections, form.collectionId]
  );

  const creatorLabel = selectedCollection?.creator_label || 'Creator';
  const dateLabel = selectedCollection?.date_label || 'Experience date';

  const [creatorSuggestions, setCreatorSuggestions] = useState<string[]>([]);
  const [collectionGenres, setCollectionGenres] = useState<Genre[]>([]);
  const { data: people = [] } = usePeople();

  const refreshPeople = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: ['people'] });
  }, [queryClient]);

  useEffect(() => {
    if (!form.collectionId) return;
    tauriApi.media.getByCollection({ collectionId: form.collectionId })
      .then((media) => {
        const rawCreators = media.flatMap((m) => m.creator ? m.creator.split(';') : []).map(c => c.trim()).filter(Boolean);
        const uniqueMap = new Map<string, string>();
        rawCreators.forEach(c => {
          const lower = c.toLowerCase();
          if (!uniqueMap.has(lower)) {
            uniqueMap.set(lower, c);
          }
        });
        const creators = Array.from(uniqueMap.values());
        setCreatorSuggestions(creators);
        const genreMap = new Map<number, Genre>();
        media.forEach((m) => {
          m.genres?.forEach((g) => { if (!genreMap.has(g.id)) genreMap.set(g.id, g); });
        });
        setCollectionGenres(Array.from(genreMap.values()));
      })
      .catch(() => { });
  }, [form.collectionId]);

  const updateField = useCallback(<K extends keyof MediaFormState>(key: K, value: MediaFormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  }, []);

  const handleStatusChange = (option: ProgressStatusOption) => {
    setForm((prev) => ({ ...prev, progressStatus: option.value }));
  };

  const handleFilePicker = useCallback(async () => {
    if (form.images.length >= MAX_IMAGES_PER_MEDIA) return;
    const selected = await openFileDialog({
      multiple: true,
      filters: [{ name: i18next.t('mediaDetail.images'), extensions: ['jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp'] }],
    });
    if (!selected) return;
    let paths = Array.isArray(selected) ? selected : [selected];
    if (paths.length === 0) return;
    // Respect the limit
    const remainingSlots = MAX_IMAGES_PER_MEDIA - form.images.length;
    paths = paths.slice(0, remainingSlots);

    droppedFilePathsRef.current = [...droppedFilePathsRef.current, ...paths];
    const newImages: GalleryImage[] = paths.map((filePath) => ({
      id: `drop-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      file: null,
      preview: convertFileSrc(filePath),
      isExisting: false,
      filePath,
    }));
    setForm((prev) => ({ ...prev, images: [...prev.images, ...newImages] }));
  }, [form.images.length]);

  const handleAttachmentPicker = useCallback(async () => {
    const selected = await openFileDialog({ multiple: true });
    if (!selected) return;
    const paths = Array.isArray(selected) ? selected : [selected];
    if (paths.length === 0) return;

    attachmentFilePathsRef.current = [...attachmentFilePathsRef.current, ...paths];
    const sizes = await Promise.all(paths.map(async (p) => {
      try { return (await stat(p)).size; } catch { return 0; }
    }));
    const newAttachments: AttachedFile[] = paths.map((filePath, i) => ({
      id: `attachment-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      name: filePath.split(/[\\/]/).pop() || 'fichier',
      size: sizes[i],
      path: filePath,
      isExisting: false,
    }));
    setForm((prev) => ({ ...prev, attachments: [...prev.attachments, ...newAttachments] }));
  }, []);

  const handleRemoveAttachment = (id: string) => {
    const removed = form.attachments.find((attachment) => attachment.id === id);
    if (removed?.isExisting && removed.serverAttachmentId) {
      setDeletedAttachmentIds((prev) => [...prev, removed.serverAttachmentId!]);
    } else if (removed?.path) {
      attachmentFilePathsRef.current = attachmentFilePathsRef.current.filter((path) => path !== removed.path);
    }
    setForm((prev) => ({ ...prev, attachments: prev.attachments.filter((attachment) => attachment.id !== id) }));
  };

  const handleRemoveImage = async (id: string) => {
    const removedIdx = form.images.findIndex((i) => i.id === id);
    const removedImg = form.images.find((i) => i.id === id);
    // Track server image for deletion on save
    if (removedImg?.isExisting && removedImg.serverImageId) {
      setDeletedImageIds((prev) => [...prev, removedImg.serverImageId!]);
    }
    // If it's a dropped image, remove its path from the ref
    if (id.startsWith('drop-')) {
      const dropIndex = form.images
        .filter(img => img.id.startsWith('drop-'))
        .findIndex(img => img.id === id);
      if (dropIndex !== -1) {
        droppedFilePathsRef.current = droppedFilePathsRef.current.filter((_, i) => i !== dropIndex);
      }
    }

    // Check if this is the last image being removed
    const isLastImage = form.images.length === 1;

    setForm((prev) => {
      const img = prev.images.find((i) => i.id === id);
      if (img) URL.revokeObjectURL(img.preview);
      return { ...prev, images: prev.images.filter((i) => i.id !== id) };
    });

    // Adjust coverImageIndex if needed
    if (removedIdx === coverImageIndex) {
      setCoverImageIndex(0);
      updateField('coverCrop', null);
      setEditCoverUrl(null);
      setCoverSourceChanged(true);
    } else if (removedIdx < coverImageIndex) {
      setCoverImageIndex((prev) => Math.max(0, prev - 1));
    }

    // If this was the last image and we're in edit mode, clear the cover
    if (isLastImage && isEditMode && editingMediaId) {
      try {
        await tauriApi.media.clearCover(editingMediaId);
        setEditCoverUrl(null);
      } catch (err) {
        console.error('Failed to clear cover:', err);
      }
    }
  };

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = form.images.findIndex((i) => i.id === active.id);
    const newIndex = form.images.findIndex((i) => i.id === over.id);

    // Track the cover image across the reorder
    const newCoverIndex = (() => {
      const prev = coverImageIndex;
      if (prev === oldIndex) return newIndex;
      if (oldIndex < prev && newIndex >= prev) return prev - 1;
      if (oldIndex > prev && newIndex <= prev) return prev + 1;
      return prev;
    })();
    setCoverImageIndex(newCoverIndex);

    // Reorder images in state
    const newImages = arrayMove(form.images, oldIndex, newIndex);
    setForm((prev) => ({ ...prev, images: newImages }));

    // Persist new positions to DB for existing server images
    const existingImages = newImages
      .map((img, index) => ({ img, index }))
      .filter(({ img }) => img.isExisting && img.serverImageId);

    if (existingImages.length > 0 && isEditMode && editingMediaId) {
      try {
        const updates = existingImages.map(({ img, index }) => [img.serverImageId!, index] as [number, number]);
        await tauriApi.media.updateImagePositions(updates);
      } catch (err) {
        console.error('Failed to update image positions:', err);
      }
    }
  };

  const [isDragOver, setIsDragOver] = useState(false);
  const [isAttachmentDragOver, setIsAttachmentDragOver] = useState(false);

  // Tauri native file drop listener — activates when pointer is over gallery or attachment zone
  const isOverGalleryRef = useRef(false);
  const isOverAttachmentRef = useRef(false);
  useEffect(() => {
    let unlisten: (() => void) | undefined;
    const setupListener = async () => {
      try {
        const appWindow = getCurrentWindow();
        unlisten = await appWindow.onDragDropEvent((event) => {
          if (event.payload.type === 'over') {
            const { x, y } = event.payload.position || { x: 0, y: 0 };
            // Check gallery zone
            const galleryZone = galleryDropZoneRef.current;
            if (galleryZone) {
              const rect = galleryZone.getBoundingClientRect();
              isOverGalleryRef.current = x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
            }
            // Check attachment zone
            const attachmentZone = attachmentDropZoneRef.current;
            if (attachmentZone) {
              const rect = attachmentZone.getBoundingClientRect();
              isOverAttachmentRef.current = x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
            }
            setIsDragOver(isOverGalleryRef.current);
            setIsAttachmentDragOver(isOverAttachmentRef.current);
          } else if (event.payload.type === 'drop') {
            setIsDragOver(false);
            setIsAttachmentDragOver(false);
            const paths = event.payload.paths;
            if (paths && paths.length > 0) {
              if (isOverAttachmentRef.current) {
                // Drop on attachment zone — all files become attachments
                isOverAttachmentRef.current = false;
                attachmentFilePathsRef.current = [...attachmentFilePathsRef.current, ...paths];
                (async () => {
                  const sizes = await Promise.all(paths.map(async (p: string) => {
                    try { return (await stat(p)).size; } catch { return 0; }
                  }));
                  const newAttachments: AttachedFile[] = paths.map((filePath: string, i: number) => ({
                    id: `attachment-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
                    name: filePath.split(/[\\/]/).pop() || 'fichier',
                    size: sizes[i],
                    path: filePath,
                    isExisting: false,
                  }));
                  setForm((prev) => ({ ...prev, attachments: [...prev.attachments, ...newAttachments] }));
                })();
              } else if (isOverGalleryRef.current) {
                // Drop on gallery zone — only image files are added
                isOverGalleryRef.current = false;
                const imageExts = ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.bmp'];
                const imagePaths = paths.filter((p: string) => imageExts.some((ext) => p.toLowerCase().endsWith(ext)));
                if (imagePaths.length > 0) {
                  // Store the paths for later upload (optimized path - no base64 round-trip)
                  droppedFilePathsRef.current = [...droppedFilePathsRef.current, ...imagePaths];

                  // Create preview images from file paths using convertFileSrc
                  const newImages: GalleryImage[] = imagePaths.map((filePath: string) => ({
                    id: `drop-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
                    file: null, // Will be uploaded via uploadImagesFromPaths
                    preview: convertFileSrc(filePath),
                    isExisting: false,
                    filePath,
                  }));
                  setForm((prev) => ({ ...prev, images: [...prev.images, ...newImages] }));
                }
              }
            }
          } else if (event.payload.type === 'leave') {
            setIsDragOver(false);
            setIsAttachmentDragOver(false);
            isOverGalleryRef.current = false;
            isOverAttachmentRef.current = false;
          }
        });
      } catch (err) {
        console.error('Failed to setup drag-drop listener:', err);
      }
    };
    setupListener();
    return () => { unlisten?.(); };
  }, []);

  const handleSubmit = async () => {
    if (isSubmitting) return;

    // Validate required fields
    const errors: string[] = [];
    if (!form.title.trim()) errors.push('title');
    if (!isEditMode && !form.collectionId) errors.push('collection');
    if (errors.length > 0) {
      setValidationErrors(errors);
      return;
    }
    setValidationErrors([]);
    setIsSubmitting(true);

    let targetMediaId: number | null = null;
    try {
      const primaryGenres = form.genres.filter(g => g.position === undefined || g.position === null || g.position < 9);
      const secondaryGenres = form.genres.filter(g => g.position !== undefined && g.position !== null && g.position >= 9);

      const sortedPrimary = [...primaryGenres].sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
      const sortedSecondary = [...secondaryGenres].sort((a, b) => (a.position ?? 9) - (b.position ?? 9));

      const genre_ids: number[] = [];
      for (let i = 0; i < 9; i++) {
        if (i < sortedPrimary.length) {
          genre_ids.push(sortedPrimary[i].id);
        } else {
          genre_ids.push(-1);
        }
      }
      sortedSecondary.forEach(g => genre_ids.push(g.id));

      const creditsInput = form.credits.map((c, idx) => ({
        person_id: c.person_id,
        role: c.role || null,
        position: idx,
      }));

      if (isEditMode && editingMediaId) {
        // UPDATE existing media
        await updateMutation.mutateAsync({
          media_id: editingMediaId,
          collection_id: form.collectionId!,
          title: form.title.trim(),
          creator: form.creator.trim() || undefined,
          release_date: form.releaseDate || undefined,
          experience_date: form.experienceDate || '',
          synopsis: form.synopsis.trim(),
          user_rating: form.userRating ?? undefined,
          user_review: form.userReview.trim(),
          positive_points: form.positivePoints.trim(),
          negative_points: form.negativePoints.trim(),
          media_status: form.mediaStatus || 'UPCOMING',
          progress_current: form.progressCurrent !== undefined ? form.progressCurrent : undefined,
          progress_total: form.progressTotal ?? undefined,
          progress_status: form.progressStatus || undefined,
          replay_count: form.replayCount ?? 0,
          experience_dates: form.experienceDates.filter(d => d).length > 0 ? JSON.stringify(form.experienceDates.filter(d => d)) : '',
          genre_ids,
          credits: creditsInput,
        });
        targetMediaId = editingMediaId;
      } else {
        // CREATE new media
        const newId = await createMutation.mutateAsync({
          collection_id: form.collectionId!,
          title: form.title.trim(),
          creator: form.creator.trim() || undefined,
          release_date: form.releaseDate || undefined,
          experience_date: form.experienceDate || undefined,
          synopsis: form.synopsis.trim() || undefined,
          user_rating: form.userRating ?? undefined,
          user_review: form.userReview.trim() || undefined,
          positive_points: form.positivePoints.trim() || undefined,
          negative_points: form.negativePoints.trim() || undefined,
          media_status: form.mediaStatus || 'UPCOMING',
          progress_current: form.progressCurrent !== undefined ? form.progressCurrent : undefined,
          progress_total: form.progressTotal ?? undefined,
          progress_status: form.progressStatus || undefined,
          replay_count: form.replayCount ?? 0,
          experience_dates: form.experienceDates.length > 0 ? JSON.stringify(form.experienceDates) : undefined,
          genre_ids,
          credits: creditsInput,
        });
        targetMediaId = newId;
      }

      // Delete removed existing server images
      if (deletedImageIds.length > 0) {
        for (const imgId of deletedImageIds) {
          try {
            await tauriApi.media.deleteImage(imgId);
          } catch (delErr) {
            console.error(`Failed to delete image ${imgId}:`, delErr);
          }
        }
      }

      // Shift remaining existing images to match their visual positions in the form.
      // This prevents UNIQUE constraint violations when uploading new images.
      const existingImages = form.images
        .map((img, index) => ({ img, index }))
        .filter(({ img }) => img.isExisting && img.serverImageId);

      if (existingImages.length > 0 && isEditMode && targetMediaId) {
        try {
          const updates = existingImages.map(({ img, index }) => [img.serverImageId!, index] as [number, number]);
          await tauriApi.media.updateImagePositions(updates);
        } catch (err) {
          console.error('Failed to update image positions on save:', err);
        }
      }

      // Track the final list of images with their database IDs to run a final reorder
      const finalImagesList: { serverImageId: number; index: number }[] = [];
      existingImages.forEach(({ img, index }) => {
        finalImagesList.push({ serverImageId: img.serverImageId!, index });
      });

      if (deletedAttachmentIds.length > 0) {
        for (const attachmentId of deletedAttachmentIds) {
          try {
            await tauriApi.media.deleteAttachment(attachmentId);
          } catch (delErr) {
            console.error(`Failed to delete attachment ${attachmentId}:`, delErr);
          }
        }
      }

      const attachmentPaths = attachmentFilePathsRef.current;
      if (attachmentPaths.length > 0) {
        try {
          await tauriApi.media.uploadAttachmentsFromPaths(targetMediaId!, attachmentPaths);
          attachmentFilePathsRef.current = [];
        } catch (attachmentErr) {
          console.error('Failed to upload attachments:', attachmentErr);
          setErrorToast(i18next.t('mediaCreate.attachmentUploadFailed'));
          setIsSubmitting(false);
          if (!isEditMode && targetMediaId) {
            try {
              await tauriApi.media.delete(targetMediaId);
            } catch (cleanupErr) {
              console.error('Failed to cleanup created media:', cleanupErr);
            }
          }
          return;
        }
      }

      // Upload dropped images via optimized path (uploadImagesFromPaths)
      const droppedImages = form.images.filter((img) => !img.isExisting && img.id.startsWith('drop-'));
      const droppedPaths = droppedImages.map((img) => img.filePath).filter((p): p is string => !!p);
      droppedFilePathsRef.current = []; // Clear dropped paths ref after reading

      // Calcul du total global : images + 1 étape cover si elle sera générée
      const pastedImagesPrecount = form.images.filter((img) => !img.isExisting && img.file).length;
      const willGenerateCover = form.images.length > 0 && (
        form.coverCrop !== null || coverSourceChanged || !isEditMode || editCoverUrl === null
      );
      const globalTotal = droppedPaths.length + pastedImagesPrecount + (willGenerateCover ? 1 : 0);

      if (droppedPaths.length > 0) {
        setIsProcessingImages(true);
        setUploadProgress({ current: 0, total: globalTotal, fileName: '', stage: 'reading', percent: 0 });

        const failedImages: string[] = [];
        const startPosition = 100; // Use a temporary high range to avoid UNIQUE constraint violations

        try {
          const results = await tauriApi.media.uploadImagesFromPaths(
            targetMediaId!,
            droppedPaths,
            (progress) => {
              setUploadProgress({
                current: progress.file_index + 1,
                total: globalTotal,
                fileName: progress.file_name,
                stage: progress.stage,
                percent: progress.percent,
              });
            },
            startPosition
          );

          // results is an array of { imageId: number, path: string } in the order of droppedPaths.
          // Map these results back to the dropped images to get their database imageId.
          if (results.length === droppedImages.length) {
            results.forEach((res, i) => {
              const originalImg = droppedImages[i];
              const originalIndex = form.images.findIndex((img) => img.id === originalImg.id);
              if (originalIndex !== -1) {
                finalImagesList.push({ serverImageId: res.imageId, index: originalIndex });
              }
            });
          } else {
            results.forEach((res, i) => {
              const originalImg = droppedImages[i] || droppedImages[droppedImages.length - 1];
              const originalIndex = form.images.findIndex((img) => img.id === originalImg.id);
              if (originalIndex !== -1) {
                finalImagesList.push({ serverImageId: res.imageId, index: originalIndex });
              }
            });
          }
        } catch (err) {
          console.error('Failed to upload dropped images:', err);
          failedImages.push(...droppedPaths.map(p => p.split(/[\\/]/).pop() || 'image'));
        }

        setIsProcessingImages(false);
        setUploadProgress(null);

        if (failedImages.length > 0) {
          // Show error toast and abort navigation
          setErrorToast(t('mediaCreate.imagesUploadFailed', { count: failedImages.length, names: failedImages.join(', ') }));
          setIsSubmitting(false);
          if (!isEditMode && targetMediaId) {
            try {
              await tauriApi.media.delete(targetMediaId);
            } catch (cleanupErr) {
              console.error('Failed to cleanup created media:', cleanupErr);
            }
          }
          return;
        }
      }

      // --- Upload images Ctrl+V (base64, cas marginal) — avec progress synthétique ---
      const pastedImages = form.images.filter((img) => !img.isExisting && img.file);
      if (pastedImages.length > 0) {
        setIsProcessingImages(true);
        const startPosition = 200; // Use a temporary high range to avoid conflicts
        const pasteOffset = droppedPaths.length; // offset dans le compteur global
        const failedImages: string[] = [];

        for (let i = 0; i < pastedImages.length; i++) {
          const img = pastedImages[i];
          const globalCurrent = pasteOffset + i + 1;

          setUploadProgress({
            current: globalCurrent,
            total: globalTotal,
            fileName: img.file!.name || `image_${i + 1}.png`,
            stage: 'reading',
            percent: 20,
          });

          try {
            const base64 = await toBase64(img.file!);

            setUploadProgress({
              current: globalCurrent,
              total: globalTotal,
              fileName: img.file!.name || `image_${i + 1}.png`,
              stage: 'processing',
              percent: 60,
            });

            const newImageId = await tauriApi.media.uploadImage(
              targetMediaId!, base64,
              img.file!.name || `paste_${i}.png`,
              startPosition + i,
            );

            // Find the index of this image in form.images
            const originalIndex = form.images.findIndex((item) => item.id === img.id);
            if (originalIndex !== -1) {
              finalImagesList.push({ serverImageId: newImageId, index: originalIndex });
            }

            setUploadProgress({
              current: globalCurrent,
              total: globalTotal,
              fileName: img.file!.name || `image_${i + 1}.png`,
              stage: 'done',
              percent: 100,
            });
          } catch (imgErr) {
            console.error(`Failed to upload pasted image ${i}:`, imgErr);
            failedImages.push(img.file!.name || `image_${i + 1}`);
          }
        }

        setIsProcessingImages(false);
        setUploadProgress(null);

        if (failedImages.length > 0) {
          setErrorToast(t('mediaCreate.pastedImagesUploadFailed', { count: failedImages.length, names: failedImages.join(', ') }));
          setIsSubmitting(false);
          if (!isEditMode && targetMediaId) {
            try {
              await tauriApi.media.delete(targetMediaId);
            } catch (cleanupErr) {
              console.error('Failed to cleanup created media:', cleanupErr);
            }
          }
          return;
        }
      }

      // Finally, reorder all images in the database to match their final visual order (0, 1, 2, ...)
      if (finalImagesList.length > 0) {
        try {
          const updates = finalImagesList.map(({ serverImageId, index }) => [serverImageId, index] as [number, number]);
          await tauriApi.media.updateImagePositions(updates);
        } catch (err) {
          console.error('Failed to update final image positions:', err);
        }
      }

      // Generate cover if:
      // - explicit crop by user
      // - cover source changed (cover image changed)
      // - creation (never has cover)
      // - edit without existing cover (media with no images until now)
      const shouldGenerateCover = form.images.length > 0 && (
        form.coverCrop !== null ||
        coverSourceChanged ||
        !isEditMode ||
        editCoverUrl === null
      );
      if (shouldGenerateCover) {
        setIsProcessingImages(true);
        const coverStep = globalTotal; // always the last step
        setUploadProgress({
          current: coverStep,
          total: globalTotal,
          fileName: 'Cover',
          stage: 'processing',
          percent: 50,
        });

        try {
          const crop = form.coverCrop ?? { x: 0, y: 0, zoom: 1 };
          await tauriApi.media.setCover(
            targetMediaId!,
            crop.x,
            crop.y,
            crop.zoom,
            coverImageIndex,
          );
          setUploadProgress({
            current: coverStep,
            total: globalTotal,
            fileName: 'Cover',
            stage: 'done',
            percent: 100,
          });
          // Keep "Done" toast visible for 400ms
          await new Promise(r => setTimeout(r, 400));
        } catch (coverErr) {
          console.error('Failed to set cover:', coverErr);
        }

        setIsProcessingImages(false);
        setUploadProgress(null);
      }

      // Invalidate queries so other pages see fresh data
      // Mettre à jour uniquement l'entrée concernée dans le cache pour que le cache-buster change immédiatement
      const now = new Date().toISOString();
      queryClient.setQueriesData({ queryKey: ['media'] }, (old: any) => {
        if (!old) return old;
        // Pour les listes paginées
        if (Array.isArray(old)) {
          return old.map((m: any) =>
            m.id === targetMediaId ? { ...m, updated_at: now } : m
          );
        }
        return old;
      });
      // Invalidate all media queries (covers lists and detail)
      queryClient.invalidateQueries({ queryKey: ['media'] });

      // Clear navigation guard so it doesn't intercept
      setBeforeNavigate(null);
      // Mark form as clean so nav guard doesn't fire, then navigate
      formDirtyRef.current = false;
      navigateToMediaDetail(targetMediaId!);
    } catch (err) {
      console.error(`Failed to ${isEditMode ? 'update' : 'create'} media:`, err);
      if (!isEditMode && targetMediaId) {
        try {
          await tauriApi.media.delete(targetMediaId);
        } catch (cleanupErr) {
          console.error('Failed to cleanup created media:', cleanupErr);
        }
      }
      setIsSubmitting(false);
    }
  };

  const progressionLabel = selectedCollection?.progression_label || 'Episode';
  const pluralWithS = selectedCollection?.plural_with_s ?? false;
  const progressionLabelPlural = pluralWithS ? progressionLabel + 's' : progressionLabel;

  useEffect(() => {
    return () => { form.images.forEach((img) => URL.revokeObjectURL(img.preview)); };
  }, []);

  // Cover image is determined by coverImageIndex, not position
  const coverImage = form.images.length > 0 ? (form.images[coverImageIndex] ?? form.images[0]) : null;

  // Bullet-list textarea handler for positive/negative points
  const handleBulletKeyDown = useCallback((
    e: React.KeyboardEvent<HTMLTextAreaElement>,
    field: 'positivePoints' | 'negativePoints'
  ) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      const ta = e.currentTarget;
      const start = ta.selectionStart;
      const value = form[field];
      const newValue = value.substring(0, start) + '\n• ' + value.substring(ta.selectionEnd);
      updateField(field, newValue);
      setTimeout(() => { ta.selectionStart = ta.selectionEnd = start + 3; }, 0);
    }
  }, [form, updateField]);

  const handleBulletFocus = useCallback((field: 'positivePoints' | 'negativePoints') => {
    if (!form[field]) {
      updateField(field, '• ');
    }
  }, [form, updateField]);


  // Smart increment/decrement and direct input handler for progression
  const handleProgressValuesChange = (updates: { current?: number; total?: number | null }) => {
    setForm((prev) => {
      const newCurrent = updates.current !== undefined ? updates.current : prev.progressCurrent;
      const newTotal = updates.total !== undefined ? updates.total : prev.progressTotal;
      let newStatus = prev.progressStatus;

      const currentChanged = updates.current !== undefined && updates.current !== prev.progressCurrent;
      const totalChanged = updates.total !== undefined && updates.total !== prev.progressTotal;

      if (currentChanged || totalChanged) {
        if (newTotal && newTotal > 0) {
          if (newCurrent >= newTotal) {
            newStatus = 'COMPLETED';
          } else if (newCurrent === 0) {
            newStatus = 'NOT_STARTED';
          } else if (prev.progressStatus === 'NOT_STARTED') {
            newStatus = 'IN_PROGRESS';
          } else if (prev.progressStatus === 'COMPLETED') {
            // Only revert to IN_PROGRESS if they were previously at 100% (or above) and decremented
            const wasAtMax = prev.progressTotal != null && prev.progressCurrent >= prev.progressTotal;
            if (wasAtMax) {
              newStatus = 'IN_PROGRESS';
            }
          } else if (currentChanged && (prev.progressStatus === 'ON_HOLD' || prev.progressStatus === 'ABANDONED')) {
            newStatus = 'IN_PROGRESS';
          }
        } else {
          if (newCurrent === 0) {
            newStatus = 'NOT_STARTED';
          } else if (prev.progressStatus === 'NOT_STARTED' || prev.progressStatus === 'COMPLETED') {
            newStatus = 'IN_PROGRESS';
          } else if (currentChanged && (prev.progressStatus === 'ON_HOLD' || prev.progressStatus === 'ABANDONED')) {
            newStatus = 'IN_PROGRESS';
          }
        }
      }

      return {
        ...prev,
        progressCurrent: newCurrent,
        progressTotal: newTotal,
        progressStatus: newStatus
      };
    });
  };

  /* ================================================================ */
  /*  RENDER — Single page layout                                      */
  /* ================================================================ */
  if (isEditMode && isLoadingMedia) {
    return (
      <AppShell>
        <SharedHeader activePage="library" />
        <MainContent>
          <div className="flex items-center justify-center h-[60vh]">
            <div className="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        </MainContent>
      </AppShell>
    );
  }

  return (
    <AppShell className="select-text">
      <SharedHeader activePage="library" />

      <MainContent>
        {/* Top bar: back + actions */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={goBack}
              className="flex items-center justify-center w-9 h-9 rounded-xl bg-white/5 border border-white/10 text-text-secondary hover:bg-white/10 hover:text-white transition-all cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <h1 className="text-lg font-bold text-white">
              {editingMediaId ? t('mediaCreate.editMedia') : t('mediaCreate.newMedia')}
            </h1>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={goBack}
              disabled={isSubmitting || createMutation.isPending || updateMutation.isPending || isProcessingImages}
              className="px-5 py-2 text-sm text-text-secondary hover:text-white border border-white/10 rounded-xl hover:bg-white/5 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Annuler
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isSubmitting || createMutation.isPending || updateMutation.isPending || isProcessingImages}
              className="flex items-center gap-2 px-5 py-2 bg-primary hover:bg-primary-dark rounded-xl text-sm font-semibold text-white shadow-[0_0_15px_rgba(217,70,239,0.25)] hover:shadow-[0_0_20px_rgba(217,70,239,0.4)] transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting || createMutation.isPending || updateMutation.isPending || isProcessingImages ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              {isProcessingImages || isSubmitting
                ? (editingMediaId ? 'Enregistrement...' : 'Création...')
                : editingMediaId ? 'Enregistrer' : 'Créer'}
            </button>
          </div>
        </div>

        {/* ============================================================ */}
        {/*  Two-column layout                                            */}
        {/* ============================================================ */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6 items-start">

          {/* LEFT COLUMN — Info + Note & Avis (2/3) */}
          <div className="lg:col-span-2 space-y-6">
            <div className="glass-card rounded-2xl p-6 relative z-10">
              <SectionHeader icon={Info} title={t('mediaCreate.generalInfo')} color="#3b82f6" />

              <div className="flex gap-6">
                {/* Cover image area */}
                <div className="shrink-0">
                  <div
                    className="w-[140px] aspect-[2/3] rounded-xl overflow-hidden border border-white/10 bg-white/5 relative group cursor-pointer"
                    onClick={() => { if (coverImage) setShowCoverCrop(true); }}
                  >
                    {coverImage ? (
                      <>
                        <div className="w-full h-full overflow-hidden relative">
                          {/* Show cropped cover from server if available and no new crop set */}
                          {editCoverUrl && !form.coverCrop ? (
                            <img src={editCoverUrl} alt="" className="w-full h-full object-cover select-none pointer-events-none" />
                          ) : (
                            <CoverPreviewImg
                              src={coverImage.preview}
                              cropData={form.coverCrop}
                              containerW={140}
                            />
                          )}
                        </div>
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <span className="text-[10px] font-semibold text-white">{t('mediaCreate.crop')}</span>
                        </div>
                      </>
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center gap-2 text-white/20">
                        <ImageIcon className="w-8 h-8" />
                        <span className="text-[10px] font-medium text-center px-2 leading-tight">{t('mediaCreate.firstImageIsCover')}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Fields */}
                <div className="flex-1 space-y-4 min-w-0">
                  {/* Collection — inline dropdown */}
                  <div ref={collectionDropdownRef} className="relative">
                    <label className="block text-[11px] font-semibold text-white/40 uppercase tracking-wider mb-1.5">{t('common.collection')} <span className="text-red-400">*</span></label>
                    <button
                      type="button"
                      onClick={() => setShowCollectionDropdown(!showCollectionDropdown)}
                      className={`w-full flex items-center gap-2.5 px-3 py-2.5 bg-white/5 border rounded-xl text-sm text-white hover:bg-white/[0.08] hover:border-white/20 transition-all cursor-pointer ${validationErrors.includes('collection') ? 'border-red-500/60 bg-red-500/5' : 'border-white/10'
                        }`}
                    >
                      {selectedCollection ? (
                        <>
                          {(() => {
                            const Icon = getCollectionIconComponent(selectedCollection.name, selectedCollection.icon);
                            return <Icon className="w-4 h-4 shrink-0" style={{ color: selectedCollection.color }} />;
                          })()}
                          <span className="flex-1 text-left">{selectedCollection.name}</span>
                        </>
                      ) : (
                        <span className="flex-1 text-left text-white/30">{t('mediaCreate.chooseCollection')}</span>
                      )}
                      {validationErrors.includes('collection') && (
                        <span className="text-[10px] text-red-400 shrink-0">{t('common.required')}</span>
                      )}
                      <ChevronDown className={`w-3.5 h-3.5 text-white/30 transition-transform ${showCollectionDropdown ? 'rotate-180' : ''}`} />
                    </button>
                    <AnimatePresence>
                      {showCollectionDropdown && (
                        <motion.div
                          initial={{ opacity: 0, y: -4 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -4 }}
                          transition={{ duration: 0.12 }}
                          className="absolute z-50 top-full left-0 right-0 mt-1.5 bg-[#12141f]/98 backdrop-blur-2xl border border-white/10 rounded-xl shadow-2xl py-1.5 max-h-64 overflow-y-auto custom-scrollbar"
                        >
                          {collections && collections.length > 0 ? collections.map((c) => {
                            const Icon = getCollectionIconComponent(c.name, c.icon);
                            const isSelected = form.collectionId === c.id;
                            return (
                              <div key={c.id} className="px-1.5">
                                <button
                                  type="button"
                                  onClick={() => { updateField('collectionId', c.id); setShowCollectionDropdown(false); setValidationErrors((prev) => prev.filter((x) => x !== 'collection')); }}
                                  className={`w-full flex items-center gap-2.5 px-2.5 py-2 text-left rounded-lg transition-all cursor-pointer ${isSelected ? 'bg-primary/10' : 'hover:bg-white/[0.06]'
                                    }`}
                                >
                                  <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: `${c.color}15` }}>
                                    <Icon className="w-3.5 h-3.5" style={{ color: c.color }} />
                                  </div>
                                  <div className="min-w-0 flex-1">
                                    <p className={`text-sm font-semibold truncate ${isSelected ? 'text-primary' : 'text-white'}`}>{c.name}</p>
                                    <p className="text-[10px] text-white/30 truncate">{c.creator_label} · {c.date_label} · {c.progression_label || 'Episode'}</p>
                                  </div>
                                  {isSelected && <CheckCircle2 className="w-3.5 h-3.5 text-primary shrink-0" />}
                                </button>
                              </div>
                            );
                          }) : (
                            <div className="px-3 py-3 text-center text-[11px] text-white/30">{t('mediaCreate.noCollection')}</div>
                          )}
                          <div className="border-t border-white/5 mt-1 pt-1 px-1.5">
                            <button
                              type="button"
                              onClick={() => {
                                setShowCollectionDropdown(false);
                                useNavigationStore.setState({ editingCollectionId: null });
                                forceNavigate('collection-edit' as any);
                              }}
                              className="w-full flex items-center gap-2.5 px-2.5 py-2 text-left rounded-lg hover:bg-white/[0.06] transition-all cursor-pointer"
                            >
                              <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 bg-white/5">
                                <Plus className="w-3.5 h-3.5 text-white/40" />
                              </div>
                              <span className="text-sm text-white/50">{t('library.newCollection')}</span>
                            </button>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  {/* Title + Creator row */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-white/40 uppercase tracking-wider mb-1.5">{t('common.title')} <span className="text-red-400">*</span></label>
                      <input
                        type="text"
                        value={form.title}
                        onChange={(e) => { updateField('title', e.target.value); setValidationErrors((prev) => prev.filter((x) => x !== 'title')); }}
                        placeholder={t('mediaCreate.titlePlaceholder')}
                        maxLength={MEDIA_TITLE_MAX}
                        className={`w-full px-3 py-2.5 bg-white/5 border rounded-xl text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-primary/30 transition-colors ${validationErrors.includes('title') ? 'border-red-500/60 bg-red-500/5' : 'border-white/10'
                          }`}
                      />
                      {validationErrors.includes('title') && (
                        <p className="text-[10px] text-red-400 mt-1">{t('mediaCreate.titleRequired')}</p>
                      )}
                    </div>
                    <CreatorSelector
                      value={form.creator}
                      onChange={(val) => updateField('creator', val)}
                      allSuggestions={creatorSuggestions}
                      label={creatorLabel}
                      placeholder={`${creatorLabel}...`}
                      maxVisible={5}
                    />
                  </div>

                  {/* Media status + Release Date row */}
                  <div className="grid grid-cols-2 gap-3">
                    {/* Media status custom dropdown */}
                    <MediaStatusPicker
                      value={form.mediaStatus}
                      onChange={(val) => updateField('mediaStatus', val)}
                    />
                    <CustomDatePicker
                      value={form.releaseDate}
                      onChange={(val) => updateField('releaseDate', val)}
                      label={t('common.releaseDate')}
                    />
                  </div>

                  {/* Synopsis */}
                  <div>
                    <label className="block text-[11px] font-semibold text-white/40 uppercase tracking-wider mb-1.5">{t('mediaCreate.synopsis')}</label>
                    <div className="rounded-xl overflow-hidden border border-white/10 focus-within:border-primary/30 transition-colors">
                      <GravityMarkdownEditor
                        key={editFormLoaded ? 'loaded' : 'initial'}
                        value={form.synopsis}
                        onChange={(value) => updateField('synopsis', value)}
                      />
                    </div>
                  </div>

                  {/* Duration / Detail info - Display only */}
                  <div>
                    <label className="block text-[11px] font-semibold text-white/40 uppercase tracking-wider mb-1.5">
                      {selectedCollection?.duration_label || 'Total'}
                    </label>
                    <div className="px-3 py-2.5 bg-white/[0.02] border border-white/5 rounded-xl text-sm text-white/60">
                      {(() => {
                        const progressionLabel = selectedCollection?.progression_label || 'Episode';
                        const pluralWithS = selectedCollection?.plural_with_s ?? false;
                        if (form.progressTotal && form.progressTotal > 0) {
                          return formatProgression(form.progressTotal, progressionLabel, pluralWithS);
                        }
                        return '—';
                      })()}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Crédits — LEFT COLUMN (2/3) */}
            <div className="glass-card rounded-2xl p-6 relative z-[2] mb-6">
              <div className="flex items-center gap-2.5 mb-5 pb-3 border-b border-white/5">
                <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ backgroundColor: '#a78bfa20' }}>
                  <Users className="w-3.5 h-3.5" style={{ color: '#a78bfa' }} />
                </div>
                <h2 className="text-base font-bold text-white">{i18next.t('common.credits')}</h2>
              </div>
              <CreditsSelector
                selectedCredits={form.credits}
                allPeople={people}
                onChange={(credits) => updateField('credits', credits)}
                onRefreshPeople={refreshPeople}
              />
            </div>

            {/* Avis — LEFT COLUMN (2/3) */}
            <div className="glass-card rounded-2xl p-6 relative z-[1]">
              <div className="flex items-center justify-between mb-5 pb-3 border-b border-white/5">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ backgroundColor: '#ec489920' }}>
                    <PenLine className="w-3.5 h-3.5" style={{ color: '#ec4899' }} />
                  </div>
                  <h2 className="text-base font-bold text-white">{t('mediaCreate.review')}</h2>
                </div>
                {/* Template picker */}
                <div ref={templateMenuRef} className="relative">
                  <button
                    type="button"
                    onClick={() => setShowTemplateMenu((v) => !v)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 hover:border-white/20 text-[11px] font-semibold text-white/40 hover:text-white/70 transition-all cursor-pointer"
                  >
                    <Zap className="w-3 h-3" />
                    {i18next.t('templateManagement.template_one')}
                    <ChevronDown className={`w-3 h-3 transition-transform ${showTemplateMenu ? 'rotate-180' : ''}`} />
                  </button>
                  {showTemplateMenu && (
                    <div className="absolute z-50 right-0 top-full mt-1.5 bg-[#12141f]/98 backdrop-blur-2xl border border-white/10 rounded-xl shadow-2xl p-1.5 min-w-[190px]">
                      <p className="px-2.5 py-1 text-[10px] font-semibold text-white/25 uppercase tracking-wider">{i18next.t('mediaCreate.insertTemplate')}</p>
                      {reviewTemplates && reviewTemplates.length > 0 ? (
                        reviewTemplates.map((tpl) => {
                          const TemplateIcon = getIconById(tpl.icon);
                          return (
                            <button
                              key={tpl.id}
                              type="button"
                              onClick={() => {
                                const filled = tpl.content.replace('{titre}', form.title || 'Titre');
                                reviewEditorRef.current?.setContent(filled);
                                updateField('userReview', filled);
                                setShowTemplateMenu(false);
                              }}
                              className="w-full text-left flex items-center gap-2.5 px-2.5 py-2 text-xs text-white/60 hover:text-white hover:bg-white/8 rounded-lg transition-colors cursor-pointer"
                            >
                              <TemplateIcon className="w-4 h-4" style={{ color: tpl.color }} />
                              {tpl.name}
                            </button>
                          );
                        })
                      ) : (
                        <p className="px-2.5 py-2 text-xs text-white/30">{i18next.t('mediaCreate.noTemplate')}</p>
                      )}
                    </div>
                  )}
                </div>
              </div>
              <div className="rounded-xl overflow-hidden border border-white/10 focus-within:border-primary/30 transition-colors">
                <GravityMarkdownEditor
                  ref={reviewEditorRef}
                  key={editFormLoaded ? 'loaded' : 'initial'}
                  value={form.userReview}
                  onChange={(value) => updateField('userReview', value)}
                />
              </div>
            </div>

            {/* ============================================================ */}
            {/*  Fichiers joints                                             */}
            {/* ============================================================ */}
            <div
              ref={attachmentDropZoneRef}
              className={`glass-card rounded-2xl p-6 transition-all ${isAttachmentDragOver ? 'ring-2 ring-green-500/50 bg-green-500/[0.03]' : ''}`}
            >
              <div className="flex items-center justify-between mb-5 pb-3 border-b border-white/5">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ backgroundColor: '#22c55e20' }}>
                    <Paperclip className="w-3.5 h-3.5" style={{ color: '#22c55e' }} />
                  </div>
                  <h2 className="text-base font-bold text-white">{i18next.t('common.attachments')}</h2>
                </div>
                <button
                  type="button"
                  onClick={handleAttachmentPicker}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs font-semibold text-white/60 hover:text-white hover:bg-white/10 transition-all cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  {i18next.t('common.add')}
                </button>
              </div>

              {form.attachments.length > 0 ? (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                    {form.attachments.map((attachment) => (
                      <div key={attachment.id} className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.03] border border-white/8">
                        <div className="w-9 h-9 rounded-lg bg-white/5 flex items-center justify-center shrink-0">
                          <FileText className="w-4 h-4 text-white/35" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-white/75 truncate" title={attachment.name}>{attachment.name}</p>
                          {attachment.isExisting && <p className="text-[11px] text-white/25">{formatFileSize(attachment.size)}</p>}
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveAttachment(attachment.id)}
                          className="w-8 h-8 rounded-lg flex items-center justify-center text-white/25 hover:text-red-300 hover:bg-red-500/10 transition-colors cursor-pointer"
                          title={t('common.remove')}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                  {isAttachmentDragOver && (
                    <div className="mt-2.5 min-h-[60px] rounded-xl border-2 border-dashed border-green-500/40 bg-green-500/5 flex flex-col items-center justify-center gap-1.5 transition-all">
                      <Upload className="w-4 h-4 text-green-400" />
                      <span className="text-[11px] text-green-400/80">{t('mediaCreate.dropFilesHere')}</span>
                    </div>
                  )}
                </>
              ) : (
                <button
                  type="button"
                  onClick={handleAttachmentPicker}
                  className={`w-full min-h-[110px] rounded-xl border-2 border-dashed flex flex-col items-center justify-center gap-2 transition-all cursor-pointer ${isAttachmentDragOver ? 'border-green-500/50 bg-green-500/10' : 'border-white/10 bg-white/[0.02] hover:border-white/25 hover:bg-white/5'}`}
                >
                  <Paperclip className={`w-5 h-5 ${isAttachmentDragOver ? 'text-green-400' : 'text-white/25'}`} />
                  <span className={`text-xs ${isAttachmentDragOver ? 'text-green-400/80' : 'text-white/35'}`}>
                    {isAttachmentDragOver ? 'Déposer les fichiers ici' : 'Glisser des fichiers ici ou cliquer pour parcourir — sauvegardes, configurations, ebooks, archives...'}
                  </span>
                </button>
              )}
            </div>
          </div>{/* end left column */}

          {/* RIGHT COLUMN — Genres + Progression + Notes and points (1/3) */}
          <div className="space-y-6">
            {/* Genres card - MOVED TO TOP */}
            <div className="glass-card rounded-2xl p-6 relative z-30">
              <div className="flex items-center justify-between mb-5 pb-3 border-b border-white/5">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ backgroundColor: '#8b5cf620' }}>
                    <Tag className="w-3.5 h-3.5" style={{ color: '#8b5cf6' }} />
                  </div>
                  <h2 className="text-base font-bold text-white">{i18next.t('common.genres')}</h2>
                </div>
                <span className="text-[11px] font-semibold text-white/30 tabular-nums">{form.genres.length}/{MAX_GENRES_PER_MEDIA}</span>
              </div>
              <GenreSelector
                selectedGenres={form.genres}
                onAdd={(genre) => {
                  const primaryCount = form.genres.filter(g => g.position == null || g.position < 9).length;
                  const secondaryCount = form.genres.filter(g => g.position != null && g.position >= 9).length;

                  let position: number;
                  if (primaryCount < 9) {
                    position = primaryCount;        // slots 0–8
                  } else if (secondaryCount < 6) {
                    position = 9 + secondaryCount;  // slots 9–14
                  } else {
                    return; // guard (UI already blocks at MAX_GENRES_PER_MEDIA)
                  }

                  updateField('genres', [...form.genres, { ...genre, position }]);
                }}
                onRemove={(id) => updateField('genres', form.genres.filter((g) => g.id !== id))}
                onReorder={(newOrder) => updateField('genres', newOrder)}
                collectionId={form.collectionId}
                collectionGenres={collectionGenres}
              />
            </div>

            {/* Progress card */}
            <div className="glass-card rounded-2xl p-6 relative z-20">
              <SectionHeader icon={Zap} title={i18next.t('mediaCreate.progress')} color="#f59e0b" />

              {/* Status picker */}
              <ProgressStatusPicker
                progressStatus={form.progressStatus}
                onSelect={handleStatusChange}
              />

              {/* ── Progression inputs ── */}
              {(() => {
                const hasTotal = form.progressTotal != null && form.progressTotal > 0;
                const rawPct = hasTotal ? Math.round((form.progressCurrent / form.progressTotal!) * 100) : 0;
                // Effective % displayed: if COMPLETED, always ≥100
                const effectivePct = form.progressStatus === 'COMPLETED' ? Math.max(100, rawPct) : rawPct;
                const isOverdrive = effectivePct > 100;
                const isEarlyFinish = form.progressStatus === 'COMPLETED' && hasTotal && form.progressCurrent < form.progressTotal!;

                return (
                  <div className="space-y-5">
                    {/* Ring + inputs row */}
                    <div className="flex items-center gap-5">
                      <div className="shrink-0">
                        <ProgressRing value={effectivePct} />
                      </div>
                      <div className="flex-1 grid grid-cols-2 gap-3">
                        {/* Current Progress Input */}
                        <div className="space-y-1">
                          <span className="text-[10px] font-semibold text-white/30 uppercase tracking-wider block">
                            {i18next.t('mediaCreate.currentCount', { label: progressionLabel })}
                          </span>
                          <div className="flex items-center bg-white/5 border border-white/10 rounded-xl p-1 focus-within:border-primary/30 transition-colors">
                            <button
                              type="button"
                              onClick={() => handleProgressValuesChange({ current: Math.max(0, form.progressCurrent - 1) })}
                              className="w-7 h-7 flex items-center justify-center rounded-lg text-white/40 hover:text-white hover:bg-white/10 transition-all cursor-pointer shrink-0"
                            >
                              <Minus className="w-3 h-3" />
                            </button>
                            <input
                              type="text"
                              inputMode="decimal"
                              value={currentInputVal}
                              onFocus={(e) => e.target.select()}
                              onChange={(e) => {
                                const valStr = e.target.value;
                                const cleaned = valStr.replace(/[^0-9.,]/g, '');
                                const parts = cleaned.split(/[.,]/);
                                if (parts.length > 2) return;
                                
                                setCurrentInputVal(cleaned);
                                
                                const numericVal = parseFloat(cleaned.replace(',', '.'));
                                if (!isNaN(numericVal)) {
                                  handleProgressValuesChange({ current: Math.max(0, numericVal) });
                                } else {
                                  handleProgressValuesChange({ current: 0 });
                                }
                              }}
                              onBlur={() => {
                                setCurrentInputVal(form.progressCurrent.toString());
                              }}
                              className="w-full text-center bg-transparent border-0 text-sm text-white font-bold focus:outline-none focus:ring-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                            />
                            <button
                              type="button"
                              onClick={() => handleProgressValuesChange({ current: form.progressCurrent + 1 })}
                              className="w-7 h-7 flex items-center justify-center rounded-lg text-white/40 hover:text-white hover:bg-white/10 transition-all cursor-pointer shrink-0"
                            >
                              <Plus className="w-3 h-3" />
                            </button>
                          </div>
                        </div>

                        {/* Total Progress Input */}
                        <div className="space-y-1">
                          <span className="text-[10px] font-semibold text-white/30 uppercase tracking-wider block">
                            {selectedCollection?.duration_label || i18next.t('mediaCreate.totalCount', { label: progressionLabel })}
                          </span>
                          <div className="flex items-center bg-white/5 border border-white/10 rounded-xl p-1 focus-within:border-primary/30 transition-colors">
                            <button
                              type="button"
                              onClick={() => handleProgressValuesChange({ total: Math.max(0, (form.progressTotal ?? 0) - 1) })}
                              className="w-7 h-7 flex items-center justify-center rounded-lg text-white/40 hover:text-white hover:bg-white/10 transition-all cursor-pointer shrink-0"
                            >
                              <Minus className="w-3 h-3" />
                            </button>
                            <input
                              type="text"
                              inputMode="decimal"
                              value={totalInputVal}
                              placeholder="--"
                              onFocus={(e) => e.target.select()}
                              onChange={(e) => {
                                const valStr = e.target.value;
                                const cleaned = valStr.replace(/[^0-9.,]/g, '');
                                const parts = cleaned.split(/[.,]/);
                                if (parts.length > 2) return;
                                
                                setTotalInputVal(cleaned);
                                
                                if (cleaned === '') {
                                  handleProgressValuesChange({ total: null });
                                } else {
                                  const numericVal = parseFloat(cleaned.replace(',', '.'));
                                  if (!isNaN(numericVal)) {
                                    handleProgressValuesChange({ total: Math.max(0, numericVal) });
                                  }
                                }
                              }}
                              onBlur={() => {
                                setTotalInputVal(form.progressTotal != null ? form.progressTotal.toString() : '');
                              }}
                              className="w-full text-center bg-transparent border-0 text-sm text-white font-bold focus:outline-none focus:ring-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                            />
                            <button
                              type="button"
                              onClick={() => handleProgressValuesChange({ total: (form.progressTotal ?? 0) + 1 })}
                              className="w-7 h-7 flex items-center justify-center rounded-lg text-white/40 hover:text-white hover:bg-white/10 transition-all cursor-pointer shrink-0"
                            >
                              <Plus className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Interactive Slider & Presets */}
                    {hasTotal && (
                      <div className="space-y-3">
                        <input
                          type="range"
                          min={0}
                          max={form.progressTotal!}
                          step={form.progressTotal! % 1 !== 0 ? 0.01 : 1}
                          value={form.progressCurrent}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value) || 0;
                            const roundedVal = form.progressTotal! % 1 !== 0
                              ? Math.round(val * 100) / 100
                              : Math.round(val);
                            handleProgressValuesChange({ current: roundedVal });
                          }}
                          className="w-full h-1.5 rounded-full appearance-none cursor-pointer bg-white/10 accent-amber-500 focus:outline-none hover:bg-white/15 transition-colors"
                          style={{
                            background: `linear-gradient(to right, #f59e0b 0%, #f59e0b ${Math.min(100, effectivePct)}%, rgba(255,255,255,0.08) ${Math.min(100, effectivePct)}%, rgba(255,255,255,0.08) 100%)`
                          }}
                        />
                        <div className="flex gap-1.5 justify-between">
                          {[0, 25, 50, 75, 100].map((pct) => {
                            const val = pct === 100
                              ? form.progressTotal!
                              : (form.progressTotal! % 1 !== 0
                                  ? Math.round((pct / 100) * form.progressTotal! * 100) / 100
                                  : Math.round((pct / 100) * form.progressTotal!));
                            const isCurrent = form.progressCurrent === val;
                            return (
                              <button
                                key={pct}
                                type="button"
                                onClick={() => handleProgressValuesChange({ current: val })}
                                className={`flex-1 py-1 px-1.5 text-center rounded-lg text-[10px] font-bold transition-all cursor-pointer border ${
                                  isCurrent
                                    ? 'bg-amber-500/20 border-amber-500/40 text-amber-400 shadow-[0_0_8px_rgba(245,158,11,0.15)]'
                                    : 'bg-white/5 border-white/10 text-white/50 hover:bg-white/10 hover:text-white hover:border-white/20'
                                }`}
                              >
                                {pct}%
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Reset/Action shortcuts for when no total is set */}
                    {!hasTotal && (
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => handleProgressValuesChange({ current: 0 })}
                          className="flex-1 py-1 px-1.5 text-center rounded-lg text-[10px] font-bold transition-all cursor-pointer border bg-white/5 border-white/10 text-white/50 hover:bg-white/10 hover:text-white hover:border-white/20"
                        >
                          Réinitialiser (0)
                        </button>
                        <button
                          type="button"
                          onClick={() => handleProgressValuesChange({ current: form.progressCurrent + 10 })}
                          className="flex-1 py-1 px-1.5 text-center rounded-lg text-[10px] font-bold transition-all cursor-pointer border bg-white/5 border-white/10 text-white/50 hover:bg-white/10 hover:text-white hover:border-white/20"
                        >
                          +10
                        </button>
                        <button
                          type="button"
                          onClick={() => handleProgressValuesChange({ current: form.progressCurrent + 50 })}
                          className="flex-1 py-1 px-1.5 text-center rounded-lg text-[10px] font-bold transition-all cursor-pointer border bg-white/5 border-white/10 text-white/50 hover:bg-white/10 hover:text-white hover:border-white/20"
                        >
                          +50
                        </button>
                      </div>
                    )}

                    {/* ── Contextual info banners ── */}

                    {/* Early finish banner: COMPLETED but current < total */}
                    {isEarlyFinish && (
                      <div className="flex items-start gap-2.5 px-3 py-2.5 rounded-xl bg-emerald-500/[0.07] border border-emerald-500/20">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                        <div>
                          <p className="text-[11px] font-semibold text-emerald-400">{i18next.t('mediaCreate.earlyFinishTitle')}</p>
                          <p className="text-[10px] text-emerald-400/60 mt-0.5">
                            {i18next.t('mediaCreate.earlyFinishDesc', { current: form.progressCurrent, total: form.progressTotal, label: progressionLabelPlural.toLowerCase() })}
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Overdrive banner: current > total */}
                    {isOverdrive && !isEarlyFinish && (
                      <div className="flex items-start gap-2.5 px-3 py-2.5 rounded-xl bg-purple-500/[0.07] border border-purple-500/20">
                        <Activity className="w-3.5 h-3.5 text-purple-400 shrink-0 mt-0.5" />
                        <div>
                          <p className="text-[11px] font-semibold text-purple-400">{i18next.t('mediaCreate.overdriveTitle', { pct: effectivePct })}</p>
                          <p className="text-[10px] text-purple-400/60 mt-0.5">
                            {i18next.t('mediaCreate.overdriveDesc', { total: form.progressTotal, label: progressionLabelPlural.toLowerCase() })}
                          </p>
                        </div>
                      </div>
                    )}

                  </div>
                );
              })()}

              {/* Experience date */}
              <div className="pt-4 border-t border-white/5 mt-4 relative z-[60]">
                <div className="flex items-center gap-3">
                  <Play className="w-3.5 h-3.5 text-white/30 shrink-0" />
                  <span className="text-xs text-white/40 shrink-0">{dateLabel}</span>
                  <div className="flex-1">
                    <CustomDatePicker
                      value={form.experienceDate}
                      onChange={(val) => updateField('experienceDate', val)}
                      placeholder="--"
                    />
                  </div>
                </div>
              </div>

              {/* Replay section */}
              <div className="pt-4 border-t border-white/5 mt-4">
                <div className="flex items-center gap-3 mb-3">
                  <RefreshCw className="w-3.5 h-3.5 text-white/30 shrink-0" />
                  <span className="text-xs text-white/40">{i18next.t('mediaCreate.replayed')}</span>
                  <label className="relative inline-flex items-center cursor-pointer ml-auto">
                    <input
                      type="checkbox"
                      checked={form.replayCount > 0}
                      onChange={(e) => {
                        if (e.target.checked) {
                          updateField('replayCount', 1);
                        } else {
                          updateField('replayCount', 0);
                          updateField('experienceDates', []);
                        }
                      }}
                      className="sr-only peer"
                    />
                    <div className="w-8 h-[18px] bg-white/10 peer-checked:bg-primary/60 rounded-full transition-colors after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-[14px] after:w-[14px] after:transition-all peer-checked:after:translate-x-[14px]" />
                  </label>
                </div>

                {form.replayCount > 0 && (
                  <div className="space-y-3 pl-6">
                    <div>
                      <span className="text-[10px] font-semibold text-white/30 uppercase tracking-wider">{i18next.t('mediaCreate.replayCount')}</span>
                      <div className="flex items-center gap-1 mt-1">
                        <button type="button" onClick={() => updateField('replayCount', Math.max(1, form.replayCount - 1))} className="w-7 h-7 flex items-center justify-center rounded-lg bg-white/5 border border-white/10 text-white/40 hover:text-white hover:bg-white/10 transition-all cursor-pointer"><Minus className="w-3 h-3" /></button>
                        <input type="number" value={form.replayCount} onChange={(e) => updateField('replayCount', Math.max(1, Number(e.target.value) || 1))} className="w-16 text-center px-1 py-1 bg-white/5 border border-white/10 rounded-lg text-sm text-white font-bold focus:outline-none focus:border-primary/30 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
                        <button type="button" onClick={() => updateField('replayCount', form.replayCount + 1)} className="w-7 h-7 flex items-center justify-center rounded-lg bg-white/5 border border-white/10 text-white/40 hover:text-white hover:bg-white/10 transition-all cursor-pointer"><Plus className="w-3 h-3" /></button>
                      </div>
                    </div>
                    <div>
                      <span className="text-[10px] font-semibold text-white/30 uppercase tracking-wider mb-1.5 block">{i18next.t('mediaCreate.experienceDates')}</span>
                      <div className="space-y-1.5">
                        {Array.from({ length: form.replayCount }, (_, i) => (
                          <div key={i} className="flex items-center gap-2">
                            <span className="text-[10px] text-white/25 w-4 text-right shrink-0">{i + 1}.</span>
                            <div className="flex-1">
                              <CustomDatePicker
                                value={form.experienceDates[i] || ''}
                                onChange={(val) => {
                                  setForm((prev) => {
                                    const dates = [...prev.experienceDates];
                                    while (dates.length <= i) dates.push('');
                                    dates[i] = val;
                                    return { ...prev, experienceDates: dates };
                                  });
                                }}
                                placeholder="--"
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Notes et points card */}
            <div className="glass-card rounded-2xl p-6 relative z-10">
              <SectionHeader icon={PenLine} title={i18next.t('mediaCreate.notesAndPoints')} color="#ec4899" />

              {/* Rating /100 with segmented bar */}
              <div className="mb-5">
                <div className="flex items-center justify-between mb-3">
                  <label className="block text-[11px] font-semibold text-white/40 uppercase tracking-wider">{i18next.t('mediaCreate.rating')}</label>
                  {form.userRating !== null && (
                    <div className="flex items-center gap-2">
                      <span
                        className="text-[10px] font-bold px-2.5 py-1 rounded-full transition-all duration-300"
                        style={{
                          backgroundColor: `${getRatingColor(form.userRating)}20`,
                          color: getRatingColor(form.userRating),
                          border: `1px solid ${getRatingColor(form.userRating)}40`,
                        }}
                      >
                        {getRatingCategory(form.userRating)}
                      </span>
                    </div>
                  )}
                </div>

                {/* Value row */}
                <div className="flex items-center justify-center gap-3 mb-4">
                  <button type="button" onClick={() => updateField('userRating', Math.max(MIN_RATING, (form.userRating ?? 0) - 1))} className="w-9 h-9 flex items-center justify-center rounded-lg bg-white/5 border border-white/10 text-white/40 hover:text-white hover:bg-white/10 transition-all cursor-pointer"><Minus className="w-4 h-4" /></button>
                  <div className="flex items-baseline gap-1 min-w-[80px] justify-center">
                    <span className="text-4xl font-black tabular-nums transition-colors duration-300" style={{ color: getRatingColor(form.userRating) }}>
                      {form.userRating !== null ? form.userRating : '—'}
                    </span>
                    <span className="text-sm text-white/30 font-semibold">/{MAX_RATING}</span>
                  </div>
                  <button type="button" onClick={() => updateField('userRating', Math.min(MAX_RATING, (form.userRating ?? 0) + 1))} className="w-9 h-9 flex items-center justify-center rounded-lg bg-white/5 border border-white/10 text-white/40 hover:text-white hover:bg-white/10 transition-all cursor-pointer"><Plus className="w-4 h-4" /></button>
                </div>

                {/* Segmented bar — clickable */}
                <div className="flex gap-0.5 mb-2">
                  {Array.from({ length: 20 }, (_, i) => {
                    const segMin = i * 5;
                    const segMax = segMin + 5;
                    const rating = form.userRating ?? 0;
                    const filled = rating >= segMax;
                    const partial = !filled && rating > segMin;
                    const fillPct = partial ? ((rating - segMin) / 5) * 100 : filled ? 100 : 0;
                    const segColor = getRatingColor(segMin + 2.5);
                    return (
                      <div
                        key={i}
                        className="flex-1 rounded-sm overflow-hidden relative cursor-pointer group"
                        style={{ height: 8, backgroundColor: 'rgba(255,255,255,0.06)' }}
                        onClick={() => updateField('userRating', segMax)}
                        title={`${segMin}–${segMax - 1} · ${getRatingCategory(segMin + 2.5)}`}
                      >
                        {fillPct > 0 && (
                          <div
                            className="absolute inset-y-0 left-0 rounded-sm transition-all duration-300"
                            style={{
                              width: `${fillPct}%`,
                              backgroundColor: segColor,
                              boxShadow: filled ? `0 0 4px ${segColor}55` : undefined,
                            }}
                          />
                        )}
                        {/* Hover highlight on empty segments */}
                        <div
                          className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity"
                          style={{ backgroundColor: `${segColor}30` }}
                        />
                      </div>
                    );
                  })}
                </div>

                {/* Scale labels */}
                <div className="flex justify-between mb-3">
                  <span className="text-[9px] text-white/15 tabular-nums">0</span>
                  <span className="text-[9px] text-white/15 tabular-nums">50</span>
                  <span className="text-[9px] text-white/15 tabular-nums">100</span>
                </div>

                {/* Hidden range input for fine control */}
                <input
                  type="range"
                  min={MIN_RATING} max={MAX_RATING} step={1}
                  value={form.userRating ?? 0}
                  onChange={(e) => updateField('userRating', parseInt(e.target.value))}
                  className="w-full h-1 rounded-full appearance-none cursor-pointer opacity-30 hover:opacity-60 transition-opacity"
                  style={{ background: `linear-gradient(to right, ${getRatingColor(form.userRating)} 0%, ${getRatingColor(form.userRating)} ${form.userRating ?? 0}%, rgba(255,255,255,0.08) ${form.userRating ?? 0}%, rgba(255,255,255,0.08) 100%)` }}
                />

                {form.userRating !== null && (
                  <div className="flex justify-center mt-2">
                    <button type="button" onClick={() => updateField('userRating', null)} className="text-[11px] text-white/30 hover:text-white/60 transition-colors cursor-pointer">{i18next.t('mediaCreate.clearRating')}</button>
                  </div>
                )}
              </div>

              {/* Positive / Negative points */}
              <div className="space-y-3">
                <div>
                  <label className="flex items-center gap-1.5 text-[11px] font-semibold text-emerald-400/70 uppercase tracking-wider mb-1.5">
                    <ThumbsUp className="w-3 h-3" />
                    {i18next.t('mediaDetail.positivePoints')}
                  </label>
                  <div className="rounded-xl overflow-hidden border border-emerald-500/20 focus-within:border-emerald-500/40 transition-colors">
                    <textarea
                      value={form.positivePoints}
                      onChange={(e) => updateField('positivePoints', e.target.value)}
                      onKeyDown={(e) => handleBulletKeyDown(e, 'positivePoints')}
                      onFocus={() => handleBulletFocus('positivePoints')}
                      placeholder={i18next.t('mediaCreate.positivePlaceholder')}
                      rows={3}
                      className="w-full px-3 py-2.5 bg-emerald-500/[0.03] text-sm text-white placeholder:text-white/15 focus:outline-none resize-none leading-relaxed custom-scrollbar"
                    />
                  </div>
                </div>
                <div>
                  <label className="flex items-center gap-1.5 text-[11px] font-semibold text-red-400/70 uppercase tracking-wider mb-1.5">
                    <ThumbsDown className="w-3 h-3" />
                    {i18next.t('mediaDetail.negativePoints')}
                  </label>
                  <div className="rounded-xl overflow-hidden border border-red-500/20 focus-within:border-red-500/40 transition-colors">
                    <textarea
                      value={form.negativePoints}
                      onChange={(e) => updateField('negativePoints', e.target.value)}
                      onKeyDown={(e) => handleBulletKeyDown(e, 'negativePoints')}
                      onFocus={() => handleBulletFocus('negativePoints')}
                      placeholder={i18next.t('mediaCreate.negativePlaceholder')}
                      rows={3}
                      className="w-full px-3 py-2.5 bg-red-500/[0.03] text-sm text-white placeholder:text-white/15 focus:outline-none resize-none leading-relaxed custom-scrollbar"
                    />
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>

        {/* ============================================================ */}
        {/*  Gallery — full width                                         */}
        {/* ============================================================ */}
        <div className="glass-card rounded-2xl p-6 mb-6">
          <div className="flex items-center justify-between mb-5 pb-3 border-b border-white/5">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ backgroundColor: '#06b6d420' }}>
                <ImageIcon className="w-3.5 h-3.5" style={{ color: '#06b6d4' }} />
              </div>
              <h2 className="text-base font-bold text-white">{i18next.t('mediaCreate.gallery')}</h2>
            </div>
            <span className="text-[11px] font-semibold text-white/30 tabular-nums">{form.images.length}/{MAX_IMAGES_PER_MEDIA}</span>
          </div>

          <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {form.images.length > 0 && (
              <DndContext sensors={sensors} collisionDetection={closestCorners} onDragEnd={handleDragEnd}>
                <SortableContext items={form.images.map((i) => i.id)} strategy={rectSortingStrategy}>
                  {form.images.map((image, index) => (
                    <SortableGalleryImage key={image.id} image={image} index={index} isCover={index === coverImageIndex} onRemove={handleRemoveImage} onSetCover={(idx) => { setCoverImageIndex(idx); updateField('coverCrop', null); setEditCoverUrl(null); setCoverSourceChanged(true); }} />
                  ))}
                </SortableContext>
              </DndContext>
            )}

            {/* Upload zone — hidden when reaching 10 images (limit is 12) */}
            {form.images.length < 10 && (
              <div
                ref={galleryDropZoneRef}
                onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setIsDragOver(true); }}
                onDragEnter={(e) => { e.preventDefault(); e.stopPropagation(); setIsDragOver(true); }}
                onDragLeave={(e) => { e.preventDefault(); e.stopPropagation(); setIsDragOver(false); }}
                onDrop={(e) => { e.preventDefault(); e.stopPropagation(); setIsDragOver(false); if (e.dataTransfer.files?.length) { const files = Array.from(e.dataTransfer.files).slice(0, MAX_IMAGES_PER_MEDIA - form.images.length); const newImages: GalleryImage[] = files.map((file) => ({ id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`, file, preview: URL.createObjectURL(file) })); setForm((prev) => ({ ...prev, images: [...prev.images, ...newImages] })); } }}
                onClick={handleFilePicker}
                className={`aspect-[3/4] rounded-xl border-2 border-dashed flex flex-col items-center justify-center gap-2 transition-all cursor-pointer ${isDragOver ? 'border-primary/60 bg-primary/10' : 'border-white/10 bg-white/[0.02] hover:border-white/25 hover:bg-white/5'
                  }`}
              >
                <Upload className={`w-5 h-5 ${isDragOver ? 'text-primary' : 'text-white/20'}`} />
                <span className="text-[10px] text-white/30 text-center px-2 flex flex-col items-center gap-0.5">
                  <span>{i18next.t('mediaCreate.dragPasteClick')}</span>
                  <span className="text-white/20">{i18next.t('mediaCreate.imageFormats')}</span>
                </span>
              </div>
            )}
          </div>

          {form.images.length > 0 && (
            <p className="text-[11px] text-white/25 mt-3">
              {form.images.length} {i18next.t('common.image', { count: form.images.length })} — {i18next.t('mediaCreate.firstIsCover')}
            </p>
          )}
        </div>

      </MainContent>

      {/* Leave confirmation dialog */}
      <ConfirmDialog
        open={showLeaveDialog}
        onClose={() => setShowLeaveDialog(false)}
        title={t('mediaCreate.unsavedChanges')}
        description={t('mediaCreate.unsavedChangesDescription')}
        iconColor="#f59e0b"
        actions={[{
          label: t('mediaCreate.leaveWithoutSaving'),
          variant: 'danger',
          onClick: () => {
            setShowLeaveDialog(false);
            formDirtyRef.current = false;
            droppedFilePathsRef.current = []; // Reset dropped paths
            attachmentFilePathsRef.current = [];
            goBack();
          },
        }]}
      >
        {(() => {
          const groups = getChangedFieldGroups();
          if (groups.length === 0) return null;
          return (
            <div className="mt-3 space-y-2.5">
              {groups.map((g) => (
                <div key={g.section}>
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: g.color }} />
                    <span className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: g.color }}>{g.section}</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5 pl-3.5">
                    {g.fields.map((f) => (
                      <span key={f} className="px-2 py-0.5 rounded-md text-[11px] font-medium text-white/60" style={{ backgroundColor: `${g.color}12`, border: `1px solid ${g.color}25` }}>
                        {f}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          );
        })()}
      </ConfirmDialog>

      {/* Cover crop modal */}
      {showCoverCrop && coverImage && (
        <CoverCropModal
          imageDataUrl={coverImage.preview}
          initialCrop={form.coverCrop ?? undefined}
          onConfirm={(cropData) => {
            updateField('coverCrop', cropData);
            setShowCoverCrop(false);
          }}
          onCancel={() => setShowCoverCrop(false)}
        />
      )}

      {/* Image processing toast */}
      <AnimatePresence>
        {uploadProgress && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-6 right-6 z-[100] flex flex-col gap-2 px-5 py-4 bg-[#12141f]/95 backdrop-blur-2xl border border-white/10 rounded-xl shadow-2xl min-w-[280px]"
          >
            <div className="flex items-center justify-between text-xs text-white/50">
              <span className="truncate max-w-[180px]">{uploadProgress.fileName}</span>
              <span>{uploadProgress.current}/{uploadProgress.total}</span>
            </div>

            {/* Progress bar */}
            <div className="w-full h-1 bg-white/10 rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-primary rounded-full"
                animate={{ width: `${uploadProgress.percent}%` }}
                transition={{ duration: 0.3 }}
              />
            </div>

            {/* Stage label */}
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              <span className="text-xs text-white/40">
                {{
                  reading: t('mediaCreate.uploadReading'),
                  processing: t('mediaCreate.uploadProcessing'),
                  saving: t('mediaCreate.uploadSaving'),
                  done: t('mediaCreate.uploadDone')
                }[uploadProgress.stage] ?? uploadProgress.stage}
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Error toast */}
      <AnimatePresence>
        {errorToast && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            onAnimationComplete={() => {
              if (errorToast) {
                setTimeout(() => setErrorToast(null), 5000);
              }
            }}
            className="fixed bottom-6 right-6 z-[100] flex items-center gap-3 px-5 py-4 bg-red-950/95 backdrop-blur-2xl border border-red-500/30 rounded-xl shadow-2xl min-w-[280px] max-w-[400px]"
          >
            <span className="text-sm text-red-200">{errorToast}</span>
            <button
              type="button"
              onClick={() => setErrorToast(null)}
              className="text-red-400 hover:text-red-200 transition-colors shrink-0"
            >
              ✕
            </button>
          </motion.div>
        )}
      </AnimatePresence>

    </AppShell>
  );
};

export default MediaCreate;
