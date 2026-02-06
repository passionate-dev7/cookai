import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { zustandStorage } from './storage';
import { GroceryList, GroceryItem, RecipeIngredient } from '@/src/types/database';
import { supabase } from '@/src/services/supabase';

interface GroceryListWithItems extends GroceryList {
  items?: GroceryItem[];
}

// Aisle categories for organization
const AISLE_CATEGORIES: Record<string, string[]> = {
  'Produce': ['apple', 'banana', 'tomato', 'lettuce', 'onion', 'garlic', 'potato', 'carrot', 'celery', 'pepper', 'cucumber', 'spinach', 'broccoli', 'lemon', 'lime', 'orange', 'avocado', 'mushroom', 'ginger', 'herb', 'cilantro', 'parsley', 'basil', 'mint'],
  'Meat & Seafood': ['chicken', 'beef', 'pork', 'lamb', 'fish', 'salmon', 'shrimp', 'bacon', 'sausage', 'turkey', 'steak', 'ground'],
  'Dairy & Eggs': ['milk', 'cheese', 'butter', 'cream', 'yogurt', 'egg', 'sour cream', 'cottage', 'mozzarella', 'parmesan', 'cheddar'],
  'Bakery': ['bread', 'roll', 'baguette', 'tortilla', 'pita', 'croissant', 'bagel'],
  'Pantry': ['flour', 'sugar', 'salt', 'pepper', 'oil', 'vinegar', 'sauce', 'paste', 'rice', 'pasta', 'noodle', 'bean', 'lentil', 'stock', 'broth', 'honey', 'syrup', 'vanilla'],
  'Spices': ['cumin', 'paprika', 'oregano', 'thyme', 'rosemary', 'cinnamon', 'nutmeg', 'turmeric', 'cayenne', 'chili', 'curry'],
  'Canned Goods': ['can', 'canned', 'tomato sauce', 'coconut milk', 'chickpea'],
  'Frozen': ['frozen', 'ice cream'],
  'Beverages': ['water', 'juice', 'wine', 'beer', 'soda', 'coffee', 'tea'],
  'Other': [],
};

interface GroceryState {
  lists: GroceryListWithItems[];
  activeList: GroceryListWithItems | null;
  isLoading: boolean;

  // Actions
  setLists: (lists: GroceryListWithItems[]) => void;
  setActiveList: (list: GroceryListWithItems | null) => void;
  setIsLoading: (isLoading: boolean) => void;

  // API Actions
  fetchLists: () => Promise<void>;
  fetchListWithItems: (listId: string) => Promise<GroceryListWithItems | null>;
  createList: (name: string) => Promise<GroceryListWithItems | null>;
  updateList: (listId: string, updates: Partial<GroceryList>) => Promise<void>;
  deleteList: (listId: string) => Promise<void>;
  addItem: (listId: string, item: Omit<GroceryItem, 'id' | 'grocery_list_id' | 'created_at'>) => Promise<GroceryItem | null>;
  updateItem: (itemId: string, updates: Partial<GroceryItem>) => Promise<void>;
  deleteItem: (itemId: string) => Promise<void>;
  toggleItemChecked: (itemId: string) => Promise<void>;
  clearCheckedItems: (listId: string) => Promise<void>;

  // Helpers
  addRecipeToList: (listId: string, recipeId: string, ingredients: RecipeIngredient[]) => Promise<void>;
  mergeIngredients: (items: Omit<GroceryItem, 'id' | 'grocery_list_id' | 'created_at'>[]) => Omit<GroceryItem, 'id' | 'grocery_list_id' | 'created_at'>[];
  getItemsByAisle: (items: GroceryItem[]) => Record<string, GroceryItem[]>;
  categorizeItem: (itemName: string) => string;
}

