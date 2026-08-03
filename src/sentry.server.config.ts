// Sentry server-side init (audit T-19). Loaded from instrumentation.ts on the
// Node.js runtime. Initialisation is GUARDED by the DSN env var so the SDK is
// completely inert until a DSN is provisioned — safe to ship to production
// dark, then activate by setting SENTRY_DSN in the deploy environment.
import * as Sentry from "@sentry/nextjs";

const dsn = process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    // Keep tracing cheap by default; tune per environment.
    tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? 0.1),
    environment: process.env.VERCEL_ENV || process.env.NODE_ENV,
    // Don't send PII (IPs, headers) unless explicitly enabled.
    sendDefaultPii: false,
  });
}
