-- name: CreateCampaignSubmission :one
INSERT INTO campaign_submissions (
  name,
  surname,
  email,
  phone,
  roles,
  networks,
  has_large_reach,
  large_reach_url,
  gdpr_consent,
  organization
) VALUES (
  sqlc.arg(name),
  sqlc.arg(surname),
  sqlc.narg(email),
  sqlc.arg(phone),
  sqlc.arg(roles),
  sqlc.arg(networks),
  sqlc.arg(has_large_reach),
  sqlc.narg(large_reach_url),
  sqlc.arg(gdpr_consent),
  sqlc.narg(organization)
)
RETURNING
  id,
  created_at,
  updated_at,
  name,
  surname,
  email,
  phone,
  roles,
  networks,
  has_large_reach,
  large_reach_url,
  gdpr_consent,
  organization;

-- name: GetCampaignSubmissionByEmail :one
SELECT
  id,
  created_at,
  updated_at,
  name,
  surname,
  email,
  phone,
  roles,
  networks,
  has_large_reach,
  large_reach_url,
  gdpr_consent,
  organization
FROM campaign_submissions
WHERE lower(email) = lower(sqlc.arg(email));
