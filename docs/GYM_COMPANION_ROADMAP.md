# SetSaathi Personal Gym Companion Roadmap

## Current foundation

- Authentication: member and admin sign-in, 30-minute local session.
- Member profile and gym-membership record/history.
- Rule-based plan generation and workout skip/change events.
- Central SQLite exercise table, public filtering endpoint, and starter catalogue.
- Exercise schema now supports category, secondary muscles, posture, breathing, safety, and independently managed media URLs.

## Product rule

Do not create dashboard metrics until the actual workout log produces them. Exercise data must be referenced by ID everywhere; it must not be copied into plans, history, or UI components.

## Stage 1 — Exercise library and planning foundation

1. Complete a reviewed exercise catalogue by category, equipment, difficulty, and movement pattern.
2. Add details screen with exact exercise media or an explicit licensed-media placeholder.
3. Add bookmarks and exercise selection in custom workout plans.
4. Add plan, workout-day, and plan-exercise database entities.
5. Add templates: full body, PPL, upper/lower, bro split, and beginner home plan.

**Exit criteria:** a member can browse, filter, inspect, save, and add an exercise to a plan.

## Stage 2 — Live workout mode

1. Start a scheduled or quick workout.
2. Record completed sets, weight, repetitions, rest, notes, skips, and substitutions.
3. Auto-save an in-progress session.
4. Add rest timer and workout stopwatch.
5. Finish with a real summary: duration, sets, reps, volume, and detected personal records.

**Exit criteria:** closing/reopening the app cannot lose logged workout data.

## Stage 3 — Dashboard from real data

1. Today’s scheduled workout and Quick Start.
2. Weekly completion, active streak, total workouts, and recent personal records.
3. Weekly activity and training-volume charts.
4. Body weight and daily goal summaries.

**Exit criteria:** every number links to actual persisted sessions or measurements.

## Stage 4 — Progress and personalization

1. Body-weight, measurement, photo, and goal logs.
2. Exercise performance history and progressive-overload suggestions.
3. Preferences: goals, experience, equipment, days, duration, and split.
4. Muscle-group volume/frequency tracker. Recovery display remains descriptive, never medically precise.

## Stage 5 — Nutrition and advanced utilities

1. Meals, calories, macros, water, and targets.
2. Superset/dropset notation, warm-up recommendations, and reminders.
3. Gym-owner tenancy, plans, subscriptions, and member management.

## Media policy

Only use owned, approved, or explicitly licensed GIF/video media. Until then, render a truthful “visual pending licence review” placeholder; never use a similar-but-wrong movement clip.

## Next implementation target

Stage 1: finish the centralized Exercise Library and introduce persistent custom workout plans. This unlocks the live workout experience and ensures all later dashboard analytics are real.
