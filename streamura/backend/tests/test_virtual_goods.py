"""
Tests for Virtual Goods Service Module

Tests the following functionality:
- Virtual goods creation and management
- Purchase flow with balance deduction
- Gifting between users
- Inventory management
- Equipment system (badges, effects)
"""

import pytest
from decimal import Decimal
from datetime import datetime
from unittest.mock import MagicMock, patch, AsyncMock

from backend.virtual_goods import (
    VirtualGoodsService,
    VirtualGoodsError,
    get_virtual_goods_service,
    PLATFORM_FEE_PERCENT,
    CREATOR_REVENUE_SHARE,
)
from backend.models import VirtualGood, UserInventory, User, Transaction


class TestVirtualGoodsError:
    """Test VirtualGoodsError exception."""

    def test_error_message(self):
        """Test error message is set correctly."""
        error = VirtualGoodsError("Test error", "test_code")

        assert error.message == "Test error"
        assert error.code == "test_code"
        assert str(error) == "Test error"

    def test_default_code(self):
        """Test default error code."""
        error = VirtualGoodsError("Test error")

        assert error.code == "virtual_goods_error"


class TestConstants:
    """Test module constants."""

    def test_platform_fee_percent(self):
        """Test platform fee is reasonable."""
        assert PLATFORM_FEE_PERCENT == Decimal("0.30")

    def test_creator_revenue_share(self):
        """Test creator revenue share is reasonable."""
        assert CREATOR_REVENUE_SHARE == Decimal("0.70")

    def test_fee_plus_share_equals_one(self):
        """Test that fee and share add up to 100%."""
        assert PLATFORM_FEE_PERCENT + CREATOR_REVENUE_SHARE == Decimal("1.00")


class TestCreateGood:
    """Test virtual goods creation."""

    @pytest.mark.asyncio
    async def test_create_good_badge(self, db, test_user):
        """Test creating a badge virtual good."""
        user = test_user["user"]
        service = VirtualGoodsService(db)

        result = await service.create_good(
            creator_id=user.id,
            name="Test Badge",
            good_type="badge",
            price=5.99,
            description="A test badge",
            image_url="https://example.com/badge.png"
        )

        assert result["id"] is not None
        assert result["name"] == "Test Badge"
        assert result["type"] == "badge"
        assert result["price"] == 5.99
        assert result["creator_id"] == user.id
        assert result["is_active"] is True

    @pytest.mark.asyncio
    async def test_create_good_emote(self, db, test_user):
        """Test creating an emote virtual good."""
        user = test_user["user"]
        service = VirtualGoodsService(db)

        result = await service.create_good(
            creator_id=user.id,
            name="Test Emote",
            good_type="emote",
            price=2.99,
            animation_url="https://example.com/emote.gif"
        )

        assert result["type"] == "emote"
        assert result["animation_url"] == "https://example.com/emote.gif"

    @pytest.mark.asyncio
    async def test_create_good_effect(self, db, test_user):
        """Test creating an effect virtual good."""
        user = test_user["user"]
        service = VirtualGoodsService(db)

        result = await service.create_good(
            creator_id=user.id,
            name="Test Effect",
            good_type="effect",
            price=9.99
        )

        assert result["type"] == "effect"

    @pytest.mark.asyncio
    async def test_create_good_sticker(self, db, test_user):
        """Test creating a sticker virtual good."""
        user = test_user["user"]
        service = VirtualGoodsService(db)

        result = await service.create_good(
            creator_id=user.id,
            name="Test Sticker",
            good_type="sticker",
            price=0.99
        )

        assert result["type"] == "sticker"

    @pytest.mark.asyncio
    async def test_create_good_invalid_type(self, db, test_user):
        """Test that invalid type raises error."""
        user = test_user["user"]
        service = VirtualGoodsService(db)

        with pytest.raises(VirtualGoodsError) as exc_info:
            await service.create_good(
                creator_id=user.id,
                name="Invalid",
                good_type="invalid_type",
                price=5.99
            )

        assert exc_info.value.code == "invalid_type"

    @pytest.mark.asyncio
    async def test_create_good_limited_edition(self, db, test_user):
        """Test creating a limited edition good."""
        user = test_user["user"]
        service = VirtualGoodsService(db)

        result = await service.create_good(
            creator_id=user.id,
            name="Limited Badge",
            good_type="badge",
            price=19.99,
            is_limited=True,
            quantity_available=100
        )

        assert result["is_limited"] is True
        assert result["quantity_available"] == 100

    @pytest.mark.asyncio
    async def test_create_good_platform_good(self, db):
        """Test creating a platform good (no creator)."""
        service = VirtualGoodsService(db)

        result = await service.create_good(
            creator_id=None,  # Platform good
            name="Platform Badge",
            good_type="badge",
            price=0.99
        )

        assert result["creator_id"] is None

    @pytest.mark.asyncio
    async def test_create_good_nonexistent_creator(self, db):
        """Test creating good with nonexistent creator raises error."""
        service = VirtualGoodsService(db)

        with pytest.raises(VirtualGoodsError) as exc_info:
            await service.create_good(
                creator_id=99999,
                name="Test",
                good_type="badge",
                price=5.99
            )

        assert exc_info.value.code == "creator_not_found"


