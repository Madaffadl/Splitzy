// Renders a JSON-LD graph into the document.
//
// `application/ld+json` is data, not executable script, so the CSP script-src
// directive does not apply to it and no nonce is needed. We still escape "<" so
// a stray "</script>" inside any string value can never break out of the tag —
// JSON-LD parsers accept the < escape, browsers do not treat it as markup.

export function JsonLd({ data }: { data: Record<string, unknown> }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(data).replace(/</g, "\\u003c"),
      }}
    />
  );
}
