// Sentry init for the Edge runtime (middleware / edge routes). Same DSN guard
// as the server config — inert until SENTRY_DSN is set (audit T-19).
import * as Sentry from "@sentry/nextjs";

const dsn = process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? 0.1),
    environment: process.env.VERCEL_ENV || process.env.NODE_ENV,
    sendDefaultPii: false,
  });
}
