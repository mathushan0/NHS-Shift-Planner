import { randomUUID } from 'expo-crypto';
import { getDatabase } from '../db';
import { Reminder } from '../../types';

function nowISO(): string {
  return new Date().toISOString();
}

export async function getRemindersForShift(shiftId: string): Promise<Reminder[]> {
  const db = getDatabase();
  return db.getAllAsync<Reminder>(
    'SELECT * FROM reminders WHERE shift_id = ? AND deleted_at IS NULL ORDER BY minutes_before DESC',
    [shiftId]
  );
}

export async function createReminder(
  shiftId: string,
  minutesBefore: number,
  notificationId: string | null = null
): Promise<Reminder> {
  const db = getDatabase();
  const id = randomUUID();
  const now = nowISO();

  await db.runAsync(
    `INSERT INTO reminders (id, shift_id, minutes_before, notification_id, is_sent, created_at, updated_at)
     VALUES (?, ?, ?, ?, 0, ?, ?)`,
    [id, shiftId, minutesBefore, notificationId, now, now]
  );

  const reminder = await db.getFirstAsync<Reminder>(
    'SELECT * FROM reminders WHERE id = ?',
    [id]
  );
  if (!reminder) throw new Error('Failed to create reminder');
  return reminder;
}

export async function updateReminderNotificationId(
  id: string,
  notificationId: string
): Promise<void> {
  const db = getDatabase();
  const now = nowISO();
  await db.runAsync(
    `UPDATE reminders SET notification_id = ?, updated_at = ? WHERE id = ?`,
    [notificationId, now, id]
  );
}

export async function markReminderSent(id: string): Promise<void> {
  const db = getDatabase();
  const now = nowISO();
  await db.runAsync(
    `UPDATE reminders SET is_sent = 1, updated_at = ? WHERE id = ?`,
    [now, id]
  );
}

export async function softDeleteRemindersForShift(shiftId: string): Promise<void> {
  const db = getDatabase();
  const now = nowISO();
  await db.runAsync(
    `UPDATE reminders SET deleted_at = ?, updated_at = ? WHERE shift_id = ? AND deleted_at IS NULL`,
    [now, now, shiftId]
  );
}

export async function softDeleteReminder(id: string): Promise<void> {
  const db = getDatabase();
  const now = nowISO();
  await db.runAsync(
    `UPDATE reminders SET deleted_at = ?, updated_at = ? WHERE id = ?`,
    [now, now, id]
  );
}
