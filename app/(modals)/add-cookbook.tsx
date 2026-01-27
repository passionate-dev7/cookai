import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useRecipeStore, useSubscriptionStore, useUserStore } from '@/src/stores';
import { Button, Input, Card } from '@/src/shared/components';

export default function AddCookbookModal() {
  const router = useRouter();
  const params = useLocalSearchParams<{ scannedData?: string; scannedIsbn?: string }>();

  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [isbn, setIsbn] = useState('');
  const [publisher, setPublisher] = useState('');
  const [year, setYear] = useState('');
  const [description, setDescription] = useState('');
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const { addCookbook } = useRecipeStore();
  const { profile } = useUserStore();
  const { canAddCookbook } = useSubscriptionStore();

  const canSave = canAddCookbook(profile?.cookbook_count || 0);

  // Handle scanned data from barcode scanner
  useEffect(() => {
    if (params.scannedData) {
      try {
        const data = JSON.parse(params.scannedData);
        if (data.title) setTitle(data.title);
        if (data.author) setAuthor(data.author);
        if (data.isbn) setIsbn(data.isbn);
        if (data.publisher) setPublisher(data.publisher);
        if (data.publishedYear) setYear(data.publishedYear.toString());
        if (data.description) setDescription(data.description);
        if (data.coverUrl) setCoverUrl(data.coverUrl);
      } catch (e) {
        console.error('Failed to parse scanned data:', e);
      }
    } else if (params.scannedIsbn) {
      setIsbn(params.scannedIsbn);
    }
  }, [params.scannedData, params.scannedIsbn]);

  const handleScan = () => {
    router.push('/(modals)/barcode-scanner');
  };

  const handleSave = async () => {
    if (!title.trim()) {
      Alert.alert('Error', 'Please enter a cookbook title');
      return;
    }

    if (!canSave) {
      router.push('/(modals)/paywall');
      return;
    }

    setIsSaving(true);

    try {
      const { data: { user } } = await (await import('@/src/services/supabase')).supabase.auth.getUser();
      if (!user) {
        Alert.alert('Error', 'Please sign in to save cookbooks');
        return;
      }

      const cookbook = await addCookbook({
        user_id: user.id,
        title: title.trim(),
        author: author.trim() || null,
        isbn: isbn.trim() || null,
        cover_image_url: coverUrl,
        page_count: null,
        publisher: publisher.trim() || null,
        published_year: year ? parseInt(year) : null,
        description: description.trim() || null,
        is_scanned: false,
      });

      if (cookbook) {
        router.dismiss();
        router.push(`/cookbook/${cookbook.id}`);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to save cookbook. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={{ flex: 1 }}
    >
      <ScrollView
        style={{ flex: 1, backgroundColor: '#FFFFFF' }}
        contentContainerStyle={{ padding: 20, paddingBottom: 100 }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Scan Option */}
        <Card
          onPress={handleScan}
          variant="outlined"
          padding="md"
          style={{ marginBottom: 24, borderStyle: 'dashed' }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View
              style={{
                width: 48,
                height: 48,
                borderRadius: 12,
                backgroundColor: '#FFF7ED',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Ionicons name="barcode-outline" size={24} color="#F97316" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 16, fontWeight: '600', color: '#1F2937' }}>
                Scan Barcode
              </Text>
              <Text style={{ fontSize: 13, color: '#6B7280' }}>
                Automatically fill details from ISBN
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
          </View>
        </Card>

        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 24 }}>
          <View style={{ flex: 1, height: 1, backgroundColor: '#E5E7EB' }} />
          <Text style={{ paddingHorizontal: 12, fontSize: 13, color: '#9CA3AF' }}>or enter manually</Text>
          <View style={{ flex: 1, height: 1, backgroundColor: '#E5E7EB' }} />
        </View>

        {/* Manual Entry Form */}
        <Input
          label="Cookbook Title"
          value={title}
          onChangeText={setTitle}
          placeholder="Enter cookbook name"
          required
        />

        <Input
          label="Author"
          value={author}
          onChangeText={setAuthor}
          placeholder="Author name (optional)"
        />

        <View style={{ flexDirection: 'row', gap: 12 }}>
          <View style={{ flex: 1 }}>
            <Input
              label="ISBN"
              value={isbn}
              onChangeText={setIsbn}
              placeholder="ISBN (optional)"
              keyboardType="numeric"
            />
          </View>
          <View style={{ flex: 1 }}>
            <Input
              label="Year Published"
              value={year}
              onChangeText={setYear}
              placeholder="Year (optional)"
              keyboardType="numeric"
              maxLength={4}
            />
          </View>
        </View>

        <Input
          label="Publisher"
          value={publisher}
          onChangeText={setPublisher}
          placeholder="Publisher name (optional)"
        />

        <Input
          label="Description"
          value={description}
          onChangeText={setDescription}
          placeholder="Brief description (optional)"
          multiline
          numberOfLines={3}
          inputStyle={{ minHeight: 80, textAlignVertical: 'top' }}
        />

        {/* Free tier notice */}
        {!canSave && (
          <Card
            variant="outlined"
            padding="md"
            style={{ marginBottom: 16, backgroundColor: '#FFF7ED', borderColor: '#FDBA74' }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <Ionicons name="information-circle" size={24} color="#F97316" />
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 14, fontWeight: '500', color: '#9A3412' }}>
                  Cookbook limit reached
                </Text>
                <TouchableOpacity onPress={() => router.push('/(modals)/paywall')}>
                  <Text style={{ fontSize: 13, color: '#F97316', marginTop: 2 }}>
                    Upgrade for unlimited cookbooks
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </Card>
        )}

        <Button
          title={canSave ? 'Add Cookbook' : 'Upgrade to Add'}
          onPress={handleSave}
          loading={isSaving}
          disabled={!title.trim()}
          fullWidth
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
