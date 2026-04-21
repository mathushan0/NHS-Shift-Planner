import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  FlatList,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { format, parseISO, addMonths, subMonths } from 'date-fns';
import { useTheme } from '../hooks/useTheme';
import { useShiftStore } from '../stores/shiftStore';
import { useSettingsStore } from '../stores/settingsStore';
import { useUIStore } from '../stores/uiStore';
import { CalendarMonthGrid } from '../components/molecules/CalendarMonthGrid';
import { ShiftCard } from '../components/molecules/ShiftCard';
import { FAB } from '../components/molecules/FAB';
import { EmptyState } from '../components/molecules/EmptyState';
import { LoadingSpinner } from '../components/molecules/LoadingSpinner';
import { CalendarStackParamList, ShiftWithType } from '../types';
import { getMonthCalendarDays, toDateString } from '../utils/dateUtils';

type Props = NativeStackScreenProps<CalendarStackParamList, 'Calendar'>;

export function CalendarScreen({ navigation, route }: Props) {
  const { colors, typography, spacing } = useTheme();
  const { shifts, isLoading, loadShiftsForDateRange, deleteShift } = useShiftStore();
  const { selectedDate, setSelectedDate, showSnackbar } = useUIStore();
  const userId = useSettingsStore(s => s.userId) ?? 'local-user-1';

  const [displayDate, setDisplayDate] = useState(() => {
    if (route.params?.initialDate) return parseISO(route.params.initialDate);
    return new Date();
  });

  const year = displayDate.getFullYear();
  const month = displayDate.getMonth() + 1;

  // Selected date defaults to today
  const currentSelected = selectedDate ?? toDateString(new Date());

  useEffect(() => {
    refreshMonth(displayDate);
  }, [year, month]);

  async function refreshMonth(date: Date) {
    const days = getMonthCalendarDays(date.getFullYear(), date.getMonth() + 1);
    const start = toDateString(days[0]);
    const end = toDateString(days[days.length - 1]);
    await loadShiftsForDateRange(userId, start, end);
  }

  const calendarDays = useMemo(
    () => getMonthCalendarDays(year, month),
    [year, month]
  );

  // Shifts for selected day
  const selectedDayShifts = useMemo(() => {
    return shifts.filter(
      s => format(parseISO(s.start_datetime), 'yyyy-MM-dd') === currentSelected
    );
  }, [shifts, currentSelected]);

  function prevMonth() {
    const prev = subMonths(displayDate, 1);
    setDisplayDate(prev);
  }

  function nextMonth() {
    const next = addMonths(displayDate, 1);
    setDisplayDate(next);
  }

  async function handleDelete(shift: ShiftWithType) {
    try {
      await deleteShift(shift.id);
      await refreshMonth(displayDate);
      showSnackbar({
        message: 'Shift deleted',
        variant: 'default',
        actionLabel: 'Undo',
        onAction: async () => {
          const { undoDeleteShift } = useShiftStore.getState();
          await undoDeleteShift(shift);
          await refreshMonth(displayDate);
        },
      });
    } catch {
      showSnackbar({ message: 'Could not delete shift', variant: 'error' });
    }
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.screenBackground }]}>
      {/* Month navigation header */}
      <View style={[styles.monthHeader, { paddingHorizontal: spacing[4], backgroundColor: colors.surface1 }]}>
        <TouchableOpacity
          onPress={prevMonth}
          style={styles.arrowBtn}
          accessibilityRole="button"
          accessibilityLabel="Previous month"
        >
          <Text style={{ fontSize: 22, color: colors.primary }}>‹</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => { setDisplayDate(new Date()); setSelectedDate(toDateString(new Date())); }}>
          <Text style={[typography.heading3, { color: colors.textPrimary }]}>
            {format(displayDate, 'MMMM yyyy')}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={nextMonth}
          style={styles.arrowBtn}
          accessibilityRole="button"
          accessibilityLabel="Next month"
        >
          <Text style={{ fontSize: 22, color: colors.primary }}>›</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.flex} contentContainerStyle={{ paddingBottom: 100 }}>
        {/* Calendar grid */}
        <View style={[styles.gridWrapper, { backgroundColor: colors.surface1, marginBottom: spacing[2] }]}>
          {isLoading && shifts.length === 0 ? (
            <LoadingSpinner style={{ paddingVertical: 48 }} />
          ) : (
            <CalendarMonthGrid
              year={year}
              month={month}
              days={calendarDays}
              shifts={shifts}
              selectedDate={currentSelected}
              bankHolidayDates={[]}
              onSelectDay={setSelectedDate}
            />
          )}
        </View>

        {/* Day detail */}
        <View style={{ paddingHorizontal: spacing[4] }}>
          <View style={[styles.dayDetailHeader, { marginBottom: spacing[2] }]}>
            <Text style={[typography.heading3, { color: colors.textPrimary }]}>
              {format(parseISO(currentSelected), 'EEEE, d MMMM')}
            </Text>
            <TouchableOpacity
              onPress={() => navigation.navigate('AddEditShift' as any, { initialDate: currentSelected })}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text style={[typography.body2, { color: colors.primary, fontWeight: '600' }]}>+ Add</Text>
            </TouchableOpacity>
          </View>

          {selectedDayShifts.length === 0 ? (
            <EmptyState
              title="No shifts"
              body="No shifts scheduled for this day."
              icon="📅"
              ctaLabel="Add Shift"
              onCta={() => navigation.navigate('AddEditShift' as any, { initialDate: currentSelected })}
              style={{ paddingVertical: 32 }}
            />
          ) : (
            selectedDayShifts.map(shift => (
              <ShiftCard
                key={shift.id}
                shift={shift}
                onPress={() => navigation.navigate('ShiftDetail', { shiftId: shift.id })}
                onDelete={() => handleDelete(shift)}
              />
            ))
          )}
        </View>
      </ScrollView>

      {/* FAB */}
      <View style={styles.fab}>
        <FAB
          onPress={() => navigation.navigate('AddEditShift' as any, { initialDate: currentSelected })}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  flex: { flex: 1 },
  monthHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  arrowBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gridWrapper: {
    paddingVertical: 8,
  },
  dayDetailHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 20,
  },
});
