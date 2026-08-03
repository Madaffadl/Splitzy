// Sentry browser init (audit T-19). Next.js loads this automatically on the
// client. Guarded by the public DSN so it stays inert until configured — no
// network calls, no bundle-time surprises for real users until we opt in by
// setting NEXT_PUBLIC_SENTRY_DSN.
import * as Sentry from "@sentry/nextjs";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    tracesSampleRate: Number(process.env.NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE ?? 0.1),
    // Session Replay is off by default (privacy + bundle cost); enable later.
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 0,
    environment: process.env.NEXT_PUBLIC_VERCEL_ENV || process.env.NODE_ENV,
    sendDefaultPii: false,
  });
}

// Required by @sentry/nextjs to instrument App Router navigations. Safe to
// export unconditionally — it's a no-op when Sentry isn't initialised.
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
