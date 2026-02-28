-- =======================================
-- TABELA: USER_PREFERENCES
-- =======================================
-- Executar via: docker exec supabase-db psql -U postgres -f /migrations/003_add_user_preferences.sql

SET search_path TO avelar_stocktech;

CREATE TABLE IF NOT EXISTS user_preferences (
    id SERIAL PRIMARY KEY,
    
    -- Multi-tenant
    account_id UUID NOT NULL,
    user_id UUID NOT NULL,
    
    email_notifications BOOLEAN NOT NULL DEFAULT true,
    marketing_offers BOOLEAN NOT NULL DEFAULT true,
    data_sharing BOOLEAN NOT NULL DEFAULT false,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    
    CONSTRAINT user_preferences_account_user_unique UNIQUE (account_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_user_preferences_account_id ON user_preferences(account_id);
CREATE INDEX IF NOT EXISTS idx_user_preferences_user_id ON user_preferences(user_id);
CREATE INDEX IF NOT EXISTS idx_user_preferences_account_user ON user_preferences(account_id, user_id);

DO $$
BEGIN
    RAISE NOTICE '✅ Tabela user_preferences criada com sucesso!';
END $$;

