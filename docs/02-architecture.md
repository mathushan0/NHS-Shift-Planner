# Architecture Document — NHS Shift Planner
**Version:** 1.0 MVP  
**Produced by:** Systems Architect Agent  
**Date:** 2026-04-21  
**Status:** Ready for Developer Handoff  
**Input:** Project Brief v1.0 + Raw Spec

---

## Table of Contents

1. [Architecture Decisions Summary](#1-architecture-decisions-summary)
2. [Tech Stack Selection & Justification](#2-tech-stack-selection--justification)
3. [System Architecture Diagram](#3-system-architecture-diagram)
4. [Database Schema](#4-database-schema)
5. [API Endpoint List](#5-api-endpoint-list)
6. [Authentication Approach](#6-authentication-approach)
7. [Offline-First Sync Strategy](#7-offline-first-sync-strategy)
8. [Notification Architecture](#8-notification-architecture)
9. [Widget Implementation](#9-widget-implementation)
10. [Infrastructure & Deployment Strategy](#10-infrastructure--deployment-strategy)
11. [Cost Estimate](#11-cost-estimate)
12. [Security & GDPR Considerations](#12-security--gdpr-considerations)
13. [Performance Requirements](#13-performance-requirements)
14. [Trade-offs](#14-trade-offs)
15. [Open Questions — Architect's Answers](#15-open-questions--architects-answers)

---

## 1. Architecture Decisions Summary

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Repo structure | Turborepo monorepo | Shared types, hooks, and utils across mobile + web |
| Expo workflow | **Bare workflow** | Widget support (P1) requires it; cannot use Expo Go |
| Web role | **Companion PWA** (not full port) | Limits scope to achievable; mobile is primary |
| Sync strategy | Timestamp last-write-wins + soft deletes | Simple, well-understood, sufficient for single-user |
| Auth mode | Optional Supabase Auth; anonymous-first | Core app must work with zero auth |
| Chart library | **Victory Native** | Better TypeScript support; more actively maintained |
| Local ID strategy | `expo-crypto` UUID on first launch | Stable device identity without requiring auth |
| Notifications | Local-scheduled only (Expo Notifications) | No backend push infrastructure needed for V1 |
| Cloud DB | Supabase PostgreSQL (EU region) | Free tier sufficient; row-level security; mirrors local schema |
| Bank holidays | GOV.UK API + local cache | Free, official source; cached on device |

---

## 2. Tech Stack Selection & Justification

The raw spec recommended: **React Native Expo + Next.js + SQLite + Supabase + Zustand**. This is confirmed with specific qualifications noted below.

### 2.1 Mobile — React Native (Expo Bare Workflow)

**Confirmed.** Expo provides the fastest path to iOS + Android from a single codebase.

**Critical change from spec:** Use **Expo bare workflow**, not managed workflow.

| Aspect | Managed Workflow | Bare Workflow (Chosen) |
|--------|-----------------|----------------------|
| Widget support (P1) | ❌ Not supported | ✅ Full native module access |
| Expo Go compatibility | ✅ Yes | ❌ Requires custom dev client |
| Native module flexibility | Limited | Full |
| Build system | EAS Build (cloud) | EAS Build (cloud) |
| Setup complexity | Low | Medium |
| Future-proofing | Risky if native features grow | Solid foundation |

**Verdict:** Bare workflow adds ~1 day of setup overhead but is mandatory for widgets and advisable for long-term flexibility. Use EAS Build for cloud builds — do not require devs to maintain local Xcode/Android Studio for CI.

### 2.2 Web — Next.js (PWA, Companion Scope)

**Confirmed with scope reduction.**

The spec is ambiguous about web parity. Architect's decision: **Web is a companion PWA, not a full feature port.**

**Web MVP scope:**
- Read-only calendar view (shifts synced from cloud)
- Hours summary display
- Shift add/edit form (basic)
- Settings (theme, pay period)

**Explicitly NOT on web:**
- Widgets
- Local push notifications (use web push if desired in V2)
- PDF/iCal export (mobile-only for V1)
- Offline-first SQLite (web uses Supabase directly; PGlite considered but deferred)

**Rationale:** NHS staff are mobile-primary. Web serves the "checking at a ward PC" use case — read-heavy, sync-dependent. Building full parity doubles scope for diminishing return.

**Next.js specifics:**
- App Router (Next.js 14+)
- Deployed as static export to Vercel free tier
- PWA via `next-pwa` (service worker for offline shell; data from Supabase, not SQLite)
- Shared `packages/core` layer with mobile (types, validation, date utilities)

### 2.3 Local Database — expo-sqlite (SQLite)

**Confirmed.** SQLite is the right choice: proven, zero-dependency, device-local, SQL-queryable.

Use `expo-sqlite` v14+ (new async API). Do not use the legacy synchronous API — it blocks the JS thread.

Supplement with **Drizzle ORM** (not specified in raw spec but strongly recommended):
- Type-safe queries
- Schema migration support (critical for app updates)
- Lightweight; no heavy ORM overhead
- Generates TypeScript types shared with Supabase layer

### 2.4 Cloud Sync — Supabase

**Confirmed.** Supabase is appropriate for MVP:
- PostgreSQL mirrors local SQLite schema
- Row-level security (RLS) ensures users only access their own data
- Supabase Auth handles optional login
- Realtime subscriptions available if multi-device sync needed later
- EU region available (Frankfurt — required for GDPR)
- Free tier: 500MB DB, 1GB storage, 50MB file uploads, 500K edge function invocations/month

### 2.5 State Management — Zustand

**Confirmed.** Zustand is lightweight, performant, and sufficient for this app's needs. No Redux.

Store slices:
- `shiftStore` — local shift state, CRUD operations
- `settingsStore` — user preferences
- `syncStore` — sync status, last-synced timestamps, error state
- `uiStore` — transient UI state (selected date, active modal, snackbar queue)

### 2.6 Charts — Victory Native

**Selected over react-native-chart-kit.**

| Criterion | Victory Native | react-native-chart-kit |
|-----------|---------------|----------------------|
| TypeScript support | ✅ Strong | ⚠️ Partial |
| Maintenance | ✅ Actively maintained (Formidable) | ⚠️ Slow updates |
| Customisation | ✅ High | ⚠️ Limited |
| Bundle size | ~180KB | ~120KB |
| Accessibility | ✅ SVG-based | ⚠️ Canvas-based |

SVG-based rendering is better for NHS-style high-contrast accessibility requirements.

### 2.7 Full Stack Summary

```
┌─────────────────────────────────────────────────────┐
│                  packages/core                      │
│  TypeScript types · Zustand stores · Drizzle schema │
│  Date utilities · Validation · NHS constants        │
└──────────────────┬──────────────────────────────────┘
                   │ shared
        ┌──────────┴──────────┐
        ▼                     ▼
┌───────────────┐    ┌────────────────┐
│  apps/mobile  │    │   apps/web     │
│  Expo (Bare)  │    │   Next.js 14   │
│  RN + Victory │    │   PWA + Vercel │
└───────────────┘    └────────────────┘
```

---

## 3. System Architecture Diagram

```
╔══════════════════════════════════════════════════════════════════════╗
║                        USER DEVICE (Mobile)                          ║
║                                                                      ║
║  ┌─────────────────────────────────────────────────────────────┐    ║
║  │                    React Native App (Expo Bare)              │    ║
║  │                                                             │    ║
║  │  ┌──────────────┐  ┌──────────────┐  ┌─────────────────┐  │    ║
║  │  │  UI Layer    │  │ Zustand Store│  │  Drizzle ORM    │  │    ║
║  │  │  (Screens,   │◄─►  (shiftStore │◄─►  (Query Builder) │  │    ║
║  │  │   Components)│  │  settingsStore│  │                 │  │    ║
║  │  │              │  │  syncStore)  │  └────────┬────────┘  │    ║
║  │  └──────┬───────┘  └──────────────┘           │           │    ║
║  │         │                                      ▼           │    ║
║  │         │                            ┌─────────────────┐   │    ║
║  │         │ Victory Native charts      │  expo-sqlite    │   │    ║
║  │         │ expo-print exports         │  (SQLite DB)    │   │    ║
║  │         │ expo-notifications         │  Source of Truth│   │    ║
║  │         │                            └────────┬────────┘   │    ║
║  │  ┌──────▼───────────────────────────┐         │           │    ║
║  │  │     Native Modules               │         │           │    ║
║  │  │  • Expo Notifications (local)    │         │           │    ║
║  │  │  • iOS Widget Extension          │         │           │    ║
║  │  │  • Android Glance Widget         │         │           │    ║
║  │  │  • expo-sharing / expo-print     │         │           │    ║
║  │  └──────────────────────────────────┘         │           │    ║
║  └─────────────────────────────────────────────┬─┘           ║
║                                                │              ║
║                                    [Sync Layer — optional]    ║
╚════════════════════════════════════════════════╪═════════════╝
                                                 │
                              (HTTPS / REST + Realtime WS)
                                                 │
╔════════════════════════════════════════════════▼═════════════╗
║                        SUPABASE (EU — Frankfurt)              ║
║                                                               ║
║  ┌──────────────┐  ┌───────────────┐  ┌──────────────────┐  ║
║  │  Auth        │  │  PostgreSQL   │  │  Edge Functions  │  ║
║  │  (optional)  │  │  (mirror of   │  │  (bank holiday   │  ║
║  │  email/oauth │  │  SQLite schema│  │   cache refresh) │  ║
║  └──────────────┘  └───────────────┘  └──────────────────┘  ║
║                                                               ║
║  Row-Level Security: user_id = auth.uid()                    ║
╚══════════════════════════════════════════════════════════════╝
                         │
                         │ (initial fetch + periodic refresh)
                         ▼
╔════════════════════════════════════════╗
║    GOV.UK Bank Holidays API           ║
║    https://www.gov.uk/bank-holidays   ║
║    (cached locally, free, official)   ║
╚════════════════════════════════════════╝

╔══════════════════════════════════════════════════════════════╗
║                   USER BROWSER (Web / Ward PC)               ║
║                                                              ║
║  ┌──────────────────────────────────────────────────────┐   ║
║  │          Next.js 14 PWA (Companion, Read-Heavy)      │   ║
║  │                                                      │   ║
║  │  • Calendar view (synced data)                       │   ║
║  │  • Hours summary                                     │   ║
║  │  • Basic shift add/edit                              │   ║
║  │  • Connects directly to Supabase (requires auth)     │   ║
║  └──────────────────────────────────────────────────────┘   ║
║                                                              ║
║  Deployed: Vercel (free tier)                                ║
╚══════════════════════════════════════════════════════════════╝
```

---

## 4. Database Schema

### 4.1 Design Principles

- Local SQLite is the **source of truth**; Supabase is a replica
- All tables include `created_at`, `updated_at`, `deleted_at` (soft delete pattern)
- `deleted_at IS NULL` filter applied on all reads
- `user_id` in local DB is a device-generated UUID (anonymous) or Supabase auth UID (when signed in)
- Drizzle ORM manages migrations; migration files committed to repo

### 4.2 Complete Schema

```sql
-- ─────────────────────────────────────────────
-- USERS (local shadow + Supabase mirror)
-- ─────────────────────────────────────────────
CREATE TABLE users (
  id                    TEXT PRIMARY KEY,          -- UUID (device-generated or Supabase UID)
  email                 TEXT,                      -- NULL for anonymous users
  display_name          TEXT,
  nhs_trust             TEXT,
  job_role              TEXT,
  contracted_hours      REAL,                      -- weekly contracted hours (e.g. 37.5)
  created_at            DATETIME NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at            DATETIME NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  deleted_at            DATETIME
);

-- ─────────────────────────────────────────────
-- SHIFT TYPES (extensible; seeded with defaults)
-- ─────────────────────────────────────────────
CREATE TABLE shift_types (
  id                    TEXT PRIMARY KEY,          -- UUID
  user_id               TEXT NOT NULL,             -- FK → users.id
  name                  TEXT NOT NULL,             -- e.g. "Long Day", "Night", "Short Day"
  colour_hex            TEXT NOT NULL DEFAULT '#005EB8',  -- NHS blue default
  default_duration_hours REAL,                     -- e.g. 12.5 for Long Day
  is_paid               INTEGER NOT NULL DEFAULT 1, -- 0 = unpaid (breaks, leave-in-lieu)
  sort_order            INTEGER NOT NULL DEFAULT 0, -- display ordering
  created_at            DATETIME NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at            DATETIME NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  deleted_at            DATETIME
);

-- Default seed data (applied on first launch):
-- Long Day    | #005EB8 | 12.5h | is_paid=1
-- Night       | #003087 | 12.5h | is_paid=1
-- Short Day   | #41B6E6 | 7.5h  | is_paid=1
-- Early       | #41B6E6 | 7.5h  | is_paid=1
-- Late        | #768692 | 7.5h  | is_paid=1
-- Rest Day    | #E8EDEE | 0h    | is_paid=0
-- Annual Leave| #00A499 | 7.5h  | is_paid=1
-- Sick        | #DA291C | 0h    | is_paid=1  (paid sick leave)
-- Bank Holiday| #FFB81C | 0h    | is_paid=1

-- ─────────────────────────────────────────────
-- SHIFTS (core table)
-- ─────────────────────────────────────────────
CREATE TABLE shifts (
  id                    TEXT PRIMARY KEY,          -- UUID
  user_id               TEXT NOT NULL,             -- FK → users.id
  shift_type_id         TEXT NOT NULL,             -- FK → shift_types.id
  start_datetime        DATETIME NOT NULL,         -- ISO 8601, full datetime (midnight-crossing safe)
  end_datetime          DATETIME NOT NULL,         -- ISO 8601, full datetime
  duration_minutes      INTEGER NOT NULL,          -- computed: (end - start) in minutes; stored for fast query
  location              TEXT,                      -- ward name, hospital, free text
  notes                 TEXT,
  is_bank_shift         INTEGER NOT NULL DEFAULT 0, -- 1 = bank/agency shift

  -- STATUS ENUM VALUES:
  -- 'scheduled'    — future shift, not yet started
  -- 'in_progress'  — shift currently ongoing (start <= now <= end)
  -- 'completed'    — shift finished; hours count toward totals
  -- 'cancelled'    — shift cancelled (excluded from hours calc)
  -- 'sick'         — called in sick (logged for records; handled by is_paid on shift_type)
  -- 'annual_leave' — leave logged against this slot
  -- 'swapped_out'  — gave shift away (excluded from hours; kept for audit)
  -- 'swapped_in'   — received extra shift (included in hours)
  status                TEXT NOT NULL DEFAULT 'scheduled'
                        CHECK (status IN (
                          'scheduled', 'in_progress', 'completed',
                          'cancelled', 'sick', 'annual_leave',
                          'swapped_out', 'swapped_in'
                        )),

  sync_version          INTEGER NOT NULL DEFAULT 1, -- incremented on each local update; used for conflict detection
  synced_at             DATETIME,                  -- last successful cloud sync timestamp; NULL = never synced

  created_at            DATETIME NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at            DATETIME NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  deleted_at            DATETIME                   -- soft delete; NULL = active
);

-- Indexes
CREATE INDEX idx_shifts_user_start ON shifts(user_id, start_datetime) WHERE deleted_at IS NULL;
CREATE INDEX idx_shifts_user_status ON shifts(user_id, status) WHERE deleted_at IS NULL;
CREATE INDEX idx_shifts_sync ON shifts(user_id, synced_at) WHERE deleted_at IS NULL;

-- ─────────────────────────────────────────────
-- REMINDERS
-- ─────────────────────────────────────────────
CREATE TABLE reminders (
  id                    TEXT PRIMARY KEY,          -- UUID
  shift_id              TEXT NOT NULL,             -- FK → shifts.id
  minutes_before        INTEGER NOT NULL,          -- e.g. 120 = 2 hours before
  notification_id       TEXT,                      -- Expo notification identifier (for cancellation)
  is_sent               INTEGER NOT NULL DEFAULT 0, -- 0 = pending, 1 = delivered
  created_at            DATETIME NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at            DATETIME NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  deleted_at            DATETIME
);

CREATE INDEX idx_reminders_shift ON reminders(shift_id) WHERE deleted_at IS NULL;

-- ─────────────────────────────────────────────
-- SETTINGS (one row per user)
-- ─────────────────────────────────────────────
CREATE TABLE settings (
  user_id               TEXT PRIMARY KEY,          -- FK → users.id
  theme_primary_colour  TEXT NOT NULL DEFAULT '#005EB8',  -- NHS Blue
  theme_secondary_colour TEXT NOT NULL DEFAULT '#003087',
  dark_mode             INTEGER NOT NULL DEFAULT 0, -- 0 = system, 1 = dark, 2 = light
  default_reminder_minutes INTEGER NOT NULL DEFAULT 120,  -- 2 hours default
  pay_period_start_day  INTEGER NOT NULL DEFAULT 1, -- ISO weekday: 1=Mon, 7=Sun
  pay_period_type       TEXT NOT NULL DEFAULT 'weekly'
                        CHECK (pay_period_type IN ('weekly', 'fortnightly', 'monthly_4week', 'monthly_calendar')),
  widget_enabled        INTEGER NOT NULL DEFAULT 1,
  cloud_sync_enabled    INTEGER NOT NULL DEFAULT 0,
  last_bank_holiday_fetch DATETIME,               -- for GOV.UK API cache invalidation
  onboarding_complete   INTEGER NOT NULL DEFAULT 0,
  updated_at            DATETIME NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- ─────────────────────────────────────────────
-- BANK HOLIDAYS (local cache)
-- ─────────────────────────────────────────────
CREATE TABLE bank_holidays (
  id                    TEXT PRIMARY KEY,          -- UUID
  date                  TEXT NOT NULL UNIQUE,      -- YYYY-MM-DD
  name                  TEXT NOT NULL,             -- e.g. "Christmas Day"
  region                TEXT NOT NULL DEFAULT 'england-and-wales'
                        CHECK (region IN ('england-and-wales', 'scotland', 'northern-ireland')),
  created_at            DATETIME NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX idx_bank_holidays_date ON bank_holidays(date);

-- ─────────────────────────────────────────────
-- SYNC LOG (audit trail for cloud sync events)
-- ─────────────────────────────────────────────
CREATE TABLE sync_log (
  id                    TEXT PRIMARY KEY,
  user_id               TEXT NOT NULL,
  sync_started_at       DATETIME NOT NULL,
  sync_completed_at     DATETIME,
  records_pushed        INTEGER DEFAULT 0,
  records_pulled        INTEGER DEFAULT 0,
  conflicts_resolved    INTEGER DEFAULT 0,
  error_message         TEXT,                      -- NULL = success
  created_at            DATETIME NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
```

### 4.3 Supabase PostgreSQL Mirror

The Supabase schema mirrors the SQLite schema with these adaptations:

- `TEXT` UUIDs → `uuid` type with `gen_random_uuid()` default
- `INTEGER` booleans → `boolean`
- `DATETIME` → `timestamptz`
- `CHECK` constraints identical
- Row-Level Security on all tables: `user_id = auth.uid()`
- `sync_version` and `synced_at` present (used in conflict resolution)

### 4.4 Hours Calculation Logic

```
Hours included in totals:
  WHERE status IN ('completed', 'in_progress', 'scheduled')
  AND shift_types.is_paid = 1
  AND shifts.deleted_at IS NULL

Hours excluded:
  status = 'cancelled' OR status = 'swapped_out'
  OR shift_types.is_paid = 0

Bank shift flag (is_bank_shift = 1):
  → Shown separately in hours breakdown ("Bank hours: X")
```

---

## 5. API Endpoint List

All API calls go through **Supabase's auto-generated REST API** (PostgREST) plus one custom Edge Function. No bespoke API server is needed for MVP.

Authentication: Supabase JWT in `Authorization: Bearer <token>` header.
Base URL: `https://<project-ref>.supabase.co`

### 5.1 Supabase REST (PostgREST)

All standard CRUD operations are exposed automatically. Key endpoints:

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/rest/v1/shifts?user_id=eq.{uid}&deleted_at=is.null&order=start_datetime.asc` | Fetch all active shifts |
| `GET` | `/rest/v1/shifts?start_datetime=gte.{from}&start_datetime=lte.{to}` | Fetch shifts in date range |
| `POST` | `/rest/v1/shifts` | Create shift(s) — supports bulk insert |
| `PATCH` | `/rest/v1/shifts?id=eq.{id}` | Update shift |
| `DELETE` | `/rest/v1/shifts?id=eq.{id}` | Hard delete (soft delete via PATCH deleted_at) |
| `GET` | `/rest/v1/shift_types?user_id=eq.{uid}` | Fetch user's shift types |
| `POST` | `/rest/v1/shift_types` | Create shift type |
| `PATCH` | `/rest/v1/shift_types?id=eq.{id}` | Update shift type |
| `GET` | `/rest/v1/reminders?shift_id=eq.{id}` | Fetch reminders for a shift |
| `POST` | `/rest/v1/reminders` | Create reminder(s) |
| `DELETE` | `/rest/v1/reminders?id=eq.{id}` | Delete reminder |
| `GET` | `/rest/v1/settings?user_id=eq.{uid}` | Fetch settings |
| `POST` | `/rest/v1/settings` | Upsert settings |
| `PATCH` | `/rest/v1/settings?user_id=eq.{uid}` | Update settings |

### 5.2 Sync Endpoint (Custom Edge Function)

```
POST /functions/v1/sync

Purpose: Bidirectional sync in a single round-trip.
         Reduces mobile data and handles conflict resolution server-side.

Request body:
{
  "client_changes": [
    {
      "table": "shifts",
      "id": "uuid",
      "operation": "upsert" | "delete",
      "payload": { ...shift fields },
      "sync_version": 3,
      "updated_at": "2026-04-21T10:00:00Z"
    }
  ],
  "last_sync_at": "2026-04-20T08:00:00Z"  // client's last known sync time
}

Response body:
{
  "server_changes": [
    {
      "table": "shifts",
      "id": "uuid",
      "operation": "upsert" | "delete",
      "payload": { ...shift fields },
      "sync_version": 4
    }
  ],
  "conflicts": [
    {
      "id": "uuid",
      "resolution": "server_wins" | "client_wins",
      "winning_version": 4
    }
  ],
  "sync_timestamp": "2026-04-21T10:01:00Z"
}

Conflict resolution rule: Higher sync_version wins.
Tie-break: server_updated_at > client_updated_at → server wins.
```

### 5.3 Auth Endpoints (Supabase Auth)

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/auth/v1/signup` | Register with email + password |
| `POST` | `/auth/v1/token?grant_type=password` | Sign in |
| `POST` | `/auth/v1/token?grant_type=refresh_token` | Refresh JWT |
| `POST` | `/auth/v1/logout` | Sign out |
| `DELETE` | `/auth/v1/user` | Delete account (GDPR right to erasure) |

### 5.4 External API

| Method | URL | Description |
|--------|-----|-------------|
| `GET` | `https://www.gov.uk/bank-holidays.json` | Bank holiday data (cached 30 days) |

---

## 6. Authentication Approach

### 6.1 Design Principles

- **Auth is optional.** The app must be fully functional with zero authentication.
- Local use is a first-class mode, not a fallback.
- Cloud sync requires auth; everything else does not.

### 6.2 Identity Lifecycle

```
First Launch
    │
    ▼
Generate device UUID (expo-crypto)
Store in SQLite users table + SecureStore
    │
    ▼
Anonymous local user created
    │
    ├─── [User never enables cloud sync] ──► App works forever; UUID is stable identity
    │
    └─── [User enables cloud sync]
              │
              ▼
         Supabase Auth flow
         (email + password; OAuth considered V2)
              │
              ▼
         Supabase UID replaces device UUID
         as user_id in all records (migration step)
              │
              ▼
         JWT stored in SecureStore
         Auto-refresh via Supabase client
```

### 6.3 Token Storage

- `expo-secure-store` for JWT and refresh token (hardware-backed on supported devices)
- Never stored in AsyncStorage or SQLite

### 6.4 PIN / Biometric Lock (P1)

Local app lock (not the same as auth) can be added in P1:
- `expo-local-authentication` for Face ID / Touch ID / PIN
- Does not affect cloud auth state
- Stored preference in `settings` table

### 6.5 Session Management

- Supabase client auto-refreshes JWT tokens
- On 401 error from Supabase: attempt refresh; if refresh fails, prompt re-login
- On re-login: sync is paused; local data unchanged; resumes after login
- Offline: all reads/writes to local SQLite; sync queued for when online

---

## 7. Offline-First Sync Strategy

### 7.1 Core Principle

> Local SQLite is always the source of truth. Cloud is a backup and cross-device mirror.

The app must never require a network call to function. Every read/write goes through SQLite first.

### 7.2 Sync Trigger Points

| Trigger | Action |
|---------|--------|
| App comes to foreground | Full incremental sync |
| Network reconnected (NetInfo event) | Full incremental sync |
| User manually taps "Sync Now" | Full sync |
| App backgrounded | Lightweight pending-changes push only |
| Interval (every 15 min, app in foreground) | Incremental sync |
| Widget refresh | Read-only SQLite; no sync triggered from widget |

### 7.3 Conflict Resolution

**Strategy: Higher sync_version wins, with timestamp tie-break.**

```
Local change made:
  → Increment local sync_version
  → Set synced_at = NULL (marks as dirty)
  → Write to SQLite immediately

Sync initiated:
  → Collect all records WHERE synced_at IS NULL (dirty records)
  → POST to /functions/v1/sync with dirty records + last_sync_at
  → Server returns server-side changes since last_sync_at
  → Apply server changes to local SQLite
  → Mark dirty records as synced (synced_at = now)

Conflict detected (same id, different sync_version):
  → Higher sync_version wins
  → Tie: server wins (simpler, predictable)
  → Log conflict in sync_log table
  → No user-facing conflict UI in V1 (inform via subtle notification in V1.1)
```

**Soft deletes:** `deleted_at` is set on delete. Sync propagates deletes as `deleted_at` updates, never hard deletes through sync. Hard deletes only on explicit "wipe all data" or account deletion.

### 7.4 Schema Migration Strategy

- Drizzle ORM migration files live in `apps/mobile/drizzle/`
- On app start, run pending migrations before any data access
- Migration history table: `drizzle_migrations` (managed by Drizzle)
- Remote schema (Supabase) migrations applied via `supabase db push` in CI/CD
- **Rule:** All schema changes must be backwards-compatible for at least one version (additive only; no drops until N+1)

### 7.5 Data Restoration

- "Restore from cloud" option in Settings → downloads all records for user_id and merges into local SQLite
- Handles reinstall scenario (local DB wiped, user logs back in)

---

## 8. Notification Architecture

### 8.1 Architecture

All notifications are **local-scheduled** via `expo-notifications`. No server-side push infrastructure required for V1. This means:

- No APNs/FCM server keys needed
- No notification backend
- No real-time delivery dependency
- Battery and privacy friendly

### 8.2 Notification Scheduling Flow

```
User saves a shift with reminder(s)
    │
    ▼
For each reminder (minutes_before):
  1. Calculate trigger_time = start_datetime - minutes_before
  2. If trigger_time is in the future:
       → Expo.scheduleNotificationAsync({
           content: {
             title: "Shift Reminder",
             body: "{shift_type} starts in {X} — {location}",
             data: { shiftId: "uuid" },
             sound: true,
             priority: 'high'
           },
           trigger: { date: trigger_time }
         })
       → Store returned notification_id in reminders table
  3. If trigger_time is in the past: skip scheduling; mark is_sent = 1
    │
    ▼
On notification tap:
  → Deep link to shift detail screen (shiftId from data payload)
```

### 8.3 Notification Content Templates

| Trigger | Title | Body |
|---------|-------|------|
| > 2 hours before | "Upcoming Shift" | "{type} starts in {X} hours — {location}" |
| 1–2 hours before | "Shift Starting Soon" | "{type} starts in {X} mins — {location}" |
| < 1 hour before | "⏰ Shift Alert" | "{type} starts in {X} mins — {location}" |

### 8.4 Permission Handling

```
First launch onboarding (step 3):
  → requestPermissionsAsync()
  → If granted: proceed normally
  → If denied:
      → Show yellow warning banner on Dashboard
      → Banner links to Linking.openSettings() (device notification settings)
      → Re-check on each app foreground (dismiss banner if granted later)
```

### 8.5 Rescheduling

When a shift is edited:
1. Cancel existing notifications: `Expo.cancelScheduledNotificationAsync(notification_id)` for all reminders
2. Delete reminders rows (soft delete)
3. Reschedule all reminders with new times
4. Update reminder rows with new notification_ids

### 8.6 Notification Limits

- iOS: Max 64 scheduled notifications per app
- Android: Higher limits but manufacturer-specific background killing (Samsung, Huawei, OnePlus)
- Strategy: Schedule reminders for the next 60 shifts only; reschedule on app open for future shifts
- Android: Prompt user to disable battery optimisation for app (documented in onboarding tip)

---

## 9. Widget Implementation

### 9.1 Decision: Expo Bare Workflow — CONFIRMED

**Widgets require Expo bare workflow. This is the correct choice for this project.**

Rationale:
- iOS widgets require a native Widget Extension target (Swift/SwiftUI), which Expo managed workflow does not support
- Android Glance widgets require a native Kotlin module
- `react-native-widget-extension` bridges this for iOS but requires native build access
- EAS Build supports bare workflow with no local Xcode/Android Studio requirement for devs

**Trade-off:** Expo Go compatibility is lost (use custom dev client instead). See §14.

### 9.2 iOS Widget (react-native-widget-extension)

- Library: `react-native-widget-extension` (npm)
- Widget sizes: Small (2×2) and Medium (4×2) only for V1
- Content: Next upcoming shift — type, time, location
- Data source: Shared App Group container (SQLite or flat JSON file written by main app)

```
Main App → writes widget_data.json to App Group container on:
  - App open
  - Any shift CRUD operation
  - Sync completion

Widget Extension → reads widget_data.json
Widget refresh: every 15 minutes (iOS WidgetKit timeline)
```

`widget_data.json` structure:
```json
{
  "next_shift": {
    "id": "uuid",
    "type_name": "Long Day",
    "type_colour": "#005EB8",
    "start_datetime": "2026-04-22T07:30:00Z",
    "end_datetime": "2026-04-22T20:00:00Z",
    "location": "Ward 6 — City Hospital",
    "is_bank_shift": false
  },
  "generated_at": "2026-04-21T10:00:00Z"
}
```

Widget UI (SwiftUI — minimal):
- Background: shift type colour (darkened to 80%)
- Top: "Next Shift" label
- Middle: shift type name + time (large, bold)
- Bottom: location (truncated to 1 line)
- Empty state: "No upcoming shifts 🎉"

### 9.3 Android Widget (Glance)

- Framework: Jetpack Compose Glance (via React Native native module)
- Same `widget_data.json` pattern via shared file in app data directory
- Refresh: `WorkManager` periodic task every 15 minutes
- Widget sizes: 4×2 cell grid (responsive via Glance modifiers)

### 9.4 Dev Client Setup

```bash
# Install Expo Dev Client
npx expo install expo-dev-client

# Build custom dev client (once, per platform)
eas build --profile development --platform ios
eas build --profile development --platform android

# Run dev server
npx expo start --dev-client
```

---

## 10. Infrastructure & Deployment Strategy

### 10.1 Repository Structure (Turborepo Monorepo)

```
nhs-shift-planner/
├── apps/
│   ├── mobile/              # Expo bare workflow (iOS + Android)
│   │   ├── ios/             # Native iOS project (gitignored binaries)
│   │   ├── android/         # Native Android project (gitignored binaries)
│   │   ├── src/
│   │   │   ├── screens/
│   │   │   ├── components/
│   │   │   ├── navigation/
│   │   │   └── native/      # widget bridge, notifications setup
│   │   └── drizzle/         # SQLite migration files
│   │
│   └── web/                 # Next.js 14 PWA
│       ├── app/             # App Router pages
│       ├── components/
│       └── public/
│
├── packages/
│   ├── core/                # Shared business logic
│   │   ├── types/           # TypeScript types (shift, user, settings, etc.)
│   │   ├── stores/          # Zustand store definitions
│   │   ├── utils/           # Date utils, NHS constants, validators
│   │   └── schema/          # Drizzle schema (source of truth for types)
│   │
│   └── ui/                  # Shared design tokens only (NOT components)
│       └── tokens.ts        # Colours, spacing, typography scale
│
├── supabase/
│   ├── migrations/          # Supabase SQL migrations
│   ├── functions/           # Edge functions (sync)
│   └── seed.sql
│
├── turbo.json
├── package.json
└── .github/workflows/
    ├── ci.yml               # Lint, type-check, test on PR
    ├── eas-build-ios.yml    # EAS Build trigger on merge to main
    └── eas-build-android.yml
```

### 10.2 CI/CD Pipeline

```
PR opened
  └─► GitHub Actions: lint + type-check + unit tests (vitest)

Merge to main
  └─► EAS Build: iOS + Android (EAS Build free tier: 30 builds/month)
  └─► Vercel: auto-deploy web app (on push to main)
  └─► Supabase: supabase db push (schema migrations, manual trigger)

TestFlight / Play Internal Track (automated via EAS Submit):
  └─► EAS Submit on successful EAS Build

App Store / Google Play release:
  └─► Manual promotion from TestFlight / Internal Track after QA sign-off
```

### 10.3 Environments

| Env | Mobile | Web | Supabase |
|-----|--------|-----|----------|
| Dev | Expo dev client + local Supabase | `next dev` | `supabase start` (local Docker) |
| Staging | EAS Build (preview profile) | Vercel preview URL | Supabase staging project |
| Production | EAS Build (production) → App Stores | Vercel production | Supabase production (EU) |

### 10.4 EAS Configuration

```json
// eas.json
{
  "cli": { "version": ">= 7.0.0" },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal"
    },
    "staging": {
      "distribution": "internal",
      "ios": { "simulator": false }
    },
    "production": {
      "autoIncrement": true
    }
  },
  "submit": {
    "production": {
      "ios": { "appleId": "...", "ascAppId": "..." },
      "android": { "serviceAccountKeyPath": "./keys/play-store.json" }
    }
  }
}
```

---

## 11. Cost Estimate

Target: **Free or near-free for MVP and early growth.**

### 11.1 Monthly Cost Breakdown

| Service | Free Tier | Paid Tier (if exceeded) | Expected MVP Usage |
|---------|-----------|------------------------|-------------------|
| **Supabase** | 500MB DB, 2GB bandwidth, 1GB storage | $25/month (Pro) | < 50MB DB at 1K users |
| **Vercel** (web) | Unlimited hobby deploys | $20/month (Pro) | Free tier sufficient |
| **EAS Build** | 30 builds/month | $99/month (Production) | ~15 builds/month |
| **EAS Submit** | Included | — | Free |
| **GitHub** | Free for public repos | $4/user/month (private) | Free (public or 1-2 devs) |
| **Apple Developer** | — | $99/year (one-time) | Required |
| **Google Play** | — | $25 one-time | Required |
| **GOV.UK API** | Free, no rate limits | — | Free |
| **Expo (hosting)** | N/A (bare workflow) | — | N/A |

### 11.2 Total MVP Cost

| Period | Cost |
|--------|------|
| Monthly operational | **$0** (all within free tiers) |
| One-time setup | **$124** (Apple $99 + Google Play $25) |
| Annual operational (1K users) | **~$0–$25** (Supabase may need Pro at scale) |

### 11.3 Scale Thresholds

| Metric | Free Tier Limit | Expected Crossover |
|--------|----------------|-------------------|
| Supabase DB size | 500MB | ~50K active users (10KB/user) |
| Supabase bandwidth | 5GB | ~5K active syncing users/month |
| Vercel bandwidth | 100GB | >500K page views/month |
| EAS builds | 30/month | Exceeds at active sprint pace |

**Recommendation:** Supabase Pro ($25/month) is the first realistic cost at 5K+ users. Budget $25/month at that point; revenue from freemium sync subscription would offset this.

---

## 12. Security & GDPR Considerations

### 12.1 Data Classification

| Data | Classification | Notes |
|------|---------------|-------|
| Shift times, types, locations | Personal (non-sensitive) | NHS workplace data; not clinical |
| User email | Personal | Optional; only with cloud sync |
| NHS Trust, job role | Personal | Optional; user-provided |
| Contracted hours | Personal | Financial implication; handle with care |
| Shift notes | Personal (potentially sensitive) | User-controlled; may contain clinical context |

**Key point:** This app is a personal organiser, not a clinical system. It does not process patient data. No special category data under GDPR Article 9. Standard personal data rules apply.

### 12.2 Data Storage

- **Local:** SQLite on device. Encrypted at rest by OS (iOS: Data Protection class "Protected Until First User Authentication"; Android: File-Based Encryption).
- **Cloud:** Supabase hosted in **EU (Frankfurt)** region. Data does not leave EEA.
- No third-party analytics SDKs that export personal data in V1.

### 12.3 Row-Level Security (Supabase)

```sql
-- Enable RLS on all tables
ALTER TABLE shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE shift_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE reminders ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

-- Policy: users can only access their own data
CREATE POLICY "shifts_own_user" ON shifts
  FOR ALL USING (user_id = auth.uid());

CREATE POLICY "shift_types_own_user" ON shift_types
  FOR ALL USING (user_id = auth.uid());
-- (repeat for all tables)
```

### 12.4 Secrets Management

- Supabase `anon` key: safe to bundle in app (RLS enforces access control)
- Supabase `service_role` key: **never bundled in app**; only in Edge Functions + CI/CD secrets
- EAS secrets for signing certificates and API keys
- Never commit secrets to git; use `.env.local` + EAS environment variables

### 12.5 GDPR Compliance Checklist

| Requirement | Implementation |
|-------------|---------------|
| Lawful basis | Legitimate interest (personal organiser); contract performance if paid tier |
| Data minimisation | Email only if cloud sync enabled; no PII required for core use |
| Right of access | Settings → "Export my data" (JSON dump of all user records) |
| Right to erasure | Settings → "Delete account" → Supabase account deletion + cascade delete all records |
| Data portability | PDF export + iCal export covers this |
| Privacy policy | Required before App Store submission; hosted on web |
| Cookie consent | Web: session cookies only for auth; no tracking cookies |
| Data breach notification | Supabase has breach notification procedures; document in ops runbook |
| Data retention | Define in settings: auto-delete shifts older than X years (default: no auto-delete) |
| Third party processors | Supabase (EU), Vercel (configurable region), EAS/Expo (builds only; no data access) |

### 12.6 Transport Security

- All Supabase API calls over HTTPS (TLS 1.3)
- Certificate pinning: not required for V1 (Supabase uses well-known CA)
- App Transport Security (iOS): enforced by default

### 12.7 NHS-Specific Notes

- App is **not** a medical device and must not claim clinical utility
- Avoid any copy implying the app is used for patient safety decisions
- If NHS Trust procurement is pursued later: IG Toolkit assessment, DSP Toolkit compliance, potential DCB0129 if clinical workflow adjacent
- For V1 consumer app: standard GDPR + App Store data practices compliance is sufficient

---

## 13. Performance Requirements

### 13.1 App Launch

| Metric | Target | Notes |
|--------|--------|-------|
| Cold start to interactive | < 2 seconds | Hermes engine; lazy screen loading |
| Warm start (from background) | < 500ms | React Navigation state preserved |
| Splash screen duration | < 1 second | Then animate to dashboard |

### 13.2 Database Query Performance

| Query | Target | Implementation |
|-------|--------|---------------|
| Fetch shifts for month | < 50ms | Index on `(user_id, start_datetime)` |
| Hours calculation (monthly) | < 100ms | SQL aggregation; no JS loops |
| Search / filter shifts | < 100ms | SQLite FTS5 if needed (V1.1) |
| Write new shift | < 30ms | Single insert; async API |

### 13.3 Sync Performance

| Metric | Target | Notes |
|--------|--------|-------|
| Incremental sync (< 10 changes) | < 2 seconds | Single round-trip to Edge Function |
| Full restore (100 shifts) | < 10 seconds | Batch insert; show progress indicator |
| Conflict resolution | < 500ms additional | Server-side; no user input required |

### 13.4 UI Performance

| Metric | Target |
|--------|--------|
| Calendar scroll / month navigation | 60 FPS (no jank) |
| Shift list render (50 items) | < 16ms per frame (FlatList with `getItemLayout`) |
| Form input response | < 16ms (no input lag) |
| Chart render (hours summary) | < 500ms |

### 13.5 Notification Reliability

| Metric | Target |
|--------|--------|
| Local notification delivery | ≥ 98% (when permissions granted + app not force-killed by OS) |
| Scheduling accuracy | ± 30 seconds of scheduled time |
| Max scheduled notifications | 60 (iOS limit: 64; keep 4 as buffer) |

### 13.6 Offline Resilience

- All core features functional with network unavailable
- Network status detected via `@react-native-community/netinfo`
- Offline banner appears within 2 seconds of connection loss
- Sync queue survives app restart (persisted in SQLite `sync_log`)

### 13.7 Bundle Size

| Platform | Target | Notes |
|----------|--------|-------|
| iOS IPA | < 30MB | Hermes bytecode; no large assets |
| Android APK | < 25MB | Split APKs by ABI |
| Web initial JS bundle | < 200KB gzipped | Code-split by route |

---

## 14. Trade-offs

### 14.1 Bare Workflow vs Managed Workflow

**Decision: Bare workflow**

| | Managed | Bare (chosen) |
|-|---------|--------------|
| Dev experience | Simpler | Slightly more complex |
| Expo Go | ✅ Works | ❌ Requires dev client |
| Widgets | ❌ | ✅ |
| Native modules | Limited | Full access |
| OTA updates | ✅ (Expo Updates) | ✅ (Expo Updates still works) |
| Long-term flexibility | Lower | Higher |

**Why accepted:** Widgets are a P1 feature with strong user value (habit-forming, reduces missed shifts). Starting in managed workflow and migrating later is high-risk (significant refactor). Better to pay the setup cost once.

**Mitigation:** EAS Build eliminates the need for local Xcode/Android Studio. Dev client build takes ~20 minutes on EAS, then devs use it like Expo Go.

### 14.2 Web as Companion vs Full Port

**Decision: Companion PWA**

Building full feature parity on web would roughly double the frontend scope (custom notification system, iCal handling in browser, PDF generation, offline SQLite via PGlite). For a team of 1–2, this is a project killer.

**Trade-off accepted:** Web users cannot use widgets or local notifications. They can view/edit shifts and check hours if they have cloud sync enabled. This is the 80% case for the "ward PC" use case.

**Future path:** PGlite (PostgreSQL in WASM) could bring offline-first SQLite to the web in V2 without requiring cloud sync for web users.

### 14.3 Last-Write-Wins vs Full CRDT Sync

**Decision: Last-write-wins (LWW) with sync_version**

A full CRDT (Conflict-free Replicated Data Type) system (e.g. Automerge, Yjs) would handle multi-device concurrent edits gracefully. However:
- NHS staff typically use one primary device
- Shifts are discrete entities, not collaborative documents
- LWW is simple to understand, debug, and explain to users
- CRDTs add significant complexity for minimal benefit at V1 scale

**Trade-off accepted:** In the rare case a user edits the same shift on two offline devices simultaneously, one version is silently overwritten. This is acceptable for a personal shift tracker.

### 14.4 Victory Native vs react-native-chart-kit

**Decision: Victory Native**

Larger bundle size (+60KB) accepted in exchange for:
- TypeScript safety
- SVG rendering (accessibility, screenshot-clean)
- Better NHS-grade visual customisation
- Active maintenance

### 14.5 Supabase vs Custom Backend

**Decision: Supabase**

A custom Node.js/Fastify backend would give more control but requires:
- Server deployment + maintenance
- Auth system implementation
- Database management
- SSL certificates

Supabase provides all of this free for MVP scale. The only trade-off is vendor dependency; mitigated by the fact that Supabase is open-source and self-hostable if required.

### 14.6 expo-sqlite vs WatermelonDB

WatermelonDB offers lazy loading and is optimised for React Native performance with large datasets. However:
- Shifts dataset is small (< 5,000 rows for any realistic user)
- expo-sqlite v14+ async API is performant for this scale
- Drizzle ORM provides type safety that WatermelonDB lacks
- Simpler tech stack = faster development

**Trade-off accepted:** If a user accumulates 10+ years of shifts, query performance may degrade slightly. Acceptable.

---

## 15. Open Questions — Architect's Answers

Addressing all 10 open questions from the Project Brief handoff notes:

| # | Question | Architect's Answer |
|---|----------|-------------------|
| 1 | Is web a full feature port or lightweight companion? | **Companion PWA.** Read-heavy, sync-dependent. No widgets, no local notifications, no offline SQLite. See §2.2 and §14.2. |
| 2 | Do widgets force bare Expo workflow — is that acceptable? | **Yes, and bare workflow is the right choice.** Confirmed. See §9.1 and §14.1. |
| 3 | What are the `shifts.status` ENUM values? | **Defined:** `scheduled`, `in_progress`, `completed`, `cancelled`, `sick`, `annual_leave`, `swapped_out`, `swapped_in`. See §4.2. |
| 4 | What constitutes the pay period? | **Architect default: configurable.** `settings.pay_period_type` supports `weekly`, `fortnightly`, `monthly_4week`, `monthly_calendar`. NHS AfC is typically 4-weekly; make this user-selectable in onboarding. Default: `weekly`. Escalate to product owner for final confirmation. |
| 5 | Are there multiple NHS Trust colour schemes to support? | **No for V1.** Single NHS Blue (#005EB8) default with user-customisable theme colour. Trust-specific branding is a B2B V2 feature. |
| 6 | UK bank holidays only, or Wales/Scotland/NI variants? | **England & Wales default; Scotland and NI as selectable options.** GOV.UK API returns all three regions. `bank_holidays.region` field supports all three. User selects their region in settings (default: England & Wales). |
| 7 | What success metrics / KPIs does the product owner want? | **Use Project Brief's proposed defaults** (D7 retention ≥ 60%, ≥ 4.2 rating, 1K users in 3 months). Implement lightweight local event logging (no external analytics SDK in V1 — GDPR safe). Add Supabase-based anonymous funnel tracking in V1.1 with consent. |
| 8 | Who owns the App Store / Google Play developer accounts? | **Stakeholder action required.** Mathu or the business entity must own these. Architect cannot unblock this. Required before TestFlight/Play Console. Budget: Apple $99/year, Google $25 one-time. |
| 9 | Is there a design system / Figma file, or is the spec the design brief? | **Assume spec is the design brief.** Build with NHS brand tokens (§12.7) + WCAG AA. If a Figma file exists, it supersedes the spec for UI decisions. Recommend creating a minimal Figma component library as part of Phase 0. |
| 10 | What is the data retention / deletion policy for cloud sync users? | **Proposed default:** No automatic deletion. User controls deletion explicitly via Settings → Delete Account (cascades all data). Archive option (mark shifts as archived, exclude from main views) deferred to V1.1. Document 30-day grace period before hard deletion after account deletion request (allows accidental recovery). |

---

## Appendix A — NHS Brand Colour Reference

| Token | Hex | Usage |
|-------|-----|-------|
| `nhs-blue` | `#005EB8` | Primary, calendar highlights, CTAs |
| `nhs-dark-blue` | `#003087` | Night shifts, dark backgrounds |
| `nhs-light-blue` | `#41B6E6` | Short Day, Early shifts |
| `nhs-aqua-green` | `#00A499` | Annual leave, positive states |
| `nhs-red` | `#DA291C` | Sick shifts, errors, destructive actions |
| `nhs-yellow` | `#FFB81C` | Warnings (notification denied banner) |
| `nhs-warm-yellow` | `#FFB81C` | Bank holidays |
| `nhs-mid-grey` | `#768692` | Late shifts, secondary text |
| `nhs-pale-grey` | `#E8EDEE` | Rest days, backgrounds |
| `nhs-black` | `#231F20` | Body text |
| `nhs-white` | `#FFFFFF` | Backgrounds, contrast |

Source: NHS Identity Guidelines (confirm against current NHS Digital brand pack before final UI build).

---

## Appendix B — Dependency List

```json
// Key production dependencies (packages/apps level)
{
  // Mobile (apps/mobile)
  "expo": "~52.0.0",
  "expo-sqlite": "~15.0.0",
  "expo-notifications": "~0.29.0",
  "expo-secure-store": "~14.0.0",
  "expo-crypto": "~13.0.0",
  "expo-print": "~13.0.0",
  "expo-sharing": "~12.0.0",
  "expo-local-authentication": "~15.0.0",
  "react-native-widget-extension": "latest",
  "@react-native-community/netinfo": "^11.0.0",
  "victory-native": "^41.0.0",

  // Web (apps/web)
  "next": "14.x",
  "next-pwa": "^5.6.0",

  // Shared (packages/core)
  "drizzle-orm": "^0.30.0",
  "drizzle-kit": "^0.21.0",
  "zustand": "^5.0.0",
  "@supabase/supabase-js": "^2.0.0",
  "zod": "^3.22.0",          // validation (shared)
  "date-fns": "^3.0.0",     // date utilities

  // Monorepo
  "turbo": "^2.0.0"
}
```

---

*Architecture Document produced by Systems Architect Agent. Ready for Developer Agent handoff. All open questions addressed; stakeholder actions flagged in §15.*
