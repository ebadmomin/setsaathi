# Gym-Bot — Product and Technical Plan

## Status

**Planning in progress.** This document is our working source of truth. Items marked **Open** need a decision before implementation begins.

## Core constraint

The product must be buildable and usable with services that have a genuinely free, no-credit-card sign-up path. It should also remain useful if every optional cloud service is removed.

## Product concept

Gym-Bot is a personal fitness companion for beginners, regular gym-goers, and home exercisers. It helps people choose a training split, obtain a complete exercise plan, learn exercise form, follow workouts, record attendance/completion/skips, and track progress. Registered users also receive access to an AI fitness bot.

The same foundation must later support branded gym spaces, where gym owners operate under their gym name, publish plans, manage memberships/subscriptions, and view only their own members' information.

## Brand direction (proposed)

### Recommended name: SetSaathi

**SetSaathi** combines the universal gym term “set” with the familiar Hinglish word “saathi” (companion). It is easy to say for English/Hinglish users, works for a bot, and can grow into a gym-owner product: *SetSaathi for [Gym Name]*.

**Tagline:** *Move with purpose.*

Before registering a domain, company, or trademark, check its availability in each intended market. This planning document does not establish legal availability.

### Logo

The initial original vector logo is [assets/setsaathi-logo.svg](assets/setsaathi-logo.svg). It uses a navy wordmark with a coral accent and a compact dumbbell-inspired “S” mark. SVG keeps the logo crisp on web, Android, and print without introducing image licensing or compression issues.

### Other name directions (not selected)

- **RepSaathi** — more explicitly gym/lifting focused.
- **FormSaathi** — more beginner and technique focused.
- **FitFlow** — broad and polished, but less distinctive.

## Product scope and delivery order

“Everything” is the product direction, but releasing everything at once would produce a slow, unreliable first version. We will build every requested capability in these releasable layers.

### Release 1 — member foundation

1. Guest mode with a restricted exercise catalogue and sample plan; no saved history, AI bot, custom plan, or sync.
2. Account creation and sign-in for registered users.
3. Onboarding: goal, experience level, available days, equipment, preferred location (home/gym), and limitations.
4. Split selection and planning: full-body, upper/lower, push-pull-legs (PPL), bro split, and home-bodyweight plans.
5. A transparent rules-based plan generator that supplies exercises, sets, reps, rest, and substitutions.
6. Workout player: exercise, sets, repetitions/time, rest timer, completion, skipped-set reason, and notes.
7. Workout calendar with planned, completed, skipped, and rest-day statuses.
8. Exercise library with form cues, substitutions, and properly licensed media links/GIFs.
9. Progress history: attendance, workout completion, volume, weight/repetition improvements, and streaks.
10. Basic profile/settings, data export, and account deletion.

### First implementation slice: web authentication

The first screen we build is a combined web authentication page with three modes:

1. **Create member account:** name, mobile number, email address, and password.
2. **Member sign-in:** email or mobile number plus password.
3. **Admin sign-in:** email or mobile number plus password on the same page, with a clearly labelled Admin mode.

The page is a shared entry screen, not a shared permission level. The backend assigns an explicit `member` or `admin` role and verifies that role on every protected request. The browser must never decide that a person is an administrator on its own.

#### Authentication data rules

- Store `name`, normalized mobile number, normalized email, password hash, role, created time, and status in the user table.
- Never store a readable password, password hint, or password in logs.
- Require unique normalized email and unique mobile number; show a clear, non-sensitive duplicate message.
- Validate mobile-number format according to the initial target market; start with an international E.164-compatible storage format.
- Seed the first administrator through a server-side setup command/environment variables, not a public “admin registration” form.
- Guests remain browse-only and are not database accounts until they register.

### Release 1 product priority: the complete training loop

Plans, tracking, and the exercise library are one equally important feature set—not competing priorities:

```text
Choose goal and split → receive a plan → view form/GIF → complete or skip workout → see calendar/progress → adjust next plan
```

The first release is not complete until this whole loop works. We will start the exercise library with a curated core set that covers every exercise used in the initial plans, then add breadth incrementally.

### Selection UI: dropdowns first

Use mobile-friendly dropdown/select controls for structured choices so beginners do not have to know the terminology in advance. Examples:

