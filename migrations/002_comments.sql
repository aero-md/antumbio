CREATE TABLE IF NOT EXISTS comments (
    id           BIGSERIAL    PRIMARY KEY,
    pseudo       TEXT         NOT NULL,
    visitor_hash TEXT         NOT NULL,
    content      TEXT         NOT NULL,
    signature    TEXT,
    created_at   TIMESTAMPTZ  NOT NULL DEFAULT now(),
    UNIQUE (pseudo, visitor_hash)
);

CREATE INDEX IF NOT EXISTS idx_comments_pseudo_created
    ON comments(pseudo, created_at DESC);

-- Force l'owner de la table (et de sa sequence BIGSERIAL) au owner de la BDD.
-- Sans ça, exécuter ce script via un query tool connecté en superuser ou en
-- compte applicatif autre que l'owner laisse les nouveaux objets avec un
-- owner divergent du reste du schéma. Idempotent.
DO $$
DECLARE
    db_owner TEXT;
BEGIN
    SELECT pg_catalog.pg_get_userbyid(datdba) INTO db_owner
    FROM pg_database
    WHERE datname = current_database();

    EXECUTE format('ALTER TABLE comments OWNER TO %I', db_owner);
    EXECUTE format('ALTER SEQUENCE comments_id_seq OWNER TO %I', db_owner);
END $$;
