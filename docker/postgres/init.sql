-- PostgreSQL initialization for FotoPro
-- Runs once on first container start

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";    -- Trigram indexes for LIKE searches
CREATE EXTENSION IF NOT EXISTS "unaccent";   -- Accent-insensitive search (pt-BR)

-- Create a read-only reporting role
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'fotopro_readonly') THEN
        CREATE ROLE fotopro_readonly;
    END IF;
END $$;

GRANT CONNECT ON DATABASE fotopro TO fotopro_readonly;
GRANT USAGE ON SCHEMA public TO fotopro_readonly;

-- Full-text search configuration for Portuguese (FIXED VERSION)
DO $$
BEGIN
    -- Verifica se a configuração já existe antes de criar
    IF NOT EXISTS (SELECT 1 FROM pg_ts_config WHERE cfgname = 'portuguese_unaccent') THEN
        CREATE TEXT SEARCH CONFIGURATION portuguese_unaccent (COPY = portuguese);
        
        -- Aplica os mappings apenas na criação inicial
        ALTER TEXT SEARCH CONFIGURATION portuguese_unaccent
            ALTER MAPPING FOR hword, hword_part, word WITH unaccent, portuguese_stem;
    END IF;
END $$;