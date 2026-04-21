import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { format, parseISO } from 'date-fns';
import { useTheme } from '../hooks/useTheme';
import { useShiftStore } from '../stores/shiftStore';
import { useSettingsStore } from '../stores/settingsStore';
import { useUIStore } from '../stores/uiStore';
import { BarChart } from '../components/molecules/BarChart';
import { SegmentedControl } from '../components/atoms/SegmentedControl';
import { FAB } from '../components/molecules/FAB';
import { LoadingSpinner } from '../components/molecules/LoadingSpinner';
import { HoursStackParamList, ShiftWithType } from '../types';
import {
  getCurrentPayPeriod,
  getWeekRange,
  getMonthRange,
  toDateString,
  getDayLabels,
  getWeekLabels,
} from '../utils/dateUtils';
import {
  calculateHoursSummary,
  getDailyHoursData,
  getWeeklyHoursData,
  getHoursStatusColor,
  minutesToHoursLabel,
  getProgressBarWidth,
} from '../utils/hoursCalculator';
import { exportHoursAsPDF } from '../utils/pdfExport';

type Props = NativeStackScreenProps<HoursStackParamList & { ShiftHistory: undefined }, 'HoursSummary'>;


const PERIOD_OPTIONS = [
  { label: 'Week', value: 'week' },
  { label: 'Pay Period', value: 'pay' },
  { label: 'Month', value: 'month' },
];

