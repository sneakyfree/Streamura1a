import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Check } from 'lucide-react';

const tiers = [
  {
    name: 'Viewer',
    price: 'Free',
    description: 'Watch streams, follow creators, join communities.',
    features: ['Unlimited streaming', 'Follow up to 500 creators', 'Basic chat', 'Mobile + web'],
    cta: 'Get started',
    href: '/register',
  },
  {
    name: 'Creator',
    price: '90/10',
    description: 'Go live and keep 90% of all earnings. Industry-leading revenue share.',
    features: ['HD streaming', 'Tips + subscriptions', 'Virtual goods marketplace', 'Analytics dashboard', 'Instant payouts'],
    cta: 'Start streaming',
    href: '/stream/new',
    highlight: true,
  },
  {
    name: 'Enterprise',
    price: 'Custom',
    description: 'Volume creators, agencies, and brands. Dedicated support and custom integrations.',
    features: ['Custom revenue terms', 'White-label option', 'API access', 'Priority support', 'SOC2 compliance docs'],
    cta: 'Contact sales',
    href: '/contact',
  },
];

export function PricingPage() {
  return (
    <div className="min-h-screen bg-slate-900 text-white py-16 px-6">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-bold mb-4">Pricing</h1>
          <p className="text-slate-400 max-w-2xl mx-auto">
            Free to watch. Free to stream. We only make money when you do — and you keep 90% of it.
          </p>
        </div>
        <div className="grid md:grid-cols-3 gap-6">
          {tiers.map((tier) => (
            <Card key={tier.name} className={tier.highlight ? 'border-primary-500 border-2' : ''}>
              <CardHeader>
                <CardTitle className="text-2xl">{tier.name}</CardTitle>
                <p className="text-3xl font-bold mt-2">{tier.price}</p>
                <p className="text-sm text-slate-400 mt-2">{tier.description}</p>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 mb-6">
                  {tier.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm">
                      <Check className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
                <Link to={tier.href}>
                  <Button variant={tier.highlight ? 'primary' : 'secondary'} className="w-full">
                    {tier.cta}
                  </Button>
                </Link>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}

export default PricingPage;
