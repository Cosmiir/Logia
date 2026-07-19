import { create } from 'zustand';

/* ================================================================== */
/*  Sort types                                                         */
/* ================================================================== */
export interface SortCriterion {
  field: string;
  order: 'asc' | 'desc';
}

export interface SortPreset {
  id: string;
  name: string;
  criteria: SortCriterion[];
}

/* ================================================================== */
/*  Filter types                                                       */
/* ================================================================== */
export type NumericOperator = 'gte' | 'lte' | 'eq' | 'neq' | 'between';

export interface NumericFilterValue {
  operator: NumericOperator;
  value: number | null;
  value2: number | null; // for 'between'
}

export type FilterType =
  | 'media_status'
  | 'progress_status'
  | 'genres'
  | 'people'
  | 'release_date'
  | 'experience_date'
  | 'created_at'
  | 'creator'
  | 'rating'
  | 'progression'
  | 'duration';

export interface FilterCriterion {
  id: string;
  type: FilterType;
  /** Meaning varies by type:
   *  media_status / progress_status: string[] of selected statuses
   *  genres: number[] of genre ids
   *  release_date / experience_date / created_at: { from?: string; to?: string }
   *  creator: string[] of selected creators
   *  rating / progression / duration: NumericFilterValue
   */
  value: any;
}

export interface FilterPreset {
  id: string;
  name: string;
  filters: FilterCriterion[];
}

/* ================================================================== */
/*  LocalStorage helpers                                               */
/* ================================================================== */
const SORT_PRESETS_KEY = 'logia_sort_presets';
const FILTER_PRESETS_KEY = 'logia_filter_presets';

