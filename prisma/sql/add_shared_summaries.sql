-- Adds the `shared_summaries` table backing the trip-summary share links
-- (/s/<code>). Purely additive — it does not touch any existing table.
--
-- Run this in the Supabase dashboard → SQL Editor (works from the browser even
-- when local Postgres ports are firewalled). After running, the /api/share
-- endpoint and the /s/<code> page work without any further migration.
--
-- This is the exact DDL Prisma's `db push` would have applied for the
-- SharedSummary model in prisma/schema.prisma.

-- CreateTable
CREATE TABLE "shared_summaries" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "created_by" UUID,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "shared_summaries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "shared_summaries_code_key" ON "shared_summaries"("code");

-- CreateIndex
CREATE INDEX "shared_summaries_expires_at_idx" ON "shared_summaries"("expires_at");

-- AddForeignKey
ALTER TABLE "shared_summaries" ADD CONSTRAINT "shared_summaries_created_by_fkey"
    FOREIGN KEY ("created_by") REFERENCES "users"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
