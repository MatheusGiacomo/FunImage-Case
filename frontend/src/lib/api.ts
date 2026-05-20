import axios, {
  type AxiosInstance,
  type AxiosRequestConfig,
  type InternalAxiosRequestConfig,
  type AxiosError,
} from 'axios';
import type {
  AuthTokens,
  LoginCredentials,
  User,
  Gallery,
  GalleryCreate,
  Photo,
  PaginatedResponse,
  ApiResponse,
  SignedDownloadUrl,
  UploadProgress,
} from '@/types';

// Config
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000/api';

// ─── snake_case → camelCase converter ────────────────────────────────────────
// Django retorna snake_case; os tipos do frontend usam camelCase.
// Roda em toda resposta via interceptor, nenhum componente vê snake_case.

function toCamel(s: string): string {
  return s.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
}

function keysToCamel<T>(obj: unknown): T {
  if (Array.isArray(obj)) {
    return obj.map((v) => keysToCamel(v)) as T;
  }
  if (obj !== null && typeof obj === 'object') {
    return Object.fromEntries(
      Object.entries(obj as Record<string, unknown>).map(([k, v]) => [
        toCamel(k),
        keysToCamel(v),
      ])
    ) as T;
  }
  return obj as T;
}

// camelCase → snake_case (para serializar requests ao Django)
function toSnake(s: string): string {
  return s.replace(/([A-Z])/g, (c) => `_${c.toLowerCase()}`);
}

function keysToSnake<T>(obj: unknown): T {
  if (Array.isArray(obj)) {
    return obj.map((v) => keysToSnake(v)) as T;
  }
  if (obj !== null && typeof obj === 'object') {
    return Object.fromEntries(
      Object.entries(obj as Record<string, unknown>).map(([k, v]) => [
        toSnake(k),
        keysToSnake(v),
      ])
    ) as T;
  }
  return obj as T;
}

// Token Management
const TOKEN_KEY = 'fotopro:tokens';

export const tokenStorage = {
  get: (): AuthTokens | null => {
    if (typeof window === 'undefined') return null;
    try {
      const raw = localStorage.getItem(TOKEN_KEY);
      const parsed = raw ? (JSON.parse(raw) as AuthTokens) : null;
      console.log('📦 Lendo Token do Storage:', parsed);
      return parsed;
    } catch {
      return null;
    }
  },
  set: (tokens: AuthTokens): void => {
    console.log('💾 Gravando Token no Storage:', tokens);
    localStorage.setItem(TOKEN_KEY, JSON.stringify(tokens));
  },
  clear: (): void => {
    localStorage.removeItem(TOKEN_KEY);
  },
};

