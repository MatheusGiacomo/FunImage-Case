import { create } from 'zustand';
import type { Gallery, Photo, ModalState, FilterState } from '@/types';
import { galleryApi, photoApi } from '@/lib/api';

interface GalleryStore {
  galleries: Gallery[];
  currentGallery: Gallery | null;
  photos: Photo[];
  totalPhotos: number;
  currentPage: number;
  hasNextPage: boolean;
  isLoadingGalleries: boolean;
  isLoadingPhotos: boolean;
  filters: FilterState;
  modal: ModalState;

  // Actions
  fetchGalleries: () => Promise<void>;
  fetchGallery: (id: string) => Promise<void>;
  fetchPhotos: (galleryId: string, page?: number) => Promise<void>;
  fetchMorePhotos: (galleryId: string) => Promise<void>;
  createGallery: (name: string, description?: string, clientId?: string) => Promise<Gallery>;
  deleteGallery: (id: string) => Promise<void>;
  deletePhoto: (photoId: string) => Promise<void>;
  toggleFavorite: (photoId: string) => Promise<void>;
  openModal: (photoIndex: number) => void;
  closeModal: () => void;
  navigateModal: (direction: 'prev' | 'next') => void;
  setFilter: (filter: Partial<FilterState>) => void;
  reset: () => void;
}

const defaultFilters: FilterState = {
  search: '',
  sortBy: 'createdAt',
  sortOrder: 'desc',
};

const defaultModal: ModalState = {
  isOpen: false,
  photoIndex: null,
  photos: [],
};

export const useGalleryStore = create<GalleryStore>()((set, get) => ({
  galleries: [],
  currentGallery: null,
  photos: [],
  totalPhotos: 0,
  currentPage: 1,
  hasNextPage: false,
  isLoadingGalleries: false,
  isLoadingPhotos: false,
  filters: defaultFilters,
  modal: defaultModal,

  fetchGalleries: async () => {
    set({ isLoadingGalleries: true });
    try {
      const result = await galleryApi.list({ perPage: 50 });

      // Normaliza qualquer formato que o interceptor possa retornar:
      // 1. Array direto             → [gallery, ...]
      // 2. PaginatedResponse        → { data: [...], total, ... }
      // 3. Qualquer outra coisa     → []
      let items: Gallery[] = [];
      if (Array.isArray(result)) {
        items = result;
      } else if (result && typeof result === 'object') {
        const r = result as unknown as Record<string, unknown>;
        if (Array.isArray(r.data)) {
          items = r.data as Gallery[];
        } else if (Array.isArray(r.results)) {
          items = r.results as Gallery[];
        }
      }

      set({ galleries: items });
    } catch (err) {
      console.error('[fetchGalleries] error:', err);
      set({ galleries: [] });
    } finally {
      set({ isLoadingGalleries: false });
    }
  },

  fetchGallery: async (id) => {
    const gallery = await galleryApi.get(id);
    set({ currentGallery: gallery });
  },

  fetchPhotos: async (galleryId, page = 1) => {
    set({ isLoadingPhotos: true });
    try {
      const result = await photoApi.list(galleryId, { page, perPage: 30 });

      // Normaliza a resposta (mesmo padrão que fetchGalleries)
      let items: Photo[] = [];
      let total = 0;
      let totalPages = 1;

      if (Array.isArray(result)) {
        items = result;
        total = result.length;
      } else if (result && typeof result === 'object') {
        const r = result as unknown as Record<string, unknown>;
        items = (Array.isArray(r.data) ? r.data : Array.isArray(r.results) ? r.results : []) as Photo[];
        total = (r.total as number) ?? items.length;
        totalPages = (r.totalPages as number) ?? 1;
      }

      set({
        photos:      page === 1 ? items : [...get().photos, ...items],
        totalPhotos: total,
        currentPage: page,
        hasNextPage: page < totalPages,
        modal:       { ...get().modal, photos: page === 1 ? items : [...get().photos, ...items] },
      });
    } catch (err) {
      console.error('[fetchPhotos] error:', err);
      set({ photos: [] });
    } finally {
      set({ isLoadingPhotos: false });
    }
  },

  fetchMorePhotos: async (galleryId) => {
    const { currentPage, hasNextPage, isLoadingPhotos } = get();
    if (!hasNextPage || isLoadingPhotos) return;
    await get().fetchPhotos(galleryId, currentPage + 1);
  },

  createGallery: async (name, description, clientId) => {
    const payload = { name, description, ...(clientId ? { clientId } : {}) };
    const gallery = await galleryApi.create(payload);
    // Recarrega a lista completa do servidor após criar
    // para garantir que o objeto tenha todos os campos (id, created_at, etc.)
    await get().fetchGalleries();
    return gallery;
  },

  deleteGallery: async (id) => {
    await galleryApi.delete(id);
    set((state) => ({
      galleries: (Array.isArray(state.galleries) ? state.galleries : []).filter((g) => g.id !== id),
    }));
  },

  deletePhoto: async (photoId) => {
    await photoApi.delete(photoId);
    set((state) => {
      const photos = (Array.isArray(state.photos) ? state.photos : []).filter(
        (p) => p.id !== photoId
      );
      return {
        photos,
        totalPhotos: Math.max(0, state.totalPhotos - 1),
        modal: { ...state.modal, photos },
      };
    });
  },

  toggleFavorite: async (photoId) => {
    const { isFavorited } = await photoApi.toggleFavorite(photoId);
    set((state) => ({
      photos: (Array.isArray(state.photos) ? state.photos : []).map((p) =>
        p.id === photoId ? { ...p, isFavorited } : p
      ),
    }));
  },

  openModal: (photoIndex) => {
    set((state) => ({
      modal: { isOpen: true, photoIndex, photos: Array.isArray(state.photos) ? state.photos : [] },
    }));
    document.body.style.overflow = 'hidden';
  },

  closeModal: () => {
    set({ modal: defaultModal });
    document.body.style.overflow = '';
  },

  navigateModal: (direction) => {
    const { modal } = get();
    if (modal.photoIndex === null) return;
    const len = modal.photos.length;
    const next =
      direction === 'next'
        ? (modal.photoIndex + 1) % len
        : (modal.photoIndex - 1 + len) % len;
    set({ modal: { ...modal, photoIndex: next } });
  },

  setFilter: (filter) =>
    set((state) => ({ filters: { ...state.filters, ...filter } })),

  reset: () =>
    set({
      galleries: [],
      currentGallery: null,
      photos: [],
      totalPhotos: 0,
      currentPage: 1,
      hasNextPage: false,
      filters: defaultFilters,
      modal: defaultModal,
    }),
}));