-- Add model column to products
SET search_path TO avelar_stocktech;

ALTER TABLE products
ADD COLUMN IF NOT EXISTS model VARCHAR(100);
