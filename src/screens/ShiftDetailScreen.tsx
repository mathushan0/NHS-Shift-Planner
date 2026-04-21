import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { format, parseISO } from 'date-fns';
import { useTheme } from '../hooks/useTheme';
import { useShiftStore } from '../stores/shiftStore';
import { useUIStore } from '../stores/uiStore';
import { HomeStackParamList, ShiftStatus } from '../types';
import { formatDate, formatTime, formatDuration } from '../utils/dateUtils';
import { ShiftTypeBadge } from '../components/atoms/ShiftTypeBadge';
import { StatusDot } from '../components/atoms/StatusDot';
import { PrimaryButton } from '../components/atoms/PrimaryButton';
import { SecondaryButton } from '../components/atoms/SecondaryButton';
import { LoadingSpinner } from '../components/molecules/LoadingSpinner';

type Props = NativeStackScreenProps<any, 'ShiftDetail'>;

const STATUS_OPTIONS: Array<{ label: string; value: ShiftStatus; emoji: string }> = [
  { label: 'Scheduled', value: 'scheduled', emoji: '📅' },
  { label: 'Completed', value: 'completed', emoji: '✅' },
  { label: 'Cancelled', value: 'cancelled', emoji: '❌' },
  { label: 'Sick', value: 'sick', emoji: '🤒' },
  { label: 'Annual Leave', value: 'annual_leave', emoji: '🏖️' },
  { label: 'Swapped Out', value: 'swapped_out', emoji: '🔄' },
];

