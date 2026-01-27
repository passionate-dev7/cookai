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
import { useRecipeStore, useSubscriptionStore, useUserStore } from '@/src/stores';
import { Button, Input, Card } from '@/src/shared/components';

interface IngredientInput {
  name: string;
  quantity: string;
  unit: string;
}

export default function AddRecipeModal() {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [prepTime, setPrepTime] = useState('');
  const [cookTime, setCookTime] = useState('');
  const [servings, setServings] = useState('');
  const [difficulty, setDifficulty] = useState<'easy' | 'medium' | 'hard' | null>(null);
  const [ingredients, setIngredients] = useState<IngredientInput[]>([{ name: '', quantity: '', unit: '' }]);
  const [instructions, setInstructions] = useState<string[]>(['']);
  const [isSaving, setIsSaving] = useState(false);

  const { addRecipe } = useRecipeStore();
  const { profile } = useUserStore();
  const { canAddRecipe } = useSubscriptionStore();

  const canSave = canAddRecipe(profile?.recipe_count || 0);

  const addIngredient = () => {
    setIngredients([...ingredients, { name: '', quantity: '', unit: '' }]);
  };

  const updateIngredient = (index: number, field: keyof IngredientInput, value: string) => {
    const updated = [...ingredients];
    updated[index][field] = value;
    setIngredients(updated);
  };

  const removeIngredient = (index: number) => {
    if (ingredients.length === 1) return;
    setIngredients(ingredients.filter((_, i) => i !== index));
  };

  const addInstruction = () => {
    setInstructions([...instructions, '']);
  };

  const updateInstruction = (index: number, value: string) => {
    const updated = [...instructions];
    updated[index] = value;
    setInstructions(updated);
  };

  const removeInstruction = (index: number) => {
    if (instructions.length === 1) return;
    setInstructions(instructions.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    if (!title.trim()) {
      Alert.alert('Error', 'Please enter a recipe title');
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
        Alert.alert('Error', 'Please sign in to save recipes');
        return;
      }

      const validIngredients = ingredients.filter((ing) => ing.name.trim());
      const validInstructions = instructions.filter((inst) => inst.trim());

      const recipe = await addRecipe(
        {
          user_id: user.id,
          title: title.trim(),
          description: description.trim() || null,
          source_type: 'manual',
          source_url: null,
          source_platform: null,
          image_url: null,
          prep_time_minutes: prepTime ? parseInt(prepTime) : null,
          cook_time_minutes: cookTime ? parseInt(cookTime) : null,
          total_time_minutes: (prepTime ? parseInt(prepTime) : 0) + (cookTime ? parseInt(cookTime) : 0) || null,
          servings: servings ? parseInt(servings) : null,
          difficulty,
          cuisine: null,
          tags: [],
          instructions: validInstructions,
          notes: null,
          is_favorite: false,
          times_cooked: 0,
          last_cooked_at: null,
          cookbook_id: null,
        },
        validIngredients.map((ing, index) => ({
          name: ing.name,
          quantity: ing.quantity ? parseFloat(ing.quantity) : null,
          unit: ing.unit || null,
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
    } catch (error) {
      Alert.alert('Error', 'Failed to save recipe. Please try again.');
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
        {/* Basic Info */}
        <Input
          label="Recipe Title"
          value={title}
          onChangeText={setTitle}
          placeholder="Enter recipe name"
          required
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

        {/* Time & Servings */}
        <View style={{ flexDirection: 'row', gap: 12, marginBottom: 16 }}>
          <View style={{ flex: 1 }}>
            <Input
              label="Prep Time"
              value={prepTime}
              onChangeText={setPrepTime}
              placeholder="mins"
              keyboardType="numeric"
              containerStyle={{ marginBottom: 0 }}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Input
              label="Cook Time"
              value={cookTime}
              onChangeText={setCookTime}
              placeholder="mins"
              keyboardType="numeric"
              containerStyle={{ marginBottom: 0 }}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Input
              label="Servings"
              value={servings}
              onChangeText={setServings}
              placeholder="#"
              keyboardType="numeric"
              containerStyle={{ marginBottom: 0 }}
            />
          </View>
        </View>

        {/* Difficulty */}
        <Text style={{ fontSize: 14, fontWeight: '500', color: '#374151', marginBottom: 8 }}>
          Difficulty
        </Text>
        <View style={{ flexDirection: 'row', gap: 10, marginBottom: 24 }}>
          {(['easy', 'medium', 'hard'] as const).map((level) => (
            <TouchableOpacity
              key={level}
              onPress={() => setDifficulty(level)}
              style={{
                flex: 1,
                paddingVertical: 10,
                borderRadius: 10,
                backgroundColor: difficulty === level ? '#FFF7ED' : '#F3F4F6',
                borderWidth: difficulty === level ? 1.5 : 0,
                borderColor: '#F97316',
                alignItems: 'center',
              }}
            >
              <Text
                style={{
                  fontSize: 14,
                  fontWeight: '500',
                  color: difficulty === level ? '#F97316' : '#6B7280',
                  textTransform: 'capitalize',
                }}
              >
                {level}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Ingredients */}
        <View style={{ marginBottom: 24 }}>
          <Text style={{ fontSize: 16, fontWeight: '600', color: '#1F2937', marginBottom: 12 }}>
            Ingredients
          </Text>
          {ingredients.map((ing, index) => (
            <View key={index} style={{ flexDirection: 'row', gap: 8, marginBottom: 8, alignItems: 'flex-start' }}>
              <View style={{ width: 60 }}>
                <Input
                  value={ing.quantity}
                  onChangeText={(v) => updateIngredient(index, 'quantity', v)}
                  placeholder="Qty"
                  keyboardType="numeric"
                  containerStyle={{ marginBottom: 0 }}
                />
              </View>
              <View style={{ width: 70 }}>
                <Input
                  value={ing.unit}
                  onChangeText={(v) => updateIngredient(index, 'unit', v)}
                  placeholder="Unit"
                  containerStyle={{ marginBottom: 0 }}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Input
                  value={ing.name}
                  onChangeText={(v) => updateIngredient(index, 'name', v)}
                  placeholder="Ingredient name"
                  containerStyle={{ marginBottom: 0 }}
                />
              </View>
              {ingredients.length > 1 && (
                <TouchableOpacity
                  onPress={() => removeIngredient(index)}
                  style={{ padding: 12, marginTop: 4 }}
                >
                  <Ionicons name="close-circle" size={20} color="#EF4444" />
                </TouchableOpacity>
              )}
            </View>
          ))}
          <TouchableOpacity
            onPress={addIngredient}
            style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 8, gap: 6 }}
          >
            <Ionicons name="add-circle-outline" size={20} color="#F97316" />
            <Text style={{ fontSize: 14, color: '#F97316', fontWeight: '500' }}>Add Ingredient</Text>
          </TouchableOpacity>
        </View>

        {/* Instructions */}
        <View style={{ marginBottom: 24 }}>
          <Text style={{ fontSize: 16, fontWeight: '600', color: '#1F2937', marginBottom: 12 }}>
            Instructions
          </Text>
          {instructions.map((inst, index) => (
            <View key={index} style={{ flexDirection: 'row', gap: 8, marginBottom: 8, alignItems: 'flex-start' }}>
              <View
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 14,
                  backgroundColor: '#FFF7ED',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginTop: 10,
                }}
              >
                <Text style={{ fontSize: 12, fontWeight: '600', color: '#F97316' }}>{index + 1}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Input
                  value={inst}
                  onChangeText={(v) => updateInstruction(index, v)}
                  placeholder={`Step ${index + 1}`}
                  multiline
                  numberOfLines={2}
                  containerStyle={{ marginBottom: 0 }}
                  inputStyle={{ minHeight: 60, textAlignVertical: 'top' }}
                />
              </View>
              {instructions.length > 1 && (
                <TouchableOpacity
                  onPress={() => removeInstruction(index)}
                  style={{ padding: 8, marginTop: 8 }}
                >
                  <Ionicons name="close-circle" size={20} color="#EF4444" />
                </TouchableOpacity>
              )}
            </View>
          ))}
          <TouchableOpacity
            onPress={addInstruction}
            style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 8, gap: 6 }}
          >
            <Ionicons name="add-circle-outline" size={20} color="#F97316" />
            <Text style={{ fontSize: 14, color: '#F97316', fontWeight: '500' }}>Add Step</Text>
          </TouchableOpacity>
        </View>

        <Button
          title={canSave ? 'Save Recipe' : 'Upgrade to Save'}
          onPress={handleSave}
          loading={isSaving}
          disabled={!title.trim()}
          fullWidth
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
