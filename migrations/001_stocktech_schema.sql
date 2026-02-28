-- ========================================
-- AVELAR SYSTEM - StockTech Database Schema
-- ========================================
-- Schema do Marketplace B2B de Eletrônicos no schema 'avelar_stocktech'
-- Executar via: docker exec supabase-db psql -U postgres -f /migrations/001_stocktech_schema.sql

-- Definir search_path para o schema avelar_stocktech
SET search_path TO avelar_stocktech;

-- =======================================
-- EXTENSÕES (já criadas pelo AvAdmin)
-- =======================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" SCHEMA public;

-- =======================================
-- ENUMS
-- =======================================

DO $$ BEGIN
    CREATE TYPE product_condition AS ENUM ('NEW', 'USED', 'REFURBISHED');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE transaction_type AS ENUM ('sale', 'purchase');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE counterparty_role AS ENUM ('buyer', 'seller');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE transaction_status AS ENUM ('completed', 'pending', 'cancelled');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- =======================================
-- TABELA: PRODUCTS
-- =======================================

CREATE TABLE IF NOT EXISTS products (
    id SERIAL PRIMARY KEY,
    
    -- Multi-tenant: isolamento por conta SaaS (referência ao AvAdmin)
    account_id UUID NOT NULL,
    created_by_user_id UUID,
    
    code VARCHAR(50) NOT NULL,
    name VARCHAR(255) NOT NULL,
    brand VARCHAR(100),
    category VARCHAR(100),
    description TEXT,
    price NUMERIC(10, 2) NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 0,
    min_quantity INTEGER NOT NULL DEFAULT 5,
    condition product_condition NOT NULL DEFAULT 'NEW',
    images TEXT, -- JSON array de URLs de imagens
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    
    -- Código único por conta
    CONSTRAINT products_code_account_unique UNIQUE (account_id, code)
);

CREATE INDEX IF NOT EXISTS idx_products_account_id ON products(account_id);
CREATE INDEX IF NOT EXISTS idx_products_code ON products(code);
CREATE INDEX IF NOT EXISTS idx_products_name ON products(name);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
CREATE INDEX IF NOT EXISTS idx_products_brand ON products(brand);
CREATE INDEX IF NOT EXISTS idx_products_created_at ON products(created_at DESC);

-- =======================================
-- TABELA: TRANSACTIONS
-- =======================================

CREATE TABLE IF NOT EXISTS transactions (
    id SERIAL PRIMARY KEY,
    
    -- Multi-tenant
    account_id UUID NOT NULL,
    buyer_id UUID NOT NULL,
    seller_id UUID NOT NULL,
    
    transaction_code VARCHAR(50) NOT NULL,
    type transaction_type NOT NULL,
    product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    product_name VARCHAR(255) NOT NULL,
    counterparty VARCHAR(255) NOT NULL,
    counterparty_role counterparty_role NOT NULL,
    amount NUMERIC(12, 2) NOT NULL,
    quantity INTEGER NOT NULL,
    status transaction_status NOT NULL DEFAULT 'pending',
    date TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    
    -- Código único por conta
    CONSTRAINT transactions_code_account_unique UNIQUE (account_id, transaction_code)
);

CREATE INDEX IF NOT EXISTS idx_transactions_account_id ON transactions(account_id);
CREATE INDEX IF NOT EXISTS idx_transactions_buyer_id ON transactions(buyer_id);
CREATE INDEX IF NOT EXISTS idx_transactions_seller_id ON transactions(seller_id);
CREATE INDEX IF NOT EXISTS idx_transactions_product_id ON transactions(product_id);
CREATE INDEX IF NOT EXISTS idx_transactions_status ON transactions(status);
CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date DESC);

-- =======================================
-- TABELA: RATINGS
-- =======================================

