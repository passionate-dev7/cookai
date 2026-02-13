import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Modal,
  FlatList,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useMealPlanStore, MealPlanEntryWithRecipe } from '@/src/stores/mealPlanStore';
import { useRecipeStore, useTasteProfileStore, useGroceryStore } from '@/src/stores';
import { generateMealPlan, MealPlanSuggestion } from '@/src/services/ai';
import { useColors } from '@/src/theme';
import { Recipe } from '@/src/types/database';

const MEAL_TYPES = ['breakfast', 'lunch', 'dinner'] as const;
const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const FULL_DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export default function MealPlannerScreen() {
  const router = useRouter();
  const colors = useColors();
  const [selectedDayIndex, setSelectedDayIndex] = useState(0);
  const [recipePickerVisible, setRecipePickerVisible] = useState(false);
  const [pickingForMealType, setPickingForMealType] = useState<typeof MEAL_TYPES[number]>('dinner');
  const [searchQuery, setSearchQuery] = useState('');

  const {
    currentPlan,
    isLoading,
    isGenerating,
    setIsGenerating,
    fetchCurrentWeekPlan,
    createPlan,
    addEntry,
    deleteEntry,
    getWeekStartDate,
    getDaysOfWeek,
    getEntriesForDay,
  } = useMealPlanStore();

  const recipes = useRecipeStore((s) => s.recipes);
  const getProfileSummary = useTasteProfileStore((s) => s.getProfileSummary);
  const { createList, addRecipeToList, activeList } = useGroceryStore();

  const weekStart = getWeekStartDate();
  const daysOfWeek = getDaysOfWeek(weekStart);
  const selectedDate = daysOfWeek[selectedDayIndex];
  const dayEntries = getEntriesForDay(selectedDate);

  useEffect(() => {
    fetchCurrentWeekPlan();
  }, []);

  // Set today as selected day on load
  useEffect(() => {
    const today = new Date().toISOString().split('T')[0];
    const todayIndex = daysOfWeek.indexOf(today);
    if (todayIndex >= 0) {
      setSelectedDayIndex(todayIndex);
    }
  }, [weekStart]);

  const ensurePlanExists = async () => {
    if (currentPlan) return currentPlan.id;
    const plan = await createPlan(weekStart);
    return plan?.id || null;
  };

  const handleAddMeal = (mealType: typeof MEAL_TYPES[number]) => {
    setPickingForMealType(mealType);
    setRecipePickerVisible(true);
    setSearchQuery('');
  };

  const handleSelectRecipe = async (recipe: Recipe) => {
    setRecipePickerVisible(false);
    const planId = await ensurePlanExists();
    if (!planId) return;

    await addEntry(planId, {
      recipe_id: recipe.id,
      date: selectedDate,
      meal_type: pickingForMealType,
      servings: recipe.servings || 2,
      notes: null,
    });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const handleRemoveEntry = (entry: MealPlanEntryWithRecipe) => {
    Alert.alert('Remove Meal', `Remove ${entry.recipe?.title || 'this meal'} from the plan?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () => deleteEntry(entry.id),
      },
    ]);
  };

  const handleAiGenerate = async () => {
    if (recipes.length === 0) {
      Alert.alert('No Recipes', 'Add some recipes first so AI can plan your week.');
      return;
    }

    setIsGenerating(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      const planId = await ensurePlanExists();
      if (!planId) throw new Error('Could not create plan');

      const profileSummary = getProfileSummary();
      const recipeData = recipes.map((r) => ({
        id: r.id,
        title: r.title,
        cuisine: r.cuisine,
        tags: r.tags || [],
        total_time_minutes: r.total_time_minutes,
        difficulty: r.difficulty,
      }));

      const result = await generateMealPlan({
        availableRecipes: recipeData,
        daysToFill: daysOfWeek,
        mealTypes: ['breakfast', 'lunch', 'dinner'],
        tasteProfile: profileSummary,
      });

      if (!result.success || result.suggestions.length === 0) {
        Alert.alert('Oops', result.error || 'Could not generate a meal plan. Try adding more recipes.');
        return;
      }

      // Convert suggestions to entries
      const entries = result.suggestions.map((s) => ({
        recipe_id: s.recipe_id,
        date: s.date,
        meal_type: s.meal_type,
        servings: 2,
        notes: s.reason || null,
      }));

      const { addAiPlanEntries } = useMealPlanStore.getState();
      await addAiPlanEntries(planId, entries);

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('Plan Created!', `Added ${entries.length} meals to your week.`);
    } catch (error) {
      console.error('AI meal plan error:', error);
      Alert.alert('Error', 'Failed to generate meal plan. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleAddToGroceryList = async () => {
    if (!currentPlan || currentPlan.entries.length === 0) {
      Alert.alert('Empty Plan', 'Add some meals first.');
      return;
    }

    try {
      let listId = activeList?.id;
      if (!listId) {
        const newList = await createList('Meal Plan Groceries');
        if (!newList) return;
        listId = newList.id;
      }

      // Collect all recipe ingredients
      const recipeIds = [...new Set(currentPlan.entries.map((e) => e.recipe_id))];
      for (const entry of currentPlan.entries) {
        if (entry.recipe) {
          // addRecipeToList handles fetching ingredients from Supabase
          await addRecipeToList(listId, entry.recipe_id, entry.recipe.ingredients || []);
        }
      }

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('Added!', 'Ingredients added to your grocery list.', [
        { text: 'OK' },
        { text: 'View List', onPress: () => router.push('/(tabs)/grocery') },
      ]);
    } catch (error) {
      console.error('Failed to add to grocery list:', error);
    }
  };

  const getEntryForMealType = (mealType: string) =>
    dayEntries.filter((e) => e.meal_type === mealType);

  const formatDateLabel = (dateStr: string) => {
    const d = new Date(dateStr + 'T00:00:00');
    return d.getDate().toString();
  };

  const isToday = (dateStr: string) => {
    return dateStr === new Date().toISOString().split('T')[0];
  };

  const totalMeals = currentPlan?.entries.length || 0;

  const filteredRecipes = recipes.filter((r) =>
    searchQuery ? r.title.toLowerCase().includes(searchQuery.toLowerCase()) : true
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Header */}
      <View style={{ paddingTop: 60, paddingHorizontal: 20, paddingBottom: 16, backgroundColor: colors.surface }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <View>
            <Text style={{ fontSize: 28, fontWeight: '700', color: colors.text }}>Meal Plan</Text>
            <Text style={{ fontSize: 14, color: colors.textSecondary, marginTop: 2 }}>
              {totalMeals} meals planned this week
            </Text>
          </View>
          <TouchableOpacity
            onPress={handleAddToGroceryList}
            style={{
              backgroundColor: colors.primaryLight,
              padding: 10,
              borderRadius: 12,
            }}
          >
            <Ionicons name="cart-outline" size={22} color={colors.primary} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Week Day Selector */}
      <View style={{ backgroundColor: colors.surface, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: colors.border }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}>
          {daysOfWeek.map((date, index) => {
            const isSelected = index === selectedDayIndex;
            const today = isToday(date);
            const dayMeals = currentPlan?.entries.filter((e) => e.date === date).length || 0;
            return (
              <TouchableOpacity
                key={date}
                onPress={() => setSelectedDayIndex(index)}
                style={{
                  alignItems: 'center',
                  paddingVertical: 8,
                  paddingHorizontal: 14,
                  borderRadius: 12,
                  backgroundColor: isSelected ? colors.primary : 'transparent',
                  minWidth: 48,
                }}
              >
                <Text style={{
                  fontSize: 12,
                  fontWeight: '500',
                  color: isSelected ? '#FFFFFF' : colors.textSecondary,
                  marginBottom: 4,
                }}>
                  {DAY_NAMES[index]}
                </Text>
                <Text style={{
                  fontSize: 18,
                  fontWeight: '700',
                  color: isSelected ? '#FFFFFF' : today ? colors.primary : colors.text,
                }}>
                  {formatDateLabel(date)}
                </Text>
                {dayMeals > 0 && (
                  <View style={{
                    width: 6,
                    height: 6,
                    borderRadius: 3,
                    backgroundColor: isSelected ? '#FFFFFF' : colors.primary,
                    marginTop: 4,
                  }} />
                )}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Day Content */}
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 20 }}>
        <Text style={{ fontSize: 18, fontWeight: '600', color: colors.text, marginBottom: 16 }}>
          {FULL_DAY_NAMES[selectedDayIndex]}
        </Text>

        {MEAL_TYPES.map((mealType) => {
          const entries = getEntryForMealType(mealType);
          return (
            <View key={mealType} style={{ marginBottom: 20 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                <Ionicons
                  name={
                    mealType === 'breakfast' ? 'sunny-outline' :
                    mealType === 'lunch' ? 'partly-sunny-outline' : 'moon-outline'
                  }
                  size={18}
                  color={colors.textSecondary}
                />
                <Text style={{
                  fontSize: 14,
                  fontWeight: '600',
                  color: colors.textSecondary,
                  marginLeft: 6,
                  textTransform: 'capitalize',
                }}>
                  {mealType}
                </Text>
              </View>

              {entries.length > 0 ? (
                entries.map((entry) => (
                  <TouchableOpacity
                    key={entry.id}
                    onPress={() => entry.recipe && router.push(`/recipe/${entry.recipe.id}`)}
                    onLongPress={() => handleRemoveEntry(entry)}
                    activeOpacity={0.7}
                    style={{
                      backgroundColor: colors.surface,
                      borderRadius: 12,
                      padding: 14,
                      marginBottom: 8,
                      borderWidth: 1,
                      borderColor: colors.border,
                      flexDirection: 'row',
                      alignItems: 'center',
                    }}
                  >
                    <View style={{
                      width: 44,
                      height: 44,
                      borderRadius: 10,
                      backgroundColor: colors.primaryLight,
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginRight: 12,
                    }}>
                      <Ionicons name="restaurant-outline" size={20} color={colors.primary} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 15, fontWeight: '600', color: colors.text }}>
                        {entry.recipe?.title || 'Unknown Recipe'}
                      </Text>
                      {entry.recipe?.total_time_minutes && (
                        <Text style={{ fontSize: 13, color: colors.textSecondary, marginTop: 2 }}>
                          {entry.recipe.total_time_minutes} min
                          {entry.recipe.cuisine ? ` · ${entry.recipe.cuisine}` : ''}
                        </Text>
                      )}
                      {entry.notes && (
                        <Text style={{ fontSize: 12, color: colors.textTertiary, marginTop: 2, fontStyle: 'italic' }}>
                          {entry.notes}
                        </Text>
                      )}
                    </View>
                    <TouchableOpacity onPress={() => handleRemoveEntry(entry)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                      <Ionicons name="close-circle-outline" size={20} color={colors.textTertiary} />
                    </TouchableOpacity>
                  </TouchableOpacity>
                ))
              ) : (
                <TouchableOpacity
                  onPress={() => handleAddMeal(mealType)}
                  style={{
                    borderWidth: 1,
                    borderColor: colors.border,
                    borderStyle: 'dashed',
                    borderRadius: 12,
                    padding: 16,
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexDirection: 'row',
                    gap: 8,
                  }}
                >
                  <Ionicons name="add-circle-outline" size={20} color={colors.textTertiary} />
                  <Text style={{ fontSize: 14, color: colors.textTertiary }}>
                    Add {mealType}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          );
        })}

        {/* AI Generate Button */}
        <TouchableOpacity
          onPress={handleAiGenerate}
          disabled={isGenerating}
          activeOpacity={0.8}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: colors.text,
            borderRadius: 14,
            paddingVertical: 16,
            gap: 10,
            marginTop: 8,
            opacity: isGenerating ? 0.6 : 1,
          }}
        >
          {isGenerating ? (
            <ActivityIndicator color="#FFFFFF" size="small" />
          ) : (
            <Ionicons name="sparkles" size={20} color="#FFFFFF" />
          )}
          <Text style={{ fontSize: 16, fontWeight: '700', color: '#FFFFFF' }}>
            {isGenerating ? 'Planning Your Week...' : 'AI Fill My Week'}
          </Text>
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Recipe Picker Modal */}
      <Modal
        visible={recipePickerVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setRecipePickerVisible(false)}
      >
        <View style={{ flex: 1, backgroundColor: colors.background }}>
          <View style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingHorizontal: 20,
            paddingTop: 16,
            paddingBottom: 12,
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
            backgroundColor: colors.surface,
          }}>
            <Text style={{ fontSize: 18, fontWeight: '700', color: colors.text }}>
              Pick a Recipe
            </Text>
            <TouchableOpacity onPress={() => setRecipePickerVisible(false)}>
              <Ionicons name="close" size={24} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <FlatList
            data={filteredRecipes}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{ padding: 16 }}
            renderItem={({ item }) => (
              <TouchableOpacity
                onPress={() => handleSelectRecipe(item)}
                style={{
                  backgroundColor: colors.surface,
                  borderRadius: 12,
                  padding: 14,
                  marginBottom: 8,
                  borderWidth: 1,
                  borderColor: colors.border,
                  flexDirection: 'row',
                  alignItems: 'center',
                }}
              >
                <View style={{
                  width: 44,
                  height: 44,
                  borderRadius: 10,
                  backgroundColor: colors.primaryLight,
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginRight: 12,
                }}>
                  <Ionicons name="restaurant-outline" size={20} color={colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 15, fontWeight: '600', color: colors.text }}>
                    {item.title}
                  </Text>
                  <Text style={{ fontSize: 13, color: colors.textSecondary, marginTop: 2 }}>
                    {item.total_time_minutes ? `${item.total_time_minutes} min` : ''}
                    {item.cuisine ? ` · ${item.cuisine}` : ''}
                    {item.difficulty ? ` · ${item.difficulty}` : ''}
                  </Text>
                </View>
                <Ionicons name="add-circle" size={24} color={colors.primary} />
              </TouchableOpacity>
            )}
            ListEmptyComponent={
              <View style={{ alignItems: 'center', paddingVertical: 40 }}>
                <Ionicons name="restaurant-outline" size={40} color={colors.textTertiary} />
                <Text style={{ fontSize: 15, color: colors.textSecondary, marginTop: 12 }}>
                  No recipes yet. Add some recipes first!
                </Text>
              </View>
            }
          />
        </View>
      </Modal>
    </View>
  );
}
