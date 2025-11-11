"""Authentication service for verifying Supabase JWT tokens"""

from typing import Optional
from uuid import UUID

import jwt
import structlog
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from config import settings
from db.base import get_db
from db.models import User

logger = structlog.get_logger()
security = HTTPBearer()


class AuthService:
    """Service for authentication and authorization"""

    @staticmethod
    def verify_token(token: str) -> dict:
        """Verify Supabase JWT token"""
        # IMPORTANT: Supabase Auth uses JWT_SECRET, so prioritize that over SUPABASE_JWT_SECRET
        jwt_secret = settings.jwt_secret or settings.supabase_jwt_secret

        if not jwt_secret:
            logger.error(
                "JWT secret not configured - check SUPABASE_JWT_SECRET or JWT_SECRET in .env"
            )
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="JWT secret not configured",
            )

        try:
            # Decode and verify the JWT
            payload = jwt.decode(
                token,
                jwt_secret,
                algorithms=["HS256"],
                audience="authenticated",
            )
            return payload
        except jwt.ExpiredSignatureError:
            logger.warning("Token expired")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token has expired",
            )
        except jwt.InvalidTokenError as e:
            logger.warning("Invalid token", error=str(e))
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token",
            )

    @staticmethod
    async def get_or_create_user(user_id: UUID, email: str, db: AsyncSession) -> User:
        """Get existing user or create new one"""
        # Check if user exists
        result = await db.execute(select(User).where(User.id == user_id))
        user = result.scalar_one_or_none()

        if not user:
            # Create new user
            user = User(id=user_id, email=email)
            db.add(user)
            await db.flush()
            logger.info("Created new user", user_id=str(user_id), email=email)

        return user


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: AsyncSession = Depends(get_db),
) -> User:
    """FastAPI dependency to get current authenticated user"""
    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authorization header required",
        )

    token = credentials.credentials

    # Verify token and extract claims
    payload = AuthService.verify_token(token)

    user_id = UUID(payload.get("sub"))
    email = payload.get("email")

    if not user_id or not email:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token payload",
        )

    # Get or create user in database
    user = await AuthService.get_or_create_user(user_id, email, db)

    return user


async def get_current_user_optional(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(HTTPBearer(auto_error=False)),
    db: AsyncSession = Depends(get_db),
) -> Optional[User]:
    """Optional authentication - returns None if no valid token"""
    if not credentials:
        return None

    try:
        return await get_current_user(credentials, db)
    except HTTPException:
        return None
