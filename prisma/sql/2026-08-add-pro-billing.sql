-- Manual migration: Pro billing (one-time monthly via Xendit).
-- Run in the Supabase SQL editor BEFORE deploying the Sprint 2 code — the
-- entitlement check (lib/scan-quota) starts selecting users.pro_expires_at, so
-- the column must exist first. Purely ADDITIVE (Expand): a nullable column and
-- a new table; no existing behaviour changes (no user has pro_expires_at set).
-- Matches User.proExpiresAt and model Payment in prisma/schema.prisma.

ALTER TABLE users ADD COLUMN IF NOT EXISTS pro_expires_at timestamp(3);

CREATE TABLE IF NOT EXISTS payments (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid         NOT NULL,
  external_id text         NOT NULL,
  xendit_id   text,
  amount      integer      NOT NULL,
  currency    text         NOT NULL DEFAULT 'IDR',
  status      text         NOT NULL DEFAULT 'pending',
  plan        text         NOT NULL DEFAULT 'pro',
  period_days integer      NOT NULL DEFAULT 30,
  invoice_url text,
  paid_at     timestamp(3),
  created_at  timestamp(3) NOT NULL DEFAULT now(),
  updated_at  timestamp(3) NOT NULL DEFAULT now(),
  CONSTRAINT payments_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS payments_external_id_key ON payments (external_id);
CREATE UNIQUE INDEX IF NOT EXISTS payments_xendit_id_key ON payments (xendit_id);
CREATE INDEX IF NOT EXISTS payments_user_id_created_at_idx ON payments (user_id, created_at DESC);
