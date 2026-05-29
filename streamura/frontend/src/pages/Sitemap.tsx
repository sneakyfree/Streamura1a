import { Link } from 'react-router-dom';

const sections: { title: string; links: { label: string; to: string }[] }[] = [
  {
    title: 'Discover',
    links: [
      { label: 'Home', to: '/' },
      { label: 'Feed', to: '/feed' },
      { label: 'Discover', to: '/discover' },
      { label: 'Trending', to: '/trending' },
      { label: 'Nearby', to: '/nearby' },
      { label: 'Communities', to: '/communities' },
    ],
  },
  {
    title: 'Creator',
    links: [
      { label: 'Go Live', to: '/stream/new' },
      { label: 'Analytics', to: '/analytics' },
      { label: 'Payouts', to: '/payouts' },
      { label: 'Tax Center', to: '/tax' },
      { label: 'Content Licensing', to: '/content-licensing' },
      { label: 'KYC Verification', to: '/kyc-verification' },
    ],
  },
  {
    title: 'Account',
    links: [
      { label: 'Profile', to: '/profile' },
      { label: 'Settings', to: '/settings' },
      { label: 'Data Export', to: '/settings/data-export' },
      { label: 'Notifications', to: '/notifications' },
      { label: 'Messages', to: '/messages' },
      { label: 'Inventory', to: '/inventory' },
      { label: 'Appeals', to: '/appeals' },
    ],
  },
  {
    title: 'Shop',
    links: [
      { label: 'Virtual Goods', to: '/shop' },
      { label: 'Coin Shop', to: '/coins' },
    ],
  },
  {
    title: 'Company',
    links: [
      { label: 'About', to: '/about' },
      { label: 'Pricing', to: '/pricing' },
      { label: 'Contact', to: '/contact' },
      { label: 'Features', to: '/features' },
    ],
  },
  {
    title: 'Legal',
    links: [
      { label: 'Terms of Service', to: '/terms' },
      { label: 'Privacy Policy', to: '/privacy' },
      { label: 'Cookie Policy', to: '/cookies' },
      { label: 'Community Guidelines', to: '/guidelines' },
    ],
  },
];

export function SitemapPage() {
  return (
    <div className="min-h-screen bg-slate-900 text-white py-16 px-6">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-4xl font-bold mb-2">Sitemap</h1>
        <p className="text-slate-400 mb-10">Every public page on Streamura, in one place.</p>
        <div className="grid md:grid-cols-3 gap-8">
          {sections.map((s) => (
            <div key={s.title}>
              <h2 className="text-lg font-semibold mb-3 text-primary-400">{s.title}</h2>
              <ul className="space-y-2">
                {s.links.map((l) => (
                  <li key={l.to}>
                    <Link to={l.to} className="text-slate-300 hover:text-white transition-colors text-sm">
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default SitemapPage;
