import React from 'react';
import { View, TouchableOpacity, ViewStyle } from 'react-native';

interface CardProps {
  children: React.ReactNode;
  onPress?: () => void;
  style?: ViewStyle;
  padding?: 'none' | 'sm' | 'md' | 'lg';
  variant?: 'default' | 'elevated' | 'outlined';
}

export function Card({
  children,
  onPress,
  style,
  padding = 'md',
  variant = 'default',
}: CardProps) {
  const paddingValues = {
    none: 0,
    sm: 8,
    md: 16,
    lg: 24,
  };

  const baseStyle: ViewStyle = {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: paddingValues[padding],
  };

  const variantStyles: Record<string, ViewStyle> = {
    default: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 3,
      elevation: 1,
    },
    elevated: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.1,
      shadowRadius: 12,
      elevation: 4,
    },
    outlined: {
      borderWidth: 1,
      borderColor: '#E5E7EB',
    },
  };

  const combinedStyle = [baseStyle, variantStyles[variant], style];

  if (onPress) {
    return (
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.7}
        style={combinedStyle}
      >
        {children}
      </TouchableOpacity>
    );
  }

  return <View style={combinedStyle}>{children}</View>;
}
