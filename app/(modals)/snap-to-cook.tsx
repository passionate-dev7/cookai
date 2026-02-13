import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  ScrollView,
  Image,
  TextInput,
  Animated,
  Easing,
  Dimensions,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { File as ExpoFile } from 'expo-file-system';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  identifyIngredients,
  generateRecipes,
  type IdentifiedIngredient,
  type GeneratedRecipe,
} from '@/src/services/ai';
import { useTasteProfileStore } from '@/src/stores/tasteProfileStore';
import { useRecipeStore } from '@/src/stores';
import { supabase } from '@/src/services/supabase';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

type Phase = 'camera' | 'identifying' | 'review' | 'generating' | 'results';

const CUISINE_OPTIONS = ['Any', 'Italian', 'Asian', 'Mexican', 'Indian', 'Mediterranean', 'American', 'French', 'Japanese', 'Thai'];
const TIME_OPTIONS = [
  { label: 'Any', value: 0 },
  { label: 'Under 15 min', value: 15 },
  { label: 'Under 30 min', value: 30 },
  { label: 'Under 1 hour', value: 60 },
];
const DIETARY_OPTIONS = ['None', 'Vegetarian', 'Vegan', 'Gluten-free', 'Dairy-free', 'Keto', 'Paleo'];

export default function SnapToCookModal() {
  const router = useRouter();
  const cameraRef = useRef<CameraView>(null);

  const [permission, requestPermission] = useCameraPermissions();
  const [phase, setPhase] = useState<Phase>('camera');
  const [capturedImageUri, setCapturedImageUri] = useState<string | null>(null);
  const [flashEnabled, setFlashEnabled] = useState(false);

  // Ingredient review state
  const [ingredients, setIngredients] = useState<IdentifiedIngredient[]>([]);
  const [newIngredientText, setNewIngredientText] = useState('');
  const [showAddInput, setShowAddInput] = useState(false);

  // Preferences state
  const [selectedCuisine, setSelectedCuisine] = useState('Any');
  const [selectedTime, setSelectedTime] = useState(0);
  const [selectedDietary, setSelectedDietary] = useState('None');

  // Results state
  const [generatedRecipes, setGeneratedRecipes] = useState<GeneratedRecipe[]>([]);
  const [savedRecipeIds, setSavedRecipeIds] = useState<Set<string>>(new Set());

  // Animation
  const scanLineAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  // Stores
  const { trackInteraction, getProfileSummary } = useTasteProfileStore();
  const { addRecipe } = useRecipeStore();

  // Request permission on mount
  useEffect(() => {
    if (permission && !permission.granted && permission.canAskAgain) {
      requestPermission();
    }
  }, [permission]);

  // Scan line animation for identifying phase
  useEffect(() => {
    if (phase === 'identifying') {
      const loopAnimation = Animated.loop(
        Animated.sequence([
          Animated.timing(scanLineAnim, {
            toValue: 1,
            duration: 2000,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(scanLineAnim, {
            toValue: 0,
            duration: 2000,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ])
      );
      loopAnimation.start();
      return () => loopAnimation.stop();
    }
  }, [phase]);

  // Fade in animation for results
  useEffect(() => {
    if (phase === 'results') {
      fadeAnim.setValue(0);
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }).start();
    }
  }, [phase]);

  // ============================================
  // Image Capture & Processing
  // ============================================

  const compressAndConvertToBase64 = async (uri: string): Promise<string> => {
    // Compress the image using expo-image-manipulator
    const manipulated = await manipulateAsync(
      uri,
      [{ resize: { width: 1024 } }],
      { compress: 0.7, format: SaveFormat.JPEG }
    );

    // Read the compressed image as base64 using the new expo-file-system File API
    const file = new ExpoFile(manipulated.uri);
    const base64 = await file.base64();

    return base64;
  };

  const takePicture = async () => {
    if (!cameraRef.current) return;

    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.8,
      });

      if (photo) {
        setCapturedImageUri(photo.uri);
        setPhase('identifying');
        await processImage(photo.uri);
      }
    } catch (error) {
      console.error('Failed to capture image:', error);
      Alert.alert('Error', 'Failed to capture image. Please try again.');
    }
  };

  const pickFromGallery = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.8,
        allowsEditing: false,
      });

      if (!result.canceled && result.assets[0]) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        const uri = result.assets[0].uri;
        setCapturedImageUri(uri);
        setPhase('identifying');
        await processImage(uri);
      }
    } catch (error) {
      console.error('Failed to pick image:', error);
      Alert.alert('Error', 'Failed to load image from gallery.');
    }
  };

  const processImage = async (uri: string) => {
    try {
      const base64 = await compressAndConvertToBase64(uri);
      const result = await identifyIngredients(base64);

      if (result.success && result.ingredients.length > 0) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setIngredients(result.ingredients);
        setPhase('review');
      } else {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        Alert.alert(
          'No Ingredients Found',
          result.error || 'Could not identify any ingredients in this photo. Try a clearer photo with visible food items.',
          [
            { text: 'Try Again', onPress: () => resetToCamera() },
          ]
        );
      }
    } catch (error: any) {
      console.error('Image processing error:', error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert(
        'Processing Error',
        'Failed to analyze the image. Please try again.',
        [{ text: 'Try Again', onPress: () => resetToCamera() }]
      );
    }
  };

  // ============================================
  // Ingredient Management
  // ============================================

  const removeIngredient = (index: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setIngredients((prev) => prev.filter((_, i) => i !== index));
  };

  const addIngredient = () => {
    const trimmed = newIngredientText.trim();
    if (!trimmed) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setIngredients((prev) => [
      ...prev,
      {
        name: trimmed,
        confidence: 1.0,
        category: 'other',
      },
    ]);
    setNewIngredientText('');
    setShowAddInput(false);
  };

  // ============================================
  // Recipe Generation
  // ============================================

  const handleGenerateRecipes = async () => {
    if (ingredients.length === 0) {
      Alert.alert('No Ingredients', 'Please add at least one ingredient.');
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setPhase('generating');

    try {
      const ingredientNames = ingredients.map((i) => i.name);
      const tasteProfile = getProfileSummary();

      const result = await generateRecipes({
        ingredients: ingredientNames,
        cuisinePreference: selectedCuisine !== 'Any' ? selectedCuisine : undefined,
        dietaryRestrictions: selectedDietary !== 'None' ? [selectedDietary] : undefined,
        maxCookTime: selectedTime > 0 ? selectedTime : undefined,
        tasteProfile,
      });

      if (result.success && result.recipes.length > 0) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setGeneratedRecipes(result.recipes);
        setPhase('results');

        // Track the generation interaction
        trackInteraction({
          type: 'generate',
          ingredients: ingredientNames,
          cuisine: selectedCuisine !== 'Any' ? selectedCuisine : undefined,
        });
      } else {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        Alert.alert(
          'Generation Failed',
          result.error || 'Could not generate recipes. Please try again.',
          [{ text: 'Try Again', onPress: () => setPhase('review') }]
        );
      }
    } catch (error: any) {
      console.error('Recipe generation error:', error);
      Alert.alert(
        'Error',
        'Failed to generate recipes. Please try again.',
        [{ text: 'Try Again', onPress: () => setPhase('review') }]
      );
    }
  };

  // ============================================
  // Recipe Saving
  // ============================================

  const handleSaveRecipe = async (recipe: GeneratedRecipe) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        Alert.alert('Sign In Required', 'Please sign in to save recipes.');
        return;
      }

      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      const saved = await addRecipe(
        {
          user_id: user.id,
          title: recipe.title,
          description: recipe.description,
          source_type: 'ai',
          source_url: null,
          source_platform: null,
          image_url: null,
          prep_time_minutes: recipe.prep_time_minutes,
          cook_time_minutes: recipe.cook_time_minutes,
          total_time_minutes: recipe.total_time_minutes,
          servings: recipe.servings,
          difficulty: recipe.difficulty,
          cuisine: recipe.cuisine,
          tags: recipe.tags,
          instructions: recipe.instructions,
          notes: recipe.notes,
          is_favorite: false,
          times_cooked: 0,
          last_cooked_at: null,
          cookbook_id: null,
        },
        recipe.ingredients.map((ing, index) => ({
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

      if (saved) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setSavedRecipeIds((prev) => {
          const next = new Set(prev);
          next.add(recipe.title);
          return next;
        });

        // Track save interaction for taste profile
        trackInteraction({
          type: 'save',
          recipeId: saved.id,
          cuisine: recipe.cuisine,
          ingredients: recipe.ingredients.map((i) => i.name),
          tags: recipe.tags,
          difficulty: recipe.difficulty,
        });
      }
    } catch (error) {
      console.error('Failed to save recipe:', error);
      Alert.alert('Error', 'Failed to save recipe. Please try again.');
    }
  };

  // ============================================
  // Navigation Helpers
  // ============================================

  const resetToCamera = () => {
    setCapturedImageUri(null);
    setIngredients([]);
    setPhase('camera');
  };

  const handleClose = () => {
    router.dismiss();
  };

  // ============================================
  // Confidence indicator color
  // ============================================

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return '#22C55E'; // green
    if (confidence >= 0.5) return '#EAB308'; // yellow
    return '#EF4444'; // red
  };

  // ============================================
  // Difficulty badge color
  // ============================================

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'easy': return '#22C55E';
      case 'medium': return '#6B7F5E';
      case 'hard': return '#EF4444';
      default: return '#6B7280';
    }
  };

  // ============================================
  // Permission screens
  // ============================================

  if (!permission) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#6B7F5E" />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.container}>
        <View style={styles.permissionContainer}>
          <View style={styles.permissionIconWrap}>
            <Ionicons name="camera-outline" size={56} color="#6B7F5E" />
          </View>
          <Text style={styles.permissionTitle}>Camera Access Needed</Text>
          <Text style={styles.permissionText}>
            CookAI needs access to your camera to snap photos of your ingredients and generate recipes.
          </Text>
          <TouchableOpacity style={styles.permissionButton} onPress={requestPermission}>
            <Text style={styles.permissionButtonText}>Allow Camera Access</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.cancelButton} onPress={handleClose}>
            <Text style={styles.cancelButtonText}>Not Now</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ============================================
  // PHASE 1: Camera View
  // ============================================

  if (phase === 'camera') {
    return (
      <View style={styles.container}>
        <CameraView
          ref={cameraRef}
          style={StyleSheet.absoluteFillObject}
          facing="back"
          enableTorch={flashEnabled}
        />

        {/* Top Overlay */}
        <SafeAreaView style={styles.cameraOverlay} edges={['top']}>
          <View style={styles.cameraHeader}>
            <TouchableOpacity style={styles.iconButton} onPress={handleClose}>
              <Ionicons name="close" size={26} color="#FFFFFF" />
            </TouchableOpacity>

            <View style={styles.headerTitleWrap}>
              <Ionicons name="scan-outline" size={18} color="#6B7F5E" />
              <Text style={styles.cameraTitle}>Scan your ingredients</Text>
            </View>

            <TouchableOpacity
              style={styles.iconButton}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setFlashEnabled(!flashEnabled);
              }}
            >
              <Ionicons
                name={flashEnabled ? 'flash' : 'flash-outline'}
                size={22}
                color={flashEnabled ? '#6B7F5E' : '#FFFFFF'}
              />
            </TouchableOpacity>
          </View>
        </SafeAreaView>

        {/* Bottom Controls */}
        <SafeAreaView style={styles.cameraBottom} edges={['bottom']}>
          <View style={styles.cameraControls}>
            {/* Gallery picker */}
            <TouchableOpacity style={styles.galleryButton} onPress={pickFromGallery}>
              <Ionicons name="images-outline" size={26} color="#FFFFFF" />
            </TouchableOpacity>

            {/* Capture button */}
            <TouchableOpacity
              style={styles.captureButton}
              onPress={takePicture}
              activeOpacity={0.7}
            >
              <View style={styles.captureOuter}>
                <View style={styles.captureInner} />
              </View>
            </TouchableOpacity>

            {/* Spacer for alignment */}
            <View style={{ width: 52 }} />
          </View>

          <Text style={styles.captureHint}>
            Point at your ingredients and tap to capture
          </Text>
        </SafeAreaView>
      </View>
    );
  }

  // ============================================
  // PHASE 2: Identifying
  // ============================================

  if (phase === 'identifying') {
    const scanLineTranslateY = scanLineAnim.interpolate({
      inputRange: [0, 1],
      outputRange: [0, SCREEN_HEIGHT * 0.6],
    });

    return (
      <View style={styles.container}>
        {/* Background image, dimmed */}
        {capturedImageUri && (
          <Image
            source={{ uri: capturedImageUri }}
            style={[StyleSheet.absoluteFillObject, { opacity: 0.4 }]}
            blurRadius={3}
          />
        )}
        <View style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(0,0,0,0.5)' }]} />

        {/* Scanning line animation */}
        <Animated.View
          style={[
            styles.scanLine,
            {
              transform: [{ translateY: scanLineTranslateY }],
            },
          ]}
        />

        {/* Content */}
        <View style={styles.identifyingContent}>
          <ActivityIndicator size="large" color="#6B7F5E" />
          <Text style={styles.identifyingTitle}>Identifying ingredients...</Text>
          <Text style={styles.identifyingSubtitle}>
            Analyzing your photo with AI
          </Text>
        </View>
      </View>
    );
  }

  // ============================================
  // PHASE 3: Ingredient Review
  // ============================================

  if (phase === 'review') {
    return (
      <SafeAreaView style={styles.reviewContainer} edges={['top', 'bottom']}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1 }}
        >
          {/* Header */}
          <View style={styles.reviewHeader}>
            <TouchableOpacity onPress={handleClose}>
              <Ionicons name="close" size={26} color="#374151" />
            </TouchableOpacity>
            <Text style={styles.reviewTitle}>Review Ingredients</Text>
            <View style={{ width: 26 }} />
          </View>

          <ScrollView
            style={styles.reviewScroll}
            contentContainerStyle={styles.reviewScrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* Ingredient count */}
            <View style={styles.ingredientCountRow}>
              <Ionicons name="nutrition-outline" size={20} color="#6B7F5E" />
              <Text style={styles.ingredientCountText}>
                {ingredients.length} ingredient{ingredients.length !== 1 ? 's' : ''} found
              </Text>
            </View>

            {/* Ingredient chips */}
            <View style={styles.chipsContainer}>
              {ingredients.map((item, index) => (
                <View key={`${item.name}-${index}`} style={styles.chip}>
                  <View
                    style={[
                      styles.confidenceDot,
                      { backgroundColor: getConfidenceColor(item.confidence) },
                    ]}
                  />
                  <Text style={styles.chipText}>{item.name}</Text>
                  {item.estimatedQuantity && (
                    <Text style={styles.chipQuantity}>{item.estimatedQuantity}</Text>
                  )}
                  <TouchableOpacity
                    onPress={() => removeIngredient(index)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Ionicons name="close-circle" size={18} color="#9CA3AF" />
                  </TouchableOpacity>
                </View>
              ))}
            </View>

            {/* Add ingredient */}
            {showAddInput ? (
              <View style={styles.addInputRow}>
                <TextInput
                  style={styles.addInput}
                  placeholder="Type ingredient name..."
                  placeholderTextColor="#9CA3AF"
                  value={newIngredientText}
                  onChangeText={setNewIngredientText}
                  onSubmitEditing={addIngredient}
                  autoFocus
                  returnKeyType="done"
                />
                <TouchableOpacity style={styles.addInputButton} onPress={addIngredient}>
                  <Ionicons name="add" size={20} color="#FFFFFF" />
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.addInputCancel}
                  onPress={() => {
                    setShowAddInput(false);
                    setNewIngredientText('');
                  }}
                >
                  <Text style={styles.addInputCancelText}>Cancel</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity
                style={styles.addButton}
                onPress={() => setShowAddInput(true)}
              >
                <Ionicons name="add-circle-outline" size={20} color="#6B7F5E" />
                <Text style={styles.addButtonText}>Add ingredient</Text>
              </TouchableOpacity>
            )}

            {/* Divider */}
            <View style={styles.divider} />

            {/* Preferences Section */}
            <Text style={styles.preferencesTitle}>Preferences (optional)</Text>

            {/* Cuisine */}
            <Text style={styles.preferenceLabel}>Cuisine</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.optionScrollContent}
            >
              {CUISINE_OPTIONS.map((cuisine) => (
                <TouchableOpacity
                  key={cuisine}
                  style={[
                    styles.optionPill,
                    selectedCuisine === cuisine && styles.optionPillActive,
                  ]}
                  onPress={() => setSelectedCuisine(cuisine)}
                >
                  <Text
                    style={[
                      styles.optionPillText,
                      selectedCuisine === cuisine && styles.optionPillTextActive,
                    ]}
                  >
                    {cuisine}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* Time */}
            <Text style={styles.preferenceLabel}>Time</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.optionScrollContent}
            >
              {TIME_OPTIONS.map((option) => (
                <TouchableOpacity
                  key={option.label}
                  style={[
                    styles.optionPill,
                    selectedTime === option.value && styles.optionPillActive,
                  ]}
                  onPress={() => setSelectedTime(option.value)}
                >
                  <Text
                    style={[
                      styles.optionPillText,
                      selectedTime === option.value && styles.optionPillTextActive,
                    ]}
                  >
                    {option.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* Dietary */}
            <Text style={styles.preferenceLabel}>Dietary</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.optionScrollContent}
            >
              {DIETARY_OPTIONS.map((diet) => (
                <TouchableOpacity
                  key={diet}
                  style={[
                    styles.optionPill,
                    selectedDietary === diet && styles.optionPillActive,
                  ]}
                  onPress={() => setSelectedDietary(diet)}
                >
                  <Text
                    style={[
                      styles.optionPillText,
                      selectedDietary === diet && styles.optionPillTextActive,
                    ]}
                  >
                    {diet}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </ScrollView>

          {/* Bottom action buttons */}
          <View style={styles.reviewBottomActions}>
            <TouchableOpacity style={styles.retakeButton} onPress={resetToCamera}>
              <Ionicons name="camera-outline" size={20} color="#6B7280" />
              <Text style={styles.retakeText}>Retake Photo</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.generateButton,
                ingredients.length === 0 && styles.generateButtonDisabled,
              ]}
              onPress={handleGenerateRecipes}
              disabled={ingredients.length === 0}
              activeOpacity={0.7}
            >
              <Ionicons name="sparkles" size={20} color="#FFFFFF" />
              <Text style={styles.generateButtonText}>Generate Recipes</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  // ============================================
  // PHASE 4: Generating
  // ============================================

  if (phase === 'generating') {
    return (
      <View style={[styles.container, styles.generatingContainer]}>
        <View style={styles.generatingContent}>
          <View style={styles.generatingIconWrap}>
            <Ionicons name="sparkles" size={40} color="#6B7F5E" />
          </View>
          <ActivityIndicator size="large" color="#6B7F5E" style={{ marginTop: 24 }} />
          <Text style={styles.generatingTitle}>Creating recipes from your ingredients...</Text>
          <Text style={styles.generatingSubtitle}>
            Our AI chef is crafting personalized recipes
          </Text>

          {/* Show ingredients summary */}
          <View style={styles.generatingSummary}>
            <Text style={styles.generatingSummaryLabel}>Using:</Text>
            <Text style={styles.generatingSummaryText}>
              {ingredients.map((i) => i.name).join(', ')}
            </Text>
          </View>
        </View>
      </View>
    );
  }

  // ============================================
  // PHASE 5: Results
  // ============================================

  if (phase === 'results') {
    return (
      <SafeAreaView style={styles.resultsContainer} edges={['top', 'bottom']}>
        {/* Header */}
        <View style={styles.resultsHeader}>
          <TouchableOpacity onPress={handleClose}>
            <Ionicons name="close" size={26} color="#374151" />
          </TouchableOpacity>
          <Text style={styles.resultsTitle}>Your Recipes</Text>
          <View style={{ width: 26 }} />
        </View>

        <Animated.View style={{ flex: 1, opacity: fadeAnim }}>
          <ScrollView
            style={styles.resultsScroll}
            contentContainerStyle={styles.resultsScrollContent}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.resultsSubheader}>
              <Ionicons name="restaurant-outline" size={18} color="#8B6F4E" />
              <Text style={styles.resultsSubheaderText}>
                {generatedRecipes.length} recipe{generatedRecipes.length !== 1 ? 's' : ''} generated from your ingredients
              </Text>
            </View>

            {generatedRecipes.map((recipe, index) => {
              const isSaved = savedRecipeIds.has(recipe.title);

              return (
                <View key={`recipe-${index}`} style={styles.recipeCard}>
                  {/* Recipe header */}
                  <View style={styles.recipeCardHeader}>
                    <View style={styles.recipeCardNumber}>
                      <Text style={styles.recipeCardNumberText}>{index + 1}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.recipeCardTitle}>{recipe.title}</Text>
                      <Text style={styles.recipeCardCuisine}>{recipe.cuisine}</Text>
                    </View>
                  </View>

                  {/* Description */}
                  <Text style={styles.recipeCardDescription}>{recipe.description}</Text>

                  {/* Meta row */}
                  <View style={styles.recipeMetaRow}>
                    <View style={styles.recipeMeta}>
                      <Ionicons name="time-outline" size={14} color="#6B7280" />
                      <Text style={styles.recipeMetaText}>
                        {recipe.total_time_minutes} min
                      </Text>
                    </View>

                    <View
                      style={[
                        styles.difficultyBadge,
                        { backgroundColor: getDifficultyColor(recipe.difficulty) + '20' },
                      ]}
                    >
                      <View
                        style={[
                          styles.difficultyDot,
                          { backgroundColor: getDifficultyColor(recipe.difficulty) },
                        ]}
                      />
                      <Text
                        style={[
                          styles.difficultyText,
                          { color: getDifficultyColor(recipe.difficulty) },
                        ]}
                      >
                        {recipe.difficulty.charAt(0).toUpperCase() + recipe.difficulty.slice(1)}
                      </Text>
                    </View>

                    <View style={styles.recipeMeta}>
                      <Ionicons name="nutrition-outline" size={14} color="#6B7280" />
                      <Text style={styles.recipeMetaText}>
                        {recipe.ingredients.length} ingredients
                      </Text>
                    </View>

                    <View style={styles.recipeMeta}>
                      <Ionicons name="people-outline" size={14} color="#6B7280" />
                      <Text style={styles.recipeMetaText}>
                        {recipe.servings} servings
                      </Text>
                    </View>
                  </View>

                  {/* Tags */}
                  {recipe.tags.length > 0 && (
                    <View style={styles.tagsRow}>
                      {recipe.tags.slice(0, 4).map((tag) => (
                        <View key={tag} style={styles.tag}>
                          <Text style={styles.tagText}>{tag}</Text>
                        </View>
                      ))}
                    </View>
                  )}

                  {/* Nutrition estimate */}
                  {recipe.nutritionEstimate && (
                    <View style={styles.nutritionRow}>
                      <View style={styles.nutritionItem}>
                        <Text style={styles.nutritionValue}>
                          {recipe.nutritionEstimate.calories}
                        </Text>
                        <Text style={styles.nutritionLabel}>cal</Text>
                      </View>
                      <View style={styles.nutritionDivider} />
                      <View style={styles.nutritionItem}>
                        <Text style={styles.nutritionValue}>
                          {recipe.nutritionEstimate.protein}
                        </Text>
                        <Text style={styles.nutritionLabel}>protein</Text>
                      </View>
                      <View style={styles.nutritionDivider} />
                      <View style={styles.nutritionItem}>
                        <Text style={styles.nutritionValue}>
                          {recipe.nutritionEstimate.carbs}
                        </Text>
                        <Text style={styles.nutritionLabel}>carbs</Text>
                      </View>
                      <View style={styles.nutritionDivider} />
                      <View style={styles.nutritionItem}>
                        <Text style={styles.nutritionValue}>
                          {recipe.nutritionEstimate.fat}
                        </Text>
                        <Text style={styles.nutritionLabel}>fat</Text>
                      </View>
                    </View>
                  )}

                  {/* Save button */}
                  <TouchableOpacity
                    style={[
                      styles.saveRecipeButton,
                      isSaved && styles.saveRecipeButtonSaved,
                    ]}
                    onPress={() => handleSaveRecipe(recipe)}
                    disabled={isSaved}
                    activeOpacity={0.7}
                  >
                    <Ionicons
                      name={isSaved ? 'checkmark-circle' : 'bookmark-outline'}
                      size={18}
                      color={isSaved ? '#059669' : '#FFFFFF'}
                    />
                    <Text
                      style={[
                        styles.saveRecipeButtonText,
                        isSaved && styles.saveRecipeButtonTextSaved,
                      ]}
                    >
                      {isSaved ? 'Saved' : 'Save Recipe'}
                    </Text>
                  </TouchableOpacity>
                </View>
              );
            })}
          </ScrollView>
        </Animated.View>

        {/* Bottom actions */}
        <View style={styles.resultsBottomActions}>
          <TouchableOpacity
            style={styles.generateMoreButton}
            onPress={() => {
              setGeneratedRecipes([]);
              setSavedRecipeIds(new Set());
              handleGenerateRecipes();
            }}
          >
            <Ionicons name="refresh-outline" size={20} color="#6B7F5E" />
            <Text style={styles.generateMoreText}>Generate More</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.newScanButton}
            onPress={() => {
              setGeneratedRecipes([]);
              setSavedRecipeIds(new Set());
              setIngredients([]);
              resetToCamera();
            }}
          >
            <Ionicons name="camera-outline" size={20} color="#FFFFFF" />
            <Text style={styles.newScanText}>New Scan</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return null;
}

// ============================================
// Styles
// ============================================

const styles = StyleSheet.create({
  // General
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },

  // Permission
  permissionContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
    backgroundColor: '#FFFFFF',
  },
  permissionIconWrap: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#E8EDE4',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  permissionTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 12,
    textAlign: 'center',
  },
  permissionText: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
  },
  permissionButton: {
    backgroundColor: '#6B7F5E',
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 16,
    width: '100%',
    alignItems: 'center',
  },
  permissionButtonText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '600',
  },
  cancelButton: {
    marginTop: 16,
    paddingVertical: 12,
  },
  cancelButtonText: {
    color: '#6B7280',
    fontSize: 16,
  },

  // Camera Phase
  cameraOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
  },
  cameraHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  cameraTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  cameraBottom: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 10,
  },
  cameraControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 40,
    paddingBottom: 8,
  },
  galleryButton: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  captureButton: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  captureOuter: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#FFFFFF',
  },
  captureInner: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#FFFFFF',
  },
  captureHint: {
    textAlign: 'center',
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 13,
    paddingBottom: 16,
    paddingTop: 4,
  },

  // Identifying Phase
  scanLine: {
    position: 'absolute',
    left: 20,
    right: 20,
    height: 2,
    backgroundColor: '#6B7F5E',
    shadowColor: '#6B7F5E',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 8,
    top: 100,
    zIndex: 5,
  },
  identifyingContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  identifyingTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#FFFFFF',
    marginTop: 24,
  },
  identifyingSubtitle: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.7)',
    marginTop: 8,
  },

  // Review Phase
  reviewContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  reviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  reviewTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
  },
  reviewScroll: {
    flex: 1,
  },
  reviewScrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  ingredientCountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  ingredientCountText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#374151',
  },
  chipsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 16,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 24,
    paddingVertical: 8,
    paddingLeft: 12,
    paddingRight: 10,
  },
  confidenceDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  chipText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
  },
  chipQuantity: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
  },
  addButtonText: {
    fontSize: 15,
    fontWeight: '500',
    color: '#6B7F5E',
  },
  addInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  addInput: {
    flex: 1,
    height: 44,
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingHorizontal: 14,
    fontSize: 15,
    color: '#1F2937',
  },
  addInputButton: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#6B7F5E',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addInputCancel: {
    paddingHorizontal: 8,
  },
  addInputCancelText: {
    fontSize: 14,
    color: '#9CA3AF',
  },

  // Preferences
  divider: {
    height: 1,
    backgroundColor: '#F3F4F6',
    marginVertical: 20,
  },
  preferencesTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 16,
  },
  preferenceLabel: {
    fontSize: 13,
    fontWeight: '500',
    color: '#9CA3AF',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
    marginTop: 12,
  },
  optionScrollContent: {
    gap: 8,
    paddingRight: 20,
  },
  optionPill: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  optionPillActive: {
    backgroundColor: '#E8EDE4',
    borderColor: '#6B7F5E',
  },
  optionPillText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6B7280',
  },
  optionPillTextActive: {
    color: '#6B7F5E',
  },

  // Bottom actions (Review)
  reviewBottomActions: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    backgroundColor: '#FFFFFF',
  },
  retakeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
  },
  retakeText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#6B7280',
  },
  generateButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: '#6B7F5E',
  },
  generateButtonDisabled: {
    backgroundColor: '#B8C4AE',
  },
  generateButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  // Generating Phase
  generatingContainer: {
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  generatingContent: {
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  generatingIconWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#E8EDE4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  generatingTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1F2937',
    marginTop: 20,
    textAlign: 'center',
  },
  generatingSubtitle: {
    fontSize: 14,
    color: '#9CA3AF',
    marginTop: 8,
    textAlign: 'center',
  },
  generatingSummary: {
    marginTop: 32,
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 16,
    width: '100%',
  },
  generatingSummaryLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#9CA3AF',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  generatingSummaryText: {
    fontSize: 14,
    color: '#374151',
    lineHeight: 20,
  },

  // Results Phase
  resultsContainer: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  resultsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  resultsTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
  },
  resultsScroll: {
    flex: 1,
  },
  resultsScrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  resultsSubheader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 20,
  },
  resultsSubheaderText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6B7280',
  },

  // Recipe Card
  recipeCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  recipeCardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
    marginBottom: 12,
  },
  recipeCardNumber: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#E8EDE4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  recipeCardNumberText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#6B7F5E',
  },
  recipeCardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
    lineHeight: 24,
  },
  recipeCardCuisine: {
    fontSize: 13,
    color: '#9CA3AF',
    marginTop: 2,
  },
  recipeCardDescription: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 21,
    marginBottom: 14,
  },

  // Recipe Meta
  recipeMetaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  recipeMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  recipeMetaText: {
    fontSize: 13,
    color: '#6B7280',
  },
  difficultyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  difficultyDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  difficultyText: {
    fontSize: 12,
    fontWeight: '600',
  },

  // Tags
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 12,
  },
  tag: {
    backgroundColor: '#F0EBE4',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  tagText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#8B6F4E',
  },

  // Nutrition
  nutritionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderRadius: 10,
    padding: 12,
    marginBottom: 14,
  },
  nutritionItem: {
    flex: 1,
    alignItems: 'center',
  },
  nutritionValue: {
    fontSize: 14,
    fontWeight: '700',
    color: '#374151',
  },
  nutritionLabel: {
    fontSize: 11,
    color: '#9CA3AF',
    marginTop: 2,
  },
  nutritionDivider: {
    width: 1,
    height: 24,
    backgroundColor: '#E5E7EB',
  },

  // Save button
  saveRecipeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#6B7F5E',
  },
  saveRecipeButtonSaved: {
    backgroundColor: '#ECFDF5',
  },
  saveRecipeButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  saveRecipeButtonTextSaved: {
    color: '#059669',
  },

  // Bottom actions (Results)
  resultsBottomActions: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  generateMoreButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#6B7F5E',
  },
  generateMoreText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#6B7F5E',
  },
  newScanButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: '#6B7F5E',
  },
  newScanText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
