import React from 'react';
import {
  TouchableOpacity,
  Text,
  ActivityIndicator,
  StyleSheet,
  ViewStyle,
} from 'react-native';
import { useTheme } from '../../hooks/useTheme';

interface Props {
  label: string;
  onPress: () => void;
  isLoading?: boolean;
  disabled?: boolean;
  destructive?: boolean;
  style?: ViewStyle;
  accessibilityLabel?: string;
}

export function PrimaryButton({
  label,
  onPress,
  isLoading = false,
  disabled = false,
  destructive = false,
  style,
  accessibilityLabel,
}: Props) {
  const { colors, typography, radius, tapTargets } = useTheme();

  const bg = disabled
    ? colors.surface3
    : destructive
    ? colors.error
    : colors.primary;

  const textColor = disabled ? colors.textDisabled : '#FFFFFF';

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || isLoading}
      activeOpacity={0.8}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: disabled || isLoading, busy: isLoading }}
      style={[
        styles.button,
        {
          backgroundColor: bg,
          borderRadius: radius.lg,
          minHeight: tapTargets.preferred,
        },
        style,
      ]}
    >
      {isLoading ? (
        <ActivityIndicator color={textColor} size="small" />
      ) : (
        <Text style={[typography.button, { color: textColor }]}>{label}</Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
});
