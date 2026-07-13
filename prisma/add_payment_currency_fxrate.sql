-- Migration: add currency + fx_rate columns to trip_payments
-- Run this in Supabase SQL Editor before deploying the new code.
ALTER TABLE trip_payments
  ADD COLUMN IF NOT EXISTS currency TEXT,
  ADD COLUMN IF NOT EXISTS fx_rate DOUBLE PRECISION;
