"""
Messaging Service (Phase 12)

Handles direct messaging functionality including:
- Sending and receiving messages
- Conversation management
- User blocking
- Read receipts
"""

import logging
from typing import List, Optional, Dict, Any
from datetime import datetime

from sqlalchemy import or_, and_
from sqlalchemy.orm import Session

from .models import DirectMessage, Conversation, UserBlock, User

logger = logging.getLogger(__name__)


class MessagingService:
    """
    Service for direct messaging between users.

    Supports one-on-one messaging with read receipts,
    conversation management, and user blocking.
    """

    def __init__(self, db: Session):
        self.db = db

    # =========================================================================
    # MESSAGES
    # =========================================================================

    async def send_message(
        self,
        sender_id: int,
        recipient_id: int,
        content: str
    ) -> DirectMessage:
        """
        Send a direct message to another user.

        Creates a conversation if one doesn't exist.
        """
        if sender_id == recipient_id:
            raise ValueError("Cannot send message to yourself")

        if not content or not content.strip():
            raise ValueError("Message content cannot be empty")

        # Check if recipient exists
        recipient = self.db.query(User).filter(User.id == recipient_id).first()
        if not recipient:
            raise ValueError("Recipient not found")

        # Check if blocked
        if await self.is_blocked(sender_id, recipient_id):
            raise PermissionError("Cannot send message to this user")

        # Get or create conversation
        conversation = await self._get_or_create_conversation(sender_id, recipient_id)

        # Create message
        message = DirectMessage(
            conversation_id=conversation.id,
            sender_id=sender_id,
            recipient_id=recipient_id,
            content=content.strip(),
        )
        self.db.add(message)

        # Update conversation metadata
        conversation.last_message_at = datetime.utcnow()
        conversation.last_message_preview = content[:255] if len(content) > 255 else content

        # Update unread count for recipient
        if conversation.user1_id == recipient_id:
            conversation.user1_unread_count += 1
        else:
            conversation.user2_unread_count += 1

        self.db.commit()
        self.db.refresh(message)

        logger.info(f"Message sent from {sender_id} to {recipient_id}")
        return message

    async def get_messages(
        self,
        conversation_id: int,
        user_id: int,
        limit: int = 50,
        offset: int = 0,
        before_id: Optional[int] = None
    ) -> Dict[str, Any]:
        """
        Get messages in a conversation.

        Only participants can view messages.
        """
        # Verify user is part of conversation
        conversation = self.db.query(Conversation).filter(
            Conversation.id == conversation_id
        ).first()

        if not conversation:
            raise ValueError("Conversation not found")

        if conversation.user1_id != user_id and conversation.user2_id != user_id:
            raise PermissionError("Not authorized to view this conversation")

        # Build query
        query = self.db.query(DirectMessage).filter(
            DirectMessage.conversation_id == conversation_id
        )

        # Filter out deleted messages for this user
        if user_id == conversation.user1_id:
            query = query.filter(DirectMessage.is_deleted_by_sender == False)
        else:
            query = query.filter(DirectMessage.is_deleted_by_recipient == False)

        # Pagination - load older messages
        if before_id:
            query = query.filter(DirectMessage.id < before_id)

        total = query.count()
        messages = query.order_by(
            DirectMessage.created_at.desc()
        ).offset(offset).limit(limit).all()

        # Reverse to show oldest first
        messages.reverse()

        return {
            "messages": messages,
            "total": total,
            "limit": limit,
            "offset": offset,
            "conversation_id": conversation_id,
        }

    async def mark_as_read(
        self,
        conversation_id: int,
        user_id: int
    ) -> int:
        """
        Mark all messages in a conversation as read.

        Returns the number of messages marked as read.
        """
        conversation = self.db.query(Conversation).filter(
            Conversation.id == conversation_id
        ).first()

        if not conversation:
            raise ValueError("Conversation not found")

        if conversation.user1_id != user_id and conversation.user2_id != user_id:
            raise PermissionError("Not authorized to access this conversation")

        # Mark unread messages as read
        updated = self.db.query(DirectMessage).filter(
            DirectMessage.conversation_id == conversation_id,
            DirectMessage.recipient_id == user_id,
            DirectMessage.is_read == False
        ).update({
            "is_read": True,
            "read_at": datetime.utcnow()
        })

        # Reset unread count
        if conversation.user1_id == user_id:
            conversation.user1_unread_count = 0
        else:
            conversation.user2_unread_count = 0

        self.db.commit()
        return updated

    async def delete_message(
        self,
        message_id: int,
        user_id: int
    ) -> bool:
        """
        Delete a message (soft delete for the user).

        Users can only delete messages from their perspective.
        """
        message = self.db.query(DirectMessage).filter(
            DirectMessage.id == message_id
        ).first()

        if not message:
            raise ValueError("Message not found")

        if message.sender_id == user_id:
            message.is_deleted_by_sender = True
        elif message.recipient_id == user_id:
            message.is_deleted_by_recipient = True
        else:
            raise PermissionError("Not authorized to delete this message")

        self.db.commit()
        return True

    # =========================================================================
    # CONVERSATIONS
    # =========================================================================

    async def get_conversations(
        self,
        user_id: int,
        limit: int = 20,
        offset: int = 0
    ) -> Dict[str, Any]:
        """Get all conversations for a user."""
        query = self.db.query(Conversation).filter(
            or_(
                Conversation.user1_id == user_id,
                Conversation.user2_id == user_id
            )
        )

        total = query.count()
        conversations = query.order_by(
            Conversation.last_message_at.desc()
        ).offset(offset).limit(limit).all()

        # Enrich with unread count and other user info
        result = []
        for conv in conversations:
            other_user_id = conv.user2_id if conv.user1_id == user_id else conv.user1_id
            other_user = self.db.query(User).filter(User.id == other_user_id).first()

            unread_count = conv.user1_unread_count if conv.user1_id == user_id else conv.user2_unread_count

            result.append({
                "id": conv.id,
                "other_user": {
                    "id": other_user.id,
                    "username": other_user.username,
                    "display_name": other_user.display_name,
                    "avatar_url": other_user.avatar_url,
                } if other_user else None,
                "last_message_at": conv.last_message_at,
                "last_message_preview": conv.last_message_preview,
                "unread_count": unread_count,
            })

        return {
            "conversations": result,
            "total": total,
            "limit": limit,
            "offset": offset,
        }

    async def get_conversation_with_user(
        self,
        user_id: int,
        other_user_id: int
    ) -> Optional[Conversation]:
        """Get or create a conversation between two users."""
        return await self._get_or_create_conversation(user_id, other_user_id)

    async def get_unread_count(self, user_id: int) -> int:
        """Get total unread message count for a user."""
        user1_count = self.db.query(Conversation).filter(
            Conversation.user1_id == user_id
        ).with_entities(func.sum(Conversation.user1_unread_count)).scalar() or 0

        user2_count = self.db.query(Conversation).filter(
            Conversation.user2_id == user_id
        ).with_entities(func.sum(Conversation.user2_unread_count)).scalar() or 0

        return int(user1_count) + int(user2_count)

    # =========================================================================
    # BLOCKING
    # =========================================================================

    async def block_user(
        self,
        blocker_id: int,
        blocked_id: int,
        reason: Optional[str] = None
    ) -> UserBlock:
        """Block another user."""
        if blocker_id == blocked_id:
            raise ValueError("Cannot block yourself")

        # Check if already blocked
        existing = self.db.query(UserBlock).filter(
            UserBlock.blocker_id == blocker_id,
            UserBlock.blocked_id == blocked_id
        ).first()

        if existing:
            raise ValueError("User already blocked")

        # Check if blocked user exists
        blocked_user = self.db.query(User).filter(User.id == blocked_id).first()
        if not blocked_user:
            raise ValueError("User not found")

        block = UserBlock(
            blocker_id=blocker_id,
            blocked_id=blocked_id,
            reason=reason,
        )
        self.db.add(block)
        self.db.commit()
        self.db.refresh(block)

        logger.info(f"User {blocker_id} blocked user {blocked_id}")
        return block

    async def unblock_user(
        self,
        blocker_id: int,
        blocked_id: int
    ) -> bool:
        """Unblock a user."""
        block = self.db.query(UserBlock).filter(
            UserBlock.blocker_id == blocker_id,
            UserBlock.blocked_id == blocked_id
        ).first()

        if not block:
            raise ValueError("User is not blocked")

        self.db.delete(block)
        self.db.commit()

        logger.info(f"User {blocker_id} unblocked user {blocked_id}")
        return True

    async def is_blocked(
        self,
        user1_id: int,
        user2_id: int
    ) -> bool:
        """Check if either user has blocked the other."""
        block = self.db.query(UserBlock).filter(
            or_(
                and_(UserBlock.blocker_id == user1_id, UserBlock.blocked_id == user2_id),
                and_(UserBlock.blocker_id == user2_id, UserBlock.blocked_id == user1_id)
            )
        ).first()
        return block is not None

    async def get_blocked_users(
        self,
        user_id: int,
        limit: int = 50,
        offset: int = 0
    ) -> Dict[str, Any]:
        """Get list of users blocked by this user."""
        query = self.db.query(UserBlock).filter(
            UserBlock.blocker_id == user_id
        )

        total = query.count()
        blocks = query.order_by(
            UserBlock.created_at.desc()
        ).offset(offset).limit(limit).all()

        return {
            "blocks": blocks,
            "total": total,
            "limit": limit,
            "offset": offset,
        }

    # =========================================================================
    # HELPERS
    # =========================================================================

    async def _get_or_create_conversation(
        self,
        user1_id: int,
        user2_id: int
    ) -> Conversation:
        """Get existing conversation or create new one."""
        # Normalize order to avoid duplicates
        if user1_id > user2_id:
            user1_id, user2_id = user2_id, user1_id

        conversation = self.db.query(Conversation).filter(
            Conversation.user1_id == user1_id,
            Conversation.user2_id == user2_id
        ).first()

        if not conversation:
            conversation = Conversation(
                user1_id=user1_id,
                user2_id=user2_id,
            )
            self.db.add(conversation)
            self.db.commit()
            self.db.refresh(conversation)

        return conversation


# Import func for aggregate queries
from sqlalchemy import func


def get_messaging_service(db: Session) -> MessagingService:
    """Factory function to get a messaging service instance."""
    return MessagingService(db)
