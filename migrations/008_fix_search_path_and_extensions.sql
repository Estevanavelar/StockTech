-- Fix function search_path and move extensions out of public

-- Ensure extensions schema exists
CREATE SCHEMA IF NOT EXISTS extensions;

-- Move extensions to extensions schema
ALTER EXTENSION IF EXISTS pg_trgm SET SCHEMA extensions;
ALTER EXTENSION IF EXISTS unaccent SET SCHEMA extensions;

-- Set explicit search_path on update_updated_at_column functions
CREATE OR REPLACE FUNCTION avelar_admin.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = avelar_admin, public
AS $function$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION avelar_stocktech.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = avelar_stocktech, public
AS $function$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$function$;
