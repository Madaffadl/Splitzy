-- Add receipts.payload_json — the full client Receipt (assignments, fees,
-- discounts, currency + fxRate) stored as one JSON document.
--
-- WHY: the relational columns cannot express a split. item_assignments.user_id
-- is a foreign key to users, so it can only record that an ACCOUNT HOLDER
-- consumed an item — but a split is between arbitrary named people who mostly
-- have no account. Importing a guest split silently dropped every assignment,
-- fee and discount, and then the client cleared localStorage. This mirrors
-- trip_receipts.payload, which the Travel path has always used.
--
-- Additive and nullable — safe to apply to production BEFORE the code deploy.
-- Existing rows keep reading from the relational columns.
--
-- Apply in the Supabase SQL editor (prisma db push is blocked by the sandbox).

ALTER TABLE receipts ADD COLUMN IF NOT EXISTS payload_json JSONB;
