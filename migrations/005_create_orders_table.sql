-- Create orders table if missing
SET search_path TO avelar_stocktech;

DO $$ BEGIN
    CREATE TYPE order_status AS ENUM (
      'pending_payment',
      'paid',
      'processing',
      'shipped',
      'delivered',
      'cancelled'
    );
EXCEPTION WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS orders (
  id SERIAL PRIMARY KEY,
  account_id UUID NOT NULL,
  buyer_id UUID NOT NULL,
  seller_id UUID NOT NULL,
  order_code VARCHAR(20) NOT NULL UNIQUE,
  status order_status NOT NULL DEFAULT 'pending_payment',
  subtotal NUMERIC(12,2) NOT NULL,
  freight NUMERIC(10,2) NOT NULL,
  total NUMERIC(12,2) NOT NULL,
  address_id INTEGER NOT NULL,
  items TEXT NOT NULL,
  payment_notes TEXT,
  payment_confirmed_at TIMESTAMP,
  payment_confirmed_by UUID,
  tracking_code VARCHAR(50),
  tracking_carrier VARCHAR(100),
  notes TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS orders_account_id_idx ON orders(account_id);
CREATE INDEX IF NOT EXISTS orders_buyer_id_idx ON orders(buyer_id);
CREATE INDEX IF NOT EXISTS orders_seller_id_idx ON orders(seller_id);
CREATE INDEX IF NOT EXISTS orders_status_idx ON orders(status);
CREATE INDEX IF NOT EXISTS orders_order_code_idx ON orders(order_code);
CREATE INDEX IF NOT EXISTS orders_created_at_idx ON orders(created_at);
CREATE INDEX IF NOT EXISTS orders_account_status_idx ON orders(account_id, status);
CREATE INDEX IF NOT EXISTS orders_buyer_created_idx ON orders(buyer_id, created_at);
CREATE INDEX IF NOT EXISTS orders_seller_created_idx ON orders(seller_id, created_at);
