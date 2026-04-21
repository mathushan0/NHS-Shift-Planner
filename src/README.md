# NHS Shift Planner — Source Code

## Structure

```
src/
├── types/              # TypeScript type definitions
│   ├── index.ts        # All domain + navigation types
│   └── declarations.d.ts  # Module stubs for optional packages
│
├── theme/              # Design tokens
│   ├── colors.ts       # NHS colour palette (light + dark)
│   ├── typography.ts   # Type scale (system fonts)
│   ├── spacing.ts      # 8-point grid, border radius, elevation
│   └── index.ts        # Theme builder + Theme interface
│
├── database/           # Offline-first SQLite layer
│   ├── db.ts           # Database init, schema creation, seed data
│   └── repositories/
│       ├── shiftRepository.ts       # Shift CRUD + overlap detection
│       ├── shiftTypeRepository.ts   # Shift types CRUD
│       ├── reminderRepository.ts    # Reminders CRUD
│       └── settingsRepository.ts    # Settings read/write
│
├── stores/             # Zustand state management
│   ├── shiftStore.ts    # Shifts state + async actions
│   ├── settingsStore.ts # User preferences + profile
│   ├── themeStore.ts    # Dark/light mode
│   └── uiStore.ts       # Transient UI (selected date, snackbar queue, modal state)
│
├── services/           # Business logic services
│   ├── notifications.ts # Local notification scheduling (expo-notifications)
│   ├── auth.ts          # [V2] Supabase auth (ts-nocheck)
│   ├── sync.ts          # [V2] Cloud sync (ts-nocheck)
│   └── subscription.ts  # [V2] Premium tier (ts-nocheck)
│
├── hooks/
│   ├── useTheme.ts         # Access current Theme
│   ├── useSnackbar.ts      # Show snackbar messages
│   └── useNetworkStatus.ts # Online/offline detection
│
├── navigation/
│   ├── RootNavigator.tsx   # Root: Onboarding vs MainApp
│   ├── OnboardingStack.tsx # Welcome → Setup → Permissions → Done
│   ├── TabNavigator.tsx    # Bottom tab bar (Home/Calendar/Hours/More)
│   ├── HomeStack.tsx       # Dashboard + ShiftDetail + AddEditShift
│   ├── CalendarStack.tsx   # Calendar + ShiftDetail + AddEditShift
│   ├── HoursStack.tsx      # HoursSummary + ShiftDetail + ShiftHistory
│   └── SettingsStack.tsx   # More/Settings + ShiftHistory + ShiftDetail
│
├── screens/
│   ├── DashboardScreen.tsx        # Greeting, hero card, week strip, upcoming
│   ├── CalendarScreen.tsx         # Month grid, day detail panel
│   ├── AddEditShiftScreen.tsx     # Shift form with overlap detection, templates
│   ├── ShiftDetailScreen.tsx      # Full shift view + status management
│   ├── HoursSummaryScreen.tsx     # Hours totals, bar chart, period toggle
│   ├── ShiftHistoryScreen.tsx     # Paginated history + filter + export
│   ├── SettingsScreen.tsx         # All settings (theme, notifications, pay period)
│   ├── DisclaimerScreen.tsx       # Onboarding legal disclaimer
│   └── onboarding/
│       ├── WelcomeScreen.tsx
│       ├── SetupScreen.tsx
│       ├── NotificationPermissionScreen.tsx
│       └── OnboardingCompleteScreen.tsx
│
├── components/
│   ├── atoms/           # Primitive reusable components
│   │   ├── ShiftTypeBadge.tsx   # Coloured type pill
│   │   ├── DurationPill.tsx     # "12h 30m" pill
│   │   ├── StatusDot.tsx        # Animated status indicator
│   │   ├── PrimaryButton.tsx    # Full-width CTA button
│   │   ├── SecondaryButton.tsx  # Outlined button
│   │   ├── FormTextInput.tsx    # Labelled input with error state
│   │   ├── SegmentedControl.tsx # Week/Month/Pay Period toggle
│   │   └── Chip.tsx             # Filter chip
│   │
│   └── molecules/       # Composed components
│       ├── ShiftCard.tsx          # Shift list item (swipe-to-delete)
│       ├── HeroCard.tsx           # Next shift hero (or day off state)
│       ├── WeekStrip.tsx          # Scrollable 7-day strip with shift dots
│       ├── BarChart.tsx           # Hours bar chart (native, no SVG lib needed)
│       ├── CalendarMonthGrid.tsx  # Monthly calendar grid with shift dots
│       ├── BottomSheet.tsx        # Animated bottom sheet with drag-to-dismiss
│       ├── Snackbar.tsx           # Toast notifications with undo action
│       ├── BannerAlert.tsx        # Warning/info/error banner
│       ├── FAB.tsx                # Floating action button
│       ├── EmptyState.tsx         # Empty state with optional CTA
│       └── LoadingSpinner.tsx     # Loading indicators
│
└── utils/
    ├── dateUtils.ts       # Date formatting, pay period calc, greeting
    ├── hoursCalculator.ts # Hours summary, bar chart data, progress
    └── pdfExport.ts       # PDF/CSV export via expo-print + expo-sharing
```

## Getting Started

```bash
# Install dependencies
npm install

# Start with dev client (requires EAS build first for native modules)
npx expo start --dev-client

# Build iOS dev client (one-time)
eas build --profile development --platform ios
```

## Design System

- **Primary colour:** NHS Blue `#005EB8`
- **Typography:** System fonts (SF Pro on iOS, Roboto on Android)
- **Spacing:** 8-point grid
- **Minimum tap target:** 44×44px throughout
- **Dark mode:** Full support via `themeStore` + token system

## Key Architecture Decisions

1. **Offline-first:** All reads/writes go through SQLite. Network is never required.
2. **User ID:** Device-generated UUID on first launch (no account needed).
3. **Notifications:** Local-only via `expo-notifications`. No server required.
4. **State:** Zustand stores sync with SQLite on mutation; SQLite is source of truth.
5. **Dark mode:** Resolved at theme layer — components use tokens, never hardcoded colours.
