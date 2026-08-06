-- Resolvent Billing Software
-- Inventory Demo Final Migration
-- Safe to run more than once on PostgreSQL / Neon.

BEGIN;

ALTER TABLE items
    ADD COLUMN IF NOT EXISTS minimum_stock INTEGER DEFAULT 5;

ALTER TABLE items
    ADD COLUMN IF NOT EXISTS batch_number VARCHAR;

ALTER TABLE items
    ADD COLUMN IF NOT EXISTS manufacturing_date DATE;

ALTER TABLE items
    ADD COLUMN IF NOT EXISTS expiry_date DATE;

ALTER TABLE items
    ADD COLUMN IF NOT EXISTS expiry_alert_days INTEGER DEFAULT 30;

UPDATE items
SET minimum_stock = 5
WHERE minimum_stock IS NULL;

UPDATE items
SET expiry_alert_days = 30
WHERE expiry_alert_days IS NULL;

CREATE TABLE IF NOT EXISTS stock_adjustments (
    id SERIAL PRIMARY KEY,
    item_id INTEGER NOT NULL REFERENCES items(id) ON DELETE CASCADE,
    previous_stock INTEGER NOT NULL,
    adjustment INTEGER NOT NULL,
    new_stock INTEGER NOT NULL,
    reason VARCHAR NOT NULL DEFAULT 'Bulk update',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS ix_items_barcode
    ON items (barcode);

CREATE INDEX IF NOT EXISTS ix_items_expiry_date
    ON items (expiry_date);

CREATE INDEX IF NOT EXISTS ix_stock_adjustments_item_id
    ON stock_adjustments (item_id);

COMMIT;
