import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { zustandStorage } from './storage';
import { Recipe, RecipeIngredient, Cookbook } from '@/src/types/database';
import { supabase } from '@/src/services/supabase';

interface RecipeWithIngredients extends Recipe {
  ingredients?: RecipeIngredient[];
}

interface RecipeState {
  recipes: RecipeWithIngredients[];
  cookbooks: Cookbook[];
  selectedRecipe: RecipeWithIngredients | null;
  selectedCookbook: Cookbook | null;
  isLoading: boolean;
  searchQuery: string;
  filters: {
    sourceType: string | null;
    cuisine: string | null;
    difficulty: string | null;
    isFavorite: boolean | null;
    cookbookId: string | null;
  };

  // Actions
  setRecipes: (recipes: RecipeWithIngredients[]) => void;
  setCookbooks: (cookbooks: Cookbook[]) => void;
  setSelectedRecipe: (recipe: RecipeWithIngredients | null) => void;
  setSelectedCookbook: (cookbook: Cookbook | null) => void;
  setIsLoading: (isLoading: boolean) => void;
  setSearchQuery: (query: string) => void;
  setFilters: (filters: Partial<RecipeState['filters']>) => void;
  clearFilters: () => void;

  // API Actions
  fetchRecipes: () => Promise<void>;
  fetchCookbooks: () => Promise<void>;
  fetchRecipeWithIngredients: (recipeId: string) => Promise<RecipeWithIngredients | null>;
  addRecipe: (recipe: Omit<Recipe, 'id' | 'created_at' | 'updated_at'>, ingredients?: Omit<RecipeIngredient, 'id' | 'recipe_id'>[]) => Promise<RecipeWithIngredients | null>;
  updateRecipe: (recipeId: string, updates: Partial<Recipe>) => Promise<void>;
  deleteRecipe: (recipeId: string) => Promise<void>;
  toggleFavorite: (recipeId: string) => Promise<void>;
  incrementCookCount: (recipeId: string) => Promise<void>;
  addCookbook: (cookbook: Omit<Cookbook, 'id' | 'created_at' | 'updated_at'>) => Promise<Cookbook | null>;
  updateCookbook: (cookbookId: string, updates: Partial<Cookbook>) => Promise<void>;
  deleteCookbook: (cookbookId: string) => Promise<void>;

  // Computed
  getFilteredRecipes: () => RecipeWithIngredients[];
  getFavoriteRecipes: () => RecipeWithIngredients[];
  getRecipesByCookbook: (cookbookId: string) => RecipeWithIngredients[];
  searchRecipes: (query: string) => RecipeWithIngredients[];
  searchRecipesByIngredients: (ingredients: string[]) => { perfect: RecipeWithIngredients[]; partial: RecipeWithIngredients[] };
}

const initialFilters = {
  sourceType: null,
  cuisine: null,
  difficulty: null,
  isFavorite: null,
  cookbookId: null,
};

