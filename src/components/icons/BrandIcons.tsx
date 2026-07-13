import type { SVGProps } from "react";

// Brand/logo icons (Instagram, LinkedIn) were removed from lucide-react in v1
// over trademark concerns. These inline replacements mirror lucide's old glyphs
// and rendering conventions (24×24 viewBox, currentColor stroke, round caps)
// so they sit visually identical alongside the remaining lucide icons.
// Defined once and shared between the landing page and AppFooter to avoid the
// copy-paste drift that footer duplication caused before.

type IconProps = SVGProps<SVGSVGElement>;

const baseProps: IconProps = {
  xmlns: "http://www.w3.org/2000/svg",
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round",
  strokeLinejoin: "round",
};

export function Instagram(props: IconProps) {
  return (
    <svg {...baseProps} {...props}>
      <rect width="20" height="20" x="2" y="2" rx="5" ry="5" />
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
      <line x1="17.5" x2="17.51" y1="6.5" y2="6.5" />
    </svg>
  );
}

export function Linkedin(props: IconProps) {
  return (
    <svg {...baseProps} {...props}>
      <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z" />
      <rect width="4" height="12" x="2" y="9" />
      <circle cx="4" cy="4" r="2" />
    </svg>
  );
}
