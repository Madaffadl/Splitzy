import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Cached at process startup so we don't pay timestamp on every probe.
const startedAt = Date.now();

// Force Node runtime — Edge can't open Postgres connections.
export const runtime = "nodejs";
// Always evaluated fresh (no Next.js cache).
export const dynamic = "force-dynamic";

/**
 * GET /api/health — Liveness + readiness probe.
 *
 * Returns 200 if the process can talk to the database, 503 otherwise.
 * Body is intentionally small and stable so it's cheap to call from uptime
 * monitors (UptimeRobot, Better Uptime, Vercel Cron, etc.).
 */
export async function GET() {
  const t0 = Date.now();
  let dbOk = false;
  let dbLatencyMs: number | null = null;

  try {
    // Cheapest possible round-trip — no table scan.
    await prisma.$queryRaw`SELECT 1`;
    dbOk = true;
    dbLatencyMs = Date.now() - t0;
  } catch {
    dbOk = false;
  }

  const body = {
    status: dbOk ? "ok" : "degraded",
    db: dbOk ? "ok" : "down",
    dbLatencyMs,
    uptimeMs: Date.now() - startedAt,
    // Vercel injects VERCEL_GIT_COMMIT_SHA at build time when deployed there.
    commit: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? null,
    region: process.env.VERCEL_REGION ?? null,
    nodeEnv: process.env.NODE_ENV,
    timestamp: new Date().toISOString(),
  };

  return NextResponse.json(body, {
    status: dbOk ? 200 : 503,
    headers: {
      // Don't cache — health must be fresh.
      "Cache-Control": "no-store, must-revalidate",
    },
  });
}
