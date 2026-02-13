import React from 'react';
import { View, ActivityIndicator, Text, ViewStyle } from 'react-native';

interface LoadingSpinnerProps {
  size?: 'small' | 'large';
  color?: string;
  message?: string;
  fullScreen?: boolean;
  style?: ViewStyle;
}

export function LoadingSpinner({
  size = 'large',
  color = '#6B7F5E',
  message,
  fullScreen = false,
  style,
}: LoadingSpinnerProps) {
  const content = (
    <View style={[{ alignItems: 'center', justifyContent: 'center' }, style]}>
      <ActivityIndicator size={size} color={color} />
      {message && (
        <Text
          style={{
            marginTop: 12,
            fontSize: 14,
            color: '#6B7280',
            textAlign: 'center',
          }}
        >
          {message}
        </Text>
      )}
    </View>
  );

  if (fullScreen) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#FFFFFF',
        }}
      >
        {content}
      </View>
    );
  }

  return content;
}
