-- Manual migration: TripChangeRequest (member approval workflow).
-- Run in the Supabase SQL editor (prisma db push is blocked by the sandbox).
-- Matches model TripChangeRequest in prisma/schema.prisma.

CREATE TABLE IF NOT EXISTS trip_change_requests (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id      uuid         NOT NULL,
  author_id    uuid         NOT NULL,
  status       text         NOT NULL DEFAULT 'pending',
  base_version integer      NOT NULL,
  ops          jsonb        NOT NULL,
  note         text,
  review_note  text,
  reviewed_by  uuid,
  created_at   timestamp(3) NOT NULL DEFAULT now(),
  reviewed_at  timestamp(3),
  CONSTRAINT trip_change_requests_trip_id_fkey
    FOREIGN KEY (trip_id) REFERENCES trips(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS trip_change_requests_trip_id_status_idx
  ON trip_change_requests (trip_id, status);
