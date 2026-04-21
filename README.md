# NHS Shift Planner

A free, offline-first iOS app for NHS staff to track shifts, get reminders, and verify hours worked.

> **Status:** v1.0.0 — Ready for TestFlight

---

## Quick Start

```bash
git clone https://github.com/your-username/nhs-shift-planner.git
cd nhs-shift-planner
./scripts/setup.sh
npm start
```

That's it for local development. The app works fully offline with no backend required.

---

## Overview

NHS staff receive rotas through fragmented channels — paper, email, WhatsApp, departmental systems. NHS Shift Planner is a single place to log all shifts, get push reminders before each one, and see exactly how many hours you've worked in a pay period.

**Core principles:**
- **Offline-first** — every feature works without internet. Cloud sync is optional.
- **No login required** — works immediately out of the box.
- **NHS-designed** — colour-coded shift types, bank shift tracking, UK bank holidays, contracted hours comparison.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Mobile | React Native (Expo bare workflow) |
| State management | Zustand |
| Local database | SQLite via `expo-sqlite` v14 |
| Push notifications | `expo-notifications` (local scheduled) |
| PDF export | `expo-print` + `expo-sharing` |
| Cloud sync (optional) | Supabase (PostgreSQL + Auth + Edge Functions) |
| Build system | EAS Build (Expo Application Services) |
| CI/CD | GitHub Actions |

---

## Project Structure

```
nhs-shift-planner/
├── src/
│   ├── screens/           # App screens (Dashboard, Calendar, HoursSummary, etc.)
│   ├── components/
│   │   ├── atoms/         # Button, Badge, TextInput, etc.
│   │   └── molecules/     # BannerAlert, ShiftCard, etc.
│   ├── navigation/        # React Navigation stacks + tab navigator
│   ├── stores/            # Zustand stores (shiftStore, settingsStore, uiStore, themeStore)
│   ├── services/          # auth.ts, sync.ts, supabase.ts, notifications.ts
│   ├── database/
│   │   ├── db.ts          # expo-sqlite connection
│   │   └── repositories/  # shiftRepository, shiftTypeRepository, etc.
│   ├── hooks/             # useTheme, useNetworkStatus, useSnackbar
│   ├── theme/             # colors.ts, typography.ts, spacing.ts
│   ├── types/             # index.ts — all TypeScript types
│   └── utils/             # dateUtils, hoursCalculator, pdfExport
├── supabase/
│   ├── migrations/        # SQL migrations (applied via supabase db push)
│   └── functions/sync/    # Edge Function for bidirectional sync
├── fastlane/              # Fastfile + Appfile for App Store submission
├── scripts/               # setup.sh, build-ios.sh, run-tests.sh
├── .github/workflows/     # CI, build-ios, deploy-preview
├── app.json               # Expo config
├── eas.json               # EAS Build profiles
└── .env.example           # Environment variable template
```

---

## Development Setup

### Prerequisites

