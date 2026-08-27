// Product funnel analytics (audit Sprint 3). This is distinct from the admin
// ActivityEvent monitoring — this feeds the conversion funnel (landing → scan →
// split → upgrade) that the audit flagged as missing.
//
// Backed by PostHog, but fully inert until NEXT_PUBLIC_POSTHOG_KEY is set:
// posthog-js is *dynamically imported only when a key exists*, so when analytics
// is off it isn't even shipped/initialised. All helpers no-op gracefully.

"use client";

import type { PostHog } from "posthog-js";

const KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY;
const HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com";

let clientPromise: Promise<PostHog | null> | null = null;

export function isAnalyticsEnabled(): boolean {
  return typeof window !== "undefined" && Boolean(KEY);
}

function getClient(): Promise<PostHog | null> {
  if (!isAnalyticsEnabled()) return Promise.resolve(null);
  if (!clientPromise) {
    clientPromise = import("posthog-js").then(({ default: posthog }) => {
      posthog.init(KEY as string, {
        api_host: HOST,
        capture_pageview: false, // we send SPA pageviews manually
        capture_pageleave: true,
        autocapture: false, // explicit events only — keeps the funnel clean
        person_profiles: "identified_only",
      });
      return posthog;
    });
  }
  return clientPromise;
}

/** Stable event names — one place so the funnel stays consistent. */
export const EVENTS = {
  pageview: "$pageview",
  modeSelected: "mode_selected",
  scanStarted: "scan_started",
  scanCompleted: "scan_completed",
  quotaHit: "scan_quota_hit",
  splitCompleted: "split_completed",
  shareWhatsapp: "share_whatsapp",
  upgradeClicked: "upgrade_clicked",
  pricingViewed: "pricing_viewed",
  // PWA install funnel. The ratio of installPromptAvailable → appInstalled is
  // the only signal we have that installing actually works: both the Chrome
  // heuristics and Google's WebAPK build server sit outside our control and
  // fail silently. See src/components/PwaInstallTelemetry.tsx.
  installPromptAvailable: "pwa_install_prompt_available",
  appInstalled: "pwa_app_installed",
  launchedStandalone: "pwa_launched_standalone",
} as const;

export async function capture(
  event: string,
  properties?: Record<string, unknown>
): Promise<void> {
  const ph = await getClient();
  ph?.capture(event, properties);
}

export async function capturePageview(path: string): Promise<void> {
  const ph = await getClient();
  ph?.capture(EVENTS.pageview, { $current_url: path });
}

export async function identify(
  distinctId: string,
  properties?: Record<string, unknown>
): Promise<void> {
  const ph = await getClient();
  ph?.identify(distinctId, properties);
}

export async function resetAnalytics(): Promise<void> {
  const ph = await getClient();
  ph?.reset();
}
