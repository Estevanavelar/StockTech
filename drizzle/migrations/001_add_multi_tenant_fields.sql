-- ========================================
-- AVELAR SYSTEM - StockTech Multi-Tenant Migration
-- ========================================
-- Adiciona campos de isolamento multi-tenant ao StockTech
-- Vincula com AvAdmin (autenticação centralizada)

-- =======================================
-- EXTENSÕES NECESSÁRIAS
-- =======================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- =======================================
-- MIGRATION: Adicionar campos account_id e user references
-- =======================================

-- Tabela: products
ALTER TABLE products
ADD COLUMN IF NOT EXISTS account_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000',
ADD COLUMN IF NOT EXISTS created_by_user_id UUID;

-- Tabela: transactions
ALTER TABLE transactions
ADD COLUMN IF NOT EXISTS account_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000',
ADD COLUMN IF NOT EXISTS buyer_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000',
ADD COLUMN IF NOT EXISTS seller_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000';

-- Tabela: ratings
ALTER TABLE ratings
ADD COLUMN IF NOT EXISTS account_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000',
ADD COLUMN IF NOT EXISTS reviewer_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000';

-- Tabela: addresses
ALTER TABLE addresses
ADD COLUMN IF NOT EXISTS account_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000',
ADD COLUMN IF NOT EXISTS user_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000';

-- Tabela: sellerProfiles (case-sensitive)
ALTER TABLE "sellerProfiles"
ADD COLUMN IF NOT EXISTS account_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000',
ADD COLUMN IF NOT EXISTS user_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000';

-- Tabela: carts
ALTER TABLE carts
ADD COLUMN IF NOT EXISTS account_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000',
ADD COLUMN IF NOT EXISTS user_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000';

-- =======================================
-- ÍNDICES PARA PERFORMANCE
-- =======================================

-- Products
CREATE INDEX IF NOT EXISTS idx_products_account_id ON products(account_id);
CREATE INDEX IF NOT EXISTS idx_products_created_by_user_id ON products(created_by_user_id);

-- Transactions
CREATE INDEX IF NOT EXISTS idx_transactions_account_id ON transactions(account_id);
CREATE INDEX IF NOT EXISTS idx_transactions_buyer_id ON transactions(buyer_id);
CREATE INDEX IF NOT EXISTS idx_transactions_seller_id ON transactions(seller_id);

-- Ratings
CREATE INDEX IF NOT EXISTS idx_ratings_account_id ON ratings(account_id);
CREATE INDEX IF NOT EXISTS idx_ratings_reviewer_id ON ratings(reviewer_id);

-- Addresses
CREATE INDEX IF NOT EXISTS idx_addresses_account_id ON addresses(account_id);
CREATE INDEX IF NOT EXISTS idx_addresses_user_id ON addresses(user_id);

-- SellerProfiles
CREATE INDEX IF NOT EXISTS idx_sellerProfiles_account_id ON "sellerProfiles"(account_id);
CREATE INDEX IF NOT EXISTS idx_sellerProfiles_user_id ON "sellerProfiles"(user_id);

-- Carts
CREATE INDEX IF NOT EXISTS idx_carts_account_id ON carts(account_id);
CREATE INDEX IF NOT EXISTS idx_carts_user_id ON carts(user_id);

-- =======================================
-- REMOVER TABELA USERS (se existir)
-- =======================================
-- Usuários são gerenciados pelo AvAdmin

DROP TABLE IF EXISTS users CASCADE;

-- =======================================
-- DADOS INICIAIS PARA TESTE
-- =======================================

-- Inserir conta demo (mesma do AvAdmin)
-- NOTA: Estes dados serão populados quando o AvAdmin estiver conectado

-- =======================================
-- FINALIZAÇÃO
-- =======================================

DO $$
BEGIN
    RAISE NOTICE '🚀 StockTech Multi-Tenant Migration aplicada com sucesso!';
    RAISE NOTICE '📊 Campos adicionados: account_id, user_id/uuid references';
    RAISE NOTICE '🔗 Vinculação com AvAdmin: accounts e users';
    RAISE NOTICE '🗑️  Tabela removida: users (centralizada no AvAdmin)';
    RAISE NOTICE '⚡ Índices criados para isolamento de dados';
END $$;

