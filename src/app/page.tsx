import { isEnabled } from "@/lib/flags";
import { LegacyLanding } from "@/components/landing/LegacyLanding";
import { NewLanding } from "@/components/landing/NewLanding";

// Server Component switch (audit T-14). Default OFF → the existing client
// landing renders exactly as before. Flip NEXT_PUBLIC_FLAG_NEW_LANDING on to
// serve the new RSC landing. Keeping the switch in a server component means the
// legacy bundle isn't shipped when the new landing is live.
export default function Home() {
  if (isEnabled("newLanding")) return <NewLanding />;
  return <LegacyLanding />;
}
