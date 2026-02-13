import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { zustandStorage } from '@/src/stores/storage';
import { lightColors, darkColors, type ThemeColors } from './colors';

type ThemeMode = 'light' | 'dark' | 'system';

interface ThemeState {
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
  colors: ThemeColors;
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      mode: 'light' as ThemeMode,
      colors: lightColors,
      setMode: (mode: ThemeMode) => {
        // For now, 'system' defaults to light. In the future, use Appearance API.
        const colors = mode === 'dark' ? darkColors : lightColors;
        set({ mode, colors });
      },
    }),
    {
      name: 'cookai-theme',
      storage: createJSONStorage(() => zustandStorage),
      partialize: (state) => ({ mode: state.mode }),
      onRehydrateStorage: () => (state) => {
        if (state) {
          state.colors = state.mode === 'dark' ? darkColors : lightColors;
        }
      },
    }
  )
);

/** Convenience hook that returns just the current color palette */
export const useColors = () => useThemeStore((s) => s.colors);
