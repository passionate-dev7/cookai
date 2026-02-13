import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { zustandStorage } from './storage';
import { MealPlan, MealPlanEntry, Recipe } from '@/src/types/database';
import { supabase } from '@/src/services/supabase';

export interface MealPlanEntryWithRecipe extends MealPlanEntry {
  recipe?: Recipe;
}

export interface MealPlanWithEntries extends MealPlan {
  entries: MealPlanEntryWithRecipe[];
}

interface MealPlanState {
  currentPlan: MealPlanWithEntries | null;
  plans: MealPlan[];
  isLoading: boolean;
  isGenerating: boolean;

  // Actions
  setCurrentPlan: (plan: MealPlanWithEntries | null) => void;
  setIsLoading: (loading: boolean) => void;
  setIsGenerating: (generating: boolean) => void;

  // API Actions
  fetchPlans: () => Promise<void>;
  fetchPlanWithEntries: (planId: string) => Promise<MealPlanWithEntries | null>;
  fetchCurrentWeekPlan: () => Promise<MealPlanWithEntries | null>;
  createPlan: (weekStartDate: string) => Promise<MealPlan | null>;
  deletePlan: (planId: string) => Promise<void>;
  addEntry: (planId: string, entry: Omit<MealPlanEntry, 'id' | 'meal_plan_id'>) => Promise<MealPlanEntry | null>;
  updateEntry: (entryId: string, updates: Partial<MealPlanEntry>) => Promise<void>;
  deleteEntry: (entryId: string) => Promise<void>;
  addAiPlanEntries: (planId: string, entries: Omit<MealPlanEntry, 'id' | 'meal_plan_id'>[]) => Promise<void>;

  // Helpers
  getWeekStartDate: (date?: Date) => string;
  getDaysOfWeek: (weekStartDate: string) => string[];
  getEntriesForDay: (date: string) => MealPlanEntryWithRecipe[];
}

