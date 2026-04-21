import React from 'react';
import { View, Text, TextInput, StyleSheet, TextInputProps, ViewStyle } from 'react-native';
import { useTheme } from '../../hooks/useTheme';

interface Props extends TextInputProps {
  label: string;
  error?: string;
  containerStyle?: ViewStyle;
}

export function FormTextInput({ label, error, containerStyle, ...inputProps }: Props) {
  const { colors, typography, radius, spacing, tapTargets } = useTheme();

  return (
    <View style={[styles.container, containerStyle]}>
      <Text style={[typography.body2, { color: colors.textSecondary, marginBottom: spacing[1] }]}>
        {label}
      </Text>
      <TextInput
        {...inputProps}
        style={[
          typography.body1,
          styles.input,
          {
            color: colors.textPrimary,
            backgroundColor: colors.surface1,
            borderColor: error ? colors.error : colors.border,
            borderRadius: radius.md,
            minHeight: tapTargets.preferred,
            paddingHorizontal: spacing[4],
          },
          inputProps.style,
        ]}
        placeholderTextColor={colors.textDisabled}
        accessibilityLabel={label}
        accessibilityHint={error ? `Error: ${error}` : undefined}
      />
      {error ? (
        <Text style={[typography.caption, { color: colors.error, marginTop: 4 }]}>
          {error}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {},
  input: {
    borderWidth: 1.5,
  },
});
