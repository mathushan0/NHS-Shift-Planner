import React from 'react';
import {
  ScrollView,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { format, isToday } from 'date-fns';
import { useTheme } from '../../hooks/useTheme';
import { ShiftWithType } from '../../types';
import { WeekDayInfo } from '../../types';

interface Props {
  days: WeekDayInfo[];
  selectedDate: string | null;
  onSelectDay: (dateString: string) => void;
}

export function WeekStrip({ days, selectedDate, onSelectDay }: Props) {
  const { colors, typography, spacing, radius } = useTheme();

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.container}
    >
      {days.map(day => {
        const dayStr = format(day.date, 'EEE')[0]; // M, T, W...
        const dateNum = format(day.date, 'd');
        const isSelected = day.dateString === selectedDate;
        const today = isToday(day.date);

        const cellBg = today
          ? colors.primary
          : isSelected
          ? 'transparent'
          : 'transparent';

        const cellBorder = isSelected && !today ? colors.primary : 'transparent';
        const textColor = today ? '#FFFFFF' : colors.textPrimary;

        // Show up to 3 dots for shifts, then "+N"
        const dots = day.shifts.slice(0, 3);
        const extraCount = Math.max(0, day.shifts.length - 3);

        return (
          <TouchableOpacity
            key={day.dateString}
            onPress={() => onSelectDay(day.dateString)}
            style={[
              styles.dayCell,
              {
                backgroundColor: cellBg,
                borderColor: cellBorder,
                borderWidth: isSelected && !today ? 1.5 : 0,
                borderRadius: radius.md,
                minHeight: 52,
                minWidth: 44,
              },
            ]}
            accessibilityRole="button"
            accessibilityLabel={`${format(day.date, 'EEEE d MMMM')}, ${day.shifts.length} shift${day.shifts.length !== 1 ? 's' : ''}`}
            accessibilityState={{ selected: isSelected }}
          >
            <Text
              style={[typography.caption, { color: today ? 'rgba(255,255,255,0.8)' : colors.textSecondary }]}
            >
              {dayStr}
            </Text>
            <Text
              style={[
                typography.body2,
                { fontWeight: '600', color: textColor },
              ]}
            >
              {dateNum}
            </Text>
            {day.shifts.length > 0 ? (
              <View style={styles.dotsRow}>
                {dots.map((shift, i) => (
                  <View
                    key={i}
                    style={[
                      styles.dot,
                      { backgroundColor: shift.shift_type.colour_hex },
                    ]}
                  />
                ))}
                {extraCount > 0 ? (
                  <Text style={[typography.caption, { color: colors.textSecondary, fontSize: 8 }]}>
                    +{extraCount}
                  </Text>
                ) : null}
              </View>
            ) : (
              <View style={{ height: 8 }} />
            )}
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    gap: 4,
  },
  dayCell: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
    paddingVertical: 6,
    marginHorizontal: 2,
  },
  dotsRow: {
    flexDirection: 'row',
    marginTop: 3,
    gap: 2,
    height: 8,
    alignItems: 'center',
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
});