| Screen | Dropdown choices |
| --- | --- |
| Onboarding | goal, experience level, training days/week, location, available equipment |
| Plan builder | split (PPL, upper/lower, full body, bro split, home/bodyweight), session length, focus muscles |
| Workout logging | set status, skip reason, perceived effort |
| Exercise library | muscle group, equipment, difficulty, location |

Each dropdown includes short plain-language helper text, e.g. “PPL: push, pull, legs—best for training 3–6 days a week.” The interface should use searchable selection where an option list is long; it should not rely on a dropdown for exercise names alone.

### Release 2 — registered-user bot and nutrition

1. AI fitness bot through OpenRouter, available only to authenticated users.
2. Server-side bot proxy: the OpenRouter API key is never shipped in the web or Android app.
3. Strict daily/member rate limits and message length limits.
4. Bot context based on the user’s plan, recent sessions, equipment, and stated goals.
5. Safety guardrails: no diagnosis, prescription, eating-disorder encouragement, or claims of professional medical advice; prompt users to consult qualified professionals where appropriate.
6. Nutrition tracking: meals, calories/macros as optional estimates, water, and personal targets.

### Release 3 — gym-owner product

1. Gym organization, brand name/logo, and owner/staff/member roles.
2. Gym-specific plans, exercise collections, announcements, and member assignment.
3. Owner dashboard for member activity, plan adherence, and attendance trends.
4. Subscription/membership records. Initially these are administrative records only; online payment processing is a separate future decision because it cannot be reliably zero-cost and needs legal/tax handling.
5. Multi-tenant data isolation: every gym-owned record has an organization ID and authorization checks must prevent cross-gym access.

### Deferred until later

- Paid online subscriptions and payment processing.
- Live personal trainers and social feeds.
- Wearable integrations.
- Medical or injury diagnosis.

## Users and jobs to be done

| User | Need | Product response |
| --- | --- | --- |
| Beginner | Start safely without knowing programming terms | Guided onboarding and simple routines |
| Regular gym-goer | Follow a repeatable plan and see improvement | Fast workout logging and progress charts |
| Home exerciser | Adapt workouts to limited equipment | Equipment filters and substitutions |

## Recommended architecture

```text
Web browser ──────────── Cloudflare Pages (static web app)
                              │ HTTPS API
Android app (Python/Kivy) ────┼── FastAPI (Python API) ── PostgreSQL/SQLite
                              │             │
                              │             └── OpenRouter (server-only bot calls)
                              └── licensed exercise-media URLs
```

- **Backend:** FastAPI + SQLAlchemy + Pydantic. This keeps the business logic, plan generator, and API in Python.
- **Web:** React + Vite + Tailwind CSS. This is free, mature, and gives the best browser experience.
- **Android:** Kivy + KivyMD, packaged with Buildozer. The application code is Python. Native Android build tooling is still required.
- **Data:** SQLite for development and a small self-hosted launch; PostgreSQL for gym/multi-user growth.
- **Authentication:** JWT access/refresh tokens managed by the FastAPI backend. This avoids depending on a third-party auth vendor.
- **Offline behavior:** Store an in-progress workout on-device; sync it after connectivity returns. Full offline-first conflict resolution is later work.

### Why not put the FastAPI server in Cloudflare Workers?

Cloudflare Pages is an excellent free frontend host. Cloudflare Workers runs JavaScript/TypeScript (with other runtime options), but is not a conventional always-on Python/FastAPI host. For a genuinely Python backend, the practical choices are a self-hosted FastAPI service or a separate free-tier Python host. We should use Cloudflare Pages now and keep the API portable behind a normal REST contract.

## Hosting decision

**Recommended launch setup:** Cloudflare Pages for the React web frontend + a self-hosted FastAPI server + SQLite (or PostgreSQL when required). Cloudflare stays responsible for the fast public web interface, while the Python server stays under our control and preserves the no-card goal.

Use a secure HTTPS tunnel or reverse proxy for the self-hosted API; do not expose a home-machine port directly. The computer hosting it must stay on and have backups. If this operational burden is unacceptable, we will research a specific free Python host at launch time, but its free tier could change or sleep.

