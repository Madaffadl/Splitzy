"use client";

import { useEffect } from "react";
import { capture, EVENTS } from "@/lib/analytics";

/**
 * Observes the PWA install funnel. Renders nothing and changes no behaviour.
 *
 * Why this exists: a broken manifest icon made Android installs fail silently
 * for an unknown number of months, and we only found out because someone tried
 * it on their own phone. Both halves of that path — Chrome's install heuristics
 * and Google's WebAPK build server — are outside our control and report nothing
 * when they fail, so the only way to know installing works is to measure the
 * two ends ourselves:
 *
 *   pwa_install_prompt_available  → Chrome judged the site installable
 *   pwa_app_installed             → an install actually completed
 *
 * A healthy gap between those is normal (most people decline). A gap of 100%
 * over a meaningful sample means the install path is broken again.
 *
 * IMPORTANT: this deliberately does NOT call preventDefault() on
 * beforeinstallprompt. Doing so suppresses Chrome's own install UI and hands us
 * the responsibility of surfacing our own — and if that UI is ever missing or
 * buggy we would remove installs rather than add them. Listening passively
 * leaves browser behaviour exactly as it is today. The cost is `userChoice`,
 * which only resolves reliably when we call prompt() ourselves; accepted-vs-
 * dismissed is not worth taking that risk for until the data says otherwise.
 */
export function PwaInstallTelemetry() {
  useEffect(() => {
    if (typeof window === "undefined") return;

    // Fires when Chrome decides the site meets the install criteria.
    const onBeforeInstallPrompt = (event: Event) => {
      const platforms = (event as Event & { platforms?: string[] }).platforms;
      capture(EVENTS.installPromptAvailable, { platforms: platforms ?? null });
    };

    // Fires on a completed install, whether it came from Chrome's prompt or
    // the browser's own menu. Never fires on iOS.
    const onAppInstalled = () => {
      capture(EVENTS.appInstalled);
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", onAppInstalled);

    // iOS emits neither event, so a home-screen launch is the only evidence
    // that anyone added the app there. `navigator.standalone` is the iOS-only
    // signal; the media query covers Android and desktop. Root layout mounts
    // this once per document load, so this counts launches, not navigations.
    const standalone =
      window.matchMedia?.("(display-mode: standalone)").matches ||
      (window.navigator as Navigator & { standalone?: boolean }).standalone ===
        true;

    if (standalone) {
      capture(EVENTS.launchedStandalone);
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onAppInstalled);
    };
  }, []);

  return null;
}
