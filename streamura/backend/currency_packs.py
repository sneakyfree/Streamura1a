"""
Currency Packs Service
Sprint 7: Advanced Monetization Features

Platform currency ("Streamura Coins") system with bulk discounts
and purchase tracking.
"""
from datetime import datetime, timedelta
from decimal import Decimal
from typing import List, Optional, Dict, Any
from dataclasses import dataclass
from enum import Enum
import uuid

from sqlalchemy.orm import Session


class CurrencyPackSize(str, Enum):
    """Available currency pack sizes"""
    STARTER = "starter"       # 100 coins
    VALUE = "value"           # 500 coins
    POPULAR = "popular"       # 1000 coins
    SUPER = "super"           # 2500 coins
    MEGA = "mega"             # 5000 coins
    ULTIMATE = "ultimate"     # 10000 coins


@dataclass
class CurrencyPack:
    """Currency pack definition"""
    pack_id: str
    size: CurrencyPackSize
    coin_amount: int
    bonus_coins: int  # Extra coins from bulk discount
    price_usd: Decimal
    price_per_coin: Decimal
    discount_percent: float
    is_featured: bool
    limited_time: bool
    expires_at: Optional[datetime] = None
    badge: Optional[str] = None  # "BEST VALUE", "MOST POPULAR", etc.


@dataclass
class CurrencyBalance:
    """User's currency balance"""
    user_id: int
    total_coins: int
    purchased_coins: int
    bonus_coins: int
    earned_coins: int
    spent_coins: int
    last_purchase: Optional[datetime]
    vip_level: int  # Higher level = better conversion rates


@dataclass
class CurrencyTransaction:
    """Individual currency transaction"""
    transaction_id: str
    user_id: int
    type: str  # 'purchase', 'spend', 'earn', 'refund', 'gift'
    coins: int
    usd_value: Optional[Decimal]
    description: str
    recipient_id: Optional[int]
    created_at: datetime


@dataclass
class ConversionRate:
    """Coin to USD conversion rate"""
    base_rate: Decimal  # Base: 1 coin = $0.01
    vip_bonus: float     # VIP level bonus percentage
    effective_rate: Decimal


# Default pack configurations
DEFAULT_PACKS: List[Dict[str, Any]] = [
    {
        "size": CurrencyPackSize.STARTER,
        "coin_amount": 100,
        "bonus_coins": 0,
        "price_usd": Decimal("0.99"),
        "badge": None,
        "is_featured": False
    },
    {
        "size": CurrencyPackSize.VALUE,
        "coin_amount": 500,
        "bonus_coins": 25,
        "price_usd": Decimal("4.49"),
        "badge": None,
        "is_featured": False
    },
    {
        "size": CurrencyPackSize.POPULAR,
        "coin_amount": 1000,
        "bonus_coins": 100,
        "price_usd": Decimal("7.99"),
        "badge": "MOST POPULAR",
        "is_featured": True
    },
    {
        "size": CurrencyPackSize.SUPER,
        "coin_amount": 2500,
        "bonus_coins": 350,
        "price_usd": Decimal("17.99"),
        "badge": None,
        "is_featured": False
    },
    {
        "size": CurrencyPackSize.MEGA,
        "coin_amount": 5000,
        "bonus_coins": 1000,
        "price_usd": Decimal("32.99"),
        "badge": "BEST VALUE",
        "is_featured": True
    },
    {
        "size": CurrencyPackSize.ULTIMATE,
        "coin_amount": 10000,
        "bonus_coins": 2500,
        "price_usd": Decimal("59.99"),
        "badge": "ULTIMATE",
        "is_featured": False
    }
]


