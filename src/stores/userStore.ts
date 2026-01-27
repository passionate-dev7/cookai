import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { zustandStorage } from './storage';
import { Profile } from '@/src/types/database';
import { supabase, getProfile } from '@/src/services/supabase';
import type { User, Session } from '@supabase/supabase-js';

interface UserState {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  hasCompletedOnboarding: boolean;

  // Actions
  setUser: (user: User | null) => void;
  setSession: (session: Session | null) => void;
  setProfile: (profile: Profile | null) => void;
  setIsLoading: (isLoading: boolean) => void;
  setHasCompletedOnboarding: (completed: boolean) => void;
  fetchProfile: () => Promise<void>;
  initialize: () => Promise<void>;
  signOut: () => Promise<void>;
  reset: () => void;
}

const initialState = {
  user: null,
  session: null,
  profile: null,
  isLoading: true,
  isAuthenticated: false,
  hasCompletedOnboarding: false,
};

export const useUserStore = create<UserState>()(
  persist(
    (set, get) => ({
      ...initialState,

      setUser: (user) =>
        set({ user, isAuthenticated: !!user }),

      setSession: (session) =>
        set({ session }),

      setProfile: (profile) =>
        set({ profile }),

      setIsLoading: (isLoading) =>
        set({ isLoading }),

      setHasCompletedOnboarding: (completed) =>
        set({ hasCompletedOnboarding: completed }),

      fetchProfile: async () => {
        const { user } = get();
        if (!user) return;

        const { profile, error } = await getProfile(user.id);
        if (!error && profile) {
          set({ profile });
        }
      },

      initialize: async () => {
        set({ isLoading: true });

        try {
          const { data: { session } } = await supabase.auth.getSession();

          if (session?.user) {
            set({
              user: session.user,
              session,
              isAuthenticated: true,
            });

            // Fetch profile
            const { profile } = await getProfile(session.user.id);
            if (profile) {
              set({ profile });
            }
          }
        } catch (error) {
          console.error('Failed to initialize user:', error);
        } finally {
          set({ isLoading: false });
        }

        // Listen for auth changes
        supabase.auth.onAuthStateChange(async (event, session) => {
          if (event === 'SIGNED_IN' && session?.user) {
            set({
              user: session.user,
              session,
              isAuthenticated: true,
            });
            const { profile } = await getProfile(session.user.id);
            if (profile) {
              set({ profile });
            }
          } else if (event === 'SIGNED_OUT') {
            get().reset();
          }
        });
      },

      signOut: async () => {
        await supabase.auth.signOut();
        get().reset();
      },

      reset: () =>
        set({
          ...initialState,
          isLoading: false,
          hasCompletedOnboarding: get().hasCompletedOnboarding,
        }),
    }),
    {
      name: 'user-storage',
      storage: createJSONStorage(() => zustandStorage),
      partialize: (state) => ({
        hasCompletedOnboarding: state.hasCompletedOnboarding,
      }),
    }
  )
);
