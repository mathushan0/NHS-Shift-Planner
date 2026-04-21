import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  ListRenderItem,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { format, parseISO, subMonths, startOfMonth, endOfMonth } from 'date-fns';
import { useTheme } from '../hooks/useTheme';
import { useShiftStore } from '../stores/shiftStore';
import { useSettingsStore } from '../stores/settingsStore';
import { useUIStore } from '../stores/uiStore';
import { ShiftCard } from '../components/molecules/ShiftCard';
import { SegmentedControl } from '../components/atoms/SegmentedControl';
import { EmptyState } from '../components/molecules/EmptyState';
import { LoadingSpinner } from '../components/molecules/LoadingSpinner';
import { ShiftWithType, ShiftStatus } from '../types';
import { toDateString, formatDate } from '../utils/dateUtils';
import { calculateHoursSummary, minutesToHoursLabel } from '../utils/hoursCalculator';
import { exportHoursAsPDF, exportShiftsAsCSV } from '../utils/pdfExport';

type Props = NativeStackScreenProps<any, 'ShiftHistory'>;

const STATUS_FILTERS: Array<{ label: string; value: ShiftStatus | 'all' }> = [
  { label: 'All', value: 'all' },
  { label: 'Completed', value: 'completed' },
  { label: 'Sick', value: 'sick' },
  { label: 'Leave', value: 'annual_leave' },
];

const MONTH_OPTIONS = Array.from({ length: 6 }, (_, i) => {
  const d = subMonths(new Date(), i);
  return {
    label: format(d, 'MMM yy'),
    value: format(d, 'yyyy-MM'),
    date: d,
  };
});

