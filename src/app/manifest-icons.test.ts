// Guards the two defects that made Android installs fail silently.
//
// Neither was catchable by type-checking, linting or a build: the manifest was
// valid JSON pointing at a file that existed, and the service worker's precache
// list was a valid array of strings. Both bugs lived in the gap between what
// the code *declared* and what was actually on disk, which is exactly what
// these assertions close.

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import manifest from "./manifest";

const PUBLIC_DIR = path.resolve(__dirname, "../../public");

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/**
 * Reads real pixel dimensions from a PNG's IHDR chunk, which sits at a fixed
 * offset immediately after the 8-byte signature and 8-byte chunk header.
 */
function readPngSize(file: Buffer): { width: number; height: number } {
  return { width: file.readUInt32BE(16), height: file.readUInt32BE(20) };
}

function readPublicFile(src: string): Buffer {
  return readFileSync(path.join(PUBLIC_DIR, src.replace(/^\//, "")));
}

describe("PWA manifest icons", () => {
  const icons = manifest().icons ?? [];

  it("declares icons at all", () => {
    expect(icons.length).toBeGreaterThan(0);
  });

  it.each(icons.map((icon) => [icon.src, icon] as const))(
    "%s exists and its real dimensions match the declared sizes",
    (_src, icon) => {
      // The original bug: /logo.png was declared 512x512 and was really
      // 1920x2194. Chrome still offered the install, then Google's WebAPK
      // build server rejected the icon and the install died with no error.
      const file = readPublicFile(icon.src);

      expect(file.subarray(0, 8)).toEqual(PNG_SIGNATURE);

      const { width, height } = readPngSize(file);
      expect(`${width}x${height}`).toBe(icon.sizes);
      expect(width).toBe(height); // launcher icons must be square
    }
  );

  it.each(icons.map((icon) => [icon.src, icon] as const))(
    "%s is small enough to fetch on a mobile connection",
    (_src, icon) => {
      // Google's WebAPK server re-downloads these itself. The old 2.26 MB
      // icon was a timeout risk on Indonesian mobile data on top of being
      // the wrong shape.
      expect(readPublicFile(icon.src).byteLength).toBeLessThan(300_000);
    }
  );

  it("has a dedicated maskable icon, not one shared with purpose 'any'", () => {
    // Android masks to a circle of 80% diameter. A maskable icon therefore
    // needs its own padded asset; reusing the edge-to-edge 'any' artwork
    // crops the top and bottom off the mark.
    const maskable = icons.filter((icon) => icon.purpose === "maskable");
    const any = icons.filter((icon) => icon.purpose === "any");

    expect(maskable.length).toBeGreaterThan(0);
    expect(any.length).toBeGreaterThan(0);

    for (const icon of maskable) {
      expect(any.map((a) => a.src)).not.toContain(icon.src);
    }
  });

  it("ships a 192px icon for the Android launcher", () => {
    expect(icons.some((icon) => icon.sizes === "192x192")).toBe(true);
  });
});

describe("service worker precache list", () => {
  const source = readFileSync(path.join(PUBLIC_DIR, "sw.js"), "utf8");

  it("only precaches static files that exist", () => {
    // The original bug: APP_SHELL listed "/icon.svg", which had never
    // existed. cache.addAll() is atomic, so that one 404 emptied the entire
    // precache and the offline fallback silently had nothing to serve.
    const match = source.match(/const APP_SHELL = \[([^\]]*)\]/);
    expect(match).not.toBeNull();

    const entries = [...(match?.[1].matchAll(/"([^"]+)"/g) ?? [])].map(
      (m) => m[1]
    );
    expect(entries.length).toBeGreaterThan(0);

    // "/" and "/manifest.webmanifest" are server-rendered routes rather than
    // files in public/, so only real static assets are checked here.
    const staticAssets = entries.filter((entry) =>
      /\.(png|jpe?g|svg|ico|css|js|woff2?)$/.test(entry)
    );

    for (const asset of staticAssets) {
      expect(() => readPublicFile(asset), `${asset} is missing`).not.toThrow();
    }
  });
});
