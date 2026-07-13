-- Adds the `admin_audit_logs` table: an append-only trail of privileged admin
-- mutations (plan / quota / ban changes made via /api/admin/users/[id]).
--
-- Purely additive — it does not touch any existing table. There is deliberately
-- NO foreign key to `users`: the trail must survive account deletion, so the
-- actor and target emails are denormalized snapshots taken at write time.
--
-- Run this in the Supabase dashboard → SQL Editor BEFORE deploying the new
-- code (the PATCH handler writes to this table inside its transaction).
--
-- This is the exact DDL Prisma's `db push` would have applied for the
-- AdminAuditLog model in prisma/schema.prisma.

-- CreateTable
CREATE TABLE IF NOT EXISTS "admin_audit_logs" (
    "id" UUID NOT NULL,
    "actor_id" UUID NOT NULL,
    "actor_email" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "target_user_id" UUID,
    "target_email" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "admin_audit_logs_created_at_idx"
    ON "admin_audit_logs"("created_at" DESC);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "admin_audit_logs_target_user_id_idx"
    ON "admin_audit_logs"("target_user_id");