class TestUpdateGood:
    """Test virtual goods update."""

    @pytest.mark.asyncio
    async def test_update_good_price(self, db, test_user):
        """Test updating good price."""
        user = test_user["user"]
        service = VirtualGoodsService(db)

        # Create a good first
        good = await service.create_good(
            creator_id=user.id,
            name="Test Badge",
            good_type="badge",
            price=5.99
        )

        # Update price
        result = await service.update_good(
            good_id=good["id"],
            creator_id=user.id,
            price=7.99
        )

        assert result["price"] == 7.99

    @pytest.mark.asyncio
    async def test_update_good_description(self, db, test_user):
        """Test updating good description."""
        user = test_user["user"]
        service = VirtualGoodsService(db)

        good = await service.create_good(
            creator_id=user.id,
            name="Test Badge",
            good_type="badge",
            price=5.99,
            description="Original description"
        )

        result = await service.update_good(
            good_id=good["id"],
            creator_id=user.id,
            description="Updated description"
        )

        assert result["description"] == "Updated description"

    @pytest.mark.asyncio
    async def test_update_good_not_found(self, db, test_user):
        """Test updating nonexistent good raises error."""
        user = test_user["user"]
        service = VirtualGoodsService(db)

        with pytest.raises(VirtualGoodsError) as exc_info:
            await service.update_good(
                good_id=99999,
                creator_id=user.id,
                price=10.00
            )

        assert exc_info.value.code == "good_not_found"

    @pytest.mark.asyncio
    async def test_update_good_wrong_creator(self, db, test_user):
        """Test updating good from different creator raises error."""
        user = test_user["user"]
        service = VirtualGoodsService(db)

        good = await service.create_good(
            creator_id=user.id,
            name="Test Badge",
            good_type="badge",
            price=5.99
        )

        with pytest.raises(VirtualGoodsError) as exc_info:
            await service.update_good(
                good_id=good["id"],
                creator_id=99999,  # Different creator
                price=10.00
            )

        assert exc_info.value.code == "good_not_found"


class TestDeleteGood:
    """Test virtual goods deletion (deactivation)."""

    @pytest.mark.asyncio
    async def test_delete_good_success(self, db, test_user):
        """Test deactivating a good."""
        user = test_user["user"]
        service = VirtualGoodsService(db)

        good = await service.create_good(
            creator_id=user.id,
            name="Test Badge",
            good_type="badge",
            price=5.99
        )

        result = await service.delete_good(
            good_id=good["id"],
            creator_id=user.id
        )

        assert result["success"] is True

        # Verify good is deactivated
        updated = await service.get_good(good["id"])
        assert updated["is_active"] is False

    @pytest.mark.asyncio
    async def test_delete_good_not_found(self, db, test_user):
        """Test deleting nonexistent good raises error."""
        user = test_user["user"]
        service = VirtualGoodsService(db)

        with pytest.raises(VirtualGoodsError) as exc_info:
            await service.delete_good(
                good_id=99999,
                creator_id=user.id
            )

        assert exc_info.value.code == "good_not_found"


