import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  FlatList,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useUserStore, useRecipeStore } from '@/src/stores';
import { Card, Button, SearchBar } from '@/src/shared/components';

// Import community recipes - will be populated by the agent
let COMMUNITY_RECIPES: any[] = [];
try {
  const mod = require('@/src/data/community-recipes');
  COMMUNITY_RECIPES = mod.COMMUNITY_RECIPES || [];
} catch {
  // Data not yet available
}

const CATEGORIES = [
  { key: 'all', label: 'All', icon: 'restaurant-outline' as const },
  { key: 'meat', label: 'Meat', icon: 'flame-outline' as const },
  { key: 'seafood', label: 'Seafood', icon: 'fish-outline' as const },
  { key: 'pasta', label: 'Pasta', icon: 'nutrition-outline' as const },
  { key: 'one-pot', label: 'One-Pot', icon: 'bonfire-outline' as const },
  { key: 'breakfast', label: 'Breakfast', icon: 'cafe-outline' as const },
  { key: 'dessert', label: 'Dessert', icon: 'ice-cream-outline' as const },
  { key: 'sides', label: 'Sides', icon: 'leaf-outline' as const },
  { key: 'mexican', label: 'Mexican', icon: 'sunny-outline' as const },
  { key: 'bbq', label: 'BBQ', icon: 'bonfire-outline' as const },
  { key: 'soups', label: 'Soups', icon: 'water-outline' as const },
];

// Map category keys to matching recipe categories
const CATEGORY_MAP: Record<string, string[]> = {
  meat: ['beef', 'pork', 'poultry', 'main-course'],
  bbq: ['barbecue'],
};

