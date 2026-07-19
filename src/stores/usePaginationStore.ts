import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface PaginationState {
  // Rows per page (5 by default)
  rowsPerPage: number;
  setRowsPerPage: (rows: number) => void;

  // Current page number (1-based)
  currentPage: number;
  setCurrentPage: (page: number) => void;
  resetPage: () => void;

  // Last viewed collection
  lastCollectionId: number | null;
  setLastCollectionId: (id: number | null) => void;

  // Calculated values
  getOffset: (itemsPerPage: number) => number;
  getPageRange: (totalItems: number, itemsPerPage: number) => { start: number; end: number };
}

export const usePaginationStore = create<PaginationState>()(
  persist(
    (set, get) => ({
      // Default: 5 rows per page as requested
      rowsPerPage: 5,
      setRowsPerPage: (rows) => set({ rowsPerPage: rows, currentPage: 1 }),

      // Current page
      currentPage: 1,
      setCurrentPage: (page) => set({ currentPage: Math.max(1, page) }),
      resetPage: () => set({ currentPage: 1 }),

      // Last collection
      lastCollectionId: null,
      setLastCollectionId: (id) => set({ lastCollectionId: id }),

      // Calculate SQL offset based on items per page
      getOffset: (itemsPerPage: number) => {
        return (get().currentPage - 1) * itemsPerPage;
      },

      // Get display range (e.g., "1-45 sur 200")
      getPageRange: (totalItems: number, itemsPerPage: number) => {
        const { currentPage } = get();
        const start = (currentPage - 1) * itemsPerPage + 1;
        const end = Math.min(currentPage * itemsPerPage, totalItems);
        return { start, end };
      },
    }),
    {
      name: 'logia-pagination',
      partialize: (state) => ({ rowsPerPage: state.rowsPerPage }),
    }
  )
);
