/**
 * OvertimeScreen — Overtime Monitor (Premium)
 *
 * Shows:
 * - Contracted hours setting
 * - Overtime worked this week/month/pay period
 * - WTD 48hr limit alert
 * - Overtime trend chart (12 weeks)
 */

import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  TextInput,
  Alert,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  format,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  subWeeks,
  getISOWeek,
} from 'date-fns';
import { useTheme } from '../hooks/useTheme';
import { useShiftStore } from '../stores/shiftStore';
import { useSettingsStore } from '../stores/settingsStore';
import { useSubscriptionStore } from '../stores/subscriptionStore';
import { PremiumLockOverlay, PremiumBadge } from '../components/molecules/PremiumBadge';
import { LoadingSpinner } from '../components/molecules/LoadingSpinner';
import { ShiftWithType } from '../types';
import { minutesToHoursLabel } from '../utils/hoursCalculator';

type Props = NativeStackScreenProps<any, 'Overtime'>;

const SCREEN_WIDTH = 360; // approximate

function MiniBarChart({
  data,
  labels,
  colors,
  typography,
  highlightThreshold,
}: {
  data: number[];
  labels: string[];
  colors: any;
  typography: any;
  highlightThreshold?: number;
}) {
  const max = Math.max(...data, 0.1);
  const barWidth = Math.max(16, (SCREEN_WIDTH - 64) / data.length - 4);
  return (
    <View style={{ marginTop: 8 }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: 80 }}>
        {data.map((v, i) => {
          const height = Math.max(2, (v / max) * 72);
          const isOver = highlightThreshold !== undefined && v > highlightThreshold;
          return (
            <View key={i} style={{ alignItems: 'center', width: barWidth + 4 }}>
              <View
                style={{
                  height,
                  width: barWidth,
                  backgroundColor: isOver ? '#DA291C' : colors.primary,
                  borderRadius: 3,
                }}
              />
              <Text style={[typography.caption, { fontSize: 8, color: colors.textSecondary, marginTop: 2 }]}>
                {labels[i] ?? ''}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

export function OvertimeScreen({ navigation }: Props) {
  const { colors, typography, spacing, radius } = useTheme();
  const isPremium = useSubscriptionStore(s => s.isPremium);
  const { loadShiftsForDateRange } = useShiftStore();
  const userId = useSettingsStore(s => s.userId) ?? 'local-user-1';
  const contractedFromStore = useSettingsStore(s => s.contractedHoursPerWeek) ?? 37.5;
  const setContractedHours = useSettingsStore(s => s.setContractedHours);

  const [contractedInput, setContractedInput] = useState(String(contractedFromStore));
  const [contractedHours, setContractedHoursLocal] = useState(contractedFromStore);
  const [shifts12Weeks, setShifts12Weeks] = useState<ShiftWithType[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setIsLoading(true);
    const end = new Date();
    const start = subWeeks(end, 12);
    const loaded = await loadShiftsForDateRange(
      userId,
      format(start, 'yyyy-MM-dd'),
      format(end, 'yyyy-MM-dd')
    );
    setShifts12Weeks(loaded);
    setIsLoading(false);
  }

  async function saveContracted() {
    const h = parseFloat(contractedInput);
    if (isNaN(h) || h <= 0 || h > 168) {
      Alert.alert('Invalid hours', 'Enter a valid number between 1 and 168');
      return;
    }
    setContractedHoursLocal(h);
    await setContractedHours(h);
    setIsEditing(false);
  }

  // Build 12-week buckets
  const weekBuckets = useMemo(() => {
    const buckets: Array<{ label: string; workedMins: number; overtimeMins: number }> = [];
    const contractedMins = contractedHours * 60;
    for (let i = 11; i >= 0; i--) {
      const weekStart = startOfWeek(subWeeks(new Date(), i), { weekStartsOn: 1 });
      const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 });
      const weekShifts = shifts12Weeks.filter(s => {
        const d = new Date(s.start_datetime);
        return d >= weekStart && d <= weekEnd;
      });
      const workedMins = weekShifts.reduce((a, s) => a + (s.shift_type.is_paid ? s.duration_minutes : 0), 0);
      buckets.push({
        label: format(weekStart, 'd/M'),
        workedMins,
        overtimeMins: Math.max(0, workedMins - contractedMins),
      });
    }
    return buckets;
  }, [shifts12Weeks, contractedHours]);

  // This week
  const thisWeekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
  const thisWeekEnd = endOfWeek(new Date(), { weekStartsOn: 1 });
  const thisWeekShifts = shifts12Weeks.filter(s => {
    const d = new Date(s.start_datetime);
    return d >= thisWeekStart && d <= thisWeekEnd;
  });
  const thisWeekMins = thisWeekShifts.reduce((a, s) => a + (s.shift_type.is_paid ? s.duration_minutes : 0), 0);
  const thisWeekOvertimeMins = Math.max(0, thisWeekMins - contractedHours * 60);

  // This month
  const monthStart = startOfMonth(new Date());
  const monthEnd = endOfMonth(new Date());
  const monthShifts = shifts12Weeks.filter(s => {
    const d = new Date(s.start_datetime);
    return d >= monthStart && d <= monthEnd;
  });
  const monthWorkedMins = monthShifts.reduce((a, s) => a + (s.shift_type.is_paid ? s.duration_minutes : 0), 0);
  const monthContractedMins = contractedHours * 60 * 4.33;
  const monthOvertimeMins = Math.max(0, monthWorkedMins - monthContractedMins);

  // 12-week totals
  const total12WeekMins = weekBuckets.reduce((a, b) => a + b.workedMins, 0);
  const total12WeekOvertimeMins = weekBuckets.reduce((a, b) => a + b.overtimeMins, 0);
  const avg12WeekHours = total12WeekMins / 12 / 60;

  // WTD check (17-week window in Analytics; here we use 12 weeks for display)
  const wtdAlert = avg12WeekHours > 48;
  const wtdWarning = avg12WeekHours > 44;

  const overtimeHoursArr = weekBuckets.map(b => b.overtimeMins / 60);
  const workedHoursArr = weekBuckets.map(b => b.workedMins / 60);
  const labels = weekBuckets.map(b => b.label);

  if (isLoading) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: colors.screenBackground }]}>
        <LoadingSpinner label="Loading overtime data..." style={{ marginTop: 80 }} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.screenBackground }]}>
      {!isPremium && <PremiumLockOverlay message="Overtime Monitor is a Premium Feature" />}
      <ScrollView contentContainerStyle={[styles.content, { paddingHorizontal: spacing[4] }]}>
        {/* Header */}
        <View style={styles.headerRow}>
          <Text style={[typography.heading2, { color: colors.textPrimary }]}>Overtime</Text>
          <View style={styles.headerActions}>
            <PremiumBadge size="sm" />
            <TouchableOpacity onPress={() => setIsEditing(!isEditing)}>
              <Text style={[typography.body2, { color: colors.primary, fontWeight: '600', paddingHorizontal: 8, paddingVertical: 4 }]}>
                {isEditing ? 'Cancel' : '⚙️ Hours'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Contracted hours edit */}
        {isEditing && (
          <View style={[styles.card, { backgroundColor: colors.surface1, borderRadius: radius.lg }]}>
            <Text style={[typography.body1, { color: colors.textPrimary, fontWeight: '700', marginBottom: spacing[2] }]}>
              Contracted Hours / Week
            </Text>
            <View style={[styles.inputRow, { borderColor: colors.border, borderRadius: radius.md }]}>
              <TextInput
                value={contractedInput}
                onChangeText={setContractedInput}
                keyboardType="decimal-pad"
                style={[typography.heading3, { flex: 1, color: colors.textPrimary, paddingHorizontal: 12, paddingVertical: 12 }]}
                placeholder="37.5"
                placeholderTextColor={colors.textDisabled}
              />
              <Text style={[typography.body2, { color: colors.textSecondary, marginRight: 12 }]}>hrs/week</Text>
            </View>
            <TouchableOpacity
              onPress={saveContracted}
              style={[styles.saveBtn, { backgroundColor: colors.primary, borderRadius: radius.md }]}
            >
              <Text style={[typography.body1, { color: '#FFFFFF', fontWeight: '700' }]}>Save</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* WTD Alert */}
        {(wtdAlert || wtdWarning) && (
          <View style={[styles.alertCard, {
            backgroundColor: wtdAlert ? colors.error + '15' : colors.warning + '15',
            borderColor: wtdAlert ? colors.error : colors.warning,
            borderRadius: radius.lg,
          }]}>
            <Text style={{ fontSize: 24 }}>{wtdAlert ? '🚨' : '⚠️'}</Text>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={[typography.body1, { color: wtdAlert ? colors.error : colors.warning, fontWeight: '700' }]}>
                {wtdAlert ? 'WTD Limit Exceeded' : 'WTD Warning'}
              </Text>
              <Text style={[typography.caption, { color: colors.textSecondary, marginTop: 2 }]}>
                12-week average: {avg12WeekHours.toFixed(1)}h/week
                {wtdAlert ? ' — exceeds 48h WTD limit' : ' — approaching 48h limit'}
              </Text>
            </View>
          </View>
        )}

        {/* Summary cards */}
        <View style={styles.summaryRow}>
          <SummaryCard label="This Week" worked={minutesToHoursLabel(thisWeekMins)} overtime={minutesToHoursLabel(thisWeekOvertimeMins)} hasOvertime={thisWeekOvertimeMins > 0} colors={colors} typography={typography} radius={radius} />
          <SummaryCard label="This Month" worked={minutesToHoursLabel(monthWorkedMins)} overtime={minutesToHoursLabel(monthOvertimeMins)} hasOvertime={monthOvertimeMins > 0} colors={colors} typography={typography} radius={radius} />
        </View>

        {/* 12-week overtime bar chart */}
        <View style={[styles.card, { backgroundColor: colors.surface1, borderRadius: radius.lg }]}>
          <Text style={[typography.body1, { color: colors.textPrimary, fontWeight: '700', marginBottom: 4 }]}>
            Overtime — Last 12 Weeks
          </Text>
          <Text style={[typography.caption, { color: colors.textSecondary }]}>
            Total: {minutesToHoursLabel(total12WeekOvertimeMins)} overtime · Contracted: {contractedHours}h/week
          </Text>
          <MiniBarChart
            data={overtimeHoursArr}
            labels={labels}
            colors={colors}
            typography={typography}
            highlightThreshold={0.1}
          />
        </View>

        {/* Hours worked chart */}
        <View style={[styles.card, { backgroundColor: colors.surface1, borderRadius: radius.lg }]}>
          <Text style={[typography.body1, { color: colors.textPrimary, fontWeight: '700', marginBottom: 4 }]}>
            Hours Worked — Last 12 Weeks
          </Text>
          <Text style={[typography.caption, { color: colors.textSecondary }]}>
            Red = over contracted hours. Avg: {avg12WeekHours.toFixed(1)}h/week
          </Text>
          <MiniBarChart
            data={workedHoursArr}
            labels={labels}
            colors={colors}
            typography={typography}
            highlightThreshold={contractedHours}
          />
          <Text style={[typography.caption, { color: colors.primary, marginTop: 4 }]}>
            — Contracted: {contractedHours}h/week
          </Text>
        </View>

        {/* WTD info */}
        <View style={[styles.infoCard, { backgroundColor: colors.surface2, borderRadius: radius.md }]}>
          <Text style={[typography.caption, { color: colors.textSecondary, lineHeight: 18 }]}>
            ℹ️ Under the Working Time Directive, your average weekly hours over a 17-week reference period should not exceed 48 hours. This includes overtime but excludes voluntary opt-outs. Use the Analytics screen for a full 17-week WTD calculation.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function SummaryCard({ label, worked, overtime, hasOvertime, colors, typography, radius }: any) {
  return (
    <View style={[{
      flex: 1,
      backgroundColor: colors.surface1,
      borderRadius: radius.lg,
      padding: 14,
      marginHorizontal: 4,
    }]}>
      <Text style={[typography.caption, { color: colors.textSecondary, marginBottom: 4 }]}>{label}</Text>
      <Text style={[typography.body2, { color: colors.textPrimary }]}>Worked: <Text style={{ fontWeight: '700' }}>{worked}</Text></Text>
      <Text style={[typography.body2, { color: hasOvertime ? colors.error : colors.success, marginTop: 2 }]}>
        OT: <Text style={{ fontWeight: '700' }}>{overtime}</Text>
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { paddingTop: 16, paddingBottom: 48 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  card: { padding: 16, marginBottom: 12 },
  alertCard: { flexDirection: 'row', alignItems: 'flex-start', padding: 14, marginBottom: 12, borderWidth: 1.5 },
  summaryRow: { flexDirection: 'row', marginHorizontal: -4, marginBottom: 12 },
  inputRow: { flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, marginBottom: 12 },
  saveBtn: { paddingVertical: 14, alignItems: 'center' },
  infoCard: { padding: 12 },
});
