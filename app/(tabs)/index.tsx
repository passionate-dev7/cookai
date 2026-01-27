import React from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRecipeStore, useUserStore, useSubscriptionStore } from '@/src/stores';
import { RecipeCard, Button, Card } from '@/src/shared/components';

export default function HomeScreen() {
  const router = useRouter();
  const [refreshing, setRefreshing] = React.useState(false);

  const { recipes, fetchRecipes, getFavoriteRecipes } = useRecipeStore();
  const { profile, user } = useUserStore();
  const { isPremium, getRemainingExtractions } = useSubscriptionStore();

  const favoriteRecipes = getFavoriteRecipes();
  const recentRecipes = recipes.slice(0, 5);
  const remainingExtractions = getRemainingExtractions(profile?.extractions_this_month || 0);

  const onRefresh = React.useCallback(async () => {
    setRefreshing(true);
    await fetchRecipes();
    setRefreshing(false);
  }, []);

  const greeting = React.useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  }, []);

  const firstName = profile?.full_name?.split(' ')[0] || 'Chef';

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#FFFFFF' }} edges={['top']}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 24 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#F97316" />
        }
      >
        {/* Header */}
        <View style={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 24 }}>
          <Text style={{ fontSize: 28, fontWeight: '700', color: '#1F2937' }}>
            {greeting}, {firstName}
          </Text>
          <Text style={{ fontSize: 15, color: '#6B7280', marginTop: 4 }}>
            What would you like to cook today?
          </Text>
        </View>

        {/* Quick Actions */}
        <View style={{ paddingHorizontal: 20, marginBottom: 28 }}>
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <TouchableOpacity
              onPress={() => router.push('/(modals)/extract-recipe')}
              activeOpacity={0.9}
              style={{ flex: 1 }}
            >
              <LinearGradient
                colors={['#F97316', '#EA580C']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{
                  borderRadius: 16,
                  padding: 16,
                  minHeight: 110,
                }}
              >
                <View
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 12,
                    backgroundColor: 'rgba(255,255,255,0.2)',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: 12,
                  }}
                >
                  <Ionicons name="videocam-outline" size={24} color="#FFFFFF" />
                </View>
                <Text style={{ fontSize: 16, fontWeight: '600', color: '#FFFFFF' }}>
                  Import Video
                </Text>
                <Text style={{ fontSize: 13, color: 'rgba(255,255,255,0.8)', marginTop: 2 }}>
                  {isPremium ? 'Unlimited' : `${remainingExtractions} left this month`}
                </Text>
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => router.push('/(modals)/add-recipe')}
              activeOpacity={0.9}
              style={{ flex: 1 }}
            >
              <LinearGradient
                colors={['#14B8A6', '#0D9488']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{
                  borderRadius: 16,
                  padding: 16,
                  minHeight: 110,
                }}
              >
                <View
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 12,
                    backgroundColor: 'rgba(255,255,255,0.2)',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: 12,
                  }}
                >
                  <Ionicons name="add-outline" size={24} color="#FFFFFF" />
                </View>
                <Text style={{ fontSize: 16, fontWeight: '600', color: '#FFFFFF' }}>
                  Add Recipe
                </Text>
                <Text style={{ fontSize: 13, color: 'rgba(255,255,255,0.8)', marginTop: 2 }}>
                  Create manually
                </Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>

        {/* What Can I Make */}
        <View style={{ paddingHorizontal: 20, marginBottom: 28 }}>
          <Card
            onPress={() => router.push('/search')}
            variant="outlined"
            padding="md"
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 12,
            }}
          >
            <View
              style={{
                width: 44,
                height: 44,
                borderRadius: 12,
                backgroundColor: '#FFF7ED',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Ionicons name="search-outline" size={22} color="#F97316" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 16, fontWeight: '600', color: '#1F2937' }}>
                What can I make?
              </Text>
              <Text style={{ fontSize: 13, color: '#6B7280' }}>
                Search by ingredients you have
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
          </Card>
        </View>

        {/* Recent Recipes */}
        {recentRecipes.length > 0 && (
          <View style={{ marginBottom: 28 }}>
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
                paddingHorizontal: 20,
                marginBottom: 16,
              }}
            >
              <Text style={{ fontSize: 20, fontWeight: '600', color: '#1F2937' }}>
                Recent Recipes
              </Text>
              <TouchableOpacity onPress={() => router.push('/(tabs)/recipes')}>
                <Text style={{ fontSize: 14, color: '#F97316', fontWeight: '500' }}>
                  See all
                </Text>
              </TouchableOpacity>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: 20, gap: 12 }}
            >
              {recentRecipes.map((recipe) => (
                <RecipeCard
                  key={recipe.id}
                  recipe={recipe}
                  variant="compact"
                  onPress={() => router.push(`/recipe/${recipe.id}`)}
                />
              ))}
            </ScrollView>
          </View>
        )}

        {/* Favorites */}
        {favoriteRecipes.length > 0 && (
          <View style={{ marginBottom: 28 }}>
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
                paddingHorizontal: 20,
                marginBottom: 16,
              }}
            >
              <Text style={{ fontSize: 20, fontWeight: '600', color: '#1F2937' }}>
                Favorites
              </Text>
              <TouchableOpacity
                onPress={() => {
                  router.push('/(tabs)/recipes');
                }}
              >
                <Text style={{ fontSize: 14, color: '#F97316', fontWeight: '500' }}>
                  See all
                </Text>
              </TouchableOpacity>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: 20, gap: 12 }}
            >
              {favoriteRecipes.slice(0, 5).map((recipe) => (
                <RecipeCard
                  key={recipe.id}
                  recipe={recipe}
                  variant="compact"
                  onPress={() => router.push(`/recipe/${recipe.id}`)}
                />
              ))}
            </ScrollView>
          </View>
        )}

        {/* Empty State */}
        {recipes.length === 0 && (
          <View
            style={{
              padding: 40,
              alignItems: 'center',
            }}
          >
            <View
              style={{
                width: 80,
                height: 80,
                borderRadius: 40,
                backgroundColor: '#FFF7ED',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 20,
              }}
            >
              <Ionicons name="restaurant-outline" size={36} color="#F97316" />
            </View>
            <Text
              style={{
                fontSize: 20,
                fontWeight: '600',
                color: '#1F2937',
                textAlign: 'center',
                marginBottom: 8,
              }}
            >
              Start your recipe collection
            </Text>
            <Text
              style={{
                fontSize: 15,
                color: '#6B7280',
                textAlign: 'center',
                lineHeight: 22,
                maxWidth: 280,
                marginBottom: 24,
              }}
            >
              Import recipes from TikTok, Instagram, or YouTube, or add them manually
            </Text>
            <Button
              title="Import from Video"
              onPress={() => router.push('/(modals)/extract-recipe')}
              size="md"
            />
          </View>
        )}

        {/* Upgrade Banner for Free Users */}
        {!isPremium && recipes.length > 0 && (
          <View style={{ paddingHorizontal: 20 }}>
            <TouchableOpacity
              onPress={() => router.push('/(modals)/paywall')}
              activeOpacity={0.9}
            >
              <LinearGradient
                colors={['#1F2937', '#374151']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{
                  borderRadius: 16,
                  padding: 20,
                  flexDirection: 'row',
                  alignItems: 'center',
                }}
              >
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 18, fontWeight: '600', color: '#FFFFFF' }}>
                    Upgrade to Premium
                  </Text>
                  <Text style={{ fontSize: 14, color: '#9CA3AF', marginTop: 4 }}>
                    Unlimited recipes, OCR scanning, and more
                  </Text>
                </View>
                <View
                  style={{
                    paddingHorizontal: 16,
                    paddingVertical: 8,
                    backgroundColor: '#F97316',
                    borderRadius: 8,
                  }}
                >
                  <Text style={{ fontSize: 14, fontWeight: '600', color: '#FFFFFF' }}>
                    Try Free
                  </Text>
                </View>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
