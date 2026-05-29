"""
Streamura Authentication Service

This module handles user authentication, authorization, and session management.
"""

from datetime import datetime, timedelta
from typing import Optional
from jose import JWTError, jwt
from passlib.context import CryptContext
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from pydantic import BaseModel
from sqlalchemy.orm import Session
from .database import get_db
from .models import User
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Configuration
SECRET_KEY = os.getenv("JWT_SECRET")
ALGORITHM = os.getenv("JWT_ALGORITHM", "HS256")
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("JWT_EXPIRE_MINUTES", "60"))
REFRESH_TOKEN_EXPIRE_DAYS = int(os.getenv("JWT_REFRESH_EXPIRE_DAYS", "7"))

# Validate JWT_SECRET at import time
if not SECRET_KEY or len(SECRET_KEY) < 32:
    raise RuntimeError(
        "JWT_SECRET environment variable must be set and be at least 32 characters long. "
        "Generate one with: python -c \"import secrets; print(secrets.token_urlsafe(32))\""
    )

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# OAuth2 scheme
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")

# Token models
class Token(BaseModel):
    access_token: str
    token_type: str
    refresh_token: Optional[str] = None

class TokenData(BaseModel):
    username: Optional[str] = None
    phone: Optional[str] = None
    user_id: Optional[int] = None

class UserCreate(BaseModel):
    username: Optional[str] = None
    email: Optional[str] = None
    phone_number: Optional[str] = None
    password: str

class UserLogin(BaseModel):
    identifier: str  # Can be email, phone, or username
    password: str

class UserResponse(BaseModel):
    id: int
    username: Optional[str]
    email: Optional[str]
    phone_number: Optional[str]
    is_verified: bool
    is_admin: bool = False
    balance: float
    lifetime_earnings: float

    class Config:
        from_attributes = True

def verify_password(plain_password: str, hashed_password: str):
    """Verify password against hashed password"""
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password: str):
    """Hash a password for storing"""
    return pwd_context.hash(password)

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    """Create JWT access token"""
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=15)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def create_refresh_token(data: dict, expires_delta: Optional[timedelta] = None):
    """Create JWT refresh token"""
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)
    to_encode.update({"exp": expire, "token_type": "refresh"})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

async def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    """Get current user from JWT token"""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )

    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("sub")
        if user_id is None:
            raise credentials_exception

        token_data = TokenData(user_id=user_id)
    except JWTError:
        raise credentials_exception

    user = db.query(User).filter(User.id == token_data.user_id).first()
    if user is None:
        raise credentials_exception

    return user

async def get_current_active_user(current_user: User = Depends(get_current_user)):
    """Get current active user"""
    if not current_user.is_active:
        raise HTTPException(status_code=400, detail="Inactive user")
    return current_user


async def get_current_admin_user(current_user: User = Depends(get_current_active_user)):
    """Get current user and verify they have admin privileges"""
    if not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin privileges required"
        )
    return current_user


# Optional OAuth2 scheme that doesn't require authentication
oauth2_scheme_optional = OAuth2PasswordBearer(tokenUrl="token", auto_error=False)


async def get_current_user_optional(
    token: Optional[str] = Depends(oauth2_scheme_optional),
    db: Session = Depends(get_db)
) -> Optional[User]:
    """Get current user from JWT token, or None if not authenticated"""
    if token is None:
        return None

    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("sub")
        if user_id is None:
            return None

        user = db.query(User).filter(User.id == user_id).first()
        return user
    except JWTError:
        return None

def authenticate_user(db: Session, identifier: str, password: str):
    """Authenticate user by identifier (email, phone, or username)"""
    # Try to find user by email, phone, or username
    user = (
        db.query(User)
        .filter(
            (User.email == identifier) |
            (User.phone_number == identifier) |
            (User.username == identifier)
        )
        .first()
    )

    if not user:
        return None
    if not verify_password(password, user.hashed_password):
        return None

    return user

def create_user(db: Session, user_data: UserCreate):
    """Create a new user.

    Only compare identifiers that the new user actually provided. Comparing
    empty phone_number against existing users with empty phone caused
    false-positive collisions that blocked every phone-less registration.
    """
    from sqlalchemy import or_
    conditions = []
    if user_data.email:
        conditions.append(User.email == user_data.email)
    if user_data.phone_number:  # only check when non-empty
        conditions.append(User.phone_number == user_data.phone_number)
    if user_data.username:
        conditions.append(User.username == user_data.username)

    if conditions:
        existing_user = db.query(User).filter(or_(*conditions)).first()
        if existing_user:
            collision = (
                "email" if existing_user.email == user_data.email
                else "username" if existing_user.username == user_data.username
                else "phone number"
            )
            raise HTTPException(
                status_code=400,
                detail=f"A user with this {collision} already exists"
            )

    # Hash password
    hashed_password = get_password_hash(user_data.password)

    # Normalize empty strings to NULL so the UNIQUE constraint on phone_number
    # doesn't reject the second phone-less registration.
    phone = user_data.phone_number.strip() if user_data.phone_number else ""
    db_user = User(
        username=user_data.username,
        email=user_data.email,
        phone_number=phone or None,
        hashed_password=hashed_password,
        is_verified=False
    )

    db.add(db_user)
    db.commit()
    db.refresh(db_user)

    return db_user

