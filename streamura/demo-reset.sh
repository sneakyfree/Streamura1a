#!/bin/bash
# Streamura Demo Reset Script
# Resets database to clean seed state

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "🔄 Resetting Streamura database to demo state..."

# Remove existing database. The app's default DATABASE_URL is sqlite:///./streamura.db
# resolved from this directory (SCRIPT_DIR), so the live DB is ./streamura.db — remove
# that one (and the legacy backend/ copy, if any) so reset truly resets.
rm -f streamura.db backend/streamura.db
echo "✅ Removed old database"

# Activate virtual environment
source backend/venv/bin/activate
export PYTHONPATH="$SCRIPT_DIR"
# Ephemeral secret for the seed process (never hardcode a real key in the repo).
export JWT_SECRET="${JWT_SECRET:-$(python -c 'import secrets;print(secrets.token_urlsafe(48))')}"

# Create tables and seed data
python -c "
from backend.database import Base, engine, SessionLocal
from backend.models import User, Event, Stream
from datetime import datetime, timedelta
from passlib.context import CryptContext
import random

# Create tables
Base.metadata.create_all(bind=engine)
print('✅ Created database tables')

# Seed data
pwd_context = CryptContext(schemes=['bcrypt'], deprecated='auto')
db = SessionLocal()

try:
    # Users with various trust levels
    users = [
        ('admin', 'admin@streamura.com', 'admin123', True, True, 85),
        ('demo', 'demo@streamura.com', 'demo123', True, False, 45),
        ('creator1', 'creator@streamura.com', 'creator123', True, False, 72),
        ('creator2', 'gold_streamer@streamura.com', 'gold123', True, False, 78),
        ('creator3', 'silver_streamer@streamura.com', 'silver123', True, False, 55),
        ('creator4', 'bronze_streamer@streamura.com', 'bronze123', True, False, 28),
        ('newbie', 'new_user@streamura.com', 'newbie123', True, False, 10),
    ]
    
    db_users = []
    for username, email, password, verified, is_admin, trust in users:
        user = User(
            username=username,
            email=email,
            hashed_password=pwd_context.hash(password),
            is_verified=verified,
            is_admin=is_admin,
            balance=random.uniform(0, 500) if username != 'newbie' else 0,
            created_at=datetime.utcnow() - timedelta(days=random.randint(30, 365)),
        )
        db.add(user)
        db.flush()
        db_users.append(user)

    print(f'✅ Created {len(users)} users')
    
    # Events
    events = [
        ('Tech Conference 2026', 37.7749, -122.4194, 'San Francisco', 'conference', 5000, True),
        ('Music Festival Live', 30.2672, -97.7431, 'Austin', 'music', 12000, False),
        ('Championship Game', 40.7128, -74.0060, 'New York', 'sports', 25000, False),
    ]
    
    db_events = []
    for title, lat, lon, location, category, viewers, featured in events:
        event = Event(
            title=title,
            latitude=lat,
            longitude=lon,
            location_name=location,
            category=category,
            status='active',
            creator_id=db_users[random.randint(0, 2)].id,
            total_viewers=viewers,
            is_featured=featured,
            starts_at=datetime.utcnow() - timedelta(hours=random.randint(1, 4)),
        )
        db.add(event)
        db_events.append(event)
    
    db.flush()
    print(f'✅ Created {len(events)} events')
    
    # Streams
    stream_titles = [
        'Main Stage Coverage', 'Behind the Scenes', 'VIP Area Stream',
        'Opening Ceremony', 'Live Interview', 'Crowd Reactions',
        'Backstage Pass', 'Technical Talk', 'Panel Discussion', 'Closing Keynote'
    ]
    
    for i, title in enumerate(stream_titles):
        event = db_events[i % len(db_events)]
        creator = db_users[random.randint(2, 5)]
        stream = Stream(
            title=title,
            description=f'Live coverage of {event.title}',
            user_id=creator.id,
            event_id=event.id,
            status='live' if i < 5 else 'ended',
            category=event.category,
            viewer_count=random.randint(50, 2000),
            created_at=datetime.utcnow() - timedelta(hours=random.randint(0, 8)),
        )
        db.add(stream)
    
    print(f'✅ Created {len(stream_titles)} streams')
    
    db.commit()
    print('✅ Database seeded successfully!')
    
except Exception as e:
    db.rollback()
    print(f'❌ Error: {e}')
    raise
finally:
    db.close()
"

echo ""
echo "🎉 Demo reset complete! Database ready at backend/streamura.db"
