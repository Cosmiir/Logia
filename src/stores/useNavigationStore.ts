import { create } from 'zustand';

export type PageType = 
  | 'dashboard' 
  | 'library' 
  | 'stats' 
  | 'settings'
  | 'notifications'
  | 'collection-edit'
  | 'create-profile'
  | 'media-create'
  | 'media-detail'
  | 'genre-management'
  | 'person-management'
  | 'template-management'
  | 'objective-create'
  | 'import'
  | 'export';

interface NavigationState {
  currentPage: PageType;
  selectedCollectionId: number | null;
  editingCollectionId: number | null;
  editingMediaId: number | null;
  viewingMediaId: number | null;
  mediaCreateCollectionId: number | null;
  editingObjectiveId: number | null;
  previousPage: PageType | null;
  focusLibrarySearch: boolean;

  // Navigation guard: if set, called before any navigation.
  // Return true to allow, false to block.
  beforeNavigate: (() => boolean) | null;
  setBeforeNavigate: (guard: (() => boolean) | null) => void;
  setFocusLibrarySearch: (value: boolean) => void;

  // Actions
  navigate: (page: PageType) => void;
  navigateToLibrary: (collectionId: number) => void;
  navigateToCollectionEdit: (collectionId?: number) => void;
  navigateToMediaCreate: (collectionId?: number | null, mediaId?: number) => void;
  navigateToMediaDetail: (mediaId: number) => void;
  navigateToObjectiveCreate: (objectiveId?: number) => void;
  navigateToImport: () => void;
  navigateToExport: () => void;
  goBack: () => void;
  forceNavigate: (page: PageType) => void;
  setSelectedCollection: (id: number | null) => void;
}

export const useNavigationStore = create<NavigationState>((set, get) => ({
  currentPage: 'dashboard',
  selectedCollectionId: null,
  editingCollectionId: null,
  editingMediaId: null,
  viewingMediaId: null,
  mediaCreateCollectionId: null,
  editingObjectiveId: null,
  previousPage: null,
  focusLibrarySearch: false,
  beforeNavigate: null,

  setBeforeNavigate: (guard) => set({ beforeNavigate: guard }),
  setFocusLibrarySearch: (value) => set({ focusLibrarySearch: value }),

  navigate: (page) => {
    const { beforeNavigate } = get();
    if (beforeNavigate && !beforeNavigate()) return;
    set((state) => ({ 
      currentPage: page, 
      previousPage: state.currentPage,
      beforeNavigate: null,
    }));
  },

  forceNavigate: (page) => set((state) => ({
    currentPage: page,
    previousPage: state.currentPage,
    beforeNavigate: null,
  })),

  navigateToLibrary: (collectionId) => {
    const { beforeNavigate } = get();
    if (beforeNavigate && !beforeNavigate()) return;
    set((state) => ({
      currentPage: 'library',
      selectedCollectionId: collectionId,
      previousPage: state.currentPage,
      beforeNavigate: null,
    }));
  },

  navigateToCollectionEdit: (collectionId) => {
    const { beforeNavigate } = get();
    if (beforeNavigate && !beforeNavigate()) return;
    set((state) => ({
      currentPage: 'collection-edit',
      editingCollectionId: collectionId ?? null,
      previousPage: state.currentPage,
      beforeNavigate: null,
    }));
  },

  navigateToMediaCreate: (collectionId, mediaId) => {
    const { beforeNavigate } = get();
    if (beforeNavigate && !beforeNavigate()) return;
    set((state) => ({
      currentPage: 'media-create',
      mediaCreateCollectionId: collectionId ?? null,
      editingMediaId: mediaId ?? null,
      previousPage: state.currentPage,
      beforeNavigate: null,
    }));
  },

  navigateToMediaDetail: (mediaId) => {
    const { beforeNavigate } = get();
    if (beforeNavigate && !beforeNavigate()) return;
    set((state) => ({
      currentPage: 'media-detail',
      viewingMediaId: mediaId,
      previousPage: state.currentPage,
      beforeNavigate: null,
    }));
  },

  navigateToObjectiveCreate: (objectiveId) => {
    const { beforeNavigate } = get();
    if (beforeNavigate && !beforeNavigate()) return;
    set((state) => ({
      currentPage: 'objective-create',
      editingObjectiveId: objectiveId ?? null,
      previousPage: state.currentPage,
      beforeNavigate: null,
    }));
  },

  navigateToImport: () => {
    const { beforeNavigate } = get();
    if (beforeNavigate && !beforeNavigate()) return;
    set((state) => ({
      currentPage: 'import',
      previousPage: state.currentPage,
      beforeNavigate: null,
    }));
  },

  navigateToExport: () => {
    const { beforeNavigate } = get();
    if (beforeNavigate && !beforeNavigate()) return;
    set((state) => ({
      currentPage: 'export',
      previousPage: state.currentPage,
      beforeNavigate: null,
    }));
  },

  goBack: () => {
    const { previousPage, beforeNavigate } = get();
    if (beforeNavigate && !beforeNavigate()) return;
    if (previousPage) {
      set({ currentPage: previousPage, previousPage: null, beforeNavigate: null });
    } else {
      set({ currentPage: 'dashboard', beforeNavigate: null });
    }
  },

  setSelectedCollection: (id) => set({ selectedCollectionId: id }),
}));
