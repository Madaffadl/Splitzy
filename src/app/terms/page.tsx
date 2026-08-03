import type { Metadata } from "next";
import { LegalPageShell } from "@/components/LegalPageShell";
import { BRAND } from "@/lib/brand";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "The terms that govern your use of Splitzy.",
};

const LAST_UPDATED = "3 August 2026";

export default function TermsPage() {
  return (
    <LegalPageShell title="Terms of Service" lastUpdated={LAST_UPDATED}>
      <p>
        These Terms of Service (&ldquo;Terms&rdquo;) govern your use of{" "}
        {BRAND.name}. By accessing or using the service, you agree to be bound
        by these Terms. If you do not agree, please do not use the service.
      </p>

      <section>
        <h2>1. The Service</h2>
        <p>
          {BRAND.name} helps you split dining and travel expenses among friends
          and calculate who owes whom with minimal transactions. Some features
          require signing in with Google to save and sync your data.
        </p>
      </section>

      <section>
        <h2>2. Your Responsibilities</h2>
        <ul>
          <li>
            Provide accurate information and keep your account credentials
            secure.
          </li>
          <li>
            Use the service only for lawful purposes and not to abuse, disrupt,
            or reverse-engineer it.
          </li>
          <li>
            Ensure you have the right to upload any receipt or content you
            submit.
          </li>
        </ul>
      </section>

      <section>
        <h2>3. Calculations Are Provided &ldquo;As Is&rdquo;</h2>
        <p>
          {BRAND.name} computes suggested splits and settlements to help you,
          but you are responsible for verifying amounts before transferring
          money. We are not a party to any payment between you and other people,
          and we do not guarantee the accuracy of any calculation.
        </p>
      </section>

      <section>
        <h2>4. Your Content</h2>
        <p>
          You retain ownership of the content you create. You grant us a limited
          licence to store and process it solely to operate the service (for
          example, to scan a receipt image or sync your history across devices),
          as described in our{" "}
          <a href="/privacy">Privacy Policy</a>.
        </p>
      </section>

      <section>
        <h2>5. Availability</h2>
        <p>
          We aim to keep the service available but may modify, suspend, or
          discontinue features at any time. The service may occasionally be
          unavailable for maintenance.
        </p>
      </section>

      <section>
        <h2>6. Disclaimer &amp; Limitation of Liability</h2>
        <p>
          The service is provided &ldquo;as is&rdquo; without warranties of any
          kind. To the maximum extent permitted by law, {BRAND.name} shall not
          be liable for any indirect, incidental, or consequential damages, or
          for any loss arising from settlements or payments made based on the
          service&rsquo;s calculations.
        </p>
      </section>

      <section>
        <h2>7. Termination</h2>
        <p>
          You may stop using the service at any time. We may suspend or
          terminate access if these Terms are violated.
        </p>
      </section>

      <section>
        <h2>8. Changes to These Terms</h2>
        <p>
          We may update these Terms from time to time. Continued use after
          changes take effect constitutes acceptance of the revised Terms.
        </p>
      </section>

      <section>
        <h2>9. Contact</h2>
        <p>
          Questions about these Terms? Email{" "}
          <a href={`mailto:${BRAND.supportEmail}`}>{BRAND.supportEmail}</a>.
        </p>
      </section>
    </LegalPageShell>
  );
}
