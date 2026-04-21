import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ViewStyle } from 'react-native';
import { useTheme } from '../../hooks/useTheme';

interface Segment {
  label: string;
  value: string;
}

interface Props {
  segments: Segment[];
  selectedValue: string;
  onSelect: (value: string) => void;
  style?: ViewStyle;
}

export function SegmentedControl({ segments, selectedValue, onSelect, style }: Props) {
  const { colors, typography, radius, tapTargets } = useTheme();

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: colors.surface3, borderRadius: radius.md, minHeight: tapTargets.minimum },
        style,
      ]}
    >
      {segments.map(seg => {
        const isSelected = seg.value === selectedValue;
        return (
          <TouchableOpacity
            key={seg.value}
            onPress={() => onSelect(seg.value)}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel={seg.label}
            accessibilityState={{ selected: isSelected }}
            style={[
              styles.segment,
              { borderRadius: radius.md - 2, minHeight: tapTargets.minimum },
              isSelected && { backgroundColor: colors.primary },
            ]}
          >
            <Text
              style={[
                typography.body2,
                { fontWeight: '600', color: isSelected ? '#FFFFFF' : colors.textSecondary },
              ]}
            >
              {seg.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    padding: 3,
  },
  segment: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
  },
});
