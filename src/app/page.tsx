"use client";

import Link from "next/link";
import { Receipt, Plane, ArrowRight, Sparkles, Calculator, Users, Zap, CheckCircle2, Star, Mail, Instagram, Linkedin, Phone } from "lucide-react";
import { useEffect, useState } from "react";

export default function Home() {
  const [scrollY, setScrollY] = useState(0);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const handleScroll = () => {
      setScrollY(window.scrollY);
    };

    const handleMouseMove = (e: MouseEvent) => {
      setMousePosition({
        x: (e.clientX / window.innerWidth - 0.5) * 20,
        y: (e.clientY / window.innerHeight - 0.5) * 20,
      });
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("mousemove", handleMouseMove, { passive: true });

    return () => {
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("mousemove", handleMouseMove);
    };
  }, []);

  return (
    <main className="min-h-screen flex flex-col overflow-hidden">
      {/* Header */}
      <header className="px-4 sm:px-6 py-3 sm:py-4 glass sticky top-0 z-50">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="h-9 w-9 sm:h-11 sm:w-11 rounded-xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center shadow-lg shadow-primary/25 animate-glow-pulse">
              <Calculator className="h-4 w-4 sm:h-5 sm:w-5 text-primary-foreground" />
            </div>
            <div className="flex flex-col">
              <span className="font-bold text-base sm:text-lg tracking-tight">Splitzy</span>
              <span className="text-[10px] text-muted-foreground font-medium -mt-0.5 hidden sm:block">Split Bills Easily</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="label-accent animate-shimmer text-xs sm:text-sm">
              <Sparkles className="h-3 w-3" />
              <span className="hidden sm:inline">Free to Use</span>
              <span className="sm:hidden">Free</span>
            </div>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="flex-1 flex flex-col items-center justify-center px-4 sm:px-6 py-8 sm:py-16 gradient-bg relative overflow-hidden min-h-[70vh] sm:min-h-[85vh]">
        {/* Animated Background Grid */}
        <div className="absolute inset-0 grid-pattern opacity-50" />
        
        {/* Parallax Orbs */}
        <div 
          className="hero-orb hero-orb-primary w-[500px] h-[500px] -top-40 -left-40 animate-float-slow"
          style={{ transform: `translate(${mousePosition.x * 0.5}px, ${mousePosition.y * 0.5}px)` }}
        />
        <div 
          className="hero-orb hero-orb-accent w-[400px] h-[400px] -bottom-20 -right-20 animate-float-medium"
          style={{ transform: `translate(${mousePosition.x * -0.3}px, ${mousePosition.y * -0.3}px)` }}
        />
        <div 
          className="hero-orb hero-orb-primary w-[300px] h-[300px] top-1/3 right-1/4 animate-float-rotate opacity-30"
          style={{ transform: `translate(${mousePosition.x * 0.2}px, ${mousePosition.y * 0.2}px)` }}
        />

        {/* Morphing Decorative Shape - Hidden on mobile */}
        <div className="absolute top-20 left-20 w-40 h-40 bg-gradient-to-br from-primary/20 to-accent/20 animate-morph opacity-40 hidden sm:block" />
        <div className="absolute bottom-40 right-20 w-32 h-32 bg-gradient-to-br from-accent/20 to-primary/10 animate-morph opacity-30 hidden sm:block" style={{ animationDelay: '-4s' }} />
        
        {/* Floating Particles */}
        <div className="particle bottom-0 left-1/4" style={{ animationDelay: '0s' }} />
        <div className="particle bottom-0 left-1/3" style={{ animationDelay: '2s' }} />
        <div className="particle bottom-0 left-1/2" style={{ animationDelay: '4s' }} />
        <div className="particle bottom-0 left-2/3" style={{ animationDelay: '6s' }} />
        <div className="particle bottom-0 right-1/4" style={{ animationDelay: '8s' }} />

        {/* Floating Decorative Icons - Hidden on mobile */}
        <div 
          className="absolute top-1/4 left-[15%] text-primary/20 animate-float-slow hidden sm:block"
          style={{ transform: `translateY(${scrollY * 0.1}px)` }}
        >
          <Receipt className="h-8 w-8" />
        </div>
        <div 
          className="absolute top-1/3 right-[15%] text-accent/25 animate-float-medium hidden sm:block"
          style={{ transform: `translateY(${scrollY * -0.15}px)` }}
        >
          <Calculator className="h-10 w-10" />
        </div>
        <div 
          className="absolute bottom-1/3 left-[10%] text-accent/20 animate-float-rotate hidden sm:block"
          style={{ transform: `translateY(${scrollY * 0.08}px)` }}
        >
          <Star className="h-6 w-6" />
        </div>

        {/* Sparkle Effects */}
        <div className="absolute top-1/2 left-1/4 w-2 h-2 rounded-full bg-accent animate-sparkle" style={{ animationDelay: '0s' }} />
        <div className="absolute top-1/3 right-1/3 w-3 h-3 rounded-full bg-primary/50 animate-sparkle" style={{ animationDelay: '0.7s' }} />
        <div className="absolute bottom-1/4 right-1/4 w-2 h-2 rounded-full bg-accent/70 animate-sparkle" style={{ animationDelay: '1.4s' }} />
        <div className="absolute top-2/3 left-1/3 w-2 h-2 rounded-full bg-primary/40 animate-sparkle" style={{ animationDelay: '2.1s' }} />
        
        <div 
          className="max-w-2xl mx-auto text-center space-y-8 relative z-10"
          style={{ transform: `translateY(${scrollY * -0.2}px)` }}
        >
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-accent/15 border border-accent/30 text-sm font-semibold text-foreground shadow-sm animate-bounce-in">
            <div className="w-2 h-2 rounded-full bg-accent animate-pulse" />
            Don't be the unpaid friend
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
          <div className="grid md:grid-cols-2 gap-5 pt-4">
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

            {/* Trip Mode Card */}
            <Link
              href="/trip"
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
                <div className="absolute -top-1 -right-1 px-2.5 py-1 rounded-full bg-accent text-accent-foreground text-[10px] font-bold shadow-md shadow-accent/30 animate-bounce-in">
                  POPULAR
                </div>
                
                {/* Icon */}
                <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-accent/20 to-accent/5 flex items-center justify-center mb-5 group-hover:scale-110 group-hover:shadow-lg group-hover:shadow-accent/20 transition-all duration-500 group-hover:animate-glow-pulse-accent">
                  <Plane className="h-7 w-7 text-accent group-hover:scale-110 group-hover:-rotate-12 transition-all duration-300" />
                </div>
                
                {/* Content */}
                <h2 className="text-xl font-bold mb-2 group-hover:text-accent transition-colors duration-300">
                  Trip Mode
                </h2>
                <p className="text-sm text-muted-foreground mb-5 leading-relaxed">
                  Track multiple receipts with different payers during your trip.
                </p>
                
                {/* CTA */}
                <div className="flex items-center gap-2 text-sm font-semibold text-accent">
                  <span>Start Trip</span>
                  <div className="w-6 h-6 rounded-full bg-accent/10 flex items-center justify-center group-hover:bg-accent group-hover:text-accent-foreground transition-all duration-300">
                    <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-0.5 transition-transform" />
                  </div>
                </div>
              </div>
            </Link>
          </div>
        </div>

        {/* Scroll Indicator */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 animate-fade-in stagger-6">
          <span className="text-xs text-muted-foreground font-medium">Scroll</span>
          <div className="w-6 h-10 rounded-full border-2 border-muted-foreground/30 flex justify-center pt-2">
            <div className="w-1.5 h-3 bg-muted-foreground/50 rounded-full animate-float-fast" />
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
              className="relative text-center group"
              style={{ transform: `translateY(${Math.max(0, (scrollY - 400) * -0.03)}px)` }}
            >
              <div className="absolute -top-3 -left-3 w-8 h-8 rounded-full bg-primary text-primary-foreground text-sm font-bold flex items-center justify-center shadow-lg shadow-primary/30 animate-scale-in">
                1
              </div>
              <div className="p-6 rounded-2xl bg-background border-2 border-transparent group-hover:border-primary/20 transition-all duration-500 hover-lift">
                <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center mx-auto mb-4 group-hover:scale-110 group-hover:rotate-6 transition-all duration-500 group-hover:animate-glow-pulse">
                  <Users className="h-7 w-7 text-primary" />
                </div>
                <h3 className="font-bold text-lg mb-2">Add Participants</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Enter the names of everyone who's splitting the bill
                </p>
              </div>
            </div>
            
            {/* Step 2 */}
            <div 
              className="relative text-center group"
              style={{ transform: `translateY(${Math.max(0, (scrollY - 450) * -0.03)}px)` }}
            >
              <div className="absolute -top-3 -left-3 w-8 h-8 rounded-full bg-accent text-accent-foreground text-sm font-bold flex items-center justify-center shadow-lg shadow-accent/30 animate-scale-in stagger-2">
                2
              </div>
              <div className="p-6 rounded-2xl bg-background border-2 border-transparent group-hover:border-accent/20 transition-all duration-500 hover-lift">
                <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-accent/20 to-accent/5 flex items-center justify-center mx-auto mb-4 group-hover:scale-110 group-hover:-rotate-6 transition-all duration-500 group-hover:animate-glow-pulse-accent">
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
              className="relative text-center group"
              style={{ transform: `translateY(${Math.max(0, (scrollY - 500) * -0.03)}px)` }}
            >
              <div className="absolute -top-3 -left-3 w-8 h-8 rounded-full bg-emerald-500 text-white text-sm font-bold flex items-center justify-center shadow-lg shadow-emerald-500/30 animate-scale-in stagger-3">
                3
              </div>
              <div className="p-6 rounded-2xl bg-background border-2 border-transparent group-hover:border-emerald-500/20 transition-all duration-500 hover-lift">
                <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-emerald-500/5 flex items-center justify-center mx-auto mb-4 group-hover:scale-110 group-hover:rotate-6 transition-all duration-500">
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

      {/* Stats Section */}
      <section className="px-6 py-12 gradient-bg-accent border-t relative overflow-hidden">
        {/* Animated background elements */}
        <div className="absolute top-1/2 left-0 w-full h-px bg-gradient-to-r from-transparent via-accent/20 to-transparent animate-wave" />
        
        <div className="max-w-4xl mx-auto relative">
          <div className="grid grid-cols-3 gap-8 text-center">
            <div className="group">
              <div className="text-3xl font-extrabold text-primary mb-1 group-hover:scale-110 transition-transform duration-300">100%</div>
              <div className="text-sm text-muted-foreground font-medium">Free to Use</div>
            </div>
            <div className="group">
              <div className="text-3xl font-extrabold text-accent mb-1 group-hover:scale-110 transition-transform duration-300">
                <Zap className="h-8 w-8 mx-auto animate-float-fast" />
              </div>
              <div className="text-sm text-muted-foreground font-medium">AI Powered</div>
            </div>
            <div className="group">
              <div className="text-3xl font-extrabold text-primary mb-1 group-hover:scale-110 transition-transform duration-300">∞</div>
              <div className="text-sm text-muted-foreground font-medium">Unlimited Splits</div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="px-4 sm:px-6 py-4 sm:py-6 border-t bg-card">
        <div className="max-w-5xl mx-auto flex flex-col items-center gap-4">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="h-7 w-7 sm:h-8 sm:w-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <Calculator className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-primary" />
            </div>
            <div className="flex flex-col">
              <span className="font-semibold text-xs sm:text-sm">Splitzy by Madaffadl</span>
              <span className="text-[10px] sm:text-xs text-muted-foreground hidden xs:block">Never miss a split <span className="text-sm sm:text-base">•</span> because someone always forgets.</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <a href="mailto:m.daffafadhil26@gmail.com" target="_blank" rel="noopener noreferrer" className="h-8 w-8 rounded-lg bg-muted/50 flex items-center justify-center text-muted-foreground hover:text-primary hover:bg-primary/10 transition-all duration-200" aria-label="Email">
              <Mail className="h-4 w-4" />
            </a>
            <a href="https://www.instagram.com/mdaffa_fdl?igsh=ajJ3Y3Y0Nzd3OXZn&utm_source=qr" target="_blank" rel="noopener noreferrer" className="h-8 w-8 rounded-lg bg-muted/50 flex items-center justify-center text-muted-foreground hover:text-pink-500 hover:bg-pink-500/10 transition-all duration-200" aria-label="Instagram">
              <Instagram className="h-4 w-4" />
            </a>
            <a href="https://www.linkedin.com/in/madaffadl" target="_blank" rel="noopener noreferrer" className="h-8 w-8 rounded-lg bg-muted/50 flex items-center justify-center text-muted-foreground hover:text-blue-600 hover:bg-blue-600/10 transition-all duration-200" aria-label="LinkedIn">
              <Linkedin className="h-4 w-4" />
            </a>
            <a href="https://wa.me/6285365360955" target="_blank" rel="noopener noreferrer" className="h-8 w-8 rounded-lg bg-muted/50 flex items-center justify-center text-muted-foreground hover:text-green-500 hover:bg-green-500/10 transition-all duration-200" aria-label="WhatsApp">
              <Phone className="h-4 w-4" />
            </a>
          </div>
        </div>
      </footer>
    </main>
  );
}
