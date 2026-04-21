import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../../hooks/useTheme';
import { formatDuration } from '../../utils/dateUtils';

interface Props {
  minutes: number;
}

export function DurationPill({ minutes }: Props) {
  const { colors, typography, radius } = useTheme();
  return (
    <View
      style={[styles.pill, { backgroundColor: colors.surface3, borderRadius: radius.full }]}
      accessibilityLabel={`Duration: ${formatDuration(minutes)}`}
    >
      <Text style={[typography.caption, { color: colors.textSecondary, fontWeight: '500' }]}>
        {formatDuration(minutes)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    alignSelf: 'flex-start',
  },
});
