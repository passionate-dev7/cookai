import React from 'react';
import { View, Text, TouchableOpacity, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Recipe } from '@/src/types/database';

interface RecipeCardProps {
  recipe: Recipe;
  onPress: () => void;
  onFavoritePress?: () => void;
  variant?: 'default' | 'compact' | 'horizontal';
}

export function RecipeCard({
  recipe,
  onPress,
  onFavoritePress,
  variant = 'default',
}: RecipeCardProps) {
  const getSourceIcon = () => {
    switch (recipe.source_platform) {
      case 'tiktok':
        return 'logo-tiktok';
      case 'instagram':
        return 'logo-instagram';
      case 'youtube':
        return 'logo-youtube';
      default:
        return recipe.source_type === 'cookbook' ? 'book-outline' : 'document-text-outline';
    }
  };

  const formatTime = (minutes: number | null) => {
    if (!minutes) return null;
    if (minutes < 60) return `${minutes} min`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  };

  if (variant === 'compact') {
    return (
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.7}
        style={{
          backgroundColor: '#FFFFFF',
          borderRadius: 12,
          overflow: 'hidden',
          width: 160,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.05,
          shadowRadius: 8,
          elevation: 2,
        }}
      >
        <View style={{ position: 'relative' }}>
          {recipe.image_url ? (
            <Image
              source={{ uri: recipe.image_url }}
              style={{ width: '100%', height: 120 }}
              resizeMode="cover"
            />
          ) : (
            <View
              style={{
                width: '100%',
                height: 120,
                backgroundColor: '#E8EDE4',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Ionicons name="restaurant-outline" size={32} color="#6B7F5E" />
            </View>
          )}
        </View>
        <View style={{ padding: 10 }}>
          <Text
            style={{
              fontSize: 14,
              fontWeight: '600',
              color: '#1F2937',
              marginBottom: 4,
            }}
            numberOfLines={2}
          >
            {recipe.title}
          </Text>
          {recipe.total_time_minutes && (
            <Text style={{ fontSize: 12, color: '#6B7280' }}>
              {formatTime(recipe.total_time_minutes)}
            </Text>
          )}
        </View>
      </TouchableOpacity>
    );
  }

  if (variant === 'horizontal') {
    return (
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.7}
        style={{
          flexDirection: 'row',
          backgroundColor: '#FFFFFF',
          borderRadius: 12,
          overflow: 'hidden',
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.05,
          shadowRadius: 8,
          elevation: 2,
        }}
      >
        {recipe.image_url ? (
          <Image
            source={{ uri: recipe.image_url }}
            style={{ width: 100, height: 100 }}
            resizeMode="cover"
          />
        ) : (
          <View
            style={{
              width: 100,
              height: 100,
              backgroundColor: '#E8EDE4',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Ionicons name="restaurant-outline" size={28} color="#6B7F5E" />
          </View>
        )}
        <View style={{ flex: 1, padding: 12, justifyContent: 'center' }}>
          <Text
            style={{
              fontSize: 16,
              fontWeight: '600',
              color: '#1F2937',
              marginBottom: 4,
            }}
            numberOfLines={2}
          >
            {recipe.title}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            {recipe.total_time_minutes && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Ionicons name="time-outline" size={14} color="#6B7280" />
                <Text style={{ fontSize: 12, color: '#6B7280' }}>
                  {formatTime(recipe.total_time_minutes)}
                </Text>
              </View>
            )}
            {recipe.difficulty && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Ionicons name="speedometer-outline" size={14} color="#6B7280" />
                <Text style={{ fontSize: 12, color: '#6B7280', textTransform: 'capitalize' }}>
                  {recipe.difficulty}
                </Text>
              </View>
            )}
          </View>
        </View>
        {onFavoritePress && (
          <TouchableOpacity
            onPress={onFavoritePress}
            style={{ padding: 12, justifyContent: 'center' }}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons
              name={recipe.is_favorite ? 'heart' : 'heart-outline'}
              size={22}
              color={recipe.is_favorite ? '#EF4444' : '#9CA3AF'}
            />
          </TouchableOpacity>
        )}
      </TouchableOpacity>
    );
  }

  // Default variant
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      style={{
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 12,
        elevation: 3,
      }}
    >
      <View style={{ position: 'relative' }}>
        {recipe.image_url ? (
          <Image
            source={{ uri: recipe.image_url }}
            style={{ width: '100%', height: 180 }}
            resizeMode="cover"
          />
        ) : (
          <View
            style={{
              width: '100%',
              height: 180,
              backgroundColor: '#E8EDE4',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Ionicons name="restaurant-outline" size={48} color="#6B7F5E" />
          </View>
        )}

        {/* Source badge */}
        <View
          style={{
            position: 'absolute',
            top: 12,
            left: 12,
            backgroundColor: 'rgba(0,0,0,0.6)',
            borderRadius: 8,
            paddingHorizontal: 8,
            paddingVertical: 4,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 4,
          }}
        >
          <Ionicons name={getSourceIcon()} size={14} color="#FFFFFF" />
          <Text style={{ fontSize: 12, color: '#FFFFFF', textTransform: 'capitalize' }}>
            {recipe.source_platform || recipe.source_type}
          </Text>
        </View>

        {/* Favorite button */}
        {onFavoritePress && (
          <TouchableOpacity
            onPress={onFavoritePress}
            style={{
              position: 'absolute',
              top: 12,
              right: 12,
              backgroundColor: 'rgba(255,255,255,0.9)',
              borderRadius: 20,
              padding: 8,
            }}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons
              name={recipe.is_favorite ? 'heart' : 'heart-outline'}
              size={20}
              color={recipe.is_favorite ? '#EF4444' : '#374151'}
            />
          </TouchableOpacity>
        )}
      </View>

      <View style={{ padding: 16 }}>
        <Text
          style={{
            fontSize: 18,
            fontWeight: '600',
            color: '#1F2937',
            marginBottom: 8,
          }}
          numberOfLines={2}
        >
          {recipe.title}
        </Text>

        {recipe.description && (
          <Text
            style={{
              fontSize: 14,
              color: '#6B7280',
              marginBottom: 12,
              lineHeight: 20,
            }}
            numberOfLines={2}
          >
            {recipe.description}
          </Text>
        )}

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
          {recipe.total_time_minutes && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Ionicons name="time-outline" size={16} color="#6B7F5E" />
              <Text style={{ fontSize: 14, color: '#374151' }}>
                {formatTime(recipe.total_time_minutes)}
              </Text>
            </View>
          )}

          {recipe.servings && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Ionicons name="people-outline" size={16} color="#6B7F5E" />
              <Text style={{ fontSize: 14, color: '#374151' }}>
                {recipe.servings} servings
              </Text>
            </View>
          )}

          {recipe.difficulty && (
            <View
              style={{
                backgroundColor: recipe.difficulty === 'easy' ? '#D1FAE5' : recipe.difficulty === 'medium' ? '#FEF3C7' : '#FEE2E2',
                paddingHorizontal: 8,
                paddingVertical: 2,
                borderRadius: 4,
              }}
            >
              <Text
                style={{
                  fontSize: 12,
                  fontWeight: '500',
                  color: recipe.difficulty === 'easy' ? '#059669' : recipe.difficulty === 'medium' ? '#D97706' : '#DC2626',
                  textTransform: 'capitalize',
                }}
              >
                {recipe.difficulty}
              </Text>
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
}
