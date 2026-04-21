# Project Brief — NHS Shift Planner
**Version:** 1.0 MVP  
**Produced by:** Briefing Analyst Agent  
**Date:** 2026-04-21  
**Status:** Ready for Systems Architect handoff

---

## 1. Project Overview & Goals

### The Problem
NHS staff receive shifts through fragmented, incompatible channels — paper rotas, email, WhatsApp, and departmental systems. This creates three recurring pain points:

1. Losing track of the schedule across sources
2. Missing shift reminders
3. Inability to accurately verify pay against hours worked

### The Solution
A free, offline-first, cross-platform shift management app purpose-built for NHS staff. It aggregates shifts entered manually into a single source of truth, provides smart reminders, and delivers clear hours/pay-period summaries.

### Goals (MVP)
- Give staff a single place to track all shifts from any source
- Reduce missed shifts via reliable local push notifications
- Enable hour-tracking to help staff verify contracted vs worked hours
- Operate fully offline; cloud sync is optional, not required
- Launch free on iOS, Android, and Web (PWA)

---

## 2. Target Audience

### Primary: NHS Staff (Standard User)
Any NHS-employed individual who works shift patterns, including:

| Sub-group | Notes |
|-----------|-------|
| Nurses & Midwives | Core audience — shift-heavy, often work nights |
| Healthcare Assistants (HCAs) | Similar needs, may be less tech-savvy |
| Junior Doctors | Complex rotating shift patterns, critical hours awareness |
| Allied Health Professionals | Physios, radiographers, OTs — variable shift patterns |
| Bank/Agency Staff | Multiple locations, irregular shifts — high complexity |
| Admin & Support Staff | May have simpler patterns but still shift-based |

### Key Behavioural Traits
- Often mid-task in demanding environments; UI must be fast and glanceable
- May use devices in poor lighting (night shifts) or while wearing gloves → high contrast, large tap targets mandatory
- Smartphone-first; web may be used on ward PCs or at home
- Trust is critical — this app touches pay and attendance data

### Secondary: V2 Admin Users (Out of MVP Scope)
Ward managers and HR coordinators who would push templates and view team rotas. **Not in V1.**

---

## 3. Core Features — MVP Scope

### P0 — Must Have (Launch Blockers)

| Feature | Notes |
|---------|-------|
| Add / Edit / Delete shifts | Fields: type, date, start/end time, location, notes, bank shift toggle |
| Calendar view (monthly + weekly) | Colour-coded dots by shift type |
| Shift detail view | Full info: time, location, notes, duration, reminder |
| Local push notification reminders | Customisable lead time; local scheduled, no server required |
| Hours calculator | Daily, weekly, monthly totals |
| Offline-first local storage | SQLite via expo-sqlite; app fully functional without internet |
| Night/Day shift type differentiation | Distinct types; extensible via shift_types table |
| Duplicate/overlap detection warning | User can override |
| Undo delete | 5-second snackbar; no trash/soft-delete required beyond this |
| Basic theme customisation | Colours + system font only |
| Dashboard / Home screen | Today's shift, week strip, next 5 upcoming, FAB, bottom tab |
| Splash / Onboarding | First-launch only; 3-step carousel; notification permission request; no login required |
| Midnight-crossing shift support | Full datetimes, not just times |
| Notifications denied handling | Yellow banner → device settings deep link |

### P1 — Should Have (Target for MVP+ / Sprint 2)

| Feature | Notes |
|---------|-------|
| Home screen widget | Next shift; iOS (react-native-widget-extension) + Android (Glance); refreshes every 15 min |
| Cloud backup via Supabase | Optional sync; free tier; requires auth |
| Export shifts to PDF | Via expo-print + expo-sharing |
| iCal / Google Calendar export/import | Bidirectional; .ics format |
| Pay period hours summary | Configurable pay period start day in settings |
| Shift notes / comments | Already in DB schema; simple text field |
| Multiple reminder times per shift | reminders table supports multiple rows per shift_id |
| Shift templates | Long Day, Night, Short Day presets |
| Bank holiday awareness | UK bank holiday calendar; visual differentiation |