def create_anonymous_user(db: Session):
    """Create an anonymous user session"""
    # Generate a unique identifier
    import uuid
    anonymous_id = f"anonymous_{uuid.uuid4().hex[:16]}"

    # Create anonymous user
    db_user = User(
        username=anonymous_id,
        is_verified=False,
        is_active=True
    )

    db.add(db_user)
    db.commit()
    db.refresh(db_user)

    return db_user

def migrate_anonymous_to_registered(db: Session, anonymous_user_id: int, user_data: UserCreate):
    """Migrate anonymous user to registered user"""
    # Get anonymous user
    anonymous_user = db.query(User).filter(User.id == anonymous_user_id).first()

    if not anonymous_user:
        raise HTTPException(status_code=404, detail="Anonymous user not found")

    if anonymous_user.email or anonymous_user.phone_number:
        raise HTTPException(status_code=400, detail="User is already registered")

    # Check if new credentials are available (excluding the anonymous user itself)
    existing_user = (
        db.query(User)
        .filter(
            User.id != anonymous_user_id,
            (User.email == user_data.email) |
            (User.phone_number == user_data.phone_number) |
            (User.username == user_data.username)
        )
        .first()
    )

    if existing_user:
        raise HTTPException(
            status_code=400,
            detail="User with this email, phone, or username already exists"
        )

    # Update anonymous user with real credentials
    anonymous_user.username = user_data.username
    anonymous_user.email = user_data.email
    anonymous_user.phone_number = user_data.phone_number
    anonymous_user.hashed_password = get_password_hash(user_data.password)
    anonymous_user.is_verified = False

    db.commit()
    db.refresh(anonymous_user)

    return anonymous_user

def generate_auth_tokens(user: User):
    """Generate authentication tokens for a user"""
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    refresh_token_expires = timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)

    # Data to encode in JWT
    token_data = {
        "sub": str(user.id),
        "username": user.username,
        "email": user.email,
        "phone": user.phone_number
    }

    access_token = create_access_token(
        token_data,
        expires_delta=access_token_expires
    )

    refresh_token = create_refresh_token(
        token_data,
        expires_delta=refresh_token_expires
    )

    return Token(
        access_token=access_token,
        token_type="bearer",
        refresh_token=refresh_token
    )

def refresh_access_token(refresh_token: str):
    """Refresh access token using refresh token"""
    try:
        payload = jwt.decode(refresh_token, SECRET_KEY, algorithms=[ALGORITHM])
        if payload.get("token_type") != "refresh":
            raise HTTPException(status_code=401, detail="Invalid refresh token")

        user_id = payload.get("sub")
        if user_id is None:
            raise HTTPException(status_code=401, detail="Invalid refresh token")

        # Create new access token
        token_data = {
            "sub": user_id,
            "username": payload.get("username"),
            "email": payload.get("email"),
            "phone": payload.get("phone")
        }

        access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
        new_access_token = create_access_token(
            token_data,
            expires_delta=access_token_expires
        )

        return Token(
            access_token=new_access_token,
            token_type="bearer"
        )

    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid refresh token")


# Password Reset
RESET_TOKEN_EXPIRE_HOURS = 24

class PasswordResetRequest(BaseModel):
    email: str

class PasswordResetConfirm(BaseModel):
    token: str
    new_password: str

def create_password_reset_token(email: str) -> str:
    """Create a password reset token"""
    expire = datetime.utcnow() + timedelta(hours=RESET_TOKEN_EXPIRE_HOURS)
    to_encode = {
        "sub": email,
        "type": "password_reset",
        "exp": expire
    }
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

def verify_password_reset_token(token: str) -> Optional[str]:
    """Verify password reset token and return email if valid"""
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        if payload.get("type") != "password_reset":
            return None
        return payload.get("sub")
    except JWTError:
        return None

def reset_user_password(db: Session, email: str, new_password: str) -> bool:
    """Reset user's password"""
    user = db.query(User).filter(User.email == email).first()
    if not user:
        return False

    user.hashed_password = get_password_hash(new_password)
    db.commit()
    return True
