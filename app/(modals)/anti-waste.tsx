import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { suggestLeftoverRecipes, AntiWasteRecipe } from '@/src/services/ai';
import { useRecipeStore, useTasteProfileStore } from '@/src/stores';
import { useColors } from '@/src/theme';

export default function AntiWasteScreen() {
  const router = useRouter();
  const colors = useColors();
  const [ingredients, setIngredients] = useState<string[]>([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState<AntiWasteRecipe[] | null>(null);
  const [tips, setTips] = useState<string[]>([]);
  const [savedRecipeIds, setSavedRecipeIds] = useState<Set<number>>(new Set());

  const addRecipe = useRecipeStore((s) => s.addRecipe);
  const getProfileSummary = useTasteProfileStore((s) => s.getProfileSummary);

  const handleAddIngredient = () => {
    const trimmed = inputText.trim();
    if (!trimmed) return;
    if (ingredients.includes(trimmed.toLowerCase())) return;
    setIngredients((prev) => [...prev, trimmed]);
    setInputText('');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleRemoveIngredient = (index: number) => {
    setIngredients((prev) => prev.filter((_, i) => i !== index));
  };

  const handleGenerate = async () => {
    if (ingredients.length === 0) {
      Alert.alert('Add Ingredients', 'Tell us what leftovers you have first!');
      return;
    }

    setIsLoading(true);
    setResults(null);
    setTips([]);
    setSavedRecipeIds(new Set());
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      const profileSummary = getProfileSummary();
      const result = await suggestLeftoverRecipes({
        leftovers: ingredients,
        tasteProfile: profileSummary,
      });

      if (!result.success) {
        Alert.alert('Error', result.error || 'Failed to generate recipes.');
        return;
      }

      setResults(result.recipes);
      setTips(result.tips);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      console.error('Anti-waste error:', error);
      Alert.alert('Error', 'Something went wrong. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveRecipe = async (recipe: AntiWasteRecipe, index: number) => {
    try {
      const ingredientsList = recipe.ingredients.map((ing, i) => ({
        name: ing.name,
        quantity: ing.quantity,
        unit: ing.unit,
        preparation: null,
        is_optional: false,
        order_index: i,
        ingredient_id: null,
        group_name: null,
      }));

      await addRecipe(
        {
          user_id: '', // Supabase RLS fills this
          title: recipe.title,
          description: recipe.description,
          source_type: 'ai' as const,
          source_url: null,
          source_platform: null,
          image_url: null,
          prep_time_minutes: recipe.prep_time_minutes,
          cook_time_minutes: recipe.cook_time_minutes,
          total_time_minutes: recipe.total_time_minutes,
          servings: recipe.servings,
          difficulty: recipe.difficulty,
          cuisine: null,
          instructions: recipe.instructions,
          notes: `Anti-waste recipe: ${recipe.leftover_usage}`,
          tags: ['anti-waste', 'leftovers'],
          is_favorite: false,
          times_cooked: 0,
          last_cooked_at: null,
          cookbook_id: null,
        },
        ingredientsList
      );
      setSavedRecipeIds((prev) => new Set([...prev, index]));
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      console.error('Save recipe error:', error);
      Alert.alert('Error', 'Failed to save recipe.');
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Header */}
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
        <View>
          <Text style={{ fontSize: 20, fontWeight: '700', color: colors.text }}>
            Anti-Waste Kitchen
          </Text>
          <Text style={{ fontSize: 13, color: colors.textSecondary, marginTop: 2 }}>
            Turn leftovers into delicious meals
          </Text>
        </View>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="close" size={24} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 20 }} keyboardShouldPersistTaps="handled">
        {/* Input Section */}
        {!results && (
          <>
            <Text style={{ fontSize: 16, fontWeight: '600', color: colors.text, marginBottom: 12 }}>
              What leftovers do you have?
            </Text>

            <View style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: colors.surface,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: colors.border,
              paddingHorizontal: 14,
              marginBottom: 16,
            }}>
              <TextInput
                value={inputText}
                onChangeText={setInputText}
                placeholder="e.g., cooked chicken, rice..."
                placeholderTextColor={colors.textTertiary}
                onSubmitEditing={handleAddIngredient}
                returnKeyType="done"
                style={{
                  flex: 1,
                  paddingVertical: 14,
                  fontSize: 16,
                  color: colors.text,
                }}
              />
              <TouchableOpacity onPress={handleAddIngredient}>
                <Ionicons name="add-circle" size={28} color={colors.primary} />
              </TouchableOpacity>
            </View>

            {/* Ingredient Tags */}
            {ingredients.length > 0 && (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
                {ingredients.map((ing, index) => (
                  <TouchableOpacity
                    key={index}
                    onPress={() => handleRemoveIngredient(index)}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      backgroundColor: colors.primaryLight,
                      borderRadius: 20,
                      paddingHorizontal: 14,
                      paddingVertical: 8,
                      gap: 6,
                    }}
                  >
                    <Text style={{ fontSize: 14, color: colors.primary, fontWeight: '500' }}>
                      {ing}
                    </Text>
                    <Ionicons name="close-circle" size={16} color={colors.primary} />
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {/* Quick Add Suggestions */}
            <Text style={{ fontSize: 13, color: colors.textSecondary, marginBottom: 8 }}>
              Common leftovers:
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 24 }}>
              {['Cooked rice', 'Chicken breast', 'Vegetables', 'Bread', 'Pasta', 'Eggs', 'Cheese', 'Beans'].map((item) => (
                <TouchableOpacity
                  key={item}
                  onPress={() => {
                    if (!ingredients.includes(item)) {
                      setIngredients((prev) => [...prev, item]);
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    }
                  }}
                  disabled={ingredients.includes(item)}
                  style={{
                    borderWidth: 1,
                    borderColor: ingredients.includes(item) ? colors.primary : colors.border,
                    backgroundColor: ingredients.includes(item) ? colors.primaryLight : 'transparent',
                    borderRadius: 20,
                    paddingHorizontal: 12,
                    paddingVertical: 6,
                  }}
                >
                  <Text style={{
                    fontSize: 13,
                    color: ingredients.includes(item) ? colors.primary : colors.textSecondary,
                  }}>
                    {item}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Generate Button */}
            <TouchableOpacity
              onPress={handleGenerate}
              disabled={isLoading || ingredients.length === 0}
              activeOpacity={0.8}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: ingredients.length > 0 ? colors.primary : colors.border,
                borderRadius: 14,
                paddingVertical: 16,
                gap: 10,
              }}
            >
              {isLoading ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Ionicons name="leaf-outline" size={20} color="#FFFFFF" />
              )}
              <Text style={{ fontSize: 16, fontWeight: '700', color: '#FFFFFF' }}>
                {isLoading ? 'Finding Recipes...' : 'Save My Leftovers'}
              </Text>
            </TouchableOpacity>
          </>
        )}

        {/* Results */}
        {results && (
          <>
            {/* Back to input */}
            <TouchableOpacity
              onPress={() => setResults(null)}
              style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}
            >
              <Ionicons name="arrow-back" size={18} color={colors.primary} />
              <Text style={{ fontSize: 14, color: colors.primary, marginLeft: 6 }}>Try different ingredients</Text>
            </TouchableOpacity>

            {/* Waste Saved Banner */}
            <View style={{
              backgroundColor: '#ECFDF5',
              borderRadius: 12,
              padding: 16,
              flexDirection: 'row',
              alignItems: 'center',
              marginBottom: 20,
              gap: 12,
            }}>
              <View style={{
                width: 44,
                height: 44,
                borderRadius: 22,
                backgroundColor: '#D1FAE5',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                <Ionicons name="leaf" size={24} color="#059669" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 15, fontWeight: '700', color: '#065F46' }}>
                  {results.length} recipes from your leftovers
                </Text>
                <Text style={{ fontSize: 13, color: '#047857', marginTop: 2 }}>
                  Reduce waste, save money, eat well
                </Text>
              </View>
            </View>

            {/* Recipe Cards */}
            {results.map((recipe, index) => (
              <View
                key={index}
                style={{
                  backgroundColor: colors.surface,
                  borderRadius: 14,
                  padding: 16,
                  marginBottom: 16,
                  borderWidth: 1,
                  borderColor: colors.border,
                }}
              >
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <View style={{ flex: 1, marginRight: 12 }}>
                    <Text style={{ fontSize: 17, fontWeight: '700', color: colors.text }}>
                      {recipe.title}
                    </Text>
                    <Text style={{ fontSize: 13, color: colors.textSecondary, marginTop: 4, lineHeight: 18 }}>
                      {recipe.description}
                    </Text>
                  </View>
                  {recipe.waste_saved_estimate && (
                    <View style={{
                      backgroundColor: '#ECFDF5',
                      paddingHorizontal: 8,
                      paddingVertical: 4,
                      borderRadius: 8,
                    }}>
                      <Text style={{ fontSize: 11, fontWeight: '600', color: '#059669' }}>
                        {recipe.waste_saved_estimate}
                      </Text>
                    </View>
                  )}
                </View>

                {/* Meta */}
                <View style={{ flexDirection: 'row', gap: 12, marginTop: 12 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <Ionicons name="time-outline" size={14} color={colors.textSecondary} />
                    <Text style={{ fontSize: 13, color: colors.textSecondary }}>
                      {recipe.total_time_minutes} min
                    </Text>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <Ionicons name="people-outline" size={14} color={colors.textSecondary} />
                    <Text style={{ fontSize: 13, color: colors.textSecondary }}>
                      {recipe.servings} servings
                    </Text>
                  </View>
                  <View style={{
                    backgroundColor: colors.tagBg,
                    paddingHorizontal: 8,
                    paddingVertical: 2,
                    borderRadius: 4,
                  }}>
                    <Text style={{ fontSize: 12, color: colors.tagText, textTransform: 'capitalize' }}>
                      {recipe.difficulty}
                    </Text>
                  </View>
                </View>

                {/* Leftover Usage */}
                {recipe.leftover_usage && (
                  <View style={{
                    backgroundColor: colors.primaryLight,
                    borderRadius: 8,
                    padding: 10,
                    marginTop: 12,
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 8,
                  }}>
                    <Ionicons name="refresh-outline" size={16} color={colors.primary} />
                    <Text style={{ fontSize: 13, color: colors.primary, flex: 1 }}>
                      {recipe.leftover_usage}
                    </Text>
                  </View>
                )}

                {/* Ingredients Preview */}
                <Text style={{ fontSize: 14, fontWeight: '600', color: colors.text, marginTop: 14, marginBottom: 6 }}>
                  Ingredients
                </Text>
                {recipe.ingredients.map((ing, i) => (
                  <View key={i} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 4 }}>
                    <View style={{
                      width: 6,
                      height: 6,
                      borderRadius: 3,
                      backgroundColor: ing.is_from_leftovers ? colors.primary : colors.textTertiary,
                      marginRight: 8,
                    }} />
                    <Text style={{ fontSize: 14, color: colors.text }}>
                      {ing.quantity && ing.unit ? `${ing.quantity} ${ing.unit} ` : ''}
                      {ing.name}
                    </Text>
                    {ing.is_from_leftovers && (
                      <Text style={{ fontSize: 11, color: colors.primary, marginLeft: 6 }}>leftover</Text>
                    )}
                  </View>
                ))}

                {/* Instructions */}
                <Text style={{ fontSize: 14, fontWeight: '600', color: colors.text, marginTop: 14, marginBottom: 6 }}>
                  Instructions
                </Text>
                {recipe.instructions.map((step, i) => (
                  <View key={i} style={{ flexDirection: 'row', paddingVertical: 4 }}>
                    <Text style={{ fontSize: 13, fontWeight: '600', color: colors.primary, width: 24 }}>
                      {i + 1}.
                    </Text>
                    <Text style={{ fontSize: 14, color: colors.text, flex: 1, lineHeight: 20 }}>
                      {step}
                    </Text>
                  </View>
                ))}

                {/* Save Button */}
                <TouchableOpacity
                  onPress={() => handleSaveRecipe(recipe, index)}
                  disabled={savedRecipeIds.has(index)}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: savedRecipeIds.has(index) ? colors.primaryLight : colors.primary,
                    borderRadius: 10,
                    paddingVertical: 12,
                    marginTop: 14,
                    gap: 8,
                  }}
                >
                  <Ionicons
                    name={savedRecipeIds.has(index) ? 'checkmark-circle' : 'bookmark-outline'}
                    size={18}
                    color={savedRecipeIds.has(index) ? colors.primary : '#FFFFFF'}
                  />
                  <Text style={{
                    fontSize: 14,
                    fontWeight: '600',
                    color: savedRecipeIds.has(index) ? colors.primary : '#FFFFFF',
                  }}>
                    {savedRecipeIds.has(index) ? 'Saved to Recipes' : 'Save Recipe'}
                  </Text>
                </TouchableOpacity>
              </View>
            ))}

            {/* Storage Tips */}
            {tips.length > 0 && (
              <View style={{
                backgroundColor: '#FEF3C7',
                borderRadius: 12,
                padding: 16,
                marginTop: 4,
              }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8, gap: 8 }}>
                  <Ionicons name="bulb-outline" size={18} color="#92400E" />
                  <Text style={{ fontSize: 15, fontWeight: '600', color: '#92400E' }}>
                    Storage Tips
                  </Text>
                </View>
                {tips.map((tip, i) => (
                  <Text key={i} style={{ fontSize: 14, color: '#78350F', lineHeight: 20, marginBottom: 4 }}>
                    {tip}
                  </Text>
                ))}
              </View>
            )}
          </>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}
