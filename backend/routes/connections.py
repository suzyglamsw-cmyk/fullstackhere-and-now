"""
Connections Routes
Handles glances, icebreakers, connections, messages, and chat requests.
"""
from fastapi import APIRouter, Depends, HTTPException
from typing import List, Optional
from datetime import datetime, timezone, timedelta
import uuid

from .dependencies import (
    db, get_current_user, IS_TEST_BUILD,
    FREE_DAILY_GLANCES, PREMIUM_DAILY_GLANCES,
    GlanceCreate, IcebreakerCreate, IcebreakerResponse, IcebreakerActionRequest,
    ConnectionResponse, MessageCreate, MessageResponse, MarkMessagesRead,
    calculate_safety_halo, get_first_name, check_chat_unlocked,
    ICEBREAKER_MESSAGES
)

router = APIRouter()

# Push notification helper (to be imported from server.py or defined here)
async def send_push_notification(user_id: str, title: str, body: str, data: dict = None):
    """Send push notification - placeholder, actual implementation in server.py"""
    pass


# ============================================================================
# GLANCE ROUTES
# ============================================================================

@router.post("/glance")
async def send_glance(data: GlanceCreate, current_user: dict = Depends(get_current_user)):
    """Send a glance to another user at a venue"""
    now = datetime.now(timezone.utc)
    
    # Check daily glance limit
    bypass_limits = IS_TEST_BUILD or current_user.get("bypass_glance_limits", False)
    
    is_premium = current_user.get("is_premium", False)
    daily_limit = PREMIUM_DAILY_GLANCES if is_premium else FREE_DAILY_GLANCES
    
    glances_reset_at = current_user.get("glances_reset_at")
    daily_used = current_user.get("daily_glances_used", 0)
    
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
    
    token_balance = current_user.get("token_balance", 0)
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
    """Get remaining daily glances"""
    is_premium = current_user.get("is_premium", False)
    daily_limit = PREMIUM_DAILY_GLANCES if is_premium else FREE_DAILY_GLANCES
    daily_used = current_user.get("daily_glances_used", 0)
    token_balance = current_user.get("token_balance", 0)
    
    now = datetime.now(timezone.utc)
    glances_reset_at = current_user.get("glances_reset_at")
    
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
    """Delete a glance (both sender and recipient can delete)"""
    # Allow deletion if user is either sender OR recipient
    result = await db.glances.delete_one({
        "id": glance_id,
        "$or": [
            {"from_user_id": current_user["id"]},
            {"to_user_id": current_user["id"]}
        ]
    })
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Glance not found")
    return {"message": "Glance removed"}


# ============================================================================
# ICEBREAKER ROUTES
# ============================================================================

@router.post("/icebreaker")
async def send_icebreaker(data: IcebreakerCreate, current_user: dict = Depends(get_current_user)):
    """Send an icebreaker to another user"""
    now = datetime.now(timezone.utc)
    
    target_user = await db.users.find_one({"id": data.to_user_id}, {"_id": 0})
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Check blocks (bilateral - soft error message)
    icebreaker_blocks = target_user.get("icebreaker_blocked_users", [])
    if current_user["id"] in icebreaker_blocks:
        raise HTTPException(status_code=403, detail="Sorry, this user is unavailable right now.")
    
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
    
    icebreaker_id = str(uuid.uuid4())
    icebreaker = {
        "id": icebreaker_id,
        "from_user_id": current_user["id"],
        "to_user_id": data.to_user_id,
        "venue_id": data.venue_id,
        "message_type": data.message_type,
        "message": ICEBREAKER_MESSAGES[data.message_type],
        "created_at": now.isoformat(),
        "status": "pending"
    }
    await db.icebreakers.insert_one(icebreaker)
    
    return {"message": "Icebreaker sent!", "icebreaker_id": icebreaker_id}


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
    
    elif request.action == "block_icebreakers":
        await db.icebreakers.update_one(
            {"id": icebreaker_id},
            {"$set": {"status": "declined", "responded_at": now.isoformat()}}
        )
        await db.users.update_one(
            {"id": current_user["id"]},
            {"$addToSet": {"icebreaker_blocked_users": icebreaker["from_user_id"]}}
        )
        return {"message": "User blocked from sending icebreakers", "status": "blocked_icebreakers"}
    
    elif request.action == "block_user":
        await db.icebreakers.update_one(
            {"id": icebreaker_id},
            {"$set": {"status": "declined", "responded_at": now.isoformat()}}
        )
        await db.users.update_one(
            {"id": current_user["id"]},
            {"$addToSet": {"blocked_users": icebreaker["from_user_id"]}}
        )
        return {"message": "User blocked", "status": "blocked"}
    
    raise HTTPException(status_code=400, detail="Invalid action")


