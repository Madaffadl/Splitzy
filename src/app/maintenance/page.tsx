"use client";

import { Wrench, Sparkles, RefreshCcw, HandHeart } from "@/components/ui/icons";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Button } from "@/components/ui/button";

export default function MaintenancePage() {
  return (
    <main className="min-h-screen bg-background flex flex-col relative overflow-hidden">
      {/* Background Orbs */}
      <div className="absolute top-0 right-0 w-1/2 h-1/2 bg-gradient-to-l from-primary/10 to-transparent blur-3xl opacity-50" />
      <div className="absolute bottom-0 left-0 w-1/2 h-1/2 bg-gradient-to-tr from-accent/10 to-transparent blur-3xl opacity-50" />

      {/* Header */}
      <header className="px-6 py-4 flex justify-end relative z-10">
        <ThemeToggle />
      </header>

      {/* Main Content */}
      <div className="flex-1 flex flex-col items-center justify-center p-6 relative z-10 text-center">
        <div className="max-w-md w-full space-y-8 animate-fade-in-up">
          {/* Icon Container */}
          <div className="relative mx-auto w-24 h-24">
            <div className="absolute inset-0 bg-primary/20 rounded-full animate-ping opacity-75" />
            <div className="relative w-full h-full bg-gradient-to-br from-background to-muted border shadow-xl shadow-primary/10 rounded-full flex items-center justify-center">
              <Wrench className="w-10 h-10 text-primary animate-float-slow" />
            </div>
            {/* Sparkles */}
            <Sparkles className="absolute -top-4 -right-2 w-6 h-6 text-accent animate-spin-slow" />
          </div>

          <div className="space-y-4">
            <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight">
              We&rsquo;ll be <span className="gradient-text bg-gradient-to-r from-primary to-accent">right back.</span>
            </h1>
            <p className="text-lg text-muted-foreground leading-relaxed">
              Splitzy is currently undergoing scheduled maintenance to improve your experience. 
              Our engineers are working hard to bring it back online.
            </p>
          </div>

          {/* Status Box */}
          <div className="bg-card border rounded-2xl p-6 shadow-sm flex flex-col items-center space-y-4">
            <div className="flex items-center gap-3">
              <div className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-500"></span>
              </div>
              <span className="font-medium text-amber-500">System Upgrading</span>
            </div>
            
            <p className="text-sm text-muted-foreground">
              Thank you for your patience while we make things better.
            </p>

            <Button onClick={() => window.location.reload()} variant="outline" className="w-full mt-2">
              <RefreshCcw className="w-4 h-4 mr-2" />
              Refresh Status
            </Button>
          </div>

          <p className="text-xs text-muted-foreground pt-8 flex items-center justify-center gap-1">
            Made with <HandHeart className="w-3 h-3 text-red-500" /> by the Splitzy team
          </p>
        </div>
      </div>
    </main>
  );
}
