-- 000002_admin_users.up.sql
--
-- Admin nalozi za interni panel. Dva puta prijave:
--   1) password login  — password_hash (bcrypt) postavljen
--   2) Google OAuth    — email whitelisted ovde, password_hash moze biti NULL
--
-- role: 'admin' moze da poziva/ukida druge admine; 'viewer' samo cita prijave.

CREATE TABLE admin_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL CHECK (email = lower(email)),
  role text NOT NULL CHECK (role IN ('admin', 'viewer')),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_login_at timestamptz,
  invited_by_admin_id uuid REFERENCES admin_users(id) ON DELETE SET NULL,
  -- NULL = admin moze samo Google OAuth. Non-NULL = bcrypt hash.
  password_hash text
);

CREATE UNIQUE INDEX admin_users_email_lower_idx
  ON admin_users (lower(email));
