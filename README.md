# SetSaathi

SetSaathi is a gym companion web app for planning workouts, recording attendance and exercise progress, browsing exercise instructions, tracking gym membership and body measurements, and asking the AI Coach questions.

Members select a workout type (Full body, Upper/lower, Push pull legs, or Muscle split). SetSaathi saves that type and uses it for daily plans and future weekly plans until the member explicitly changes it in Workout plan. A new week can rotate exercises while keeping the selected type.

Admins have a separate gym console. They can view registered member and staff accounts in **Members**. Staff sign in through the Staff / Admin form and get a limited floor and front-desk portal: member onboarding, check-in, attendance and body trends, trainer notes, daily exercise swaps, reminders, and payment collection awaiting owner review. Staff cannot approve payments or see owner-wide financials. **Gym roster** holds manually managed gym membership records, renewal dates, and follow-ups; those records remain separate from SetSaathi login accounts.

## UI rule

Every UI fix or visual upgrade must be reviewed and applied to both the member website and admin console in the same task. Shared colors, fonts, interaction effects, accessibility states, and responsive behavior should stay aligned. See [project rules](AGENTS.md).

## Current live site

[app.setsaathi.workers.dev](https://app.setsaathi.workers.dev/)

The site runs as one Cloudflare Worker: Vite builds the React frontend into `dist/`, the Worker handles `/api/*` and `/health`, and Cloudflare D1 stores account and workout data. The app uses same-origin API calls in production.

## Project layout

| Path | Purpose |
| --- | --- |
| `src/` | React app, feature modules, and styles |
| `worker/` | Cloudflare Worker API |
| `migrations/` | D1 schema and seed data |
| `backend/` | FastAPI local development and reference implementation |
| `docs/` | Exercise data, deployment, and integration notes |
| `wrangler.toml` | Worker, static assets, and D1 configuration |

## Local development

Install Node.js and run from the repository root:

```sh
npm ci
npm run build
```

To run the complete app with a local D1 database, copy `.dev.vars.example` to `.dev.vars`, fill in local secrets, then run:

```sh
npx wrangler d1 migrations apply setsaathi --local
npm run worker:dev
```

Wrangler serves the frontend and API together at `http://127.0.0.1:8787`. For Vite hot reload, keep Wrangler running and start `npm run dev` in a second terminal; Vite proxies `/api` to the local Worker, so both modes use the same D1 API. The older FastAPI reference backend can still be selected explicitly with `VITE_API_BASE_URL=http://127.0.0.1:8007`, but it does not implement the Phase 3 staff routes. See [Worker setup](worker/README.md) for the full local and Cloudflare setup.

## Deploying changes

The current Cloudflare Worker is connected to the personal GitHub repository's `main` branch. A push to `main` can build and deploy to that existing Worker. The build command is `npm run build`; the deploy command is `npx wrangler deploy`. Apply any new D1 migrations separately before deploying code that needs them:

```sh
npx wrangler d1 migrations apply setsaathi --remote
```

The set, rep, and weight log requires `migrations/0008_workout_sets.sql`. Include `src/`, `worker/src/`, and `migrations/` when uploading these changes to GitHub, and apply the remote migration before using the new log on the live site.

Shared account access also requires `migrations/0009_shared_accounts.sql`. Apply it to the same D1 database before deploying the Phase 2 Worker. Set `INITIAL_STAFF_PASSWORD` as a Worker secret to seed `staff1` with a Worker-generated PBKDF2 hash on the next API request; the password is never stored in Git. The new `memberships`, `payments`, and `reminders` tables are schema groundwork for later member, staff, and admin flows.

The staff portal adds `migrations/0010_staff_portal.sql` and `migrations/0011_payment_reference.sql`. Staff record a cash or online/UPI amount without uploading a screenshot. Online payments require a UTR or transaction ID; the D1 payment remains `pending_review` until an owner verifies it. Each payment stores the submitting staff account ID plus snapshots of their name and login ID, shown in My collections. The staff collections page only shows submissions made by the signed-in staff member. The one-tap reminder is currently an **in-app** reminder shown to the member on sign-in; it does not send WhatsApp or email. R2 storage is not required.

```sh
npx wrangler d1 migrations apply setsaathi --remote
```

Cloudflare's Git deployment does not apply D1 migrations automatically. For a manual GitHub upload, include `src/`, `worker/src/`, `migrations/0010_staff_portal.sql`, `migrations/0011_payment_reference.sql`, `wrangler.toml`, and this README. Keep local `.dev.vars`, `.npm-cache/`, `node_modules/`, and `dist/` out of Git.

Cloudflare secrets, including `SECRET_KEY`, `OPENROUTER_API_KEY`, `BREVO_API_KEY`, and `BREVO_SENDER_EMAIL`, belong in Worker settings or Wrangler secrets. Brevo powers password-reset email; OpenRouter powers AI Coach responses. See [Worker setup](worker/README.md) for their exact configuration and [account migration](docs/ACCOUNT_MIGRATION.md) before connecting this repository to a new Cloudflare account. Never commit `.dev.vars`, `.env`, tokens, passwords, local SQLite databases, or D1 exports. Signing in to GitHub in a browser does not authenticate the Git CLI; use `gh auth login -h github.com` when pushing from a new machine.

If you want to upload code without changing the current live site, push it to a branch other than `main` first. Older commits contain generated `dist/` and Python `__pycache__/` files; these are not required for deployment and should not be uploaded again. A previously exposed OpenRouter key in Git history was revoked; removing the file later did not erase that old commit.

## Checks

```sh
npm run build
npm run worker:typecheck
npm run worker:test
```

See [OpenRouter setup](docs/OPENROUTER_SETUP.md) for AI Coach configuration and [exercise library notes](docs/EXERCISE_LIBRARY.md) for exercise data and licensing.
