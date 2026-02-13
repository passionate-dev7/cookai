import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Animated,
  Share,
  Keyboard,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { generateRecipeStream, GeneratedRecipe, RecipeGenerationOptions } from '@/src/services/ai';
import { useTasteProfileStore } from '@/src/stores/tasteProfileStore';
import { useRecipeStore, useGroceryStore, useSubscriptionStore } from '@/src/stores';

// ============================================
// Constants
// ============================================

const CUISINES = ['Any', 'Italian', 'Asian', 'Mexican', 'Indian', 'Mediterranean', 'American', 'Japanese', 'Thai', 'French'];
const TIME_OPTIONS = ['Any', '<15min', '<30min', '<1hr'];
const DIFFICULTY_OPTIONS = ['Any', 'Easy', 'Medium', 'Hard'];
const DIETARY_OPTIONS = ['Vegetarian', 'Vegan', 'Gluten-Free', 'Dairy-Free', 'Keto', 'Low-Carb'];

const TIME_MAP: Record<string, number | undefined> = {
  'Any': undefined,
  '<15min': 15,
  '<30min': 30,
  '<1hr': 60,
};

const DIFFICULTY_MAP: Record<string, 'easy' | 'medium' | 'hard' | undefined> = {
  'Any': undefined,
  'Easy': 'easy',
  'Medium': 'medium',
  'Hard': 'hard',
};

type Phase = 'input' | 'streaming' | 'result';

// ============================================
// Component
// ============================================

