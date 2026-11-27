# SetSaathi Implementation State

## Current delivery order

1. **Web foundation and authentication** — complete
2. **Guest exercise library** — complete
3. **Deterministic plan generator** — complete
4. **Workout tracking and progress** — in progress
5. **Web hardening**
6. **Android client** — blocked until the web MVP is accepted

## Task ledger

| Task | Owner | Exclusive paths | Depends on | Acceptance criteria | Evidence | Status |
| --- | --- | --- | --- | --- | --- | --- |
| Local web/API foundation | Codex | `package.json`, `src/`, `backend/` | None | React build and FastAPI health endpoint run locally | Vite build and `/health` returned 200 | Complete |
| Registration and member/admin login | Codex | `src/`, `backend/app/` | Foundation | Hash passwords; member/admin role separation; responsive same-page UI | 2 automated tests passed; frontend build passed | Complete |
| Authentication automated tests | Codex | `backend/tests/` | Authentication | Cover register, login, duplicate user, role protection | `2 passed` | Complete |
| Guest exercise library | Codex | `backend/app/`, `src/` | Auth acceptance | Browse/search/filter curated licensed exercise data | Public API/filter test passed; frontend build passed | Complete |
| Deterministic plan generator | Codex | `backend/app/`, `src/` | Exercise library | Generate explainable plans from goal, experience, days, equipment, location and split | 4 automated tests passed; frontend build passed; verified signed-in plan generation | Complete |
| Workout tracking and progress | Codex | `backend/app/`, `src/` | Plan generator | Log/check in/skip distinct workout events and view them on a calendar | Change/skip events persist; check-in/calendar still pending | In progress |
| Dashboard BMI category | Codex | `src/body-tracker.js`, `src/body-tracker.css` | Body measurements | Show the adult BMI category with a matching card color and a source link | 83 kg / 173 cm displays 27.7 and Overweight in the browser; Vite build passed | Complete |
| Workout log three-day view | Codex | `src/top-tabs.js`, `src/workout-log-details.js`, `src/workout-log-details.css`, `src/workout-log-checkin.js`, `src/workout-log-checkin.css` | Workout tracking | Show readable previous, selected, and next day cards; separate attendance from exercise progress; show rest days without a borrowed plan | Browser checked all three cards and Rest day action; Vite build passed | Complete |
| Dashboard visual refresh | Codex | `src/dashboard-panels.js`, `src/body-tracker.js`, `src/dashboard-refresh.css`, `src/main.jsx` | Membership and tracking | Compact membership details, replace single-point chart with a useful starting state, clarify attendance controls and calendar progress on desktop and mobile | Browser reviewed dashboard at desktop and 390px mobile widths; Vite build passed | Complete |
| Hover depth across tabs and panels | Codex | `src/hover-depth.css`, `src/main.jsx` | Dashboard visual refresh | Navigation tabs and main panels rise above neighboring content on pointer hover; calendar cells use a lighter lift; reduced-motion preference removes animation | Vite build passed; live browser computed 3D transforms and shadows for a navigation tab and the membership card; screenshot saved | Complete |
| Sitewide design system | Codex | `src/site-unified.css`, `src/main.jsx` | Dashboard visual refresh | Shared colors, type, surfaces, controls and spacing across auth, Dashboard, Gym, Workout log, Workout plan, Exercise library, Progress and AI Coach; responsive and accessible focus states | Reviewed all seven signed-in pages at desktop and 390px mobile, auth at both widths, and confirmed no mobile horizontal overflow; Vite build passed | Complete |
| OpenRouter coach configuration | Codex | `backend/.env`, `backend/.env.example`, `backend/app/config.py`, `backend/app/database.py`, `backend/app/main.py`, `backend/run.py`, `src/coach.js`, `src/privacy.js`, `docs/OPENROUTER_SETUP.md` | AI Coach | Key remains server-side; app settings drive model, site URL, API port, database path, and CORS; saved plan and progress ground answers; old local answers do not block OpenRouter after a key is added; repeat AI answers reuse database cache | 14 backend tests passed, including model switch/cache and next exercise after saved progress; Vite build passed; local API and web health checks passed; frontend source and build contain no OpenRouter key reference | Complete |
| Dashboard card polish | Codex | `src/visual-refresh.css` | Shared visual system | Membership editor, body tracker, check-in and weekly tracker use consistent panel dimensions, field styling and hover depth | Vite build passed; membership editor reviewed in the live mobile browser | Complete |
| Sitewide typography and contrast | Codex | `src/styles.css`, `src/typography-refresh.css`, `src/main.jsx`, `src/coach.js` | Shared visual system | Use a distinct display, body and label font; increase faint small text across signed-in views; restore AI Coach after a page refresh | Browser reviewed all signed-in pages at desktop and mobile widths; font loading checked in browser; Vite build passed | Complete |

## Current local run commands

```powershell
.\.venv\Scripts\python.exe backend\run.py
npm run dev
```

## Security notes

- `backend/.env` is present locally with a generated `SECRET_KEY`; copy `backend/.env.example` on a fresh clone and set a unique secret.
- The local SQLite database and all secrets are ignored by Git.
- A public user registration always creates a `member`; admins are seeded server-side only.

## Cloudflare Worker + D1 API port (in progress)

Decision (product owner): replace the FastAPI/SQLite production API with a Cloudflare Worker + D1 so the deployed site works without a self-hosted server. The FastAPI code in `backend/` stays as the behavioural reference and local-dev option until the Worker is accepted.

| Task | Owner | Exclusive paths | Depends on | Acceptance criteria | Status |
| --- | --- | --- | --- | --- | --- |
| Port API to Worker + D1 | backend-security | `worker/`, `migrations/`, `wrangler.toml` | None | All `/api/*` and `/health` routes from `backend/app/main.py` behave the same; same-origin `/api` (no CORS, no `VITE_API_BASE_URL`); WebCrypto PBKDF2 password hashes + JWT HS256; secrets only via `wrangler secret`; D1 migrations + exercise seed; Vitest/Miniflare tests for auth, role separation, guest rejection, cross-user isolation | In progress |
| Provision D1 + deploy | Lead + product owner | Cloudflare account | Port | `wrangler d1 create`, apply migrations, set `SECRET_KEY`/admin secrets, deploy; needs owner's explicit go-ahead and login | Blocked on owner |

Risks: Argon2 is not viable in Workers CPU limits (use PBKDF2); existing local user hashes will not transfer (production DB starts empty); Python plan generator (`build_generated_plan`) must be ported faithfully to TypeScript.
Rollback: Worker is additive; revert `wrangler.toml` to assets-only.
