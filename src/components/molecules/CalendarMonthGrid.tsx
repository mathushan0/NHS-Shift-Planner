import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { format, isToday, isSameMonth } from 'date-fns';
import { useTheme } from '../../hooks/useTheme';
import { ShiftWithType } from '../../types';

interface Props {
  year: number;
  month: number; // 1-12
  days: Date[];
  shifts: ShiftWithType[];
  selectedDate: string | null;
  bankHolidayDates: string[]; // YYYY-MM-DD
  onSelectDay: (dateString: string) => void;
}

const DAY_HEADERS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

export function CalendarMonthGrid({
  year,
  month,
  days,
  shifts,
  selectedDate,
  bankHolidayDates,
  onSelectDay,
}: Props) {
  const { colors, typography, radius } = useTheme();

  // Build a map of dateString → shifts
  const shiftMap = new Map<string, ShiftWithType[]>();
  for (const shift of shifts) {
    const key = format(new Date(shift.start_datetime), 'yyyy-MM-dd');
    const existing = shiftMap.get(key) ?? [];
    existing.push(shift);
    shiftMap.set(key, existing);
  }

  const currentMonth = new Date(year, month - 1);

  return (
    <View style={styles.grid}>
      {/* Day headers */}
      <View style={styles.headerRow}>
        {DAY_HEADERS.map((d, i) => (
          <View key={i} style={styles.cell}>
            <Text
              style={[typography.caption, { color: colors.textSecondary, fontWeight: '600' }]}
            >
              {d}
            </Text>
          </View>
        ))}
      </View>

      {/* Calendar days — 6 rows × 7 cols */}
      {Array.from({ length: Math.ceil(days.length / 7) }, (_, weekIdx) => (
        <View key={weekIdx} style={styles.weekRow}>
          {days.slice(weekIdx * 7, weekIdx * 7 + 7).map(day => {
            const dateStr = format(day, 'yyyy-MM-dd');
            const dayShifts = shiftMap.get(dateStr) ?? [];
            const isCurrentMonth = isSameMonth(day, currentMonth);
            const today = isToday(day);
            const isSelected = dateStr === selectedDate;
            const isBankHoliday = bankHolidayDates.includes(dateStr);

            const visibleShifts = dayShifts.slice(0, 2);
            const extraCount = Math.max(0, dayShifts.length - 2);

            const bgColor = today
              ? colors.primary
              : isBankHoliday
              ? colors.surface3
              : 'transparent';

            const textColor = today
              ? '#FFFFFF'
              : !isCurrentMonth
              ? colors.textDisabled
              : colors.textPrimary;

            const selectionBorder = isSelected && !today ? colors.primary : 'transparent';

            const cellLabel = `${format(day, 'EEEE d MMMM')}${dayShifts.length > 0 ? `, ${dayShifts.length} shift${dayShifts.length > 1 ? 's' : ''}` : ', no shifts'}${isBankHoliday ? ', bank holiday' : ''}`;

            return (
              <TouchableOpacity
                key={dateStr}
                onPress={() => onSelectDay(dateStr)}
                style={[
                  styles.cell,
                  styles.dayCell,
                  {
                    backgroundColor: bgColor,
                    borderRadius: radius.sm,
                    borderWidth: isSelected && !today ? 1.5 : 0,
                    borderColor: selectionBorder,
                  },
                ]}
                accessibilityRole="button"
                accessibilityLabel={cellLabel}
                accessibilityState={{ selected: isSelected }}
              >
                <Text
                  style={[
                    typography.body2,
                    { color: textColor, fontWeight: today ? '700' : '400' },
                  ]}
                >
                  {format(day, 'd')}
                </Text>

                {isBankHoliday && !today ? (
                  <Text style={[typography.caption, { fontSize: 7, color: colors.textDisabled }]}>
                    BH
                  </Text>
                ) : null}

                {visibleShifts.length > 0 ? (
                  <View style={styles.abbrevRow}>
                    {visibleShifts.map((s, i) => (
                      <View
                        key={i}
                        style={[
                          styles.abbrevBadge,
                          { backgroundColor: s.shift_type.colour_hex },
                        ]}
                      >
                        <Text style={styles.abbrevText}>
                          {s.shift_type.abbreviation || s.shift_type.name.slice(0, 2).toUpperCase()}
                        </Text>
                      </View>
                    ))}
                    {extraCount > 0 ? (
                      <Text style={{ fontSize: 7, color: colors.textSecondary }}>+{extraCount}</Text>
                    ) : null}
                  </View>
                ) : null}
              </TouchableOpacity>
            );
          })}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    paddingHorizontal: 8,
  },
  headerRow: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  weekRow: {
    flexDirection: 'row',
    marginBottom: 2,
  },
  cell: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 2,
  },
  dayCell: {
    minHeight: 44,
    paddingVertical: 4,
  },
  abbrevRow: {
    flexDirection: 'row',
    marginTop: 2,
    gap: 2,
    alignItems: 'center',
    justifyContent: 'center',
    flexWrap: 'wrap',
  },
  abbrevBadge: {
    paddingHorizontal: 3,
    paddingVertical: 1,
    borderRadius: 2,
    minWidth: 16,
    alignItems: 'center',
  },
  abbrevText: {
    fontSize: 7,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },
});
