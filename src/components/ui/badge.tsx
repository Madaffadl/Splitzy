import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-primary text-primary-foreground shadow-sm hover:bg-primary/80",
        secondary:
          "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80",
        destructive:
          "border-transparent bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/80",
        outline: "text-foreground border-border",
        accent:
          "border-transparent bg-accent text-accent-foreground shadow-sm shadow-accent/20 hover:bg-accent/80",
        "accent-outline":
          "border-accent/30 bg-accent/10 text-accent-foreground",
        // emerald-700, not emerald-500: white on emerald-500 measures 2.5:1,
        // well under the 4.5:1 text minimum. This variant has no call sites
        // yet, so the failure was latent — waiting for whoever reached for it
        // first. emerald-700 measures ~5.5:1.
        success:
          "border-transparent bg-emerald-700 text-white shadow-sm hover:bg-emerald-800",
        "success-outline":
          "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  )
}

export { Badge, badgeVariants }