- Node.js 20+
- npm 10+
- For local iOS builds: macOS + Xcode 15+ (not required if using EAS Build)
- An [Expo account](https://expo.dev) (free)

### First run

```bash
# 1. Clone and install
git clone https://github.com/your-username/nhs-shift-planner.git
cd nhs-shift-planner
./scripts/setup.sh

# 2. Configure environment
cp .env.example .env.local
# Edit .env.local — at minimum, set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY
# Leave these blank to run fully offline with no cloud features

# 3. Start dev server
npm start
```

### Running on a device (bare workflow)

Expo bare workflow cannot use Expo Go. Build a custom dev client once:

```bash
eas login
eas build --platform ios --profile development
# Install the .ipa on your device via the EAS dashboard QR code
# Then start the dev server — the dev client app connects to it
npm start
```

### TypeScript checks

```bash
npm run ts:check
```

### Tests

```bash
npm test
npm run test:coverage
```

### Linting

```bash
npm run lint
```

---

## Building for iOS / TestFlight

### Prerequisites

- Apple Developer Program membership (£79/year)
- EAS credentials configured (`eas credentials`)

### Build for TestFlight (preview)

```bash
./scripts/build-ios.sh preview
# Builds on EAS cloud (~20-30 min) then submits to TestFlight automatically
```

### Build for App Store (production)

```bash
./scripts/build-ios.sh production
```

### CI/CD

Every push to `main` triggers:
1. `ci.yml` — lint, type-check, tests
2. `deploy-preview.yml` — EAS Build preview → TestFlight

See `.github/workflows/` for full pipeline config.

---

## Environment Variables

Copy `.env.example` to `.env.local` and fill in your values. The app works fully offline if Supabase vars are left empty.

| Variable | Required | Description |
|----------|----------|-------------|
| `EXPO_PUBLIC_SUPABASE_URL` | Optional | Your Supabase project URL |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Optional | Supabase anonymous key (safe to expose; RLS enforced) |
| `SUPABASE_SERVICE_ROLE_KEY` | CI only | Never bundle in app — Edge Function / CI use only |
| `EXPO_PUBLIC_APP_ENV` | Optional | `development` / `preview` / `production` |
| `EXPO_TOKEN` | CI only | Expo account token for GitHub Actions |
| `APPLE_ID` | CI only | Apple ID for Fastlane / EAS Submit |
| `ASC_APP_ID` | CI only | App Store Connect app ID (numeric) |
| `EXPO_PUBLIC_ENABLE_CLOUD_SYNC` | Optional | Set `true` to show cloud sync UI |

See `.env.example` for the full list including Apple/Fastlane variables.

---

## Database Schema Overview

The app uses SQLite locally (source of truth) mirrored to Supabase PostgreSQL (optional cloud backup).

### Core tables

| Table | Purpose |
|-------|---------|
| `users` | User profile — name, NHS trust, job role, contracted hours |
| `shift_types` | Shift type catalogue — Long Day, Night, Short Day, etc. with colour codes |
| `shifts` | All shift records — datetime, type, location, notes, status |
| `reminders` | Notification reminders per shift |
| `settings` | Per-user preferences — theme, pay period, dark mode |
| `bank_holidays` | Local cache of GOV.UK bank holiday data |
| `sync_log` | Audit trail for cloud sync operations |

All tables use soft deletes (`deleted_at`). All reads filter `WHERE deleted_at IS NULL`.

**Shift statuses:** `scheduled` · `in_progress` · `completed` · `cancelled` · `sick` · `annual_leave` · `swapped_out` · `swapped_in`

For the full schema, see:
- Local SQLite: [`docs/07-api-docs.md`](docs/07-api-docs.md)
- Supabase migration: [`supabase/migrations/20260421000001_initial_schema.sql`](supabase/migrations/20260421000001_initial_schema.sql)

---

## Supabase Setup (Optional)

Required only for cloud sync. The app works without this.

```bash
# Install Supabase CLI
brew install supabase/tap/supabase

# Link to your project
supabase link --project-ref your-project-ref

# Apply schema migrations
supabase db push

# Deploy the sync Edge Function
supabase functions deploy sync

# For local development (requires Docker)
supabase start
```

Create your project at [supabase.com](https://supabase.com). Choose a **European** region (London or Frankfurt) for GDPR compliance.

---

## Contributing

1. Fork the repo and create a branch from `develop`
2. Make your changes — follow the existing TypeScript and component patterns
3. Run `npm run lint && npm run ts:check && npm test` — all must pass
4. Submit a PR to `develop` (not `main`)
5. PRs require passing CI and at least one review before merge
6. `main` is protected — only merge from `develop` via PR

### Code style

- TypeScript strict mode — no `any` without a comment explaining why
- Functional components only — no class components
- Zustand stores for all shared state — no prop drilling
- Repository pattern for database access — no raw SQL in components or screens
- All new screens must follow the existing `useTheme()` pattern for styling

---

## Docs

| Document | Audience |
|----------|---------|
| [`docs/01-project-brief.md`](docs/01-project-brief.md) | Product context and feature scope |
| [`docs/02-architecture.md`](docs/02-architecture.md) | System design and tech decisions |
| [`docs/03-ux-design.md`](docs/03-ux-design.md) | UX flows and screen designs |
| [`docs/04-deployment.md`](docs/04-deployment.md) | Full deployment and CI/CD guide |
| [`docs/05-qa-report.md`](docs/05-qa-report.md) | QA test report |
| [`docs/06-user-guide.md`](docs/06-user-guide.md) | End user guide for NHS staff |
| [`docs/07-api-docs.md`](docs/07-api-docs.md) | Technical API and schema docs |

---

## Licence

MIT — see `LICENSE`.
