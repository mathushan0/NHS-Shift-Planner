/**
 * AnalyticsScreen — Work pattern analytics (Premium)
 *
 * Features:
 * - Shift type distribution (pie / bar chart)
 * - Hours trend over last 12 weeks
 * - Overtime tracking vs contracted hours
 * - Fatigue risk indicator (WTD 48hr average rule over 17 weeks)
 * - Hours heatmap by day of week
 * - Busiest months
 */

import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  SafeAreaView,
  Dimensions,
  TouchableOpacity,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  format,
  startOfWeek,
  endOfWeek,
  addWeeks,
  subWeeks,
  getDay,
  eachWeekOfInterval,
  subMonths,
  startOfMonth,
  endOfMonth,
} from 'date-fns';
import { useTheme } from '../hooks/useTheme';
import { useShiftStore } from '../stores/shiftStore';
import { useSettingsStore } from '../stores/settingsStore';
import { useSubscriptionStore } from '../stores/subscriptionStore';
import { PremiumLockOverlay, PremiumBadge } from '../components/molecules/PremiumBadge';
import { LoadingSpinner } from '../components/molecules/LoadingSpinner';
import { ShiftWithType } from '../types';
import { minutesToHoursLabel } from '../utils/hoursCalculator';

type Props = NativeStackScreenProps<any, 'Analytics'>;

const SCREEN_WIDTH = Dimensions.get('window').width;
const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function groupByWeek(shifts: ShiftWithType[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const s of shifts) {
    const weekStart = format(startOfWeek(new Date(s.start_datetime), { weekStartsOn: 1 }), 'yyyy-MM-dd');
    map.set(weekStart, (map.get(weekStart) ?? 0) + s.duration_minutes);
  }
  return map;
}

function groupByShiftType(shifts: ShiftWithType[]): Array<{ name: string; colour: string; minutes: number }> {
  const map = new Map<string, { colour: string; minutes: number }>();
  for (const s of shifts) {
    const existing = map.get(s.shift_type.name);
    if (existing) {
      existing.minutes += s.duration_minutes;
    } else {
      map.set(s.shift_type.name, { colour: s.shift_type.colour_hex, minutes: s.duration_minutes });
    }
  }
  return Array.from(map.entries())
    .map(([name, v]) => ({ name, colour: v.colour, minutes: v.minutes }))
    .sort((a, b) => b.minutes - a.minutes);
}

function groupByDayOfWeek(shifts: ShiftWithType[]): number[] {
  // 0=Mon … 6=Sun
  const totals = new Array(7).fill(0);
  for (const s of shifts) {
    const jsDay = getDay(new Date(s.start_datetime)); // 0=Sun
    const idx = jsDay === 0 ? 6 : jsDay - 1; // convert to Mon=0
    totals[idx] += s.duration_minutes;
  }
  return totals;
}

function groupByMonth(shifts: ShiftWithType[]): Array<{ month: string; minutes: number }> {
  const map = new Map<string, number>();
  for (const s of shifts) {
    const key = format(new Date(s.start_datetime), 'MMM yy');
    map.set(key, (map.get(key) ?? 0) + s.duration_minutes);
  }
  return Array.from(map.entries()).map(([month, minutes]) => ({ month, minutes }));
}

function calcWTDAverage(weeklyMinutesMap: Map<string, number>, weeks: string[]): number {
  if (weeks.length === 0) return 0;
  const total = weeks.reduce((sum, w) => sum + (weeklyMinutesMap.get(w) ?? 0), 0);
  return total / weeks.length / 60;
}

// ─── Mini Bar Chart ──────────────────────────────────────────────────────────

