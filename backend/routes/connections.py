"""
Connections Routes
Handles glances, icebreakers, connections, messages, and chat requests.
"""
from fastapi import APIRouter, Depends, HTTPException
from typing import List, Optional
from datetime import datetime, timezone, timedelta
import uuid
import logging

from .dependencies import (
    db, get_current_user, IS_TEST_BUILD,
    FREE_DAILY_GLANCES, PREMIUM_DAILY_GLANCES,
    FREE_DAILY_ICEBREAKERS, PREMIUM_DAILY_ICEBREAKERS,
    GlanceCreate, IcebreakerCreate, IcebreakerResponse, IcebreakerActionRequest,
    ConnectionResponse, MessageCreate, MessageResponse, MarkMessagesRead,
    get_first_name, check_chat_unlocked,
    ICEBREAKER_MESSAGES
)

router = APIRouter()
logger = logging.getLogger(__name__)


# Push notification helper for routes
async def send_push_notification_from_route(user_id: str, title: str, body: str, data: dict = None):
    """
    Send push notification to a user.
    Uses the same logic as server.py's send_push_notification.
    """
    try:
        from pywebpush import webpush, WebPushException
        import os
        import json
        
        # Get user's push subscriptions
        subscriptions = await db.push_subscriptions.find({"user_id": user_id}).to_list(10)
        if not subscriptions:
            logger.info(f"No push subscriptions for user {user_id}")
            return
        
        # Check user's notification settings
        settings = await db.push_settings.find_one({"user_id": user_id})
        if settings and not settings.get("enabled", True):
            logger.info(f"Push notifications disabled for user {user_id}")
            return
        
        vapid_private_key = os.environ.get("VAPID_PRIVATE_KEY", "")
        vapid_claims = {"sub": "mailto:support@hereandnow.app"}
        
        if not vapid_private_key:
            logger.warning("VAPID_PRIVATE_KEY not configured")
            return
        
        payload = json.dumps({
            "title": title,
            "body": body,
            "data": data or {}
        })
        
        for sub in subscriptions:
            try:
                webpush(
                    subscription_info=sub["subscription"],
                    data=payload,
                    vapid_private_key=vapid_private_key,
                    vapid_claims=vapid_claims
                )
                logger.info(f"Push notification sent to user {user_id}")
            except WebPushException as e:
                logger.error(f"Push notification failed: {e}")
                if e.response and e.response.status_code in [404, 410]:
                    # Subscription expired, remove it
                    await db.push_subscriptions.delete_one({"_id": sub["_id"]})
            except Exception as e:
                logger.error(f"Push notification error: {e}")
    except ImportError:
        logger.warning("pywebpush not installed, skipping push notification")
    except Exception as e:
        logger.error(f"Push notification error: {e}")


# ============================================================================
# GLANCE ROUTES
# ============================================================================

@router.post("/glance")
async def send_glance(data: GlanceCreate, current_user: dict = Depends(get_current_user)):
    """Send a glance to another user at a venue. Uses daily allowance first, then tokens as fallback."""
    now = datetime.now(timezone.utc)
    
    # Check daily glance limit
    bypass_limits = IS_TEST_BUILD or current_user.get("bypass_glance_limits", False)
    
    # Re-fetch user from database to get fresh daily usage counters
    fresh_user = await db.users.find_one({"id": current_user["id"]}, {"_id": 0})
    if not fresh_user:
        raise HTTPException(status_code=401, detail="User not found")
    
    is_premium = fresh_user.get("is_premium", False)
    daily_limit = PREMIUM_DAILY_GLANCES if is_premium else FREE_DAILY_GLANCES
    
    glances_reset_at = fresh_user.get("glances_reset_at")
    daily_used = fresh_user.get("daily_glances_used", 0)
    
    if glances_reset_at:
        reset_time = datetime.fromisoformat(glances_reset_at.replace("Z", "+00:00"))
        if now >= reset_time:
            daily_used = 0
            next_reset = now.replace(hour=5, minute=0, second=0, microsecond=0)
            if now.hour >= 5:
                next_reset = next_reset + timedelta(days=1)
            await db.users.update_one(
                {"id": current_user["id"]},
                {"$set": {"daily_glances_used": 0, "glances_reset_at": next_reset.isoformat()}}
            )
    
    token_balance = fresh_user.get("token_balance", 0)
    use_token = False
    
    if daily_used < daily_limit:
        pass
    elif token_balance > 0:
        use_token = True
    elif not bypass_limits:
        raise HTTPException(status_code=429, detail="no_glances_remaining")
    
    # Check blocks (bilateral)
    target_user = await db.users.find_one({"id": data.to_user_id}, {"_id": 0})
    if target_user:
        if current_user["id"] in target_user.get("blocked_users", []):
            raise HTTPException(status_code=403, detail="Sorry, this user is unavailable right now.")
        if current_user["id"] in target_user.get("blocked_by_users", []):
            raise HTTPException(status_code=403, detail="Sorry, this user is unavailable right now.")
    
    if data.to_user_id in current_user.get("blocked_users", []):
        raise HTTPException(status_code=403, detail="Sorry, this user is unavailable right now.")
    if data.to_user_id in current_user.get("blocked_by_users", []):
        raise HTTPException(status_code=403, detail="Sorry, this user is unavailable right now.")
    
    # Check if already glanced
    existing = await db.glances.find_one({
        "from_user_id": current_user["id"],
        "to_user_id": data.to_user_id,
        "venue_id": data.venue_id
    })
    if existing:
        return {"message": "Already glanced", "is_mutual": False}
    
    # Track usage
    if use_token:
        await db.users.update_one(
            {"id": current_user["id"]},
            {"$inc": {"token_balance": -1}}
        )
    else:
        await db.users.update_one(
            {"id": current_user["id"]},
            {"$inc": {"daily_glances_used": 1}}
        )
    
    glance_id = str(uuid.uuid4())
    glance = {
        "id": glance_id,
        "from_user_id": current_user["id"],
        "to_user_id": data.to_user_id,
        "venue_id": data.venue_id,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "was_viewed": False
    }
    await db.glances.insert_one(glance)
    
    # Check for mutual glance
    mutual = await db.glances.find_one({
        "from_user_id": data.to_user_id,
        "to_user_id": current_user["id"],
        "venue_id": data.venue_id
    })
    
    if mutual:
        # Create connection
        connection_id = str(uuid.uuid4())
        connection = {
            "id": connection_id,
            "user1_id": current_user["id"],
            "user2_id": data.to_user_id,
            "venue_id": data.venue_id,
            "connected_at": datetime.now(timezone.utc).isoformat()
        }
        await db.connections.insert_one(connection)
        
        return {"message": "It's a match! You can now connect.", "is_mutual": True}
    
    return {"message": "Glance sent!", "is_mutual": False}


@router.post("/glance/{glance_id}/viewed")
async def mark_glance_viewed(glance_id: str, current_user: dict = Depends(get_current_user)):
    """Mark a glance as viewed"""
    glance = await db.glances.find_one({"id": glance_id, "to_user_id": current_user["id"]})
    if not glance:
        raise HTTPException(status_code=404, detail="Glance not found")
    
    await db.glances.update_one(
        {"id": glance_id},
        {"$set": {"was_viewed": True, "viewed_at": datetime.now(timezone.utc).isoformat()}}
    )
    return {"message": "Glance marked as viewed"}


@router.get("/glances/remaining")
async def get_remaining_glances(current_user: dict = Depends(get_current_user)):
    """Get remaining daily glances and token balance for fallback"""
    now = datetime.now(timezone.utc)
    
    # Re-fetch user from database to get fresh daily usage counters
    fresh_user = await db.users.find_one({"id": current_user["id"]}, {"_id": 0})
    if not fresh_user:
        raise HTTPException(status_code=401, detail="User not found")
    
    is_premium = fresh_user.get("is_premium", False)
    daily_limit = PREMIUM_DAILY_GLANCES if is_premium else FREE_DAILY_GLANCES
    daily_used = fresh_user.get("daily_glances_used", 0)
    token_balance = fresh_user.get("token_balance", 0)
    
    glances_reset_at = fresh_user.get("glances_reset_at")
    
    if glances_reset_at:
        reset_time = datetime.fromisoformat(glances_reset_at.replace("Z", "+00:00"))
        if now >= reset_time:
            daily_used = 0
    
    remaining_free = max(0, daily_limit - daily_used)
    
    return {
        "remaining_free": remaining_free,
        "daily_limit": daily_limit,
        "daily_used": daily_used,
        "token_balance": token_balance,
        "total_available": remaining_free + token_balance,
        "is_premium": is_premium
    }


