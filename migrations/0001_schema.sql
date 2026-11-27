-- SetSaathi D1 schema, mirroring backend/app/models.py.
-- Timestamps are naive UTC ISO-8601 text; dates are YYYY-MM-DD text.
CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  username TEXT UNIQUE,
  email TEXT NOT NULL UNIQUE,
  mobile TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'member',
  status TEXT NOT NULL DEFAULT 'active',
  gym_name TEXT NOT NULL DEFAULT 'Independent member',
  gym_location TEXT,
  gym_place_ref TEXT,
  gym_place_name TEXT,
  membership_plan TEXT NOT NULL DEFAULT 'SetSaathi Starter',
  membership_started_at TEXT,
  membership_expires_at TEXT,
  height_cm REAL,
  weight_kg REAL,
  bmi REAL,
  created_at TEXT NOT NULL
);
CREATE INDEX ix_users_role ON users (role);

CREATE TABLE exercises (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  primary_muscle TEXT NOT NULL,
  secondary_muscles TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT 'Strength',
  equipment TEXT NOT NULL,
  difficulty TEXT NOT NULL,
  instructions TEXT NOT NULL,
  posture TEXT NOT NULL DEFAULT 'Maintain a controlled, comfortable range of motion.',
  breathing TEXT NOT NULL DEFAULT 'Exhale during effort; inhale during the controlled return.',
  common_mistake TEXT NOT NULL,
  safety_tips TEXT NOT NULL DEFAULT 'Stop if pain is sharp or worsening.',
  substitute TEXT NOT NULL,
  media_status TEXT NOT NULL DEFAULT 'licensed-media-pending',
  media_url TEXT,
  source_name TEXT NOT NULL DEFAULT 'SetSaathi',
  source_id TEXT,
  source_url TEXT,
  license_name TEXT NOT NULL DEFAULT 'SetSaathi original',
  license_url TEXT,
  movement_force TEXT,
  movement_mechanic TEXT
);
CREATE INDEX ix_exercises_primary_muscle ON exercises (primary_muscle);
CREATE INDEX ix_exercises_category ON exercises (category);
CREATE INDEX ix_exercises_equipment ON exercises (equipment);
CREATE INDEX ix_exercises_difficulty ON exercises (difficulty);
CREATE INDEX ix_exercises_source_id ON exercises (source_id);

CREATE TABLE workout_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  workout_day TEXT NOT NULL,
  exercise_name TEXT NOT NULL,
  event_type TEXT NOT NULL,
  replacement_name TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX ix_workout_events_user ON workout_events (user_id);

CREATE TABLE workout_progress (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  workout_date TEXT NOT NULL,
  workout_day TEXT NOT NULL,
  exercise_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  replacement_name TEXT,
  notes TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL,
  CONSTRAINT uq_workout_progress_user_date_exercise UNIQUE (user_id, workout_date, exercise_name)
);
CREATE INDEX ix_workout_progress_date ON workout_progress (workout_date);

CREATE TABLE workout_plans (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  configuration_json TEXT NOT NULL,
  plan_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  CONSTRAINT uq_workout_plan_user UNIQUE (user_id)
);

CREATE TABLE daily_workout_plans (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  workout_date TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'generated',
  configuration_json TEXT NOT NULL,
  day_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  CONSTRAINT uq_daily_workout_plan_user_date UNIQUE (user_id, workout_date)
);

CREATE TABLE membership_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  gym_name TEXT NOT NULL,
  membership_plan TEXT NOT NULL,
  started_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX ix_membership_events_user ON membership_events (user_id);

-- Gym check-in only. Kept separate from workout_progress (completed/skipped exercises).
CREATE TABLE gym_attendance (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  workout_date TEXT NOT NULL,
  status TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'manual',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  CONSTRAINT uq_gym_attendance_user_date UNIQUE (user_id, workout_date)
);

CREATE TABLE body_measurements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  recorded_at TEXT NOT NULL,
  height_cm REAL NOT NULL,
  weight_kg REAL NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  CONSTRAINT uq_body_measurement_user_date UNIQUE (user_id, recorded_at)
);

CREATE TABLE user_equipment (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  equipment TEXT NOT NULL,
  CONSTRAINT uq_user_equipment UNIQUE (user_id, equipment)
);

CREATE TABLE gym_equipment_reports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  gym_key TEXT NOT NULL,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  equipment TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  CONSTRAINT uq_gym_equipment_report UNIQUE (gym_key, user_id, equipment)
);
CREATE INDEX ix_gym_equipment_reports_key ON gym_equipment_reports (gym_key);

CREATE TABLE plan_templates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  experience TEXT NOT NULL,
  split TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  structure_json TEXT NOT NULL,
  pools_json TEXT NOT NULL,
  published INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT uq_plan_template_variant UNIQUE (experience, split, version)
);

CREATE TABLE plan_variants (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  template_id INTEGER NOT NULL REFERENCES plan_templates(id),
  number INTEGER NOT NULL,
  pools_json TEXT NOT NULL,
  published INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT uq_plan_variant_number UNIQUE (template_id, number)
);

CREATE TABLE plan_assignments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  template_id INTEGER NOT NULL,
  variant_id INTEGER NOT NULL,
  exercise_signature TEXT NOT NULL,
  configuration_json TEXT NOT NULL,
  plan_json TEXT NOT NULL,
  assigned_at TEXT NOT NULL
);
CREATE INDEX ix_plan_assignments_user ON plan_assignments (user_id, assigned_at);

CREATE TABLE coach_cache (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  cache_key TEXT NOT NULL UNIQUE,
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  sources_json TEXT NOT NULL DEFAULT '[]',
  provider TEXT NOT NULL,
  hit_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
