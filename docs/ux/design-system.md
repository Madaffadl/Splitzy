# Splitzy — Design System Audit

> The design system **as implemented**, not as intended. Token counts and contrast ratios below were
> measured, not estimated.
>
> Evidence labels: **[IMPLEMENTED]** · **[INFERRED]** · **[VISUAL-VERIFIED]** · **[UNKNOWN]**

---

## 1. Overall assessment **[INFERRED]**

This is a **more disciplined design system than the project's size would predict**. Three properties
stand out:

1. **Tokens carry their reasoning.** `globals.css` records measured contrast ratios beside the values
   — *"emerald-600 3.5:1 → emerald-700 5.5:1"* — and explains why the light value is the `-700` step
   rather than the `-600` one the old classes used.
2. **Rules are enforced, not merely stated.** A documented z-index scale, a shared touch-target
   height baked into the CVA `size` variants, and a unit test that reads real PNG dimensions.
3. **Comments record the failure that motivated the code.** `sticky-action-bar.tsx` explains why
   `sticky` and not `fixed`, why the safe-area inset belongs in padding, and why the breakpoint is
   `md:` and not `sm:`.

The main gaps are an unused dependency, a ~92 %-complete token migration, and one token pair that
was never given the contrast treatment the others received.

---

## 2. Component library **[IMPLEMENTED]**

**Hand-rolled shadcn/ui-style layer** — Radix primitives + CVA + Tailwind. Not shadcn CLI output;
there is no `components.json`.

| Layer | Detail |
|---|---|
| Primitives | `@radix-ui/react-{checkbox, dialog, label, select, slot}` |
| Variants | `class-variance-authority ^0.7.1` |
| Class merging | `clsx` + `tailwind-merge` via `cn()` in [utils.ts](../../src/lib/utils.ts) |
| Polymorphism | Radix `Slot` — `Button` supports `asChild` |

**16 primitives** in `components/ui/`: `button`, `badge`, `card`, `checkbox`, `dialog`,
`empty-state`, `icons`, `input`, `label`, `select`, `skeleton`, `spinner`, `sticky-action-bar`,
`textarea`, `toast`, `Logo`.

**[IMPLEMENTED]** Two are notable as *design-system* primitives rather than wrappers:
`sticky-action-bar` (which unified three divergent implementations) and `spinner` (which exports
both `Spinner` and a `LoadingState` page-level variant).

---

## 3. Icons — one library, shipped as two **[IMPLEMENTED]**

This is the clearest inconsistency in the system, and it is the opposite of what the Phase C brief
anticipates.

| Package | In `package.json` | Actually used |
|---|---|---|
| `@phosphor-icons/react ^2.1.10` | ✅ | ✅ **exclusively** |
| `lucide-react ^1.24.0` | ✅ | ❌ **zero imports anywhere in `src/`** |

[icons.tsx](../../src/components/ui/icons.tsx) is a **shim**: it imports Phosphor icons and
re-exports them under **lucide's API names**, so the rest of the app writes
`import { ArrowLeft } from "@/components/ui/icons"` and receives Phosphor.

```ts
function w(PhIcon: Icon, defaultWeight: IconProps["weight"] = "duotone"): Icon {
  const Wrapped = ({ weight = defaultWeight, ...props }: IconProps) =>
    createElement(PhIcon, { weight, ...props });
  return Wrapped as Icon;
}
export const ArrowLeft = w(_ArrowLeft, "regular");
export const CheckCircle2 = w(_CheckCircle2, "fill");
export const LayoutDashboard = w(_LayoutDashboard);          // duotone default
```

**75 icons** are exported, each with a deliberate weight — `regular` for navigation and actions,
`bold` for chevrons and check marks, `fill` for status, `duotone` for feature and brand marks. That
weight discipline is what gives the icon set its consistency, and it is centralised in one file.

**Findings**

