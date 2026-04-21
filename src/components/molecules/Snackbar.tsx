import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Text,
  TouchableOpacity,
  StyleSheet,
  View,
  AccessibilityInfo,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../hooks/useTheme';
import { useUIStore, SnackbarConfig } from '../../stores/uiStore';

const VARIANT_COLORS = {
  default: '#323232',
  success: '#00A499',
  error: '#DA291C',
  warning: '#FFB81C',
};

const VARIANT_TEXT_COLORS = {
  default: '#FFFFFF',
  success: '#FFFFFF',
  error: '#FFFFFF',
  warning: '#231F20',
};

interface SingleSnackbarProps {
  config: SnackbarConfig;
  onDismiss: (id: string) => void;
}

function SingleSnackbar({ config, onDismiss }: SingleSnackbarProps) {
  const { typography, spacing, radius } = useTheme();
  const insets = useSafeAreaInsets();
  const translateY = useRef(new Animated.Value(100)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    Animated.parallel([
      Animated.spring(translateY, { toValue: 0, useNativeDriver: true, damping: 15, stiffness: 200 }),
      Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
    ]).start();

    timerRef.current = setTimeout(() => {
      dismiss();
    }, config.duration ?? 5000);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  function dismiss() {
    Animated.parallel([
      Animated.timing(translateY, { toValue: 100, duration: 200, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 0, duration: 200, useNativeDriver: true }),
    ]).start(() => onDismiss(config.id));
  }

  const bgColor = VARIANT_COLORS[config.variant];
  const textColor = VARIANT_TEXT_COLORS[config.variant];

  return (
    <Animated.View
      style={[
        styles.snackbar,
        {
          backgroundColor: bgColor,
          borderRadius: radius.md,
          marginBottom: insets.bottom + spacing[4],
          marginHorizontal: spacing[4],
          transform: [{ translateY }],
          opacity,
        },
      ]}
      accessibilityLiveRegion="polite"
      accessibilityRole="alert"
    >
      <Text
        style={[typography.body2, { color: textColor, flex: 1 }]}
        numberOfLines={2}
      >
        {config.message}
      </Text>
      {config.actionLabel ? (
        <TouchableOpacity
          onPress={() => {
            config.onAction?.();
            dismiss();
          }}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityRole="button"
          accessibilityLabel={config.actionLabel}
        >
          <Text style={[typography.body2, { color: textColor, fontWeight: '700', marginLeft: 12 }]}>
            {config.actionLabel}
          </Text>
        </TouchableOpacity>
      ) : null}
    </Animated.View>
  );
}

export function SnackbarContainer() {
  const snackbarQueue = useUIStore(state => state.snackbarQueue);
  const dismissSnackbar = useUIStore(state => state.dismissSnackbar);
  const latest = snackbarQueue[snackbarQueue.length - 1];

  if (!latest) return null;

  return (
    <View style={styles.container} pointerEvents="box-none">
      <SingleSnackbar key={latest.id} config={latest} onDismiss={dismissSnackbar} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 80, // above tab bar
    left: 0,
    right: 0,
    zIndex: 9999,
  },
  snackbar: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    minHeight: 48,
  },
});