function MiniBarChart({
  data,
  labels,
  colors,
  typography,
  maxValue,
  highlightThreshold,
}: {
  data: number[];
  labels: string[];
  colors: any;
  typography: any;
  maxValue?: number;
  highlightThreshold?: number;
}) {
  const max = maxValue ?? Math.max(...data, 1);
  const chartWidth = SCREEN_WIDTH - 64;
  const barWidth = Math.max(8, (chartWidth / data.length) - 6);

  return (
    <View style={miniStyles.container}>
      <View style={miniStyles.chartArea}>
        {data.map((v, i) => {
          const height = Math.max(2, (v / max) * 80);
          const isOver = highlightThreshold ? v > highlightThreshold : false;
          return (
            <View key={i} style={[miniStyles.barCol, { width: barWidth + 6 }]}>
              <View
                style={[
                  miniStyles.bar,
                  { height, width: barWidth, backgroundColor: isOver ? '#DA291C' : colors.primary },
                ]}
              />
              <Text style={[typography.caption, { fontSize: 9, color: colors.textSecondary, marginTop: 3 }]}>
                {labels[i] ?? ''}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const miniStyles = StyleSheet.create({
  container: { marginTop: 8 },
  chartArea: { flexDirection: 'row', alignItems: 'flex-end', height: 100 },
  barCol: { alignItems: 'center', justifyContent: 'flex-end' },
  bar: { borderRadius: 3 },
});

// ─── Screen ──────────────────────────────────────────────────────────────────

export function AnalyticsScreen({ navigation }: Props) {
  const { colors, typography, spacing, radius, elevation } = useTheme();
  const isPremium = useSubscriptionStore(s => s.isPremium);
  const { loadShiftsForDateRange } = useShiftStore();
  const userId = useSettingsStore(s => s.userId) ?? 'local-user-1';
  const contractedHoursPerWeek = useSettingsStore(s => s.contractedHoursPerWeek) ?? 37.5;

  const [shifts, setShifts] = useState<ShiftWithType[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Load 17 weeks of data (for WTD)
  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setIsLoading(true);
    const end = new Date();
    const start = subWeeks(end, 17);
    const loaded = await loadShiftsForDateRange(
      userId,
      format(start, 'yyyy-MM-dd'),
      format(end, 'yyyy-MM-dd')
    );
    setShifts(loaded);
    setIsLoading(false);
  }

  // Compute last 12 weeks
  const last12Weeks = useMemo(() => {
    const weeks: string[] = [];
    for (let i = 11; i >= 0; i--) {
      weeks.push(format(startOfWeek(subWeeks(new Date(), i), { weekStartsOn: 1 }), 'yyyy-MM-dd'));
    }
    return weeks;
  }, []);

  const weeklyMap = useMemo(() => groupByWeek(shifts), [shifts]);
  const shiftTypeBreakdown = useMemo(() => groupByShiftType(shifts), [shifts]);
  const dayOfWeekMinutes = useMemo(() => groupByDayOfWeek(shifts), [shifts]);
  const monthlyBreakdown = useMemo(() => groupByMonth(shifts), [shifts]);

  const weeklyHours = last12Weeks.map(w => (weeklyMap.get(w) ?? 0) / 60);
  const weeklyLabels = last12Weeks.map(w => format(new Date(w), 'd/M'));

  const wtdAvg = useMemo(() => {
    const all17Weeks: string[] = [];
    for (let i = 16; i >= 0; i--) {
      all17Weeks.push(format(startOfWeek(subWeeks(new Date(), i), { weekStartsOn: 1 }), 'yyyy-MM-dd'));
    }
    return calcWTDAverage(weeklyMap, all17Weeks);
  }, [weeklyMap]);

  const totalMinutesLast12 = last12Weeks.reduce((a, w) => a + (weeklyMap.get(w) ?? 0), 0);
  const avgHoursPerWeek = totalMinutesLast12 / 12 / 60;
  const contractedMinutesPerWeek = contractedHoursPerWeek * 60;
  const overtimeMinutes = last12Weeks.reduce((sum, w) => {
    const worked = weeklyMap.get(w) ?? 0;
    return sum + Math.max(0, worked - contractedMinutesPerWeek);
  }, 0);

  const fatigueFlagged = wtdAvg > 48;
  const fatigueWarning = wtdAvg > 44;

  const maxDayMinutes = Math.max(...dayOfWeekMinutes, 1);
  const maxWeekHours = Math.max(...weeklyHours, 1);

  if (isLoading) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: colors.screenBackground }]}>
        <LoadingSpinner label="Loading analytics..." style={{ marginTop: 80 }} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.screenBackground }]}>
      {!isPremium && <PremiumLockOverlay message="Analytics is a Premium Feature" />}
      <ScrollView contentContainerStyle={[styles.content, { paddingHorizontal: spacing[4] }]}>
        {/* Header */}
        <View style={styles.headerRow}>
          <Text style={[typography.heading2, { color: colors.textPrimary }]}>Analytics</Text>
          <PremiumBadge size="sm" />
        </View>
        <Text style={[typography.body2, { color: colors.textSecondary, marginBottom: spacing[4] }]}>
          Last 12 weeks · {shifts.length} shifts
        </Text>

        {/* Summary cards */}
        <View style={styles.summaryRow}>
          <StatCard label="Avg hrs/week" value={avgHoursPerWeek.toFixed(1)} colors={colors} typography={typography} radius={radius} />
          <StatCard label="Overtime" value={minutesToHoursLabel(overtimeMinutes)} colors={colors} typography={typography} radius={radius} highlight={overtimeMinutes > 0} />
          <StatCard label="WTD Average" value={`${wtdAvg.toFixed(1)}h`} colors={colors} typography={typography} radius={radius} highlight={fatigueFlagged} warning={fatigueWarning && !fatigueFlagged} />
        </View>

        {/* Fatigue risk indicator */}
        {(fatigueFlagged || fatigueWarning) && (
          <View style={[styles.alertCard, { backgroundColor: fatigueFlagged ? colors.error + '22' : colors.warning + '22', borderColor: fatigueFlagged ? colors.error : colors.warning, borderRadius: radius.lg }]}>
            <Text style={{ fontSize: 24 }}>{fatigueFlagged ? '🚨' : '⚠️'}</Text>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={[typography.body1, { color: fatigueFlagged ? colors.error : colors.warning, fontWeight: '700' }]}>
                {fatigueFlagged ? 'WTD Limit Exceeded' : 'Approaching WTD Limit'}
              </Text>
              <Text style={[typography.caption, { color: colors.textSecondary, marginTop: 2 }]}>
                {fatigueFlagged
                  ? `Your 17-week average is ${wtdAvg.toFixed(1)}h/week — above the 48h Working Time Directive limit. Speak to your manager.`
                  : `Your 17-week average is ${wtdAvg.toFixed(1)}h/week — approaching the 48h WTD limit.`}
              </Text>
            </View>
          </View>
        )}

        {/* Hours trend */}
        <View style={[styles.card, { backgroundColor: colors.surface1, borderRadius: radius.lg }]}>
          <Text style={[typography.body1, { color: colors.textPrimary, fontWeight: '700', marginBottom: 4 }]}>
            Hours Trend (12 weeks)
          </Text>
          <Text style={[typography.caption, { color: colors.textSecondary, marginBottom: 4 }]}>
            Red bars exceed contracted {contractedHoursPerWeek}h/week
          </Text>
          <MiniBarChart
            data={weeklyHours}
            labels={weeklyLabels}
            colors={colors}
            typography={typography}
            maxValue={Math.max(maxWeekHours, contractedHoursPerWeek + 10)}
            highlightThreshold={contractedHoursPerWeek}
          />
          {/* Contracted hours line label */}
          <Text style={[typography.caption, { color: colors.primary, marginTop: 4 }]}>
            — Contracted: {contractedHoursPerWeek}h/week
          </Text>
        </View>

        {/* Shift type distribution */}
        <View style={[styles.card, { backgroundColor: colors.surface1, borderRadius: radius.lg }]}>
          <Text style={[typography.body1, { color: colors.textPrimary, fontWeight: '700', marginBottom: spacing[3] }]}>
            Shift Type Distribution
          </Text>
          {shiftTypeBreakdown.length === 0 ? (
            <Text style={[typography.body2, { color: colors.textSecondary }]}>No shift data</Text>
          ) : (
            shiftTypeBreakdown.map((item, i) => {
              const totalMins = shiftTypeBreakdown.reduce((a, b) => a + b.minutes, 0);
              const pct = totalMins > 0 ? Math.round((item.minutes / totalMins) * 100) : 0;
              return (
                <View key={i} style={styles.distRow}>
                  <View style={[styles.distColor, { backgroundColor: item.colour }]}>
                    <Text style={styles.distAbbrev}>{item.name.slice(0, 2).toUpperCase()}</Text>
                  </View>
                  <Text style={[typography.body2, { flex: 1, color: colors.textPrimary }]}>{item.name}</Text>
                  <View style={[styles.distBarBg, { backgroundColor: colors.surface2, flex: 2, marginHorizontal: 8 }]}>
                    <View style={[styles.distBarFill, { width: `${pct}%`, backgroundColor: item.colour }]} />
                  </View>
                  <Text style={[typography.caption, { color: colors.textSecondary, width: 36, textAlign: 'right' }]}>{pct}%</Text>
                </View>
              );
            })
          )}
        </View>

        {/* Day of week heatmap */}
        <View style={[styles.card, { backgroundColor: colors.surface1, borderRadius: radius.lg }]}>
          <Text style={[typography.body1, { color: colors.textPrimary, fontWeight: '700', marginBottom: 4 }]}>
            Hours by Day of Week
          </Text>
          <MiniBarChart
            data={dayOfWeekMinutes.map(m => m / 60)}
            labels={DAY_NAMES}
            colors={colors}
            typography={typography}
          />
        </View>

        {/* Busiest months */}
        {monthlyBreakdown.length > 0 && (
          <View style={[styles.card, { backgroundColor: colors.surface1, borderRadius: radius.lg }]}>
            <Text style={[typography.body1, { color: colors.textPrimary, fontWeight: '700', marginBottom: spacing[3] }]}>
              Busiest Months
            </Text>
            {[...monthlyBreakdown].sort((a, b) => b.minutes - a.minutes).slice(0, 5).map((m, i) => (
              <View key={i} style={styles.compRow}>
                <Text style={[typography.body2, { color: colors.textPrimary, flex: 1 }]}>{m.month}</Text>
                <Text style={[typography.body2, { color: colors.primary, fontWeight: '600' }]}>
                  {minutesToHoursLabel(m.minutes)}
                </Text>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function StatCard({ label, value, colors, typography, radius, highlight, warning }: any) {
  return (
    <View style={[{
      flex: 1,
      backgroundColor: highlight ? colors.error + '15' : warning ? colors.warning + '15' : colors.surface1,
      borderRadius: radius.lg,
      padding: 12,
      alignItems: 'center',
      marginHorizontal: 4,
    }]}>
      <Text style={[typography.heading3, { color: highlight ? colors.error : warning ? colors.warning : colors.primary, fontWeight: '800' }]}>
        {value}
      </Text>
      <Text style={[typography.caption, { color: colors.textSecondary, textAlign: 'center', marginTop: 2 }]}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { paddingTop: 16, paddingBottom: 48 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  summaryRow: { flexDirection: 'row', marginBottom: 12, marginHorizontal: -4 },
  card: { padding: 16, marginBottom: 12 },
  alertCard: { flexDirection: 'row', alignItems: 'flex-start', padding: 14, marginBottom: 12, borderWidth: 1.5 },
  distRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6 },
  distColor: { width: 28, height: 20, borderRadius: 3, alignItems: 'center', justifyContent: 'center', marginRight: 8 },
  distAbbrev: { fontSize: 9, fontWeight: '800', color: '#FFFFFF' },
  distBarBg: { height: 8, borderRadius: 4, overflow: 'hidden' },
  distBarFill: { height: '100%', borderRadius: 4 },
  compRow: { flexDirection: 'row', paddingVertical: 4 },
});
