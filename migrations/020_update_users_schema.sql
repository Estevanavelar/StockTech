-- Update users table schema to sync from AvAdmin.accounts
-- Migration: 020_update_users_schema.sql

-- Backup existing data
CREATE TABLE IF NOT EXISTS users_backup AS SELECT * FROM users;

-- Drop existing table and recreate with new schema
DROP TABLE IF EXISTS users CASCADE;

-- Create new enums
DO $$ BEGIN
    CREATE TYPE document_type AS ENUM ('cpf', 'cnpj');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE client_type AS ENUM ('lojista', 'distribuidor', 'cliente_final');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create new users table
CREATE TABLE users (
  id VARCHAR(14) PRIMARY KEY,
  document_type document_type,
  document VARCHAR(14),
  business_name VARCHAR(255),
  owner_cpf VARCHAR(11) NOT NULL,
  is_individual BOOLEAN DEFAULT false,
  whatsapp VARCHAR(20),
  status VARCHAR(50) DEFAULT 'active',
  enabled_modules TEXT,
  previous_document VARCHAR(14),
  plan_id VARCHAR(36),
  client_type client_type,
  last_sync_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Create indexes
CREATE INDEX users_owner_cpf_idx ON users(owner_cpf);
CREATE INDEX users_document_idx ON users(document);