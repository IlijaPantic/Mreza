-- name: UpsertInitialAdmin :one
INSERT INTO admin_users (email, role)
VALUES (sqlc.arg(email), sqlc.arg(role))
ON CONFLICT ((lower(email))) DO UPDATE SET active = true
RETURNING
  id,
  email,
  role,
  active,
  created_at,
  last_login_at,
  invited_by_admin_id,
  password_hash;

-- name: SetAdminPasswordHash :exec
UPDATE admin_users
SET password_hash = sqlc.arg(password_hash)
WHERE id = sqlc.arg(id);

-- name: SetAdminPasswordHashByEmail :exec
-- Za bootstrap iz env varijable: postavi hash adminu na osnovu email-a.
UPDATE admin_users
SET password_hash = sqlc.arg(password_hash)
WHERE lower(email) = lower(sqlc.arg(email));

-- name: GetAdminByEmail :one
SELECT
  id,
  email,
  role,
  active,
  created_at,
  last_login_at,
  invited_by_admin_id,
  password_hash
FROM admin_users
WHERE lower(email) = lower(sqlc.arg(email))
LIMIT 1;

-- name: GetAdminByID :one
SELECT
  id,
  email,
  role,
  active,
  created_at,
  last_login_at,
  invited_by_admin_id,
  password_hash
FROM admin_users
WHERE id = sqlc.arg(id);

-- name: TouchAdminLastLogin :exec
UPDATE admin_users
SET last_login_at = now()
WHERE id = sqlc.arg(id);

-- name: ListAdmins :many
SELECT
  id,
  email,
  role,
  active,
  created_at,
  last_login_at,
  invited_by_admin_id,
  password_hash
FROM admin_users
ORDER BY created_at DESC;

-- name: InsertAdmin :one
INSERT INTO admin_users (email, role, invited_by_admin_id, password_hash)
VALUES (sqlc.arg(email), sqlc.arg(role), sqlc.arg(invited_by_admin_id), sqlc.narg(password_hash))
RETURNING
  id,
  email,
  role,
  active,
  created_at,
  last_login_at,
  invited_by_admin_id,
  password_hash;

-- name: RevokeAdmin :one
UPDATE admin_users
SET active = false
WHERE id = sqlc.arg(id)
RETURNING
  id,
  email,
  role,
  active,
  created_at,
  last_login_at,
  invited_by_admin_id,
  password_hash;

-- name: ReactivateAdmin :one
UPDATE admin_users
SET active = true
WHERE id = sqlc.arg(id)
RETURNING
  id,
  email,
  role,
  active,
  created_at,
  last_login_at,
  invited_by_admin_id,
  password_hash;

-- name: CountSubmissionsForAdmin :one
-- Isti WHERE kao ListSubmissionsForAdmin (bez kursora) — daje total_count za paginaciju.
SELECT count(*)::bigint AS count
FROM campaign_submissions
WHERE (sqlc.narg(search)::text IS NULL OR name ILIKE '%' || sqlc.narg(search)::text || '%' OR surname ILIKE '%' || sqlc.narg(search)::text || '%' OR email ILIKE '%' || sqlc.narg(search)::text || '%' OR phone ILIKE '%' || sqlc.narg(search)::text || '%')
  AND (sqlc.narg(role)::text IS NULL OR roles ? sqlc.narg(role)::text)
  AND (sqlc.narg(network)::text IS NULL OR networks ? sqlc.narg(network)::text)
  AND (sqlc.narg(large_reach)::boolean IS NULL OR has_large_reach = sqlc.narg(large_reach)::boolean)
  AND (sqlc.narg(date_from)::timestamptz IS NULL OR created_at >= sqlc.narg(date_from)::timestamptz)
  AND (sqlc.narg(date_to)::timestamptz IS NULL OR created_at < sqlc.narg(date_to)::timestamptz);

-- name: ListSubmissionsForAdmin :many
-- Keyset paginacija: (created_at, id) < (cursor_created_at, cursor_id).
-- Uzima page_size + 1 redova da bi se znalo ima li sledece strane.
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
  profile_links,
  gdpr_consent
FROM campaign_submissions
WHERE (sqlc.narg(search)::text IS NULL OR name ILIKE '%' || sqlc.narg(search)::text || '%' OR surname ILIKE '%' || sqlc.narg(search)::text || '%' OR email ILIKE '%' || sqlc.narg(search)::text || '%' OR phone ILIKE '%' || sqlc.narg(search)::text || '%')
  AND (sqlc.narg(role)::text IS NULL OR roles ? sqlc.narg(role)::text)
  AND (sqlc.narg(network)::text IS NULL OR networks ? sqlc.narg(network)::text)
  AND (sqlc.narg(large_reach)::boolean IS NULL OR has_large_reach = sqlc.narg(large_reach)::boolean)
  AND (sqlc.narg(date_from)::timestamptz IS NULL OR created_at >= sqlc.narg(date_from)::timestamptz)
  AND (sqlc.narg(date_to)::timestamptz IS NULL OR created_at < sqlc.narg(date_to)::timestamptz)
  AND (sqlc.narg(cursor_created_at)::timestamptz IS NULL OR (created_at, id) < (sqlc.narg(cursor_created_at)::timestamptz, sqlc.narg(cursor_id)::uuid))
ORDER BY created_at DESC, id DESC
LIMIT sqlc.arg(page_size_plus_one);

-- name: GetSubmissionByID :one
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
  profile_links,
  gdpr_consent
FROM campaign_submissions
WHERE id = sqlc.arg(id);