export const useMealPlanStore = create<MealPlanState>()(
  persist(
    (set, get) => ({
      currentPlan: null,
      plans: [],
      isLoading: false,
      isGenerating: false,

      setCurrentPlan: (plan) => set({ currentPlan: plan }),
      setIsLoading: (loading) => set({ isLoading: loading }),
      setIsGenerating: (generating) => set({ isGenerating: generating }),

      getWeekStartDate: (date?: Date) => {
        const d = date || new Date();
        const day = d.getDay();
        const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Monday
        const monday = new Date(d.setDate(diff));
        return monday.toISOString().split('T')[0];
      },

      getDaysOfWeek: (weekStartDate: string) => {
        const days: string[] = [];
        const start = new Date(weekStartDate + 'T00:00:00');
        for (let i = 0; i < 7; i++) {
          const d = new Date(start);
          d.setDate(d.getDate() + i);
          days.push(d.toISOString().split('T')[0]);
        }
        return days;
      },

      getEntriesForDay: (date: string) => {
        const plan = get().currentPlan;
        if (!plan) return [];
        return plan.entries.filter((e) => e.date === date);
      },

      fetchPlans: async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        set({ isLoading: true });
        try {
          const { data, error } = await supabase
            .from('meal_plans')
            .select('*')
            .order('week_start_date', { ascending: false })
            .limit(10);

          if (error) throw error;
          set({ plans: data || [] });
        } catch (error) {
          console.error('Failed to fetch meal plans:', error);
        } finally {
          set({ isLoading: false });
        }
      },

      fetchPlanWithEntries: async (planId: string) => {
        try {
          const { data: plan, error: planError } = await supabase
            .from('meal_plans')
            .select('*')
            .eq('id', planId)
            .single();

          if (planError) throw planError;

          const { data: entries, error: entriesError } = await supabase
            .from('meal_plan_entries')
            .select('*')
            .eq('meal_plan_id', planId)
            .order('date', { ascending: true });

          if (entriesError) throw entriesError;

          // Fetch recipes for entries
          const recipeIds = [...new Set((entries || []).map((e) => e.recipe_id))];
          let recipesMap: Record<string, Recipe> = {};

          if (recipeIds.length > 0) {
            const { data: recipes } = await supabase
              .from('recipes')
              .select('*')
              .in('id', recipeIds);

            if (recipes) {
              recipesMap = Object.fromEntries(recipes.map((r) => [r.id, r]));
            }
          }

          const entriesWithRecipes: MealPlanEntryWithRecipe[] = (entries || []).map((e) => ({
            ...e,
            recipe: recipesMap[e.recipe_id],
          }));

          const planWithEntries: MealPlanWithEntries = {
            ...plan,
            entries: entriesWithRecipes,
          };

          set({ currentPlan: planWithEntries });
          return planWithEntries;
        } catch (error) {
          console.error('Failed to fetch meal plan with entries:', error);
          return null;
        }
      },

      fetchCurrentWeekPlan: async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return null;

        const weekStart = get().getWeekStartDate();

        try {
          const { data: plan } = await supabase
            .from('meal_plans')
            .select('*')
            .eq('week_start_date', weekStart)
            .single();

          if (plan) {
            return await get().fetchPlanWithEntries(plan.id);
          }
          return null;
        } catch {
          return null;
        }
      },

      createPlan: async (weekStartDate: string) => {
        try {
          const { data: { user } } = await supabase.auth.getUser();
          if (!user) throw new Error('Not authenticated');

          const { data, error } = await supabase
            .from('meal_plans')
            .insert({ user_id: user.id, week_start_date: weekStartDate })
            .select()
            .single();

          if (error) throw error;

          set((state) => ({
            plans: [data, ...state.plans],
            currentPlan: { ...data, entries: [] },
          }));
          return data;
        } catch (error) {
          console.error('Failed to create meal plan:', error);
          return null;
        }
      },

      deletePlan: async (planId: string) => {
        try {
          const { error } = await supabase
            .from('meal_plans')
            .delete()
            .eq('id', planId);

          if (error) throw error;

          set((state) => ({
            plans: state.plans.filter((p) => p.id !== planId),
            currentPlan: state.currentPlan?.id === planId ? null : state.currentPlan,
          }));
        } catch (error) {
          console.error('Failed to delete meal plan:', error);
        }
      },

      addEntry: async (planId, entry) => {
        try {
          const { data, error } = await supabase
            .from('meal_plan_entries')
            .insert({ meal_plan_id: planId, ...entry })
            .select()
            .single();

          if (error) throw error;

          // Fetch the recipe for this entry
          const { data: recipe } = await supabase
            .from('recipes')
            .select('*')
            .eq('id', entry.recipe_id)
            .single();

          const entryWithRecipe: MealPlanEntryWithRecipe = { ...data, recipe: recipe || undefined };

          set((state) => {
            if (state.currentPlan?.id === planId) {
              return {
                currentPlan: {
                  ...state.currentPlan,
                  entries: [...state.currentPlan.entries, entryWithRecipe],
                },
              };
            }
            return {};
          });

          return data;
        } catch (error) {
          console.error('Failed to add meal plan entry:', error);
          return null;
        }
      },

      updateEntry: async (entryId, updates) => {
        try {
          const { error } = await supabase
            .from('meal_plan_entries')
            .update(updates)
            .eq('id', entryId);

          if (error) throw error;

          set((state) => {
            if (!state.currentPlan) return {};
            return {
              currentPlan: {
                ...state.currentPlan,
                entries: state.currentPlan.entries.map((e) =>
                  e.id === entryId ? { ...e, ...updates } : e
                ),
              },
            };
          });
        } catch (error) {
          console.error('Failed to update meal plan entry:', error);
        }
      },

      deleteEntry: async (entryId) => {
        try {
          const { error } = await supabase
            .from('meal_plan_entries')
            .delete()
            .eq('id', entryId);

          if (error) throw error;

          set((state) => {
            if (!state.currentPlan) return {};
            return {
              currentPlan: {
                ...state.currentPlan,
                entries: state.currentPlan.entries.filter((e) => e.id !== entryId),
              },
            };
          });
        } catch (error) {
          console.error('Failed to delete meal plan entry:', error);
        }
      },

      addAiPlanEntries: async (planId, entries) => {
        try {
          const inserts = entries.map((e) => ({ meal_plan_id: planId, ...e }));
          const { data, error } = await supabase
            .from('meal_plan_entries')
            .insert(inserts)
            .select();

          if (error) throw error;

          // Fetch all recipes
          const recipeIds = [...new Set((data || []).map((e) => e.recipe_id))];
          let recipesMap: Record<string, Recipe> = {};
          if (recipeIds.length > 0) {
            const { data: recipes } = await supabase
              .from('recipes')
              .select('*')
              .in('id', recipeIds);
            if (recipes) {
              recipesMap = Object.fromEntries(recipes.map((r) => [r.id, r]));
            }
          }

          const entriesWithRecipes: MealPlanEntryWithRecipe[] = (data || []).map((e) => ({
            ...e,
            recipe: recipesMap[e.recipe_id],
          }));

          set((state) => {
            if (state.currentPlan?.id === planId) {
              return {
                currentPlan: {
                  ...state.currentPlan,
                  entries: [...state.currentPlan.entries, ...entriesWithRecipes],
                },
              };
            }
            return {};
          });
        } catch (error) {
          console.error('Failed to add AI plan entries:', error);
        }
      },
    }),
    {
      name: 'meal-plan-storage',
      storage: createJSONStorage(() => zustandStorage),
      partialize: (state) => ({
        plans: state.plans,
      }),
    }
  )
);
