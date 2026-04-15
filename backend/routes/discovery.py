"""
Discovery Routes
Handles discovery of users in "Here" and "Not Here" modes, proximity echoes.
"""
from fastapi import APIRouter, Depends, HTTPException
from typing import List, Optional
from datetime import datetime, timezone, timedelta

from .dependencies import (
    db, get_current_user, IS_TEST_BUILD,
    WhoIsHereUser,
    calculate_distance_miles,
    is_checkin_valid, get_first_name, check_dating_compatibility,
    check_visibility_match, get_photo_url
)

router = APIRouter()

# Fake test users for test mode
FAKE_TEST_USERS = []


# ============================================================================
# DISCOVERY ROUTES
# ============================================================================

@router.get("/discovery/not-here", response_model=List[WhoIsHereUser])
async def get_people_not_here(
    radius: str = "0-10",  # "0-10" or "10-25" miles
    current_user: dict = Depends(get_current_user)
):
    """
    Get people nearby within 0-25 mile radius (Not Here mode).
    Shows all visible users within range who are NOT at a venue.
    Only shows users with presence_status = "not_here" (or no presence set).
    
    PRESENCE LOGIC: Accessing Not Here mode automatically:
    - Checks out user from any active venue check-ins
    - Sets presence_status to "not_here"
    """
    now = datetime.now(timezone.utc)
    
    # =========================================================================
    # MUTUAL EXCLUSIVITY: Check out from any venue when entering Not Here mode
    # =========================================================================
    active_checkin = await db.checkins.find_one({
        "user_id": current_user["id"],
        "is_active": True
    })
    
    if active_checkin:
        # Auto-checkout from venue
        await db.checkins.update_one(
            {"id": active_checkin["id"]},
            {"$set": {
                "is_active": False, 
                "checked_out_at": now.isoformat(),
                "auto_checkout_reason": "switched_to_not_here"
            }}
        )
    
    # Update user's presence status to "not_here"
    await db.users.update_one(
        {"id": current_user["id"]},
        {"$set": {"presence_status": "not_here", "last_active_at": now.isoformat()}}
    )
    
    # Check if current user has a profile photo
    current_user_photos = current_user.get("photos", []) or []
    current_user_avatar = current_user.get("avatar_url", "")
    if not current_user_photos and not current_user_avatar:
        raise HTTPException(status_code=403, detail="Please upload a profile photo to see who's nearby")
    
    # Get current user's location
    user_lat = current_user.get("lat")
    user_lng = current_user.get("lng")
    
    # If user has no location, try to get from active checkin venue
    if not user_lat or not user_lng:
        current_checkin = await db.checkins.find_one({
            "user_id": current_user["id"],
            "is_active": True
        }, {"_id": 0})
        
        if current_checkin:
            venue = await db.venues.find_one({"id": current_checkin["venue_id"]}, {"_id": 0})
            if venue:
                user_lat = venue.get("latitude") or venue.get("lat")
                user_lng = venue.get("longitude") or venue.get("lng")
        
        if not user_lat or not user_lng:
            raise HTTPException(status_code=400, detail="Location required. Please enable GPS to see nearby users.")
    
    # Parse radius - flexible format
    try:
        parts = radius.split("-")
        min_miles = int(parts[0]) if len(parts) > 0 else 0
        max_miles = int(parts[1]) if len(parts) > 1 else 25
    except:
        min_miles = 0
        max_miles = 25
    
    # Find visible users - including current user (self)
    # Users with presence_status = "not_here" OR presence_status not set (default to not_here)
    users = await db.users.find({
        "$and": [
            {
                "$or": [
                    {"visibility": "visible"},
                    {"visibility": {"$exists": False}, "is_visible": True},
                    {"visibility": {"$exists": False}, "is_visible": {"$exists": False}}
                ]
            },
            {
                "$or": [
                    {"presence_status": "not_here"},
                    {"presence_status": {"$exists": False}}
                ]
            }
        ]
        # NOTE: Removed "id": {"$ne": current_user["id"]} - include self in feed
    }, {"_id": 0, "password": 0}).to_list(500)
    
    people = []
    current_user_entry = None
    
    for user in users:
        is_self = user["id"] == current_user["id"]
        
        # Skip users with hidden visibility (but not self)
        if not is_self and user.get("visibility") == "hidden":
            continue
            
        # Skip users without photos (but not self)
        user_photos = user.get("photos", []) or []
        user_avatar = user.get("avatar_url", "")
        if not is_self and not user_photos and not user_avatar:
            continue
        
        # Calculate distance (need user location)
        target_lat = user.get("lat")
        target_lng = user.get("lng")
        
        # For self, distance is 0; for others, require location
        if is_self:
            distance = 0
        elif not target_lat or not target_lng:
            continue
        else:
            distance = calculate_distance_miles(user_lat, user_lng, target_lat, target_lng)
        
        # Filter by radius (but not self - always include self)
        if not is_self and (distance < min_miles or distance > max_miles):
            continue
        
        # Visibility check - skip for self
        if not is_self and not check_visibility_match(current_user, user):
            continue
        
        # For self, mark appropriately - show as PRE-REVEAL (how others see them)
        if is_self:
            has_glanced_at_me = False
            i_glanced_at = False
            is_connected = False
            is_connection_accepted = False  # Self shows with heavy blur (as others see them)
            is_revealed = False  # Self should see their card as others see it (blurred/pre-reveal)
            is_mutual_glance = False
            icebreaker_sent = False
            icebreaker_received = False
        else:
            # Check glance status
            has_glanced_at_me = await db.glances.find_one({
                "from_user_id": user["id"],
                "to_user_id": current_user["id"]
            }) is not None
            
            i_glanced_at = await db.glances.find_one({
                "from_user_id": current_user["id"],
                "to_user_id": user["id"]
            }) is not None
            
            # Check connection status (created when icebreaker/chat request is accepted)
            is_connected = await db.connections.find_one({
                "$or": [
                    {"user1_id": current_user["id"], "user2_id": user["id"]},
                    {"user1_id": user["id"], "user2_id": current_user["id"]}
                ]
            }) is not None
            
            # Check icebreaker status
            icebreaker_sent = await db.icebreakers.find_one({
                "from_user_id": current_user["id"],
                "to_user_id": user["id"]
            }) is not None
            
            icebreaker_received = await db.icebreakers.find_one({
                "from_user_id": user["id"],
                "to_user_id": current_user["id"],
                "status": "pending"
            }) is not None
            
            # REVEAL LOGIC - Two stages (same as venues):
            # 1. is_connection_accepted = mutual glance OR accepted icebreaker/chat (gives 6px medium blur)
            # 2. is_revealed = ONLY when both users explicitly press "Reveal" button (gives 0px clear)
            # Note: Presence/venue status NEVER triggers reveal
            is_mutual_glance = has_glanced_at_me and i_glanced_at
            
            # Check for accepted icebreaker (either direction)
            accepted_icebreaker = await db.icebreakers.find_one({
                "$or": [
                    {"from_user_id": current_user["id"], "to_user_id": user["id"], "status": "accepted"},
                    {"from_user_id": user["id"], "to_user_id": current_user["id"], "status": "accepted"}
                ]
            })
            
            # Check for accepted chat request (either direction)
            accepted_chat = await db.chat_requests.find_one({
                "$or": [
                    {"from_user_id": current_user["id"], "to_user_id": user["id"], "status": "accepted"},
                    {"from_user_id": user["id"], "to_user_id": current_user["id"], "status": "accepted"}
                ]
            })
            
            # is_connection_accepted = mutual glance OR accepted icebreaker/chat (medium blur - 6px)
            is_connection_accepted = is_mutual_glance or bool(accepted_icebreaker) or bool(accepted_chat)
            
            # Check for explicit reveal (both users pressed reveal button)
            # Only truly revealed if BOTH users have pressed reveal (clear - 0px)
            i_revealed = await db.reveals.find_one({
                "from_user_id": current_user["id"],
                "to_user_id": user["id"]
            }) is not None
            
            they_revealed = await db.reveals.find_one({
                "from_user_id": user["id"],
                "to_user_id": current_user["id"]
            }) is not None
            
            is_revealed = i_revealed and they_revealed
        
        first_name = get_first_name(user.get("display_name", "Someone"))
        
        # Calculate age from date_of_birth if not already set
        user_age = user.get("age")
        if not user_age and user.get("date_of_birth"):
            try:
                dob = datetime.fromisoformat(user["date_of_birth"].replace("Z", "+00:00"))
                today = datetime.now(timezone.utc)
                user_age = today.year - dob.year - ((today.month, today.day) < (dob.month, dob.day))
            except Exception:
                pass
        
        # Get photo URL with appropriate blur based on reveal status
        # Self card should NEVER be blurred (user always sees their own photo clearly)
        blur_photos = not is_revealed and not is_self
        avatar_url = get_photo_url(user.get("avatar_url", ""), blur=blur_photos)
        
        entry = {
            "id": user["id"],
            "display_name": user["display_name"] if is_revealed else first_name,
            "first_name": first_name,
            "age": user_age,
            "avatar_url": avatar_url,
            "bio": user.get("bio", "") if is_revealed else "",
            "interests": user.get("interests", []) if is_revealed else [],
            "checked_in_at": None,
            "has_glanced_at_me": has_glanced_at_me,
            "i_glanced_at": i_glanced_at,
            "is_connected": is_connected,
            "is_mutual": is_mutual_glance,  # Both users have glanced at each other
            "is_connection_accepted": is_connection_accepted,  # For blur logic: mutual glance OR accepted icebreaker/chat (6px)
            "is_revealed": is_revealed,  # ONLY when both users explicitly pressed reveal (0px)
            "is_premium": user.get("is_premium", False),
            "last_active_at": user.get("last_active_at"),
            "presence_note": user.get("presence_note", ""),
            "celebrity_crush": user.get("celebrity_crush", ""),
            "shy_indicator": user.get("shy_indicator", False),
            "voice_intro_url": user.get("voice_intro_url", "") if is_revealed else "",
            "distance_miles": round(distance, 1),
            "show_as": user.get("show_as", ""),
            "rainbow": user.get("rainbow", False),
            "open_to_all": user.get("open_to_all", False),
            "intent": user.get("intent", ""),
            "is_self": is_self,
            "icebreaker_sent": icebreaker_sent,
            "icebreaker_received": icebreaker_received,
        }
        
        if is_self:
            current_user_entry = entry
        else:
            people.append(entry)
    
    # Sort: Premium first, then by distance
    premium = [p for p in people if p.get("is_premium")]
    non_premium = [p for p in people if not p.get("is_premium")]
    
    premium.sort(key=lambda x: x.get("distance_miles", 999))
    non_premium.sort(key=lambda x: x.get("distance_miles", 999))
    
    # Put current user at the beginning
    result = []
    if current_user_entry:
        result.append(current_user_entry)
    result.extend(premium + non_premium)
    
    return result


