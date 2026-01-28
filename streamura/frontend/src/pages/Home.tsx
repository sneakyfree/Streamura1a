import { Link } from 'react-router-dom';
import { Radio, Play, Globe, DollarSign, Users, Zap, Sparkles, Video, TrendingUp, Shield } from 'lucide-react';
import { Button } from '@/components/ui/Button';

export function HomePage() {
  return (
    <div className="min-h-screen bg-slate-950">
      {/* Hero Section with Animated Background */}
      <section className="relative overflow-hidden min-h-[90vh] flex items-center">
        {/* Animated gradient orbs */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-40 -right-40 w-96 h-96 bg-primary-500/20 rounded-full blur-3xl animate-pulse" />
          <div className="absolute top-1/2 -left-40 w-80 h-80 bg-purple-500/15 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
          <div className="absolute -bottom-20 right-1/3 w-72 h-72 bg-accent-500/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '2s' }} />
        </div>

        {/* Grid pattern overlay */}
        <div
          className="absolute inset-0 opacity-[0.02]"
          style={{
            backgroundImage: `linear-gradient(rgba(255,255,255,.1) 1px, transparent 1px),
                              linear-gradient(90deg, rgba(255,255,255,.1) 1px, transparent 1px)`,
            backgroundSize: '60px 60px'
          }}
        />

        {/* Main content */}
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
          <div className="text-center">
            {/* Live badge */}
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-red-500/10 border border-red-500/20 mb-8">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
              </span>
              <span className="text-red-400 text-sm font-medium">10,847 streams live now</span>
            </div>

            {/* Animated logo */}
            <div className="flex justify-center mb-8">
              <div className="relative">
                <div className="absolute inset-0 bg-primary-500/30 rounded-full blur-xl animate-pulse" />
                <div className="relative p-4 bg-gradient-to-br from-primary-500 to-primary-600 rounded-2xl">
                  <Radio className="h-12 w-12 text-white" />
                </div>
              </div>
            </div>

            {/* Main headline with gradient text */}
            <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold mb-6 tracking-tight">
              <span className="text-white">Live Events from</span>
              <br />
              <span className="bg-gradient-to-r from-primary-400 via-cyan-400 to-primary-400 bg-clip-text text-transparent">
                Everywhere
              </span>
            </h1>

            <p className="text-xl text-slate-400 max-w-2xl mx-auto mb-12 leading-relaxed">
              Stream live events, discover what's happening around the world,
              and <span className="text-primary-400 font-medium">earn money</span> sharing moments that matter.
            </p>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center mb-16">
              <Link to="/discover">
                <Button size="lg" className="w-full sm:w-auto px-8 py-4 text-lg bg-gradient-to-r from-primary-500 to-primary-600 hover:from-primary-600 hover:to-primary-700 shadow-lg shadow-primary-500/25 transition-all hover:shadow-xl hover:shadow-primary-500/30 hover:-translate-y-0.5">
                  <Play className="h-5 w-5 mr-2" />
                  Start Watching
                </Button>
              </Link>
              <Link to="/register">
                <Button size="lg" variant="outline" className="w-full sm:w-auto px-8 py-4 text-lg border-2 border-slate-600 hover:border-primary-500 hover:bg-primary-500/10 transition-all hover:-translate-y-0.5">
                  <Video className="h-5 w-5 mr-2" />
                  Go Live Now
                </Button>
              </Link>
            </div>

            {/* Trust indicators */}
            <div className="flex flex-wrap justify-center gap-8 text-slate-500 text-sm">
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4 text-green-500" />
                <span>Secure & Encrypted</span>
              </div>
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-primary-500" />
                <span>1M+ Active Users</span>
              </div>
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-yellow-500" />
                <span>$2M+ Paid to Creators</span>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom gradient fade */}
        <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-slate-950 to-transparent" />
      </section>

      {/* Features Section with Glassmorphism Cards */}
      <section className="py-24 relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <span className="inline-block px-4 py-1 rounded-full bg-primary-500/10 text-primary-400 text-sm font-medium mb-4">
              Why Streamura?
            </span>
            <h2 className="text-4xl lg:text-5xl font-bold text-white mb-6">
              The Future of Live Streaming
            </h2>
            <p className="text-slate-400 max-w-2xl mx-auto text-lg">
              Streamura connects you to live events as they unfold, powered by people on the ground.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {/* Card 1 - Global Coverage */}
            <div className="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-800/50 to-slate-900/50 backdrop-blur-sm border border-slate-700/50 p-8 hover:border-primary-500/50 transition-all duration-300 hover:-translate-y-1">
              <div className="absolute inset-0 bg-gradient-to-br from-primary-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="relative">
                <div className="h-14 w-14 bg-gradient-to-br from-primary-500/20 to-primary-600/20 rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                  <Globe className="h-7 w-7 text-primary-400" />
                </div>
                <h3 className="text-xl font-bold text-white mb-3">Global Coverage</h3>
                <p className="text-slate-400 leading-relaxed">
                  Watch live streams from concerts, protests, festivals, and breaking news events worldwide.
                </p>
              </div>
            </div>

            {/* Card 2 - Instant Monetization */}
            <div className="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-800/50 to-slate-900/50 backdrop-blur-sm border border-slate-700/50 p-8 hover:border-accent-500/50 transition-all duration-300 hover:-translate-y-1">
              <div className="absolute inset-0 bg-gradient-to-br from-accent-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="relative">
                <div className="h-14 w-14 bg-gradient-to-br from-accent-500/20 to-orange-600/20 rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                  <DollarSign className="h-7 w-7 text-accent-500" />
                </div>
                <h3 className="text-xl font-bold text-white mb-3">Instant Monetization</h3>
                <p className="text-slate-400 leading-relaxed">
                  Start earning from your streams immediately. Get paid for sharing moments that matter.
                </p>
              </div>
            </div>

            {/* Card 3 - Crowd-Sourced */}
            <div className="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-800/50 to-slate-900/50 backdrop-blur-sm border border-slate-700/50 p-8 hover:border-green-500/50 transition-all duration-300 hover:-translate-y-1">
              <div className="absolute inset-0 bg-gradient-to-br from-green-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="relative">
                <div className="h-14 w-14 bg-gradient-to-br from-green-500/20 to-emerald-600/20 rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                  <Users className="h-7 w-7 text-green-400" />
                </div>
                <h3 className="text-xl font-bold text-white mb-3">Crowd-Sourced</h3>
                <p className="text-slate-400 leading-relaxed">
                  Multiple perspectives from every event. See what's really happening from every angle.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section with Animated Numbers */}
      <section className="py-20 relative">
        <div className="absolute inset-0 bg-gradient-to-r from-primary-500/5 via-transparent to-primary-500/5" />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            <div className="text-center group">
              <div className="text-5xl font-bold bg-gradient-to-r from-primary-400 to-cyan-400 bg-clip-text text-transparent mb-2 group-hover:scale-110 transition-transform">10K+</div>
              <div className="text-slate-400 font-medium">Live Streams Daily</div>
            </div>
            <div className="text-center group">
              <div className="text-5xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent mb-2 group-hover:scale-110 transition-transform">150+</div>
              <div className="text-slate-400 font-medium">Countries</div>
            </div>
            <div className="text-center group">
              <div className="text-5xl font-bold bg-gradient-to-r from-green-400 to-emerald-400 bg-clip-text text-transparent mb-2 group-hover:scale-110 transition-transform">$2M+</div>
              <div className="text-slate-400 font-medium">Paid to Streamers</div>
            </div>
            <div className="text-center group">
              <div className="text-5xl font-bold bg-gradient-to-r from-accent-400 to-yellow-400 bg-clip-text text-transparent mb-2 group-hover:scale-110 transition-transform">1M+</div>
              <div className="text-slate-400 font-medium">Active Users</div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section with Gradient Border */}
      <section className="py-24">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="relative overflow-hidden rounded-3xl p-[1px] bg-gradient-to-r from-primary-500 via-purple-500 to-accent-500">
            <div className="relative bg-slate-900 rounded-3xl p-12 text-center">
              <div className="inline-flex items-center justify-center p-4 bg-gradient-to-br from-accent-500/20 to-accent-600/20 rounded-2xl mb-6">
                <Zap className="h-10 w-10 text-accent-500" />
              </div>
              <h2 className="text-4xl font-bold text-white mb-4">
                Ready to Start Streaming?
              </h2>
              <p className="text-slate-400 mb-8 text-lg max-w-xl mx-auto">
                No special equipment needed. Just your phone and something worth sharing.
              </p>
              <Link to="/register">
                <Button size="lg" className="px-10 py-4 text-lg bg-gradient-to-r from-accent-500 to-orange-500 hover:from-accent-600 hover:to-orange-600 shadow-lg shadow-accent-500/25 transition-all hover:shadow-xl hover:shadow-accent-500/30 hover:-translate-y-0.5">
                  Create Free Account
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-800/50 py-12 bg-slate-950">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-3 text-white">
              <div className="p-2 bg-gradient-to-br from-primary-500 to-primary-600 rounded-lg">
                <Radio className="h-5 w-5" />
              </div>
              <span className="text-xl font-bold">Streamura</span>
            </div>
            <div className="flex gap-8 text-slate-400 text-sm">
              <Link to="/about" className="hover:text-white transition-colors">About</Link>
              <Link to="/terms" className="hover:text-white transition-colors">Terms</Link>
              <Link to="/privacy" className="hover:text-white transition-colors">Privacy</Link>
              <Link to="/contact" className="hover:text-white transition-colors">Contact</Link>
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
