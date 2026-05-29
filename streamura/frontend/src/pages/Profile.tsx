import { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { User, Video, Settings, Shield, CheckCircle, Crown, Package, ShoppingBag } from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import { WalletCard, TransactionList, PayoutSettings } from '@/components/payments';
import { FollowersList } from '@/components/social';
import { TierManagement } from '@/components/subscriptions/TierManagement';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

export function ProfilePage() {
  const { user } = useAuthStore();
  const [searchParams, setSearchParams] = useSearchParams();
  const [stripeMessage, setStripeMessage] = useState<string | null>(null);
  const [showFollowersModal, setShowFollowersModal] = useState(false);
  const [followersTab, setFollowersTab] = useState<'followers' | 'following'>('followers');

  // Handle Stripe redirect callbacks
  useEffect(() => {
    const stripeStatus = searchParams.get('stripe');
    if (stripeStatus === 'complete') {
      setStripeMessage('Stripe setup completed successfully!');
      setSearchParams({}, { replace: true });
    } else if (stripeStatus === 'refresh') {
      setStripeMessage('Please complete your Stripe setup to enable payouts.');
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-xl font-semibold text-white mb-2">Please sign in</h1>
          <p className="text-slate-400 mb-4">You need to be logged in to view your profile.</p>
          <Link to="/login">
            <Button>Sign In</Button>
          </Link>
        </div>
      </div>
    );
  }

  const isAnonymous = user.username?.startsWith('anonymous_');

  return (
    <div className="min-h-screen bg-slate-900">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Profile Header */}
        <div className="mb-8">
          <div className="flex items-start gap-6">
            <div className="h-24 w-24 bg-slate-700 rounded-full flex items-center justify-center">
              <User className="h-12 w-12 text-slate-400" />
            </div>
            <div className="flex-1">
              <h1 className="text-2xl font-bold text-white mb-1">
                {isAnonymous ? 'Anonymous User' : user.username || 'User'}
              </h1>
              <p className="text-slate-400 mb-3">
                {user.email || user.phone_number || 'No contact info'}
              </p>
              <div className="flex items-center gap-4">
                {user.is_verified ? (
                  <span className="flex items-center gap-1 text-green-400 text-sm">
                    <Shield className="h-4 w-4" />
                    Verified
                  </span>
                ) : (
                  <span className="text-slate-500 text-sm">Not verified</span>
                )}
                <button
                  onClick={() => {
                    setFollowersTab('followers');
                    setShowFollowersModal(true);
                  }}
                  className="text-slate-400 hover:text-white transition-colors"
                >
                  <span className="font-semibold text-white">{(user.follower_count || 0).toLocaleString()}</span> followers
                </button>
                <button
                  onClick={() => {
                    setFollowersTab('following');
                    setShowFollowersModal(true);
                  }}
                  className="text-slate-400 hover:text-white transition-colors"
                >
                  <span className="font-semibold text-white">{(user.following_count || 0).toLocaleString()}</span> following
                </button>
              </div>
            </div>
            <Button variant="secondary">
              <Settings className="h-4 w-4 mr-2" />
              Edit Profile
            </Button>
          </div>
        </div>

        {/* Anonymous User Upgrade Banner */}
        {isAnonymous && (
          <Card className="mb-8 border-primary-500/30 bg-primary-500/5">
            <CardContent className="py-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-white mb-1">Upgrade Your Account</h3>
                  <p className="text-slate-400 text-sm">
                    Create a full account to unlock all features and start earning from your streams.
                  </p>
                </div>
                <Link to="/register">
                  <Button>Create Account</Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Stripe Status Message */}
        {stripeMessage && (
          <div className="mb-6 p-4 bg-green-500/10 border border-green-500/20 rounded-lg flex items-center gap-3">
            <CheckCircle className="h-5 w-5 text-green-400 flex-shrink-0" />
            <span className="text-green-400">{stripeMessage}</span>
            <button
              onClick={() => setStripeMessage(null)}
              className="ml-auto text-slate-400 hover:text-white"
            >
              &times;
            </button>
          </div>
        )}

        {/* Wallet Card */}
        <div className="mb-8">
          <WalletCard />
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
          <Card>
            <CardContent className="py-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 bg-accent-500/10 rounded-lg flex items-center justify-center">
                  <Video className="h-5 w-5 text-accent-500" />
                </div>
                <div>
                  <p className="text-slate-400 text-sm">Total Streams</p>
                  <p className="text-xl font-bold text-white">0</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="py-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 bg-purple-500/10 rounded-lg flex items-center justify-center">
                  <User className="h-5 w-5 text-purple-400" />
                </div>
                <div>
                  <p className="text-slate-400 text-sm">Total Views</p>
                  <p className="text-xl font-bold text-white">0</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            <Tabs defaultValue="streams" className="w-full">
              <TabsList className="grid w-full grid-cols-3 mb-4">
                <TabsTrigger value="streams" className="flex items-center gap-2">
                  <Video className="h-4 w-4" />
                  Streams
                </TabsTrigger>
                <TabsTrigger value="subscriptions" className="flex items-center gap-2">
                  <Crown className="h-4 w-4" />
                  Subscriptions
                </TabsTrigger>
                <TabsTrigger value="transactions" className="flex items-center gap-2">
                  <ShoppingBag className="h-4 w-4" />
                  Transactions
                </TabsTrigger>
              </TabsList>

              <TabsContent value="streams">
                {/* Recent Streams */}
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <h2 className="text-lg font-semibold text-white">Your Streams</h2>
                      <Link to="/stream/new">
                        <Button size="sm">Go Live</Button>
                      </Link>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="text-center py-8">
                      <Video className="h-12 w-12 text-slate-600 mx-auto mb-3" />
                      <p className="text-slate-400 mb-4">You haven't streamed yet</p>
                      <Link to="/stream/new">
                        <Button variant="secondary">Start Your First Stream</Button>
                      </Link>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="subscriptions">
                {/* Subscription Tier Management for Creators */}
                <TierManagement creatorId={user.id} />
              </TabsContent>

              <TabsContent value="transactions">
                {/* Transaction History */}
                <TransactionList limit={10} />
              </TabsContent>
            </Tabs>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Quick Actions */}
            <Card>
              <CardHeader>
                <h2 className="text-lg font-semibold text-white">Quick Actions</h2>
              </CardHeader>
              <CardContent className="space-y-2">
                <Link
                  to="/stream/new"
                  className="flex items-center gap-3 p-3 rounded-lg hover:bg-slate-700/50 transition-colors"
                >
                  <Video className="h-5 w-5 text-accent-500" />
                  <span className="text-white">Go Live</span>
                </Link>
                <Link
                  to="/shop"
                  className="flex items-center gap-3 p-3 rounded-lg hover:bg-slate-700/50 transition-colors"
                >
                  <ShoppingBag className="h-5 w-5 text-purple-400" />
                  <span className="text-white">Browse Shop</span>
                </Link>
                <Link
                  to="/inventory"
                  className="flex items-center gap-3 p-3 rounded-lg hover:bg-slate-700/50 transition-colors"
                >
                  <Package className="h-5 w-5 text-blue-400" />
                  <span className="text-white">My Inventory</span>
                </Link>
                <Link
                  to="/settings"
                  className="flex items-center gap-3 p-3 rounded-lg hover:bg-slate-700/50 transition-colors"
                >
                  <Settings className="h-5 w-5 text-slate-400" />
                  <span className="text-white">Settings</span>
                </Link>
              </CardContent>
            </Card>

            {/* Payout Settings */}
            <PayoutSettings />
          </div>
        </div>
      </div>

      {/* Followers/Following Modal */}
      <Dialog open={showFollowersModal} onOpenChange={setShowFollowersModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              <div className="flex gap-4 border-b border-slate-700 -mx-6 px-6 pb-4">
                <button
                  onClick={() => setFollowersTab('followers')}
                  className={`pb-2 font-medium transition-colors ${
                    followersTab === 'followers'
                      ? 'text-white border-b-2 border-primary-500'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Followers
                </button>
                <button
                  onClick={() => setFollowersTab('following')}
                  className={`pb-2 font-medium transition-colors ${
                    followersTab === 'following'
                      ? 'text-white border-b-2 border-primary-500'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Following
                </button>
              </div>
            </DialogTitle>
          </DialogHeader>
          <div className="max-h-96 overflow-y-auto">
            <FollowersList
              userId={user.id}
              type={followersTab}
              currentUserId={user.id}
            />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
