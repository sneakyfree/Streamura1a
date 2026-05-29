"""
Streamura API Schemas

This module contains Pydantic models for request/response validation.
"""

from pydantic import BaseModel, EmailStr
from typing import Optional, List
from datetime import datetime

# User Schemas
class UserBase(BaseModel):
    username: Optional[str] = None
    email: Optional[EmailStr] = None
    phone_number: Optional[str] = None

class UserCreate(UserBase):
    password: str

class UserResponse(UserBase):
    id: int
    is_verified: bool
    is_admin: bool = False
    balance: float
    lifetime_earnings: float

    class Config:
        from_attributes = True

# Stream Schemas
class StreamBase(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    is_public: bool = True
    is_monetized: bool = False
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    location_name: Optional[str] = None
    category: Optional[str] = None
    tags: Optional[List[str]] = None

class StreamCreate(StreamBase):
    pass

class StreamResponse(StreamBase):
    id: int
    stream_key: str
    user_id: Optional[int] = None
    status: str
    viewer_count: int
    peak_viewers: int
    total_watch_time: int
    earnings: float
    starts_at: Optional[datetime] = None
    ends_at: Optional[datetime] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    thumbnail_url: Optional[str] = None
    event_id: Optional[int] = None

    class Config:
        from_attributes = True

# Event Schemas
class EventBase(BaseModel):
    title: str
    description: Optional[str] = None
    latitude: float
    longitude: float
    location_name: str
    category: Optional[str] = None

class EventCreate(EventBase):
    radius: Optional[float] = 100.0

class EventUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    category: Optional[str] = None
    is_featured: Optional[bool] = None

class EventResponse(EventBase):
    id: int
    status: str
    creator_id: Optional[int] = None
    radius: float
    total_viewers: int
    total_streams: int
    total_earnings: float
    ranking_score: float
    starts_at: Optional[datetime] = None
    ends_at: Optional[datetime] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    thumbnail_url: Optional[str] = None
    is_featured: bool

    class Config:
        from_attributes = True

class EventDetailResponse(EventResponse):
    """Extended event response with streams"""
    streams: List["StreamResponse"] = []
    primary_stream: Optional["StreamResponse"] = None

    class Config:
        from_attributes = True

class EventListResponse(BaseModel):
    """Paginated list of events"""
    events: List[EventResponse]
    total: int
    page: int
    per_page: int
    has_more: bool

# Notification Schemas
class NotificationResponse(BaseModel):
    id: int
    notification_type: str
    title: str
    message: str
    is_read: bool
    created_at: datetime
    read_at: Optional[datetime] = None
    stream_id: Optional[int] = None
    event_id: Optional[int] = None
    from_user_id: Optional[int] = None
    transaction_id: Optional[int] = None
    extra_data: Optional[dict] = None

    class Config:
        from_attributes = True

# Monetization Schemas
class TransactionBase(BaseModel):
    amount: float
    currency: str = "USD"
    transaction_type: str
    status: str = "pending"

class TransactionResponse(TransactionBase):
    id: int
    user_id: int
    stream_id: Optional[int] = None
    stripe_transaction_id: Optional[str] = None
    stripe_transfer_id: Optional[str] = None
    created_at: datetime
    completed_at: Optional[datetime] = None

    class Config:
        from_attributes = True

# Ad Schemas
class AdImpressionBase(BaseModel):
    ad_network: str
    ad_unit: str
    impression_count: int
    click_count: int
    revenue: float

class AdImpressionResponse(AdImpressionBase):
    id: int
    stream_id: int
    created_at: datetime

    class Config:
        from_attributes = True

# Discovery Schemas
class DiscoveryEventResponse(BaseModel):
    id: int
    title: str
    category: Optional[str] = None
    total_viewers: int
    total_streams: int
    ranking_score: float
    thumbnail_url: Optional[str] = None
    location_name: str
    is_featured: bool

    class Config:
        from_attributes = True

# Error Schemas
class ErrorResponse(BaseModel):
    detail: str
    code: Optional[str] = None
    status: Optional[int] = None

# Health Check Schema
class HealthCheckResponse(BaseModel):
    status: str
    service: str
    timestamp: datetime
