-- Online transaction reference and a collector-name audit snapshot. Payment proofs are not stored.
ALTER TABLE payments ADD COLUMN transaction_ref TEXT;
ALTER TABLE payments ADD COLUMN collected_by_name TEXT;
ALTER TABLE payments ADD COLUMN collected_by_username TEXT;
UPDATE payments
SET collected_by_name = (SELECT name FROM users WHERE users.id = payments.collected_by),
    collected_by_username = (SELECT username FROM users WHERE users.id = payments.collected_by)
WHERE collected_by IS NOT NULL;
CREATE UNIQUE INDEX ix_payments_transaction_ref
  ON payments(transaction_ref) WHERE transaction_ref IS NOT NULL;
