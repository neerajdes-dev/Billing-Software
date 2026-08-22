ALTER TABLE sale_items
ADD COLUMN IF NOT EXISTS returned_quantity INTEGER DEFAULT 0;

CREATE TABLE IF NOT EXISTS sales_returns (
    id SERIAL PRIMARY KEY,
    sale_id INTEGER NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
    sale_item_id INTEGER NOT NULL REFERENCES sale_items(id) ON DELETE CASCADE,
    item_id INTEGER NOT NULL REFERENCES items(id),
    quantity INTEGER NOT NULL,
    return_amount DOUBLE PRECISION NOT NULL DEFAULT 0,
    reason VARCHAR NOT NULL,
    refund_method VARCHAR NOT NULL DEFAULT 'Cash',
    return_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS inventory_movements (
    id SERIAL PRIMARY KEY,
    item_id INTEGER NOT NULL REFERENCES items(id),
    movement_type VARCHAR NOT NULL,
    quantity_change INTEGER NOT NULL,
    previous_stock INTEGER NOT NULL,
    new_stock INTEGER NOT NULL,
    reference_type VARCHAR,
    reference_id INTEGER,
    reference_number VARCHAR,
    reason VARCHAR,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_inventory_movements_item
ON inventory_movements(item_id);

CREATE INDEX IF NOT EXISTS idx_inventory_movements_created
ON inventory_movements(created_at);
