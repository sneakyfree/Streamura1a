import { Link, Navigate } from 'react-router-dom';
import { Package, ShoppingBag, ArrowLeft } from 'lucide-react';
import { InventoryGrid } from '@/components/shop/InventoryGrid';
import { Button } from '@/components/ui/Button';
import { useAuthStore } from '@/stores/authStore';

export function InventoryPage() {
  const { isAuthenticated, isLoading } = useAuthStore();

  // Show loading state while checking auth
  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  // Redirect to login if not authenticated
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-card border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-3">
              <Package className="h-8 w-8 text-primary" />
              <div>
                <h1 className="text-2xl font-bold">My Inventory</h1>
                <p className="text-muted-foreground">
                  Manage your badges, emotes, effects, and stickers
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <Link to="/shop">
                <Button variant="outline">
                  <ShoppingBag className="h-4 w-4 mr-2" />
                  Browse Shop
                </Button>
              </Link>
              <Link to="/profile">
                <Button variant="ghost">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Profile
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <InventoryGrid />
      </div>
    </div>
  );
}

export default InventoryPage;
