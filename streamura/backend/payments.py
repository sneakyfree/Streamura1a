"""
Streamura Payments Service

Stripe Connect integration for creator monetization.

This module handles:
- Creator account onboarding (Stripe Connect Express)
- Tip processing (PaymentIntents)
- Revenue splits (Transfers)
- Payouts to creator bank accounts

Revenue Split: 70% creator / 30% platform
"""

import os
import stripe
import logging
from decimal import Decimal
from datetime import datetime
from typing import Optional, Dict, Any
from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)

# Configuration
STRIPE_SECRET_KEY = os.getenv("STRIPE_SECRET_KEY")
STRIPE_WEBHOOK_SECRET = os.getenv("STRIPE_WEBHOOK_SECRET")
STRIPE_PLATFORM_FEE_PERCENT = Decimal("0.30")  # 30% platform fee
CREATOR_REVENUE_SHARE = Decimal("0.70")  # 70% to creator
MINIMUM_TIP_AMOUNT = Decimal("1.00")
MAXIMUM_TIP_AMOUNT = Decimal("500.00")
MINIMUM_PAYOUT_AMOUNT = Decimal("5.00")

# Initialize Stripe
if STRIPE_SECRET_KEY:
    stripe.api_key = STRIPE_SECRET_KEY
else:
    logger.warning("STRIPE_SECRET_KEY not set - payment features will be disabled")


class PaymentError(Exception):
    """Custom exception for payment-related errors"""
    def __init__(self, message: str, code: str = "payment_error"):
        self.message = message
        self.code = code
        super().__init__(self.message)


