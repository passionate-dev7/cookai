import React from 'react';
import { View, Text, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Button } from './Button';

interface EmptyStateProps {
  icon?: keyof typeof Ionicons.glyphMap;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  style?: ViewStyle;
}

export function EmptyState({
  icon = 'folder-open-outline',
  title,
  description,
  actionLabel,
  onAction,
  style,
}: EmptyStateProps) {
  return (
    <View
      style={[
        {
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          padding: 32,
        },
        style,
      ]}
    >
      <View
        style={{
          width: 80,
          height: 80,
          borderRadius: 40,
          backgroundColor: '#E8EDE4',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 20,
        }}
      >
        <Ionicons name={icon} size={36} color="#6B7F5E" />
      </View>

      <Text
        style={{
          fontSize: 20,
          fontWeight: '600',
          color: '#1F2937',
          textAlign: 'center',
          marginBottom: 8,
        }}
      >
        {title}
      </Text>

      {description && (
        <Text
          style={{
            fontSize: 15,
            color: '#6B7280',
            textAlign: 'center',
            lineHeight: 22,
            maxWidth: 280,
            marginBottom: 24,
          }}
        >
          {description}
        </Text>
      )}

      {actionLabel && onAction && (
        <Button title={actionLabel} onPress={onAction} size="md" />
      )}
    </View>
  );
}
