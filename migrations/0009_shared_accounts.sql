-- Shared account controls. Preserve existing blocked accounts during the transition.
ALTER TABLE users ADD COLUMN is_blocked INTEGER NOT NULL DEFAULT 0 CHECK (is_blocked IN (0, 1));
ALTER TABLE users ADD COLUMN blocked_reason TEXT;
ALTER TABLE users ADD COLUMN blocked_by INTEGER REFERENCES users(id);
ALTER TABLE users ADD COLUMN blocked_at TEXT;
UPDATE users SET is_blocked = 1 WHERE status = 'blocked';
CREATE INDEX ix_users_role_blocked ON users(role, is_blocked);
CREATE TRIGGER enforce_user_role_insert BEFORE INSERT ON users
WHEN NEW.role NOT IN ('member', 'staff', 'admin')
BEGIN SELECT RAISE(ABORT, 'Invalid user role'); END;
CREATE TRIGGER enforce_user_role_update BEFORE UPDATE OF role ON users
WHEN NEW.role NOT IN ('member', 'staff', 'admin')
BEGIN SELECT RAISE(ABORT, 'Invalid user role'); END;

-- Monetary amounts are integer minor units (paise for INR).
CREATE TABLE memberships (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  billing_tier TEXT NOT NULL DEFAULT 'free' CHECK (billing_tier IN ('free', 'paid')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'expiring', 'expired', 'cancelled')),
  expiry_date TEXT,
  due_balance INTEGER NOT NULL DEFAULT 0 CHECK (due_balance >= 0),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX ix_memberships_user_expiry ON memberships(user_id, expiry_date);

CREATE TABLE payments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  membership_id INTEGER NOT NULL REFERENCES memberships(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL CHECK (amount >= 0),
  status TEXT NOT NULL DEFAULT 'pending_review' CHECK (status IN ('pending_review', 'verified', 'rejected')),
  proof_r2_key TEXT,
  receipt_no TEXT UNIQUE,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  reviewed_by INTEGER REFERENCES users(id),
  reviewed_at TEXT
);
CREATE INDEX ix_payments_member_status ON payments(user_id, status);

CREATE TABLE reminders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  membership_id INTEGER REFERENCES memberships(id) ON DELETE SET NULL,
  channel TEXT NOT NULL CHECK (channel IN ('in_app', 'whatsapp')),
  trigger_type TEXT NOT NULL CHECK (trigger_type IN ('manual', 'auto')),
  message TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  sent_at TEXT,
  seen_at TEXT
);
CREATE INDEX ix_reminders_member_created ON reminders(user_id, created_at);
