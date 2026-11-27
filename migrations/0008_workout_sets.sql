CREATE TABLE workout_sets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  workout_date TEXT NOT NULL,
  exercise_name TEXT NOT NULL,
  set_number INTEGER NOT NULL CHECK (set_number BETWEEN 1 AND 20),
  reps INTEGER NOT NULL CHECK (reps BETWEEN 0 AND 1000),
  weight_kg REAL CHECK (weight_kg IS NULL OR (weight_kg >= 0 AND weight_kg <= 2000)),
  updated_at TEXT NOT NULL,
  UNIQUE (user_id, workout_date, exercise_name, set_number)
);
CREATE INDEX ix_workout_sets_user_date ON workout_sets (user_id, workout_date);
