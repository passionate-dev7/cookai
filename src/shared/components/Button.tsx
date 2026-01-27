import React from 'react';
import {
  TouchableOpacity,
  Text,
  ActivityIndicator,
  ViewStyle,
  TextStyle,
} from 'react-native';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  loading?: boolean;
  fullWidth?: boolean;
  icon?: React.ReactNode;
  iconPosition?: 'left' | 'right';
  style?: ViewStyle;
  textStyle?: TextStyle;
}

export function Button({
  title,
  onPress,
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  fullWidth = false,
  icon,
  iconPosition = 'left',
  style,
  textStyle,
}: ButtonProps) {
  const isDisabled = disabled || loading;

  const baseStyles: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    ...(fullWidth && { width: '100%' }),
  };

  const sizeStyles: Record<string, ViewStyle> = {
    sm: { paddingHorizontal: 12, paddingVertical: 8, gap: 6 },
    md: { paddingHorizontal: 20, paddingVertical: 12, gap: 8 },
    lg: { paddingHorizontal: 24, paddingVertical: 16, gap: 10 },
  };

  const variantStyles: Record<string, ViewStyle> = {
    primary: {
      backgroundColor: isDisabled ? '#FED7AA' : '#F97316',
    },
    secondary: {
      backgroundColor: isDisabled ? '#99F6E4' : '#14B8A6',
    },
    outline: {
      backgroundColor: 'transparent',
      borderWidth: 2,
      borderColor: isDisabled ? '#FED7AA' : '#F97316',
    },
    ghost: {
      backgroundColor: 'transparent',
    },
  };

  const textSizeStyles: Record<string, TextStyle> = {
    sm: { fontSize: 14, fontWeight: '600' },
    md: { fontSize: 16, fontWeight: '600' },
    lg: { fontSize: 18, fontWeight: '700' },
  };

  const textVariantStyles: Record<string, TextStyle> = {
    primary: { color: '#FFFFFF' },
    secondary: { color: '#FFFFFF' },
    outline: { color: isDisabled ? '#FED7AA' : '#F97316' },
    ghost: { color: isDisabled ? '#9CA3AF' : '#F97316' },
  };

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={isDisabled}
      activeOpacity={0.7}
      style={[
        baseStyles,
        sizeStyles[size],
        variantStyles[variant],
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator
          color={variant === 'primary' || variant === 'secondary' ? '#FFFFFF' : '#F97316'}
          size="small"
        />
      ) : (
        <>
          {icon && iconPosition === 'left' && icon}
          <Text
            style={[
              textSizeStyles[size],
              textVariantStyles[variant],
              textStyle,
            ]}
          >
            {title}
          </Text>
          {icon && iconPosition === 'right' && icon}
        </>
      )}
    </TouchableOpacity>
  );
}
