# Changelog

All notable changes to MyShifts are documented here.

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).  
Versioning follows [Semantic Versioning](https://semver.org/).

---

## [1.0.0] — 2026-04-21

Initial release. 🎉

### Added

#### Core shift management
- Add, edit, and delete shifts with type, date, start/end time, location, notes, and bank shift flag
- Midnight-crossing shift support — correct duration calculation for overnight shifts
- Duplicate/overlap detection warning (overridable)
- Undo delete via 5-second snackbar
- Eight default shift types: Long Day, Night, Short Day, Early, Late, Rest Day, Annual Leave, Sick
- Custom shift types — add your own with a name, colour, and default duration
- Shift statuses: `scheduled`, `in_progress`, `completed`, `cancelled`, `sick`, `annual_leave`, `swapped_out`, `swapped_in`

#### Calendar
- Monthly calendar view with colour-coded dots per shift type
- UK bank holiday display (England & Wales, Scotland, Northern Ireland via GOV.UK API)
- Tap any date to see that day's shifts

#### Dashboard / Home
- Today's shift summary
- Week strip showing the next 7 days
- Upcoming shifts list (next 5)
- Floating action button for quick shift entry

#### Hours summary
- Daily, weekly, and pay-period hour totals
- Contracted vs worked comparison (if contracted hours entered during onboarding)
- Bank shift hours tracked separately
- Breakdown by shift type with colour chart
- Configurable pay period: weekly, fortnightly, 4-weekly, or monthly calendar

#### Local push notifications
- One or more reminders per shift (15 min, 30 min, 1 hour, 2 hours before)
- Notifications automatically rescheduled on shift edit
- Reminders cancelled on shift deletion
- Yellow warning banner when notification permissions are denied, with deep link to device settings
- Notification tap navigates directly to shift detail

#### Offline-first local storage
- All data stored in SQLite via `expo-sqlite` — no internet required
- App fully functional with no network connection
- Offline indicator banner

#### Export
- PDF export of shifts for a chosen date range, via `expo-print` + `expo-sharing`

#### Onboarding
- Three-step onboarding on first launch: profile setup, notification permissions, ready screen
- No login or account required to use the app

#### Settings
- Dark mode: system / always dark / always light
- Theme colour customisation
- Pay period type and start day configuration
- Default reminder time
- Bank holiday region selection
- Shift type management (add, edit, reorder)
- Account setup (name, NHS trust, job role, contracted hours)

#### Cloud sync (optional)
- Supabase-backed cloud backup — off by default
- Email + password account creation
- Bidirectional incremental sync via Edge Function
- Conflict resolution: higher `sync_version` wins; server wins on tie
- Restore from cloud on reinstall or new device
- Local data migrated from anonymous device UUID to Supabase UID on first sign-in
- Account deletion with full cloud data erasure (GDPR right to erasure)

#### Accessibility & design
- App brand colours as defaults
- High-contrast shift type colours
- Support for system dynamic text sizing
- Portrait-only layout

#### Developer / infrastructure
- Expo bare workflow (required for widget support in v1.1)
- EAS Build with three profiles: development, preview, production
- GitHub Actions CI pipeline: lint, TypeScript checks, tests on every PR
- Automated TestFlight deployment on merge to `main`
- Supabase PostgreSQL schema with Row-Level Security on all tables
- `updated_at` auto-trigger on all Supabase tables
- Full SQL migration at `supabase/migrations/20260421000001_initial_schema.sql`

---

## Known issues in v1.0.0

- Home screen widget not yet available — planned for v1.1 (requires native widget extension build setup)
- iCal / Google Calendar export not yet available — planned for v1.1
- Android not yet submitted to Google Play — iOS only in this release
- Account deletion does not remove the Supabase `auth.users` record (data rows are deleted; auth record requires manual cleanup via Supabase dashboard)
- No in-app conflict notification when a sync conflict is resolved silently

---

## Upcoming — v1.1 (planned)

- Home screen widget (iOS WidgetKit + Android Glance)
- iCal / Google Calendar export and import
- CSV export
- Multiple device support improvements
- In-app sync conflict notification
- Sentry crash reporting

---

[1.0.0]: https://github.com/your-username/myshifts/releases/tag/v1.0.0
