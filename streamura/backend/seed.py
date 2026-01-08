"""
Streamura Database Seed Data

This module provides seed data for initial database setup and testing.
"""

from .database import SessionLocal
from .models import User, Stream, Event, Transaction, AdImpression, Notification
from datetime import datetime, timedelta
import random
from faker import Faker

fake = Faker()

def seed_database():
    """Seed the database with initial test data"""
    db = SessionLocal()

    print("Seeding Streamura database...")

    # Clear existing data (for development)
    db.query(Notification).delete()
    db.query(AdImpression).delete()
    db.query(Transaction).delete()
    db.query(Stream).delete()
    db.query(Event).delete()
    db.query(User).delete()

    # Create test users
    users = create_test_users(db)
    print(f"✓ Created {len(users)} test users")

    # Create test events
    events = create_test_events(db, users)
    print(f"✓ Created {len(events)} test events")

    # Create test streams
    streams = create_test_streams(db, users, events)
    print(f"✓ Created {len(streams)} test streams")

    # Create test transactions
    transactions = create_test_transactions(db, users, streams)
    print(f"✓ Created {len(transactions)} test transactions")

    # Create test ad impressions
    ad_impressions = create_test_ad_impressions(db, streams)
    print(f"✓ Created {len(ad_impressions)} test ad impressions")

    # Create test notifications
    notifications = create_test_notifications(db, users, events)
    print(f"✓ Created {len(notifications)} test notifications")

    db.commit()
    print("✓ Database seeding complete")

def create_test_users(db, count=10):
    """Create test users"""
    users = []

    # Create admin user
    admin = User(
        username="admin",
        email="admin@streamura.com",
        phone_number="+1234567890",
        hashed_password="$2b$12$fakehashedpasswordforadmin",
        is_verified=True,
        stripe_customer_id="cus_test_admin",
        stripe_account_id="acct_test_admin",
        payout_enabled=True,
        balance=1000.00,
        lifetime_earnings=5000.00
    )
    db.add(admin)
    users.append(admin)

    # Create regular users
    for i in range(1, count):
        user = User(
            username=f"user{i}",
            email=f"user{i}@streamura.com",
            phone_number=f"+12345678{i:02d}",
            hashed_password=f"$2b$12$fakehashedpassword{i}",
            is_verified=random.choice([True, False]),
            stripe_customer_id=f"cus_test_{i}",
            stripe_account_id=f"acct_test_{i}" if random.random() > 0.3 else None,
            payout_enabled=random.random() > 0.5,
            balance=random.uniform(0, 100),
            lifetime_earnings=random.uniform(0, 1000)
        )
        db.add(user)
        users.append(user)

    db.flush()
    return users

def create_test_events(db, users, count=5):
    """Create test events"""
    events = []

    # Event categories and locations
    event_data = [
        {"title": "Rolling Stones Concert", "location": "Paris, France", "category": "music"},
        {"title": "Tech Conference 2024", "location": "San Francisco, USA", "category": "conference"},
        {"title": "Street Festival", "location": "Barcelona, Spain", "category": "festival"},
        {"title": "Protest March", "location": "Berlin, Germany", "category": "news"},
        {"title": "Sports Game", "location": "New York, USA", "category": "sports"}
    ]

    for i, data in enumerate(event_data):
        event = Event(
            title=data["title"],
            description=fake.text(max_nb_chars=200),
            creator_id=users[i % len(users)].id,
            latitude=random.uniform(-90, 90),
            longitude=random.uniform(-180, 180),
            location_name=data["location"],
            category=data["category"],
            is_featured=(i == 0),  # Feature the first event
            total_viewers=random.randint(1000, 10000),
            total_streams=random.randint(5, 50),
            total_earnings=random.uniform(100, 1000),
            ranking_score=random.uniform(0, 100)
        )
        db.add(event)
        events.append(event)

    db.flush()
    return events

def create_test_streams(db, users, events, count=50):
    """Create test streams"""
    streams = []

    # Stream categories
    categories = ["music", "news", "sports", "festival", "conference", "other"]

    for i in range(count):
        # Randomly assign to user (some anonymous)
        user_id = users[i % len(users)].id if random.random() > 0.2 else None

        # Randomly assign to event (some standalone)
        event_id = events[i % len(events)].id if random.random() > 0.4 else None

        # Random start time (last 30 days)
        start_time = datetime.utcnow() - timedelta(days=random.randint(0, 30))

        stream = Stream(
            stream_key=f"stream_{i:06d}",
            user_id=user_id,
            title=f"Live Stream {i+1}",
            description=fake.text(max_nb_chars=100),
            status=random.choice(["live", "ended", "archived"]),
            is_public=random.choice([True, True, False]),
            is_monetized=random.choice([True, False]),
            latitude=random.uniform(-90, 90),
            longitude=random.uniform(-180, 180),
            location_name=fake.city(),
            viewer_count=random.randint(0, 1000),
            peak_viewers=random.randint(0, 5000),
            total_watch_time=random.randint(0, 36000),
            earnings=random.uniform(0, 100),
            starts_at=start_time,
            ends_at=start_time + timedelta(hours=random.randint(1, 6)) if random.random() > 0.5 else None,
            category=random.choice(categories),
            thumbnail_url=f"https://example.com/thumbnail{i}.jpg",
            tags=[fake.word() for _ in range(random.randint(1, 5))]
        )
        db.add(stream)
        streams.append(stream)

    db.flush()
    return streams

def create_test_transactions(db, users, streams, count=30):
    """Create test transactions"""
    transactions = []

    transaction_types = ["earnings", "payout", "tip", "subscription"]

    for i in range(count):
        transaction = Transaction(
            user_id=users[i % len(users)].id,
            stream_id=streams[i % len(streams)].id if random.random() > 0.3 else None,
            amount=random.uniform(1, 100),
            currency="USD",
            transaction_type=random.choice(transaction_types),
            status=random.choice(["pending", "completed", "completed", "completed"]),
            stripe_transaction_id=f"txn_{fake.uuid4()}",
            stripe_transfer_id=f"trf_{fake.uuid4()}" if random.random() > 0.5 else None,
            completed_at=datetime.utcnow() - timedelta(days=random.randint(0, 7))
        )
        db.add(transaction)
        transactions.append(transaction)

    return transactions

def create_test_ad_impressions(db, streams, count=100):
    """Create test ad impressions"""
    ad_impressions = []

    ad_networks = ["google", "custom", "premium"]

    for i in range(count):
        impression = AdImpression(
            stream_id=streams[i % len(streams)].id,
            ad_network=random.choice(ad_networks),
            ad_unit=f"ad_unit_{i}",
            impression_count=random.randint(100, 10000),
            click_count=random.randint(10, 500),
            revenue=random.uniform(1, 50)
        )
        db.add(impression)
        ad_impressions.append(impression)

    return ad_impressions

def create_test_notifications(db, users, events, count=20):
    """Create test notifications"""
    notifications = []

    notification_types = ["earnings", "event", "system", "social"]

    for i in range(count):
        notification = Notification(
            user_id=users[i % len(users)].id,
            event_id=events[i % len(events)].id if random.random() > 0.5 else None,
            notification_type=random.choice(notification_types),
            title=f"Notification {i+1}",
            message=fake.text(max_nb_chars=150),
            is_read=random.choice([True, False]),
            metadata={
                "related_id": i,
                "priority": random.choice(["low", "medium", "high"])
            }
        )
        db.add(notification)
        notifications.append(notification)

    return notifications

if __name__ == "__main__":
    seed_database()
