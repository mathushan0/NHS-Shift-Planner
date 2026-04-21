# QA Report — NHS Shift Planner
**Produced by:** QA Engineer Agent  
**Date:** 2026-04-21  
**Reviewed against:** Project Brief v1.0 (01-project-brief.md)  
**Verdict:** ⛔ REVISION REQUIRED

---

## Executive Summary

The codebase is well-structured with a clear architecture, strong TypeScript typing, proper RLS on all Supabase tables, and solid SQLite offline-first implementation. However, **one crash-level bug** (broken import on startup) and **four major issues** block launch. Minor issues are logged for post-launch or next sprint.

---

## P0 Feature Coverage — Pass/Fail

| P0 Feature | Status | Notes |
|---|---|---|
| Add / Edit / Delete shifts | ✅ PASS | Full CRUD in AddEditShiftScreen + shiftRepository |
| Calendar view (monthly + weekly) | ✅ PASS | CalendarScreen + WeekStrip implemented |
| Shift detail view | ✅ PASS | ShiftDetailScreen complete with all fields |
| Local push notification reminders | ✅ PASS | notifications.ts fully implemented |
| Hours calculator | ✅ PASS | hoursCalculator.ts + HoursSummaryScreen complete |
| Offline-first local storage | ✅ PASS | SQLite via expo-sqlite; db.ts well structured |
| Night/Day shift type differentiation | ✅ PASS | Default shift types seeded in db.ts |
| Duplicate/overlap detection warning | ✅ PASS | checkOverlap + BannerAlert in AddEditShiftScreen |
| Undo delete | ⚠️ PARTIAL | Snackbar + undo works but reminders not restored (see MAJOR-02) |
| Basic theme customisation | ✅ PASS | Dark/Light/System in SettingsScreen |
| Dashboard / Home screen | ✅ PASS | DashboardScreen with HeroCard, WeekStrip, FAB, tabs |
| Splash / Onboarding (3-step) | ✅ PASS | Welcome → Setup → Permissions → Done |
| Midnight-crossing shift support | ✅ PASS | end <= start → +1 day logic in AddEditShiftScreen |
| Notifications denied handling | ⚠️ PARTIAL | Status shown in Settings but no dashboard banner or deep link (see MAJOR-03) |

---

## Issues Found

### 🔴 CRITICAL

---

#### CRIT-01 — App crashes on startup: broken `initDatabase` import
**File:** `App.tsx` line 8, 28  
**Agent:** `frontend-dev`

`App.tsx` imports and calls `initDatabase()` but `src/database/db.ts` only exports `initializeDatabase(userId)`. This import will resolve to `undefined` at runtime, and calling it will throw immediately — the app will never boot.

```ts
// App.tsx (BROKEN)
import { initDatabase } from './src/database/db';   // ← doesn't exist
await initDatabase();                                // ← crashes

// db.ts (ACTUAL export)
export async function initializeDatabase(userId: string): Promise<SQLite.SQLiteDatabase>
```

**Fix required:** Update `App.tsx` to import and call `initializeDatabase(FIXED_USER_ID)`, or export a no-argument `initDatabase` wrapper from `db.ts` that uses the hardcoded user ID. The `userId` must be passed at call site.

---

### 🟠 MAJOR

---

#### MAJOR-01 — Missing ESLint, Jest, and test dependencies in `package.json`
**File:** `package.json` devDependencies  
**Agent:** `devops-engineer`

The CI workflow runs `npm run lint` and `npm test` but the required packages are absent from `devDependencies`:
- `eslint` (and any React Native ESLint plugin)
- `jest` / `jest-expo`
- `@testing-library/react-native`
- `babel-jest`

`npm ci` will succeed but `npm run lint` and `npm test` will fail with command-not-found errors. No tests exist (`--passWithNoTests` suppresses the test failure but coverage will be 0%).

**Fix required:** Add `eslint`, `jest-expo`, `@testing-library/react-native`, and related packages to `devDependencies`. Add at least one smoke test to validate bootstrap.

