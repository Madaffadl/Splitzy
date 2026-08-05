"use client";

import Link from "next/link";
import { SearchX, Home, ArrowLeft, Sparkles } from "@/components/ui/icons";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-6 bg-background relative overflow-hidden">
      {/* Animated Background Grid */}
      <div className="absolute inset-0 grid-pattern opacity-50" />
      
      {/* Decorative Parallax Orbs */}
      <div className="hero-orb hero-orb-primary w-[300px] h-[300px] top-1/4 right-1/4 animate-float-slow opacity-30 blur-[80px]" />
      <div className="hero-orb hero-orb-accent w-[400px] h-[400px] bottom-1/4 left-1/4 animate-float-medium opacity-20 blur-[80px]" />

      <div className="relative z-10 flex flex-col items-center text-center max-w-lg w-full">
        {/* 404 Visual Icon */}
        <div className="relative mb-8 pt-4 pb-2 group animate-bounce-in">
          <div className="flex items-center justify-center gap-2 relative z-10">
            <span className="text-8xl sm:text-[9rem] font-extrabold tracking-tighter bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent leading-none drop-shadow-sm">
              4
            </span>
            <div className="flex items-center justify-center bg-gradient-to-br from-primary/10 to-accent/10 p-3 sm:p-4 rounded-3xl m-1 border-2 border-primary/10 shadow-lg">
              <SearchX className="w-16 h-16 sm:w-20 sm:h-20 text-accent animate-pulse" strokeWidth={2.5} />
            </div>
            <span className="text-8xl sm:text-[9rem] font-extrabold tracking-tighter bg-gradient-to-r from-accent to-primary bg-clip-text text-transparent leading-none drop-shadow-sm">
              4
            </span>
          </div>
          
          <Sparkles className="absolute top-0 right-10 text-primary w-8 h-8 animate-sparkle" style={{ animationDelay: '0s' }} />
          <Sparkles className="absolute bottom-4 left-10 text-accent w-6 h-6 animate-sparkle" style={{ animationDelay: '1.2s' }} />
        </div>

        {/* Content */}
        <div className="space-y-4 mb-10 animate-fade-in-up">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-accent/10 text-accent text-sm font-semibold mx-auto">
            <span>Page Not Found</span>
          </div>
          
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight">
            Lost your way in the receipt?
          </h1>
          
          <p className="text-muted-foreground text-lg px-4 leading-relaxed">
            The page you&rsquo;re trying to reach doesn&rsquo;t exist or has been moved. Let&rsquo;s get you back to settling those tabs!
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 w-full sm:w-auto animate-fade-in-up stagger-2">
          <Link href="/" className="w-full sm:w-auto">
            <Button 
              size="lg" 
              className="w-full rounded-xl shadow-lg hover:shadow-xl transition-all flex items-center gap-2 bg-gradient-to-r from-primary to-accent hover:scale-105"
            >
              <Home className="w-4 h-4" />
              Return Home
            </Button>
          </Link>
          
          <Button 
            variant="ghost" 
            size="lg" 
            onClick={() => window.history.back()}
            className="w-full sm:w-auto rounded-xl transition-all flex items-center gap-2 text-muted-foreground hover:bg-muted/50"
          >
            <ArrowLeft className="w-4 h-4" />
            Go Back
          </Button>
        </div>
      </div>
    </main>
  );
}
