-- =======================================
-- Add missing columns to seller_profiles
-- =======================================
-- This migration is safe to run multiple times.

SET search_path TO avelar_stocktech;

ALTER TABLE seller_profiles
  ADD COLUMN IF NOT EXISTS email VARCHAR(320),
  ADD COLUMN IF NOT EXISTS phone VARCHAR(20),
  ADD COLUMN IF NOT EXISTS city VARCHAR(100),
  ADD COLUMN IF NOT EXISTS state VARCHAR(2),
  ADD COLUMN IF NOT EXISTS profile_photo TEXT,
  ADD COLUMN IF NOT EXISTS cover_photo TEXT,
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS rating NUMERIC(3, 2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_sales INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_sales_amount NUMERIC(12, 2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_products INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_reviews INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS followers INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS response_time INTEGER,
  ADD COLUMN IF NOT EXISTS street VARCHAR(255),
  ADD COLUMN IF NOT EXISTS number VARCHAR(20),
  ADD COLUMN IF NOT EXISTS neighborhood VARCHAR(100),
  ADD COLUMN IF NOT EXISTS zip_code VARCHAR(20),
  ADD COLUMN IF NOT EXISTS latitude NUMERIC(10, 8),
  ADD COLUMN IF NOT EXISTS longitude NUMERIC(11, 8);

