import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../../hooks/useTheme';

interface Props {
  typeName: string;
  colourHex: string;
  size?: 'small' | 'large';
}

export function ShiftTypeBadge({ typeName, colourHex, size = 'small' }: Props) {
  const { typography, radius } = useTheme();
  const isLarge = size === 'large';

  return (
    <View
      style={[
        styles.badge,
        { backgroundColor: colourHex, borderRadius: radius.sm },
        isLarge && styles.badgeLarge,
      ]}
      accessibilityLabel={`${typeName} shift type`}
    >
      <Text
        style={[
          typography.caption,
          styles.text,
          isLarge && { ...typography.body2, fontWeight: '600' },
        ]}
      >
        {typeName}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    alignSelf: 'flex-start',
  },
  badgeLarge: {
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  text: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
});
