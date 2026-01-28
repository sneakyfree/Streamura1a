"""
Streamura Subscription Service (Phase 10)

Handles subscription tiers, subscriber management, and Stripe Billing integration.

This module provides:
- Creator subscription tier management
- Subscriber checkout and management
- Stripe Billing integration for recurring payments
- Gift subscriptions
- Subscriber benefits verification

Revenue Split: 70% creator / 30% platform (same as tips)
"""

import os
import stripe
import logging
import secrets
from decimal import Decimal
from datetime import datetime, timedelta
from typing import Optional, Dict, Any, List
from sqlalchemy.orm import Session
from sqlalchemy import and_

logger = logging.getLogger(__name__)

# Configuration
STRIPE_SECRET_KEY = os.getenv("STRIPE_SECRET_KEY")
STRIPE_WEBHOOK_SECRET = os.getenv("STRIPE_WEBHOOK_SECRET")
PLATFORM_FEE_PERCENT = Decimal("0.10")  # 10% platform fee (90/10 creator-first split)
CREATOR_REVENUE_SHARE = Decimal("0.90")  # 90% to creator

# Initialize Stripe
if STRIPE_SECRET_KEY:
    stripe.api_key = STRIPE_SECRET_KEY


class SubscriptionError(Exception):
    """Custom exception for subscription-related errors"""
    def __init__(self, message: str, code: str = "subscription_error"):
        self.message = message
        self.code = code
        super().__init__(self.message)


