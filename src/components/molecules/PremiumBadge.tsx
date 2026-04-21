/**
 * PremiumBadge — small lock/crown indicator for premium-gated features.
 * Tapping it navigates to the Subscription upsell screen.
 */

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../../hooks/useTheme';

interface Props {
  size?: 'xs' | 'sm' | 'md';
  label?: string;
  style?: object;
}

export function PremiumBadge({ size = 'sm', label, style }: Props) {
  const { colors, radius } = useTheme();
  const navigation = useNavigation<any>();

  const iconSize = size === 'xs' ? 10 : size === 'sm' ? 14 : 18;
  const fontSize = size === 'xs' ? 9 : size === 'sm' ? 11 : 13;
  const px = size === 'xs' ? 4 : 6;
  const py = size === 'xs' ? 2 : 4;

  return (
    <TouchableOpacity
      onPress={() => navigation.navigate('Subscription')}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel="Premium feature — tap to upgrade"
      style={[
        styles.badge,
        {
          backgroundColor: '#FFB81C',
          borderRadius: radius.sm,
          paddingHorizontal: px,
          paddingVertical: py,
        },
        style,
      ]}
    >
      <Text style={{ fontSize: iconSize }}>👑</Text>
      {label ? (
        <Text
          style={[styles.label, { fontSize, color: '#231F20' }]}
        >
          {label}
        </Text>
      ) : null}
    </TouchableOpacity>
  );
}

/**
 * PremiumLockOverlay — covers a component with a semi-transparent lock,
 * used to visually gate premium features while still showing a preview.
 */
export function PremiumLockOverlay({ message = 'Premium Feature' }: { message?: string }) {
  const { colors, typography, radius } = useTheme();
  const navigation = useNavigation<any>();

  return (
    <TouchableOpacity
      onPress={() => navigation.navigate('Subscription')}
      activeOpacity={0.9}
      style={[styles.overlay, { backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: radius.lg }]}
      accessibilityRole="button"
      accessibilityLabel={`${message} — tap to upgrade`}
    >
      <Text style={styles.lockIcon}>🔒</Text>
      <Text style={[typography.body1, { color: '#FFFFFF', fontWeight: '700', marginTop: 8, textAlign: 'center' }]}>
        {message}
      </Text>
      <Text style={[typography.caption, { color: 'rgba(255,255,255,0.8)', marginTop: 4, textAlign: 'center' }]}>
        Tap to unlock with Premium
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
  },
  label: {
    fontWeight: '700',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
    padding: 16,
  },
  lockIcon: {
    fontSize: 36,
  },
});
