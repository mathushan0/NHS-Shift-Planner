import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { useTheme } from '../../hooks/useTheme';
import { PrimaryButton } from '../atoms/PrimaryButton';

interface Props {
  title: string;
  body: string;
  ctaLabel?: string;
  onCta?: () => void;
  icon?: string;
  style?: ViewStyle;
}

export function EmptyState({ title, body, ctaLabel, onCta, icon = '📅', style }: Props) {
  const { colors, typography, spacing } = useTheme();

  return (
    <View style={[styles.container, style]}>
      <Text style={styles.icon}>{icon}</Text>
      <Text style={[typography.heading2, { color: colors.textPrimary, textAlign: 'center', marginBottom: spacing[2] }]}>
        {title}
      </Text>
      <Text style={[typography.body1, { color: colors.textSecondary, textAlign: 'center', marginBottom: spacing[6] }]}>
        {body}
      </Text>
      {ctaLabel && onCta ? (
        <PrimaryButton label={ctaLabel} onPress={onCta} style={{ width: 'auto', paddingHorizontal: 32 }} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  icon: {
    fontSize: 56,
    marginBottom: 16,
  },
});