class SubscriptionService:
    """
    Main service class for subscription operations.
    """

    def __init__(self, db: Session):
        self.db = db

    # =========================================================================
    # Subscription Tier Management
    # =========================================================================

    async def create_tier(
        self,
        creator_id: int,
        name: str,
        price: float,
        description: Optional[str] = None,
        benefits: Optional[List[str]] = None,
        billing_period: str = "monthly",
        currency: str = "USD",
        max_subscribers: Optional[int] = None,
        badge_url: Optional[str] = None,
        emote_slots: int = 0,
    ) -> Dict[str, Any]:
        """
        Create a new subscription tier for a creator.

        Args:
            creator_id: ID of the creator
            name: Tier name (e.g., "Supporter", "VIP")
            price: Monthly price
            description: Tier description
            benefits: List of benefit strings
            billing_period: 'monthly' or 'yearly'
            currency: Currency code
            max_subscribers: Maximum subscribers (None = unlimited)
            badge_url: URL to custom subscriber badge
            emote_slots: Number of custom emotes for this tier

        Returns:
            Dict with tier details
        """
        from .models import SubscriptionTier, User

        # Validate creator exists
        creator = self.db.query(User).filter(User.id == creator_id).first()
        if not creator:
            raise SubscriptionError("Creator not found", "creator_not_found")

        # Create Stripe Price if Stripe is configured
        stripe_price_id = None
        if STRIPE_SECRET_KEY and creator.stripe_account_id:
            try:
                # Create Stripe Product for this tier
                product = stripe.Product.create(
                    name=f"{creator.username or creator.display_name} - {name}",
                    metadata={
                        "creator_id": str(creator_id),
                        "tier_name": name,
                        "platform": "streamura",
                    }
                )

                # Create recurring price
                interval = "year" if billing_period == "yearly" else "month"
                price_obj = stripe.Price.create(
                    product=product.id,
                    unit_amount=int(price * 100),  # Convert to cents
                    currency=currency.lower(),
                    recurring={"interval": interval},
                    metadata={
                        "creator_id": str(creator_id),
                        "platform": "streamura",
                    }
                )
                stripe_price_id = price_obj.id

            except stripe.error.StripeError as e:
                logger.error(f"Failed to create Stripe price for tier: {e}")
                # Continue without Stripe price - can be added later

        # Get next sort order
        max_sort = self.db.query(SubscriptionTier).filter(
            SubscriptionTier.creator_id == creator_id
        ).count()

        # Create tier
        tier = SubscriptionTier(
            creator_id=creator_id,
            name=name,
            description=description,
            price=price,
            currency=currency,
            billing_period=billing_period,
            stripe_price_id=stripe_price_id,
            benefits=benefits or [],
            badge_url=badge_url,
            emote_slots=emote_slots,
            max_subscribers=max_subscribers,
            is_active=True,
            sort_order=max_sort,
        )
        self.db.add(tier)
        self.db.commit()
        self.db.refresh(tier)

        logger.info(f"Created subscription tier '{name}' for creator {creator_id}")

        return self._tier_to_dict(tier)

    async def update_tier(
        self,
        tier_id: int,
        creator_id: int,
        **updates
    ) -> Dict[str, Any]:
        """
        Update a subscription tier.

        Note: Price changes only affect new subscribers.
        """
        from .models import SubscriptionTier

        tier = self.db.query(SubscriptionTier).filter(
            and_(
                SubscriptionTier.id == tier_id,
                SubscriptionTier.creator_id == creator_id
            )
        ).first()

        if not tier:
            raise SubscriptionError("Tier not found", "tier_not_found")

        # Allowed updates
        allowed_fields = [
            'name', 'description', 'benefits', 'max_subscribers',
            'badge_url', 'emote_slots', 'is_active', 'sort_order'
        ]

        for field in allowed_fields:
            if field in updates:
                setattr(tier, field, updates[field])

        # Handle price update - creates new Stripe price
        if 'price' in updates and updates['price'] != tier.price:
            new_price = updates['price']
            tier.price = new_price

            # Create new Stripe price if available
            if STRIPE_SECRET_KEY and tier.stripe_price_id:
                try:
                    old_price = stripe.Price.retrieve(tier.stripe_price_id)
                    interval = "year" if tier.billing_period == "yearly" else "month"

                    new_stripe_price = stripe.Price.create(
                        product=old_price.product,
                        unit_amount=int(new_price * 100),
                        currency=tier.currency.lower(),
                        recurring={"interval": interval},
                    )
                    tier.stripe_price_id = new_stripe_price.id
                except stripe.error.StripeError as e:
                    logger.error(f"Failed to update Stripe price: {e}")

        self.db.commit()
        self.db.refresh(tier)

        return self._tier_to_dict(tier)

    async def delete_tier(self, tier_id: int, creator_id: int) -> Dict[str, Any]:
        """
        Deactivate a subscription tier.
        Does not actually delete - marks as inactive for existing subscribers.
        """
        from .models import SubscriptionTier

        tier = self.db.query(SubscriptionTier).filter(
            and_(
                SubscriptionTier.id == tier_id,
                SubscriptionTier.creator_id == creator_id
            )
        ).first()

        if not tier:
            raise SubscriptionError("Tier not found", "tier_not_found")

        tier.is_active = False
        self.db.commit()

        return {"success": True, "message": "Tier deactivated"}

    async def get_tiers(
        self,
        creator_id: int,
        include_inactive: bool = False
    ) -> List[Dict[str, Any]]:
        """Get all subscription tiers for a creator."""
        from .models import SubscriptionTier

        query = self.db.query(SubscriptionTier).filter(
            SubscriptionTier.creator_id == creator_id
        )

        if not include_inactive:
            query = query.filter(SubscriptionTier.is_active == True)

        tiers = query.order_by(SubscriptionTier.sort_order).all()
        return [self._tier_to_dict(t) for t in tiers]

    async def get_tier(self, tier_id: int) -> Dict[str, Any]:
        """Get a specific tier by ID."""
        from .models import SubscriptionTier

        tier = self.db.query(SubscriptionTier).filter(
            SubscriptionTier.id == tier_id
        ).first()

        if not tier:
            raise SubscriptionError("Tier not found", "tier_not_found")

        return self._tier_to_dict(tier)

    # =========================================================================
    # Subscription Management
    # =========================================================================

    async def create_checkout_session(
        self,
        subscriber_id: int,
        tier_id: int,
        success_url: str,
        cancel_url: str,
    ) -> Dict[str, Any]:
        """
        Create a Stripe Checkout session for subscribing.

        Args:
            subscriber_id: ID of the subscribing user
            tier_id: ID of the subscription tier
            success_url: URL to redirect after successful payment
            cancel_url: URL to redirect if cancelled

        Returns:
            Dict with checkout session URL
        """
        from .models import SubscriptionTier, User, Subscription

        if not STRIPE_SECRET_KEY:
            raise SubscriptionError("Payment system not configured", "not_configured")

        tier = self.db.query(SubscriptionTier).filter(
            SubscriptionTier.id == tier_id,
            SubscriptionTier.is_active == True
        ).first()

        if not tier:
            raise SubscriptionError("Tier not found or inactive", "tier_not_found")

        subscriber = self.db.query(User).filter(User.id == subscriber_id).first()
        if not subscriber:
            raise SubscriptionError("User not found", "user_not_found")

        creator = self.db.query(User).filter(User.id == tier.creator_id).first()
        if not creator:
            raise SubscriptionError("Creator not found", "creator_not_found")

        # Check if already subscribed
        existing = self.db.query(Subscription).filter(
            and_(
                Subscription.subscriber_id == subscriber_id,
                Subscription.creator_id == tier.creator_id,
                Subscription.status.in_(['active', 'past_due'])
            )
        ).first()

        if existing:
            raise SubscriptionError(
                "Already subscribed to this creator",
                "already_subscribed"
            )

        # Check max subscribers
        if tier.max_subscribers and tier.current_subscribers >= tier.max_subscribers:
            raise SubscriptionError("This tier is full", "tier_full")

        # Ensure Stripe price exists
        if not tier.stripe_price_id:
            raise SubscriptionError(
                "Subscription not available for this tier",
                "stripe_not_configured"
            )

        # Get or create Stripe customer for subscriber
        if not subscriber.stripe_customer_id:
            customer = stripe.Customer.create(
                email=subscriber.email,
                metadata={
                    "user_id": str(subscriber_id),
                    "platform": "streamura",
                }
            )
            subscriber.stripe_customer_id = customer.id
            self.db.commit()

        try:
            # Calculate application fee (platform's 30%)
            application_fee_percent = int(PLATFORM_FEE_PERCENT * 100)

            session = stripe.checkout.Session.create(
                mode="subscription",
                customer=subscriber.stripe_customer_id,
                line_items=[{
                    "price": tier.stripe_price_id,
                    "quantity": 1,
                }],
                success_url=success_url,
                cancel_url=cancel_url,
                subscription_data={
                    "application_fee_percent": application_fee_percent,
                    "transfer_data": {
                        "destination": creator.stripe_account_id,
                    },
                    "metadata": {
                        "tier_id": str(tier_id),
                        "subscriber_id": str(subscriber_id),
                        "creator_id": str(tier.creator_id),
                        "platform": "streamura",
                    }
                },
                metadata={
                    "type": "subscription",
                    "tier_id": str(tier_id),
                    "subscriber_id": str(subscriber_id),
                }
            )

            return {
                "checkout_url": session.url,
                "session_id": session.id,
            }

        except stripe.error.StripeError as e:
            logger.error(f"Failed to create checkout session: {e}")
            raise SubscriptionError(
                "Failed to create checkout session",
                "checkout_failed"
            )

    async def cancel_subscription(
        self,
        subscription_id: int,
        subscriber_id: int,
        cancel_immediately: bool = False
    ) -> Dict[str, Any]:
        """
        Cancel a subscription.

        Args:
            subscription_id: Internal subscription ID
            subscriber_id: ID of the subscriber (for authorization)
            cancel_immediately: If True, cancel now; if False, cancel at period end

        Returns:
            Dict with cancellation details
        """
        from .models import Subscription

        subscription = self.db.query(Subscription).filter(
            and_(
                Subscription.id == subscription_id,
                Subscription.subscriber_id == subscriber_id
            )
        ).first()

        if not subscription:
            raise SubscriptionError("Subscription not found", "subscription_not_found")

        if subscription.status in ['canceled']:
            raise SubscriptionError("Subscription already canceled", "already_canceled")

        # Cancel in Stripe
        if STRIPE_SECRET_KEY and subscription.stripe_subscription_id:
            try:
                if cancel_immediately:
                    stripe.Subscription.delete(subscription.stripe_subscription_id)
                    subscription.status = 'canceled'
                    subscription.canceled_at = datetime.utcnow()
                else:
                    stripe.Subscription.modify(
                        subscription.stripe_subscription_id,
                        cancel_at_period_end=True
                    )
                    subscription.cancel_at_period_end = True
            except stripe.error.StripeError as e:
                logger.error(f"Failed to cancel Stripe subscription: {e}")
                raise SubscriptionError("Failed to cancel subscription", "cancel_failed")
        else:
            # No Stripe - just update locally
            subscription.status = 'canceled'
            subscription.canceled_at = datetime.utcnow()

        self.db.commit()

        return {
            "success": True,
            "canceled_immediately": cancel_immediately,
            "status": subscription.status,
            "cancel_at_period_end": subscription.cancel_at_period_end,
        }

    async def get_subscriptions(
        self,
        user_id: int,
        as_subscriber: bool = True,
        status: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """
        Get subscriptions for a user.

        Args:
            user_id: The user ID
            as_subscriber: If True, get subscriptions where user is subscriber;
                          If False, get subscriptions where user is creator
            status: Filter by status ('active', 'canceled', etc.)

        Returns:
            List of subscription dicts
        """
        from .models import Subscription

        if as_subscriber:
            query = self.db.query(Subscription).filter(
                Subscription.subscriber_id == user_id
            )
        else:
            query = self.db.query(Subscription).filter(
                Subscription.creator_id == user_id
            )

        if status:
            query = query.filter(Subscription.status == status)

        subscriptions = query.all()
        return [self._subscription_to_dict(s) for s in subscriptions]

    async def get_subscribers(
        self,
        creator_id: int,
        tier_id: Optional[int] = None,
        limit: int = 50,
        offset: int = 0
    ) -> Dict[str, Any]:
        """Get subscribers for a creator."""
        from .models import Subscription, User

        query = self.db.query(Subscription).filter(
            and_(
                Subscription.creator_id == creator_id,
                Subscription.status == 'active'
            )
        )

        if tier_id:
            query = query.filter(Subscription.tier_id == tier_id)

        total = query.count()
        subscriptions = query.offset(offset).limit(limit).all()

        subscribers = []
        for sub in subscriptions:
            user = self.db.query(User).filter(User.id == sub.subscriber_id).first()
            if user:
                subscribers.append({
                    "subscription_id": sub.id,
                    "user_id": user.id,
                    "username": user.username,
                    "display_name": user.display_name,
                    "avatar_url": user.avatar_url,
                    "tier_id": sub.tier_id,
                    "subscribed_at": sub.created_at.isoformat() if sub.created_at else None,
                    "current_period_end": sub.current_period_end.isoformat() if sub.current_period_end else None,
                })

        return {
            "subscribers": subscribers,
            "total": total,
            "limit": limit,
            "offset": offset,
        }

    # =========================================================================
    # Subscription Verification
    # =========================================================================

    async def is_subscribed(
        self,
        subscriber_id: int,
        creator_id: int,
        min_tier_id: Optional[int] = None
    ) -> Dict[str, Any]:
        """
        Check if a user is subscribed to a creator.

        Args:
            subscriber_id: ID of the potential subscriber
            creator_id: ID of the creator
            min_tier_id: Optional minimum tier ID required

        Returns:
            Dict with subscription status and details
        """
        from .models import Subscription, SubscriptionTier

        query = self.db.query(Subscription).filter(
            and_(
                Subscription.subscriber_id == subscriber_id,
                Subscription.creator_id == creator_id,
                Subscription.status == 'active'
            )
        )

        subscription = query.first()

        if not subscription:
            return {
                "is_subscribed": False,
                "tier_id": None,
                "tier_name": None,
            }

        tier = self.db.query(SubscriptionTier).filter(
            SubscriptionTier.id == subscription.tier_id
        ).first()

        # Check minimum tier if specified
        meets_minimum = True
        if min_tier_id and tier:
            min_tier = self.db.query(SubscriptionTier).filter(
                SubscriptionTier.id == min_tier_id
            ).first()
            if min_tier:
                meets_minimum = tier.price >= min_tier.price

        return {
            "is_subscribed": True,
            "meets_minimum_tier": meets_minimum,
            "tier_id": subscription.tier_id,
            "tier_name": tier.name if tier else None,
            "tier_price": tier.price if tier else None,
            "benefits": tier.benefits if tier else [],
            "badge_url": tier.badge_url if tier else None,
            "current_period_end": subscription.current_period_end.isoformat() if subscription.current_period_end else None,
        }

    async def get_subscriber_benefits(
        self,
        subscriber_id: int,
        creator_id: int
    ) -> Dict[str, Any]:
        """Get all benefits a subscriber has for a creator."""
        sub_status = await self.is_subscribed(subscriber_id, creator_id)

        if not sub_status["is_subscribed"]:
            return {
                "has_subscription": False,
                "benefits": [],
                "badge_url": None,
                "emote_slots": 0,
            }

        from .models import SubscriptionTier
        tier = self.db.query(SubscriptionTier).filter(
            SubscriptionTier.id == sub_status["tier_id"]
        ).first()

        return {
            "has_subscription": True,
            "tier_id": tier.id if tier else None,
            "tier_name": tier.name if tier else None,
            "benefits": tier.benefits if tier else [],
            "badge_url": tier.badge_url if tier else None,
            "emote_slots": tier.emote_slots if tier else 0,
        }

    # =========================================================================
    # Gift Codes
    # =========================================================================

    async def create_gift_code(
        self,
        tier_id: int,
        created_by: int,
        months: int = 1,
        expires_days: Optional[int] = 30
    ) -> Dict[str, Any]:
        """Create a gift code for a subscription tier."""
        from .models import SubscriptionGiftCode, SubscriptionTier

        tier = self.db.query(SubscriptionTier).filter(
            SubscriptionTier.id == tier_id
        ).first()

        if not tier:
            raise SubscriptionError("Tier not found", "tier_not_found")

        # Generate unique code
        code = secrets.token_urlsafe(16)[:16].upper()

        expires_at = None
        if expires_days:
            expires_at = datetime.utcnow() + timedelta(days=expires_days)

        gift_code = SubscriptionGiftCode(
            code=code,
            tier_id=tier_id,
            months=months,
            created_by=created_by,
            expires_at=expires_at,
        )
        self.db.add(gift_code)
        self.db.commit()
        self.db.refresh(gift_code)

        return {
            "code": code,
            "tier_id": tier_id,
            "tier_name": tier.name,
            "months": months,
            "expires_at": expires_at.isoformat() if expires_at else None,
        }

    async def redeem_gift_code(
        self,
        code: str,
        user_id: int
    ) -> Dict[str, Any]:
        """Redeem a gift code."""
        from .models import SubscriptionGiftCode, Subscription, SubscriptionTier, User

        gift = self.db.query(SubscriptionGiftCode).filter(
            SubscriptionGiftCode.code == code
        ).first()

        if not gift:
            raise SubscriptionError("Invalid gift code", "invalid_code")

        if gift.redeemed_by:
            raise SubscriptionError("Gift code already redeemed", "already_redeemed")

        if gift.expires_at and gift.expires_at < datetime.utcnow():
            raise SubscriptionError("Gift code has expired", "code_expired")

        tier = self.db.query(SubscriptionTier).filter(
            SubscriptionTier.id == gift.tier_id
        ).first()

        if not tier:
            raise SubscriptionError("Tier no longer exists", "tier_not_found")

        # Create subscription
        period_end = datetime.utcnow() + timedelta(days=30 * gift.months)

        subscription = Subscription(
            subscriber_id=user_id,
            creator_id=tier.creator_id,
            tier_id=tier.id,
            status='active',
            current_period_start=datetime.utcnow(),
            current_period_end=period_end,
            gift_from_user_id=gift.created_by,
        )
        self.db.add(subscription)

        # Mark code as redeemed
        gift.redeemed_by = user_id
        gift.redeemed_at = datetime.utcnow()

        # Update subscriber count
        tier.current_subscribers = (tier.current_subscribers or 0) + 1

        # Update creator's subscriber count
        creator = self.db.query(User).filter(User.id == tier.creator_id).first()
        if creator:
            creator.subscriber_count = (creator.subscriber_count or 0) + 1

        self.db.commit()

        return {
            "success": True,
            "tier_name": tier.name,
            "creator_id": tier.creator_id,
            "months": gift.months,
            "expires_at": period_end.isoformat(),
        }

    # =========================================================================
    # Webhook Handlers
    # =========================================================================

    async def handle_webhook_event(self, event_type: str, event_data: Dict) -> Dict[str, Any]:
        """
        Main webhook handler - called by payments.py for subscription-related events.

        Handles:
        - customer.subscription.* events
        - invoice.* events
        - checkout.session.completed (for subscriptions)
        """
        handlers = {
            "customer.subscription.created": self._handle_subscription_created,
            "customer.subscription.updated": self._handle_subscription_updated,
            "customer.subscription.deleted": self._handle_subscription_deleted,
            "invoice.paid": self._handle_invoice_paid,
            "invoice.payment_failed": self._handle_invoice_failed,
            "checkout.session.completed": self._handle_checkout_completed,
        }

        handler = handlers.get(event_type)
        if handler:
            return await handler(event_data)

        return {"handled": False, "event_type": event_type}

    async def _handle_checkout_completed(self, session_data: Dict) -> Dict:
        """Handle completed checkout session for subscription."""
        subscription_id = session_data.get("subscription")
        if not subscription_id:
            return {"handled": False, "reason": "no_subscription_in_session"}

        # The subscription.created webhook will handle the actual creation
        # This just logs the checkout completion
        metadata = session_data.get("metadata", {})
        logger.info(
            f"Checkout completed for subscription. "
            f"Tier: {metadata.get('tier_id')}, "
            f"Subscriber: {metadata.get('subscriber_id')}"
        )

        return {"handled": True, "event_type": "checkout.session.completed"}

    async def _handle_subscription_created(self, sub_data: Dict) -> Dict:
        """Handle new subscription from Stripe."""
        from .models import Subscription, SubscriptionTier, User

        metadata = sub_data.get("metadata", {})
        tier_id = int(metadata.get("tier_id", 0))
        subscriber_id = int(metadata.get("subscriber_id", 0))
        creator_id = int(metadata.get("creator_id", 0))

        if not all([tier_id, subscriber_id, creator_id]):
            logger.warning(f"Missing metadata in subscription: {sub_data.get('id')}")
            return {"handled": False, "reason": "missing_metadata"}

        # Check for existing subscription
        existing = self.db.query(Subscription).filter(
            and_(
                Subscription.subscriber_id == subscriber_id,
                Subscription.creator_id == creator_id,
                Subscription.status == 'active'
            )
        ).first()

        if existing:
            # Update existing subscription
            existing.stripe_subscription_id = sub_data.get("id")
            existing.tier_id = tier_id
            existing.status = 'active'
            existing.current_period_start = datetime.fromtimestamp(
                sub_data.get("current_period_start", 0)
            )
            existing.current_period_end = datetime.fromtimestamp(
                sub_data.get("current_period_end", 0)
            )
        else:
            # Create new subscription
            subscription = Subscription(
                subscriber_id=subscriber_id,
                creator_id=creator_id,
                tier_id=tier_id,
                stripe_subscription_id=sub_data.get("id"),
                stripe_customer_id=sub_data.get("customer"),
                status='active',
                current_period_start=datetime.fromtimestamp(
                    sub_data.get("current_period_start", 0)
                ),
                current_period_end=datetime.fromtimestamp(
                    sub_data.get("current_period_end", 0)
                ),
            )
            self.db.add(subscription)

            # Update tier subscriber count
            tier = self.db.query(SubscriptionTier).filter(
                SubscriptionTier.id == tier_id
            ).first()
            if tier:
                tier.current_subscribers = (tier.current_subscribers or 0) + 1

            # Update creator's subscriber count
            creator = self.db.query(User).filter(User.id == creator_id).first()
            if creator:
                creator.subscriber_count = (creator.subscriber_count or 0) + 1

        self.db.commit()

        logger.info(f"Created subscription for user {subscriber_id} to creator {creator_id}")
        return {"handled": True, "event_type": "customer.subscription.created"}

    async def _handle_subscription_updated(self, sub_data: Dict) -> Dict:
        """Handle subscription update from Stripe."""
        from .models import Subscription

        stripe_sub_id = sub_data.get("id")
        subscription = self.db.query(Subscription).filter(
            Subscription.stripe_subscription_id == stripe_sub_id
        ).first()

        if subscription:
            status_map = {
                "active": "active",
                "past_due": "past_due",
                "canceled": "canceled",
                "incomplete": "past_due",
                "incomplete_expired": "canceled",
                "trialing": "active",
                "unpaid": "past_due",
                "paused": "paused",
            }
            stripe_status = sub_data.get("status", "active")
            subscription.status = status_map.get(stripe_status, "active")
            subscription.current_period_end = datetime.fromtimestamp(
                sub_data.get("current_period_end", 0)
            )
            subscription.cancel_at_period_end = sub_data.get("cancel_at_period_end", False)

            self.db.commit()

        return {"handled": True, "event_type": "customer.subscription.updated"}

    async def _handle_subscription_deleted(self, sub_data: Dict) -> Dict:
        """Handle subscription cancellation from Stripe."""
        from .models import Subscription, SubscriptionTier, User

        stripe_sub_id = sub_data.get("id")
        subscription = self.db.query(Subscription).filter(
            Subscription.stripe_subscription_id == stripe_sub_id
        ).first()

        if subscription:
            subscription.status = 'canceled'
            subscription.canceled_at = datetime.utcnow()

            # Update tier subscriber count
            tier = self.db.query(SubscriptionTier).filter(
                SubscriptionTier.id == subscription.tier_id
            ).first()
            if tier and tier.current_subscribers > 0:
                tier.current_subscribers -= 1

            # Update creator's subscriber count
            creator = self.db.query(User).filter(
                User.id == subscription.creator_id
            ).first()
            if creator and creator.subscriber_count > 0:
                creator.subscriber_count -= 1

            self.db.commit()

        return {"handled": True, "event_type": "customer.subscription.deleted"}

    async def _handle_invoice_paid(self, invoice_data: Dict) -> Dict:
        """Handle successful subscription invoice payment."""
        from .models import Transaction, Subscription

        sub_id = invoice_data.get("subscription")
        if not sub_id:
            return {"handled": False, "reason": "not_subscription_invoice"}

        subscription = self.db.query(Subscription).filter(
            Subscription.stripe_subscription_id == sub_id
        ).first()

        if subscription:
            amount_cents = invoice_data.get("amount_paid", 0)
            amount = Decimal(amount_cents) / 100
            creator_amount = amount * CREATOR_REVENUE_SHARE

            # Create transaction record
            transaction = Transaction(
                user_id=subscription.creator_id,
                transaction_type="subscription_payment",
                amount=float(amount),
                fee=float(amount * PLATFORM_FEE_PERCENT),
                net_amount=float(creator_amount),
                status="completed",
                stripe_payment_intent_id=invoice_data.get("payment_intent"),
                description=f"Subscription payment from user {subscription.subscriber_id}",
            )
            self.db.add(transaction)
            self.db.commit()

        return {"handled": True, "event_type": "invoice.payment_succeeded"}

    async def _handle_invoice_failed(self, invoice_data: Dict) -> Dict:
        """Handle failed subscription invoice payment."""
        from .models import Subscription, Notification

        sub_id = invoice_data.get("subscription")
        if not sub_id:
            return {"handled": False, "reason": "not_subscription_invoice"}

        subscription = self.db.query(Subscription).filter(
            Subscription.stripe_subscription_id == sub_id
        ).first()

        if subscription:
            subscription.status = 'past_due'

            # Notify subscriber
            notification = Notification(
                user_id=subscription.subscriber_id,
                notification_type="subscription",
                title="Subscription Payment Failed",
                message="Your subscription payment failed. Please update your payment method.",
            )
            self.db.add(notification)
            self.db.commit()

        return {"handled": True, "event_type": "invoice.payment_failed"}

    # =========================================================================
    # Helper Methods
    # =========================================================================

    def _tier_to_dict(self, tier) -> Dict[str, Any]:
        """Convert SubscriptionTier to dict."""
        return {
            "id": tier.id,
            "creator_id": tier.creator_id,
            "name": tier.name,
            "description": tier.description,
            "price": tier.price,
            "currency": tier.currency,
            "billing_period": tier.billing_period,
            "benefits": tier.benefits or [],
            "badge_url": tier.badge_url,
            "emote_slots": tier.emote_slots,
            "max_subscribers": tier.max_subscribers,
            "current_subscribers": tier.current_subscribers,
            "is_active": tier.is_active,
            "sort_order": tier.sort_order,
            "created_at": tier.created_at.isoformat() if tier.created_at else None,
        }

    def _subscription_to_dict(self, sub) -> Dict[str, Any]:
        """Convert Subscription to dict."""
        return {
            "id": sub.id,
            "subscriber_id": sub.subscriber_id,
            "creator_id": sub.creator_id,
            "tier_id": sub.tier_id,
            "status": sub.status,
            "current_period_start": sub.current_period_start.isoformat() if sub.current_period_start else None,
            "current_period_end": sub.current_period_end.isoformat() if sub.current_period_end else None,
            "cancel_at_period_end": sub.cancel_at_period_end,
            "canceled_at": sub.canceled_at.isoformat() if sub.canceled_at else None,
            "gift_from_user_id": sub.gift_from_user_id,
            "created_at": sub.created_at.isoformat() if sub.created_at else None,
        }


# Convenience function to get service instance
def get_subscription_service(db: Session) -> SubscriptionService:
    """Get a SubscriptionService instance with the given database session."""
    return SubscriptionService(db)
