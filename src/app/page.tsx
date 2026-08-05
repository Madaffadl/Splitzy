import { NewLanding } from "@/components/landing/NewLanding";

// The RSC landing (audit T-14) is now the permanent landing — the newLanding
// flag was contracted once it proved stable in production, and the legacy
// client landing was removed.
export default function Home() {
  return <NewLanding />;
}
