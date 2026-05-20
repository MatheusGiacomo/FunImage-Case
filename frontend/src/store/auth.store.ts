import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { User, AuthTokens } from '@/types';
import { authApi, tokenStorage } from '@/lib/api';

interface AuthStore {
  user: User | null;
  tokens: AuthTokens | null;
  isAuthenticated: boolean;
  isLoading: boolean;

  // Actions
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  fetchMe: (token?: string) => Promise<void>;
  setUser: (user: User) => void;
  setTokens: (tokens: AuthTokens) => void;
  reset: () => void;
}

const initialState = {
  user: null,
  tokens: null,
  isAuthenticated: false,
  isLoading: false,
};

/** Retry a function up to `maxAttempts` times on network errors (ERR_EMPTY_RESPONSE / no status). */
async function withNetworkRetry<T>(
  fn: () => Promise<T>,
  maxAttempts = 4,
  delayMs = 800
): Promise<T> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err: unknown) {
      const isNetworkError =
        err instanceof Error &&
        (err.message === 'Network Error' ||
          (err as { code?: string }).code === 'ERR_EMPTY_RESPONSE' ||
          (err as { response?: unknown }).response === undefined);

      if (isNetworkError && attempt < maxAttempts) {
        console.warn(`Network error — retry ${attempt}/${maxAttempts - 1} in ${delayMs}ms…`);
        await new Promise((r) => setTimeout(r, delayMs * attempt));
      } else {
        throw err;
      }
    }
  }
  throw new Error('Max retries exceeded');
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set, get) => ({
      ...initialState,

      login: async (email, password) => {
        set({ isLoading: true });
        try {
          const tokens = await withNetworkRetry(() =>
            authApi.login({ email, password })
          );
          set({ tokens, isAuthenticated: true });
          await get().fetchMe(tokens.access);
        } catch (error) {
          // Reset auth state on failure so the login form stays visible
          set({ tokens: null, isAuthenticated: false });
          throw error; // re-throw so the login form can show the error
        } finally {
          set({ isLoading: false });
        }
      },

      logout: async () => {
        set({ isLoading: true });
        try {
          await authApi.logout();
        } catch {
          // Logout silencioso
        } finally {
          tokenStorage.clear();
          set({ ...initialState });
        }
      },

      fetchMe: async (overrideToken?: string) => { // Adicione o parâmetro aqui
        try {
          // Passa o token para a API
          const user = await authApi.me(overrideToken); 
          set({ user, isAuthenticated: true });
        } catch {
          set({ user: null, isAuthenticated: false });
        }
      },

      setUser: (user) => set({ user }),
      setTokens: (tokens) => {
        tokenStorage.set(tokens);
        set({ tokens, isAuthenticated: true });
      },
      reset: () => set(initialState),
    }),
    {
      name: 'fotopro:auth',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        user: state.user,
        tokens: state.tokens,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);