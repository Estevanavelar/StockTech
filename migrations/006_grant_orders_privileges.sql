-- Grant permissions for orders table to app role
SET search_path TO avelar_stocktech;

GRANT USAGE ON SCHEMA avelar_stocktech TO postgres;
GRANT ALL PRIVILEGES ON TABLE orders TO postgres;
GRANT USAGE, SELECT ON SEQUENCE orders_id_seq TO postgres;

-- Also allow service role if needed
GRANT ALL PRIVILEGES ON TABLE orders TO service_role;
GRANT USAGE, SELECT ON SEQUENCE orders_id_seq TO service_role;