export const useRecipeStore = create<RecipeState>()(
  persist(
    (set, get) => ({
      recipes: [],
      cookbooks: [],
      selectedRecipe: null,
      selectedCookbook: null,
      isLoading: false,
      searchQuery: '',
      filters: initialFilters,

      setRecipes: (recipes) => set({ recipes }),
      setCookbooks: (cookbooks) => set({ cookbooks }),
      setSelectedRecipe: (recipe) => set({ selectedRecipe: recipe }),
      setSelectedCookbook: (cookbook) => set({ selectedCookbook: cookbook }),
      setIsLoading: (isLoading) => set({ isLoading }),
      setSearchQuery: (query) => set({ searchQuery: query }),
      setFilters: (filters) => set((state) => ({ filters: { ...state.filters, ...filters } })),
      clearFilters: () => set({ filters: initialFilters, searchQuery: '' }),

      fetchRecipes: async () => {
        // Skip if not authenticated
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        set({ isLoading: true });
        try {
          const { data, error } = await supabase
            .from('recipes')
            .select('*')
            .order('created_at', { ascending: false });

          if (error) throw error;
          set({ recipes: data || [] });
        } catch (error) {
          console.error('Failed to fetch recipes:', error);
        } finally {
          set({ isLoading: false });
        }
      },

      fetchCookbooks: async () => {
        // Skip if not authenticated
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        try {
          const { data, error } = await supabase
            .from('cookbooks')
            .select('*')
            .order('title', { ascending: true });

          if (error) throw error;
          set({ cookbooks: data || [] });
        } catch (error) {
          console.error('Failed to fetch cookbooks:', error);
        }
      },

      fetchRecipeWithIngredients: async (recipeId) => {
        try {
          const { data: recipe, error: recipeError } = await supabase
            .from('recipes')
            .select('*')
            .eq('id', recipeId)
            .single();

          if (recipeError) throw recipeError;

          const { data: ingredients, error: ingredientsError } = await supabase
            .from('recipe_ingredients')
            .select('*')
            .eq('recipe_id', recipeId)
            .order('order_index', { ascending: true });

          if (ingredientsError) throw ingredientsError;

          const recipeWithIngredients: RecipeWithIngredients = {
            ...recipe,
            ingredients: ingredients || [],
          };

          set({ selectedRecipe: recipeWithIngredients });
          return recipeWithIngredients;
        } catch (error) {
          console.error('Failed to fetch recipe with ingredients:', error);
          return null;
        }
      },

      addRecipe: async (recipe, ingredients = []) => {
        try {
          const { data: newRecipe, error: recipeError } = await supabase
            .from('recipes')
            .insert(recipe)
            .select()
            .single();

          if (recipeError) throw recipeError;

          if (ingredients.length > 0) {
            const ingredientsWithRecipeId = ingredients.map((ing, index) => ({
              ...ing,
              recipe_id: newRecipe.id,
              order_index: index,
            }));

            const { error: ingredientsError } = await supabase
              .from('recipe_ingredients')
              .insert(ingredientsWithRecipeId);

            if (ingredientsError) throw ingredientsError;
          }

          const recipeWithIngredients: RecipeWithIngredients = {
            ...newRecipe,
            ingredients: ingredients.map((ing, index) => ({
              ...ing,
              id: '',
              recipe_id: newRecipe.id,
              order_index: index,
            })),
          };

          set((state) => ({ recipes: [recipeWithIngredients, ...state.recipes] }));
          return recipeWithIngredients;
        } catch (error) {
          console.error('Failed to add recipe:', error);
          return null;
        }
      },

      updateRecipe: async (recipeId, updates) => {
        try {
          const { error } = await supabase
            .from('recipes')
            .update(updates)
            .eq('id', recipeId);

          if (error) throw error;

          set((state) => ({
            recipes: state.recipes.map((r) =>
              r.id === recipeId ? { ...r, ...updates } : r
            ),
            selectedRecipe:
              state.selectedRecipe?.id === recipeId
                ? { ...state.selectedRecipe, ...updates }
                : state.selectedRecipe,
          }));
        } catch (error) {
          console.error('Failed to update recipe:', error);
        }
      },

      deleteRecipe: async (recipeId) => {
        try {
          const { error } = await supabase
            .from('recipes')
            .delete()
            .eq('id', recipeId);

          if (error) throw error;

          set((state) => ({
            recipes: state.recipes.filter((r) => r.id !== recipeId),
            selectedRecipe:
              state.selectedRecipe?.id === recipeId ? null : state.selectedRecipe,
          }));
        } catch (error) {
          console.error('Failed to delete recipe:', error);
        }
      },

      toggleFavorite: async (recipeId) => {
        const recipe = get().recipes.find((r) => r.id === recipeId);
        if (!recipe) return;

        await get().updateRecipe(recipeId, { is_favorite: !recipe.is_favorite });
      },

      incrementCookCount: async (recipeId) => {
        const recipe = get().recipes.find((r) => r.id === recipeId);
        if (!recipe) return;

        await get().updateRecipe(recipeId, {
          times_cooked: recipe.times_cooked + 1,
          last_cooked_at: new Date().toISOString(),
        });
      },

      addCookbook: async (cookbook) => {
        try {
          const { data, error } = await supabase
            .from('cookbooks')
            .insert(cookbook)
            .select()
            .single();

          if (error) throw error;

          set((state) => ({ cookbooks: [...state.cookbooks, data] }));
          return data;
        } catch (error) {
          console.error('Failed to add cookbook:', error);
          return null;
        }
      },

      updateCookbook: async (cookbookId, updates) => {
        try {
          const { error } = await supabase
            .from('cookbooks')
            .update(updates)
            .eq('id', cookbookId);

          if (error) throw error;

          set((state) => ({
            cookbooks: state.cookbooks.map((c) =>
              c.id === cookbookId ? { ...c, ...updates } : c
            ),
          }));
        } catch (error) {
          console.error('Failed to update cookbook:', error);
        }
      },

      deleteCookbook: async (cookbookId) => {
        try {
          const { error } = await supabase
            .from('cookbooks')
            .delete()
            .eq('id', cookbookId);

          if (error) throw error;

          set((state) => ({
            cookbooks: state.cookbooks.filter((c) => c.id !== cookbookId),
          }));
        } catch (error) {
          console.error('Failed to delete cookbook:', error);
        }
      },

      getFilteredRecipes: () => {
        const { recipes, searchQuery, filters } = get();
        let filtered = [...recipes];

        if (searchQuery) {
          const query = searchQuery.toLowerCase();
          filtered = filtered.filter(
            (r) =>
              r.title.toLowerCase().includes(query) ||
              r.description?.toLowerCase().includes(query) ||
              r.cuisine?.toLowerCase().includes(query) ||
              r.tags.some((t) => t.toLowerCase().includes(query))
          );
        }

        if (filters.sourceType) {
          filtered = filtered.filter((r) => r.source_type === filters.sourceType);
        }

        if (filters.cuisine) {
          filtered = filtered.filter((r) => r.cuisine === filters.cuisine);
        }

        if (filters.difficulty) {
          filtered = filtered.filter((r) => r.difficulty === filters.difficulty);
        }

        if (filters.isFavorite !== null) {
          filtered = filtered.filter((r) => r.is_favorite === filters.isFavorite);
        }

        if (filters.cookbookId) {
          filtered = filtered.filter((r) => r.cookbook_id === filters.cookbookId);
        }

        return filtered;
      },

      getFavoriteRecipes: () => {
        return get().recipes.filter((r) => r.is_favorite);
      },

      getRecipesByCookbook: (cookbookId) => {
        return get().recipes.filter((r) => r.cookbook_id === cookbookId);
      },

      searchRecipes: (query) => {
        const lowercaseQuery = query.toLowerCase();
        return get().recipes.filter(
          (r) =>
            r.title.toLowerCase().includes(lowercaseQuery) ||
            r.description?.toLowerCase().includes(lowercaseQuery) ||
            r.cuisine?.toLowerCase().includes(lowercaseQuery)
        );
      },

      searchRecipesByIngredients: (ingredients) => {
        const { recipes } = get();
        const normalizedInput = ingredients.map(i => i.toLowerCase().trim());

        const results: { recipe: RecipeWithIngredients; matchCount: number; totalIngredients: number }[] = [];

        for (const recipe of recipes) {
          // Get ingredients from the recipe - check both the ingredients array and the title/description for hints
          const recipeIngredients: string[] = [];

          if (recipe.ingredients) {
            recipeIngredients.push(...recipe.ingredients.map(i => i.name.toLowerCase()));
          }

          // Also extract potential ingredients from instructions and title
          const allText = `${recipe.title} ${recipe.description || ''} ${recipe.instructions.join(' ')}`.toLowerCase();

          let matchCount = 0;
          for (const inputIng of normalizedInput) {
            // Check if any recipe ingredient contains the input ingredient
            const hasMatch = recipeIngredients.some(ri =>
              ri.includes(inputIng) || inputIng.includes(ri)
            ) || allText.includes(inputIng);

            if (hasMatch) {
              matchCount++;
            }
          }

          if (matchCount > 0) {
            results.push({
              recipe,
              matchCount,
              totalIngredients: recipeIngredients.length || 5, // Default to 5 if no ingredients stored
            });
          }
        }

        // Sort by match ratio
        results.sort((a, b) => {
          const ratioA = a.matchCount / a.totalIngredients;
          const ratioB = b.matchCount / b.totalIngredients;
          return ratioB - ratioA;
        });

        // Perfect matches: match ratio > 0.7 or matchCount >= 3
        const perfect = results
          .filter(r => r.matchCount / r.totalIngredients > 0.7 || r.matchCount >= 3)
          .map(r => r.recipe);

        // Partial matches: some matches but not perfect
        const partial = results
          .filter(r => r.matchCount / r.totalIngredients <= 0.7 && r.matchCount < 3 && r.matchCount >= 1)
          .map(r => r.recipe)
          .slice(0, 10);

        return { perfect, partial };
      },
    }),
    {
      name: 'recipe-storage',
      storage: createJSONStorage(() => zustandStorage),
      partialize: (state) => ({
        recipes: state.recipes,
        cookbooks: state.cookbooks,
      }),
    }
  )
);
