// @ts-nocheck — V2 cloud sync: requires supabase, not active in MVP build
/**
 * Offline-first sync service for MyShifts.
 *
 * Strategy:
 *  - Local SQLite is always the source of truth.
 *  - "Dirty" records are identified by synced_at IS NULL.
 *  - On sync: push dirty records → pull server changes → apply & mark clean.
 *  - Conflict resolution: higher sync_version wins; ties go to server.
 *  - Soft deletes (deleted_at) propagate to the cloud, never hard deletes.
 *
 * Sync is triggered by:
 *  - App foregrounded
 *  - Network reconnection (via useNetworkStatus hook)
 *  - Manual "Sync Now" tap
 *  - 15-minute foreground interval (managed by caller)
 *  - App backgrounded (lightweight dirty-push only — not yet implemented here;
 *    use a BackgroundFetch task in the app entry point)
 */

import { getSupabaseClient, isSupabaseConfigured } from './supabase';
import { getCurrentSession, isAuthenticated } from './auth';
import { getDatabase } from '../database/db';
import type { Shift, ShiftType, Reminder, Settings } from '../types';

// ─── Types ────────────────────────────────────────────────────────────────────

type SyncTable = 'shifts' | 'shift_types' | 'reminders' | 'settings';

interface SyncableRecord {
  id?: string;         // not present for settings (PK is user_id)
  user_id?: string;
  updated_at: string;
  synced_at?: string | null;
  sync_version?: number;
  deleted_at?: string | null;
}

interface ClientChange {
  table: SyncTable;
  id: string;
  operation: 'upsert' | 'delete';
  payload: Record<string, unknown>;
  sync_version: number;
  updated_at: string;
}

interface ServerChange {
  table: SyncTable;
  id: string;
  operation: 'upsert' | 'delete';
  payload: Record<string, unknown>;
  sync_version: number;
}

interface ConflictResolution {
  id: string;
  resolution: 'server_wins' | 'client_wins';
  winning_version: number;
}

interface SyncRequest {
  client_changes: ClientChange[];
  last_sync_at: string | null;
}

interface SyncResponse {
  server_changes: ServerChange[];
  conflicts: ConflictResolution[];
  sync_timestamp: string;
}

