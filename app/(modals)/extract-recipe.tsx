import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useRecipeStore, useUserStore, useSubscriptionStore } from '@/src/stores';
import { Button, Input, Card, LoadingSpinner } from '@/src/shared/components';
import { extractRecipeFromUrl, AVAILABLE_MODELS, ModelKey } from '@/src/services/extraction';

type Platform_Type = 'tiktok' | 'instagram' | 'youtube' | 'other';

const PLATFORMS: { key: Platform_Type; label: string; icon: keyof typeof Ionicons.glyphMap; color: string }[] = [
  { key: 'tiktok', label: 'TikTok', icon: 'logo-tiktok', color: '#000000' },
  { key: 'instagram', label: 'Instagram', icon: 'logo-instagram', color: '#E4405F' },
  { key: 'youtube', label: 'YouTube', icon: 'logo-youtube', color: '#FF0000' },
  { key: 'other', label: 'Other', icon: 'link-outline', color: '#6B7280' },
];

export default function ExtractRecipeModal() {
  const router = useRouter();
  const [url, setUrl] = useState('');
  const [selectedPlatform, setSelectedPlatform] = useState<Platform_Type | null>(null);
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractedRecipe, setExtractedRecipe] = useState<any>(null);

  const { addRecipe } = useRecipeStore();
  const { profile } = useUserStore();
  const { isPremium, canExtractRecipe, getRemainingExtractions } = useSubscriptionStore();

  const remainingExtractions = getRemainingExtractions(profile?.extractions_this_month || 0);
  const canExtract = canExtractRecipe(profile?.extractions_this_month || 0);

  const detectPlatform = (inputUrl: string): Platform_Type | null => {
    const lowerUrl = inputUrl.toLowerCase();
    if (lowerUrl.includes('tiktok.com') || lowerUrl.includes('vm.tiktok')) return 'tiktok';
    if (lowerUrl.includes('instagram.com') || lowerUrl.includes('instagr.am')) return 'instagram';
    if (lowerUrl.includes('youtube.com') || lowerUrl.includes('youtu.be')) return 'youtube';
    if (inputUrl.startsWith('http')) return 'other';
    return null;
  };

  const handleUrlChange = (text: string) => {
    setUrl(text);
    const detected = detectPlatform(text);
    if (detected) {
      setSelectedPlatform(detected);
    }
  };

  const handleExtract = async () => {
    if (!url.trim()) {
      Alert.alert('Error', 'Please enter a video URL');
      return;
    }

    if (!canExtract) {
      router.push('/(modals)/paywall');
      return;
    }

    setIsExtracting(true);

    try {
      // Use OpenRouter API for extraction with selected model
      const result = await extractRecipeFromUrl(url, {
        isPremium,
        platform: selectedPlatform || undefined,
      });

      if (result.success && result.recipe) {
        setExtractedRecipe({
          ...result.recipe,
          model_used: result.model_used,
        });
      } else {
        Alert.alert(
          'Extraction Failed',
          result.error || 'Could not extract recipe from this video. Please try again.'
        );
      }
    } catch (error) {
      Alert.alert('Extraction Failed', 'Could not extract recipe from this video. Please try again.');
    } finally {
      setIsExtracting(false);
    }
  };

  const handleSaveRecipe = async () => {
    if (!extractedRecipe) return;

    const { data: { user } } = await (await import('@/src/services/supabase')).supabase.auth.getUser();
    if (!user) {
      Alert.alert('Error', 'Please sign in to save recipes');
      return;
    }

    const recipe = await addRecipe(
      {
        user_id: user.id,
        title: extractedRecipe.title,
        description: extractedRecipe.description,
        source_type: 'video',
        source_url: url,
        source_platform: selectedPlatform,
        image_url: null,
        prep_time_minutes: extractedRecipe.prep_time_minutes,
        cook_time_minutes: extractedRecipe.cook_time_minutes,
        total_time_minutes: extractedRecipe.total_time_minutes,
        servings: extractedRecipe.servings,
        difficulty: extractedRecipe.difficulty,
        cuisine: null,
        tags: [],
        instructions: extractedRecipe.instructions,
        notes: null,
        is_favorite: false,
        times_cooked: 0,
        last_cooked_at: null,
        cookbook_id: null,
      },
      extractedRecipe.ingredients.map((ing: any, index: number) => ({
        name: ing.name,
        quantity: ing.quantity,
        unit: ing.unit,
        preparation: null,
        is_optional: false,
        group_name: null,
        ingredient_id: null,
        order_index: index,
      }))
    );

    if (recipe) {
      router.dismiss();
      router.push(`/recipe/${recipe.id}`);
    }
  };

  if (isExtracting) {
    return (
      <View style={{ flex: 1, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' }}>
        <LoadingSpinner message="Extracting recipe from video..." />
        <Text style={{ fontSize: 14, color: '#6B7280', marginTop: 16, textAlign: 'center', paddingHorizontal: 40 }}>
          This may take a few seconds as we analyze the video content
        </Text>
      </View>
    );
  }

  if (extractedRecipe) {
    return (
      <ScrollView
        style={{ flex: 1, backgroundColor: '#FFFFFF' }}
        contentContainerStyle={{ padding: 20 }}
      >
        <Text style={{ fontSize: 13, color: '#059669', fontWeight: '500', marginBottom: 8 }}>
          Recipe extracted successfully
        </Text>
        <Text style={{ fontSize: 24, fontWeight: '700', color: '#1F2937', marginBottom: 16 }}>
          {extractedRecipe.title}
        </Text>

        <Card variant="outlined" padding="md" style={{ marginBottom: 16 }}>
          <Text style={{ fontSize: 15, fontWeight: '600', color: '#374151', marginBottom: 12 }}>
            Details
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 16 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Ionicons name="time-outline" size={16} color="#6B7F5E" />
              <Text style={{ fontSize: 14, color: '#6B7280' }}>
                {extractedRecipe.total_time_minutes} min
              </Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Ionicons name="people-outline" size={16} color="#6B7F5E" />
              <Text style={{ fontSize: 14, color: '#6B7280' }}>
                {extractedRecipe.servings} servings
              </Text>
            </View>
          </View>
        </Card>

        <Card variant="outlined" padding="md" style={{ marginBottom: 16 }}>
          <Text style={{ fontSize: 15, fontWeight: '600', color: '#374151', marginBottom: 12 }}>
            Ingredients ({extractedRecipe.ingredients.length})
          </Text>
          {extractedRecipe.ingredients.map((ing: any, index: number) => (
            <View key={index} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 8 }}>
              <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#6B7F5E', marginRight: 12 }} />
              <Text style={{ fontSize: 15, color: '#1F2937' }}>
                {ing.quantity} {ing.unit} {ing.name}
              </Text>
            </View>
          ))}
        </Card>

        <Card variant="outlined" padding="md" style={{ marginBottom: 24 }}>
          <Text style={{ fontSize: 15, fontWeight: '600', color: '#374151', marginBottom: 12 }}>
            Instructions ({extractedRecipe.instructions.length} steps)
          </Text>
          {extractedRecipe.instructions.map((step: string, index: number) => (
            <View key={index} style={{ flexDirection: 'row', paddingVertical: 8 }}>
              <View
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: 12,
                  backgroundColor: '#E8EDE4',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginRight: 12,
                }}
              >
                <Text style={{ fontSize: 12, fontWeight: '600', color: '#6B7F5E' }}>{index + 1}</Text>
              </View>
              <Text style={{ flex: 1, fontSize: 15, color: '#1F2937', lineHeight: 22 }}>{step}</Text>
            </View>
          ))}
        </Card>

        <View style={{ gap: 12 }}>
          <Button title="Save Recipe" onPress={handleSaveRecipe} fullWidth />
          <Button
            title="Extract Again"
            onPress={() => setExtractedRecipe(null)}
            variant="outline"
            fullWidth
          />
        </View>
      </ScrollView>
    );
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={{ flex: 1 }}
    >
      <ScrollView
        style={{ flex: 1, backgroundColor: '#FFFFFF' }}
        contentContainerStyle={{ padding: 20 }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Remaining extractions */}
        {!isPremium && (
          <Card
            variant="outlined"
            padding="md"
            style={{ marginBottom: 20, backgroundColor: '#E8EDE4', borderColor: '#6B7F5E' }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <Ionicons name="information-circle" size={24} color="#6B7F5E" />
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 14, fontWeight: '500', color: '#9A3412' }}>
                  {remainingExtractions} extraction{remainingExtractions !== 1 ? 's' : ''} remaining this month
                </Text>
                <TouchableOpacity onPress={() => router.push('/(modals)/paywall')}>
                  <Text style={{ fontSize: 13, color: '#6B7F5E', marginTop: 2 }}>
                    Upgrade for unlimited
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </Card>
        )}

        {/* URL Input */}
        <Input
          label="Video URL"
          value={url}
          onChangeText={handleUrlChange}
          placeholder="Paste TikTok, Instagram, or YouTube URL"
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
          leftIcon="link-outline"
        />

        {/* Platform Selection */}
        <Text style={{ fontSize: 14, fontWeight: '500', color: '#374151', marginBottom: 12 }}>
          Platform (auto-detected)
        </Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 24 }}>
          {PLATFORMS.map((platform) => (
            <TouchableOpacity
              key={platform.key}
              onPress={() => setSelectedPlatform(platform.key)}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                paddingHorizontal: 14,
                paddingVertical: 10,
                borderRadius: 10,
                backgroundColor: selectedPlatform === platform.key ? '#E8EDE4' : '#F3F4F6',
                borderWidth: selectedPlatform === platform.key ? 1.5 : 0,
                borderColor: '#6B7F5E',
                gap: 8,
              }}
            >
              <Ionicons
                name={platform.icon}
                size={18}
                color={selectedPlatform === platform.key ? platform.color : '#6B7280'}
              />
              <Text
                style={{
                  fontSize: 14,
                  fontWeight: '500',
                  color: selectedPlatform === platform.key ? '#1F2937' : '#6B7280',
                }}
              >
                {platform.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* How it works */}
        <Card variant="outlined" padding="md" style={{ marginBottom: 24 }}>
          <Text style={{ fontSize: 15, fontWeight: '600', color: '#374151', marginBottom: 12 }}>
            How it works
          </Text>
          {[
            'Paste a link to any cooking video',
            'We analyze the video and extract the recipe',
            'Review and save to your collection',
          ].map((step, index) => (
            <View key={index} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 6 }}>
              <View
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: 11,
                  backgroundColor: '#E8EDE4',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginRight: 10,
                }}
              >
                <Text style={{ fontSize: 11, fontWeight: '600', color: '#6B7F5E' }}>{index + 1}</Text>
              </View>
              <Text style={{ fontSize: 14, color: '#6B7280' }}>{step}</Text>
            </View>
          ))}
        </Card>

        <Button
          title={canExtract ? 'Extract Recipe' : 'Upgrade to Extract'}
          onPress={handleExtract}
          disabled={!url.trim()}
          fullWidth
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
