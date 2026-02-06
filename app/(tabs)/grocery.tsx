import React, { useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useGroceryStore, useUserStore } from '@/src/stores';
import { EmptyState, Button, Card, Input } from '@/src/shared/components';
import { GroceryItem } from '@/src/types/database';

export default function GroceryScreen() {
  const router = useRouter();
  const { isAuthenticated } = useUserStore();
  const [refreshing, setRefreshing] = useState(false);
  const [newItemName, setNewItemName] = useState('');
  const [isAdding, setIsAdding] = useState(false);

  const {
    activeList,
    fetchLists,
    createList,
    addItem,
    toggleItemChecked,
    deleteItem,
    clearCheckedItems,
    getItemsByAisle,
  } = useGroceryStore();

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchLists();
    setRefreshing(false);
  };

  const handleAddItem = async () => {
    if (!newItemName.trim()) return;

    if (!activeList) {
      // Create a new list if none exists
      const list = await createList('My Grocery List');
      if (list) {
        await addItem(list.id, {
          name: newItemName.trim(),
          quantity: null,
          unit: null,
          aisle: null,
          is_checked: false,
          notes: null,
          order_index: 0,
          recipe_id: null,
          ingredient_id: null,
        });
      }
    } else {
      await addItem(activeList.id, {
        name: newItemName.trim(),
        quantity: null,
        unit: null,
        aisle: null,
        is_checked: false,
        notes: null,
        order_index: (activeList.items?.length || 0) + 1,
        recipe_id: null,
        ingredient_id: null,
      });
    }

    setNewItemName('');
    setIsAdding(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const handleToggleItem = async (itemId: string) => {
    await toggleItemChecked(itemId);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleDeleteItem = (itemId: string) => {
    Alert.alert('Delete Item', 'Are you sure you want to delete this item?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => deleteItem(itemId),
      },
    ]);
  };

  const handleClearChecked = () => {
    if (!activeList) return;
    const checkedCount = activeList.items?.filter((i) => i.is_checked).length || 0;
    if (checkedCount === 0) return;

    Alert.alert(
      'Clear Checked Items',
      `Remove ${checkedCount} checked item${checkedCount > 1 ? 's' : ''}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: () => clearCheckedItems(activeList.id),
        },
      ]
    );
  };

  const itemsByAisle = React.useMemo(() => {
    if (!activeList?.items) return {};
    return getItemsByAisle(activeList.items);
  }, [activeList?.items]);

  const aisles = Object.keys(itemsByAisle).sort((a, b) => {
    if (a === 'Other') return 1;
    if (b === 'Other') return -1;
    return a.localeCompare(b);
  });

  const renderItem = ({ item }: { item: GroceryItem }) => (
    <TouchableOpacity
      onPress={() => handleToggleItem(item.id)}
      onLongPress={() => handleDeleteItem(item.id)}
      activeOpacity={0.7}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: 16,
        backgroundColor: '#FFFFFF',
        borderBottomWidth: 1,
        borderBottomColor: '#F3F4F6',
      }}
    >
      <View
        style={{
          width: 24,
          height: 24,
          borderRadius: 12,
          borderWidth: 2,
          borderColor: item.is_checked ? '#14B8A6' : '#D1D5DB',
          backgroundColor: item.is_checked ? '#14B8A6' : 'transparent',
          alignItems: 'center',
          justifyContent: 'center',
          marginRight: 12,
        }}
      >
        {item.is_checked && <Ionicons name="checkmark" size={14} color="#FFFFFF" />}
      </View>
      <View style={{ flex: 1 }}>
        <Text
          style={{
            fontSize: 16,
            color: item.is_checked ? '#9CA3AF' : '#1F2937',
            textDecorationLine: item.is_checked ? 'line-through' : 'none',
          }}
        >
          {item.name}
        </Text>
        {(item.quantity || item.unit || item.notes) && (
          <Text style={{ fontSize: 13, color: '#6B7280', marginTop: 2 }}>
            {item.quantity && item.unit
              ? `${item.quantity} ${item.unit}`
              : item.quantity || item.unit || ''}
            {item.notes ? ` - ${item.notes}` : ''}
          </Text>
        )}
      </View>
    </TouchableOpacity>
  );

  const checkedCount = activeList?.items?.filter((i) => i.is_checked).length || 0;
  const totalCount = activeList?.items?.length || 0;

  // Show sign-in prompt if not authenticated
  if (!isAuthenticated) {
    return (
      <View style={{ flex: 1, backgroundColor: '#F9FAFB', justifyContent: 'center', alignItems: 'center', padding: 40 }}>
        <View style={{
          width: 80, height: 80, borderRadius: 40,
          backgroundColor: '#FFF7ED', alignItems: 'center', justifyContent: 'center', marginBottom: 20,
        }}>
          <Ionicons name="cart-outline" size={36} color="#F97316" />
        </View>
        <Text style={{ fontSize: 20, fontWeight: '600', color: '#1F2937', textAlign: 'center', marginBottom: 8 }}>
          Sign in to use Grocery Lists
        </Text>
        <Text style={{ fontSize: 15, color: '#6B7280', textAlign: 'center', lineHeight: 22, maxWidth: 280, marginBottom: 24 }}>
          Create and sync grocery lists across your devices
        </Text>
        <Button
          title="Sign In"
          onPress={() => router.push('/(tabs)/profile')}
          size="md"
        />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#F9FAFB' }}>
      {/* Add Item Section */}
      {isAdding ? (
        <View style={{ padding: 16, backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#E5E7EB' }}>
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <View style={{ flex: 1 }}>
              <Input
                value={newItemName}
                onChangeText={setNewItemName}
                placeholder="Add an item..."
                autoFocus
                onSubmitEditing={handleAddItem}
                containerStyle={{ marginBottom: 0 }}
              />
            </View>
            <Button title="Add" onPress={handleAddItem} size="md" disabled={!newItemName.trim()} />
            <TouchableOpacity
              onPress={() => {
                setIsAdding(false);
                setNewItemName('');
              }}
              style={{ justifyContent: 'center' }}
            >
              <Ionicons name="close" size={24} color="#6B7280" />
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <TouchableOpacity
          onPress={() => setIsAdding(true)}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            padding: 16,
            backgroundColor: '#FFFFFF',
            borderBottomWidth: 1,
            borderBottomColor: '#E5E7EB',
            gap: 12,
          }}
        >
          <View
            style={{
              width: 36,
              height: 36,
              borderRadius: 18,
              backgroundColor: '#FFF7ED',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Ionicons name="add" size={20} color="#F97316" />
          </View>
          <Text style={{ fontSize: 16, color: '#6B7280' }}>Add an item</Text>
        </TouchableOpacity>
      )}

      {/* Progress Bar */}
      {totalCount > 0 && (
        <View style={{ padding: 16, backgroundColor: '#FFFFFF' }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
            <Text style={{ fontSize: 14, color: '#6B7280' }}>
              {checkedCount} of {totalCount} items
            </Text>
            {checkedCount > 0 && (
              <TouchableOpacity onPress={handleClearChecked}>
                <Text style={{ fontSize: 14, color: '#F97316', fontWeight: '500' }}>
                  Clear checked
                </Text>
              </TouchableOpacity>
            )}
          </View>
          <View style={{ height: 6, backgroundColor: '#E5E7EB', borderRadius: 3, overflow: 'hidden' }}>
            <View
              style={{
                height: '100%',
                width: `${(checkedCount / totalCount) * 100}%`,
                backgroundColor: '#14B8A6',
                borderRadius: 3,
              }}
            />
          </View>
        </View>
      )}

      {/* Items by Aisle */}
      {aisles.length > 0 ? (
        <FlatList
          data={aisles}
          keyExtractor={(aisle) => aisle}
          contentContainerStyle={{ paddingBottom: 100 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#F97316" />
          }
          renderItem={({ item: aisle }) => (
            <View style={{ marginTop: 16 }}>
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  paddingHorizontal: 16,
                  paddingVertical: 8,
                  gap: 8,
                }}
              >
                <Ionicons name="location-outline" size={16} color="#F97316" />
                <Text style={{ fontSize: 14, fontWeight: '600', color: '#374151' }}>{aisle}</Text>
                <Text style={{ fontSize: 13, color: '#9CA3AF' }}>
                  ({itemsByAisle[aisle].length})
                </Text>
              </View>
              <Card variant="default" padding="none" style={{ marginHorizontal: 16, overflow: 'hidden' }}>
                {itemsByAisle[aisle].map((item, index) => (
                  <React.Fragment key={item.id}>
                    {renderItem({ item })}
                  </React.Fragment>
                ))}
              </Card>
            </View>
          )}
        />
      ) : (
        <EmptyState
          icon="cart-outline"
          title="Your list is empty"
          description="Add items to your grocery list or generate a list from recipes"
          actionLabel="Add Item"
          onAction={() => setIsAdding(true)}
          style={{ marginTop: 60 }}
        />
      )}
    </View>
  );
}