// Axios Instance
const createApiClient = (): AxiosInstance => {
  const client = axios.create({
    baseURL: API_BASE_URL,
    headers: { 'Content-Type': 'application/json' },
    timeout: 30_000,
  });

client.interceptors.request.use((config) => {
  try {
    // Lê sempre do Zustand persist (fotopro:auth) — fonte única de verdade
    const raw = localStorage.getItem('fotopro:auth');
    if (!raw) return config;

    const parsed = JSON.parse(raw);
    const token = parsed.state?.tokens?.access;

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    } else {
      console.warn("⚠️ INTERCEPTOR: token não encontrado em fotopro:auth > state.tokens.access");
    }
  } catch (e) {
    console.error("❌ INTERCEPTOR: Erro ao ler localStorage", e);
  }

  // Converte o body (JSON) de camelCase para snake_case
  if (config.data && !(config.data instanceof FormData)) {
    try {
      config.data = keysToSnake(config.data);
    } catch {
      // Se não for serializável, deixa como está
    }
  }

  // Converte query params de camelCase para snake_case
  // ex: { perPage: 30 } → { per_page: 30 }
  if (config.params && typeof config.params === 'object') {
    try {
      config.params = keysToSnake(config.params);
    } catch {
      // Se falhar, mantém original
    }
  }

  return config;
});

  // Response: handle 401, refresh token + snake_case → camelCase
  let isRefreshing = false;
  let failedQueue: Array<{
    resolve: (value: string) => void;
    reject: (err: unknown) => void;
  }> = [];

  const processQueue = (error: unknown, token: string | null = null) => {
    failedQueue.forEach(({ resolve, reject }) =>
      error ? reject(error) : resolve(token!)
    );
    failedQueue = [];
  };

  client.interceptors.response.use(
    (response) => {
      // Skip processing for binary responses — the interceptor's JSON envelope
      // unwrapping and keysToCamel conversion would corrupt binary data (ZIP, etc.)
      if (response.config.responseType === 'blob') {
        return response;
      }

      const raw = response.data;

      // Desembrulha o envelope { success: true, data: ..., meta: ... }
      // que o SuccessRenderer do Django adiciona em toda resposta.
      if (raw && typeof raw === 'object' && 'success' in raw) {
        if (raw.meta) {
          // Resposta paginada: reconstrói no formato de PaginatedResponse<T>
          // O tipo usa o campo "data" para os itens, não "results"
          response.data = {
            data:       raw.data ?? [],
            total:      raw.meta.total ?? 0,
            page:       raw.meta.page  ?? 1,
            perPage:    raw.meta.per_page ?? raw.meta.perPage ?? 30,
            totalPages: raw.meta.total_pages ?? raw.meta.totalPages ?? 1,
          };
        } else {
          // Resposta simples: retorna apenas o conteúdo de data
          response.data = raw.data ?? null;
        }
      }

      // Converte todas as chaves de snake_case para camelCase
      if (response.data) {
        response.data = keysToCamel(response.data);
      }

      return response;
    },
    async (error: AxiosError) => {
      const originalRequest = error.config as InternalAxiosRequestConfig & {
        _retry?: boolean;
      };

      if (error.response?.status === 401 && !originalRequest._retry) {
        if (isRefreshing) {
          return new Promise<string>((resolve, reject) => {
            failedQueue.push({ resolve, reject });
          })
            .then((token) => {
              originalRequest.headers.Authorization = `Bearer ${token}`;
              return client(originalRequest);
            })
            .catch((err) => Promise.reject(err));
        }

        originalRequest._retry = true;
        isRefreshing = true;

        const tokens = tokenStorage.get();
        if (!tokens?.refresh) {
          tokenStorage.clear();
          window.location.href = '/auth/login';
          return Promise.reject(error);
        }

        try {
  // Chamada de refresh usando a instância limpa do axios
  const response = await axios.post(`${API_BASE_URL}/auth/token/refresh/`, { 
    refresh: tokens.refresh 
  });

  // A MÁGICA: Captura o token de dentro do envelope 'data' que o Django envia
  // Verificamos as duas possibilidades para não dar erro
  // refresh usa axios puro (sem interceptor) — desembrulha manualmente
  const payload = response.data?.data ?? response.data;
  const newAccessToken = payload?.access;

  if (!newAccessToken) {
    throw new Error("Token não encontrado na resposta do servidor");
  }

  // Montamos o novo objeto SEM o envelope 'success' ou 'data' do Django
  const newTokens: AuthTokens = { 
    access: newAccessToken,
    refresh: tokens.refresh 
  };

  // 1. Atualizamos o storage (isso deve sobrescrever o dado antigo)
  tokenStorage.set(newTokens);
  
  // 2. Liberamos a fila
  processQueue(null, newAccessToken);

  // 3. Atualizamos o header da requisição que falhou e tentamos de novo
  originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
  return client(originalRequest);

} catch (refreshError) {
  processQueue(refreshError, null);
  tokenStorage.clear();
  window.location.href = '/auth/login';
  return Promise.reject(refreshError);
} finally {
  isRefreshing = false;
}
      }

      return Promise.reject(error);
    }
  );

  return client;
};

export const apiClient = createApiClient();

// Auth API

export const authApi = {
  login: async (credentials: LoginCredentials) => {
    // O interceptor já desembrulha o envelope { success, data }
    // response.data é diretamente { access, refresh, user }
    const { data } = await apiClient.post<AuthTokens>('/auth/login/', credentials);
    return data;
  },

  logout: async () => {
    const tokens = tokenStorage.get();
    if (tokens?.refresh) {
      await apiClient.post('/auth/logout/', { refresh: tokens.refresh });
    }
    tokenStorage.clear();
  },

  me: async (token?: string): Promise<User> => {
    const config = token 
      ? { headers: { Authorization: `Bearer ${token}` } } 
      : {};
    const { data } = await apiClient.get<User>('/auth/me/', config);
    return data;
  },
};