export default function AIGenerateModal() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const scrollViewRef = useRef<ScrollView>(null);
  const inputRef = useRef<TextInput>(null);
  const abortRef = useRef(false);

  // Stores
  const { addRecipe } = useRecipeStore();
  const { activeList, addItem, createList } = useGroceryStore();
  const { isPremium } = useSubscriptionStore();
  const { trackInteraction, getProfileSummary } = useTasteProfileStore();

  // Phase
  const [phase, setPhase] = useState<Phase>('input');

  // Input state
  const [ingredientInput, setIngredientInput] = useState('');
  const [ingredients, setIngredients] = useState<string[]>([]);
  const [preferencesExpanded, setPreferencesExpanded] = useState(false);
  const [selectedCuisine, setSelectedCuisine] = useState('Any');
  const [selectedTime, setSelectedTime] = useState('Any');
  const [selectedDifficulty, setSelectedDifficulty] = useState('Any');
  const [servings, setServings] = useState(4);
  const [selectedDietary, setSelectedDietary] = useState<string[]>([]);

  // Streaming state
  const [streamingText, setStreamingText] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);

  // Result state
  const [generatedRecipe, setGeneratedRecipe] = useState<GeneratedRecipe | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isAddingToGrocery, setIsAddingToGrocery] = useState(false);
  const [showSaveToast, setShowSaveToast] = useState(false);
  const [showGroceryToast, setShowGroceryToast] = useState(false);

  // Animations
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const toastAnim = useRef(new Animated.Value(0)).current;
  const groceryToastAnim = useRef(new Animated.Value(0)).current;

  // Pulsing dot animation during streaming
  useEffect(() => {
    if (isStreaming) {
      const animation = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 0.3,
            duration: 600,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 600,
            useNativeDriver: true,
          }),
        ])
      );
      animation.start();
      return () => animation.stop();
    } else {
      pulseAnim.setValue(1);
    }
  }, [isStreaming]);

  // Auto-scroll during streaming
  useEffect(() => {
    if (isStreaming && streamingText) {
      const timeout = setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 100);
      return () => clearTimeout(timeout);
    }
  }, [streamingText, isStreaming]);

  // Show toast animation
  const showToastAnimation = useCallback((animValue: Animated.Value, setShow: (v: boolean) => void) => {
    setShow(true);
    Animated.sequence([
      Animated.timing(animValue, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.delay(1800),
      Animated.timing(animValue, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start(() => setShow(false));
  }, []);

  // ============================================
  // Input Handlers
  // ============================================

  const addIngredient = useCallback((text: string) => {
    const items = text
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter((s) => s.length > 0 && !ingredients.includes(s));

    if (items.length > 0) {
      setIngredients((prev) => [...prev, ...items]);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    setIngredientInput('');
  }, [ingredients]);

  const removeIngredient = useCallback((ingredient: string) => {
    setIngredients((prev) => prev.filter((i) => i !== ingredient));
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  const handleInputSubmit = useCallback(() => {
    if (ingredientInput.trim()) {
      addIngredient(ingredientInput);
    }
  }, [ingredientInput, addIngredient]);

  const toggleDietary = useCallback((option: string) => {
    setSelectedDietary((prev) =>
      prev.includes(option) ? prev.filter((d) => d !== option) : [...prev, option]
    );
    Haptics.selectionAsync();
  }, []);

  // ============================================
  // Generation
  // ============================================

  const handleGenerate = useCallback(async () => {
    if (ingredients.length < 2) return;

    Keyboard.dismiss();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    setPhase('streaming');
    setStreamingText('');
    setGeneratedRecipe(null);
    setIsStreaming(true);
    abortRef.current = false;

    const options: RecipeGenerationOptions = {
      ingredients,
      cuisinePreference: selectedCuisine !== 'Any' ? selectedCuisine : undefined,
      dietaryRestrictions: selectedDietary.length > 0 ? selectedDietary : undefined,
      maxCookTime: TIME_MAP[selectedTime],
      difficulty: DIFFICULTY_MAP[selectedDifficulty],
      servings,
      tasteProfile: getProfileSummary(),
      isPremium,
    };

    await generateRecipeStream(
      options,
      // onChunk
      (chunk) => {
        if (abortRef.current) return;
        setStreamingText((prev) => prev + chunk);
      },
      // onComplete
      (recipe) => {
        if (abortRef.current) return;
        setIsStreaming(false);
        if (recipe) {
          setGeneratedRecipe(recipe);
          setPhase('result');
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } else {
          // Could not parse JSON -- stay on streaming view with raw text
          setPhase('result');
        }
      },
      // onError
      (error) => {
        setIsStreaming(false);
        setPhase('input');
        Alert.alert('Generation Failed', error || 'Could not generate a recipe. Please try again.');
      }
    );
  }, [ingredients, selectedCuisine, selectedTime, selectedDifficulty, servings, selectedDietary, isPremium, getProfileSummary]);

  const handleCancel = useCallback(() => {
    abortRef.current = true;
    setIsStreaming(false);
    setPhase('input');
  }, []);

  // ============================================
  // Result Actions
  // ============================================

  const handleSave = useCallback(async () => {
    if (!generatedRecipe) return;

    setIsSaving(true);
    try {
      const { data: { user } } = await (await import('@/src/services/supabase')).supabase.auth.getUser();
      if (!user) {
        Alert.alert('Error', 'Please sign in to save recipes');
        setIsSaving(false);
        return;
      }

      const recipe = await addRecipe(
        {
          user_id: user.id,
          title: generatedRecipe.title,
          description: generatedRecipe.description || null,
          source_type: 'ai',
          source_url: null,
          source_platform: null,
          image_url: null,
          prep_time_minutes: generatedRecipe.prep_time_minutes || null,
          cook_time_minutes: generatedRecipe.cook_time_minutes || null,
          total_time_minutes: generatedRecipe.total_time_minutes || null,
          servings: generatedRecipe.servings || null,
          difficulty: generatedRecipe.difficulty || null,
          cuisine: generatedRecipe.cuisine || null,
          tags: generatedRecipe.tags || [],
          instructions: generatedRecipe.instructions || [],
          notes: generatedRecipe.notes || null,
          is_favorite: false,
          times_cooked: 0,
          last_cooked_at: null,
          cookbook_id: null,
        },
        generatedRecipe.ingredients.map((ing, index) => ({
          name: ing.name,
          quantity: ing.quantity,
          unit: ing.unit,
          preparation: ing.preparation,
          is_optional: ing.is_optional,
          group_name: null,
          ingredient_id: null,
          order_index: index,
        }))
      );

      if (recipe) {
        // Track the interaction for taste profile
        trackInteraction({
          type: 'save',
          recipeId: recipe.id,
          cuisine: generatedRecipe.cuisine,
          ingredients: generatedRecipe.ingredients.map((i) => i.name),
          tags: generatedRecipe.tags,
          difficulty: generatedRecipe.difficulty,
        });

        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        showToastAnimation(toastAnim, setShowSaveToast);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to save recipe. Please try again.');
    } finally {
      setIsSaving(false);
    }
  }, [generatedRecipe, addRecipe, trackInteraction, showToastAnimation, toastAnim]);

  const handleAddToGrocery = useCallback(async () => {
    if (!generatedRecipe) return;

    setIsAddingToGrocery(true);
    try {
      let listId = activeList?.id;

      // Create a new list if none active
      if (!listId) {
        const newList = await createList('AI Recipe Groceries');
        if (!newList) {
          Alert.alert('Error', 'Failed to create grocery list');
          setIsAddingToGrocery(false);
          return;
        }
        listId = newList.id;
      }

      // Add each ingredient to the list
      for (const ing of generatedRecipe.ingredients) {
        await addItem(listId, {
          name: ing.name,
          quantity: ing.quantity,
          unit: ing.unit,
          recipe_id: null,
          ingredient_id: null,
          is_checked: false,
          notes: ing.preparation,
          order_index: 0,
          aisle: null,
        });
      }

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      showToastAnimation(groceryToastAnim, setShowGroceryToast);
    } catch (error) {
      Alert.alert('Error', 'Failed to add ingredients to grocery list.');
    } finally {
      setIsAddingToGrocery(false);
    }
  }, [generatedRecipe, activeList, createList, addItem, showToastAnimation, groceryToastAnim]);

  const handleGenerateAnother = useCallback(() => {
    setPhase('input');
    setStreamingText('');
    setGeneratedRecipe(null);
  }, []);

  const handleShare = useCallback(async () => {
    if (!generatedRecipe) return;

    const ingredientsList = generatedRecipe.ingredients
      .map((ing) => `  ${ing.quantity || ''} ${ing.unit || ''} ${ing.name}${ing.preparation ? ` (${ing.preparation})` : ''}`.trim())
      .join('\n');

    const instructionsList = generatedRecipe.instructions
      .map((step, i) => `${i + 1}. ${step}`)
      .join('\n');

    const message = [
      generatedRecipe.title,
      '',
      generatedRecipe.description,
      '',
      `Servings: ${generatedRecipe.servings} | Time: ${generatedRecipe.total_time_minutes}min | ${generatedRecipe.difficulty}`,
      '',
      'Ingredients:',
      ingredientsList,
      '',
      'Instructions:',
      instructionsList,
      '',
      generatedRecipe.notes ? `Tips: ${generatedRecipe.notes}` : '',
      '',
      'Generated with CookAI',
    ].filter(Boolean).join('\n');

    try {
      await Share.share({ message });
    } catch {
      // User cancelled
    }
  }, [generatedRecipe]);

  // ============================================
  // Render: Input Phase
  // ============================================

  const renderInputPhase = () => (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={{ flex: 1 }}
      keyboardVerticalOffset={0}
    >
      <ScrollView
        ref={scrollViewRef}
        style={{ flex: 1, backgroundColor: '#F5F7F3' }}
        contentContainerStyle={{ padding: 20, paddingBottom: 40 + insets.bottom }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 24 }}>
          <Ionicons name="sparkles" size={24} color="#6B7F5E" style={{ marginRight: 8 }} />
          <Text style={{ fontSize: 22, fontWeight: '700', color: '#1F2937' }}>
            AI Recipe Generator
          </Text>
        </View>

        {/* Ingredient Input */}
        <Text style={{ fontSize: 15, fontWeight: '600', color: '#374151', marginBottom: 8 }}>
          What ingredients do you have?
        </Text>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: '#FFFFFF',
            borderRadius: 12,
            borderWidth: 1.5,
            borderColor: '#E5E7EB',
            paddingHorizontal: 14,
            paddingVertical: Platform.OS === 'ios' ? 12 : 4,
          }}
        >
          <Ionicons name="add-circle-outline" size={20} color="#9CA3AF" style={{ marginRight: 8 }} />
          <TextInput
            ref={inputRef}
            value={ingredientInput}
            onChangeText={setIngredientInput}
            placeholder="Type an ingredient and press enter..."
            placeholderTextColor="#9CA3AF"
            style={{
              flex: 1,
              fontSize: 15,
              color: '#1F2937',
            }}
            returnKeyType="done"
            onSubmitEditing={handleInputSubmit}
            blurOnSubmit={false}
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>

        {/* Ingredient Chips */}
        {ingredients.length > 0 && (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
            {ingredients.map((ingredient) => (
              <TouchableOpacity
                key={ingredient}
                onPress={() => removeIngredient(ingredient)}
                activeOpacity={0.7}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  backgroundColor: '#6B7F5E',
                  paddingHorizontal: 12,
                  paddingVertical: 7,
                  borderRadius: 20,
                  gap: 6,
                }}
              >
                <Text style={{ fontSize: 14, color: '#FFFFFF', fontWeight: '500' }}>
                  {ingredient}
                </Text>
                <Ionicons name="close" size={14} color="#FFFFFF" />
              </TouchableOpacity>
            ))}
          </View>
        )}

        {ingredients.length > 0 && ingredients.length < 2 && (
          <Text style={{ fontSize: 12, color: '#6B7F5E', marginTop: 6, fontStyle: 'italic' }}>
            Add at least {2 - ingredients.length} more ingredient{2 - ingredients.length > 1 ? 's' : ''}
          </Text>
        )}

        {/* Quick Preferences */}
        <TouchableOpacity
          onPress={() => {
            setPreferencesExpanded(!preferencesExpanded);
            Haptics.selectionAsync();
          }}
          activeOpacity={0.7}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginTop: 28,
            marginBottom: 12,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Ionicons name="options-outline" size={18} color="#6B7280" />
            <Text style={{ fontSize: 14, fontWeight: '600', color: '#6B7280' }}>
              Preferences
            </Text>
            {(selectedCuisine !== 'Any' || selectedTime !== 'Any' || selectedDifficulty !== 'Any' || selectedDietary.length > 0) && (
              <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#6B7F5E' }} />
            )}
          </View>
          <Ionicons
            name={preferencesExpanded ? 'chevron-up' : 'chevron-down'}
            size={18}
            color="#6B7280"
          />
        </TouchableOpacity>

        {preferencesExpanded && (
          <View style={{ marginBottom: 8 }}>
            {/* Divider */}
            <View style={{ height: 1, backgroundColor: '#E5E7EB', marginBottom: 16 }} />

            {/* Cuisine */}
            <Text style={{ fontSize: 13, fontWeight: '500', color: '#6B7280', marginBottom: 8 }}>
              Cuisine
            </Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 8, paddingRight: 20 }}
              style={{ marginBottom: 16 }}
            >
              {CUISINES.map((cuisine) => (
                <TouchableOpacity
                  key={cuisine}
                  onPress={() => {
                    setSelectedCuisine(cuisine);
                    Haptics.selectionAsync();
                  }}
                  style={{
                    paddingHorizontal: 14,
                    paddingVertical: 8,
                    borderRadius: 20,
                    backgroundColor: selectedCuisine === cuisine ? '#E8EDE4' : '#F3F4F6',
                    borderWidth: selectedCuisine === cuisine ? 1.5 : 0,
                    borderColor: '#6B7F5E',
                  }}
                >
                  <Text
                    style={{
                      fontSize: 13,
                      fontWeight: '500',
                      color: selectedCuisine === cuisine ? '#6B7F5E' : '#6B7280',
                    }}
                  >
                    {cuisine}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* Time */}
            <Text style={{ fontSize: 13, fontWeight: '500', color: '#6B7280', marginBottom: 8 }}>
              Time
            </Text>
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
              {TIME_OPTIONS.map((time) => (
                <TouchableOpacity
                  key={time}
                  onPress={() => {
                    setSelectedTime(time);
                    Haptics.selectionAsync();
                  }}
                  style={{
                    paddingHorizontal: 14,
                    paddingVertical: 8,
                    borderRadius: 20,
                    backgroundColor: selectedTime === time ? '#E8EDE4' : '#F3F4F6',
                    borderWidth: selectedTime === time ? 1.5 : 0,
                    borderColor: '#6B7F5E',
                  }}
                >
                  <Text
                    style={{
                      fontSize: 13,
                      fontWeight: '500',
                      color: selectedTime === time ? '#6B7F5E' : '#6B7280',
                    }}
                  >
                    {time}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Difficulty */}
            <Text style={{ fontSize: 13, fontWeight: '500', color: '#6B7280', marginBottom: 8 }}>
              Difficulty
            </Text>
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
              {DIFFICULTY_OPTIONS.map((diff) => (
                <TouchableOpacity
                  key={diff}
                  onPress={() => {
                    setSelectedDifficulty(diff);
                    Haptics.selectionAsync();
                  }}
                  style={{
                    paddingHorizontal: 14,
                    paddingVertical: 8,
                    borderRadius: 20,
                    backgroundColor: selectedDifficulty === diff ? '#E8EDE4' : '#F3F4F6',
                    borderWidth: selectedDifficulty === diff ? 1.5 : 0,
                    borderColor: '#6B7F5E',
                  }}
                >
                  <Text
                    style={{
                      fontSize: 13,
                      fontWeight: '500',
                      color: selectedDifficulty === diff ? '#6B7F5E' : '#6B7280',
                    }}
                  >
                    {diff}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Servings Stepper */}
            <Text style={{ fontSize: 13, fontWeight: '500', color: '#6B7280', marginBottom: 8 }}>
              Servings
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 16 }}>
              <TouchableOpacity
                onPress={() => {
                  if (servings > 1) {
                    setServings(servings - 1);
                    Haptics.selectionAsync();
                  }
                }}
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 18,
                  backgroundColor: servings > 1 ? '#E8EDE4' : '#F3F4F6',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderWidth: 1.5,
                  borderColor: servings > 1 ? '#6B7F5E' : '#E5E7EB',
                }}
              >
                <Ionicons name="remove" size={18} color={servings > 1 ? '#6B7F5E' : '#9CA3AF'} />
              </TouchableOpacity>
              <Text style={{ fontSize: 18, fontWeight: '700', color: '#1F2937', minWidth: 24, textAlign: 'center' }}>
                {servings}
              </Text>
              <TouchableOpacity
                onPress={() => {
                  if (servings < 8) {
                    setServings(servings + 1);
                    Haptics.selectionAsync();
                  }
                }}
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 18,
                  backgroundColor: servings < 8 ? '#E8EDE4' : '#F3F4F6',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderWidth: 1.5,
                  borderColor: servings < 8 ? '#6B7F5E' : '#E5E7EB',
                }}
              >
                <Ionicons name="add" size={18} color={servings < 8 ? '#6B7F5E' : '#9CA3AF'} />
              </TouchableOpacity>
            </View>

            {/* Dietary */}
            <Text style={{ fontSize: 13, fontWeight: '500', color: '#6B7280', marginBottom: 8 }}>
              Dietary
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
              {DIETARY_OPTIONS.map((option) => {
                const isSelected = selectedDietary.includes(option);
                return (
                  <TouchableOpacity
                    key={option}
                    onPress={() => toggleDietary(option)}
                    style={{
                      paddingHorizontal: 14,
                      paddingVertical: 8,
                      borderRadius: 20,
                      backgroundColor: isSelected ? '#E8EDE4' : '#F3F4F6',
                      borderWidth: isSelected ? 1.5 : 0,
                      borderColor: '#6B7F5E',
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 13,
                        fontWeight: '500',
                        color: isSelected ? '#6B7F5E' : '#6B7280',
                      }}
                    >
                      {option}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Divider */}
            <View style={{ height: 1, backgroundColor: '#E5E7EB', marginTop: 8 }} />
          </View>
        )}

        {/* Generate Button */}
        <TouchableOpacity
          onPress={handleGenerate}
          disabled={ingredients.length < 2}
          activeOpacity={0.8}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: ingredients.length >= 2 ? '#6B7F5E' : '#B8C4AE',
            paddingVertical: 16,
            borderRadius: 14,
            marginTop: 24,
            gap: 8,
            shadowColor: ingredients.length >= 2 ? '#6B7F5E' : 'transparent',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.3,
            shadowRadius: 8,
            elevation: ingredients.length >= 2 ? 4 : 0,
          }}
        >
          <Ionicons name="sparkles" size={20} color="#FFFFFF" />
          <Text style={{ fontSize: 17, fontWeight: '700', color: '#FFFFFF' }}>
            Generate Recipe
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );

  // ============================================
  // Render: Streaming Phase
  // ============================================

  const renderStreamingPhase = () => (
    <ScrollView
      ref={scrollViewRef}
      style={{ flex: 1, backgroundColor: '#F5F7F3' }}
      contentContainerStyle={{ padding: 20, paddingBottom: 40 + insets.bottom }}
      showsVerticalScrollIndicator={false}
    >
      {/* Streaming Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 20 }}>
        <Animated.View
          style={{
            width: 10,
            height: 10,
            borderRadius: 5,
            backgroundColor: '#6B7F5E',
            marginRight: 10,
            opacity: pulseAnim,
          }}
        />
        <Text style={{ fontSize: 15, fontWeight: '600', color: '#6B7F5E' }}>
          Creating your recipe...
        </Text>
      </View>

      {/* Recipe Card */}
      <View
        style={{
          backgroundColor: '#FFFFFF',
          borderRadius: 16,
          padding: 20,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.08,
          shadowRadius: 12,
          elevation: 3,
          minHeight: 200,
        }}
      >
        <Text
          style={{
            fontSize: 15,
            color: '#374151',
            lineHeight: 24,
          }}
        >
          {streamingText}
          {isStreaming && (
            <Text style={{ color: '#6B7F5E' }}>{'\u2588'}</Text>
          )}
        </Text>
      </View>

      {/* Cancel Button */}
      {isStreaming && (
        <TouchableOpacity
          onPress={handleCancel}
          activeOpacity={0.7}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#FFFFFF',
            paddingVertical: 14,
            borderRadius: 12,
            marginTop: 16,
            borderWidth: 1.5,
            borderColor: '#E5E7EB',
            gap: 6,
          }}
        >
          <Ionicons name="stop-circle-outline" size={18} color="#6B7280" />
          <Text style={{ fontSize: 15, fontWeight: '600', color: '#6B7280' }}>
            Cancel
          </Text>
        </TouchableOpacity>
      )}
    </ScrollView>
  );

  // ============================================
  // Render: Result Phase
  // ============================================

  const renderResultPhase = () => {
    if (!generatedRecipe) {
      // Fallback: display raw streaming text if JSON parse failed
      return (
        <ScrollView
          style={{ flex: 1, backgroundColor: '#F5F7F3' }}
          contentContainerStyle={{ padding: 20, paddingBottom: 40 + insets.bottom }}
          showsVerticalScrollIndicator={false}
        >
          <View
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: 16,
              padding: 20,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.08,
              shadowRadius: 12,
              elevation: 3,
            }}
          >
            <Text style={{ fontSize: 15, color: '#374151', lineHeight: 24 }}>
              {streamingText}
            </Text>
          </View>

          <TouchableOpacity
            onPress={handleGenerateAnother}
            activeOpacity={0.7}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: '#FFFFFF',
              paddingVertical: 14,
              borderRadius: 12,
              marginTop: 16,
              borderWidth: 2,
              borderColor: '#6B7F5E',
              gap: 6,
            }}
          >
            <Ionicons name="refresh-outline" size={18} color="#6B7F5E" />
            <Text style={{ fontSize: 15, fontWeight: '600', color: '#6B7F5E' }}>
              Generate Another
            </Text>
          </TouchableOpacity>
        </ScrollView>
      );
    }

    return (
      <ScrollView
        style={{ flex: 1, backgroundColor: '#F5F7F3' }}
        contentContainerStyle={{ padding: 20, paddingBottom: 24 + insets.bottom }}
        showsVerticalScrollIndicator={false}
      >
        {/* Recipe Card */}
        <View
          style={{
            backgroundColor: '#FFFFFF',
            borderRadius: 16,
            padding: 20,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.08,
            shadowRadius: 12,
            elevation: 3,
            marginBottom: 16,
          }}
        >
          {/* Title */}
          <Text style={{ fontSize: 22, fontWeight: '700', color: '#1F2937', marginBottom: 8 }}>
            {generatedRecipe.title}
          </Text>

          {/* Description */}
          {generatedRecipe.description ? (
            <Text style={{ fontSize: 15, color: '#6B7280', lineHeight: 22, marginBottom: 16 }}>
              {generatedRecipe.description}
            </Text>
          ) : null}

          {/* Badges */}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
            {generatedRecipe.total_time_minutes > 0 && (
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  backgroundColor: '#E8EDE4',
                  paddingHorizontal: 10,
                  paddingVertical: 6,
                  borderRadius: 8,
                  gap: 4,
                }}
              >
                <Ionicons name="time-outline" size={14} color="#6B7F5E" />
                <Text style={{ fontSize: 12, fontWeight: '600', color: '#5C6E50' }}>
                  {generatedRecipe.total_time_minutes} min
                </Text>
              </View>
            )}
            {generatedRecipe.servings > 0 && (
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  backgroundColor: '#F0EBE4',
                  paddingHorizontal: 10,
                  paddingVertical: 6,
                  borderRadius: 8,
                  gap: 4,
                }}
              >
                <Ionicons name="people-outline" size={14} color="#8B6F4E" />
                <Text style={{ fontSize: 12, fontWeight: '600', color: '#7A6340' }}>
                  {generatedRecipe.servings} servings
                </Text>
              </View>
            )}
            {generatedRecipe.difficulty && (
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  backgroundColor: '#FFF1F2',
                  paddingHorizontal: 10,
                  paddingVertical: 6,
                  borderRadius: 8,
                  gap: 4,
                }}
              >
                <Ionicons name="speedometer-outline" size={14} color="#C4704B" />
                <Text style={{ fontSize: 12, fontWeight: '600', color: '#E11D48', textTransform: 'capitalize' }}>
                  {generatedRecipe.difficulty}
                </Text>
              </View>
            )}
            {generatedRecipe.cuisine && (
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  backgroundColor: '#F5F3FF',
                  paddingHorizontal: 10,
                  paddingVertical: 6,
                  borderRadius: 8,
                  gap: 4,
                }}
              >
                <Ionicons name="restaurant-outline" size={14} color="#7C3AED" />
                <Text style={{ fontSize: 12, fontWeight: '600', color: '#6D28D9' }}>
                  {generatedRecipe.cuisine}
                </Text>
              </View>
            )}
          </View>

          {/* Divider */}
          <View style={{ height: 1, backgroundColor: '#E5E7EB', marginBottom: 16 }} />

          {/* Ingredients */}
          <Text style={{ fontSize: 16, fontWeight: '600', color: '#1F2937', marginBottom: 12 }}>
            Ingredients
          </Text>
          {generatedRecipe.ingredients.map((ing, index) => (
            <View key={index} style={{ flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 6 }}>
              <View
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: 3,
                  backgroundColor: '#6B7F5E',
                  marginRight: 12,
                  marginTop: 7,
                }}
              />
              <Text style={{ flex: 1, fontSize: 15, color: '#1F2937', lineHeight: 22 }}>
                {[
                  ing.quantity != null ? String(ing.quantity) : '',
                  ing.unit || '',
                  ing.name,
                  ing.preparation ? `(${ing.preparation})` : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
                {ing.is_optional && (
                  <Text style={{ fontSize: 12, color: '#9CA3AF', fontStyle: 'italic' }}> optional</Text>
                )}
              </Text>
            </View>
          ))}

          {/* Divider */}
          <View style={{ height: 1, backgroundColor: '#E5E7EB', marginTop: 16, marginBottom: 16 }} />

          {/* Instructions */}
          <Text style={{ fontSize: 16, fontWeight: '600', color: '#1F2937', marginBottom: 12 }}>
            Instructions
          </Text>
          {generatedRecipe.instructions.map((step, index) => (
            <View key={index} style={{ flexDirection: 'row', paddingVertical: 8, alignItems: 'flex-start' }}>
              <View
                style={{
                  width: 26,
                  height: 26,
                  borderRadius: 13,
                  backgroundColor: '#E8EDE4',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginRight: 12,
                  marginTop: 1,
                }}
              >
                <Text style={{ fontSize: 12, fontWeight: '700', color: '#6B7F5E' }}>{index + 1}</Text>
              </View>
              <Text style={{ flex: 1, fontSize: 15, color: '#374151', lineHeight: 23 }}>
                {step}
              </Text>
            </View>
          ))}

          {/* Notes */}
          {generatedRecipe.notes && (
            <>
              <View style={{ height: 1, backgroundColor: '#E5E7EB', marginTop: 16, marginBottom: 16 }} />
              <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}>
                <Ionicons name="bulb-outline" size={18} color="#F59E0B" style={{ marginTop: 1 }} />
                <Text style={{ flex: 1, fontSize: 14, color: '#6B7280', lineHeight: 21, fontStyle: 'italic' }}>
                  {generatedRecipe.notes}
                </Text>
              </View>
            </>
          )}
        </View>

        {/* Nutrition Estimate */}
        {generatedRecipe.nutritionEstimate && (
          <View
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: 12,
              padding: 16,
              marginBottom: 16,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.05,
              shadowRadius: 6,
              elevation: 2,
            }}
          >
            <Text style={{ fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 12 }}>
              Nutrition Estimate (per serving)
            </Text>
            <View style={{ flexDirection: 'row', justifyContent: 'space-around' }}>
              <View style={{ alignItems: 'center' }}>
                <Text style={{ fontSize: 18, fontWeight: '700', color: '#6B7F5E' }}>
                  {generatedRecipe.nutritionEstimate.calories}
                </Text>
                <Text style={{ fontSize: 11, color: '#9CA3AF', marginTop: 2 }}>Calories</Text>
              </View>
              <View style={{ width: 1, backgroundColor: '#E5E7EB' }} />
              <View style={{ alignItems: 'center' }}>
                <Text style={{ fontSize: 18, fontWeight: '700', color: '#8B6F4E' }}>
                  {generatedRecipe.nutritionEstimate.protein}
                </Text>
                <Text style={{ fontSize: 11, color: '#9CA3AF', marginTop: 2 }}>Protein</Text>
              </View>
              <View style={{ width: 1, backgroundColor: '#E5E7EB' }} />
              <View style={{ alignItems: 'center' }}>
                <Text style={{ fontSize: 18, fontWeight: '700', color: '#8B5CF6' }}>
                  {generatedRecipe.nutritionEstimate.carbs}
                </Text>
                <Text style={{ fontSize: 11, color: '#9CA3AF', marginTop: 2 }}>Carbs</Text>
              </View>
              <View style={{ width: 1, backgroundColor: '#E5E7EB' }} />
              <View style={{ alignItems: 'center' }}>
                <Text style={{ fontSize: 18, fontWeight: '700', color: '#C4704B' }}>
                  {generatedRecipe.nutritionEstimate.fat}
                </Text>
                <Text style={{ fontSize: 11, color: '#9CA3AF', marginTop: 2 }}>Fat</Text>
              </View>
            </View>
          </View>
        )}

        {/* Action Buttons */}
        <View style={{ gap: 10 }}>
          {/* Save to My Recipes */}
          <TouchableOpacity
            onPress={handleSave}
            disabled={isSaving}
            activeOpacity={0.8}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: isSaving ? '#B8C4AE' : '#6B7F5E',
              paddingVertical: 15,
              borderRadius: 12,
              gap: 8,
              shadowColor: '#6B7F5E',
              shadowOffset: { width: 0, height: 3 },
              shadowOpacity: 0.25,
              shadowRadius: 6,
              elevation: 3,
            }}
          >
            {isSaving ? (
              <Text style={{ fontSize: 16, fontWeight: '600', color: '#FFFFFF' }}>Saving...</Text>
            ) : (
              <>
                <Ionicons name="bookmark-outline" size={18} color="#FFFFFF" />
                <Text style={{ fontSize: 16, fontWeight: '600', color: '#FFFFFF' }}>
                  Save to My Recipes
                </Text>
              </>
            )}
          </TouchableOpacity>

          {/* Add to Grocery List */}
          <TouchableOpacity
            onPress={handleAddToGrocery}
            disabled={isAddingToGrocery}
            activeOpacity={0.8}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: isAddingToGrocery ? '#C4B5A3' : '#8B6F4E',
              paddingVertical: 15,
              borderRadius: 12,
              gap: 8,
            }}
          >
            {isAddingToGrocery ? (
              <Text style={{ fontSize: 16, fontWeight: '600', color: '#FFFFFF' }}>Adding...</Text>
            ) : (
              <>
                <Ionicons name="cart-outline" size={18} color="#FFFFFF" />
                <Text style={{ fontSize: 16, fontWeight: '600', color: '#FFFFFF' }}>
                  Add to Grocery List
                </Text>
              </>
            )}
          </TouchableOpacity>

          {/* Generate Another */}
          <TouchableOpacity
            onPress={handleGenerateAnother}
            activeOpacity={0.7}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: '#FFFFFF',
              paddingVertical: 14,
              borderRadius: 12,
              borderWidth: 2,
              borderColor: '#6B7F5E',
              gap: 6,
            }}
          >
            <Ionicons name="refresh-outline" size={18} color="#6B7F5E" />
            <Text style={{ fontSize: 15, fontWeight: '600', color: '#6B7F5E' }}>
              Generate Another
            </Text>
          </TouchableOpacity>

          {/* Share */}
          <TouchableOpacity
            onPress={handleShare}
            activeOpacity={0.7}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              paddingVertical: 14,
              gap: 6,
            }}
          >
            <Ionicons name="share-outline" size={18} color="#6B7280" />
            <Text style={{ fontSize: 15, fontWeight: '500', color: '#6B7280' }}>
              Share
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    );
  };

  // ============================================
  // Main Render
  // ============================================

  return (
    <View style={{ flex: 1, backgroundColor: '#F5F7F3' }}>
      {/* Top Bar with Close Button */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingTop: insets.top + 8,
          paddingHorizontal: 16,
          paddingBottom: 8,
          backgroundColor: '#F5F7F3',
        }}
      >
        <TouchableOpacity
          onPress={() => router.dismiss()}
          activeOpacity={0.7}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          style={{
            width: 32,
            height: 32,
            borderRadius: 16,
            backgroundColor: '#F3F4F6',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Ionicons name="close" size={18} color="#6B7280" />
        </TouchableOpacity>

        {phase === 'result' && generatedRecipe && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Ionicons name="checkmark-circle" size={16} color="#10B981" />
            <Text style={{ fontSize: 13, fontWeight: '500', color: '#10B981' }}>
              Recipe ready
            </Text>
          </View>
        )}

        {/* Spacer for alignment */}
        <View style={{ width: 32 }} />
      </View>

      {/* Phase Content */}
      {phase === 'input' && renderInputPhase()}
      {phase === 'streaming' && renderStreamingPhase()}
      {phase === 'result' && renderResultPhase()}

      {/* Save Toast */}
      {showSaveToast && (
        <Animated.View
          style={{
            position: 'absolute',
            bottom: 100 + insets.bottom,
            left: 20,
            right: 20,
            backgroundColor: '#065F46',
            borderRadius: 12,
            padding: 14,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            opacity: toastAnim,
            transform: [
              {
                translateY: toastAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [20, 0],
                }),
              },
            ],
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.15,
            shadowRadius: 8,
            elevation: 4,
          }}
        >
          <Ionicons name="checkmark-circle" size={20} color="#FFFFFF" />
          <Text style={{ fontSize: 14, fontWeight: '600', color: '#FFFFFF' }}>
            Recipe saved to your collection!
          </Text>
        </Animated.View>
      )}

      {/* Grocery Toast */}
      {showGroceryToast && (
        <Animated.View
          style={{
            position: 'absolute',
            bottom: 100 + insets.bottom,
            left: 20,
            right: 20,
            backgroundColor: '#065F46',
            borderRadius: 12,
            padding: 14,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            opacity: groceryToastAnim,
            transform: [
              {
                translateY: groceryToastAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [20, 0],
                }),
              },
            ],
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.15,
            shadowRadius: 8,
            elevation: 4,
          }}
        >
          <Ionicons name="cart" size={20} color="#FFFFFF" />
          <Text style={{ fontSize: 14, fontWeight: '600', color: '#FFFFFF' }}>
            Ingredients added to grocery list!
          </Text>
        </Animated.View>
      )}
    </View>
  );
}
