import React from 'react';
import { View, ActivityIndicator, Text, StyleSheet, ViewStyle } from 'react-native';
import { useTheme } from '../../hooks/useTheme';

interface Props {
  fullScreen?: boolean;
  label?: string;
  style?: ViewStyle;
}

export function LoadingSpinner({ fullScreen = false, label, style }: Props) {
  const { colors, typography } = useTheme();

  return (
    <View style={[fullScreen ? styles.fullScreen : styles.inline, style]}>
      <ActivityIndicator size={fullScreen ? 'large' : 'small'} color={colors.primary} />
      {label ? (
        <Text style={[typography.body2, { color: colors.textSecondary, marginTop: 8 }]}>
          {label}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  fullScreen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inline: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
});