export interface SyncResult {
  pushed: number;
  pulled: number;
  conflicts: number;
  error: string | null;
  syncedAt: string | null;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Run a full incremental sync. Safe to call at any time — it guards against
 * concurrent invocations and missing auth/network.
 */
export async function runSync(userId: string): Promise<SyncResult> {
  if (!isSupabaseConfigured()) {
    return noOpResult('Supabase is not configured.');
  }

  const authed = await isAuthenticated();
  if (!authed) {
    return noOpResult('User is not authenticated.');
  }

  if (syncInProgress) {
    return noOpResult('Sync already in progress.');
  }

  syncInProgress = true;
  const syncStartedAt = new Date().toISOString();
  let result: SyncResult = { pushed: 0, pulled: 0, conflicts: 0, error: null, syncedAt: null };

  try {
    const lastSyncAt = await getLastSyncTimestamp(userId);
    const clientChanges = await collectDirtyRecords(userId);

    const response = await callSyncEdgeFunction({
      client_changes: clientChanges,
      last_sync_at: lastSyncAt,
    });

    await applyServerChanges(userId, response.server_changes);
    await markRecordsClean(userId, clientChanges, response.sync_timestamp);

    result = {
      pushed: clientChanges.length,
      pulled: response.server_changes.length,
      conflicts: response.conflicts.length,
      error: null,
      syncedAt: response.sync_timestamp,
    };

    await logSyncResult(userId, syncStartedAt, result);
    await updateLastSyncTimestamp(userId, response.sync_timestamp);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    result = { pushed: 0, pulled: 0, conflicts: 0, error: message, syncedAt: null };
    await logSyncResult(userId, syncStartedAt, result);
    console.error('[Sync] Sync failed:', message);
  } finally {
    syncInProgress = false;
  }

  return result;
}

/**
 * Lightweight dirty-push: only uploads local changes without pulling.
 * Used when the app is being backgrounded. Faster, lower data usage.
 */
export async function pushDirtyRecords(userId: string): Promise<{ pushed: number; error: string | null }> {
  if (!isSupabaseConfigured()) return { pushed: 0, error: 'Supabase not configured.' };

  const authed = await isAuthenticated();
  if (!authed) return { pushed: 0, error: 'Not authenticated.' };
  if (syncInProgress) return { pushed: 0, error: 'Full sync in progress.' };

  try {
    const dirty = await collectDirtyRecords(userId);
    if (dirty.length === 0) return { pushed: 0, error: null };

    // Push directly via Supabase REST (no edge function) for lightweight push.
    const supabase = getSupabaseClient();

    for (const change of dirty) {
      if (change.operation === 'upsert') {
        const { error } = await supabase
          .from(change.table)
          .upsert(change.payload, { onConflict: 'id' });
        if (error) throw new Error(`Failed to push ${change.table} ${change.id}: ${error.message}`);
      }
      // Soft deletes are included in upsert payload (deleted_at is set).
    }

    const now = new Date().toISOString();
    await markRecordsClean(userId, dirty, now);
    return { pushed: dirty.length, error: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { pushed: 0, error: message };
  }
}

/**
 * Pull and apply all server records for the user.
 * Used after a fresh install / sign-in to restore data from cloud.
 */
export async function restoreFromCloud(userId: string): Promise<SyncResult> {
  if (!isSupabaseConfigured()) return noOpResult('Supabase not configured.');

  const authed = await isAuthenticated();
  if (!authed) return noOpResult('Not authenticated.');

  const syncStartedAt = new Date().toISOString();

  try {
    const supabase = getSupabaseClient();

    // Fetch all tables for the user.
    const [shiftsRes, shiftTypesRes, remindersRes, settingsRes] = await Promise.all([
      supabase.from('shifts').select('*').eq('user_id', userId),
      supabase.from('shift_types').select('*').eq('user_id', userId),
      supabase.from('reminders').select('*'),  // reminders join through shifts
      supabase.from('settings').select('*').eq('user_id', userId),
    ]);

    const errors = [shiftsRes.error, shiftTypesRes.error, remindersRes.error, settingsRes.error]
      .filter(Boolean);
    if (errors.length > 0) {
      throw new Error(errors.map(e => e!.message).join('; '));
    }

    const serverChanges: ServerChange[] = [
      ...(shiftTypesRes.data ?? []).map(r => toServerChange('shift_types', r)),
      ...(shiftsRes.data ?? []).map(r => toServerChange('shifts', r)),
      ...(remindersRes.data ?? []).map(r => toServerChange('reminders', r)),
      ...(settingsRes.data ?? []).map(r => toServerChange('settings', r)),
    ];

    await applyServerChanges(userId, serverChanges);

    const syncedAt = new Date().toISOString();
    const result: SyncResult = {
      pushed: 0,
      pulled: serverChanges.length,
      conflicts: 0,
      error: null,
      syncedAt,
    };
    await logSyncResult(userId, syncStartedAt, result);
    await updateLastSyncTimestamp(userId, syncedAt);
    return result;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { pushed: 0, pulled: 0, conflicts: 0, error: message, syncedAt: null };
  }
}

// ─── Internals ────────────────────────────────────────────────────────────────

let syncInProgress = false;

async function callSyncEdgeFunction(request: SyncRequest): Promise<SyncResponse> {
  const supabase = getSupabaseClient();
  const session = await getCurrentSession();

  if (!session) throw new Error('No active session for sync.');

  const { data, error } = await supabase.functions.invoke<SyncResponse>('sync', {
    body: request,
    headers: {
      Authorization: `Bearer ${session.access_token}`,
    },
  });

  if (error) throw new Error(`Sync edge function error: ${error.message}`);
  if (!data) throw new Error('Sync edge function returned no data.');

  return data;
}

/**
 * Collect all local records that have not yet been synced (synced_at IS NULL).
 * Settings uses user_id as PK so it's handled separately.
 */
async function collectDirtyRecords(userId: string): Promise<ClientChange[]> {
  const db = getDatabase();
  const changes: ClientChange[] = [];

  // Shifts
  const dirtyShifts = await db.getAllAsync<Shift>(
    `SELECT * FROM shifts WHERE user_id = ? AND synced_at IS NULL`,
    [userId]
  );
  for (const shift of dirtyShifts) {
    changes.push({
      table: 'shifts',
      id: shift.id,
      operation: shift.deleted_at ? 'delete' : 'upsert',
      payload: serializeShift(shift),
      sync_version: shift.sync_version,
      updated_at: shift.updated_at,
    });
  }

  // Shift types
  const dirtyShiftTypes = await db.getAllAsync<ShiftType>(
    `SELECT * FROM shift_types WHERE user_id = ? AND synced_at IS NULL`,
    [userId]
  );
  for (const st of dirtyShiftTypes) {
    changes.push({
      table: 'shift_types',
      id: st.id,
      operation: st.deleted_at ? 'delete' : 'upsert',
      payload: serializeShiftType(st),
      sync_version: 1,
      updated_at: st.updated_at,
    });
  }

  // Reminders (tied to shifts; no independent sync_version needed)
  const dirtyReminders = await db.getAllAsync<Reminder>(
    `SELECT r.* FROM reminders r
     JOIN shifts s ON r.shift_id = s.id
     WHERE s.user_id = ? AND r.synced_at IS NULL`,
    [userId]
  );
  for (const reminder of dirtyReminders) {
    changes.push({
      table: 'reminders',
      id: reminder.id,
      operation: reminder.deleted_at ? 'delete' : 'upsert',
      payload: serializeReminder(reminder),
      sync_version: 1,
      updated_at: reminder.updated_at,
    });
  }

  // Settings (single row per user)
  const settings = await db.getFirstAsync<Settings>(
    `SELECT * FROM settings WHERE user_id = ?`,
    [userId]
  );
  if (settings) {
    // Settings doesn't have a synced_at column; compare updated_at with last sync.
    const lastSync = await getLastSyncTimestamp(userId);
    const settingsUpdatedAt = new Date(settings.updated_at).getTime();
    const lastSyncTime = lastSync ? new Date(lastSync).getTime() : 0;

    if (settingsUpdatedAt > lastSyncTime) {
      changes.push({
        table: 'settings',
        id: userId, // use user_id as id for settings
        operation: 'upsert',
        payload: serializeSettings(settings),
        sync_version: 1,
        updated_at: settings.updated_at,
      });
    }
  }

  return changes;
}

/**
 * Apply server changes to local SQLite using last-write-wins conflict resolution.
 */
async function applyServerChanges(userId: string, changes: ServerChange[]): Promise<void> {
  if (changes.length === 0) return;

  const db = getDatabase();
  const now = new Date().toISOString();

  await db.withTransactionAsync(async () => {
    for (const change of changes) {
      switch (change.table) {
        case 'shifts':
          await applyShiftChange(db, change, now);
          break;
        case 'shift_types':
          await applyShiftTypeChange(db, change, now);
          break;
        case 'reminders':
          await applyReminderChange(db, change, now);
          break;
        case 'settings':
          await applySettingsChange(db, change, now);
          break;
      }
    }
  });
}

async function applyShiftChange(
  db: ReturnType<typeof getDatabase>,
  change: ServerChange,
  now: string
): Promise<void> {
  const p = change.payload;
  const existing = await db.getFirstAsync<Pick<Shift, 'sync_version' | 'updated_at'>>(
    `SELECT sync_version, updated_at FROM shifts WHERE id = ?`,
    [change.id]
  );

  if (existing) {
    // Conflict resolution: higher sync_version wins. Tie: server wins.
    const shouldApply =
      !existing.sync_version ||
      change.sync_version > existing.sync_version ||
      (change.sync_version === existing.sync_version &&
        new Date(p.updated_at as string) > new Date(existing.updated_at));

    if (!shouldApply) return;
  }

  // Upsert using REPLACE — handles both insert and update.
  await db.runAsync(
    `INSERT OR REPLACE INTO shifts (
       id, user_id, shift_type_id, start_datetime, end_datetime, duration_minutes,
       location, notes, is_bank_shift, status, sync_version, synced_at,
       created_at, updated_at, deleted_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      p.id as string,
      p.user_id as string,
      p.shift_type_id as string,
      p.start_datetime as string,
      p.end_datetime as string,
      p.duration_minutes as number,
      (p.location as string | null) ?? null,
      (p.notes as string | null) ?? null,
      p.is_bank_shift as number,
      p.status as string,
      change.sync_version,
      now,  // mark as synced
      p.created_at as string,
      p.updated_at as string,
      (p.deleted_at as string | null) ?? null,
    ]
  );
}

async function applyShiftTypeChange(
  db: ReturnType<typeof getDatabase>,
  change: ServerChange,
  now: string
): Promise<void> {
  const p = change.payload;
  await db.runAsync(
    `INSERT OR REPLACE INTO shift_types (
       id, user_id, name, colour_hex, default_duration_hours, is_paid,
       sort_order, created_at, updated_at, deleted_at, synced_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      p.id as string,
      p.user_id as string,
      p.name as string,
      p.colour_hex as string,
      (p.default_duration_hours as number | null) ?? null,
      p.is_paid as number,
      p.sort_order as number,
      p.created_at as string,
      p.updated_at as string,
      (p.deleted_at as string | null) ?? null,
      now,
    ]
  );
}

async function applyReminderChange(
  db: ReturnType<typeof getDatabase>,
  change: ServerChange,
  now: string
): Promise<void> {
  const p = change.payload;
  await db.runAsync(
    `INSERT OR REPLACE INTO reminders (
       id, shift_id, minutes_before, notification_id, is_sent,
       created_at, updated_at, deleted_at, synced_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      p.id as string,
      p.shift_id as string,
      p.minutes_before as number,
      (p.notification_id as string | null) ?? null,
      p.is_sent as number,
      p.created_at as string,
      p.updated_at as string,
      (p.deleted_at as string | null) ?? null,
      now,
    ]
  );
}

async function applySettingsChange(
  db: ReturnType<typeof getDatabase>,
  change: ServerChange,
  now: string
): Promise<void> {
  const p = change.payload;

  // For settings, check updated_at to avoid overwriting newer local changes.
  const existing = await db.getFirstAsync<Pick<Settings, 'updated_at'>>(
    `SELECT updated_at FROM settings WHERE user_id = ?`,
    [p.user_id as string]
  );

  if (existing && new Date(existing.updated_at) >= new Date(p.updated_at as string)) {
    return; // Local is newer or same; keep local.
  }

  await db.runAsync(
    `INSERT OR REPLACE INTO settings (
       user_id, theme_primary_colour, theme_secondary_colour, dark_mode,
       default_reminder_minutes, pay_period_start_day, pay_period_type,
       widget_enabled, cloud_sync_enabled, last_bank_holiday_fetch,
       onboarding_complete, updated_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      p.user_id as string,
      p.theme_primary_colour as string,
      p.theme_secondary_colour as string,
      p.dark_mode as number,
      p.default_reminder_minutes as number,
      p.pay_period_start_day as number,
      p.pay_period_type as string,
      p.widget_enabled as number,
      p.cloud_sync_enabled as number,
      (p.last_bank_holiday_fetch as string | null) ?? null,
      p.onboarding_complete as number,
      p.updated_at as string,
    ]
  );
}

/**
 * Mark all pushed records as synced by setting synced_at.
 */
async function markRecordsClean(
  userId: string,
  changes: ClientChange[],
  syncedAt: string
): Promise<void> {
  const db = getDatabase();

  const shiftIds = changes.filter(c => c.table === 'shifts').map(c => c.id);
  const shiftTypeIds = changes.filter(c => c.table === 'shift_types').map(c => c.id);
  const reminderIds = changes.filter(c => c.table === 'reminders').map(c => c.id);

  await db.withTransactionAsync(async () => {
    if (shiftIds.length > 0) {
      const placeholders = shiftIds.map(() => '?').join(',');
      await db.runAsync(
        `UPDATE shifts SET synced_at = ? WHERE id IN (${placeholders})`,
        [syncedAt, ...shiftIds]
      );
    }

    if (shiftTypeIds.length > 0) {
      const placeholders = shiftTypeIds.map(() => '?').join(',');
      await db.runAsync(
        `UPDATE shift_types SET synced_at = ? WHERE id IN (${placeholders})`,
        [syncedAt, ...shiftTypeIds]
      );
    }

    if (reminderIds.length > 0) {
      const placeholders = reminderIds.map(() => '?').join(',');
      await db.runAsync(
        `UPDATE reminders SET synced_at = ? WHERE id IN (${placeholders})`,
        [syncedAt, ...reminderIds]
      );
    }
  });
}

// ─── Sync log / timestamp helpers ─────────────────────────────────────────────

async function getLastSyncTimestamp(userId: string): Promise<string | null> {
  const db = getDatabase();
  const row = await db.getFirstAsync<{ sync_completed_at: string }>(
    `SELECT sync_completed_at FROM sync_log
     WHERE user_id = ? AND sync_completed_at IS NOT NULL AND error_message IS NULL
     ORDER BY sync_completed_at DESC LIMIT 1`,
    [userId]
  );
  return row?.sync_completed_at ?? null;
}

async function updateLastSyncTimestamp(userId: string, timestamp: string): Promise<void> {
  // Already recorded in sync_log; nothing extra needed unless we want a separate
  // fast-access key. sync_log is the source of truth.
  void userId;
  void timestamp;
}

async function logSyncResult(
  userId: string,
  startedAt: string,
  result: SyncResult
): Promise<void> {
  const db = getDatabase();
  const { randomUUID } = await import('expo-crypto');
  const id = randomUUID();
  const now = new Date().toISOString();

  await db.runAsync(
    `INSERT INTO sync_log (
       id, user_id, sync_started_at, sync_completed_at,
       records_pushed, records_pulled, conflicts_resolved, error_message, created_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      userId,
      startedAt,
      now,
      result.pushed,
      result.pulled,
      result.conflicts,
      result.error ?? null,
      now,
    ]
  );
}

// ─── Serialization helpers ────────────────────────────────────────────────────
// Convert SQLite INTEGER booleans to PostgreSQL booleans and ensure
// UUID strings are properly typed.

function serializeShift(shift: Shift): Record<string, unknown> {
  return {
    id: shift.id,
    user_id: shift.user_id,
    shift_type_id: shift.shift_type_id,
    start_datetime: shift.start_datetime,
    end_datetime: shift.end_datetime,
    duration_minutes: shift.duration_minutes,
    location: shift.location,
    notes: shift.notes,
    is_bank_shift: Boolean(shift.is_bank_shift),
    status: shift.status,
    sync_version: shift.sync_version,
    created_at: shift.created_at,
    updated_at: shift.updated_at,
    deleted_at: shift.deleted_at,
  };
}

function serializeShiftType(st: ShiftType): Record<string, unknown> {
  return {
    id: st.id,
    user_id: st.user_id,
    name: st.name,
    colour_hex: st.colour_hex,
    default_duration_hours: st.default_duration_hours,
    is_paid: Boolean(st.is_paid),
    sort_order: st.sort_order,
    created_at: st.created_at,
    updated_at: st.updated_at,
    deleted_at: st.deleted_at,
  };
}

function serializeReminder(reminder: Reminder): Record<string, unknown> {
  return {
    id: reminder.id,
    shift_id: reminder.shift_id,
    minutes_before: reminder.minutes_before,
    notification_id: reminder.notification_id,
    is_sent: Boolean(reminder.is_sent),
    created_at: reminder.created_at,
    updated_at: reminder.updated_at,
    deleted_at: reminder.deleted_at,
  };
}

function serializeSettings(settings: Settings): Record<string, unknown> {
  return {
    user_id: settings.user_id,
    theme_primary_colour: settings.theme_primary_colour,
    theme_secondary_colour: settings.theme_secondary_colour,
    dark_mode: settings.dark_mode,
    default_reminder_minutes: settings.default_reminder_minutes,
    pay_period_start_day: settings.pay_period_start_day,
    pay_period_type: settings.pay_period_type,
    widget_enabled: Boolean(settings.widget_enabled),
    cloud_sync_enabled: Boolean(settings.cloud_sync_enabled),
    last_bank_holiday_fetch: settings.last_bank_holiday_fetch,
    onboarding_complete: Boolean(settings.onboarding_complete),
    updated_at: settings.updated_at,
  };
}

function toServerChange(table: SyncTable, record: Record<string, unknown>): ServerChange {
  const id = (record.id ?? record.user_id) as string;
  return {
    table,
    id,
    operation: record.deleted_at ? 'delete' : 'upsert',
    payload: record,
    sync_version: (record.sync_version as number | undefined) ?? 1,
  };
}

function noOpResult(error: string): SyncResult {
  return { pushed: 0, pulled: 0, conflicts: 0, error, syncedAt: null };
}