export const useGroceryStore = create<GroceryState>()(
  persist(
    (set, get) => ({
      lists: [],
      activeList: null,
      isLoading: false,

      setLists: (lists) => set({ lists }),
      setActiveList: (list) => set({ activeList: list }),
      setIsLoading: (isLoading) => set({ isLoading }),

      fetchLists: async () => {
        // Check if user is authenticated before fetching
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          // Not authenticated, skip fetching
          return;
        }

        set({ isLoading: true });
        try {
          const { data, error } = await supabase
            .from('grocery_lists')
            .select('*')
            .order('created_at', { ascending: false });

          if (error) throw error;
          set({ lists: data || [] });

          // Set active list to first active one
          const activeList = data?.find((l) => l.is_active);
          if (activeList) {
            await get().fetchListWithItems(activeList.id);
          }
        } catch (error) {
          console.error('Failed to fetch grocery lists:', error);
        } finally {
          set({ isLoading: false });
        }
      },

      fetchListWithItems: async (listId) => {
        try {
          const { data: list, error: listError } = await supabase
            .from('grocery_lists')
            .select('*')
            .eq('id', listId)
            .single();

          if (listError) throw listError;

          const { data: items, error: itemsError } = await supabase
            .from('grocery_items')
            .select('*')
            .eq('grocery_list_id', listId)
            .order('order_index', { ascending: true });

          if (itemsError) throw itemsError;

          const listWithItems: GroceryListWithItems = {
            ...list,
            items: items || [],
          };

          set({ activeList: listWithItems });
          return listWithItems;
        } catch (error) {
          console.error('Failed to fetch list with items:', error);
          return null;
        }
      },

      createList: async (name) => {
        try {
          // Get current user
          const { data: { user } } = await supabase.auth.getUser();
          if (!user) throw new Error('Not authenticated');

          const { data, error } = await supabase
            .from('grocery_lists')
            .insert({ user_id: user.id, name, is_active: true })
            .select()
            .single();

          if (error) throw error;

          const listWithItems: GroceryListWithItems = { ...data, items: [] };
          set((state) => ({
            lists: [listWithItems, ...state.lists],
            activeList: listWithItems,
          }));
          return listWithItems;
        } catch (error) {
          console.error('Failed to create grocery list:', error);
          return null;
        }
      },

      updateList: async (listId, updates) => {
        try {
          const { error } = await supabase
            .from('grocery_lists')
            .update(updates)
            .eq('id', listId);

          if (error) throw error;

          set((state) => ({
            lists: state.lists.map((l) =>
              l.id === listId ? { ...l, ...updates } : l
            ),
            activeList:
              state.activeList?.id === listId
                ? { ...state.activeList, ...updates }
                : state.activeList,
          }));
        } catch (error) {
          console.error('Failed to update grocery list:', error);
        }
      },

      deleteList: async (listId) => {
        try {
          const { error } = await supabase
            .from('grocery_lists')
            .delete()
            .eq('id', listId);

          if (error) throw error;

          set((state) => ({
            lists: state.lists.filter((l) => l.id !== listId),
            activeList: state.activeList?.id === listId ? null : state.activeList,
          }));
        } catch (error) {
          console.error('Failed to delete grocery list:', error);
        }
      },

      addItem: async (listId, item) => {
        try {
          const aisle = item.aisle || get().categorizeItem(item.name);
          const { data, error } = await supabase
            .from('grocery_items')
            .insert({ ...item, grocery_list_id: listId, aisle })
            .select()
            .single();

          if (error) throw error;

          set((state) => {
            const updatedLists = state.lists.map((l) =>
              l.id === listId
                ? { ...l, items: [...(l.items || []), data] }
                : l
            );
            return {
              lists: updatedLists,
              activeList:
                state.activeList?.id === listId
                  ? { ...state.activeList, items: [...(state.activeList.items || []), data] }
                  : state.activeList,
            };
          });

          return data;
        } catch (error) {
          console.error('Failed to add grocery item:', error);
          return null;
        }
      },

      updateItem: async (itemId, updates) => {
        try {
          const { error } = await supabase
            .from('grocery_items')
            .update(updates)
            .eq('id', itemId);

          if (error) throw error;

          set((state) => {
            const updateItems = (items?: GroceryItem[]) =>
              items?.map((i) => (i.id === itemId ? { ...i, ...updates } : i));

            return {
              lists: state.lists.map((l) => ({
                ...l,
                items: updateItems(l.items),
              })),
              activeList: state.activeList
                ? { ...state.activeList, items: updateItems(state.activeList.items) }
                : null,
            };
          });
        } catch (error) {
          console.error('Failed to update grocery item:', error);
        }
      },

      deleteItem: async (itemId) => {
        try {
          const { error } = await supabase
            .from('grocery_items')
            .delete()
            .eq('id', itemId);

          if (error) throw error;

          set((state) => {
            const filterItems = (items?: GroceryItem[]) =>
              items?.filter((i) => i.id !== itemId);

            return {
              lists: state.lists.map((l) => ({
                ...l,
                items: filterItems(l.items),
              })),
              activeList: state.activeList
                ? { ...state.activeList, items: filterItems(state.activeList.items) }
                : null,
            };
          });
        } catch (error) {
          console.error('Failed to delete grocery item:', error);
        }
      },

      toggleItemChecked: async (itemId) => {
        const { activeList } = get();
        const item = activeList?.items?.find((i) => i.id === itemId);
        if (!item) return;

        await get().updateItem(itemId, { is_checked: !item.is_checked });
      },

      clearCheckedItems: async (listId) => {
        try {
          const { error } = await supabase
            .from('grocery_items')
            .delete()
            .eq('grocery_list_id', listId)
            .eq('is_checked', true);

          if (error) throw error;

          set((state) => {
            const filterItems = (items?: GroceryItem[]) =>
              items?.filter((i) => !i.is_checked);

            return {
              lists: state.lists.map((l) =>
                l.id === listId ? { ...l, items: filterItems(l.items) } : l
              ),
              activeList:
                state.activeList?.id === listId
                  ? { ...state.activeList, items: filterItems(state.activeList.items) }
                  : state.activeList,
            };
          });
        } catch (error) {
          console.error('Failed to clear checked items:', error);
        }
      },

      addRecipeToList: async (listId, recipeId, ingredients) => {
        const items = ingredients.map((ing) => ({
          name: ing.name,
          quantity: ing.quantity,
          unit: ing.unit,
          recipe_id: recipeId,
          ingredient_id: ing.ingredient_id,
          is_checked: false,
          notes: ing.preparation || null,
          order_index: ing.order_index,
          aisle: null,
        }));

        const mergedItems = get().mergeIngredients(items);

        for (const item of mergedItems) {
          await get().addItem(listId, item);
        }
      },

      mergeIngredients: (items) => {
        const merged = new Map<string, typeof items[0]>();

        for (const item of items) {
          const key = `${item.name.toLowerCase()}-${item.unit || ''}`;
          const existing = merged.get(key);

          if (existing && existing.quantity && item.quantity) {
            existing.quantity += item.quantity;
          } else if (!existing) {
            merged.set(key, { ...item });
          }
        }

        return Array.from(merged.values());
      },

      getItemsByAisle: (items) => {
        const grouped: Record<string, GroceryItem[]> = {};

        for (const item of items) {
          const aisle = item.aisle || 'Other';
          if (!grouped[aisle]) {
            grouped[aisle] = [];
          }
          grouped[aisle].push(item);
        }

        return grouped;
      },

      categorizeItem: (itemName) => {
        const lowerName = itemName.toLowerCase();

        for (const [aisle, keywords] of Object.entries(AISLE_CATEGORIES)) {
          if (keywords.some((keyword) => lowerName.includes(keyword))) {
            return aisle;
          }
        }

        return 'Other';
      },
    }),
    {
      name: 'grocery-storage',
      storage: createJSONStorage(() => zustandStorage),
      partialize: (state) => ({
        lists: state.lists,
        activeList: state.activeList,
      }),
    }
  )
);
