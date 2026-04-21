import React from 'react';
import { TouchableOpacity, Text, StyleSheet, ViewStyle } from 'react-native';
import { useTheme } from '../../hooks/useTheme';

interface Props {
  label: string;
  onPress: () => void;
  destructive?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
  accessibilityLabel?: string;
}

export function SecondaryButton({ label, onPress, destructive, disabled, style, accessibilityLabel }: Props) {
  const { colors, typography, radius, tapTargets } = useTheme();
  const color = destructive ? colors.error : colors.primary;

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled }}
      style={[
        styles.button,
        { borderColor: color, borderRadius: radius.lg, minHeight: tapTargets.preferred },
        style,
      ]}
    >
      <Text style={[typography.button, { color: disabled ? colors.textDisabled : color }]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    borderWidth: 1.5,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
});
