-- Fix owner of product_returns table to postgres
-- This migration should be run as supabase_admin or superuser

SET search_path TO avelar_stocktech;

-- Alterar dono da tabela e sequência para postgres
ALTER TABLE avelar_stocktech.product_returns OWNER TO postgres;
ALTER SEQUENCE avelar_stocktech.product_returns_id_seq OWNER TO postgres;

-- Garantir permissões
GRANT ALL PRIVILEGES ON TABLE avelar_stocktech.product_returns TO postgres;
GRANT USAGE, SELECT ON SEQUENCE avelar_stocktech.product_returns_id_seq TO postgres;
