CREATE TABLE IF NOT EXISTS page_views (
    id           BIGSERIAL    PRIMARY KEY,
    pseudo       TEXT         NOT NULL,
    visitor_hash TEXT         NOT NULL,
    viewed_at    TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_page_views_pseudo
    ON page_views(pseudo);

CREATE INDEX IF NOT EXISTS idx_page_views_dedup
    ON page_views(pseudo, visitor_hash, viewed_at DESC);
