"use client";

import Link from "next/link";
import { Receipt, Layers, Plane, ArrowRight, Sparkles, Calculator, Users, CheckCircle2, Mail, Network, ArrowRightLeft, History } from "@/components/ui/icons";
import { Logo } from "@/components/ui/Logo";
import { ThemeToggle } from "@/components/ThemeToggle";
import { AuthButton } from "@/components/AuthButton";
import { useAuth } from "@/hooks/useAuth";
import { BRAND, copyrightYear } from "@/lib/brand";
import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { LogIn } from "@/components/ui/icons";

function LoginBanner() {
  const { isAuthenticated, signIn } = useAuth();
  const searchParams = useSearchParams();
  const loginRequired = searchParams.get("login") === "required";
  const redirectPath = searchParams.get("redirect") || "/multiple";

  if (!loginRequired || isAuthenticated) return null;

  return (
    <div className="bg-primary/10 border-b border-primary/20 px-4 py-3">
      <div className="max-w-5xl mx-auto flex items-center justify-between gap-3">
        <p className="text-sm text-foreground">
          Sign in to view your Receipt History across devices.
        </p>
        <button
          onClick={() => signIn(redirectPath)}
          className="flex items-center gap-2 text-sm font-medium text-primary hover:underline whitespace-nowrap"
        >
          <LogIn className="h-4 w-4" />
          Sign in with Google
        </button>
      </div>
    </div>
  );
}

