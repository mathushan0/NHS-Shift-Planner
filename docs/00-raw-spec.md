# MyShifts — Raw Product Specification

## Product Vision
NHS staff work across multiple rotations, wards, and contracted hours. Shifts arrive via paper rotas, emails, WhatsApp, and departmental systems — none of which talk to each other. Staff lose track of hours, miss shift reminders, and struggle to calculate pay. This app puts every shift in one free, purpose-built place.

## App Identity
- Version: 1.0 MVP
- Target Users: NHS Staff
- Cost Model: Free to Use
- Platforms: iOS, Android, Web

## 3 Critical Jobs-to-Be-Done
1. **Know My Schedule** — See all upcoming shifts at a glance
2. **Get Reminded in Time** — Alert before shift starts
3. **Know My Hours** — Track hours worked to verify pay and avoid overtime breaches

## User Roles (MVP)
- **Staff (Standard User):** Any NHS employee. Can add/edit/delete own shifts, view hours summary, customise app, set reminders. Cannot view other users' shifts or approve timesheets.
- **Admin (V2 only):** Ward manager, HR coordinator. Push shift templates, view team rotas, export hours.

## 5 Essential Screens
1. **Dashboard/Calendar** — Today's shift + week-at-a-glance, tap shift for details
2. **Add/Edit Shift** — Shift type, date, start/end time, ward/location, notes
3. **Hours Summary** — Hours worked this week/month/pay period, breakdown by shift type
4. **Reminders & Settings** — Notification lead time, widget toggle, theme
5. **Shift History** — Past shifts, filter by date/type, export to PDF/CSV

## Edge Cases
- **No Internet:** Fully offline via SQLite. Syncs when reconnected. Offline banner shown.
- **Notifications Denied:** Yellow banner with link to device settings.
- **Midnight-Crossing Shifts:** Full datetimes stored (not just times).
- **Widget Stale Data:** Refreshes every 15 min + on app open.
- **Accidental Delete:** Bottom-sheet confirmation + 5-second undo snackbar.
- **Duplicate Shift:** Overlap warning shown, user can override.

## Tech Stack
- **Mobile:** React Native (Expo) — single codebase iOS + Android
- **Web:** React (Next.js) — shared components, PWA
- **Local DB:** SQLite via expo-sqlite — offline-first
- **Cloud Sync:** Supabase (PostgreSQL) — optional, free tier
- **Auth:** Supabase Auth or local PIN — optional
- **Notifications:** Expo Notifications — local scheduled
- **State:** Zustand — lightweight
- **Widget:** react-native-widget-extension (iOS) / Glance (Android)
- **Charts:** Victory Native / react-native-chart-kit
- **Export:** expo-print + expo-sharing

## MVP (MoSCoW)

### MUST HAVE
- Add, edit, delete shifts (date, start/end time, type, location)
- Calendar view (monthly + weekly)
- Shift detail view
- Local notification reminders (customisable lead time)
- Hours calculator (daily, weekly, monthly)
- Offline-first local storage
- Night/Day shift type differentiation
- Basic theme customisation
- Duplicate/overlap detection warning
- Undo delete (5-second snackbar)

### SHOULD HAVE
- Home screen widget (next shift)
- Cloud backup (Supabase)
- Export shifts to PDF
- Export/import to iCal/Google Calendar
- Pay period hours summary
- Shift notes/comments
- Multiple reminder times
- Shift templates (Long Day, Night, Short Day)
- Bank holiday awareness

### COULD HAVE
- Annual leave tracking
- Overtime calculator
- Sick day logging
- Dark mode toggle
- Hours breakdown by ward/department
- CSV export
- Colour-code shifts by type
- Shift swap request logging
- NHS banding/pay rate estimator

### WON'T HAVE IN V1
- Admin team rota management
- In-app messaging/shift swap
- NHS Login integration
- Payslip verification
- Multi-employer profiles
- Apple Watch support
- AI-generated rota optimisation

## Core Workflows

### Adding a New Shift
1. Open app → Dashboard with today's date and next shift
2. Tap "+" → Bottom-sheet form (type, date, start/end, ward, notes)
3. Fill in details → Select from dropdown, native pickers
4. Overlap check → Warning if conflict, user can override
5. Save → Local DB, notification scheduled, appears on calendar

### Checking Hours
1. Tap "Hours" tab → Current week total prominent
2. Toggle period → This Month view with bar chart
3. View breakdown → List of shifts with date, type, duration
4. Export → PDF or CSV

### Shift Reminder
1. Notification fires → "Your Long Day shift starts in 2 hours — Ward 6, City Hospital"
2. Tap → Deep-links to specific shift detail screen
3. See full shift info → Time, location, notes, duration

## Database Schema

### shifts (core table)
- id (UUID PK)
- user_id (UUID FK)
- shift_type_id (UUID FK)
- start_datetime (DATETIME)
- end_datetime (DATETIME)
- duration_minutes (INTEGER)
- location (TEXT)
- notes (TEXT)
- is_bank_shift (BOOLEAN)
- status (ENUM)
- created_at, updated_at, deleted_at (TIMESTAMP)

### shift_types
- id (UUID PK), user_id (FK), name, colour_hex, default_duration_hours, is_paid

### reminders
- id (UUID PK), shift_id (FK), minutes_before, notification_id, is_sent

### settings
- user_id (PK/FK), theme colours, dark_mode, default_reminder_minutes, pay_period_start_day, widget_enabled, cloud_sync_enabled

### users (optional, for cloud sync)
- id (UUID PK), email, display_name, nhs_trust, job_role, contracted_hours, created_at

## UI/UX Design Direction
- Clean, clinical-but-warm
- Primary colour: NHS blue
- High contrast for hospital lighting
- Minimum 44px tap targets (gloves/hurry)
- System fonts only
- No decorative complexity

## Screen Details

### Splash/Onboarding (first launch only)
- Logo, 3-step carousel, "Get Started" CTA
- Notification permission requested here
- No login required

### Dashboard (Home)
- Greeting, today's date, Next Shift Hero Card
- Week strip calendar (Mon-Sun)
- Upcoming shifts list (next 5)
- "+" FAB, bottom tab bar
- States: empty, no shift today ("Day off 🎉"), shift in progress (pulsing green dot)

### Calendar View
- Full monthly grid, colour dots per shift type
- Month navigation, selected day's shifts below
- Bank holidays grey, rest days "R", today NHS blue

### Add/Edit Shift Form
- Fields: type dropdown, date picker, start/end time, auto-calc duration, location with suggestions, bank shift toggle, notes, reminder
- Validation: end after start, date required, overlap warning, live duration calc

### Hours Summary
- Period toggle: Week/Month/Pay Period
- Big number total, vs contracted hours
- Bar chart, shift list below