export function ShiftDetailScreen({ navigation, route }: Props) {
  const { colors, typography, spacing, radius, elevation } = useTheme();
  const { loadShiftById, selectedShift, deleteShift, updateStatus } = useShiftStore();
  const { showSnackbar } = useUIStore();
  const [isLoading, setIsLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);

  const shiftId: string = route.params?.shiftId;

  useEffect(() => {
    loadShift();
  }, [shiftId]);

  async function loadShift() {
    setIsLoading(true);
    await loadShiftById(shiftId);
    setIsLoading(false);
  }

  async function handleDelete() {
    Alert.alert(
      'Delete Shift',
      'Are you sure you want to delete this shift? This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setIsDeleting(true);
            try {
              await deleteShift(shiftId);
              showSnackbar({ message: 'Shift deleted', variant: 'default' });
              navigation.goBack();
            } catch {
              showSnackbar({ message: 'Could not delete shift', variant: 'error' });
              setIsDeleting(false);
            }
          },
        },
      ]
    );
  }

  async function handleStatusChange(status: ShiftStatus) {
    await updateStatus(shiftId, status);
    await loadShift();
    showSnackbar({ message: `Status updated to ${status.replace('_', ' ')}`, variant: 'success' });
  }

  if (isLoading) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: colors.screenBackground }]}>
        <LoadingSpinner fullScreen label="Loading shift..." />
      </SafeAreaView>
    );
  }

  if (!selectedShift) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: colors.screenBackground }]}>
        <View style={styles.center}>
          <Text style={[typography.body1, { color: colors.textSecondary }]}>Shift not found.</Text>
        </View>
      </SafeAreaView>
    );
  }

  const shift = selectedShift;
  const date = formatDate(shift.start_datetime, 'EEEE, d MMMM yyyy');
  const startTime = formatTime(shift.start_datetime, true);
  const endTime = formatTime(shift.end_datetime, true);
  const duration = formatDuration(shift.duration_minutes);

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.screenBackground }]}>
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        {/* Hero header */}
        <View
          style={[
            styles.hero,
            { backgroundColor: shift.shift_type.colour_hex, paddingHorizontal: spacing[4] },
          ]}
        >
          <ShiftTypeBadge
            typeName={shift.shift_type.name}
            colourHex={shift.shift_type.colour_hex}
            size="large"
          />
          <Text style={[typography.heading1, { color: '#FFFFFF', marginBottom: 4 }]}>
            {startTime} – {endTime}
          </Text>
          <Text style={[typography.body1, { color: 'rgba(255,255,255,0.85)' }]}>
            {date}
          </Text>
          <Text style={[typography.body2, { color: 'rgba(255,255,255,0.75)', marginTop: 4 }]}>
            {duration}
          </Text>
        </View>

        {/* Details card */}
        <View
          style={[
            styles.card,
            elevation[1],
            {
              backgroundColor: colors.surface1,
              borderRadius: radius.lg,
              marginHorizontal: spacing[4],
              marginTop: -16,
              padding: spacing[4],
            },
          ]}
        >
          {/* Status */}
          <View style={styles.detailRow}>
            <Text style={[typography.body2, { color: colors.textSecondary, width: 100 }]}>Status</Text>
            <View style={styles.statusBadge}>
              <StatusDot status={shift.status} size={8} />
              <Text style={[typography.body2, { color: colors.textPrimary, fontWeight: '600', marginLeft: 6 }]}>
                {shift.status.replace(/_/g, ' ')}
              </Text>
            </View>
          </View>

          {shift.location ? (
            <View style={styles.detailRow}>
              <Text style={[typography.body2, { color: colors.textSecondary, width: 100 }]}>Location</Text>
              <Text style={[typography.body2, { color: colors.textPrimary, flex: 1 }]}>
                📍 {shift.location}
              </Text>
            </View>
          ) : null}

          {shift.is_bank_shift === 1 ? (
            <View style={styles.detailRow}>
              <Text style={[typography.body2, { color: colors.textSecondary, width: 100 }]}>Type</Text>
              <View style={[styles.bankBadge, { backgroundColor: colors.primaryLight }]}>
                <Text style={[typography.caption, { color: '#FFFFFF', fontWeight: '700' }]}>BANK</Text>
              </View>
            </View>
          ) : null}

          {shift.notes ? (
            <View style={[styles.detailRow, { alignItems: 'flex-start' }]}>
              <Text style={[typography.body2, { color: colors.textSecondary, width: 100 }]}>Notes</Text>
              <Text style={[typography.body2, { color: colors.textPrimary, flex: 1 }]}>
                {shift.notes}
              </Text>
            </View>
          ) : null}

          {shift.reminders.length > 0 ? (
            <View style={[styles.detailRow, { alignItems: 'flex-start' }]}>
              <Text style={[typography.body2, { color: colors.textSecondary, width: 100 }]}>Reminders</Text>
              <View style={{ flex: 1, gap: 4 }}>
                {shift.reminders.map((r, i) => (
                  <Text key={i} style={[typography.body2, { color: colors.textPrimary }]}>
                    🔔 {r.minutes_before >= 60
                      ? `${r.minutes_before / 60}h before`
                      : `${r.minutes_before} min before`}
                  </Text>
                ))}
              </View>
            </View>
          ) : null}
        </View>

        {/* Update status */}
        <View style={[styles.section, { paddingHorizontal: spacing[4], marginTop: spacing[4] }]}>
          <Text style={[typography.heading3, { color: colors.textPrimary, marginBottom: spacing[3] }]}>
            Update Status
          </Text>
          <View style={styles.statusGrid}>
            {STATUS_OPTIONS.map(opt => (
              <TouchableOpacity
                key={opt.value}
                onPress={() => handleStatusChange(opt.value)}
                style={[
                  styles.statusChip,
                  {
                    backgroundColor:
                      shift.status === opt.value ? colors.primary : colors.surface1,
                    borderColor:
                      shift.status === opt.value ? colors.primary : colors.border,
                    borderRadius: radius.md,
                  },
                ]}
                accessibilityRole="button"
                accessibilityState={{ selected: shift.status === opt.value }}
              >
                <Text style={{ fontSize: 18 }}>{opt.emoji}</Text>
                <Text
                  style={[
                    typography.caption,
                    {
                      color: shift.status === opt.value ? '#FFFFFF' : colors.textPrimary,
                      fontWeight: '600',
                      marginTop: 4,
                      textAlign: 'center',
                    },
                  ]}
                >
                  {opt.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Actions */}
        <View style={[styles.actions, { paddingHorizontal: spacing[4], marginTop: spacing[4] }]}>
          <PrimaryButton
            label="Edit Shift"
            onPress={() => navigation.navigate('AddEditShift', { shiftId: shift.id })}
            style={{ marginBottom: spacing[3] }}
          />
          <SecondaryButton
            label="Delete Shift"
            onPress={handleDelete}
            destructive
            disabled={isDeleting}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  hero: {
    paddingTop: 24,
    paddingBottom: 40,
  },
  card: {},
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(0,0,0,0.06)',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  bankBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  section: {},
  statusGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  statusChip: {
    width: '30%',
    flexGrow: 1,
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderWidth: 1.5,
    alignItems: 'center',
    minHeight: 64,
    justifyContent: 'center',
  },
  actions: {},
});
