import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Image,
  Share,
  Alert,
  Dimensions,
} from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useRecipeStore, useGroceryStore } from '@/src/stores';
import { Button, Card, LoadingSpinner } from '@/src/shared/components';

const { width } = Dimensions.get('window');

export default function RecipeDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'ingredients' | 'instructions'>('ingredients');

  const {
    selectedRecipe,
    fetchRecipeWithIngredients,
    toggleFavorite,
    incrementCookCount,
    deleteRecipe,
    setSelectedRecipe,
  } = useRecipeStore();

  const { activeList, createList, addRecipeToList } = useGroceryStore();

  useEffect(() => {
    if (id) {
      fetchRecipeWithIngredients(id);
    }

    return () => {
      setSelectedRecipe(null);
    };
  }, [id]);

  const handleShare = async () => {
    if (!selectedRecipe) return;
    try {
      await Share.share({
        message: `Check out this recipe: ${selectedRecipe.title}${
          selectedRecipe.source_url ? `\n${selectedRecipe.source_url}` : ''
        }`,
      });
    } catch (error) {
      console.error('Share error:', error);
    }
  };

  const handleFavorite = () => {
    if (!selectedRecipe) return;
    toggleFavorite(selectedRecipe.id);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleCookNow = () => {
    if (!selectedRecipe) return;
    incrementCookCount(selectedRecipe.id);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Alert.alert('Marked as Cooked', 'This recipe has been marked as cooked!');
  };

  const handleAddToGroceryList = async () => {
    if (!selectedRecipe?.ingredients) return;

    let listId = activeList?.id;
    if (!listId) {
      const newList = await createList('Grocery List');
      if (!newList) return;
      listId = newList.id;
    }

    await addRecipeToList(listId, selectedRecipe.id, selectedRecipe.ingredients);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Alert.alert('Added to List', 'Ingredients have been added to your grocery list', [
      { text: 'OK' },
      { text: 'View List', onPress: () => router.push('/(tabs)/grocery') },
    ]);
  };

  const handleDelete = () => {
    Alert.alert('Delete Recipe', 'Are you sure you want to delete this recipe?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          if (selectedRecipe) {
            await deleteRecipe(selectedRecipe.id);
            router.back();
          }
        },
      },
    ]);
  };

  const formatTime = (minutes: number | null) => {
    if (!minutes) return null;
    if (minutes < 60) return `${minutes} min`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  };

  if (!selectedRecipe) {
    return <LoadingSpinner fullScreen message="Loading recipe..." />;
  }

  return (
    <>
      <Stack.Screen
        options={{
          headerRight: () => (
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <TouchableOpacity onPress={handleShare}>
                <Ionicons name="share-outline" size={24} color="#FFFFFF" />
              </TouchableOpacity>
              <TouchableOpacity onPress={handleFavorite}>
                <Ionicons
                  name={selectedRecipe.is_favorite ? 'heart' : 'heart-outline'}
                  size={24}
                  color={selectedRecipe.is_favorite ? '#EF4444' : '#FFFFFF'}
                />
              </TouchableOpacity>
            </View>
          ),
        }}
      />
      <ScrollView
        style={{ flex: 1, backgroundColor: '#FFFFFF' }}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero Image */}
        <View style={{ position: 'relative' }}>
          {selectedRecipe.image_url ? (
            <Image
              source={{ uri: selectedRecipe.image_url }}
              style={{ width, height: 280 }}
              resizeMode="cover"
            />
          ) : (
            <LinearGradient
              colors={['#FFF7ED', '#FFEDD5']}
              style={{
                width,
                height: 280,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Ionicons name="restaurant-outline" size={64} color="#FDBA74" />
            </LinearGradient>
          )}
          <LinearGradient
            colors={['transparent', 'rgba(0,0,0,0.6)']}
            style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              height: 120,
              justifyContent: 'flex-end',
              padding: 20,
            }}
          >
            <Text style={{ fontSize: 24, fontWeight: '700', color: '#FFFFFF', marginBottom: 8 }}>
              {selectedRecipe.title}
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              {selectedRecipe.total_time_minutes && (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <Ionicons name="time-outline" size={16} color="#FFFFFF" />
                  <Text style={{ fontSize: 14, color: '#FFFFFF' }}>
                    {formatTime(selectedRecipe.total_time_minutes)}
                  </Text>
                </View>
              )}
              {selectedRecipe.servings && (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <Ionicons name="people-outline" size={16} color="#FFFFFF" />
                  <Text style={{ fontSize: 14, color: '#FFFFFF' }}>
                    {selectedRecipe.servings} servings
                  </Text>
                </View>
              )}
              {selectedRecipe.difficulty && (
                <View
                  style={{
                    backgroundColor: 'rgba(255,255,255,0.2)',
                    paddingHorizontal: 8,
                    paddingVertical: 2,
                    borderRadius: 4,
                  }}
                >
                  <Text style={{ fontSize: 12, color: '#FFFFFF', textTransform: 'capitalize' }}>
                    {selectedRecipe.difficulty}
                  </Text>
                </View>
              )}
            </View>
          </LinearGradient>
        </View>

        <View style={{ padding: 20 }}>
          {/* Description */}
          {selectedRecipe.description && (
            <Text style={{ fontSize: 15, color: '#6B7280', lineHeight: 22, marginBottom: 20 }}>
              {selectedRecipe.description}
            </Text>
          )}

          {/* Quick Info */}
          <View style={{ flexDirection: 'row', gap: 12, marginBottom: 20 }}>
            {selectedRecipe.prep_time_minutes && (
              <Card variant="outlined" padding="sm" style={{ flex: 1, alignItems: 'center' }}>
                <Text style={{ fontSize: 12, color: '#6B7280', marginBottom: 4 }}>Prep Time</Text>
                <Text style={{ fontSize: 16, fontWeight: '600', color: '#1F2937' }}>
                  {formatTime(selectedRecipe.prep_time_minutes)}
                </Text>
              </Card>
            )}
            {selectedRecipe.cook_time_minutes && (
              <Card variant="outlined" padding="sm" style={{ flex: 1, alignItems: 'center' }}>
                <Text style={{ fontSize: 12, color: '#6B7280', marginBottom: 4 }}>Cook Time</Text>
                <Text style={{ fontSize: 16, fontWeight: '600', color: '#1F2937' }}>
                  {formatTime(selectedRecipe.cook_time_minutes)}
                </Text>
              </Card>
            )}
            <Card variant="outlined" padding="sm" style={{ flex: 1, alignItems: 'center' }}>
              <Text style={{ fontSize: 12, color: '#6B7280', marginBottom: 4 }}>Cooked</Text>
              <Text style={{ fontSize: 16, fontWeight: '600', color: '#1F2937' }}>
                {selectedRecipe.times_cooked}x
              </Text>
            </Card>
          </View>

          {/* Tab Switcher */}
          <View
            style={{
              flexDirection: 'row',
              backgroundColor: '#F3F4F6',
              borderRadius: 12,
              padding: 4,
              marginBottom: 20,
            }}
          >
            <TouchableOpacity
              onPress={() => setActiveTab('ingredients')}
              style={{
                flex: 1,
                paddingVertical: 10,
                borderRadius: 10,
                backgroundColor: activeTab === 'ingredients' ? '#FFFFFF' : 'transparent',
              }}
            >
              <Text
                style={{
                  fontSize: 15,
                  fontWeight: '600',
                  color: activeTab === 'ingredients' ? '#1F2937' : '#6B7280',
                  textAlign: 'center',
                }}
              >
                Ingredients ({selectedRecipe.ingredients?.length || 0})
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setActiveTab('instructions')}
              style={{
                flex: 1,
                paddingVertical: 10,
                borderRadius: 10,
                backgroundColor: activeTab === 'instructions' ? '#FFFFFF' : 'transparent',
              }}
            >
              <Text
                style={{
                  fontSize: 15,
                  fontWeight: '600',
                  color: activeTab === 'instructions' ? '#1F2937' : '#6B7280',
                  textAlign: 'center',
                }}
              >
                Instructions ({selectedRecipe.instructions?.length || 0})
              </Text>
            </TouchableOpacity>
          </View>

          {/* Ingredients Tab */}
          {activeTab === 'ingredients' && (
            <View>
              {selectedRecipe.ingredients?.map((ing, index) => (
                <View
                  key={ing.id || index}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    paddingVertical: 12,
                    borderBottomWidth: index < (selectedRecipe.ingredients?.length || 0) - 1 ? 1 : 0,
                    borderBottomColor: '#F3F4F6',
                  }}
                >
                  <View
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: 4,
                      backgroundColor: '#F97316',
                      marginRight: 12,
                    }}
                  />
                  <Text style={{ flex: 1, fontSize: 16, color: '#1F2937' }}>
                    {ing.quantity && ing.unit
                      ? `${ing.quantity} ${ing.unit} `
                      : ing.quantity
                      ? `${ing.quantity} `
                      : ''}
                    {ing.name}
                    {ing.preparation ? `, ${ing.preparation}` : ''}
                  </Text>
                  {ing.is_optional && (
                    <Text style={{ fontSize: 12, color: '#9CA3AF' }}>optional</Text>
                  )}
                </View>
              ))}
              <Button
                title="Add to Grocery List"
                onPress={handleAddToGroceryList}
                variant="outline"
                fullWidth
                icon={<Ionicons name="cart-outline" size={18} color="#F97316" />}
                style={{ marginTop: 16 }}
              />
            </View>
          )}

          {/* Instructions Tab */}
          {activeTab === 'instructions' && (
            <View>
              {selectedRecipe.instructions?.map((step, index) => (
                <View
                  key={index}
                  style={{
                    flexDirection: 'row',
                    paddingVertical: 16,
                    borderBottomWidth: index < (selectedRecipe.instructions?.length || 0) - 1 ? 1 : 0,
                    borderBottomColor: '#F3F4F6',
                  }}
                >
                  <View
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 16,
                      backgroundColor: '#FFF7ED',
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginRight: 12,
                    }}
                  >
                    <Text style={{ fontSize: 14, fontWeight: '600', color: '#F97316' }}>
                      {index + 1}
                    </Text>
                  </View>
                  <Text style={{ flex: 1, fontSize: 16, color: '#1F2937', lineHeight: 24 }}>
                    {step}
                  </Text>
                </View>
              ))}
            </View>
          )}

          {/* Notes */}
          {selectedRecipe.notes && (
            <Card variant="outlined" padding="md" style={{ marginTop: 24 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                <Ionicons name="document-text-outline" size={18} color="#6B7280" />
                <Text style={{ fontSize: 15, fontWeight: '600', color: '#374151', marginLeft: 8 }}>
                  Notes
                </Text>
              </View>
              <Text style={{ fontSize: 15, color: '#6B7280', lineHeight: 22 }}>
                {selectedRecipe.notes}
              </Text>
            </Card>
          )}

          {/* Action Buttons */}
          <View style={{ marginTop: 24, gap: 12 }}>
            <Button title="Mark as Cooked" onPress={handleCookNow} fullWidth />
            <Button
              title="Delete Recipe"
              onPress={handleDelete}
              variant="ghost"
              fullWidth
              textStyle={{ color: '#EF4444' }}
            />
          </View>
        </View>
      </ScrollView>
    </>
  );
}
