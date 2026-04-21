import React, { useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  PanResponder,
} from 'react-native';
import { useTheme } from '../../hooks/useTheme';
import { ShiftWithType } from '../../types';
import { formatDate, formatTime, formatDuration } from '../../utils/dateUtils';
import { ShiftTypeBadge } from '../atoms/ShiftTypeBadge';
import { DurationPill } from '../atoms/DurationPill';

interface Props {
  shift: ShiftWithType;
  onPress: () => void;
  onDelete?: () => void;
}

export function ShiftCard({ shift, onPress, onDelete }: Props) {
  const { colors, typography, spacing, radius, elevation } = useTheme();
  const translateX = useRef(new Animated.Value(0)).current;
  const deleteOpacity = useRef(new Animated.Value(0)).current;

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, { dx, dy }) =>
        Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy),
      onPanResponderMove: (_, { dx }) => {
        if (dx < 0) {
          translateX.setValue(Math.max(dx, -120));
          deleteOpacity.setValue(Math.min(Math.abs(dx) / 80, 1));
        }
      },
      onPanResponderRelease: (_, { dx, vx }) => {
        if (dx < -80 || vx < -0.5) {
          Animated.parallel([
            Animated.spring(translateX, { toValue: -80, useNativeDriver: true }),
            Animated.timing(deleteOpacity, { toValue: 1, duration: 100, useNativeDriver: true }),
          ]).start();
        } else {
          Animated.parallel([
            Animated.spring(translateX, { toValue: 0, useNativeDriver: true }),
            Animated.timing(deleteOpacity, { toValue: 0, duration: 200, useNativeDriver: true }),
          ]).start();
        }
      },
    })
  ).current;

  const date = formatDate(shift.start_datetime, 'EEE d MMM');
  const startTime = formatTime(shift.start_datetime, true);
  const endTime = formatTime(shift.end_datetime, true);

  const accessLabel = `${shift.shift_type.name}, ${date}, ${startTime} to ${endTime}${shift.location ? `, at ${shift.location}` : ''}`;

  return (
    <View style={styles.swipeContainer}>
      {/* Delete action revealed by swipe */}
      <Animated.View
        style={[styles.deleteAction, { backgroundColor: colors.error, opacity: deleteOpacity }]}
      >
        <TouchableOpacity
          onPress={onDelete}
          style={styles.deleteButton}
          accessibilityRole="button"
          accessibilityLabel="Delete shift"
        >
          <Text style={[typography.body2, { color: '#FFFFFF', fontWeight: '600' }]}>Delete</Text>
        </TouchableOpacity>
      </Animated.View>

      <Animated.View
        style={{ transform: [{ translateX }] }}
        {...(onDelete ? panResponder.panHandlers : {})}
      >
        <TouchableOpacity
          onPress={onPress}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel={accessLabel}
          style={[
            styles.card,
            elevation[1],
            {
              backgroundColor: colors.surface1,
              borderRadius: radius.md,
              marginHorizontal: spacing[4],
              marginBottom: spacing[2],
            },
          ]}
        >
          {/* Left colour bar */}
          <View
            style={[styles.colorBar, { backgroundColor: shift.shift_type.colour_hex }]}
          />
          <View style={styles.content}>
            <View style={styles.row}>
              <ShiftTypeBadge
                typeName={shift.shift_type.name}
                colourHex={shift.shift_type.colour_hex}
                abbreviation={shift.shift_type.abbreviation}
              />
              <DurationPill minutes={shift.duration_minutes} />
            </View>
            <Text style={[typography.body2, { color: colors.textPrimary, marginTop: 4 }]}>
              {date} · {startTime}–{endTime}
            </Text>
            {shift.location ? (
              <Text
                style={[typography.caption, { color: colors.textSecondary, marginTop: 2 }]}
                numberOfLines={1}
              >
                📍 {shift.location}
              </Text>
            ) : null}
            {shift.is_bank_shift === 1 ? (
              <View style={[styles.bankBadge, { backgroundColor: colors.primaryLight }]}>
                <Text style={[typography.caption, { color: '#FFFFFF', fontWeight: '600' }]}>
                  BANK
                </Text>
              </View>
            ) : null}
          </View>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  swipeContainer: {
    position: 'relative',
    overflow: 'hidden',
  },
  deleteAction: {
    position: 'absolute',
    right: 16,
    top: 0,
    bottom: 8,
    width: 80,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
  },
  deleteButton: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    flexDirection: 'row',
    overflow: 'hidden',
  },
  colorBar: {
    width: 4,
  },
  content: {
    flex: 1,
    padding: 12,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  bankBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginTop: 4,
  },
});