class StripeService:
    """
    Main service class for Stripe operations.
    All methods handle errors gracefully and log appropriately.
    """

    def __init__(self, db: Session):
        self.db = db

    async def create_connect_account(
        self,
        user_id: int,
        email: str,
        country: str = "US"
    ) -> Dict[str, Any]:
        """
        Create a Stripe Connect Express account for a creator.

        Args:
            user_id: Internal user ID
            email: Creator's email address
            country: Two-letter country code

        Returns:
            Dict with account_id and account_created flag

        Raises:
            PaymentError: If account creation fails
        """
        if not STRIPE_SECRET_KEY:
            raise PaymentError("Payment system not configured", "not_configured")

        try:
            # Create Express account
            account = stripe.Account.create(
                type="express",
                email=email,
                country=country,
                capabilities={
                    "card_payments": {"requested": True},
                    "transfers": {"requested": True},
                },
                metadata={
                    "user_id": str(user_id),
                    "platform": "streamura",
                }
            )

            logger.info(f"Created Stripe account {account.id} for user {user_id}")

            return {
                "account_id": account.id,
                "account_created": True,
            }

        except stripe.error.StripeError as e:
            logger.error(f"Stripe account creation failed for user {user_id}: {e}")
            raise PaymentError(
                message=f"Failed to create payment account: {str(e)}",
                code="account_creation_failed"
            )

    async def create_onboarding_link(
        self,
        account_id: str,
        return_url: str,
        refresh_url: str
    ) -> str:
        """
        Generate Stripe Connect onboarding URL.

        The user is redirected to this URL to complete identity
        verification and bank account setup.

        Args:
            account_id: Stripe Connect account ID
            return_url: URL after successful onboarding
            refresh_url: URL if onboarding link expires

        Returns:
            Onboarding URL string
        """
        if not STRIPE_SECRET_KEY:
            raise PaymentError("Payment system not configured", "not_configured")

        try:
            link = stripe.AccountLink.create(
                account=account_id,
                return_url=return_url,
                refresh_url=refresh_url,
                type="account_onboarding",
            )

            return link.url

        except stripe.error.StripeError as e:
            logger.error(f"Failed to create onboarding link for {account_id}: {e}")
            raise PaymentError(
                message="Failed to generate onboarding link",
                code="onboarding_link_failed"
            )

    async def get_account_status(self, account_id: str) -> Dict[str, Any]:
        """
        Check the status of a Stripe Connect account.

        Returns details about:
        - Whether onboarding is complete
        - Whether payouts are enabled
        - Whether charges are enabled
        - Any pending requirements

        Args:
            account_id: Stripe Connect account ID

        Returns:
            Dict with account status details
        """
        if not STRIPE_SECRET_KEY:
            raise PaymentError("Payment system not configured", "not_configured")

        try:
            account = stripe.Account.retrieve(account_id)

            return {
                "account_id": account.id,
                "charges_enabled": account.charges_enabled,
                "payouts_enabled": account.payouts_enabled,
                "details_submitted": account.details_submitted,
                "onboarding_complete": (
                    account.charges_enabled and
                    account.payouts_enabled and
                    account.details_submitted
                ),
                "requirements": {
                    "currently_due": account.requirements.currently_due or [],
                    "eventually_due": account.requirements.eventually_due or [],
                    "past_due": account.requirements.past_due or [],
                },
                "country": account.country,
                "default_currency": account.default_currency,
            }

        except stripe.error.StripeError as e:
            logger.error(f"Failed to retrieve account {account_id}: {e}")
            raise PaymentError(
                message="Failed to retrieve account status",
                code="account_retrieve_failed"
            )

    async def create_tip_payment_intent(
        self,
        amount: Decimal,
        currency: str,
        creator_account_id: str,
        tipper_customer_id: Optional[str],
        stream_id: int,
        message: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Create a PaymentIntent for a tip with automatic platform fee.

        Uses Stripe Connect's destination charges to automatically
        split the payment between platform and creator.

        Args:
            amount: Tip amount in dollars
            currency: Three-letter currency code (e.g., "usd")
            creator_account_id: Creator's Stripe Connect account ID
            tipper_customer_id: Tipper's Stripe customer ID (optional)
            stream_id: ID of the stream being tipped
            message: Optional tip message

        Returns:
            Dict with payment_intent_id and client_secret
        """
        if not STRIPE_SECRET_KEY:
            raise PaymentError("Payment system not configured", "not_configured")

        # Validate amount
        if amount < MINIMUM_TIP_AMOUNT:
            raise PaymentError(
                message=f"Minimum tip is ${MINIMUM_TIP_AMOUNT}",
                code="tip_below_minimum"
            )
        if amount > MAXIMUM_TIP_AMOUNT:
            raise PaymentError(
                message=f"Maximum tip is ${MAXIMUM_TIP_AMOUNT}",
                code="tip_above_maximum"
            )

        # Convert to cents for Stripe
        amount_cents = int(amount * 100)
        platform_fee_cents = int(amount_cents * float(STRIPE_PLATFORM_FEE_PERCENT))

        try:
            intent_params = {
                "amount": amount_cents,
                "currency": currency.lower(),
                "application_fee_amount": platform_fee_cents,
                "transfer_data": {
                    "destination": creator_account_id,
                },
                "metadata": {
                    "type": "tip",
                    "stream_id": str(stream_id),
                    "message": message or "",
                    "platform": "streamura",
                },
            }

            # Attach customer if provided
            if tipper_customer_id:
                intent_params["customer"] = tipper_customer_id

            payment_intent = stripe.PaymentIntent.create(**intent_params)

            logger.info(
                f"Created tip PaymentIntent {payment_intent.id} "
                f"for ${amount} to account {creator_account_id}"
            )

            return {
                "payment_intent_id": payment_intent.id,
                "client_secret": payment_intent.client_secret,
                "amount": float(amount),
                "currency": currency,
                "platform_fee": float(platform_fee_cents / 100),
                "creator_amount": float((amount_cents - platform_fee_cents) / 100),
            }

        except stripe.error.StripeError as e:
            logger.error(f"Failed to create tip PaymentIntent: {e}")
            raise PaymentError(
                message="Failed to process tip payment",
                code="payment_intent_failed"
            )

    async def request_payout(
        self,
        account_id: str,
        amount: Decimal,
        currency: str = "usd"
    ) -> Dict[str, Any]:
        """
        Request a payout from creator's Stripe balance to their bank.

        Note: Payouts are typically automatic with Stripe Connect Express,
        but this allows manual/instant payouts if needed.

        Args:
            account_id: Creator's Stripe Connect account ID
            amount: Amount to pay out
            currency: Currency code

        Returns:
            Dict with payout details
        """
        if not STRIPE_SECRET_KEY:
            raise PaymentError("Payment system not configured", "not_configured")

        if amount < MINIMUM_PAYOUT_AMOUNT:
            raise PaymentError(
                message=f"Minimum payout is ${MINIMUM_PAYOUT_AMOUNT}",
                code="payout_below_minimum"
            )

        amount_cents = int(amount * 100)

        try:
            # Check available balance first
            balance = stripe.Balance.retrieve(
                stripe_account=account_id
            )

            available_cents = sum(
                b.amount for b in balance.available
                if b.currency == currency.lower()
            )

            if amount_cents > available_cents:
                raise PaymentError(
                    message=f"Insufficient balance. Available: ${available_cents/100:.2f}",
                    code="insufficient_balance"
                )

            # Create payout
            payout = stripe.Payout.create(
                amount=amount_cents,
                currency=currency.lower(),
                stripe_account=account_id,
                metadata={
                    "platform": "streamura",
                    "type": "creator_payout",
                }
            )

            logger.info(f"Created payout {payout.id} for ${amount} to account {account_id}")

            return {
                "payout_id": payout.id,
                "amount": float(amount),
                "currency": currency,
                "status": payout.status,
                "arrival_date": payout.arrival_date,
            }

        except stripe.error.StripeError as e:
            logger.error(f"Failed to create payout for {account_id}: {e}")
            raise PaymentError(
                message="Failed to process payout",
                code="payout_failed"
            )

    async def handle_webhook(
        self,
        payload: bytes,
        signature: str
    ) -> Dict[str, Any]:
        """
        Process Stripe webhook events.

        Important events to handle:
        - account.updated: Connect account status changed
        - payment_intent.succeeded: Tip payment completed
        - payment_intent.payment_failed: Tip payment failed
        - payout.paid: Payout completed
        - payout.failed: Payout failed

        Args:
            payload: Raw request body
            signature: Stripe-Signature header

        Returns:
            Dict indicating how event was handled
        """
        if not STRIPE_WEBHOOK_SECRET:
            raise PaymentError("Webhook secret not configured", "not_configured")

        try:
            event = stripe.Webhook.construct_event(
                payload,
                signature,
                STRIPE_WEBHOOK_SECRET
            )
        except ValueError as e:
            logger.error(f"Invalid webhook payload: {e}")
            raise PaymentError("Invalid payload", "invalid_payload")
        except stripe.error.SignatureVerificationError as e:
            logger.error(f"Invalid webhook signature: {e}")
            raise PaymentError("Invalid signature", "invalid_signature")

        event_type = event.type
        event_data = event.data.object

        logger.info(f"Processing webhook: {event_type}")

        handlers = {
            "account.updated": self._handle_account_updated,
            "payment_intent.succeeded": self._handle_payment_succeeded,
            "payment_intent.payment_failed": self._handle_payment_failed,
            "payout.paid": self._handle_payout_paid,
            "payout.failed": self._handle_payout_failed,
            # Subscription events (Phase 10)
            "customer.subscription.created": self._handle_subscription_event,
            "customer.subscription.updated": self._handle_subscription_event,
            "customer.subscription.deleted": self._handle_subscription_event,
            "invoice.paid": self._handle_invoice_event,
            "invoice.payment_failed": self._handle_invoice_event,
            # Checkout session for subscriptions
            "checkout.session.completed": self._handle_checkout_completed,
        }

        handler = handlers.get(event_type)
        if handler:
            return await handler(event_data, event_type)

        return {"handled": False, "event_type": event_type}

    async def _handle_account_updated(self, account_data: Dict, event_type: str = "account.updated") -> Dict:
        """Update user's Stripe status when account changes"""
        from .models import User

        account_id = account_data.get("id")

        user = self.db.query(User).filter(
            User.stripe_account_id == account_id
        ).first()

        if user:
            user.stripe_onboarding_complete = (
                account_data.get("charges_enabled", False) and
                account_data.get("payouts_enabled", False) and
                account_data.get("details_submitted", False)
            )
            user.payout_enabled = account_data.get("payouts_enabled", False)
            self.db.commit()

            logger.info(f"Updated Stripe status for user {user.id}")

        return {"handled": True, "event_type": event_type}

    async def _handle_payment_succeeded(self, payment_data: Dict, event_type: str = "payment_intent.succeeded") -> Dict:
        """Process successful tip payment"""
        from .models import Transaction, Tip, Stream, User, Notification

        metadata = payment_data.get("metadata", {})

        if metadata.get("type") != "tip":
            return {"handled": False, "reason": "not_a_tip"}

        stream_id = int(metadata.get("stream_id", 0))
        amount_cents = payment_data.get("amount", 0)
        amount = Decimal(amount_cents) / 100

        # Get stream and creator
        stream = self.db.query(Stream).filter(Stream.id == stream_id).first()
        if not stream:
            logger.warning(f"Stream {stream_id} not found for tip")
            return {"handled": False, "reason": "stream_not_found"}

        creator = self.db.query(User).filter(User.id == stream.user_id).first()
        if not creator:
            logger.warning(f"Creator not found for stream {stream_id}")
            return {"handled": False, "reason": "creator_not_found"}

        # Calculate creator's portion (70%)
        creator_amount = amount * CREATOR_REVENUE_SHARE
        platform_fee = amount * STRIPE_PLATFORM_FEE_PERCENT

        # Create transaction record
        transaction = Transaction(
            user_id=creator.id,
            stream_id=stream_id,
            transaction_type="tip_received",
            amount=float(amount),
            fee=float(platform_fee),
            net_amount=float(creator_amount),
            status="completed",
            stripe_payment_intent_id=payment_data.get("id"),
            description=f"Tip received on stream: {stream.title or 'Untitled'}",
        )
        self.db.add(transaction)
        self.db.flush()  # Get transaction ID

        # Update creator balance
        creator.balance = float(Decimal(str(creator.balance or 0)) + creator_amount)
        creator.lifetime_earnings = float(Decimal(str(creator.lifetime_earnings or 0)) + creator_amount)

        # Update stream earnings
        stream.earnings = float(Decimal(str(stream.earnings or 0)) + creator_amount)
        stream.tip_count = (stream.tip_count or 0) + 1

        # Create tip record
        tip = Tip(
            to_user_id=creator.id,
            stream_id=stream_id,
            amount=float(amount),
            message=metadata.get("message", ""),
            status="completed",
            transaction_id=transaction.id,
        )
        self.db.add(tip)

        # Create notification for creator
        notification = Notification(
            user_id=creator.id,
            notification_type="tip_received",
            title="You received a tip!",
            message=f"Someone tipped ${float(amount):.2f} on your stream!",
            stream_id=stream_id,
            transaction_id=transaction.id,
        )
        self.db.add(notification)

        self.db.commit()

        logger.info(f"Processed tip of ${amount} for stream {stream_id}")

        return {
            "handled": True,
            "event_type": "payment_intent.succeeded",
            "tip_amount": float(amount),
            "creator_amount": float(creator_amount),
        }

    async def _handle_payment_failed(self, payment_data: Dict, event_type: str = "payment_intent.payment_failed") -> Dict:
        """Handle failed tip payment"""
        logger.warning(f"Payment failed: {payment_data.get('id')}")
        return {"handled": True, "event_type": event_type}

    async def _handle_payout_paid(self, payout_data: Dict, event_type: str = "payout.paid") -> Dict:
        """Handle successful payout"""
        from .models import Transaction, User, Notification

        account_id = payout_data.get("destination")
        amount_cents = payout_data.get("amount", 0)
        amount = Decimal(amount_cents) / 100

        user = self.db.query(User).filter(
            User.stripe_account_id == account_id
        ).first()

        if user:
            # Create transaction record
            transaction = Transaction(
                user_id=user.id,
                transaction_type="payout_completed",
                amount=float(amount),
                status="completed",
                stripe_payout_id=payout_data.get("id"),
                description="Payout to bank account",
            )
            self.db.add(transaction)
            self.db.flush()

            # Update pending payout
            user.pending_payout = max(
                0.0,
                float(Decimal(str(user.pending_payout or 0)) - amount)
            )

            # Create notification
            notification = Notification(
                user_id=user.id,
                notification_type="payout",
                title="Payout Completed!",
                message=f"${float(amount):.2f} has been sent to your bank account.",
                transaction_id=transaction.id,
            )
            self.db.add(notification)

            self.db.commit()

        return {"handled": True, "event_type": event_type}

    async def _handle_payout_failed(self, payout_data: Dict, event_type: str = "payout.failed") -> Dict:
        """Handle failed payout"""
        from .models import User, Notification

        account_id = payout_data.get("destination")

        user = self.db.query(User).filter(
            User.stripe_account_id == account_id
        ).first()

        if user:
            notification = Notification(
                user_id=user.id,
                notification_type="payout",
                title="Payout Failed",
                message="Your payout could not be processed. Please check your bank details.",
            )
            self.db.add(notification)
            self.db.commit()

        return {"handled": True, "event_type": event_type}

    async def _handle_subscription_event(self, subscription_data: Dict, event_type: str) -> Dict:
        """
        Delegate subscription events to the subscription service.

        Handles:
        - customer.subscription.created
        - customer.subscription.updated
        - customer.subscription.deleted
        """
        from .subscriptions import get_subscription_service

        try:
            subscription_service = get_subscription_service(self.db)
            result = await subscription_service.handle_webhook_event(event_type, subscription_data)
            return result
        except Exception as e:
            logger.error(f"Error handling subscription event {event_type}: {e}")
            return {"handled": False, "event_type": event_type, "error": str(e)}

    async def _handle_invoice_event(self, invoice_data: Dict, event_type: str) -> Dict:
        """
        Delegate invoice events to the subscription service.

        Handles:
        - invoice.paid (successful subscription payment)
        - invoice.payment_failed (failed subscription payment)
        """
        from .subscriptions import get_subscription_service

        # Only handle subscription-related invoices
        subscription_id = invoice_data.get("subscription")
        if not subscription_id:
            return {"handled": False, "reason": "not_subscription_invoice"}

        try:
            subscription_service = get_subscription_service(self.db)
            result = await subscription_service.handle_webhook_event(event_type, invoice_data)
            return result
        except Exception as e:
            logger.error(f"Error handling invoice event {event_type}: {e}")
            return {"handled": False, "event_type": event_type, "error": str(e)}

    async def _handle_checkout_completed(self, session_data: Dict, event_type: str) -> Dict:
        """
        Handle completed checkout sessions.

        This handles both subscription checkouts and one-time purchases.
        """
        mode = session_data.get("mode")

        if mode == "subscription":
            # Delegate to subscription service
            from .subscriptions import get_subscription_service

            try:
                subscription_service = get_subscription_service(self.db)
                result = await subscription_service.handle_webhook_event(event_type, session_data)
                return result
            except Exception as e:
                logger.error(f"Error handling checkout completion: {e}")
                return {"handled": False, "event_type": event_type, "error": str(e)}

        # For other checkout modes (one-time payments), could add handling here
        return {"handled": False, "reason": f"unhandled_checkout_mode_{mode}"}


# Convenience function to get service instance
def get_stripe_service(db: Session) -> StripeService:
    """Get a StripeService instance with the given database session."""
    return StripeService(db)
