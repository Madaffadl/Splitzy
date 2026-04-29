import { Calculator, Mail, Instagram, Linkedin, Phone } from "lucide-react";

// Shared footer used across the single, trip, and history pages. Keep all
// social links and styling in one place — the previous copy-paste in three
// pages drifted independently and was a maintenance hazard.
export function AppFooter() {
  return (
    <footer className="px-6 py-4 border-t bg-card/50 backdrop-blur-sm">
      <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="h-6 w-6 rounded-md bg-primary/10 flex items-center justify-center">
            <Calculator className="h-3 w-3 text-primary" />
          </div>
          <span className="text-xs font-medium text-muted-foreground">
            Splitzy by Madaffadl
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <a
            href="mailto:m.daffafadhil26@gmail.com"
            target="_blank"
            rel="noopener noreferrer"
            className="h-6 w-6 rounded-md bg-muted/30 flex items-center justify-center text-muted-foreground hover:text-primary hover:bg-primary/10 transition-all duration-200"
            aria-label="Email"
          >
            <Mail className="h-3 w-3" />
          </a>
          <a
            href="https://www.instagram.com/mdaffa_fdl?igsh=ajJ3Y3Y0Nzd3OXZn&utm_source=qr"
            target="_blank"
            rel="noopener noreferrer"
            className="h-6 w-6 rounded-md bg-muted/30 flex items-center justify-center text-muted-foreground hover:text-pink-500 hover:bg-pink-500/10 transition-all duration-200"
            aria-label="Instagram"
          >
            <Instagram className="h-3 w-3" />
          </a>
          <a
            href="https://www.linkedin.com/in/madaffadl"
            target="_blank"
            rel="noopener noreferrer"
            className="h-6 w-6 rounded-md bg-muted/30 flex items-center justify-center text-muted-foreground hover:text-blue-600 hover:bg-blue-600/10 transition-all duration-200"
            aria-label="LinkedIn"
          >
            <Linkedin className="h-3 w-3" />
          </a>
          <a
            href="https://wa.me/6285365360955"
            target="_blank"
            rel="noopener noreferrer"
            className="h-6 w-6 rounded-md bg-muted/30 flex items-center justify-center text-muted-foreground hover:text-green-500 hover:bg-green-500/10 transition-all duration-200"
            aria-label="WhatsApp"
          >
            <Phone className="h-3 w-3" />
          </a>
        </div>
      </div>
    </footer>
  );
}
