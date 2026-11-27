ALTER TABLE payments ADD COLUMN method TEXT CHECK (method IN ('cash', 'upi'));
ALTER TABLE payments ADD COLUMN collected_by INTEGER REFERENCES users(id);

-- Accounts created before the shared memberships table still need a record
-- for staff reminders and payment collection. Existing billing stays free until
-- an owner verifies a paid membership.
INSERT INTO memberships (user_id, billing_tier, status, expiry_date, due_balance, created_at, updated_at)
SELECT u.id, 'free',
  CASE WHEN substr(u.membership_expires_at, 1, 10) < date('now') THEN 'expired'
       WHEN substr(u.membership_expires_at, 1, 10) <= date('now', '+14 days') THEN 'expiring'
       ELSE 'active' END,
  substr(u.membership_expires_at, 1, 10), 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM users u WHERE u.role = 'member' AND NOT EXISTS (SELECT 1 FROM memberships m WHERE m.user_id = u.id);

CREATE TABLE trainer_notes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  member_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  author_id INTEGER NOT NULL REFERENCES users(id),
  note TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX ix_trainer_notes_member ON trainer_notes(member_id, created_at DESC);

CREATE TABLE trainer_exercise_swaps (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  member_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  author_id INTEGER NOT NULL REFERENCES users(id),
  workout_date TEXT NOT NULL,
  original_name TEXT NOT NULL,
  replacement_name TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX ix_trainer_swaps_member ON trainer_exercise_swaps(member_id, workout_date DESC);
