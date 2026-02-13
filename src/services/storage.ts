import { Alert } from 'react-native';
import * as ImageManipulator from 'expo-image-manipulator';
import { supabase } from './supabase';

const BUCKET_NAME = 'cooking-photos';
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const MAX_DIMENSION = 1200;
const COMPRESS_QUALITY = 0.7;

/**
 * Compress and resize an image before upload.
 * Returns the local URI of the processed image.
 */
export async function compressImage(uri: string): Promise<string> {
  const result = await ImageManipulator.manipulateAsync(
    uri,
    [{ resize: { width: MAX_DIMENSION } }],
    { compress: COMPRESS_QUALITY, format: ImageManipulator.SaveFormat.JPEG }
  );
  return result.uri;
}

/**
 * Upload a single photo to Supabase Storage.
 * Returns the public URL on success, null on failure.
 */
export async function uploadPhoto(
  localUri: string,
  userId: string
): Promise<string | null> {
  try {
    // Compress first
    const compressedUri = await compressImage(localUri);

    // Fetch file as array buffer
    const response = await fetch(compressedUri);
    const blob = await response.blob();

    // Check size after compression
    if (blob.size > MAX_FILE_SIZE) {
      Alert.alert(
        'Photo Too Large',
        'This photo is still over 5MB after compression. Please choose a smaller photo.'
      );
      return null;
    }

    const timestamp = Date.now();
    const randomId = Math.random().toString(36).substring(2, 10);
    const filePath = `${userId}/${timestamp}-${randomId}.jpg`;

    const arrayBuffer = await blob.arrayBuffer();

    const { error } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(filePath, arrayBuffer, {
        contentType: 'image/jpeg',
        upsert: false,
      });

    if (error) throw error;

    const { data } = supabase.storage.from(BUCKET_NAME).getPublicUrl(filePath);
    return data.publicUrl;
  } catch (error) {
    console.error('Failed to upload photo:', error);
    return null;
  }
}

/**
 * Upload multiple photos in parallel.
 * Calls onProgress with (completed, total) for progress tracking.
 * Returns array of public URLs (skips any that failed).
 */
export async function uploadPhotos(
  localUris: string[],
  userId: string,
  onProgress?: (completed: number, total: number) => void
): Promise<string[]> {
  const urls: string[] = [];
  const total = localUris.length;
  let completed = 0;

  const results = await Promise.allSettled(
    localUris.map(async (uri) => {
      const url = await uploadPhoto(uri, userId);
      completed++;
      onProgress?.(completed, total);
      return url;
    })
  );

  for (const result of results) {
    if (result.status === 'fulfilled' && result.value) {
      urls.push(result.value);
    }
  }

  return urls;
}

/**
 * Delete a photo from Supabase Storage by its public URL.
 */
export async function deletePhoto(publicUrl: string): Promise<boolean> {
  try {
    // Extract the file path from the public URL
    const urlParts = publicUrl.split(`${BUCKET_NAME}/`);
    if (urlParts.length < 2) return false;

    const filePath = urlParts[1];
    const { error } = await supabase.storage.from(BUCKET_NAME).remove([filePath]);

    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Failed to delete photo:', error);
    return false;
  }
}
