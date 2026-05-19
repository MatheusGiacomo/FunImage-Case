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

export const useAuthStore = create<AuthStore>()(
  persist(
    (set, get) => ({
      ...initialState,

  login: async (email, password) => {
  set({ isLoading: true });
  try {
    const tokens = await authApi.login({ email, password });

    // ❌ REMOVA ESTA LINHA: tokenStorage.set(tokens); 
    // O persist() abaixo já vai gravar isso automaticamente no localStorage

    set({ 
      tokens, // Aqui tokens deve ser { access: "...", refresh: "..." }
      isAuthenticated: true 
    });

    await get().fetchMe(tokens.access);

  } catch (error) {
    console.error("Erro no login:", error);
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