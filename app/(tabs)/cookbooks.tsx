import React, { useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Image,
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useRecipeStore } from '@/src/stores';
import { SearchBar, EmptyState, Card } from '@/src/shared/components';
import { Cookbook } from '@/src/types/database';

export default function CookbooksScreen() {
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const { cookbooks, fetchCookbooks, recipes } = useRecipeStore();

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchCookbooks();
    setRefreshing(false);
  };

  const filteredCookbooks = React.useMemo(() => {
    if (!searchQuery) return cookbooks;
    const query = searchQuery.toLowerCase();
    return cookbooks.filter(
      (c) =>
        c.title.toLowerCase().includes(query) ||
        c.author?.toLowerCase().includes(query)
    );
  }, [cookbooks, searchQuery]);

  const getRecipeCount = (cookbookId: string) => {
    return recipes.filter((r) => r.cookbook_id === cookbookId).length;
  };

  const renderCookbook = ({ item }: { item: Cookbook }) => (
    <TouchableOpacity
      onPress={() => router.push(`/cookbook/${item.id}`)}
      activeOpacity={0.7}
      style={{ marginHorizontal: 20, marginBottom: 16 }}
    >
      <Card variant="elevated" padding="none">
        <View style={{ flexDirection: 'row' }}>
          {item.cover_image_url ? (
            <Image
              source={{ uri: item.cover_image_url }}
              style={{ width: 100, height: 140, borderTopLeftRadius: 16, borderBottomLeftRadius: 16 }}
              resizeMode="cover"
            />
          ) : (
            <View
              style={{
                width: 100,
                height: 140,
                backgroundColor: '#FFF7ED',
                borderTopLeftRadius: 16,
                borderBottomLeftRadius: 16,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Ionicons name="book-outline" size={36} color="#FDBA74" />
            </View>
          )}
          <View style={{ flex: 1, padding: 14, justifyContent: 'center' }}>
            <Text
              style={{ fontSize: 17, fontWeight: '600', color: '#1F2937', marginBottom: 4 }}
              numberOfLines={2}
            >
              {item.title}
            </Text>
            {item.author && (
              <Text style={{ fontSize: 14, color: '#6B7280', marginBottom: 8 }} numberOfLines={1}>
                by {item.author}
              </Text>
            )}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Ionicons name="restaurant-outline" size={14} color="#F97316" />
                <Text style={{ fontSize: 13, color: '#6B7280' }}>
                  {getRecipeCount(item.id)} recipes
                </Text>
              </View>
              {item.is_scanned && (
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 4,
                    backgroundColor: '#D1FAE5',
                    paddingHorizontal: 8,
                    paddingVertical: 2,
                    borderRadius: 4,
                  }}
                >
                  <Ionicons name="checkmark-circle" size={12} color="#059669" />
                  <Text style={{ fontSize: 11, color: '#059669', fontWeight: '500' }}>
                    Scanned
                  </Text>
                </View>
              )}
            </View>
          </View>
          <View style={{ justifyContent: 'center', paddingRight: 14 }}>
            <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
          </View>
        </View>
      </Card>
    </TouchableOpacity>
  );

  return (
    <View style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
      {/* Search Bar */}
      <View style={{ paddingHorizontal: 20, paddingVertical: 12 }}>
        <SearchBar
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Search cookbooks..."
        />
      </View>

      {/* Cookbook List */}
      <FlatList
        data={filteredCookbooks}
        renderItem={renderCookbook}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingTop: 8, paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#F97316" />
        }
        ListEmptyComponent={
          <EmptyState
            icon="book-outline"
            title={searchQuery ? 'No cookbooks found' : 'No cookbooks yet'}
            description={
              searchQuery
                ? 'Try adjusting your search'
                : 'Add cookbooks to your collection by scanning their barcode or entering details manually'
            }
            actionLabel={!searchQuery ? 'Add Cookbook' : undefined}
            onAction={!searchQuery ? () => router.push('/(modals)/add-cookbook') : undefined}
            style={{ marginTop: 60 }}
          />
        }
      />

      {/* FAB */}
      <TouchableOpacity
        onPress={() => router.push('/(modals)/add-cookbook')}
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
