-- Manual migration: Review (user rating + moderation queue).
-- Run in the Supabase SQL editor (prisma db push is blocked by the sandbox).
-- Matches model Review in prisma/schema.prisma. Purely additive.
--
-- NOTE: the rating CHECK below has no Prisma equivalent, so a `db push`
-- rebuild (staging / DR restore) will NOT recreate it. Re-run this file after
-- any such rebuild. The API validates the same 1..5 range, so the constraint
-- is a backstop against a direct SQL write, not the primary guard.

CREATE TABLE IF NOT EXISTS reviews (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid         NOT NULL,
  rating       integer      NOT NULL,
  body         text,
  display_name text,
  source       text         NOT NULL DEFAULT 'dashboard',
  locale       text,
  status       text         NOT NULL DEFAULT 'pending',
  review_note  text,
  reviewed_by  uuid,
  reviewed_at  timestamp(3),
  created_at   timestamp(3) NOT NULL DEFAULT now(),
  updated_at   timestamp(3) NOT NULL DEFAULT now(),
  -- One review per account; re-submitting edits the existing row.
  CONSTRAINT reviews_user_id_key UNIQUE (user_id),
  CONSTRAINT reviews_rating_check CHECK (rating BETWEEN 1 AND 5),
  -- Cascade, not the RESTRICT default: five existing FKs to users already make
  -- account deletion impossible (PBI-023) and a sixth would deepen that hole.
  -- It is also the right privacy answer — deleting the account withdraws the
  -- testimonial with it.
  CONSTRAINT reviews_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Moderation queue read: one status, newest first.
CREATE INDEX IF NOT EXISTS reviews_status_created_at_idx
  ON reviews (status, created_at DESC);
