import Image from "next/image";
import { cn } from "@/lib/utils";

type LogoSize = "sm" | "md" | "lg";

const sizes: Record<LogoSize, { px: number; className: string }> = {
  sm: { px: 24, className: "h-6 w-6" },
  md: { px: 36, className: "h-9 w-9 sm:h-11 sm:w-11" },
  lg: { px: 48, className: "h-12 w-12" },
};

interface LogoProps {
  size?: LogoSize;
  className?: string;
}

export function Logo({ size = "md", className }: LogoProps) {
  const { px, className: sizeClass } = sizes[size];
  return (
    <Image
      src="/logo.png"
      alt="Splitzy"
      width={px}
      height={px}
      className={cn("object-contain drop-shadow-sm", sizeClass, className)}
      priority
      unoptimized
    />
  );
}
