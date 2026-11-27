# SetSaathi — Portfolio case study

**Role:** Forward Deployed Engineer / Full Stack Developer  
**Project:** Personal project  
**Status:** Web application deployed; Android application planned  
**Live site:** https://app.setsaathi.workers.dev/  
**Repository:** https://github.com/ebadmomin35/setsaathi

## Portfolio summary

SetSaathi is a gym companion web application that connects workout planning, gym attendance, exercise guidance, progress tracking, and membership management in one place. I translated a broad product idea into a deployed application, iterating on real user flows and feedback from the login page through the workout and progress experience. The production system runs on a Cloudflare Worker with a D1 database; the React frontend and API share one deployment and origin.

## Problem and approach

Gym members often have their plan, attendance, exercise instructions, and body measurements spread across separate tools. SetSaathi brings those tasks into a single workflow: select a plan, see the day’s exercises, record attendance and exercise outcomes, and review progress over time. The product also accounts for the equipment available at a gym and gives users alternatives when a movement does not suit them.

I built the project in successive releases, using UI feedback to reshape the dashboard, navigation, workout controls, mobile layout, typography, and exercise instructions. I then adapted the initial local Python/FastAPI and SQLite implementation for a Cloudflare Worker and D1 production deployment.

## Delivered features

- **Accounts and access:** Member registration and login, separate admin access, password hashing, signed sessions, and a browsable guest exercise library.
- **Exercise library:** 902 seeded exercises searchable by muscle, equipment, difficulty, and category, with instructions, posture and safety guidance, media where available, and source/license metadata.
- **Workout planning:** Published plan templates with 216 seeded variants; selection by experience, goal, split, training days, equipment, and spine-safety preference. Plan generation avoids repeating exercises within a week and rotates plan signatures over a 14-day window where eligible alternatives exist.
- **Gym context:** Membership dates and status, gym location, and an editable inventory of gym equipment used to filter suitable exercises.
- **Workout and attendance tracking:** Daily gym done, skipped, and rest-day records; exercise done, skipped, changed, and undo actions; previous, selected, and next day views; linked weekly and monthly calendars.
- **Progress:** Daily height and weight measurements, a weight trend, weekly/monthly changes, and an adult BMI category display.
- **AI Coach:** Retrieval over the exercise library and saved user context, with per-user question-and-answer caching. OpenRouter is an optional server-side integration; the coach has a local retrieval fallback when an API key is unavailable.

## Engineering work

- Built the responsive interface with **React, JavaScript, CSS, and Vite**.
- Implemented the production API in **TypeScript on Cloudflare Workers**, with **Cloudflare D1** for persistent data and SQL migrations for schema and seed data.
- Served the Vite build and `/api/*` from one Worker, allowing same-origin API calls.
- Implemented validation, role checks, password hashing, and signed access tokens in the Worker.
- Kept OpenRouter credentials server-side and cached repeat coach answers in D1 to reduce repeat model calls.
- Used **Wrangler, Vitest, and TypeScript type checking** for local development and deployment checks.
- Retained the earlier **Python/FastAPI and SQLite** backend as a local development option and behavioral reference during the production migration.

## Forward Deployed Engineer angle

This project demonstrates the work of turning a user’s evolving requests into a usable system: gathering requirements, deciding what data must persist, connecting the interface to the API, responding to usability problems, and adapting the deployment architecture to the target platform. The product requirements changed repeatedly during development, so I maintained continuity across features instead of treating the dashboard, plans, logs, equipment, and coach as separate demos.

## Outcome and current scope

The web application is deployed on Cloudflare with a D1-backed API. A member account and workout history were migrated from the local database into D1 during deployment. Android remains a future phase. The OpenRouter-backed response path depends on a configured API key; the app can answer from local retrieval without one. The project has no published adoption, revenue, or performance figures, so none are claimed here.

## CV version — concise

**SetSaathi | Forward Deployed Engineer / Full Stack Developer | Personal Project**  
Built and deployed a gym companion web app on React, Cloudflare Workers, and D1, connecting workout plans, exercise guidance, attendance, progress, and gym membership in a single user flow. Ported an initial FastAPI/SQLite implementation to a same-origin Worker API, seeded 902 exercises and 216 plan variants, and implemented equipment-aware plan selection, 14-day plan rotation, secure member/admin access, and a retrieval-based AI Coach with cached answers.

## CV bullet options

- Translated evolving gym-member requirements into a deployed React application with connected planning, daily workout logging, attendance calendars, membership management, and body-progress tracking.
- Migrated the production API from a local FastAPI/SQLite prototype to TypeScript on Cloudflare Workers with D1 persistence, SQL migrations, and same-origin frontend/API delivery.
- Seeded and organized a 902-exercise library and 216 plan variants; built equipment-aware, experience-aware workout generation with safety preferences and a 14-day plan rotation.
- Added an exercise-grounded AI Coach with per-user answer caching and optional OpenRouter integration, keeping provider credentials on the server.
- Iterated on desktop and mobile UI based on observed usability issues, including navigation, workout action clarity, instruction readability, and dashboard consistency.

## Interview talking points

1. **How I handled changing scope:** I kept the core entities—user, gym, equipment, plan, workout log, measurement—connected as requirements expanded.
2. **Why Cloudflare:** A single Worker could serve the static build and API, while D1 stored application data. This removed the need for a separately hosted production FastAPI server.
3. **How plan selection works:** Published templates and variants supply candidate exercises; filters apply experience, equipment, and safety preferences; recent signatures constrain repetition.
4. **How the coach controls cost:** It retrieves relevant exercise and user context, checks a user-specific answer cache, and calls OpenRouter only when configured and needed.
5. **What I would improve next:** Production monitoring and rate limiting, deeper automated end-to-end coverage, more robust gym/place verification, and the planned Android client.

## Accuracy notes before publishing

- Describe this as a **personal project**, unless you can independently document a client or employer engagement.
- Do not claim Android has shipped, or that OpenRouter responses are active on the live site, without verifying those conditions.
- Do not claim user growth, revenue, uptime, or a measured reduction in API cost; those metrics have not been recorded.
- The repository currently contains a local commit that removes tracked SQLite database files but has not been pushed to GitHub. Confirm the public repository state before presenting it as a clean code sample.
