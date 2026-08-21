// X/Twitter reads the same card as OpenGraph. Declared explicitly rather than
// relying on X's og:image fallback, so `twitter:image` is always present for the
// `summary_large_image` card declared in the root layout.
export { default, alt, size, contentType } from "./opengraph-image";
