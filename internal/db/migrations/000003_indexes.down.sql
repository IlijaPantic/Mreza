-- 000003_indexes.down.sql
-- Vraca stanje pre 000003. pg_trgm se NE drop-uje — mogu ga koristiti drugi objekti.

DROP INDEX IF EXISTS campaign_submissions_phone_trgm_idx;
DROP INDEX IF EXISTS campaign_submissions_email_trgm_idx;
DROP INDEX IF EXISTS campaign_submissions_surname_trgm_idx;
DROP INDEX IF EXISTS campaign_submissions_name_trgm_idx;
DROP INDEX IF EXISTS campaign_submissions_large_reach_idx;
DROP INDEX IF EXISTS campaign_submissions_networks_gin;
DROP INDEX IF EXISTS campaign_submissions_roles_gin;
DROP INDEX IF EXISTS campaign_submissions_created_at_id_idx;
