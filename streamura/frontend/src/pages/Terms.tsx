import { Link } from 'react-router-dom';
import { FileText, ChevronRight } from 'lucide-react';

const sections = [
  { id: 'acceptance', title: '1. Acceptance of Terms' },
  { id: 'accounts', title: '2. Account Terms' },
  { id: 'acceptable-use', title: '3. Acceptable Use' },
  { id: 'content', title: '4. Content Rights' },
  { id: 'monetization', title: '5. Monetization' },
  { id: 'subscriptions', title: '6. Subscriptions & Payments' },
  { id: 'termination', title: '7. Termination' },
  { id: 'disclaimers', title: '8. Disclaimers' },
  { id: 'liability', title: '9. Limitation of Liability' },
  { id: 'changes', title: '10. Changes to Terms' },
  { id: 'contact', title: '11. Contact Information' },
];

export function TermsPage() {
  const lastUpdated = 'January 1, 2026';

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-800">
      <div className="max-w-4xl mx-auto px-4 py-12">
        {/* Header */}
        <div className="mb-12">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 bg-primary-500/20 rounded-lg">
              <FileText className="h-8 w-8 text-primary-400" />
            </div>
            <div>
              <h1 className="text-4xl font-bold text-white">Terms of Service</h1>
              <p className="text-slate-400">Last updated: {lastUpdated}</p>
            </div>
          </div>
          <p className="text-slate-300">
            Please read these Terms of Service carefully before using Streamura.
            By accessing or using our platform, you agree to be bound by these terms.
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
          <section id="acceptance">
            <h2 className="text-2xl font-bold text-white mb-4">1. Acceptance of Terms</h2>
            <p className="text-slate-300 mb-4">
              By accessing or using Streamura ("the Platform"), you agree to be bound by these Terms of Service
              and all applicable laws and regulations. If you do not agree with any of these terms, you are
              prohibited from using or accessing the Platform.
            </p>
            <p className="text-slate-300">
              These terms apply to all users of the Platform, including without limitation users who are
              streamers, viewers, subscribers, or contributors of content.
            </p>
          </section>

          <section id="accounts">
            <h2 className="text-2xl font-bold text-white mb-4">2. Account Terms</h2>
            <ul className="list-disc pl-6 text-slate-300 space-y-2">
              <li>You must be at least 13 years old to use the Platform. If you are under 18, you must have parental consent.</li>
              <li>You must provide accurate and complete information when creating your account.</li>
              <li>You are responsible for maintaining the security of your account and password.</li>
              <li>You are responsible for all activities that occur under your account.</li>
              <li>You must notify us immediately of any unauthorized use of your account.</li>
              <li>One person may not maintain more than one account without prior approval.</li>
            </ul>
          </section>

          <section id="acceptable-use">
            <h2 className="text-2xl font-bold text-white mb-4">3. Acceptable Use</h2>
            <p className="text-slate-300 mb-4">You agree not to use the Platform to:</p>
            <ul className="list-disc pl-6 text-slate-300 space-y-2">
              <li>Violate any applicable laws or regulations</li>
              <li>Post or transmit any content that is illegal, harmful, threatening, abusive, harassing, defamatory, or otherwise objectionable</li>
              <li>Impersonate any person or entity or falsely represent your affiliation</li>
              <li>Post content that infringes on intellectual property rights</li>
              <li>Transmit viruses, malware, or other harmful code</li>
              <li>Interfere with or disrupt the Platform or servers</li>
              <li>Attempt to gain unauthorized access to any portion of the Platform</li>
              <li>Harass, bully, or intimidate other users</li>
              <li>Share sexually explicit content involving minors</li>
              <li>Engage in any form of hate speech or discrimination</li>
            </ul>
          </section>

          <section id="content">
            <h2 className="text-2xl font-bold text-white mb-4">4. Content Rights</h2>
            <h3 className="text-lg font-semibold text-white mb-2">Your Content</h3>
            <p className="text-slate-300 mb-4">
              You retain ownership of all content you create and share on the Platform. By posting content,
              you grant Streamura a non-exclusive, worldwide, royalty-free license to use, copy, modify,
              distribute, and display your content in connection with operating the Platform.
            </p>
            <h3 className="text-lg font-semibold text-white mb-2">Content Moderation</h3>
            <p className="text-slate-300 mb-4">
              We reserve the right to remove any content that violates these terms or is otherwise
              objectionable. We use AI-powered moderation tools to help maintain community standards.
            </p>
            <h3 className="text-lg font-semibold text-white mb-2">DMCA</h3>
            <p className="text-slate-300">
              We respect intellectual property rights and will respond to valid DMCA takedown notices.
              Contact us at legal@streamura.com for copyright concerns.
            </p>
          </section>

          <section id="monetization">
            <h2 className="text-2xl font-bold text-white mb-4">5. Monetization</h2>
            <p className="text-slate-300 mb-4">
              Streamura offers various monetization features for eligible creators:
            </p>
            <ul className="list-disc pl-6 text-slate-300 space-y-2">
              <li><strong>Tips:</strong> Viewers can send tips to creators during streams. Streamura takes a 10% platform fee.</li>
              <li><strong>Subscriptions:</strong> Creators can offer subscription tiers with exclusive benefits. Revenue split is 70/30 (creator/platform).</li>
              <li><strong>Virtual Goods:</strong> Creators can sell digital items. Revenue split is 70/30 (creator/platform).</li>
            </ul>
            <p className="text-slate-300 mt-4">
              To receive payouts, you must connect a valid payment method and meet our minimum payout threshold of $50.
            </p>
          </section>

          <section id="subscriptions">
            <h2 className="text-2xl font-bold text-white mb-4">6. Subscriptions & Payments</h2>
            <ul className="list-disc pl-6 text-slate-300 space-y-2">
              <li>Subscription fees are billed in advance on a monthly basis</li>
              <li>Subscriptions automatically renew unless cancelled before the renewal date</li>
              <li>Refunds are generally not provided for subscription fees, except as required by law</li>
              <li>We may change subscription prices with 30 days notice</li>
              <li>Gift subscriptions are non-refundable once redeemed</li>
            </ul>
          </section>

          <section id="termination">
            <h2 className="text-2xl font-bold text-white mb-4">7. Termination</h2>
            <p className="text-slate-300 mb-4">
              We may terminate or suspend your account immediately, without prior notice, for any reason,
              including but not limited to:
            </p>
            <ul className="list-disc pl-6 text-slate-300 space-y-2">
              <li>Breach of these Terms of Service</li>
              <li>Fraudulent, abusive, or illegal activity</li>
              <li>Behavior that is harmful to other users or the Platform</li>
              <li>Extended periods of inactivity</li>
            </ul>
            <p className="text-slate-300 mt-4">
              Upon termination, your right to use the Platform will immediately cease. Any pending
              payouts will be processed according to our standard schedule, minus any amounts owed to us.
            </p>
          </section>

          <section id="disclaimers">
            <h2 className="text-2xl font-bold text-white mb-4">8. Disclaimers</h2>
            <p className="text-slate-300 mb-4">
              THE PLATFORM IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY KIND,
              EITHER EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO IMPLIED WARRANTIES OF
              MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT.
            </p>
            <p className="text-slate-300">
              We do not warrant that the Platform will be uninterrupted, secure, or error-free.
              We do not endorse or guarantee any content posted by users.
            </p>
          </section>

          <section id="liability">
            <h2 className="text-2xl font-bold text-white mb-4">9. Limitation of Liability</h2>
            <p className="text-slate-300 mb-4">
              IN NO EVENT SHALL STREAMURA, ITS OFFICERS, DIRECTORS, EMPLOYEES, OR AGENTS BE LIABLE
              FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES ARISING OUT
              OF OR RELATED TO YOUR USE OF THE PLATFORM.
            </p>
            <p className="text-slate-300">
              Our total liability for any claims arising from these terms or your use of the Platform
              shall not exceed the amount you paid to us in the twelve months preceding the claim.
            </p>
          </section>

          <section id="changes">
            <h2 className="text-2xl font-bold text-white mb-4">10. Changes to Terms</h2>
            <p className="text-slate-300">
              We reserve the right to modify these terms at any time. We will notify users of any
              material changes by posting the new terms on the Platform and updating the "Last updated"
              date. Your continued use of the Platform after changes constitutes acceptance of the new terms.
            </p>
          </section>

          <section id="contact">
            <h2 className="text-2xl font-bold text-white mb-4">11. Contact Information</h2>
            <p className="text-slate-300 mb-4">
              If you have any questions about these Terms of Service, please contact us:
            </p>
            <ul className="text-slate-300 space-y-2">
              <li>Email: <a href="mailto:legal@streamura.com" className="text-primary-400 hover:underline">legal@streamura.com</a></li>
              <li>Contact Form: <Link to="/contact" className="text-primary-400 hover:underline">Contact Us</Link></li>
            </ul>
          </section>
        </div>


      </div>
    </div>
  );
}
