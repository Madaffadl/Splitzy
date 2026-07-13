-- Adds the `role` column to `users`, moving admin access out of the hardcoded
-- email list and into the database so admins can be granted/revoked at runtime.
--
-- Additive + backfilled: every existing row defaults to 'user'. The final
-- statement seeds the original bootstrap admin so access is never interrupted
-- (the app also keeps an env/bootstrap-email fallback for lockout safety).
--
-- Run this in the Supabase dashboard → SQL Editor BEFORE deploying the new code.
--
-- Matches the DDL Prisma's `db push` would apply for User.role in schema.prisma.

-- AlterTable
ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "role" TEXT NOT NULL DEFAULT 'user';

-- Seed the initial admin (idempotent). Adjust the email if yours differs.
UPDATE "users" SET "role" = 'admin' WHERE lower("email") = 'm.daffafadhil26@gmail.com';