export function ShiftHistoryScreen({ navigation }: Props) {
  const { colors, typography, spacing, radius, elevation } = useTheme();
  const { loadShiftsForDateRange } = useShiftStore();
  const displayName = useSettingsStore(s => s.displayName);
  const contractedHoursPerWeek = useSettingsStore(s => s.contractedHoursPerWeek);
  const userId = useSettingsStore(s => s.userId) ?? 'local-user-1';
  const { showSnackbar } = useUIStore();

  const [selectedMonth, setSelectedMonth] = useState(MONTH_OPTIONS[0].value);
  const [statusFilter, setStatusFilter] = useState<ShiftStatus | 'all'>('all');
  const [shifts, setShifts] = useState<ShiftWithType[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);

  const selectedMonthDate = useMemo(
    () => MONTH_OPTIONS.find(m => m.value === selectedMonth)?.date ?? new Date(),
    [selectedMonth]
  );

  useEffect(() => {
    loadHistory();
  }, [selectedMonth]);

  async function loadHistory() {
    setIsLoading(true);
    const start = startOfMonth(selectedMonthDate);
    const end = endOfMonth(selectedMonthDate);
    const loaded = await loadShiftsForDateRange(
      userId,
      toDateString(start),
      toDateString(end)
    );
    setShifts(loaded);
    setIsLoading(false);
  }

  const filteredShifts = useMemo(() => {
    if (statusFilter === 'all') return shifts;
    return shifts.filter(s => s.status === statusFilter);
  }, [shifts, statusFilter]);

  const summary = useMemo(() => {
    const start = startOfMonth(selectedMonthDate);
    const end = endOfMonth(selectedMonthDate);
    return calculateHoursSummary(filteredShifts, contractedHoursPerWeek, start, end);
  }, [filteredShifts, contractedHoursPerWeek, selectedMonthDate]);

  const periodLabel = format(selectedMonthDate, 'MMMM yyyy');

  async function handleExportPDF() {
    setIsExporting(true);
    try {
      await exportHoursAsPDF(summary, periodLabel, displayName);
    } catch {
      showSnackbar({ message: 'Export failed', variant: 'error' });
    } finally {
      setIsExporting(false);
    }
  }

  async function handleExportCSV() {
    setIsExporting(true);
    try {
      await exportShiftsAsCSV(filteredShifts, periodLabel);
    } catch {
      showSnackbar({ message: 'CSV export failed', variant: 'error' });
    } finally {
      setIsExporting(false);
    }
  }

  const renderShift: ListRenderItem<ShiftWithType> = useCallback(
    ({ item }) => (
      <ShiftCard
        shift={item}
        onPress={() => navigation.navigate('ShiftDetail', { shiftId: item.id })}
      />
    ),
    [navigation]
  );

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.screenBackground }]}>
      {/* Month selector */}
      <View style={[styles.monthRow, { paddingHorizontal: spacing[4], marginBottom: spacing[3] }]}>
        {MONTH_OPTIONS.slice(0, 4).map(m => (
          <TouchableOpacity
            key={m.value}
            onPress={() => setSelectedMonth(m.value)}
            style={[
              styles.monthChip,
              {
                backgroundColor:
                  m.value === selectedMonth ? colors.primary : colors.surface1,
                borderColor: m.value === selectedMonth ? colors.primary : colors.border,
                borderRadius: radius.md,
              },
            ]}
          >
            <Text
              style={[
                typography.caption,
                {
                  color: m.value === selectedMonth ? '#FFFFFF' : colors.textPrimary,
                  fontWeight: '600',
                },
              ]}
            >
              {m.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Status filter */}
      <View style={{ paddingHorizontal: spacing[4], marginBottom: spacing[3] }}>
        <SegmentedControl
          segments={STATUS_FILTERS}
          selectedValue={statusFilter}
          onSelect={v => setStatusFilter(v as ShiftStatus | 'all')}
        />
      </View>

      {/* Summary strip */}
      <View
        style={[
          styles.summaryStrip,
          elevation[1],
          {
            backgroundColor: colors.surface1,
            marginHorizontal: spacing[4],
            borderRadius: radius.lg,
            marginBottom: spacing[3],
            padding: spacing[3],
          },
        ]}
      >
        <View style={styles.statItem}>
          <Text style={[typography.caption, { color: colors.textSecondary }]}>SHIFTS</Text>
          <Text style={[typography.heading3, { color: colors.textPrimary }]}>
            {filteredShifts.length}
          </Text>
        </View>
        <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
        <View style={styles.statItem}>
          <Text style={[typography.caption, { color: colors.textSecondary }]}>WORKED</Text>
          <Text style={[typography.heading3, { color: colors.primary }]}>
            {minutesToHoursLabel(summary.total_minutes)}
          </Text>
        </View>
        <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
        <View style={styles.statItem}>
          <Text style={[typography.caption, { color: colors.textSecondary }]}>BANK</Text>
          <Text style={[typography.heading3, { color: colors.textPrimary }]}>
            {minutesToHoursLabel(summary.bank_minutes)}
          </Text>
        </View>
        <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
        <View style={styles.statRow}>
          <TouchableOpacity onPress={handleExportPDF} disabled={isExporting} style={styles.exportBtn}>
            <Text style={[typography.caption, { color: colors.primary, fontWeight: '700' }]}>PDF</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={handleExportCSV} disabled={isExporting} style={styles.exportBtn}>
            <Text style={[typography.caption, { color: colors.primary, fontWeight: '700' }]}>CSV</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Shift list */}
      {isLoading ? (
        <LoadingSpinner style={{ marginTop: 40 }} label="Loading history..." />
      ) : (
        <FlatList
          data={filteredShifts}
          keyExtractor={item => item.id}
          renderItem={renderShift}
          ListEmptyComponent={
            <EmptyState
              title="No shifts found"
              body={
                statusFilter !== 'all'
                  ? `No ${statusFilter.replace('_', ' ')} shifts in ${periodLabel}.`
                  : `No shifts recorded in ${periodLabel}.`
              }
              icon="📋"
            />
          }
          contentContainerStyle={{ paddingBottom: 40 }}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  monthRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  monthChip: {
    flex: 1,
    paddingVertical: 8,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 36,
  },
  summaryStrip: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statDivider: {
    width: 1,
    height: 32,
  },
  statRow: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-evenly',
  },
  exportBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    minHeight: 36,
    justifyContent: 'center',
  },
});
