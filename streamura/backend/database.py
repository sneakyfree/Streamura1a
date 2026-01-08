"""
Streamura Database Configuration and Initialization

This module handles database connection setup, session management,
and initialization for the Streamura backend.
"""

from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, scoped_session
from dotenv import load_dotenv
import os

# Load environment variables
load_dotenv()

# Database configuration
DB_HOST = os.getenv("DB_HOST", "localhost")
DB_PORT = os.getenv("DB_PORT", "5432")
DB_NAME = os.getenv("DB_NAME", "streamura")
DB_USER = os.getenv("DB_USER", "streamura")
DB_PASSWORD = os.getenv("DB_PASSWORD", "streamura_dev")

# Create database URL
DATABASE_URL = f"postgresql://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}"

# Create engine
engine = create_engine(
    DATABASE_URL,
    pool_size=int(os.getenv("DB_POOL_SIZE", "10")),
    max_overflow=int(os.getenv("DB_POOL_SIZE", "10")) * 2,
    pool_pre_ping=True,
    pool_recycle=int(os.getenv("DB_POOL_RECYCLE", "3600")),
    echo=os.getenv("DEBUG", "False").lower() == "true"
)

# Create session factory
SessionLocal = scoped_session(
    sessionmaker(
        autocommit=False,
        autoflush=False,
        bind=engine
    )
)

# Base for models
Base = declarative_base()

def get_db():
    """Dependency to get DB session"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def init_db():
    """Initialize database with tables and seed data"""
    from .models import Base

    print("Initializing Streamura database...")

    # Create all tables
    Base.metadata.create_all(bind=engine)
    print("✓ Database tables created")

    # Import and create seed data
    from .seed import seed_database
    seed_database()

    print("✓ Database initialization complete")

def drop_db():
    """Drop all database tables (for development only)"""
    from .models import Base

    print("Dropping all database tables...")
    Base.metadata.drop_all(bind=engine)
    print("✓ All tables dropped")

if __name__ == "__main__":
    # Command line interface for database management
    import argparse

    parser = argparse.ArgumentParser(description="Streamura Database Management")
    parser.add_argument("command", choices=["init", "drop", "reset"],
                       help="Database command to execute")

    args = parser.parse_args()

    if args.command == "init":
        init_db()
    elif args.command == "drop":
        drop_db()
    elif args.command == "reset":
        drop_db()
        init_db()