class TestGetGoods:
    """Test virtual goods retrieval."""

    @pytest.mark.asyncio
    async def test_get_goods_empty(self, db):
        """Test getting goods when none exist."""
        service = VirtualGoodsService(db)

        result = await service.get_goods()

        assert result["goods"] == []
        assert result["total"] == 0

    @pytest.mark.asyncio
    async def test_get_goods_by_creator(self, db, test_user):
        """Test getting goods filtered by creator."""
        user = test_user["user"]
        service = VirtualGoodsService(db)

        await service.create_good(
            creator_id=user.id,
            name="Creator Badge",
            good_type="badge",
            price=5.99
        )

        result = await service.get_goods(
            creator_id=user.id,
            include_platform=False
        )

        assert len(result["goods"]) == 1
        assert result["goods"][0]["name"] == "Creator Badge"

    @pytest.mark.asyncio
    async def test_get_goods_by_type(self, db, test_user):
        """Test getting goods filtered by type."""
        user = test_user["user"]
        service = VirtualGoodsService(db)

        await service.create_good(
            creator_id=user.id,
            name="Badge",
            good_type="badge",
            price=5.99
        )
        await service.create_good(
            creator_id=user.id,
            name="Emote",
            good_type="emote",
            price=2.99
        )

        result = await service.get_goods(
            good_type="badge"
        )

        assert len(result["goods"]) == 1
        assert result["goods"][0]["type"] == "badge"

    @pytest.mark.asyncio
    async def test_get_goods_excludes_inactive(self, db, test_user):
        """Test that inactive goods are excluded by default."""
        user = test_user["user"]
        service = VirtualGoodsService(db)

        good = await service.create_good(
            creator_id=user.id,
            name="Test Badge",
            good_type="badge",
            price=5.99
        )
        await service.delete_good(good["id"], user.id)

        result = await service.get_goods(creator_id=user.id, include_platform=False)

        assert len(result["goods"]) == 0

    @pytest.mark.asyncio
    async def test_get_goods_includes_inactive(self, db, test_user):
        """Test including inactive goods."""
        user = test_user["user"]
        service = VirtualGoodsService(db)

        good = await service.create_good(
            creator_id=user.id,
            name="Test Badge",
            good_type="badge",
            price=5.99
        )
        await service.delete_good(good["id"], user.id)

        result = await service.get_goods(
            creator_id=user.id,
            include_platform=False,
            include_inactive=True
        )

        assert len(result["goods"]) == 1


