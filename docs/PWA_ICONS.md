# PWA icons

How the icons referenced by `src/app/manifest.ts` and `src/app/layout.tsx` are
produced, and the rules that must hold when they are regenerated.

## Source

`public/Splitzy-Color-Bgwhite.jpeg` — 2048×2048, square, background `#FDFDFB`.

Do **not** use `public/logo.png` for any icon. It is 1920×2194 (portrait) and
exists only for in-app rendering (`src/components/ui/Logo.tsx`).

## Recipe

Uses `sips`, which ships with macOS. No extra tooling required.

```sh
SRC=public/Splitzy-Color-Bgwhite.jpeg

# Favicon + Android launcher
sips -s format png -z 192 192 "$SRC" --out public/icon-192.png
sips -s format png -z 512 512 "$SRC" --out public/icon-512.png

# iOS home screen — 180×180 is the size Safari asks for
sips -s format png -z 180 180 "$SRC" --out public/apple-touch-icon.png

# Maskable: scale the mark to 410px, then pad to 512 with the source background
sips -s format png -z 410 410 "$SRC" --out /tmp/maskable-inner.png
sips -p 512 512 --padColor FDFDFB /tmp/maskable-inner.png \
  --out public/icon-maskable-512.png
```

`--padColor` must match the source background. Pure `FFFFFF` leaves a faint
seam where the padding meets the artwork.

## Rules

These are enforced by `src/app/manifest-icons.test.ts`. They exist because
breaking them makes Android installs fail **silently** — Chrome still shows the
install prompt, and Google's WebAPK build server then rejects the icon with no
error surfaced to the user or to us.

1. **Declared `sizes` must equal the file's real pixel dimensions.** This is the
   bug that shipped: `/logo.png` was declared `512x512` while being 1920×2194.
2. **Icons must be square.** Launchers assume it.
3. **`maskable` needs its own padded asset.** Android crops to a circle of 80%
   diameter, so artwork that fills the canvas loses its top and bottom. Never
   point `purpose: "maskable"` and `purpose: "any"` at the same file.
4. **Keep each file under 300 KB.** Google's WebAPK server re-downloads them;
   the old 2.26 MB icon was a timeout risk on Indonesian mobile data.
5. **PNG, not JPEG.** Permitted by spec, but PNG is what every implementation
   is actually tested against.

## Verifying a real install

The test suite cannot exercise Chrome's heuristics or Google's build server, so
after changing icons check a real Android device:

- `chrome://webapks` — lists installed WebAPKs and their update status.
- Remote debug via `chrome://inspect`, then DevTools → Application → Manifest,
  which reports installability errors directly.

In production, the `pwa_install_prompt_available` → `pwa_app_installed` ratio in
PostHog is the ongoing signal (see `src/components/PwaInstallTelemetry.tsx`). A
sustained 100% gap means the install path is broken again.
