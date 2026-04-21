import * as SQLite from 'expo-sqlite';

let _db: SQLite.SQLiteDatabase | null = null;

export function getDatabase(): SQLite.SQLiteDatabase {
  if (!_db) {
    throw new Error('Database not initialized. Call initializeDatabase() first.');
  }
  return _db;
}

const CREATE_TABLES_SQL = `
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;

  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT,
    display_name TEXT,
    nhs_trust TEXT,
    job_role TEXT,
    contracted_hours REAL,
    created_at DATETIME NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    updated_at DATETIME NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    deleted_at DATETIME
  );

  CREATE TABLE IF NOT EXISTS shift_types (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    colour_hex TEXT NOT NULL DEFAULT '#005EB8',
    default_duration_hours REAL,
    is_paid INTEGER NOT NULL DEFAULT 1,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    updated_at DATETIME NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    deleted_at DATETIME,
    synced_at DATETIME
  );

  CREATE TABLE IF NOT EXISTS shifts (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    shift_type_id TEXT NOT NULL,
    start_datetime DATETIME NOT NULL,
    end_datetime DATETIME NOT NULL,
    duration_minutes INTEGER NOT NULL,
    location TEXT,
    notes TEXT,
    is_bank_shift INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'scheduled'
      CHECK (status IN (
        'scheduled', 'in_progress', 'completed',
        'cancelled', 'sick', 'annual_leave',
        'swapped_out', 'swapped_in'
      )),
    sync_version INTEGER NOT NULL DEFAULT 1,
    synced_at DATETIME,
    created_at DATETIME NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    updated_at DATETIME NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    deleted_at DATETIME
  );

  CREATE INDEX IF NOT EXISTS idx_shifts_user_start
    ON shifts(user_id, start_datetime) WHERE deleted_at IS NULL;

  CREATE INDEX IF NOT EXISTS idx_shifts_user_status
    ON shifts(user_id, status) WHERE deleted_at IS NULL;

  CREATE TABLE IF NOT EXISTS reminders (
    id TEXT PRIMARY KEY,
    shift_id TEXT NOT NULL,
    minutes_before INTEGER NOT NULL,
    notification_id TEXT,
    is_sent INTEGER NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    updated_at DATETIME NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    deleted_at DATETIME,
    synced_at DATETIME
  );

  CREATE INDEX IF NOT EXISTS idx_reminders_shift
    ON reminders(shift_id) WHERE deleted_at IS NULL;

  CREATE TABLE IF NOT EXISTS settings (
    user_id TEXT PRIMARY KEY,
    theme_primary_colour TEXT NOT NULL DEFAULT '#005EB8',
    theme_secondary_colour TEXT NOT NULL DEFAULT '#003087',
    dark_mode INTEGER NOT NULL DEFAULT 0,
    default_reminder_minutes INTEGER NOT NULL DEFAULT 120,
    pay_period_start_day INTEGER NOT NULL DEFAULT 1,
    pay_period_type TEXT NOT NULL DEFAULT 'weekly',
    widget_enabled INTEGER NOT NULL DEFAULT 1,
    cloud_sync_enabled INTEGER NOT NULL DEFAULT 0,
    last_bank_holiday_fetch DATETIME,
    onboarding_complete INTEGER NOT NULL DEFAULT 0,
    updated_at DATETIME NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  );

  CREATE TABLE IF NOT EXISTS bank_holidays (
    id TEXT PRIMARY KEY,
    date TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    region TEXT NOT NULL DEFAULT 'england-and-wales',
    created_at DATETIME NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  );

  CREATE INDEX IF NOT EXISTS idx_bank_holidays_date ON bank_holidays(date);

  CREATE TABLE IF NOT EXISTS sync_log (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    sync_started_at DATETIME NOT NULL,
    sync_completed_at DATETIME,
    records_pushed INTEGER DEFAULT 0,
    records_pulled INTEGER DEFAULT 0,
    conflicts_resolved INTEGER DEFAULT 0,
    error_message TEXT,
    created_at DATETIME NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  );

  CREATE INDEX IF NOT EXISTS idx_sync_log_user
    ON sync_log(user_id, sync_completed_at);
`;

const DEFAULT_SHIFT_TYPES = [
  { name: 'Long Day',     colour_hex: '#005EB8', default_duration_hours: 12.5, is_paid: 1, sort_order: 0 },
  { name: 'Night',        colour_hex: '#003087', default_duration_hours: 12.5, is_paid: 1, sort_order: 1 },
  { name: 'Short Day',    colour_hex: '#41B6E6', default_duration_hours: 7.5,  is_paid: 1, sort_order: 2 },
  { name: 'Early',        colour_hex: '#41B6E6', default_duration_hours: 7.5,  is_paid: 1, sort_order: 3 },
  { name: 'Late',         colour_hex: '#768692', default_duration_hours: 7.5,  is_paid: 1, sort_order: 4 },
  { name: 'Rest Day',     colour_hex: '#E8EDEE', default_duration_hours: 0,    is_paid: 0, sort_order: 5 },
  { name: 'Annual Leave', colour_hex: '#00A499', default_duration_hours: 7.5,  is_paid: 1, sort_order: 6 },
  { name: 'Sick',         colour_hex: '#DA291C', default_duration_hours: 0,    is_paid: 1, sort_order: 7 },
  { name: 'Bank Holiday', colour_hex: '#FFB81C', default_duration_hours: 0,    is_paid: 1, sort_order: 8 },
];

export async function initializeDatabase(userId: string): Promise<SQLite.SQLiteDatabase> {
  const db = await SQLite.openDatabaseAsync('nhs_shift_planner.db');
  _db = db;

  await db.execAsync(CREATE_TABLES_SQL);

  // ── Schema migrations for existing installs ──────────────────────────────
  // SQLite does not support IF NOT EXISTS on ALTER TABLE ADD COLUMN.
  // We attempt each column addition and silently ignore "duplicate column" errors.
  const alterations: string[] = [
    'ALTER TABLE shift_types ADD COLUMN synced_at DATETIME',
    'ALTER TABLE reminders ADD COLUMN synced_at DATETIME',
    'ALTER TABLE shifts ADD COLUMN sync_version INTEGER NOT NULL DEFAULT 1',
    'ALTER TABLE shifts ADD COLUMN synced_at DATETIME',
  ];
  for (const sql of alterations) {
    try {
      await db.runAsync(sql);
    } catch {
      // Column already exists — safe to ignore.
    }
  }

  // Seed default shift types if user has none
  const count = await db.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) as count FROM shift_types WHERE user_id = ? AND deleted_at IS NULL',
    [userId]
  );

  if (!count || count.count === 0) {
    const { randomUUID } = await import('expo-crypto');
    for (const st of DEFAULT_SHIFT_TYPES) {
      const id = randomUUID();
      await db.runAsync(
        `INSERT INTO shift_types (id, user_id, name, colour_hex, default_duration_hours, is_paid, sort_order)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [id, userId, st.name, st.colour_hex, st.default_duration_hours, st.is_paid, st.sort_order]
      );
    }
  }

  // Ensure settings row exists
  await db.runAsync(
    `INSERT OR IGNORE INTO settings (user_id) VALUES (?)`,
    [userId]
  );

  return db;
}