---

#### MAJOR-02 — Undo Delete does not restore reminders or reschedule notifications
**File:** `src/stores/shiftStore.ts` lines 136–142  
**Agent:** `frontend-dev`

`undoDeleteShift` directly issues a SQL `UPDATE shifts SET deleted_at = NULL` but does not:
1. Un-soft-delete the reminders rows (`reminders.deleted_at` stays set)
2. Reschedule the Expo notifications that were cancelled on delete

After an undo, the shift appears in the UI but all reminders are permanently lost. This violates the P0 undo-delete spec ("5-second snackbar").

```ts
// Current (incomplete)
undoDeleteShift: async (shift: Shift) => {
  const db = (await import('../database/db')).getDatabase();
  await db.runAsync(`UPDATE shifts SET deleted_at = NULL ...`, [...]);
  // ← Missing: restore reminders + reschedule notifications
},
```

**Fix required:** After restoring the shift, also un-soft-delete its reminders and call `scheduleShiftReminders` to restore notifications.

---

#### MAJOR-03 — Notification denied: no dashboard banner or deep link to device settings
**File:** `src/screens/DashboardScreen.tsx`  
**Agent:** `frontend-dev`

The Project Brief explicitly requires: *"Notifications denied handling — Yellow banner → device settings deep link"*. The `notificationsGranted` state exists in `uiStore` and is shown as text in Settings, but:
- No banner appears on the Dashboard when notifications are denied
- No `Linking.openSettings()` or `Linking.openURL('app-settings:')` deep link exists anywhere in the codebase

Users who deny notifications have no visible prompt to re-enable them.

**Fix required:** In `DashboardScreen`, add a `BannerAlert` (variant `warning`) when `notificationsGranted === false`. Include a CTA that calls `Linking.openSettings()` to open device notification settings. Also check permission status on app foreground (not just at onboarding).

---

#### MAJOR-04 — Contracted hours not persisted: `setContractedHours` and `setDisplayName` are memory-only
**Files:** `src/stores/settingsStore.ts` lines 65–70; `src/screens/SettingsScreen.tsx` `handleSaveProfile`  
**Agent:** `frontend-dev`

Two data persistence bugs in `settingsStore`:

1. `setContractedHours(hours)` only updates the Zustand in-memory state; it never calls `settingsRepo.updateSettings`. On app restart, contracted hours reverts to null. The Hours Summary screen consequently can never show a persistent contracted-hours baseline.

2. `setDisplayName(name)` similarly only updates in-memory state. The display name is lost on restart.

The SettingsScreen's `handleSaveProfile` calls `setDisplayName` but never calls `updateSettings({ contracted_hours: ... })`.

**Fix required:**
- `setContractedHours`: persist via `settingsRepo.updateSettings(userId, { contracted_hours: hours })`
- `setDisplayName`: persist via a `users` table update (or store display_name in the settings row)
- `handleSaveProfile`: also save contracted hours to DB when saving profile

---

### 🟡 MINOR

---

#### MINOR-01 — Sync Edge Function: reminders fetched without user scoping (data leak risk)
**File:** `supabase/functions/sync/index.ts` `fetchServerChanges` for `reminders` table  
**Agent:** `backend-dev`

The reminders query fetches all reminders updated since `cutoff` with no `user_id` filter. A comment acknowledges this and says "filter client-side" but the subsequent code does NOT filter by user — all updated reminders across all users are returned. The function then sends them all to the client.

```ts
// Current: no user scoping on reminders
query = query.gte('updated_at', cutoff);   // ← all users!
```

**Fix required:** Join reminders to shifts to filter by user: add `.in('shift_id', userShiftIds)` or use a view/RPC. At minimum, filter the `data` array by the user's shift IDs before including in `serverChanges`.

---

#### MINOR-02 — Calendar: midnight-crossing shifts may not display on correct day
**File:** `src/database/repositories/shiftRepository.ts` `getShiftsForDateRange`  
**Agent:** `frontend-dev`

