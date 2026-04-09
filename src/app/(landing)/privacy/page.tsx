import type { Metadata } from "next";

import { Footer } from "../_components/footer";
import { Header } from "../_components/header";

export const metadata: Metadata = {
  title: "Privacy Policy - iShortn",
  description:
    "Learn how iShortn collects, uses, and protects your personal information.",
  openGraph: {
    title: "Privacy Policy - iShortn",
    description:
      "Learn how iShortn collects, uses, and protects your personal information.",
    type: "website",
  },
};

export default function PrivacyPage() {
  return (
    <main className="relative bg-white">
      <Header />

      {/* Hero */}
      <section className="px-6 pt-32 pb-12 md:pt-40 md:pb-16">
        <div className="mx-auto max-w-3xl">
          <p className="text-xs font-medium uppercase tracking-widest text-neutral-400">
            Legal
          </p>
          <h1 className="mt-3 font-display text-4xl tracking-tight text-neutral-900 sm:text-5xl">
            Privacy Policy
          </h1>
          <p className="mt-3 text-base text-neutral-500">
            Last updated: March 2026
          </p>
        </div>
      </section>

      {/* Content */}
      <section className="px-6 pb-24">
        <div className="mx-auto max-w-3xl">
          <div className="prose prose-neutral max-w-none text-neutral-600 [&_h2]:mt-10 [&_h2]:mb-4 [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:tracking-tight [&_h2]:text-neutral-900 [&_p]:mb-4 [&_p]:leading-relaxed [&_ul]:mb-4 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:leading-relaxed [&_li]:mb-1">
            <p>
              At iShortn, we take your privacy seriously. This Privacy Policy
              explains how we collect, use, disclose, and safeguard your
              information when you use our URL shortening service at ishortn.ink.
              Please read this policy carefully. By using iShortn, you agree to
              the collection and use of information in accordance with this
              policy.
            </p>

            <h2>1. Information We Collect</h2>

            <p>
              We collect information in the following ways when you use our
              service:
            </p>

            <p className="!mb-2 font-medium text-neutral-800">
              Account Information
            </p>
            <ul>
              <li>
                Name, email address, and profile information provided through
                your authentication provider when you create an account.
              </li>
              <li>
                Account preferences, settings, and subscription details.
              </li>
            </ul>

            <p className="!mb-2 font-medium text-neutral-800">Usage Data</p>
            <ul>
              <li>
                Links you create, including original URLs and shortened URLs.
              </li>
              <li>QR codes you generate through the platform.</li>
              <li>
                Interaction data such as features used, pages visited, and
                actions taken within the service.
              </li>
            </ul>

            <p className="!mb-2 font-medium text-neutral-800">
              Analytics Data from Shortened Links
            </p>
            <ul>
              <li>
                When someone clicks a shortened link, we collect information
                about that click, including: IP address (anonymized), browser
                type and version, operating system, device type, referring
                website, approximate geographic location (country and city), and
                timestamp of the click.
              </li>
              <li>
                This analytics data is collected to provide link creators with
                insights about their audience and link performance.
              </li>
            </ul>

            <p className="!mb-2 font-medium text-neutral-800">
              Technical Information
            </p>
            <ul>
              <li>
                Browser type, IP address, device information, and operating
                system when you access our website or dashboard.
              </li>
              <li>
                Log data such as access times, pages viewed, and referring URLs.
              </li>
            </ul>

            <h2>2. How We Use Your Information</h2>

            <p>We use the information we collect to:</p>
            <ul>
              <li>Provide, maintain, and improve the iShortn service.</li>
              <li>
                Create and manage your account and process your requests.
              </li>
              <li>
                Generate click analytics and performance reports for your
                shortened links.
              </li>
              <li>
                Detect and prevent abuse, spam, phishing, and malicious use of
                our service.
              </li>
              <li>
                Send you service-related communications, such as account
                notifications and updates.
              </li>
              <li>
                Enforce our Terms of Service and ensure compliance with our
                acceptable use policies.
              </li>
              <li>
                Analyze usage trends to improve the user experience and develop
                new features.
              </li>
            </ul>

            <h2>3. Data Sharing and Disclosure</h2>

            <p>
              We do not sell, rent, or trade your personal information to third
              parties. We may share your information in the following limited
              circumstances:
            </p>
            <ul>
              <li>
                <strong>Service providers:</strong> We use third-party services
                to operate our platform. These include Clerk for authentication
                and account management, and analytics providers for service
                monitoring. These providers only have access to the information
                necessary to perform their functions and are obligated to protect
                your data.
              </li>
              <li>
                <strong>Legal requirements:</strong> We may disclose your
                information if required to do so by law, court order, or
                governmental request, or if we believe disclosure is necessary to
                protect our rights, your safety, or the safety of others.
              </li>
              <li>
                <strong>Business transfers:</strong> In the event of a merger,
                acquisition, or sale of assets, your information may be
                transferred as part of that transaction.
              </li>
            </ul>

            <p>
              Link analytics data (click counts, geographic distribution, device
              breakdowns) is visible to the user who created the shortened link.
              This data does not include personally identifiable information
              about the individuals who clicked the link.
            </p>

            <h2>4. Cookies</h2>

            <p>
              iShortn uses cookies and similar technologies to maintain your
              session, remember your preferences, and provide a secure
              experience. We use:
            </p>
            <ul>
              <li>
                <strong>Essential cookies:</strong> Required for authentication,
                security, and basic functionality of the service.
              </li>
              <li>
                <strong>Analytics cookies:</strong> Used to understand how
                visitors interact with our website so we can improve the
                experience.
              </li>
            </ul>
            <p>
              You can control cookie settings through your browser preferences.
              Disabling essential cookies may affect the functionality of the
              service.
            </p>

            <h2>5. Data Retention</h2>

            <p>
              We retain your account information for as long as your account is
              active. If you delete your account, we will remove your personal
              information and link data within 30 days, except where we are
              required to retain it for legal or compliance purposes.
            </p>
            <p>
              Aggregated and anonymized analytics data may be retained
              indefinitely as it cannot be used to identify any individual.
            </p>

            <h2>6. Data Security</h2>

            <p>
              We implement industry-standard security measures to protect your
              information, including encryption in transit (TLS/SSL), secure data
              storage, and access controls. However, no method of transmission
              over the internet or electronic storage is completely secure, and
              we cannot guarantee absolute security.
            </p>

            <h2>7. Your Rights</h2>

            <p>
              Depending on your jurisdiction, you may have the following rights
              regarding your personal information:
            </p>
            <ul>
              <li>
                <strong>Access:</strong> Request a copy of the personal
                information we hold about you.
              </li>
              <li>
                <strong>Correction:</strong> Request that we correct any
                inaccurate or incomplete information.
              </li>
              <li>
                <strong>Deletion:</strong> Request that we delete your personal
                information and account data.
              </li>
              <li>
                <strong>Data portability:</strong> Request a copy of your data in
                a structured, machine-readable format.
              </li>
              <li>
                <strong>Objection:</strong> Object to the processing of your
                personal information in certain circumstances.
              </li>
            </ul>
            <p>
              To exercise any of these rights, please contact us at{" "}
              <a
                href="mailto:support@ishortn.ink"
                className="text-neutral-900 underline underline-offset-4 transition-colors hover:text-neutral-600"
              >
                support@ishortn.ink
              </a>
              .
            </p>

            <h2>8. Children&apos;s Privacy</h2>

            <p>
              iShortn is not intended for use by children under the age of 13. We
              do not knowingly collect personal information from children. If we
              become aware that we have collected information from a child under
              13, we will take steps to delete that information promptly.
            </p>

            <h2>9. Changes to This Policy</h2>

            <p>
              We may update this Privacy Policy from time to time. When we make
              changes, we will update the &quot;Last updated&quot; date at the top of this
              page. We encourage you to review this policy periodically to stay
              informed about how we protect your information.
            </p>

            <h2>10. Contact Us</h2>

            <p>
              If you have any questions or concerns about this Privacy Policy or
              our data practices, please contact us at{" "}
              <a
                href="mailto:support@ishortn.ink"
                className="text-neutral-900 underline underline-offset-4 transition-colors hover:text-neutral-600"
              >
                support@ishortn.ink
              </a>
              .
            </p>
          </div>
        </div>
      </section>

      <Footer />
    </main>
  );
}
