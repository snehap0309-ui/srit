-- Enable trigram similarity for typo-tolerant place search (nidaan → Nidan)
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX IF NOT EXISTS places_name_trgm_idx ON places USING GIN (name gin_trgm_ops);
