"""
Tests for Subscription and Virtual Goods System (Phase 10)

Tests the following functionality:
- Subscription tier CRUD
- Virtual goods CRUD
- Purchase and gift flow
- Inventory management
- Gift codes
"""

import pytest
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from fastapi.testclient import TestClient

from backend.models import (
    SubscriptionTier, Subscription, VirtualGood, UserInventory,
    SubscriptionGiftCode, User
)


class TestSubscriptionTiers:
    """Test subscription tier management."""

    def test_create_tier(self, client: TestClient, creator_user: dict):
        """Test creating a subscription tier."""
        response = client.post(
            f"/api/v1/creators/{creator_user['user'].id}/tiers",
            json={
                "name": "VIP Tier",
                "price": 19.99,
                "description": "Premium access",
                "benefits": ["Custom emotes", "Priority support"],
                "billing_period": "monthly",
            },
            headers=creator_user["headers"]
        )
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "VIP Tier"
        assert data["price"] == 19.99
        assert len(data["benefits"]) == 2

    def test_create_tier_unauthorized(self, client: TestClient, test_user: dict, creator_user: dict):
        """Test that non-owner can't create tier for another creator."""
        response = client.post(
            f"/api/v1/creators/{creator_user['user'].id}/tiers",
            json={
                "name": "Unauthorized Tier",
                "price": 9.99,
            },
            headers=test_user["headers"]
        )
        assert response.status_code == 403

    def test_get_tiers(self, client: TestClient, subscription_tier: SubscriptionTier, creator_user: dict):
        """Test getting subscription tiers for a creator."""
        response = client.get(f"/api/v1/creators/{creator_user['user'].id}/tiers")
        assert response.status_code == 200
        data = response.json()
        assert len(data) >= 1
        assert any(t["name"] == "Test Tier" for t in data)

    def test_get_single_tier(self, client: TestClient, subscription_tier: SubscriptionTier):
        """Test getting a single tier by ID."""
        response = client.get(f"/api/v1/tiers/{subscription_tier.id}")
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == subscription_tier.id
        assert data["name"] == "Test Tier"

    def test_update_tier(self, client: TestClient, subscription_tier: SubscriptionTier, creator_user: dict):
        """Test updating a subscription tier."""
        response = client.put(
            f"/api/v1/tiers/{subscription_tier.id}",
            json={
                "name": "Updated Tier",
                "description": "Updated description",
            },
            headers=creator_user["headers"]
        )
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "Updated Tier"
        assert data["description"] == "Updated description"

    def test_delete_tier(self, client: TestClient, subscription_tier: SubscriptionTier, creator_user: dict):
        """Test deactivating a subscription tier."""
        response = client.delete(
            f"/api/v1/tiers/{subscription_tier.id}",
            headers=creator_user["headers"]
        )
        assert response.status_code == 200
        assert response.json()["success"] is True

        # Verify it's inactive
        response = client.get(f"/api/v1/tiers/{subscription_tier.id}")
        assert response.status_code == 200
        assert response.json()["is_active"] is False


class TestSubscriptions:
    """Test subscription management."""

    def test_check_subscription_status_not_subscribed(
        self, client: TestClient, test_user: dict, creator_user: dict
    ):
        """Test checking subscription status when not subscribed."""
        response = client.get(
            f"/api/v1/creators/{creator_user['user'].id}/is-subscribed",
            headers=test_user["headers"]
        )
        assert response.status_code == 200
        data = response.json()
        assert data["is_subscribed"] is False

    def test_get_my_subscriptions_empty(self, client: TestClient, test_user: dict):
        """Test getting subscriptions when none exist."""
        response = client.get(
            "/api/v1/subscriptions/mine",
            headers=test_user["headers"]
        )
        assert response.status_code == 200
        data = response.json()
        assert data["subscriptions"] == []

    def test_get_benefits_not_subscribed(
        self, client: TestClient, test_user: dict, creator_user: dict
    ):
        """Test getting benefits when not subscribed."""
        response = client.get(
            f"/api/v1/creators/{creator_user['user'].id}/benefits",
            headers=test_user["headers"]
        )
        assert response.status_code == 200
        data = response.json()
        assert data["has_subscription"] is False
        assert data["benefits"] == []


class TestGiftCodes:
    """Test subscription gift code functionality."""

    def test_create_gift_code(
        self, client: TestClient, subscription_tier: SubscriptionTier, creator_user: dict
    ):
        """Test creating a gift code."""
        response = client.post(
            f"/api/v1/tiers/{subscription_tier.id}/gift-codes",
            headers=creator_user["headers"],
            json={"tier_id": subscription_tier.id, "months": 3}
        )
        assert response.status_code == 200
        data = response.json()
        assert "code" in data
        assert len(data["code"]) > 0
        assert data["months"] == 3
        assert data["tier_id"] == subscription_tier.id

    def test_redeem_invalid_code(self, client: TestClient, test_user: dict):
        """Test redeeming an invalid gift code."""
        response = client.post(
            "/api/v1/gift-codes/redeem",
            params={"code": "INVALID_CODE"},
            headers=test_user["headers"]
        )
        assert response.status_code == 400
        assert "invalid" in response.json()["detail"].lower() or "not found" in response.json()["detail"].lower()


