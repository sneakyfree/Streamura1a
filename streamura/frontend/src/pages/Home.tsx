import { Link } from 'react-router-dom';
import { Radio, Play, Globe, DollarSign, Users, Zap } from 'lucide-react';
import { Button } from '@/components/ui/Button';

export function HomePage() {
  return (
    <div className="min-h-screen bg-slate-900">
      {/* Hero Section */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary-900/20 via-slate-900 to-slate-900" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 lg:py-32">
          <div className="text-center">
            <div className="flex justify-center mb-8">
              <Radio className="h-16 w-16 text-primary-500" />
            </div>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white mb-6">
              Live Events from
              <span className="text-primary-400"> Everywhere</span>
            </h1>
            <p className="text-xl text-slate-300 max-w-2xl mx-auto mb-10">
              Stream live events, discover what's happening around the world, and earn money sharing moments that matter.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link to="/discover">
                <Button size="lg" className="w-full sm:w-auto">
                  <Play className="h-5 w-5 mr-2" />
                  Start Watching
                </Button>
              </Link>
              <Link to="/register">
                <Button size="lg" variant="secondary" className="w-full sm:w-auto">
                  Go Live Now
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 border-t border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-white mb-4">
              The Future of Live Streaming
            </h2>
            <p className="text-slate-400 max-w-2xl mx-auto">
              Streamura connects you to live events as they unfold, powered by people on the ground.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
              <div className="h-12 w-12 bg-primary-500/10 rounded-lg flex items-center justify-center mb-4">
                <Globe className="h-6 w-6 text-primary-400" />
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">Global Coverage</h3>
              <p className="text-slate-400">
                Watch live streams from concerts, protests, festivals, and breaking news events worldwide.
              </p>
            </div>

            <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
              <div className="h-12 w-12 bg-accent-500/10 rounded-lg flex items-center justify-center mb-4">
                <DollarSign className="h-6 w-6 text-accent-500" />
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">Instant Monetization</h3>
              <p className="text-slate-400">
                Start earning from your streams immediately. Get paid for sharing moments that matter.
              </p>
            </div>

            <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
              <div className="h-12 w-12 bg-green-500/10 rounded-lg flex items-center justify-center mb-4">
                <Users className="h-6 w-6 text-green-400" />
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">Crowd-Sourced</h3>
              <p className="text-slate-400">
                Multiple perspectives from every event. See what's really happening from every angle.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-20 bg-slate-800/30 border-y border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            <div className="text-center">
              <div className="text-4xl font-bold text-primary-400 mb-2">10K+</div>
              <div className="text-slate-400">Live Streams Daily</div>
            </div>
            <div className="text-center">
              <div className="text-4xl font-bold text-primary-400 mb-2">150+</div>
              <div className="text-slate-400">Countries</div>
            </div>
            <div className="text-center">
              <div className="text-4xl font-bold text-primary-400 mb-2">$2M+</div>
              <div className="text-slate-400">Paid to Streamers</div>
            </div>
            <div className="text-center">
              <div className="text-4xl font-bold text-primary-400 mb-2">1M+</div>
              <div className="text-slate-400">Active Users</div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <Zap className="h-12 w-12 text-accent-500 mx-auto mb-6" />
          <h2 className="text-3xl font-bold text-white mb-4">
            Ready to Start Streaming?
          </h2>
          <p className="text-slate-400 mb-8">
            No special equipment needed. Just your phone and something worth sharing.
          </p>
          <Link to="/register">
            <Button size="lg">
              Create Free Account
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-800 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2 text-white">
              <Radio className="h-6 w-6 text-primary-500" />
              <span className="font-bold">Streamura</span>
            </div>
            <div className="flex gap-6 text-slate-400 text-sm">
              <Link to="/about" className="hover:text-white">About</Link>
              <Link to="/terms" className="hover:text-white">Terms</Link>
              <Link to="/privacy" className="hover:text-white">Privacy</Link>
              <Link to="/contact" className="hover:text-white">Contact</Link>
            </div>
            <div className="text-slate-500 text-sm">
              &copy; 2024 Streamura. All rights reserved.
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
