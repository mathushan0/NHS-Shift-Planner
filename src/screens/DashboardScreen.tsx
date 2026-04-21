import React, { useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  RefreshControl,
  ListRenderItem,
  Linking,
} from 'react-native';
import { CompositeScreenProps } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { format, parseISO, isToday } from 'date-fns';
import { useTheme } from '../hooks/useTheme';
import { useShiftStore } from '../stores/shiftStore';
import { useSettingsStore } from '../stores/settingsStore';
import { useUIStore } from '../stores/uiStore';
import { HeroCard } from '../components/molecules/HeroCard';
import { WeekStrip } from '../components/molecules/WeekStrip';
import { ShiftCard } from '../components/molecules/ShiftCard';
import { FAB } from '../components/molecules/FAB';
import { EmptyState } from '../components/molecules/EmptyState';
import { LoadingSpinner } from '../components/molecules/LoadingSpinner';
import { HomeStackParamList, MainTabParamList, ShiftWithType, WeekDayInfo } from '../types';
import { BannerAlert } from '../components/molecules/BannerAlert';
import { getGreeting, getWeekDays, toDateString } from '../utils/dateUtils';

type Props = NativeStackScreenProps<HomeStackParamList, 'Dashboard'>;

export function DashboardScreen({ navigation }: Props) {
  const { colors, typography, spacing } = useTheme();
  const { upcomingShifts, shifts, isLoading, loadUpcomingShifts, loadShiftsForDateRange, deleteShift } =
    useShiftStore();
  const displayName = useSettingsStore(s => s.displayName);
  const userId = useSettingsStore(s => s.userId) ?? 'local-user-1';
  const { selectedDate, setSelectedDate, showSnackbar, notificationsGranted, openAddShift, openEditShift } = useUIStore();

  const today = toDateString(new Date());
  const currentDate = selectedDate ?? today;

  // Load upcoming and week shifts
  useEffect(() => {
    loadUpcomingShifts(userId);
    refreshWeek();
  }, [userId]);

  async function refreshWeek() {
    const weekDays = getWeekDays(new Date());
    const start = toDateString(weekDays[0]);
    const end = toDateString(weekDays[6]);
    await loadShiftsForDateRange(userId, start, end);
  }

  // Week strip data
  const weekDays = useMemo((): WeekDayInfo[] => {
    return getWeekDays(new Date()).map(date => {
      const dateString = toDateString(date);
      const dayShifts = shifts.filter(s =>
        format(parseISO(s.start_datetime), 'yyyy-MM-dd') === dateString
      );
      return {
        date,
        dateString,
        shifts: dayShifts,
        isToday: isToday(date),
        isSelected: dateString === currentDate,
      };
    });
  }, [shifts, currentDate]);

  // Hero card: today's or next upcoming
  const heroShift = useMemo(() => {
    const todayShift = upcomingShifts.find(
      s => format(parseISO(s.start_datetime), 'yyyy-MM-dd') === today
    );
    return todayShift ?? upcomingShifts[0] ?? null;
  }, [upcomingShifts, today]);

  // Shifts for selected day
  const selectedDayShifts = useMemo(() => {
    return upcomingShifts.filter(
      s => format(parseISO(s.start_datetime), 'yyyy-MM-dd') === currentDate
    );
  }, [upcomingShifts, currentDate]);

  async function handleDelete(shift: ShiftWithType) {
    try {
      await deleteShift(shift.id);
      await loadUpcomingShifts(userId);
      showSnackbar({
        message: 'Shift deleted',
        variant: 'default',
        actionLabel: 'Undo',
        onAction: async () => {
          const { undoDeleteShift } = useShiftStore.getState();
          await undoDeleteShift(shift);
          await loadUpcomingShifts(userId);
        },
      });
    } catch {
      showSnackbar({ message: 'Could not delete shift', variant: 'error' });
    }
  }

  const renderShift: ListRenderItem<ShiftWithType> = ({ item }) => (
    <ShiftCard
      shift={item}
      onPress={() => navigation.navigate('ShiftDetail', { shiftId: item.id })}
      onDelete={() => handleDelete(item)}
    />
  );

  const greeting = getGreeting(displayName);

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.screenBackground }]}>
      {/* Header */}
      <View style={[styles.header, { paddingHorizontal: spacing[4] }]}>
        <View>
          <Text style={[typography.heading2, { color: colors.textPrimary }]}>{greeting}</Text>
          <Text style={[typography.body2, { color: colors.textSecondary }]}>
            {format(new Date(), 'EEEE, d MMMM yyyy')}
          </Text>
        </View>
        <TouchableOpacity
          onPress={() => navigation.navigate('Settings' as any)}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityRole="button"
          accessibilityLabel="Notification settings"
        >
          <Text style={{ fontSize: 24 }}>🔔</Text>
        </TouchableOpacity>
      </View>

      {/* Notification denied banner */}
      {notificationsGranted === false && (
        <BannerAlert
          variant="warning"
          message="Notifications are disabled. Tap to enable shift reminders."
          ctaLabel="Open Settings"
          onCta={() => Linking.openSettings()}
        />
      )}

      <FlatList
        data={upcomingShifts.slice(0, 20)}
        keyExtractor={item => item.id}
        renderItem={renderShift}
        refreshControl={
          <RefreshControl
            refreshing={isLoading}
            onRefresh={async () => {
              await loadUpcomingShifts(userId);
              await refreshWeek();
            }}
            tintColor={colors.primary}
          />
        }
        ListHeaderComponent={
          <>
            {/* Hero card */}
            <View style={{ marginTop: spacing[4], marginBottom: spacing[4] }}>
              <HeroCard
                shift={heroShift}
                onEdit={
                  heroShift
                    ? () => navigation.navigate('AddEditShift' as any, { shiftId: heroShift.id })
                    : undefined
                }
              />
            </View>


            {/* Week strip */}
            <WeekStrip
              days={weekDays}
              selectedDate={currentDate}
              onSelectDay={setSelectedDate}
            />

            {/* Section header */}
            <View style={[styles.sectionHeader, { paddingHorizontal: spacing[4], marginTop: spacing[4] }]}>
              <Text style={[typography.heading3, { color: colors.textPrimary }]}>
                Upcoming Shifts
              </Text>
              <TouchableOpacity
                onPress={() => openAddShift(currentDate)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text style={[typography.body2, { color: colors.primary, fontWeight: '600' }]}>
                  + Add
                </Text>
              </TouchableOpacity>
            </View>

            {isLoading && upcomingShifts.length === 0 ? <LoadingSpinner /> : null}
          </>
        }
        ListEmptyComponent={
          !isLoading ? (
            <EmptyState
              title="No upcoming shifts"
              body="Tap the + button to add your first shift."
              icon="📅"
              ctaLabel="Add Shift"
              onCta={() => openAddShift(currentDate)}
              style={{ marginTop: 32 }}
            />
          ) : null
        }
        contentContainerStyle={{ paddingBottom: 100 }}
      />

      {/* Floating action button */}
      <View style={styles.fab}>
        <FAB
          onPress={() => navigation.navigate('AddEditShift' as any, { initialDate: currentDate })}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 16,
    paddingBottom: 8,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 20,
  },
});
