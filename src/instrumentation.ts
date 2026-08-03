// Next.js instrumentation hook (audit T-19). Runs once per runtime at startup
// and wires Sentry into the correct runtime's config. onRequestError forwards
// uncaught errors from server components / route handlers to Sentry.
import type { Instrumentation } from "next";

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}

export const onRequestError: Instrumentation.onRequestError = async (...args) => {
  // Lazy import so the Sentry SDK isn't pulled into runtimes that never error.
  const { captureRequestError } = await import("@sentry/nextjs");
  return captureRequestError(...args);
};