### P2 — Nice to Have (V1.x or V2)

| Feature | Notes |
|---------|-------|
| Annual leave tracking | Separate from shift types |
| Overtime calculator | Needs NHS banding logic |
| Sick day logging | Status enum in shifts table already supports this |
| Dark mode toggle | settings.dark_mode already in schema |
| Hours breakdown by ward / department | Requires location tagging at entry |
| CSV export | Minor addition alongside PDF |
| Colour-code shifts by shift type | shift_types.colour_hex already in schema |
| Shift swap request logging | Local record only — no messaging |
| NHS banding / pay rate estimator | Complex, jurisdiction-specific |

---

## 4. Technical Constraints & Preferences

### Stack (Specified in Raw Spec)
| Layer | Technology | Rationale |
|-------|-----------|-----------|
| Mobile | React Native (Expo) | Single codebase iOS + Android |
| Web | Next.js (React) | PWA; shared component library |
| Local DB | expo-sqlite (SQLite) | Offline-first; device-local |
| Cloud sync | Supabase (PostgreSQL) | Optional; free tier available |
| Auth | Supabase Auth OR local PIN | Optional; no login required for core use |
| Notifications | Expo Notifications | Local scheduled; no backend needed |
| State management | Zustand | Lightweight; no Redux |
| Widgets | react-native-widget-extension (iOS) + Glance (Android) | Platform-specific implementations |
| Charts | Victory Native or react-native-chart-kit | TBD — pick one, don't use both |
| Export | expo-print + expo-sharing | PDF + share sheet |