class TestVirtualGoods:
    """Test virtual goods functionality."""

    def test_create_virtual_good(self, client: TestClient, creator_user: dict):
        """Test creating a virtual good."""
        response = client.post(
            "/api/v1/virtual-goods",
            json={
                "name": "Cool Badge",
                "type": "badge",
                "price": 2.99,
                "description": "A cool badge for supporters",
            },
            headers=creator_user["headers"]
        )
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "Cool Badge"
        assert data["type"] == "badge"
        assert data["price"] == 2.99

    def test_get_virtual_goods(self, client: TestClient, virtual_good: VirtualGood):
        """Test getting virtual goods list."""
        response = client.get("/api/v1/virtual-goods")
        assert response.status_code == 200
        data = response.json()
        # Response format is {"goods": [...], "total": ...}
        assert len(data["goods"]) >= 1

    def test_get_virtual_goods_by_type(self, client: TestClient, virtual_good: VirtualGood):
        """Test filtering virtual goods by type."""
        response = client.get("/api/v1/virtual-goods", params={"type": "emote"})
        assert response.status_code == 200
        data = response.json()
        # Response format is {"goods": [...], "total": ...}
        assert all(g["type"] == "emote" for g in data["goods"])

    def test_get_single_virtual_good(self, client: TestClient, virtual_good: VirtualGood):
        """Test getting a single virtual good."""
        response = client.get(f"/api/v1/virtual-goods/{virtual_good.id}")
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == virtual_good.id
        assert data["name"] == "Test Emote"

    def test_update_virtual_good(
        self, client: TestClient, virtual_good: VirtualGood, creator_user: dict
    ):
        """Test updating a virtual good."""
        response = client.put(
            f"/api/v1/virtual-goods/{virtual_good.id}",
            json={
                "name": "Updated Emote",
                "price": 5.99,
            },
            headers=creator_user["headers"]
        )
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "Updated Emote"
        assert data["price"] == 5.99

    def test_purchase_virtual_good(
        self, client: TestClient, virtual_good: VirtualGood, test_user: dict
    ):
        """Test purchasing a virtual good."""
        response = client.post(
            f"/api/v1/virtual-goods/{virtual_good.id}/purchase",
            headers=test_user["headers"]
        )
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert "good_id" in data

    def test_purchase_virtual_good_insufficient_balance(
        self, client: TestClient, db: Session, creator_user: dict
    ):
        """Test purchasing when balance is insufficient."""
        # Create an expensive good
        good = VirtualGood(
            creator_id=creator_user["user"].id,
            name="Expensive Item",
            type="effect",
            price=1000.00,
            is_active=True,
        )
        db.add(good)
        db.commit()

        # Create a user with low balance
        from backend.auth import get_password_hash, create_access_token
        user = User(
            username="pooruser",
            email="poor@example.com",
            hashed_password=get_password_hash("password"),
            balance=10.0,
        )
        db.add(user)
        db.commit()

        token = create_access_token(
            data={"sub": str(user.id), "username": user.username, "email": user.email}
        )

        response = client.post(
            f"/api/v1/virtual-goods/{good.id}/purchase",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 400
        assert "insufficient" in response.json()["detail"].lower()


class TestInventory:
    """Test user inventory functionality."""

    def test_get_empty_inventory(self, client: TestClient, test_user: dict):
        """Test getting empty inventory."""
        response = client.get(
            "/api/v1/inventory",
            headers=test_user["headers"]
        )
        assert response.status_code == 200
        assert response.json() == []

    def test_get_inventory_after_purchase(
        self, client: TestClient, virtual_good: VirtualGood, test_user: dict
    ):
        """Test that purchased items appear in inventory."""
        # Purchase the item
        client.post(
            f"/api/v1/virtual-goods/{virtual_good.id}/purchase",
            headers=test_user["headers"]
        )

        # Check inventory
        response = client.get(
            "/api/v1/inventory",
            headers=test_user["headers"]
        )
        assert response.status_code == 200
        data = response.json()
        assert len(data) >= 1
        assert any(item["good_id"] == virtual_good.id for item in data)

    def test_equip_item(
        self, client: TestClient, db: Session, creator_user: dict, test_user: dict
    ):
        """Test equipping an inventory item."""
        # Create a badge (equippable item type)
        badge = VirtualGood(
            creator_id=creator_user["user"].id,
            name="Test Badge",
            type="badge",  # Badges can be equipped
            price=2.99,
            is_active=True,
        )
        db.add(badge)
        db.commit()
        db.refresh(badge)

        # Purchase the badge
        response = client.post(
            f"/api/v1/virtual-goods/{badge.id}/purchase",
            headers=test_user["headers"]
        )
        assert response.status_code == 200

        # Get inventory to find the inventory_id
        response = client.get(
            "/api/v1/inventory",
            headers=test_user["headers"]
        )
        inventory_items = response.json()
        badge_item = next((item for item in inventory_items if item["type"] == "badge"), None)
        assert badge_item is not None, "Badge not found in inventory"
        inventory_id = badge_item["inventory_id"]

        # Equip it
        response = client.post(
            f"/api/v1/inventory/{inventory_id}/equip",
            headers=test_user["headers"],
            params={"equip": True}
        )
        assert response.status_code == 200, f"Failed: {response.json()}"
        assert response.json()["is_equipped"] is True

    def test_unequip_item(
        self, client: TestClient, db: Session, creator_user: dict, test_user: dict
    ):
        """Test unequipping an inventory item."""
        # Create a badge (equippable item type)
        badge = VirtualGood(
            creator_id=creator_user["user"].id,
            name="Test Badge 2",
            type="badge",  # Badges can be equipped
            price=2.99,
            is_active=True,
        )
        db.add(badge)
        db.commit()
        db.refresh(badge)

        # Purchase the badge
        response = client.post(
            f"/api/v1/virtual-goods/{badge.id}/purchase",
            headers=test_user["headers"]
        )
        assert response.status_code == 200

        # Get inventory to find the inventory_id
        response = client.get(
            "/api/v1/inventory",
            headers=test_user["headers"]
        )
        inventory_items = response.json()
        badge_item = next((item for item in inventory_items if item["type"] == "badge" and item["name"] == "Test Badge 2"), None)
        assert badge_item is not None, "Badge not found in inventory"
        inventory_id = badge_item["inventory_id"]

        # Equip it first
        client.post(
            f"/api/v1/inventory/{inventory_id}/equip",
            headers=test_user["headers"],
            params={"equip": True}
        )

        # Unequip
        response = client.post(
            f"/api/v1/inventory/{inventory_id}/equip",
            headers=test_user["headers"],
            params={"equip": False}
        )
        assert response.status_code == 200
        assert response.json()["is_equipped"] is False


class TestGifting:
    """Test virtual goods gifting functionality."""

    def test_gift_virtual_good(
        self, client: TestClient, virtual_good: VirtualGood, test_user: dict, second_user: dict
    ):
        """Test gifting a virtual good to another user."""
        response = client.post(
            f"/api/v1/virtual-goods/{virtual_good.id}/gift",
            headers=test_user["headers"],
            params={"to_user_id": second_user["user"].id}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert data["recipient_id"] == second_user["user"].id

    def test_gift_to_self_fails(
        self, client: TestClient, virtual_good: VirtualGood, test_user: dict
    ):
        """Test that you cannot gift to yourself."""
        response = client.post(
            f"/api/v1/virtual-goods/{virtual_good.id}/gift",
            headers=test_user["headers"],
            params={"to_user_id": test_user["user"].id}
        )
        assert response.status_code == 400


class TestLimitedItems:
    """Test limited edition virtual goods."""

    def test_create_limited_item(self, client: TestClient, creator_user: dict):
        """Test creating a limited edition item."""
        response = client.post(
            "/api/v1/virtual-goods",
            json={
                "name": "Rare Badge",
                "type": "badge",
                "price": 9.99,
                "is_limited": True,
                "quantity_available": 100,
            },
            headers=creator_user["headers"]
        )
        assert response.status_code == 200
        data = response.json()
        assert data["is_limited"] is True
        assert data["quantity_available"] == 100
        assert data["quantity_sold"] == 0

    def test_purchase_updates_quantity(
        self, client: TestClient, db: Session, creator_user: dict, test_user: dict
    ):
        """Test that purchasing updates quantity sold."""
        # Create limited item
        good = VirtualGood(
            creator_id=creator_user["user"].id,
            name="Limited Badge",
            type="badge",
            price=5.00,
            is_limited=True,
            quantity_available=10,
            quantity_sold=0,
            is_active=True,
        )
        db.add(good)
        db.commit()
        db.refresh(good)

        # Purchase
        client.post(
            f"/api/v1/virtual-goods/{good.id}/purchase",
            headers=test_user["headers"]
        )

        # Check quantity updated
        response = client.get(f"/api/v1/virtual-goods/{good.id}")
        assert response.json()["quantity_sold"] == 1
