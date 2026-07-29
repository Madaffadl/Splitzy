-- Manual migration: user activity log + last-login tracking.
-- Run in the Supabase SQL editor (prisma db push is blocked by the sandbox).
-- Matches User.lastLoginAt and model ActivityEvent in prisma/schema.prisma.

ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at timestamp(3);

CREATE TABLE IF NOT EXISTS activity_events (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid         NOT NULL,
  user_email text         NOT NULL,
  feature    text         NOT NULL,
  type       text         NOT NULL,
  metadata   jsonb,
  created_at timestamp(3) NOT NULL DEFAULT now(),
  CONSTRAINT activity_events_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS activity_events_created_at_idx
  ON activity_events (created_at DESC);
CREATE INDEX IF NOT EXISTS activity_events_user_id_created_at_idx
  ON activity_events (user_id, created_at DESC);
