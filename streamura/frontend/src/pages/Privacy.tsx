import { Link } from 'react-router-dom';
import { Shield, ChevronRight } from 'lucide-react';

const sections = [
  { id: 'collection', title: '1. Information We Collect' },
  { id: 'use', title: '2. How We Use Your Information' },
  { id: 'sharing', title: '3. Information Sharing' },
  { id: 'cookies', title: '4. Cookies & Tracking' },
  { id: 'rights', title: '5. Your Rights' },
  { id: 'retention', title: '6. Data Retention' },
  { id: 'security', title: '7. Security' },
  { id: 'children', title: '8. Children\'s Privacy' },
  { id: 'international', title: '9. International Transfers' },
  { id: 'changes', title: '10. Changes to This Policy' },
  { id: 'contact', title: '11. Contact Us' },
];

export function PrivacyPage() {
  const lastUpdated = 'January 1, 2026';

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-800">
      <div className="max-w-4xl mx-auto px-4 py-12">
        {/* Header */}
        <div className="mb-12">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 bg-primary-500/20 rounded-lg">
              <Shield className="h-8 w-8 text-primary-400" />
            </div>
            <div>
              <h1 className="text-4xl font-bold text-white">Privacy Policy</h1>
              <p className="text-slate-400">Last updated: {lastUpdated}</p>
            </div>
          </div>
          <p className="text-slate-300">
            Your privacy is important to us. This Privacy Policy explains how Streamura collects,
            uses, discloses, and safeguards your information when you use our platform.
          </p>
        </div>

        {/* Table of Contents */}
        <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-6 mb-12">
          <h2 className="text-lg font-semibold text-white mb-4">Table of Contents</h2>
          <nav className="grid md:grid-cols-2 gap-2">
            {sections.map((section) => (
              <a
                key={section.id}
                href={`#${section.id}`}
                className="flex items-center gap-2 text-slate-400 hover:text-primary-400 transition-colors py-1"
              >
                <ChevronRight className="h-4 w-4" />
                {section.title}
              </a>
            ))}
          </nav>
        </div>

        {/* Content */}
        <div className="prose prose-invert prose-slate max-w-none space-y-12">
          <section id="collection">
            <h2 className="text-2xl font-bold text-white mb-4">1. Information We Collect</h2>

            <h3 className="text-lg font-semibold text-white mb-2">Information You Provide</h3>
            <ul className="list-disc pl-6 text-slate-300 space-y-2 mb-4">
              <li><strong>Account Information:</strong> Username, email address, password, profile picture</li>
              <li><strong>Profile Information:</strong> Bio, social links, display name, preferred language</li>
              <li><strong>Payment Information:</strong> Billing address, payment method details (processed by Stripe)</li>
              <li><strong>Content:</strong> Streams, chat messages, comments, uploaded media</li>
              <li><strong>Communications:</strong> Messages to support, feedback, survey responses</li>
            </ul>

            <h3 className="text-lg font-semibold text-white mb-2">Information Collected Automatically</h3>
            <ul className="list-disc pl-6 text-slate-300 space-y-2 mb-4">
              <li><strong>Device Information:</strong> Device type, operating system, browser type</li>
              <li><strong>Usage Data:</strong> Pages viewed, streams watched, features used, time spent</li>
              <li><strong>Location Data:</strong> IP address, approximate geographic location</li>
              <li><strong>Log Data:</strong> Access times, error logs, referring URLs</li>
            </ul>

            <h3 className="text-lg font-semibold text-white mb-2">Information from Third Parties</h3>
            <ul className="list-disc pl-6 text-slate-300 space-y-2">
              <li>Social login providers (if you sign up via Google, etc.)</li>
              <li>Payment processors (transaction confirmations)</li>
              <li>Analytics providers</li>
            </ul>
          </section>

          <section id="use">
            <h2 className="text-2xl font-bold text-white mb-4">2. How We Use Your Information</h2>
            <p className="text-slate-300 mb-4">We use your information to:</p>
            <ul className="list-disc pl-6 text-slate-300 space-y-2">
              <li>Provide, maintain, and improve our platform</li>
              <li>Process transactions and send related information</li>
              <li>Send notifications about streams, follows, and other activities</li>
              <li>Personalize your experience and content recommendations</li>
              <li>Respond to your comments, questions, and support requests</li>
              <li>Monitor and analyze usage patterns and trends</li>
              <li>Detect, prevent, and address technical issues and fraud</li>
              <li>Enforce our Terms of Service and community guidelines</li>
              <li>Train and improve our AI moderation systems</li>
              <li>Send promotional communications (with your consent)</li>
            </ul>
          </section>

          <section id="sharing">
            <h2 className="text-2xl font-bold text-white mb-4">3. Information Sharing</h2>
            <p className="text-slate-300 mb-4">We may share your information with:</p>

            <h3 className="text-lg font-semibold text-white mb-2">Service Providers</h3>
            <p className="text-slate-300 mb-4">
              Third parties that help us operate the platform, including cloud hosting (AWS),
              payment processing (Stripe), email services, and analytics providers.
            </p>

            <h3 className="text-lg font-semibold text-white mb-2">Public Information</h3>
            <p className="text-slate-300 mb-4">
              Your public profile, streams, and chat messages are visible to other users.
              Your username and profile picture may appear in search results.
            </p>

            <h3 className="text-lg font-semibold text-white mb-2">Legal Requirements</h3>
            <p className="text-slate-300 mb-4">
              We may disclose information if required by law or in response to valid legal requests,
              or to protect our rights, privacy, safety, or property.
            </p>

            <h3 className="text-lg font-semibold text-white mb-2">Business Transfers</h3>
            <p className="text-slate-300">
              In the event of a merger, acquisition, or sale of assets, your information may be
              transferred as part of that transaction.
            </p>
          </section>

          <section id="cookies">
            <h2 className="text-2xl font-bold text-white mb-4">4. Cookies & Tracking</h2>
            <p className="text-slate-300 mb-4">We use cookies and similar technologies to:</p>
            <ul className="list-disc pl-6 text-slate-300 space-y-2 mb-4">
              <li><strong>Essential Cookies:</strong> Required for the platform to function (authentication, security)</li>
              <li><strong>Performance Cookies:</strong> Help us understand how you use the platform</li>
              <li><strong>Functionality Cookies:</strong> Remember your preferences (language, theme)</li>
              <li><strong>Analytics Cookies:</strong> Measure and improve platform performance</li>
            </ul>
            <p className="text-slate-300">
              You can control cookies through your browser settings. Note that disabling certain
              cookies may affect platform functionality.
            </p>
          </section>

          <section id="rights">
            <h2 className="text-2xl font-bold text-white mb-4">5. Your Rights</h2>
            <p className="text-slate-300 mb-4">Depending on your location, you may have the right to:</p>
            <ul className="list-disc pl-6 text-slate-300 space-y-2 mb-4">
              <li><strong>Access:</strong> Request a copy of your personal data</li>
              <li><strong>Rectification:</strong> Request correction of inaccurate data</li>
              <li><strong>Erasure:</strong> Request deletion of your personal data</li>
              <li><strong>Portability:</strong> Request your data in a portable format</li>
              <li><strong>Objection:</strong> Object to certain processing of your data</li>
              <li><strong>Restriction:</strong> Request restriction of processing</li>
              <li><strong>Withdraw Consent:</strong> Withdraw consent for processing based on consent</li>
            </ul>
            <p className="text-slate-300">
              To exercise these rights, please contact us at <a href="mailto:privacy@streamura.com" className="text-primary-400 hover:underline">privacy@streamura.com</a>.
              We will respond within 30 days.
            </p>

            <h3 className="text-lg font-semibold text-white mt-6 mb-2">California Residents (CCPA)</h3>
            <p className="text-slate-300">
              California residents have additional rights under the CCPA, including the right to
              know what personal information we collect, opt out of sales of personal information,
              and non-discrimination for exercising privacy rights.
            </p>

            <h3 className="text-lg font-semibold text-white mt-6 mb-2">EU/EEA Residents (GDPR)</h3>
            <p className="text-slate-300">
              If you are in the EU/EEA, you have rights under GDPR including those listed above.
              Our legal bases for processing include consent, contract performance, legitimate interests,
              and legal obligations.
            </p>
          </section>

          <section id="retention">
            <h2 className="text-2xl font-bold text-white mb-4">6. Data Retention</h2>
            <p className="text-slate-300 mb-4">We retain your information for as long as:</p>
            <ul className="list-disc pl-6 text-slate-300 space-y-2">
              <li>Your account is active</li>
              <li>Needed to provide services to you</li>
              <li>Required by law or for legal purposes</li>
              <li>Necessary for legitimate business purposes</li>
            </ul>
            <p className="text-slate-300 mt-4">
              When you delete your account, we will delete or anonymize your personal data within
              90 days, except where retention is required by law or for legitimate purposes.
            </p>
          </section>

          <section id="security">
            <h2 className="text-2xl font-bold text-white mb-4">7. Security</h2>
            <p className="text-slate-300 mb-4">
              We implement industry-standard security measures to protect your information:
            </p>
            <ul className="list-disc pl-6 text-slate-300 space-y-2">
              <li>Encryption in transit (TLS/SSL) and at rest</li>
              <li>Secure password hashing</li>
              <li>Regular security audits and penetration testing</li>
              <li>Access controls and authentication</li>
              <li>Monitoring for suspicious activity</li>
            </ul>
            <p className="text-slate-300 mt-4">
              While we strive to protect your information, no method of transmission or storage
              is 100% secure. Please use strong passwords and protect your account credentials.
            </p>
          </section>

          <section id="children">
            <h2 className="text-2xl font-bold text-white mb-4">8. Children's Privacy</h2>
            <p className="text-slate-300">
              Our platform is not intended for children under 13 years of age. We do not knowingly
              collect personal information from children under 13. If we become aware that we have
              collected personal information from a child under 13, we will take steps to delete
              that information. If you believe a child has provided us with personal information,
              please contact us immediately.
            </p>
          </section>

          <section id="international">
            <h2 className="text-2xl font-bold text-white mb-4">9. International Transfers</h2>
            <p className="text-slate-300">
              Your information may be transferred to and processed in countries other than your own.
              These countries may have different data protection laws. We take appropriate safeguards
              to ensure your information remains protected, including standard contractual clauses
              and other legal mechanisms approved by relevant authorities.
            </p>
          </section>

          <section id="changes">
            <h2 className="text-2xl font-bold text-white mb-4">10. Changes to This Policy</h2>
            <p className="text-slate-300">
              We may update this Privacy Policy from time to time. We will notify you of any material
              changes by posting the new policy on this page and updating the "Last updated" date.
              For significant changes, we may also send you an email notification. We encourage you
              to review this policy periodically.
            </p>
          </section>

          <section id="contact">
            <h2 className="text-2xl font-bold text-white mb-4">11. Contact Us</h2>
            <p className="text-slate-300 mb-4">
              If you have questions about this Privacy Policy or our data practices, please contact us:
            </p>
            <ul className="text-slate-300 space-y-2">
              <li>Email: <a href="mailto:privacy@streamura.com" className="text-primary-400 hover:underline">privacy@streamura.com</a></li>
              <li>Contact Form: <Link to="/contact" className="text-primary-400 hover:underline">Contact Us</Link></li>
            </ul>
            <p className="text-slate-300 mt-4">
              For EU residents, you also have the right to lodge a complaint with your local
              data protection authority.
            </p>
          </section>
        </div>


      </div>
    </div>
  );
}
