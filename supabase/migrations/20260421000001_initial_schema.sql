-- ═══════════════════════════════════════════════════════════════════════════
-- NHS Shift Planner — Initial Supabase Schema
-- Migration: 20260421000001_initial_schema
--
-- This mirrors the SQLite schema with PostgreSQL adaptations:
--   TEXT UUIDs  →  uuid
--   INTEGER booleans  →  boolean
--   DATETIME  →  timestamptz
--   CHECK constraints preserved
--
-- Row-Level Security is enabled on every table.
-- Users can only access records where user_id = auth.uid().
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── Extensions ───────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─── USERS ────────────────────────────────────────────────────────────────────
-- Shadow of the local users table.
-- id is the Supabase auth.uid() (UUID), not a sequence.

CREATE TABLE IF NOT EXISTS public.users (
  id                    uuid          PRIMARY KEY,
  email                 text,
  display_name          text,
  nhs_trust             text,
  job_role              text,
  contracted_hours      numeric(5,2),
  created_at            timestamptz   NOT NULL DEFAULT now(),
  updated_at            timestamptz   NOT NULL DEFAULT now(),
  deleted_at            timestamptz
);

COMMENT ON TABLE public.users IS 'User profile data. id = auth.uid().';

-- ─── SHIFT TYPES ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.shift_types (
  id                      uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                 uuid          NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  name                    text          NOT NULL,
  colour_hex              text          NOT NULL DEFAULT '#005EB8',
  default_duration_hours  numeric(4,2),
  is_paid                 boolean       NOT NULL DEFAULT true,
  sort_order              integer       NOT NULL DEFAULT 0,
  created_at              timestamptz   NOT NULL DEFAULT now(),
  updated_at              timestamptz   NOT NULL DEFAULT now(),
  deleted_at              timestamptz,
  synced_at               timestamptz,
  sync_version            integer       NOT NULL DEFAULT 1
);

CREATE INDEX IF NOT EXISTS idx_shift_types_user
  ON public.shift_types(user_id)
  WHERE deleted_at IS NULL;

COMMENT ON TABLE public.shift_types IS 'Extensible shift type catalogue per user.';

-- ─── SHIFTS ───────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.shifts (
  id                uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           uuid          NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  shift_type_id     uuid          NOT NULL REFERENCES public.shift_types(id) ON DELETE RESTRICT,
  start_datetime    timestamptz   NOT NULL,
  end_datetime      timestamptz   NOT NULL,
  duration_minutes  integer       NOT NULL,
  location          text,
  notes             text,
  is_bank_shift     boolean       NOT NULL DEFAULT false,
  status            text          NOT NULL DEFAULT 'scheduled'
                    CHECK (status IN (
                      'scheduled', 'in_progress', 'completed',
                      'cancelled', 'sick', 'annual_leave',
                      'swapped_out', 'swapped_in'
                    )),
  sync_version      integer       NOT NULL DEFAULT 1,
  synced_at         timestamptz,
  created_at        timestamptz   NOT NULL DEFAULT now(),
  updated_at        timestamptz   NOT NULL DEFAULT now(),
  deleted_at        timestamptz
);

CREATE INDEX IF NOT EXISTS idx_shifts_user_start
  ON public.shifts(user_id, start_datetime)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_shifts_user_status
  ON public.shifts(user_id, status)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_shifts_sync_dirty
  ON public.shifts(user_id, synced_at)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_shifts_updated_at
  ON public.shifts(user_id, updated_at DESC);

COMMENT ON TABLE public.shifts IS 'Core shift records. Soft-deleted via deleted_at.';

-- ─── REMINDERS ────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.reminders (
  id                uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  shift_id          uuid          NOT NULL REFERENCES public.shifts(id) ON DELETE CASCADE,
  minutes_before    integer       NOT NULL,
  notification_id   text,         -- Expo notification ID (iOS-only, not useful on server)
  is_sent           boolean       NOT NULL DEFAULT false,
  created_at        timestamptz   NOT NULL DEFAULT now(),
  updated_at        timestamptz   NOT NULL DEFAULT now(),
  deleted_at        timestamptz,
  synced_at         timestamptz
);

CREATE INDEX IF NOT EXISTS idx_reminders_shift
  ON public.reminders(shift_id)
  WHERE deleted_at IS NULL;

