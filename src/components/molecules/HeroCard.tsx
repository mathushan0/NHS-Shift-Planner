import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useTheme } from '../../hooks/useTheme';
import { ShiftWithType } from '../../types';
import { formatDate, formatTime, formatDuration } from '../../utils/dateUtils';
import { StatusDot } from '../atoms/StatusDot';

interface Props {
  shift: ShiftWithType | null;
  onEdit?: () => void;
  onSetReminder?: () => void;
}

export function HeroCard({ shift, onEdit, onSetReminder }: Props) {
  const { colors, typography, spacing, radius, elevation } = useTheme();

  if (!shift) {
    return (
      <View
        style={[
          styles.card,
          elevation[2],
          { backgroundColor: colors.surface1, borderRadius: radius.xl },
        ]}
      >
        <Text style={[typography.caption, { color: colors.textSecondary, letterSpacing: 0.5 }]}>
          TODAY
        </Text>
        <View style={styles.dayOffContainer}>
          <Text style={{ fontSize: 36 }}>🎉</Text>
          <Text style={[typography.heading2, { color: colors.textPrimary, marginLeft: 12 }]}>
            Day off
          </Text>
        </View>
        <Text style={[typography.body2, { color: colors.textSecondary }]}>
          No shifts scheduled today
        </Text>
      </View>
    );
  }

  const isInProgress = shift.status === 'in_progress';
  const headerBg = shift.shift_type.colour_hex;
  const date = formatDate(shift.start_datetime, 'EEEE d MMMM');
  const startTime = formatTime(shift.start_datetime, true);
  const endTime = formatTime(shift.end_datetime, true);
  const duration = formatDuration(shift.duration_minutes);

  return (
    <View
      style={[
        styles.card,
        elevation[2],
        { backgroundColor: headerBg, borderRadius: radius.xl },
      ]}
      accessibilityLabel={`Next shift: ${shift.shift_type.name} on ${date} from ${startTime} to ${endTime}, ${duration}`}
    >
      {/* Header row */}
      <View style={styles.headerRow}>
        <Text style={[typography.caption, { color: 'rgba(255,255,255,0.8)', letterSpacing: 0.5 }]}>
          {isInProgress ? 'SHIFT IN PROGRESS' : 'NEXT SHIFT'}
        </Text>
        {isInProgress ? (
          <View style={styles.statusRow}>
            <StatusDot status="in_progress" size={8} />
            <Text style={[typography.caption, { color: '#FFFFFF', marginLeft: 4, fontWeight: '600' }]}>
              Active
            </Text>
          </View>
        ) : null}
      </View>

      {/* Main content */}
      <View style={styles.mainRow}>
        <View style={{ flex: 1 }}>
          <Text style={[typography.heading1, { color: '#FFFFFF' }]}>
            {shift.shift_type.name}
          </Text>
          <Text style={[typography.body2, { color: 'rgba(255,255,255,0.85)' }]}>
            {date}
          </Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={[typography.heading3, { color: '#FFFFFF' }]}>
            {startTime} – {endTime}
          </Text>
          <Text style={[typography.body2, { color: 'rgba(255,255,255,0.85)' }]}>
            {duration}
          </Text>
        </View>
      </View>

      {/* Location */}
      {shift.location ? (
        <Text
          style={[typography.body2, { color: 'rgba(255,255,255,0.85)', marginTop: spacing[2] }]}
          numberOfLines={1}
        >
          📍 {shift.location}
        </Text>
      ) : null}

      {/* Actions */}
      <View style={styles.actionsRow}>
        {onSetReminder ? (
          <TouchableOpacity
            onPress={onSetReminder}
            style={styles.actionButton}
            accessibilityRole="button"
            accessibilityLabel="Set reminder"
          >
            <Text style={[typography.body2, { color: '#FFFFFF', fontWeight: '600' }]}>
              ⏰ Reminder
            </Text>
          </TouchableOpacity>
        ) : null}
        {onEdit ? (
          <TouchableOpacity
            onPress={onEdit}
            style={styles.actionButton}
            accessibilityRole="button"
            accessibilityLabel="Edit shift"
          >
            <Text style={[typography.body2, { color: '#FFFFFF', fontWeight: '600' }]}>
              ✏️ Edit
            </Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 20,
    marginHorizontal: 16,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dayOffContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 12,
  },
  mainRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  actionsRow: {
    flexDirection: 'row',
    marginTop: 16,
    gap: 12,
  },
  actionButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.2)',
    minHeight: 44,
    justifyContent: 'center',
  },
});