| # | Finding | Label |
|---|---|---|
| 1 | **`lucide-react` is an unused dependency.** Nothing imports it | **[IMPLEMENTED]** |
| 2 | The exported type alias is `LucideIcon`, but resolves to Phosphor's `Icon`. Every consumer writes `LucideIcon` for a Phosphor type | **[IMPLEMENTED]** naming debt |
| 3 | `SearchX` and `Search` both map to Phosphor `Search` — the 404 page's "no results" icon is a plain magnifier | **[IMPLEMENTED]** minor |
| 4 | Enforcement is by convention only — nothing stops a new file importing `lucide-react` directly | **[INFERRED]** |

**Recommendation** Remove `lucide-react` from `package.json`; rename the type alias; optionally add
an ESLint `no-restricted-imports` rule for `lucide-react` and `@phosphor-icons/react` outside the
shim.

---

## 4. Colour tokens **[IMPLEMENTED]**

HSL CSS variables in `globals.css`, surfaced through `tailwind.config.ts`. `darkMode: ["class"]`.

### Palette — olive green + gold

| Token | Light | Dark | Purpose |
|---|---|---|---|
| `--background` | `50 33% 98%` cream | `75 5% 9%` warm charcoal | page |
| `--foreground` | `75 30% 15%` | `60 8% 96%` | body text |
| `--card` / `--popover` | white | `75 5% 11%` | raised surfaces |
| `--primary` | `78 45% 25%` olive | `78 50% 40%` | brand, primary actions |
| `--accent` | `45 90% 45%` gold | `45 85% 50%` | highlights, **fills only** |
| `--accent-strong` | `45 85% 30%` | `45 90% 60%` | **gold as text** |
| `--success` | `163 94% 24%` | `158 64% 52%` | positive |
| `--warning` | `26 90% 37%` | `43 96% 56%` | caution |
| `--info` | `221 83% 45%` | `213 94% 68%` | informational |
| `--destructive` | `0 84.2% 60.2%` | `0 62.8% 30.6%` | danger |
| `--muted` | `45 15% 93%` | `75 5% 17%` | secondary text/surfaces |
| `--border` / `--input` / `--ring` | `45 20% 88%` | `75 6% 22%` | edges, focus |
| `--radius` | `0.75rem` | — | drives `lg`/`md`/`sm` |

**Two decisions worth naming [IMPLEMENTED]**

- **`--accent-strong` exists because bright gold fails as text.** The comment states *"bright
  `--accent` fails WCAG as text (~2.2:1); this passes AA (~4.7:1)"*. The rendering pass measured a
  missed call site at **2.15:1** — the comment's estimate was accurate to within 0.05.
- **Dark neutrals keep the olive hue at low saturation** (`75 5–6%`) so surfaces read as warm
  charcoal rather than green, leaving brand olive and gold to stand out.

### The gap **[VISUAL-VERIFIED]**

`success`, `warning`, `info` and `accent-strong` all received documented contrast work.
**`primary` did not.** Dark-mode `--primary` (`78 50% 40%` ≈ `rgb(122,153,51)`) with white foreground
measures **3.27:1** — below the 4.5:1 needed for normal text, and it is the colour of every primary
button and badge. See UX-011.

### Adoption **[IMPLEMENTED]**

| | Count |
|---|---|
| Semantic token classes | **1 158** |
| Raw Tailwind palette classes | **104** |
| …of which carry a `dark:` pair | 39 |
| …with **no** dark counterpart | **~65** |

≈92 % migrated. The stragglers cluster on `bg-emerald-500` (15), `border-emerald-500` (6),
`text-green-600` (4). No visibly broken dark region was found, so this is latent (UX-021).

---

## 5. Typography **[IMPLEMENTED]**

**Inter**, self-hosted via `next/font/google` with `subsets: ["latin"]` — no runtime request to
Google. Applied on `<body>` and again as a CSS fallback in `globals.css`.

A semantic marketing scale sits alongside the default Tailwind sizes:

