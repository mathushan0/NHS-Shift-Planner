import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet, AccessibilityInfo } from 'react-native';
import { useTheme } from '../../hooks/useTheme';

type StatusType = 'in_progress' | 'scheduled' | 'completed' | 'cancelled' | 'default';

interface Props {
  status: StatusType;
  size?: number;
}

const STATUS_COLORS: Record<StatusType, (colors: { success: string; primary: string; textDisabled: string; error: string; textSecondary: string }) => string> = {
  in_progress: c => c.success,
  scheduled: c => c.primary,
  completed: c => c.textDisabled,
  cancelled: c => c.error,
  default: c => c.textSecondary,
};

const STATUS_LABELS: Record<StatusType, string> = {
  in_progress: 'Shift in progress',
  scheduled: 'Shift scheduled',
  completed: 'Shift completed',
  cancelled: 'Shift cancelled',
  default: 'Status unknown',
};

export function StatusDot({ status, size = 10 }: Props) {
  const { colors } = useTheme();
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const opacityAnim = useRef(new Animated.Value(1)).current;
  const [reduceMotion, setReduceMotion] = React.useState(false);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
  }, []);

  useEffect(() => {
    if (status === 'in_progress' && !reduceMotion) {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.parallel([
            Animated.timing(scaleAnim, { toValue: 1.4, duration: 750, useNativeDriver: true }),
            Animated.timing(opacityAnim, { toValue: 0.6, duration: 750, useNativeDriver: true }),
          ]),
          Animated.parallel([
            Animated.timing(scaleAnim, { toValue: 1, duration: 750, useNativeDriver: true }),
            Animated.timing(opacityAnim, { toValue: 1, duration: 750, useNativeDriver: true }),
          ]),
        ])
      );
      pulse.start();
      return () => pulse.stop();
    }
  }, [status, reduceMotion, scaleAnim, opacityAnim]);

  const color = STATUS_COLORS[status](colors);

  return (
    <Animated.View
      style={[
        styles.dot,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: color,
          transform: [{ scale: scaleAnim }],
          opacity: opacityAnim,
        },
      ]}
      accessibilityLabel={STATUS_LABELS[status]}
    />
  );
}

const styles = StyleSheet.create({
  dot: {},
});
