import React, { useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useRecipeStore } from '@/src/stores';
import { RecipeCard, SearchBar, EmptyState } from '@/src/shared/components';

type FilterType = 'all' | 'video' | 'cookbook' | 'manual' | 'favorites';

const FILTERS: { key: FilterType; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: 'all', label: 'All', icon: 'apps-outline' },
  { key: 'favorites', label: 'Favorites', icon: 'heart-outline' },
  { key: 'video', label: 'Video', icon: 'videocam-outline' },
  { key: 'cookbook', label: 'Cookbook', icon: 'book-outline' },
  { key: 'manual', label: 'Manual', icon: 'create-outline' },
];

export default function RecipesScreen() {
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');

  const { recipes, fetchRecipes, toggleFavorite } = useRecipeStore();

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchRecipes();
    setRefreshing(false);
  };

  const filteredRecipes = React.useMemo(() => {
    let filtered = [...recipes];

    // Apply search
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

    // Apply filter
    if (activeFilter === 'favorites') {
      filtered = filtered.filter((r) => r.is_favorite);
    } else if (activeFilter !== 'all') {
      filtered = filtered.filter((r) => r.source_type === activeFilter);
    }

    return filtered;
  }, [recipes, searchQuery, activeFilter]);

  const renderRecipe = ({ item }: { item: (typeof recipes)[0] }) => (
    <View style={{ marginHorizontal: 20, marginBottom: 16 }}>
      <RecipeCard
        recipe={item}
        variant="horizontal"
        onPress={() => router.push(`/recipe/${item.id}`)}
        onFavoritePress={() => toggleFavorite(item.id)}
      />
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
      {/* Search Bar */}
      <View style={{ paddingHorizontal: 20, paddingVertical: 12 }}>
        <SearchBar
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Search recipes..."
        />
      </View>

      {/* Filters */}
      <View style={{ paddingVertical: 8 }}>
        <FlatList
          data={FILTERS}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 20, gap: 8 }}
          keyExtractor={(item) => item.key}
          renderItem={({ item }) => (
            <TouchableOpacity
              onPress={() => setActiveFilter(item.key)}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                paddingHorizontal: 14,
                paddingVertical: 8,
                borderRadius: 20,
                backgroundColor: activeFilter === item.key ? '#FFF7ED' : '#F3F4F6',
                borderWidth: activeFilter === item.key ? 1.5 : 0,
                borderColor: '#F97316',
                gap: 6,
              }}
            >
              <Ionicons
                name={item.icon}
                size={16}
                color={activeFilter === item.key ? '#F97316' : '#6B7280'}
              />
              <Text
                style={{
                  fontSize: 14,
                  fontWeight: '500',
                  color: activeFilter === item.key ? '#F97316' : '#6B7280',
                }}
              >
                {item.label}
              </Text>
            </TouchableOpacity>
          )}
        />
      </View>

      {/* Recipe List */}
      <FlatList
        data={filteredRecipes}
        renderItem={renderRecipe}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingTop: 8, paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#F97316" />
        }
        ListEmptyComponent={
          <EmptyState
            icon="restaurant-outline"
            title={searchQuery ? 'No recipes found' : 'No recipes yet'}
            description={
              searchQuery
                ? 'Try adjusting your search or filters'
                : 'Import recipes from videos or add them manually'
            }
            actionLabel={!searchQuery ? 'Add Recipe' : undefined}
            onAction={!searchQuery ? () => router.push('/(modals)/add-recipe') : undefined}
            style={{ marginTop: 60 }}
          />
        }
      />

      {/* FAB */}
      <TouchableOpacity
        onPress={() => router.push('/(modals)/add-recipe')}
        activeOpacity={0.8}
        style={{
          position: 'absolute',
          right: 20,
          bottom: 20,
          width: 56,
          height: 56,
          borderRadius: 28,
          backgroundColor: '#F97316',
          alignItems: 'center',
          justifyContent: 'center',
          shadowColor: '#F97316',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.3,
          shadowRadius: 8,
          elevation: 5,
        }}
      >
        <Ionicons name="add" size={28} color="#FFFFFF" />
      </TouchableOpacity>
    </View>
  );
}
