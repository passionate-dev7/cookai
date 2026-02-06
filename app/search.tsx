import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useRecipeStore } from '@/src/stores';
import { RecipeCard, Card, Button } from '@/src/shared/components';

// Common ingredients for quick selection
const COMMON_INGREDIENTS = [
  'Chicken', 'Beef', 'Pork', 'Fish', 'Shrimp',
  'Eggs', 'Milk', 'Cheese', 'Butter', 'Cream',
  'Onion', 'Garlic', 'Tomato', 'Potato', 'Carrot',
  'Rice', 'Pasta', 'Bread', 'Flour', 'Oil',
  'Salt', 'Pepper', 'Lemon', 'Lime', 'Ginger',
];

export default function SearchScreen() {
  const router = useRouter();
  const [inputValue, setInputValue] = useState('');
  const [selectedIngredients, setSelectedIngredients] = useState<string[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  const { recipes, searchRecipesByIngredients } = useRecipeStore();

  // Get search results
  const searchResults = selectedIngredients.length > 0
    ? searchRecipesByIngredients(selectedIngredients)
    : { perfect: [], partial: [] };

  const addIngredient = useCallback((ingredient: string) => {
    const normalized = ingredient.trim().toLowerCase();
    if (normalized && !selectedIngredients.includes(normalized)) {
      setSelectedIngredients(prev => [...prev, normalized]);
    }
    setInputValue('');
  }, [selectedIngredients]);

  const removeIngredient = useCallback((ingredient: string) => {
    setSelectedIngredients(prev => prev.filter(i => i !== ingredient));
  }, []);

  const handleSubmit = () => {
    if (inputValue.trim()) {
      addIngredient(inputValue);
    }
  };

  const clearAll = () => {
    setSelectedIngredients([]);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#FFFFFF' }} edges={['top']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        {/* Header */}
        <View style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: 16,
          paddingVertical: 12,
          borderBottomWidth: 1,
          borderBottomColor: '#F3F4F6',
        }}>
          <TouchableOpacity onPress={() => router.back()} style={{ padding: 4 }}>
            <Ionicons name="arrow-back" size={24} color="#1F2937" />
          </TouchableOpacity>
          <Text style={{ flex: 1, fontSize: 18, fontWeight: '600', color: '#1F2937', marginLeft: 12 }}>
            What Can I Make?
          </Text>
        </View>

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingBottom: 40 }}
          keyboardShouldPersistTaps="handled"
        >
          {/* Input Section */}
          <View style={{ padding: 20 }}>
            <Text style={{ fontSize: 15, color: '#6B7280', marginBottom: 12 }}>
              Add ingredients you have and we'll find recipes you can make
            </Text>

            {/* Input */}
            <View style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: '#F3F4F6',
              borderRadius: 12,
              paddingHorizontal: 12,
              marginBottom: 16,
            }}>
              <Ionicons name="search" size={20} color="#9CA3AF" />
              <TextInput
                value={inputValue}
                onChangeText={setInputValue}
                onSubmitEditing={handleSubmit}
                placeholder="Type an ingredient..."
                placeholderTextColor="#9CA3AF"
                returnKeyType="done"
                style={{
                  flex: 1,
                  paddingVertical: 14,
                  paddingHorizontal: 10,
                  fontSize: 16,
                  color: '#1F2937',
                }}
              />
              {inputValue.length > 0 && (
                <TouchableOpacity onPress={handleSubmit}>
                  <Ionicons name="add-circle" size={24} color="#F97316" />
                </TouchableOpacity>
              )}
            </View>

            {/* Selected Ingredients */}
            {selectedIngredients.length > 0 && (
              <View style={{ marginBottom: 16 }}>
                <View style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: 8,
                }}>
                  <Text style={{ fontSize: 14, fontWeight: '500', color: '#374151' }}>
                    Your ingredients ({selectedIngredients.length})
                  </Text>
                  <TouchableOpacity onPress={clearAll}>
                    <Text style={{ fontSize: 14, color: '#F97316' }}>Clear all</Text>
                  </TouchableOpacity>
                </View>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  {selectedIngredients.map((ingredient) => (
                    <TouchableOpacity
                      key={ingredient}
                      onPress={() => removeIngredient(ingredient)}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        backgroundColor: '#FFF7ED',
                        borderRadius: 8,
                        paddingVertical: 6,
                        paddingLeft: 12,
                        paddingRight: 8,
                        gap: 4,
                      }}
                    >
                      <Text style={{ fontSize: 14, color: '#F97316', textTransform: 'capitalize' }}>
                        {ingredient}
                      </Text>
                      <Ionicons name="close-circle" size={18} color="#F97316" />
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}

            {/* Quick Add */}
            {selectedIngredients.length < 5 && (
              <View>
                <Text style={{ fontSize: 14, fontWeight: '500', color: '#374151', marginBottom: 8 }}>
                  Quick add
                </Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  {COMMON_INGREDIENTS
                    .filter(i => !selectedIngredients.includes(i.toLowerCase()))
                    .slice(0, 10)
                    .map((ingredient) => (
                      <TouchableOpacity
                        key={ingredient}
                        onPress={() => addIngredient(ingredient)}
                        style={{
                          backgroundColor: '#F3F4F6',
                          borderRadius: 8,
                          paddingVertical: 6,
                          paddingHorizontal: 12,
                        }}
                      >
                        <Text style={{ fontSize: 14, color: '#6B7280' }}>+ {ingredient}</Text>
                      </TouchableOpacity>
                    ))}
                </View>
              </View>
            )}
          </View>

          {/* Results */}
          {selectedIngredients.length > 0 && (
            <View style={{ paddingHorizontal: 20 }}>
              {/* Perfect Matches */}
              {searchResults.perfect.length > 0 && (
                <View style={{ marginBottom: 24 }}>
                  <Text style={{ fontSize: 18, fontWeight: '600', color: '#1F2937', marginBottom: 12 }}>
                    Perfect Matches ({searchResults.perfect.length})
                  </Text>
                  <Text style={{ fontSize: 14, color: '#059669', marginBottom: 12 }}>
                    You have all the ingredients for these recipes
                  </Text>
                  <View style={{ gap: 12 }}>
                    {searchResults.perfect.map((recipe) => (
                      <RecipeCard
                        key={recipe.id}
                        recipe={recipe}
                        variant="default"
                        onPress={() => router.push(`/recipe/${recipe.id}`)}
                      />
                    ))}
                  </View>
                </View>
              )}

              {/* Partial Matches */}
              {searchResults.partial.length > 0 && (
                <View style={{ marginBottom: 24 }}>
                  <Text style={{ fontSize: 18, fontWeight: '600', color: '#1F2937', marginBottom: 12 }}>
                    Almost There ({searchResults.partial.length})
                  </Text>
                  <Text style={{ fontSize: 14, color: '#6B7280', marginBottom: 12 }}>
                    You're only missing a few ingredients
                  </Text>
                  <View style={{ gap: 12 }}>
                    {searchResults.partial.map((recipe) => (
                      <RecipeCard
                        key={recipe.id}
                        recipe={recipe}
                        variant="default"
                        onPress={() => router.push(`/recipe/${recipe.id}`)}
                      />
                    ))}
                  </View>
                </View>
              )}

              {/* No Results */}
              {searchResults.perfect.length === 0 && searchResults.partial.length === 0 && (
                <Card variant="outlined" padding="lg" style={{ alignItems: 'center' }}>
                  <View style={{
                    width: 64,
                    height: 64,
                    borderRadius: 32,
                    backgroundColor: '#F3F4F6',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: 16,
                  }}>
                    <Ionicons name="search-outline" size={28} color="#9CA3AF" />
                  </View>
                  <Text style={{ fontSize: 16, fontWeight: '600', color: '#1F2937', textAlign: 'center' }}>
                    No matching recipes found
                  </Text>
                  <Text style={{ fontSize: 14, color: '#6B7280', textAlign: 'center', marginTop: 8 }}>
                    Try adding more ingredients or import new recipes to build your collection
                  </Text>
                  <Button
                    title="Import from Video"
                    onPress={() => router.push('/(modals)/extract-recipe')}
                    size="sm"
                    style={{ marginTop: 16 }}
                  />
                </Card>
              )}
            </View>
          )}

          {/* Empty state - no ingredients selected */}
          {selectedIngredients.length === 0 && recipes.length > 0 && (
            <View style={{ paddingHorizontal: 20, alignItems: 'center', paddingTop: 40 }}>
              <View style={{
                width: 80,
                height: 80,
                borderRadius: 40,
                backgroundColor: '#FFF7ED',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 20,
              }}>
                <Ionicons name="restaurant-outline" size={36} color="#F97316" />
              </View>
              <Text style={{ fontSize: 18, fontWeight: '600', color: '#1F2937', textAlign: 'center' }}>
                Add your ingredients
              </Text>
              <Text style={{ fontSize: 15, color: '#6B7280', textAlign: 'center', marginTop: 8, maxWidth: 280 }}>
                Tell us what you have in your kitchen and we'll show you what you can cook
              </Text>
            </View>
          )}

          {/* No recipes */}
          {recipes.length === 0 && (
            <View style={{ paddingHorizontal: 20, alignItems: 'center', paddingTop: 40 }}>
              <View style={{
                width: 80,
                height: 80,
                borderRadius: 40,
                backgroundColor: '#F3F4F6',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 20,
              }}>
                <Ionicons name="book-outline" size={36} color="#9CA3AF" />
              </View>
              <Text style={{ fontSize: 18, fontWeight: '600', color: '#1F2937', textAlign: 'center' }}>
                No recipes yet
              </Text>
              <Text style={{ fontSize: 15, color: '#6B7280', textAlign: 'center', marginTop: 8, maxWidth: 280 }}>
                Add some recipes first, then come back to find what you can make
              </Text>
              <Button
                title="Import from Video"
                onPress={() => router.push('/(modals)/extract-recipe')}
                style={{ marginTop: 20 }}
              />
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
