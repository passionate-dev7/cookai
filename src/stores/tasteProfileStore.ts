/**
 * Taste Profile Store - Learns user preferences over time
 *
 * Tracks: cuisine preferences, ingredient affinities, spice tolerance,
 * complexity preference, dietary patterns, and cooking habits.
 *
 * Every interaction (save, favorite, cook, skip) updates the profile.
 * The profile is serialized into context for AI recipe generation.
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { zustandStorage } from './storage';

// ============================================
// Types
// ============================================

export interface TasteInteraction {
  type: 'save' | 'favorite' | 'unfavorite' | 'cook' | 'skip' | 'generate' | 'rate';
  recipeId?: string;
  cuisine?: string;
  ingredients?: string[];
  tags?: string[];
  difficulty?: 'easy' | 'medium' | 'hard';
  rating?: number; // 1-5
  timestamp: number;
}

export interface TasteProfile {
  // Cuisine preferences - scored by interaction weight
  cuisineScores: Record<string, number>;

  // Ingredient affinities - positive = likes, negative = dislikes
  ingredientScores: Record<string, number>;

  // Spice tolerance: 0 = mild only, 5 = balanced, 10 = loves heat
  spiceTolerance: number;

  // Complexity preference based on what they actually cook
  complexityPreference: 'quick' | 'balanced' | 'elaborate';

  // Detected dietary patterns (from frequent ingredient choices)
  dietaryPatterns: string[];

  // Preferred serving sizes
  preferredServings: number;

  // Cooking frequency patterns
  cookingFrequency: 'daily' | 'several-weekly' | 'weekly' | 'occasional';

  // Recent interactions for recency-weighted scoring
  recentInteractions: TasteInteraction[];

  // Total interaction count
  totalInteractions: number;

  // Profile last updated
  lastUpdated: number;
}

// Interaction weights for scoring
const INTERACTION_WEIGHTS = {
  cook: 5,      // Actually cooking = strongest signal
  favorite: 3,  // Favoriting = strong positive
  save: 2,      // Saving = moderate positive
  generate: 1,  // Requesting generation = mild interest
  rate: 0,      // Rating uses the rating value directly
  skip: -1,     // Skipping = mild negative
  unfavorite: -2, // Unfavoriting = moderate negative
};

const MAX_RECENT_INTERACTIONS = 200;
const RECENCY_DECAY = 0.95; // Older interactions worth slightly less

// ============================================
// Store
// ============================================

interface TasteProfileState {
  profile: TasteProfile;

  // Actions
  trackInteraction: (interaction: Omit<TasteInteraction, 'timestamp'>) => void;
  getTopCuisines: (limit?: number) => { cuisine: string; score: number }[];
  getTopIngredients: (limit?: number) => { ingredient: string; score: number }[];
  getDislikedIngredients: () => string[];
  getProfileSummary: () => string; // For AI prompt injection
  resetProfile: () => void;
}

const DEFAULT_PROFILE: TasteProfile = {
  cuisineScores: {},
  ingredientScores: {},
  spiceTolerance: 5,
  complexityPreference: 'balanced',
  dietaryPatterns: [],
  preferredServings: 4,
  cookingFrequency: 'several-weekly',
  recentInteractions: [],
  totalInteractions: 0,
  lastUpdated: Date.now(),
};

export const useTasteProfileStore = create<TasteProfileState>()(
  persist(
    (set, get) => ({
      profile: { ...DEFAULT_PROFILE },

      trackInteraction: (interaction) => {
        const fullInteraction: TasteInteraction = {
          ...interaction,
          timestamp: Date.now(),
        };

        set((state) => {
          const profile = { ...state.profile };
          const weight = interaction.type === 'rate'
            ? (interaction.rating || 3) - 3 // -2 to +2 based on 1-5 rating
            : INTERACTION_WEIGHTS[interaction.type];

          // Update cuisine scores
          if (interaction.cuisine) {
            const current = profile.cuisineScores[interaction.cuisine] || 0;
            profile.cuisineScores[interaction.cuisine] = current + weight;
          }

          // Update ingredient scores
          if (interaction.ingredients?.length) {
            for (const ingredient of interaction.ingredients) {
              const normalized = ingredient.toLowerCase().trim();
              const current = profile.ingredientScores[normalized] || 0;
              profile.ingredientScores[normalized] = current + weight;
            }
          }

          // Update spice tolerance from tags/ingredients
          if (interaction.tags?.length) {
            const spicyTags = ['spicy', 'hot', 'chili', 'habanero', 'jalapeno', 'sriracha', 'cayenne'];
            const hasSpicy = interaction.tags.some((t) =>
              spicyTags.some((s) => t.toLowerCase().includes(s))
            );
            if (hasSpicy && weight > 0) {
              profile.spiceTolerance = Math.min(10, profile.spiceTolerance + 0.2);
            }
          }

          // Update complexity preference from difficulty patterns
          if (interaction.difficulty && (interaction.type === 'cook' || interaction.type === 'save')) {
            const difficultyMap = { easy: -1, medium: 0, hard: 1 };
            const shift = difficultyMap[interaction.difficulty] * 0.1;
            const currentValue =
              profile.complexityPreference === 'quick' ? -1 :
              profile.complexityPreference === 'elaborate' ? 1 : 0;
            const newValue = currentValue + shift;

            if (newValue < -0.5) profile.complexityPreference = 'quick';
            else if (newValue > 0.5) profile.complexityPreference = 'elaborate';
            else profile.complexityPreference = 'balanced';
          }

          // Update dietary patterns from frequent ingredient choices
          profile.dietaryPatterns = detectDietaryPatterns(profile.ingredientScores);

          // Add to recent interactions (keep bounded)
          profile.recentInteractions = [
            fullInteraction,
            ...profile.recentInteractions,
          ].slice(0, MAX_RECENT_INTERACTIONS);

          profile.totalInteractions += 1;
          profile.lastUpdated = Date.now();

          return { profile };
        });
      },

      getTopCuisines: (limit = 5) => {
        const { cuisineScores } = get().profile;
        return Object.entries(cuisineScores)
          .filter(([, score]) => score > 0)
          .sort((a, b) => b[1] - a[1])
          .slice(0, limit)
          .map(([cuisine, score]) => ({ cuisine, score }));
      },

      getTopIngredients: (limit = 10) => {
        const { ingredientScores } = get().profile;
        return Object.entries(ingredientScores)
          .filter(([, score]) => score > 0)
          .sort((a, b) => b[1] - a[1])
          .slice(0, limit)
          .map(([ingredient, score]) => ({ ingredient, score }));
      },

      getDislikedIngredients: () => {
        const { ingredientScores } = get().profile;
        return Object.entries(ingredientScores)
          .filter(([, score]) => score < -2)
          .sort((a, b) => a[1] - b[1])
          .map(([ingredient]) => ingredient);
      },

      getProfileSummary: () => {
        const state = get();
        const { profile } = state;

        if (profile.totalInteractions < 3) {
          return 'New user - no established preferences yet. Suggest diverse, approachable recipes.';
        }

        const parts: string[] = [];

        // Top cuisines
        const topCuisines = state.getTopCuisines(3);
        if (topCuisines.length > 0) {
          parts.push(
            `Favorite cuisines: ${topCuisines.map((c) => c.cuisine).join(', ')}`
          );
        }

        // Top ingredients
        const topIngredients = state.getTopIngredients(5);
        if (topIngredients.length > 0) {
          parts.push(
            `Loves: ${topIngredients.map((i) => i.ingredient).join(', ')}`
          );
        }

        // Disliked ingredients
        const disliked = state.getDislikedIngredients();
        if (disliked.length > 0) {
          parts.push(`Avoids: ${disliked.join(', ')}`);
        }

        // Spice tolerance
        if (profile.spiceTolerance <= 2) {
          parts.push('Prefers mild, non-spicy food');
        } else if (profile.spiceTolerance >= 8) {
          parts.push('Loves spicy and bold flavors');
        }

        // Complexity
        if (profile.complexityPreference === 'quick') {
          parts.push('Prefers quick, easy recipes (under 30 min)');
        } else if (profile.complexityPreference === 'elaborate') {
          parts.push('Enjoys complex, multi-step cooking projects');
        }

        // Dietary patterns
        if (profile.dietaryPatterns.length > 0) {
          parts.push(`Dietary tendencies: ${profile.dietaryPatterns.join(', ')}`);
        }

        // Serving size
        if (profile.preferredServings !== 4) {
          parts.push(`Usually cooks for ${profile.preferredServings} servings`);
        }

        return parts.join('\n');
      },

      resetProfile: () => {
        set({ profile: { ...DEFAULT_PROFILE } });
      },
    }),
    {
      name: 'cookai-taste-profile',
      storage: createJSONStorage(() => zustandStorage),
      partialize: (state) => ({
        profile: state.profile,
      }),
    }
  )
);

// ============================================
// Helpers
// ============================================

function detectDietaryPatterns(ingredientScores: Record<string, number>): string[] {
  const patterns: string[] = [];

  const highScoreIngredients = Object.entries(ingredientScores)
    .filter(([, score]) => score > 3)
    .map(([name]) => name.toLowerCase());

  const lowScoreIngredients = Object.entries(ingredientScores)
    .filter(([, score]) => score < -2)
    .map(([name]) => name.toLowerCase());

  // Check for vegetarian tendency
  const meatIngredients = ['chicken', 'beef', 'pork', 'lamb', 'turkey', 'bacon', 'sausage', 'steak', 'ground meat'];
  const avoidsMeat = meatIngredients.some((m) =>
    lowScoreIngredients.some((l) => l.includes(m))
  );
  const likesMeat = meatIngredients.some((m) =>
    highScoreIngredients.some((h) => h.includes(m))
  );

  if (avoidsMeat && !likesMeat) {
    patterns.push('vegetarian-leaning');
  }

  // Check for dairy-free tendency
  const dairyIngredients = ['milk', 'cheese', 'cream', 'butter', 'yogurt'];
  const avoidsDairy = dairyIngredients.some((d) =>
    lowScoreIngredients.some((l) => l.includes(d))
  );
  if (avoidsDairy) {
    patterns.push('dairy-free-leaning');
  }

  // Check for health-conscious patterns
  const healthyIngredients = ['quinoa', 'kale', 'avocado', 'salmon', 'tofu', 'lentils', 'chickpeas'];
  const likesHealthy = healthyIngredients.filter((h) =>
    highScoreIngredients.some((hi) => hi.includes(h))
  ).length;
  if (likesHealthy >= 3) {
    patterns.push('health-conscious');
  }

  return patterns;
}