// Galeria API

export const galleryApi = {
  list: async (params?: {
    page?: number;
    perPage?: number;
    search?: string;
  }): Promise<PaginatedResponse<Gallery>> => {
    const { data } = await apiClient.get<PaginatedResponse<Gallery>>(
      '/galleries/',
      { params }
    );
    return data;
  },

  get: async (id: string): Promise<Gallery> => {
    const { data } = await apiClient.get<Gallery>(`/galleries/${id}/`);
    return data;
  },

  create: async (payload: GalleryCreate): Promise<Gallery> => {
    const { data } = await apiClient.post<Gallery>('/galleries/', payload);
    return data;
  },

  update: async (id: string, payload: Partial<GalleryCreate>): Promise<Gallery> => {
    const { data } = await apiClient.patch<Gallery>(`/galleries/${id}/`, payload);
    return data;
  },

  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`/galleries/${id}/`);
  },

  purchase: async (galleryId: string, code: string): Promise<{ unlocked: number }> => {
    const { data } = await apiClient.post(`/galleries/${galleryId}/purchase/`, { code });
    return data;
  },

  downloadAlbum: async (galleryId: string, galleryName: string): Promise<void> => {
    const response = await apiClient.get(`/galleries/${galleryId}/download/`, {
      responseType: 'blob',
    });
    // response.data is already a Blob when responseType is 'blob'
    const blob = new Blob([response.data], { type: 'application/zip' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${galleryName.replace(/\s+/g, '_')}.zip`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  },

  getShareLink: async (id: string): Promise<{ shareUrl: string }> => {
    const { data } = await apiClient.post<{ shareUrl: string }>(
      `/galleries/${id}/share/`
    );
    return data;
  },
};

// Fotos API

export const photoApi = {
  list: async (
    galleryId: string,
    params?: { page?: number; perPage?: number }
  ): Promise<PaginatedResponse<Photo>> => {
    const { data } = await apiClient.get<PaginatedResponse<Photo>>(
      `/galleries/${galleryId}/photos/`,
      { params }
    );
    return data;
  },

  upload: async (
    galleryId: string,
    files: File[],
    onProgress?: (fileIndex: number, progress: number) => void
  ): Promise<Photo[]> => {
    const results: Photo[] = [];

    for (let i = 0; i < files.length; i++) {
      const formData = new FormData();
      formData.append('photo', files[i]);
      formData.append('gallery_id', galleryId);

      const { data } = await apiClient.post<{ photos: Photo[]; errors?: { filename: string; error: string }[] }>(
        '/photos/upload/',
        formData,
        {
          headers: { 'Content-Type': 'multipart/form-data' },
          onUploadProgress: (progressEvent) => {
            if (progressEvent.total) {
              const pct = Math.round(
                (progressEvent.loaded / progressEvent.total) * 100
              );
              onProgress?.(i, pct);
            }
          },
        }
      );
      // Backend returns { photos: Photo[], errors?: [...] }
      if (data.photos?.length) {
        results.push(...data.photos);
      }
    }

    return results;
  },

  delete: async (photoId: string): Promise<void> => {
    await apiClient.delete(`/photos/${photoId}/`);
  },

  getDownloadUrl: async (photoId: string): Promise<SignedDownloadUrl> => {
    const { data } = await apiClient.post<SignedDownloadUrl>(
      `/photos/${photoId}/download/`
    );
    return data;
  },

  purchase: async (photoId: string, code: string): Promise<Photo> => {
    const { data } = await apiClient.post<Photo>(`/photos/${photoId}/purchase/`, { code });
    return data;
  },

  toggleFavorite: async (photoId: string): Promise<{ isFavorited: boolean }> => {
    const { data } = await apiClient.post<{ isFavorited: boolean }>(
      `/photos/${photoId}/favorite/`
    );
    return data;
  },
};

// Helper

export const downloadFile = async (url: string, filename: string): Promise<void> => {
  const response = await fetch(url);
  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = objectUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(objectUrl);
};