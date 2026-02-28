-- ========================================
-- MIGRATION: Product Catalog Tables
-- Schema: avelar_stocktech
-- ========================================

-- Garantir que estamos no schema correto
SET search_path TO avelar_stocktech;

-- =======================================
-- TABELA: product_types
-- =======================================
CREATE TABLE IF NOT EXISTS product_types (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    slug VARCHAR(100) NOT NULL UNIQUE,
    display_order INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT true,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_product_types_slug ON product_types(slug);
CREATE INDEX IF NOT EXISTS idx_product_types_active ON product_types(is_active);
CREATE INDEX IF NOT EXISTS idx_product_types_display_order ON product_types(display_order);

-- =======================================
-- TABELA: product_parts
-- =======================================
CREATE TABLE IF NOT EXISTS product_parts (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    slug VARCHAR(100) NOT NULL UNIQUE,
    display_order INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT true,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_product_parts_slug ON product_parts(slug);
CREATE INDEX IF NOT EXISTS idx_product_parts_active ON product_parts(is_active);
CREATE INDEX IF NOT EXISTS idx_product_parts_display_order ON product_parts(display_order);

-- =======================================
-- TABELA: product_conditions
-- =======================================
CREATE TABLE IF NOT EXISTS product_conditions (
    id SERIAL PRIMARY KEY,
    value VARCHAR(50) NOT NULL UNIQUE,
    label VARCHAR(100) NOT NULL,
    display_order INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_product_conditions_value ON product_conditions(value);
CREATE INDEX IF NOT EXISTS idx_product_conditions_active ON product_conditions(is_active);
CREATE INDEX IF NOT EXISTS idx_product_conditions_display_order ON product_conditions(display_order);

-- =======================================
-- ATUALIZAR brands (adicionar índice)
-- =======================================
CREATE INDEX IF NOT EXISTS idx_brands_display_order ON brands(display_order);

-- =======================================
-- ALTERAR TABELA products
-- =======================================
ALTER TABLE products ADD COLUMN IF NOT EXISTS product_type VARCHAR(100);

-- =======================================
-- TRIGGERS para updated_at
-- =======================================
DROP TRIGGER IF EXISTS trigger_product_types_updated_at ON product_types;
CREATE TRIGGER trigger_product_types_updated_at
    BEFORE UPDATE ON product_types FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trigger_product_parts_updated_at ON product_parts;
CREATE TRIGGER trigger_product_parts_updated_at
    BEFORE UPDATE ON product_parts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trigger_product_conditions_updated_at ON product_conditions;
CREATE TRIGGER trigger_product_conditions_updated_at
    BEFORE UPDATE ON product_conditions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =======================================
-- DADOS INICIAIS - PRODUCT_TYPES
-- =======================================
INSERT INTO product_types (name, slug, display_order, description) VALUES
    ('Smartphone', 'smartphone', 1, 'Smartphones e celulares'),
    ('Tablet', 'tablet', 2, 'Tablets e iPads'),
    ('Notebook', 'notebook', 3, 'Notebooks e laptops'),
    ('Smartwatch', 'smartwatch', 4, 'Relógios inteligentes'),
    ('Fone de Ouvido', 'fone-de-ouvido', 5, 'Fones e headsets'),
    ('Outro', 'outro', 99, 'Outros tipos de produtos')
ON CONFLICT (slug) DO NOTHING;

-- =======================================
-- DADOS INICIAIS - PRODUCT_PARTS
-- =======================================
INSERT INTO product_parts (name, slug, display_order) VALUES
    ('Câmera Frontal', 'camera-frontal', 1),
    ('Câmera Traseira', 'camera-traseira', 2),
    ('Aro', 'aro', 3),
    ('Biometria', 'biometria', 4),
    ('Flex Main', 'flex-main', 5),
    ('Flex Sub', 'flex-sub', 6),
    ('Flex Botão', 'flex-botao', 7),
    ('Tampa Traseira', 'tampa-traseira', 8),
    ('Alto-falante Auricular', 'alto-falante-auricular', 9),
    ('Alto-falante Principal', 'alto-falante-principal', 10),
    ('Tela', 'tela', 11),
    ('Bateria', 'bateria', 12),
    ('Conector de Carga', 'conector-de-carga', 13),
    ('Botão de Ligar', 'botao-de-ligar', 14),
    ('Botão de Volume', 'botao-de-volume', 15),
    ('Microfone', 'microfone', 16),
    ('Vibrador', 'vibrador', 17),
    ('Carcaça', 'carcaca', 18),
    ('Vidro Traseiro', 'vidro-traseiro', 19),
    ('Fone de Ouvido', 'fone-de-ouvido', 20),
    ('Cabo USB', 'cabo-usb', 21),
    ('Carregador', 'carregador', 22)
ON CONFLICT (slug) DO NOTHING;

-- =======================================
-- DADOS INICIAIS - PRODUCT_CONDITIONS
-- =======================================
INSERT INTO product_conditions (value, label, display_order) VALUES
    ('NEW', 'Novo', 1),
    ('USED', 'Usado', 2),
    ('REFURBISHED', 'Recondicionado', 3),
    ('ORIGINAL_RETIRADA', 'Original Retirada', 4)
ON CONFLICT (value) DO NOTHING;

-- =======================================
-- DADOS INICIAIS - BRANDS (garantir que existem)
-- =======================================
INSERT INTO brands (name, slug, display_order) VALUES
    ('Samsung', 'samsung', 1),
    ('Motorola', 'motorola', 2),
    ('Xiaomi', 'xiaomi', 3),
    ('Realme', 'realme', 4),
    ('Apple', 'apple', 5)
ON CONFLICT (slug) DO NOTHING;

-- =======================================
-- FINALIZAÇÃO
-- =======================================
DO $$
BEGIN
    RAISE NOTICE 'Migration 002 aplicada com sucesso no schema avelar_stocktech!';
    RAISE NOTICE 'Tabelas criadas: product_types, product_parts, product_conditions';
    RAISE NOTICE 'Coluna adicionada: products.product_type';
    RAISE NOTICE 'Dados iniciais inseridos em todas as tabelas de catálogo';
END $$;