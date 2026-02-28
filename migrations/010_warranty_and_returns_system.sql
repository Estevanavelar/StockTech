-- Migration: 010 - Sistema de Garantia e Devoluções
-- Descrição: Adiciona campos de garantia aos produtos, sistema de reserva de carrinho e tabela de devoluções

-- Criar enum de garantia
CREATE TYPE warranty_period AS ENUM (
  'NONE',           -- Sem garantia
  'DAYS_7',         -- 7 dias
  'DAYS_30',        -- 30 dias
  'DAYS_90',        -- 90 dias
  'MONTHS_6'        -- 6 meses
);

-- Adicionar campo de garantia na tabela products
ALTER TABLE products
  ADD COLUMN warranty_period warranty_period NOT NULL DEFAULT 'NONE',
  ADD COLUMN defective_quantity INTEGER NOT NULL DEFAULT 0;

-- Criar índice para busca por garantia
CREATE INDEX products_warranty_period_idx ON products(warranty_period);

-- Adicionar campos de reserva na tabela carts
ALTER TABLE carts
  ADD COLUMN reserved_until TIMESTAMP,
  ADD COLUMN reserved_at TIMESTAMP DEFAULT NOW();

-- Criar índice para limpeza de reservas expiradas
CREATE INDEX carts_reserved_until_idx ON carts(reserved_until) WHERE reserved_until IS NOT NULL;

-- Criar enum para status de devolução
CREATE TYPE return_status AS ENUM (
  'requested',
  'approved_replacement',
  'approved_refund',
  'rejected',
  'completed'
);

-- Criar tabela de devoluções/trocas
CREATE TABLE product_returns (
  id SERIAL PRIMARY KEY,

  -- Multi-tenant
  account_id VARCHAR(14) NOT NULL,
  buyer_id VARCHAR(11) NOT NULL,
  seller_id VARCHAR(11) NOT NULL,

  -- Referências
  order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  transaction_id INTEGER REFERENCES transactions(id) ON DELETE SET NULL,

  -- Dados da devolução
  return_code VARCHAR(20) NOT NULL UNIQUE,
  reason TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,

  -- Status do processo
  status return_status NOT NULL DEFAULT 'requested',

  -- Decisão do vendedor
  seller_decision VARCHAR(50), -- 'replacement', 'refund'
  seller_notes TEXT,

  -- Tracking
  approved_at TIMESTAMP,
  approved_by VARCHAR(11), -- CPF do vendedor
  completed_at TIMESTAMP,
  rejected_at TIMESTAMP,
  rejection_reason TEXT,

  -- Auditoria
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL,

  -- Validação de garantia (calculado no backend)
  is_within_warranty BOOLEAN NOT NULL DEFAULT true,
  warranty_expires_at TIMESTAMP
);

-- Índices para product_returns
CREATE INDEX product_returns_account_id_idx ON product_returns(account_id);
CREATE INDEX product_returns_buyer_id_idx ON product_returns(buyer_id);
CREATE INDEX product_returns_seller_id_idx ON product_returns(seller_id);
CREATE INDEX product_returns_order_id_idx ON product_returns(order_id);
CREATE INDEX product_returns_product_id_idx ON product_returns(product_id);
CREATE INDEX product_returns_status_idx ON product_returns(status);
CREATE INDEX product_returns_created_at_idx ON product_returns(created_at);

-- Criar enum para novos status de transação
ALTER TYPE transaction_status ADD VALUE IF NOT EXISTS 'return_requested';
ALTER TYPE transaction_status ADD VALUE IF NOT EXISTS 'returned';