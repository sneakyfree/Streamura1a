"""
Community Service (Phase 12)

Handles community/group functionality including:
- Community CRUD operations
- Membership management
- Role assignments (owner, moderator, member)
- Community discovery and search
"""

import logging
from typing import List, Optional, Dict, Any
from datetime import datetime

from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from .models import Community, CommunityMember, User, UserBlock

logger = logging.getLogger(__name__)


class CommunityService:
    """
    Service for managing communities.

    Communities are user-created groups where members can connect,
    share content, and participate in discussions.
    """

    def __init__(self, db: Session):
        self.db = db

    # =========================================================================
    # COMMUNITY CRUD
    # =========================================================================

    async def create_community(
        self,
        owner_id: int,
        name: str,
        description: Optional[str] = None,
        image_url: Optional[str] = None,
        banner_url: Optional[str] = None,
        is_public: bool = True,
        rules: Optional[List[str]] = None,
        tags: Optional[List[str]] = None,
    ) -> Community:
        """
        Create a new community.

        The creator automatically becomes the owner and first member.
        """
        # Verify owner exists
        owner = self.db.query(User).filter(User.id == owner_id).first()
        if not owner:
            raise ValueError("User not found")

        # Create community
        community = Community(
            name=name,
            description=description,
            owner_id=owner_id,
            image_url=image_url,
            banner_url=banner_url,
            is_public=is_public,
            rules=rules or [],
            tags=tags or [],
            member_count=1,  # Owner counts as first member
        )

        self.db.add(community)
        self.db.commit()
        self.db.refresh(community)

        # Add owner as first member with owner role
        membership = CommunityMember(
            community_id=community.id,
            user_id=owner_id,
            role="owner",
        )
        self.db.add(membership)
        self.db.commit()

        logger.info(f"Community created: {community.id} by user {owner_id}")
        return community

    async def get_community(self, community_id: int) -> Optional[Community]:
        """Get a community by ID."""
        return self.db.query(Community).filter(
            Community.id == community_id,
            Community.is_active == True
        ).first()

    async def update_community(
        self,
        community_id: int,
        user_id: int,
        **kwargs
    ) -> Community:
        """
        Update community details.

        Only owner or moderators can update (owner can update more fields).
        """
        community = await self.get_community(community_id)
        if not community:
            raise ValueError("Community not found")

        # Check permissions
        membership = self._get_membership(community_id, user_id)
        if not membership or membership.role not in ["owner", "moderator"]:
            raise PermissionError("Not authorized to update this community")

        # Only owner can change certain fields
        owner_only_fields = ["is_public", "owner_id"]
        if membership.role != "owner":
            for field in owner_only_fields:
                if field in kwargs:
                    raise PermissionError(f"Only owner can change {field}")

        # Update allowed fields
        allowed_fields = [
            "name", "description", "image_url", "banner_url",
            "is_public", "rules", "tags"
        ]
        for field in allowed_fields:
            if field in kwargs and kwargs[field] is not None:
                setattr(community, field, kwargs[field])

        self.db.commit()
        self.db.refresh(community)
        return community

    async def delete_community(self, community_id: int, user_id: int) -> bool:
        """
        Soft-delete a community.

        Only the owner can delete a community.
        """
        community = await self.get_community(community_id)
        if not community:
            raise ValueError("Community not found")

        if community.owner_id != user_id:
            raise PermissionError("Only the owner can delete this community")

        community.is_active = False
        self.db.commit()

        logger.info(f"Community deleted: {community_id} by user {user_id}")
        return True

    # =========================================================================
    # MEMBERSHIP
    # =========================================================================

    async def join_community(
        self,
        community_id: int,
        user_id: int
    ) -> CommunityMember:
        """
        Join a community.

        For public communities, membership is automatic.
        For private communities, this could create a request (future feature).
        """
        community = await self.get_community(community_id)
        if not community:
            raise ValueError("Community not found")

        # Check if already a member
        existing = self._get_membership(community_id, user_id)
        if existing:
            raise ValueError("Already a member of this community")

        # Check if community is public
        if not community.is_public:
            raise PermissionError("This is a private community")

        # Create membership
        membership = CommunityMember(
            community_id=community_id,
            user_id=user_id,
            role="member",
        )
        self.db.add(membership)

        # Update member count
        community.member_count += 1

        self.db.commit()
        self.db.refresh(membership)

        logger.info(f"User {user_id} joined community {community_id}")
        return membership

    async def leave_community(
        self,
        community_id: int,
        user_id: int
    ) -> bool:
        """
        Leave a community.

        Owners cannot leave - they must transfer ownership or delete.
        """
        community = await self.get_community(community_id)
        if not community:
            raise ValueError("Community not found")

        membership = self._get_membership(community_id, user_id)
        if not membership:
            raise ValueError("Not a member of this community")

        if membership.role == "owner":
            raise PermissionError("Owners cannot leave. Transfer ownership or delete the community.")

        self.db.delete(membership)
        community.member_count = max(0, community.member_count - 1)
        self.db.commit()

        logger.info(f"User {user_id} left community {community_id}")
        return True

    async def get_members(
        self,
        community_id: int,
        limit: int = 50,
        offset: int = 0,
        role: Optional[str] = None
    ) -> Dict[str, Any]:
        """Get community members with pagination."""
        query = self.db.query(CommunityMember).filter(
            CommunityMember.community_id == community_id
        )

        if role:
            query = query.filter(CommunityMember.role == role)

        total = query.count()
        members = query.order_by(CommunityMember.joined_at).offset(offset).limit(limit).all()

        return {
            "members": members,
            "total": total,
            "limit": limit,
            "offset": offset,
        }

    async def set_member_role(
        self,
        community_id: int,
        target_user_id: int,
        acting_user_id: int,
        new_role: str
    ) -> CommunityMember:
        """
        Change a member's role.

        Role hierarchy: owner > moderator > member
        Only owner can promote to moderator or transfer ownership.
        """
        if new_role not in ["owner", "moderator", "member"]:
            raise ValueError("Invalid role")

        community = await self.get_community(community_id)
        if not community:
            raise ValueError("Community not found")

        # Check acting user permissions
        actor_membership = self._get_membership(community_id, acting_user_id)
        if not actor_membership or actor_membership.role != "owner":
            raise PermissionError("Only owner can change roles")

        # Get target membership
        target_membership = self._get_membership(community_id, target_user_id)
        if not target_membership:
            raise ValueError("Target user is not a member")

        # Handle ownership transfer
        if new_role == "owner":
            # Current owner becomes moderator
            actor_membership.role = "moderator"
            community.owner_id = target_user_id

        target_membership.role = new_role
        self.db.commit()
        self.db.refresh(target_membership)

        logger.info(f"Role changed: user {target_user_id} is now {new_role} in community {community_id}")
        return target_membership

    async def mute_member(
        self,
        community_id: int,
        target_user_id: int,
        acting_user_id: int,
        until: Optional[datetime] = None
    ) -> CommunityMember:
        """
        Mute a member in a community.

        Owner and moderators can mute members.
        """
        community = await self.get_community(community_id)
        if not community:
            raise ValueError("Community not found")

        # Check permissions
        actor_membership = self._get_membership(community_id, acting_user_id)
        if not actor_membership or actor_membership.role not in ["owner", "moderator"]:
            raise PermissionError("Not authorized to mute members")

        target_membership = self._get_membership(community_id, target_user_id)
        if not target_membership:
            raise ValueError("Target user is not a member")

        # Can't mute owner or higher-ranked members
        if target_membership.role == "owner":
            raise PermissionError("Cannot mute the owner")
        if target_membership.role == "moderator" and actor_membership.role != "owner":
            raise PermissionError("Only owner can mute moderators")

        target_membership.is_muted = True
        target_membership.muted_until = until
        self.db.commit()
        self.db.refresh(target_membership)

        return target_membership

    async def kick_member(
        self,
        community_id: int,
        target_user_id: int,
        acting_user_id: int
    ) -> bool:
        """
        Remove a member from the community.

        Owner and moderators can kick members.
        """
        community = await self.get_community(community_id)
        if not community:
            raise ValueError("Community not found")

        # Check permissions
        actor_membership = self._get_membership(community_id, acting_user_id)
        if not actor_membership or actor_membership.role not in ["owner", "moderator"]:
            raise PermissionError("Not authorized to kick members")

        target_membership = self._get_membership(community_id, target_user_id)
        if not target_membership:
            raise ValueError("Target user is not a member")

        # Can't kick owner or higher-ranked members
        if target_membership.role == "owner":
            raise PermissionError("Cannot kick the owner")
        if target_membership.role == "moderator" and actor_membership.role != "owner":
            raise PermissionError("Only owner can kick moderators")

        self.db.delete(target_membership)
        community.member_count = max(0, community.member_count - 1)
        self.db.commit()

        logger.info(f"User {target_user_id} was kicked from community {community_id}")
        return True

    # =========================================================================
    # DISCOVERY
    # =========================================================================

    async def list_communities(
        self,
        limit: int = 20,
        offset: int = 0,
        search: Optional[str] = None,
        tags: Optional[List[str]] = None,
        user_id: Optional[int] = None,  # For checking membership
    ) -> Dict[str, Any]:
        """List public communities with optional filters."""
        query = self.db.query(Community).filter(
            Community.is_active == True,
            Community.is_public == True
        )

        if search:
            search_filter = f"%{search}%"
            query = query.filter(
                or_(
                    Community.name.ilike(search_filter),
                    Community.description.ilike(search_filter)
                )
            )

        total = query.count()
        communities = query.order_by(
            Community.member_count.desc()
        ).offset(offset).limit(limit).all()

        return {
            "communities": communities,
            "total": total,
            "limit": limit,
            "offset": offset,
        }

    async def get_user_communities(
        self,
        user_id: int,
        limit: int = 50,
        offset: int = 0
    ) -> Dict[str, Any]:
        """Get communities that a user is a member of."""
        query = self.db.query(Community).join(
            CommunityMember, Community.id == CommunityMember.community_id
        ).filter(
            CommunityMember.user_id == user_id,
            Community.is_active == True
        )

        total = query.count()
        communities = query.order_by(
            CommunityMember.joined_at.desc()
        ).offset(offset).limit(limit).all()

        return {
            "communities": communities,
            "total": total,
            "limit": limit,
            "offset": offset,
        }

    async def check_membership(
        self,
        community_id: int,
        user_id: int
    ) -> Optional[CommunityMember]:
        """Check if a user is a member of a community."""
        return self._get_membership(community_id, user_id)

    # =========================================================================
    # HELPERS
    # =========================================================================

    def _get_membership(
        self,
        community_id: int,
        user_id: int
    ) -> Optional[CommunityMember]:
        """Get a user's membership in a community."""
        return self.db.query(CommunityMember).filter(
            CommunityMember.community_id == community_id,
            CommunityMember.user_id == user_id
        ).first()


def get_community_service(db: Session) -> CommunityService:
    """Factory function to get a community service instance."""
    return CommunityService(db)
