import type { Metadata } from "next";
import { ContentPageShell } from "@/components/ContentPageShell";
import { BRAND } from "@/lib/brand";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "How Splitzy collects, uses, and protects your data.",
  // Self-referencing canonical. Required: without it this page inherits the
  // layout's canonical and declares itself a duplicate of the homepage.
  alternates: { canonical: "/privacy" },
};

const LAST_UPDATED = "3 August 2026";

export default function PrivacyPage() {
  return (
    <ContentPageShell title="Privacy Policy" lastUpdated={LAST_UPDATED}>
      <p>
        This Privacy Policy explains how {BRAND.name} (&ldquo;we&rdquo;,
        &ldquo;us&rdquo;) collects, uses, and safeguards your information when
        you use {BRAND.name} at{" "}
        <a href={BRAND.siteUrl}>{BRAND.siteUrl.replace("https://", "")}</a>. By
        using the service you agree to the practices described here.
      </p>

      <section>
        <h2>1. Information We Collect</h2>
        <ul>
          <li>
            <strong>Account information.</strong> When you sign in with Google
            we receive your name, email address, and profile photo. We do not
            receive or store your Google password.
          </li>
          <li>
            <strong>Content you create.</strong> Bills, receipts, trips,
            participants, items, and settlement data you enter or import.
          </li>
          <li>
            <strong>Receipt images.</strong> Photos you upload for scanning are
            processed to extract line items and totals.
          </li>
          <li>
            <strong>Technical data.</strong> Basic request metadata (such as IP
            address and browser type) used for security, rate limiting, and
            diagnostics.
          </li>
        </ul>
      </section>

      <section>
        <h2>2. How We Use Your Information</h2>
        <ul>
          <li>To provide the core bill-splitting and settlement features.</li>
          <li>To save your history so it syncs across your devices.</li>
          <li>
            To process uploaded receipts using AI (see &ldquo;Third-Party
            Services&rdquo; below).
          </li>
          <li>
            To protect the service against abuse, fraud, and technical faults.
          </li>
        </ul>
      </section>

      <section>
        <h2>3. Third-Party Services</h2>
        <p>We rely on trusted providers to operate the service:</p>
        <ul>
          <li>
            <strong>Google</strong> — authentication (sign-in).
          </li>
          <li>
            <strong>Supabase</strong> — authentication and database hosting for
            your account and content.
          </li>
          <li>
            <strong>Google Gemini AI</strong> — extracting items and totals from
            receipt images you upload. Images are sent for processing and are
            not used to train models by us.
          </li>
        </ul>
        <p>
          Each provider processes data under its own privacy terms. We share
          only what is necessary to deliver the feature you requested.
        </p>
      </section>

      <section>
        <h2>4. Data Retention</h2>
        <p>
          We keep your account and content for as long as your account is
          active. Deleted items are held briefly to support recovery
          (&ldquo;restore&rdquo;) before permanent removal. You may request
          deletion of your account and associated data at any time.
        </p>
      </section>

      <section>
        <h2>5. Your Rights</h2>
        <p>
          You can access, correct, export, or delete your data. To exercise any
          of these rights, contact us at{" "}
          <a href={`mailto:${BRAND.supportEmail}`}>{BRAND.supportEmail}</a>.
        </p>
      </section>

      <section>
        <h2>6. Security</h2>
        <p>
          We apply reasonable technical and organisational measures to protect
          your data, including encrypted transport (HTTPS) and access controls.
          No method of transmission or storage is completely secure, so we
          cannot guarantee absolute security.
        </p>
      </section>

      <section>
        <h2>7. Children</h2>
        <p>
          {BRAND.name} is not directed to children under 13, and we do not
          knowingly collect their personal data.
        </p>
      </section>

      <section>
        <h2>8. Changes to This Policy</h2>
        <p>
          We may update this policy from time to time. Material changes will be
          reflected by updating the &ldquo;Last updated&rdquo; date above.
        </p>
      </section>

      <section>
        <h2>9. Contact</h2>
        <p>
          Questions about this policy? Email{" "}
          <a href={`mailto:${BRAND.supportEmail}`}>{BRAND.supportEmail}</a>.
        </p>
      </section>
    </ContentPageShell>
  );
}
