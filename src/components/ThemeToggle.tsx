"use client"

import * as React from "react"
import { Moon, Sun } from "@/components/ui/icons"
import { useTheme } from "next-themes"

export function ThemeToggle() {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = React.useState(false)

  // Avoid hydration mismatch
  React.useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return (
      <button
        aria-hidden="true"
        tabIndex={-1}
        className="w-11 h-11 rounded-lg bg-muted text-muted-foreground flex items-center justify-center opacity-50"
      >
        <Sun className="h-4 w-4" />
      </button>
    )
  }

  return (
    <button
      onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
      className="touch-manipulation w-11 h-11 rounded-lg bg-muted text-muted-foreground hover:bg-primary/10 hover:text-foreground flex items-center justify-center transition-all relative overflow-hidden"
      aria-label="Toggle theme"
    >
      <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
      <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
    </button>
  )
}
