import { cn } from "@/lib/utils";

/**
 * The bar that holds a screen's forward actions, pinned in the thumb zone on a
 * phone and returned to the flow on a mouse-driven screen.
 *
 * There were three of these. /single and /multiple agreed: edge-to-edge, a top
 * border, safe-area padding, static from md: up. The receipt editor did
 * something else entirely — a floating rounded card with its own heavier blur,
 * horizontal margins, the safe area applied as an offset rather than padding,
 * and no static breakpoint, so it kept floating on desktop. Two visual
 * languages for two actions taken seconds apart in the same flow.
 *
 * (Careful editing this comment: Tailwind scans the raw file text, so writing an
 * arbitrary-value class in prose here makes it a real candidate. An invalid one
 * fails the build.)
 *
 * Notes on the details, because each one is load-bearing:
 *
 *   * `position: sticky`, not `fixed` — a fixed bar needs the page to reserve
 *     space for it and gets that wrong the moment content is short.
 *   * the safe-area inset belongs in the padding, not the offset. Padding keeps
 *     the bar's background flush to the bottom edge behind the home indicator;
 *     an offset leaves a strip of scrolling content showing beneath it.
 *   * `md:` and not `sm:` — 640px still includes a phone in landscape and a
 *     small tablet, both of which are touch.
 */
export function StickyActionBar({
    children,
    className,
}: {
    children: React.ReactNode;
    className?: string;
}) {
    return (
        <div
            className={cn(
                "sticky bottom-0 z-20 -mx-3 mt-6 space-y-2 border-t bg-background/95 px-3 pt-3 backdrop-blur",
                "pb-[max(0.75rem,env(safe-area-inset-bottom))]",
                "md:static md:mx-0 md:border-0 md:bg-transparent md:px-0 md:pb-0 md:backdrop-blur-none",
                className
            )}
        >
            {children}
        </div>
    );
}
