import { randomUUID } from 'expo-crypto';
import { getDatabase } from '../db';
import { ShiftType } from '../../types';

function nowISO(): string {
  return new Date().toISOString();
}

export async function getShiftTypes(userId: string): Promise<ShiftType[]> {
  const db = getDatabase();
  return db.getAllAsync<ShiftType>(
    'SELECT * FROM shift_types WHERE user_id = ? AND deleted_at IS NULL ORDER BY sort_order ASC',
    [userId]
  );
}

export async function getShiftTypeById(id: string): Promise<ShiftType | null> {
  const db = getDatabase();
  return db.getFirstAsync<ShiftType>(
    'SELECT * FROM shift_types WHERE id = ? AND deleted_at IS NULL',
    [id]
  );
}

export async function createShiftType(
  data: Omit<ShiftType, 'id' | 'created_at' | 'updated_at' | 'deleted_at'>
): Promise<ShiftType> {
  const db = getDatabase();
  const id = randomUUID();
  const now = nowISO();

  await db.runAsync(
    `INSERT INTO shift_types (id, user_id, name, colour_hex, default_duration_hours, is_paid, sort_order, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, data.user_id, data.name, data.colour_hex, data.default_duration_hours ?? null, data.is_paid, data.sort_order, now, now]
  );

  const st = await getShiftTypeById(id);
  if (!st) throw new Error('Failed to create shift type');
  return st;
}

export async function updateShiftType(
  id: string,
  data: Partial<Pick<ShiftType, 'name' | 'colour_hex' | 'default_duration_hours' | 'is_paid' | 'sort_order'>>
): Promise<ShiftType> {
  const db = getDatabase();
  const now = nowISO();
  const fields = Object.keys(data).map(k => `${k} = ?`).join(', ');
  const values = [...Object.values(data), now, id];

  await db.runAsync(
    `UPDATE shift_types SET ${fields}, updated_at = ? WHERE id = ? AND deleted_at IS NULL`,
    values
  );

  const updated = await getShiftTypeById(id);
  if (!updated) throw new Error('Shift type not found after update');
  return updated;
}

export async function softDeleteShiftType(id: string): Promise<void> {
  const db = getDatabase();
  const now = nowISO();
  await db.runAsync(
    `UPDATE shift_types SET deleted_at = ?, updated_at = ? WHERE id = ? AND deleted_at IS NULL`,
    [now, now, id]
  );
}
