"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Loader2, CheckCircle2, AlertCircle, UserPlus } from "@/components/ui/icons";
import { Logo } from "@/components/ui/Logo";
import { BRAND } from "@/lib/brand";

interface InviteInfo {
  tripId: string;
  tripName: string;
  invitedBy: string;
  expiresAt: string;
}

type PageState = "loading" | "invalid" | "ready" | "joining" | "joined" | "error";

export default function InvitePage() {
  const { token } = useParams<{ token: string }>();
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading, signIn } = useAuth();

  const [info, setInfo] = useState<InviteInfo | null>(null);
  const [pageState, setPageState] = useState<PageState>("loading");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    async function fetchInfo() {
      try {
        const res = await fetch(`/api/invite/${token}`);
        if (!res.ok) {
          setPageState("invalid");
          return;
        }
        const data = (await res.json()) as InviteInfo;
        setInfo(data);
        setPageState("ready");
      } catch {
        setPageState("invalid");
      }
    }
    if (token) void fetchInfo();
  }, [token]);

  const handleJoin = async () => {
    if (!isAuthenticated) {
      signIn(`/invite/${token}`);
      return;
    }
    setPageState("joining");
    try {
      const res = await fetch(`/api/invite/${token}/join`, { method: "POST" });
      if (res.ok) {
        setPageState("joined");
        setTimeout(() => router.push("/travel"), 1800);
      } else {
        const body = await res.json().catch(() => ({}));
        setErrorMsg((body as { message?: string }).message ?? "Something went wrong.");
        setPageState("error");
      }
    } catch {
      setErrorMsg("Network error. Please try again.");
      setPageState("error");
    }
  };

  const loading = authLoading || pageState === "loading";

  return (
    <main className="min-h-screen flex flex-col">
      <header className="px-3 sm:px-6 py-3 sm:py-4 border-b glass sticky top-0 z-10">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <Logo size="md" />
            <span className="font-semibold text-sm sm:text-base">{BRAND.name}</span>
          </Link>
          <ThemeToggle />
        </div>
      </header>

      <div className="flex-grow flex items-center justify-center px-4 py-12">
        <Card className="w-full max-w-md">
          {loading && (
            <>
              <CardHeader className="text-center">
                <div className="mx-auto mb-3 h-12 w-12 rounded-full bg-muted flex items-center justify-center">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
                <CardTitle>Loading invite…</CardTitle>
              </CardHeader>
            </>
          )}

          {!loading && pageState === "invalid" && (
            <>
              <CardHeader className="text-center">
                <div className="mx-auto mb-3 h-12 w-12 rounded-full bg-destructive/10 flex items-center justify-center">
                  <AlertCircle className="h-6 w-6 text-destructive" />
                </div>
                <CardTitle>Invite not found</CardTitle>
                <CardDescription>
                  This invite link has expired or is no longer valid.
                </CardDescription>
              </CardHeader>
              <CardFooter>
                <Button asChild className="w-full" variant="outline">
                  <Link href="/">Back to Splitzy</Link>
                </Button>
              </CardFooter>
            </>
          )}

          {!loading && (pageState === "ready" || pageState === "joining") && info && (
            <>
              <CardHeader className="text-center">
                <div className="mx-auto mb-3 h-12 w-12 rounded-full bg-emerald-500/10 flex items-center justify-center">
                  <UserPlus className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
                </div>
                <CardTitle>You&apos;ve been invited!</CardTitle>
                <CardDescription>
                  <span className="font-semibold text-foreground">{info.invitedBy}</span> invited you
                  to join the trip
                </CardDescription>
              </CardHeader>
              <CardContent className="text-center">
                <div className="rounded-xl border bg-muted/40 px-4 py-3">
                  <p className="text-lg font-bold">{info.tripName}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Expires {new Date(info.expiresAt).toLocaleDateString()}
                  </p>
                </div>
                {!isAuthenticated && (
                  <p className="text-sm text-muted-foreground mt-4">
                    Sign in with Google to join this trip.
                  </p>
                )}
              </CardContent>
              <CardFooter className="flex flex-col gap-2">
                <Button
                  className="w-full gap-2"
                  onClick={() => void handleJoin()}
                  disabled={pageState === "joining"}
                >
                  {pageState === "joining" ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <UserPlus className="h-4 w-4" />
                  )}
                  {isAuthenticated ? "Join trip" : "Sign in to join"}
                </Button>
                <Button asChild variant="ghost" className="w-full">
                  <Link href="/">Cancel</Link>
                </Button>
              </CardFooter>
            </>
          )}

          {!loading && pageState === "joined" && info && (
            <>
              <CardHeader className="text-center">
                <div className="mx-auto mb-3 h-12 w-12 rounded-full bg-emerald-500/10 flex items-center justify-center">
                  <CheckCircle2 className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
                </div>
                <CardTitle>You&apos;re in!</CardTitle>
                <CardDescription>
                  You&apos;ve joined <span className="font-semibold text-foreground">{info.tripName}</span>.
                  Redirecting…
                </CardDescription>
              </CardHeader>
              <CardContent className="flex justify-center">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </CardContent>
            </>
          )}

          {!loading && pageState === "error" && (
            <>
              <CardHeader className="text-center">
                <div className="mx-auto mb-3 h-12 w-12 rounded-full bg-destructive/10 flex items-center justify-center">
                  <AlertCircle className="h-6 w-6 text-destructive" />
                </div>
                <CardTitle>Failed to join</CardTitle>
                <CardDescription>{errorMsg}</CardDescription>
              </CardHeader>
              <CardFooter className="flex flex-col gap-2">
                <Button className="w-full" onClick={() => setPageState("ready")}>Try again</Button>
                <Button asChild variant="ghost" className="w-full">
                  <Link href="/">Back to Splitzy</Link>
                </Button>
              </CardFooter>
            </>
          )}
        </Card>
      </div>
    </main>
  );
}
