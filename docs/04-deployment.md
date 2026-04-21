# Deployment Guide — MyShifts

**Version:** 1.0  
**Platform:** iOS only (TestFlight → App Store)  
**Build system:** EAS Build (Expo Application Services)  
**Target cost:** £0/month (free tiers)

---

## Table of Contents

1. [Prerequisites](#1-prerequisites)
2. [First-Time Setup](#2-first-time-setup)
3. [Environment Configuration](#3-environment-configuration)
4. [Building for iOS](#4-building-for-ios)
5. [TestFlight Distribution](#5-testflight-distribution)
6. [App Store Release](#6-app-store-release)
7. [CI/CD Pipeline](#7-cicd-pipeline)
8. [Supabase Setup](#8-supabase-setup)
9. [Monitoring](#9-monitoring)
10. [Troubleshooting](#10-troubleshooting)
11. [Cost Breakdown](#11-cost-breakdown)

---

## 1. Prerequisites

### Accounts Required

| Account | Cost | Purpose |
|---------|------|---------|
| [Expo](https://expo.dev) | Free | EAS Build, EAS Submit |
| [Apple Developer](https://developer.apple.com) | £79/year | TestFlight + App Store |
| [Supabase](https://supabase.com) | Free | Backend DB + Auth |
| [GitHub](https://github.com) | Free | Source control + CI/CD |

### Local Tools (macOS only, for native builds)

```bash
# Install via Homebrew
brew install node
brew install --cask xcode     # Required for local iOS builds
brew install supabase/tap/supabase

# Install EAS CLI
npm install -g eas-cli

# Install CocoaPods
sudo gem install cocoapods
```

> **Note:** Local Xcode is NOT required if you use EAS Build (cloud). EAS builds iOS in the cloud — you only need Xcode if you want to run native builds locally.

---

## 2. First-Time Setup

### 2.1 Clone and install

```bash
git clone https://github.com/your-username/myshifts.git
cd myshifts
./scripts/setup.sh
```

The setup script will:
- Check Node 20+ is installed
- Install npm dependencies
- Create `.env.local` from `.env.example`
- Install CocoaPods (macOS only)
- Install Fastlane gems (macOS only)

### 2.2 EAS Login

```bash
eas login
# Enter your Expo account credentials
eas whoami  # Confirm you're logged in
```

### 2.3 Link project to EAS

```bash
# This creates/links the project on expo.dev
eas project:init
```

### 2.4 Configure signing credentials

EAS manages iOS certificates automatically. Run once:

```bash
eas credentials
# Select: iOS > App Store credentials
# EAS will generate and manage your Distribution Certificate and Provisioning Profile
```

---

## 3. Environment Configuration

### 3.1 Local development

Copy and fill in your credentials:

```bash
cp .env.example .env.local
```

Edit `.env.local`:
```
EXPO_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
EXPO_PUBLIC_APP_ENV=development
```

### 3.2 EAS Secrets (for CI/CD)

Store secrets in EAS (not in git):

```bash
# Add Supabase URL and key
eas secret:create --scope project --name SUPABASE_URL --value "https://your-project.supabase.co"
eas secret:create --scope project --name SUPABASE_ANON_KEY --value "your-anon-key"

# List stored secrets
eas secret:list
```

### 3.3 GitHub Actions Secrets

Add these in GitHub → Settings → Secrets and variables → Actions:

| Secret | Value |
|--------|-------|
| `EXPO_TOKEN` | From expo.dev → Account Settings → Access Tokens |
| `SUPABASE_URL` | Your Supabase project URL |
| `SUPABASE_ANON_KEY` | Your Supabase anon key |

---

## 4. Building for iOS

### 4.1 Development build (custom dev client)

Required for bare workflow (replaces Expo Go):

```bash
./scripts/build-ios.sh development
# Or directly:
eas build --platform ios --profile development
```

After the build completes, scan the QR code in the Expo dashboard to install on your device.

Start the dev server:
```bash
npm start
```

### 4.2 Preview build (TestFlight)

```bash
./scripts/build-ios.sh preview
# Or directly:
eas build --platform ios --profile preview
```

Then submit to TestFlight:
```bash
eas submit --platform ios --profile preview --latest
```

### 4.3 Production build (App Store)

```bash
./scripts/build-ios.sh production
# Then submit:
eas submit --platform ios --profile production --latest
```

### 4.4 Build profiles summary

| Profile | Distribution | Use case |
|---------|-------------|----------|
| `development` | Internal | Dev client for local development |
| `preview` | Internal (TestFlight) | Testing builds for Mathu |
| `production` | App Store | Public release |

---

## 5. TestFlight Distribution

### 5.1 Automated (CI/CD)

Every push to `main` automatically triggers a TestFlight build via the `deploy-preview.yml` workflow.

Timeline:
1. Push to `main` → GitHub Actions triggers
2. EAS Build starts (~20-30 min build time on free tier)
3. Build completes → EAS Submit sends to TestFlight
4. Apple processes the build (~15-30 min)
5. Build appears in App Store Connect → TestFlight
6. Mathu receives TestFlight notification

### 5.2 Manual submission

```bash
# Build and submit manually
eas build --platform ios --profile preview --non-interactive
eas submit --platform ios --latest
```

### 5.3 Adding testers

In App Store Connect → TestFlight:
1. Go to your app → TestFlight
2. Add Mathu's Apple ID as an internal tester
3. She'll get an email invitation

---

## 6. App Store Release

### 6.1 Checklist before first release

- [ ] Apple Developer account enrolled (£79/year)
- [ ] Bundle identifier registered in App Store Connect
- [ ] App record created in App Store Connect
- [ ] Privacy policy hosted and linked (required by Apple)
- [ ] App Store screenshots prepared (6.7" + 6.1" iPhone)
- [ ] App description and keywords written
- [ ] Age rating questionnaire completed
- [ ] `eas.json` updated with your `appleId` and `ascAppId`

### 6.2 App Store Connect IDs

After creating your app in App Store Connect, update `eas.json`:

```json
"submit": {
  "production": {
    "ios": {
      "appleId": "your-real-apple-id@example.com",
      "ascAppId": "1234567890",
      "appleTeamId": "XXXXXXXXXX"
    }
  }
}
```

### 6.3 Release process

```bash
# 1. Build production
eas build --platform ios --profile production

# 2. Submit to App Store
eas submit --platform ios --profile production --latest

# 3. In App Store Connect: add release notes, submit for review
# Review typically takes 24-48 hours
```

---

## 7. CI/CD Pipeline

### 7.1 Workflows

| Workflow | File | Trigger | What it does |
|----------|------|---------|-------------|
| CI | `ci.yml` | PR opened, push to `develop` | Lint, typecheck, test |
| Build iOS | `build-ios.yml` | Push to `main` | EAS Build production |
| Deploy Preview | `deploy-preview.yml` | Push to `main` | Build + submit to TestFlight |

### 7.2 Branch strategy

```
main        ← protected; triggers TestFlight deployment
develop     ← integration branch; CI only
feature/*   ← feature branches; CI on PR
```

### 7.3 Free tier limits

| Service | Free limit | Usage |
|---------|-----------|-------|
| GitHub Actions | 2,000 min/month | ~15 min/build × ~10 builds = 150 min |
| EAS Build | 30 builds/month | Typically 5-15 builds/month |
| EAS Submit | Unlimited | Free |

---

## 8. Supabase Setup

### 8.1 Create project

1. Go to [supabase.com](https://supabase.com) → New Project
2. Name: `myshifts`
3. Region: **Europe West (London)** or **EU Central (Frankfurt)** — GDPR requirement
4. Password: generate a strong password, save it

### 8.2 Run migrations

```bash
# Link local project to remote Supabase
supabase link --project-ref your-project-ref

# Push migrations to remote
supabase db push

# Verify
supabase db diff
```

### 8.3 Enable Row Level Security

Migrations in `supabase/migrations/` include RLS policies. Verify in Supabase dashboard:
- Database → Tables → each table should show "RLS enabled"

### 8.4 Deploy Edge Functions

```bash
# Deploy the sync function
supabase functions deploy sync

# Verify
supabase functions list
```

### 8.5 Local development

```bash
# Start local Supabase (requires Docker)
supabase start

# View local Studio
open http://localhost:54323

# Stop
supabase stop
```

### 8.6 Environment variables for Edge Functions

```bash
# Set secrets for Edge Functions
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

---

## 9. Monitoring

### 9.1 Build monitoring

- **EAS Dashboard:** https://expo.dev/accounts/[account]/projects/myshifts/builds
- Build notifications: enable email notifications in Expo account settings

### 9.2 App monitoring

- **Supabase Dashboard:** https://supabase.com/dashboard/project/[ref]
  - Database: query performance, table sizes
  - Auth: user signups, active sessions
  - Edge Functions: invocation logs, errors
  - Storage: usage

### 9.3 Crash reporting (V1.1)

For V1, rely on TestFlight crash logs (Xcode Organizer → Crashes).
In V1.1, add [Sentry](https://sentry.io) (free tier: 5K errors/month):
```bash
npx expo install @sentry/react-native sentry-expo
```

### 9.4 Health checks

Supabase provides uptime monitoring at https://status.supabase.com

For the app itself, no backend server to monitor (Supabase-managed).

---

## 10. Troubleshooting

### EAS Build fails

```bash
# Check build logs
eas build:list --platform ios
eas build:view [build-id]

# Common fixes:
# - Credentials issue: eas credentials --platform ios
# - Pod install failure: cd ios && pod install
# - TypeScript errors: npm run ts:check
```

### TestFlight submission rejected

Common reasons:
- **Missing privacy policy:** Add URL in App Store Connect → App Information
- **Missing export compliance:** Add `ITSAppUsesNonExemptEncryption = false` to `Info.plist` if not using custom encryption
- **Guideline 4.2:** App too simple — ensure core features work without login

### Supabase connection issues

```bash
# Check project status
supabase status

# Re-link if project changed
supabase link --project-ref your-new-project-ref

# Test connection
curl https://your-project.supabase.co/rest/v1/ \
  -H "apikey: your-anon-key"
```

### iOS build: CocoaPods error

```bash
cd ios
pod deintegrate
pod install
cd ..
```

---

## 11. Cost Breakdown

### Monthly costs (MVP)

| Service | Cost |
|---------|------|
| EAS Build (free tier: 30 builds/month) | £0 |
| EAS Submit | £0 |
| Supabase (free tier: 500MB, 5GB bandwidth) | £0 |
| GitHub Actions (free: 2,000 min/month) | £0 |
| **Total monthly** | **£0** |

### One-time costs

| Item | Cost |
|------|------|
| Apple Developer Program | £79/year |
| **Total one-time** | **£79** |

### When will costs increase?

| Threshold | Trigger |
|-----------|---------|
| >30 EAS builds/month | Active sprint pace → EAS Production $99/month |
| >500MB Supabase DB | ~50K active users → Supabase Pro $25/month |
| >2,000 GitHub Actions minutes | Heavy CI usage → GitHub Teams $4/user/month |

For MVP and early growth (up to ~5,000 users), all free tiers are sufficient.

---

*Deployment guide produced by DevOps Engineer Agent. Last updated: 2026-04-21.*