class TestPurchase:
    """Test virtual goods purchase."""

    @pytest.mark.asyncio
    async def test_purchase_success(self, db, test_user):
        """Test successful purchase."""
        user = test_user["user"]
        service = VirtualGoodsService(db)

        # Set user balance
        user.balance = 100.00
        db.commit()

        # Create good
        good = await service.create_good(
            creator_id=user.id,
            name="Test Badge",
            good_type="badge",
            price=5.99
        )

        # Create buyer
        buyer = User(
            username="buyer",
            email="buyer@example.com",
            hashed_password="hash",
            balance=50.00
        )
        db.add(buyer)
        db.commit()

        result = await service.purchase(
            user_id=buyer.id,
            good_id=good["id"],
            quantity=1
        )

        assert result["success"] is True
        assert result["quantity"] == 1
        assert result["total_cost"] == 5.99

        # Check balance was deducted
        db.refresh(buyer)
        assert buyer.balance == pytest.approx(50.00 - 5.99, rel=0.01)

    @pytest.mark.asyncio
    async def test_purchase_insufficient_balance(self, db, test_user):
        """Test purchase with insufficient balance raises error."""
        user = test_user["user"]
        service = VirtualGoodsService(db)

        good = await service.create_good(
            creator_id=user.id,
            name="Expensive Badge",
            good_type="badge",
            price=999.99
        )

        # Create buyer with low balance
        buyer = User(
            username="poorbuyer",
            email="poor@example.com",
            hashed_password="hash",
            balance=10.00
        )
        db.add(buyer)
        db.commit()

        with pytest.raises(VirtualGoodsError) as exc_info:
            await service.purchase(
                user_id=buyer.id,
                good_id=good["id"],
                quantity=1
            )

        assert exc_info.value.code == "insufficient_balance"

    @pytest.mark.asyncio
    async def test_purchase_limited_stock(self, db, test_user):
        """Test purchasing limited edition with insufficient stock."""
        user = test_user["user"]
        service = VirtualGoodsService(db)

        good = await service.create_good(
            creator_id=user.id,
            name="Limited Badge",
            good_type="badge",
            price=5.99,
            is_limited=True,
            quantity_available=2
        )

        buyer = User(
            username="buyer2",
            email="buyer2@example.com",
            hashed_password="hash",
            balance=100.00
        )
        db.add(buyer)
        db.commit()

        # Try to buy more than available
        with pytest.raises(VirtualGoodsError) as exc_info:
            await service.purchase(
                user_id=buyer.id,
                good_id=good["id"],
                quantity=5  # Only 2 available
            )

        assert exc_info.value.code == "insufficient_stock"

    @pytest.mark.asyncio
    async def test_purchase_invalid_quantity(self, db, test_user):
        """Test purchase with invalid quantity raises error."""
        user = test_user["user"]
        service = VirtualGoodsService(db)

        good = await service.create_good(
            creator_id=user.id,
            name="Test Badge",
            good_type="badge",
            price=5.99
        )

        with pytest.raises(VirtualGoodsError) as exc_info:
            await service.purchase(
                user_id=user.id,
                good_id=good["id"],
                quantity=0  # Invalid
            )

        assert exc_info.value.code == "invalid_quantity"

    @pytest.mark.asyncio
    async def test_purchase_updates_inventory(self, db, test_user):
        """Test that purchase updates user inventory."""
        user = test_user["user"]
        service = VirtualGoodsService(db)

        good = await service.create_good(
            creator_id=user.id,
            name="Test Badge",
            good_type="badge",
            price=1.00
        )

        buyer = User(
            username="buyer3",
            email="buyer3@example.com",
            hashed_password="hash",
            balance=100.00
        )
        db.add(buyer)
        db.commit()

        await service.purchase(
            user_id=buyer.id,
            good_id=good["id"],
            quantity=2
        )

        # Check inventory
        inventory = await service.get_inventory(buyer.id)
        assert len(inventory["inventory"]) == 1
        assert inventory["inventory"][0]["quantity"] == 2

    @pytest.mark.asyncio
    async def test_purchase_credits_creator(self, db, test_user):
        """Test that purchase credits creator."""
        creator = test_user["user"]
        creator.balance = 0.00
        db.commit()

        service = VirtualGoodsService(db)

        good = await service.create_good(
            creator_id=creator.id,
            name="Test Badge",
            good_type="badge",
            price=10.00
        )

        buyer = User(
            username="buyer4",
            email="buyer4@example.com",
            hashed_password="hash",
            balance=100.00
        )
        db.add(buyer)
        db.commit()

        await service.purchase(
            user_id=buyer.id,
            good_id=good["id"],
            quantity=1
        )

        # Check creator received revenue share (70%)
        db.refresh(creator)
        expected_amount = 10.00 * 0.70
        assert creator.balance == pytest.approx(expected_amount, rel=0.01)


