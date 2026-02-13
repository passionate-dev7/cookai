/**
 * CookAI Design System - Color Tokens
 *
 * Primary: Sage green (#6B7F5E) - herbs, freshness, premium feel
 * Accent: Terracotta (#C4704B) - warm clay, appetite, energy
 * Complements food photography without competing with it.
 */

export const lightColors = {
  // Brand
  primary: '#6B7F5E',
  primaryHover: '#5C6E50',
  primaryLight: '#E8EDE4',
  secondary: '#8B6F4E',
  accent: '#C4704B',
  accentLight: '#F5E1D6',

  // Backgrounds
  background: '#FAF8F5',
  surface: '#FFFFFF',
  surfaceSecondary: '#F3F0EB',

  // Text
  text: '#2C2825',
  textSecondary: '#7A746D',
  textTertiary: '#A39E97',

  // Borders
  border: '#E5E0D9',
  borderFocus: '#6B7F5E',
  divider: '#EEEAE4',

  // Status
  success: '#4A7C59',
  error: '#C44B4B',
  warning: '#D4943A',
  info: '#5B7FA5',

  // Components
  tagBg: '#F0EDE7',
  tagText: '#5C5650',
  ratingStar: '#D4943A',
  overlay: 'rgba(44, 40, 37, 0.4)',

  // Tab bar
  tabActive: '#6B7F5E',
  tabInactive: '#A39E97',
};

export const darkColors = {
  // Brand
  primary: '#8FA87E',
  primaryHover: '#A0B890',
  primaryLight: '#3D4A36',
  secondary: '#B8977A',
  accent: '#D4885F',
  accentLight: '#3A2A20',

  // Backgrounds
  background: '#141211',
  surface: '#1E1C19',
  surfaceSecondary: '#28251F',

  // Text
  text: '#EDE8E2',
  textSecondary: '#9C9590',
  textTertiary: '#6B6560',

  // Borders
  border: '#332F2A',
  borderFocus: '#8FA87E',
  divider: '#2A2722',

  // Status
  success: '#6BA57A',
  error: '#D46B6B',
  warning: '#E0A84E',
  info: '#7A9DC0',

  // Components
  tagBg: '#2A2722',
  tagText: '#B5AFA8',
  ratingStar: '#E0A84E',
  overlay: 'rgba(0, 0, 0, 0.5)',

  // Tab bar
  tabActive: '#8FA87E',
  tabInactive: '#6B6560',
};

export type ThemeColors = typeof lightColors;

/**
 * Legacy color mapping for gradual migration.
 * Maps old orange-based colors to new sage/terracotta palette.
 */
export const legacyColorMap = {
  '#F97316': lightColors.primary,     // Orange -> Sage
  '#EA580C': lightColors.accent,      // Dark orange -> Terracotta
  '#FFF7ED': lightColors.primaryLight, // Light orange bg -> Light sage
  '#FDBA74': lightColors.primary,     // Medium orange -> Sage
  '#14B8A6': lightColors.secondary,   // Teal -> Warm brown
  '#FF6B6B': lightColors.accent,      // Coral -> Terracotta
} as const;
