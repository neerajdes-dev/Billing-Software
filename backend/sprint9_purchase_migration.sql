BEGIN;

ALTER TABLE sale_items ADD COLUMN IF NOT EXISTS cost_price DOUBLE PRECISION DEFAULT 0;
ALTER TABLE sale_items ADD COLUMN IF NOT EXISTS profit_amount DOUBLE PRECISION DEFAULT 0;

CREATE TABLE IF NOT EXISTS purchases (
    id SERIAL PRIMARY KEY,
    dealer_id INTEGER NOT NULL REFERENCES dealers(id) ON DELETE CASCADE,
    invoice_number VARCHAR NOT NULL,
    purchase_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    subtotal DOUBLE PRECISION DEFAULT 0,
    gst_amount DOUBLE PRECISION DEFAULT 0,
    discount_amount DOUBLE PRECISION DEFAULT 0,
    freight_amount DOUBLE PRECISION DEFAULT 0,
    round_off DOUBLE PRECISION DEFAULT 0,
    total_amount DOUBLE PRECISION DEFAULT 0,
    paid_amount DOUBLE PRECISION DEFAULT 0,
    outstanding_amount DOUBLE PRECISION DEFAULT 0,
    payment_mode VARCHAR DEFAULT 'Credit',
    note VARCHAR,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS purchase_items (
    id SERIAL PRIMARY KEY,
    purchase_id INTEGER NOT NULL REFERENCES purchases(id) ON DELETE CASCADE,
    item_id INTEGER NOT NULL REFERENCES items(id),
    item_name VARCHAR NOT NULL,
    quantity INTEGER NOT NULL,
    purchase_price DOUBLE PRECISION NOT NULL DEFAULT 0,
    mrp DOUBLE PRECISION DEFAULT 0,
    sale_price DOUBLE PRECISION DEFAULT 0,
    gst_percent DOUBLE PRECISION DEFAULT 0,
    taxable_amount DOUBLE PRECISION DEFAULT 0,
    gst_amount DOUBLE PRECISION DEFAULT 0,
    line_total DOUBLE PRECISION DEFAULT 0,
    batch_number VARCHAR,
    manufacturing_date DATE,
    expiry_date DATE,
    returned_quantity INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS purchase_returns (
    id SERIAL PRIMARY KEY,
    purchase_id INTEGER NOT NULL REFERENCES purchases(id) ON DELETE CASCADE,
    purchase_item_id INTEGER NOT NULL REFERENCES purchase_items(id) ON DELETE CASCADE,
    dealer_id INTEGER NOT NULL REFERENCES dealers(id) ON DELETE CASCADE,
    item_id INTEGER NOT NULL REFERENCES items(id),
    quantity INTEGER NOT NULL,
    return_amount DOUBLE PRECISION NOT NULL DEFAULT 0,
    reason VARCHAR,
    return_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_purchases_dealer_id ON purchases(dealer_id);
CREATE INDEX IF NOT EXISTS idx_purchase_items_purchase_id ON purchase_items(purchase_id);
CREATE INDEX IF NOT EXISTS idx_purchase_items_item_id ON purchase_items(item_id);

COMMIT;
