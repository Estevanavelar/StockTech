-- ========================================
-- StockTech - Movimentações de Estoque
-- ========================================

SET search_path TO avelar_stocktech, public;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'stock_movement_type') THEN
    CREATE TYPE stock_movement_type AS ENUM ('IN', 'OUT', 'ADJUST');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS stock_movements (
  id SERIAL PRIMARY KEY,
  account_id VARCHAR(14) NOT NULL,
  owner_cpf VARCHAR(11) NOT NULL,
  user_id VARCHAR(11) NOT NULL,
  product_id INTEGER NOT NULL,
  product_code VARCHAR(50) NOT NULL,
  product_name VARCHAR(255) NOT NULL,
  type stock_movement_type NOT NULL,
  previous_quantity INTEGER NOT NULL,
  new_quantity INTEGER NOT NULL,
  delta INTEGER NOT NULL,
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS stock_movements_account_id_idx ON stock_movements(account_id);
CREATE INDEX IF NOT EXISTS stock_movements_product_id_idx ON stock_movements(product_id);
CREATE INDEX IF NOT EXISTS stock_movements_type_idx ON stock_movements(type);
CREATE INDEX IF NOT EXISTS stock_movements_created_at_idx ON stock_movements(created_at);
CREATE INDEX IF NOT EXISTS stock_movements_product_created_idx ON stock_movements(product_id, created_at);

DO $$
BEGIN
  RAISE NOTICE 'Migration 002: stock_movements table created successfully';
END $$;
