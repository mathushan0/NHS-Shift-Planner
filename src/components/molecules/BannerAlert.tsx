import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ViewStyle } from 'react-native';
import { useTheme } from '../../hooks/useTheme';

type BannerVariant = 'warning' | 'info' | 'error';

interface Props {
  message: string;
  variant: BannerVariant;
  ctaLabel?: string;
  onCta?: () => void;
  onDismiss?: () => void;
  style?: ViewStyle;
}

const VARIANT_STYLES: Record<BannerVariant, { bg: string; text: string }> = {
  warning: { bg: '#FFB81C', text: '#231F20' },
  info: { bg: '#41B6E6', text: '#FFFFFF' },
  error: { bg: '#DA291C', text: '#FFFFFF' },
};

export function BannerAlert({ message, variant, ctaLabel, onCta, onDismiss, style }: Props) {
  const { typography, spacing, radius } = useTheme();
  const vs = VARIANT_STYLES[variant];

  return (
    <View
      style={[styles.banner, { backgroundColor: vs.bg, minHeight: 56 }, style]}
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
    >
      <Text
        style={[typography.body2, { color: vs.text, flex: 1, fontWeight: '500' }]}
        numberOfLines={2}
      >
        {message}
      </Text>
      {ctaLabel && onCta ? (
        <TouchableOpacity
          onPress={onCta}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityRole="button"
          accessibilityLabel={ctaLabel}
        >
          <Text style={[typography.body2, { color: vs.text, fontWeight: '700', marginLeft: 12 }]}>
            {ctaLabel}
          </Text>
        </TouchableOpacity>
      ) : null}
      {onDismiss ? (
        <TouchableOpacity
          onPress={onDismiss}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={{ marginLeft: 8 }}
          accessibilityRole="button"
          accessibilityLabel="Dismiss"
        >
          <Text style={[typography.body2, { color: vs.text, fontWeight: '700' }]}>✕</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
});
