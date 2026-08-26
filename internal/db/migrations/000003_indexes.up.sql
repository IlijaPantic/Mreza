-- 000003_indexes.up.sql
--
-- Indeksi za admin panel (ListSubmissionsForAdmin / CountSubmissionsForAdmin).
-- Cisto optimizacija — ne menjaju semantiku nijednog upita.
--
-- Trigram indeksi zahtevaju pg_trgm (standardna PG ekstenzija) i pokrivaju
-- ILIKE '%...%' pretragu, koju b-tree indeks ne moze da iskoristi.

CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ORDER BY created_at DESC, id DESC + keyset paginacija.
CREATE INDEX IF NOT EXISTS campaign_submissions_created_at_id_idx
  ON campaign_submissions (created_at DESC, id DESC);

-- Filter po ulozi: roles ? 'kreator-sadrzaja'
CREATE INDEX IF NOT EXISTS campaign_submissions_roles_gin
  ON campaign_submissions USING gin (roles);

-- Filter po mrezi: networks ? 'instagram'
CREATE INDEX IF NOT EXISTS campaign_submissions_networks_gin
  ON campaign_submissions USING gin (networks);

-- Filter "samo veci domet" — partial indeks jer je to manjina redova.
CREATE INDEX IF NOT EXISTS campaign_submissions_large_reach_idx
  ON campaign_submissions (has_large_reach)
  WHERE has_large_reach;

-- Free-text pretraga u admin panelu gada name/surname/email/phone.
CREATE INDEX IF NOT EXISTS campaign_submissions_name_trgm_idx
  ON campaign_submissions USING gin (name gin_trgm_ops);

CREATE INDEX IF NOT EXISTS campaign_submissions_surname_trgm_idx
  ON campaign_submissions USING gin (surname gin_trgm_ops);

CREATE INDEX IF NOT EXISTS campaign_submissions_email_trgm_idx
  ON campaign_submissions USING gin (email gin_trgm_ops)
  WHERE email IS NOT NULL;

CREATE INDEX IF NOT EXISTS campaign_submissions_phone_trgm_idx
  ON campaign_submissions USING gin (phone gin_trgm_ops);