| Token | Size | Line height | Tracking | Weight |
|---|---|---|---|---|
| `display-1` | `clamp(2.5rem, 5vw, 3.75rem)` | 1.05 | −0.02em | 800 |
| `display-2` | `clamp(2rem, 4vw, 3rem)` | 1.1 | −0.02em | 800 |
| `heading` | `clamp(1.5rem, 2.5vw, 2rem)` | 1.2 | −0.01em | 700 |
| `eyebrow` | `0.8125rem` | 1 | 0.08em | 600 |
| `lead` | `1.125rem` | 1.6 | — | — |

**[INFERRED]** `clamp()` means type scales fluidly rather than stepping at breakpoints — consistent
with the zero-overflow result measured at both viewports.

**[IMPLEMENTED]** Additive by design: the tokens are consumed by newer surfaces (pricing, new
landing) while existing `text-*` utilities are untouched. So two type systems coexist — intentional,
but a consumer must know which to reach for.

---

## 6. Spacing, radius, elevation **[IMPLEMENTED]**

- **Spacing** — default Tailwind scale; no custom tokens.
- **Radius** — one variable, `--radius: 0.75rem`, deriving `lg`/`md`/`sm`. Buttons and cards use
  `rounded-xl`/`rounded-2xl`; pills use `rounded-full`.
- **Elevation** — two custom utilities, `.shadow-premium` and `.shadow-premium-lg`, each a
  three-layer shadow built from `hsl(var(--foreground) / 0.04–0.06)` so shadows tint with the theme
  instead of being flat black.

### The z-index scale — documented and enforced by comment

```
 10  sticky page chrome (headers, bottom action bars)
 20  in-page overlays anchored to content (dropdowns, suggestion lists)
 40  scrims
 50  dialogs and drawers (Radix portals)
100  toasts and the first-run modal — must clear a dialog
200  skip link
```

*"Anything outside this list is a mistake; the header shipped with four different values before this
comment existed."* **[IMPLEMENTED]** — a rare example of a stacking scale that is actually written
down.

---

## 7. Component variants (CVA) **[IMPLEMENTED]**

### `Button` — 8 variants × 5 sizes

`default` · `destructive` · `outline` · `secondary` · `ghost` · `link` · `accent` · `accent-outline`

**The size scale is the interesting part.** Every size is **44 px on touch**, compacting only from
`sm:` up:

```
default  h-11 px-5 rounded-xl
sm       h-11 sm:h-9 rounded-lg px-4 text-xs
lg       h-12 rounded-xl px-8
icon     h-11 w-11 rounded-xl
pill     h-11 sm:h-10 px-6 rounded-full
```

The comment explains why: `sm` was a flat `h-9` (36 px), under the touch minimum, *"and it is the
size 47 call sites reach for, so each one bolted on its own patch… Four dialects for one rule."*

**[VISUAL-VERIFIED]** It worked. Every primary action measured ≥ 44 px; the only sub-44 px targets in
the whole app are footer text links (UX-004).

**Press feedback** `active:scale-[0.97]` on the base — *"the only press feedback this app has. Every
state below it was hover-only, and a touch screen has no hover."*

### `Badge` — 8 variants

Including `success` at `bg-emerald-700`, with a comment recording that emerald-500 measured 2.5:1 and
that the variant *"has no call sites yet, so the failure was latent — waiting for whoever reached for
it first."* **[INFERRED]** Fixing a latent contrast bug in an unused variant is unusually thorough.

**[IMPLEMENTED]** Note the inconsistency: `Badge.success` uses a raw `emerald-700`, while
`success-outline` uses the `--success` token. One variant set, two sourcing strategies.

---

## 8. Dark mode **[VISUAL-VERIFIED]**

`next-themes`, `attribute="class"`, `defaultTheme="light"`, `disableTransitionOnChange`,
`suppressHydrationWarning` on `<html>`.

| Check | Result |
|---|---|
| Toggle applies `class="dark"` | ✅ verified |
| Unthemed regions found | none |
| Overflow in dark mode | none |
| Contrast regressions | **3 instances of one token pair** (UX-011) |

`ThemeToggle` has an accessible name ("Toggle theme") and appears in most headers.
**[IMPLEMENTED]** It is absent from `/pricing` and `/dashboard`'s signed-out state — minor
inconsistency.

