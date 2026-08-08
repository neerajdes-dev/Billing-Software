-- Sprint 3 Create Bill 2.0 migration
BEGIN;

ALTER TABLE sales ADD COLUMN IF NOT EXISTS discount_amount DOUBLE PRECISION DEFAULT 0;
ALTER TABLE sales ADD COLUMN IF NOT EXISTS cash_amount DOUBLE PRECISION DEFAULT 0;
ALTER TABLE sales ADD COLUMN IF NOT EXISTS online_amount DOUBLE PRECISION DEFAULT 0;
ALTER TABLE sales ADD COLUMN IF NOT EXISTS credit_amount DOUBLE PRECISION DEFAULT 0;
ALTER TABLE sales ADD COLUMN IF NOT EXISTS amount_received DOUBLE PRECISION DEFAULT 0;
ALTER TABLE sales ADD COLUMN IF NOT EXISTS change_return DOUBLE PRECISION DEFAULT 0;

UPDATE sales SET discount_amount = 0 WHERE discount_amount IS NULL;
UPDATE sales SET cash_amount = 0 WHERE cash_amount IS NULL;
UPDATE sales SET online_amount = 0 WHERE online_amount IS NULL;
UPDATE sales SET credit_amount = 0 WHERE credit_amount IS NULL;
UPDATE sales SET amount_received = 0 WHERE amount_received IS NULL;
UPDATE sales SET change_return = 0 WHERE change_return IS NULL;

COMMIT;