COMMENT ON TABLE public.reminders IS 'Shift reminder records. notification_id is device-local.';

-- ─── SETTINGS ─────────────────────────────────────────────────────────────────
-- One row per user. user_id is the primary key.

CREATE TABLE IF NOT EXISTS public.settings (
  user_id                   uuid          PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  theme_primary_colour      text          NOT NULL DEFAULT '#005EB8',
  theme_secondary_colour    text          NOT NULL DEFAULT '#003087',
  dark_mode                 smallint      NOT NULL DEFAULT 0  -- 0=system, 1=dark, 2=light
                            CHECK (dark_mode IN (0, 1, 2)),
  default_reminder_minutes  integer       NOT NULL DEFAULT 120,
  pay_period_start_day      smallint      NOT NULL DEFAULT 1  -- ISO weekday: 1=Mon, 7=Sun
                            CHECK (pay_period_start_day BETWEEN 1 AND 7),
  pay_period_type           text          NOT NULL DEFAULT 'weekly'
                            CHECK (pay_period_type IN (
                              'weekly', 'fortnightly', 'monthly_4week', 'monthly_calendar'
                            )),
  widget_enabled            boolean       NOT NULL DEFAULT true,
  cloud_sync_enabled        boolean       NOT NULL DEFAULT false,
  last_bank_holiday_fetch   timestamptz,
  onboarding_complete       boolean       NOT NULL DEFAULT false,
  updated_at                timestamptz   NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.settings IS 'Per-user app settings. Single row per user.';

-- ─── SYNC LOG ─────────────────────────────────────────────────────────────────
-- Audit trail for sync operations. Useful for debugging.

CREATE TABLE IF NOT EXISTS public.sync_log (
  id                  uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             uuid          NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  sync_started_at     timestamptz   NOT NULL,
  sync_completed_at   timestamptz,
  records_pushed      integer       DEFAULT 0,
  records_pulled      integer       DEFAULT 0,
  conflicts_resolved  integer       DEFAULT 0,
  error_message       text,
  created_at          timestamptz   NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sync_log_user
  ON public.sync_log(user_id, sync_completed_at DESC);

COMMENT ON TABLE public.sync_log IS 'Audit log for cloud sync operations.';

-- ─── Updated-at trigger ───────────────────────────────────────────────────────
-- Auto-update updated_at on every row change.

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER trg_users_updated_at
  BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE TRIGGER trg_shift_types_updated_at
  BEFORE UPDATE ON public.shift_types
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE TRIGGER trg_shifts_updated_at
  BEFORE UPDATE ON public.shifts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE TRIGGER trg_reminders_updated_at
  BEFORE UPDATE ON public.reminders
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE TRIGGER trg_settings_updated_at
  BEFORE UPDATE ON public.settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ═══════════════════════════════════════════════════════════════════════════
-- ROW-LEVEL SECURITY
-- All tables locked down: users can only read/write their own data.
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE public.users         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shift_types   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shifts        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reminders     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sync_log      ENABLE ROW LEVEL SECURITY;

-- ── users ──
CREATE POLICY "users: own row only"
  ON public.users
  FOR ALL
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- ── shift_types ──
CREATE POLICY "shift_types: own records only"
  ON public.shift_types
  FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ── shifts ──
CREATE POLICY "shifts: own records only"
  ON public.shifts
  FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ── reminders ──
-- Reminders don't have a direct user_id; access is via the parent shift.
CREATE POLICY "reminders: own via shift"
  ON public.reminders
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.shifts s
      WHERE s.id = reminders.shift_id
        AND s.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.shifts s
      WHERE s.id = reminders.shift_id
        AND s.user_id = auth.uid()
    )
  );

-- ── settings ──
CREATE POLICY "settings: own row only"
  ON public.settings
  FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ── sync_log ──
CREATE POLICY "sync_log: own records only"
  ON public.sync_log
  FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ═══════════════════════════════════════════════════════════════════════════
-- SERVICE ROLE BYPASS
-- The sync Edge Function uses the service_role key and needs to bypass RLS
-- to handle server-side conflict resolution. RLS bypass is automatic for
-- service_role — no policy needed.
-- ═══════════════════════════════════════════════════════════════════════════
