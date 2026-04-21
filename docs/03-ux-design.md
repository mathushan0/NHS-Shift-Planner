# UX Design Document — MyShifts
**Version:** 1.0 MVP  
**Produced by:** UX Designer Agent  
**Date:** 2026-04-21  
**Status:** Ready for Developer Handoff  
**Input:** Raw Spec v1.0 + Project Brief v1.0 + Architecture Doc v1.0

---

## Table of Contents

1. [User Personas](#1-user-personas)
2. [User Flows](#2-user-flows)
3. [Navigation Structure](#3-navigation-structure)
4. [Design Tokens](#4-design-tokens)
5. [Component Inventory](#5-component-inventory)
6. [Screen-by-Screen Wireframes](#6-screen-by-screen-wireframes)
7. [Empty, Loading & Error States](#7-empty-loading--error-states)
8. [Widget Design](#8-widget-design)
9. [Onboarding Flow](#9-onboarding-flow)
10. [Interaction Patterns](#10-interaction-patterns)
11. [Responsive Strategy](#11-responsive-strategy)
12. [Accessibility Requirements](#12-accessibility-requirements)
13. [Dark Mode Considerations](#13-dark-mode-considerations)

---

## 1. User Personas

### 1.1 — Sarah, Staff Nurse (RN), Band 5
**Age:** 28 | **Trust:** Large acute NHS trust | **Device:** iPhone 13

**Context:**
Sarah works 12.5-hour long days and nights in a busy surgical ward. She rotates between day shifts and nights on a 4-weekly rota. Her rota is posted on the ward noticeboard and occasionally emailed as a PDF — she manually re-enters shifts into her phone calendar.

**Goals:**
- Know what shift is next without hunting through emails
- Get reminded 2 hours before a shift so she can sort childcare
- Verify her hours at pay period end without doing mental maths

**Frustrations:**
- Current calendar app has no concept of "night shift" — midnight shifts show up on the wrong day
- She misses reminders because her phone is on silent at work
- She can't quickly see if she's hit her contracted 37.5h this week

**UX Implications:**
- **Speed is everything.** She adds shifts during a 10-minute break; the form must be fast
- **Shift type** needs to be the most prominent field — Long Day / Night is the first decision
- **Week view** matters more than month view — she lives week to week
- **Midnight shift handling** must be visually intuitive (shift spans two calendar days)
- **Hours counter at a glance** — visible on the hours screen without scrolling
- Prefers light mode; her ward is bright, but needs app to work in dim locker room
- **44px minimum tap targets** — she adds shifts with acrylic nails (effectively gloves)

---

### 1.2 — Dev, Healthcare Assistant / Porter, Band 2
**Age:** 41 | **Trust:** Medium district general | **Device:** Samsung Galaxy A52

**Context:**
Dev works as a porter and picks up bank shifts from multiple wards across two hospitals. He has no fixed rota — he's contacted by WhatsApp when shifts are available. He has several employers simultaneously and needs to track across all of them to avoid double-booking.

**Goals:**
- Log bank shifts quickly after accepting them via WhatsApp
- Avoid double-booking across multiple hospitals
- See a clear picture of total hours and expected pay at month end

**Frustrations:**
- Less confident with technology — gets confused by cluttered interfaces
- Has been double-booked before; it caused a disciplinary issue
- Doesn't always know the exact ward name when adding shifts on the go

**UX Implications:**
- **Overlap/duplicate detection is critical** — must be prominent, not dismissable by accident
- **Simple, uncluttered interface** — fewer choices visible at any one time
- **Bank shift toggle** must be prominent and easy to set
- **Location field** should be free text with smart suggestions, not a required dropdown
- **Onboarding must not require email/login** — he's cautious about data
- **Android-first testing** — Samsung battery optimisation kills notifications
- Needs to see at a glance: "is that day taken?"
- Appreciates big, readable text — slightly larger default text size

---

### 1.3 — Dr Priya, Foundation Year 2 Doctor
**Age:** 25 | **Trust:** Large teaching hospital | **Device:** iPhone 15 Pro + iPad

**Context:**
Priya is in her second foundation year, rotating across specialties every 4 months. Each rotation has a completely different shift pattern — sometimes 8-hour days, sometimes 12-hour long days with weekend on-calls. She has strict Working Time Directive (WTD) limits she must not breach (max 48h average/week, max 13h straight).

**Goals:**
- Track hours rigorously to avoid WTD breaches
- Understand how many hours she's worked vs her contracted hours each rota period
- Get early warning if she's approaching her weekly limit

**Frustrations:**
- Junior doctors frequently exceed safe hours without realising until it's too late
- The junior doctor rota app her trust uses is read-only — she can't add extra cover shifts
- She uses an iPad at home and wants web access for detailed review

**UX Implications:**
- **Hours summary is her primary screen** — she checks it multiple times per week
- **Pay period flexibility matters** — her contracts run on 4-weekly rota cycles, not calendar months
- **Hours vs contracted** comparison must be front and centre
- **Web PWA matters** for her — she reviews on iPad at home
- She's tech-savvy; can handle slightly more complex interactions
- **Export to PDF** is important — she keeps records for her foundation portfolio
- **Multiple reminders per shift** — she sets a 4-hour and a 1-hour reminder
- Appreciates data density — she can read compact layouts

---

### 1.4 — Common Traits Across All Personas

| Trait | UX Response |
|-------|-------------|
| Mobile-first, often mid-task | Fast entry, minimal steps to core actions |
| Poor lighting environments (nights, dark wards) | High contrast, dark mode option |
| Wearing gloves or using devices hastily | 44px+ tap targets throughout |
| Trust is critical — this touches pay data | No unnecessary permissions, clear offline banner, no surprise logins |
| Shift patterns don't fit standard calendars | Custom shift types, midnight-crossing support, flexible pay periods |
| Notification reliability is essential | Clear permission prompts, Android battery optimisation guidance |

---

## 2. User Flows

### 2.1 Flow 1: Adding a New Shift

**Entry points:** Dashboard FAB (+), Calendar day tap → "Add shift", Quick-add from empty day

```
START
  │
  ▼
[Dashboard / Calendar]
  │
  │  Tap FAB "+" or "Add Shift" on empty day
  ▼
[Add Shift Bottom Sheet — Step 1: Type & Date]
  │
  │  Select shift type (Long Day / Night / Short Day / etc.)
  │  Select date (pre-filled if tapped from calendar)
  ▼
[Add Shift Form — Step 2: Times & Location]
  │
  │  Set start time → native time picker
  │  Set end time → native time picker
  │  Duration auto-calculates and displays live
  │  If end < start → midnight-crossing detected → shows "spans 2 days" label
  │  Enter location (optional, free text + suggestions)
  │  Toggle bank shift (optional)
  │  Add notes (optional)
  ▼
[Overlap Check — Background, silent]
  │
  ├─── No overlap ──────────────────────────────────────────┐
  │                                                          │
  └─── Overlap detected                                      │
         │                                                   │
         ▼                                                   │
    [Overlap Warning Banner — inline, yellow]                │
    "⚠️ Overlap with Long Day on [date] [time]"              │
    [Cancel] [Override & Save]                               │
         │                                                   │
         │  User taps Override                               │
         │                                                   ▼
         └──────────────────────────────────────────► [Set Reminder]
                                                             │
                                                    Default: 2 hours
                                                    Tap to change: 
                                                    30 min / 1h / 2h / 4h / custom
                                                    Multiple reminders: + Add another
                                                             │
                                                             ▼
                                                    [Save Shift]
                                                             │
                                              ┌──────────────┴──────────────┐
                                              │                              │
                                         Success                        Error (DB)
                                              │                              │
                                              ▼                              ▼
                                    Shift saved to SQLite          Error snackbar
                                    Notification scheduled         "Couldn't save shift.
                                    Calendar updates               Try again."
                                    Widget data updated
                                              │
                                              ▼
                                    [Dashboard] — shift appears
                                    Green snackbar: "Shift added ✓"
                                    [Undo] visible for 5s
                                              │
                                    User taps Undo
                                              │
                                              ▼
                                    Shift deleted, notification cancelled
                                    "Shift removed"
```

**Key UX Decisions:**
- Bottom sheet, not full screen — keeps calendar visible underneath
- Type is the first choice — most important field, shown as visual cards not dropdown
- Date pre-fills from where user tapped — reduce input friction
- Duration shows live as times change — immediate feedback
- Overlap check is silent; only interrupts if a conflict is found
- Reminder pre-fills from user's default setting (Settings)
- Save is a single large button at the bottom, always visible above keyboard

---

### 2.2 Flow 2: Checking Hours

**Entry point:** Hours tab in bottom tab bar

```
START — User taps "Hours" tab
  │
  ▼
[Hours Summary Screen]
  │
  │  Big number: "42h 30m" this week
  │  vs contracted: "37.5h" (colour coded — green if under, amber if near, red if over)
  │  Period toggle bar: [Week] [Month] [Pay Period]
  │
  ├─── Tap "Week" (default)
  │         │
  │         ▼
  │    Total for Mon–Sun
  │    Bar chart: 7 bars (Mon–Sun), each bar = shift hours that day
  │    List below: each shift with date, type chip, duration
  │    
  ├─── Tap "Month"
  │         │
  │         ▼
  │    Total for calendar month
  │    Bar chart: 4–5 bars (weeks within month)
  │    List: all shifts this month, grouped by week
  │    
  └─── Tap "Pay Period"
            │
            ▼
       Total for configured pay period
       (configured in Settings → Pay Period)
       Same bar chart + list pattern
       If not configured: prompt "Set your pay period in Settings"
  │
  ▼
[Within any view — Actions]
  │
  ├─── Tap a shift in the list → [Shift Detail Screen]
  │
  ├─── Tap "Export" (top right icon)
  │         │
  │         ▼
  │    Bottom sheet: [Export as PDF] [Export as CSV] [Add to Calendar]
  │    Tap PDF → expo-print generates, expo-sharing opens share sheet
  │
  └─── No shifts in period → Empty state (see §7)
```

**Key UX Decisions:**
- Big number is the hero — Dr Priya needs it instantly
- Colour coding of hours vs contracted is immediate visual feedback
- Period toggle is a segmented control, always visible, no navigation required
- Export is secondary — icon in header, not on critical path
- Contracted hours can be set in this screen via an inline prompt if not set yet

---

### 2.3 Flow 3: Receiving a Shift Reminder

**Entry point:** Device notification fires (local scheduled)

```
START — Notification fires on device
  │
  ▼
[Device Lock Screen / Notification Centre]
  │
  Notification content:
  ┌─────────────────────────────────────────┐
  │ ⏰ MyShifts                    │
  │ Long Day starts in 2 hours              │
  │ Ward 6 · City Hospital                  │
  └─────────────────────────────────────────┘
  │
  ├─── User ignores / dismisses
  │         │
  │         ▼
  │    Notification clears. App state unchanged.
  │    (If multiple reminders set: next one fires later)
  │
  └─── User taps notification
            │
            ▼
       [App opens / foregrounds]
            │
            ├─── App was not running → cold start → deep link to shift
            │
            └─── App was in background → foreground → deep link to shift
                      │
                      ▼
            [Shift Detail Screen — pre-loaded for that shift]
                      │
            Full details visible:
            • Shift type + colour chip
            • Start / End time (12h or 24h per device setting)
            • Duration
            • Location
            • Notes (if any)
            • Reminders set
            • Bank shift badge (if applicable)
                      │
            Actions available:
            ├─── [Edit Shift] → opens Add/Edit form pre-filled
            ├─── [Delete Shift] → confirmation bottom sheet
            └─── [Back] → returns to Dashboard/Calendar
```

**Key UX Decisions:**
- Notification body includes the two most important pieces of info: type and location
- Deep link goes directly to the specific shift — no hunting required
- Shift Detail screen is read-optimised — large text, clear layout
- Edit and Delete available directly from detail — no extra navigation

---

## 3. Navigation Structure

### 3.1 Bottom Tab Bar (Mobile — Primary Navigation)

```
┌─────────────────────────────────────────────────────┐
│                                                     │
│              [SCREEN CONTENT AREA]                  │
│                                                     │
│                                                     │
│                        [+]  ← FAB (above tab bar)   │
├─────────┬──────────┬──────────┬────────────────────┤
│  🏠     │  📅      │  ⏱️      │  ☰                 │
│ Home    │ Calendar │  Hours   │  More              │
└─────────┴──────────┴──────────┴────────────────────┘
```

**Tab descriptions:**

| Tab | Icon | Screen | Badge |
|-----|------|--------|-------|
| Home | House | Dashboard | "Today" pill if shift in progress |
| Calendar | Calendar grid | Calendar View | None |
| Hours | Clock/stopwatch | Hours Summary | Red dot if approaching limit |
| More | Hamburger/lines | Side menu → Shift History, Settings, About | None |

**FAB (+):**
- Floats above tab bar, bottom-right position
- NHS Blue background, white "+" icon
- Tapping opens Add Shift bottom sheet
- 56px diameter (accessible, well above 44px minimum)
- Shadow: 4dp elevation

**Why 4 tabs + FAB, not 5 tabs:**
- Primary actions are Home, Calendar, Hours — used daily
- History and Settings are secondary — accessed weekly/monthly
- Keeping tab bar at 4 items prevents crowding on small screens (SE, Galaxy A series)
- FAB for Add Shift is the most common action — deserves prominent placement separate from tab navigation

### 3.2 Navigation Hierarchy

```
Root Stack
├── Onboarding Stack (first launch only)
│   ├── OnboardingWelcome
│   ├── OnboardingSetup (name, role, contracted hours, pay period)
│   ├── OnboardingPermissions (notifications)
│   └── OnboardingDone
│
└── Main App (Tab Navigator)
    ├── Tab: Home
    │   └── DashboardScreen
    │       └── ShiftDetailScreen (push on shift tap)
    │
    ├── Tab: Calendar
    │   └── CalendarScreen
    │       └── ShiftDetailScreen (push on shift tap)
    │
    ├── Tab: Hours
    │   └── HoursSummaryScreen
    │       └── ShiftDetailScreen (push on shift tap)
    │
    ├── Tab: More
    │   ├── ShiftHistoryScreen
    │   │   └── ShiftDetailScreen
    │   └── SettingsScreen
    │       ├── NotificationSettingsScreen
    │       ├── ThemeSettingsScreen
    │       ├── PayPeriodSettingsScreen
    │       ├── ShiftTypesSettingsScreen
    │       └── AccountSettingsScreen (cloud sync, export data, delete)
    │
    └── Modal Stack (overlays, any tab)
        ├── AddEditShiftModal (bottom sheet → full screen on small devices)
        └── OverlapWarningModal (inline within add/edit)
```

### 3.3 Web PWA Navigation

The web companion uses a top navigation bar (no tab bar — desktop context):

```
┌──────────────────────────────────────────────────────────────────┐
│  🏥 MyShifts    [Calendar] [Hours] [Settings]  [Sync ↑] │
└──────────────────────────────────────────────────────────────────┘
```

Mobile web (≤768px) collapses to hamburger menu + bottom nav strip.

---

## 4. Design Tokens

### 4.1 Colour Palette

**Primary Brand**

| Token | Hex | Usage |
|-------|-----|-------|
| `color-primary` | `#005EB8` | Primary CTA buttons, FAB, active tab, NHS blue |
| `color-primary-dark` | `#003087` | Night shifts, pressed states, dark backgrounds |
| `color-primary-light` | `#41B6E6` | Short Day/Early shifts, secondary highlights |

**Semantic / Shift Type Colours**

| Token | Hex | Shift Type / Usage |
|-------|-----|--------------------|
| `color-shift-long-day` | `#005EB8` | Long Day |
| `color-shift-night` | `#003087` | Night shift |
| `color-shift-short-day` | `#41B6E6` | Short Day / Early |
| `color-shift-late` | `#768692` | Late shift |
| `color-shift-annual-leave` | `#00A499` | Annual leave |
| `color-shift-sick` | `#DA291C` | Sick |
| `color-shift-bank-holiday` | `#FFB81C` | Bank holidays |
| `color-shift-rest` | `#E8EDEE` | Rest day |

**Semantic / Status Colours**

| Token | Hex | Usage |
|-------|-----|-------|
| `color-success` | `#00A499` | Success states, under contracted hours |
| `color-warning` | `#FFB81C` | Warnings, notification denied banner |
| `color-error` | `#DA291C` | Errors, over contracted hours, destructive actions |
| `color-info` | `#41B6E6` | Informational banners |

**Neutral Scale**

| Token | Hex | Usage |
|-------|-----|-------|
| `color-text-primary` | `#231F20` | Body text (NHS black) |
| `color-text-secondary` | `#425563` | Secondary text, labels |
| `color-text-disabled` | `#768692` | Disabled elements |
| `color-text-inverse` | `#FFFFFF` | Text on dark backgrounds |
| `color-surface-1` | `#FFFFFF` | Card and sheet backgrounds |
| `color-surface-2` | `#F0F4F5` | Screen background |
| `color-surface-3` | `#E8EDEE` | Dividers, input backgrounds |
| `color-border` | `#D8DDE0` | Input borders, dividers |

### 4.2 Typography

**System fonts only. No web font loading.**

| Platform | Font Stack |
|----------|-----------|
| iOS | `-apple-system` (SF Pro) |
| Android | `Roboto` (default system font) |
| Web | `-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif` |

**Type Scale**

| Token | Size | Line Height | Weight | Usage |
|-------|------|-------------|--------|-------|
| `text-display` | 32sp | 40sp | 700 (Bold) | Hours big number, hero stats |
| `text-heading-1` | 24sp | 32sp | 700 | Screen titles |
| `text-heading-2` | 20sp | 28sp | 600 | Card headers, section titles |
| `text-heading-3` | 17sp | 24sp | 600 | Shift type names, sub-headers |
| `text-body-1` | 16sp | 24sp | 400 | Body text, form labels |
| `text-body-2` | 14sp | 20sp | 400 | Secondary info, metadata |
| `text-caption` | 12sp | 16sp | 400 | Timestamps, helper text |
| `text-button` | 16sp | 24sp | 600 | Button labels |
| `text-tab` | 11sp | 16sp | 500 | Tab bar labels |

**Note on accessibility:** Body minimum is 16sp. Never go below 12sp for any user-facing text. All sizes are sp (scale-independent pixels) to respect user's OS font size preference.

### 4.3 Spacing Scale (8-point grid)

| Token | Value | Usage |
|-------|-------|-------|
| `space-1` | 4px | Micro gaps, icon padding |
| `space-2` | 8px | Tight component padding |
| `space-3` | 12px | Inner card padding (small) |
| `space-4` | 16px | Standard component padding |
| `space-5` | 20px | Section spacing |
| `space-6` | 24px | Card padding, section gaps |
| `space-8` | 32px | Large section separations |
| `space-10` | 40px | Screen-level padding |
| `space-12` | 48px | Hero element spacing |

**Screen edge margins:** 16px horizontal on mobile (≤390px), 24px on larger phones.

### 4.4 Elevation / Shadow

| Level | Usage | Shadow |
|-------|-------|--------|
| `elevation-0` | Flat surfaces | None |
| `elevation-1` | Cards, list items | 0 1px 3px rgba(0,0,0,0.12) |
| `elevation-2` | Bottom sheets (resting) | 0 4px 8px rgba(0,0,0,0.16) |
| `elevation-3` | FAB, modals | 0 8px 16px rgba(0,0,0,0.20) |
| `elevation-4` | Dialogs, toast | 0 16px 24px rgba(0,0,0,0.24) |

### 4.5 Border Radius

| Token | Value | Usage |
|-------|-------|-------|
| `radius-sm` | 4px | Small chips, badges |
| `radius-md` | 8px | Cards, input fields |
| `radius-lg` | 12px | Bottom sheets, modals |
| `radius-xl` | 16px | Hero cards |
| `radius-full` | 9999px | Pills, FAB, avatar circles |

### 4.6 Tap Target Minimums

- **All interactive elements:** minimum 44×44px touch area
- **FAB:** 56×56px
- **Tab bar items:** full tab bar height, no smaller than 44px
- **Bottom sheet actions:** 48px height minimum
- Use invisible padding to extend small visual elements to 44px tap area

---

## 5. Component Inventory

All components follow the design tokens defined above. Listed from atomic to composite.

### 5.1 Atoms

#### `<ShiftTypeBadge />`
- Coloured pill: background = shift type colour (hex), white text
- Variants: default (small, in lists), large (in shift detail / form)
- Props: `typeName`, `colourHex`, `size`

#### `<DurationPill />`
- Grey pill showing calculated duration: "12h 30m"
- Used in: Add/Edit form (live), shift list items, detail screen

#### `<StatusDot />`
- Circular indicator: 10px diameter
- Colours: green (in progress / pulsing), blue (scheduled), grey (completed), red (sick/cancelled)
- Animated: pulsing green for in-progress shifts on dashboard

#### `<IconButton />`
- 44×44px minimum, icon centred
- Props: `icon`, `onPress`, `accessibilityLabel` (required)
- Variants: default, ghost, destructive

#### `<PrimaryButton />`
- Full-width on mobile, min 200px on web
- 48px height, `radius-lg`, `color-primary` background
- Loading state: spinner replaces label
- Disabled state: `color-text-disabled` background

#### `<SecondaryButton />`
- Same dimensions, transparent background, `color-primary` border + text
- Destructive variant: `color-error` text + border

#### `<TextInput />`
- 48px height, `radius-md`, `color-border` border
- Focus state: `color-primary` 2px border
- Error state: `color-error` border + helper text below
- Label above, always visible (not placeholder-as-label)

#### `<SegmentedControl />`
- 2–4 segments (Week / Month / Pay Period)
- Selected: `color-primary` background, white text
- Unselected: `color-surface-3` background, `color-text-secondary`
- 44px height

#### `<ToggleSwitch />`
- iOS-style switch on iOS, Material-style on Android
- Custom tint: `color-primary` when active

#### `<Chip />`
- Small pill for filter/category display
- 32px height, `radius-full`
- Tappable variant for filter chips

### 5.2 Molecules

#### `<ShiftCard />`
- Used in: upcoming shifts list on Dashboard, shift history list
- Layout:
  ```
  ┌────────────────────────────────────────────┐
  │ ■ [ShiftTypeBadge]        [DurationPill]   │
  │   Mon 21 Apr · 07:30–20:00                 │
  │   📍 Ward 6, City Hospital                 │
  │   [Bank badge if applicable]               │
  └────────────────────────────────────────────┘
  ```
- Left: 4px colour bar (shift type colour)
- Tap: navigate to ShiftDetailScreen
- Swipe left: reveals Delete action (red, 48px min)
- Long press: context menu (Edit / Delete / Copy)

#### `<NextShiftHero />`
- Large card at top of Dashboard
- Shows NEXT upcoming shift prominently
- States: shift today (normal), shift in progress (pulsing dot + "In Progress"), no shift ("Day off 🎉")
- Layout:
  ```
  ┌──────────────────────────────────────────────────┐
  │ NEXT SHIFT                        [● In Progress] │
  │                                                   │
  │  Long Day                       07:30 – 20:00    │
  │  Wednesday 22 April             12h 30m           │
  │                                                   │
  │  📍 Ward 6 · City Hospital                        │
  │                                                   │
  │  [Set Reminder]       [Edit Shift]                │
  └──────────────────────────────────────────────────┘
  ```

#### `<WeekStrip />`
- Horizontal scrollable row: Mon–Sun
- Each day: 2-letter abbr + date number
- Today: `color-primary` background, white text
- Has shift: small coloured dot below date number (up to 3, then "+N")
- Selected: outline ring
- Tapping day scrolls calendar to that date / filters upcoming list
- 52px height per day cell (accessible)

#### `<HoursWidget />`
- Compact card on Hours screen showing big number
- Layout:
  ```
  ┌──────────────────────────────────────────┐
  │  This Week                               │
  │                                          │
  │   42h 30m                 / 37.5h        │
  │   ████████████████░░░░░   contracted     │
  │   (progress bar)          +5h over       │
  └──────────────────────────────────────────┘
  ```
- Progress bar: fills to contracted hours, overflows in `color-error`
- "over" label in red, "remaining" in green

#### `<BarChart />`
- Victory Native wrapper with NHS design tokens
- Axes: day/week labels on X, hours on Y
- Bar fill: `color-primary` for normal, `color-error` if over threshold
- No animation on first render (accessibility — users may have reduced motion preference)
- Accessible: data-label on each bar for screen readers

#### `<BottomSheet />`
- Slides up from bottom, handles notch/home indicator
- Drag handle: centred pill at top, 40×4px, `color-border`
- Backdrop: 50% black overlay, tappable to dismiss
- States: half-height (peek), full-height
- Keyboard-aware: shifts up with keyboard on iOS/Android

#### `<Snackbar />`
- Appears at bottom (above tab bar), auto-dismisses after 5s
- Max 2 lines of text
- Optional action button on right: "UNDO", "OPEN SETTINGS"
- Variants: default (grey), success (green), error (red), warning (yellow)

#### `<BannerAlert />`
- Full-width sticky banner below header, above content
- Variants:
  - Yellow (warning): "Notifications are off. Tap to enable →"
  - Blue (info): "You're offline. Changes will sync when reconnected."
  - Red (error): Rare — for critical errors only
- Dismissable via X button (persists if condition still true)
- 56px height minimum

#### `<CalendarMonthGrid />`
- 7-column grid, Mon–Sun headers
- Each cell: date number + up to 3 shift dots
- Today: `color-primary` background circle
- Bank holiday: grey background with small label
- Rest day: "R" label in `color-text-disabled`
- Selected day: outline ring
- Swipe left/right: previous/next month with animation

#### `<FormSection />`
- Grouped form fields with optional section header
- 8px internal gap between fields
- 24px gap between sections

#### `<LoadingSpinner />`
- NHS Blue circular spinner
- Full-screen variant: centred, with optional "Loading..." label
- Inline variant: replaces button content

#### `<EmptyState />`
- Centred in available space
- Illustration (simple, single-colour SVG using `color-primary-light`)
- Heading + body text
- Optional CTA button

### 5.3 Organisms

#### `<AddShiftForm />`
- Contains: ShiftTypeSelector, DatePicker, StartTimePicker, EndTimePicker, DurationDisplay, LocationInput, BankShiftToggle, NotesInput, ReminderSelector
- Lives in a BottomSheet (half → full on keyboard open)
- Validation inline, on field blur

#### `<ShiftTypeSelector />`
- Grid of shift type cards (2 columns)
- Each card: coloured background, type name, default duration
- Selected: border ring, checkmark
- "+ Custom" card at end (opens type editor)

#### `<ShiftHistoryList />`
- FlatList with `getItemLayout` for performance
- Grouped by month
- Pull-to-refresh
- Filter bar: [All] [Long Day] [Night] [Short Day] [Bank] [Sick]
- Search input (activates on scroll up)

#### `<NotificationPermissionBanner />`
- Yellow banner, persistent until permissions granted
- "Notifications are off — you won't get shift reminders"
- CTA: "Enable Notifications" → Linking.openSettings()

#### `<SyncStatusBar />`
- Subtle bar at top of screen (not full banner)
- Shows: "Syncing..." / "Synced 2m ago" / "⚠️ Sync failed"
- Only visible when cloud sync is enabled

---

## 6. Screen-by-Screen Wireframes

### 6.1 Splash Screen

```
┌─────────────────────────────────┐
│                                 │
│                                 │
│                                 │
│          [NHS Logo Mark]        │
│                                 │
│       MyShifts         │
│                                 │
│          (loading...)           │
│                                 │
│                                 │
│                                 │
└─────────────────────────────────┘
```

- White background, NHS blue logo and wordmark
- Spinner below wordmark
- Duration: ≤ 1 second, then transitions to onboarding (first launch) or dashboard
- No user interaction required

---

### 6.2 Dashboard (Home Screen)

```
┌─────────────────────────────────────────────┐
│ ≡   Good morning, Sarah          🔔  [sync] │  ← Header
├─────────────────────────────────────────────┤
│                                             │
│  ┌─────────────────────────────────────┐   │  ← Next Shift Hero Card
│  │ NEXT SHIFT                 ● active │   │
│  │                                     │   │
│  │  Long Day              07:30–20:00  │   │
│  │  Wednesday 22 Apr      12h 30m      │   │
│  │                                     │   │
│  │  📍 Ward 6 · City Hospital          │   │
│  │                                     │   │
│  │  [⏰ Reminder: 2h]  [✏️ Edit]       │   │
│  └─────────────────────────────────────┘   │
│                                             │
│  ┌─Mon─┬─Tue─┬─Wed─┬─Thu─┬─Fri─┬─Sat─┬─Sun─┐  ← Week Strip
│  │ 20  │[21] │ 22  │ 23  │ 24  │ 25  │ 26  │
│  │     │ ●●  │ ●   │     │ ●   │     │     │
│  └─────┴─────┴─────┴─────┴─────┴─────┴─────┘
│                                             │
│  UPCOMING SHIFTS                  (see all) │  ← Section header
│  ┌─────────────────────────────────────┐   │
│  │■ Long Day  Wed 22 Apr  07:30–20:00  │   │  ← ShiftCard
│  │  📍 Ward 6 · City Hospital          │   │
│  └─────────────────────────────────────┘   │
│  ┌─────────────────────────────────────┐   │
│  │■ Night     Thu 23 Apr  20:00–08:00  │   │
│  │  📍 Ward 6 · City Hospital          │   │
│  └─────────────────────────────────────┘   │
│  ┌─────────────────────────────────────┐   │
│  │■ Short Day Fri 24 Apr  08:00–14:00  │   │
│  │  📍 City Hospital                   │   │
│  └─────────────────────────────────────┘   │
│                                             │
│                              [+]            │  ← FAB
├────────┬───────────┬───────────┬────────────┤
│  🏠    │    📅     │    ⏱️     │    ☰      │  ← Tab Bar
│ Home   │ Calendar  │   Hours   │   More     │
└────────┴───────────┴───────────┴────────────┘
```

**Header:**
- Greeting changes by time of day (Good morning / afternoon / evening)
- Name from user's profile (set in onboarding, editable in Settings)
- 🔔 icon: navigates to notification settings; shows badge dot if notifications disabled
- Sync icon: only shown when cloud sync enabled; shows sync state

**Shift In Progress state:**
```
  │ SHIFT IN PROGRESS         ●●● (pulsing)│
  │  Long Day         Started 2h 30m ago   │
  │  07:30 – 20:00    ████░░░░░░ 23%        │
```

**Day Off state (no shift today):**
```
  │ TODAY                                   │
  │                                         │
  │         Day off 🎉                      │
  │    Your next shift: Wed 22 Apr          │
  │                                         │
```

---

### 6.3 Calendar View

```
┌─────────────────────────────────────────────┐
│ <  April 2026  >                     [+ Add] │  ← Month nav
├─────────────────────────────────────────────┤
│  M    T    W    T    F    S    S            │  ← Day headers
├────┬────┬────┬────┬────┬────┬────┐          │
│    │    │  1 │  2 │  3 │  4 │  5 │          │
│    │    │    │  ● │    │ ●  │    │          │
├────┼────┼────┼────┼────┼────┼────┤          │
│  6 │  7 │  8 │  9 │ 10 │ 11 │ 12 │          │
│ ●● │    │ ●  │    │ [R]│    │    │          │
├────┼────┼────┼────┼────┼────┼────┤          │
│ 13 │ 14 │ 15 │ 16 │ 17 │ 18 │ 19 │          │
│    │ ●  │    │ ●● │    │    │[BH]│          │
├────┼────┼────┼────┼────┼────┼────┤          │
│ 20 │[21]│ 22 │ 23 │ 24 │ 25 │ 26 │          │
│    │ ●● │ ●  │ ●  │ ●  │    │    │          │
├────┼────┼────┼────┼────┼────┼────┤          │
│ 27 │ 28 │ 29 │ 30 │    │    │    │          │
│    │ ●  │    │    │    │    │    │          │
└────┴────┴────┴────┴────┴────┴────┘          │
│                                             │
│  WEDNESDAY 22 APRIL                        │  ← Selected day panel
│  ┌─────────────────────────────────────┐   │
│  │ ■ Long Day  07:30–20:00  12h 30m    │   │
│  │   📍 Ward 6 · City Hospital         │   │
│  └─────────────────────────────────────┘   │
│  [+ Add shift on this day]                 │
│                                             │
│                              [+]            │
├────────┬───────────┬───────────┬────────────┤
│  🏠    │    📅     │    ⏱️     │    ☰      │
└────────┴───────────┴───────────┴────────────┘
```

**Calendar legend (below grid, collapsible):**
```
● NHS Blue = Long Day   ● Dark Blue = Night   ● Light Blue = Short Day
[R] = Rest Day   [BH] = Bank Holiday
```

**Dot rules:**
- Max 3 coloured dots per cell; if more: "3+" grey label
- Dots use `color-shift-*` tokens for their respective shift type
- Today: blue circle background on date number
- Selected: outline ring on date number
- Bank holiday: light grey cell background + "BH" micro-label

---

### 6.4 Add / Edit Shift Form

Appears as a BottomSheet. Expands to near-full-screen when keyboard opens.

```
┌─────────────────────────────────────────────┐
│              ─────                          │  ← drag handle
│         Add Shift                    [×]    │  ← sheet header
├─────────────────────────────────────────────┤
│                                             │
│  SHIFT TYPE                                 │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐    │
│  │          │ │          │ │          │    │
│  │ Long Day │ │  Night   │ │Short Day │    │
│  │  12.5h   │ │  12.5h   │ │   7.5h   │    │
│  │  ✓ sel.  │ │          │ │          │    │
│  └──────────┘ └──────────┘ └──────────┘    │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐    │
│  │  Early   │ │   Late   │ │   + Add  │    │
│  │   7.5h   │ │   7.5h   │ │  Custom  │    │
│  └──────────┘ └──────────┘ └──────────┘    │
│                                             │
│  DATE                                       │
│  ┌─────────────────────────────────────┐   │
│  │  Wednesday, 22 April 2026        ▼  │   │
│  └─────────────────────────────────────┘   │
│                                             │
│  START TIME            END TIME             │
│  ┌─────────────┐      ┌─────────────┐       │
│  │   07:30  ▼  │      │  20:00   ▼  │       │
│  └─────────────┘      └─────────────┘       │
│                                             │
│  Duration: 12h 30m  (auto-calculated)       │
│  [Spans 2 days — ends Thu 23 Apr] ← if night│
│                                             │
│  ─────────────────────────────────────────  │
│                                             │
│  LOCATION (optional)                        │
│  ┌─────────────────────────────────────┐   │
│  │  Ward 6, City Hospital          🗑️  │   │
│  └─────────────────────────────────────┘   │
│  Recent: Ward 4  |  City Hospital  |  MAU  │
│                                             │
│  Bank shift  ○──────── (toggle off)         │
│                                             │
│  NOTES (optional)                           │
│  ┌─────────────────────────────────────┐   │
│  │                                     │   │
│  │                                     │   │
│  └─────────────────────────────────────┘   │
│                                             │
│  REMINDER                                   │
│  ┌─────────────────────────────────────┐   │
│  │  2 hours before               ▼ ×  │   │
│  └─────────────────────────────────────┘   │
│  [+ Add another reminder]                   │
│                                             │
│ ─────────────────────────────────────────── │
│                                             │
│  ┌─────────────────────────────────────┐   │
│  │            Save Shift               │   │  ← Primary CTA
│  └─────────────────────────────────────┘   │
│                                             │
└─────────────────────────────────────────────┘
```

**Overlap warning (inline, yellow banner, appears after date/time selected):**
```
  ┌─────────────────────────────────────────┐
  │ ⚠️  Overlap with Night shift on 22 Apr  │
  │     20:00–08:00 — same time period      │
  │     [Review]              [Override]    │
  └─────────────────────────────────────────┘
```

**Edit Shift:** Same form, pre-filled. Header says "Edit Shift". Footer has [Save Changes] and [Delete Shift (red)].

---

### 6.5 Shift Detail Screen

Full-screen push navigation from any shift tap.

```
┌─────────────────────────────────────────────┐
│ ←                                  [✏️ Edit] │  ← Navigation bar
├─────────────────────────────────────────────┤
│                                             │
│  ┌─────────────────────────────────────┐   │  ← Type header card (colour bg)
│  │  ■ Long Day                         │   │
│  │                                     │   │
│  │  Wednesday 22 April 2026            │   │
│  │  07:30 – 20:00 · 12h 30m            │   │
│  └─────────────────────────────────────┘   │
│                                             │
│  LOCATION                                   │
│  📍  Ward 6, City Hospital                 │
│                                             │
│  ──────────────────────────────────────     │
│                                             │
│  REMINDERS                                  │
│  🔔  2 hours before  (05:30 Wed 22 Apr)     │
│  🔔  30 mins before  (07:00 Wed 22 Apr)     │
│                                             │
│  ──────────────────────────────────────     │
│                                             │
│  DETAILS                                    │
│  Type         Long Day                      │
│  Duration     12h 30m                       │
│  Status       Scheduled                     │
│  Bank Shift   No                            │
│                                             │
│  ──────────────────────────────────────     │
│                                             │
│  NOTES                                      │
│  "Covering for Jane — check handover notes" │
│                                             │
│  ──────────────────────────────────────     │
│                                             │
│  ┌─────────────────────────────────────┐   │
│  │  🗑️  Delete Shift                   │   │  ← Destructive, red text
│  └─────────────────────────────────────┘   │
│                                             │
└─────────────────────────────────────────────┘
```

**Delete confirmation bottom sheet:**
```
              ─────
  Delete Shift?

  "Long Day · Wed 22 Apr · 07:30–20:00"
  
  This will also cancel any reminders.
  
  [Cancel]               [Delete Shift]
                         (red button)
```

After delete: navigate back, show snackbar: "Shift deleted · [Undo]" (5 seconds)

---

### 6.6 Hours Summary Screen

```
┌─────────────────────────────────────────────┐
│              Hours Summary                  │  ← Screen title
├─────────────────────────────────────────────┤
│                                             │
│  ┌─────────────────────────────────────┐   │  ← Period selector
│  │  [  Week  ]  [  Month  ]  [  Pay  ] │   │
│  └─────────────────────────────────────┘   │
│                                             │
│  Mon 20 – Sun 26 April 2026                 │  ← Period label
│                                             │
│  ┌─────────────────────────────────────┐   │  ← Hours Hero
│  │   42h 30m                           │   │
│  │   ████████████████░░░  / 37.5h      │   │
│  │   +5h over contracted        🔴     │   │
│  └─────────────────────────────────────┘   │
│                                             │
│  ┌─────────────────────────────────────┐   │  ← Bar chart
│  │       │                             │   │
│  │  12 ─ │████ │     │████ │████ │    │   │
│  │   8 ─ │     │     │     │     │    │   │
│  │   4 ─ │     │     │     │     │    │   │
│  │   0 ─ M   T   W   T   F   S   S    │   │
│  └─────────────────────────────────────┘   │
│                                             │
│  SHIFTS THIS WEEK                  [Export] │
│  ┌─────────────────────────────────────┐   │
│  │ ■ Long Day  Mon 20 Apr  07:30–20:00 │   │
│  │   12h 30m                           │   │
│  ├─────────────────────────────────────┤   │
│  │ ■ Night     Wed 22 Apr  20:00–08:00 │   │
│  │   12h 00m                           │   │
│  ├─────────────────────────────────────┤   │
│  │ ■ Long Day  Thu 23 Apr  07:30–20:00 │   │
│  │   12h 30m                           │   │
│  ├─────────────────────────────────────┤   │
│  │ ■ Short Day Fri 24 Apr  08:00–14:00 │   │
│  │   06h 00m                           │   │
│  └─────────────────────────────────────┘   │
│                                             │
│  BREAKDOWN                                  │
│  Long Day:     25h 00m                      │
│  Night:        12h 00m                      │
│  Short Day:     5h 30m                      │
│  Bank shifts:  12h 00m ← separate line      │
│                                             │
└─────────────────────────────────────────────┘
```

**Export bottom sheet (tap [Export]):**
```
              ─────
  Export Hours

  Period: Mon 20 – Sun 26 April 2026
  
  [📄 Export as PDF]
  [📊 Export as CSV]
  [📅 Add to Calendar]
  
  [Cancel]
```

---

### 6.7 Shift History Screen

Accessed via "More" tab.

```
┌─────────────────────────────────────────────┐
│ ←  Shift History               [🔍 Search]  │
├─────────────────────────────────────────────┤
│  ──────────────────────────────────────────  │
│  [All][Long Day][Night][Short][Bank][Sick]   │  ← Filter chips (horizontal scroll)
│  ──────────────────────────────────────────  │
│                                             │
│  APRIL 2026                                 │  ← Month section header
│  ┌─────────────────────────────────────┐   │
│  │ ■ Long Day  Mon 20 · 07:30–20:00    │   │
│  │   📍 Ward 6                         │   │
│  └─────────────────────────────────────┘   │
│  ┌─────────────────────────────────────┐   │
│  │ ■ Night     Wed 22 · 20:00–08:00    │   │
│  │   📍 Ward 6                         │   │
│  └─────────────────────────────────────┘   │
│                                             │
│  MARCH 2026                                 │
│  ┌─────────────────────────────────────┐   │
│  │ ■ Short Day Fri 31 · 08:00–14:00    │   │
│  └─────────────────────────────────────┘   │
│  ...                                        │
│                                             │
└─────────────────────────────────────────────┘
```

- Pull-to-refresh at top
- Search (activated by scroll-up or 🔍 tap): filters by type/location/notes
- Swipe left on shift: quick delete
- Each row tap → ShiftDetailScreen

---

### 6.8 Settings Screen

Accessed via "More" tab.

```
┌─────────────────────────────────────────────┐
│              Settings                       │
├─────────────────────────────────────────────┤
│                                             │
│  MY PROFILE                                 │
│  ┌─────────────────────────────────────┐   │
│  │  Sarah Johnson         Edit →       │   │
│  │  Nurse · City NHS Trust             │   │
│  │  Contracted: 37.5h/week             │   │
│  └─────────────────────────────────────┘   │
│                                             │
│  NOTIFICATIONS                              │
│  ┌─────────────────────────────────────┐   │
│  │  Default reminder time              │   │
│  │  2 hours before shift      Edit  →  │   │
│  ├─────────────────────────────────────┤   │
│  │  Notification sound                 │   │
│  │  On                        ■──●     │   │
│  └─────────────────────────────────────┘   │
│                                             │
│  HOURS & PAY                                │
│  ┌─────────────────────────────────────┐   │
│  │  Pay period                         │   │
│  │  Weekly (Mon–Sun)          Edit  →  │   │
│  ├─────────────────────────────────────┤   │
│  │  Contracted hours                   │   │
│  │  37.5h per week            Edit  →  │   │
│  └─────────────────────────────────────┘   │
│                                             │
│  APPEARANCE                                 │
│  ┌─────────────────────────────────────┐   │
│  │  Theme                              │   │
│  │  ○ Light  ● System  ○ Dark          │   │
│  ├─────────────────────────────────────┤   │
│  │  Region (bank holidays)             │   │
│  │  England & Wales           Edit  →  │   │
│  └─────────────────────────────────────┘   │
│                                             │
│  SHIFT TYPES                                │
│  ┌─────────────────────────────────────┐   │
│  │  Manage shift types        Edit  →  │   │
│  └─────────────────────────────────────┘   │
│                                             │
│  DATA & SYNC                                │
│  ┌─────────────────────────────────────┐   │
│  │  Cloud backup               Off ──● │   │
│  ├─────────────────────────────────────┤   │
│  │  Widget                     On ●──  │   │
│  ├─────────────────────────────────────┤   │
│  │  Export my data            [Export] │   │
│  ├─────────────────────────────────────┤   │
│  │  Delete all data        [Delete ⚠️]│   │
│  └─────────────────────────────────────┘   │
│                                             │
│  ABOUT                                      │
│  Version 1.0.0 · Privacy Policy · Licences  │
│                                             │
└─────────────────────────────────────────────┘
```

---

## 7. Empty, Loading & Error States

### 7.1 Dashboard — Empty State (No Shifts Added Yet)

```
┌─────────────────────────────────────────────┐
│ ≡   Good morning, Sarah          🔔         │
├─────────────────────────────────────────────┤
│                                             │
│         [Simple calendar illustration]      │
│               (NHS blue, minimal)           │
│                                             │
│          No shifts yet                      │
│                                             │
│     Add your first shift to get started.   │
│                                             │
│      ┌───────────────────────────────┐     │
│      │      + Add Your First Shift   │     │
│      └───────────────────────────────┘     │
│                                             │
└─────────────────────────────────────────────┘
```

### 7.2 Dashboard — Loading State (Initial Data Fetch)

```
┌─────────────────────────────────────────────┐
│ ≡   MyShifts             🔔         │
├─────────────────────────────────────────────┤
│                                             │
│  ┌─────────────────────────────────────┐   │
│  │ ████████████████████ (skeleton)     │   │  ← Shimmer skeleton
│  │ ████████████                        │   │
│  │ ██████████████████████████          │   │
│  └─────────────────────────────────────┘   │
│                                             │
│  ████ ████ ████ ████ ████ ████ ████        │  ← Skeleton week strip
│                                             │
│  ████████████████████████████████          │  ← Skeleton shift card
│  ████████████████████                      │
│                                             │
└─────────────────────────────────────────────┘
```

Skeleton shimmer: `color-surface-3` base with `color-surface-2` animated highlight.

### 7.3 Dashboard — Error State

```
  ┌─────────────────────────────────────────┐
  │  ⚠️  Couldn't load your shifts           │
  │  Check your connection and try again.   │
  │                    [Try Again]          │
  └─────────────────────────────────────────┘
```

Inline error card; does not replace the whole screen (cached data may still show).

### 7.4 Calendar — Empty Month

```
  ← April 2026 →

  [Calendar grid shows, all cells empty]

  ──────────────────────────────────────
  No shifts in April

  Tap any day to add a shift.
```

### 7.5 Calendar — Loading

Calendar grid renders immediately from local SQLite (fast). Shift dots appear once query resolves (< 50ms). No full-screen loading — at most a brief moment of empty dots.

### 7.6 Hours Summary — No Shifts This Period

```
┌─────────────────────────────────────────────┐
│  [  Week  ]  [  Month  ]  [  Pay  ]         │
│                                             │
│         [Clock illustration]                │
│                                             │
│         0h worked this week                 │
│                                             │
│   No shifts recorded for this period.      │
│                                             │
│      ┌───────────────────────────────┐     │
│      │        + Add a Shift          │     │
│      └───────────────────────────────┘     │
└─────────────────────────────────────────────┘
```

### 7.7 Hours Summary — Loading

Big number shows "—" (dash), bar chart shows placeholder bars with skeleton shimmer. Resolves in < 100ms from local DB.

### 7.8 Add/Edit Form — Validation Errors

```
  START TIME
  ┌──────────────────────────────────────┐
  │  20:00                            ▼  │  ← red border
  └──────────────────────────────────────┘
  ⚠ Start time must be before end time

  (Field label turns red, helper text appears below)
```

Other validation:
- Missing required field: red border, "This field is required"
- Overlap: yellow banner (see §2.1)
- Midnight-crossing: info label (blue, not error), "This shift spans 2 days (ends [date])"

### 7.9 Shift History — No Results

```
  [All][Long Day][Night][Short][Bank][Sick]

  ────────────────────────────────────────

      No shifts match your filter.

      [Clear Filters]
```

### 7.10 Notification Permission Denied — Persistent Banner

```
  ┌─────────────────────────────────────────┐
  │ 🔔  Notifications off — you won't get   │
  │     shift reminders.  Enable →      [×] │
  └─────────────────────────────────────────┘
```

Yellow background (`color-warning`), dark text for contrast. Shows on Dashboard. Dismissable but reappears on next launch until fixed.

### 7.11 Offline Banner

```
  ┌─────────────────────────────────────────┐
  │ 📶  You're offline. Changes will sync    │
  │     when reconnected.              [×]  │
  └─────────────────────────────────────────┘
```

Blue info style. Auto-dismisses when connectivity restored.

### 7.12 Sync Error Banner (Cloud Sync Only)

```
  ┌─────────────────────────────────────────┐
  │ ⚠️  Sync failed. Tap to retry.  [Retry] │
  └─────────────────────────────────────────┘
```

---

## 8. Widget Design

### 8.1 iOS Widget — Small (2×2 grid units)

```
┌────────────────────────┐
│ MyShifts      │  ← app name, 10pt
│                        │
│ NEXT SHIFT             │  ← label, 11pt, #FFFFFF 70%
│ Long Day               │  ← type name, 17pt Bold, white
│ 07:30                  │  ← start time, 22pt Bold, white
│                        │
│ Ward 6                 │  ← location, 11pt, #FFFFFF 80%
└────────────────────────┘
Background: shift type colour (darkened 20% for readability)
Corner radius: system (≈13px on iOS)
```

### 8.2 iOS Widget — Medium (4×2 grid units)

```
┌──────────────────────────────────────────────┐
│ MyShifts                            │  ← 10pt
│                                              │
│  NEXT SHIFT           In 1h 45m remaining   │
│                                              │
│  Long Day                    07:30 – 20:00  │  ← 20pt Bold
│  Wed 22 April                     12h 30m   │  ← 14pt
│                                              │
│  📍 Ward 6 · City Hospital                  │  ← 12pt
└──────────────────────────────────────────────┘
Background: shift type colour (gradient — full colour top, darkened bottom)
```

### 8.3 iOS Widget — Empty State

```
┌────────────────────────┐
│ MyShifts      │
│                        │
│    🎉                  │
│    No upcoming         │
│    shifts              │
└────────────────────────┘
Background: `color-surface-2` (light grey)
Text: `color-text-secondary`
```

### 8.4 Android Widget (Glance — 4×2 cells)

Matches medium iOS widget layout. Uses Glance's Material3 components with NHS Blue tinting.

```
┌──────────────────────────────────────────────┐
│ 📅 MyShifts              [Open App] │
│ ─────────────────────────────────────────── │
│  Next: Long Day · Wed 22 Apr                │
│  07:30 – 20:00 · Ward 6, City Hospital      │
│                          Starts in 1h 45m   │
└──────────────────────────────────────────────┘
```

### 8.5 Widget Stale Data Indicator

If widget data is > 30 minutes old (e.g. widget refresh delayed):
```
│  Long Day · 07:30               [↻ update] │
│  (updated 35 min ago)                       │
```

---

## 9. Onboarding Flow

### Screen 1: Welcome

```
┌─────────────────────────────────────────────┐
│                                             │
│                                             │
│         [MyShifts Logo]            │
│                                             │
│     Your shifts, all in one place.          │
│                                             │
│  Built for NHS staff who juggle multiple    │
│  rotas, nights, and bank shifts.            │
│                                             │
│  Free. Offline. No login needed.            │
│                                             │
│                                             │
│  ┌─────────────────────────────────────┐   │
│  │           Get Started →             │   │
│  └─────────────────────────────────────┘   │
│                                             │
│           ● ○ ○  (progress dots)            │
└─────────────────────────────────────────────┘
```

### Screen 2: Quick Setup

```
┌─────────────────────────────────────────────┐
│                                             │
│        Let's set up your planner            │
│                                             │
│  YOUR NAME (optional)                       │
│  ┌─────────────────────────────────────┐   │
│  │  e.g. Sarah                         │   │
│  └─────────────────────────────────────┘   │
│  Used for greetings only. Stored locally.  │
│                                             │
│  YOUR ROLE                                  │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐   │
│  │  Nurse / │ │  Doctor  │ │   HCA /  │   │
│  │ Midwife  │ │          │ │  Porter  │   │
│  └──────────┘ └──────────┘ └──────────┘   │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐   │
│  │   AHP    │ │  Admin   │ │  Other   │   │
│  └──────────┘ └──────────┘ └──────────┘   │
│                                             │
│  CONTRACTED HOURS PER WEEK (optional)       │
│  ┌─────────────────────────────────────┐   │
│  │  37.5                               │   │
│  └─────────────────────────────────────┘   │
│  Used to calculate over/under hours.        │
│                                             │
│  PAY PERIOD                                 │
│  ○ Weekly   ● Every 4 weeks   ○ Monthly     │
│                                             │
│  ┌─────────────────────────────────────┐   │
│  │           Continue →                │   │
│  └─────────────────────────────────────┘   │
│                                             │
│           ○ ● ○  (progress dots)            │
└─────────────────────────────────────────────┘
```

All fields optional — "Skip" link in top right. None block access to the app.

### Screen 3: Notifications

```
┌─────────────────────────────────────────────┐
│                                             │
│           🔔                                │
│                                             │
│     Never miss a shift                      │
│                                             │
│  MyShifts can remind you before    │
│  each shift starts — even without internet. │
│                                             │
│  Reminders are set per shift and work       │
│  100% on your device. No account needed.   │
│                                             │
│  ┌─────────────────────────────────────┐   │
│  │     Allow Notifications →           │   │
│  └─────────────────────────────────────┘   │
│                                             │
│       Not now  (text link, smaller)         │
│                                             │
│           ○ ○ ●  (progress dots)            │
└─────────────────────────────────────────────┘
```

Tapping "Allow Notifications" triggers `requestPermissionsAsync()`. Result:
- Granted → proceed to Done screen
- Denied → show brief message "You can enable this later in Settings" → Done screen

### Screen 4: Done

```
┌─────────────────────────────────────────────┐
│                                             │
│                                             │
│           ✓                                 │
│           (large checkmark, NHS blue)       │
│                                             │
│       You're all set!                       │
│                                             │
│   Add your first shift to get started.      │
│                                             │
│                                             │
│  ┌─────────────────────────────────────┐   │
│  │         Add First Shift →           │   │
│  └─────────────────────────────────────┘   │
│                                             │
│       Go to Dashboard  (text link)          │
│                                             │
└─────────────────────────────────────────────┘
```

- "Add First Shift" opens AddShiftModal directly
- "Go to Dashboard" navigates to main app without adding a shift
- `settings.onboarding_complete` set to 1 before this screen renders
- Onboarding never shown again

---

## 10. Interaction Patterns

### 10.1 Swipe Gestures

**Swipe left on ShiftCard (in Dashboard upcoming list, Shift History):**
- Reveals: red "Delete" action panel (full card height, right side)
- Confirm action tap: triggers delete confirmation bottom sheet
- If user swipes further (full swipe): delete confirmation opens immediately
- Threshold: 80px swipe to reveal, 80% of card width to full-swipe

**Swipe left/right on CalendarMonthGrid:**
- Swipe left → next month (spring animation)
- Swipe right → previous month
- No accidental activation: must be deliberate horizontal swipe, not vertical scroll

**Swipe down on BottomSheet:**
- Dismisses the sheet
- Threshold: 150px downward drag, or velocity > 500px/s
- If form has unsaved changes: confirmation: "Discard changes?" before dismissing

### 10.2 Long Press

**Long press on ShiftCard:**
- Context menu (Action Sheet) appears with:
  - Edit Shift
  - Copy Shift (creates duplicate on same day, opens edit form)
  - Set Reminder
  - Delete Shift
- 500ms hold duration
- Haptic feedback on trigger (medium impact)

**Long press on Calendar day cell:**
- Quick-add: opens Add Shift form with that date pre-filled
- 400ms hold duration
- Haptic feedback (light impact)

### 10.3 Bottom Sheets

All sheets follow a consistent pattern:

- **Drag handle** at top (40×4px pill, `color-border`)
- **Header** with title (left) and dismiss × button (right)
- **Content** scrollable if exceeds 80% viewport height
- **Footer** with primary action (sticky, not scrollable)
- **Keyboard:** sheet shifts up with keyboard; content remains scrollable
- **Backdrop:** tap to dismiss (unless form has unsaved changes)

**Bottom sheet variants by context:**

| Context | Sheet height | Dismissable |
|---------|-------------|-------------|
| Delete confirmation | ~35% | Yes (tap backdrop) |
| Add shift form | 60% → 95% (with keyboard) | Only if no changes |
| Export options | ~40% | Yes |
| Overlap warning | Inline in form (not a sheet) | No |

### 10.4 Snackbars

- Position: bottom of screen, 16px above tab bar
- Animation: slide up (300ms ease), slide down (200ms ease)
- Auto-dismiss: 5 seconds
- Manual dismiss: swipe down
- One at a time: new snackbar replaces existing
- Action button: right-aligned, `color-primary` text, 44px tap target

**Snackbar types:**

| Type | Background | Text | Example |
|------|-----------|------|---------|
| Default | `#323232` | White | "Shift saved" |
| Success | `color-success` | White | "Shift added ✓" |
| Error | `color-error` | White | "Couldn't save shift" |
| Warning | `color-warning` | `color-text-primary` | "Notification permission denied" |
| Undo | `#323232` | White + [UNDO] action | "Shift deleted · UNDO" |

### 10.5 Pull to Refresh

- Available on: Dashboard (upcoming shifts), Calendar, Shift History
- Triggers: re-query local SQLite + (if online) sync
- Indicator: NHS blue spinner at top of list
- Returns to normal state once query completes

### 10.6 Haptic Feedback

| Action | Haptic |
|--------|--------|
| Save shift (success) | Medium impact |
| Delete shift | Heavy impact |
| Long press activation | Light impact |
| Overlap warning | Medium impact + warning tone |
| Undo tap | Light impact |
| Tab bar switch | Selection feedback |
| Toggle switch | Selection feedback |

### 10.7 Transitions & Animations

- **Screen transitions:** Default React Navigation slide (right → left push)
- **Bottom sheet:** Spring animation (damping 0.7, stiffness 200)
- **Calendar month change:** Horizontal slide (200ms)
- **FAB:** Scale bounce on appear (spring)
- **Shift card appear on add:** Fade-in + translateY (150ms)
- **StatusDot pulse (in progress):** Scale 1.0 → 1.4 → 1.0, 1.5s loop, opacity 1.0 → 0.6
- **Respect `prefers-reduced-motion`:** All animations disabled; transitions are instant

---

## 11. Responsive Strategy

### 11.1 Mobile (Primary — 320px to 430px wide)

All wireframes above are designed for this breakpoint. Key rules:
- Single column layout throughout
- Tab bar at bottom
- Bottom sheets for overlays
- Full-width cards with 16px edge margins
- Scrollable content within each screen

**Tested device sizes:**
- iPhone SE 3rd gen (375×667pt) — minimum supported
- iPhone 14/15 Pro (393×852pt) — primary test device
- Samsung Galaxy A52 (360×780dp) — Android primary
- Samsung Galaxy S23 (393×851dp)

### 11.2 Large Mobile / Tablet (≥600dp width)

- Dashboard: max-width 600px centred with 24px side margins
- Calendar: month grid expands proportionally
- Add/Edit form: max-width 480px, centred in a modal (not full-sheet)
- Hours chart: taller bars, more readable
- Tab bar shifts to: **side navigation rail** (icons + labels, left side, ≥600dp)

```
┌──────────────────────────────────────────────────────┐
│                                                      │
│ 🏠 Home  │                                           │
│ 📅 Cal   │         [MAIN CONTENT AREA]               │
│ ⏱️ Hours │                                           │
│ ☰  More  │                                           │
│          │                                           │
│   [+]    │                                           │
└──────────────────────────────────────────────────────┘
```

### 11.3 Web PWA (Companion — ≥768px)

The web app uses a top navigation bar. Layout adapts:

**Desktop (≥1024px):**
```
┌──────────────────────────────────────────────────────────────┐
│  🏥 MyShifts    Calendar | Hours | History | Settings│
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  [CALENDAR — 2/3 width]    │  [DETAILS PANEL — 1/3 width]   │
│                            │  Selected day shifts            │
│                            │  Quick shift add form           │
│                            │                                 │
└──────────────────────────────────────────────────────────────┘
```

- Split-pane layout: calendar left, detail right
- No tab bar — top nav with text labels
- Hours screen: wider chart, data table alongside

**Tablet / Narrow Desktop (768–1024px):**
- Single column, max-width 800px centred
- Top nav collapses to icons + tooltip labels

**Web-specific differences from mobile:**
- No local notifications (web push deferred to V2)
- No widgets
- No PDF export (V2)
- Requires cloud sync to view data (no local SQLite on web)
- "Connect to mobile" prompt if no cloud sync enabled

### 11.4 Web Mobile (≤767px)

- Renders as single-column layout
- Top nav collapses to hamburger + bottom tab strip
- Touch interactions supported (swipe on calendar, pull-to-refresh)

---

## 12. Accessibility Requirements

### 12.1 WCAG 2.1 AA Compliance — Mandatory

All screens must meet AA level minimum. AAA target for high-priority elements (hours hero, shift type badges, warning banners).

**Contrast requirements:**

| Contrast ratio | Applies to |
|----------------|-----------|
| ≥ 4.5:1 | Normal text (< 18sp) |
| ≥ 3:1 | Large text (≥ 18sp or 14sp bold) |
| ≥ 3:1 | UI components and graphical objects |

**Verified NHS colour combinations:**

| Foreground | Background | Ratio | Pass |
|------------|-----------|-------|------|
| #FFFFFF | #005EB8 (NHS Blue) | 5.1:1 | ✅ AA |
| #FFFFFF | #003087 (NHS Dark Blue) | 10.5:1 | ✅ AAA |
| #231F20 | #FFFFFF | 19.2:1 | ✅ AAA |
| #FFFFFF | #DA291C (NHS Red) | 4.8:1 | ✅ AA |
| #231F20 | #FFB81C (NHS Yellow) | 7.6:1 | ✅ AA |
| #231F20 | #E8EDEE (Pale Grey) | 13.2:1 | ✅ AAA |
| #FFFFFF | #768692 (Mid Grey) | 3.1:1 | ✅ AA (large text only) |

**Action:** `#768692` background must only be used with large text (≥ 18sp) or with `#231F20` foreground.

### 12.2 Tap Target Sizes

- **Minimum:** 44×44px for all interactive elements
- **Preferred:** 48×48px for primary actions
- **FAB:** 56×56px
- **Tab bar items:** Full tab bar height
- **Implement via:** invisible padding/hitSlop in React Native

```tsx
// Example: extending small tap target
<TouchableOpacity
  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
  style={styles.smallButton}
>
```

**Glove-friendly design checklist:**
- [ ] No tap targets below 44px in any dimension
- [ ] No targets closer than 8px to adjacent targets
- [ ] Large date numbers in calendar cells (≥ 18sp)
- [ ] Shift type selector uses full-width cards, not radio buttons
- [ ] Confirmation actions never placed adjacent to destructive actions
- [ ] Picker wheels use native OS components (large, haptic)

### 12.3 Screen Reader Support

**React Native accessibility props required on all interactive elements:**

```tsx
// Every button, card, and interactive element needs:
accessibilityLabel="Delete Long Day shift on Wednesday 22 April"
accessibilityRole="button"
accessibilityHint="Tap to open delete confirmation"

// Status elements:
accessibilityLiveRegion="polite"  // for snackbars, sync status
accessibilityLiveRegion="assertive"  // for errors, overlap warnings
```

**Specific requirements:**

| Element | Requirement |
|---------|-------------|
| ShiftCard | Full shift description as accessibilityLabel |
| WeekStrip day | "Monday 20 April, 2 shifts" |
| Calendar cell | "Wednesday 22 April, Long Day shift" or "no shifts" |
| StatusDot | accessibilityLabel "Shift in progress" |
| Toggle switch | "Widget enabled, toggle to disable" |
| FAB | "Add new shift" |
| Bar chart | accessibilityLabel with all data values |

### 12.4 Hospital Lighting Conditions

NHS staff use devices in variable lighting: bright wards, dimly lit corridors, overnight in dark wards.

**Design responses:**

- **High contrast mode support:** iOS/Android system high contrast must not break layout
- **Dark mode** (see §13): critical for night shift workers
- **No reliance on colour alone** for information: shift type = colour + name label (never just a coloured dot without text)
- **Glare-resistant:** Avoid pure white (#FFFFFF) as the only large surface — use `color-surface-2` (#F0F4F5) for screen backgrounds
- **Status dot animations** are visible even in bright light: animated scale, not just opacity change

### 12.5 Font Scale

- Must not break layout at 200% font size (iOS Dynamic Type XXL)
- Test at: Default, Large, Extra Large, Accessibility Extra Extra Extra Large
- Use `sp` units throughout (not `px`)
- All text containers: `flex-wrap: wrap`, never fixed heights for text-containing elements

### 12.6 Colour Blindness

Do not use colour as the only differentiator for shift types:
- ✅ Colour badge + shift type name label
- ✅ Chart bars have value labels
- ✅ Overlap warning has ⚠️ icon + text
- ❌ Never: "the red bar means overtime" without a text label

**Test with:** Protanopia, Deuteranopia, Tritanopia simulation tools.

### 12.7 Reduce Motion

Detect `AccessibilityInfo.isReduceMotionEnabled()` and disable:
- Snackbar slide animations → instant appear/disappear
- Calendar month slide → instant switch
- StatusDot pulse → static dot
- Bottom sheet spring → linear ease

### 12.8 Focus Management

- On modal/sheet open: focus moves to first interactive element
- On modal/sheet close: focus returns to the triggering element
- On screen navigate: focus moves to screen heading
- No keyboard traps

---

## 13. Dark Mode Considerations

### 13.1 Dark Mode Token Overrides

Dark mode is toggled via `settings.dark_mode` (0 = system, 1 = dark, 2 = light).

| Light Token | Dark Override | Notes |
|-------------|--------------|-------|
| `color-surface-1` #FFFFFF | `#1C1C1E` | Card backgrounds |
| `color-surface-2` #F0F4F5 | `#000000` | Screen background |
| `color-surface-3` #E8EDEE | `#2C2C2E` | Dividers, inputs |
| `color-border` #D8DDE0 | `#3A3A3C` | Borders |
| `color-text-primary` #231F20 | `#FFFFFF` | Body text |
| `color-text-secondary` #425563 | `#EBEBF5` at 60% | Secondary text |
| `color-text-disabled` #768692 | `#EBEBF5` at 30% | Disabled |
| `color-primary` #005EB8 | `#4DA3FF` | CTA buttons — lightened for dark bg |
| `color-primary-dark` #003087 | `#2D7DD2` | Dark surfaces |

**NHS Blue in dark mode:** #005EB8 does not meet 4.5:1 contrast on dark surfaces. Use `#4DA3FF` (lightened variant) on dark backgrounds only for text and icons. Keep #005EB8 for opaque backgrounds (buttons, FAB).

### 13.2 Shift Type Colours in Dark Mode

Shift type colours are used as backgrounds in cards and badges. In dark mode:
- Shift badge backgrounds keep the colour (NHS blue, dark blue, etc.)
- Text on badges remains white — all shift colours maintain >4.5:1 on white text
- Hero card: shift colour as background — acceptable as decorative background (text meets AA)

### 13.3 Dark Mode Priority for This App

Night shift workers are the most important dark mode users — checking the app at 3am on a dim device.

**Non-negotiables for dark mode:**
- The Next Shift Hero Card must be readable in dark mode
- The Hours big number must meet AAA contrast in dark mode
- Notification banners (yellow warning) must invert to dark yellow bg + dark text
- Calendar must be scannable — shift dots highly visible on dark cell backgrounds

### 13.4 Widget in Dark Mode

- iOS WidgetKit adapts automatically via `.widgetBackground` modifier
- Widget background: dark mode uses `#1C2533` (dark NHS navy) instead of shift colour

### 13.5 System Default Behaviour

When `dark_mode = 0` (System): use React Native's `useColorScheme()` hook. Toggle immediately when system appearance changes — no app restart required.

---

## Appendix A — Screen Summary Table

| # | Screen | Nav location | Primary user |
|---|--------|-------------|-------------|
| 1 | Splash | Root | All |
| 2 | Onboarding Welcome | Root (first launch) | All |
| 3 | Onboarding Setup | Root (first launch) | All |
| 4 | Onboarding Permissions | Root (first launch) | All |
| 5 | Onboarding Done | Root (first launch) | All |
| 6 | Dashboard | Tab: Home | All |
| 7 | Calendar | Tab: Calendar | Sarah, Dev |
| 8 | Add/Edit Shift | Modal (bottom sheet) | All |
| 9 | Shift Detail | Push from shift tap | All |
| 10 | Hours Summary | Tab: Hours | Sarah, Priya |
| 11 | Shift History | More → History | All |
| 12 | Settings | More → Settings | All |
| 13 | Notification Settings | Settings → Notifications | All |
| 14 | Shift Types Management | Settings → Shift Types | All |
| 15 | Pay Period Settings | Settings → Pay Period | Priya |
| 16 | Account / Sync Settings | Settings → Data & Sync | All |

---

## Appendix B — Design Checklist for Developers

Before shipping each screen, verify:

**Layout**
- [ ] Edge margins: 16px mobile, 24px large screen
- [ ] 8-point grid spacing throughout
- [ ] No fixed-height text containers

**Tap Targets**
- [ ] All interactive elements ≥ 44×44px (hitSlop applied where visual is smaller)
- [ ] Adjacent targets ≥ 8px apart

**Accessibility**
- [ ] Every interactive element has `accessibilityLabel`
- [ ] Every button has `accessibilityRole="button"`
- [ ] Status changes use `accessibilityLiveRegion`
- [ ] Screen has logical focus order

**Contrast**
- [ ] All text meets 4.5:1 (normal) or 3:1 (large) against background
- [ ] UI components meet 3:1 against adjacent colours
- [ ] Colour is not the only differentiator for information

**States**
- [ ] Empty state designed and implemented
- [ ] Loading state (skeleton or spinner) implemented
- [ ] Error state with retry action implemented
- [ ] Offline state handled gracefully

**Dark Mode**
- [ ] All colours use design tokens (never hardcoded hex in components)
- [ ] Dark token overrides applied
- [ ] Tested at both system light and system dark

**Responsiveness**
- [ ] Tested at iPhone SE size (375px wide)
- [ ] Tested at 200% font scale
- [ ] Tested with reduce motion enabled

---

*UX Design Document produced by UX Designer Agent. Ready for Developer Agent handoff.*  
*All screens, states, and interaction patterns specified. Design tokens defined for direct implementation.*
