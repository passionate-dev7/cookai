import React from 'react';
import { View, TextInput, TouchableOpacity, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface SearchBarProps {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  onSubmit?: () => void;
  onClear?: () => void;
  autoFocus?: boolean;
  style?: ViewStyle;
}

export function SearchBar({
  value,
  onChangeText,
  placeholder = 'Search...',
  onSubmit,
  onClear,
  autoFocus = false,
  style,
}: SearchBarProps) {
  return (
    <View
      style={[
        {
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: '#F3F4F6',
          borderRadius: 12,
          paddingHorizontal: 12,
          height: 48,
        },
        style,
      ]}
    >
      <Ionicons name="search-outline" size={20} color="#9CA3AF" />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#9CA3AF"
        autoFocus={autoFocus}
        returnKeyType="search"
        onSubmitEditing={onSubmit}
        style={{
          flex: 1,
          marginLeft: 8,
          fontSize: 16,
          color: '#1F2937',
        }}
      />
      {value.length > 0 && (
        <TouchableOpacity
          onPress={() => {
            onChangeText('');
            onClear?.();
          }}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="close-circle" size={20} color="#9CA3AF" />
        </TouchableOpacity>
      )}
    </View>
  );
}
