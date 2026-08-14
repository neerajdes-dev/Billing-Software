BEGIN;

ALTER TABLE customers ADD COLUMN IF NOT EXISTS loyalty_points DOUBLE PRECISION DEFAULT 0;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS loyalty_tier VARCHAR DEFAULT 'Regular';
ALTER TABLE customers ADD COLUMN IF NOT EXISTS loyalty_member_since TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE sales ADD COLUMN IF NOT EXISTS loyalty_points_earned DOUBLE PRECISION DEFAULT 0;
ALTER TABLE sales ADD COLUMN IF NOT EXISTS loyalty_points_redeemed DOUBLE PRECISION DEFAULT 0;
ALTER TABLE sales ADD COLUMN IF NOT EXISTS loyalty_discount DOUBLE PRECISION DEFAULT 0;

CREATE TABLE IF NOT EXISTS loyalty_settings (
    id SERIAL PRIMARY KEY,
    enabled INTEGER NOT NULL DEFAULT 1,
    earn_amount DOUBLE PRECISION NOT NULL DEFAULT 100,
    points_per_earn_amount DOUBLE PRECISION NOT NULL DEFAULT 1,
    point_value DOUBLE PRECISION NOT NULL DEFAULT 1,
    minimum_redeem_points DOUBLE PRECISION NOT NULL DEFAULT 10,
    max_redeem_percent DOUBLE PRECISION NOT NULL DEFAULT 20,
    silver_threshold DOUBLE PRECISION NOT NULL DEFAULT 10000,
    gold_threshold DOUBLE PRECISION NOT NULL DEFAULT 25000,
    platinum_threshold DOUBLE PRECISION NOT NULL DEFAULT 50000,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS loyalty_transactions (
    id SERIAL PRIMARY KEY,
    customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    sale_id INTEGER REFERENCES sales(id) ON DELETE SET NULL,
    transaction_type VARCHAR NOT NULL,
    points DOUBLE PRECISION NOT NULL DEFAULT 0,
    balance_after DOUBLE PRECISION NOT NULL DEFAULT 0,
    note VARCHAR,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO loyalty_settings (
    enabled,
    earn_amount,
    points_per_earn_amount,
    point_value,
    minimum_redeem_points,
    max_redeem_percent,
    silver_threshold,
    gold_threshold,
    platinum_threshold
)
SELECT 1, 100, 1, 1, 10, 20, 10000, 25000, 50000
WHERE NOT EXISTS (SELECT 1 FROM loyalty_settings);

UPDATE customers SET loyalty_points = 0 WHERE loyalty_points IS NULL;
UPDATE customers SET loyalty_tier = 'Regular' WHERE loyalty_tier IS NULL;
UPDATE customers SET loyalty_member_since = CURRENT_TIMESTAMP WHERE loyalty_member_since IS NULL;

COMMIT;