class TestGift:
    """Test virtual goods gifting."""

    @pytest.mark.asyncio
    async def test_gift_success(self, db, test_user):
        """Test successful gifting."""
        creator = test_user["user"]
        service = VirtualGoodsService(db)

        good = await service.create_good(
            creator_id=creator.id,
            name="Gift Badge",
            good_type="badge",
            price=5.99
        )

        # Create sender and recipient
        sender = User(
            username="sender",
            email="sender@example.com",
            hashed_password="hash",
            balance=50.00
        )
        recipient = User(
            username="recipient",
            email="recipient@example.com",
            hashed_password="hash",
            balance=0.00
        )
        db.add_all([sender, recipient])
        db.commit()

        result = await service.gift(
            from_user_id=sender.id,
            to_user_id=recipient.id,
            good_id=good["id"],
            quantity=1
        )

        assert result["success"] is True
        assert result["recipient_id"] == recipient.id

        # Check recipient has item
        has_item = await service.has_good(recipient.id, good["id"])
        assert has_item is True

    @pytest.mark.asyncio
    async def test_gift_to_self_error(self, db, test_user):
        """Test gifting to self raises error."""
        user = test_user["user"]
        user.balance = 100.00
        db.commit()

        service = VirtualGoodsService(db)

        good = await service.create_good(
            creator_id=user.id,
            name="Test Badge",
            good_type="badge",
            price=5.99
        )

        with pytest.raises(VirtualGoodsError) as exc_info:
            await service.gift(
                from_user_id=user.id,
                to_user_id=user.id,
                good_id=good["id"],
                quantity=1
            )

        assert exc_info.value.code == "self_gift"

    @pytest.mark.asyncio
    async def test_gift_insufficient_balance(self, db, test_user):
        """Test gift with insufficient balance raises error."""
        creator = test_user["user"]
        service = VirtualGoodsService(db)

        good = await service.create_good(
            creator_id=creator.id,
            name="Expensive Badge",
            good_type="badge",
            price=100.00
        )

        sender = User(
            username="poorsender",
            email="poorsender@example.com",
            hashed_password="hash",
            balance=5.00  # Not enough
        )
        recipient = User(
            username="luckyrecipient",
            email="lucky@example.com",
            hashed_password="hash"
        )
        db.add_all([sender, recipient])
        db.commit()

        with pytest.raises(VirtualGoodsError) as exc_info:
            await service.gift(
                from_user_id=sender.id,
                to_user_id=recipient.id,
                good_id=good["id"],
                quantity=1
            )

        assert exc_info.value.code == "insufficient_balance"


class TestInventory:
    """Test inventory management."""

    @pytest.mark.asyncio
    async def test_get_inventory_empty(self, db, test_user):
        """Test getting empty inventory."""
        user = test_user["user"]
        service = VirtualGoodsService(db)

        result = await service.get_inventory(user.id)

        assert result["inventory"] == []
        assert result["total"] == 0

    @pytest.mark.asyncio
    async def test_get_inventory_with_items(self, db, test_user):
        """Test getting inventory with items."""
        creator = test_user["user"]
        service = VirtualGoodsService(db)

        good = await service.create_good(
            creator_id=creator.id,
            name="Test Badge",
            good_type="badge",
            price=1.00
        )

        buyer = User(
            username="inventorybuyer",
            email="invbuyer@example.com",
            hashed_password="hash",
            balance=100.00
        )
        db.add(buyer)
        db.commit()

        await service.purchase(
            user_id=buyer.id,
            good_id=good["id"],
            quantity=3
        )

        result = await service.get_inventory(buyer.id)

        assert len(result["inventory"]) == 1
        assert result["inventory"][0]["quantity"] == 3
        assert result["inventory"][0]["name"] == "Test Badge"

    @pytest.mark.asyncio
    async def test_get_inventory_by_type(self, db, test_user):
        """Test filtering inventory by type."""
        creator = test_user["user"]
        service = VirtualGoodsService(db)

        badge = await service.create_good(
            creator_id=creator.id,
            name="Badge",
            good_type="badge",
            price=1.00
        )
        emote = await service.create_good(
            creator_id=creator.id,
            name="Emote",
            good_type="emote",
            price=1.00
        )

        buyer = User(
            username="typedbuyer",
            email="typed@example.com",
            hashed_password="hash",
            balance=100.00
        )
        db.add(buyer)
        db.commit()

        await service.purchase(user_id=buyer.id, good_id=badge["id"], quantity=1)
        await service.purchase(user_id=buyer.id, good_id=emote["id"], quantity=1)

        # Get only badges
        result = await service.get_inventory(buyer.id, good_type="badge")

        assert len(result["inventory"]) == 1
        assert result["inventory"][0]["type"] == "badge"