Cloudflare Pages’ currently documented Free plan allows static assets without request charges and gives Pages Functions the Workers Free quota (100,000 daily dynamic requests shared with Workers); it also has a 20,000-file site limit. See the official [Pages limits](https://developers.cloudflare.com/pages/platform/limits/) and [Pages pricing](https://developers.cloudflare.com/pages/functions/pricing/) documentation.

| Need | Recommended no-cost launch option | Notes |
| --- | --- | --- |
| Web app | Cloudflare Pages | Static React app, Git-based deployments |
| Python API | Self-hosted FastAPI | Requires a machine that remains online |
| Development database | SQLite | Versioned migrations and regular backups |
| Production database | PostgreSQL or SQLite initially | Move before multi-gym scale |
| Android distribution | Direct APK / F-Droid | Google Play has a registration fee |
| AI bot | OpenRouter free models only | Rate-limited; see bot policy below |
| Notifications | Local Android/browser notifications | No paid push provider needed |

### OpenRouter bot policy

OpenRouter has free-model options, but it must not be considered unlimited production capacity: its current free plan is documented as 50 requests/day, and free model availability/rate limits can change. The bot will therefore launch as a limited registered-user feature, with a rules-based fallback for standard workout questions. See [OpenRouter’s free-model information](https://openrouter.ai/collections/free-models) and [pricing](https://openrouter.ai/pricing).

| Need | Primary free option | Fallback / notes |
| --- | --- | --- |
| Source control | GitHub Free | No card required for public/private repos |
| Web hosting | Cloudflare Pages | Static frontend; free tier and no card at sign-up historically; re-check before launch |
| API hosting | Self-host on an always-on personal machine | Truly no recurring cost; availability depends on machine/network |
| Database | SQLite on self-hosted API | Easiest zero-cost option; make automated backups |
| Android distribution | Direct APK download / F-Droid | Google Play requires a one-time developer registration fee, so it is excluded |
| Push notifications | Local notifications | Avoids a server push provider |

**Important:** Cloud free tiers and sign-up requirements can change. Before choosing a hosted provider, verify its current terms. The self-hosted API + SQLite path is the only option that does not rely on a vendor’s free-tier policy.

## Data model (draft)

- `users`: identity, profile and preferences.
- `organizations`: future gyms/brands.
- `organization_members`: role and member-to-gym relationship.
- `exercises`: name, instructions, muscles, equipment, media links and substitutions.
- `plans`: a user’s generated or saved program.
- `plan_days` and `plan_exercises`: ordered workouts and prescribed sets/reps/rest.
- `workout_sessions`: a performed workout, start/end time and notes.
- `calendar_events`: planned, completed, skipped, rest, or custom gym visit state; a skip reason is optional.
- `set_logs`: completed set, weight, reps, duration and perceived effort.
- `measurements`: optional body weight and measurements.
- `bot_messages`: role, content, safety/result metadata and rate-limit accounting; exclude sensitive prompt data from analytics.
- `nutrition_entries`: later optional meals and macro/calorie estimates.

## Safety and privacy baseline

- Ask for limitations only to adapt exercise suggestions; do not present medical advice.
- Let users delete their account and export their data as JSON/CSV.
- Collect only data needed for the app; no ads, trackers, or sale of data.
- Hash passwords with Argon2/bcrypt; use HTTPS in production; rate-limit sign-in routes.

## Key design rules

1. Every plan uses a deterministic rules engine first. The AI may explain or adjust a plan but never becomes the sole source of the prescribed workout.
2. The exercise record stores media attribution/license and a stable external or owned media URL. Do not copy random GIFs from Google Images or hotlink providers without permission.
3. Guest data stays local and is clearly labelled as not backed up. Registration can later import the guest’s local data.
4. Gym-owner capabilities are feature-flagged and do not complicate ordinary member screens.
5. All user-visible health guidance is educational, not medical advice.
6. Release 1 supports English and Hinglish. The code and content model should keep all visible strings translatable so Hindi/Urdu can be added later without a rewrite.

## Recommended improvements backlog

### Add to Release 1 if time permits

1. **Progressive overload suggestions:** after a user completes all prescribed sets, suggest a small next-session increase in weight or repetitions. Keep it optional and explain why.
2. **Exercise substitution button:** replace an unavailable or uncomfortable exercise while retaining the target muscle and movement pattern.
3. **Rest timer and plate calculator:** provide an in-workout countdown plus a simple “how to load this barbell” calculator.
4. **Quick log mode:** repeat the previous session’s sets/weights with one tap, then edit only what changed.
5. **Calendar adherence score:** show planned vs completed workouts, but avoid guilt-inducing language for skipped days.
6. **Personal records:** celebrate a new best weight, reps, or volume for an exercise.
7. **Search and filters:** search the exercise library by name, muscle, equipment, difficulty, and home/gym suitability.
8. **Form checklist:** show concise, actionable “before you start,” “during,” and “avoid” guidance alongside the GIF.

### Strong Release 2 additions

1. **Smart deload/recovery prompt:** suggest an easier week when completion, performance, or recovery signals indicate it may help; never present it as medical advice.
2. **Goal checkpoints:** let members set strength, attendance, bodyweight, or consistency goals and review them weekly.
3. **Shareable progress card:** create a privacy-safe image summarising a streak or personal record; no social network is required.
4. **PWA web app:** allow the web app to install like an app and retain core screens/cache for unreliable connectivity.
5. **Coach handoff in the bot:** offer safe predefined actions such as “change today’s exercise,” “explain PPL,” or “summarize my last week,” instead of relying only on open-ended chat.

### Gym-owner improvements for the future

1. **Member onboarding codes/QR:** a gym invites a member without manually entering their account data.
2. **Trainer plan templates:** coaches create one program and assign copies to selected members.
3. **Privacy-respecting dashboards:** owners see aggregate adherence by default; detailed member data requires an appropriate role and clear consent.
4. **Gym check-in:** optional QR/manual check-in, separate from a completed workout so attendance is not mistaken for training completion.
5. **Brand configuration:** logo, colors, gym contact information, and terms per organization—not separate app builds.

### Decisions that prevent future trouble

- Separate **gym check-in**, **workout completed**, and **workout skipped** as different events; they mean different things.
- Do not let the bot prescribe medical treatment, diagnose injuries, or expose its API key to clients.
- Start with a small, licensed media catalogue. Exercise GIF/video rights and load time are recurring product concerns.
- Build the data model for organizations early, but hide gym features until they are ready. Retrofitting tenant isolation later is risky.

## Delivery phases

1. **Web foundation:** GitHub repository, backend, migrations, guest/registered access model, and web shell.
2. **Web member MVP:** web exercise catalogue, split/plan generator, calendar, workout logging, and progress screen.
3. **Web hardening:** web accessibility, tests, backups, privacy controls, security review, and release documentation.
4. **Android client:** only after the web training loop is accepted; reuse the shared API, then add local in-progress-workout recovery, packaging, and Android testing.
5. **Bot and nutrition:** OpenRouter proxy/rate limits/guardrails, then meal tracking.
6. **Gym product:** organizations, roles, branding, owner dashboard, plan assignment.

### Delivery decision: web before Android

All first-release member features are designed, implemented, and verified on the web first. The web product establishes the API contract, data model, workout rules, and user feedback loop. Android starts only once the web member MVP has a verified guest browse flow, account/access controls, exercise library, plan generation, and workout tracking. This avoids building the same unfinished feature twice.

### Source control decision: GitHub is the source of truth

The GitHub repository stores code, non-secret documentation, migrations, tests, and approved assets. Work should be made in small focused commits after a milestone/task passes its checks. Never commit `.env` files, OpenRouter keys, passwords, API tokens, databases containing personal data, build outputs, or user workout data.

## Decisions needed to finalize the plan

1. What name should appear in the app: keep **Gym-Bot** or choose a brand name?
2. Which language(s) should Release 1 support: English only, Hindi/Urdu, or another combination?
3. Does “very limited guest access” mean only browse exercises/sample plans, or should guests also be allowed to log a single local workout?
4. Are you comfortable operating a self-hosted FastAPI service for the first launch, or should we evaluate a specific free Python host when we reach deployment?
5. Which feature must be polished first in Release 1: plan generation, workout/calendar tracking, or the exercise-media library?

## Definition of a finalized plan

The plan is ready for implementation after we agree on the target user, MVP priority, sign-in/offline choice, hosting path, and the first platform to launch.