function loadSortPresets(): SortPreset[] {
  try {
    const raw = localStorage.getItem(SORT_PRESETS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}
function saveSortPresetsToStorage(presets: SortPreset[]) {
  localStorage.setItem(SORT_PRESETS_KEY, JSON.stringify(presets));
}

function loadFilterPresets(): FilterPreset[] {
  try {
    const raw = localStorage.getItem(FILTER_PRESETS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}
function saveFilterPresetsToStorage(presets: FilterPreset[]) {
  localStorage.setItem(FILTER_PRESETS_KEY, JSON.stringify(presets));
}

/* ================================================================== */
/*  Store interface                                                    */
/* ================================================================== */
interface FiltersState {
  searchQuery: string;
  genreIds: number[];
  minRating: number | null;
  maxRating: number | null;
  sortCriteria: SortCriterion[];
  sortPresets: SortPreset[];

  // New filter system
  activeFilters: FilterCriterion[];
  filterPresets: FilterPreset[];

  // Computed-like getters for backend compatibility (first criterion)
  sortBy: 'title' | 'created_at' | 'experience_date' | 'rating' | 'release_date';
  sortOrder: 'asc' | 'desc';

  // Actions
  setSearchQuery: (query: string) => void;
  setGenreIds: (ids: number[]) => void;
  toggleGenre: (id: number) => void;
  setMinRating: (rating: number | null) => void;
  setMaxRating: (rating: number | null) => void;
  setSortBy: (sortBy: FiltersState['sortBy']) => void;
  setSortOrder: (order: 'asc' | 'desc') => void;
  resetFilters: () => void;

  // Multi-sort actions
  addSortCriterion: (criterion: SortCriterion) => void;
  removeSortCriterion: (index: number) => void;
  updateSortCriterion: (index: number, criterion: Partial<SortCriterion>) => void;
  reorderSortCriteria: (fromIndex: number, toIndex: number) => void;
  resetSort: () => void;

  // Sort preset actions
  saveSortPreset: (name: string) => void;
  loadSortPreset: (id: string) => void;
  deleteSortPreset: (id: string) => void;

  // Filter actions
  addFilter: (type: FilterType) => void;
  removeFilter: (filterId: string) => void;
  updateFilter: (filterId: string, value: any) => void;
  clearAllFilters: () => void;
  filterByPerson: (personId: number) => void;

  // Filter preset actions
  saveFilterPreset: (name: string) => void;
  loadFilterPreset: (id: string) => void;
  deleteFilterPreset: (id: string) => void;
}

const DEFAULT_SORT: SortCriterion[] = [{ field: 'created_at', order: 'desc' }];

// Helper: derive sortBy/sortOrder from first criterion
function deriveSortProps(criteria: SortCriterion[]) {
  const first = criteria[0] || DEFAULT_SORT[0];
  const validFields = ['title', 'created_at', 'experience_date', 'rating', 'release_date'];
  const sortBy = validFields.includes(first.field) ? first.field : 'created_at';
  return {
    sortBy: sortBy as FiltersState['sortBy'],
    sortOrder: first.order,
  };
}

// Default value for each filter type
function getDefaultFilterValue(type: FilterType): any {
  switch (type) {
    case 'media_status': return [];
    case 'progress_status': return [];
    case 'genres': return [];
    case 'people': return [];
    case 'release_date': return { from: '', to: '' };
    case 'experience_date': return { from: '', to: '' };
    case 'created_at': return { from: '', to: '' };
    case 'creator': return [] as string[];
    case 'rating': return { operator: 'gte', value: null, value2: null } as NumericFilterValue;
    case 'progression': return { operator: 'gte', value: null, value2: null } as NumericFilterValue;
    case 'duration': return { operator: 'gte', value: null, value2: null } as NumericFilterValue;
  }
}

const initialState = {
  searchQuery: '',
  genreIds: [] as number[],
  minRating: null as number | null,
  maxRating: null as number | null,
  sortCriteria: [...DEFAULT_SORT],
  sortPresets: loadSortPresets(),
  activeFilters: [] as FilterCriterion[],
  filterPresets: loadFilterPresets(),
  ...deriveSortProps(DEFAULT_SORT),
};

export const useFiltersStore = create<FiltersState>((set) => ({
  ...initialState,

  setSearchQuery: (query) => set({ searchQuery: query }),
  
  setGenreIds: (ids) => set({ genreIds: ids }),
  
  toggleGenre: (id) => set((state) => ({
    genreIds: state.genreIds.includes(id)
      ? state.genreIds.filter((g) => g !== id)
      : [...state.genreIds, id],
  })),
  
  setMinRating: (rating) => set({ minRating: rating }),
  
  setMaxRating: (rating) => set({ maxRating: rating }),
  
  setSortBy: (sortBy) => set((state) => {
    const newCriteria = [...state.sortCriteria];
    if (newCriteria.length > 0) {
      newCriteria[0] = { ...newCriteria[0], field: sortBy };
    } else {
      newCriteria.push({ field: sortBy, order: 'desc' });
    }
    return { sortBy, sortCriteria: newCriteria };
  }),
  
  setSortOrder: (order) => set((state) => {
    const newCriteria = [...state.sortCriteria];
    if (newCriteria.length > 0) {
      newCriteria[0] = { ...newCriteria[0], order };
    }
    return { sortOrder: order, sortCriteria: newCriteria };
  }),
  
  resetFilters: () => set(initialState),

  // Multi-sort actions
  addSortCriterion: (criterion) => set((state) => {
    const newCriteria = [...state.sortCriteria, criterion];
    return { sortCriteria: newCriteria, ...deriveSortProps(newCriteria) };
  }),

  removeSortCriterion: (index) => set((state) => {
    const newCriteria = state.sortCriteria.filter((_, i) => i !== index);
    if (newCriteria.length === 0) {
      return { sortCriteria: [...DEFAULT_SORT], ...deriveSortProps(DEFAULT_SORT) };
    }
    return { sortCriteria: newCriteria, ...deriveSortProps(newCriteria) };
  }),

  updateSortCriterion: (index, updates) => set((state) => {
    const newCriteria = [...state.sortCriteria];
    if (index >= 0 && index < newCriteria.length) {
      newCriteria[index] = { ...newCriteria[index], ...updates };
    }
    return { sortCriteria: newCriteria, ...deriveSortProps(newCriteria) };
  }),

  reorderSortCriteria: (fromIndex, toIndex) => set((state) => {
    const newCriteria = [...state.sortCriteria];
    const [moved] = newCriteria.splice(fromIndex, 1);
    newCriteria.splice(toIndex, 0, moved);
    return { sortCriteria: newCriteria, ...deriveSortProps(newCriteria) };
  }),

  resetSort: () => set({
    sortCriteria: [...DEFAULT_SORT],
    ...deriveSortProps(DEFAULT_SORT),
  }),

  // Sort preset actions
  saveSortPreset: (name) => set((state) => {
    const preset: SortPreset = {
      id: `preset-${Date.now()}`,
      name,
      criteria: [...state.sortCriteria],
    };
    const newPresets = [...state.sortPresets, preset];
    saveSortPresetsToStorage(newPresets);
    return { sortPresets: newPresets };
  }),

  loadSortPreset: (id) => set((state) => {
    const preset = state.sortPresets.find(p => p.id === id);
    if (!preset) return {};
    const newCriteria = [...preset.criteria];
    return { sortCriteria: newCriteria, ...deriveSortProps(newCriteria) };
  }),

  deleteSortPreset: (id) => set((state) => {
    const newPresets = state.sortPresets.filter(p => p.id !== id);
    saveSortPresetsToStorage(newPresets);
    return { sortPresets: newPresets };
  }),

  // Filter actions
  addFilter: (type) => set((state) => {
    // Don't add duplicate type
    if (state.activeFilters.some(f => f.type === type)) return {};
    const newFilter: FilterCriterion = {
      id: `filter-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      type,
      value: getDefaultFilterValue(type),
    };
    return { activeFilters: [...state.activeFilters, newFilter] };
  }),

  removeFilter: (filterId) => set((state) => ({
    activeFilters: state.activeFilters.filter(f => f.id !== filterId),
  })),

  updateFilter: (filterId, value) => set((state) => ({
    activeFilters: state.activeFilters.map(f =>
      f.id === filterId ? { ...f, value } : f
    ),
  })),

  clearAllFilters: () => set({ activeFilters: [] }),

  filterByPerson: (personId) => set(() => {
    const filterId = `filter-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const newFilter: FilterCriterion = {
      id: filterId,
      type: 'people',
      value: [personId],
    };
    return {
      activeFilters: [newFilter],
      searchQuery: '',
    };
  }),

  // Filter preset actions
  saveFilterPreset: (name) => set((state) => {
    const preset: FilterPreset = {
      id: `fpreset-${Date.now()}`,
      name,
      filters: state.activeFilters.map(f => ({ ...f })),
    };
    const newPresets = [...state.filterPresets, preset];
    saveFilterPresetsToStorage(newPresets);
    return { filterPresets: newPresets };
  }),

  loadFilterPreset: (id) => set((state) => {
    const preset = state.filterPresets.find(p => p.id === id);
    if (!preset) return {};
    return { activeFilters: preset.filters.map(f => ({ ...f, id: `filter-${Date.now()}-${Math.random().toString(36).slice(2, 6)}` })) };
  }),

  deleteFilterPreset: (id) => set((state) => {
    const newPresets = state.filterPresets.filter(p => p.id !== id);
    saveFilterPresetsToStorage(newPresets);
    return { filterPresets: newPresets };
  }),
}));
