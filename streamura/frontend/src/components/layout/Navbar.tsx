import { Link, useNavigate } from 'react-router-dom';
import { Radio, Search, User, LogOut, Menu, X, ShoppingBag, Package } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/stores/authStore';
import { Button } from '@/components/ui/Button';
import { LanguageSelector } from '@/components/common/LanguageSelector';
import { NotificationBell } from '@/components/notifications';

export function Navbar() {
  const { user, isAuthenticated, logout } = useAuthStore();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const [searchQuery, setSearchQuery] = useState('');
  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const q = searchQuery.trim();
    if (q.length === 0) return;
    navigate(`/discover?q=${encodeURIComponent(q)}`);
    setMobileMenuOpen(false);
  };

  return (
    <nav className="bg-slate-900/95 backdrop-blur-sm border-b border-slate-800 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2 text-white">
            <Radio className="h-8 w-8 text-primary-500" />
            <span className="text-xl font-bold">Streamura</span>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-6">
            <Link
              to="/discover"
              className="text-slate-300 hover:text-white transition-colors"
            >
              {t('nav.explore')}
            </Link>
            <Link
              to="/trending"
              className="text-slate-300 hover:text-white transition-colors"
            >
              Trending
            </Link>
            <Link
              to="/nearby"
              className="text-slate-300 hover:text-white transition-colors"
            >
              Nearby
            </Link>
            <Link
              to="/shop"
              className="text-slate-300 hover:text-white transition-colors flex items-center gap-1"
            >
              <ShoppingBag className="h-4 w-4" />
              Shop
            </Link>
          </div>

          {/* Search Bar */}
          <form onSubmit={handleSearchSubmit} className="hidden md:flex flex-1 max-w-md mx-8" role="search">
            <div className="relative w-full">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search events, streams..."
                aria-label="Search events, streams"
                className="w-full pl-10 pr-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
            </div>
          </form>

          {/* Right Side */}
          <div className="hidden md:flex items-center gap-4">
            <LanguageSelector />
            {isAuthenticated ? (
              <>
                <Link
                  to="/stream/new"
                  className="bg-accent-500 hover:bg-accent-600 text-white px-4 py-2 rounded-lg font-medium transition-colors"
                >
                  {t('nav.goLive')}
                </Link>
                <NotificationBell />
                <div className="flex items-center gap-3">
                  <Link
                    to="/profile"
                    className="flex items-center gap-2 text-slate-300 hover:text-white transition-colors"
                  >
                    <div className="h-8 w-8 bg-slate-700 rounded-full flex items-center justify-center">
                      <User className="h-4 w-4" />
                    </div>
                    <span className="text-sm">{user?.username || t('nav.profile')}</span>
                  </Link>
                  <button
                    onClick={handleLogout}
                    className="p-2 text-slate-400 hover:text-white transition-colors"
                  >
                    <LogOut className="h-5 w-5" />
                  </button>
                </div>
              </>
            ) : (
              <div className="flex items-center gap-3">
                <Link to="/login">
                  <Button variant="ghost">{t('nav.login')}</Button>
                </Link>
                <Link to="/register">
                  <Button variant="primary">{t('nav.register')}</Button>
                </Link>
              </div>
            )}
          </div>

          {/* Mobile menu button */}
          <button
            className="md:hidden p-2 text-slate-300"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-slate-800">
          <div className="px-4 py-4 space-y-4">
            <form onSubmit={handleSearchSubmit} className="relative" role="search">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search events, streams..."
                aria-label="Search events, streams"
                className="w-full pl-10 pr-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-400"
              />
            </form>
            <div className="flex flex-col gap-2">
              <Link
                to="/discover"
                className="px-3 py-2 text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg"
              >
                Discover
              </Link>
              <Link
                to="/trending"
                className="px-3 py-2 text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg"
              >
                Trending
              </Link>
              <Link
                to="/nearby"
                className="px-3 py-2 text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg"
              >
                Nearby
              </Link>
              <Link
                to="/shop"
                className="px-3 py-2 text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg flex items-center gap-2"
              >
                <ShoppingBag className="h-4 w-4" />
                Shop
              </Link>
            </div>
            {isAuthenticated ? (
              <>
                <Link
                  to="/stream/new"
                  className="block w-full bg-accent-500 hover:bg-accent-600 text-white px-4 py-2 rounded-lg font-medium text-center"
                >
                  Go Live
                </Link>
                <Link
                  to="/inventory"
                  className="px-3 py-2 text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg flex items-center gap-2"
                >
                  <Package className="h-4 w-4" />
                  My Inventory
                </Link>
                <button
                  onClick={handleLogout}
                  className="w-full px-3 py-2 text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg text-left"
                >
                  Sign Out
                </button>
              </>
            ) : (
              <div className="flex flex-col gap-2">
                <Link to="/login">
                  <Button variant="ghost" className="w-full">Sign In</Button>
                </Link>
                <Link to="/register">
                  <Button variant="primary" className="w-full">Get Started</Button>
                </Link>
              </div>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}
