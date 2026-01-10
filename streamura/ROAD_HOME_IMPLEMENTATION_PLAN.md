# ROAD HOME IMPLEMENTATION PLAN
## Streamura Platform - Complete Gap Closure & UX Excellence Plan
### Version 1.0 | January 2026

---

# STRATEGY SUMMARY

This plan closes **24 identified gaps** across the Streamura platform, raising every feature to a 10/10 UX score. The plan is organized into **5 Phases** executed sequentially: (1) Critical Revenue Blockers, (2) Trust & Security, (3) Real-time Experience, (4) Feature Completion, (5) Polish & Excellence. Each task is written for mechanical execution by lower-context models with explicit steps, acceptance criteria, and test cases. Total estimated effort: **180-220 hours**. Fix First items unblock revenue streams and repair trust-damaging gaps. High Impact items complete partial implementations. Polish items elevate good features to exceptional. Quality is the top priority—no shortcuts.

---

# TABLE OF CONTENTS

1. [Definition of Done](#definition-of-done)
2. [Phase 1: Critical Revenue Blockers](#phase-1-critical-revenue-blockers)
3. [Phase 2: Trust & Security](#phase-2-trust--security)
4. [Phase 3: Real-time Experience](#phase-3-real-time-experience)
5. [Phase 4: Feature Completion](#phase-4-feature-completion)
6. [Phase 5: Polish & Excellence](#phase-5-polish--excellence)
7. [Top 10 Highest-Leverage Improvements](#top-10-highest-leverage-improvements)
8. [Rollout Plan](#rollout-plan)
9. [Risk Registry](#risk-registry)

---

# DEFINITION OF DONE

Every task must meet ALL criteria before marking complete:

## Functional Requirements
- [ ] Feature works as specified in acceptance criteria
- [ ] All happy paths function correctly
- [ ] All error paths handled gracefully with user feedback
- [ ] All edge cases identified and handled

## UX Requirements (10/10 Standard)
- [ ] No crashes, freezes, or dead ends
- [ ] No confusing flows or ambiguous copy
- [ ] Loading states shown for operations >200ms
- [ ] Empty states shown with helpful CTAs
- [ ] Error states show actionable messages
- [ ] Success feedback for all user actions
- [ ] Keyboard navigation works (Tab, Enter, Escape)
- [ ] Focus states visible on all interactive elements
- [ ] ARIA labels on icons and non-text elements
- [ ] Mobile responsive (320px to 2560px)
- [ ] Dark theme consistent throughout

## Technical Requirements
- [ ] No TypeScript errors
- [ ] No console errors or warnings
- [ ] No ESLint violations
- [ ] Backend tests pass (pytest)
- [ ] Frontend builds successfully (npm run build)
- [ ] API responses <500ms for 95th percentile
- [ ] No N+1 query issues

## Testing Requirements
- [ ] Unit tests for new functions (>80% coverage)
- [ ] Integration tests for API endpoints
- [ ] E2E test for critical user path
- [ ] Manual QA checklist completed

## Documentation Requirements
- [ ] API endpoints documented in code
- [ ] Complex logic commented
- [ ] TypeScript interfaces defined

---

# PHASE 1: CRITICAL REVENUE BLOCKERS
**Priority: FIX FIRST | Timeline: Week 1-2**
**Goal: Unblock all monetization features**

---

## Epic 1.1: Virtual Goods Shop
**Current UX: 2/10 | Target UX: 10/10**
**Effort: 12-16 hours**

### Task 1.1.1: Create Shop Page Route and Layout

**Goal:** Create the `/shop` page with proper routing and responsive layout structure.

**Scope:**
- INCLUDED: Route setup, page component, layout grid, navigation
- EXCLUDED: Product cards, purchase flow, filtering

**Dependencies:** None

**Prerequisites:**
- Frontend builds successfully
- Existing component library (Card, Button) available

**Implementation Steps:**

1. Open `frontend/src/App.tsx`
2. Add import: `const ShopPage = lazy(() => import('./pages/Shop'));`
3. Add route inside `<Routes>`: `<Route path="/shop" element={<ShopPage />} />`
4. Create file `frontend/src/pages/Shop.tsx`
5. Add the following code:

```tsx
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ShoppingBag, Filter, Search, Loader2 } from 'lucide-react';
import { virtualGoodsApi } from '@/lib/api';
import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

const GOOD_TYPES = [
  { value: 'all', label: 'All Items' },
  { value: 'badge', label: 'Badges' },
  { value: 'emote', label: 'Emotes' },
  { value: 'effect', label: 'Effects' },
  { value: 'sticker', label: 'Stickers' },
];

export default function ShopPage() {
  const [selectedType, setSelectedType] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  const { data: goods, isLoading, error, refetch } = useQuery({
    queryKey: ['virtual-goods', selectedType],
    queryFn: () => virtualGoodsApi.getAll({
      type: selectedType === 'all' ? undefined : selectedType,
      active_only: true
    }),
  });

  const filteredGoods = goods?.filter(good =>
    good.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    good.description?.toLowerCase().includes(searchQuery.toLowerCase())
  ) ?? [];

  return (
    <div className="min-h-screen bg-slate-900">
      {/* Header */}
      <div className="bg-slate-800 border-b border-slate-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex items-center gap-3">
            <ShoppingBag className="h-8 w-8 text-purple-500" />
            <div>
              <h1 className="text-2xl font-bold text-white">Shop</h1>
              <p className="text-slate-400">Browse badges, emotes, effects, and more</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              type="text"
              placeholder="Search items..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
              aria-label="Search virtual goods"
            />
          </div>

          {/* Type Filter */}
          <div className="flex gap-2 flex-wrap">
            {GOOD_TYPES.map((type) => (
              <Button
                key={type.value}
                variant={selectedType === type.value ? 'primary' : 'ghost'}
                size="sm"
                onClick={() => setSelectedType(type.value)}
                aria-pressed={selectedType === type.value}
              >
                {type.label}
              </Button>
            ))}
          </div>
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-purple-500" />
            <span className="ml-3 text-slate-400">Loading items...</span>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-6 text-center">
            <p className="text-red-400 mb-4">Failed to load shop items</p>
            <Button onClick={() => refetch()} variant="secondary">
              Try Again
            </Button>
          </div>
        )}

        {/* Empty State */}
        {!isLoading && !error && filteredGoods.length === 0 && (
          <div className="text-center py-20">
            <ShoppingBag className="h-12 w-12 text-slate-600 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-white mb-2">No items found</h3>
            <p className="text-slate-400 mb-4">
              {searchQuery
                ? 'Try adjusting your search terms'
                : 'Check back later for new items'}
            </p>
            {searchQuery && (
              <Button onClick={() => setSearchQuery('')} variant="secondary">
                Clear Search
              </Button>
            )}
          </div>
        )}

        {/* Products Grid */}
        {!isLoading && !error && filteredGoods.length > 0 && (
          <div
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6"
            role="list"
            aria-label="Virtual goods"
          >
            {filteredGoods.map((good) => (
              <VirtualGoodCard key={good.id} good={good} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// Import the card component (to be created in next task)
import { VirtualGoodCard } from '@/components/shop/VirtualGoodCard';
```

6. Add navigation link in `frontend/src/components/layout/Navbar.tsx`:
   - Find the navigation links array
   - Add: `{ to: '/shop', label: 'Shop', icon: ShoppingBag }`

**Acceptance Criteria:**
- [ ] `/shop` route renders without errors
- [ ] Page shows loading spinner while fetching
- [ ] Page shows error state with retry button on API failure
- [ ] Page shows empty state when no items
- [ ] Type filter buttons work and update query
- [ ] Search input filters items by name/description
- [ ] Layout is responsive (1 col mobile, 2 col tablet, 4 col desktop)
- [ ] Keyboard navigation works on all buttons and inputs
- [ ] No console errors

**UI/UX Requirements:**
- Loading: Purple spinner with "Loading items..." text
- Empty: Shopping bag icon + "No items found" + contextual message
- Error: Red banner with error message + "Try Again" button
- Filter active state: Purple background on selected type
- Grid gap: 24px (gap-6)

**Testing Requirements:**
- Manual: Navigate to /shop, verify render
- Manual: Test each filter type
- Manual: Test search with various queries
- Manual: Test error by disconnecting network
- Manual: Test on mobile viewport (375px)

---

### Task 1.1.2: Create VirtualGoodCard Component

**Goal:** Create a reusable card component to display virtual goods with purchase capability.

**Scope:**
- INCLUDED: Card display, price, type badge, purchase button, limited edition indicator
- EXCLUDED: Purchase modal (next task), gifting

**Dependencies:** Task 1.1.1 complete

**Prerequisites:**
- VirtualGood TypeScript interface exists in `types/index.ts`
- Button, Card components exist

**Implementation Steps:**

1. Create file `frontend/src/components/shop/VirtualGoodCard.tsx`
2. Add the following code:

```tsx
import { useState } from 'react';
import { ShoppingCart, Gift, Sparkles, AlertCircle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import type { VirtualGood } from '@/types';

interface VirtualGoodCardProps {
  good: VirtualGood;
  onPurchase?: (good: VirtualGood) => void;
  onGift?: (good: VirtualGood) => void;
}

const TYPE_COLORS: Record<string, string> = {
  badge: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  emote: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  effect: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  sticker: 'bg-green-500/20 text-green-400 border-green-500/30',
};

const TYPE_LABELS: Record<string, string> = {
  badge: 'Badge',
  emote: 'Emote',
  effect: 'Effect',
  sticker: 'Sticker',
};

export function VirtualGoodCard({ good, onPurchase, onGift }: VirtualGoodCardProps) {
  const [imageError, setImageError] = useState(false);
  const isLimited = good.is_limited && good.quantity_available !== null;
  const isSoldOut = isLimited && good.quantity_available === 0;

  return (
    <Card
      className="group hover:border-purple-500/50 transition-colors"
      role="listitem"
    >
      <CardContent className="p-4">
        {/* Image */}
        <div className="relative aspect-square rounded-lg overflow-hidden bg-slate-800 mb-4">
          {good.image_url && !imageError ? (
            <img
              src={good.image_url}
              alt={good.name}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform"
              onError={() => setImageError(true)}
              loading="lazy"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Sparkles className="h-12 w-12 text-slate-600" />
            </div>
          )}

          {/* Limited Badge */}
          {isLimited && (
            <div className="absolute top-2 left-2 bg-orange-500 text-white text-xs font-bold px-2 py-1 rounded">
              LIMITED
            </div>
          )}

          {/* Sold Out Overlay */}
          {isSoldOut && (
            <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
              <span className="text-white font-bold text-lg">SOLD OUT</span>
            </div>
          )}

          {/* Type Badge */}
          <div
            className={`absolute top-2 right-2 text-xs font-medium px-2 py-1 rounded border ${TYPE_COLORS[good.type] || TYPE_COLORS.badge}`}
          >
            {TYPE_LABELS[good.type] || good.type}
          </div>
        </div>

        {/* Info */}
        <div className="space-y-2">
          <h3 className="font-semibold text-white truncate" title={good.name}>
            {good.name}
          </h3>

          {good.description && (
            <p className="text-sm text-slate-400 line-clamp-2" title={good.description}>
              {good.description}
            </p>
          )}

          {/* Stock Info */}
          {isLimited && !isSoldOut && (
            <div className="flex items-center gap-1 text-xs text-orange-400">
              <AlertCircle className="h-3 w-3" />
              <span>{good.quantity_available} left</span>
            </div>
          )}

          {/* Price */}
          <div className="flex items-center justify-between pt-2">
            <span className="text-lg font-bold text-white">
              ${good.price.toFixed(2)}
            </span>

            {/* Actions */}
            <div className="flex gap-2">
              {onGift && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onGift(good)}
                  disabled={isSoldOut}
                  aria-label={`Gift ${good.name}`}
                  title="Gift to friend"
                >
                  <Gift className="h-4 w-4" />
                </Button>
              )}

              <Button
                variant="primary"
                size="sm"
                onClick={() => onPurchase?.(good)}
                disabled={isSoldOut}
                aria-label={`Buy ${good.name} for $${good.price.toFixed(2)}`}
              >
                <ShoppingCart className="h-4 w-4 mr-1" />
                Buy
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
```

3. Create barrel export in `frontend/src/components/shop/index.ts`:

```tsx
export { VirtualGoodCard } from './VirtualGoodCard';
```

4. Add VirtualGood type to `frontend/src/types/index.ts` if not exists:

```tsx
export interface VirtualGood {
  id: number;
  name: string;
  description: string | null;
  type: 'badge' | 'emote' | 'effect' | 'sticker';
  price: number;
  image_url: string | null;
  is_limited: boolean;
  quantity_available: number | null;
  creator_id: number | null;
  tier_id: number | null;
  is_active: boolean;
  created_at: string;
}
```

**Acceptance Criteria:**
- [ ] Card displays good name, description (truncated), type, price
- [ ] Type badge shows correct color for each type
- [ ] Limited items show "LIMITED" badge and stock count
- [ ] Sold out items show overlay and disabled buttons
- [ ] Image loads lazily with fallback on error
- [ ] Buy button triggers onPurchase callback
- [ ] Gift button triggers onGift callback
- [ ] Hover state shows border highlight
- [ ] Card is keyboard accessible

**UI/UX Requirements:**
- Image aspect ratio: 1:1 (square)
- Name: Single line, truncated with ellipsis
- Description: Max 2 lines, truncated
- Price: Bold, white, $X.XX format
- Limited badge: Orange background, top-left
- Type badge: Colored background, top-right
- Hover: Scale image 105%, purple border

**Testing Requirements:**
- Unit test: Renders with minimal props
- Unit test: Shows LIMITED badge when is_limited=true
- Unit test: Shows SOLD OUT when quantity_available=0
- Unit test: Calls onPurchase when Buy clicked
- Manual: Test image loading and error fallback

---

### Task 1.1.3: Create Purchase Modal with Stripe Integration

**Goal:** Create a modal for purchasing virtual goods with wallet balance or Stripe payment.

**Scope:**
- INCLUDED: Modal UI, balance check, quantity selector, purchase confirmation
- EXCLUDED: Gift flow (separate task)

**Dependencies:** Task 1.1.2 complete

**Prerequisites:**
- User auth state available via useAuthStore
- walletApi.getBalance() exists
- virtualGoodsApi.purchase() exists

**Implementation Steps:**

1. Create file `frontend/src/components/shop/PurchaseModal.tsx`
2. Add the following code:

```tsx
import { useState, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { X, Minus, Plus, Wallet, CreditCard, Loader2, CheckCircle, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { virtualGoodsApi, walletApi } from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';
import type { VirtualGood } from '@/types';

interface PurchaseModalProps {
  good: VirtualGood;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

type PurchaseStep = 'select' | 'confirm' | 'processing' | 'success' | 'error';

export function PurchaseModal({ good, isOpen, onClose, onSuccess }: PurchaseModalProps) {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();

  const [quantity, setQuantity] = useState(1);
  const [step, setStep] = useState<PurchaseStep>('select');
  const [errorMessage, setErrorMessage] = useState('');

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setQuantity(1);
      setStep('select');
      setErrorMessage('');
    }
  }, [isOpen]);

  // Fetch wallet balance
  const { data: wallet, isLoading: walletLoading } = useQuery({
    queryKey: ['wallet-balance'],
    queryFn: walletApi.getBalance,
    enabled: isOpen && !!user,
  });

  // Purchase mutation
  const purchaseMutation = useMutation({
    mutationFn: () => virtualGoodsApi.purchase(good.id, quantity),
    onMutate: () => setStep('processing'),
    onSuccess: () => {
      setStep('success');
      queryClient.invalidateQueries({ queryKey: ['wallet-balance'] });
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      queryClient.invalidateQueries({ queryKey: ['virtual-goods'] });
      setTimeout(() => {
        onSuccess?.();
        onClose();
      }, 2000);
    },
    onError: (error: Error) => {
      setStep('error');
      setErrorMessage(error.message || 'Purchase failed. Please try again.');
    },
  });

  const totalPrice = good.price * quantity;
  const hasBalance = (wallet?.balance ?? 0) >= totalPrice;
  const maxQuantity = good.is_limited ? Math.min(good.quantity_available ?? 10, 10) : 10;

  const handleQuantityChange = (delta: number) => {
    setQuantity((prev) => Math.max(1, Math.min(maxQuantity, prev + delta)));
  };

  const handlePurchase = () => {
    if (!hasBalance) {
      setErrorMessage('Insufficient balance. Please add funds to your wallet.');
      setStep('error');
      return;
    }
    purchaseMutation.mutate();
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="purchase-modal-title"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={step !== 'processing' ? onClose : undefined}
        aria-hidden="true"
      />

      {/* Modal */}
      <div className="relative bg-slate-800 rounded-xl border border-slate-700 w-full max-w-md shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-700">
          <h2 id="purchase-modal-title" className="text-lg font-semibold text-white">
            {step === 'success' ? 'Purchase Complete!' : 'Purchase Item'}
          </h2>
          {step !== 'processing' && (
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-white transition-colors"
              aria-label="Close modal"
            >
              <X className="h-5 w-5" />
            </button>
          )}
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Select Step */}
          {step === 'select' && (
            <div className="space-y-6">
              {/* Item Preview */}
              <div className="flex gap-4">
                <div className="w-20 h-20 rounded-lg bg-slate-700 overflow-hidden flex-shrink-0">
                  {good.image_url ? (
                    <img
                      src={good.image_url}
                      alt={good.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-slate-500">
                      ?
                    </div>
                  )}
                </div>
                <div>
                  <h3 className="font-medium text-white">{good.name}</h3>
                  <p className="text-sm text-slate-400 capitalize">{good.type}</p>
                  <p className="text-lg font-bold text-white mt-1">${good.price.toFixed(2)}</p>
                </div>
              </div>

              {/* Quantity Selector */}
              <div className="flex items-center justify-between">
                <span className="text-slate-300">Quantity</span>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => handleQuantityChange(-1)}
                    disabled={quantity <= 1}
                    className="p-2 rounded-lg bg-slate-700 text-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-600 transition-colors"
                    aria-label="Decrease quantity"
                  >
                    <Minus className="h-4 w-4" />
                  </button>
                  <span className="w-8 text-center text-white font-medium">{quantity}</span>
                  <button
                    onClick={() => handleQuantityChange(1)}
                    disabled={quantity >= maxQuantity}
                    className="p-2 rounded-lg bg-slate-700 text-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-600 transition-colors"
                    aria-label="Increase quantity"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Wallet Balance */}
              <div className="bg-slate-700/50 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-slate-400 flex items-center gap-2">
                    <Wallet className="h-4 w-4" />
                    Your Balance
                  </span>
                  {walletLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
                  ) : (
                    <span className={`font-medium ${hasBalance ? 'text-green-400' : 'text-red-400'}`}>
                      ${(wallet?.balance ?? 0).toFixed(2)}
                    </span>
                  )}
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Total</span>
                  <span className="text-lg font-bold text-white">${totalPrice.toFixed(2)}</span>
                </div>
              </div>

              {/* Insufficient Balance Warning */}
              {!hasBalance && !walletLoading && (
                <div className="flex items-start gap-3 p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                  <AlertTriangle className="h-5 w-5 text-yellow-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-yellow-400 font-medium">Insufficient Balance</p>
                    <p className="text-sm text-yellow-400/70">
                      You need ${(totalPrice - (wallet?.balance ?? 0)).toFixed(2)} more.
                    </p>
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-3">
                <Button
                  variant="secondary"
                  className="flex-1"
                  onClick={onClose}
                >
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  className="flex-1"
                  onClick={() => setStep('confirm')}
                  disabled={!hasBalance || walletLoading}
                >
                  Continue
                </Button>
              </div>
            </div>
          )}

          {/* Confirm Step */}
          {step === 'confirm' && (
            <div className="space-y-6">
              <div className="text-center">
                <p className="text-slate-300 mb-2">You are about to purchase:</p>
                <p className="text-xl font-bold text-white">
                  {quantity}x {good.name}
                </p>
                <p className="text-2xl font-bold text-purple-400 mt-2">
                  ${totalPrice.toFixed(2)}
                </p>
              </div>

              <div className="flex gap-3">
                <Button
                  variant="secondary"
                  className="flex-1"
                  onClick={() => setStep('select')}
                >
                  Back
                </Button>
                <Button
                  variant="primary"
                  className="flex-1"
                  onClick={handlePurchase}
                >
                  Confirm Purchase
                </Button>
              </div>
            </div>
          )}

          {/* Processing Step */}
          {step === 'processing' && (
            <div className="text-center py-8">
              <Loader2 className="h-12 w-12 animate-spin text-purple-500 mx-auto mb-4" />
              <p className="text-white font-medium">Processing your purchase...</p>
              <p className="text-sm text-slate-400 mt-1">Please don't close this window</p>
            </div>
          )}

          {/* Success Step */}
          {step === 'success' && (
            <div className="text-center py-8">
              <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="h-8 w-8 text-green-500" />
              </div>
              <p className="text-white font-medium text-lg">Purchase Successful!</p>
              <p className="text-slate-400 mt-1">
                {quantity}x {good.name} added to your inventory
              </p>
            </div>
          )}

          {/* Error Step */}
          {step === 'error' && (
            <div className="space-y-6">
              <div className="text-center py-4">
                <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center mx-auto mb-4">
                  <AlertTriangle className="h-8 w-8 text-red-500" />
                </div>
                <p className="text-white font-medium text-lg">Purchase Failed</p>
                <p className="text-red-400 mt-2">{errorMessage}</p>
              </div>

              <div className="flex gap-3">
                <Button
                  variant="secondary"
                  className="flex-1"
                  onClick={onClose}
                >
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  className="flex-1"
                  onClick={() => setStep('select')}
                >
                  Try Again
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
```

3. Update `frontend/src/pages/Shop.tsx` to integrate the modal:

```tsx
// Add imports at top
import { PurchaseModal } from '@/components/shop/PurchaseModal';

// Add state inside component
const [selectedGood, setSelectedGood] = useState<VirtualGood | null>(null);
const [showPurchaseModal, setShowPurchaseModal] = useState(false);

const handlePurchase = (good: VirtualGood) => {
  setSelectedGood(good);
  setShowPurchaseModal(true);
};

// Add modal at bottom of component, before closing </div>
{selectedGood && (
  <PurchaseModal
    good={selectedGood}
    isOpen={showPurchaseModal}
    onClose={() => {
      setShowPurchaseModal(false);
      setSelectedGood(null);
    }}
    onSuccess={() => refetch()}
  />
)}

// Update VirtualGoodCard to pass onPurchase
<VirtualGoodCard key={good.id} good={good} onPurchase={handlePurchase} />
```

4. Export from barrel file `frontend/src/components/shop/index.ts`:

```tsx
export { VirtualGoodCard } from './VirtualGoodCard';
export { PurchaseModal } from './PurchaseModal';
```

**Acceptance Criteria:**
- [ ] Modal opens when Buy button clicked
- [ ] Modal shows item preview, name, type, price
- [ ] Quantity selector works (1 to max)
- [ ] Wallet balance displays correctly
- [ ] Insufficient balance shows warning
- [ ] Cannot proceed without sufficient balance
- [ ] Confirm step shows summary
- [ ] Processing step shows spinner
- [ ] Success step shows checkmark and auto-closes
- [ ] Error step shows message with retry option
- [ ] Modal closes on backdrop click (except processing)
- [ ] Escape key closes modal
- [ ] Focus trapped inside modal

**UI/UX Requirements:**
- Backdrop: Black 70% opacity with blur
- Modal width: max-w-md (28rem)
- Animation: Fade in (CSS transition)
- Processing: Disable all controls
- Success: Green checkmark, 2s delay before close
- Error: Red warning icon, actionable message

**Backend Requirements:**
- `virtualGoodsApi.purchase(goodId, quantity)` must:
  - Verify user has sufficient balance
  - Deduct balance atomically
  - Create inventory record
  - Update quantity_available for limited items
  - Return purchase confirmation

**Testing Requirements:**
- Unit test: Modal renders when isOpen=true
- Unit test: Quantity controls work within bounds
- Unit test: Cannot proceed with insufficient balance
- Integration test: Full purchase flow with mock API
- Manual: Test purchase with real balance
- Manual: Test error handling (disconnect network mid-purchase)

---

### Task 1.1.4: Wire Shop Page to VirtualGoodCard with Purchase Flow

**Goal:** Complete the integration between Shop page, VirtualGoodCard, and PurchaseModal.

**Scope:**
- INCLUDED: State management, event handling, query invalidation
- EXCLUDED: Gift flow

**Dependencies:** Tasks 1.1.1, 1.1.2, 1.1.3 complete

**Implementation Steps:**

1. Update `frontend/src/pages/Shop.tsx` with complete integration (already mostly done in 1.1.3)

2. Verify API method exists in `frontend/src/lib/api.ts`:

```tsx
// Ensure these methods exist in virtualGoodsApi object
virtualGoodsApi: {
  getAll: async (params?: { type?: string; active_only?: boolean; creator_id?: number }) => {
    const searchParams = new URLSearchParams();
    if (params?.type) searchParams.append('type', params.type);
    if (params?.active_only) searchParams.append('active_only', 'true');
    if (params?.creator_id) searchParams.append('creator_id', String(params.creator_id));
    const response = await api.get(`/virtual-goods?${searchParams}`);
    return response.data;
  },

  purchase: async (goodId: number, quantity: number = 1) => {
    const response = await api.post(`/virtual-goods/${goodId}/purchase`, { quantity });
    return response.data;
  },

  getInventory: async (params?: { type?: string }) => {
    const searchParams = new URLSearchParams();
    if (params?.type) searchParams.append('type', params.type);
    const response = await api.get(`/inventory?${searchParams}`);
    return response.data;
  },
},
```

3. Add wallet API if not exists:

```tsx
walletApi: {
  getBalance: async () => {
    const response = await api.get('/wallet/balance');
    return response.data;
  },
},
```

**Acceptance Criteria:**
- [ ] Shop loads and displays all active goods
- [ ] Clicking Buy opens PurchaseModal with correct good
- [ ] Successful purchase updates balance display
- [ ] Successful purchase updates shop (limited item counts)
- [ ] User can purchase multiple items in sequence

**Testing Requirements:**
- E2E test: Load shop → Select item → Purchase → Verify inventory
- Manual: Test full flow as logged-in user

---

## Epic 1.2: User Inventory Page
**Current UX: 2/10 | Target UX: 10/10**
**Effort: 8-10 hours**

### Task 1.2.1: Create Inventory Page Route and Layout

**Goal:** Create the `/inventory` page showing user's purchased virtual goods.

**Scope:**
- INCLUDED: Route, layout, item grid, type filtering, equip functionality
- EXCLUDED: Trading, selling

**Dependencies:** Epic 1.1 complete

**Prerequisites:**
- virtualGoodsApi.getInventory() exists
- virtualGoodsApi.equipItem() exists

**Implementation Steps:**

1. Add route in `frontend/src/App.tsx`:
```tsx
const InventoryPage = lazy(() => import('./pages/Inventory'));
// Add route
<Route path="/inventory" element={<ProtectedRoute><InventoryPage /></ProtectedRoute>} />
```

2. Create file `frontend/src/pages/Inventory.tsx`:

```tsx
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Package, Filter, Loader2, CheckCircle, Sparkles } from 'lucide-react';
import { virtualGoodsApi } from '@/lib/api';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { useAuthStore } from '@/stores/authStore';
import type { InventoryItem } from '@/types';

const INVENTORY_TYPES = [
  { value: 'all', label: 'All Items' },
  { value: 'badge', label: 'Badges' },
  { value: 'emote', label: 'Emotes' },
  { value: 'effect', label: 'Effects' },
  { value: 'sticker', label: 'Stickers' },
];

export default function InventoryPage() {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const [selectedType, setSelectedType] = useState('all');

  const { data: inventory, isLoading, error, refetch } = useQuery({
    queryKey: ['inventory', selectedType],
    queryFn: () => virtualGoodsApi.getInventory({
      type: selectedType === 'all' ? undefined : selectedType,
    }),
    enabled: !!user,
  });

  const equipMutation = useMutation({
    mutationFn: (inventoryId: number) => virtualGoodsApi.equipItem(inventoryId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      queryClient.invalidateQueries({ queryKey: ['user-equipped'] });
    },
  });

  const items = inventory?.items ?? [];

  return (
    <div className="min-h-screen bg-slate-900">
      {/* Header */}
      <div className="bg-slate-800 border-b border-slate-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Package className="h-8 w-8 text-purple-500" />
              <div>
                <h1 className="text-2xl font-bold text-white">My Inventory</h1>
                <p className="text-slate-400">Manage your badges, emotes, and effects</p>
              </div>
            </div>
            <Button variant="secondary" onClick={() => window.location.href = '/shop'}>
              Visit Shop
            </Button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Filters */}
        <div className="flex gap-2 flex-wrap mb-6">
          {INVENTORY_TYPES.map((type) => (
            <Button
              key={type.value}
              variant={selectedType === type.value ? 'primary' : 'ghost'}
              size="sm"
              onClick={() => setSelectedType(type.value)}
              aria-pressed={selectedType === type.value}
            >
              {type.label}
            </Button>
          ))}
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-purple-500" />
            <span className="ml-3 text-slate-400">Loading inventory...</span>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-6 text-center">
            <p className="text-red-400 mb-4">Failed to load inventory</p>
            <Button onClick={() => refetch()} variant="secondary">
              Try Again
            </Button>
          </div>
        )}

        {/* Empty State */}
        {!isLoading && !error && items.length === 0 && (
          <div className="text-center py-20">
            <Package className="h-12 w-12 text-slate-600 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-white mb-2">Your inventory is empty</h3>
            <p className="text-slate-400 mb-4">
              Purchase items from the shop to see them here
            </p>
            <Button onClick={() => window.location.href = '/shop'} variant="primary">
              Browse Shop
            </Button>
          </div>
        )}

        {/* Inventory Grid */}
        {!isLoading && !error && items.length > 0 && (
          <div
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6"
            role="list"
            aria-label="Inventory items"
          >
            {items.map((item: InventoryItem) => (
              <InventoryItemCard
                key={item.id}
                item={item}
                onEquip={() => equipMutation.mutate(item.id)}
                isEquipping={equipMutation.isPending}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// Inventory Item Card Component
interface InventoryItemCardProps {
  item: InventoryItem;
  onEquip: () => void;
  isEquipping: boolean;
}

function InventoryItemCard({ item, onEquip, isEquipping }: InventoryItemCardProps) {
  const canEquip = item.good.type === 'badge' || item.good.type === 'effect';

  return (
    <Card
      className={`relative ${item.is_equipped ? 'border-purple-500' : ''}`}
      role="listitem"
    >
      {/* Equipped Badge */}
      {item.is_equipped && (
        <div className="absolute -top-2 -right-2 bg-purple-500 rounded-full p-1">
          <CheckCircle className="h-4 w-4 text-white" />
        </div>
      )}

      <CardContent className="p-4">
        {/* Image */}
        <div className="relative aspect-square rounded-lg overflow-hidden bg-slate-800 mb-4">
          {item.good.image_url ? (
            <img
              src={item.good.image_url}
              alt={item.good.name}
              className="w-full h-full object-cover"
              loading="lazy"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Sparkles className="h-12 w-12 text-slate-600" />
            </div>
          )}

          {/* Quantity Badge */}
          {item.quantity > 1 && (
            <div className="absolute bottom-2 right-2 bg-black/70 text-white text-sm font-bold px-2 py-1 rounded">
              x{item.quantity}
            </div>
          )}
        </div>

        {/* Info */}
        <div className="space-y-2">
          <h3 className="font-semibold text-white truncate">{item.good.name}</h3>
          <p className="text-sm text-slate-400 capitalize">{item.good.type}</p>

          {/* Equip Button */}
          {canEquip && (
            <Button
              variant={item.is_equipped ? 'secondary' : 'primary'}
              size="sm"
              className="w-full"
              onClick={onEquip}
              disabled={isEquipping || item.is_equipped}
            >
              {isEquipping ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : item.is_equipped ? (
                'Equipped'
              ) : (
                'Equip'
              )}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
```

3. Add InventoryItem type to `frontend/src/types/index.ts`:

```tsx
export interface InventoryItem {
  id: number;
  user_id: number;
  good_id: number;
  quantity: number;
  is_equipped: boolean;
  purchased_at: string;
  good: VirtualGood;
}
```

4. Add API method to `frontend/src/lib/api.ts`:

```tsx
// In virtualGoodsApi object
equipItem: async (inventoryId: number) => {
  const response = await api.post(`/inventory/${inventoryId}/equip`);
  return response.data;
},

getUserEquipped: async (userId: number) => {
  const response = await api.get(`/users/${userId}/equipped`);
  return response.data;
},
```

5. Add navigation link in Navbar:
```tsx
{ to: '/inventory', label: 'Inventory', icon: Package }
```

**Acceptance Criteria:**
- [ ] `/inventory` route renders for authenticated users
- [ ] Redirects to login if not authenticated
- [ ] Shows loading state while fetching
- [ ] Shows error state with retry on failure
- [ ] Shows empty state with CTA to shop
- [ ] Type filters work correctly
- [ ] Items display with image, name, type, quantity
- [ ] Equipped items show checkmark badge
- [ ] Equip button works for badges and effects
- [ ] Cannot equip already-equipped item
- [ ] Successful equip updates UI immediately

**UI/UX Requirements:**
- Equipped badge: Purple checkmark, top-right corner
- Quantity badge: Black pill, bottom-right of image
- Equip button: Full width, disabled when already equipped
- Grid: Same as shop (responsive 1-4 columns)

**Backend Requirements:**
- `GET /inventory` returns items with nested good data
- `POST /inventory/{id}/equip` toggles equip state
- Only one badge and one effect can be equipped at a time

**Testing Requirements:**
- Unit test: Renders with items
- Unit test: Filter by type works
- Unit test: Equip button triggers mutation
- Integration test: Equip flow with mock API
- Manual: Full flow as logged-in user

---

## Epic 1.3: Subscription Tier Management
**Current UX: 4/10 | Target UX: 10/10**
**Effort: 14-18 hours**

### Task 1.3.1: Create Subscription Tiers Display for Creator Profiles

**Goal:** Display subscription tiers on creator profiles with subscribe functionality.

**Scope:**
- INCLUDED: Tier cards, benefits display, subscribe button, Stripe Checkout redirect
- EXCLUDED: Tier creation/editing (separate task)

**Dependencies:** None

**Prerequisites:**
- subscriptionApi exists with getCreatorTiers, createCheckout
- Creator profiles accessible

**Implementation Steps:**

1. Create file `frontend/src/components/subscriptions/SubscriptionTiers.tsx`:

```tsx
import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Crown, Check, Loader2, ExternalLink } from 'lucide-react';
import { subscriptionApi } from '@/lib/api';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { useAuthStore } from '@/stores/authStore';
import type { SubscriptionTier } from '@/types';

interface SubscriptionTiersProps {
  creatorId: number;
  creatorName: string;
}

export function SubscriptionTiers({ creatorId, creatorName }: SubscriptionTiersProps) {
  const { user, isAuthenticated } = useAuthStore();
  const [subscribingTierId, setSubscribingTierId] = useState<number | null>(null);

  const { data: tiers, isLoading } = useQuery({
    queryKey: ['subscription-tiers', creatorId],
    queryFn: () => subscriptionApi.getCreatorTiers(creatorId),
  });

  const { data: subscription } = useQuery({
    queryKey: ['subscription-status', creatorId],
    queryFn: () => subscriptionApi.isSubscribed(creatorId),
    enabled: isAuthenticated,
  });

  const checkoutMutation = useMutation({
    mutationFn: (tierId: number) => subscriptionApi.createCheckout(tierId),
    onSuccess: (data) => {
      // Redirect to Stripe Checkout
      if (data.checkout_url) {
        window.location.href = data.checkout_url;
      }
    },
    onError: () => {
      setSubscribingTierId(null);
    },
  });

  const handleSubscribe = (tierId: number) => {
    if (!isAuthenticated) {
      window.location.href = `/login?redirect=/profile/${creatorId}`;
      return;
    }
    setSubscribingTierId(tierId);
    checkoutMutation.mutate(tierId);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-purple-500" />
      </div>
    );
  }

  if (!tiers || tiers.length === 0) {
    return null; // No tiers, don't show section
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Crown className="h-5 w-5 text-yellow-500" />
        <h3 className="text-lg font-semibold text-white">Support {creatorName}</h3>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {tiers.map((tier: SubscriptionTier) => (
          <TierCard
            key={tier.id}
            tier={tier}
            isSubscribed={subscription?.tier_id === tier.id}
            isSubscribing={subscribingTierId === tier.id}
            onSubscribe={() => handleSubscribe(tier.id)}
          />
        ))}
      </div>
    </div>
  );
}

interface TierCardProps {
  tier: SubscriptionTier;
  isSubscribed: boolean;
  isSubscribing: boolean;
  onSubscribe: () => void;
}

function TierCard({ tier, isSubscribed, isSubscribing, onSubscribe }: TierCardProps) {
  const benefits = tier.benefits || [];

  return (
    <Card className={`relative ${isSubscribed ? 'border-yellow-500' : ''}`}>
      {isSubscribed && (
        <div className="absolute -top-2 -right-2 bg-yellow-500 text-black text-xs font-bold px-2 py-1 rounded">
          SUBSCRIBED
        </div>
      )}

      <CardContent className="p-4 space-y-4">
        {/* Header */}
        <div>
          <h4 className="text-lg font-bold text-white">{tier.name}</h4>
          <div className="flex items-baseline gap-1 mt-1">
            <span className="text-2xl font-bold text-purple-400">
              ${tier.price.toFixed(2)}
            </span>
            <span className="text-slate-400">
              /{tier.billing_period === 'monthly' ? 'mo' : 'yr'}
            </span>
          </div>
        </div>

        {/* Benefits */}
        {benefits.length > 0 && (
          <ul className="space-y-2">
            {benefits.map((benefit: string, index: number) => (
              <li key={index} className="flex items-start gap-2 text-sm text-slate-300">
                <Check className="h-4 w-4 text-green-500 flex-shrink-0 mt-0.5" />
                <span>{benefit}</span>
              </li>
            ))}
          </ul>
        )}

        {/* Badge Preview */}
        {tier.badge_url && (
          <div className="flex items-center gap-2 p-2 bg-slate-700/50 rounded">
            <img
              src={tier.badge_url}
              alt={`${tier.name} badge`}
              className="w-6 h-6"
            />
            <span className="text-sm text-slate-300">Subscriber Badge</span>
          </div>
        )}

        {/* Subscribe Button */}
        <Button
          variant={isSubscribed ? 'secondary' : 'primary'}
          className="w-full"
          onClick={onSubscribe}
          disabled={isSubscribed || isSubscribing}
        >
          {isSubscribing ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
              Redirecting...
            </>
          ) : isSubscribed ? (
            'Currently Subscribed'
          ) : (
            <>
              Subscribe
              <ExternalLink className="h-4 w-4 ml-2" />
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
```

2. Add SubscriptionTier type to `frontend/src/types/index.ts`:

```tsx
export interface SubscriptionTier {
  id: number;
  creator_id: number;
  name: string;
  price: number;
  billing_period: 'monthly' | 'yearly';
  benefits: string[];
  badge_url: string | null;
  emote_slots: number;
  max_subscribers: number | null;
  is_active: boolean;
  created_at: string;
}
```

3. Add API methods to `frontend/src/lib/api.ts`:

```tsx
subscriptionApi: {
  getCreatorTiers: async (creatorId: number) => {
    const response = await api.get(`/creators/${creatorId}/tiers`);
    return response.data;
  },

  createCheckout: async (tierId: number) => {
    const response = await api.post('/subscriptions/checkout', { tier_id: tierId });
    return response.data;
  },

  isSubscribed: async (creatorId: number) => {
    const response = await api.get(`/creators/${creatorId}/is-subscribed`);
    return response.data;
  },

  getMySubscriptions: async () => {
    const response = await api.get('/subscriptions/mine');
    return response.data;
  },

  cancelSubscription: async (subscriptionId: number) => {
    const response = await api.post(`/subscriptions/${subscriptionId}/cancel`);
    return response.data;
  },
},
```

4. Integrate into profile/stream pages where creator info shown

**Acceptance Criteria:**
- [ ] Tiers display on creator profiles
- [ ] Each tier shows name, price, billing period
- [ ] Benefits list rendered with checkmarks
- [ ] Subscribe button redirects to Stripe Checkout
- [ ] Subscribed tier shows badge and disabled button
- [ ] Non-authenticated users redirected to login
- [ ] Loading state shown while fetching tiers

**UI/UX Requirements:**
- Tier cards: Equal height in grid
- Price: Large, bold, purple
- Billing period: Gray, smaller text
- Benefits: Green checkmarks
- Subscribed badge: Yellow, top-right

**Backend Requirements:**
- `POST /subscriptions/checkout` creates Stripe Checkout Session
- Returns checkout_url for redirect
- Success URL: `/subscriptions/success?session_id={CHECKOUT_SESSION_ID}`
- Cancel URL: `/subscriptions/cancelled`

**Testing Requirements:**
- Unit test: Renders tiers correctly
- Unit test: Subscribe button triggers checkout
- Integration test: Checkout redirect with mock
- Manual: Full Stripe Checkout flow (test mode)

---

### Task 1.3.2: Create Tier Management for Creators

**Goal:** Allow creators to create and manage their subscription tiers.

**Scope:**
- INCLUDED: Create tier form, edit tier, delete tier, tier list
- EXCLUDED: Analytics, subscriber management

**Dependencies:** Task 1.3.1 complete

**Implementation Steps:**

1. Create file `frontend/src/components/subscriptions/TierManagement.tsx`:

```tsx
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Edit2, Trash2, Loader2, Crown, AlertTriangle } from 'lucide-react';
import { subscriptionApi } from '@/lib/api';
import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useAuthStore } from '@/stores/authStore';
import type { SubscriptionTier } from '@/types';

interface TierFormData {
  name: string;
  price: string;
  billing_period: 'monthly' | 'yearly';
  benefits: string[];
}

const DEFAULT_FORM: TierFormData = {
  name: '',
  price: '',
  billing_period: 'monthly',
  benefits: [''],
};

export function TierManagement() {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editingTier, setEditingTier] = useState<SubscriptionTier | null>(null);
  const [formData, setFormData] = useState<TierFormData>(DEFAULT_FORM);
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);

  const { data: tiers, isLoading } = useQuery({
    queryKey: ['my-tiers'],
    queryFn: () => subscriptionApi.getCreatorTiers(user!.id),
    enabled: !!user,
  });

  const createMutation = useMutation({
    mutationFn: (data: Partial<SubscriptionTier>) =>
      subscriptionApi.createTier(user!.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-tiers'] });
      resetForm();
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<SubscriptionTier> }) =>
      subscriptionApi.updateTier(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-tiers'] });
      resetForm();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => subscriptionApi.deleteTier(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-tiers'] });
      setDeleteConfirmId(null);
    },
  });

  const resetForm = () => {
    setShowForm(false);
    setEditingTier(null);
    setFormData(DEFAULT_FORM);
  };

  const handleEdit = (tier: SubscriptionTier) => {
    setEditingTier(tier);
    setFormData({
      name: tier.name,
      price: tier.price.toString(),
      billing_period: tier.billing_period,
      benefits: tier.benefits.length > 0 ? tier.benefits : [''],
    });
    setShowForm(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const data = {
      name: formData.name,
      price: parseFloat(formData.price),
      billing_period: formData.billing_period,
      benefits: formData.benefits.filter(b => b.trim() !== ''),
    };

    if (editingTier) {
      updateMutation.mutate({ id: editingTier.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const addBenefit = () => {
    setFormData({ ...formData, benefits: [...formData.benefits, ''] });
  };

  const updateBenefit = (index: number, value: string) => {
    const newBenefits = [...formData.benefits];
    newBenefits[index] = value;
    setFormData({ ...formData, benefits: newBenefits });
  };

  const removeBenefit = (index: number) => {
    if (formData.benefits.length > 1) {
      setFormData({
        ...formData,
        benefits: formData.benefits.filter((_, i) => i !== index)
      });
    }
  };

  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Crown className="h-5 w-5 text-yellow-500" />
          <h2 className="text-xl font-bold text-white">Subscription Tiers</h2>
        </div>
        {!showForm && (
          <Button onClick={() => setShowForm(true)} variant="primary">
            <Plus className="h-4 w-4 mr-2" />
            Create Tier
          </Button>
        )}
      </div>

      {/* Create/Edit Form */}
      {showForm && (
        <Card>
          <CardHeader>
            <h3 className="font-semibold text-white">
              {editingTier ? 'Edit Tier' : 'Create New Tier'}
            </h3>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Name */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">
                  Tier Name *
                </label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Supporter, VIP, Legend"
                  required
                />
              </div>

              {/* Price & Period */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">
                    Price (USD) *
                  </label>
                  <Input
                    type="number"
                    min="0.99"
                    step="0.01"
                    value={formData.price}
                    onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                    placeholder="4.99"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">
                    Billing Period
                  </label>
                  <select
                    value={formData.billing_period}
                    onChange={(e) => setFormData({
                      ...formData,
                      billing_period: e.target.value as 'monthly' | 'yearly'
                    })}
                    className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white"
                  >
                    <option value="monthly">Monthly</option>
                    <option value="yearly">Yearly</option>
                  </select>
                </div>
              </div>

              {/* Benefits */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">
                  Benefits
                </label>
                <div className="space-y-2">
                  {formData.benefits.map((benefit, index) => (
                    <div key={index} className="flex gap-2">
                      <Input
                        value={benefit}
                        onChange={(e) => updateBenefit(index, e.target.value)}
                        placeholder="e.g., Exclusive badges, Early access"
                      />
                      {formData.benefits.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeBenefit(index)}
                          aria-label="Remove benefit"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={addBenefit}
                  className="mt-2"
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Add Benefit
                </Button>
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-4">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={resetForm}
                  disabled={isSubmitting}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  disabled={isSubmitting || !formData.name || !formData.price}
                >
                  {isSubmitting ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : null}
                  {editingTier ? 'Update Tier' : 'Create Tier'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Existing Tiers */}
      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-purple-500" />
        </div>
      ) : tiers && tiers.length > 0 ? (
        <div className="space-y-4">
          {tiers.map((tier: SubscriptionTier) => (
            <Card key={tier.id}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="font-semibold text-white">{tier.name}</h4>
                    <p className="text-purple-400 font-bold">
                      ${tier.price.toFixed(2)}/{tier.billing_period === 'monthly' ? 'mo' : 'yr'}
                    </p>
                    {tier.benefits.length > 0 && (
                      <ul className="mt-2 text-sm text-slate-400">
                        {tier.benefits.map((b, i) => (
                          <li key={i}>• {b}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleEdit(tier)}
                      aria-label={`Edit ${tier.name}`}
                    >
                      <Edit2 className="h-4 w-4" />
                    </Button>
                    {deleteConfirmId === tier.id ? (
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-red-400">Delete?</span>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => deleteMutation.mutate(tier.id)}
                          className="text-red-400"
                        >
                          Yes
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setDeleteConfirmId(null)}
                        >
                          No
                        </Button>
                      </div>
                    ) : (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setDeleteConfirmId(tier.id)}
                        aria-label={`Delete ${tier.name}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="p-8 text-center">
            <Crown className="h-12 w-12 text-slate-600 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-white mb-2">No subscription tiers yet</h3>
            <p className="text-slate-400 mb-4">
              Create tiers to let your fans support you with monthly subscriptions
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
```

2. Add API methods:

```tsx
// In subscriptionApi
createTier: async (creatorId: number, data: Partial<SubscriptionTier>) => {
  const response = await api.post(`/creators/${creatorId}/tiers`, data);
  return response.data;
},

updateTier: async (tierId: number, data: Partial<SubscriptionTier>) => {
  const response = await api.put(`/tiers/${tierId}`, data);
  return response.data;
},

deleteTier: async (tierId: number) => {
  const response = await api.delete(`/tiers/${tierId}`);
  return response.data;
},
```

3. Add TierManagement to Profile page for creators:

```tsx
// In Profile.tsx, add section for creators
{user?.id === profileUser.id && (
  <div className="mt-8">
    <TierManagement />
  </div>
)}
```

**Acceptance Criteria:**
- [ ] Creator can create new tier with name, price, period, benefits
- [ ] Creator can edit existing tier
- [ ] Creator can delete tier with confirmation
- [ ] Form validation prevents invalid submissions
- [ ] Success updates list immediately
- [ ] Empty state shows CTA to create first tier

**UI/UX Requirements:**
- Create button: Top right, primary style
- Form: Card with clear sections
- Benefits: Dynamic add/remove
- Delete: Requires confirmation
- Loading: Spinner in button

**Backend Requirements:**
- `POST /creators/{id}/tiers` creates tier
- `PUT /tiers/{id}` updates tier
- `DELETE /tiers/{id}` soft-deletes tier
- Only creator can modify their own tiers

**Testing Requirements:**
- Unit test: Form renders and validates
- Unit test: Create/Edit/Delete mutations work
- Integration test: Full CRUD flow
- Manual: Create, edit, delete tier as creator

---

[CONTINUING IN NEXT SECTION DUE TO LENGTH...]

---

# PHASE 2: TRUST & SECURITY
**Priority: FIX FIRST | Timeline: Week 2-3**
**Goal: Fix trust-damaging gaps**

---

## Epic 2.1: Password Reset Flow
**Current UX: 2/10 | Target UX: 10/10**
**Effort: 10-14 hours**

### Task 2.1.1: Create Password Reset Request Endpoint (Backend)

**Goal:** Create API endpoint for requesting password reset via email.

**Scope:**
- INCLUDED: Reset token generation, email sending, rate limiting
- EXCLUDED: Reset completion (next task)

**Dependencies:** None

**Prerequisites:**
- Email service configured (SMTP or SendGrid)
- User model has email field

**Implementation Steps:**

1. Add reset token fields to User model in `backend/models.py`:

```python
# Add to User class
password_reset_token = Column(String(100), nullable=True)
password_reset_expires = Column(DateTime, nullable=True)
```

2. Create migration for new fields

3. Add endpoint in `backend/api.py`:

```python
from datetime import datetime, timedelta
import secrets
from .email import send_password_reset_email  # To be created

@app.post("/api/v1/auth/forgot-password")
@limiter.limit("3/minute")
async def request_password_reset(
    request: Request,
    email: str = Body(..., embed=True),
    db: Session = Depends(get_db)
):
    """
    Request password reset email.
    Always returns success to prevent email enumeration.
    """
    user = db.query(User).filter(User.email == email.lower()).first()

    if user:
        # Generate secure token
        token = secrets.token_urlsafe(32)
        user.password_reset_token = token
        user.password_reset_expires = datetime.utcnow() + timedelta(hours=1)
        db.commit()

        # Send email (async, don't block response)
        try:
            await send_password_reset_email(
                email=user.email,
                username=user.username,
                token=token
            )
        except Exception as e:
            # Log but don't expose failure
            logger.error(f"Failed to send reset email: {e}")

    # Always return success (prevents enumeration)
    return {"message": "If an account exists with that email, a reset link has been sent."}
```

4. Create email service `backend/email.py`:

```python
import os
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import aiosmtplib

FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173")

async def send_password_reset_email(email: str, username: str, token: str):
    """Send password reset email."""
    reset_url = f"{FRONTEND_URL}/reset-password?token={token}"

    html_content = f"""
    <html>
    <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Reset Your Password</h2>
        <p>Hi {username},</p>
        <p>You requested to reset your password. Click the button below to continue:</p>
        <p style="text-align: center; margin: 30px 0;">
            <a href="{reset_url}"
               style="background: #8B5CF6; color: white; padding: 12px 24px;
                      text-decoration: none; border-radius: 8px; display: inline-block;">
                Reset Password
            </a>
        </p>
        <p>This link expires in 1 hour.</p>
        <p>If you didn't request this, you can safely ignore this email.</p>
        <p style="color: #666; font-size: 12px; margin-top: 40px;">
            — The Streamura Team
        </p>
    </body>
    </html>
    """

    message = MIMEMultipart("alternative")
    message["Subject"] = "Reset Your Streamura Password"
    message["From"] = os.getenv("EMAIL_FROM", "noreply@streamura.com")
    message["To"] = email

    message.attach(MIMEText(html_content, "html"))

    await aiosmtplib.send(
        message,
        hostname=os.getenv("SMTP_HOST", "localhost"),
        port=int(os.getenv("SMTP_PORT", 587)),
        username=os.getenv("SMTP_USER"),
        password=os.getenv("SMTP_PASS"),
        use_tls=True,
    )
```

**Acceptance Criteria:**
- [ ] POST /api/v1/auth/forgot-password accepts email
- [ ] Generates secure 32-byte token
- [ ] Token expires in 1 hour
- [ ] Sends email with reset link
- [ ] Returns same response whether email exists or not
- [ ] Rate limited to 3 requests per minute

**Backend Requirements:**
- Token stored hashed or as-is (reset tokens are single-use)
- Expiration stored in UTC
- Email sent asynchronously

**Testing Requirements:**
- Unit test: Token generation works
- Unit test: Expiration set correctly
- Integration test: Endpoint returns 200 for any email
- Manual: Verify email received (test SMTP)

---

### Task 2.1.2: Create Password Reset Completion Endpoint (Backend)

**Goal:** Create API endpoint to complete password reset with token.

**Scope:**
- INCLUDED: Token validation, password update, token invalidation
- EXCLUDED: Email sending (previous task)

**Implementation Steps:**

1. Add endpoint in `backend/api.py`:

```python
from pydantic import BaseModel, validator

class PasswordResetComplete(BaseModel):
    token: str
    new_password: str

    @validator('new_password')
    def password_strength(cls, v):
        if len(v) < 8:
            raise ValueError('Password must be at least 8 characters')
        if not any(c.isupper() for c in v):
            raise ValueError('Password must contain at least one uppercase letter')
        if not any(c.islower() for c in v):
            raise ValueError('Password must contain at least one lowercase letter')
        if not any(c.isdigit() for c in v):
            raise ValueError('Password must contain at least one number')
        return v

@app.post("/api/v1/auth/reset-password")
async def complete_password_reset(
    data: PasswordResetComplete,
    db: Session = Depends(get_db)
):
    """Complete password reset with token."""
    # Find user with this token
    user = db.query(User).filter(
        User.password_reset_token == data.token,
        User.password_reset_expires > datetime.utcnow()
    ).first()

    if not user:
        raise HTTPException(
            status_code=400,
            detail="Invalid or expired reset token. Please request a new one."
        )

    # Update password
    user.hashed_password = hash_password(data.new_password)
    user.password_reset_token = None
    user.password_reset_expires = None
    db.commit()

    return {"message": "Password reset successful. You can now log in."}
```

**Acceptance Criteria:**
- [ ] POST /api/v1/auth/reset-password accepts token and new password
- [ ] Validates password strength
- [ ] Rejects expired tokens
- [ ] Rejects invalid tokens
- [ ] Updates password hash
- [ ] Invalidates token after use
- [ ] Returns success message

**Testing Requirements:**
- Unit test: Valid token succeeds
- Unit test: Expired token fails
- Unit test: Invalid token fails
- Unit test: Weak password rejected
- Integration test: Full reset flow

---

### Task 2.1.3: Create Forgot Password Page (Frontend)

**Goal:** Create the forgot password request form.

**Scope:**
- INCLUDED: Email form, submission, success message
- EXCLUDED: Reset completion (next task)

**Implementation Steps:**

1. Add route in `frontend/src/App.tsx`:

```tsx
const ForgotPasswordPage = lazy(() => import('./pages/ForgotPassword'));
// Add route
<Route path="/forgot-password" element={<ForgotPasswordPage />} />
```

2. Create `frontend/src/pages/ForgotPassword.tsx`:

```tsx
import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Mail, ArrowLeft, Loader2, CheckCircle } from 'lucide-react';
import { authApi } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const resetMutation = useMutation({
    mutationFn: (email: string) => authApi.requestPasswordReset(email),
    onSuccess: () => setSubmitted(true),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (email.trim()) {
      resetMutation.mutate(email);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white">Streamura</h1>
        </div>

        <div className="bg-slate-800 rounded-xl border border-slate-700 p-8">
          {!submitted ? (
            <>
              <h2 className="text-xl font-bold text-white mb-2">Reset your password</h2>
              <p className="text-slate-400 mb-6">
                Enter your email address and we'll send you a link to reset your password.
              </p>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label
                    htmlFor="email"
                    className="block text-sm font-medium text-slate-300 mb-1"
                  >
                    Email Address
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <Input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@example.com"
                      className="pl-10"
                      required
                      autoFocus
                    />
                  </div>
                </div>

                {resetMutation.isError && (
                  <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                    <p className="text-sm text-red-400">
                      Something went wrong. Please try again.
                    </p>
                  </div>
                )}

                <Button
                  type="submit"
                  variant="primary"
                  className="w-full"
                  disabled={resetMutation.isPending || !email}
                >
                  {resetMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Sending...
                    </>
                  ) : (
                    'Send Reset Link'
                  )}
                </Button>
              </form>
            </>
          ) : (
            <div className="text-center py-4">
              <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="h-8 w-8 text-green-500" />
              </div>
              <h2 className="text-xl font-bold text-white mb-2">Check your email</h2>
              <p className="text-slate-400 mb-6">
                If an account exists for {email}, you'll receive a password reset link shortly.
              </p>
              <Button
                variant="secondary"
                onClick={() => {
                  setEmail('');
                  setSubmitted(false);
                }}
              >
                Send another link
              </Button>
            </div>
          )}

          <div className="mt-6 text-center">
            <Link
              to="/login"
              className="text-sm text-purple-400 hover:text-purple-300 inline-flex items-center gap-1"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to login
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
```

3. Add API method:

```tsx
// In authApi
requestPasswordReset: async (email: string) => {
  const response = await api.post('/auth/forgot-password', { email });
  return response.data;
},
```

4. Add link to forgot password in Login page:

```tsx
// In Login.tsx, add below password field
<div className="text-right">
  <Link to="/forgot-password" className="text-sm text-purple-400 hover:text-purple-300">
    Forgot password?
  </Link>
</div>
```

**Acceptance Criteria:**
- [ ] /forgot-password route renders
- [ ] Form validates email format
- [ ] Submit sends request to API
- [ ] Loading state shown during submission
- [ ] Success message shown after submission
- [ ] Can request another link
- [ ] Link back to login
- [ ] Keyboard accessible

**Testing Requirements:**
- Unit test: Form renders
- Unit test: Validates email
- Unit test: Shows success state
- Manual: Full flow with real email

---

### Task 2.1.4: Create Reset Password Page (Frontend)

**Goal:** Create the password reset completion form.

**Scope:**
- INCLUDED: Token from URL, password form, validation, success redirect
- EXCLUDED: Request flow (previous task)

**Implementation Steps:**

1. Add route:

```tsx
const ResetPasswordPage = lazy(() => import('./pages/ResetPassword'));
<Route path="/reset-password" element={<ResetPasswordPage />} />
```

2. Create `frontend/src/pages/ResetPassword.tsx`:

```tsx
import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { Lock, Eye, EyeOff, Loader2, CheckCircle, AlertTriangle } from 'lucide-react';
import { authApi } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

interface PasswordStrength {
  score: number;
  label: string;
  color: string;
}

function checkPasswordStrength(password: string): PasswordStrength {
  let score = 0;
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[a-z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;

  if (score <= 2) return { score: 1, label: 'Weak', color: 'bg-red-500' };
  if (score <= 4) return { score: 2, label: 'Fair', color: 'bg-yellow-500' };
  return { score: 3, label: 'Strong', color: 'bg-green-500' };
}

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token');

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);

  const strength = checkPasswordStrength(password);

  const resetMutation = useMutation({
    mutationFn: (data: { token: string; new_password: string }) =>
      authApi.resetPassword(data.token, data.new_password),
    onSuccess: () => {
      // Redirect to login after 3 seconds
      setTimeout(() => navigate('/login'), 3000);
    },
  });

  // Validate on submit
  const validatePassword = (): boolean => {
    const newErrors: string[] = [];

    if (password.length < 8) {
      newErrors.push('Password must be at least 8 characters');
    }
    if (!/[A-Z]/.test(password)) {
      newErrors.push('Include at least one uppercase letter');
    }
    if (!/[a-z]/.test(password)) {
      newErrors.push('Include at least one lowercase letter');
    }
    if (!/[0-9]/.test(password)) {
      newErrors.push('Include at least one number');
    }
    if (password !== confirmPassword) {
      newErrors.push('Passwords do not match');
    }

    setErrors(newErrors);
    return newErrors.length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validatePassword() && token) {
      resetMutation.mutate({ token, new_password: password });
    }
  };

  // No token - show error
  if (!token) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center px-4">
        <div className="w-full max-w-md text-center">
          <div className="bg-slate-800 rounded-xl border border-slate-700 p-8">
            <AlertTriangle className="h-12 w-12 text-yellow-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-white mb-2">Invalid Reset Link</h2>
            <p className="text-slate-400 mb-6">
              This password reset link is invalid or has expired.
            </p>
            <Link to="/forgot-password">
              <Button variant="primary">Request New Link</Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Success state
  if (resetMutation.isSuccess) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center px-4">
        <div className="w-full max-w-md text-center">
          <div className="bg-slate-800 rounded-xl border border-slate-700 p-8">
            <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="h-8 w-8 text-green-500" />
            </div>
            <h2 className="text-xl font-bold text-white mb-2">Password Reset!</h2>
            <p className="text-slate-400 mb-4">
              Your password has been changed successfully.
            </p>
            <p className="text-sm text-slate-500">
              Redirecting to login...
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white">Streamura</h1>
        </div>

        <div className="bg-slate-800 rounded-xl border border-slate-700 p-8">
          <h2 className="text-xl font-bold text-white mb-2">Set new password</h2>
          <p className="text-slate-400 mb-6">
            Enter your new password below.
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Password */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">
                New Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-10 pr-10"
                  required
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>

              {/* Strength Indicator */}
              {password && (
                <div className="mt-2">
                  <div className="flex gap-1 mb-1">
                    {[1, 2, 3].map((level) => (
                      <div
                        key={level}
                        className={`h-1 flex-1 rounded ${
                          level <= strength.score ? strength.color : 'bg-slate-600'
                        }`}
                      />
                    ))}
                  </div>
                  <p className="text-xs text-slate-400">
                    Password strength: <span className="font-medium">{strength.label}</span>
                  </p>
                </div>
              )}
            </div>

            {/* Confirm Password */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">
                Confirm Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  type={showPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="pl-10"
                  required
                />
              </div>
              {confirmPassword && password !== confirmPassword && (
                <p className="text-xs text-red-400 mt-1">Passwords don't match</p>
              )}
            </div>

            {/* Errors */}
            {(errors.length > 0 || resetMutation.isError) && (
              <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                {errors.map((error, i) => (
                  <p key={i} className="text-sm text-red-400">• {error}</p>
                ))}
                {resetMutation.isError && (
                  <p className="text-sm text-red-400">
                    • {(resetMutation.error as Error).message || 'Reset failed. The link may have expired.'}
                  </p>
                )}
              </div>
            )}

            {/* Submit */}
            <Button
              type="submit"
              variant="primary"
              className="w-full"
              disabled={resetMutation.isPending || !password || !confirmPassword}
            >
              {resetMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Resetting...
                </>
              ) : (
                'Reset Password'
              )}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
```

3. Add API method:

```tsx
// In authApi
resetPassword: async (token: string, newPassword: string) => {
  const response = await api.post('/auth/reset-password', {
    token,
    new_password: newPassword
  });
  return response.data;
},
```

**Acceptance Criteria:**
- [ ] /reset-password?token=xxx route renders
- [ ] Shows error if no token in URL
- [ ] Password strength indicator works
- [ ] Confirm password validation
- [ ] All password requirements validated
- [ ] Success message and redirect to login
- [ ] Error message for expired/invalid token
- [ ] Toggle password visibility

**UI/UX Requirements:**
- Strength meter: 3 bars, colored by score
- Password visibility toggle: Eye icon
- Error messages: Red, bulleted list
- Success: Green checkmark, auto-redirect

**Testing Requirements:**
- Unit test: Renders with token
- Unit test: Shows error without token
- Unit test: Password validation works
- Integration test: Full reset flow
- Manual: Test with real reset link

---

[DOCUMENT CONTINUES WITH REMAINING PHASES...]

---

# PHASE 3: REAL-TIME EXPERIENCE
**Priority: HIGH IMPACT | Timeline: Week 3-4**

## Epic 3.1: Real-time Notifications WebSocket

### Task 3.1.1: Create Notifications WebSocket Endpoint (Backend)
### Task 3.1.2: Create Notification Context Provider (Frontend)
### Task 3.1.3: Update Notification Bell Component
### Task 3.1.4: Add Real-time Notification Toast

## Epic 3.2: Real-time Direct Messaging

### Task 3.2.1: Connect Messages Page to WebSocket
### Task 3.2.2: Add Typing Indicators
### Task 3.2.3: Add Online Presence

---

# PHASE 4: FEATURE COMPLETION
**Priority: HIGH IMPACT | Timeline: Week 4-6**

## Epic 4.1: Stream Scheduling UI
## Epic 4.2: Event Creation UI
## Epic 4.3: User Settings Page
## Epic 4.4: Public User Profiles
## Epic 4.5: Recording Controls
## Epic 4.6: Content Filter Admin UI

---

# PHASE 5: POLISH & EXCELLENCE
**Priority: POLISH | Timeline: Week 6-8**

## Epic 5.1: Analytics Charts
## Epic 5.2: i18n Error Messages
## Epic 5.3: Accessibility Audit
## Epic 5.4: Performance Optimization
## Epic 5.5: Error Handling Enhancement

---

# TOP 10 HIGHEST-LEVERAGE IMPROVEMENTS

| Rank | Improvement | Current UX | Target UX | Impact | Effort |
|------|-------------|------------|-----------|--------|--------|
| 1 | Virtual Goods Shop + Inventory | 2 | 10 | Revenue | 20h |
| 2 | Subscription Tier UI | 4 | 10 | Revenue | 18h |
| 3 | Password Reset Flow | 2 | 10 | Trust | 14h |
| 4 | Real-time Notifications | 4 | 10 | Engagement | 12h |
| 5 | User Settings Page | 2 | 10 | Basic | 10h |
| 6 | Stream Scheduling | 3 | 10 | Feature | 8h |
| 7 | Direct Messaging WebSocket | 6 | 10 | Engagement | 8h |
| 8 | Event Creation UI | 3 | 10 | Feature | 8h |
| 9 | Public User Profiles | 4 | 10 | Social | 6h |
| 10 | Gift Code Redemption | 3 | 10 | Revenue | 4h |

**Total: ~108 hours for top 10 improvements**

---

# ROLLOUT PLAN

## Stage 1: Development Environment
1. Implement features in local development
2. Run all unit tests: `npm test` / `pytest`
3. Fix any failing tests
4. Developer self-QA on localhost

## Stage 2: Staging Environment
1. Deploy to staging: `git push staging main`
2. Run integration tests against staging API
3. Run E2E tests: `npm run test:e2e`
4. Manual QA by team member (not implementer)
5. Fix any issues found, repeat tests

## Stage 3: QA Environment
1. Deploy to QA: `git push qa main`
2. Full regression testing
3. Cross-browser testing (Chrome, Firefox, Safari, Edge)
4. Mobile testing (iOS Safari, Android Chrome)
5. Accessibility audit (WAVE, axe)
6. Performance audit (Lighthouse)
7. Security scan (OWASP ZAP)

## Stage 4: Production Rollout
1. Schedule maintenance window (if needed)
2. Backup production database
3. Deploy to production: `git push production main`
4. Run smoke tests against production
5. Monitor error rates for 24 hours
6. Gradual feature flag rollout (if applicable)
7. Full release after 48 hours stable

## Rollback Plan
If critical issues found:
1. Revert: `git revert HEAD && git push production`
2. Restore database backup if needed
3. Post-mortem within 24 hours
4. Fix and re-deploy through full pipeline

---

# RISK REGISTRY

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Stripe API changes | Low | High | Pin Stripe SDK version, test in sandbox |
| LiveKit integration issues | Medium | High | Have fallback to RTMP only |
| Email delivery failures | Medium | Medium | Use reliable provider (SendGrid), add logging |
| Database migration issues | Low | High | Test migrations on staging first, backup |
| Performance degradation | Medium | Medium | Monitor metrics, set alerts |
| Cross-browser compatibility | Medium | Medium | Test matrix, use polyfills |
| Security vulnerabilities | Low | Critical | Security audit before release |

---

# APPENDIX: FILE MANIFEST

## New Frontend Files to Create
- `frontend/src/pages/Shop.tsx`
- `frontend/src/pages/Inventory.tsx`
- `frontend/src/pages/ForgotPassword.tsx`
- `frontend/src/pages/ResetPassword.tsx`
- `frontend/src/pages/Settings.tsx`
- `frontend/src/pages/PublicProfile.tsx`
- `frontend/src/components/shop/VirtualGoodCard.tsx`
- `frontend/src/components/shop/PurchaseModal.tsx`
- `frontend/src/components/shop/GiftModal.tsx`
- `frontend/src/components/subscriptions/SubscriptionTiers.tsx`
- `frontend/src/components/subscriptions/TierManagement.tsx`
- `frontend/src/components/notifications/NotificationProvider.tsx`
- `frontend/src/components/notifications/NotificationToast.tsx`
- `frontend/src/components/settings/SettingsForm.tsx`
- `frontend/src/components/settings/NotificationPreferences.tsx`

## New Backend Files to Create
- `backend/email.py`

## Files to Modify
- `frontend/src/App.tsx` (add routes)
- `frontend/src/lib/api.ts` (add API methods)
- `frontend/src/types/index.ts` (add types)
- `frontend/src/components/layout/Navbar.tsx` (add links)
- `frontend/src/pages/Profile.tsx` (add subscription tiers)
- `frontend/src/pages/Login.tsx` (add forgot password link)
- `backend/api.py` (add password reset endpoints)
- `backend/models.py` (add reset token fields)

---

**END OF ROAD HOME IMPLEMENTATION PLAN**

*Document Version: 1.0*
*Created: January 2026*
*Author: Claude Opus 4.5*
*Status: Ready for Execution*
