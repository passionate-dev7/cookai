import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Image,
  Alert,
} from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useRecipeStore, useSubscriptionStore } from '@/src/stores';
import { RecipeCard, EmptyState, Button, Card, SearchBar } from '@/src/shared/components';
import { Cookbook, Recipe } from '@/src/types/database';

export default function CookbookDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');

  const { cookbooks, recipes, deleteCookbook, setSelectedCookbook, getRecipesByCookbook } =
    useRecipeStore();
  const { isPremium } = useSubscriptionStore();

  const cookbook = cookbooks.find((c) => c.id === id);
  const cookbookRecipes = cookbook ? getRecipesByCookbook(cookbook.id) : [];

  const filteredRecipes = React.useMemo(() => {
    if (!searchQuery) return cookbookRecipes;
    const query = searchQuery.toLowerCase();
    return cookbookRecipes.filter(
      (r) =>
        r.title.toLowerCase().includes(query) ||
        r.description?.toLowerCase().includes(query)
    );
  }, [cookbookRecipes, searchQuery]);

  useEffect(() => {
    return () => {
      setSelectedCookbook(null);
    };
  }, []);

  const handleScanRecipes = () => {
    if (!isPremium) {
      router.push('/(modals)/paywall');
      return;
    }
    router.push({
      pathname: '/(modals)/ocr-scanner',
      params: { cookbookId: id },
    });
  };

  const handleDelete = () => {
    Alert.alert(
      'Delete Cookbook',
      'Are you sure you want to delete this cookbook? All recipes from this cookbook will remain in your collection.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            if (cookbook) {
              await deleteCookbook(cookbook.id);
              router.back();
            }
          },
        },
      ]
    );
  };

  if (!cookbook) {
    return (
      <EmptyState
        icon="book-outline"
        title="Cookbook not found"
        description="This cookbook may have been deleted"
        actionLabel="Go Back"
        onAction={() => router.back()}
      />
    );
  }

  const renderHeader = () => (
    <>
      {/* Cookbook Info */}
      <View style={{ padding: 20 }}>
        <View style={{ flexDirection: 'row', gap: 16 }}>
          {cookbook.cover_image_url ? (
            <Image
              source={{ uri: cookbook.cover_image_url }}
              style={{ width: 100, height: 140, borderRadius: 12 }}
              resizeMode="cover"
            />
          ) : (
            <View
              style={{
                width: 100,
                height: 140,
                backgroundColor: '#E8EDE4',
                borderRadius: 12,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Ionicons name="book-outline" size={40} color="#6B7F5E" />
            </View>
          )}
          <View style={{ flex: 1, justifyContent: 'center' }}>
            <Text style={{ fontSize: 22, fontWeight: '700', color: '#1F2937', marginBottom: 4 }}>
              {cookbook.title}
            </Text>
            {cookbook.author && (
              <Text style={{ fontSize: 15, color: '#6B7280', marginBottom: 8 }}>
                by {cookbook.author}
              </Text>
            )}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Ionicons name="restaurant-outline" size={14} color="#6B7F5E" />
                <Text style={{ fontSize: 13, color: '#6B7280' }}>
                  {cookbookRecipes.length} recipes
                </Text>
              </View>
              {cookbook.published_year && (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <Ionicons name="calendar-outline" size={14} color="#6B7280" />
                  <Text style={{ fontSize: 13, color: '#6B7280' }}>{cookbook.published_year}</Text>
                </View>
              )}
            </View>
          </View>
        </View>

        {cookbook.description && (
          <Text style={{ fontSize: 15, color: '#6B7280', lineHeight: 22, marginTop: 16 }}>
            {cookbook.description}
          </Text>
        )}
      </View>

      {/* Scan Recipes Card */}
      {!cookbook.is_scanned && (
        <View style={{ paddingHorizontal: 20, marginBottom: 20 }}>
          <Card
            onPress={handleScanRecipes}
            variant="outlined"
            padding="md"
            style={{ backgroundColor: '#E8EDE4', borderColor: '#6B7F5E', borderStyle: 'dashed' }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 12,
                  backgroundColor: '#6B7F5E',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Ionicons name="scan-outline" size={24} color="#FFFFFF" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 16, fontWeight: '600', color: '#1F2937' }}>
                  Scan Recipes
                </Text>
                <Text style={{ fontSize: 13, color: '#6B7280' }}>
                  {isPremium
                    ? 'Use OCR to digitize recipes from this cookbook'
                    : 'Upgrade to Premium to scan recipes'}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
            </View>
          </Card>
        </View>
      )}

      {/* Search Bar */}
      {cookbookRecipes.length > 0 && (
        <View style={{ paddingHorizontal: 20, marginBottom: 16 }}>
          <SearchBar
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search recipes in this cookbook..."
          />
        </View>
      )}

      {/* Section Header */}
      {cookbookRecipes.length > 0 && (
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            paddingHorizontal: 20,
            marginBottom: 12,
          }}
        >
          <Text style={{ fontSize: 18, fontWeight: '600', color: '#1F2937' }}>
            Recipes
          </Text>
          <TouchableOpacity>
            <Text style={{ fontSize: 14, color: '#6B7F5E', fontWeight: '500' }}>Add Recipe</Text>
          </TouchableOpacity>
        </View>
      )}
    </>
  );

  const renderRecipe = ({ item }: { item: Recipe }) => (
    <View style={{ paddingHorizontal: 20, marginBottom: 12 }}>
      <RecipeCard
        recipe={item}
        variant="horizontal"
        onPress={() => router.push(`/recipe/${item.id}`)}
      />
    </View>
  );

  return (
    <>
      <Stack.Screen
        options={{
          headerTitle: cookbook.title,
          headerRight: () => (
            <TouchableOpacity onPress={handleDelete}>
              <Ionicons name="trash-outline" size={22} color="#EF4444" />
            </TouchableOpacity>
          ),
        }}
      />
      <View style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
        <FlatList
          data={filteredRecipes}
          renderItem={renderRecipe}
          keyExtractor={(item) => item.id}
          ListHeaderComponent={renderHeader}
          ListEmptyComponent={
            <EmptyState
              icon="restaurant-outline"
              title={searchQuery ? 'No recipes found' : 'No recipes yet'}
              description={
                searchQuery
                  ? 'Try adjusting your search'
                  : 'Scan recipes from this cookbook or add them manually'
              }
              actionLabel={!searchQuery ? 'Scan Recipes' : undefined}
              onAction={!searchQuery ? handleScanRecipes : undefined}
              style={{ marginTop: 20 }}
            />
          }
          contentContainerStyle={{ paddingBottom: 100 }}
          showsVerticalScrollIndicator={false}
        />
      </View>
    </>
  );
}
