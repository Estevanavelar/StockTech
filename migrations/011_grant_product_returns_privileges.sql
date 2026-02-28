-- Grant permissions for product_returns table to app role
SET search_path TO avelar_stocktech;

-- Conceder permissões do dono (supabase_admin) para postgres
GRANT USAGE ON SCHEMA avelar_stocktech TO postgres;
GRANT ALL PRIVILEGES ON TABLE avelar_stocktech.product_returns TO postgres;
GRANT USAGE, SELECT ON SEQUENCE avelar_stocktech.product_returns_id_seq TO postgres;

-- Also allow service role if needed
GRANT ALL PRIVILEGES ON TABLE avelar_stocktech.product_returns TO service_role;
GRANT USAGE, SELECT ON SEQUENCE avelar_stocktech.product_returns_id_seq TO service_role;