@router.get("/discovery/here", response_model=List[WhoIsHereUser])
async def get_people_here(
    radius: str = "0-25",  # Full 0-25 mile radius
    current_user: dict = Depends(get_current_user)
):
    """
    Get people who have set their presence to "Here" within 0-25 mile radius.
    Includes the current user as the first item with is_self=true.
    """
    # Check if current user has a profile photo
    current_user_photos = current_user.get("photos", []) or []
    current_user_avatar = current_user.get("avatar_url", "")
    if not current_user_photos and not current_user_avatar:
        raise HTTPException(status_code=403, detail="Please upload a profile photo to see who's here")
    
    # Get current user's location
    user_lat = current_user.get("lat")
    user_lng = current_user.get("lng")
    
    if not user_lat or not user_lng:
        current_checkin = await db.checkins.find_one({
            "user_id": current_user["id"],
            "is_active": True
        }, {"_id": 0})
        
        if current_checkin:
            venue = await db.venues.find_one({"id": current_checkin["venue_id"]}, {"_id": 0})
            if venue:
                user_lat = venue.get("latitude") or venue.get("lat")
                user_lng = venue.get("longitude") or venue.get("lng")
        
        if not user_lat or not user_lng:
            raise HTTPException(status_code=400, detail="Location required. Please enable GPS to see nearby users.")
    
    now = datetime.now(timezone.utc)
    
    await db.users.update_one(
        {"id": current_user["id"]},
        {"$set": {"last_active_at": now.isoformat()}}
    )
    
    # Calculate 1-hour cutoff for Here & Now visibility
    here_now_cutoff = (now - timedelta(hours=1)).isoformat()
    
    # Build the self card first (current user's own entry)
    self_card = None
    current_user_checkin = await db.checkins.find_one({
        "user_id": current_user["id"],
        "is_active": True
    }, {"_id": 0})
    
    # Only include self card if user is in Here & Now mode (has discovery_mode = "here_now")
    if current_user.get("discovery_mode") == "here_now":
        first_name = get_first_name(current_user.get("display_name", "You"))
        
        # Calculate age from date_of_birth if not already set
        current_age = current_user.get("age")
        if not current_age and current_user.get("date_of_birth"):
            try:
                dob = datetime.fromisoformat(current_user["date_of_birth"].replace("Z", "+00:00"))
                today = datetime.now(timezone.utc)
                current_age = today.year - dob.year - ((today.month, today.day) < (dob.month, dob.day))
            except Exception:
                pass
        
        self_card = {
            "id": current_user["id"],
            "display_name": current_user.get("display_name", "You"),
            "first_name": first_name,
            "age": current_age,
            "avatar_url": current_user.get("avatar_url", ""),
            "bio": "",  # Don't show bio on self card
            "interests": [],
            "checked_in_at": current_user_checkin.get("checked_in_at") if current_user_checkin else None,
            "has_glanced_at_me": False,
            "i_glanced_at": False,
            "is_connected": False,
            "is_revealed": False,  # Always show as pre-reveal (blurred or silhouette)
            "is_premium": current_user.get("is_premium", False),
            "last_active_at": current_user.get("last_active_at"),
            "presence_note": current_user.get("presence_note", ""),
            "celebrity_crush": "",
            "shy_indicator": current_user.get("shy_indicator", False),
            "voice_intro_url": "",
            "distance_miles": 0,
            "hide_photo_in_venues": current_user.get("hide_photo_in_venues", False),
            "is_self": True,  # Mark as self card
            "show_as": current_user.get("show_as", ""),
            "rainbow": current_user.get("rainbow", False),
            "open_to_all": current_user.get("open_to_all", False),
            "intent": current_user.get("intent", ""),
        }
    
    # Find visible users with presence_status = "here" who were active in last 1 hour
    users = await db.users.find({
        "$and": [
            {
                "$or": [
                    {"visibility": "visible"},
                    {"visibility": {"$exists": False}, "is_visible": True}
                ]
            },
            {"presence_status": "here"},
            # Only show users active in last 1 hour (inactivity auto-checkout rule)
            {"last_active_at": {"$gte": here_now_cutoff}}
        ],
        "id": {"$ne": current_user["id"]}
    }, {"_id": 0, "password": 0}).to_list(500)
    
    people = []
    for user in users:
        if user.get("visibility") == "hidden":
            continue
            
        user_photos = user.get("photos", []) or []
        user_avatar = user.get("avatar_url", "")
        if not user_photos and not user_avatar:
            continue
        
        target_lat = user.get("lat")
        target_lng = user.get("lng")
        
        if not target_lat or not target_lng:
            continue
        
        distance = calculate_distance_miles(user_lat, user_lng, target_lat, target_lng)
        
        # Filter by 25 mile radius
        if distance > 25:
            continue
        
        # Dating compatibility filter
        if not check_dating_compatibility(current_user, user):
            continue
        
        # Gender/Rainbow visibility filter
        if not check_visibility_match(current_user, user):
            continue
        
        # Check glance status
        has_glanced_at_me = await db.glances.find_one({
            "from_user_id": user["id"],
            "to_user_id": current_user["id"]
        }) is not None
        
        i_glanced_at = await db.glances.find_one({
            "from_user_id": current_user["id"],
            "to_user_id": user["id"]
        }) is not None
        
        is_connected = await db.connections.find_one({
            "$or": [
                {"user1_id": current_user["id"], "user2_id": user["id"]},
                {"user1_id": user["id"], "user2_id": current_user["id"]}
            ]
        }) is not None
        
        # Check icebreaker status
        icebreaker_sent = await db.icebreakers.find_one({
            "from_user_id": current_user["id"],
            "to_user_id": user["id"]
        }) is not None
        
        icebreaker_received = await db.icebreakers.find_one({
            "from_user_id": user["id"],
            "to_user_id": current_user["id"],
            "status": "pending"
        }) is not None
        
        # REVEAL LOGIC - Two triggers:
        # 1. Mutual glance (both users glanced at each other)
        # 2. Accepted icebreaker/chat request (creates connection)
        # Note: Presence/venue status NEVER triggers reveal
        is_mutual_glance = has_glanced_at_me and i_glanced_at
        
        # Check for accepted icebreaker (either direction)
        accepted_icebreaker = await db.icebreakers.find_one({
            "$or": [
                {"from_user_id": current_user["id"], "to_user_id": user["id"], "status": "accepted"},
                {"from_user_id": user["id"], "to_user_id": current_user["id"], "status": "accepted"}
            ]
        })
        
        # Check for accepted chat request (either direction)
        accepted_chat = await db.chat_requests.find_one({
            "$or": [
                {"from_user_id": current_user["id"], "to_user_id": user["id"], "status": "accepted"},
                {"from_user_id": user["id"], "to_user_id": current_user["id"], "status": "accepted"}
            ]
        })
        
        # Revealed if: mutual glance OR accepted icebreaker/chat OR connected
        is_revealed = is_mutual_glance or bool(accepted_icebreaker) or bool(accepted_chat) or is_connected
        
        first_name = get_first_name(user.get("display_name", "Someone"))
        
        # Calculate age from date_of_birth if not already set
        user_age = user.get("age")
        if not user_age and user.get("date_of_birth"):
            try:
                dob = datetime.fromisoformat(user["date_of_birth"].replace("Z", "+00:00"))
                today = datetime.now(timezone.utc)
                user_age = today.year - dob.year - ((today.month, today.day) < (dob.month, dob.day))
            except Exception:
                pass
        
        # Get their current venue if checked in
        user_checkin = await db.checkins.find_one({
            "user_id": user["id"],
            "is_active": True
        }, {"_id": 0})
        
        venue_name = None
        if user_checkin and is_checkin_valid(user_checkin):
            venue = await db.venues.find_one({"id": user_checkin["venue_id"]}, {"_id": 0})
            if venue:
                venue_name = venue.get("name")
        
        # Get photo URL with appropriate blur based on reveal status
        blur_photos = not is_revealed
        avatar_url = get_photo_url(user.get("avatar_url", ""), blur=blur_photos)
        
        people.append({
            "id": user["id"],
            "display_name": user["display_name"] if is_revealed else first_name,
            "first_name": first_name,
            "age": user_age,
            "avatar_url": avatar_url,
            "bio": user.get("bio", "") if is_revealed else "",
            "interests": user.get("interests", []) if is_revealed else [],
            "checked_in_at": user_checkin.get("checked_in_at") if user_checkin else None,
            "has_glanced_at_me": has_glanced_at_me,
            "i_glanced_at": i_glanced_at,
            "is_connected": is_connected,
            "is_revealed": is_revealed,
            "is_premium": user.get("is_premium", False),
            "last_active_at": user.get("last_active_at"),
            "presence_note": user.get("presence_note", ""),
            "celebrity_crush": user.get("celebrity_crush", ""),
            "shy_indicator": user.get("shy_indicator", False),
            "voice_intro_url": user.get("voice_intro_url", "") if is_revealed else "",
            "distance_miles": round(distance, 1),
            "venue_name": venue_name if is_revealed else None,
            "show_as": user.get("show_as", ""),
            "rainbow": user.get("rainbow", False),
            "open_to_all": user.get("open_to_all", False),
            "icebreaker_sent": icebreaker_sent,
            "icebreaker_received": icebreaker_received,
        })
    
    # Sort: Premium first, then by distance
    premium = [p for p in people if p.get("is_premium")]
    non_premium = [p for p in people if not p.get("is_premium")]
    
    premium.sort(key=lambda x: x.get("distance_miles", 999))
    non_premium.sort(key=lambda x: x.get("distance_miles", 999))
    
    # Build final result: self card first (if present), then premium, then non-premium
    result = []
    if self_card:
        result.append(self_card)
    result.extend(premium + non_premium)
    
    return result


