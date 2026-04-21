import React from 'react';
import { TouchableOpacity, Text, StyleSheet } from 'react-native';
import { useTheme } from '../../hooks/useTheme';

interface Props {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  colourHex?: string;
}

export function Chip({ label, selected = false, onPress, colourHex }: Props) {
  const { colors, typography, radius } = useTheme();

  const bgColor = selected ? (colourHex ?? colors.primary) : colors.surface3;
  const textColor = selected ? '#FFFFFF' : colors.textSecondary;

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      style={[
        styles.chip,
        { backgroundColor: bgColor, borderRadius: radius.full },
        selected && { borderColor: bgColor },
      ]}
    >
      <Text style={[typography.caption, { color: textColor, fontWeight: '500' }]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    minHeight: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
});
