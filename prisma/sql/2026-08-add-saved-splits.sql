-- Saved splits: let a signed-in user save a Single/Multiple split and resume it
-- later from the history page.
--
--   expires_at  — saved splits are a short-lived working copy, not an archive.
--                 Set to now() + 7 days on every save; the cleanup job hard-
--                 deletes lapsed rows. NULL means no expiry (Travel receipts,
--                 which live until the user deletes the trip).
--   share_code  — the read-only link created for this split, so re-saving
--                 updates THAT link rather than minting a second one.
--
-- Additive and nullable — safe to apply to production BEFORE the code deploy.
-- Existing rows get NULL for both, which reads as "never expires, not shared".
--
-- Apply in the Supabase SQL editor (prisma db push is blocked by the sandbox).

ALTER TABLE receipts
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS share_code TEXT;

-- The cleanup job sweeps by expiry.
CREATE INDEX IF NOT EXISTS receipts_expires_at_idx ON receipts (expires_at);

-- Shared links are refreshed when the split behind them is re-saved, so the
-- viewer needs to see when the numbers last moved.
ALTER TABLE shared_summaries
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP(3) NOT NULL DEFAULT now();