### UI/UX Constraints
- **NHS Blue** as primary colour (#005EB8 — confirm against NHS brand guidelines)
- **System fonts only** — no custom font loading
- **Minimum 44px tap targets** — gloves + urgency use cases
- **High contrast** — hospital lighting, accessibility compliance (WCAG AA minimum)
- **No decorative complexity** — clinical-but-warm aesthetic

### Platform Constraints
- Must work fully offline (SQLite as source of truth)
- Cloud sync is optional layer — not a dependency for core features
- Auth is optional — local PIN or anonymous use should be possible
- No NHS Login integration in V1 (explicitly out of scope)

### ⚠️ Ambiguity: Web vs Mobile Feature Parity
The spec lists both React Native (Expo) and Next.js (web) but doesn't clarify which features apply to web. Widgets clearly won't work on web. Clarify: **Is the web app a full feature port, or a companion/secondary experience?**

---

## 5. Success Metrics

### Adoption
- 1,000 active users within 3 months of launch (baseline target — raw spec doesn't specify)
- App Store / Google Play rating ≥ 4.2 stars
- ≥ 60% D7 retention (users returning after 7 days)

### Engagement
- ≥ 70% of users have at least one active shift reminder set
- ≥ 50% of users check the Hours Summary tab at least once per pay period
- Offline usage without error tracked via local analytics events

### Quality
- Crash-free rate ≥ 99.5%
- Notification delivery success rate ≥ 98% (local scheduled)
- Zero data loss events on app update or reinstall (backup/restore flow)

### ⚠️ Gap: No success metrics defined in raw spec. The above are proposed defaults — confirm with stakeholders.**

---

## 6. Timeline Estimate

Assuming 1–2 developers using AI coding agents (Cursor/Copilot), Expo managed workflow.

| Phase | Duration | Deliverables |
|-------|----------|-------------|
| **Phase 0 — Setup** | Week 1 | Repo, Expo project, Supabase project, DB schema, CI/CD skeleton |
| **Phase 1 — Core P0** | Weeks 2–4 | Shift CRUD, calendar view, local DB, offline mode, notifications, dashboard |
| **Phase 2 — Polish P0** | Week 5 | Overlap detection, undo delete, onboarding, edge cases (midnight shifts, denied perms) |
| **Phase 3 — P1 Features** | Weeks 6–8 | Cloud sync, widgets, export (PDF/iCal), pay period summary, templates |
| **Phase 4 — QA & Launch** | Weeks 9–10 | TestFlight / Play beta, bug fixes, App Store submission, web PWA deploy |

**Total: ~10 weeks to public launch (MVP)**

P2 features feed into a V1.x sprint post-launch based on user feedback.

---

## 7. Revenue Model Analysis

### Current Model: Free
The spec explicitly states free to use with no monetisation mentioned.

### Potential Future Revenue Paths

| Model | Viability | Notes |
|-------|----------|-------|
| **Freemium — Cloud Sync Premium** | ⭐⭐⭐⭐ | Core app free; cloud backup, cross-device sync, multi-device access behind £1.99–£2.99/month. Low friction — most users will try free first. |
| **One-time Pro Unlock** | ⭐⭐⭐ | £3.99–£6.99 one-time for advanced features (overtime calc, pay estimator, CSV export, annual leave). Good for NHS staff who dislike subscriptions. |
| **Trust/Organisation Licence** | ⭐⭐⭐⭐⭐ | Sell to NHS Trusts directly — admin tier, team rota management, SSO/NHS Login integration. B2B SaaS, £X/seat/month. Highest revenue potential. |
| **NHS Framework / Digital Marketplace** | ⭐⭐⭐ | Register on G-Cloud / NHS Digital marketplace for procurement by Trusts. Requires DCB0129 clinical safety assessment if used clinically. |
| **Referral / Affiliate** | ⭐ | Staffing agencies, bank shift platforms — likely too niche to scale. |

### Recommended Path
1. **Launch free** to build user base and trust
2. **Add freemium cloud sync** in V1.1 — natural upsell once users have data they want to protect
3. **Build Admin tier (V2)** — target Trust procurement

### ⚠️ Note: If the app ever influences clinical decision-making (e.g., flagging fatigue/overtime that affects patient safety), it may require DCB0129 compliance. Avoid any clinical safety claims in marketing copy.

---

## 8. Risks & Assumptions

### Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Users won't manually enter shifts | High | High | Make entry fast (templates, time pickers, iCal import). Widget reinforces habit. |
| Notification reliability on Android | Medium | High | Test across manufacturers (Samsung, OnePlus — known to kill background processes). Document battery optimisation steps. |
| SQLite data loss on app uninstall | Medium | High | Prompt cloud backup on first sync; clear warning in UI that data is local |
| App Store rejection (widget complexity) | Low | Medium | Follow Apple guidelines strictly; test with TestFlight early |
| GDPR / data residency concerns | Medium | High | Supabase EU region; no PHI stored; user_id pseudonymous only |
| Scope creep during development | High | Medium | Strict MoSCoW; all P2 features gated behind post-launch backlog |
| Widget stale data complaints | Medium | Low | Already addressed: 15-min refresh + on-app-open refresh |

### Assumptions
- Users will manually enter shifts (no integration with NHS systems in V1)
- NHS Blue (#005EB8) is acceptable — confirm against current NHS Digital brand pack
- Supabase free tier is sufficient for MVP user volumes
- No clinical safety regulation applies at V1 (app is a personal organiser, not a clinical system)
- UK-only bank holidays for V1 (no Wales/Scotland/NI variants handled separately unless specified)
- Pay periods are fixed weekly cycles (configurable start day) — not NHS Agenda for Change pay cycle complexity
- Auth is truly optional — local-only usage is a first-class supported mode

---

## 9. Out of Scope (V2+ Only)

These are **explicitly excluded** from V1:

| Feature | Reason |
|---------|--------|
| Admin / Ward Manager tier | Requires multi-user architecture, significant backend work |
| In-app messaging / shift swap requests | Messaging platform complexity; safeguarding risk |
| NHS Login integration | Requires NHS Digital partnership and IG compliance |
| Payslip verification | Requires integration with payroll systems |
| Multi-employer profiles | Complex data model; edge case for MVP |
| Apple Watch support | Separate WatchOS app; high dev cost |
| AI-generated rota optimisation | Requires rota data, ML infrastructure |
| Team rota visibility | Admin-tier dependency |
| Android / iOS cross-device background sync | Deferred pending cloud sync maturity |
| Clinical safety / DCB0129 certification | Only relevant if app enters clinical workflows |

---

## 10. Handoff Notes for Systems Architect

### What You're Building
An offline-first, cross-platform mobile + web shift management app. The architecture must treat the **local SQLite database as the source of truth**. Cloud sync is a secondary layer, not a dependency.

### Key Architecture Decisions to Make

1. **Mono-repo or separate repos?**  
   React Native (Expo) + Next.js web could share a monorepo (Turborepo/Nx). Shared component library would reduce duplication. Recommend monorepo.

2. **Shared component strategy**  
   Web and mobile share logic (hooks, Zustand store, DB schema types) but NOT components (React Native ≠ React DOM). Plan for a `packages/core` shared layer.

3. **SQLite sync strategy**  
   When cloud sync is enabled, need a conflict resolution strategy (last-write-wins is simplest; timestamp-based). Soft deletes (`deleted_at`) are already in schema — good. Ensure sync handles schema migrations gracefully.

4. **Auth is optional — design for it**  
   Local anonymous use must work without any Supabase session. user_id in local DB can be a device-generated UUID until the user opts into cloud sync / creates an account.

5. **Notification architecture**  
   All notifications are local-scheduled (Expo Notifications). No server-side push infrastructure needed for V1. Notification IDs stored in `reminders` table to allow cancellation/rescheduling.

6. **Widget implementation**  
   - iOS: react-native-widget-extension (requires Expo bare workflow or custom dev client — NOT compatible with Expo Go)
   - Android: Glance (Jetpack Compose-based)
   - Both read from shared local DB; widget refresh every 15 min + app open
   - ⚠️ Widget support likely forces **Expo bare workflow** — this is a significant architectural decision. Confirm before starting.

7. **Export pipeline**  
   PDF via expo-print (HTML → PDF); iCal via .ics generation (string templating, no library needed); CSV via string join. All triggered via expo-sharing share sheet.

8. **DB schema is largely defined** in the raw spec. Review:
   - `shifts.status` ENUM values are not defined — define them (e.g., `scheduled`, `completed`, `cancelled`, `sick`, `annual_leave`)
   - `shift_types` has `is_paid` — clarify how this is used (hours calculator should exclude unpaid?)
   - `settings` table is user-scoped — for anonymous local users, this maps to a static device UUID

9. **GDPR**  
   No PII is required for core functionality. If cloud sync enabled, email is collected. Store data in Supabase EU region. Provide data export + account deletion in settings.

10. **Bank holidays**  
    UK bank holiday data can be sourced from the GOV.UK Bank Holidays API (free, JSON): `https://www.gov.uk/bank-holidays.json` — cache locally, refresh periodically.

### Open Questions for Stakeholders (Flag Before Build)

| # | Question | Blocks |
|---|----------|--------|
| 1 | Is web a full feature port or lightweight companion? | Web scope, component strategy |
| 2 | Do widgets force bare Expo workflow — is that acceptable? | Entire build approach |
| 3 | What are the `shifts.status` ENUM values? | DB schema, hours calc |
| 4 | What constitutes the pay period? Fixed weekly cycle or NHS AfC monthly? | Hours summary feature |
| 5 | Are there multiple NHS Trust colour schemes to support? | Theme engine |
| 6 | UK bank holidays only, or Wales/Scotland/NI variants too? | Bank holiday awareness |
| 7 | What success metrics / KPIs does the product owner want to track? | Analytics design |
| 8 | Who owns the App Store / Google Play developer accounts? | Launch logistics |
| 9 | Is there a design system / Figma file, or is the spec the design brief? | UI build speed |
| 10 | What is the data retention / deletion policy for cloud sync users? | GDPR compliance |

---

*Brief produced by Briefing Analyst Agent. All ambiguities flagged above should be resolved before the Systems Architect begins infrastructure design.*
