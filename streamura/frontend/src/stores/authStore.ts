import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User, Token, UserCreate } from '@/types';
import { authApi } from '@/lib/api';

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;

  // Actions
  login: (identifier: string, password: string) => Promise<void>;
  register: (data: UserCreate) => Promise<void>;
  loginAnonymous: () => Promise<void>;
  migrateToRegistered: (data: UserCreate) => Promise<void>;
  logout: () => void;
  checkAuth: () => Promise<void>;
  clearError: () => void;
  updateUser: (updates: Partial<User>) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,

      login: async (identifier: string, password: string) => {
        set({ isLoading: true, error: null });
        try {
          const token: Token = await authApi.login(identifier, password);
          localStorage.setItem('access_token', token.access_token);
          if (token.refresh_token) {
            localStorage.setItem('refresh_token', token.refresh_token);
          }

          const user = await authApi.getCurrentUser();
          set({ user, isAuthenticated: true, isLoading: false });
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Login failed';
          set({ error: message, isLoading: false });
          throw error;
        }
      },

      register: async (data: UserCreate) => {
        set({ isLoading: true, error: null });
        try {
          await authApi.register(data);
          // After registration, log the user in
          await get().login(data.email || data.username || data.phone_number || '', data.password);
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Registration failed';
          set({ error: message, isLoading: false });
          throw error;
        }
      },

      loginAnonymous: async () => {
        set({ isLoading: true, error: null });
        try {
          const user = await authApi.createAnonymous();
          set({ user, isAuthenticated: true, isLoading: false });
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Anonymous login failed';
          set({ error: message, isLoading: false });
          throw error;
        }
      },

      migrateToRegistered: async (data: UserCreate) => {
        const { user } = get();
        if (!user) {
          set({ error: 'No user to migrate' });
          return;
        }

        set({ isLoading: true, error: null });
        try {
          const updatedUser = await authApi.migrateAnonymous(user.id, data);
          set({ user: updatedUser, isLoading: false });
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Migration failed';
          set({ error: message, isLoading: false });
          throw error;
        }
      },

      logout: () => {
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        set({ user: null, isAuthenticated: false, error: null });
      },

      checkAuth: async () => {
        const token = localStorage.getItem('access_token');
        if (!token) {
          set({ user: null, isAuthenticated: false });
          return;
        }

        set({ isLoading: true });
        try {
          const user = await authApi.getCurrentUser();
          set({ user, isAuthenticated: true, isLoading: false });
        } catch {
          localStorage.removeItem('access_token');
          localStorage.removeItem('refresh_token');
          set({ user: null, isAuthenticated: false, isLoading: false });
        }
      },

      clearError: () => set({ error: null }),

      updateUser: (updates) => {
        const { user } = get();
        if (user) {
          set({ user: { ...user, ...updates } });
        }
      },
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);