@router.get("/discovery/proximity-echoes")
async def get_proximity_echoes(current_user: dict = Depends(get_current_user)):
    """
    Get proximity echoes - users who were recently at the same venue.
    Shows users you might have "just missed" at venues.
    """
    # Get current user's recent check-ins (last 24 hours)
    now = datetime.now(timezone.utc)
    cutoff = now - timedelta(hours=24)
    
    recent_checkins = await db.checkins.find({
        "user_id": current_user["id"],
        "checked_in_at": {"$gte": cutoff.isoformat()}
    }, {"_id": 0}).to_list(50)
    
    venue_ids = list(set([c["venue_id"] for c in recent_checkins]))
    
    if not venue_ids:
        return []
    
    # Find other users who checked in at the same venues within the window
    echoes = []
    for venue_id in venue_ids:
        other_checkins = await db.checkins.find({
            "venue_id": venue_id,
            "user_id": {"$ne": current_user["id"]},
            "checked_in_at": {"$gte": cutoff.isoformat()}
        }, {"_id": 0}).to_list(50)
        
        for checkin in other_checkins:
            user = await db.users.find_one({"id": checkin["user_id"]}, {"_id": 0, "password": 0})
            if not user:
                continue
            
            # Skip hidden users
            if user.get("visibility") == "hidden" or not user.get("is_visible", True):
                continue
            
            # Dating compatibility filter
            if not check_dating_compatibility(current_user, user):
                continue
            
            # Gender/Rainbow visibility filter
            if not check_visibility_match(current_user, user):
                continue
            
            venue = await db.venues.find_one({"id": venue_id}, {"_id": 0})
            
            echoes.append({
                "user_id": user["id"],
                "display_name": get_first_name(user.get("display_name", "Someone")),
                "avatar_url": user.get("avatar_url", ""),
                "venue_id": venue_id,
                "venue_name": venue.get("name") if venue else "Unknown Venue",
                "checked_in_at": checkin.get("checked_in_at"),
                "is_premium": user.get("is_premium", False)
            })
    
    # Remove duplicates and sort by recency
    seen = set()
    unique_echoes = []
    for echo in sorted(echoes, key=lambda x: x.get("checked_in_at", ""), reverse=True):
        if echo["user_id"] not in seen:
            seen.add(echo["user_id"])
            unique_echoes.append(echo)
    
    return unique_echoes[:20]
