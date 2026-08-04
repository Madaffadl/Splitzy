-- Sprint 6 Fase D: Referral system
-- Additive only — safe to apply to production before code deploy.
-- Apply to Supabase prod via SQL editor before merging this branch.

ALTER TABLE users ADD COLUMN IF NOT EXISTS referral_code TEXT UNIQUE;

CREATE TABLE IF NOT EXISTS referrals (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  referee_id  UUID        NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  rewarded_at TIMESTAMPTZ,
  reward_days INTEGER     NOT NULL DEFAULT 14
);

CREATE INDEX IF NOT EXISTS idx_referrals_referrer_id ON referrals(referrer_id);