@router.delete("/icebreaker/{icebreaker_id}")
async def delete_icebreaker(icebreaker_id: str, current_user: dict = Depends(get_current_user)):
    """Delete/withdraw an icebreaker"""
    result = await db.icebreakers.delete_one({
        "id": icebreaker_id,
        "from_user_id": current_user["id"]
    })
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Icebreaker not found")
    return {"message": "Icebreaker withdrawn"}


# ============================================================================
# CONNECTION ROUTES
# ============================================================================

@router.get("/connections")
async def get_connections(current_user: dict = Depends(get_current_user)):
    """Get all connections for current user"""
    connections = await db.connections.find({
        "$or": [
            {"user1_id": current_user["id"]},
            {"user2_id": current_user["id"]}
        ]
    }, {"_id": 0}).to_list(100)
    
    result = []
    for conn in connections:
        other_id = conn["user2_id"] if conn["user1_id"] == current_user["id"] else conn["user1_id"]
        other_user = await db.users.find_one({"id": other_id}, {"_id": 0, "password": 0})
        
        if not other_user:
            continue
        
        # Get venue name
        venue = await db.venues.find_one({"id": conn.get("venue_id", "")}, {"_id": 0})
        venue_name = venue.get("name", "Unknown") if venue else "Unknown"
        
        # Get last message
        last_msg = await db.messages.find_one(
            {"$or": [
                {"from_user_id": current_user["id"], "to_user_id": other_id},
                {"from_user_id": other_id, "to_user_id": current_user["id"]}
            ]},
            {"_id": 0},
            sort=[("created_at", -1)]
        )
        
        # Count unread
        unread_count = await db.messages.count_documents({
            "from_user_id": other_id,
            "to_user_id": current_user["id"],
            "is_read": False
        })
        
        result.append({
            "id": conn["id"],
            "user_id": other_id,
            "display_name": other_user.get("display_name", "Unknown"),
            "avatar_url": other_user.get("avatar_url", ""),
            "bio": other_user.get("bio", ""),
            "connected_at": conn.get("connected_at", ""),
            "venue_name": venue_name,
            "last_message": last_msg.get("content", "") if last_msg else None,
            "last_message_at": last_msg.get("created_at") if last_msg else None,
            "unread_count": unread_count,
            "is_premium": other_user.get("is_premium", False)
        })
    
    # Sort by last message time
    result.sort(key=lambda x: x.get("last_message_at") or x.get("connected_at", ""), reverse=True)
    
    return result


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
    """Get glances sent and received"""
    sent = await db.glances.find({"from_user_id": current_user["id"]}, {"_id": 0}).to_list(100)
    received = await db.glances.find({"to_user_id": current_user["id"]}, {"_id": 0}).to_list(100)
    
    # Check for mutual glances
    sent_to_ids = {g["to_user_id"] for g in sent}
    received_from_ids = {g["from_user_id"] for g in received}
    
    outgoing_list = []
    for g in sent:
        user = await db.users.find_one({"id": g["to_user_id"]}, {"_id": 0})
        if user:
            is_mutual = g["to_user_id"] in received_from_ids
            outgoing_list.append({
                **g,
                "user_id": g["to_user_id"],
                "display_name": user.get("display_name"),
                "avatar_url": user.get("avatar_url", ""),
                "is_mutual": is_mutual
            })
    
    incoming_list = []
    for g in received:
        user = await db.users.find_one({"id": g["from_user_id"]}, {"_id": 0})
        if user:
            is_mutual = g["from_user_id"] in sent_to_ids
            incoming_list.append({
                **g,
                "user_id": g["from_user_id"],
                "display_name": get_first_name(user.get("display_name")),
                "avatar_url": user.get("avatar_url", ""),
                "is_mutual": is_mutual
            })
    
    return {"incoming": incoming_list, "outgoing": outgoing_list}