export function HoursSummaryScreen({ navigation }: Props) {
  const { colors, typography, spacing, radius, elevation } = useTheme();
  const { loadShiftsForDateRange } = useShiftStore();
  const settings = useSettingsStore(s => s.settings);
  const displayName = useSettingsStore(s => s.displayName);
  const contractedHoursPerWeek = useSettingsStore(s => s.contractedHoursPerWeek);
  const userId = useSettingsStore(s => s.userId) ?? 'local-user-1';
  const { showSnackbar } = useUIStore();

  const [period, setPeriod] = useState('pay');
  const [shifts, setShifts] = useState<ShiftWithType[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);

  const dateRange = useMemo(() => {
    if (period === 'week') return getWeekRange();
    if (period === 'month') return getMonthRange();
    // Pay period
    return getCurrentPayPeriod(
      settings?.pay_period_type ?? 'monthly_calendar',
      settings?.pay_period_start_day ?? 1
    );
  }, [period, settings]);

  const periodLabel = useMemo(() => {
    const start = format(dateRange.start, 'd MMM');
    const end = format(dateRange.end, 'd MMM yyyy');
    return `${start} – ${end}`;
  }, [dateRange]);

  useEffect(() => {
    loadPeriodShifts();
  }, [dateRange]);

  async function loadPeriodShifts() {
    setIsLoading(true);
    const loaded = await loadShiftsForDateRange(
      userId,
      toDateString(dateRange.start),
      toDateString(dateRange.end)
    );
    setShifts(loaded);
    setIsLoading(false);
  }

  const summary = useMemo(
    () =>
      calculateHoursSummary(
        shifts,
        contractedHoursPerWeek ?? null,
        dateRange.start,
        dateRange.end
      ),
    [shifts, contractedHoursPerWeek, dateRange]
  );

  // Bar chart
  const { chartData, chartLabels } = useMemo(() => {
    if (period === 'week') {
      return {
        chartData: getDailyHoursData(shifts, dateRange.start, dateRange.end),
        chartLabels: getDayLabels(dateRange.start, 7),
      };
    }
    const weekCount = period === 'month' ? 5 : 4;
    return {
      chartData: getWeeklyHoursData(shifts, dateRange.start, weekCount),
      chartLabels: getWeekLabels(dateRange.start, weekCount),
    };
  }, [shifts, period, dateRange]);

  const statusColor = getHoursStatusColor(
    summary.total_minutes,
    summary.contracted_minutes,
    colors
  );
  const progressWidth = getProgressBarWidth(summary.total_minutes, summary.contracted_minutes);

  async function handleExport() {
    setIsExporting(true);
    try {
      await exportHoursAsPDF(summary, periodLabel, displayName);
    } catch {
      showSnackbar({ message: 'Export failed', variant: 'error' });
    } finally {
      setIsExporting(false);
    }
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.screenBackground }]}>
      {/* Header */}
      <View style={[styles.header, { paddingHorizontal: spacing[4], backgroundColor: colors.surface1 }]}>
        <View>
          <Text style={[typography.heading2, { color: colors.textPrimary }]}>Hours</Text>
          <Text style={[typography.body2, { color: colors.textSecondary }]}>{periodLabel}</Text>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity
            onPress={() => navigation.navigate('ShiftHistory' as any)}
            style={[styles.headerBtn, { borderColor: colors.border, borderRadius: radius.md }]}
          >
            <Text style={[typography.body2, { color: colors.primary, fontWeight: '600' }]}>History</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={handleExport}
            disabled={isExporting}
            style={[styles.headerBtn, { borderColor: colors.border, borderRadius: radius.md, marginLeft: 8 }]}
          >
            <Text style={[typography.body2, { color: colors.primary, fontWeight: '600' }]}>
              {isExporting ? '...' : '⬇ PDF'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={styles.flex}
        contentContainerStyle={{ paddingBottom: 100 }}
        refreshControl={
          <RefreshControl refreshing={isLoading} onRefresh={loadPeriodShifts} tintColor={colors.primary} />
        }
      >
        {/* Period toggle */}
        <View style={[styles.toggleWrapper, { paddingHorizontal: spacing[4], marginTop: spacing[3] }]}>
          <SegmentedControl
            segments={PERIOD_OPTIONS}
            selectedValue={period}
            onSelect={setPeriod}
          />
        </View>

        {isLoading ? (
          <LoadingSpinner style={{ marginTop: 40 }} label="Calculating hours..." />
        ) : (
          <>
            {/* Summary hero */}
            <View
              style={[
                styles.heroCard,
                elevation[1],
                {
                  backgroundColor: colors.surface1,
                  borderRadius: radius.xl,
                  marginHorizontal: spacing[4],
                  marginTop: spacing[4],
                  padding: spacing[5],
                },
              ]}
            >
              <View style={styles.heroRow}>
                <View style={styles.heroStat}>
                  <Text style={[typography.caption, { color: colors.textSecondary, marginBottom: 4 }]}>
                    WORKED
                  </Text>
                  <Text style={[typography.heading1, { color: statusColor, fontSize: 32 }]}>
                    {minutesToHoursLabel(summary.total_minutes)}
                  </Text>
                </View>
                {summary.contracted_minutes ? (
                  <View style={[styles.heroStat, { alignItems: 'flex-end' }]}>
                    <Text style={[typography.caption, { color: colors.textSecondary, marginBottom: 4 }]}>
                      CONTRACTED
                    </Text>
                    <Text style={[typography.heading2, { color: colors.textPrimary }]}>
                      {minutesToHoursLabel(summary.contracted_minutes)}
                    </Text>
                  </View>
                ) : null}
              </View>

              {/* Progress bar */}
              {summary.contracted_minutes ? (
                <View style={[styles.progressTrack, { backgroundColor: colors.surface3, marginTop: spacing[4] }]}>
                  <View
                    style={[
                      styles.progressFill,
                      { width: `${progressWidth * 100}%`, backgroundColor: statusColor },
                    ]}
                  />
                </View>
              ) : null}

              {/* Bank hours */}
              {summary.bank_minutes > 0 ? (
                <Text style={[typography.body2, { color: colors.textSecondary, marginTop: spacing[2] }]}>
                  Bank: {minutesToHoursLabel(summary.bank_minutes)}
                </Text>
              ) : null}
            </View>

            {/* Bar chart */}
            <View
              style={[
                styles.chartCard,
                elevation[1],
                {
                  backgroundColor: colors.surface1,
                  borderRadius: radius.xl,
                  marginHorizontal: spacing[4],
                  marginTop: spacing[3],
                  padding: spacing[4],
                },
              ]}
            >
              <Text style={[typography.heading3, { color: colors.textPrimary, marginBottom: spacing[3] }]}>
                Hours by {period === 'week' ? 'Day' : 'Week'}
              </Text>
              <BarChart
                data={chartData}
                labels={chartLabels}
                contractedHours={
                  summary.contracted_minutes && chartData.length > 0
                    ? summary.contracted_minutes / 60 / chartData.length
                    : undefined
                }
              />
            </View>

            {/* Breakdown */}
            {summary.breakdown.length > 0 ? (
              <View
                style={[
                  styles.breakdownCard,
                  elevation[1],
                  {
                    backgroundColor: colors.surface1,
                    borderRadius: radius.xl,
                    marginHorizontal: spacing[4],
                    marginTop: spacing[3],
                    padding: spacing[4],
                  },
                ]}
              >
                <Text style={[typography.heading3, { color: colors.textPrimary, marginBottom: spacing[3] }]}>
                  Breakdown
                </Text>
                {summary.breakdown.map((b, i) => (
                  <View key={i} style={[styles.breakdownRow, { borderBottomColor: colors.border }]}>
                    <View
                      style={[styles.breakdownDot, { backgroundColor: b.colour_hex }]}
                    />
                    <Text style={[typography.body1, { color: colors.textPrimary, flex: 1 }]}>
                      {b.type_name}
                    </Text>
                    <Text style={[typography.body2, { color: colors.textSecondary, fontWeight: '600' }]}>
                      {minutesToHoursLabel(b.minutes)}
                    </Text>
                  </View>
                ))}
              </View>
            ) : null}

            {/* Shift count */}
            <Text
              style={[
                typography.caption,
                { color: colors.textDisabled, textAlign: 'center', marginTop: spacing[4] },
              ]}
            >
              {summary.shifts.length} shift{summary.shifts.length !== 1 ? 's' : ''} in period
            </Text>
          </>
        )}
      </ScrollView>

      {/* FAB */}
      <View style={styles.fab}>
        <FAB onPress={() => navigation.navigate('AddEditShift' as any)} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    minHeight: 44,
    justifyContent: 'center',
  },
  toggleWrapper: {},
  heroCard: {},
  heroRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  heroStat: {},
  progressTrack: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  chartCard: {},
  breakdownCard: {},
  breakdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 10,
  },
  breakdownDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 20,
  },
});
