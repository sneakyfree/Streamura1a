"""
Streamura Virtual Goods Service (Phase 10)

Handles virtual goods (badges, emotes, effects, stickers), inventory management,
and purchasing/gifting functionality.

This module provides:
- Creator virtual goods management
- User inventory management
- Purchase flow (deducts from balance)
- Gifting between users
- Tier-exclusive goods management
"""

import os
import logging
from decimal import Decimal
from datetime import datetime
from typing import Optional, Dict, Any, List
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_

logger = logging.getLogger(__name__)

# Revenue split for virtual goods (same as tips/subscriptions)
PLATFORM_FEE_PERCENT = Decimal("0.30")
CREATOR_REVENUE_SHARE = Decimal("0.70")


class VirtualGoodsError(Exception):
    """Custom exception for virtual goods-related errors"""
    def __init__(self, message: str, code: str = "virtual_goods_error"):
        self.message = message
        self.code = code
        super().__init__(self.message)


class VirtualGoodsService:
    """
    Main service class for virtual goods operations.
    """

    def __init__(self, db: Session):
        self.db = db

    # =========================================================================
    # Virtual Goods Management
    # =========================================================================

    async def create_good(
        self,
        creator_id: Optional[int],  # None for platform goods
        name: str,
        good_type: str,
        price: float,
        description: Optional[str] = None,
        currency: str = "USD",
        image_url: Optional[str] = None,
        animation_url: Optional[str] = None,
        is_limited: bool = False,
        quantity_available: Optional[int] = None,
        tier_exclusive_id: Optional[int] = None,
    ) -> Dict[str, Any]:
        """
        Create a new virtual good.

        Args:
            creator_id: ID of the creator (None for platform goods)
            name: Good name
            good_type: Type ('badge', 'emote', 'effect', 'sticker')
            price: Price in currency
            description: Description
            currency: Currency code
            image_url: URL to static image
            animation_url: URL to animation (for animated goods)
            is_limited: Whether this is a limited edition
            quantity_available: Number available (None = unlimited)
            tier_exclusive_id: If set, only available to subscribers of this tier

        Returns:
            Dict with good details
        """
        from .models import VirtualGood, User, SubscriptionTier

        # Validate type
        valid_types = ['badge', 'emote', 'effect', 'sticker']
        if good_type not in valid_types:
            raise VirtualGoodsError(
                f"Invalid type. Must be one of: {valid_types}",
                "invalid_type"
            )

        # Validate creator if specified
        if creator_id:
            creator = self.db.query(User).filter(User.id == creator_id).first()
            if not creator:
                raise VirtualGoodsError("Creator not found", "creator_not_found")

        # Validate tier if specified
        if tier_exclusive_id:
            tier = self.db.query(SubscriptionTier).filter(
                SubscriptionTier.id == tier_exclusive_id
            ).first()
            if not tier:
                raise VirtualGoodsError("Tier not found", "tier_not_found")

        good = VirtualGood(
            creator_id=creator_id,
            name=name,
            description=description,
            type=good_type,
            price=price,
            currency=currency,
            image_url=image_url,
            animation_url=animation_url,
            is_limited=is_limited,
            quantity_available=quantity_available,
            tier_exclusive_id=tier_exclusive_id,
            is_active=True,
        )
        self.db.add(good)
        self.db.commit()
        self.db.refresh(good)

        logger.info(f"Created virtual good '{name}' by creator {creator_id}")

        return self._good_to_dict(good)

    async def update_good(
        self,
        good_id: int,
        creator_id: int,
        **updates
    ) -> Dict[str, Any]:
        """
        Update a virtual good.

        Note: Cannot change type or reduce quantity below sold amount.
        """
        from .models import VirtualGood

        good = self.db.query(VirtualGood).filter(
            and_(
                VirtualGood.id == good_id,
                VirtualGood.creator_id == creator_id
            )
        ).first()

        if not good:
            raise VirtualGoodsError("Good not found", "good_not_found")

        # Allowed updates
        allowed_fields = [
            'name', 'description', 'price', 'image_url', 'animation_url',
            'is_limited', 'quantity_available', 'is_active', 'tier_exclusive_id'
        ]

        for field in allowed_fields:
            if field in updates:
                # Validate quantity if updating
                if field == 'quantity_available' and updates[field] is not None:
                    if updates[field] < good.quantity_sold:
                        raise VirtualGoodsError(
                            f"Cannot set quantity below already sold ({good.quantity_sold})",
                            "invalid_quantity"
                        )
                setattr(good, field, updates[field])

        self.db.commit()
        self.db.refresh(good)

        return self._good_to_dict(good)

    async def delete_good(self, good_id: int, creator_id: int) -> Dict[str, Any]:
        """
        Deactivate a virtual good.
        Does not actually delete - existing inventory remains valid.
        """
        from .models import VirtualGood

        good = self.db.query(VirtualGood).filter(
            and_(
                VirtualGood.id == good_id,
                VirtualGood.creator_id == creator_id
            )
        ).first()

        if not good:
            raise VirtualGoodsError("Good not found", "good_not_found")

        good.is_active = False
        self.db.commit()

        return {"success": True, "message": "Good deactivated"}

    async def get_goods(
        self,
        creator_id: Optional[int] = None,
        good_type: Optional[str] = None,
        include_inactive: bool = False,
        include_platform: bool = True,
        limit: int = 50,
        offset: int = 0,
    ) -> Dict[str, Any]:
        """
        Get virtual goods with filtering.

        Args:
            creator_id: Filter by creator (None for all)
            good_type: Filter by type
            include_inactive: Include deactivated goods
            include_platform: Include platform goods (creator_id is None)
            limit: Max results
            offset: Results offset

        Returns:
            Dict with goods list and pagination
        """
        from .models import VirtualGood

        query = self.db.query(VirtualGood)

        if creator_id is not None:
            if include_platform:
                query = query.filter(
                    or_(
                        VirtualGood.creator_id == creator_id,
                        VirtualGood.creator_id.is_(None)
                    )
                )
            else:
                query = query.filter(VirtualGood.creator_id == creator_id)
        elif not include_platform:
            query = query.filter(VirtualGood.creator_id.isnot(None))

        if good_type:
            query = query.filter(VirtualGood.type == good_type)

        if not include_inactive:
            query = query.filter(VirtualGood.is_active == True)

        total = query.count()
        goods = query.order_by(VirtualGood.created_at.desc()).offset(offset).limit(limit).all()

        return {
            "goods": [self._good_to_dict(g) for g in goods],
            "total": total,
            "limit": limit,
            "offset": offset,
        }

    async def get_good(self, good_id: int) -> Dict[str, Any]:
        """Get a specific good by ID."""
        from .models import VirtualGood

        good = self.db.query(VirtualGood).filter(VirtualGood.id == good_id).first()

        if not good:
            raise VirtualGoodsError("Good not found", "good_not_found")

        return self._good_to_dict(good)

    # =========================================================================
    # Purchase & Inventory
    # =========================================================================

    async def purchase(
        self,
        user_id: int,
        good_id: int,
        quantity: int = 1
    ) -> Dict[str, Any]:
        """
        Purchase a virtual good using account balance.

        Args:
            user_id: ID of the buyer
            good_id: ID of the good to purchase
            quantity: Number to purchase

        Returns:
            Dict with purchase details
        """
        from .models import VirtualGood, User, UserInventory, Transaction, SubscriptionTier
        from .subscriptions import get_subscription_service

        if quantity < 1:
            raise VirtualGoodsError("Quantity must be at least 1", "invalid_quantity")

        good = self.db.query(VirtualGood).filter(
            and_(VirtualGood.id == good_id, VirtualGood.is_active == True)
        ).first()

        if not good:
            raise VirtualGoodsError("Good not found or inactive", "good_not_found")

        user = self.db.query(User).filter(User.id == user_id).first()
        if not user:
            raise VirtualGoodsError("User not found", "user_not_found")

        # Check tier exclusivity
        if good.tier_exclusive_id:
            sub_service = get_subscription_service(self.db)
            sub_status = await sub_service.is_subscribed(
                subscriber_id=user_id,
                creator_id=good.creator_id,
                min_tier_id=good.tier_exclusive_id
            )
            if not sub_status["is_subscribed"] or not sub_status.get("meets_minimum_tier", False):
                raise VirtualGoodsError(
                    "This item is exclusive to subscribers",
                    "tier_required"
                )

        # Check availability
        if good.is_limited and good.quantity_available is not None:
            available = good.quantity_available - good.quantity_sold
            if quantity > available:
                raise VirtualGoodsError(
                    f"Only {available} available",
                    "insufficient_stock"
                )

        # Calculate total cost
        total_cost = Decimal(str(good.price)) * quantity

        # Check balance
        if Decimal(str(user.balance or 0)) < total_cost:
            raise VirtualGoodsError(
                f"Insufficient balance. Need ${float(total_cost):.2f}",
                "insufficient_balance"
            )

        # Deduct from user balance
        user.balance = float(Decimal(str(user.balance or 0)) - total_cost)

        # Calculate creator's share
        creator_amount = total_cost * CREATOR_REVENUE_SHARE
        platform_fee = total_cost * PLATFORM_FEE_PERCENT

        # Credit creator if applicable
        if good.creator_id:
            creator = self.db.query(User).filter(User.id == good.creator_id).first()
            if creator:
                creator.balance = float(Decimal(str(creator.balance or 0)) + creator_amount)
                creator.lifetime_earnings = float(
                    Decimal(str(creator.lifetime_earnings or 0)) + creator_amount
                )

                # Create transaction for creator
                creator_transaction = Transaction(
                    user_id=creator.id,
                    transaction_type="virtual_good_sale",
                    amount=float(total_cost),
                    fee=float(platform_fee),
                    net_amount=float(creator_amount),
                    status="completed",
                    description=f"Sale of {quantity}x {good.name}",
                )
                self.db.add(creator_transaction)

        # Create purchase transaction for buyer
        buyer_transaction = Transaction(
            user_id=user_id,
            transaction_type="virtual_good_purchase",
            amount=float(total_cost),
            status="completed",
            description=f"Purchased {quantity}x {good.name}",
        )
        self.db.add(buyer_transaction)

        # Update inventory
        existing_inventory = self.db.query(UserInventory).filter(
            and_(
                UserInventory.user_id == user_id,
                UserInventory.good_id == good_id
            )
        ).first()

        if existing_inventory:
            existing_inventory.quantity += quantity
        else:
            inventory = UserInventory(
                user_id=user_id,
                good_id=good_id,
                quantity=quantity,
            )
            self.db.add(inventory)

        # Update sold count
        good.quantity_sold = (good.quantity_sold or 0) + quantity

        self.db.commit()

        logger.info(f"User {user_id} purchased {quantity}x good {good_id}")

        return {
            "success": True,
            "good_id": good_id,
            "good_name": good.name,
            "quantity": quantity,
            "total_cost": float(total_cost),
            "new_balance": user.balance,
        }

    async def gift(
        self,
        from_user_id: int,
        to_user_id: int,
        good_id: int,
        quantity: int = 1
    ) -> Dict[str, Any]:
        """
        Gift a virtual good from one user to another.

        Uses sender's balance to purchase and transfers to recipient.
        """
        from .models import VirtualGood, User, UserInventory, Transaction

        if from_user_id == to_user_id:
            raise VirtualGoodsError("Cannot gift to yourself", "self_gift")

        if quantity < 1:
            raise VirtualGoodsError("Quantity must be at least 1", "invalid_quantity")

        good = self.db.query(VirtualGood).filter(
            and_(VirtualGood.id == good_id, VirtualGood.is_active == True)
        ).first()

        if not good:
            raise VirtualGoodsError("Good not found or inactive", "good_not_found")

        from_user = self.db.query(User).filter(User.id == from_user_id).first()
        to_user = self.db.query(User).filter(User.id == to_user_id).first()

        if not from_user:
            raise VirtualGoodsError("Sender not found", "user_not_found")
        if not to_user:
            raise VirtualGoodsError("Recipient not found", "recipient_not_found")

        # Check availability
        if good.is_limited and good.quantity_available is not None:
            available = good.quantity_available - good.quantity_sold
            if quantity > available:
                raise VirtualGoodsError(
                    f"Only {available} available",
                    "insufficient_stock"
                )

        # Calculate total cost
        total_cost = Decimal(str(good.price)) * quantity

        # Check balance
        if Decimal(str(from_user.balance or 0)) < total_cost:
            raise VirtualGoodsError(
                f"Insufficient balance. Need ${float(total_cost):.2f}",
                "insufficient_balance"
            )

        # Deduct from sender
        from_user.balance = float(Decimal(str(from_user.balance or 0)) - total_cost)

        # Calculate creator's share
        creator_amount = total_cost * CREATOR_REVENUE_SHARE
        platform_fee = total_cost * PLATFORM_FEE_PERCENT

        # Credit creator if applicable
        if good.creator_id:
            creator = self.db.query(User).filter(User.id == good.creator_id).first()
            if creator:
                creator.balance = float(Decimal(str(creator.balance or 0)) + creator_amount)
                creator.lifetime_earnings = float(
                    Decimal(str(creator.lifetime_earnings or 0)) + creator_amount
                )

                # Create transaction for creator
                creator_transaction = Transaction(
                    user_id=creator.id,
                    transaction_type="virtual_good_sale",
                    amount=float(total_cost),
                    fee=float(platform_fee),
                    net_amount=float(creator_amount),
                    status="completed",
                    description=f"Gift sale of {quantity}x {good.name}",
                )
                self.db.add(creator_transaction)

        # Create gift transaction
        gift_transaction = Transaction(
            user_id=from_user_id,
            transaction_type="virtual_good_gift",
            amount=float(total_cost),
            status="completed",
            description=f"Gifted {quantity}x {good.name} to {to_user.username or to_user.display_name}",
        )
        self.db.add(gift_transaction)

        # Update recipient inventory
        existing_inventory = self.db.query(UserInventory).filter(
            and_(
                UserInventory.user_id == to_user_id,
                UserInventory.good_id == good_id
            )
        ).first()

        if existing_inventory:
            existing_inventory.quantity += quantity
        else:
            inventory = UserInventory(
                user_id=to_user_id,
                good_id=good_id,
                quantity=quantity,
                gifted_from_user_id=from_user_id,
            )
            self.db.add(inventory)

        # Update sold count
        good.quantity_sold = (good.quantity_sold or 0) + quantity

        self.db.commit()

        logger.info(f"User {from_user_id} gifted {quantity}x good {good_id} to user {to_user_id}")

        return {
            "success": True,
            "good_id": good_id,
            "good_name": good.name,
            "quantity": quantity,
            "recipient_id": to_user_id,
            "recipient_name": to_user.username or to_user.display_name,
            "total_cost": float(total_cost),
            "new_balance": from_user.balance,
        }

    # =========================================================================
    # Inventory Management
    # =========================================================================

    async def get_inventory(
        self,
        user_id: int,
        good_type: Optional[str] = None,
        limit: int = 100,
        offset: int = 0,
    ) -> Dict[str, Any]:
        """Get a user's inventory."""
        from .models import UserInventory, VirtualGood

        query = self.db.query(UserInventory).filter(
            UserInventory.user_id == user_id
        )

        if good_type:
            query = query.join(VirtualGood).filter(VirtualGood.type == good_type)

        total = query.count()
        items = query.offset(offset).limit(limit).all()

        inventory = []
        for item in items:
            good = self.db.query(VirtualGood).filter(
                VirtualGood.id == item.good_id
            ).first()
            if good:
                inventory.append({
                    "inventory_id": item.id,
                    "good_id": item.good_id,
                    "name": good.name,
                    "type": good.type,
                    "description": good.description,
                    "image_url": good.image_url,
                    "animation_url": good.animation_url,
                    "quantity": item.quantity,
                    "is_equipped": item.is_equipped,
                    "gifted_from_user_id": item.gifted_from_user_id,
                    "purchased_at": item.purchased_at.isoformat() if item.purchased_at else None,
                })

        return {
            "inventory": inventory,
            "total": total,
            "limit": limit,
            "offset": offset,
        }

    async def equip_good(
        self,
        user_id: int,
        inventory_id: int,
        equip: bool = True
    ) -> Dict[str, Any]:
        """
        Equip or unequip an item (badges, effects).

        For badges/effects, only one of each type can be equipped at a time.
        """
        from .models import UserInventory, VirtualGood

        item = self.db.query(UserInventory).filter(
            and_(
                UserInventory.id == inventory_id,
                UserInventory.user_id == user_id
            )
        ).first()

        if not item:
            raise VirtualGoodsError("Item not found in inventory", "item_not_found")

        good = self.db.query(VirtualGood).filter(VirtualGood.id == item.good_id).first()
        if not good:
            raise VirtualGoodsError("Good not found", "good_not_found")

        # Only badges and effects can be equipped
        equippable_types = ['badge', 'effect']
        if good.type not in equippable_types:
            raise VirtualGoodsError(
                f"Only {equippable_types} can be equipped",
                "not_equippable"
            )

        if equip:
            # Unequip other items of the same type
            other_items = self.db.query(UserInventory).join(VirtualGood).filter(
                and_(
                    UserInventory.user_id == user_id,
                    UserInventory.is_equipped == True,
                    VirtualGood.type == good.type,
                    UserInventory.id != inventory_id
                )
            ).all()

            for other in other_items:
                other.is_equipped = False

        item.is_equipped = equip
        self.db.commit()

        return {
            "success": True,
            "inventory_id": inventory_id,
            "is_equipped": equip,
            "good_name": good.name,
            "good_type": good.type,
        }

    async def get_equipped(
        self,
        user_id: int,
        good_type: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """Get user's currently equipped items."""
        from .models import UserInventory, VirtualGood

        query = self.db.query(UserInventory).join(VirtualGood).filter(
            and_(
                UserInventory.user_id == user_id,
                UserInventory.is_equipped == True
            )
        )

        if good_type:
            query = query.filter(VirtualGood.type == good_type)

        items = query.all()
        equipped = []

        for item in items:
            good = self.db.query(VirtualGood).filter(
                VirtualGood.id == item.good_id
            ).first()
            if good:
                equipped.append({
                    "inventory_id": item.id,
                    "good_id": item.good_id,
                    "name": good.name,
                    "type": good.type,
                    "image_url": good.image_url,
                    "animation_url": good.animation_url,
                })

        return equipped

    async def has_good(self, user_id: int, good_id: int) -> bool:
        """Check if a user owns a specific good."""
        from .models import UserInventory

        item = self.db.query(UserInventory).filter(
            and_(
                UserInventory.user_id == user_id,
                UserInventory.good_id == good_id,
                UserInventory.quantity > 0
            )
        ).first()

        return item is not None

    # =========================================================================
    # Helper Methods
    # =========================================================================

    def _good_to_dict(self, good) -> Dict[str, Any]:
        """Convert VirtualGood to dict."""
        available = None
        if good.is_limited and good.quantity_available is not None:
            available = good.quantity_available - (good.quantity_sold or 0)

        return {
            "id": good.id,
            "creator_id": good.creator_id,
            "name": good.name,
            "description": good.description,
            "type": good.type,
            "price": good.price,
            "currency": good.currency,
            "image_url": good.image_url,
            "animation_url": good.animation_url,
            "is_limited": good.is_limited,
            "quantity_available": available,
            "quantity_sold": good.quantity_sold,
            "is_active": good.is_active,
            "tier_exclusive_id": good.tier_exclusive_id,
            "created_at": good.created_at.isoformat() if good.created_at else None,
        }


# Convenience function to get service instance
def get_virtual_goods_service(db: Session) -> VirtualGoodsService:
    """Get a VirtualGoodsService instance with the given database session."""
    return VirtualGoodsService(db)
