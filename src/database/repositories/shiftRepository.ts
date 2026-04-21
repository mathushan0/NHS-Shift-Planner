import { randomUUID } from 'expo-crypto';
import { getDatabase } from '../db';
import { Shift, ShiftWithType, ShiftStatus } from '../../types';

function nowISO(): string {
  return new Date().toISOString();
}

export async function createShift(
  data: Omit<Shift, 'id' | 'created_at' | 'updated_at' | 'deleted_at' | 'sync_version' | 'synced_at'>
): Promise<Shift> {
  const db = getDatabase();
  const id = randomUUID();
  const now = nowISO();

  await db.runAsync(
    `INSERT INTO shifts (
       id, user_id, shift_type_id, start_datetime, end_datetime,
       duration_minutes, location, notes, is_bank_shift, status,
       sync_version, created_at, updated_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
    [
      id,
      data.user_id,
      data.shift_type_id,
      data.start_datetime,
      data.end_datetime,
      data.duration_minutes,
      data.location ?? null,
      data.notes ?? null,
      data.is_bank_shift,
      data.status,
      now,
      now,
    ]
  );

  const shift = await getShiftById(id);
  if (!shift) throw new Error('Failed to create shift');
  return shift;
}

export async function getShiftById(id: string): Promise<Shift | null> {
  const db = getDatabase();
  return db.getFirstAsync<Shift>(
    'SELECT * FROM shifts WHERE id = ? AND deleted_at IS NULL',
    [id]
  );
}

export async function getShiftsForDateRange(
  userId: string,
  startDate: string,
  endDate: string
): Promise<ShiftWithType[]> {
  const db = getDatabase();
  return db.getAllAsync<ShiftWithType>(
    `SELECT s.*, 
       st.name as shift_type_name, st.colour_hex, st.is_paid,
       st.default_duration_hours,
       json_object(
         'id', st.id, 'name', st.name, 'colour_hex', st.colour_hex,
         'is_paid', st.is_paid, 'default_duration_hours', st.default_duration_hours,
         'sort_order', st.sort_order, 'user_id', st.user_id,
         'created_at', st.created_at, 'updated_at', st.updated_at, 'deleted_at', st.deleted_at
       ) as shift_type_json
     FROM shifts s
     JOIN shift_types st ON s.shift_type_id = st.id
     WHERE s.user_id = ?
       AND s.deleted_at IS NULL
       AND (s.start_datetime >= ? AND s.start_datetime <= ?
         OR s.end_datetime > ? AND s.end_datetime <= ?)
     ORDER BY s.start_datetime ASC`,
    [userId, startDate, endDate, startDate, endDate]
  ).then(rows =>
    rows.map(row => ({
      ...row,
      shift_type: JSON.parse((row as any).shift_type_json),
    }))
  );
}

export async function getUpcomingShifts(
  userId: string,
  limit: number = 10
): Promise<ShiftWithType[]> {
  const db = getDatabase();
  const now = nowISO();
  const rows = await db.getAllAsync<Record<string, unknown>>(
    `SELECT s.*, 
       json_object(
         'id', st.id, 'name', st.name, 'colour_hex', st.colour_hex,
         'is_paid', st.is_paid, 'default_duration_hours', st.default_duration_hours,
         'sort_order', st.sort_order, 'user_id', st.user_id,
         'created_at', st.created_at, 'updated_at', st.updated_at, 'deleted_at', st.deleted_at
       ) as shift_type_json
     FROM shifts s
     JOIN shift_types st ON s.shift_type_id = st.id
     WHERE s.user_id = ?
       AND s.deleted_at IS NULL
       AND s.end_datetime >= ?
       AND s.status NOT IN ('cancelled', 'swapped_out')
     ORDER BY s.start_datetime ASC
     LIMIT ?`,
    [userId, now, limit]
  );

  return rows.map(row => ({
    ...(row as unknown as Shift),
    shift_type: JSON.parse(row.shift_type_json as string),
  }));
}

export async function getShiftsForHours(
  userId: string,
  startDate: string,
  endDate: string
): Promise<ShiftWithType[]> {
  const db = getDatabase();
  const rows = await db.getAllAsync<Record<string, unknown>>(
    `SELECT s.*,
       json_object(
         'id', st.id, 'name', st.name, 'colour_hex', st.colour_hex,
         'is_paid', st.is_paid, 'default_duration_hours', st.default_duration_hours,
         'sort_order', st.sort_order, 'user_id', st.user_id,
         'created_at', st.created_at, 'updated_at', st.updated_at, 'deleted_at', st.deleted_at
       ) as shift_type_json
     FROM shifts s
     JOIN shift_types st ON s.shift_type_id = st.id
     WHERE s.user_id = ?
       AND s.deleted_at IS NULL
       AND s.start_datetime >= ?
       AND s.start_datetime <= ?
       AND s.status IN ('completed', 'in_progress', 'scheduled', 'sick', 'annual_leave', 'swapped_in')
       AND st.is_paid = 1
     ORDER BY s.start_datetime ASC`,
    [userId, startDate, endDate]
  );

  return rows.map(row => ({
    ...(row as unknown as Shift),
    shift_type: JSON.parse(row.shift_type_json as string),
  }));
}

export async function updateShift(
  id: string,
  data: Partial<Omit<Shift, 'id' | 'created_at' | 'deleted_at'>>
): Promise<Shift> {
  const db = getDatabase();
  const now = nowISO();

  const fields = Object.keys(data)
    .filter(k => k !== 'updated_at')
    .map(k => `${k} = ?`)
    .join(', ');

  const values = [...Object.values(data), now, id];

  await db.runAsync(
    `UPDATE shifts SET ${fields}, updated_at = ?, sync_version = sync_version + 1, synced_at = NULL
     WHERE id = ? AND deleted_at IS NULL`,
    values
  );

  const updated = await getShiftById(id);
  if (!updated) throw new Error('Shift not found after update');
  return updated;
}

export async function softDeleteShift(id: string): Promise<void> {
  const db = getDatabase();
  const now = nowISO();
  await db.runAsync(
    `UPDATE shifts SET deleted_at = ?, updated_at = ?, sync_version = sync_version + 1, synced_at = NULL
     WHERE id = ? AND deleted_at IS NULL`,
    [now, now, id]
  );
}

export async function updateShiftStatus(id: string, status: ShiftStatus): Promise<void> {
  const db = getDatabase();
  const now = nowISO();
  await db.runAsync(
    `UPDATE shifts SET status = ?, updated_at = ?, sync_version = sync_version + 1
     WHERE id = ? AND deleted_at IS NULL`,
    [status, now, id]
  );
}

export async function checkOverlap(
  userId: string,
  startDatetime: string,
  endDatetime: string,
  excludeShiftId?: string
): Promise<ShiftWithType[]> {
  const db = getDatabase();
  const excludeClause = excludeShiftId ? `AND s.id != ?` : '';
  const params: (string | number)[] = [
    userId,
    endDatetime,
    startDatetime,
    ...(excludeShiftId ? [excludeShiftId] : []),
  ];

  const rows = await db.getAllAsync<Record<string, unknown>>(
    `SELECT s.*,
       json_object(
         'id', st.id, 'name', st.name, 'colour_hex', st.colour_hex,
         'is_paid', st.is_paid, 'default_duration_hours', st.default_duration_hours,
         'sort_order', st.sort_order, 'user_id', st.user_id,
         'created_at', st.created_at, 'updated_at', st.updated_at, 'deleted_at', st.deleted_at
       ) as shift_type_json
     FROM shifts s
     JOIN shift_types st ON s.shift_type_id = st.id
     WHERE s.user_id = ?
       AND s.deleted_at IS NULL
       AND s.status NOT IN ('cancelled', 'swapped_out')
       AND s.start_datetime < ?
       AND s.end_datetime > ?
       ${excludeClause}`,
    params
  );

  return rows.map(row => ({
    ...(row as unknown as Shift),
    shift_type: JSON.parse(row.shift_type_json as string),
  }));
}

export async function getAllShiftsPaginated(
  userId: string,
  offset: number = 0,
  limit: number = 30,
  filterTypeId?: string
): Promise<ShiftWithType[]> {
  const db = getDatabase();
  const filterClause = filterTypeId ? 'AND s.shift_type_id = ?' : '';
  const params: (string | number)[] = [
    userId,
    ...(filterTypeId ? [filterTypeId] : []),
    limit,
    offset,
  ];

  const rows = await db.getAllAsync<Record<string, unknown>>(
    `SELECT s.*,
       json_object(
         'id', st.id, 'name', st.name, 'colour_hex', st.colour_hex,
         'is_paid', st.is_paid, 'default_duration_hours', st.default_duration_hours,
         'sort_order', st.sort_order, 'user_id', st.user_id,
         'created_at', st.created_at, 'updated_at', st.updated_at, 'deleted_at', st.deleted_at
       ) as shift_type_json
     FROM shifts s
     JOIN shift_types st ON s.shift_type_id = st.id
     WHERE s.user_id = ?
       AND s.deleted_at IS NULL
       ${filterClause}
     ORDER BY s.start_datetime DESC
     LIMIT ? OFFSET ?`,
    params
  );

  return rows.map(row => ({
    ...(row as unknown as Shift),
    shift_type: JSON.parse(row.shift_type_json as string),
  }));
}
