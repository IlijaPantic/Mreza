-- 000005_add_organization.down.sql
--
-- Vraca stanje pre 000005. Podaci u koloni se gube.

ALTER TABLE campaign_submissions
  DROP CONSTRAINT IF EXISTS campaign_submissions_organization_len;

ALTER TABLE campaign_submissions
  DROP COLUMN IF EXISTS organization;
