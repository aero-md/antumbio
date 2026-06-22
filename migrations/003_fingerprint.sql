-- Plan sécurité #03 — fingerprint en signal secondaire (jamais clé d'unicité).
-- Colonne nullable, sans contrainte ni index unique : purement informative,
-- exploitable à la main en SQL si un abus est suspecté.
ALTER TABLE page_views ADD COLUMN IF NOT EXISTS fingerprint TEXT;
ALTER TABLE comments   ADD COLUMN IF NOT EXISTS fingerprint TEXT;
