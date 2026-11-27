-- Record successful member sign-ins for the platform administrator's account directory.
ALTER TABLE users ADD COLUMN last_login_at TEXT;
