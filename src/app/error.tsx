"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertCircle, RotateCcw, Home, Sparkles } from "@/components/ui/icons";
import { Button } from "@/components/ui/button";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Optionally log the error to an error reporting service
    console.error(error);
  }, [error]);

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-6 bg-background relative overflow-hidden">
      {/* Animated Background Grid */}
      <div className="absolute inset-0 grid-pattern opacity-50" />
      
      {/* Decorative Parallax Orbs */}
      <div className="hero-orb hero-orb-accent w-[300px] h-[300px] top-1/4 left-1/4 animate-float-slow opacity-40 blur-[80px]" />
      <div className="hero-orb hero-orb-primary w-[300px] h-[300px] bottom-1/4 right-1/4 animate-float-medium opacity-30 blur-[80px]" />

      <div className="relative z-10 flex flex-col items-center text-center max-w-lg w-full">
        {/* Error Icon Wrapper */}
        <div className="relative mb-8 group">
          <div className="absolute inset-0 bg-destructive/20 rounded-full blur-2xl scale-125 animate-pulse" />
          <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-[2rem] bg-gradient-to-br from-destructive/30 to-destructive/5 flex items-center justify-center border-2 border-destructive/20 shadow-2xl relative z-10 animate-bounce-in">
            <AlertCircle className="w-12 h-12 sm:w-14 sm:h-14 text-destructive" />
          </div>
          
          {/* Sparkles around icon */}
          <Sparkles className="absolute -top-4 -right-2 text-destructive/60 w-6 h-6 animate-sparkle" style={{ animationDelay: '0s' }} />
          <Sparkles className="absolute bottom-0 -left-6 text-destructive/40 w-5 h-5 animate-sparkle" style={{ animationDelay: '1s' }} />
        </div>

        {/* Content */}
        <div className="space-y-4 mb-10 animate-fade-in-up">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-destructive/10 text-destructive text-sm font-semibold mx-auto">
            <span>500 System Error</span>
          </div>
          
          <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight">
             <span className="text-foreground">Oops! Something</span>
             <br />
             <span className="bg-gradient-to-r from-destructive to-rose-400 bg-clip-text text-transparent">went wrong.</span>
          </h1>
          
          <p className="text-muted-foreground text-lg px-4 leading-relaxed">
            We apologize, but it seems an unexpected error occurred while processing your request. Don&rsquo;t worry, your data is safe!
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 w-full sm:w-auto animate-fade-in-up stagger-2">
          <Button 
            onClick={() => reset()} 
            size="lg" 
            className="w-full sm:w-auto rounded-xl shadow-lg hover:shadow-xl transition-all flex items-center gap-2 bg-foreground text-background hover:bg-foreground/90"
          >
            <RotateCcw className="w-4 h-4" />
            Try Again
          </Button>
          
          <Link href="/" className="w-full sm:w-auto">
            <Button 
              variant="outline" 
              size="lg" 
              className="w-full rounded-xl border-border bg-card/50 hover:bg-accent/10 hover:text-accent hover:border-accent/50 transition-all flex items-center gap-2"
            >
              <Home className="w-4 h-4" />
              Back to Home
            </Button>
          </Link>
        </div>
        
        {/* Error details snippet for dev/debugging - minimal styling */}
        {process.env.NODE_ENV !== 'production' && (
           <p className="mt-12 text-xs text-muted-foreground font-mono bg-muted/50 border border-muted px-4 py-2 rounded-lg max-w-full overflow-hidden text-ellipsis whitespace-nowrap opacity-60">
             {error.message || "Unknown Error Check Console"}
           </p>
        )}
      </div>
    </main>
  );
}
