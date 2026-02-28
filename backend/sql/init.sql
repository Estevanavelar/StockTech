-- ========================================
-- STOCKTECH - Inicialização Banco Local
-- ========================================
-- Este script é executado automaticamente na primeira inicialização
-- do PostgreSQL local via Docker

-- Configurações do banco
SET timezone = 'America/Sao_Paulo';
SET default_text_search_config = 'portuguese';

-- =======================================
-- EXTENSÕES ÚTEIS
-- =======================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";     -- Para busca fuzzy
CREATE EXTENSION IF NOT EXISTS "unaccent";    -- Remove acentos
CREATE EXTENSION IF NOT EXISTS "citext";      -- Case insensitive text

-- =======================================
-- FUNÇÕES AUXILIARES
-- =======================================

-- Função para busca sem acento
CREATE OR REPLACE FUNCTION unaccent_lower(text)
RETURNS text AS $$
SELECT lower(unaccent($1));
$$ LANGUAGE SQL IMMUTABLE;

-- Função para gerar códigos únicos de produtos
CREATE OR REPLACE FUNCTION generate_product_code()
RETURNS text AS $$
DECLARE
    code text;
    exists_code boolean := true;
BEGIN
    WHILE exists_code LOOP
        -- Gera código: ST + 6 dígitos + letra aleatória
        code := 'ST' || LPAD(floor(random() * 999999)::text, 6, '0') || 
                chr(65 + floor(random() * 26)::int);
        
        -- Verifica se já existe
        SELECT EXISTS(SELECT 1 FROM products WHERE code = code) INTO exists_code;
    END LOOP;
    
    RETURN code;
END;
$$ LANGUAGE plpgsql;

-- =======================================
-- MENSAGEM DE INICIALIZAÇÃO
-- =======================================
DO $$
BEGIN
    RAISE NOTICE '🚀 StockTech Database inicializado com sucesso!';
    RAISE NOTICE '📊 Extensões: uuid-ossp, pg_trgm, unaccent, citext';
    RAISE NOTICE '🔧 Funções: generate_product_code(), unaccent_lower()';
    RAISE NOTICE '⏰ Timezone: America/Sao_Paulo';
    RAISE NOTICE '🇧🇷 Text Search: Portuguese';
END $$;