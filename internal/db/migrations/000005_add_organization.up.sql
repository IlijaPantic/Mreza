-- 000005_add_organization.up.sql
--
-- Organizacija / plenum / pokret / udruzenje blisko studentima, preko kog se
-- prijavljeni moze verifikovati. Opciono polje.
--
-- Ogranicenje duzine stoji i ovde, ne samo u handleru: kolona je kratko ime
-- organizacije, a ne slobodan tekst, pa CHECK cuva tu nameru i kad bi neko
-- pisao u bazu mimo aplikacije. char_length (ne octet_length) jer nasa slova
-- zauzimaju po dva bajta.

ALTER TABLE campaign_submissions
  ADD COLUMN organization text;

ALTER TABLE campaign_submissions
  ADD CONSTRAINT campaign_submissions_organization_len
    CHECK (organization IS NULL OR char_length(organization) <= 50);