export function LegacyLanding() {
  const { isAuthenticated } = useAuth();
  const [scrollY, setScrollY] = useState(0);
  const strikeRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = strikeRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.classList.add("is-visible");
          observer.disconnect();
        }
      },
      { threshold: 0.5 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    let scrollFrame = 0;
    let pendingScroll = 0;

    const handleScroll = () => {
      pendingScroll = window.scrollY;
      if (scrollFrame) return;
      scrollFrame = requestAnimationFrame(() => {
        setScrollY(pendingScroll);
        scrollFrame = 0;
      });
    };

    window.addEventListener("scroll", handleScroll, { passive: true });

    return () => {
      window.removeEventListener("scroll", handleScroll);
      if (scrollFrame) cancelAnimationFrame(scrollFrame);
    };
  }, []);

  return (
    <main className="min-h-screen flex flex-col overflow-hidden">
      {/* Header */}
      <header className="px-4 sm:px-6 py-3 sm:py-4 glass sticky top-0 z-50">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2 sm:gap-3">
            <Logo size="md" />
            <div className="flex flex-col">
              <span className="font-bold text-base sm:text-lg tracking-tight">Splitzy</span>
              <span className="text-[10px] text-muted-foreground font-medium -mt-0.5 hidden sm:block">Split Bills Easily</span>
            </div>
          </div>
          <div className="flex items-center gap-3 sm:gap-4">
            {isAuthenticated && (
              <Link
                href="/history"
                aria-label="Receipt history"
                className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                <History className="h-4 w-4" />
                <span className="hidden sm:inline">History</span>
              </Link>
            )}
            <ThemeToggle />
            <AuthButton />
          </div>
        </div>
      </header>

      {/* Login Required Banner */}
      <Suspense fallback={null}>
        <LoginBanner />
      </Suspense>

      {/* Hero */}
      <section className="flex-1 flex flex-col items-center justify-center px-4 sm:px-6 py-8 sm:py-16 gradient-bg relative overflow-hidden min-h-[70dvh] sm:min-h-[85dvh]">
        {/* Animated Background Grid */}
        <div className="absolute inset-0 grid-pattern opacity-50" />
        
        {/* Background Orbs */}
        <div className="hero-orb hero-orb-primary w-[500px] h-[500px] -top-40 -left-40 animate-float-slow" />
        <div className="hero-orb hero-orb-accent w-[400px] h-[400px] -bottom-20 -right-20 animate-float-medium" />
        <div className="hero-orb hero-orb-primary w-[300px] h-[300px] top-1/3 right-1/4 animate-float-rotate opacity-30" />

        {/* Single floating decorative icon — kept minimal so the CTA stays focal */}
        <div
          className="absolute top-1/3 right-[15%] text-accent/20 animate-float-medium hidden sm:block"
          style={{ transform: `translateY(${scrollY * -0.1}px)` }}
          aria-hidden="true"
        >
          <Calculator className="h-10 w-10" />
        </div>


        <div 
          className="max-w-2xl mx-auto text-center space-y-8 relative z-10"
          style={{ transform: `translateY(${scrollY * -0.2}px)` }}
        >
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-accent/15 border border-accent/30 text-sm font-semibold text-foreground shadow-sm animate-bounce-in">
            <div className="w-2 h-2 rounded-full bg-accent animate-pulse" />
            Don&rsquo;t be the unpaid friend
          </div>
          
          {/* Headline */}
          <div className="space-y-4">
            <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight leading-tight animate-fade-in-up">
              <span className="gradient-text animate-gradient bg-gradient-to-r from-primary via-accent to-primary">Split Bills</span>
              <br />
              <span className="text-foreground animate-fade-in-up stagger-2">With Friends</span>
            </h1>
            
            <p className="text-lg text-muted-foreground max-w-md mx-auto leading-relaxed animate-fade-in-up stagger-3">
              Dining out or traveling? Calculate who owes what with 
              <span className="text-primary font-semibold"> minimal transactions</span>.
            </p>
          </div>

          {/* Mode Selection */}
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5 pt-4">
            {/* Single Receipt Card */}
            <Link
              href="/single"
              className="group relative overflow-hidden rounded-2xl border-2 border-transparent bg-card p-6 text-left transition-all duration-500 hover:shadow-premium-lg hover:border-primary/30 hover-lift animate-fade-in-left stagger-4"
            >
              {/* Animated Background Gradient */}
              <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-primary/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              
              {/* Decorative gradient */}
              <div className="absolute top-0 right-0 w-40 h-40 bg-gradient-to-br from-primary/20 via-primary/5 to-transparent rounded-bl-full opacity-60 group-hover:opacity-100 group-hover:scale-110 transition-all duration-500" />
              
              {/* Shimmer overlay */}
              <div className="absolute inset-0 opacity-0 group-hover:opacity-100 group-hover:animate-shimmer transition-opacity duration-300" />
              
              <div className="relative">
                {/* Icon */}
                <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center mb-5 group-hover:scale-110 group-hover:shadow-lg group-hover:shadow-primary/20 transition-all duration-500 group-hover:animate-glow-pulse">
                  <Receipt className="h-7 w-7 text-primary group-hover:scale-110 transition-transform duration-300" />
                </div>
                
                {/* Content */}
                <h2 className="text-xl font-bold mb-2 group-hover:text-primary transition-colors duration-300">
                  Single Receipt
                </h2>
                <p className="text-sm text-muted-foreground mb-5 leading-relaxed">
                  Split a single dining bill or any shared expense with friends.
                </p>
                
                {/* CTA */}
                <div className="flex items-center gap-2 text-sm font-semibold text-primary">
                  <span>Start Splitting</span>
                  <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center group-hover:bg-primary group-hover:text-primary-foreground transition-all duration-300">
                    <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-0.5 transition-transform" />
                  </div>
                </div>
              </div>
            </Link>

            {/* Multiple Receipt Card */}
            <Link
              href="/multiple"
              className="group relative overflow-hidden rounded-2xl border-2 border-transparent bg-card p-6 text-left transition-all duration-500 hover:shadow-premium-lg hover:border-accent/30 hover-lift animate-fade-in-right stagger-4"
            >
              {/* Animated Background Gradient */}
              <div className="absolute inset-0 bg-gradient-to-br from-accent/5 via-transparent to-accent/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              
              {/* Decorative gradient */}
              <div className="absolute top-0 right-0 w-40 h-40 bg-gradient-to-br from-accent/20 via-accent/5 to-transparent rounded-bl-full opacity-60 group-hover:opacity-100 group-hover:scale-110 transition-all duration-500" />
              
              {/* Shimmer overlay */}
              <div className="absolute inset-0 opacity-0 group-hover:opacity-100 group-hover:animate-shimmer transition-opacity duration-300" />
              
              <div className="relative">
                {/* Popular badge */}
                <div className="absolute top-4 right-4 px-2.5 py-1 rounded-full bg-accent text-accent-foreground text-[10px] font-bold shadow-md shadow-accent/30 animate-bounce-in z-10">
                  POPULAR
                </div>
                
                {/* Icon */}
                <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-accent/20 to-accent/5 flex items-center justify-center mb-5 group-hover:scale-110 group-hover:shadow-lg group-hover:shadow-accent/20 transition-all duration-500 group-hover:animate-glow-pulse-accent">
                  <Layers className="h-7 w-7 text-accent group-hover:scale-110 transition-all duration-300" />
                </div>

                {/* Content */}
                <h2 className="text-xl font-bold mb-2 group-hover:text-accent transition-colors duration-300">
                  Multiple Receipts
                </h2>
                <p className="text-sm text-muted-foreground mb-5 leading-relaxed">
                  Track several receipts with different payers and settle up together.
                </p>

                {/* CTA */}
                <div className="flex items-center gap-2 text-sm font-semibold text-accent">
                  <span>Start Splitting</span>
                  <div className="w-6 h-6 rounded-full bg-accent/10 flex items-center justify-center group-hover:bg-accent group-hover:text-accent-foreground transition-all duration-300">
                    <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-0.5 transition-transform" />
                  </div>
                </div>
              </div>
            </Link>

            {/* Travel Spend Card */}
            <Link
              href="/travel"
              className="group relative overflow-hidden rounded-2xl border-2 border-transparent bg-card p-6 text-left transition-all duration-500 hover:shadow-premium-lg hover:border-emerald-500/30 hover-lift animate-fade-in-right stagger-4 sm:col-span-2 lg:col-span-1"
            >
              {/* Animated Background Gradient */}
              <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 via-transparent to-emerald-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

              {/* Decorative gradient */}
              <div className="absolute top-0 right-0 w-40 h-40 bg-gradient-to-br from-emerald-500/20 via-emerald-500/5 to-transparent rounded-bl-full opacity-60 group-hover:opacity-100 group-hover:scale-110 transition-all duration-500" />

              {/* Shimmer overlay */}
              <div className="absolute inset-0 opacity-0 group-hover:opacity-100 group-hover:animate-shimmer transition-opacity duration-300" />

              <div className="relative">
                {/* New badge */}
                <div className="absolute top-4 right-4 px-2.5 py-1 rounded-full bg-emerald-500 text-white text-[10px] font-bold shadow-md shadow-emerald-500/30 animate-bounce-in z-10">
                  NEW
                </div>

                {/* Icon */}
                <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-emerald-500/5 flex items-center justify-center mb-5 group-hover:scale-110 group-hover:shadow-lg group-hover:shadow-emerald-500/20 transition-all duration-500">
                  <Plane className="h-7 w-7 text-emerald-600 dark:text-emerald-400 group-hover:scale-110 group-hover:-rotate-12 transition-all duration-300" />
                </div>

                {/* Content */}
                <h2 className="text-xl font-bold mb-2 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors duration-300">
                  Travel Spend
                </h2>
                <p className="text-sm text-muted-foreground mb-5 leading-relaxed">
                  Log expenses across a whole trip and see who owes whom, anytime.
                </p>

                {/* CTA */}
                <div className="flex items-center gap-2 text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                  <span>Start a Trip</span>
                  <div className="w-6 h-6 rounded-full bg-emerald-500/10 flex items-center justify-center group-hover:bg-emerald-500 group-hover:text-white transition-all duration-300">
                    <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-0.5 transition-transform" />
                  </div>
                </div>
              </div>
            </Link>
          </div>
        </div>

        {/* Scroll Indicator — outer div owns the X-centering transform,
            inner div owns the fadeIn animation. Keeping them on separate
            elements prevents the keyframe `transform: translateY(...)` from
            overwriting the `translateX(-50%)` centering. */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2">
          <div className="flex flex-col items-center gap-2 animate-fade-in stagger-6">
            <span className="text-xs text-muted-foreground font-medium">Scroll</span>
            <div className="w-6 h-10 rounded-full border-2 border-muted-foreground/30 relative">
              <div className="absolute top-2 left-1/2 -translate-x-1/2">
                <div className="w-1.5 h-3 bg-muted-foreground/50 rounded-full animate-float-fast" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="px-6 py-20 border-t bg-card relative overflow-hidden">
        {/* Background decoration */}
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-primary/20 to-transparent" />
        
        <div className="max-w-4xl mx-auto">
          {/* Section Header */}
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 mb-4">
              <div className="w-8 h-0.5 bg-accent rounded-full animate-wave" />
              <span className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">How It Works</span>
              <div className="w-8 h-0.5 bg-accent rounded-full animate-wave" style={{ animationDelay: '0.5s' }} />
            </div>
            <h2 className="text-3xl font-bold">
              Three Simple <span className="gradient-text">Steps</span>
            </h2>
          </div>
          
          {/* Feature Cards */}
          <div className="grid md:grid-cols-3 gap-8">
            {/* Step 1 */}
            <div 
              className="relative text-left group"
              style={{ transform: `translateY(${Math.max(0, (scrollY - 400) * -0.03)}px)` }}
            >
              <div className="absolute -top-3 -left-3 w-8 h-8 rounded-full bg-primary text-primary-foreground text-sm font-bold flex items-center justify-center shadow-lg shadow-primary/30 animate-scale-in">
                1
              </div>
              <div className="p-6 rounded-2xl bg-background border-2 border-transparent group-hover:border-primary/20 transition-all duration-500 hover-lift">
                <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center mb-4 group-hover:scale-110 group-hover:rotate-6 transition-all duration-500 group-hover:animate-glow-pulse">
                  <Users className="h-7 w-7 text-primary" />
                </div>
                <h3 className="font-bold text-lg mb-2">Add Participants</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Enter the names of everyone who&rsquo;s splitting the bill
                </p>
              </div>
            </div>
            
            {/* Step 2 */}
            <div 
              className="relative text-left group"
              style={{ transform: `translateY(${Math.max(0, (scrollY - 450) * -0.03)}px)` }}
            >
              <div className="absolute -top-3 -left-3 w-8 h-8 rounded-full bg-accent text-accent-foreground text-sm font-bold flex items-center justify-center shadow-lg shadow-accent/30 animate-scale-in stagger-2">
                2
              </div>
              <div className="p-6 rounded-2xl bg-background border-2 border-transparent group-hover:border-accent/20 transition-all duration-500 hover-lift">
                <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-accent/20 to-accent/5 flex items-center justify-center mb-4 group-hover:scale-110 group-hover:-rotate-6 transition-all duration-500 group-hover:animate-glow-pulse-accent">
                  <Receipt className="h-7 w-7 text-accent" />
                </div>
                <h3 className="font-bold text-lg mb-2">Add Items</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Scan receipt with AI or add items manually
                </p>
              </div>
            </div>
            
            {/* Step 3 */}
            <div 
              className="relative text-left group"
              style={{ transform: `translateY(${Math.max(0, (scrollY - 500) * -0.03)}px)` }}
            >
              <div className="absolute -top-3 -left-3 w-8 h-8 rounded-full bg-emerald-500 text-white text-sm font-bold flex items-center justify-center shadow-lg shadow-emerald-500/30 animate-scale-in stagger-3">
                3
              </div>
              <div className="p-6 rounded-2xl bg-background border-2 border-transparent group-hover:border-emerald-500/20 transition-all duration-500 hover-lift">
                <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-emerald-500/5 flex items-center justify-center mb-4 group-hover:scale-110 group-hover:rotate-6 transition-all duration-500">
                  <CheckCircle2 className="h-7 w-7 text-emerald-500" />
                </div>
                <h3 className="font-bold text-lg mb-2">See Results</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Get who pays what with minimal transactions
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Behind the Scenes Section */}
      <section className="px-6 py-20 relative overflow-hidden bg-background">
        <div className="max-w-5xl mx-auto">
          {/* Section Header */}
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 mb-4">
              <div className="w-8 h-0.5 bg-primary rounded-full animate-wave" />
              <span className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Under The Hood</span>
              <div className="w-8 h-0.5 bg-primary rounded-full animate-wave" style={{ animationDelay: '0.5s' }} />
            </div>
            <h2 className="text-3xl font-bold mb-4">
              Behind the <span className="gradient-text bg-gradient-to-r from-primary to-accent">Calculation</span>
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              How we process your bills from initial input to final settlement, ensuring fair distribution and the least amount of transfers possible.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 relative">
            {/* Connecting lines for large screens */}
            <div className="hidden lg:block absolute top-[28px] left-[10%] w-[80%] h-0.5 bg-gradient-to-r from-primary/20 via-accent/20 to-emerald-500/20 z-0" />

            {/* Step 1 */}
            <div className="relative bg-card p-6 rounded-2xl border-2 border-transparent hover:border-primary/20 transition-all duration-500 hover-lift z-10 group">
               <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-primary/10 to-transparent rounded-bl-full opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
               <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center mb-6 mx-auto lg:mx-0 group-hover:scale-110 group-hover:-rotate-6 transition-transform duration-300">
                 <Calculator className="w-7 h-7 text-primary" />
               </div>
               <h3 className="font-bold text-lg mb-3">1. Item Allocation</h3>
               <p className="text-sm text-muted-foreground leading-relaxed">Each item&rsquo;s price is calculated and divided exactly among the people who shared it.</p>
            </div>

            {/* Step 2 */}
            <div className="relative bg-card p-6 rounded-2xl border-2 border-transparent hover:border-accent/20 transition-all duration-500 hover-lift z-10 group">
               <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-accent/10 to-transparent rounded-bl-full opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
               <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-accent/20 to-accent/5 flex items-center justify-center mb-6 mx-auto lg:mx-0 group-hover:scale-110 group-hover:rotate-6 transition-transform duration-300">
                 <Receipt className="w-7 h-7 text-accent" />
               </div>
               <h3 className="font-bold text-lg mb-3">2. Proportional Fees</h3>
               <p className="text-sm text-muted-foreground leading-relaxed">Taxes, service, and discounts are fairly scaled based on each person&rsquo;s subtotal share.</p>
            </div>

            {/* Step 3 */}
            <div className="relative bg-card p-6 rounded-2xl border-2 border-transparent hover:border-emerald-500/20 transition-all duration-500 hover-lift z-10 group">
               <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-emerald-500/10 to-transparent rounded-bl-full opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
               <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-emerald-500/5 flex items-center justify-center mb-6 mx-auto lg:mx-0 group-hover:scale-110 group-hover:-rotate-6 transition-transform duration-300">
                 <Network className="w-7 h-7 text-emerald-500" />
               </div>
               <h3 className="font-bold text-lg mb-3">3. Debt Graphing</h3>
               <p className="text-sm text-muted-foreground leading-relaxed">We map out everybody&rsquo;s balance against the main payer to create a web of debts.</p>
            </div>

            {/* Step 4 */}
            <div className="relative bg-card p-6 rounded-2xl border-2 border-transparent hover:border-indigo-500/20 transition-all duration-500 hover-lift z-10 group">
               <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-indigo-500/10 to-transparent rounded-bl-full opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
               <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500/20 to-indigo-500/5 flex items-center justify-center mb-6 mx-auto lg:mx-0 group-hover:scale-110 group-hover:rotate-6 transition-transform duration-300">
                 <ArrowRightLeft className="w-7 h-7 text-indigo-500" />
               </div>
               <h3 className="font-bold text-lg mb-3">4. Smart Settlement</h3>
               <p className="text-sm text-muted-foreground leading-relaxed">The algorithm cancels out messy transfers, minimizing the total transactions needed.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA Section */}
      <section className="px-6 py-24 relative overflow-hidden bg-card border-t">
        {/* Background Decorative Elements */}
        <div className="absolute top-0 right-0 w-1/2 h-full bg-gradient-to-l from-primary/5 to-transparent skew-x-12 translate-x-32" />
        <div className="absolute bottom-0 left-0 w-1/2 h-1/2 bg-gradient-to-tr from-accent/5 to-transparent rounded-tr-full" />
        
        <div className="max-w-4xl mx-auto text-center relative z-10">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-semibold mb-6 animate-fade-in-up">
            <Sparkles className="w-4 h-4" />
            <span>Ready to settle the tab?</span>
          </div>
          
          <h2 className="text-4xl md:text-5xl font-bold mb-6">
            <span className="inline-block animate-fade-in-up stagger-2">Stop doing</span>{" "}
            <span ref={strikeRef} className="inline-block animate-fade-in-up stagger-2 text-muted-foreground animate-strike-draw">math.</span><br />
            <span className="inline-block animate-fade-in-late">Start splitting</span>{" "}
            <span className="inline-block animate-fade-in-later gradient-text bg-gradient-to-r from-primary to-accent">fairly.</span>
          </h2>
          
          <p className="text-lg text-muted-foreground mb-10 max-w-2xl mx-auto animate-fade-in-up stagger-3">
            Choose your splitting mode and get back to enjoying your time with friends. <br className="hidden sm:block" /> Free to try — sign in only to save your splits & history.
          </p>
          
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 animate-fade-in-up stagger-4">
            <Link
              href="/single"
              className="w-full sm:w-auto px-8 py-4 rounded-xl bg-primary text-primary-foreground font-bold shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/40 hover:-translate-y-1 transition-all flex items-center justify-center gap-2 group relative overflow-hidden"
            >
              <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
              <Receipt className="w-5 h-5 relative z-10 group-hover:scale-110 transition-transform" />
              <span className="relative z-10">Split Single Bill</span>
            </Link>
            
            <Link
              href="/multiple"
              className="w-full sm:w-auto px-8 py-4 rounded-xl bg-transparent border-2 border-border hover:border-accent/50 hover:bg-accent/5 text-foreground font-bold shadow-sm hover:shadow-md transition-all flex items-center justify-center gap-2 group"
            >
              <Layers className="w-5 h-5 text-accent transition-transform group-hover:scale-110" />
              Split Multiple Receipts
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="px-4 sm:px-6 py-6 sm:py-8 border-t bg-card">
        <div className="max-w-5xl mx-auto flex flex-col items-center gap-5 sm:flex-row sm:justify-between">
          <div className="flex items-center gap-2 sm:gap-3">
            <Logo size="sm" className="h-7 w-7 sm:h-8 sm:w-8" />
            <div className="flex flex-col">
              <span className="font-semibold text-xs sm:text-sm">{BRAND.name}</span>
              <span className="text-[10px] sm:text-xs text-muted-foreground">{BRAND.tagline}</span>
            </div>
          </div>
          <nav className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs text-muted-foreground">
            <Link href="/privacy" className="hover:text-foreground transition-colors">Privacy Policy</Link>
            <Link href="/terms" className="hover:text-foreground transition-colors">Terms of Service</Link>
            <a href={`mailto:${BRAND.supportEmail}`} className="flex items-center gap-1.5 hover:text-foreground transition-colors">
              <Mail className="h-3.5 w-3.5" />
              <span>Support</span>
            </a>
          </nav>
        </div>
        <p className="max-w-5xl mx-auto mt-5 text-center sm:text-left text-[11px] text-muted-foreground/70">
          © {copyrightYear()} {BRAND.name}. All rights reserved.
        </p>
      </footer>
    </main>
  );
}