@router.delete("/glances/{glance_id}")
async def delete_glance(glance_id: str, current_user: dict = Depends(get_current_user)):
    """
    Hide a glance from user's own view (non-destructive).
    
    This only affects the current user's view - the other party still sees the interaction.
    The glance is marked as 'hidden' for the current user rather than deleted.
    """
    # Find the glance
    glance = await db.glances.find_one({
        "id": glance_id,
        "$or": [
            {"from_user_id": current_user["id"]},
            {"to_user_id": current_user["id"]}
        ]
    })
    
    if not glance:
        raise HTTPException(status_code=404, detail="Glance not found")
    
    # Determine if user is sender or recipient
    is_sender = glance["from_user_id"] == current_user["id"]
    
    # Mark as hidden for this user (non-destructive)
    hidden_field = "hidden_by_sender" if is_sender else "hidden_by_recipient"
    await db.glances.update_one(
        {"id": glance_id},
        {"$set": {hidden_field: True, f"{hidden_field}_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    return {"message": "Glance removed from your list"}


@router.post("/glances/bulk-delete")
async def bulk_delete_glances(data: dict, current_user: dict = Depends(get_current_user)):
    """
    Bulk hide glances from user's own view (non-destructive).
    
    Request body: {"glance_ids": ["id1", "id2", ...]}
    """
    glance_ids = data.get("glance_ids", [])
    if not glance_ids:
        raise HTTPException(status_code=400, detail="No glance IDs provided")
    
    hidden_count = 0
    for glance_id in glance_ids:
        glance = await db.glances.find_one({
            "id": glance_id,
            "$or": [
                {"from_user_id": current_user["id"]},
                {"to_user_id": current_user["id"]}
            ]
        })
        
        if glance:
            is_sender = glance["from_user_id"] == current_user["id"]
            hidden_field = "hidden_by_sender" if is_sender else "hidden_by_recipient"
            await db.glances.update_one(
                {"id": glance_id},
                {"$set": {hidden_field: True, f"{hidden_field}_at": datetime.now(timezone.utc).isoformat()}}
            )
            hidden_count += 1
    
    return {"message": f"Removed {hidden_count} glances from your list", "count": hidden_count}


# ============================================================================
# ICEBREAKER ROUTES
# ============================================================================

@router.post("/icebreaker")
async def send_icebreaker(data: IcebreakerCreate, current_user: dict = Depends(get_current_user)):
    """Send an icebreaker to another user. Uses daily allowance first, then tokens as fallback."""
    now = datetime.now(timezone.utc)
    
    target_user = await db.users.find_one({"id": data.to_user_id}, {"_id": 0})
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Check blocks (bilateral - soft error message)
    if current_user["id"] in target_user.get("blocked_users", []):
        raise HTTPException(status_code=403, detail="Sorry, this user is unavailable right now.")
    if current_user["id"] in target_user.get("blocked_by_users", []):
        raise HTTPException(status_code=403, detail="Sorry, this user is unavailable right now.")
    
    if data.to_user_id in current_user.get("blocked_users", []):
        raise HTTPException(status_code=403, detail="Sorry, this user is unavailable right now.")
    if data.to_user_id in current_user.get("blocked_by_users", []):
        raise HTTPException(status_code=403, detail="Sorry, this user is unavailable right now.")
    
    # Check cooldown (30 min after decline/not_right_now)
    last_declined = await db.icebreakers.find_one({
        "from_user_id": current_user["id"],
        "to_user_id": data.to_user_id,
        "status": {"$in": ["declined", "not_right_now"]},
        "responded_at": {"$gte": (now - timedelta(minutes=30)).isoformat()}
    })
    if last_declined:
        raise HTTPException(status_code=429, detail="Please wait before sending another icebreaker to this person.")
    
    # Check for existing pending icebreaker
    existing = await db.icebreakers.find_one({
        "from_user_id": current_user["id"],
        "to_user_id": data.to_user_id,
        "status": "pending"
    })
    if existing:
        raise HTTPException(status_code=400, detail="You already have a pending icebreaker to this person.")
    
    # Validate message type
    if data.message_type < 0 or data.message_type >= len(ICEBREAKER_MESSAGES):
        raise HTTPException(status_code=400, detail="Invalid message type")
    
    # ========================================================================
    # DAILY ICEBREAKER ALLOWANCE CHECK (with token fallback)
    # ========================================================================
    bypass_limits = IS_TEST_BUILD or current_user.get("bypass_glance_limits", False)
    
    # Re-fetch user from database to get fresh daily usage counters
    fresh_user = await db.users.find_one({"id": current_user["id"]}, {"_id": 0})
    if not fresh_user:
        raise HTTPException(status_code=401, detail="User not found")
    
    is_premium = fresh_user.get("is_premium", False)
    daily_limit = PREMIUM_DAILY_ICEBREAKERS if is_premium else FREE_DAILY_ICEBREAKERS
    
    # Check if daily icebreaker counter needs reset (resets at 5am local)
    icebreakers_reset_at = fresh_user.get("icebreakers_reset_at")
    daily_used = fresh_user.get("daily_icebreakers_used", 0)
    
    if icebreakers_reset_at:
        reset_time = datetime.fromisoformat(icebreakers_reset_at.replace("Z", "+00:00"))
        if now >= reset_time:
            daily_used = 0
            next_reset = now.replace(hour=5, minute=0, second=0, microsecond=0)
            if now.hour >= 5:
                next_reset = next_reset + timedelta(days=1)
            await db.users.update_one(
                {"id": current_user["id"]},
                {"$set": {"daily_icebreakers_used": 0, "icebreakers_reset_at": next_reset.isoformat()}}
            )
    else:
        # Initialize reset time for users who don't have one yet
        next_reset = now.replace(hour=5, minute=0, second=0, microsecond=0)
        if now.hour >= 5:
            next_reset = next_reset + timedelta(days=1)
        await db.users.update_one(
            {"id": current_user["id"]},
            {"$set": {"icebreakers_reset_at": next_reset.isoformat()}}
        )
    
    token_balance = fresh_user.get("token_balance", 0)
    use_token = False
    
    # Priority: Use daily allowance first, then tokens as fallback
    if daily_used < daily_limit:
        # Still have daily icebreakers available
        pass
    elif token_balance > 0:
        # Out of daily icebreakers, use token
        use_token = True
    elif not bypass_limits:
        # No daily icebreakers AND no tokens
        raise HTTPException(status_code=429, detail="no_icebreakers_remaining")
    
    # Track usage
    if use_token:
        await db.users.update_one(
            {"id": current_user["id"]},
            {"$inc": {"token_balance": -1}}
        )
    else:
        await db.users.update_one(
            {"id": current_user["id"]},
            {"$inc": {"daily_icebreakers_used": 1}}
        )
    
    icebreaker_id = str(uuid.uuid4())
    icebreaker = {
        "id": icebreaker_id,
        "from_user_id": current_user["id"],
        "to_user_id": data.to_user_id,
        "venue_id": data.venue_id,
        "message_type": data.message_type,
        "message": ICEBREAKER_MESSAGES[data.message_type],
        "created_at": now.isoformat(),
        "status": "pending",
        "used_token": use_token  # Track if token was used
    }
    await db.icebreakers.insert_one(icebreaker)
    
    return {"message": "Icebreaker sent!", "icebreaker_id": icebreaker_id, "used_token": use_token}


@router.get("/icebreakers/remaining")
async def get_remaining_icebreakers(current_user: dict = Depends(get_current_user)):
    """Get remaining daily icebreakers and token balance for fallback"""
    now = datetime.now(timezone.utc)
    
    # Re-fetch user from database to get fresh daily usage counters
    fresh_user = await db.users.find_one({"id": current_user["id"]}, {"_id": 0})
    if not fresh_user:
        raise HTTPException(status_code=401, detail="User not found")
    
    is_premium = fresh_user.get("is_premium", False)
    daily_limit = PREMIUM_DAILY_ICEBREAKERS if is_premium else FREE_DAILY_ICEBREAKERS
    daily_used = fresh_user.get("daily_icebreakers_used", 0)
    token_balance = fresh_user.get("token_balance", 0)
    
    icebreakers_reset_at = fresh_user.get("icebreakers_reset_at")
    
    if icebreakers_reset_at:
        reset_time = datetime.fromisoformat(icebreakers_reset_at.replace("Z", "+00:00"))
        if now >= reset_time:
            daily_used = 0
    
    remaining_free = max(0, daily_limit - daily_used)
    
    return {
        "remaining_free": remaining_free,
        "daily_limit": daily_limit,
        "daily_used": daily_used,
        "token_balance": token_balance,
        "total_available": remaining_free + token_balance,
        "is_premium": is_premium
    }


@router.get("/icebreakers/received")
async def get_received_icebreakers(current_user: dict = Depends(get_current_user)):
    """Get icebreakers received by current user"""
    icebreakers = await db.icebreakers.find({
        "to_user_id": current_user["id"],
        "status": "pending"
    }, {"_id": 0}).to_list(50)
    
    result = []
    for ib in icebreakers:
        from_user = await db.users.find_one({"id": ib["from_user_id"]}, {"_id": 0})
        if from_user:
            result.append({
                **ib,
                "from_user_name": from_user.get("display_name", "Someone"),
                "from_user_avatar": from_user.get("avatar_url", "")
            })
    
    return result


@router.post("/icebreaker/{icebreaker_id}/view")
async def view_icebreaker(icebreaker_id: str, current_user: dict = Depends(get_current_user)):
    """Mark an icebreaker as viewed"""
    icebreaker = await db.icebreakers.find_one({
        "id": icebreaker_id,
        "to_user_id": current_user["id"]
    })
    if not icebreaker:
        raise HTTPException(status_code=404, detail="Icebreaker not found")
    
    await db.icebreakers.update_one(
        {"id": icebreaker_id},
        {"$set": {"viewed_at": datetime.now(timezone.utc).isoformat()}}
    )
    return {"message": "Icebreaker viewed"}


@router.post("/icebreaker/{icebreaker_id}/respond")
async def respond_to_icebreaker(
    icebreaker_id: str,
    request: IcebreakerActionRequest,
    current_user: dict = Depends(get_current_user)
):
    """Respond to an icebreaker"""
    icebreaker = await db.icebreakers.find_one({
        "id": icebreaker_id,
        "to_user_id": current_user["id"]
    })
    if not icebreaker:
        raise HTTPException(status_code=404, detail="Icebreaker not found")
    
    now = datetime.now(timezone.utc)
    
    if request.action == "accept":
        await db.icebreakers.update_one(
            {"id": icebreaker_id},
            {"$set": {"status": "accepted", "responded_at": now.isoformat()}}
        )
        
        # Create connection
        connection_id = str(uuid.uuid4())
        connection = {
            "id": connection_id,
            "user1_id": icebreaker["from_user_id"],
            "user2_id": current_user["id"],
            "venue_id": icebreaker["venue_id"],
            "connected_at": now.isoformat(),
            "source": "icebreaker"
        }
        await db.connections.insert_one(connection)
        
        return {"message": "Icebreaker accepted! You're now connected.", "status": "accepted"}
    
    elif request.action == "not_right_now":
        await db.icebreakers.update_one(
            {"id": icebreaker_id},
            {"$set": {"status": "not_right_now", "responded_at": now.isoformat()}}
        )
        return {"message": "Response sent", "status": "not_right_now"}
    
    elif request.action == "decline":
        await db.icebreakers.update_one(
            {"id": icebreaker_id},
            {"$set": {"status": "declined", "responded_at": now.isoformat()}}
        )
        return {"message": "Icebreaker declined", "status": "declined"}
    
    elif request.action == "block_user":
        await db.icebreakers.update_one(
            {"id": icebreaker_id},
            {"$set": {"status": "declined", "responded_at": now.isoformat()}}
        )
        # Add to blocked_users list (full block) and blocked_by_users for the other user
        await db.users.update_one(
            {"id": current_user["id"]},
            {"$addToSet": {"blocked_users": icebreaker["from_user_id"]}}
        )
        await db.users.update_one(
            {"id": icebreaker["from_user_id"]},
            {"$addToSet": {"blocked_by_users": current_user["id"]}}
        )
        return {"message": "User blocked", "status": "blocked"}
    
    raise HTTPException(status_code=400, detail="Invalid action")


@router.delete("/icebreaker/{icebreaker_id}")
async def delete_icebreaker(icebreaker_id: str, current_user: dict = Depends(get_current_user)):
    """
    Hide an icebreaker from user's own view (non-destructive).
    
    This only affects the current user's view - the other party still sees the interaction.
    Premium view history is preserved for the other user.
    """
    # Find the icebreaker
    icebreaker = await db.icebreakers.find_one({
        "id": icebreaker_id,
        "$or": [
            {"from_user_id": current_user["id"]},
            {"to_user_id": current_user["id"]}
        ]
    })
    
    if not icebreaker:
        raise HTTPException(status_code=404, detail="Icebreaker not found")
    
    # Determine if user is sender or recipient
    is_sender = icebreaker["from_user_id"] == current_user["id"]
    
    # Mark as hidden for this user (non-destructive)
    hidden_field = "hidden_by_sender" if is_sender else "hidden_by_recipient"
    await db.icebreakers.update_one(
        {"id": icebreaker_id},
        {"$set": {hidden_field: True, f"{hidden_field}_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    return {"message": "Icebreaker removed from your list"}


@router.post("/icebreakers/bulk-delete")
async def bulk_delete_icebreakers(data: dict, current_user: dict = Depends(get_current_user)):
    """
    Bulk hide icebreakers from user's own view (non-destructive).
    
    Request body: {"icebreaker_ids": ["id1", "id2", ...]}
    """
    icebreaker_ids = data.get("icebreaker_ids", [])
    if not icebreaker_ids:
        raise HTTPException(status_code=400, detail="No icebreaker IDs provided")
    
    hidden_count = 0
    for icebreaker_id in icebreaker_ids:
        icebreaker = await db.icebreakers.find_one({
            "id": icebreaker_id,
            "$or": [
                {"from_user_id": current_user["id"]},
                {"to_user_id": current_user["id"]}
            ]
        })
        
        if icebreaker:
            is_sender = icebreaker["from_user_id"] == current_user["id"]
            hidden_field = "hidden_by_sender" if is_sender else "hidden_by_recipient"
            await db.icebreakers.update_one(
                {"id": icebreaker_id},
                {"$set": {hidden_field: True, f"{hidden_field}_at": datetime.now(timezone.utc).isoformat()}}
            )
            hidden_count += 1
    
    return {"message": f"Removed {hidden_count} icebreakers from your list", "count": hidden_count}


# ============================================================================
# CONNECTION ROUTES
# ============================================================================

@router.get("/connections")
async def get_connections(current_user: dict = Depends(get_current_user)):
    """
    Get all mutual connections for current user including:
    - Explicit connections from connections collection
    - Mutual glances (both users glanced at each other)
    - Accepted icebreakers
    - Accepted chat requests
    - Mutual messagers (users who've exchanged messages)
    
    Excludes users hidden from matches via /connections/{user_id}/hide-from-matches
    Excludes blocked users
    """
    all_connections = []
    seen_users = set()
    
    # Get list of users hidden from matches
    hidden_list = await db.hidden_from_matches.find({
        "user_id": current_user["id"]
    }, {"_id": 0}).to_list(100)
    hidden_user_ids = {h["hidden_user_id"] for h in hidden_list}
    
    # Get blocked users to filter them out
    blocked_users = set(current_user.get("blocked_users", []))
    blocked_by_users = set(current_user.get("blocked_by_users", []))
    all_blocked = blocked_users | blocked_by_users
    excluded_users = hidden_user_ids | all_blocked
    
    # 1. Get explicit connections from the connections collection
    explicit_connections = await db.connections.find({
        "$or": [
            {"user1_id": current_user["id"]},
            {"user2_id": current_user["id"]}
        ]
    }, {"_id": 0}).to_list(100)
    
    for conn in explicit_connections:
        other_id = conn["user2_id"] if conn["user1_id"] == current_user["id"] else conn["user1_id"]
        if other_id in seen_users or other_id in excluded_users:
            continue
        seen_users.add(other_id)
        
        other_user = await db.users.find_one({"id": other_id}, {"_id": 0, "password": 0})
        if not other_user:
            continue
        
        venue = await db.venues.find_one({"id": conn.get("venue_id", "")}, {"_id": 0})
        all_connections.append({
            "id": conn["id"],
            "user_id": other_id,
            "display_name": other_user.get("display_name", "Someone"),
            "avatar_url": other_user.get("avatar_url", ""),
            "thumbnail_url": other_user.get("thumbnail_url", ""),
            "bio": other_user.get("bio", ""),
            "connected_at": conn.get("connected_at", ""),
            "venue_name": venue.get("name", "Nearby") if venue else "Nearby",
            "connection_type": conn.get("type", "connection")
        })
    
    # 2. Get mutual glances (both users glanced at each other)
    my_glances = await db.glances.find({"from_user_id": current_user["id"]}, {"_id": 0}).to_list(200)
    glanced_at_users = {g["to_user_id"] for g in my_glances}
    
    mutual_glances = await db.glances.find({
        "from_user_id": {"$in": list(glanced_at_users)},
        "to_user_id": current_user["id"]
    }, {"_id": 0}).to_list(200)
    
    for glance in mutual_glances:
        from_user_id = glance["from_user_id"]
        if from_user_id in seen_users or from_user_id in excluded_users:
            continue
        seen_users.add(from_user_id)
        
        user = await db.users.find_one({"id": from_user_id}, {"_id": 0, "password": 0})
        if user:
            venue = await db.venues.find_one({"id": glance.get("venue_id", "")}, {"_id": 0})
            all_connections.append({
                "id": f"mutual-{from_user_id}",
                "user_id": user.get("id"),
                "display_name": user.get("display_name", "Someone"),
                "avatar_url": user.get("avatar_url", ""),
                "thumbnail_url": user.get("thumbnail_url", ""),
                "bio": user.get("bio", ""),
                "connected_at": glance["created_at"],
                "venue_name": venue.get("name", "Nearby") if venue else "Nearby",
                "connection_type": "mutual_glance"
            })
    
    # 3. Get accepted icebreakers
    accepted_icebreakers = await db.icebreakers.find({
        "$or": [
            {"from_user_id": current_user["id"], "status": "accepted"},
            {"to_user_id": current_user["id"], "status": "accepted"}
        ]
    }, {"_id": 0}).to_list(100)
    
    for ib in accepted_icebreakers:
        other_user_id = ib["to_user_id"] if ib["from_user_id"] == current_user["id"] else ib["from_user_id"]
        if other_user_id in seen_users or other_user_id in excluded_users:
            continue
        seen_users.add(other_user_id)
        
        user = await db.users.find_one({"id": other_user_id}, {"_id": 0, "password": 0})
        if user:
            venue = await db.venues.find_one({"id": ib.get("venue_id", "")}, {"_id": 0})
            all_connections.append({
                "id": f"icebreaker-{ib['id']}",
                "user_id": user.get("id"),
                "display_name": user.get("display_name", "Someone"),
                "avatar_url": user.get("avatar_url", ""),
                "thumbnail_url": user.get("thumbnail_url", ""),
                "bio": user.get("bio", ""),
                "connected_at": ib.get("responded_at", ib.get("created_at")),
                "venue_name": venue.get("name", "Via Icebreaker") if venue else "Via Icebreaker",
                "connection_type": "icebreaker_accepted"
            })
    
    # 4. Get accepted chat requests
    accepted_chat_requests = await db.chat_requests.find({
        "$or": [
            {"from_user_id": current_user["id"], "status": "accepted"},
            {"to_user_id": current_user["id"], "status": "accepted"}
        ]
    }, {"_id": 0}).to_list(100)
    
    for req in accepted_chat_requests:
        other_user_id = req["to_user_id"] if req["from_user_id"] == current_user["id"] else req["from_user_id"]
        if other_user_id in seen_users or other_user_id in excluded_users:
            continue
        seen_users.add(other_user_id)
        
        user = await db.users.find_one({"id": other_user_id}, {"_id": 0, "password": 0})
        if user:
            venue = await db.venues.find_one({"id": req.get("venue_id", "")}, {"_id": 0})
            all_connections.append({
                "id": f"chat-request-{req['id']}",
                "user_id": user.get("id"),
                "display_name": user.get("display_name", "Someone"),
                "avatar_url": user.get("avatar_url", ""),
                "thumbnail_url": user.get("thumbnail_url", ""),
                "bio": user.get("bio", ""),
                "connected_at": req.get("responded_at", req.get("created_at")),
                "venue_name": venue.get("name", "Via Chat Request") if venue else "Via Chat Request",
                "connection_type": "chat_request_accepted"
            })
    
    # 5. Get mutual messagers (both sent AND received messages)
    my_sent_messages = await db.messages.distinct("to_user_id", {"from_user_id": current_user["id"]})
    my_received_messages = await db.messages.distinct("from_user_id", {"to_user_id": current_user["id"]})
    mutual_messagers = set(my_sent_messages) & set(my_received_messages)
    
    for other_id in mutual_messagers:
        if other_id in seen_users or other_id in excluded_users:
            continue
        seen_users.add(other_id)
        
        user = await db.users.find_one({"id": other_id}, {"_id": 0, "password": 0})
        if user:
            # Find latest message for timestamp
            latest_msg = await db.messages.find_one(
                {"$or": [
                    {"from_user_id": current_user["id"], "to_user_id": other_id},
                    {"from_user_id": other_id, "to_user_id": current_user["id"]}
                ]},
                {"_id": 0},
                sort=[("created_at", -1)]
            )
            all_connections.append({
                "id": f"mutual-msg-{other_id}",
                "user_id": user.get("id"),
                "display_name": user.get("display_name", "Someone"),
                "avatar_url": user.get("avatar_url", ""),
                "thumbnail_url": user.get("thumbnail_url", ""),
                "bio": user.get("bio", ""),
                "connected_at": latest_msg.get("created_at") if latest_msg else datetime.now(timezone.utc).isoformat(),
                "venue_name": "Via Messages",
                "connection_type": "mutual_messaging"
            })
    
    # Sort by most recent connection
    all_connections.sort(key=lambda x: x.get("connected_at", ""), reverse=True)
    
    return all_connections


@router.delete("/connections/{user_id}/clear")
async def clear_connection(user_id: str, current_user: dict = Depends(get_current_user)):
    """Clear a connection (remove from matches but keep chat history)"""
    # Delete the connection
    result = await db.connections.delete_one({
        "$or": [
            {"user1_id": current_user["id"], "user2_id": user_id},
            {"user1_id": user_id, "user2_id": current_user["id"]}
        ]
    })
    
    # Also delete mutual glances
    await db.glances.delete_many({
        "$or": [
            {"from_user_id": current_user["id"], "to_user_id": user_id},
            {"from_user_id": user_id, "to_user_id": current_user["id"]}
        ]
    })
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Connection not found")
    
    return {"message": "Connection cleared. Chat history preserved."}


@router.post("/connections/{user_id}/hide-from-matches")
async def hide_from_matches(user_id: str, current_user: dict = Depends(get_current_user)):
    """
    Hide a user from the Mutual Matches section in HereHub.
    This is a personal-view cleanup only - it does NOT:
    - Unmatch
    - Block
    - Delete messages
    - Affect any other interactions
    
    The user will simply not appear in your Mutual Matches list.
    """
    # Check if already hidden
    existing = await db.hidden_from_matches.find_one({
        "user_id": current_user["id"],
        "hidden_user_id": user_id
    })
    
    if existing:
        return {"message": "Already hidden from matches"}
    
    # Add to hidden list
    await db.hidden_from_matches.insert_one({
        "id": str(uuid.uuid4()),
        "user_id": current_user["id"],
        "hidden_user_id": user_id,
        "hidden_at": datetime.now(timezone.utc).isoformat()
    })
    
    return {"message": "Hidden from Mutual Matches. They won't see any change."}


@router.delete("/connections/{user_id}/unhide-from-matches")
async def unhide_from_matches(user_id: str, current_user: dict = Depends(get_current_user)):
    """
    Unhide a user from the Mutual Matches section.
    They will appear in your matches list again.
    """
    result = await db.hidden_from_matches.delete_one({
        "user_id": current_user["id"],
        "hidden_user_id": user_id
    })
    
    if result.deleted_count == 0:
        return {"message": "User was not hidden"}
    
    return {"message": "User will appear in Mutual Matches again"}


@router.delete("/connections/{user_id}/bin")
async def bin_hidden_match(user_id: str, current_user: dict = Depends(get_current_user)):
    """
    BIN ACTION (Quiet Unmatch) - Remove mutual connection silently.
    
    This action:
    - Removes the user from Hidden Matches
    - Removes the mutual connection (one-sided, quiet)
    - Does NOT delete chat history
    - Does NOT notify the other user
    - Does NOT block
    
    After binning:
    - They appear as a normal unmatched person
    - They can match again in the future
    - The other user sees no change (they still see mutual from their side until they interact)
    """
    # 1. Remove from hidden_from_matches
    await db.hidden_from_matches.delete_one({
        "user_id": current_user["id"],
        "hidden_user_id": user_id
    })
    
    # 2. Remove mutual glances (only current user's glance to them)
    # This breaks the mutual state from our side
    await db.glances.delete_many({
        "from_user_id": current_user["id"],
        "to_user_id": user_id
    })
    
    # 3. Remove any icebreakers we sent (not theirs to us)
    await db.icebreakers.update_many(
        {
            "from_user_id": current_user["id"],
            "to_user_id": user_id
        },
        {"$set": {"status": "withdrawn"}}
    )
    
    # 4. Remove any chat requests we sent (not theirs to us)
    await db.chat_requests.update_many(
        {
            "from_user_id": current_user["id"],
            "to_user_id": user_id
        },
        {"$set": {"status": "withdrawn"}}
    )
    
    # 5. Remove from explicit connections collection (one-sided)
    await db.connections.delete_many({
        "$or": [
            {"user1_id": current_user["id"], "user2_id": user_id},
            {"user1_id": user_id, "user2_id": current_user["id"]}
        ]
    })
    
    # 6. Remove reveal state (one-sided)
    await db.reveals.delete_many({
        "from_user_id": current_user["id"],
        "to_user_id": user_id
    })
    
    # Note: We do NOT delete:
    # - Chat messages (preserved)
    # - Their glance/icebreaker/chat request to us (they still see mutual from their side)
    # - Any notifications they received (already sent)
    
    return {"message": "Connection removed. They can still see you as a match until they interact again."}


@router.get("/connections/hidden-from-matches")
async def get_hidden_from_matches(current_user: dict = Depends(get_current_user)):
    """Get list of users hidden from Mutual Matches with full user details"""
    hidden = await db.hidden_from_matches.find({
        "user_id": current_user["id"]
    }, {"_id": 0}).to_list(100)
    
    # Fetch full user details for each hidden user
    hidden_users = []
    for hidden_record in hidden:
        user = await db.users.find_one(
            {"id": hidden_record["hidden_user_id"]}, 
            {"_id": 0, "password": 0}
        )
        if user:
            hidden_users.append({
                "user_id": user["id"],
                "display_name": user.get("display_name", "Unknown"),
                "avatar_url": user.get("avatar_url", ""),
                "thumbnail_url": user.get("thumbnail_url", ""),
                "age": user.get("age"),
                "presence_status": user.get("presence_status"),
                "last_active_at": user.get("last_active_at"),
                "hidden_at": hidden_record.get("hidden_at"),
                "is_premium": user.get("is_premium", False),
            })
    
    return hidden_users


@router.get("/connections/mutual-glances")
async def get_mutual_glances(current_user: dict = Depends(get_current_user)):
    """Get all mutual glances (matches)"""
    # Get glances where I glanced at someone
    my_glances = await db.glances.find({"from_user_id": current_user["id"]}, {"_id": 0}).to_list(100)
    
    mutual = []
    for glance in my_glances:
        # Check if they glanced back
        reverse = await db.glances.find_one({
            "from_user_id": glance["to_user_id"],
            "to_user_id": current_user["id"]
        })
        
        if reverse:
            other_user = await db.users.find_one({"id": glance["to_user_id"]}, {"_id": 0, "password": 0})
            if other_user:
                mutual.append({
                    "user_id": other_user["id"],
                    "display_name": other_user.get("display_name", "Unknown"),
                    "avatar_url": other_user.get("avatar_url", ""),
                    "matched_at": max(glance.get("created_at", ""), reverse.get("created_at", ""))
                })
    
    return mutual


@router.get("/connections/glances")
async def get_glances(current_user: dict = Depends(get_current_user)):
    """Get glances sent and received with blur state fields, excluding hidden items"""
    # Get sent glances, excluding ones hidden by sender
    sent = await db.glances.find({
        "from_user_id": current_user["id"],
        "$or": [
            {"hidden_by_sender": {"$exists": False}},
            {"hidden_by_sender": False}
        ]
    }, {"_id": 0}).to_list(100)
    
    # Get received glances, excluding ones hidden by recipient
    received = await db.glances.find({
        "to_user_id": current_user["id"],
        "$or": [
            {"hidden_by_recipient": {"$exists": False}},
            {"hidden_by_recipient": False}
        ]
    }, {"_id": 0}).to_list(100)
    
    # Check for mutual glances
    sent_to_ids = {g["to_user_id"] for g in sent}
    received_from_ids = {g["from_user_id"] for g in received}
    
    async def get_blur_state(user_id: str) -> dict:
        """Calculate blur state for a user"""
        # Check for mutual glance
        is_mutual = user_id in sent_to_ids and user_id in received_from_ids
        
        # Check for accepted icebreaker
        accepted_icebreaker = await db.icebreakers.find_one({
            "$or": [
                {"from_user_id": current_user["id"], "to_user_id": user_id, "status": "accepted"},
                {"from_user_id": user_id, "to_user_id": current_user["id"], "status": "accepted"}
            ]
        })
        
        # Check for accepted chat request
        accepted_chat = await db.chat_requests.find_one({
            "$or": [
                {"from_user_id": current_user["id"], "to_user_id": user_id, "status": "accepted"},
                {"from_user_id": user_id, "to_user_id": current_user["id"], "status": "accepted"}
            ]
        })
        
        # is_connection_accepted = mutual glance OR accepted icebreaker/chat
        is_connection_accepted = is_mutual or bool(accepted_icebreaker) or bool(accepted_chat)
        
        # Check for explicit reveal (both users pressed reveal button)
        i_revealed = await db.reveals.find_one({
            "from_user_id": current_user["id"], "to_user_id": user_id
        }) is not None
        they_revealed = await db.reveals.find_one({
            "from_user_id": user_id, "to_user_id": current_user["id"]
        }) is not None
        is_revealed = i_revealed and they_revealed
        
        return {
            "is_mutual": is_mutual,
            "is_connection_accepted": is_connection_accepted,
            "reveal_state": {
                "is_revealed": is_revealed,
                "iRevealed": i_revealed,
                "theyRevealed": they_revealed
            }
        }
    
    outgoing_list = []
    for g in sent:
        user = await db.users.find_one({"id": g["to_user_id"]}, {"_id": 0})
        if user:
            blur_state = await get_blur_state(g["to_user_id"])
            # Get the primary profile photo (photos[0] takes priority over avatar_url)
            photos = user.get("photos", [])
            profile_photo = photos[0] if photos else user.get("avatar_url", "")
            outgoing_list.append({
                **g,
                "user_id": g["to_user_id"],
                "display_name": user.get("display_name"),
                "photo_url": profile_photo,  # Primary profile photo for BlurredImage
                "avatar_url": user.get("avatar_url", ""),
                "thumbnail_url": user.get("thumbnail_url", ""),
                **blur_state
            })
    
    incoming_list = []
    for g in received:
        user = await db.users.find_one({"id": g["from_user_id"]}, {"_id": 0})
        if user:
            blur_state = await get_blur_state(g["from_user_id"])
            # Get the primary profile photo (photos[0] takes priority over avatar_url)
            photos = user.get("photos", [])
            profile_photo = photos[0] if photos else user.get("avatar_url", "")
            incoming_list.append({
                **g,
                "user_id": g["from_user_id"],
                "display_name": get_first_name(user.get("display_name")),
                "photo_url": profile_photo,  # Primary profile photo for BlurredImage
                "avatar_url": user.get("avatar_url", ""),
                "thumbnail_url": user.get("thumbnail_url", ""),
                **blur_state
            })
    
    return {"incoming": incoming_list, "outgoing": outgoing_list}


@router.get("/connections/icebreakers")
async def get_icebreakers(current_user: dict = Depends(get_current_user)):
    """Get icebreakers sent and received with blur state fields, excluding hidden items"""
    # Get sent icebreakers, excluding ones hidden by sender
    sent = await db.icebreakers.find({
        "from_user_id": current_user["id"],
        "$or": [
            {"hidden_by_sender": {"$exists": False}},
            {"hidden_by_sender": False}
        ]
    }, {"_id": 0}).to_list(100)
    
    # Get received icebreakers, excluding ones hidden by recipient
    received = await db.icebreakers.find({
        "to_user_id": current_user["id"],
        "$or": [
            {"hidden_by_recipient": {"$exists": False}},
            {"hidden_by_recipient": False}
        ]
    }, {"_id": 0}).to_list(100)
    
    async def get_blur_state(user_id: str) -> dict:
        """Calculate blur state for a user"""
        # Check for mutual glance
        my_glance = await db.glances.find_one({
            "from_user_id": current_user["id"], "to_user_id": user_id
        })
        their_glance = await db.glances.find_one({
            "from_user_id": user_id, "to_user_id": current_user["id"]
        })
        is_mutual_glance = bool(my_glance) and bool(their_glance)
        
        # Check for accepted icebreaker
        accepted_icebreaker = await db.icebreakers.find_one({
            "$or": [
                {"from_user_id": current_user["id"], "to_user_id": user_id, "status": "accepted"},
                {"from_user_id": user_id, "to_user_id": current_user["id"], "status": "accepted"}
            ]
        })
        
        # Check for accepted chat request
        accepted_chat = await db.chat_requests.find_one({
            "$or": [
                {"from_user_id": current_user["id"], "to_user_id": user_id, "status": "accepted"},
                {"from_user_id": user_id, "to_user_id": current_user["id"], "status": "accepted"}
            ]
        })
        
        # is_connection_accepted = mutual glance OR accepted icebreaker/chat
        is_connection_accepted = is_mutual_glance or bool(accepted_icebreaker) or bool(accepted_chat)
        
        # Check for explicit reveal
        i_revealed = await db.reveals.find_one({
            "from_user_id": current_user["id"], "to_user_id": user_id
        }) is not None
        they_revealed = await db.reveals.find_one({
            "from_user_id": user_id, "to_user_id": current_user["id"]
        }) is not None
        is_revealed = i_revealed and they_revealed
        
        return {
            "is_connection_accepted": is_connection_accepted,
            "reveal_state": {
                "is_revealed": is_revealed,
                "iRevealed": i_revealed,
                "theyRevealed": they_revealed
            }
        }
    
    outgoing_list = []
    for ib in sent:
        user = await db.users.find_one({"id": ib["to_user_id"]}, {"_id": 0})
        if user:
            blur_state = await get_blur_state(ib["to_user_id"])
            # Get the primary profile photo (photos[0] takes priority over avatar_url)
            photos = user.get("photos", [])
            profile_photo = photos[0] if photos else user.get("avatar_url", "")
            outgoing_list.append({
                **ib,
                "user_id": ib["to_user_id"],
                "display_name": user.get("display_name"),
                "photo_url": profile_photo,  # Primary profile photo for BlurredImage
                "avatar_url": user.get("avatar_url", ""),
                "thumbnail_url": user.get("thumbnail_url", ""),
                **blur_state
            })
    
    incoming_list = []
    for ib in received:
        user = await db.users.find_one({"id": ib["from_user_id"]}, {"_id": 0})
        if user:
            blur_state = await get_blur_state(ib["from_user_id"])
            # Get the primary profile photo (photos[0] takes priority over avatar_url)
            photos = user.get("photos", [])
            profile_photo = photos[0] if photos else user.get("avatar_url", "")
            incoming_list.append({
                **ib,
                "user_id": ib["from_user_id"],
                "display_name": user.get("display_name"),
                "photo_url": profile_photo,  # Primary profile photo for BlurredImage
                "avatar_url": user.get("avatar_url", ""),
                "thumbnail_url": user.get("thumbnail_url", ""),
                **blur_state
            })
    
    return {"incoming": incoming_list, "outgoing": outgoing_list}



@router.get("/connections/chat-requests")
async def get_chat_requests(current_user: dict = Depends(get_current_user)):
    """Get chat requests sent and received with blur state fields, excluding hidden items"""
    # Get sent chat requests, excluding ones hidden by sender
    sent = await db.chat_requests.find({
        "from_user_id": current_user["id"],
        "$or": [
            {"hidden_by_sender": {"$exists": False}},
            {"hidden_by_sender": False}
        ]
    }, {"_id": 0}).to_list(100)
    
    # Get received chat requests, excluding ones hidden by recipient
    received = await db.chat_requests.find({
        "to_user_id": current_user["id"],
        "$or": [
            {"hidden_by_recipient": {"$exists": False}},
            {"hidden_by_recipient": False}
        ]
    }, {"_id": 0}).to_list(100)
    
    async def get_blur_state(user_id: str) -> dict:
        """Calculate blur state for a user"""
        # Check for mutual glance
        my_glance = await db.glances.find_one({
            "from_user_id": current_user["id"], "to_user_id": user_id
        })
        their_glance = await db.glances.find_one({
            "from_user_id": user_id, "to_user_id": current_user["id"]
        })
        is_mutual_glance = bool(my_glance) and bool(their_glance)
        
        # Check for accepted icebreaker
        accepted_icebreaker = await db.icebreakers.find_one({
            "$or": [
                {"from_user_id": current_user["id"], "to_user_id": user_id, "status": "accepted"},
                {"from_user_id": user_id, "to_user_id": current_user["id"], "status": "accepted"}
            ]
        })
        
        # Check for accepted chat request
        accepted_chat = await db.chat_requests.find_one({
            "$or": [
                {"from_user_id": current_user["id"], "to_user_id": user_id, "status": "accepted"},
                {"from_user_id": user_id, "to_user_id": current_user["id"], "status": "accepted"}
            ]
        })
        
        # is_connection_accepted = mutual glance OR accepted icebreaker/chat
        is_connection_accepted = is_mutual_glance or bool(accepted_icebreaker) or bool(accepted_chat)
        
        # Check for explicit reveal
        i_revealed = await db.reveals.find_one({
            "from_user_id": current_user["id"], "to_user_id": user_id
        }) is not None
        they_revealed = await db.reveals.find_one({
            "from_user_id": user_id, "to_user_id": current_user["id"]
        }) is not None
        is_revealed = i_revealed and they_revealed
        
        return {
            "is_connection_accepted": is_connection_accepted,
            "reveal_state": {
                "is_revealed": is_revealed,
                "iRevealed": i_revealed,
                "theyRevealed": they_revealed
            }
        }
    
    outgoing_list = []
    for req in sent:
        user = await db.users.find_one({"id": req["to_user_id"]}, {"_id": 0})
        if user:
            blur_state = await get_blur_state(req["to_user_id"])
            # Get the primary profile photo (photos[0] takes priority over avatar_url)
            photos = user.get("photos", [])
            profile_photo = photos[0] if photos else user.get("avatar_url", "")
            outgoing_list.append({
                **req,
                "user_id": req["to_user_id"],
                "display_name": user.get("display_name"),
                "photo_url": profile_photo,  # Primary profile photo for BlurredImage
                "avatar_url": user.get("avatar_url", ""),  # Fallback only
                "thumbnail_url": user.get("thumbnail_url", ""),
                **blur_state
            })
    
    incoming_list = []
    for req in received:
        user = await db.users.find_one({"id": req["from_user_id"]}, {"_id": 0})
        if user:
            blur_state = await get_blur_state(req["from_user_id"])
            # Get the primary profile photo (photos[0] takes priority over avatar_url)
            photos = user.get("photos", [])
            profile_photo = photos[0] if photos else user.get("avatar_url", "")
            incoming_list.append({
                **req,
                "user_id": req["from_user_id"],
                "display_name": user.get("display_name"),
                "photo_url": profile_photo,  # Primary profile photo for BlurredImage
                "avatar_url": user.get("avatar_url", ""),  # Fallback only
                "thumbnail_url": user.get("thumbnail_url", ""),
                **blur_state
            })
    
    return {"incoming": incoming_list, "outgoing": outgoing_list}


@router.delete("/chat-request/{request_id}")
async def delete_chat_request(request_id: str, current_user: dict = Depends(get_current_user)):
    """
    Hide a chat request from user's own view (non-destructive).
    """
    chat_request = await db.chat_requests.find_one({
        "id": request_id,
        "$or": [
            {"from_user_id": current_user["id"]},
            {"to_user_id": current_user["id"]}
        ]
    })
    
    if not chat_request:
        raise HTTPException(status_code=404, detail="Chat request not found")
    
    is_sender = chat_request["from_user_id"] == current_user["id"]
    hidden_field = "hidden_by_sender" if is_sender else "hidden_by_recipient"
    
    await db.chat_requests.update_one(
        {"id": request_id},
        {"$set": {hidden_field: True, f"{hidden_field}_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    return {"message": "Chat request removed from your list"}


@router.post("/chat-requests/bulk-delete")
async def bulk_delete_chat_requests(data: dict, current_user: dict = Depends(get_current_user)):
    """
    Bulk hide chat requests from user's own view (non-destructive).
    
    Request body: {"request_ids": ["id1", "id2", ...]}
    """
    request_ids = data.get("request_ids", [])
    if not request_ids:
        raise HTTPException(status_code=400, detail="No request IDs provided")
    
    hidden_count = 0
    for request_id in request_ids:
        chat_request = await db.chat_requests.find_one({
            "id": request_id,
            "$or": [
                {"from_user_id": current_user["id"]},
                {"to_user_id": current_user["id"]}
            ]
        })
        
        if chat_request:
            is_sender = chat_request["from_user_id"] == current_user["id"]
            hidden_field = "hidden_by_sender" if is_sender else "hidden_by_recipient"
            await db.chat_requests.update_one(
                {"id": request_id},
                {"$set": {hidden_field: True, f"{hidden_field}_at": datetime.now(timezone.utc).isoformat()}}
            )
            hidden_count += 1
    
    return {"message": f"Removed {hidden_count} chat requests from your list", "count": hidden_count}


# ============================================================================
# MESSAGE ROUTES
# ============================================================================

@router.get("/messages/threads")
async def get_message_threads(current_user: dict = Depends(get_current_user)):
    """Get all message threads"""
    # Get unique users we have messages with
    sent_to = await db.messages.distinct("to_user_id", {"from_user_id": current_user["id"]})
    received_from = await db.messages.distinct("from_user_id", {"to_user_id": current_user["id"]})
    
    all_users = list(set(sent_to + received_from))
    
    threads = []
    for user_id in all_users:
        user = await db.users.find_one({"id": user_id}, {"_id": 0, "password": 0})
        if not user:
            continue
        
        last_msg = await db.messages.find_one(
            {"$or": [
                {"from_user_id": current_user["id"], "to_user_id": user_id},
                {"from_user_id": user_id, "to_user_id": current_user["id"]}
            ]},
            {"_id": 0},
            sort=[("created_at", -1)]
        )
        
        unread = await db.messages.count_documents({
            "from_user_id": user_id,
            "to_user_id": current_user["id"],
            "is_read": False
        })
        
        # Convert photo IDs to URLs for the new avatar design
        photos = user.get("photos", [])
        photo_urls = [f"/api/photos/serve/{p}" for p in photos if p] if photos else []
        
        threads.append({
            "user_id": user_id,
            "display_name": user.get("display_name", "Unknown"),
            "avatar_url": user.get("avatar_url", ""),
            "photos": photo_urls,  # Full photos array for new avatar design
            "last_message": last_msg.get("content", "") if last_msg else "",
            "last_message_at": last_msg.get("created_at") if last_msg else "",
            "unread_count": unread
        })
    
    threads.sort(key=lambda x: x.get("last_message_at", ""), reverse=True)
    return threads


@router.post("/messages")
async def send_message(data: MessageCreate, current_user: dict = Depends(get_current_user)):
    """Send a message to another user"""
    # Check if chat is unlocked
    unlock_status = await check_chat_unlocked(current_user["id"], data.to_user_id)
    if not unlock_status["is_unlocked"]:
        raise HTTPException(status_code=403, detail="Chat not unlocked with this user")
    
    # Check blocks
    target_user = await db.users.find_one({"id": data.to_user_id}, {"_id": 0})
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")
    
    if current_user["id"] in target_user.get("blocked_users", []):
        raise HTTPException(status_code=403, detail="Cannot message this user")
    
    if data.to_user_id in current_user.get("blocked_users", []):
        raise HTTPException(status_code=403, detail="You have blocked this user")
    
    message_id = str(uuid.uuid4())
    message = {
        "id": message_id,
        "from_user_id": current_user["id"],
        "to_user_id": data.to_user_id,
        "content": data.content,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "is_read": False
    }
    await db.messages.insert_one(message)
    
    return {
        "id": message_id,
        "from_user_id": current_user["id"],
        "from_user_name": current_user["display_name"],
        "from_user_avatar": current_user.get("avatar_url", ""),
        "to_user_id": data.to_user_id,
        "content": data.content,
        "created_at": message["created_at"],
        "is_read": False
    }


@router.get("/messages/{user_id}")
async def get_messages(user_id: str, current_user: dict = Depends(get_current_user)):
    """Get messages with a specific user"""
    # Check if user is blocked (bilateral check)
    is_blocked = (
        user_id in current_user.get("blocked_users", []) or
        user_id in current_user.get("blocked_by_users", [])
    )
    
    messages = await db.messages.find({
        "$or": [
            {"from_user_id": current_user["id"], "to_user_id": user_id},
            {"from_user_id": user_id, "to_user_id": current_user["id"]}
        ]
    }, {"_id": 0}).sort("created_at", 1).to_list(500)
    
    # Mark received messages as read (only if not blocked)
    if not is_blocked:
        await db.messages.update_many(
            {"from_user_id": user_id, "to_user_id": current_user["id"], "is_read": False},
            {"$set": {"is_read": True, "read_at": datetime.now(timezone.utc).isoformat()}}
        )
    
    # Get user info for response
    other_user = await db.users.find_one({"id": user_id}, {"_id": 0, "password": 0})
    
    # Check reveal status
    i_revealed = await db.reveals.find_one({
        "from_user_id": current_user["id"],
        "to_user_id": user_id
    })
    they_revealed = await db.reveals.find_one({
        "from_user_id": user_id,
        "to_user_id": current_user["id"]
    })
    is_revealed = bool(i_revealed and they_revealed)
    
    result = []
    for msg in messages:
        if msg["from_user_id"] == current_user["id"]:
            result.append({
                **msg,
                "from_user_name": current_user["display_name"],
                "from_user_avatar": current_user.get("avatar_url", ""),
                "is_request": False,
                "is_masked": False
            })
        else:
            result.append({
                **msg,
                "from_user_name": other_user.get("display_name", "Unknown") if other_user else "Unknown",
                "from_user_avatar": other_user.get("avatar_url", "") if other_user else "",
                "is_request": False,
                "is_masked": False
            })
    
    # Convert photo IDs to URLs
    photos = other_user.get("photos", []) if other_user else []
    photo_urls = [f"/api/photos/serve/{p}" for p in photos if p] if photos else []
    
    return {
        "messages": result,
        "is_unlocked": True,
        "is_revealed": is_revealed,
        "is_blocked": is_blocked,
        "unlock_reason": "connection",
        "other_user": {
            "id": user_id,
            "display_name": other_user.get("display_name", "Someone") if other_user else "Someone",
            "avatar_url": other_user.get("avatar_url", "") if other_user else "",
            "photos": photo_urls
        }
    }


@router.post("/messages/mark-read")
async def mark_messages_read(data: MarkMessagesRead, current_user: dict = Depends(get_current_user)):
    """Mark messages as read"""
    result = await db.messages.update_many(
        {"id": {"$in": data.message_ids}, "to_user_id": current_user["id"]},
        {"$set": {"is_read": True, "read_at": datetime.now(timezone.utc).isoformat()}}
    )
    return {"marked_count": result.modified_count}


@router.get("/messages/unread/count")
async def get_unread_count(current_user: dict = Depends(get_current_user)):
    """Get total unread message count"""
    count = await db.messages.count_documents({"to_user_id": current_user["id"], "is_read": False})
    return {"unread_count": count}


@router.delete("/messages/conversation/{other_user_id}")
async def delete_conversation(other_user_id: str, current_user: dict = Depends(get_current_user)):
    """Delete all messages in a conversation"""
    await db.messages.delete_many({
        "$or": [
            {"from_user_id": current_user["id"], "to_user_id": other_user_id},
            {"from_user_id": other_user_id, "to_user_id": current_user["id"]}
        ]
    })
    return {"message": "Conversation deleted"}



# ============================================================================
# HIDDEN USERS ("NOT FOR NOW") ROUTES
# ============================================================================

@router.post("/users/{user_id}/hide")
async def hide_user(user_id: str, current_user: dict = Depends(get_current_user)):
    """
    Hide a user from feed for 90 days.
    Does not block or notify the other user.
    """
    now = datetime.now(timezone.utc)
    expires_at = now + timedelta(days=90)
    
    # Check if already hidden
    existing = await db.hidden_users.find_one({
        "hidden_by": current_user["id"],
        "hidden_user_id": user_id
    })
    
    if existing:
        # Update expiration
        await db.hidden_users.update_one(
            {"_id": existing["_id"]},
            {"$set": {"expires_at": expires_at.isoformat(), "hidden_at": now.isoformat()}}
        )
    else:
        # Create new hidden entry
        await db.hidden_users.insert_one({
            "id": str(uuid.uuid4()),
            "hidden_by": current_user["id"],
            "hidden_user_id": user_id,
            "hidden_at": now.isoformat(),
            "expires_at": expires_at.isoformat()
        })
    
    return {"message": "User hidden for 90 days", "expires_at": expires_at.isoformat()}


@router.delete("/users/{user_id}/hide")
async def unhide_user(user_id: str, current_user: dict = Depends(get_current_user)):
    """Unhide a user before the 90-day period ends"""
    await db.hidden_users.delete_one({
        "hidden_by": current_user["id"],
        "hidden_user_id": user_id
    })
    return {"message": "User unhidden"}


@router.get("/users/hidden")
async def get_hidden_users(current_user: dict = Depends(get_current_user)):
    """Get list of hidden users"""
    now = datetime.now(timezone.utc)
    
    # Clean up expired entries
    await db.hidden_users.delete_many({
        "hidden_by": current_user["id"],
        "expires_at": {"$lt": now.isoformat()}
    })
    
    # Get active hidden users
    hidden = await db.hidden_users.find(
        {"hidden_by": current_user["id"]},
        {"_id": 0}
    ).to_list(100)
    
    return hidden


# ============================================================================
# PHOTO REVEAL ROUTES
# ============================================================================

@router.post("/reveal/{other_user_id}")
async def reveal_photo(other_user_id: str, current_user: dict = Depends(get_current_user)):
    """
    Reveal your photo to another matched user.
    Only works if users are matched.
    """
    # Check if matched
    is_matched = await check_if_matched(current_user["id"], other_user_id)
    if not is_matched:
        raise HTTPException(status_code=400, detail="You must be matched to reveal your photo")
    
    now = datetime.now(timezone.utc)
    
    # Check if already revealed
    existing = await db.reveals.find_one({
        "revealer_id": current_user["id"],
        "revealed_to_id": other_user_id
    })
    
    if existing:
        return {"message": "Already revealed", "revealed_at": existing.get("revealed_at")}
    
    # Create reveal record
    await db.reveals.insert_one({
        "id": str(uuid.uuid4()),
        "revealer_id": current_user["id"],
        "revealed_to_id": other_user_id,
        "revealed_at": now.isoformat()
    })
    
    # Send push notification to the other user (uses "matches" channel)
    settings = await db.push_settings.find_one({"user_id": other_user_id})
    if not settings or settings.get("matches", True):
        first_name = get_first_name(current_user.get("display_name", "Someone"))
        await send_push_notification_from_route(
            other_user_id,
            "Someone revealed to you!",
            f"{first_name} has revealed their photo. Reveal back to see each other clearly!",
            {"type": "reveal", "from_user_id": current_user["id"]}
        )
    
    # Check if mutual reveal (both have revealed)
    mutual = await db.reveals.find_one({
        "revealer_id": other_user_id,
        "revealed_to_id": current_user["id"]
    })
    
    return {
        "message": "Photo revealed",
        "revealed_at": now.isoformat(),
        "is_mutual": mutual is not None
    }


@router.get("/reveal/status/{other_user_id}")
async def get_reveal_status(other_user_id: str, current_user: dict = Depends(get_current_user)):
    """Get reveal status between current user and another user"""
    
    # Did I reveal to them?
    i_revealed = await db.reveals.find_one({
        "revealer_id": current_user["id"],
        "revealed_to_id": other_user_id
    })
    
    # Did they reveal to me?
    they_revealed = await db.reveals.find_one({
        "revealer_id": other_user_id,
        "revealed_to_id": current_user["id"]
    })
    
    return {
        "i_revealed": i_revealed is not None,
        "they_revealed": they_revealed is not None,
        "is_mutual": i_revealed is not None and they_revealed is not None
    }


# ============================================================================
# MATCH STATUS HELPER
# ============================================================================

async def check_if_matched(user_id: str, other_user_id: str) -> bool:
    """
    Check if two users are matched via any method:
    - icebreaker_accepted
    - chat_request_accepted
    - mutual_glance
    - explicit_connection
    - mutual_messagers
    """
    # Check explicit connections
    connection = await db.connections.find_one({
        "$or": [
            {"user1_id": user_id, "user2_id": other_user_id},
            {"user1_id": other_user_id, "user2_id": user_id}
        ]
    })
    if connection:
        return True
    
    # Check accepted icebreakers
    icebreaker = await db.icebreakers.find_one({
        "$or": [
            {"from_user_id": user_id, "to_user_id": other_user_id, "status": "accepted"},
            {"from_user_id": other_user_id, "to_user_id": user_id, "status": "accepted"}
        ]
    })
    if icebreaker:
        return True
    
    # Check accepted chat requests
    chat_request = await db.chat_requests.find_one({
        "$or": [
            {"from_user_id": user_id, "to_user_id": other_user_id, "status": "accepted"},
            {"from_user_id": other_user_id, "to_user_id": user_id, "status": "accepted"}
        ]
    })
    if chat_request:
        return True
    
    # Check mutual glances
    glance_to = await db.glances.find_one({"from_user_id": user_id, "to_user_id": other_user_id})
    glance_from = await db.glances.find_one({"from_user_id": other_user_id, "to_user_id": user_id})
    if glance_to and glance_from:
        return True
    
    # Check mutual messages
    sent = await db.messages.find_one({"from_user_id": user_id, "to_user_id": other_user_id})
    received = await db.messages.find_one({"from_user_id": other_user_id, "to_user_id": user_id})
    if sent and received:
        return True
    
    return False


@router.get("/match/status/{other_user_id}")
async def get_match_status(other_user_id: str, current_user: dict = Depends(get_current_user)):
    """Get detailed match status with another user"""
    is_matched = await check_if_matched(current_user["id"], other_user_id)
    
    # Determine match type
    match_type = None
    if is_matched:
        # Check each type in order
        connection = await db.connections.find_one({
            "$or": [
                {"user1_id": current_user["id"], "user2_id": other_user_id},
                {"user1_id": other_user_id, "user2_id": current_user["id"]}
            ]
        })
        if connection:
            match_type = "explicit_connection"
        else:
            icebreaker = await db.icebreakers.find_one({
                "$or": [
                    {"from_user_id": current_user["id"], "to_user_id": other_user_id, "status": "accepted"},
                    {"from_user_id": other_user_id, "to_user_id": current_user["id"], "status": "accepted"}
                ]
            })
            if icebreaker:
                match_type = "icebreaker_accepted"
            else:
                chat_request = await db.chat_requests.find_one({
                    "$or": [
                        {"from_user_id": current_user["id"], "to_user_id": other_user_id, "status": "accepted"},
                        {"from_user_id": other_user_id, "to_user_id": current_user["id"], "status": "accepted"}
                    ]
                })
                if chat_request:
                    match_type = "chat_request_accepted"
                else:
                    glance_to = await db.glances.find_one({"from_user_id": current_user["id"], "to_user_id": other_user_id})
                    glance_from = await db.glances.find_one({"from_user_id": other_user_id, "to_user_id": current_user["id"]})
                    if glance_to and glance_from:
                        match_type = "mutual_glance"
                    else:
                        match_type = "mutual_messagers"
    
    # Get reveal status
    i_revealed = await db.photo_reveals.find_one({
        "revealer_id": current_user["id"],
        "revealed_to_id": other_user_id
    })
    they_revealed = await db.photo_reveals.find_one({
        "revealer_id": other_user_id,
        "revealed_to_id": current_user["id"]
    })
    
    return {
        "is_matched": is_matched,
        "match_type": match_type,
        "reveal_state": {
            "i_revealed": i_revealed is not None,
            "they_revealed": they_revealed is not None,
            "is_mutual": i_revealed is not None and they_revealed is not None
        }
    }
