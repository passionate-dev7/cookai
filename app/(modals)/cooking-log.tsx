import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Image,
  TextInput,
  Alert,
  Linking,
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import { useRecipeStore } from '@/src/stores';
import { useCookingLogStore } from '@/src/stores/cookingLogStore';
import { Button } from '@/src/shared/components';

const MAX_PHOTOS = 5;

export default function CookingLogModal() {
  const { recipeId } = useLocalSearchParams<{ recipeId: string }>();
  const router = useRouter();
  const incrementCookCount = useRecipeStore((s) => s.incrementCookCount);
  const createCookingLog = useCookingLogStore((s) => s.createCookingLog);

  const [photos, setPhotos] = useState<string[]>([]);
  const [notes, setNotes] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState('');

  const requestPermission = async (type: 'camera' | 'library') => {
    if (type === 'camera') {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Camera Access Needed',
          'Please enable camera access in Settings to take photos of your dish.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Open Settings', onPress: () => Linking.openSettings() },
          ]
        );
        return false;
      }
    } else {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Photo Library Access Needed',
          'Please enable photo library access in Settings to select photos.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Open Settings', onPress: () => Linking.openSettings() },
          ]
        );
        return false;
      }
    }
    return true;
  };

  const pickFromCamera = async () => {
    if (photos.length >= MAX_PHOTOS) {
      Alert.alert('Limit Reached', `You can add up to ${MAX_PHOTOS} photos.`);
      return;
    }
    const hasPermission = await requestPermission('camera');
    if (!hasPermission) return;

    const result = await ImagePicker.launchCameraAsync({
      quality: 0.7,
      allowsEditing: true,
      aspect: [4, 3],
    });

    if (!result.canceled && result.assets[0]) {
      setPhotos((prev) => [...prev, result.assets[0].uri]);
    }
  };

  const pickFromLibrary = async () => {
    if (photos.length >= MAX_PHOTOS) {
      Alert.alert('Limit Reached', `You can add up to ${MAX_PHOTOS} photos.`);
      return;
    }
    const hasPermission = await requestPermission('library');
    if (!hasPermission) return;

    const remaining = MAX_PHOTOS - photos.length;
    const result = await ImagePicker.launchImageLibraryAsync({
      quality: 0.7,
      allowsMultipleSelection: true,
      selectionLimit: remaining,
    });

    if (!result.canceled && result.assets.length > 0) {
      setPhotos((prev) => [
        ...prev,
        ...result.assets.map((a) => a.uri).slice(0, remaining),
      ]);
    }
  };

  const removePhoto = (index: number) => {
    setPhotos((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSaveWithPhotos = async () => {
    if (!recipeId) return;
    setIsUploading(true);

    try {
      setUploadProgress(
        photos.length > 0 ? `Uploading photo 1 of ${photos.length}...` : 'Saving...'
      );

      const log = await createCookingLog(recipeId, photos, notes || undefined);
      if (log) {
        await incrementCookCount(recipeId);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }

      if (router.canDismiss()) {
        router.dismiss();
      } else {
        router.back();
      }
    } catch (error) {
      console.error('Failed to save cooking log:', error);
      Alert.alert('Error', 'Failed to save your cooking log. Please try again.');
    } finally {
      setIsUploading(false);
      setUploadProgress('');
    }
  };

  const handleJustMarkCooked = async () => {
    if (!recipeId) return;
    await incrementCookCount(recipeId);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    if (router.canDismiss()) {
      router.dismiss();
    } else {
      router.back();
    }
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: '#FFFFFF' }}
      contentContainerStyle={{ padding: 20 }}
      keyboardShouldPersistTaps="handled"
    >
      {/* Header */}
      <Text style={{ fontSize: 22, fontWeight: '700', color: '#1F2937', marginBottom: 4 }}>
        Cooking Memory
      </Text>
      <Text style={{ fontSize: 15, color: '#6B7280', marginBottom: 24 }}>
        Add photos of your dish and any notes. Photos are optional!
      </Text>

      {/* Photo Grid */}
      <View
        style={{
          flexDirection: 'row',
          flexWrap: 'wrap',
          gap: 12,
          marginBottom: 20,
        }}
      >
        {photos.map((uri, index) => (
          <View
            key={index}
            style={{
              width: '30%',
              aspectRatio: 1,
              borderRadius: 12,
              overflow: 'hidden',
              position: 'relative',
            }}
          >
            <Image
              source={{ uri }}
              style={{ width: '100%', height: '100%' }}
              resizeMode="cover"
            />
            <TouchableOpacity
              onPress={() => removePhoto(index)}
              accessibilityLabel={`Remove photo ${index + 1}`}
              style={{
                position: 'absolute',
                top: 4,
                right: 4,
                width: 24,
                height: 24,
                borderRadius: 12,
                backgroundColor: 'rgba(0,0,0,0.6)',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Ionicons name="close" size={16} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        ))}
      </View>

      {/* Photo Picker Buttons */}
      {photos.length < MAX_PHOTOS && (
        <View style={{ flexDirection: 'row', gap: 12, marginBottom: 24 }}>
          <TouchableOpacity
            onPress={pickFromCamera}
            accessibilityLabel="Take photo with camera"
            style={{
              flex: 1,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              paddingVertical: 14,
              borderRadius: 12,
              borderWidth: 2,
              borderColor: '#E5E7EB',
              borderStyle: 'dashed',
            }}
          >
            <Ionicons name="camera-outline" size={22} color="#6B7F5E" />
            <Text style={{ fontSize: 15, fontWeight: '600', color: '#374151' }}>
              Camera
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={pickFromLibrary}
            accessibilityLabel="Choose photos from library"
            style={{
              flex: 1,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              paddingVertical: 14,
              borderRadius: 12,
              borderWidth: 2,
              borderColor: '#E5E7EB',
              borderStyle: 'dashed',
            }}
          >
            <Ionicons name="images-outline" size={22} color="#6B7F5E" />
            <Text style={{ fontSize: 15, fontWeight: '600', color: '#374151' }}>
              Gallery
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Notes Input */}
      <Text style={{ fontSize: 15, fontWeight: '600', color: '#374151', marginBottom: 8 }}>
        Notes (optional)
      </Text>
      <TextInput
        value={notes}
        onChangeText={setNotes}
        placeholder="How did it turn out?"
        placeholderTextColor="#9CA3AF"
        multiline
        numberOfLines={3}
        style={{
          borderWidth: 1,
          borderColor: '#E5E7EB',
          borderRadius: 12,
          padding: 14,
          fontSize: 15,
          color: '#1F2937',
          minHeight: 80,
          textAlignVertical: 'top',
          marginBottom: 24,
        }}
      />

      {/* Upload Progress */}
      {isUploading && (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 10,
            marginBottom: 16,
          }}
        >
          <ActivityIndicator color="#6B7F5E" />
          <Text style={{ fontSize: 14, color: '#6B7280' }}>{uploadProgress}</Text>
        </View>
      )}

      {/* Action Buttons */}
      <View style={{ gap: 12 }}>
        <Button
          title={photos.length > 0 ? 'Save with Photos' : 'Save Cooking Log'}
          onPress={handleSaveWithPhotos}
          fullWidth
          loading={isUploading}
          disabled={isUploading}
          icon={<Ionicons name="checkmark-circle-outline" size={20} color="#FFFFFF" />}
        />
        <Button
          title="Just Mark as Cooked"
          onPress={handleJustMarkCooked}
          variant="outline"
          fullWidth
          disabled={isUploading}
          icon={<Ionicons name="flame-outline" size={20} color="#6B7F5E" />}
        />
      </View>
    </ScrollView>
  );
}