CREATE TABLE IF NOT EXISTS ratings (
    id SERIAL PRIMARY KEY,
    
    -- Multi-tenant
    account_id UUID NOT NULL,
    reviewer_id UUID NOT NULL,
    
    product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    transaction_id INTEGER REFERENCES transactions(id) ON DELETE SET NULL,
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    comment TEXT,
    author VARCHAR(255) NOT NULL,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_ratings_account_id ON ratings(account_id);
CREATE INDEX IF NOT EXISTS idx_ratings_product_id ON ratings(product_id);
CREATE INDEX IF NOT EXISTS idx_ratings_reviewer_id ON ratings(reviewer_id);
CREATE INDEX IF NOT EXISTS idx_ratings_rating ON ratings(rating);

-- =======================================
-- TABELA: ADDRESSES
-- =======================================

CREATE TABLE IF NOT EXISTS addresses (
    id SERIAL PRIMARY KEY,
    
    -- Multi-tenant
    account_id UUID NOT NULL,
    user_id UUID NOT NULL,
    
    street VARCHAR(255) NOT NULL,
    number VARCHAR(20) NOT NULL,
    complement VARCHAR(255),
    neighborhood VARCHAR(100) NOT NULL,
    city VARCHAR(100) NOT NULL,
    state VARCHAR(2) NOT NULL,
    zip_code VARCHAR(20) NOT NULL,
    country VARCHAR(100) NOT NULL DEFAULT 'Brasil',
    is_default BOOLEAN NOT NULL DEFAULT false,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_addresses_account_id ON addresses(account_id);
CREATE INDEX IF NOT EXISTS idx_addresses_user_id ON addresses(user_id);
CREATE INDEX IF NOT EXISTS idx_addresses_is_default ON addresses(is_default);

-- =======================================
-- TABELA: SELLER_PROFILES
-- =======================================

CREATE TABLE IF NOT EXISTS seller_profiles (
    id SERIAL PRIMARY KEY,
    
    -- Multi-tenant
    account_id UUID NOT NULL,
    user_id UUID NOT NULL UNIQUE,
    
    -- Informações da loja
    store_name VARCHAR(255) NOT NULL,
    email VARCHAR(320),
    phone VARCHAR(20),
    city VARCHAR(100),
    state VARCHAR(2),
    
    -- Fotos (URLs do storage)
    profile_photo TEXT,
    cover_photo TEXT,
    
    -- Informações e métricas
    description TEXT,
    rating NUMERIC(3, 2) DEFAULT 0,
    total_sales INTEGER NOT NULL DEFAULT 0,
    total_sales_amount NUMERIC(12, 2) DEFAULT 0,
    total_products INTEGER NOT NULL DEFAULT 0,
    total_reviews INTEGER NOT NULL DEFAULT 0,
    followers INTEGER NOT NULL DEFAULT 0,
    response_time INTEGER, -- em minutos
    
    -- Endereço da loja
    street VARCHAR(255),
    number VARCHAR(20),
    neighborhood VARCHAR(100),
    zip_code VARCHAR(20),
    latitude NUMERIC(10, 8),
    longitude NUMERIC(11, 8),
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_seller_profiles_account_id ON seller_profiles(account_id);
CREATE INDEX IF NOT EXISTS idx_seller_profiles_user_id ON seller_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_seller_profiles_store_name ON seller_profiles(store_name);
CREATE INDEX IF NOT EXISTS idx_seller_profiles_rating ON seller_profiles(rating DESC);

-- =======================================
-- TABELA: CARTS
-- =======================================

CREATE TABLE IF NOT EXISTS carts (
    id SERIAL PRIMARY KEY,
    
    -- Multi-tenant
    account_id UUID NOT NULL,
    user_id UUID NOT NULL,
    
    product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    
    -- Um usuário só pode ter um produto uma vez no carrinho
    CONSTRAINT carts_user_product_unique UNIQUE (user_id, product_id)
);

CREATE INDEX IF NOT EXISTS idx_carts_account_id ON carts(account_id);
CREATE INDEX IF NOT EXISTS idx_carts_user_id ON carts(user_id);
CREATE INDEX IF NOT EXISTS idx_carts_product_id ON carts(product_id);

-- =======================================
-- TABELA: CATEGORIES (Nova - para organização)
-- =======================================

CREATE TABLE IF NOT EXISTS categories (
    id SERIAL PRIMARY KEY,
    
    name VARCHAR(100) NOT NULL,
    slug VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    icon VARCHAR(50),
    parent_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
    display_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_categories_slug ON categories(slug);
CREATE INDEX IF NOT EXISTS idx_categories_parent_id ON categories(parent_id);
CREATE INDEX IF NOT EXISTS idx_categories_is_active ON categories(is_active);

-- =======================================
-- TABELA: BRANDS (Nova - para organização)
-- =======================================

CREATE TABLE IF NOT EXISTS brands (
    id SERIAL PRIMARY KEY,
    
    name VARCHAR(100) NOT NULL UNIQUE,
    slug VARCHAR(100) NOT NULL UNIQUE,
    logo_url TEXT,
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_brands_slug ON brands(slug);
CREATE INDEX IF NOT EXISTS idx_brands_is_active ON brands(is_active);

-- =======================================
-- FUNÇÃO: Update Updated_At
-- =======================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers para updated_at
DROP TRIGGER IF EXISTS trigger_products_updated_at ON products;
CREATE TRIGGER trigger_products_updated_at
    BEFORE UPDATE ON products FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trigger_transactions_updated_at ON transactions;
CREATE TRIGGER trigger_transactions_updated_at
    BEFORE UPDATE ON transactions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trigger_ratings_updated_at ON ratings;
CREATE TRIGGER trigger_ratings_updated_at
    BEFORE UPDATE ON ratings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trigger_addresses_updated_at ON addresses;
CREATE TRIGGER trigger_addresses_updated_at
    BEFORE UPDATE ON addresses FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trigger_seller_profiles_updated_at ON seller_profiles;
CREATE TRIGGER trigger_seller_profiles_updated_at
    BEFORE UPDATE ON seller_profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trigger_carts_updated_at ON carts;
CREATE TRIGGER trigger_carts_updated_at
    BEFORE UPDATE ON carts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trigger_categories_updated_at ON categories;
CREATE TRIGGER trigger_categories_updated_at
    BEFORE UPDATE ON categories FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trigger_brands_updated_at ON brands;
CREATE TRIGGER trigger_brands_updated_at
    BEFORE UPDATE ON brands FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =======================================
-- DADOS INICIAIS - CATEGORIAS
-- =======================================

INSERT INTO categories (name, slug, description, icon, display_order) VALUES
    ('Celulares', 'celulares', 'Smartphones e celulares', 'smartphone', 1),
    ('Tablets', 'tablets', 'Tablets e iPads', 'tablet', 2),
    ('Notebooks', 'notebooks', 'Notebooks e laptops', 'laptop', 3),
    ('Acessórios', 'acessorios', 'Capas, cabos e acessórios', 'headphones', 4),
    ('Peças', 'pecas', 'Peças de reposição', 'cpu', 5),
    ('Baterias', 'baterias', 'Baterias e carregadores', 'battery-charging', 6),
    ('Telas', 'telas', 'Displays e telas', 'monitor', 7),
    ('Ferramentas', 'ferramentas', 'Ferramentas para reparo', 'wrench', 8)
ON CONFLICT (slug) DO NOTHING;

-- =======================================
-- DADOS INICIAIS - MARCAS
-- =======================================

INSERT INTO brands (name, slug) VALUES
    ('Apple', 'apple'),
    ('Samsung', 'samsung'),
    ('Xiaomi', 'xiaomi'),
    ('Motorola', 'motorola'),
    ('LG', 'lg'),
    ('Asus', 'asus'),
    ('Lenovo', 'lenovo'),
    ('Dell', 'dell'),
    ('HP', 'hp'),
    ('Huawei', 'huawei'),
    ('Realme', 'realme'),
    ('OnePlus', 'oneplus'),
    ('Google', 'google'),
    ('Sony', 'sony'),
    ('Multilaser', 'multilaser')
ON CONFLICT (slug) DO NOTHING;

-- =======================================
-- FINALIZAÇÃO
-- =======================================

DO $$
BEGIN
    RAISE NOTICE '🚀 StockTech Schema criado com sucesso no schema avelar_stocktech!';
    RAISE NOTICE '📊 Tabelas: products, transactions, ratings, addresses, seller_profiles, carts, categories, brands';
    RAISE NOTICE '📁 Categorias iniciais: 8 categorias de eletrônicos';
    RAISE NOTICE '🏷️ Marcas iniciais: 15 marcas populares';
END $$;


