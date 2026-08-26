-- 000001_campaign_submissions.up.sql
--
-- Jedna prijava za ucesce u javnoj medijskoj kampanji = jedan red.
--
-- roles / networks su jsonb ARRAY-evi kebab-case slug-ova (npr. '["kreator-sadrzaja"]').
-- Slug je stabilan wire/storage oblik; proto enum <-> slug mapiranje zivi u
-- internal/catalog. Array (a ne zasebna join tabela) je namerno: lista je
-- fiksna i kratka, a `jsonb ? 'slug'` uz GIN indeks pokriva sve admin filtere.

CREATE TABLE campaign_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  name text NOT NULL,
  surname text NOT NULL,
  -- email je opcion; kad postoji, jedinstven je (partial index ispod).
  email text,
  -- phone pokriva i telefon i WhatsApp — obavezan kontakt.
  phone text NOT NULL,
  roles jsonb NOT NULL,
  networks jsonb NOT NULL DEFAULT '[]'::jsonb,
  has_large_reach boolean NOT NULL DEFAULT false,
  large_reach_url text,
  profile_links text,
  gdpr_consent boolean NOT NULL,

  -- Prijava bez ijedne uloge nema smisla — cuvamo invariant i na DB nivou,
  -- ne samo u handleru.
  CONSTRAINT campaign_submissions_roles_not_empty
    CHECK (jsonb_typeof(roles) = 'array' AND jsonb_array_length(roles) > 0),
  CONSTRAINT campaign_submissions_networks_is_array
    CHECK (jsonb_typeof(networks) = 'array'),
  -- URL veceg dometa je besmislen bez cekirane opcije.
  CONSTRAINT campaign_submissions_large_reach_url_requires_flag
    CHECK (large_reach_url IS NULL OR has_large_reach),
  -- Saglasnost je preduslov za upis; false red ne sme da postoji.
  CONSTRAINT campaign_submissions_gdpr_consent_required
    CHECK (gdpr_consent)
);

-- Duplikat se detektuje po email-u, ali samo kad je email dat: partial index
-- dozvoljava vise prijava bez email-a.
CREATE UNIQUE INDEX campaign_submissions_email_lower_idx
  ON campaign_submissions (lower(email))
  WHERE email IS NOT NULL;