The date range query filters `start_datetime >= startDate AND start_datetime <= endDate`. A shift starting at 22:00 on the last day of a calendar month that crosses midnight into the next month will not appear on that last calendar day if the calendar only loads the month range. This is an edge case but relevant for night-shift workers.

**Fix required:** Consider also including shifts where `end_datetime` falls within the range (i.e., `OR end_datetime BETWEEN startDate AND endDate`).

---

#### MINOR-03 — `getWeekLabels` has unused variable
**File:** `src/utils/dateUtils.ts` line in `getWeekLabels`  
**Agent:** `frontend-dev`

```ts
const d = addWeeks(startDate, i);   // ← computed but never used
labels.push(`W${i + 1}`);
```

This will trigger an ESLint `no-unused-vars` error. Remove `d`.

---

#### MINOR-04 — `DashboardScreen` notification bell navigates to wrong screen
**File:** `src/screens/DashboardScreen.tsx` line ~105  
**Agent:** `frontend-dev`

The bell icon's `onPress` calls `navigation.navigate('ShiftDetail' as any)` with no `shiftId` param. This would crash or show "Shift not found." The bell should either navigate to notification settings or be removed.

---

#### MINOR-05 — `SettingsScreen` `historyBtn` tap target below 44px minimum
**File:** `src/screens/SettingsScreen.tsx`  
**Agent:** `frontend-dev`

```ts
historyBtn: { minHeight: 36 ... }   // ← 36px, below the 44px NHS/accessibility minimum
```

Per spec: *"Minimum 44px tap targets — gloves + urgency use cases."* Raise to `minHeight: 44`.

Similarly, the `headerBtn` in `HoursSummaryScreen` is `minHeight: 36`.

---

#### MINOR-06 — `FIXED_USER_ID = 'local-user-1'` hardcoded in 5 screens
**Files:** All screen files  
**Agent:** `frontend-dev`

Multiple screens hardcode `'local-user-1'` rather than reading from `settingsStore.userId` or calling `getActiveUserId()`. This creates a future migration problem when cloud auth is added: the auth migration in `auth.ts` correctly updates the DB, but screens will continue querying as `'local-user-1'` after sign-in.

**Fix required (pre-cloud-sync):** Read `userId` from `useSettingsStore(s => s.userId)` in all screens. This is minor for MVP (no cloud sync yet) but should be fixed before cloud sync ships.

---

#### MINOR-07 — No test files exist anywhere
**Files:** Project-wide  
**Agent:** `frontend-dev` + `devops-engineer`

Zero test files exist in the project. The CI pipeline runs `jest --passWithNoTests` which masks the gap. Critical utility functions (`calculateHoursSummary`, `checkOverlap`, `combineDateAndTime`, midnight-crossing logic) should have unit tests.

**Suggested minimum:** Unit tests for `hoursCalculator.ts`, `dateUtils.ts` (overnight shift handling), and `shiftRepository.checkOverlap`.

---

#### MINOR-08 — `deleteAccount` in `auth.ts` doesn't delete `auth.users` record
**File:** `src/services/auth.ts` lines 218–253  
**Agent:** `backend-dev`

The `deleteAccount` function deletes data rows but the comment correctly acknowledges it can't delete the `auth.users` record client-side. This means GDPR right-to-erasure is incomplete. A service-role Edge Function for account deletion should be added before any cloud sync/auth feature goes live.

**Fix required (before cloud sync launch):** Add a `delete-account` Edge Function that accepts the user's JWT, verifies identity, deletes data, then calls `supabase.auth.admin.deleteUser(userId)` with service role.

---

## Security Assessment

| Area | Result |
|---|---|
| RLS on all Supabase tables | ✅ PASS — All 6 tables have RLS enabled with correct policies |
| No secrets in source code | ✅ PASS — `.env.example` clean; service_role only in Edge Functions |
| JWT stored in SecureStore | ✅ PASS — Not in AsyncStorage or SQLite |
| Supabase sync validates user ownership | ✅ PASS — Edge Function verifies JWT and validates user_id |
| Reminders data leakage in sync | ⚠️ MINOR-01 — Fix required |
| GDPR account deletion | ⚠️ MINOR-08 — Incomplete (pre-cloud only) |

