-- 000004_drop_profile_links.up.sql
--
-- Polje "linkovi ka profilima i stranicama" je uklonjeno iz forme. Ostaje samo
-- link ka mediju/profilu veceg dometa (large_reach_url), koji je i jedini koji
-- se zapravo koristio pri proceni dometa.

ALTER TABLE campaign_submissions
  DROP COLUMN IF EXISTS profile_links;
