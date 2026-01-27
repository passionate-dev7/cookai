import React, { useState } from 'react';
import {
  View,
  TextInput,
  Text,
  TouchableOpacity,
  ViewStyle,
  TextStyle,
  TextInputProps,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface InputProps extends Omit<TextInputProps, 'style'> {
  label?: string;
  error?: string;
  hint?: string;
  leftIcon?: keyof typeof Ionicons.glyphMap;
  rightIcon?: keyof typeof Ionicons.glyphMap;
  onRightIconPress?: () => void;
  containerStyle?: ViewStyle;
  inputStyle?: TextStyle;
  required?: boolean;
}

export function Input({
  label,
  error,
  hint,
  leftIcon,
  rightIcon,
  onRightIconPress,
  containerStyle,
  inputStyle,
  required,
  secureTextEntry,
  ...props
}: InputProps) {
  const [isFocused, setIsFocused] = useState(false);
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);

  const isPassword = secureTextEntry !== undefined;
  const showPassword = isPassword && isPasswordVisible;

  const getBorderColor = () => {
    if (error) return '#EF4444';
    if (isFocused) return '#F97316';
    return '#E5E7EB';
  };

  return (
    <View style={[{ marginBottom: 16 }, containerStyle]}>
      {label && (
        <View style={{ flexDirection: 'row', marginBottom: 6 }}>
          <Text style={{ fontSize: 14, fontWeight: '500', color: '#374151' }}>
            {label}
          </Text>
          {required && (
            <Text style={{ color: '#EF4444', marginLeft: 2 }}>*</Text>
          )}
        </View>
      )}

      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          borderWidth: 1.5,
          borderColor: getBorderColor(),
          borderRadius: 12,
          backgroundColor: '#FFFFFF',
          paddingHorizontal: 12,
        }}
      >
        {leftIcon && (
          <Ionicons
            name={leftIcon}
            size={20}
            color={isFocused ? '#F97316' : '#9CA3AF'}
            style={{ marginRight: 8 }}
          />
        )}

        <TextInput
          {...props}
          secureTextEntry={isPassword && !showPassword}
          onFocus={(e) => {
            setIsFocused(true);
            props.onFocus?.(e);
          }}
          onBlur={(e) => {
            setIsFocused(false);
            props.onBlur?.(e);
          }}
          style={[
            {
              flex: 1,
              paddingVertical: 14,
              fontSize: 16,
              color: '#1F2937',
            },
            inputStyle,
          ]}
          placeholderTextColor="#9CA3AF"
        />

        {isPassword && (
          <TouchableOpacity
            onPress={() => setIsPasswordVisible(!isPasswordVisible)}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons
              name={showPassword ? 'eye-off-outline' : 'eye-outline'}
              size={20}
              color="#9CA3AF"
            />
          </TouchableOpacity>
        )}

        {rightIcon && !isPassword && (
          <TouchableOpacity
            onPress={onRightIconPress}
            disabled={!onRightIconPress}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name={rightIcon} size={20} color="#9CA3AF" />
          </TouchableOpacity>
        )}
      </View>

      {error && (
        <Text style={{ fontSize: 12, color: '#EF4444', marginTop: 4 }}>
          {error}
        </Text>
      )}

      {hint && !error && (
        <Text style={{ fontSize: 12, color: '#6B7280', marginTop: 4 }}>
          {hint}
        </Text>
      )}
    </View>
  );
}