class TestEquipGood:
    """Test equipment functionality."""

    @pytest.mark.asyncio
    async def test_equip_badge(self, db, test_user):
        """Test equipping a badge."""
        creator = test_user["user"]
        service = VirtualGoodsService(db)

        good = await service.create_good(
            creator_id=creator.id,
            name="Equip Badge",
            good_type="badge",
            price=1.00
        )

        buyer = User(
            username="equipper",
            email="equip@example.com",
            hashed_password="hash",
            balance=100.00
        )
        db.add(buyer)
        db.commit()

        await service.purchase(
            user_id=buyer.id,
            good_id=good["id"],
            quantity=1
        )

        # Get inventory to find inventory_id
        inventory = await service.get_inventory(buyer.id)
        inventory_id = inventory["inventory"][0]["inventory_id"]

        result = await service.equip_good(
            user_id=buyer.id,
            inventory_id=inventory_id,
            equip=True
        )

        assert result["success"] is True
        assert result["is_equipped"] is True

    @pytest.mark.asyncio
    async def test_equip_replaces_previous(self, db, test_user):
        """Test that equipping unequips previous item of same type."""
        creator = test_user["user"]
        service = VirtualGoodsService(db)

        badge1 = await service.create_good(
            creator_id=creator.id,
            name="Badge 1",
            good_type="badge",
            price=1.00
        )
        badge2 = await service.create_good(
            creator_id=creator.id,
            name="Badge 2",
            good_type="badge",
            price=1.00
        )

        buyer = User(
            username="doubleequip",
            email="double@example.com",
            hashed_password="hash",
            balance=100.00
        )
        db.add(buyer)
        db.commit()

        await service.purchase(user_id=buyer.id, good_id=badge1["id"], quantity=1)
        await service.purchase(user_id=buyer.id, good_id=badge2["id"], quantity=1)

        inventory = await service.get_inventory(buyer.id)
        id1 = inventory["inventory"][0]["inventory_id"]
        id2 = inventory["inventory"][1]["inventory_id"]

        # Equip first badge
        await service.equip_good(user_id=buyer.id, inventory_id=id1, equip=True)

        # Equip second badge
        await service.equip_good(user_id=buyer.id, inventory_id=id2, equip=True)

        # Check only one is equipped
        equipped = await service.get_equipped(buyer.id, good_type="badge")
        assert len(equipped) == 1
        assert equipped[0]["inventory_id"] == id2

    @pytest.mark.asyncio
    async def test_equip_non_equippable_type(self, db, test_user):
        """Test that non-equippable types raise error."""
        creator = test_user["user"]
        service = VirtualGoodsService(db)

        sticker = await service.create_good(
            creator_id=creator.id,
            name="Sticker",
            good_type="sticker",  # Not equippable
            price=1.00
        )

        buyer = User(
            username="stickerbuyer",
            email="sticker@example.com",
            hashed_password="hash",
            balance=100.00
        )
        db.add(buyer)
        db.commit()

        await service.purchase(user_id=buyer.id, good_id=sticker["id"], quantity=1)

        inventory = await service.get_inventory(buyer.id)
        inventory_id = inventory["inventory"][0]["inventory_id"]

        with pytest.raises(VirtualGoodsError) as exc_info:
            await service.equip_good(
                user_id=buyer.id,
                inventory_id=inventory_id,
                equip=True
            )

        assert exc_info.value.code == "not_equippable"


class TestHasGood:
    """Test ownership checking."""

    @pytest.mark.asyncio
    async def test_has_good_true(self, db, test_user):
        """Test has_good returns True when user owns good."""
        creator = test_user["user"]
        service = VirtualGoodsService(db)

        good = await service.create_good(
            creator_id=creator.id,
            name="Owned Badge",
            good_type="badge",
            price=1.00
        )

        buyer = User(
            username="owner",
            email="owner@example.com",
            hashed_password="hash",
            balance=100.00
        )
        db.add(buyer)
        db.commit()

        await service.purchase(user_id=buyer.id, good_id=good["id"], quantity=1)

        result = await service.has_good(buyer.id, good["id"])
        assert result is True

    @pytest.mark.asyncio
    async def test_has_good_false(self, db, test_user):
        """Test has_good returns False when user doesn't own good."""
        creator = test_user["user"]
        service = VirtualGoodsService(db)

        good = await service.create_good(
            creator_id=creator.id,
            name="Not Owned",
            good_type="badge",
            price=1.00
        )

        buyer = User(
            username="nonowner",
            email="nonowner@example.com",
            hashed_password="hash"
        )
        db.add(buyer)
        db.commit()

        result = await service.has_good(buyer.id, good["id"])
        assert result is False


class TestGetVirtualGoodsService:
    """Test factory function."""

    def test_get_virtual_goods_service(self, db):
        """Test getting service instance."""
        service = get_virtual_goods_service(db)

        assert service is not None
        assert isinstance(service, VirtualGoodsService)
        assert service.db is db
