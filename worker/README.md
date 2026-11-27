# SetSaathi Worker + D1 API

One Worker (`app`, see `../wrangler.toml`) serves the static app (`../dist`, SPA fallback)
and the API. Only `/api/*` and `/health` run the Worker code first; everything else is static assets.

Layout: `src/index.ts` (router + routes), `security.ts` (PBKDF2-SHA256 + HS256 JWT via WebCrypto),
`schemas.ts` (zod), `plans.ts` (deterministic generator), `coach.ts`, `equipment.ts`;
`../migrations/` (0001 schema, 0002 exercise seed, 0003 plan templates/variants,
0004 admin workspace, 0005 last sign-in tracking, 0006 muscle split templates,
0007 password-reset codes, 0008 workout sets, 0009 shared account and billing tables,
0010 staff notes, swaps, and payment collection fields, 0011 payment transaction references and collector name/login-ID snapshots);
`scripts/generate_seed.py` regenerates the seed migrations from a populated `backend/setsaathi.db`
(exercise source/licence metadata is preserved; no user data is read).
`scripts/generate_muscle_split_migration.py` regenerates the muscle split template migration.

The member's selected workout type is stored with their weekly plan. `GET /api/plans/settings`
returns the saved configuration; `PUT /api/plans/type` selects or explicitly changes the type;
`POST /api/plans/regenerate` rotates a new week within the selected type. Daily plan generation
uses the saved configuration. Requests that try to change the type through the ordinary weekly
or daily generation endpoints return HTTP 409.

## One-time owner steps (production)

Run from the repository root. These touch your Cloudflare account, so you run them.

```sh
npm install
npx wrangler login

# 1. Create the database, then copy the printed database_id into wrangler.toml
#    (replace REPLACE-WITH-YOUR-D1-DATABASE-ID).
npx wrangler d1 create setsaathi

# 2. Apply schema + seed to D1.
npx wrangler d1 migrations apply setsaathi --remote

# 3. Secrets (each command prompts for the value; never commit them).
npx wrangler secret put SECRET_KEY              # random, 32+ characters
npx wrangler secret put INITIAL_ADMIN_EMAIL
npx wrangler secret put INITIAL_ADMIN_MOBILE    # E.164, e.g. +919999999999
npx wrangler secret put INITIAL_ADMIN_PASSWORD
npx wrangler secret put INITIAL_ADMIN_USERNAME  # optional, default "administrator"
npx wrangler secret put INITIAL_ADMIN_NAME      # optional
npx wrangler secret put INITIAL_STAFF_PASSWORD  # seeds staff1 once; never commit the value
npx wrangler secret put INITIAL_STAFF_EMAIL     # optional staff contact
npx wrangler secret put INITIAL_STAFF_MOBILE    # optional staff contact
npx wrangler secret put OPENROUTER_API_KEY      # optional; without it the coach uses local retrieval
npx wrangler secret put BREVO_API_KEY           # optional; enables password-reset email
npx wrangler secret put BREVO_SENDER_EMAIL      # verified sender address in Brevo
# OPENROUTER_MODEL is a plain var in wrangler.toml (default openrouter/free).
# BREVO_SENDER_NAME is optional; default is SetSaathi.

# 4. Build and deploy.
npm run build
npx wrangler deploy
```

If the Worker is deployed through Cloudflare's GitHub integration, set `database_id` in
`wrangler.toml` before pushing; the `[build]` command (`npm run build`) creates `dist`, and the
secrets from step 3 must still be set once (dashboard: Worker, Settings, Variables and Secrets).
Migrations are not applied by the Git build; run step 2 after adding new migration files.
Password-reset email needs both Brevo secrets and migration 0007. Enter the key and sender
address in the Worker settings or via `wrangler secret put`; never put their values in Git.
For a move to a different Cloudflare account, follow [account migration](../docs/ACCOUNT_MIGRATION.md)
instead of the empty-database steps above.

The first administrator is created automatically on the first API request after the three
`INITIAL_ADMIN_*` secrets exist and no admin is in the database. There is no admin registration
route. Rotating `INITIAL_ADMIN_PASSWORD` later does not change an existing admin.
After migration 0009, `INITIAL_STAFF_PASSWORD` seeds `staff1` on the next API request.
The sign-in ID is case-insensitive, so `Staff1` works too.
The Worker stores a PBKDF2 hash; no password or hash is included in Git migrations.
Changing this secret later does not reset an existing staff account. Staff use the
Staff / Admin sign-in and see the floor and front-desk portal inside `/admin`.
They can create free member logins, check in members, view attendance and body trends,
add trainer notes, swap an exercise in today's generated plan, submit cash/UPI
payments without screenshot upload (online/UPI requires a transaction ID), view only their own collections, block members with
a reason, and send one in-app reminder per member per day. An owner must review
payments; staff cannot approve them or access owner-wide financials. Admins can
also block staff. Neither role can block an admin.

## Local development

```sh
cp .dev.vars.example .dev.vars        # then paste your local .env values (file is git-ignored)
npm run build
npx wrangler d1 migrations apply setsaathi --local
npm run worker:dev                    # http://127.0.0.1:8787, API + built app
# Optional: run `npm run dev` in another terminal for Vite hot reload.
# Vite proxies /api to this Worker, so staff features use this D1 runtime.
```

## Checks

```sh
npm run worker:test        # vitest in the Workers runtime (Miniflare, in-memory D1)
npm run worker:typecheck   # tsc --noEmit
npx wrangler deploy --dry-run
```

## Notes and limits

- PBKDF2 uses 100,000 iterations (the Workers maximum). Existing FastAPI/Argon2 hashes do not
  transfer directly. A full D1-to-D1 migration preserves the existing Worker password hashes
  and member accounts.
- Validation errors return HTTP 422 with `detail` as a readable string (the UI renders `detail`
  directly) plus an `errors` array in FastAPI's `{loc,msg,type}` shape.
- "Today" is the UTC date. Timestamps are naive UTC ISO strings, as in the FastAPI API.
- CPU limits: PBKDF2 and plan generation are CPU-heavy. On the Workers Free plan (10 ms CPU per
  request) registration/login or plan generation may be cut off; the Paid plan raises this.
  Test on the real account before announcing.
- Add a Cloudflare rate-limiting rule for `/api/auth/*` (not implemented in code).
- The admin workspace stores one gym and a private member roster per admin account. Roster
  entries are separate from SetSaathi login accounts. Sharing one roster across multiple
  owners or managers would require a later staff access model.
- Only the initial platform administrator (matching the configured admin username and email)
  can read `/api/admin/users`, which lists registered member accounts. Successful sign-ins
  update `last_login_at`. Existing accounts have no historical sign-in date until their next login.
- That administrator can block or unblock a registered member with
  `PUT /api/admin/users/{id}/status` and `{ "status": "blocked" | "active" }`.
  Blocked members cannot sign in or use existing tokens. The member app checks session access
  while open and shows the blocked-account message on the sign-in screen. This uses the existing
  `users.status` column; no new D1 migration is needed.
