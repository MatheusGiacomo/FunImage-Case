import { create } from 'zustand';
import type { Photo } from '@/types';
import { apiClient } from '@/lib/api';

interface FavoritesStore {
  photos: Photo[];
  total: number;
  page: number;
  hasNextPage: boolean;
  isLoading: boolean;
  isFetchingMore: boolean;

  fetchFavorites: (reset?: boolean) => Promise<void>;
  fetchMore: () => Promise<void>;
  removeFromFavorites: (photoId: string) => void;
  reset: () => void;
}

const PER_PAGE = 30;

export const useFavoritesStore = create<FavoritesStore>()((set, get) => ({
  photos: [],
  total: 0,
  page: 1,
  hasNextPage: false,
  isLoading: false,
  isFetchingMore: false,

  fetchFavorites: async (reset = true) => {
    if (reset) {
      set({ isLoading: true, photos: [], page: 1 });
    }

    try {
      const { data } = await apiClient.get('/photos/', {
        params: {
          is_favorited: true,
          page: reset ? 1 : get().page,
          per_page: PER_PAGE,
        },
      });

      const incoming: Photo[] = data.data ?? data.results ?? [];
      const total: number     = data.meta?.total ?? data.count ?? 0;
      const totalPages: number = data.meta?.total_pages ?? Math.ceil(total / PER_PAGE);
      const currentPage        = reset ? 1 : get().page;

      set((state) => ({
        photos: reset ? incoming : [...state.photos, ...incoming],
        total,
        page: currentPage,
        hasNextPage: currentPage < totalPages,
        isLoading: false,
        isFetchingMore: false,
      }));
    } catch {
      set({ isLoading: false, isFetchingMore: false });
    }
  },

  fetchMore: async () => {
    const { hasNextPage, isFetchingMore, page } = get();
    if (!hasNextPage || isFetchingMore) return;

    set((state) => ({ isFetchingMore: true, page: state.page + 1 }));
    await get().fetchFavorites(false);
  },

  removeFromFavorites: (photoId) => {
    set((state) => ({
      photos: state.photos.filter((p) => p.id !== photoId),
      total: Math.max(0, state.total - 1),
    }));
  },

  reset: () =>
    set({ photos: [], total: 0, page: 1, hasNextPage: false, isLoading: false }),
}));