---

## Accessibility Assessment

| Area | Result |
|---|---|
| Tap targets ≥ 44px on interactive elements | ⚠️ MINOR-05 — Two header buttons at 36px |
| `accessibilityRole` on touchables | ✅ PASS — Present throughout |
| `accessibilityLabel` on icon-only buttons | ⚠️ Notification bell lacks a label |
| High contrast text / NHS Blue primary | ✅ PASS — NHS Blue (#005EB8) correctly applied |
| Screen reader `accessibilityLiveRegion` on snackbar | ✅ PASS — Snackbar has `accessibilityLiveRegion="polite"` |

---

## Offline-First Assessment

| Area | Result |
|---|---|
| SQLite as source of truth | ✅ PASS |
| App boots without network | ✅ PASS — No network calls in bootstrap path |
| Cloud sync truly optional | ✅ PASS — `isSupabaseConfigured()` gate on all sync calls |
| Schema migrations on update | ✅ PASS — ALTER TABLE with silent duplicate-column catch |
| Soft deletes throughout | ✅ PASS — `deleted_at` on all tables |

---

## Revision Requests Summary

| ID | Severity | Agent | Description |
|---|---|---|---|
| CRIT-01 | 🔴 CRITICAL | `frontend-dev` | Fix broken `initDatabase` import in App.tsx — app will not boot |
| MAJOR-01 | 🟠 MAJOR | `devops-engineer` | Add ESLint + Jest devDependencies; CI will fail without them |
| MAJOR-02 | 🟠 MAJOR | `frontend-dev` | Undo delete must also restore reminders and reschedule notifications |
| MAJOR-03 | 🟠 MAJOR | `frontend-dev` | Add notification-denied banner with `Linking.openSettings()` deep link to Dashboard |
| MAJOR-04 | 🟠 MAJOR | `frontend-dev` | Persist contracted hours and display name to DB in settingsStore |
| MINOR-01 | 🟡 MINOR | `backend-dev` | Scope reminders query by user_id in sync Edge Function |
| MINOR-02 | 🟡 MINOR | `frontend-dev` | Calendar query may miss midnight-crossing shifts |
| MINOR-03 | 🟡 MINOR | `frontend-dev` | Remove unused variable `d` in `getWeekLabels` |
| MINOR-04 | 🟡 MINOR | `frontend-dev` | Fix notification bell navigation (wrong screen / no shiftId) |
| MINOR-05 | 🟡 MINOR | `frontend-dev` | Raise header button tap targets to 44px minimum |
| MINOR-06 | 🟡 MINOR | `frontend-dev` | Replace hardcoded `'local-user-1'` with `settingsStore.userId` |
| MINOR-07 | 🟡 MINOR | `frontend-dev` + `devops-engineer` | Add unit tests for hoursCalculator, dateUtils, checkOverlap |
| MINOR-08 | 🟡 MINOR | `backend-dev` | Add Edge Function for complete account deletion (GDPR) |

---

## Overall Verdict

### ⛔ REVISION REQUIRED

**Blockers (must fix before resubmission):**
- CRIT-01 (app won't start)
- MAJOR-01 (CI broken)
- MAJOR-02 (P0 undo delete incomplete)
- MAJOR-03 (P0 notifications denied handling missing)
- MAJOR-04 (P0 data loss — contracted hours and display name not persisted)

**Minor issues** may be addressed in the post-launch sprint with the exception of MINOR-01 (security) and MINOR-05 (accessibility — NHS mandate). Recommend fixing those in the same revision pass.

Once CRIT-01 + all MAJOR issues are resolved, resubmit for QA sign-off. The architecture is sound and the remaining work is contained and well-scoped.

---

*QA Report produced by QA Engineer Agent — NHS Shift Planner v1.0 MVP*
