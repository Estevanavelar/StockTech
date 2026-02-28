-- Migration: 022 - Novo fluxo de trocas multi-etapa
-- Descrição: Adiciona novos status e campos para o fluxo de troca com reserva e validação

SET search_path TO avelar_stocktech;

-- Novos valores no enum return_status
ALTER TYPE avelar_stocktech.return_status ADD VALUE IF NOT EXISTS 'replacement_sent';
ALTER TYPE avelar_stocktech.return_status ADD VALUE IF NOT EXISTS 'defective_received';
ALTER TYPE avelar_stocktech.return_status ADD VALUE IF NOT EXISTS 'completed_approved';
ALTER TYPE avelar_stocktech.return_status ADD VALUE IF NOT EXISTS 'completed_rejected_by_vendor';
ALTER TYPE avelar_stocktech.return_status ADD VALUE IF NOT EXISTS 'converted_to_sale';
ALTER TYPE avelar_stocktech.return_status ADD VALUE IF NOT EXISTS 'returned_to_stock';

-- Novos campos na tabela product_returns
ALTER TABLE avelar_stocktech.product_returns ADD COLUMN IF NOT EXISTS replacement_product_id INTEGER;
ALTER TABLE avelar_stocktech.product_returns ADD COLUMN IF NOT EXISTS replacement_sent_at TIMESTAMP;
ALTER TABLE avelar_stocktech.product_returns ADD COLUMN IF NOT EXISTS defective_received_at TIMESTAMP;
ALTER TABLE avelar_stocktech.product_returns ADD COLUMN IF NOT EXISTS defective_validated_at TIMESTAMP;
ALTER TABLE avelar_stocktech.product_returns ADD COLUMN IF NOT EXISTS validation_notes TEXT;
ALTER TABLE avelar_stocktech.product_returns ADD COLUMN IF NOT EXISTS converted_to_sale_at TIMESTAMP;
ALTER TABLE avelar_stocktech.product_returns ADD COLUMN IF NOT EXISTS converted_order_id INTEGER;
ALTER TABLE avelar_stocktech.product_returns ADD COLUMN IF NOT EXISTS reserved_quantity INTEGER DEFAULT 0;