---

## 9. Motion **[IMPLEMENTED]**

Tokens: `ease-smooth`, `ease-bounce-soft`, `duration-250`, `duration-400`.

Twelve keyframe animations in `globals.css` — `fadeIn`, `fadeInUp`, `scaleIn`, `bounceIn`, `float`,
`floatSlow`, `floatMedium`, `pulse-glow`, plus stagger delay utilities.

**Accessibility** A global `prefers-reduced-motion` block reduces every animation and transition to
`0.01ms` and disables smooth scrolling — applied with `!important` across `*`, `*::before`,
`*::after`. **[IMPLEMENTED]** WCAG 2.3.3 satisfied at the system level rather than per component.

**[IMPLEMENTED]** `globals.css` contains several orphaned comment headers — *"Shimmer Effect"*,
*"Rotating Animation"*, *"Wave Animation for Decorative Lines"*, *"Morphing Shape"*, *"Particle
Float"*, *"Text Reveal Animation"*, *"Gradient Border Animation"* — with no rules beneath them.
Removed effects whose headings remain. Cosmetic, but it makes the file read as larger than it is.

---

## 10. Custom utilities **[IMPLEMENTED]**

| Utility | Purpose |
|---|---|
| `.glass` / `.glass-card` | Backdrop-blurred sticky chrome |
| `.gradient-bg` / `.gradient-text` | Brand gradient background and clipped text |
| `.shadow-premium` / `-lg` | Theme-tinted elevation |
| `.hero-orb` + `-primary` / `-accent` | Blurred decorative orbs |
| `.grid-pattern` | Faint 40 px grid background |
| `.stagger-1` / `-2` | Animation delays |

All are built from tokens (`hsl(var(--…))`), so they theme automatically.

---

## 11. Focus and keyboard **[VISUAL-VERIFIED]**

A global `:focus-visible` rule — `2px solid hsl(var(--ring))`, `2px` offset, `3px` radius — with the
comment noting that mouse clicks do not trigger `:focus-visible`, so this shows only for keyboard and
AT users. Buttons additionally carry `focus-visible:ring-2 ring-offset-2`.

Measured: every one of 16 tab stops on `/single` had a visible 2–3 px outline. No traps.

---

## 12. Inconsistencies — consolidated

| # | Inconsistency | Severity |
|---|---|---|
| 1 | `lucide-react` shipped as a dependency, never imported | Medium — dead weight |
| 2 | Type alias `LucideIcon` resolves to a Phosphor type | Low — naming |
| 3 | `primary` never received the contrast treatment `success`/`warning`/`info`/`accent-strong` did | **High** (UX-011) |
| 4 | 104 raw palette classes remain; ~65 lack a `dark:` pair | Medium (UX-021) |
| 5 | `Badge.success` uses raw `emerald-700`; `success-outline` uses the token | Low |
| 6 | Two type systems coexist — the semantic scale and default `text-*` | Low, intentional |
| 7 | `EmptyState` primitive exists with zero consumers; every empty state is bespoke | Low (UX-023) |
| 8 | `Skeleton` has one consumer; three other loading treatments are in use | Medium (UX-022) |
| 9 | `ThemeToggle` missing from `/pricing` and the signed-out dashboard | Low |
| 10 | Orphaned animation comment headers with no rules | Cosmetic |

---

## 13. What is genuinely strong

1. **Touch targets solved at the token layer**, not per call site — and it measurably held.
2. **Contrast reasoning recorded next to the values**, with the measured ratios written down.
3. **A documented z-index scale**, prompted by a real incident.
4. **`prefers-reduced-motion` handled globally.**
5. **Theme-tinted shadows** rather than flat black.
6. **A latent contrast bug fixed in an unused variant** before anyone could hit it.
7. **The icon shim** gives 75 icons one consistent weight vocabulary from a single file.

**[INFERRED]** The system's weakness is not design quality but **completion**: a migration at 92 %, a
primitive nobody adopted, a dependency nobody removed, and one token pair that missed the audit the
others passed.
