-- Migration: 015 - Ajuste status de troca com schema
-- Descrição: Adiciona novos status ao enum order_status e garante owner postgres no schema correto

SET search_path TO avelar_stocktech;

DO $$
BEGIN
  IF to_regtype('avelar_stocktech.order_status') IS NOT NULL THEN
    ALTER TYPE avelar_stocktech.order_status ADD VALUE IF NOT EXISTS 'awaiting_exchange';
    ALTER TYPE avelar_stocktech.order_status ADD VALUE IF NOT EXISTS 'exchange_completed';
    ALTER TYPE avelar_stocktech.order_status ADD VALUE IF NOT EXISTS 'exchange_rejected';
    ALTER TYPE avelar_stocktech.order_status OWNER TO postgres;
  END IF;

  IF to_regtype('avelar_stocktech.return_status') IS NOT NULL THEN
    ALTER TYPE avelar_stocktech.return_status OWNER TO postgres;
  END IF;
END
$$;

ALTER TABLE IF EXISTS avelar_stocktech.product_returns OWNER TO postgres;
ALTER SEQUENCE IF EXISTS avelar_stocktech.product_returns_id_seq OWNER TO postgres;
