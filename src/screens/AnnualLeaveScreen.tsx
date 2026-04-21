/**
 * AnnualLeaveScreen — Annual Leave Tracker (Premium)
 *
 * NHS default allowance: 27 days annual leave + 8 bank holidays
 * Tracks: allowance, days taken, days remaining
 * Visual progress bar, leave history.
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  TextInput,
  Alert,
  Switch,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { format, getYear, startOfYear, endOfYear } from 'date-fns';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../hooks/useTheme';
import { useShiftStore } from '../stores/shiftStore';
import { useSettingsStore } from '../stores/settingsStore';
import { useSubscriptionStore } from '../stores/subscriptionStore';
import { PremiumLockOverlay, PremiumBadge } from '../components/molecules/PremiumBadge';
import { LoadingSpinner } from '../components/molecules/LoadingSpinner';
import { ShiftWithType } from '../types';

type Props = NativeStackScreenProps<any, 'AnnualLeave'>;

const STORAGE_KEY = 'annual_leave_settings';

interface LeaveSettings {
  annualLeaveAllowance: number;    // days
  bankHolidayAllowance: number;    // days
  leaveYear: 'calendar' | 'april'; // NHS year: April–March or calendar
}

const NHS_DEFAULTS: LeaveSettings = {
  annualLeaveAllowance: 27,
  bankHolidayAllowance: 8,
  leaveYear: 'april',
};

// Shift types treated as leave
const LEAVE_TYPE_NAMES = ['annual leave', 'sick', 'bank holiday'];
const AL_TYPE_NAMES = ['annual leave'];
const BH_TYPE_NAMES = ['bank holiday'];

function isLeaveShift(shift: ShiftWithType, typeNames: string[]): boolean {
  return typeNames.some(n => shift.shift_type.name.toLowerCase().includes(n));
}

// Calculate days taken (assuming 1 shift = 1 working day, or use 7.5h as 1 day)
function shiftsToDays(shifts: ShiftWithType[], dailyHours = 7.5): number {
  const totalMins = shifts.reduce((a, s) => a + s.duration_minutes, 0);
  return Math.round((totalMins / (dailyHours * 60)) * 10) / 10;
}

function getLeaveYearRange(settings: LeaveSettings): { start: Date; end: Date } {
  const now = new Date();
  const year = now.getFullYear();
  if (settings.leaveYear === 'calendar') {
    return { start: startOfYear(now), end: endOfYear(now) };
  }
  // NHS April–March
  const aprilMonth = 3; // 0-indexed
  if (now.getMonth() >= aprilMonth) {
    return {
      start: new Date(year, aprilMonth, 1),
      end: new Date(year + 1, aprilMonth - 1, 31),
    };
  }
  return {
    start: new Date(year - 1, aprilMonth, 1),
    end: new Date(year, aprilMonth - 1, 31),
  };
}

export function AnnualLeaveScreen({ navigation }: Props) {
  const { colors, typography, spacing, radius, elevation } = useTheme();
  const isPremium = useSubscriptionStore(s => s.isPremium);
  const { loadShiftsForDateRange } = useShiftStore();
  const userId = useSettingsStore(s => s.userId) ?? 'local-user-1';

  const [settings, setSettings] = useState<LeaveSettings>(NHS_DEFAULTS);
  const [alShifts, setAlShifts] = useState<ShiftWithType[]>([]);
  const [bhShifts, setBhShifts] = useState<ShiftWithType[]>([]);
  const [allShifts, setAllShifts] = useState<ShiftWithType[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);

  // Editable state
  const [editAllowance, setEditAllowance] = useState('27');
  const [editBhAllowance, setEditBhAllowance] = useState('8');
  const [editLeaveYear, setEditLeaveYear] = useState<'calendar' | 'april'>('april');

  useEffect(() => {
    loadSettingsAndShifts();
  }, []);

  async function loadSettingsAndShifts() {
    setIsLoading(true);
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      const s: LeaveSettings = stored ? JSON.parse(stored) : NHS_DEFAULTS;
      setSettings(s);
      setEditAllowance(String(s.annualLeaveAllowance));
      setEditBhAllowance(String(s.bankHolidayAllowance));
      setEditLeaveYear(s.leaveYear);

      const range = getLeaveYearRange(s);
      const loaded = await loadShiftsForDateRange(
        userId,
        format(range.start, 'yyyy-MM-dd'),
        format(range.end, 'yyyy-MM-dd')
      );
      setAllShifts(loaded);
      setAlShifts(loaded.filter(sh => isLeaveShift(sh, AL_TYPE_NAMES)));
      setBhShifts(loaded.filter(sh => isLeaveShift(sh, BH_TYPE_NAMES)));
    } catch (e) {
      console.error(e);
    }
    setIsLoading(false);
  }

  async function saveSettings() {
    const newSettings: LeaveSettings = {
      annualLeaveAllowance: parseInt(editAllowance) || 27,
      bankHolidayAllowance: parseInt(editBhAllowance) || 8,
      leaveYear: editLeaveYear,
    };
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(newSettings));
    setSettings(newSettings);
    setIsEditing(false);
    await loadSettingsAndShifts();
  }

  const alDaysTaken = useMemo(() => shiftsToDays(alShifts), [alShifts]);
  const bhDaysTaken = useMemo(() => shiftsToDays(bhShifts), [bhShifts]);
  const alRemaining = Math.max(0, settings.annualLeaveAllowance - alDaysTaken);
  const bhRemaining = Math.max(0, settings.bankHolidayAllowance - bhDaysTaken);
  const alPct = settings.annualLeaveAllowance > 0
    ? Math.min(1, alDaysTaken / settings.annualLeaveAllowance)
    : 0;
  const bhPct = settings.bankHolidayAllowance > 0
    ? Math.min(1, bhDaysTaken / settings.bankHolidayAllowance)
    : 0;

  const range = getLeaveYearRange(settings);

  if (isLoading) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: colors.screenBackground }]}>
        <LoadingSpinner label="Loading leave data..." style={{ marginTop: 80 }} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.screenBackground }]}>
      {!isPremium && <PremiumLockOverlay message="Annual Leave Tracker is a Premium Feature" />}
      <ScrollView contentContainerStyle={[styles.content, { paddingHorizontal: spacing[4] }]}>
        {/* Header */}
        <View style={styles.headerRow}>
          <Text style={[typography.heading2, { color: colors.textPrimary }]}>Annual Leave</Text>
          <View style={styles.headerActions}>
            <PremiumBadge size="sm" />
            <TouchableOpacity onPress={() => setIsEditing(!isEditing)} style={styles.editBtn}>
              <Text style={[typography.body2, { color: colors.primary, fontWeight: '600' }]}>
                {isEditing ? 'Cancel' : '⚙️ Edit'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        <Text style={[typography.caption, { color: colors.textSecondary, marginBottom: spacing[4] }]}>
          Leave year: {format(range.start, 'd MMM yyyy')} – {format(range.end, 'd MMM yyyy')}
        </Text>

        {/* Edit settings */}
        {isEditing && (
          <View style={[styles.card, { backgroundColor: colors.surface1, borderRadius: radius.lg }]}>
            <Text style={[typography.body1, { color: colors.textPrimary, fontWeight: '700', marginBottom: spacing[3] }]}>
              Leave Allowance Settings
            </Text>
            <InputRow label="Annual leave days" value={editAllowance} onChange={setEditAllowance} colors={colors} typography={typography} radius={radius} />
            <InputRow label="Bank holiday days" value={editBhAllowance} onChange={setEditBhAllowance} colors={colors} typography={typography} radius={radius} />

            <Text style={[typography.body2, { color: colors.textSecondary, marginBottom: 8, marginTop: 8 }]}>Leave year type</Text>
            <View style={styles.yearTypeRow}>
              {(['april', 'calendar'] as const).map(y => (
                <TouchableOpacity
                  key={y}
                  onPress={() => setEditLeaveYear(y)}
                  style={[styles.yearBtn, {
                    backgroundColor: editLeaveYear === y ? colors.primary : colors.surface2,
                    borderRadius: radius.md,
                  }]}
                >
                  <Text style={[typography.body2, { color: editLeaveYear === y ? '#FFFFFF' : colors.textPrimary, fontWeight: '600' }]}>
                    {y === 'april' ? 'April–March (NHS)' : 'Calendar Year'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity
              onPress={saveSettings}
              style={[styles.saveBtn, { backgroundColor: colors.primary, borderRadius: radius.md }]}
            >
              <Text style={[typography.body1, { color: '#FFFFFF', fontWeight: '700' }]}>Save</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Annual Leave progress */}
        <View style={[styles.card, { backgroundColor: colors.surface1, borderRadius: radius.lg }]}>
          <View style={styles.leaveHeader}>
            <Text style={{ fontSize: 24 }}>🌴</Text>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={[typography.body1, { color: colors.textPrimary, fontWeight: '700' }]}>Annual Leave</Text>
              <Text style={[typography.caption, { color: colors.textSecondary }]}>
                {settings.annualLeaveAllowance} days total
              </Text>
            </View>
            <View style={styles.daysBadge}>
              <Text style={[typography.heading2, { color: colors.primary, fontWeight: '800' }]}>
                {alRemaining}
              </Text>
              <Text style={[typography.caption, { color: colors.textSecondary }]}>remaining</Text>
            </View>
          </View>

          <ProgressBar pct={alPct} color={alPct > 0.85 ? colors.error : colors.success} />

          <View style={styles.statsRow}>
            <StatItem label="Taken" value={`${alDaysTaken}d`} color={colors.textPrimary} typography={typography} />
            <StatItem label="Remaining" value={`${alRemaining}d`} color={colors.success} typography={typography} />
            <StatItem label="Allowance" value={`${settings.annualLeaveAllowance}d`} color={colors.textSecondary} typography={typography} />
          </View>
        </View>

        {/* Bank Holiday progress */}
        <View style={[styles.card, { backgroundColor: colors.surface1, borderRadius: radius.lg }]}>
          <View style={styles.leaveHeader}>
            <Text style={{ fontSize: 24 }}>🏦</Text>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={[typography.body1, { color: colors.textPrimary, fontWeight: '700' }]}>Bank Holidays</Text>
              <Text style={[typography.caption, { color: colors.textSecondary }]}>
                {settings.bankHolidayAllowance} days total
              </Text>
            </View>
            <View style={styles.daysBadge}>
              <Text style={[typography.heading2, { color: colors.warning, fontWeight: '800' }]}>
                {bhRemaining}
              </Text>
              <Text style={[typography.caption, { color: colors.textSecondary }]}>remaining</Text>
            </View>
          </View>

          <ProgressBar pct={bhPct} color={colors.warning} />

          <View style={styles.statsRow}>
            <StatItem label="Taken" value={`${bhDaysTaken}d`} color={colors.textPrimary} typography={typography} />
            <StatItem label="Remaining" value={`${bhRemaining}d`} color={colors.warning} typography={typography} />
            <StatItem label="Allowance" value={`${settings.bankHolidayAllowance}d`} color={colors.textSecondary} typography={typography} />
          </View>
        </View>

        {/* Leave history */}
        {alShifts.length > 0 && (
          <View style={[styles.card, { backgroundColor: colors.surface1, borderRadius: radius.lg }]}>
            <Text style={[typography.body1, { color: colors.textPrimary, fontWeight: '700', marginBottom: spacing[3] }]}>
              Leave History
            </Text>
            {[...alShifts, ...bhShifts]
              .sort((a, b) => new Date(b.start_datetime).getTime() - new Date(a.start_datetime).getTime())
              .map((shift, i) => (
                <View key={i} style={styles.historyRow}>
                  <View style={[styles.historyDot, { backgroundColor: shift.shift_type.colour_hex }]}>
                    <Text style={styles.historyAbbrev}>
                      {shift.shift_type.abbreviation || shift.shift_type.name.slice(0, 2).toUpperCase()}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[typography.body2, { color: colors.textPrimary, fontWeight: '600' }]}>
                      {format(new Date(shift.start_datetime), 'EEE d MMM yyyy')}
                    </Text>
                    <Text style={[typography.caption, { color: colors.textSecondary }]}>
                      {shift.shift_type.name} · {Math.round(shift.duration_minutes / 60 * 10) / 10}h
                    </Text>
                  </View>
                </View>
              ))}
          </View>
        )}

        {alShifts.length === 0 && bhShifts.length === 0 && (
          <View style={[styles.card, { backgroundColor: colors.surface2, borderRadius: radius.lg, alignItems: 'center' }]}>
            <Text style={{ fontSize: 32, marginBottom: 8 }}>🌴</Text>
            <Text style={[typography.body2, { color: colors.textSecondary, textAlign: 'center' }]}>
              No annual leave or bank holiday shifts found for this leave year.
            </Text>
            <Text style={[typography.caption, { color: colors.textDisabled, textAlign: 'center', marginTop: 4 }]}>
              Add shifts with type "Annual Leave" or "Bank Holiday" to track them here.
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function ProgressBar({ pct, color }: { pct: number; color: string }) {
  return (
    <View style={[pbStyles.track]}>
      <View style={[pbStyles.fill, { width: `${Math.round(pct * 100)}%`, backgroundColor: color }]} />
    </View>
  );
}
const pbStyles = StyleSheet.create({
  track: { height: 10, backgroundColor: '#E8EDEE', borderRadius: 5, marginVertical: 12, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 5 },
});

function InputRow({ label, value, onChange, colors, typography, radius }: any) {
  return (
    <View style={{ marginBottom: 12 }}>
      <Text style={[typography.caption, { color: colors.textSecondary, marginBottom: 4 }]}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        keyboardType="number-pad"
        style={{
          borderWidth: 1.5,
          borderColor: colors.border,
          borderRadius: radius.md,
          paddingHorizontal: 12,
          paddingVertical: 10,
          color: colors.textPrimary,
          fontSize: 16,
          fontWeight: '600',
        }}
      />
    </View>
  );
}

function StatItem({ label, value, color, typography }: any) {
  return (
    <View style={{ alignItems: 'center', flex: 1 }}>
      <Text style={[typography.heading3, { color, fontWeight: '700' }]}>{value}</Text>
      <Text style={[typography.caption, { color: '#768692' }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { paddingTop: 16, paddingBottom: 48 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  editBtn: { paddingVertical: 4, paddingHorizontal: 8 },
  card: { padding: 16, marginBottom: 12 },
  leaveHeader: { flexDirection: 'row', alignItems: 'center' },
  daysBadge: { alignItems: 'center' },
  statsRow: { flexDirection: 'row', marginTop: 8 },
  historyRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, gap: 10 },
  historyDot: { width: 36, height: 28, borderRadius: 4, alignItems: 'center', justifyContent: 'center' },
  historyAbbrev: { fontSize: 10, fontWeight: '800', color: '#FFFFFF' },
  yearTypeRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  yearBtn: { flex: 1, paddingVertical: 10, alignItems: 'center' },
  saveBtn: { paddingVertical: 14, alignItems: 'center', marginTop: 8 },
});