@router.get("/connections/icebreakers")
async def get_icebreakers(current_user: dict = Depends(get_current_user)):
    """Get icebreakers sent and received"""
    sent = await db.icebreakers.find({"from_user_id": current_user["id"]}, {"_id": 0}).to_list(100)
    received = await db.icebreakers.find({"to_user_id": current_user["id"]}, {"_id": 0}).to_list(100)
    
    outgoing_list = []
    for ib in sent:
        user = await db.users.find_one({"id": ib["to_user_id"]}, {"_id": 0})
        if user:
            outgoing_list.append({
                **ib,
                "user_id": ib["to_user_id"],
                "display_name": user.get("display_name"),
                "avatar_url": user.get("avatar_url", "")
            })
    
    incoming_list = []
    for ib in received:
        user = await db.users.find_one({"id": ib["from_user_id"]}, {"_id": 0})
        if user:
            incoming_list.append({
                **ib,
                "user_id": ib["from_user_id"],
                "display_name": user.get("display_name"),
                "avatar_url": user.get("avatar_url", "")
            })
    
    return {"incoming": incoming_list, "outgoing": outgoing_list}



@router.get("/connections/chat-requests")
async def get_chat_requests(current_user: dict = Depends(get_current_user)):
    """Get chat requests sent and received"""
    sent = await db.chat_requests.find({"from_user_id": current_user["id"]}, {"_id": 0}).to_list(100)
    received = await db.chat_requests.find({"to_user_id": current_user["id"]}, {"_id": 0}).to_list(100)
    
    outgoing_list = []
    for req in sent:
        user = await db.users.find_one({"id": req["to_user_id"]}, {"_id": 0})
        if user:
            outgoing_list.append({
                **req,
                "user_id": req["to_user_id"],
                "display_name": user.get("display_name"),
                "avatar_url": user.get("avatar_url", "")
            })
    
    incoming_list = []
    for req in received:
        user = await db.users.find_one({"id": req["from_user_id"]}, {"_id": 0})
        if user:
            incoming_list.append({
                **req,
                "user_id": req["from_user_id"],
                "display_name": user.get("display_name"),
                "avatar_url": user.get("avatar_url", "")
            })
    
    return {"incoming": incoming_list, "outgoing": outgoing_list}


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
        
        threads.append({
            "user_id": user_id,
            "display_name": user.get("display_name", "Unknown"),
            "avatar_url": user.get("avatar_url", ""),
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
    messages = await db.messages.find({
        "$or": [
            {"from_user_id": current_user["id"], "to_user_id": user_id},
            {"from_user_id": user_id, "to_user_id": current_user["id"]}
        ]
    }, {"_id": 0}).sort("created_at", 1).to_list(500)
    
    # Mark received messages as read
    await db.messages.update_many(
        {"from_user_id": user_id, "to_user_id": current_user["id"], "is_read": False},
        {"$set": {"is_read": True, "read_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    # Get user info for response
    other_user = await db.users.find_one({"id": user_id}, {"_id": 0})
    
    result = []
    for msg in messages:
        if msg["from_user_id"] == current_user["id"]:
            result.append({
                **msg,
                "from_user_name": current_user["display_name"],
                "from_user_avatar": current_user.get("avatar_url", "")
            })
        else:
            result.append({
                **msg,
                "from_user_name": other_user.get("display_name", "Unknown") if other_user else "Unknown",
                "from_user_avatar": other_user.get("avatar_url", "") if other_user else ""
            })
    
    return result


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
