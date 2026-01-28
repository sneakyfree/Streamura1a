import { Link } from 'react-router-dom';
import {
  Video, Users, DollarSign, Globe, Shield, Zap,
  Heart, TrendingUp, Award, ArrowRight
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';

const features = [
  {
    icon: Video,
    title: 'Live Streaming',
    description: 'Broadcast in HD quality with ultra-low latency. Reach your audience anywhere in the world.',
  },
  {
    icon: DollarSign,
    title: 'Monetization',
    description: 'Earn through tips, subscriptions, and virtual goods. Get paid directly to your bank account.',
  },
  {
    icon: Users,
    title: 'Community',
    description: 'Build your community with followers, subscribers, and dedicated fan spaces.',
  },
  {
    icon: Shield,
    title: 'AI Moderation',
    description: 'Keep your streams safe with intelligent content moderation powered by AI.',
  },
  {
    icon: Globe,
    title: 'Global Reach',
    description: 'Stream to viewers worldwide with multi-language support and global CDN.',
  },
  {
    icon: Zap,
    title: 'Smart Analytics',
    description: 'AI-powered predictions and insights to grow your channel and optimize your content.',
  },
];

const stats = [
  { label: 'Active Creators', value: '10K+' },
  { label: 'Hours Streamed', value: '1M+' },
  { label: 'Tips Sent', value: '$500K+' },
  { label: 'Countries', value: '150+' },
];

const values = [
  {
    icon: Heart,
    title: 'Creator First',
    description: 'Everything we build is designed to help creators succeed and connect with their audience.',
  },
  {
    icon: TrendingUp,
    title: 'Innovation',
    description: 'We push the boundaries of live streaming with cutting-edge technology and AI.',
  },
  {
    icon: Award,
    title: 'Quality',
    description: 'We maintain the highest standards in streaming quality, reliability, and user experience.',
  },
];

export function AboutPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-900 to-slate-800">
      {/* Hero Section */}
      <section className="relative py-20 px-4 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-primary-500/10 to-accent-500/10" />
        <div className="max-w-6xl mx-auto relative z-10">
          <div className="text-center">
            <h1 className="text-5xl md:text-6xl font-bold text-white mb-6">
              About <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary-400 to-accent-400">Streamura</span>
            </h1>
            <p className="text-xl text-slate-300 max-w-3xl mx-auto mb-8">
              We're building the future of live streaming. A platform where creators can thrive,
              communities can flourish, and everyone can share their passion with the world.
            </p>
            <div className="flex flex-wrap justify-center gap-4">
              <Link to="/register">
                <Button size="lg" className="gap-2">
                  Start Streaming <ArrowRight className="h-5 w-5" />
                </Button>
              </Link>
              <Link to="/discover">
                <Button variant="outline" size="lg">
                  Explore Streams
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-16 px-4 border-y border-slate-800">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {stats.map((stat) => (
              <div key={stat.label} className="text-center">
                <div className="text-4xl md:text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-primary-400 to-accent-400 mb-2">
                  {stat.value}
                </div>
                <div className="text-slate-400">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
              Everything You Need to Succeed
            </h2>
            <p className="text-slate-400 max-w-2xl mx-auto">
              Streamura provides all the tools creators need to build their audience,
              engage their community, and monetize their content.
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature) => (
              <Card key={feature.title} className="bg-slate-800/50 border-slate-700 hover:border-primary-500/50 transition-colors">
                <CardContent className="p-6">
                  <div className="p-3 bg-primary-500/20 rounded-lg w-fit mb-4">
                    <feature.icon className="h-6 w-6 text-primary-400" />
                  </div>
                  <h3 className="text-xl font-semibold text-white mb-2">{feature.title}</h3>
                  <p className="text-slate-400">{feature.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Mission Section */}
      <section className="py-20 px-4 bg-slate-800/30">
        <div className="max-w-6xl mx-auto">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-3xl md:text-4xl font-bold text-white mb-6">
                Our Mission
              </h2>
              <p className="text-lg text-slate-300 mb-6">
                We believe everyone has a story worth sharing. Our mission is to democratize
                live streaming by providing creators with powerful, accessible tools to
                broadcast their content and build meaningful connections with their audience.
              </p>
              <p className="text-lg text-slate-300">
                Whether you're a gamer, musician, educator, or just someone who loves to
                share, Streamura is your platform to shine.
              </p>
            </div>
            <div className="grid grid-cols-1 gap-6">
              {values.map((value) => (
                <div key={value.title} className="flex gap-4">
                  <div className="p-3 bg-accent-500/20 rounded-lg h-fit">
                    <value.icon className="h-6 w-6 text-accent-400" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-white mb-1">{value.title}</h3>
                    <p className="text-slate-400">{value.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-6">
            Ready to Start Your Journey?
          </h2>
          <p className="text-xl text-slate-300 mb-8">
            Join thousands of creators who are already building their audience on Streamura.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <Link to="/register">
              <Button size="lg" className="gap-2">
                Create Your Account <ArrowRight className="h-5 w-5" />
              </Button>
            </Link>
            <Link to="/contact">
              <Button variant="outline" size="lg">
                Contact Us
              </Button>
            </Link>
          </div>
        </div>
      </section>


    </div>
  );
}
