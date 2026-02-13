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
} from 'react-native';
import { CameraView, useCameraPermissions, CameraCapturedPicture } from 'expo-camera';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system';
import { extractRecipeFromImage } from '@/src/services/ocr';
import { useSubscriptionStore, useRecipeStore, useUserStore } from '@/src/stores';
import { Button } from '@/src/shared/components';

type ScanState = 'camera' | 'preview' | 'extracting' | 'result';

export default function OCRScannerModal() {
  const router = useRouter();
  const { cookbookId } = useLocalSearchParams<{ cookbookId: string }>();
  const cameraRef = useRef<CameraView>(null);

  const [permission, requestPermission] = useCameraPermissions();
  const [scanState, setScanState] = useState<ScanState>('camera');
  const [capturedImage, setCapturedImage] = useState<CameraCapturedPicture | null>(null);
  const [torchEnabled, setTorchEnabled] = useState(false);
  const [extractedRecipe, setExtractedRecipe] = useState<any>(null);

  const { isPremium } = useSubscriptionStore();
  const { addRecipe } = useRecipeStore();
  const { profile } = useUserStore();

  useEffect(() => {
    if (permission && !permission.granted && permission.canAskAgain) {
      requestPermission();
    }
  }, [permission]);

  const takePicture = async () => {
    if (!cameraRef.current) return;

    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.8,
        base64: true,
      });

      if (photo) {
        setCapturedImage(photo);
        setScanState('preview');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to capture image. Please try again.');
    }
  };

  const handleExtract = async () => {
    if (!capturedImage?.base64) {
      Alert.alert('Error', 'No image captured');
      return;
    }

    setScanState('extracting');

    try {
      const result = await extractRecipeFromImage(capturedImage.base64, {
        isPremium,
      });

      if (result.success && result.recipe) {
        setExtractedRecipe(result.recipe);
        setScanState('result');
      } else {
        Alert.alert(
          'Extraction Failed',
          result.error || 'Could not extract recipe from this image. Please try again with a clearer photo.',
          [{ text: 'Try Again', onPress: () => setScanState('camera') }]
        );
      }
    } catch (error) {
      Alert.alert(
        'Error',
        'Failed to extract recipe. Please try again.',
        [{ text: 'Try Again', onPress: () => setScanState('camera') }]
      );
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
        source_type: 'cookbook',
        source_url: null,
        source_platform: null,
        image_url: null,
        prep_time_minutes: extractedRecipe.prep_time_minutes,
        cook_time_minutes: extractedRecipe.cook_time_minutes,
        total_time_minutes: extractedRecipe.total_time_minutes,
        servings: extractedRecipe.servings,
        difficulty: extractedRecipe.difficulty,
        cuisine: null,
        tags: [],
        instructions: extractedRecipe.instructions,
        notes: extractedRecipe.page_number ? `Page ${extractedRecipe.page_number}` : null,
        is_favorite: false,
        times_cooked: 0,
        last_cooked_at: null,
        cookbook_id: cookbookId || null,
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

  const retake = () => {
    setCapturedImage(null);
    setExtractedRecipe(null);
    setScanState('camera');
  };

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
          <Ionicons name="camera-outline" size={64} color="#9CA3AF" />
          <Text style={styles.permissionTitle}>Camera Access Required</Text>
          <Text style={styles.permissionText}>
            CookAI needs camera access to scan cookbook pages.
          </Text>
          <TouchableOpacity style={styles.permissionButton} onPress={requestPermission}>
            <Text style={styles.permissionButtonText}>Grant Permission</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.cancelButton} onPress={() => router.dismiss()}>
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // Camera View
  if (scanState === 'camera') {
    return (
      <View style={styles.container}>
        <CameraView
          ref={cameraRef}
          style={StyleSheet.absoluteFillObject}
          facing="back"
          enableTorch={torchEnabled}
        />

        <View style={styles.overlay}>
          <View style={styles.header}>
            <TouchableOpacity style={styles.closeButton} onPress={() => router.dismiss()}>
              <Ionicons name="close" size={28} color="#FFFFFF" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Scan Recipe Page</Text>
            <TouchableOpacity
              style={styles.torchButton}
              onPress={() => setTorchEnabled(!torchEnabled)}
            >
              <Ionicons
                name={torchEnabled ? 'flash' : 'flash-outline'}
                size={24}
                color="#FFFFFF"
              />
            </TouchableOpacity>
          </View>

          <View style={styles.scanArea}>
            <View style={[styles.corner, styles.topLeft]} />
            <View style={[styles.corner, styles.topRight]} />
            <View style={[styles.corner, styles.bottomLeft]} />
            <View style={[styles.corner, styles.bottomRight]} />
          </View>

          <View style={styles.captureArea}>
            <Text style={styles.instructionText}>
              Align the recipe page within the frame
            </Text>
            <TouchableOpacity style={styles.captureButton} onPress={takePicture}>
              <View style={styles.captureInner} />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  }

  // Preview View
  if (scanState === 'preview' && capturedImage) {
    return (
      <View style={styles.container}>
        <Image source={{ uri: capturedImage.uri }} style={StyleSheet.absoluteFillObject} />

        <View style={styles.previewOverlay}>
          <View style={styles.header}>
            <TouchableOpacity style={styles.closeButton} onPress={retake}>
              <Ionicons name="arrow-back" size={28} color="#FFFFFF" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Review Photo</Text>
            <View style={{ width: 44 }} />
          </View>

          <View style={styles.previewActions}>
            <TouchableOpacity style={styles.retakeButton} onPress={retake}>
              <Ionicons name="refresh" size={20} color="#FFFFFF" />
              <Text style={styles.retakeText}>Retake</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.extractButton} onPress={handleExtract}>
              <Ionicons name="sparkles" size={20} color="#FFFFFF" />
              <Text style={styles.extractText}>Extract Recipe</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  }

  // Extracting View
  if (scanState === 'extracting') {
    return (
      <View style={[styles.container, styles.centerContent]}>
        <ActivityIndicator size="large" color="#6B7F5E" />
        <Text style={styles.extractingTitle}>Extracting Recipe</Text>
        <Text style={styles.extractingText}>
          Analyzing the page with AI...
        </Text>
      </View>
    );
  }

  // Result View
  if (scanState === 'result' && extractedRecipe) {
    return (
      <ScrollView style={styles.resultContainer} contentContainerStyle={{ padding: 20 }}>
        <View style={styles.successBadge}>
          <Ionicons name="checkmark-circle" size={20} color="#059669" />
          <Text style={styles.successText}>Recipe extracted successfully</Text>
        </View>

        <Text style={styles.recipeTitle}>{extractedRecipe.title}</Text>

        {extractedRecipe.description && (
          <Text style={styles.recipeDescription}>{extractedRecipe.description}</Text>
        )}

        <View style={styles.metaRow}>
          {extractedRecipe.total_time_minutes && (
            <View style={styles.metaItem}>
              <Ionicons name="time-outline" size={16} color="#6B7F5E" />
              <Text style={styles.metaText}>{extractedRecipe.total_time_minutes} min</Text>
            </View>
          )}
          {extractedRecipe.servings && (
            <View style={styles.metaItem}>
              <Ionicons name="people-outline" size={16} color="#6B7F5E" />
              <Text style={styles.metaText}>{extractedRecipe.servings} servings</Text>
            </View>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            Ingredients ({extractedRecipe.ingredients.length})
          </Text>
          {extractedRecipe.ingredients.map((ing: any, index: number) => (
            <View key={index} style={styles.ingredientRow}>
              <View style={styles.bullet} />
              <Text style={styles.ingredientText}>
                {ing.quantity} {ing.unit} {ing.name}
              </Text>
            </View>
          ))}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            Instructions ({extractedRecipe.instructions.length} steps)
          </Text>
          {extractedRecipe.instructions.map((step: string, index: number) => (
            <View key={index} style={styles.stepRow}>
              <View style={styles.stepNumber}>
                <Text style={styles.stepNumberText}>{index + 1}</Text>
              </View>
              <Text style={styles.stepText}>{step}</Text>
            </View>
          ))}
        </View>

        <View style={{ gap: 12, marginTop: 24 }}>
          <Button title="Save Recipe" onPress={handleSaveRecipe} fullWidth />
          <Button title="Scan Another Page" onPress={retake} variant="outline" fullWidth />
        </View>
      </ScrollView>
    );
  }

  return null;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  centerContent: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  overlay: {
    flex: 1,
  },
  previewOverlay: {
    flex: 1,
    justifyContent: 'space-between',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
  },
  closeButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  torchButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scanArea: {
    flex: 1,
    marginHorizontal: 20,
  },
  corner: {
    position: 'absolute',
    width: 40,
    height: 40,
    borderColor: '#6B7F5E',
  },
  topLeft: {
    top: 0,
    left: 0,
    borderTopWidth: 3,
    borderLeftWidth: 3,
    borderTopLeftRadius: 12,
  },
  topRight: {
    top: 0,
    right: 0,
    borderTopWidth: 3,
    borderRightWidth: 3,
    borderTopRightRadius: 12,
  },
  bottomLeft: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 3,
    borderLeftWidth: 3,
    borderBottomLeftRadius: 12,
  },
  bottomRight: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 3,
    borderRightWidth: 3,
    borderBottomRightRadius: 12,
  },
  captureArea: {
    alignItems: 'center',
    paddingBottom: 60,
  },
  instructionText: {
    fontSize: 16,
    color: '#FFFFFF',
    marginBottom: 24,
  },
  captureButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  captureInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#FFFFFF',
  },
  previewActions: {
    flexDirection: 'row',
    gap: 16,
    padding: 20,
    paddingBottom: 60,
    justifyContent: 'center',
  },
  retakeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 12,
  },
  retakeText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  extractButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#6B7F5E',
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 12,
  },
  extractText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  extractingTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1F2937',
    marginTop: 24,
  },
  extractingText: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 8,
  },
  resultContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  successBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  successText: {
    color: '#059669',
    fontSize: 13,
    fontWeight: '500',
  },
  recipeTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 8,
  },
  recipeDescription: {
    fontSize: 15,
    color: '#6B7280',
    lineHeight: 22,
    marginBottom: 16,
  },
  metaRow: {
    flexDirection: 'row',
    gap: 20,
    marginBottom: 24,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metaText: {
    fontSize: 14,
    color: '#6B7280',
  },
  section: {
    marginBottom: 24,
    padding: 16,
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 12,
  },
  ingredientRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
  },
  bullet: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#6B7F5E',
    marginRight: 12,
  },
  ingredientText: {
    fontSize: 15,
    color: '#1F2937',
  },
  stepRow: {
    flexDirection: 'row',
    paddingVertical: 8,
  },
  stepNumber: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#E8EDE4',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  stepNumberText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B7F5E',
  },
  stepText: {
    flex: 1,
    fontSize: 15,
    color: '#1F2937',
    lineHeight: 22,
  },
  permissionContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
    backgroundColor: '#FFFFFF',
  },
  permissionTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1F2937',
    marginTop: 24,
    marginBottom: 12,
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
    paddingVertical: 14,
    borderRadius: 12,
  },
  permissionButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
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
});
