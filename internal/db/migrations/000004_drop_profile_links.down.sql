-- 000004_drop_profile_links.down.sql
--
-- Vraca kolonu, ali NE i podatke — sadrzaj obrisan u up migraciji je izgubljen.
-- Ako podaci treba da prezive rollback, snimi ih pre pokretanja up migracije.

ALTER TABLE campaign_submissions
  ADD COLUMN IF NOT EXISTS profile_links text;