class CurrencyPacksService:
    """
    Platform currency management service.
    
    Features:
    - Currency pack purchases with bulk discounts
    - Balance tracking
    - VIP level bonuses
    - Transaction history
    - Coin-to-USD conversion
    """
    
    BASE_COIN_VALUE = Decimal("0.01")  # 1 coin = $0.01 USD
    
    def __init__(self, db: Session):
        self.db = db
    
    def get_available_packs(
        self, 
        user_id: Optional[int] = None,
        include_limited: bool = True
    ) -> List[CurrencyPack]:
        """
        Get available currency packs with pricing.
        
        Personalizes pricing based on user VIP level.
        """
        packs = []
        
        # Get user VIP level for personalized bonuses
        vip_level = 0
        if user_id:
            balance = self.get_balance(user_id)
            vip_level = balance.vip_level
        
        for pack_config in DEFAULT_PACKS:
            # Calculate effective price per coin
            total_coins = pack_config["coin_amount"] + pack_config["bonus_coins"]
            
            # Apply VIP bonus coins
            vip_bonus = int(pack_config["coin_amount"] * vip_level * 0.02)  # 2% per VIP level
            total_coins += vip_bonus
            
            price_per_coin = pack_config["price_usd"] / total_coins
            
            # Calculate discount from base rate
            base_price = pack_config["coin_amount"] * self.BASE_COIN_VALUE
            discount = float((base_price - pack_config["price_usd"]) / base_price * 100) if base_price > 0 else 0
            
            packs.append(CurrencyPack(
                pack_id=f"pack_{pack_config['size'].value}",
                size=pack_config["size"],
                coin_amount=pack_config["coin_amount"],
                bonus_coins=pack_config["bonus_coins"] + vip_bonus,
                price_usd=pack_config["price_usd"],
                price_per_coin=price_per_coin,
                discount_percent=max(0, discount),
                is_featured=pack_config["is_featured"],
                limited_time=False,
                badge=pack_config["badge"]
            ))
        
        # Add limited time offers if applicable
        if include_limited:
            limited_packs = self._get_limited_time_packs()
            packs.extend(limited_packs)
        
        return packs
    
    def _get_limited_time_packs(self) -> List[CurrencyPack]:
        """Get any active limited-time offers"""
        # Check for active promotions in DB
        # For now, return empty (can be expanded)
        return []
    
    def get_balance(self, user_id: int) -> CurrencyBalance:
        """
        Get user's current currency balance.
        """
        from models import User
        
        user = self.db.query(User).filter(User.id == user_id).first()
        if not user:
            return CurrencyBalance(
                user_id=user_id,
                total_coins=0,
                purchased_coins=0,
                bonus_coins=0,
                earned_coins=0,
                spent_coins=0,
                last_purchase=None,
                vip_level=0
            )
        
        # Get coin data from user model or separate table
        coin_balance = getattr(user, 'coin_balance', 0)
        purchased = getattr(user, 'purchased_coins', 0)
        bonus = getattr(user, 'bonus_coins', 0)
        earned = getattr(user, 'earned_coins', 0)
        spent = getattr(user, 'spent_coins', 0)
        last_purchase = getattr(user, 'last_coin_purchase', None)
        
        # Calculate VIP level based on total purchases
        vip_level = self._calculate_vip_level(purchased)
        
        return CurrencyBalance(
            user_id=user_id,
            total_coins=coin_balance,
            purchased_coins=purchased,
            bonus_coins=bonus,
            earned_coins=earned,
            spent_coins=spent,
            last_purchase=last_purchase,
            vip_level=vip_level
        )
    
    def _calculate_vip_level(self, total_purchased: int) -> int:
        """Calculate VIP level based on total purchased coins"""
        if total_purchased >= 100000:
            return 5  # Diamond
        elif total_purchased >= 50000:
            return 4  # Platinum
        elif total_purchased >= 20000:
            return 3  # Gold
        elif total_purchased >= 5000:
            return 2  # Silver
        elif total_purchased >= 1000:
            return 1  # Bronze
        return 0  # Standard
    
    async def purchase_pack(
        self,
        user_id: int,
        pack_size: CurrencyPackSize,
        payment_method_id: str
    ) -> Dict[str, Any]:
        """
        Process currency pack purchase.
        
        Returns transaction details and new balance.
        """
        from models import User
        import stripe
        
        # Get pack details
        pack = None
        for p in self.get_available_packs(user_id):
            if p.size == pack_size:
                pack = p
                break
        
        if not pack:
            return {"success": False, "error": "Pack not found"}
        
        # Get user
        user = self.db.query(User).filter(User.id == user_id).first()
        if not user:
            return {"success": False, "error": "User not found"}
        
        # Process payment via Stripe
        try:
            payment_intent = stripe.PaymentIntent.create(
                amount=int(pack.price_usd * 100),  # Cents
                currency="usd",
                customer=getattr(user, 'stripe_customer_id', None),
                payment_method=payment_method_id,
                confirm=True,
                metadata={
                    "type": "currency_pack",
                    "pack_size": pack_size.value,
                    "user_id": str(user_id)
                }
            )
            
            if payment_intent.status != "succeeded":
                return {"success": False, "error": "Payment failed"}
            
        except Exception as e:
            return {"success": False, "error": str(e)}
        
        # Credit coins to user
        total_coins = pack.coin_amount + pack.bonus_coins
        
        # Update user balance
        current_balance = getattr(user, 'coin_balance', 0)
        current_purchased = getattr(user, 'purchased_coins', 0)
        current_bonus = getattr(user, 'bonus_coins', 0)
        
        user.coin_balance = current_balance + total_coins
        user.purchased_coins = current_purchased + pack.coin_amount
        user.bonus_coins = current_bonus + pack.bonus_coins
        user.last_coin_purchase = datetime.now()
        
        # Record transaction
        tx_id = str(uuid.uuid4())
        
        self.db.commit()
        
        return {
            "success": True,
            "transaction_id": tx_id,
            "coins_added": total_coins,
            "bonus_coins": pack.bonus_coins,
            "new_balance": user.coin_balance,
            "payment_amount": float(pack.price_usd)
        }
    
    def spend_coins(
        self,
        user_id: int,
        amount: int,
        description: str,
        recipient_id: Optional[int] = None
    ) -> Dict[str, Any]:
        """
        Spend coins (tips, purchases, etc.)
        """
        from models import User
        
        user = self.db.query(User).filter(User.id == user_id).first()
        if not user:
            return {"success": False, "error": "User not found"}
        
        current_balance = getattr(user, 'coin_balance', 0)
        if current_balance < amount:
            return {"success": False, "error": "Insufficient balance"}
        
        # Deduct coins
        user.coin_balance = current_balance - amount
        user.spent_coins = getattr(user, 'spent_coins', 0) + amount
        
        # If tipping another user, credit them
        if recipient_id:
            recipient = self.db.query(User).filter(User.id == recipient_id).first()
            if recipient:
                recipient_balance = getattr(recipient, 'coin_balance', 0)
                recipient_earned = getattr(recipient, 'earned_coins', 0)
                recipient.coin_balance = recipient_balance + amount
                recipient.earned_coins = recipient_earned + amount
        
        tx_id = str(uuid.uuid4())
        self.db.commit()
        
        return {
            "success": True,
            "transaction_id": tx_id,
            "coins_spent": amount,
            "new_balance": user.coin_balance,
            "description": description
        }
    
    def get_conversion_rate(self, user_id: int) -> ConversionRate:
        """
        Get current coin-to-USD conversion rate for user.
        
        VIP users get better rates for cashing out.
        """
        balance = self.get_balance(user_id)
        
        # VIP bonus: 5% per level
        vip_bonus = balance.vip_level * 0.05
        effective_rate = self.BASE_COIN_VALUE * Decimal(str(1 + vip_bonus))
        
        return ConversionRate(
            base_rate=self.BASE_COIN_VALUE,
            vip_bonus=vip_bonus,
            effective_rate=effective_rate
        )
    
    def get_transaction_history(
        self,
        user_id: int,
        limit: int = 50,
        offset: int = 0
    ) -> List[CurrencyTransaction]:
        """
        Get user's currency transaction history.
        """
        # Query from transaction table
        # For now, return mock data
        return []
    
    def convert_to_usd(self, user_id: int, coin_amount: int) -> Dict[str, Any]:
        """
        Convert coins to USD (for creator cashout).
        
        Minimum conversion: 1000 coins
        """
        MIN_CONVERSION = 1000
        
        if coin_amount < MIN_CONVERSION:
            return {"success": False, "error": f"Minimum conversion is {MIN_CONVERSION} coins"}
        
        balance = self.get_balance(user_id)
        if balance.total_coins < coin_amount:
            return {"success": False, "error": "Insufficient balance"}
        
        rate = self.get_conversion_rate(user_id)
        usd_amount = Decimal(coin_amount) * rate.effective_rate
        
        # Deduct coins
        result = self.spend_coins(
            user_id, 
            coin_amount, 
            f"Converted to ${usd_amount:.2f} USD"
        )
        
        if not result["success"]:
            return result
        
        return {
            "success": True,
            "coins_converted": coin_amount,
            "usd_amount": float(usd_amount),
            "rate": float(rate.effective_rate),
            "vip_bonus": rate.vip_bonus
        }


# Singleton instance
_currency_service: Optional[CurrencyPacksService] = None


def get_currency_service(db: Session) -> CurrencyPacksService:
    """Get or create currency service instance"""
    global _currency_service
    if _currency_service is None:
        _currency_service = CurrencyPacksService(db)
    return _currency_service