export default function DiscoverScreen() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [expandedRecipe, setExpandedRecipe] = useState<string | null>(null);
  const [savingRecipeId, setSavingRecipeId] = useState<string | null>(null);

  const { isAuthenticated } = useUserStore();
  const { addRecipe } = useRecipeStore();

  const filteredRecipes = useMemo(() => {
    let recipes = COMMUNITY_RECIPES;

    if (selectedCategory !== 'all') {
      const matchCategories = CATEGORY_MAP[selectedCategory] || [selectedCategory];
      recipes = recipes.filter(r =>
        matchCategories.includes(r.category?.toLowerCase()) ||
        r.tags?.some((t: string) => matchCategories.includes(t.toLowerCase()))
      );
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      recipes = recipes.filter(r =>
        r.title.toLowerCase().includes(query) ||
        r.description?.toLowerCase().includes(query) ||
        r.ingredients?.some((i: string) => i.toLowerCase().includes(query)) ||
        r.tags?.some((t: string) => t.toLowerCase().includes(query))
      );
    }

    return recipes;
  }, [selectedCategory, searchQuery]);

  const handleSaveRecipe = async (recipe: any) => {
    if (!isAuthenticated) {
      Alert.alert(
        'Sign In Required',
        'Please sign in to save recipes to your collection.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Sign In', onPress: () => router.push('/(tabs)/profile') },
        ]
      );
      return;
    }

    setSavingRecipeId(recipe.id);
    try {
      const { data: { user } } = await (await import('@/src/services/supabase')).supabase.auth.getUser();
      if (!user) {
        Alert.alert('Error', 'Please sign in first');
        return;
      }

      const saved = await addRecipe(
        {
          user_id: user.id,
          title: recipe.title,
          description: recipe.description || null,
          source_type: 'url',
          source_url: recipe.source_url,
          source_platform: null,
          image_url: null,
          prep_time_minutes: null,
          cook_time_minutes: null,
          total_time_minutes: null,
          servings: null,
          difficulty: recipe.difficulty || null,
          cuisine: recipe.category || null,
          tags: recipe.tags || [],
          instructions: recipe.instructions || [],
          notes: `From community recipes (${recipe.source_repo})`,
          is_favorite: false,
          times_cooked: 0,
          last_cooked_at: null,
          cookbook_id: null,
        },
        recipe.ingredients?.map((ing: string, idx: number) => ({
          name: ing,
          quantity: null,
          unit: null,
          preparation: null,
          is_optional: false,
          group_name: null,
          order_index: idx,
          ingredient_id: null,
        }))
      );

      if (saved) {
        Alert.alert('Saved!', `"${recipe.title}" has been added to your recipes.`);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to save recipe. Please try again.');
    } finally {
      setSavingRecipeId(null);
    }
  };

  const renderRecipe = ({ item: recipe }: { item: any }) => {
    const isExpanded = expandedRecipe === recipe.id;

    return (
      <Card
        variant="outlined"
        padding="md"
        style={{ marginHorizontal: 16, marginBottom: 12 }}
      >
        <TouchableOpacity
          onPress={() => setExpandedRecipe(isExpanded ? null : recipe.id)}
          activeOpacity={0.7}
        >
          <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 17, fontWeight: '600', color: '#1F2937', marginBottom: 4 }}>
                {recipe.title}
              </Text>
              {recipe.description ? (
                <Text style={{ fontSize: 14, color: '#6B7280', marginBottom: 8 }} numberOfLines={isExpanded ? undefined : 2}>
                  {recipe.description}
                </Text>
              ) : null}
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                {recipe.category ? (
                  <View style={{
                    backgroundColor: '#FFF7ED', borderRadius: 6,
                    paddingHorizontal: 8, paddingVertical: 3,
                  }}>
                    <Text style={{ fontSize: 12, color: '#F97316', fontWeight: '500' }}>
                      {recipe.category}
                    </Text>
                  </View>
                ) : null}
                {recipe.difficulty ? (
                  <View style={{
                    backgroundColor: '#F0FDF4', borderRadius: 6,
                    paddingHorizontal: 8, paddingVertical: 3,
                  }}>
                    <Text style={{ fontSize: 12, color: '#16A34A', fontWeight: '500' }}>
                      {recipe.difficulty}
                    </Text>
                  </View>
                ) : null}
                <View style={{
                  backgroundColor: '#F3F4F6', borderRadius: 6,
                  paddingHorizontal: 8, paddingVertical: 3,
                }}>
                  <Text style={{ fontSize: 12, color: '#6B7280' }}>
                    {recipe.ingredients?.length || 0} ingredients
                  </Text>
                </View>
              </View>
            </View>
            <Ionicons
              name={isExpanded ? 'chevron-up' : 'chevron-down'}
              size={20}
              color="#9CA3AF"
              style={{ marginLeft: 8, marginTop: 4 }}
            />
          </View>
        </TouchableOpacity>

        {/* Expanded Content */}
        {isExpanded && (
          <View style={{ marginTop: 16, borderTopWidth: 1, borderTopColor: '#F3F4F6', paddingTop: 16 }}>
            {/* Ingredients */}
            {recipe.ingredients?.length > 0 && (
              <View style={{ marginBottom: 16 }}>
                <Text style={{ fontSize: 15, fontWeight: '600', color: '#1F2937', marginBottom: 8 }}>
                  Ingredients
                </Text>
                {recipe.ingredients.map((ing: string, idx: number) => (
                  <Text key={idx} style={{ fontSize: 14, color: '#374151', lineHeight: 22 }}>
                    {'\u2022'} {ing}
                  </Text>
                ))}
              </View>
            )}

            {/* Instructions */}
            {recipe.instructions?.length > 0 && (
              <View style={{ marginBottom: 16 }}>
                <Text style={{ fontSize: 15, fontWeight: '600', color: '#1F2937', marginBottom: 8 }}>
                  Instructions
                </Text>
                {recipe.instructions.map((step: string, idx: number) => (
                  <View key={idx} style={{ flexDirection: 'row', marginBottom: 8 }}>
                    <Text style={{ fontSize: 14, fontWeight: '600', color: '#F97316', width: 24 }}>
                      {idx + 1}.
                    </Text>
                    <Text style={{ fontSize: 14, color: '#374151', flex: 1, lineHeight: 22 }}>
                      {step}
                    </Text>
                  </View>
                ))}
              </View>
            )}

            {/* Save Button */}
            <Button
              title={savingRecipeId === recipe.id ? 'Saving...' : 'Save to My Recipes'}
              onPress={() => handleSaveRecipe(recipe)}
              loading={savingRecipeId === recipe.id}
              fullWidth
              size="sm"
            />
          </View>
        )}
      </Card>
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#FFFFFF' }} edges={['top']}>
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
          Discover Recipes
        </Text>
        <Text style={{ fontSize: 14, color: '#6B7280' }}>
          {COMMUNITY_RECIPES.length} recipes
        </Text>
      </View>

      {/* Search */}
      <View style={{ paddingHorizontal: 16, paddingVertical: 12 }}>
        <SearchBar
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Search community recipes..."
        />
      </View>

      {/* Categories */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 16, gap: 8, paddingBottom: 12 }}
      >
        {CATEGORIES.map((cat) => (
          <TouchableOpacity
            key={cat.key}
            onPress={() => setSelectedCategory(cat.key)}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              paddingHorizontal: 14,
              paddingVertical: 8,
              borderRadius: 20,
              backgroundColor: selectedCategory === cat.key ? '#F97316' : '#F3F4F6',
              gap: 6,
            }}
          >
            <Ionicons
              name={cat.icon}
              size={16}
              color={selectedCategory === cat.key ? '#FFFFFF' : '#6B7280'}
            />
            <Text style={{
              fontSize: 14,
              fontWeight: '500',
              color: selectedCategory === cat.key ? '#FFFFFF' : '#6B7280',
            }}>
              {cat.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Recipes List */}
      {filteredRecipes.length > 0 ? (
        <FlatList
          data={filteredRecipes}
          keyExtractor={(item) => item.id}
          renderItem={renderRecipe}
          contentContainerStyle={{ paddingTop: 8, paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}
        />
      ) : (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 }}>
          <Ionicons name="search-outline" size={48} color="#D1D5DB" />
          <Text style={{ fontSize: 18, fontWeight: '600', color: '#1F2937', marginTop: 16 }}>
            {COMMUNITY_RECIPES.length === 0 ? 'Loading recipes...' : 'No recipes found'}
          </Text>
          <Text style={{ fontSize: 14, color: '#6B7280', textAlign: 'center', marginTop: 8 }}>
            {COMMUNITY_RECIPES.length === 0
              ? 'Community recipes are being set up'
              : 'Try a different search or category'}
          </Text>
        </View>
      )}
    </SafeAreaView>
  );
}
