# MyShifts — Technical API Documentation

**Version:** 1.0.0  
**Date:** 2026-04-21

---

## Contents

1. [Overview](#1-overview)
2. [Local SQLite Schema](#2-local-sqlite-schema)
3. [Supabase PostgreSQL Schema](#3-supabase-postgresql-schema)
4. [Supabase REST API](#4-supabase-rest-api)
5. [Sync Edge Function](#5-sync-edge-function)
6. [Auth Flows](#6-auth-flows)
7. [External APIs](#7-external-apis)
8. [Row-Level Security](#8-row-level-security)

---

## 1. Overview

The app uses a **dual-database architecture**:

- **Local SQLite** (via `expo-sqlite` v14) — the source of truth. All reads and writes go here first.
- **Supabase PostgreSQL** (optional) — a cloud replica used for backup and cross-device sync.

All API communication is through Supabase's auto-generated PostgREST REST API plus one custom Edge Function (`/functions/v1/sync`).

Authentication uses Supabase Auth (optional). The app works fully without auth using a device-generated UUID as the local user identity.

---

## 2. Local SQLite Schema

### Design principles

- All tables include `created_at`, `updated_at`, `deleted_at` (soft delete pattern).
- All reads filter `WHERE deleted_at IS NULL`.
- `user_id` is a device-generated UUID (anonymous) or the Supabase Auth UID when signed in.
- `sync_version` is incremented on every local write; `synced_at IS NULL` marks a record as dirty (unsynced).

---

### `users`

```sql
CREATE TABLE users (
  id                TEXT PRIMARY KEY,    -- UUID (device or Supabase UID)
  email             TEXT,                -- NULL for anonymous users
  display_name      TEXT,
  nhs_trust         TEXT,
  job_role          TEXT,                -- see JobRole type
  contracted_hours  REAL,               -- weekly contracted hours (e.g. 37.5)
  created_at        DATETIME NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at        DATETIME NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  deleted_at        DATETIME
);
```

**`job_role` values:** `nurse_midwife` · `doctor` · `hca_porter` · `ahp` · `admin` · `other`

---

### `shift_types`

```sql
CREATE TABLE shift_types (
  id                      TEXT PRIMARY KEY,
  user_id                 TEXT NOT NULL,         -- FK → users.id
  name                    TEXT NOT NULL,         -- e.g. "Long Day"
  colour_hex              TEXT NOT NULL DEFAULT '#005EB8',
  default_duration_hours  REAL,                  -- e.g. 12.5
  is_paid                 INTEGER NOT NULL DEFAULT 1,  -- 0 = unpaid
  sort_order              INTEGER NOT NULL DEFAULT 0,
  created_at              DATETIME NOT NULL DEFAULT ...,
  updated_at              DATETIME NOT NULL DEFAULT ...,
  deleted_at              DATETIME,
  synced_at               DATETIME              -- NULL = not yet synced
);
```

**Default seed data (created on first launch):**

| Name | Colour | Duration | Paid |
|------|--------|----------|------|
| Long Day | `#005EB8` | 12.5h | Yes |
| Night | `#003087` | 12.5h | Yes |
| Short Day | `#41B6E6` | 7.5h | Yes |
| Early | `#41B6E6` | 7.5h | Yes |
| Late | `#768692` | 7.5h | Yes |
| Rest Day | `#E8EDEE` | 0h | No |
| Annual Leave | `#00A499` | 7.5h | Yes |
| Sick | `#DA291C` | 0h | Yes |
| Bank Holiday | `#FFB81C` | 0h | Yes |

---

### `shifts`

```sql
CREATE TABLE shifts (
  id                TEXT PRIMARY KEY,
  user_id           TEXT NOT NULL,         -- FK → users.id
  shift_type_id     TEXT NOT NULL,         -- FK → shift_types.id
  start_datetime    DATETIME NOT NULL,     -- ISO 8601 full datetime
  end_datetime      DATETIME NOT NULL,
  duration_minutes  INTEGER NOT NULL,      -- pre-computed for fast queries
  location          TEXT,
  notes             TEXT,
  is_bank_shift     INTEGER NOT NULL DEFAULT 0,  -- 1 = bank/agency shift
  status            TEXT NOT NULL DEFAULT 'scheduled'
                    CHECK (status IN (
                      'scheduled', 'in_progress', 'completed',
                      'cancelled', 'sick', 'annual_leave',
                      'swapped_out', 'swapped_in'
                    )),
  sync_version      INTEGER NOT NULL DEFAULT 1,
  synced_at         DATETIME,
  created_at        DATETIME NOT NULL DEFAULT ...,
  updated_at        DATETIME NOT NULL DEFAULT ...,
  deleted_at        DATETIME
);

CREATE INDEX idx_shifts_user_start ON shifts(user_id, start_datetime) WHERE deleted_at IS NULL;
CREATE INDEX idx_shifts_user_status ON shifts(user_id, status) WHERE deleted_at IS NULL;
CREATE INDEX idx_shifts_sync ON shifts(user_id, synced_at) WHERE deleted_at IS NULL;
```

**Hours calculation — statuses included in totals:**
```sql
WHERE status IN ('completed', 'in_progress', 'scheduled')
  AND shift_types.is_paid = 1
  AND shifts.deleted_at IS NULL
```

---

### `reminders`

```sql
CREATE TABLE reminders (
  id               TEXT PRIMARY KEY,
  shift_id         TEXT NOT NULL,   -- FK → shifts.id
  minutes_before   INTEGER NOT NULL,
  notification_id  TEXT,            -- Expo notification ID (device-local)
  is_sent          INTEGER NOT NULL DEFAULT 0,  -- 1 = delivered
  created_at       DATETIME NOT NULL DEFAULT ...,
  updated_at       DATETIME NOT NULL DEFAULT ...,
  deleted_at       DATETIME,
  synced_at        DATETIME
);
```

---

### `settings`

One row per user. `user_id` is the primary key.

```sql
CREATE TABLE settings (
  user_id                  TEXT PRIMARY KEY,
  theme_primary_colour     TEXT NOT NULL DEFAULT '#005EB8',
  theme_secondary_colour   TEXT NOT NULL DEFAULT '#003087',
  dark_mode                INTEGER NOT NULL DEFAULT 0,  -- 0=system, 1=dark, 2=light
  default_reminder_minutes INTEGER NOT NULL DEFAULT 120,
  pay_period_start_day     INTEGER NOT NULL DEFAULT 1,  -- ISO weekday: 1=Mon, 7=Sun
  pay_period_type          TEXT NOT NULL DEFAULT 'weekly'
                           CHECK (pay_period_type IN (
                             'weekly', 'fortnightly', 'monthly_4week', 'monthly_calendar'
                           )),
  widget_enabled           INTEGER NOT NULL DEFAULT 1,
  cloud_sync_enabled       INTEGER NOT NULL DEFAULT 0,
  last_bank_holiday_fetch  DATETIME,
  onboarding_complete      INTEGER NOT NULL DEFAULT 0,
  updated_at               DATETIME NOT NULL DEFAULT ...
);
```

---

### `bank_holidays`

Local cache of UK bank holidays fetched from GOV.UK API (refreshed every 30 days).

```sql
CREATE TABLE bank_holidays (
  id          TEXT PRIMARY KEY,
  date        TEXT NOT NULL UNIQUE,  -- YYYY-MM-DD
  name        TEXT NOT NULL,
  region      TEXT NOT NULL DEFAULT 'england-and-wales'
              CHECK (region IN ('england-and-wales', 'scotland', 'northern-ireland')),
  created_at  DATETIME NOT NULL DEFAULT ...
);
```

---

### `sync_log`

Audit trail for cloud sync operations.

```sql
CREATE TABLE sync_log (
  id                  TEXT PRIMARY KEY,
  user_id             TEXT NOT NULL,
  sync_started_at     DATETIME NOT NULL,
  sync_completed_at   DATETIME,
  records_pushed      INTEGER DEFAULT 0,
  records_pulled      INTEGER DEFAULT 0,
  conflicts_resolved  INTEGER DEFAULT 0,
  error_message       TEXT,   -- NULL = success
  created_at          DATETIME NOT NULL DEFAULT ...
);
```

---

## 3. Supabase PostgreSQL Schema

The Supabase schema mirrors the SQLite schema with these adaptations:

| SQLite type | PostgreSQL type |
|-------------|----------------|
| `TEXT` (UUID) | `uuid` with `gen_random_uuid()` default |
| `INTEGER` (boolean) | `boolean` |
| `DATETIME` | `timestamptz` |
| `REAL` | `numeric(5,2)` |

All tables have Row-Level Security enabled. An `updated_at` trigger auto-updates the timestamp on every row change.

Full migration script: [`supabase/migrations/20260421000001_initial_schema.sql`](../supabase/migrations/20260421000001_initial_schema.sql)

---

## 4. Supabase REST API

All standard CRUD is exposed automatically via PostgREST. Authentication uses a Supabase JWT in the `Authorization: Bearer <token>` header.

**Base URL:** `https://<project-ref>.supabase.co`

All requests require:
```
Authorization: Bearer <supabase_jwt>
apikey: <supabase_anon_key>
Content-Type: application/json
```

### Shifts

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/rest/v1/shifts?user_id=eq.{uid}&deleted_at=is.null&order=start_datetime.asc` | All active shifts |
| `GET` | `/rest/v1/shifts?start_datetime=gte.{from}&start_datetime=lte.{to}` | Shifts in date range |
| `POST` | `/rest/v1/shifts` | Create shift (supports bulk insert) |
| `PATCH` | `/rest/v1/shifts?id=eq.{id}` | Update shift |
| `PATCH` | `/rest/v1/shifts?id=eq.{id}` | Soft delete: set `{ "deleted_at": "<iso_timestamp>" }` |

### Shift types

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/rest/v1/shift_types?user_id=eq.{uid}&deleted_at=is.null` | All shift types |
| `POST` | `/rest/v1/shift_types` | Create shift type |
| `PATCH` | `/rest/v1/shift_types?id=eq.{id}` | Update shift type |

### Reminders

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/rest/v1/reminders?shift_id=eq.{shift_id}&deleted_at=is.null` | Reminders for a shift |
| `POST` | `/rest/v1/reminders` | Create reminder |
| `DELETE` | `/rest/v1/reminders?id=eq.{id}` | Hard delete |

### Settings

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/rest/v1/settings?user_id=eq.{uid}` | Fetch settings |
| `POST` | `/rest/v1/settings` | Insert settings (upsert) |
| `PATCH` | `/rest/v1/settings?user_id=eq.{uid}` | Update settings |

---

## 5. Sync Edge Function

### Endpoint

```
POST https://<project-ref>.supabase.co/functions/v1/sync
Authorization: Bearer <supabase_jwt>
Content-Type: application/json
```

A single round-trip bidirectional sync. The client sends its dirty records and last sync timestamp; the server returns records that changed since that timestamp.

### Request body

```json
{
  "client_changes": [
    {
      "table": "shifts",
      "id": "3f2d1a...",
      "operation": "upsert",
      "payload": {
        "id": "3f2d1a...",
        "user_id": "auth-uid...",
        "shift_type_id": "type-uuid...",
        "start_datetime": "2026-05-01T07:30:00Z",
        "end_datetime": "2026-05-01T20:00:00Z",
        "duration_minutes": 750,
        "location": "Ward 6",
        "notes": null,
        "is_bank_shift": false,
        "status": "scheduled",
        "sync_version": 2,
        "created_at": "2026-04-20T10:00:00Z",
        "updated_at": "2026-04-21T09:00:00Z",
        "deleted_at": null
      },
      "sync_version": 2,
      "updated_at": "2026-04-21T09:00:00Z"
    }
  ],
  "last_sync_at": "2026-04-20T08:00:00Z"
}
```

**`table`** — one of: `shifts` · `shift_types` · `reminders` · `settings`  
**`operation`** — `upsert` or `delete`  
**`last_sync_at`** — ISO 8601 timestamp of the last successful sync; `null` on first sync

### Response body

```json
{
  "server_changes": [
    {
      "table": "shifts",
      "id": "abc123...",
      "operation": "upsert",
      "payload": { ...shift fields },
      "sync_version": 3
    }
  ],
  "conflicts": [
    {
      "id": "conflicted-uuid...",
      "resolution": "server_wins",
      "winning_version": 4
    }
  ],
  "sync_timestamp": "2026-04-21T10:01:00Z"
}
```

### Conflict resolution

| Scenario | Resolution |
|----------|-----------|
| Server `sync_version` > client `sync_version` | Server wins |
| Same `sync_version`, server `updated_at` >= client `updated_at` | Server wins |
| Client `sync_version` > server `sync_version` | Client wins |

Conflicts are logged but not surfaced to the user in v1.0. The winning version is always applied silently.

### Error responses

| Status | Meaning |
|--------|---------|
| `400` | Invalid JSON body |
| `401` | Missing or invalid JWT |
| `403` | Change payload belongs to a different user |
| `405` | Only POST is accepted |
| `500` | Internal server error (logged in Edge Function logs) |

### Sync triggers (client-side)

The app calls this endpoint when:
- App comes to foreground
- Network reconnects (via NetInfo event)
- User taps "Sync Now" in Settings
- Every 15 minutes while the app is in the foreground

A lightweight dirty-push (direct Supabase REST upsert, no Edge Function) is used when the app is backgrounded.

---

## 6. Auth Flows

### Anonymous (default)

No network calls. A UUID is generated via `expo-crypto` and stored in `expo-secure-store`.

```
App first launch
  → randomUUID()
  → SecureStore.setItemAsync('nhs_shift_planner_device_user_id', uuid)
  → All SQLite records written with this UUID as user_id
```

### Sign up (cloud sync)

```
POST /auth/v1/signup
{
  "email": "user@example.com",
  "password": "...",
  "options": { "data": { "display_name": "Jane Smith" } }
}

→ Returns: { session, user }
→ JWT stored by Supabase client (SecureStore internally)
→ Local data migrated: device UUID → Supabase UID
```

### Sign in

```
POST /auth/v1/token?grant_type=password
{
  "email": "user@example.com",
  "password": "..."
}

→ Returns: { access_token, refresh_token, expires_at, user }
→ On success: migrateLocalDataToSupabaseUid(deviceUUID, supabaseUID)
```

**Local data migration** runs inside a single SQLite transaction:
1. `UPDATE shifts SET user_id = supabaseUid WHERE user_id = deviceUUID`
2. Same for `shift_types`, `settings`, `sync_log`
3. `UPDATE users SET id = supabaseUid WHERE id = deviceUUID`
4. `SecureStore.setItemAsync(DEVICE_USER_ID_KEY, supabaseUid)` — so future anonymous ID lookups return the Supabase UID

### Token refresh

The Supabase JS client auto-refreshes JWTs. Manual refresh:

```
POST /auth/v1/token?grant_type=refresh_token
{ "refresh_token": "..." }
```

On 401 error from any Supabase call: attempt refresh → if refresh fails, prompt re-login. Local data is unchanged; sync resumes after re-login.

### Sign out

```
POST /auth/v1/logout
Authorization: Bearer <access_token>
```

Local SQLite data is preserved. The device UUID continues to work as the local identity.

### Account deletion (GDPR right to erasure)

Client-side sequence:
1. Fetch all `shifts.id` for the user
2. Delete `reminders` by `shift_id IN (...)` 
3. Delete `shifts`, `shift_types`, `settings`, `sync_log` by `user_id`
4. Delete `users` row by `id`
5. Call `supabase.auth.signOut()`

> **Note:** Deleting the `auth.users` record itself requires a service_role Edge Function call (not yet implemented in v1.0). The auth account is signed out and all data is deleted; the auth record is cleaned up via Supabase's admin tooling or a scheduled cleanup.

---

## 7. External APIs

### GOV.UK Bank Holidays

```
GET https://www.gov.uk/bank-holidays.json
```

Returns bank holidays for England & Wales, Scotland, and Northern Ireland.

The app fetches this once and caches it locally in the `bank_holidays` table. Cache is refreshed if `settings.last_bank_holiday_fetch` is more than 30 days ago.

No API key required. No rate limits documented; the app fetches at most once per 30 days per user.

---

## 8. Row-Level Security

All Supabase tables have RLS enabled. Every policy uses `auth.uid()` to ensure users can only access their own data.

```sql
-- Users can only access their own row
CREATE POLICY "users: own row only" ON public.users
  FOR ALL USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- Shifts, shift_types, settings, sync_log
CREATE POLICY "shifts: own records only" ON public.shifts
  FOR ALL USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Reminders are linked to shifts, not directly to users
CREATE POLICY "reminders: own via shift" ON public.reminders
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.shifts s
      WHERE s.id = reminders.shift_id AND s.user_id = auth.uid()
    )
  );
```

The sync Edge Function uses the `service_role` key (bypasses RLS by design). It verifies the user's JWT independently before processing any changes, and validates that all payload `user_id` values match the authenticated user.

---

## TypeScript Types Reference

All types are defined in `src/types/index.ts`. Key types:

```typescript
type ShiftStatus =
  | 'scheduled' | 'in_progress' | 'completed' | 'cancelled'
  | 'sick' | 'annual_leave' | 'swapped_out' | 'swapped_in';

type PayPeriodType = 'weekly' | 'fortnightly' | 'monthly_4week' | 'monthly_calendar';

type DarkModePreference = 0 | 1 | 2;  // 0=system, 1=dark, 2=light

type JobRole = 'nurse_midwife' | 'doctor' | 'hca_porter' | 'ahp' | 'admin' | 'other';

interface Shift { /* matches SQLite schema */ }
interface ShiftType { /* matches SQLite schema */ }
interface Reminder { /* matches SQLite schema */ }
interface Settings { /* matches SQLite schema */ }

// Enriched view types (joined)
interface ShiftWithType extends Shift { shift_type: ShiftType; }
interface ShiftWithTypeAndReminders extends ShiftWithType { reminders: Reminder[]; }

// Hours calculation result
interface HoursSummary {
  total_minutes: number;
  bank_minutes: number;
  contracted_minutes: number | null;
  shifts: ShiftWithType[];
  breakdown: Array<{ type_name: string; colour_hex: string; minutes: number }>;
}
```
