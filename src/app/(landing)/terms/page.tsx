import type { Metadata } from "next";

import { Footer } from "../_components/footer";
import { Header } from "../_components/header";

export const metadata: Metadata = {
  title: "Terms of Service - iShortn",
  description:
    "Read the terms and conditions for using iShortn URL shortener service.",
  openGraph: {
    title: "Terms of Service - iShortn",
    description:
      "Read the terms and conditions for using iShortn URL shortener service.",
    type: "website",
  },
};

export default function TermsPage() {
  return (
    <main style={{ background: "var(--warm-bg)", color: "var(--warm-ink)" }}>
      <Header />

      <section className="warm-subhero">
        <div className="warm-container">
          <div className="warm-eyebrow" style={{ marginBottom: 24 }}>
            <span className="warm-eyebrow-dot" />
            Legal
          </div>
          <h1
            className="warm-display"
            style={{ margin: 0, fontSize: "clamp(44px, 11vw, 104px)" }}
          >
            Terms of <em style={{ fontStyle: "italic", color: "var(--warm-accent)" }}>service</em>.
          </h1>
          <p style={{ marginTop: 20, fontSize: 14, color: "var(--warm-mute)" }}>
            Last updated: March 2026
          </p>
        </div>
      </section>

      <section style={{ padding: "24px 0 120px" }}>
        <article
          className="warm-container warm-legal-prose"
          style={{ maxWidth: 760, fontFamily: "var(--font-warm-ui)" }}
        >
          <p>
            Welcome to iShortn. These Terms of Service (&quot;Terms&quot;) govern your
            access to and use of the iShortn URL shortening service available
            at ishortn.ink (&quot;Service&quot;), operated by iShortn (&quot;we&quot;, &quot;us&quot;, or
            &quot;our&quot;). By accessing or using the Service, you agree to be bound
            by these Terms. If you do not agree to these Terms, please do not
            use the Service.
          </p>

          <h2>1. Acceptance of Terms</h2>

          <p>
            By creating an account or using any part of the Service, you
            confirm that you are at least 13 years of age and that you accept
            and agree to be bound by these Terms and our{" "}
            <a href="/privacy">Privacy Policy</a>
            . If you are using the Service on behalf of an organization, you
            represent that you have the authority to bind that organization to
            these Terms.
          </p>

          <h2>2. Description of Service</h2>

          <p>
            iShortn provides a URL shortening service that allows users to
            create shortened links, generate QR codes, track click analytics,
            and manage links through a dashboard. We offer both free and paid
            plans with varying feature sets and usage limits.
          </p>

          <h2>3. Account Responsibilities</h2>

          <p>
            When you create an account with iShortn, you are responsible for:
          </p>
          <ul>
            <li>
              Maintaining the security and confidentiality of your account
              credentials.
            </li>
            <li>
              All activities that occur under your account, whether authorized
              by you or not.
            </li>
            <li>
              Providing accurate and up-to-date information in your account
              profile.
            </li>
            <li>
              Notifying us immediately at{" "}
              <a href="mailto:support@ishortn.ink">support@ishortn.ink</a>{" "}
              if you suspect any unauthorized use of your account.
            </li>
          </ul>

          <h2>4. Acceptable Use</h2>

          <p>
            You agree not to use the Service to create shortened links that
            point to, distribute, or promote:
          </p>
          <ul>
            <li>
              <strong>Spam:</strong> Unsolicited bulk messages, advertisements,
              or promotional content.
            </li>
            <li>
              <strong>Phishing:</strong> Content designed to deceive users into
              revealing personal information, credentials, or financial data.
            </li>
            <li>
              <strong>Malware:</strong> Software intended to damage, disrupt,
              or gain unauthorized access to computer systems, including
              viruses, ransomware, and trojans.
            </li>
            <li>
              <strong>Illegal content:</strong> Any material that violates
              applicable local, state, national, or international law,
              including content related to illegal drugs, weapons trafficking,
              or exploitation.
            </li>
            <li>
              <strong>Harassment:</strong> Content intended to harass,
              threaten, intimidate, or bully individuals or groups.
            </li>
            <li>
              <strong>Intellectual property infringement:</strong> Content that
              infringes on the copyrights, trademarks, or other intellectual
              property rights of others.
            </li>
          </ul>

          <p>
            We reserve the right to disable any shortened link and suspend or
            terminate any account that violates these acceptable use policies,
            with or without notice. We employ automated systems, including AI-based
            phishing detection, to identify and block malicious links.
          </p>

          <h2>5. Intellectual Property</h2>

          <p>
            The Service, including its design, features, code, and branding,
            is owned by iShortn and protected by applicable intellectual
            property laws. You retain ownership of the content you link to
            through our Service, but you grant us a limited license to process,
            store, and display your links as necessary to provide the Service.
          </p>
          <p>
            You may not copy, modify, distribute, or reverse-engineer any part
            of the Service without our prior written consent. The iShortn name,
            logo, and associated trademarks may not be used without permission.
          </p>

          <h2>6. Service Availability</h2>

          <p>
            We strive to maintain high availability of the Service, but we do
            not guarantee uninterrupted or error-free operation. The Service
            may be temporarily unavailable due to maintenance, updates, or
            circumstances beyond our control. We will make reasonable efforts
            to notify users of planned downtime in advance.
          </p>
          <p>
            We reserve the right to modify, suspend, or discontinue any part
            of the Service at any time. For paid plans, we will provide
            reasonable notice before discontinuing features included in your
            subscription.
          </p>

          <h2>7. Paid Plans and Billing</h2>

          <p>
            Certain features of the Service are available through paid
            subscription plans. By subscribing to a paid plan, you agree to
            pay the applicable fees as described at the time of purchase.
            Subscriptions automatically renew unless cancelled before the
            renewal date. Refunds are handled on a case-by-case basis. Please
            contact{" "}
            <a href="mailto:support@ishortn.ink">support@ishortn.ink</a>{" "}
            for billing inquiries.
          </p>

          <h2>8. Limitation of Liability</h2>

          <p>
            To the maximum extent permitted by applicable law, iShortn and its
            officers, employees, and affiliates shall not be liable for any
            indirect, incidental, special, consequential, or punitive damages,
            including but not limited to loss of profits, data, or business
            opportunities, arising from your use of or inability to use the
            Service.
          </p>
          <p>
            Our total liability for any claim arising from or related to the
            Service shall not exceed the amount you have paid us in the twelve
            (12) months preceding the claim, or $100, whichever is greater.
          </p>
          <p>
            The Service is provided &quot;as is&quot; and &quot;as available&quot; without
            warranties of any kind, whether express or implied, including but
            not limited to implied warranties of merchantability, fitness for a
            particular purpose, and non-infringement.
          </p>

          <h2>9. Indemnification</h2>

          <p>
            You agree to indemnify, defend, and hold harmless iShortn and its
            officers, employees, and affiliates from and against any claims,
            liabilities, damages, losses, and expenses (including reasonable
            legal fees) arising out of or in any way connected with your use of
            the Service, your violation of these Terms, or your violation of
            any rights of a third party.
          </p>

          <h2>10. Termination</h2>

          <p>
            You may terminate your account at any time by deleting it through
            the dashboard or by contacting us at{" "}
            <a href="mailto:support@ishortn.ink">support@ishortn.ink</a>.
          </p>
          <p>
            We may suspend or terminate your account and access to the Service
            at our discretion, without prior notice, if we believe you have
            violated these Terms or engaged in conduct that is harmful to other
            users, us, or third parties. Upon termination, your right to use
            the Service ceases immediately and your shortened links may be
            deactivated.
          </p>

          <h2>11. Changes to These Terms</h2>

          <p>
            We reserve the right to update or modify these Terms at any time.
            When we make material changes, we will update the &quot;Last updated&quot;
            date at the top of this page and, where appropriate, notify you
            through the Service or via email. Your continued use of the Service
            after changes are posted constitutes your acceptance of the revised
            Terms.
          </p>

          <h2>12. Governing Law</h2>

          <p>
            These Terms shall be governed by and construed in accordance with
            applicable laws, without regard to conflict of law principles. Any
            disputes arising from these Terms or the Service shall be resolved
            through good-faith negotiation. If a resolution cannot be reached,
            disputes shall be submitted to binding arbitration.
          </p>

          <h2>13. Contact Us</h2>

          <p>
            If you have any questions about these Terms of Service, please
            contact us at{" "}
            <a href="mailto:support@ishortn.ink">support@ishortn.ink</a>.
          </p>
        </article>
      </section>

      <Footer />
    </main>
  );
}
