import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail, MessageSquare, Clock, CheckCircle, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';
import { api } from '@/lib/api';

const categories = [
  { value: 'general', label: 'General Inquiry' },
  { value: 'technical', label: 'Technical Support' },
  { value: 'billing', label: 'Billing & Payments' },
  { value: 'report', label: 'Report an Issue' },
  { value: 'partnership', label: 'Partnership Inquiry' },
  { value: 'press', label: 'Press & Media' },
];

const faqs = [
  {
    question: 'How do I start streaming?',
    answer: 'Create an account, go to "Go Live", set up your stream details, and click start!',
    link: '/stream/new',
  },
  {
    question: 'How do I get paid?',
    answer: 'Connect your Stripe account in your profile settings to receive tips and subscription revenue.',
    link: '/profile',
  },
  {
    question: 'How do I report a user?',
    answer: 'Click the report button on any stream or profile, or use the form below.',
    link: null,
  },
];

export function ContactPage() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    category: 'general',
    subject: '',
    message: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setFormData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSubmitStatus('idle');
    setErrorMessage('');

    try {
      await api.post('/contact', formData);
      setSubmitStatus('success');
      setFormData({
        name: '',
        email: '',
        category: 'general',
        subject: '',
        message: '',
      });
    } catch (error) {
      setSubmitStatus('error');
      setErrorMessage('Failed to send message. Please try again later.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-800">
      <div className="max-w-6xl mx-auto px-4 py-12">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="flex justify-center mb-4">
            <div className="p-4 bg-primary-500/20 rounded-full">
              <Mail className="h-10 w-10 text-primary-400" />
            </div>
          </div>
          <h1 className="text-4xl font-bold text-white mb-4">Contact Us</h1>
          <p className="text-slate-300 max-w-2xl mx-auto">
            Have a question, feedback, or need help? We're here for you.
            Fill out the form below and we'll get back to you as soon as possible.
          </p>
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Contact Form */}
          <div className="lg:col-span-2">
            <Card className="bg-slate-800/50 border-slate-700">
              <CardContent className="p-6">
                {submitStatus === 'success' ? (
                  <div className="text-center py-12">
                    <div className="flex justify-center mb-4">
                      <div className="p-4 bg-green-500/20 rounded-full">
                        <CheckCircle className="h-12 w-12 text-green-400" />
                      </div>
                    </div>
                    <h2 className="text-2xl font-bold text-white mb-2">Message Sent!</h2>
                    <p className="text-slate-300 mb-6">
                      Thank you for reaching out. We'll respond to your message within 24-48 hours.
                    </p>
                    <Button onClick={() => setSubmitStatus('idle')}>
                      Send Another Message
                    </Button>
                  </div>
                ) : (
                  <form onSubmit={handleSubmit} className="space-y-6">
                    {submitStatus === 'error' && (
                      <div className="flex items-center gap-2 p-4 bg-red-500/10 border border-red-500/20 rounded-lg">
                        <AlertCircle className="h-5 w-5 text-red-400" />
                        <span className="text-red-400">{errorMessage}</span>
                      </div>
                    )}

                    <div className="grid md:grid-cols-2 gap-6">
                      <div>
                        <label htmlFor="name" className="block text-sm font-medium text-slate-300 mb-2">
                          Your Name *
                        </label>
                        <input
                          type="text"
                          id="name"
                          name="name"
                          value={formData.name}
                          onChange={handleChange}
                          required
                          className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                          placeholder="John Doe"
                        />
                      </div>
                      <div>
                        <label htmlFor="email" className="block text-sm font-medium text-slate-300 mb-2">
                          Email Address *
                        </label>
                        <input
                          type="email"
                          id="email"
                          name="email"
                          value={formData.email}
                          onChange={handleChange}
                          required
                          className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                          placeholder="you@example.com"
                        />
                      </div>
                    </div>

                    <div className="grid md:grid-cols-2 gap-6">
                      <div>
                        <label htmlFor="category" className="block text-sm font-medium text-slate-300 mb-2">
                          Category *
                        </label>
                        <select
                          id="category"
                          name="category"
                          value={formData.category}
                          onChange={handleChange}
                          required
                          className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                        >
                          {categories.map((cat) => (
                            <option key={cat.value} value={cat.value}>
                              {cat.label}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label htmlFor="subject" className="block text-sm font-medium text-slate-300 mb-2">
                          Subject *
                        </label>
                        <input
                          type="text"
                          id="subject"
                          name="subject"
                          value={formData.subject}
                          onChange={handleChange}
                          required
                          className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                          placeholder="Brief description of your inquiry"
                        />
                      </div>
                    </div>

                    <div>
                      <label htmlFor="message" className="block text-sm font-medium text-slate-300 mb-2">
                        Message *
                      </label>
                      <textarea
                        id="message"
                        name="message"
                        value={formData.message}
                        onChange={handleChange}
                        required
                        rows={6}
                        className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none"
                        placeholder="Please provide as much detail as possible..."
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <p className="text-sm text-slate-400">
                        * Required fields
                      </p>
                      <Button type="submit" disabled={isSubmitting} className="gap-2">
                        {isSubmitting ? (
                          <>
                            <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            Sending...
                          </>
                        ) : (
                          <>
                            <MessageSquare className="h-4 w-4" />
                            Send Message
                          </>
                        )}
                      </Button>
                    </div>
                  </form>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Response Time */}
            <Card className="bg-slate-800/50 border-slate-700">
              <CardContent className="p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 bg-accent-500/20 rounded-lg">
                    <Clock className="h-5 w-5 text-accent-400" />
                  </div>
                  <h3 className="text-lg font-semibold text-white">Response Time</h3>
                </div>
                <p className="text-slate-300 text-sm">
                  We typically respond within <strong>24-48 hours</strong> during business days.
                  For urgent issues, please include "URGENT" in your subject line.
                </p>
              </CardContent>
            </Card>

            {/* Quick Links / FAQs */}
            <Card className="bg-slate-800/50 border-slate-700">
              <CardContent className="p-6">
                <h3 className="text-lg font-semibold text-white mb-4">Quick Answers</h3>
                <div className="space-y-4">
                  {faqs.map((faq, index) => (
                    <div key={index} className="border-b border-slate-700 pb-4 last:border-0 last:pb-0">
                      <h4 className="text-sm font-medium text-white mb-1">{faq.question}</h4>
                      <p className="text-sm text-slate-400">
                        {faq.answer}
                        {faq.link && (
                          <Link to={faq.link} className="text-primary-400 hover:underline ml-1">
                            Learn more
                          </Link>
                        )}
                      </p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Direct Contact */}
            <Card className="bg-slate-800/50 border-slate-700">
              <CardContent className="p-6">
                <h3 className="text-lg font-semibold text-white mb-4">Direct Contact</h3>
                <div className="space-y-3 text-sm">
                  <div>
                    <span className="text-slate-400">General:</span>
                    <a href="mailto:hello@streamura.com" className="text-primary-400 hover:underline ml-2">
                      hello@streamura.com
                    </a>
                  </div>
                  <div>
                    <span className="text-slate-400">Support:</span>
                    <a href="mailto:support@streamura.com" className="text-primary-400 hover:underline ml-2">
                      support@streamura.com
                    </a>
                  </div>
                  <div>
                    <span className="text-slate-400">Legal:</span>
                    <a href="mailto:legal@streamura.com" className="text-primary-400 hover:underline ml-2">
                      legal@streamura.com
                    </a>
                  </div>
                  <div>
                    <span className="text-slate-400">Press:</span>
                    <a href="mailto:press@streamura.com" className="text-primary-400 hover:underline ml-2">
                      press@streamura.com
                    </a>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Footer Navigation */}
        <div className="mt-12 pt-8 border-t border-slate-700 flex flex-wrap justify-center gap-6 text-slate-400">
          <Link to="/about" className="hover:text-white transition-colors">About</Link>
          <Link to="/terms" className="hover:text-white transition-colors">Terms of Service</Link>
          <Link to="/privacy" className="hover:text-white transition-colors">Privacy Policy</Link>
        </div>
      </div>
    </div>
  );
}
