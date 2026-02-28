-- Add owner_cpf field to multi-tenant tables
-- Migration: 021_add_owner_cpf_to_tables.sql

-- Add owner_cpf to products table
ALTER TABLE products ADD COLUMN IF NOT EXISTS owner_cpf VARCHAR(11);
CREATE INDEX IF NOT EXISTS products_owner_cpf_idx ON products(owner_cpf);

-- Add owner_cpf to transactions table
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS owner_cpf VARCHAR(11);
CREATE INDEX IF NOT EXISTS transactions_owner_cpf_idx ON transactions(owner_cpf);

-- Add owner_cpf to orders table
ALTER TABLE orders ADD COLUMN IF NOT EXISTS owner_cpf VARCHAR(11);
CREATE INDEX IF NOT EXISTS orders_owner_cpf_idx ON orders(owner_cpf);

-- Add owner_cpf to product_returns table
ALTER TABLE product_returns ADD COLUMN IF NOT EXISTS owner_cpf VARCHAR(11);
CREATE INDEX IF NOT EXISTS product_returns_owner_cpf_idx ON product_returns(owner_cpf);

-- Add owner_cpf to seller_profiles table
ALTER TABLE seller_profiles ADD COLUMN IF NOT EXISTS owner_cpf VARCHAR(11);
CREATE INDEX IF NOT EXISTS seller_profiles_owner_cpf_idx ON seller_profiles(owner_cpf);