import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { Shift, Reminder, ShiftType } from '../types';
import * as reminderRepo from '../database/repositories/reminderRepository';
import * as shiftTypeRepo from '../database/repositories/shiftTypeRepository';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export async function requestNotificationPermissions(): Promise<boolean> {
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('shift-reminders', {
      name: 'Shift Reminders',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#005EB8',
    });
  }

  return finalStatus === 'granted';
}

export async function checkNotificationPermissions(): Promise<boolean> {
  const { status } = await Notifications.getPermissionsAsync();
  return status === 'granted';
}

function getNotificationTitle(minutesBefore: number): string {
  if (minutesBefore > 120) return 'Upcoming Shift';
  if (minutesBefore > 60) return 'Shift Starting Soon';
  return '⏰ Shift Alert';
}

function getNotificationBody(
  shiftTypeName: string,
  minutesBefore: number,
  location: string | null
): string {
  const timeStr =
    minutesBefore >= 60
      ? `${Math.round(minutesBefore / 60)} hour${minutesBefore >= 120 ? 's' : ''}`
      : `${minutesBefore} min${minutesBefore !== 1 ? 's' : ''}`;

  const locationStr = location ? ` — ${location}` : '';
  return `${shiftTypeName} starts in ${timeStr}${locationStr}`;
}

export async function scheduleShiftReminders(
  shift: Shift,
  reminderMinutes: number[],
  shiftType?: ShiftType
): Promise<void> {
  const type =
    shiftType ?? (await shiftTypeRepo.getShiftTypeById(shift.shift_type_id));
  if (!type) return;

  const startDate = new Date(shift.start_datetime);

  for (const minutesBefore of reminderMinutes) {
    const triggerDate = new Date(startDate.getTime() - minutesBefore * 60 * 1000);

    if (triggerDate <= new Date()) {
      // Already past — create as sent
      await reminderRepo.createReminder(shift.id, minutesBefore, null);
      continue;
    }

    try {
      const notificationId = await Notifications.scheduleNotificationAsync({
        content: {
          title: getNotificationTitle(minutesBefore),
          body: getNotificationBody(type.name, minutesBefore, shift.location),
          data: { shiftId: shift.id },
          sound: true,
        },
        trigger: { date: triggerDate } as Notifications.DateTriggerInput,
      });

      await reminderRepo.createReminder(shift.id, minutesBefore, notificationId);
    } catch (error) {
      // If scheduling fails (e.g. hit 64-notification limit), still record
      await reminderRepo.createReminder(shift.id, minutesBefore, null);
    }
  }
}

export async function cancelShiftReminders(reminders: Reminder[]): Promise<void> {
  for (const reminder of reminders) {
    if (reminder.notification_id) {
      try {
        await Notifications.cancelScheduledNotificationAsync(reminder.notification_id);
      } catch {
        // Ignore errors — notification may have already fired
      }
    }
  }
}

export async function rescheduleAllRemindersForShift(
  shift: Shift,
  reminderMinutes: number[]
): Promise<void> {
  const existing = await reminderRepo.getRemindersForShift(shift.id);
  await cancelShiftReminders(existing);
  await reminderRepo.softDeleteRemindersForShift(shift.id);
  await scheduleShiftReminders(shift, reminderMinutes);
}

export function setupNotificationResponseHandler(
  onShiftOpen: (shiftId: string) => void
): Notifications.Subscription {
  return Notifications.addNotificationResponseReceivedListener(response => {
    const shiftId = response.notification.request.content.data?.shiftId as string | undefined;
    if (shiftId) {
      onShiftOpen(shiftId);
    }
  });
}

export async function getScheduledNotificationCount(): Promise<number> {
  const notifications = await Notifications.getAllScheduledNotificationsAsync();
  return notifications.length;
}
